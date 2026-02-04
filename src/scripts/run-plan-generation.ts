/**
 * Actually generate the integrated training plan by calling the plan generator directly.
 *
 * Run with: npx tsx src/scripts/run-plan-generation.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex !== -1) {
          let value = trimmed.substring(eqIndex + 1);
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[trimmed.substring(0, eqIndex)] = value;
        }
      }
    });
  }
}

loadEnv();

// Import the plan generator directly
import { generateTrainingPlan } from '../lib/training/plan-generator';
import { calculatePaceZones } from '../lib/training/vdot-calculator';
import type { PlanGenerationInput, IntermediateRace } from '../lib/training/types';

async function main() {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);

  console.log('='.repeat(60));
  console.log('GENERATING TRAINING PLAN');
  console.log('='.repeat(60));

  // Get the races
  const races = await sql`
    SELECT id, name, date, priority, distance_label, distance_meters, target_time_seconds
    FROM races
    ORDER BY date ASC
  `;

  const marathonRace = races.find((r: any) => r.priority === 'A');
  const halfRace = races.find((r: any) => r.priority === 'B');

  if (!marathonRace) {
    throw new Error('No A race (marathon) found');
  }

  console.log(`\nGenerating plan for: ${marathonRace.name}`);
  console.log(`Race date: ${marathonRace.date}`);

  // Get user settings
  const settings = await sql`
    SELECT * FROM user_settings LIMIT 1
  `;

  if (settings.length === 0) {
    throw new Error('No user settings found');
  }

  const userSettings = settings[0];

  // Build pace zones from VDOT
  const paceZones = userSettings.vdot ? calculatePaceZones(userSettings.vdot) : undefined;

  // Build intermediate races array
  const intermediateRaces: IntermediateRace[] = [];
  if (halfRace) {
    intermediateRaces.push({
      id: halfRace.id,
      name: halfRace.name,
      date: halfRace.date,
      distanceMeters: halfRace.distance_meters,
      distanceLabel: halfRace.distance_label,
      priority: halfRace.priority as 'B' | 'C',
    });
    console.log(`Including intermediate race: ${halfRace.name} (${halfRace.date})`);
  }

  // Build the plan generation input
  const today = new Date();
  const startDate = today.toISOString().split('T')[0];

  const input: PlanGenerationInput = {
    currentWeeklyMileage: userSettings.current_weekly_mileage || 40,
    peakWeeklyMileageTarget: userSettings.peak_weekly_mileage_target || 55,
    currentLongRunMax: userSettings.current_long_run_max || undefined,
    runsPerWeek: userSettings.runs_per_week_target || userSettings.runs_per_week_current || 5,
    preferredLongRunDay: userSettings.preferred_long_run_day || 'sunday',
    preferredQualityDays: userSettings.preferred_quality_days
      ? JSON.parse(userSettings.preferred_quality_days)
      : ['tuesday', 'thursday'],
    requiredRestDays: userSettings.required_rest_days
      ? JSON.parse(userSettings.required_rest_days)
      : [],
    planAggressiveness: userSettings.plan_aggressiveness || 'moderate',
    qualitySessionsPerWeek: userSettings.quality_sessions_per_week || 2,
    raceId: marathonRace.id,
    raceDate: marathonRace.date,
    raceDistanceMeters: marathonRace.distance_meters,
    raceDistanceLabel: marathonRace.distance_label,
    vdot: userSettings.vdot ?? undefined,
    paceZones,
    startDate,
    intermediateRaces,
  };

  console.log('\nPlan input:');
  console.log(`  Start date: ${startDate}`);
  console.log(`  Race date: ${marathonRace.date}`);
  console.log(`  Current mileage: ${input.currentWeeklyMileage} mi/week`);
  console.log(`  Peak target: ${input.peakWeeklyMileageTarget} mi/week`);
  console.log(`  Runs per week: ${input.runsPerWeek}`);
  console.log(`  Quality sessions: ${input.qualitySessionsPerWeek}`);
  console.log(`  VDOT: ${input.vdot}`);

  // Generate the plan
  console.log('\nGenerating plan...\n');
  const plan = generateTrainingPlan(input);
  plan.raceName = marathonRace.name;

  console.log('='.repeat(60));
  console.log('PLAN GENERATED SUCCESSFULLY');
  console.log('='.repeat(60));
  console.log(`\nTotal weeks: ${plan.totalWeeks}`);
  console.log(`Phases: ${plan.phases.map(p => `${p.phase}(${p.weeks}wks)`).join(' → ')}`);

  // Show week-by-week summary
  console.log('\n' + '-'.repeat(60));
  console.log('WEEKLY SUMMARY');
  console.log('-'.repeat(60));

  for (const week of plan.weeks) {
    const weekNum = String(week.weekNumber).padStart(2, ' ');
    const phase = week.phase.padEnd(6, ' ');
    const miles = String(week.targetMileage).padStart(4, ' ');
    const longRun = String(week.longRunMiles).padStart(4, ' ');
    const keyWorkouts = week.workouts.filter(w => w.isKeyWorkout).length;
    const marker = week.isDownWeek ? '  [DOWN]' : '';

    // Check if this week has the half marathon
    const hasHalf = week.workouts.some(w => w.workoutType === 'race');
    const raceMarker = hasHalf ? '  ** RACE **' : '';

    console.log(`Week ${weekNum}: ${phase} | ${miles} mi | Long: ${longRun} mi | Key: ${keyWorkouts}${marker}${raceMarker}`);
  }

  // Save the plan to the database
  console.log('\n' + '='.repeat(60));
  console.log('SAVING PLAN TO DATABASE');
  console.log('='.repeat(60));

  const now = new Date().toISOString();

  // First, clear any existing plan data
  await sql`DELETE FROM planned_workouts WHERE race_id = ${marathonRace.id}`;
  await sql`DELETE FROM training_blocks WHERE race_id = ${marathonRace.id}`;

  // Create training blocks for each week
  for (const week of plan.weeks) {
    // Insert training block
    const blockResult = await sql`
      INSERT INTO training_blocks (
        race_id, name, phase, start_date, end_date, week_number,
        target_mileage, focus, created_at
      ) VALUES (
        ${marathonRace.id},
        ${`${week.phase.charAt(0).toUpperCase() + week.phase.slice(1)} - Week ${week.weekNumber}`},
        ${week.phase},
        ${week.startDate},
        ${week.endDate},
        ${week.weekNumber},
        ${week.targetMileage},
        ${week.focus},
        ${now}
      )
      RETURNING id
    `;

    const blockId = blockResult[0].id;

    // Insert workouts for this week
    for (const workout of week.workouts) {
      const workoutTypeMap: Record<string, string> = {
        'easy': 'easy',
        'long': 'long',
        'quality': 'tempo',
        'rest': 'recovery',
        'tempo': 'tempo',
        'threshold': 'tempo',
        'interval': 'interval',
        'race': 'race',
      };

      await sql`
        INSERT INTO planned_workouts (
          race_id, training_block_id, date, workout_type, name, description,
          target_distance_miles, target_duration_minutes, target_pace_seconds_per_mile,
          structure, rationale, is_key_workout, status, created_at, updated_at
        ) VALUES (
          ${marathonRace.id},
          ${blockId},
          ${workout.date},
          ${workoutTypeMap[workout.workoutType] || 'other'},
          ${workout.name},
          ${workout.description},
          ${workout.targetDistanceMiles ?? null},
          ${workout.targetDurationMinutes ?? null},
          ${workout.targetPaceSecondsPerMile ?? null},
          ${workout.structure ? JSON.stringify(workout.structure) : null},
          ${workout.rationale || null},
          ${workout.isKeyWorkout || false},
          'scheduled',
          ${now},
          ${now}
        )
      `;
    }
  }

  // Mark race as having a plan
  await sql`
    UPDATE races
    SET training_plan_generated = true, updated_at = ${now}
    WHERE id = ${marathonRace.id}
  `;

  console.log(`\nSaved ${plan.weeks.length} weeks and ${plan.weeks.reduce((sum, w) => sum + w.workouts.length, 0)} workouts`);

  // Show key dates
  console.log('\n' + '='.repeat(60));
  console.log('KEY DATES');
  console.log('='.repeat(60));
  console.log(`Today: ${startDate}`);
  if (halfRace) {
    console.log(`United NYC Half: ${halfRace.date} (B race)`);
  }
  console.log(`Jersey City Marathon: ${marathonRace.date} (A race)`);

  console.log('\n' + '='.repeat(60));
  console.log('PLAN GENERATION COMPLETE!');
  console.log('='.repeat(60));
  console.log('\nView your plan at: /plan');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
