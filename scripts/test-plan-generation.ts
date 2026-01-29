// Test script for plan generation
// Run with: npx tsx scripts/test-plan-generation.ts

import Database from 'better-sqlite3';
import path from 'path';

// Import the plan generator directly
import { generateTrainingPlan } from '../src/lib/training/plan-generator';
import { calculatePaceZones } from '../src/lib/training/vdot-calculator';
import type { PlanGenerationInput } from '../src/lib/training/types';

const dataDir = path.join(process.cwd(), 'data');
const db = new Database(path.join(dataDir, 'stride.db'));

// Get user settings
const settings = db.prepare('SELECT * FROM user_settings LIMIT 1').get() as Record<string, unknown>;
console.log('\n=== User Settings ===');
console.log('currentWeeklyMileage:', settings.current_weekly_mileage);
console.log('peakWeeklyMileageTarget:', settings.peak_weekly_mileage_target);
console.log('runsPerWeekTarget:', settings.runs_per_week_target);
console.log('preferredLongRunDay:', settings.preferred_long_run_day);
console.log('preferredQualityDays:', settings.preferred_quality_days);
console.log('requiredRestDays:', settings.required_rest_days);
console.log('qualitySessionsPerWeek:', settings.quality_sessions_per_week);
console.log('vdot:', settings.vdot);

// Get a race
const race = db.prepare('SELECT * FROM races WHERE distance_meters > 0 LIMIT 1').get() as Record<string, unknown>;
console.log('\n=== Race ===');
console.log('name:', race.name);
console.log('date:', race.date);
console.log('distanceMeters:', race.distance_meters);
console.log('distanceLabel:', race.distance_label);

// Build input
const paceZones = settings.vdot ? calculatePaceZones(settings.vdot as number) : undefined;

const input: PlanGenerationInput = {
  currentWeeklyMileage: settings.current_weekly_mileage as number,
  peakWeeklyMileageTarget: (settings.peak_weekly_mileage_target as number) || Math.round((settings.current_weekly_mileage as number) * 1.5),
  runsPerWeek: (settings.runs_per_week_target as number) || 5,
  preferredLongRunDay: (settings.preferred_long_run_day as string) || 'sunday',
  preferredQualityDays: settings.preferred_quality_days
    ? JSON.parse(settings.preferred_quality_days as string)
    : ['tuesday', 'thursday'],
  requiredRestDays: settings.required_rest_days
    ? JSON.parse(settings.required_rest_days as string)
    : [],
  planAggressiveness: (settings.plan_aggressiveness as 'conservative' | 'moderate' | 'aggressive') || 'moderate',
  qualitySessionsPerWeek: (settings.quality_sessions_per_week as number) || 2,
  raceId: race.id as number,
  raceDate: race.date as string,
  raceDistanceMeters: race.distance_meters as number,
  raceDistanceLabel: race.distance_label as string,
  vdot: settings.vdot as number | undefined,
  paceZones,
  startDate: new Date().toISOString().split('T')[0],
};

console.log('\n=== Plan Generation Input ===');
console.log(JSON.stringify(input, null, 2));

// Generate plan
console.log('\n=== Generating Plan ===');
try {
  const plan = generateTrainingPlan(input);

  console.log('\n=== Plan Summary ===');
  console.log('totalWeeks:', plan.totalWeeks);
  console.log('phases:', plan.phases.map(p => `${p.phase}(${p.weeks})`).join(', '));

  console.log('\n=== Weeks ===');
  for (const week of plan.weeks) {
    console.log(`Week ${week.weekNumber} (${week.phase}): ${week.workouts.length} workouts, ${week.targetMileage} miles`);
    for (const w of week.workouts) {
      console.log(`  - ${w.date} ${w.dayOfWeek}: ${w.name} (${w.workoutType})`);
    }
  }
} catch (error) {
  console.error('Plan generation error:', error);
}
