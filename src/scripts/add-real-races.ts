/**
 * Add real races for Jason:
 * - United Half (March 15, 2026) - Half Marathon
 * - Jersey City Marathon (April 19, 2026) - Marathon
 *
 * Run with: npx tsx src/scripts/add-real-races.ts
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
    console.log('Loaded environment from .env.local');
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
  console.log('ADDING REAL RACES');
  console.log('='.repeat(60));

  // Get the active profile (likely "Jason" or profile with existing workouts)
  const profiles = await sql`
    SELECT p.id, p.name, COUNT(w.id) as workout_count
    FROM profiles p
    LEFT JOIN workouts w ON w.profile_id = p.id
    GROUP BY p.id, p.name
    ORDER BY workout_count DESC
    LIMIT 1
  `;

  let profileId: number | null = null;
  if (profiles.length > 0) {
    profileId = profiles[0].id;
    console.log(`Using profile: ${profiles[0].name} (ID: ${profileId})`);
  } else {
    console.log('No profile found, using NULL profile_id');
  }

  const now = new Date().toISOString();

  // Check if races already exist
  const existingRaces = await sql`
    SELECT name, date FROM races
    WHERE (name ILIKE '%united%half%' OR name ILIKE '%jersey%city%marathon%')
  `;

  if (existingRaces.length > 0) {
    console.log('\nExisting races found:');
    existingRaces.forEach(r => console.log(`  - ${r.name} (${r.date})`));
    console.log('Skipping creation to avoid duplicates.');
    return;
  }

  // Race 1: United Half - March 15, 2026
  // Target time: ~1:35:00 (5520 seconds) for a 42 VDOT runner
  const unitedHalf = {
    name: 'United NYC Half',
    date: '2026-03-15',
    distanceMeters: RACE_DISTANCES.half_marathon.meters,
    distanceLabel: 'half_marathon',
    priority: 'B' as const, // B race (tune-up for marathon)
    targetTimeSeconds: 5520, // 1:32:00 (good target for ~42 VDOT)
    targetPaceSecondsPerMile: Math.round(5520 / 13.1), // ~421 sec/mi = 7:01/mi
    location: 'New York, NY',
    notes: 'Tune-up race for Jersey City Marathon. Run strong but controlled.',
  };

  // Race 2: Jersey City Marathon - April 19, 2026
  // Target time: ~3:20:00 (12000 seconds) for a 42 VDOT runner
  const jerseyMarathon = {
    name: 'Jersey City Marathon',
    date: '2026-04-19',
    distanceMeters: RACE_DISTANCES.marathon.meters,
    distanceLabel: 'marathon',
    priority: 'A' as const, // A race (main goal)
    targetTimeSeconds: 12000, // 3:20:00 (good marathon target for ~42 VDOT)
    targetPaceSecondsPerMile: Math.round(12000 / 26.2), // ~458 sec/mi = 7:38/mi
    location: 'Jersey City, NJ',
    notes: 'Primary goal race. Target sub-3:20.',
  };

  console.log('\nAdding races...\n');

  // Insert United Half
  await sql`
    INSERT INTO races (
      profile_id, name, date, distance_meters, distance_label, priority,
      target_time_seconds, target_pace_seconds_per_mile, location, notes,
      training_plan_generated, created_at, updated_at
    ) VALUES (
      ${profileId}, ${unitedHalf.name}, ${unitedHalf.date},
      ${unitedHalf.distanceMeters}, ${unitedHalf.distanceLabel}, ${unitedHalf.priority},
      ${unitedHalf.targetTimeSeconds}, ${unitedHalf.targetPaceSecondsPerMile},
      ${unitedHalf.location}, ${unitedHalf.notes},
      false, ${now}, ${now}
    )
  `;
  console.log(`  [x] ${unitedHalf.name} - ${unitedHalf.date}`);
  console.log(`      Target: 1:32:00 (7:01/mi) - Priority: B`);

  // Insert Jersey City Marathon
  await sql`
    INSERT INTO races (
      profile_id, name, date, distance_meters, distance_label, priority,
      target_time_seconds, target_pace_seconds_per_mile, location, notes,
      training_plan_generated, created_at, updated_at
    ) VALUES (
      ${profileId}, ${jerseyMarathon.name}, ${jerseyMarathon.date},
      ${jerseyMarathon.distanceMeters}, ${jerseyMarathon.distanceLabel}, ${jerseyMarathon.priority},
      ${jerseyMarathon.targetTimeSeconds}, ${jerseyMarathon.targetPaceSecondsPerMile},
      ${jerseyMarathon.location}, ${jerseyMarathon.notes},
      false, ${now}, ${now}
    )
  `;
  console.log(`  [x] ${jerseyMarathon.name} - ${jerseyMarathon.date}`);
  console.log(`      Target: 3:20:00 (7:38/mi) - Priority: A`);

  // Verify races were added
  const verifyRaces = await sql`
    SELECT id, name, date, priority, distance_label, target_time_seconds
    FROM races
    ORDER BY date ASC
  `;

  console.log('\n' + '='.repeat(60));
  console.log('CURRENT RACES:');
  console.log('='.repeat(60));
  verifyRaces.forEach(r => {
    const time = r.target_time_seconds
      ? `${Math.floor(r.target_time_seconds / 3600)}:${String(Math.floor((r.target_time_seconds % 3600) / 60)).padStart(2, '0')}:${String(r.target_time_seconds % 60).padStart(2, '0')}`
      : 'No target';
    console.log(`  [${r.priority}] ${r.name}`);
    console.log(`      Date: ${r.date} | Distance: ${r.distance_label} | Target: ${time}`);
  });

  console.log('\nRaces added successfully!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
