'use server';

import { db, races, raceResults, userSettings, workouts, Race, RaceResult, Workout } from '@/lib/db';
import { eq, desc, asc, gte, lte, inArray, isNull, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { calculateVDOT, calculatePaceZones, getWeatherPaceAdjustment } from '@/lib/training/vdot-calculator';
import { buildPerformanceModel } from '@/lib/training/performance-model';
import { inferEffortFromWorkout, type EffortLevel } from '@/lib/race-utils';
import { recordVdotEntry } from './vdot-history';
import { getActiveProfileId } from '@/lib/profile-server';

const METERS_PER_MILE = 1609.34;

type ConfidenceLevel = 'high' | 'medium' | 'low';

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

// inferEffortFromWorkout moved to @/lib/race-utils

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

// ==================== Race Results With Context ====================

export async function getRaceResultsWithContext(profileId?: number): Promise<RaceResultWithContext[]> {
  const results: RaceResult[] = await db.query.raceResults.findMany({
    where: profileId ? eq(raceResults.profileId, profileId) : undefined,
    orderBy: [desc(raceResults.date)],
  });
  const workoutIds = results
    .map((r: RaceResult) => r.workoutId)
    .filter((id): id is number => id != null);

  const linked: Workout[] = workoutIds.length > 0
    ? await db.query.workouts.findMany({
        where: inArray(workouts.id, workoutIds),
      })
    : [];
  const linkedMap = new Map(linked.map((w: Workout) => [w.id, w]));

  // Batch-fetch linked races
  const raceIds = results
    .map((r: RaceResult) => r.raceId)
    .filter((id): id is number => id != null);
  const linkedRaces: Race[] = raceIds.length > 0
    ? await db.query.races.findMany({
        where: inArray(races.id, raceIds),
      })
    : [];
  const raceMap = new Map(linkedRaces.map((r: Race) => [r.id, r]));

  return results.map((result: RaceResult) => {
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
export async function updateUserVDOTFromResults(profileId?: number, sourceRaceResultId?: number) {
  // Use the performance model for weighted VDOT calculation
  const model = await buildPerformanceModel(profileId);

  // If no data points, nothing to update
  if (model.dataPoints === 0) return;

  const rawVdot = model.estimatedVdot;

  // Validate VDOT is within realistic range (15-85)
  if (!rawVdot || rawVdot < 15 || rawVdot > 85) return;

  // Find settings — try with provided profileId first, fall back to active profile
  const effectiveProfileId = profileId ?? await getActiveProfileId();
  const settings = effectiveProfileId
    ? await db.query.userSettings.findFirst({ where: eq(userSettings.profileId, effectiveProfileId) })
    : null;

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
  const profileId = await getActiveProfileId();
  if (!profileId) return null;
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId)
  });

  if (!settings?.vdot || settings.vdot < 15 || settings.vdot > 85) {
    return null;
  }

  return calculatePaceZones(settings.vdot);
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
