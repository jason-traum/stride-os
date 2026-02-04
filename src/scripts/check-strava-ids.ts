/**
 * Quick check for strava_activity_id population
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

  // Check strava_activity_id population
  const withActivityId = await sql`SELECT COUNT(*) as count FROM workouts WHERE strava_activity_id IS NOT NULL`;
  console.log('Workouts with strava_activity_id:', withActivityId[0].count);

  const withoutActivityId = await sql`SELECT COUNT(*) as count FROM workouts WHERE source = 'strava' AND strava_activity_id IS NULL`;
  console.log('Strava workouts WITHOUT strava_activity_id:', withoutActivityId[0].count);

  // Check a few recent workouts
  const recent = await sql`
    SELECT w.id, w.date, w.source, w.strava_activity_id,
           (SELECT COUNT(*) FROM workout_segments ws WHERE ws.workout_id = w.id) as segment_count
    FROM workouts w
    WHERE w.source = 'strava'
    ORDER BY w.date DESC
    LIMIT 10
  `;
  console.log('\nRecent Strava workouts:');
  recent.forEach((w: any) => {
    console.log(`  - ID: ${w.id}, Date: ${w.date}, Strava ID: ${w.strava_activity_id}, Segments: ${w.segment_count}`);
  });

  // Count workouts that should have laps but don't
  const missingLaps = await sql`
    SELECT COUNT(*) as count
    FROM workouts w
    WHERE w.source = 'strava'
      AND w.strava_activity_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM workout_segments ws WHERE ws.workout_id = w.id)
  `;
  console.log('\nStrava workouts with activity ID but NO segments:', missingLaps[0].count);

  // Sample of workouts missing laps
  const sampleMissing = await sql`
    SELECT w.id, w.date, w.strava_activity_id, w.distance_miles
    FROM workouts w
    WHERE w.source = 'strava'
      AND w.strava_activity_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM workout_segments ws WHERE ws.workout_id = w.id)
    ORDER BY w.date DESC
    LIMIT 5
  `;
  if (sampleMissing.length > 0) {
    console.log('\nSample workouts missing laps:');
    sampleMissing.forEach((w: any) => {
      console.log(`  - ID: ${w.id}, Date: ${w.date}, Strava ID: ${w.strava_activity_id}, Distance: ${w.distance_miles?.toFixed(2)}mi`);
    });
  }
}

main().catch(console.error);
