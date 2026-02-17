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

  // 6. Record to VDOT history
  const signalNames = prediction.signals.map(s => s.name).join(', ');
  const notes = [
    `multi-signal (${signalsUsed} signals)`,
    `agreement: ${Math.round(prediction.agreementScore * 100)}%`,
    signalNames,
    currentVdot ? `prev: ${currentVdot} → ${smoothedVdot} (raw: ${rawVdot})` : undefined,
  ].filter(Boolean).join(' | ');

  try {
    await recordVdotEntry(smoothedVdot, 'estimate', {
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
