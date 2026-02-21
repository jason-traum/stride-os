/**
 * Pull all Strava activity detail JSON and cache locally.
 * Then backfill start_time_local (and any other fields) from the cache.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/pull-all-strava-details.ts
 *
 * Respects Strava rate limits: 90 requests per 15 minutes.
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);

const CACHE_DIR = path.join(process.cwd(), 'data', 'strava-cache');
const RATE_LIMIT = 90; // requests per window
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function getAccessToken(): Promise<string> {
  const settings = await sql`SELECT strava_access_token, strava_refresh_token, strava_token_expires_at FROM user_settings WHERE profile_id = 1`;
  if (!settings[0]?.strava_access_token) throw new Error('No Strava token found');

  const token = settings[0].strava_access_token;
  const expiresAt = settings[0].strava_token_expires_at;

  // Check if expired
  if (expiresAt && new Date(expiresAt * 1000) < new Date()) {
    console.log('Token expired, refreshing...');
    const refreshToken = settings[0].strava_refresh_token;
    const resp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || '199902',
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = await resp.json();
    if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));

    // Update DB
    await sql`UPDATE user_settings SET
      strava_access_token = ${data.access_token},
      strava_refresh_token = ${data.refresh_token},
      strava_token_expires_at = ${data.expires_at},
      updated_at = ${new Date().toISOString()}
      WHERE profile_id = 1`;

    return data.access_token;
  }

  return token;
}

async function fetchActivity(accessToken: string, activityId: string): Promise<object | null> {
  const cachePath = path.join(CACHE_DIR, `${activityId}.json`);

  // Check cache first
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }

  const resp = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (resp.status === 429) {
    console.log('Rate limited! Waiting 15 minutes...');
    await new Promise(r => setTimeout(r, RATE_WINDOW_MS));
    return fetchActivity(accessToken, activityId); // retry
  }

  if (!resp.ok) {
    console.error(`Failed to fetch activity ${activityId}: ${resp.status}`);
    return null;
  }

  const data = await resp.json();
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  // Ensure cache dir exists
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const accessToken = await getAccessToken();

  // Get all workouts with Strava IDs
  const workouts = await sql`
    SELECT id, strava_activity_id, start_time_local
    FROM workouts
    WHERE strava_activity_id IS NOT NULL AND profile_id = 1
    ORDER BY id
  `;

  console.log(`Total workouts with Strava IDs: ${workouts.length}`);

  // Check how many are already cached
  const alreadyCached = workouts.filter((w: Record<string, string>) =>
    fs.existsSync(path.join(CACHE_DIR, `${w.strava_activity_id}.json`))
  );
  console.log(`Already cached: ${alreadyCached.length}`);

  const needsFetch = workouts.filter((w: Record<string, string>) =>
    !fs.existsSync(path.join(CACHE_DIR, `${w.strava_activity_id}.json`))
  );
  console.log(`Need to fetch: ${needsFetch.length}`);

  // Fetch in batches respecting rate limits
  let fetched = 0;
  let batchStart = Date.now();

  for (const workout of needsFetch) {
    if (fetched > 0 && fetched % RATE_LIMIT === 0) {
      const elapsed = Date.now() - batchStart;
      const waitTime = Math.max(0, RATE_WINDOW_MS - elapsed + 5000); // 5s buffer
      if (waitTime > 0) {
        console.log(`Rate limit pause: waiting ${Math.round(waitTime / 1000)}s...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
      batchStart = Date.now();
    }

    const data = await fetchActivity(accessToken, workout.strava_activity_id);
    fetched++;

    if (fetched % 10 === 0) {
      console.log(`Fetched ${fetched}/${needsFetch.length}`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nAll activities fetched! Total cached: ${workouts.length}`);

  // Now backfill start_time_local from cache
  console.log('\nBackfilling start_time_local from cache...');
  let updated = 0;

  for (const workout of workouts) {
    if (workout.start_time_local) continue; // already has it

    const cachePath = path.join(CACHE_DIR, `${workout.strava_activity_id}.json`);
    if (!fs.existsSync(cachePath)) continue;

    const activity = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    const startTimeLocal = activity.start_date_local?.split('T')[1]?.substring(0, 5) || null;

    if (startTimeLocal) {
      await sql`UPDATE workouts SET start_time_local = ${startTimeLocal}, updated_at = ${new Date().toISOString()} WHERE id = ${workout.id}`;
      updated++;
    }
  }

  console.log(`Backfilled start_time_local for ${updated} workouts`);

  // Report what's in the cache
  const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
  console.log(`\nCache contains ${cacheFiles.length} activity detail files`);
  console.log(`Location: ${CACHE_DIR}`);
}

main().catch(console.error);
