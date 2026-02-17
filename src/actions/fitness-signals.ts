'use server';

import { db, workouts, workoutFitnessSignals } from '@/lib/db';
import { eq, and, gte, ne } from 'drizzle-orm';
import { getWeatherPaceAdjustment } from '@/lib/training/vdot-calculator';
import { getSettings } from './settings';

const METERS_PER_MILE = 1609.34;

// Steady-state workout types (valid for HR-based signals)
const STEADY_STATE_TYPES = ['easy', 'steady', 'long', 'tempo', 'threshold', 'recovery', 'marathon'];

/**
 * Compute and store fitness signals for a single workout.
 * Called after Strava sync imports a workout.
 * Non-critical: if it fails, sync still succeeds.
 */
export async function computeWorkoutFitnessSignals(
  workoutId: number,
  profileId: number | null
): Promise<void> {
  try {
    const workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
    });

    if (!workout) return;
    if (!workout.distanceMiles || !workout.durationMinutes || workout.distanceMiles <= 0) return;

    // Get user settings for HR thresholds
    const settings = profileId ? await getSettings(profileId) : null;
    const restingHr = settings?.restingHr || 60;
    const age = settings?.age;
    const maxHrFromAge = age ? 220 - age : 185;
    const maxHr = Math.max(maxHrFromAge, workout.maxHr || 0);
    const hrRange = maxHr - restingHr;

    const avgHr = workout.avgHr || workout.avgHeartRate;
    const isSteadyState = STEADY_STATE_TYPES.includes(workout.workoutType);

    // HR Reserve %
    let hrReservePct: number | null = null;
    if (avgHr && hrRange > 20) {
      hrReservePct = (avgHr - restingHr) / hrRange;
      hrReservePct = Math.max(0, Math.min(1, hrReservePct));
    }

    // Velocity in m/min
    const distanceMeters = workout.distanceMiles * METERS_PER_MILE;
    let velocity = distanceMeters / (workout.durationMinutes * 60) * 60;

    // Weather-adjusted pace
    let weatherAdjustedPace: number | null = null;
    if (workout.weatherTempF != null && workout.weatherHumidityPct != null && workout.avgPaceSeconds) {
      const adjustment = getWeatherPaceAdjustment(workout.weatherTempF, workout.weatherHumidityPct);
      if (adjustment > 0) {
        weatherAdjustedPace = workout.avgPaceSeconds - adjustment;
        if (weatherAdjustedPace > 0) {
          velocity = METERS_PER_MILE / (weatherAdjustedPace / 60);
        }
      }
    }

    // Elevation-adjusted pace
    let elevationAdjustedPace: number | null = null;
    const elevGain = workout.elevationGainFt || workout.elevationGainFeet;
    if (elevGain && elevGain > 0 && workout.distanceMiles > 0 && workout.avgPaceSeconds) {
      const gainPerMile = elevGain / workout.distanceMiles;
      const elevCorrection = Math.round((gainPerMile / 100) * 12);
      if (elevCorrection > 0) {
        elevationAdjustedPace = workout.avgPaceSeconds - elevCorrection;
      }
    }

    // Effective VO2max (only for steady-state with HR in valid range)
    let effectiveVo2max: number | null = null;
    if (isSteadyState && hrReservePct != null && hrReservePct > 0.50 && hrReservePct < 0.92) {
      const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
      const pctVo2max = 1.4854 * hrReservePct - 0.3702;
      if (pctVo2max > 0.2 && pctVo2max <= 1.0) {
        effectiveVo2max = vo2 / pctVo2max;
        if (effectiveVo2max < 15 || effectiveVo2max > 85) effectiveVo2max = null;
      }
    }

    // Efficiency Factor: velocity(m/min) / avgHR
    let efficiencyFactor: number | null = null;
    if (avgHr && avgHr > 0) {
      efficiencyFactor = velocity / avgHr;
    }

    // Check if signals already exist for this workout
    const existing = await db.query.workoutFitnessSignals.findFirst({
      where: eq(workoutFitnessSignals.workoutId, workoutId),
    });

    const signalData = {
      workoutId,
      profileId,
      effectiveVo2max: effectiveVo2max ? Math.round(effectiveVo2max * 10) / 10 : null,
      efficiencyFactor: efficiencyFactor ? Math.round(efficiencyFactor * 1000) / 1000 : null,
      aerobicDecouplingPct: null as number | null, // Computed when segment data available
      weatherAdjustedPace,
      elevationAdjustedPace,
      hrReservePct: hrReservePct ? Math.round(hrReservePct * 1000) / 1000 : null,
      isSteadyState,
      computedAt: new Date().toISOString(),
    };

    if (existing) {
      await db.update(workoutFitnessSignals)
        .set(signalData)
        .where(eq(workoutFitnessSignals.id, existing.id));
    } else {
      await db.insert(workoutFitnessSignals).values(signalData);
    }

    // Auto-exclude outlier workouts from fitness estimates
    if (effectiveVo2max != null) {
      await checkAutoExclusion(workoutId, profileId, effectiveVo2max);
    }
  } catch (error) {
    console.error(`[computeWorkoutFitnessSignals] Failed for workout ${workoutId}:`, error);
    // Non-critical — don't throw
  }
}

/**
 * Auto-exclude workouts whose effectiveVO2max deviates >20% from recent median.
 * Only flags workouts that aren't already manually excluded.
 * Requires at least 5 recent data points to establish a baseline.
 */
async function checkAutoExclusion(
  workoutId: number,
  profileId: number | null,
  currentVo2max: number
): Promise<void> {
  try {
    // Don't override manual decisions
    const workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
    });
    if (!workout || workout.excludeFromEstimates) return;

    if (!profileId) return;

    // Query recent effectiveVo2max values (90 days, same profile, non-excluded, excluding current workout)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const recentSignals = await db.query.workoutFitnessSignals.findMany({
      where: and(
        eq(workoutFitnessSignals.profileId, profileId),
        ne(workoutFitnessSignals.workoutId, workoutId)
      ),
      with: {
        workout: true,
      },
    });

    // Filter to non-excluded workouts in the date window with valid VO2max
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentVo2maxValues: number[] = recentSignals
      .filter((s: any) =>
        s.workout &&
        s.workout.date >= cutoffStr &&
        !s.workout.excludeFromEstimates &&
        s.effectiveVo2max != null
      )
      .map((s: any) => s.effectiveVo2max as number)
      .sort((a: number, b: number) => a - b);

    // Need at least 5 data points to establish baseline
    if (recentVo2maxValues.length < 5) return;

    // Compute median
    const mid = Math.floor(recentVo2maxValues.length / 2);
    const median = recentVo2maxValues.length % 2 === 0
      ? (recentVo2maxValues[mid - 1] + recentVo2maxValues[mid]) / 2
      : recentVo2maxValues[mid];

    // Check if current value deviates >20% from median
    const deviationPct = ((currentVo2max - median) / median) * 100;

    if (Math.abs(deviationPct) > 20) {
      const direction = deviationPct > 0 ? 'higher' : 'lower';
      const reason = `Auto-excluded: effectiveVO2max (${currentVo2max.toFixed(1)}) is ${Math.abs(deviationPct).toFixed(0)}% ${direction} than recent median (${median.toFixed(1)})`;

      await db.update(workouts)
        .set({
          excludeFromEstimates: true,
          autoExcluded: true,
          excludeReason: reason,
        })
        .where(eq(workouts.id, workoutId));
    }
  } catch (error) {
    console.error(`[checkAutoExclusion] Failed for workout ${workoutId}:`, error);
    // Non-critical — don't throw
  }
}
