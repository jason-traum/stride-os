'use server';

import { db, races, raceResults, userSettings, workouts, Race, RaceResult } from '@/lib/db';
import { eq, desc, asc, and, gte, lte, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { calculateVDOT, calculatePaceZones, getWeatherPaceAdjustment } from '@/lib/training/vdot-calculator';
import { RACE_DISTANCES } from '@/lib/training/types';
import { buildPerformanceModel } from '@/lib/training/performance-model';
import { recordVdotEntry } from './vdot-history';
import { syncVdotFromPredictionEngine } from './vdot-sync';
import type { RacePriority } from '@/lib/schema';
import { isPublicAccessMode } from '@/lib/access-mode';
import {
  isWritableRole,
  resolveAuthRoleFromGetter,
  resolveEffectivePublicMode,
  resolveSessionModeOverrideFromGetter,
} from '@/lib/auth-access';

const METERS_PER_MILE = 1609.34;
const READ_ONLY_ERROR = "Oops, can't do that in guest mode! Public mode is read-only.";

type EffortLevel = 'all_out' | 'hard' | 'moderate' | 'easy';
type ConfidenceLevel = 'high' | 'medium' | 'low';

async function assertRaceWriteAccess() {
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  const role = resolveAuthRoleFromGetter(getCookie);
  const sessionOverride = resolveSessionModeOverrideFromGetter(getCookie);
  const publicModeEnabled = resolveEffectivePublicMode({
    role,
    sessionOverride,
    globalPublicMode: isPublicAccessMode(),
  });

  if (publicModeEnabled || !isWritableRole(role)) {
    throw new Error(READ_ONLY_ERROR);
  }
}

export interface RaceResultNormalization {
  equivalentTimeSeconds: number;
  equivalentVdot: number;
  weatherAdjustmentSecPerMile: number;
  elevationAdjustmentSecPerMile: number;
  effortMultiplier: number;
  confidenceWeight: number;
  confidence: ConfidenceLevel;
}

export interface RaceResultWithContext extends RaceResult {
  linkedWorkout?: {
    id: number;
    workoutType: string;
    avgHr: number | null;
    maxHr: number | null;
    weatherTempF: number | null;
    weatherHumidityPct: number | null;
    elevationGainFt: number | null;
  } | null;
  linkedRace?: {
    id: number;
    name: string;
    priority: string;
    targetTimeSeconds: number | null;
  } | null;
  effectiveEffortLevel: EffortLevel;
  normalization: RaceResultNormalization;
}

function getEffortMultiplier(effortLevel: EffortLevel): number {
  switch (effortLevel) {
    case 'all_out':
      return 1.0;
    case 'hard':
      return 0.98;
    case 'moderate':
      return 0.96;
    case 'easy':
      return 0.93;
    default:
      return 1.0;
  }
}

function inferEffortFromWorkout(workout: {
  workoutType: string;
  avgHr: number | null;
  maxHr: number | null;
}): EffortLevel {
  const wt = (workout.workoutType || '').toLowerCase();
  const avgHr = workout.avgHr || 0;
  const maxHr = workout.maxHr || 0;
  const hrRatio = maxHr > 0 ? avgHr / maxHr : null;

  if (wt === 'race') {
    if (hrRatio != null && hrRatio >= 0.9) return 'all_out';
    if (hrRatio != null && hrRatio >= 0.84) return 'hard';
    return 'moderate';
  }
  if (wt === 'interval' || wt === 'threshold' || wt === 'tempo') return 'hard';
  return 'moderate';
}

function getRaceSignalConfidence(
  effortLevel: EffortLevel,
  hasWeather: boolean,
  hasElevation: boolean,
): { confidence: ConfidenceLevel; confidenceWeight: number } {
  let score = effortLevel === 'all_out'
    ? 1.0
    : effortLevel === 'hard'
      ? 0.9
      : effortLevel === 'moderate'
        ? 0.78
        : 0.62;

  if (!hasWeather) score -= 0.05;
  if (!hasElevation) score -= 0.03;

  if (score >= 0.9) return { confidence: 'high', confidenceWeight: 1.0 };
  if (score >= 0.75) return { confidence: 'medium', confidenceWeight: 0.85 };
  return { confidence: 'low', confidenceWeight: 0.7 };
}

function getElevationAdjustmentSecPerMile(elevationGainFt: number | null, distanceMiles: number): number {
  if (!elevationGainFt || elevationGainFt <= 0 || distanceMiles <= 0) return 0;
  const gainPerMile = elevationGainFt / distanceMiles;
  return Math.round((gainPerMile / 100) * 12);
}

function normalizeRaceResult(
  result: RaceResult,
  linkedWorkout?: {
    weatherTempF: number | null;
    weatherHumidityPct: number | null;
    elevationGainFt: number | null;
  } | null,
  effortLevel?: EffortLevel
): RaceResultNormalization {
  const distanceMiles = result.distanceMeters / METERS_PER_MILE;
  const weatherAdjustmentSecPerMile =
    linkedWorkout?.weatherTempF != null && linkedWorkout?.weatherHumidityPct != null
      ? getWeatherPaceAdjustment(linkedWorkout.weatherTempF, linkedWorkout.weatherHumidityPct)
      : 0;
  const elevationAdjustmentSecPerMile = getElevationAdjustmentSecPerMile(linkedWorkout?.elevationGainFt ?? null, distanceMiles);
  const totalAdjustmentPerMile = Math.max(0, weatherAdjustmentSecPerMile + elevationAdjustmentSecPerMile);

  const weatherAdjustedTime = Math.max(
    result.finishTimeSeconds * 0.85,
    result.finishTimeSeconds - (totalAdjustmentPerMile * distanceMiles)
  );

  const multiplier = getEffortMultiplier(effortLevel ?? 'all_out');
  const equivalentTimeSeconds = Math.max(
    result.finishTimeSeconds * 0.82,
    Math.round(weatherAdjustedTime * multiplier)
  );
  const equivalentVdot = calculateVDOT(result.distanceMeters, equivalentTimeSeconds);

  const confidenceMeta = getRaceSignalConfidence(
    effortLevel ?? 'all_out',
    weatherAdjustmentSecPerMile > 0,
    elevationAdjustmentSecPerMile > 0
  );

  return {
    equivalentTimeSeconds,
    equivalentVdot,
    weatherAdjustmentSecPerMile,
    elevationAdjustmentSecPerMile,
    effortMultiplier: multiplier,
    confidenceWeight: confidenceMeta.confidenceWeight,
    confidence: confidenceMeta.confidence,
  };
}

// ==================== Races (Upcoming) ====================

export async function getRaces(profileId?: number) {
  return db.query.races.findMany({
    where: profileId ? eq(races.profileId, profileId) : undefined,
    orderBy: [asc(races.date)],
  });
}

export async function getUpcomingRaces(profileId?: number) {
  const today = new Date().toISOString().split('T')[0];
  const allRaces: Race[] = await db.query.races.findMany({
    where: profileId ? eq(races.profileId, profileId) : undefined,
    orderBy: [asc(races.date)],
  });
  return allRaces.filter((r: Race) => r.date >= today && r.status !== 'completed');
}

export async function getRace(id: number) {
  return db.query.races.findFirst({
    where: eq(races.id, id),
  });
}

export async function createRace(data: {
  name: string;
  date: string;
  distanceLabel: string;
  priority: RacePriority;
  targetTimeSeconds?: number;
  location?: string;
  notes?: string;
  profileId?: number;
}) {
  await assertRaceWriteAccess();
  const now = new Date().toISOString();

  // Get distance in meters from label
  const distanceInfo = RACE_DISTANCES[data.distanceLabel];
  const distanceMeters = distanceInfo?.meters || 0;

  // Calculate target pace if target time is provided
  const targetPaceSecondsPerMile = data.targetTimeSeconds && distanceInfo
    ? Math.round(data.targetTimeSeconds / distanceInfo.miles)
    : null;

  const [race] = await db.insert(races).values({
    name: data.name,
    date: data.date,
    distanceMeters,
    distanceLabel: data.distanceLabel,
    priority: data.priority,
    targetTimeSeconds: data.targetTimeSeconds ?? null,
    targetPaceSecondsPerMile,
    location: data.location ?? null,
    notes: data.notes ?? null,
    trainingPlanGenerated: false,
    profileId: data.profileId ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/races');
  revalidatePath('/today');
  revalidatePath('/plan');

  return race;
}

export async function updateRace(id: number, data: {
  name?: string;
  date?: string;
  distanceLabel?: string;
  priority?: RacePriority;
  targetTimeSeconds?: number | null;
  location?: string | null;
  notes?: string | null;
}) {
  await assertRaceWriteAccess();
  const now = new Date().toISOString();
  const existing = await getRace(id);

  if (!existing) {
    throw new Error('Race not found');
  }

  // Recalculate distance if label changed
  const distanceLabel = data.distanceLabel ?? existing.distanceLabel;
  const distanceInfo = RACE_DISTANCES[distanceLabel];
  const distanceMeters = distanceInfo?.meters ?? existing.distanceMeters;

  // Recalculate target pace if time changed
  const targetTimeSeconds = data.targetTimeSeconds !== undefined
    ? data.targetTimeSeconds
    : existing.targetTimeSeconds;

  const targetPaceSecondsPerMile = targetTimeSeconds && distanceInfo
    ? Math.round(targetTimeSeconds / distanceInfo.miles)
    : null;

  const [race] = await db.update(races)
    .set({
      name: data.name ?? existing.name,
      date: data.date ?? existing.date,
      distanceMeters,
      distanceLabel,
      priority: data.priority ?? existing.priority,
      targetTimeSeconds,
      targetPaceSecondsPerMile,
      location: data.location !== undefined ? data.location : existing.location,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      updatedAt: now,
    })
    .where(eq(races.id, id))
    .returning();

  revalidatePath('/races');
  revalidatePath('/today');
  revalidatePath('/plan');

  return race;
}

export async function deleteRace(id: number) {
  await assertRaceWriteAccess();
  await db.delete(races).where(eq(races.id, id));

  revalidatePath('/races');
  revalidatePath('/today');
  revalidatePath('/plan');
}

// ==================== Auto-Match Races to Results ====================

/**
 * Automatically link a race result to a planned race if distance matches
 * and dates are within ±7 days. Updates the result's raceId and the
 * race's status to 'completed'.
 */
export async function autoMatchRaceToResult(
  raceResultId: number,
  distanceMeters: number,
  date: string,
  profileId?: number | null,
): Promise<number | null> {
  // Find planned races with matching distance within ±7 days
  const targetDate = new Date(date);
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 7);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const conditions = [
    gte(races.date, startStr),
    lte(races.date, endStr),
    eq(races.status, 'upcoming'),
  ];
  if (profileId) {
    conditions.push(eq(races.profileId, profileId));
  }

  const candidateRaces = await db.query.races.findMany({
    where: and(...conditions),
    orderBy: [asc(races.date)],
  });

  // Filter by matching distance (within 5% tolerance)
  const matched = candidateRaces.filter((r: Race) => {
    const pct = Math.abs(r.distanceMeters - distanceMeters) / r.distanceMeters;
    return pct <= 0.05;
  });

  if (matched.length === 0) return null;

  // Pick closest date match
  const closest = matched.reduce((best: Race, r: Race) => {
    const bestDiff = Math.abs(new Date(best.date).getTime() - targetDate.getTime());
    const rDiff = Math.abs(new Date(r.date).getTime() - targetDate.getTime());
    return rDiff < bestDiff ? r : best;
  });

  // Update race result with linked race
  await db.update(raceResults)
    .set({ raceId: closest.id })
    .where(eq(raceResults.id, raceResultId));

  // Mark race as completed
  await db.update(races)
    .set({ status: 'completed', updatedAt: new Date().toISOString() })
    .where(eq(races.id, closest.id));

  return closest.id;
}

// ==================== Race Results (Historical) ====================

export async function getRaceResults(profileId?: number) {
  return db.query.raceResults.findMany({
    where: profileId ? eq(raceResults.profileId, profileId) : undefined,
    orderBy: [desc(raceResults.date)],
  });
}

export async function getRaceResultsWithContext(profileId?: number): Promise<RaceResultWithContext[]> {
  const results = await getRaceResults(profileId);
  const workoutIds = results
    .map(r => r.workoutId)
    .filter((id): id is number => id != null);

  const linked = workoutIds.length > 0
    ? await db.query.workouts.findMany({
        where: inArray(workouts.id, workoutIds),
      })
    : [];
  const linkedMap = new Map(linked.map(w => [w.id, w]));

  // Batch-fetch linked races
  const raceIds = results
    .map(r => r.raceId)
    .filter((id): id is number => id != null);
  const linkedRaces = raceIds.length > 0
    ? await db.query.races.findMany({
        where: inArray(races.id, raceIds),
      })
    : [];
  const raceMap = new Map(linkedRaces.map((r: Race) => [r.id, r]));

  return results.map((result) => {
    const workout = result.workoutId ? linkedMap.get(result.workoutId) : undefined;
    const linkedWorkout = workout ? {
      id: workout.id,
      workoutType: workout.workoutType,
      avgHr: workout.avgHr || workout.avgHeartRate || null,
      maxHr: workout.maxHr || null,
      weatherTempF: workout.weatherTempF || null,
      weatherHumidityPct: workout.weatherHumidityPct || null,
      elevationGainFt: workout.elevationGainFt || (typeof workout.elevationGainFeet === 'number' ? Math.round(workout.elevationGainFeet) : null),
    } : null;

    const race = result.raceId ? raceMap.get(result.raceId) : undefined;
    const linkedRace = race ? {
      id: race.id,
      name: race.name,
      priority: race.priority,
      targetTimeSeconds: race.targetTimeSeconds,
    } : null;

    const effectiveEffortLevel = (result.effortLevel as EffortLevel | null) || (linkedWorkout ? inferEffortFromWorkout(linkedWorkout) : 'all_out');
    const normalization = normalizeRaceResult(result, linkedWorkout, effectiveEffortLevel);
    return {
      ...result,
      linkedWorkout,
      linkedRace,
      effectiveEffortLevel,
      normalization,
    };
  });
}

export async function getRaceResult(id: number) {
  return db.query.raceResults.findFirst({
    where: eq(raceResults.id, id),
  });
}

export async function createRaceResult(data: {
  raceName?: string;
  date: string;
  distanceLabel: string;
  finishTimeSeconds: number;
  effortLevel?: 'all_out' | 'hard' | 'moderate' | 'easy';
  conditions?: string;
  notes?: string;
  profileId?: number;
  workoutId?: number | null;
}) {
  await assertRaceWriteAccess();
  const now = new Date().toISOString();

  // Get distance in meters from label
  const distanceInfo = RACE_DISTANCES[data.distanceLabel];
  const distanceMeters = distanceInfo?.meters || 0;

  const linkedWorkout = data.workoutId
    ? await db.query.workouts.findFirst({ where: eq(workouts.id, data.workoutId) })
    : null;
  const inferredEffort = linkedWorkout
    ? inferEffortFromWorkout({
        workoutType: linkedWorkout.workoutType,
        avgHr: linkedWorkout.avgHr || linkedWorkout.avgHeartRate || null,
        maxHr: linkedWorkout.maxHr || null,
      })
    : 'all_out';

  // Calculate VDOT from this race
  const calculatedVdot = calculateVDOT(distanceMeters, data.finishTimeSeconds);

  const [result] = await db.insert(raceResults).values({
    raceName: data.raceName ?? null,
    date: data.date,
    distanceMeters,
    distanceLabel: data.distanceLabel,
    finishTimeSeconds: data.finishTimeSeconds,
    calculatedVdot,
    effortLevel: data.effortLevel ?? inferredEffort,
    conditions: data.conditions ?? null,
    notes: data.notes ?? null,
    profileId: data.profileId ?? null,
    workoutId: data.workoutId ?? null,
    createdAt: now,
  }).returning();

  // Update user's VDOT and pace zones using multi-signal prediction engine
  try {
    await syncVdotFromPredictionEngine(data.profileId, { skipSmoothing: true });
  } catch (err) {
    console.error('[createRaceResult] Multi-signal VDOT sync failed, falling back:', err);
    await updateUserVDOTFromResults(data.profileId, result.id);
  }

  // Auto-link to a planned race if possible
  try {
    await autoMatchRaceToResult(result.id, distanceMeters, data.date, data.profileId);
  } catch (err) {
    console.error('[createRaceResult] Auto-match failed (non-fatal):', err);
  }

  revalidatePath('/races');
  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/plan');
  revalidatePath('/analytics');

  return result;
}

export async function updateRaceResult(id: number, data: {
  raceName?: string | null;
  date?: string;
  distanceLabel?: string;
  finishTimeSeconds?: number;
  effortLevel?: 'all_out' | 'hard' | 'moderate' | 'easy';
  conditions?: string | null;
  notes?: string | null;
  workoutId?: number | null;
}) {
  await assertRaceWriteAccess();
  const existing = await getRaceResult(id);

  if (!existing) {
    throw new Error('Race result not found');
  }

  // Recalculate distance and VDOT if changed
  const distanceLabel = data.distanceLabel ?? existing.distanceLabel;
  const distanceInfo = RACE_DISTANCES[distanceLabel];
  const distanceMeters = distanceInfo?.meters ?? existing.distanceMeters;
  const finishTimeSeconds = data.finishTimeSeconds ?? existing.finishTimeSeconds;
  const nextWorkoutId = data.workoutId !== undefined ? data.workoutId : existing.workoutId;
  const linkedWorkout = nextWorkoutId
    ? await db.query.workouts.findFirst({ where: eq(workouts.id, nextWorkoutId) })
    : null;
  const inferredEffort = linkedWorkout
    ? inferEffortFromWorkout({
        workoutType: linkedWorkout.workoutType,
        avgHr: linkedWorkout.avgHr || linkedWorkout.avgHeartRate || null,
        maxHr: linkedWorkout.maxHr || null,
      })
    : 'all_out';

  const calculatedVdot = calculateVDOT(distanceMeters, finishTimeSeconds);

  const [result] = await db.update(raceResults)
    .set({
      raceName: data.raceName !== undefined ? data.raceName : existing.raceName,
      date: data.date ?? existing.date,
      distanceMeters,
      distanceLabel,
      finishTimeSeconds,
      calculatedVdot,
      effortLevel: data.effortLevel ?? (existing.effortLevel as EffortLevel | null) ?? inferredEffort,
      conditions: data.conditions !== undefined ? data.conditions : existing.conditions,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      workoutId: nextWorkoutId,
    })
    .where(eq(raceResults.id, id))
    .returning();

  // Update user's VDOT using multi-signal prediction engine
  try {
    await syncVdotFromPredictionEngine(existing.profileId ?? undefined, { skipSmoothing: true });
  } catch (err) {
    console.error('[updateRaceResult] Multi-signal VDOT sync failed, falling back:', err);
    await updateUserVDOTFromResults(existing.profileId ?? undefined, result.id);
  }

  revalidatePath('/races');
  revalidatePath('/settings');

  return result;
}

export async function deleteRaceResult(id: number) {
  await assertRaceWriteAccess();
  const existing = await getRaceResult(id);
  await db.delete(raceResults).where(eq(raceResults.id, id));

  // Update user's VDOT using multi-signal prediction engine
  try {
    await syncVdotFromPredictionEngine(existing?.profileId ?? undefined);
  } catch (err) {
    console.error('[deleteRaceResult] Multi-signal VDOT sync failed, falling back:', err);
    await updateUserVDOTFromResults(existing?.profileId ?? undefined);
  }

  revalidatePath('/races');
  revalidatePath('/settings');
}

// ==================== Workout Linking ====================

export async function getWorkoutsForRaceLinking(profileId?: number, date?: string) {
  if (!date) return [];

  // Fetch workouts within ±7 days of given date
  const targetDate = new Date(date);
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 7);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const conditions = [
    gte(workouts.date, startStr),
    lte(workouts.date, endStr),
  ];
  if (profileId) {
    conditions.push(eq(workouts.profileId, profileId));
  }

  const allWorkouts = await db.query.workouts.findMany({
    where: and(...conditions),
    orderBy: [desc(workouts.date)],
    limit: 20,
  });

  // Prefer race-type workouts, fall back to all if none
  const raceWorkouts = allWorkouts.filter((w: { workoutType: string }) => w.workoutType === 'race');
  const results = raceWorkouts.length > 0 ? raceWorkouts : allWorkouts;

  // Sort by date proximity to target
  return results
    .map((w: { id: number; date: string; distanceMiles: number | null; durationMinutes: number | null; stravaName: string | null; workoutType: string }) => ({
      id: w.id,
      date: w.date,
      distanceMiles: w.distanceMiles,
      durationMinutes: w.durationMinutes,
      stravaName: w.stravaName,
      workoutType: w.workoutType,
    }))
    .sort((a: { date: string }, b: { date: string }) => {
      const aDiff = Math.abs(new Date(a.date).getTime() - targetDate.getTime());
      const bDiff = Math.abs(new Date(b.date).getTime() - targetDate.getTime());
      return aDiff - bDiff;
    });
}

// ==================== VDOT Management ====================

/**
 * @deprecated Use syncVdotFromPredictionEngine() instead. This is kept as a
 * fallback in case the multi-signal engine fails. Uses the old single-model
 * buildPerformanceModel() approach.
 *
 * Update user's VDOT and pace zones using the performance model.
 * Uses weighted average of races, time trials, and workout segments
 * with exponential decay favoring recent performances.
 */
async function updateUserVDOTFromResults(profileId?: number, sourceRaceResultId?: number) {
  // Use the performance model for weighted VDOT calculation
  const model = await buildPerformanceModel(profileId);

  // If no data points, nothing to update
  if (model.dataPoints === 0) return;

  const rawVdot = model.estimatedVdot;

  // Validate VDOT is within realistic range (15-85)
  if (!rawVdot || rawVdot < 15 || rawVdot > 85) return;

  // Find settings — try with profileId first, fall back to first record
  let settings = profileId
    ? await db.query.userSettings.findFirst({ where: eq(userSettings.profileId, profileId) })
    : null;

  if (!settings) {
    settings = await db.query.userSettings.findFirst();
  }

  // Asymmetric smoothing: faster to rise, slower to fall.
  // A fast performance proves fitness; a slow one has many explanations.
  const currentVdot = settings?.vdot;
  let smoothedVdot = rawVdot;

  if (currentVdot && currentVdot >= 15 && currentVdot <= 85) {
    const delta = rawVdot - currentVdot;

    if (delta > 0) {
      // Going UP — accept most of the change (fast performance = real fitness)
      // High-confidence data (races) → accept 85%, low → accept 60%
      const upFactor = model.vdotConfidence === 'high' ? 0.85
        : model.vdotConfidence === 'medium' ? 0.75 : 0.60;
      smoothedVdot = currentVdot + delta * upFactor;
    } else if (delta < 0) {
      // Going DOWN — dampen heavily (slow run ≠ fitness decline)
      // Only accept 30-40% of the downward movement
      const downFactor = model.vdotConfidence === 'high' ? 0.40
        : model.vdotConfidence === 'medium' ? 0.30 : 0.20;
      smoothedVdot = currentVdot + delta * downFactor;
    }

    smoothedVdot = Math.round(smoothedVdot * 10) / 10;
  }

  // Calculate pace zones from the smoothed VDOT
  const zones = calculatePaceZones(smoothedVdot);

  if (settings) {
    await db.update(userSettings)
      .set({
        vdot: smoothedVdot,
        easyPaceSeconds: zones.easy,
        tempoPaceSeconds: zones.tempo,
        thresholdPaceSeconds: zones.threshold,
        intervalPaceSeconds: zones.interval,
        marathonPaceSeconds: zones.marathon,
        halfMarathonPaceSeconds: zones.halfMarathon,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));
  }

  // Record to VDOT history for trend tracking
  const confidence = model.vdotConfidence;
  const notes = [
    model.trend !== 'insufficient_data' ? model.trend : 'initial',
    `${model.dataPoints} data points`,
    `sources: ${model.sources.races}R/${model.sources.timeTrials}TT/${model.sources.workoutBestEfforts}WO`,
    currentVdot ? `prev: ${currentVdot} → ${smoothedVdot} (raw: ${rawVdot})` : undefined,
  ].filter(Boolean).join(' | ');

  try {
    await recordVdotEntry(smoothedVdot, sourceRaceResultId ? 'race' : 'estimate', {
      sourceId: sourceRaceResultId,
      confidence,
      notes,
      profileId: profileId ?? settings?.profileId ?? undefined,
    });
  } catch (err) {
    // Don't fail the VDOT update if history recording fails
    console.error('Failed to record VDOT history entry:', err);
  }
}

/**
 * Get the user's current pace zones.
 */
export async function getUserPaceZones() {
  const settings = await db.query.userSettings.findFirst();

  if (!settings?.vdot || settings.vdot < 15 || settings.vdot > 85) {
    return null;
  }

  return calculatePaceZones(settings.vdot);
}

/**
 * Manually set user's VDOT and update pace zones.
 */
export async function setUserVDOT(vdot: number) {
  await assertRaceWriteAccess();
  if (vdot < 15 || vdot > 85) {
    throw new Error('VDOT must be between 15 and 85');
  }

  const zones = calculatePaceZones(vdot);
  const now = new Date().toISOString();

  const settings = await db.query.userSettings.findFirst();

  if (settings) {
    await db.update(userSettings)
      .set({
        vdot,
        easyPaceSeconds: zones.easy,
        tempoPaceSeconds: zones.tempo,
        thresholdPaceSeconds: zones.threshold,
        intervalPaceSeconds: zones.interval,
        marathonPaceSeconds: zones.marathon,
        halfMarathonPaceSeconds: zones.halfMarathon,
        updatedAt: now,
      })
      .where(eq(userSettings.id, settings.id));
  }

  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/pace-calculator');

  return zones;
}

// ==================== Backfill ====================

/**
 * One-time backfill: link existing race results to planned races,
 * and mark matched races as completed.
 */
export async function backfillRaceLinks(profileId?: number): Promise<{
  matched: number;
  total: number;
}> {
  const conditions = profileId
    ? and(eq(raceResults.profileId, profileId), isNull(raceResults.raceId))
    : isNull(raceResults.raceId);

  // Get all unlinked race results
  const unlinked: RaceResult[] = await db.query.raceResults.findMany({
    where: conditions,
    orderBy: [desc(raceResults.date)],
  });

  let matched = 0;

  for (const result of unlinked) {
    try {
      const raceId = await autoMatchRaceToResult(
        result.id,
        result.distanceMeters,
        result.date,
        result.profileId,
      );
      if (raceId) matched++;
    } catch {
      // Skip failures silently
    }
  }

  // Also mark any past races without results as upcoming still (no change needed)
  // But mark past races that were matched as completed (already done in autoMatch)

  revalidatePath('/races');
  return { matched, total: unlinked.length };
}

// Note: Utility functions (getDaysUntilRace, formatRaceTime, etc.) are in @/lib/race-utils
