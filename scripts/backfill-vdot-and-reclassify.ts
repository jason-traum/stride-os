/**
 * Backfill script: Update VDOT via multi-signal engine, then re-classify all workouts.
 *
 * What it does:
 * 1. Runs the multi-signal prediction engine to compute the best VDOT estimate
 * 2. Updates userSettings with the new VDOT + pace zones (with asymmetric smoothing)
 * 3. Re-processes all workouts through the classification pipeline so zone
 *    distributions, workout types, and quality ratios reflect the updated VDOT
 *
 * Run with: npx tsx scripts/backfill-vdot-and-reclassify.ts
 *
 * For production (Postgres): Set DATABASE_URL env var.
 */

import { db } from '../src/lib/db';
import { workouts, userSettings } from '../src/lib/schema';
import { eq } from 'drizzle-orm';
import { processWorkout } from '../src/lib/training/workout-processor';
import { getComprehensiveRacePredictions } from '../src/actions/race-predictor';
import { calculatePaceZones } from '../src/lib/training/vdot-calculator';

async function main() {
  console.log('=== VDOT Backfill & Workout Reclassification ===\n');

  // Step 1: Get current settings
  const allSettings = await db.select().from(userSettings);
  if (allSettings.length === 0) {
    console.error('No user settings found. Aborting.');
    return;
  }

  const settings = allSettings[0];
  const profileId = settings.profileId;
  const oldVdot = settings.vdot;

  console.log(`Profile ID: ${profileId}`);
  console.log(`Current VDOT: ${oldVdot ?? 'not set'}`);

  // Step 2: Run multi-signal prediction engine
  console.log('\nRunning multi-signal prediction engine...');
  const prediction = await getComprehensiveRacePredictions(profileId ?? undefined);

  if (!prediction || !prediction.vdot) {
    console.error('Multi-signal engine returned no VDOT. Aborting.');
    return;
  }

  const rawVdot = prediction.vdot;
  const confidence = prediction.confidence;
  const signalsUsed = prediction.dataQuality.signalsUsed;

  console.log(`Raw multi-signal VDOT: ${rawVdot} (confidence: ${confidence}, signals: ${signalsUsed})`);
  console.log(`Signals: ${prediction.signals.map(s => `${s.name}=${s.estimatedVdot}`).join(', ')}`);
  console.log(`Agreement: ${Math.round(prediction.agreementScore * 100)}%`);

  if (rawVdot < 15 || rawVdot > 85) {
    console.error(`VDOT ${rawVdot} is out of valid range (15-85). Aborting.`);
    return;
  }

  // Step 3: Apply asymmetric smoothing
  let smoothedVdot = rawVdot;

  if (oldVdot && oldVdot >= 15 && oldVdot <= 85) {
    const delta = rawVdot - oldVdot;

    if (delta > 0) {
      const upFactor = confidence === 'high' ? 0.85
        : confidence === 'medium' ? 0.75 : 0.60;
      smoothedVdot = oldVdot + delta * upFactor;
    } else if (delta < 0) {
      const downFactor = confidence === 'high' ? 0.40
        : confidence === 'medium' ? 0.30 : 0.20;
      smoothedVdot = oldVdot + delta * downFactor;
    }

    smoothedVdot = Math.round(smoothedVdot * 10) / 10;
  }

  console.log(`Smoothed VDOT: ${smoothedVdot} (old: ${oldVdot ?? 'none'})`);

  // Step 4: Update settings with new VDOT + pace zones
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

  console.log(`\nSettings updated: VDOT ${oldVdot ?? 'none'} → ${smoothedVdot}`);

  // Step 5: Re-classify all workouts
  console.log('\nRe-classifying workouts...');

  const allWorkouts = await db.select({ id: workouts.id }).from(workouts);
  console.log(`Found ${allWorkouts.length} workouts to re-process`);

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

      if (processed % 50 === 0) {
        console.log(`  Processed ${processed}/${allWorkouts.length}...`);
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.warn(`  Error processing workout ${workout.id}:`, err);
      }
    }
  }

  console.log(`\n=== Done! ===`);
  console.log(`VDOT: ${oldVdot ?? 'none'} → ${smoothedVdot}`);
  console.log(`Workouts re-classified: ${processed}, Errors: ${errors}`);
}

main().catch(console.error);
