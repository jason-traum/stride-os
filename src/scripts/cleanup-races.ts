/**
 * Clean up races and ensure correct 2026 races exist:
 * - United NYC Half: March 15, 2026 (B race)
 * - Jersey City Marathon: April 19, 2026 (A race)
 *
 * Run with: npx tsx src/scripts/cleanup-races.ts
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

const RACE_DISTANCES = {
  'half_marathon': { meters: 21097, miles: 13.1 },
  'marathon': { meters: 42195, miles: 26.2 },
};

async function main() {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);

  console.log('='.repeat(60));
  console.log('RACE CLEANUP AND SETUP');
  console.log('='.repeat(60));

  // Get Jason's profile ID
  const profiles = await sql`
    SELECT id, name FROM profiles WHERE name ILIKE '%jason%' LIMIT 1
  `;
  const profileId = profiles.length > 0 ? profiles[0].id : 1;
  console.log(`Using profile ID: ${profileId}`);

  // Step 1: Delete all existing races (clean slate)
  console.log('\n1. Cleaning up existing races...');
  const deleted = await sql`DELETE FROM races RETURNING id`;
  console.log(`   Deleted ${deleted.length} races`);

  // Step 2: Add the two correct 2026 races
  console.log('\n2. Adding 2026 races...');
  const now = new Date().toISOString();

  // United NYC Half - March 15, 2026
  // Target: 1:32:00 (5520 sec) = 7:01/mi pace
  await sql`
    INSERT INTO races (
      profile_id, name, date, distance_meters, distance_label, priority,
      target_time_seconds, target_pace_seconds_per_mile, location, notes,
      training_plan_generated, created_at, updated_at
    ) VALUES (
      ${profileId},
      'United NYC Half',
      '2026-03-15',
      ${RACE_DISTANCES.half_marathon.meters},
      'half_marathon',
      'B',
      5520,
      ${Math.round(5520 / 13.1)},
      'New York, NY',
      'Tune-up race for Jersey City Marathon. Run strong but controlled. Good test of marathon fitness.',
      false,
      ${now},
      ${now}
    )
  `;
  console.log('   [x] United NYC Half - March 15, 2026');
  console.log('       Target: 1:32:00 (7:01/mi) - Priority B');

  // Jersey City Marathon - April 19, 2026
  // Target: 3:20:00 (12000 sec) = 7:38/mi pace
  await sql`
    INSERT INTO races (
      profile_id, name, date, distance_meters, distance_label, priority,
      target_time_seconds, target_pace_seconds_per_mile, location, notes,
      training_plan_generated, created_at, updated_at
    ) VALUES (
      ${profileId},
      'Jersey City Marathon',
      '2026-04-19',
      ${RACE_DISTANCES.marathon.meters},
      'marathon',
      'A',
      12000,
      ${Math.round(12000 / 26.2)},
      'Jersey City, NJ',
      'Primary goal race. Target sub-3:20. 5 weeks after United Half for recovery and final sharpening.',
      false,
      ${now},
      ${now}
    )
  `;
  console.log('   [x] Jersey City Marathon - April 19, 2026');
  console.log('       Target: 3:20:00 (7:38/mi) - Priority A');

  // Step 3: Verify final state
  console.log('\n3. Verifying races...');
  const finalRaces = await sql`
    SELECT id, name, date, priority, distance_label, target_time_seconds, location
    FROM races
    ORDER BY date ASC
  `;

  console.log('\n' + '='.repeat(60));
  console.log('FINAL RACE CALENDAR:');
  console.log('='.repeat(60));
  finalRaces.forEach(r => {
    const time = r.target_time_seconds
      ? `${Math.floor(r.target_time_seconds / 3600)}:${String(Math.floor((r.target_time_seconds % 3600) / 60)).padStart(2, '0')}:${String(r.target_time_seconds % 60).padStart(2, '0')}`
      : 'No target';
    console.log(`\n[${r.priority}] ${r.name}`);
    console.log(`    Date: ${r.date}`);
    console.log(`    Distance: ${r.distance_label}`);
    console.log(`    Target: ${time}`);
    console.log(`    Location: ${r.location}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('Race setup complete!');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
