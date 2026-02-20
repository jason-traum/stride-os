'use server';

import { db, userSettings, workouts } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
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

export interface RetroactiveBacktestResult {
  monthsProcessed: number;
  monthsFailed: number;
  monthsSkipped: number;
  firstMonth: string;
  lastMonth: string;
}

/**
 * Retroactively recompute VDOT for each historical month using the current engine.
 * Runs the prediction engine "as of" the last day of each month, so only data
 * available at that time is used. Records each result to vdot_history.
 */
export async function retroactiveVdotBacktest(profileId?: number): Promise<RetroactiveBacktestResult> {
  const pid = profileId ?? await getActiveProfileId();
  if (!pid) {
    return { monthsProcessed: 0, monthsFailed: 0, monthsSkipped: 0, firstMonth: '', lastMonth: '' };
  }

  // Find earliest workout date
  const earliest = await db.select({ date: workouts.date })
    .from(workouts)
    .where(eq(workouts.profileId, pid))
    .orderBy(asc(workouts.date))
    .limit(1);

  if (earliest.length === 0) {
    return { monthsProcessed: 0, monthsFailed: 0, monthsSkipped: 0, firstMonth: '', lastMonth: '' };
  }

  // Helpers (same as vdot-history.ts)
  const toMonthStart = (dateStr: string): string => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(1);
    return d.toISOString().split('T')[0];
  };
  const addMonth = (dateStr: string): string => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(1);
    return d.toISOString().split('T')[0];
  };
  const lastDayOfMonth = (monthStr: string): Date => {
    const d = new Date(`${monthStr}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0); // last day of previous month
    d.setUTCHours(23, 59, 59, 999);
    return d;
  };

  const startMonth = toMonthStart(earliest[0].date);
  const nowMonth = toMonthStart(new Date().toISOString().split('T')[0]);

  let cursor = startMonth;
  let monthsProcessed = 0;
  let monthsFailed = 0;
  let monthsSkipped = 0;

  while (cursor <= nowMonth) {
    const asOfDate = lastDayOfMonth(cursor);

    try {
      const prediction = await getComprehensiveRacePredictions(pid, asOfDate);

      if (!prediction || !prediction.vdot || prediction.vdot < 15 || prediction.vdot > 85) {
        monthsSkipped++;
        cursor = addMonth(cursor);
        continue;
      }

      const signalNames = prediction.signals.map(s => s.name).join(', ');
      await recordVdotEntry(prediction.vdot, 'estimate', {
        date: cursor, // month start date (recordVdotEntry normalizes to month)
        confidence: prediction.confidence,
        notes: `backtest as-of ${asOfDate.toISOString().split('T')[0]} | ${prediction.dataQuality.signalsUsed} signals | ${signalNames}`,
        profileId: pid,
      });

      monthsProcessed++;
    } catch (err) {
      console.error(`[retroactiveVdotBacktest] Failed for ${cursor}:`, err);
      monthsFailed++;
    }

    cursor = addMonth(cursor);
  }

  return {
    monthsProcessed,
    monthsFailed,
    monthsSkipped,
    firstMonth: startMonth,
    lastMonth: nowMonth,
  };
}

export interface FullReprocessResult {
  success: boolean;
  signalsRecomputed: number;
  signalErrors: number;
  raceResultsCreated: number;
  vdotResult: VdotSyncResult;
  backtestMonthsProcessed: number;
  backtestMonthsFailed: number;
  historyRebuilt: number;
  workoutsReclassified: number;
  reclassifyErrors: number;
}

/**
 * Full reprocessing pipeline: recompute all fitness signals (with updated
 * weather formula), sync VDOT, rebuild history, and reclassify all workouts.
 * Use after backfilling data or changing the weather/VDOT calculation logic.
 */
export async function fullReprocess(profileId?: number, options?: { skipSignals?: boolean; skipReclassify?: boolean }): Promise<FullReprocessResult> {
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
  if (!options?.skipSignals) {
    for (const w of allWorkouts) {
      try {
        await computeWorkoutFitnessSignals(w.id, w.profileId);
        signalsRecomputed++;
      } catch {
        signalErrors++;
      }
    }
  }

  // Step 1b: Auto-create race results for race-tagged workouts without one
  let raceResultsCreated = 0;
  try {
    const { workouts: workoutsTable, raceResults } = await import('@/lib/db');
    const { and: andOp, eq: eqOp } = await import('drizzle-orm');
    const { calculateVDOT: calcVdot } = await import('@/lib/training/vdot-calculator');
    const { RACE_DISTANCES } = await import('@/lib/training/types');

    const raceWorkouts = await database.select({
      id: workoutsTable.id,
      profileId: workoutsTable.profileId,
      date: workoutsTable.date,
      distanceMiles: workoutsTable.distanceMiles,
      durationMinutes: workoutsTable.durationMinutes,
      notes: workoutsTable.notes,
      avgHeartRate: workoutsTable.avgHeartRate,
      avgHr: workoutsTable.avgHr,
      maxHr: workoutsTable.maxHr,
    }).from(workoutsTable).where(
      andOp(eqOp(workoutsTable.workoutType, 'race'))
    );

    // Get existing race result workout IDs
    const existingResults = await database.select({ workoutId: raceResults.workoutId }).from(raceResults);
    const linkedIds = new Set(existingResults.map((r: { workoutId: number | null }) => r.workoutId).filter(Boolean));

    const matchDist = (meters: number): string | null => {
      let best: string | null = null;
      let bestPct = Infinity;
      for (const [key, info] of Object.entries(RACE_DISTANCES)) {
        const pct = Math.abs(meters - info.meters) / info.meters;
        if (pct < bestPct) { bestPct = pct; best = key; }
      }
      return bestPct <= 0.05 ? best : null;
    };

    for (const w of raceWorkouts) {
      if (linkedIds.has(w.id)) continue;
      if (!w.distanceMiles || !w.durationMinutes) continue;
      const distMeters = w.distanceMiles * 1609.34;
      const label = matchDist(distMeters);
      if (!label) continue;
      const timeSec = Math.round(w.durationMinutes * 60);
      const vdot = calcVdot(distMeters, timeSec);
      if (vdot < 15 || vdot > 85) continue;

      const avgHr = w.avgHr || w.avgHeartRate || 0;
      const maxHr = w.maxHr || 0;
      const hrRatio = maxHr > 0 ? avgHr / maxHr : null;
      const effortLevel: 'all_out' | 'hard' | 'moderate' =
        hrRatio != null && hrRatio >= 0.9 ? 'all_out'
        : hrRatio != null && hrRatio >= 0.84 ? 'hard'
        : 'moderate';

      try {
        await database.insert(raceResults).values({
          profileId: w.profileId,
          raceName: w.notes || null,
          date: w.date,
          distanceMeters: RACE_DISTANCES[label].meters,
          distanceLabel: label,
          finishTimeSeconds: timeSec,
          calculatedVdot: vdot,
          effortLevel,
          workoutId: w.id,
          createdAt: new Date().toISOString(),
        });
        raceResultsCreated++;
      } catch {
        // Skip duplicates or other insert errors
      }
    }
  } catch {
    // Non-critical — continue with reprocess
  }

  // Step 2: Sync VDOT via multi-signal engine (skip smoothing — accept raw result)
  const vdotResult = await syncVdotFromPredictionEngine(pid ?? undefined, { skipSmoothing: true });

  // Step 2b: Retroactive VDOT backtest — recompute VDOT for each historical month
  let backtestMonthsProcessed = 0;
  let backtestMonthsFailed = 0;
  if (pid) {
    const backtestResult = await retroactiveVdotBacktest(pid);
    backtestMonthsProcessed = backtestResult.monthsProcessed;
    backtestMonthsFailed = backtestResult.monthsFailed;
  }

  // Step 3: Rebuild VDOT history (monthly snapshots, no step limits)
  let historyRebuilt = 0;
  if (pid) {
    const historyResult = await rebuildMonthlyVdotHistory({ profileId: pid });
    historyRebuilt = historyResult.rebuiltEntries;
  }

  // Step 4: Reclassify all workouts with updated pace zones
  let workoutsReclassified = 0;
  let reclassifyErrors = 0;
  if (!options?.skipReclassify) {
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
    raceResultsCreated,
    vdotResult,
    backtestMonthsProcessed,
    backtestMonthsFailed,
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
