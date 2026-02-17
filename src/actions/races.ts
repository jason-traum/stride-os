'use server';

import { db, races, raceResults, userSettings, workouts, Race, RaceResult } from '@/lib/db';
import { eq, desc, asc, and, gte, lte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { calculateVDOT, calculatePaceZones } from '@/lib/training/vdot-calculator';
import { RACE_DISTANCES } from '@/lib/training/types';
import { buildPerformanceModel } from '@/lib/training/performance-model';
import { recordVdotEntry } from './vdot-history';
import { syncVdotFromPredictionEngine } from './vdot-sync';
import type { RacePriority } from '@/lib/schema';

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
  return allRaces.filter((r: Race) => r.date >= today);
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
  await db.delete(races).where(eq(races.id, id));

  revalidatePath('/races');
  revalidatePath('/today');
  revalidatePath('/plan');
}

// ==================== Race Results (Historical) ====================

export async function getRaceResults(profileId?: number) {
  return db.query.raceResults.findMany({
    where: profileId ? eq(raceResults.profileId, profileId) : undefined,
    orderBy: [desc(raceResults.date)],
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
  const now = new Date().toISOString();

  // Get distance in meters from label
  const distanceInfo = RACE_DISTANCES[data.distanceLabel];
  const distanceMeters = distanceInfo?.meters || 0;

  // Calculate VDOT from this race
  const calculatedVdot = calculateVDOT(distanceMeters, data.finishTimeSeconds);

  const [result] = await db.insert(raceResults).values({
    raceName: data.raceName ?? null,
    date: data.date,
    distanceMeters,
    distanceLabel: data.distanceLabel,
    finishTimeSeconds: data.finishTimeSeconds,
    calculatedVdot,
    effortLevel: data.effortLevel ?? 'all_out',
    conditions: data.conditions ?? null,
    notes: data.notes ?? null,
    profileId: data.profileId ?? null,
    workoutId: data.workoutId ?? null,
    createdAt: now,
  }).returning();

  // Update user's VDOT and pace zones using multi-signal prediction engine
  try {
    await syncVdotFromPredictionEngine(data.profileId);
  } catch (err) {
    console.error('[createRaceResult] Multi-signal VDOT sync failed, falling back:', err);
    await updateUserVDOTFromResults(data.profileId, result.id);
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
  const existing = await getRaceResult(id);

  if (!existing) {
    throw new Error('Race result not found');
  }

  // Recalculate distance and VDOT if changed
  const distanceLabel = data.distanceLabel ?? existing.distanceLabel;
  const distanceInfo = RACE_DISTANCES[distanceLabel];
  const distanceMeters = distanceInfo?.meters ?? existing.distanceMeters;
  const finishTimeSeconds = data.finishTimeSeconds ?? existing.finishTimeSeconds;

  const calculatedVdot = calculateVDOT(distanceMeters, finishTimeSeconds);

  const [result] = await db.update(raceResults)
    .set({
      raceName: data.raceName !== undefined ? data.raceName : existing.raceName,
      date: data.date ?? existing.date,
      distanceMeters,
      distanceLabel,
      finishTimeSeconds,
      calculatedVdot,
      effortLevel: data.effortLevel ?? existing.effortLevel,
      conditions: data.conditions !== undefined ? data.conditions : existing.conditions,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      workoutId: data.workoutId !== undefined ? data.workoutId : existing.workoutId,
    })
    .where(eq(raceResults.id, id))
    .returning();

  // Update user's VDOT using multi-signal prediction engine
  try {
    await syncVdotFromPredictionEngine(existing.profileId ?? undefined);
  } catch (err) {
    console.error('[updateRaceResult] Multi-signal VDOT sync failed, falling back:', err);
    await updateUserVDOTFromResults(existing.profileId ?? undefined, result.id);
  }

  revalidatePath('/races');
  revalidatePath('/settings');

  return result;
}

export async function deleteRaceResult(id: number) {
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

// Note: Utility functions (getDaysUntilRace, formatRaceTime, etc.) are in @/lib/race-utils
