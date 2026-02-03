/**
 * Script to sync Strava activities to local database
 * Run with: npx tsx scripts/sync-strava.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

// Initialize database
const dbPath = path.join(process.cwd(), 'data', 'stride.db');
const db = new Database(dbPath);

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  description?: string;
  workout_type?: number;
}

interface StravaLap {
  id: number;
  activity: { id: number };
  lap_index: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  start_index: number;
  end_index: number;
}

interface StravaStream {
  type: string;
  data: number[];
  series_type: string;
  original_size: number;
  resolution: string;
}

async function refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
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

async function getActivities(accessToken: string, after?: number, page = 1): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: '100',
    page: String(page),
  });
  if (after) {
    params.set('after', String(after));
  }

  const response = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${response.status}`);
  }

  return response.json();
}

async function getActivityLaps(accessToken: string, activityId: number): Promise<StravaLap[]> {
  const response = await fetch(`${STRAVA_API_BASE}/activities/${activityId}/laps`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.warn(`Failed to fetch laps for activity ${activityId}: ${response.status}`);
    return [];
  }

  return response.json();
}

async function getActivityStreams(accessToken: string, activityId: number): Promise<StravaStream[]> {
  const keys = ['heartrate', 'time', 'distance', 'altitude', 'cadence'];
  const response = await fetch(
    `${STRAVA_API_BASE}/activities/${activityId}/streams?keys=${keys.join(',')}&key_by_type=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    console.warn(`Failed to fetch streams for activity ${activityId}: ${response.status}`);
    return [];
  }

  const data = await response.json();
  // Convert from keyed object to array
  return Object.entries(data).map(([type, stream]: [string, any]) => ({
    type,
    data: stream.data,
    series_type: stream.series_type,
    original_size: stream.original_size,
    resolution: stream.resolution,
  }));
}

function metersToMiles(meters: number): number {
  return Math.round((meters / 1609.344) * 100) / 100;
}

function metersToFeet(meters: number): number {
  return Math.round(meters * 3.28084);
}

function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function calculatePaceSeconds(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 0;
  const miles = distanceMeters / 1609.344;
  return Math.round(timeSeconds / miles);
}

function mapStravaWorkoutType(activity: StravaActivity): string {
  // Strava workout_type: 0=default, 1=race, 2=long run, 3=workout
  if (activity.workout_type === 1) return 'race';
  if (activity.workout_type === 2) return 'long';
  if (activity.workout_type === 3) return 'tempo'; // Could also be interval

  // Infer from pace and distance
  const paceSecondsPerMile = calculatePaceSeconds(activity.distance, activity.moving_time);
  const miles = metersToMiles(activity.distance);

  if (miles >= 10) return 'long';
  if (paceSecondsPerMile > 0 && paceSecondsPerMile < 420) return 'tempo'; // < 7:00/mi
  if (miles < 4) return 'easy';

  return 'easy';
}

async function main() {
  console.log('Starting Strava sync...');

  // Load environment variables manually
  const fs = require('fs');
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1]] = match[2];
      }
    }
  }

  // Get settings from database
  const settings = db.prepare('SELECT * FROM user_settings LIMIT 1').get() as any;

  if (!settings?.strava_access_token) {
    console.error('No Strava connection found. Please connect via the app first.');
    process.exit(1);
  }

  let accessToken = settings.strava_access_token;

  // Check if token needs refresh
  const now = Math.floor(Date.now() / 1000);
  if (settings.strava_token_expires_at && settings.strava_token_expires_at < now) {
    console.log('Refreshing expired token...');
    try {
      const newTokens = await refreshToken(settings.strava_refresh_token);
      accessToken = newTokens.accessToken;

      // Update tokens in database
      db.prepare(`
        UPDATE user_settings SET
          strava_access_token = ?,
          strava_refresh_token = ?,
          strava_token_expires_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(newTokens.accessToken, newTokens.refreshToken, newTokens.expiresAt, new Date().toISOString(), settings.id);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      process.exit(1);
    }
  }

  // Fetch activities (last 2 years for comprehensive data)
  console.log('Fetching activities from Strava...');
  const twoYearsAgo = Math.floor((Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) / 1000);

  let allActivities: StravaActivity[] = [];
  let page = 1;

  while (true) {
    const activities = await getActivities(accessToken, twoYearsAgo, page);
    if (activities.length === 0) break;

    // Filter to running activities only
    const runningActivities = activities.filter(a =>
      ['Run', 'VirtualRun', 'TrailRun'].includes(a.type)
    );

    allActivities = allActivities.concat(runningActivities);
    console.log(`Fetched page ${page}: ${runningActivities.length} running activities`);

    if (activities.length < 100) break;
    page++;

    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Found ${allActivities.length} total running activities`);

  // Clear existing demo workouts to replace with real data
  console.log('Clearing demo workouts...');
  db.prepare("DELETE FROM workout_segments WHERE workout_id IN (SELECT id FROM workouts WHERE source = 'demo')").run();
  db.prepare("DELETE FROM assessments WHERE workout_id IN (SELECT id FROM workouts WHERE source = 'demo')").run();
  db.prepare("DELETE FROM workouts WHERE source = 'demo'").run();

  // Prepare insert statements
  const insertWorkout = db.prepare(`
    INSERT INTO workouts (
      date, distance_miles, duration_minutes, avg_pace_seconds, avg_hr, max_hr,
      elevation_gain_ft, workout_type, source, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'strava', ?, ?, ?)
  `);

  const insertSegment = db.prepare(`
    INSERT INTO workout_segments (
      workout_id, segment_number, distance_miles, duration_seconds, pace_seconds_per_mile,
      avg_hr, max_hr, segment_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'lap', ?)
  `);

  let imported = 0;
  let withHR = 0;

  for (const activity of allActivities) {
    try {
      // Check if already exists
      const existing = db.prepare('SELECT id FROM workouts WHERE date = ? AND ABS(distance_miles - ?) < 0.2').get(
        activity.start_date_local.split('T')[0],
        metersToMiles(activity.distance)
      );

      if (existing) {
        continue;
      }

      const date = activity.start_date_local.split('T')[0];
      const distanceMiles = metersToMiles(activity.distance);
      const durationMinutes = secondsToMinutes(activity.moving_time);
      const avgPaceSeconds = calculatePaceSeconds(activity.distance, activity.moving_time);
      const avgHr = activity.average_heartrate ? Math.round(activity.average_heartrate) : null;
      const maxHr = activity.max_heartrate ? Math.round(activity.max_heartrate) : null;
      const elevationFt = metersToFeet(activity.total_elevation_gain);
      const workoutType = mapStravaWorkoutType(activity);
      const notes = activity.name || '';
      const now = new Date().toISOString();

      const result = insertWorkout.run(
        date, distanceMiles, durationMinutes, avgPaceSeconds, avgHr, maxHr,
        elevationFt, workoutType, notes, now, now
      );

      const workoutId = result.lastInsertRowid;

      if (avgHr) withHR++;

      // Fetch and save laps
      const laps = await getActivityLaps(accessToken, activity.id);
      for (let i = 0; i < laps.length; i++) {
        const lap = laps[i];
        insertSegment.run(
          workoutId,
          i + 1,
          metersToMiles(lap.distance),
          lap.moving_time,
          calculatePaceSeconds(lap.distance, lap.moving_time),
          lap.average_heartrate ? Math.round(lap.average_heartrate) : null,
          lap.max_heartrate ? Math.round(lap.max_heartrate) : null,
          now
        );
      }

      imported++;
      if (imported % 10 === 0) {
        console.log(`Imported ${imported} activities...`);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 150));
    } catch (error) {
      console.error(`Failed to import activity ${activity.id}:`, error);
    }
  }

  // Update last sync time
  db.prepare(`
    UPDATE user_settings SET strava_last_sync_at = ?, updated_at = ? WHERE id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), settings.id);

  console.log(`\nSync complete!`);
  console.log(`Imported: ${imported} activities`);
  console.log(`With HR data: ${withHR} activities`);

  // Show summary
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(distance_miles) as totalMiles,
      COUNT(CASE WHEN avg_hr IS NOT NULL THEN 1 END) as withHR
    FROM workouts WHERE source = 'strava'
  `).get() as any;

  console.log(`\nDatabase now has:`);
  console.log(`- ${stats.total} Strava workouts`);
  console.log(`- ${Math.round(stats.totalMiles)} total miles`);
  console.log(`- ${stats.withHR} with heart rate data`);
}

main().catch(console.error);
