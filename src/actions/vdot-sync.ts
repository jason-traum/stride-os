'use server';

import { db, userSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getActiveProfileId } from '@/lib/profile-server';
import { getSettings } from './settings';
import { getComprehensiveRacePredictions } from './race-predictor';
import { calculatePaceZones } from '@/lib/training/vdot-calculator';
import { recordVdotEntry } from './vdot-history';

export interface VdotSyncResult {
  success: boolean;
  oldVdot: number | null;
  newVdot: number | null;
  confidence: 'high' | 'medium' | 'low';
  signalsUsed: number;
}

/**
 * Sync the user's VDOT and pace zones using the multi-signal prediction engine.
 *
 * Calls getComprehensiveRacePredictions() which blends 6 signals (race VDOT,
 * best efforts, effective VO2max from HR, EF trend, critical speed, training
 * pace inference) into a single blended VDOT.
 *
 * Applies asymmetric smoothing: fast performances pull VDOT up readily
 * (you can't fake fitness), while slow performances pull it down gently
 * (many explanations: bad day, weather, effort level, etc.).
 *
 * Updates userSettings (vdot + 6 pace fields) and records to vdot_history.
 */
export interface ReclassifyResult {
  success: boolean;
  vdotResult: VdotSyncResult;
  workoutsProcessed: number;
  errors: number;
}

/**
 * Full VDOT sync + workout reclassification.
 * Updates VDOT via multi-signal engine, then re-runs classification on all workouts.
 */
export async function syncVdotAndReclassify(profileId?: number): Promise<ReclassifyResult> {
  const { processWorkout } = await import('@/lib/training/workout-processor');

  // Step 1: Sync VDOT — skip smoothing for explicit user-triggered recalculation
  const vdotResult = await syncVdotFromPredictionEngine(profileId, { skipSmoothing: true });

  if (!vdotResult.success) {
    return { success: false, vdotResult, workoutsProcessed: 0, errors: 0 };
  }

  // Step 2: Re-classify all workouts with updated VDOT
  const { db: database, workouts } = await import('@/lib/db');
  const allWorkouts = await database.select({ id: workouts.id }).from(workouts);

  let processed = 0;
  let errors = 0;

  for (const workout of allWorkouts) {
    try {
      await processWorkout(workout.id, {
        skipExecution: true,
        skipRouteMatching: true,
        skipDataQuality: true,
      });
      processed++;
    } catch {
      errors++;
    }
  }

  revalidatePath('/history');
  revalidatePath('/analytics');
  revalidatePath('/today');
  revalidatePath('/profile');

  return { success: true, vdotResult, workoutsProcessed: processed, errors };
}

export interface FullReprocessResult {
  success: boolean;
  signalsRecomputed: number;
  signalErrors: number;
  vdotResult: VdotSyncResult;
  historyRebuilt: number;
  workoutsReclassified: number;
  reclassifyErrors: number;
}

/**
 * Full reprocessing pipeline: recompute all fitness signals (with updated
 * weather formula), sync VDOT, rebuild history, and reclassify all workouts.
 * Use after backfilling data or changing the weather/VDOT calculation logic.
 */
export async function fullReprocess(profileId?: number): Promise<FullReprocessResult> {
  const pid = profileId ?? await getActiveProfileId();
  const { computeWorkoutFitnessSignals } = await import('./fitness-signals');
  const { rebuildMonthlyVdotHistory } = await import('./vdot-history');
  const { processWorkout } = await import('@/lib/training/workout-processor');
  const { db: database, workouts: workoutsTable } = await import('@/lib/db');

  const allWorkouts = await database.select({
    id: workoutsTable.id,
    profileId: workoutsTable.profileId,
  }).from(workoutsTable);

  // Step 1: Recompute fitness signals for all workouts (weather-adjusted paces, VO2max, etc.)
  let signalsRecomputed = 0;
  let signalErrors = 0;
  for (const w of allWorkouts) {
    try {
      await computeWorkoutFitnessSignals(w.id, w.profileId);
      signalsRecomputed++;
    } catch {
      signalErrors++;
    }
  }

  // Step 2: Sync VDOT via multi-signal engine (skip smoothing — accept raw result)
  const vdotResult = await syncVdotFromPredictionEngine(pid ?? undefined, { skipSmoothing: true });

  // Step 3: Rebuild VDOT history (monthly snapshots, no step limits)
  let historyRebuilt = 0;
  if (pid) {
    const historyResult = await rebuildMonthlyVdotHistory({ profileId: pid });
    historyRebuilt = historyResult.rebuiltEntries;
  }

  // Step 4: Reclassify all workouts with updated pace zones
  let workoutsReclassified = 0;
  let reclassifyErrors = 0;
  for (const w of allWorkouts) {
    try {
      await processWorkout(w.id, {
        skipExecution: true,
        skipRouteMatching: true,
        skipDataQuality: true,
      });
      workoutsReclassified++;
    } catch {
      reclassifyErrors++;
    }
  }

  revalidatePath('/history');
  revalidatePath('/analytics');
  revalidatePath('/today');
  revalidatePath('/profile');
  revalidatePath('/predictions');

  return {
    success: vdotResult.success,
    signalsRecomputed,
    signalErrors,
    vdotResult,
    historyRebuilt,
    workoutsReclassified,
    reclassifyErrors,
  };
}

