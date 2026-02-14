/**
 * Strava Integration
 *
 * Handles OAuth authentication and activity syncing from Strava API
 */

import { logApiUsage } from './api-usage';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth';

// Import enhanced API client
import { stravaFetch } from './strava-api';

// The stravaFetch function is now imported from strava-api.ts

// Strava activity types we care about
const RUNNING_ACTIVITY_TYPES = ['Run', 'VirtualRun', 'TrailRun'];

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  athleteId: number;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string; // ISO date
  start_date_local: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number; // meters/second
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  description?: string;
  workout_type?: number; // Strava workout type
  external_id?: string;
  map?: {
    id?: string;
    polyline?: string;
    summary_polyline?: string;
  };
  start_latlng?: [number, number];
  end_latlng?: [number, number];
}

export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city?: string;
  state?: string;
  country?: string;
  profile?: string; // Profile image URL
}

/**
 * Get the Strava OAuth authorization URL
 */
export function getStravaAuthUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;

  if (!clientId) {
    throw new Error('NEXT_PUBLIC_STRAVA_CLIENT_ID environment variable not set');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read,activity:read_all',
    approval_prompt: 'auto',
  });

  if (state) {
    params.set('state', state);
  }

  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  console.log('[exchangeStravaCode] Environment check:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientSecretLength: clientSecret?.length,
    codeLength: code?.length,
  });

  if (!clientId || !clientSecret) {
    throw new Error('Strava client credentials not configured');
  }

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  };

  console.log('[exchangeStravaCode] Making request to Strava...');

  const response = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();

  console.log('[exchangeStravaCode] Strava response:', {
    status: response.status,
    statusText: response.statusText,
    responsePreview: responseText.substring(0, 200),
  });

  if (!response.ok) {
    console.error('[exchangeStravaCode] Token exchange failed:', responseText);
    throw new Error(`Failed to exchange Strava code: ${responseText}`);
  }

  const data = JSON.parse(responseText);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteId: data.athlete.id,
  };
}

/**
 * Refresh expired access token
 */
export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens & { athleteId?: number }> {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Strava client credentials not configured');
  }

  const response = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Strava token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteId: data.athlete?.id,
  };
}

/**
 * Deauthorize the application (revoke tokens)
 */
export async function deauthorizeStrava(accessToken: string): Promise<void> {
  const response = await fetch(`${STRAVA_OAUTH_BASE}/deauthorize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to deauthorize Strava: ${error}`);
  }
}

/**
 * Get authenticated athlete profile
 */
export async function getStravaAthlete(accessToken: string): Promise<StravaAthlete> {
  const response = await stravaFetch('/athlete', accessToken);

  if (!response.ok) {
    throw new Error('Failed to fetch Strava athlete');
  }

  return response.json();
}

/**
 * Fetch activities from Strava
 */
