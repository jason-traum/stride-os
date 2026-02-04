/**
 * Sync laps for all workouts that have strava_activity_id but no segments
 *
 * Run with: npx tsx src/scripts/sync-all-laps.ts
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

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

interface StravaLap {
  id: number;
  lap_index: number;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain: number;
}

async function refreshToken(refreshTokenValue: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshTokenValue,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
}

async function fetchLaps(accessToken: string, activityId: number): Promise<StravaLap[]> {
  const response = await fetch(`${STRAVA_API_BASE}/activities/${activityId}/laps`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    console.warn(`  Failed to fetch laps for ${activityId}: ${response.status}`);
    return [];
  }

  return response.json();
}

function metersToMiles(meters: number): number {
  return meters / 1609.34;
}

function calculatePaceSeconds(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 0;
  const miles = distanceMeters / 1609.34;
  return Math.round(timeSeconds / miles);
}

async function main() {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);

  console.log('='.repeat(60));
  console.log('BATCH LAP SYNC');
  console.log('='.repeat(60));

  // Get Strava settings
  const settings = await sql`
    SELECT id, strava_access_token, strava_refresh_token, strava_token_expires_at
    FROM user_settings
    WHERE strava_athlete_id IS NOT NULL
    LIMIT 1
  `;

  if (settings.length === 0 || !settings[0].strava_access_token) {
    console.error('No Strava connection found!');
    process.exit(1);
  }

  let accessToken = settings[0].strava_access_token;
  const settingsId = settings[0].id;

  // Check if token needs refresh
  const now = Math.floor(Date.now() / 1000);
  if (settings[0].strava_token_expires_at && settings[0].strava_token_expires_at < now) {
    console.log('Refreshing expired token...');
    const newTokens = await refreshToken(settings[0].strava_refresh_token);
    accessToken = newTokens.accessToken;

    await sql`
      UPDATE user_settings SET
        strava_access_token = ${newTokens.accessToken},
        strava_refresh_token = ${newTokens.refreshToken},
        strava_token_expires_at = ${newTokens.expiresAt},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${settingsId}
    `;
    console.log('Token refreshed.');
  }

  // Find workouts with strava_activity_id but no segments
  const workoutsToSync = await sql`
    SELECT w.id, w.strava_activity_id, w.date
    FROM workouts w
    WHERE w.strava_activity_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM workout_segments ws WHERE ws.workout_id = w.id)
    ORDER BY w.date DESC
  `;

  console.log(`\nWorkouts needing lap sync: ${workoutsToSync.length}`);

  if (workoutsToSync.length === 0) {
    console.log('Nothing to sync!');
    process.exit(0);
  }

  let synced = 0;
  let failed = 0;
  let rateLimited = false;

  for (let i = 0; i < workoutsToSync.length; i++) {
    const workout = workoutsToSync[i];

    if (rateLimited) {
      console.log(`\nRate limited. Stopping at ${synced} synced, ${workoutsToSync.length - i} remaining.`);
      console.log('Wait 15 minutes and run again.');
      break;
    }

    try {
      const laps = await fetchLaps(accessToken, Number(workout.strava_activity_id));

      if (laps.length > 0) {
        // Delete any existing segments (shouldn't be any, but just in case)
        await sql`DELETE FROM workout_segments WHERE workout_id = ${workout.id}`;

        // Insert new segments
        for (let j = 0; j < laps.length; j++) {
          const lap = laps[j];
          await sql`
            INSERT INTO workout_segments (
              workout_id, segment_number, segment_type, distance_miles,
              duration_seconds, pace_seconds_per_mile, avg_hr, max_hr,
              elevation_gain_ft, created_at
            ) VALUES (
              ${workout.id},
              ${j + 1},
              'steady',
              ${Math.round(metersToMiles(lap.distance) * 100) / 100},
              ${lap.moving_time},
              ${calculatePaceSeconds(lap.distance, lap.moving_time)},
              ${lap.average_heartrate ? Math.round(lap.average_heartrate) : null},
              ${lap.max_heartrate ? Math.round(lap.max_heartrate) : null},
              ${lap.total_elevation_gain ? Math.round(lap.total_elevation_gain * 3.28084) : null},
              ${new Date().toISOString()}
            )
          `;
        }

        synced++;
        if (synced % 20 === 0) {
          console.log(`  Synced ${synced}/${workoutsToSync.length}...`);
        }
      } else {
        failed++;
      }

      // Rate limiting - be gentle
      await new Promise(r => setTimeout(r, 150));

    } catch (err: any) {
      if (err.message === 'RATE_LIMIT') {
        rateLimited = true;
      } else {
        console.error(`  Error syncing workout ${workout.id}:`, err.message);
        failed++;
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`  Synced: ${synced}`);
  console.log(`  Failed: ${failed}`);

  // Final count
  const remaining = await sql`
    SELECT COUNT(*) as count
    FROM workouts w
    WHERE w.strava_activity_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM workout_segments ws WHERE ws.workout_id = w.id)
  `;
  console.log(`\nWorkouts still missing laps: ${remaining[0].count}`);

  console.log('\nLap sync complete!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
