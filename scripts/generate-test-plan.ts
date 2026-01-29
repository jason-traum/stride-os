// Generate a test plan and save to database
// Run with: NODE_ENV=development npx tsx scripts/generate-test-plan.ts

// Note: Set NODE_ENV=development when running this script

import { db, races, trainingBlocks, plannedWorkouts } from '../src/lib/db';
import { eq, asc } from 'drizzle-orm';
import { generateTrainingPlan } from '../src/lib/training/plan-generator';
import { calculatePaceZones } from '../src/lib/training/vdot-calculator';
import type { PlanGenerationInput } from '../src/lib/training/types';
import type { Race } from '../src/lib/schema';

async function main() {
  // Get user settings
  const settings = await db.query.userSettings.findFirst();
  if (!settings) {
    console.error('No user settings found');
    return;
  }

  console.log('\n=== User Settings ===');
  console.log('currentWeeklyMileage:', settings.currentWeeklyMileage);
  console.log('peakWeeklyMileageTarget:', settings.peakWeeklyMileageTarget);
  console.log('preferredQualityDays:', settings.preferredQualityDays);

  // Get a race with distance > 0
  const allRaces = await db.select().from(races).orderBy(asc(races.date));
  const race = allRaces.find((r: Race) => r.distanceMeters > 0);

  if (!race) {
    console.error('No valid race found');
    return;
  }

  console.log('\n=== Race ===');
  console.log('name:', race.name);
  console.log('date:', race.date);
  console.log('distanceMeters:', race.distanceMeters);

  // Build input
  const paceZones = settings.vdot ? calculatePaceZones(settings.vdot) : undefined;

  const input: PlanGenerationInput = {
    currentWeeklyMileage: settings.currentWeeklyMileage!,
    peakWeeklyMileageTarget: settings.peakWeeklyMileageTarget || Math.round(settings.currentWeeklyMileage! * 1.5),
    runsPerWeek: settings.runsPerWeekTarget || settings.runsPerWeekCurrent || 5,
    preferredLongRunDay: settings.preferredLongRunDay || 'sunday',
    preferredQualityDays: settings.preferredQualityDays
      ? JSON.parse(settings.preferredQualityDays)
      : ['tuesday', 'thursday'],
    requiredRestDays: settings.requiredRestDays
      ? JSON.parse(settings.requiredRestDays)
      : [],
    planAggressiveness: (settings.planAggressiveness as 'conservative' | 'moderate' | 'aggressive') || 'moderate',
    qualitySessionsPerWeek: settings.qualitySessionsPerWeek || 2,
    raceId: race.id,
    raceDate: race.date,
    raceDistanceMeters: race.distanceMeters,
    raceDistanceLabel: race.distanceLabel,
    vdot: settings.vdot ?? undefined,
    paceZones,
    startDate: new Date().toISOString().split('T')[0],
  };

  console.log('\n=== Generating Plan ===');
  const plan = generateTrainingPlan(input);

  console.log('totalWeeks:', plan.totalWeeks);
  console.log('Total workouts to save:', plan.weeks.reduce((sum, w) => sum + w.workouts.length, 0));

  // Save to database
  console.log('\n=== Saving to Database ===');
  const now = new Date().toISOString();

  // Delete existing
  const existingBlocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, race.id),
  });
  for (const block of existingBlocks) {
    await db.delete(plannedWorkouts).where(eq(plannedWorkouts.trainingBlockId, block.id));
  }
  await db.delete(trainingBlocks).where(eq(trainingBlocks.raceId, race.id));

  // Create blocks first, collect all IDs
  const blockIdsByWeek: Record<number, number> = {};

  for (const week of plan.weeks) {
    const [block] = await db.insert(trainingBlocks).values({
      raceId: race.id,
      name: `${week.phase.charAt(0).toUpperCase() + week.phase.slice(1)} - Week ${week.weekNumber}`,
      phase: week.phase,
      startDate: week.startDate,
      endDate: week.endDate,
      weekNumber: week.weekNumber,
      targetMileage: week.targetMileage,
      focus: week.focus,
      createdAt: now,
    }).returning();

    blockIdsByWeek[week.weekNumber] = block.id;
    console.log(`Created block for week ${week.weekNumber}: id=${block.id}`);
  }

  // Now create workouts
  let totalWorkoutsSaved = 0;

  for (const week of plan.weeks) {
    const blockId = blockIdsByWeek[week.weekNumber];

    if (!blockId) {
      console.error(`ERROR: No block found for week ${week.weekNumber}`);
      continue;
    }

    for (const workout of week.workouts) {
      const workoutTypeMap: Record<string, string> = {
        'easy': 'easy',
        'long': 'long',
        'quality': 'tempo',
        'rest': 'recovery',
      };

      try {
        await db.insert(plannedWorkouts).values({
          raceId: race.id,
          trainingBlockId: blockId,
          date: workout.date,
          templateId: null, // TODO: Map to correct template IDs
          workoutType: workoutTypeMap[workout.workoutType] || 'other',
          name: workout.name,
          description: workout.description,
          targetDistanceMiles: workout.targetDistanceMiles ?? null,
          targetDurationMinutes: workout.targetDurationMinutes ?? null,
          targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile ?? null,
          structure: workout.structure ? JSON.stringify(workout.structure) : null,
          rationale: workout.rationale,
          isKeyWorkout: workout.isKeyWorkout,
          alternatives: workout.alternatives ? JSON.stringify(workout.alternatives) : null,
          status: 'scheduled',
          createdAt: now,
          updatedAt: now,
        });
        totalWorkoutsSaved++;
      } catch (err) {
        console.error(`Error saving workout for week ${week.weekNumber}:`, err);
      }
    }
  }

  console.log(`\nTotal workouts saved: ${totalWorkoutsSaved}`);

  // Update race flag
  await db.update(races)
    .set({ trainingPlanGenerated: true, updatedAt: now })
    .where(eq(races.id, race.id));

  // Verify
  const savedWorkouts = await db.query.plannedWorkouts.findMany({
    where: eq(plannedWorkouts.raceId, race.id),
  });
  console.log(`Verified workouts in DB: ${savedWorkouts.length}`);

  // Show sample
  console.log('\n=== Sample Workouts ===');
  const sample = savedWorkouts.slice(0, 10);
  for (const w of sample) {
    console.log(`${w.date}: ${w.name} (${w.workoutType})`);
  }
}

main().catch(console.error);