export async function syncVdotFromPredictionEngine(
  profileId?: number,
  options?: { skipSmoothing?: boolean }
): Promise<VdotSyncResult> {
  const pid = profileId ?? await getActiveProfileId();

  // 1. Run the multi-signal engine
  const prediction = await getComprehensiveRacePredictions(pid ?? undefined);

  if (!prediction || !prediction.vdot) {
    return { success: false, oldVdot: null, newVdot: null, confidence: 'low', signalsUsed: 0 };
  }

  const rawVdot = prediction.vdot;
  const confidence = prediction.confidence;
  const signalsUsed = prediction.dataQuality.signalsUsed;

  // 2. Validate VDOT is within realistic range
  if (rawVdot < 15 || rawVdot > 85) {
    return { success: false, oldVdot: null, newVdot: null, confidence, signalsUsed };
  }

  // 3. Fetch current settings
  const settings = await getSettings(pid ?? undefined);
  if (!settings) {
    return { success: false, oldVdot: null, newVdot: null, confidence, signalsUsed };
  }

  const currentVdot = settings.vdot;

  // 4. Asymmetric smoothing (skipped for explicit user-triggered recalculation)
  let smoothedVdot = rawVdot;

  if (!options?.skipSmoothing && currentVdot && currentVdot >= 15 && currentVdot <= 85) {
    const delta = rawVdot - currentVdot;

    if (delta > 0) {
      // Going UP — accept most of the change (fast performance = real fitness)
      const upFactor = confidence === 'high' ? 0.85
        : confidence === 'medium' ? 0.75 : 0.60;
      smoothedVdot = currentVdot + delta * upFactor;
    } else if (delta < 0) {
      // Going DOWN — dampen heavily (slow run ≠ fitness decline)
      const downFactor = confidence === 'high' ? 0.40
        : confidence === 'medium' ? 0.30 : 0.20;
      smoothedVdot = currentVdot + delta * downFactor;
    }

    smoothedVdot = Math.round(smoothedVdot * 10) / 10;
  }

  // 5. Calculate pace zones and update settings
  const zones = calculatePaceZones(smoothedVdot);

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

  // 6. Record to VDOT history — preserve race source when race signal dominates
  const raceSignal = prediction.signals.find(s => s.name === 'Race VDOT');
  const historySource: 'race' | 'estimate' =
    raceSignal && raceSignal.confidence >= 0.7 && raceSignal.weight >= 0.3
      ? 'race'
      : 'estimate';

  const signalNames = prediction.signals.map(s => s.name).join(', ');
  const notes = [
    `multi-signal (${signalsUsed} signals)`,
    `agreement: ${Math.round(prediction.agreementScore * 100)}%`,
    signalNames,
    currentVdot ? `prev: ${currentVdot} → ${smoothedVdot} (raw: ${rawVdot})` : undefined,
  ].filter(Boolean).join(' | ');

  try {
    await recordVdotEntry(smoothedVdot, historySource, {
      confidence,
      notes,
      profileId: pid ?? settings.profileId ?? undefined,
    });
  } catch (err) {
    // Don't fail the VDOT update if history recording fails
    console.error('[syncVdotFromPredictionEngine] Failed to record VDOT history:', err);
  }

  return {
    success: true,
    oldVdot: currentVdot ?? null,
    newVdot: smoothedVdot,
    confidence,
    signalsUsed,
  };
}
