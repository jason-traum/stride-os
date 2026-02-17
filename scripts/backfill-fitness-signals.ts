/**
 * Backfill script: Compute fitness signals for all existing workouts.
 * Run with: npx tsx scripts/backfill-fitness-signals.ts
 */

import { db } from '../src/lib/db';
import { workouts, workoutFitnessSignals, userSettings } from '../src/lib/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { getWeatherPaceAdjustment } from '../src/lib/training/vdot-calculator';

const METERS_PER_MILE = 1609.34;
const STEADY_STATE_TYPES = ['easy', 'steady', 'long', 'tempo', 'threshold', 'recovery', 'marathon'];

async function main() {
  console.log('Backfilling workout fitness signals...');

  // Get all workouts that don't have signals yet
  const allWorkouts = await db.select().from(workouts);

  const existingSignals = await db.select({ workoutId: workoutFitnessSignals.workoutId }).from(workoutFitnessSignals);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingIds = new Set(existingSignals.map((s: any) => s.workoutId));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toProcess = allWorkouts.filter((w: any) =>
    !existingIds.has(w.id) &&
    w.distanceMiles && w.distanceMiles > 0 &&
    w.durationMinutes && w.durationMinutes > 0
  );

  console.log(`Found ${toProcess.length} workouts to process (${existingIds.size} already done)`);

  // Cache settings by profileId
  const settingsCache = new Map<number | null, typeof userSettings.$inferSelect | null>();
  async function getCachedSettings(profileId: number | null) {
    if (settingsCache.has(profileId)) return settingsCache.get(profileId);
    if (!profileId) { settingsCache.set(null, null); return null; }
    const s = await db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1);
    const result = s[0] || null;
    settingsCache.set(profileId, result);
    return result;
  }

  let processed = 0;
  let skipped = 0;

  for (const workout of toProcess) {
    try {
      const settings = await getCachedSettings(workout.profileId);
      const restingHr = settings?.restingHr || 60;
      const age = settings?.age;
      const maxHrFromAge = age ? 220 - age : 185;
      const maxHr = Math.max(maxHrFromAge, workout.maxHr || 0);
      const hrRange = maxHr - restingHr;

      const avgHr = workout.avgHr || workout.avgHeartRate;
      const isSteadyState = STEADY_STATE_TYPES.includes(workout.workoutType);

      let hrReservePct: number | null = null;
      if (avgHr && hrRange > 20) {
        hrReservePct = Math.max(0, Math.min(1, (avgHr - restingHr) / hrRange));
      }

      const distanceMeters = workout.distanceMiles! * METERS_PER_MILE;
      let velocity = distanceMeters / (workout.durationMinutes! * 60) * 60;

      let weatherAdjustedPace: number | null = null;
      if (workout.weatherTempF != null && workout.weatherHumidityPct != null && workout.avgPaceSeconds) {
        const adjustment = getWeatherPaceAdjustment(workout.weatherTempF, workout.weatherHumidityPct);
        if (adjustment > 0) {
          weatherAdjustedPace = workout.avgPaceSeconds - adjustment;
          if (weatherAdjustedPace > 0) velocity = METERS_PER_MILE / (weatherAdjustedPace / 60);
        }
      }

      let elevationAdjustedPace: number | null = null;
      const elevGain = workout.elevationGainFt || workout.elevationGainFeet;
      if (elevGain && elevGain > 0 && workout.distanceMiles! > 0 && workout.avgPaceSeconds) {
        const gainPerMile = elevGain / workout.distanceMiles!;
        const elevCorrection = Math.round((gainPerMile / 100) * 12);
        if (elevCorrection > 0) elevationAdjustedPace = workout.avgPaceSeconds - elevCorrection;
      }

      let effectiveVo2max: number | null = null;
      if (isSteadyState && hrReservePct != null && hrReservePct > 0.50 && hrReservePct < 0.92) {
        const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
        const pctVo2max = 1.4854 * hrReservePct - 0.3702;
        if (pctVo2max > 0.2 && pctVo2max <= 1.0) {
          effectiveVo2max = vo2 / pctVo2max;
          if (effectiveVo2max < 15 || effectiveVo2max > 85) effectiveVo2max = null;
        }
      }

      let efficiencyFactor: number | null = null;
      if (avgHr && avgHr > 0) efficiencyFactor = velocity / avgHr;

      await db.insert(workoutFitnessSignals).values({
        workoutId: workout.id,
        profileId: workout.profileId,
        effectiveVo2max: effectiveVo2max ? Math.round(effectiveVo2max * 10) / 10 : null,
        efficiencyFactor: efficiencyFactor ? Math.round(efficiencyFactor * 1000) / 1000 : null,
        aerobicDecouplingPct: null,
        weatherAdjustedPace,
        elevationAdjustedPace,
        hrReservePct: hrReservePct ? Math.round(hrReservePct * 1000) / 1000 : null,
        isSteadyState,
        computedAt: new Date().toISOString(),
      });

      processed++;
      if (processed % 50 === 0) {
        console.log(`  Processed ${processed}/${toProcess.length}...`);
      }
    } catch (error) {
      skipped++;
    }
  }

  console.log(`Done! Processed: ${processed}, Skipped: ${skipped}`);
}

main().catch(console.error);
