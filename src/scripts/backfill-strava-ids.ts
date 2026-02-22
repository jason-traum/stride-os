/**
 * Backfill strava_activity_id for workouts that are missing it
 *
 * This script:
 * 1. Fetches all activities from Strava
 * 2. Matches them with existing workouts by date and distance
 * 3. Updates the strava_activity_id field
 *
 * Run with: npx tsx src/scripts/backfill-strava-ids.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { encryptToken, decryptToken } from '../lib/token-crypto';

// Load environment
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

interface StravaActivity {
  id: number;
  start_date_local: string;
  distance: number; // meters
  type: string;
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

async function main() {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);

  console.log('='.repeat(60));
  console.log('STRAVA ACTIVITY ID BACKFILL');
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

  let accessToken = decryptToken(settings[0].strava_access_token);
  const settingsId = settings[0].id;

  // Check if token needs refresh
  const now = Math.floor(Date.now() / 1000);
  if (settings[0].strava_token_expires_at && settings[0].strava_token_expires_at < now) {
    console.log('Refreshing expired token...');
    const newTokens = await refreshToken(decryptToken(settings[0].strava_refresh_token));
    accessToken = newTokens.accessToken;

    // Update tokens in database
    await sql`
      UPDATE user_settings SET
        strava_access_token = ${encryptToken(newTokens.accessToken)},
        strava_refresh_token = ${encryptToken(newTokens.refreshToken)},
        strava_token_expires_at = ${newTokens.expiresAt},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${settingsId}
    `;
    console.log('Token refreshed.');
  }

  // Count workouts missing strava_activity_id
  const missingCount = await sql`
    SELECT COUNT(*) as count FROM workouts
    WHERE source = 'strava' AND strava_activity_id IS NULL
  `;
  console.log(`\nWorkouts missing strava_activity_id: ${missingCount[0].count}`);

  if (missingCount[0].count === 0) {
    console.log('Nothing to backfill!');
    process.exit(0);
  }

  // Fetch all activities from Strava (last 3 years)
  console.log('\nFetching activities from Strava...');
  const threeYearsAgo = Math.floor((Date.now() - 3 * 365 * 24 * 60 * 60 * 1000) / 1000);

  const allActivities: StravaActivity[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      per_page: '100',
      page: String(page),
      after: String(threeYearsAgo),
    });

    const response = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log('Rate limited - waiting 15 minutes...');
        await new Promise(r => setTimeout(r, 15 * 60 * 1000));
        continue;
      }
      throw new Error(`Failed to fetch activities: ${response.status}`);
    }

    const activities: StravaActivity[] = await response.json();
    if (activities.length === 0) break;

    // Filter to running activities
    const running = activities.filter(a =>
      ['Run', 'VirtualRun', 'TrailRun'].includes(a.type)
    );
    allActivities.push(...running);

    console.log(`  Page ${page}: ${running.length} running activities`);

    if (activities.length < 100) break;
    page++;

    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nTotal Strava activities: ${allActivities.length}`);

  // Get all workouts missing strava_activity_id
  const workoutsToFix = await sql`
    SELECT id, date, distance_miles
    FROM workouts
    WHERE source = 'strava' AND strava_activity_id IS NULL
    ORDER BY date DESC
  `;

  console.log(`\nMatching ${workoutsToFix.length} workouts to Strava activities...`);

  let matched = 0;
  let unmatched = 0;

  for (const workout of workoutsToFix) {
    // Find matching Strava activity by date and distance
    const workoutDate = workout.date;
    const workoutMiles = parseFloat(workout.distance_miles) || 0;

    const match = allActivities.find(activity => {
      const activityDate = activity.start_date_local.split('T')[0];
      const activityMiles = activity.distance / 1609.34;
      const distanceDiff = Math.abs(activityMiles - workoutMiles);

      return activityDate === workoutDate && distanceDiff < 0.3; // Within 0.3 miles
    });

    if (match) {
      await sql`
        UPDATE workouts
        SET strava_activity_id = ${match.id},
            updated_at = ${new Date().toISOString()}
        WHERE id = ${workout.id}
      `;
      matched++;

      // Remove from allActivities to avoid double-matching
      const idx = allActivities.indexOf(match);
      if (idx > -1) allActivities.splice(idx, 1);
    } else {
      unmatched++;
      if (unmatched <= 10) {
        console.log(`  No match for: ${workoutDate}, ${workoutMiles.toFixed(2)}mi`);
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Unmatched: ${unmatched}`);

  // Verify
  const remaining = await sql`
    SELECT COUNT(*) as count FROM workouts
    WHERE source = 'strava' AND strava_activity_id IS NULL
  `;
  console.log(`\nWorkouts still missing strava_activity_id: ${remaining[0].count}`);

  console.log('\nBackfill complete!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
