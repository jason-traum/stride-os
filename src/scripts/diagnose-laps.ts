/**
 * Diagnostic script for lap data
 * Run with: npx tsx src/scripts/diagnose-laps.ts
 *
 * This script analyzes the state of workout segments (laps) in the database
 * to help diagnose why laps might be "missing".
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Manually load .env.local since we don't have dotenv
function loadEnv() {
  const envPaths = [
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '.env'),
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex !== -1) {
            const key = trimmed.substring(0, eqIndex);
            let value = trimmed.substring(eqIndex + 1);
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            process.env[key] = value;
          }
        }
      }
      console.log(`Loaded environment from: ${envPath}`);
      break;
    }
  }
}

loadEnv();

async function main() {
  // Dynamically import based on database type
  const hasPostgres = !!process.env.DATABASE_URL;

  console.log('='.repeat(60));
  console.log('STRIDE OS - LAP DATA DIAGNOSTIC REPORT');
  console.log('='.repeat(60));
  console.log(`Database: ${hasPostgres ? 'Postgres (Neon)' : 'SQLite'}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('');

  if (hasPostgres) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);

    // 1. Total workouts count
    const totalWorkouts = await sql`SELECT COUNT(*) as count FROM workouts`;
    console.log(`Total workouts: ${totalWorkouts[0].count}`);

    // 2. Strava workouts count
    const stravaWorkouts = await sql`SELECT COUNT(*) as count FROM workouts WHERE source = 'strava'`;
    console.log(`Strava workouts: ${stravaWorkouts[0].count}`);

    // 3. Workouts with segments (laps)
    const workoutsWithSegments = await sql`
      SELECT COUNT(DISTINCT workout_id) as count FROM workout_segments
    `;
    console.log(`Workouts with segments: ${workoutsWithSegments[0].count}`);

    // 4. Total segments count
    const totalSegments = await sql`SELECT COUNT(*) as count FROM workout_segments`;
    console.log(`Total segments: ${totalSegments[0].count}`);

    console.log('');
    console.log('-'.repeat(60));
    console.log('ANALYSIS');
    console.log('-'.repeat(60));

    // 5. Strava workouts WITHOUT segments
    const stravaWithoutSegments = await sql`
      SELECT w.id, w.date, w.distance_miles, w.strava_activity_id, w.workout_type
      FROM workouts w
      LEFT JOIN workout_segments ws ON w.id = ws.workout_id
      WHERE w.source = 'strava'
        AND w.strava_activity_id IS NOT NULL
        AND ws.id IS NULL
      ORDER BY w.date DESC
      LIMIT 20
    `;

    console.log('');
    console.log(`Strava workouts WITHOUT segments (top 20 recent):`);
    if (stravaWithoutSegments.length === 0) {
      console.log('  None found - all Strava workouts have segments!');
    } else {
      console.log(`  Found ${stravaWithoutSegments.length} workouts missing segments:`);
      stravaWithoutSegments.forEach((w: any) => {
        console.log(`  - ID: ${w.id}, Date: ${w.date}, Distance: ${w.distance_miles?.toFixed(2)}mi, Type: ${w.workout_type}, Strava ID: ${w.strava_activity_id}`);
      });
    }

    // 6. Profile distribution
    console.log('');
    const profileDistribution = await sql`
      SELECT
        p.id,
        p.name,
        COUNT(w.id) as workout_count,
        COUNT(DISTINCT ws.workout_id) as workouts_with_segments
      FROM profiles p
      LEFT JOIN workouts w ON w.profile_id = p.id
      LEFT JOIN workout_segments ws ON ws.workout_id = w.id
      GROUP BY p.id, p.name
    `;
    console.log('Workouts per profile:');
    profileDistribution.forEach((p: any) => {
      console.log(`  - ${p.name || '(unnamed)'} (ID: ${p.id}): ${p.workout_count} workouts, ${p.workouts_with_segments} with segments`);
    });

    // 7. Workouts without profileId
    const orphanWorkouts = await sql`
      SELECT COUNT(*) as count FROM workouts WHERE profile_id IS NULL
    `;
    console.log('');
    console.log(`Workouts without profile_id: ${orphanWorkouts[0].count}`);

    // 8. Recent segment saves
    console.log('');
    const recentSegments = await sql`
      SELECT ws.id, ws.workout_id, ws.segment_number, ws.distance_miles, ws.created_at
      FROM workout_segments ws
      ORDER BY ws.created_at DESC
      LIMIT 5
    `;
    console.log('Most recent segment saves:');
    if (recentSegments.length === 0) {
      console.log('  No segments found in database!');
    } else {
      recentSegments.forEach((s: any) => {
        console.log(`  - Segment ${s.segment_number} for workout ${s.workout_id}: ${s.distance_miles?.toFixed(2)}mi (created: ${s.created_at})`);
      });
    }

    // 9. Check for duplicate strava_activity_ids
    console.log('');
    const duplicateStravaIds = await sql`
      SELECT strava_activity_id, COUNT(*) as count
      FROM workouts
      WHERE strava_activity_id IS NOT NULL
      GROUP BY strava_activity_id
      HAVING COUNT(*) > 1
      LIMIT 10
    `;
    if (duplicateStravaIds.length > 0) {
      console.log('WARNING: Duplicate Strava activity IDs found:');
      duplicateStravaIds.forEach((d: any) => {
        console.log(`  - Strava ID ${d.strava_activity_id}: ${d.count} workouts`);
      });
    } else {
      console.log('No duplicate Strava activity IDs found.');
    }

    // 10. User settings - check Strava connection
    console.log('');
    const stravaSettings = await sql`
      SELECT
        us.id,
        us.profile_id,
        us.strava_athlete_id,
        us.strava_last_sync_at,
        us.strava_auto_sync,
        us.strava_access_token IS NOT NULL as has_access_token,
        us.strava_refresh_token IS NOT NULL as has_refresh_token
      FROM user_settings us
      WHERE us.strava_athlete_id IS NOT NULL
    `;
    console.log('Strava connections:');
    if (stravaSettings.length === 0) {
      console.log('  No Strava connections found!');
    } else {
      stravaSettings.forEach((s: any) => {
        console.log(`  - Profile ${s.profile_id}: Athlete ID ${s.strava_athlete_id}, Last sync: ${s.strava_last_sync_at || 'never'}`);
        console.log(`    Tokens: access=${s.has_access_token}, refresh=${s.has_refresh_token}, auto_sync=${s.strava_auto_sync}`);
      });
    }

    // 11. Check all workouts count by source
    console.log('');
    const bySource = await sql`
      SELECT source, COUNT(*) as count
      FROM workouts
      GROUP BY source
      ORDER BY count DESC
    `;
    console.log('Workouts by source:');
    bySource.forEach((s: any) => {
      console.log(`  - ${s.source}: ${s.count}`);
    });

  } else {
    // SQLite version
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'data', 'stride.db'));

    const totalWorkouts = db.prepare('SELECT COUNT(*) as count FROM workouts').get() as any;
    console.log(`Total workouts: ${totalWorkouts.count}`);

    const stravaWorkouts = db.prepare("SELECT COUNT(*) as count FROM workouts WHERE source = 'strava'").get() as any;
    console.log(`Strava workouts: ${stravaWorkouts.count}`);

    const workoutsWithSegments = db.prepare('SELECT COUNT(DISTINCT workout_id) as count FROM workout_segments').get() as any;
    console.log(`Workouts with segments: ${workoutsWithSegments.count}`);

    const totalSegments = db.prepare('SELECT COUNT(*) as count FROM workout_segments').get() as any;
    console.log(`Total segments: ${totalSegments.count}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(60));
  console.log('');
  console.log('If Strava workouts are missing segments:');
  console.log('1. Run lap resync: Call syncStravaLaps() action');
  console.log('2. Check Strava connection has activity:read_all scope');
  console.log('3. Verify rate limiting is not blocking lap fetches');
  console.log('4. Check if laps were deleted by saveWorkoutLaps() with empty array');
  console.log('');
}

main().catch(console.error);
