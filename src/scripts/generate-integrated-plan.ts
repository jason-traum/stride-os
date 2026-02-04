/**
 * Generate integrated training plan for:
 * - United NYC Half: March 15, 2026 (B race - tune-up)
 * - Jersey City Marathon: April 19, 2026 (A race - primary goal)
 *
 * The plan generator will:
 * 1. Build to the A race (marathon) as the primary goal
 * 2. Incorporate the B race (half) as an intermediate tune-up
 * 3. Include proper taper before the half and recovery after
 *
 * Run with: npx tsx src/scripts/generate-integrated-plan.ts
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

async function main() {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);

  console.log('='.repeat(60));
  console.log('GENERATING INTEGRATED TRAINING PLAN');
  console.log('='.repeat(60));

  // Get the races
  const races = await sql`
    SELECT id, name, date, priority, distance_label, distance_meters, target_time_seconds
    FROM races
    ORDER BY date ASC
  `;

  console.log('\nRaces found:');
  races.forEach(r => {
    console.log(`  [${r.priority}] ${r.name} - ${r.date}`);
  });

  // Find the A race (marathon)
  const marathonRace = races.find(r => r.priority === 'A');
  const halfRace = races.find(r => r.priority === 'B');

  if (!marathonRace) {
    console.error('No A race found!');
    process.exit(1);
  }

  console.log(`\nPrimary goal: ${marathonRace.name} (${marathonRace.date})`);
  if (halfRace) {
    console.log(`Intermediate race: ${halfRace.name} (${halfRace.date})`);
  }

  // Get user settings
  const settings = await sql`
    SELECT
      vdot, current_weekly_mileage, peak_weekly_mileage_target,
      current_long_run_max, runs_per_week_target, runs_per_week_current,
      preferred_long_run_day, preferred_quality_days, required_rest_days,
      plan_aggressiveness, quality_sessions_per_week,
      easy_pace_seconds, tempo_pace_seconds, threshold_pace_seconds,
      interval_pace_seconds, marathon_pace_seconds, half_marathon_pace_seconds
    FROM user_settings
    LIMIT 1
  `;

  if (settings.length === 0) {
    console.error('No user settings found!');
    process.exit(1);
  }

  const userSettings = settings[0];
  console.log(`\nUser settings:`);
  console.log(`  VDOT: ${userSettings.vdot}`);
  console.log(`  Current weekly mileage: ${userSettings.current_weekly_mileage} mi`);
  console.log(`  Peak weekly target: ${userSettings.peak_weekly_mileage_target} mi`);
  console.log(`  Runs per week: ${userSettings.runs_per_week_target || userSettings.runs_per_week_current || 5}`);

  // Calculate weeks until race
  const today = new Date();
  const raceDate = new Date(marathonRace.date);
  const weeksUntilRace = Math.floor((raceDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));

  console.log(`\nWeeks until marathon: ${weeksUntilRace}`);

  if (weeksUntilRace < 4) {
    console.error('Not enough time for a training plan. Need at least 4 weeks.');
    process.exit(1);
  }

  // We can't directly call the server action from a script, so let me explain
  // what needs to happen and mark the race as needing plan generation
  console.log('\n' + '='.repeat(60));
  console.log('PLAN GENERATION INSTRUCTIONS');
  console.log('='.repeat(60));
  console.log(`
To generate the integrated training plan:

1. Go to the Races page (/races)
2. Click on "Jersey City Marathon" (the A race)
3. Click "Generate Training Plan"

The system will automatically:
- Start the plan from today
- Build towards the marathon (April 19, 2026)
- Incorporate United NYC Half (March 15, 2026) as a B race
- Include mini-taper before the half
- Include recovery week after the half
- Continue build and final taper for the marathon

Alternatively, you can ask the AI Coach:
"Generate a training plan for my Jersey City Marathon"

The coach will use the generatePlanForRace action which handles
all the intermediate race logic automatically.
`);

  // Mark both races as needing plans (reset any existing)
  const now = new Date().toISOString();
  await sql`
    UPDATE races
    SET training_plan_generated = false, updated_at = ${now}
    WHERE id IN (${marathonRace.id}, ${halfRace?.id || marathonRace.id})
  `;

  // Clear any existing training blocks and planned workouts
  console.log('\nClearing existing plan data...');
  await sql`DELETE FROM planned_workouts WHERE race_id IN (${marathonRace.id}, ${halfRace?.id || marathonRace.id})`;
  await sql`DELETE FROM training_blocks WHERE race_id IN (${marathonRace.id}, ${halfRace?.id || marathonRace.id})`;
  console.log('  [x] Cleared existing training blocks and planned workouts');

  console.log('\n' + '='.repeat(60));
  console.log('Ready for plan generation!');
  console.log('='.repeat(60));
  console.log(`
Next steps:
1. Visit /races in the app
2. Generate the plan for Jersey City Marathon
3. The United Half will be incorporated automatically
`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