export async function getStravaActivities(
  accessToken: string,
  options: {
    after?: number; // Unix timestamp
    before?: number;
    page?: number;
    perPage?: number;
    maxPages?: number; // Limit pagination to avoid rate limits
  } = {}
): Promise<StravaActivity[]> {
  const perPage = options.perPage || 100;
  const maxPages = options.maxPages || 10; // Default: max 1000 activities
  const allActivities: StravaActivity[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams();

    if (options.after) {
      params.set('after', options.after.toString());
    }
    if (options.before) {
      params.set('before', options.before.toString());
    }
    params.set('page', page.toString());
    params.set('per_page', perPage.toString());

    console.log(`[Strava API] Fetching page ${page}...`);

    const response = await stravaFetch(
      `/athlete/activities?${params.toString()}`,
      accessToken
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[Strava API] Error on page ${page}:`, response.status, errorText);

      // If rate limited, return what we have so far
      if (response.status === 429) {
        console.log(`[Strava API] Rate limited. Returning ${allActivities.length} activities fetched so far.`);
        break;
      }
      throw new Error(`Failed to fetch Strava activities: ${response.status}`);
    }

    const activities: StravaActivity[] = await response.json();
    console.log(`[Strava API] Page ${page}: ${activities.length} activities`);

    if (activities.length === 0) {
      break; // No more activities
    }

    allActivities.push(...activities);

    if (activities.length < perPage) {
      break; // Last page
    }
  }

  console.log(`[Strava API] Total fetched: ${allActivities.length} activities`);

  // Filter to only running activities
  const runningActivities = allActivities.filter((a) =>
    RUNNING_ACTIVITY_TYPES.includes(a.type) || RUNNING_ACTIVITY_TYPES.includes(a.sport_type)
  );

  console.log(`[Strava API] Running activities: ${runningActivities.length}`);
  return runningActivities;
}

/**
 * Get a single activity with detailed data
 */
export async function getStravaActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  const response = await stravaFetch(`/activities/${activityId}`, accessToken);

  if (!response.ok) {
    throw new Error(`Failed to fetch Strava activity ${activityId}`);
  }

  return response.json();
}

/**
 * Strava lap data from API
 */
export interface StravaLap {
  id: number;
  activity: { id: number };
  athlete: { id: number };
  lap_index: number;
  name: string;
  elapsed_time: number; // seconds
  moving_time: number; // seconds
  start_date: string;
  start_date_local: string;
  distance: number; // meters
  average_speed: number; // m/s
  max_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain: number; // meters
  pace_zone?: number;
}

/**
 * Fetch laps for a specific activity
 */
export async function getStravaActivityLaps(
  accessToken: string,
  activityId: number
): Promise<StravaLap[]> {
  const response = await stravaFetch(`/activities/${activityId}/laps`, accessToken);

  if (!response.ok) {
    // Don't throw - laps might not be available for some activities
    console.warn(`[Strava API] Could not fetch laps for activity ${activityId}: ${response.status}`);
    return [];
  }

  return response.json();
}

/**
 * Convert Strava lap to our format (basic conversion without classification)
 */
export function convertStravaLap(lap: StravaLap): {
  lapNumber: number;
  distanceMiles: number;
  durationSeconds: number;
  avgPaceSeconds: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainFeet: number | null;
  lapType: string;
} {
  const distanceMiles = lap.distance / 1609.34;
  const durationSeconds = lap.moving_time;
  // Calculate pace: seconds per mile
  const avgPaceSeconds = distanceMiles > 0 ? Math.round(durationSeconds / distanceMiles) : 0;

  return {
    lapNumber: lap.lap_index,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationSeconds,
    avgPaceSeconds,
    avgHeartRate: lap.average_heartrate ? Math.round(lap.average_heartrate) : null,
    maxHeartRate: lap.max_heartrate ? Math.round(lap.max_heartrate) : null,
    elevationGainFeet: lap.total_elevation_gain
      ? Math.round(lap.total_elevation_gain * 3.28084)
      : null,
    lapType: 'steady', // Will be refined by classifyLaps()
  };
}

/**
 * Classify laps as work/recovery/warmup/cooldown based on pace patterns
 * Uses adaptive thresholding and position analysis
 */
export function classifyLaps(laps: ReturnType<typeof convertStravaLap>[]): ReturnType<typeof convertStravaLap>[] {
  if (laps.length < 2) return laps;

  // Filter out invalid paces for analysis
  const validPaces = laps
    .map(l => l.avgPaceSeconds)
    .filter(p => p > 180 && p < 900); // 3:00 to 15:00 pace

  if (validPaces.length < 2) return laps;

  // Calculate statistics using Winsorized mean (exclude extreme 10%)
  const sortedPaces = [...validPaces].sort((a, b) => a - b);
  const trimCount = Math.max(1, Math.floor(sortedPaces.length * 0.1));
  const winsorizedPaces = sortedPaces.slice(trimCount, -trimCount || undefined);

  const avgPace = winsorizedPaces.reduce((a, b) => a + b, 0) / winsorizedPaces.length;
  const stdDev = Math.sqrt(
    winsorizedPaces.reduce((sum, p) => sum + Math.pow(p - avgPace, 2), 0) / winsorizedPaces.length
  );

  // Determine if this looks like an interval workout (high pace variation)
  const paceRange = Math.max(...validPaces) - Math.min(...validPaces);
  const isIntervalWorkout = paceRange > 45 && stdDev > 15; // More than 45s range and 15s std dev

  // Classification thresholds
  const fastThreshold = avgPace - (isIntervalWorkout ? stdDev * 0.5 : stdDev * 0.3);
  const slowThreshold = avgPace + (isIntervalWorkout ? stdDev * 0.7 : stdDev * 0.5);

  return laps.map((lap, index) => {
    const pace = lap.avgPaceSeconds;
    const isFirst = index === 0;
    const isLast = index === laps.length - 1;
    const isSecond = index === 1;
    const isSecondLast = index === laps.length - 2;

    // Skip invalid paces
    if (pace <= 180 || pace >= 900) {
      return { ...lap, lapType: 'recovery' }; // Likely a rest interval
    }

    // Very slow paces (> 60s slower than average) are recovery
    if (pace > avgPace + 60) {
      return { ...lap, lapType: 'recovery' };
    }

    // First lap that's slower than average is likely warmup
    if ((isFirst || isSecond) && pace > avgPace + 10) {
      return { ...lap, lapType: 'warmup' };
    }

    // Last lap that's slower than average is likely cooldown
    if ((isLast || isSecondLast) && pace > avgPace + 10) {
      return { ...lap, lapType: 'cooldown' };
    }

    // For interval workouts, classify based on pace relative to thresholds
    if (isIntervalWorkout) {
      if (pace <= fastThreshold) {
        return { ...lap, lapType: 'work' };
      } else if (pace >= slowThreshold) {
        return { ...lap, lapType: 'recovery' };
      }
    }

    // Default: faster than average = work, slower = steady
    if (pace < avgPace - 10) {
      return { ...lap, lapType: 'work' };
    }

    return { ...lap, lapType: 'steady' };
  });
}

/**
 * Get fastest work segments, excluding recovery/rest (Winsorized)
 * Returns paces that represent actual effort, not jog recoveries
 */
export function getFastestWorkPace(laps: ReturnType<typeof convertStravaLap>[]): number | null {
  // First classify laps if not already done
  const classifiedLaps = laps[0]?.lapType === 'steady' && laps.length > 2
    ? classifyLaps(laps)
    : laps;

  // Get work segments only
  const workPaces = classifiedLaps
    .filter(l => l.lapType === 'work' && l.avgPaceSeconds > 180 && l.avgPaceSeconds < 600)
    .map(l => l.avgPaceSeconds);

  if (workPaces.length === 0) {
    // Fall back to fastest non-recovery segment
    const nonRecoveryPaces = classifiedLaps
      .filter(l => l.lapType !== 'recovery' && l.lapType !== 'warmup' && l.lapType !== 'cooldown')
      .filter(l => l.avgPaceSeconds > 180 && l.avgPaceSeconds < 600)
      .map(l => l.avgPaceSeconds);

    return nonRecoveryPaces.length > 0 ? Math.min(...nonRecoveryPaces) : null;
  }

  return Math.min(...workPaces);
}

/**
 * Map Strava workout type to our workout type
 */
export function mapStravaWorkoutType(stravaWorkoutType?: number): string {
  // Strava workout types:
  // 0: default/none
  // 1: race
  // 2: long run
  // 3: workout (intervals, tempo, etc.)
  // 11: race (new)
  // 12: long run (new)
  switch (stravaWorkoutType) {
    case 1:
    case 11:
      return 'race';
    case 2:
    case 12:
      return 'long';
    case 3:
      return 'tempo'; // Could be interval, we'll refine based on pace analysis
    default:
      return 'easy'; // Default to easy for unmarked runs
  }
}

/**
 * Convert Strava activity to our workout format
 */
export function convertStravaActivity(activity: StravaActivity): {
  date: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPaceSeconds: number;
  workoutType: string;
  notes: string;
  source: string;
  stravaActivityId: number;
  avgHeartRate?: number;
  elevationGainFeet?: number;
  polyline?: string;
} {
  const distanceMiles = activity.distance / 1609.34;
  const durationMinutes = activity.moving_time / 60;
  const avgPaceSeconds = distanceMiles > 0
    ? Math.round((activity.moving_time / distanceMiles))
    : 0;

  // Extract date from local time (YYYY-MM-DD)
  const date = activity.start_date_local.split('T')[0];

  return {
    date,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationMinutes: Math.round(durationMinutes),
    avgPaceSeconds,
    workoutType: mapStravaWorkoutType(activity.workout_type),
    stravaName: activity.name || '',
    notes: activity.name || '',
    source: 'strava',
    stravaActivityId: activity.id,
    avgHeartRate: activity.average_heartrate ? Math.round(activity.average_heartrate) : undefined,
    elevationGainFeet: activity.total_elevation_gain
      ? Math.round(activity.total_elevation_gain * 3.28084)
      : undefined,
    polyline: activity.map?.summary_polyline || activity.map?.polyline || undefined,
  };
}

/**
 * Check if token needs refresh (expired or expiring soon)
 */
export function isTokenExpired(expiresAt: number): boolean {
  // Consider expired if less than 5 minutes remaining
  const bufferSeconds = 300;
  return Date.now() / 1000 > expiresAt - bufferSeconds;
}

/**
 * Activity streams from Strava (HR, time, distance, etc.)
 */
export interface StravaStream {
  type: string;
  data: number[];
  series_type: string;
  original_size: number;
  resolution: string;
}

/**
 * Fetch activity streams (HR, time, etc.)
 */
export async function getStravaActivityStreams(
  accessToken: string,
  activityId: number,
  streamTypes: string[] = ['heartrate', 'time']
): Promise<StravaStream[]> {
  const keys = streamTypes.join(',');
  const response = await stravaFetch(
    `/activities/${activityId}/streams?keys=${keys}&key_by_type=true`,
    accessToken
  );

  if (!response.ok) {
    console.warn(`[Strava API] Could not fetch streams for activity ${activityId}: ${response.status}`);
    return [];
  }

  const data = await response.json();

  // Convert key_by_type response to array
  const streams: StravaStream[] = [];
  for (const key of streamTypes) {
    if (data[key]) {
      streams.push({ ...data[key], type: key });
    }
  }

  return streams;
}

/**
 * HR Zone definitions (percentage of max HR)
 */
// HR Zone definitions - colors match workout-colors.ts trainingZoneBgColors
export const HR_ZONES = [
  { zone: 1, name: 'Recovery', min: 0, max: 0.6, color: 'bg-teal-400' },     // Easy/Recovery
  { zone: 2, name: 'Aerobic', min: 0.6, max: 0.7, color: 'bg-amber-400' },   // Moderate/Aerobic
  { zone: 3, name: 'Tempo', min: 0.7, max: 0.8, color: 'bg-orange-500' },    // Tempo/Threshold
  { zone: 4, name: 'Threshold', min: 0.8, max: 0.9, color: 'bg-rose-500' },  // Hard/VO2max
  { zone: 5, name: 'VO2max', min: 0.9, max: 1.0, color: 'bg-purple-600' },   // Max effort
];

/**
 * Calculate time in each HR zone from stream data
 */
export function calculateHRZones(
  hrData: number[],
  timeData: number[],
  maxHr: number
): { zone: number; name: string; seconds: number; percentage: number; color: string }[] {
  if (!hrData || !timeData || hrData.length !== timeData.length || hrData.length < 2) {
    return [];
  }

  // Initialize zone times
  const zoneTimes: number[] = [0, 0, 0, 0, 0];

  // Calculate time in each zone
  for (let i = 1; i < hrData.length; i++) {
    const hr = hrData[i];
    const timeDelta = timeData[i] - timeData[i - 1];
    const hrPercent = hr / maxHr;

    // Determine zone (1-5)
    let zoneIndex = 0;
    if (hrPercent >= 0.9) zoneIndex = 4;
    else if (hrPercent >= 0.8) zoneIndex = 3;
    else if (hrPercent >= 0.7) zoneIndex = 2;
    else if (hrPercent >= 0.6) zoneIndex = 1;
    else zoneIndex = 0;

    zoneTimes[zoneIndex] += timeDelta;
  }

  const totalTime = zoneTimes.reduce((a, b) => a + b, 0);

  return HR_ZONES.map((zone, i) => ({
    zone: zone.zone,
    name: zone.name,
    seconds: Math.round(zoneTimes[i]),
    percentage: totalTime > 0 ? Math.round((zoneTimes[i] / totalTime) * 100) : 0,
    color: zone.color,
  }));
}
