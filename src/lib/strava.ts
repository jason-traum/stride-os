/**
 * Strava Integration
 *
 * Handles OAuth authentication and activity syncing from Strava API
 */


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth';

// Import enhanced API client
import { stravaFetch } from './strava-api';
import { db, apiUsageLogs } from './db';

// The stravaFetch function is now imported from strava-api.ts

// Strava activity types we care about
const RUNNING_ACTIVITY_TYPES = ['Run', 'VirtualRun', 'TrailRun'];

function getStravaClientId(): string | undefined {
  const raw = process.env.STRAVA_CLIENT_ID || process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  return raw?.trim();
}

function getStravaClientSecret(): string | undefined {
  return process.env.STRAVA_CLIENT_SECRET?.trim();
}

function describeCredentialShape(clientId?: string, clientSecret?: string): string {
  const idPart = clientId ? `id=${clientId}` : 'id=missing';
  const secretPart = clientSecret ? `secret_len=${clientSecret.length}` : 'secret=missing';
  return `${idPart} ${secretPart}`;
}

async function logStravaAuthEvent(params: {
  endpoint: 'oauth.token.exchange' | 'oauth.token.refresh';
  statusCode: number;
  responseTimeMs: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(apiUsageLogs).values({
      service: 'strava',
      endpoint: params.endpoint,
      method: 'POST',
      statusCode: params.statusCode,
      responseTimeMs: params.responseTimeMs,
      errorMessage: params.errorMessage || null,
      metadata: JSON.stringify(params.metadata || {}),
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Never block auth flow due to logging failures.
  }
}

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
  // Comprehensive fields
  kudos_count?: number;
  comment_count?: number;
  achievement_count?: number;
  photo_count?: number;
  athlete_count?: number;
  suffer_score?: number;
  perceived_exertion?: number;
  gear_id?: string;
  device_name?: string;
  trainer?: boolean;
  commute?: boolean;
  // photos field from detail endpoint
  photos?: { count?: number };
  // best efforts from detail endpoint (PRs at standard distances)
  best_efforts?: StravaBestEffort[];
}

export interface StravaBestEffort {
  id: number;
  name: string;           // e.g., "400m", "1/2 mile", "1k", "1 mile", "5k", etc.
  elapsed_time: number;   // seconds
  moving_time: number;    // seconds
  start_date: string;
  start_date_local: string;
  distance: number;       // meters
  pr_rank: number | null; // 1 = PR, 2 = 2nd best, 3 = 3rd best, null = not top 3
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
  const clientId = getStravaClientId();

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
export async function exchangeStravaCode(code: string, redirectUri?: string): Promise<StravaTokens> {
  const clientId = getStravaClientId();
  const clientSecret = getStravaClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error('Strava client credentials not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  });
  if (redirectUri) {
    body.set('redirect_uri', redirectUri);
  }

  console.info('[exchangeStravaCode] Using credentials:', describeCredentialShape(clientId, clientSecret));

  const startedAt = Date.now();
  const response = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const responseText = await response.text();
  const responseTimeMs = Date.now() - startedAt;

  if (!response.ok) {
    console.error('[exchangeStravaCode] Token exchange failed:', responseText);
    console.error('[exchangeStravaCode] Credential shape:', describeCredentialShape(clientId, clientSecret));
    await logStravaAuthEvent({
      endpoint: 'oauth.token.exchange',
      statusCode: response.status,
      responseTimeMs,
      errorMessage: responseText,
      metadata: { redirectUriProvided: !!redirectUri, credentialShape: describeCredentialShape(clientId, clientSecret) },
    });
    throw new Error(`Failed to exchange Strava code: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  await logStravaAuthEvent({
    endpoint: 'oauth.token.exchange',
    statusCode: response.status,
    responseTimeMs,
    metadata: { redirectUriProvided: !!redirectUri },
  });

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
  const clientId = getStravaClientId();
  const clientSecret = getStravaClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error('Strava client credentials not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  console.info('[refreshStravaToken] Using credentials:', describeCredentialShape(clientId, clientSecret));

  const startedAt = Date.now();
  const response = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const responseTimeMs = Date.now() - startedAt;
  if (!response.ok) {
    const error = await response.text();
    console.error('[refreshStravaToken] Credential shape:', describeCredentialShape(clientId, clientSecret));
    await logStravaAuthEvent({
      endpoint: 'oauth.token.refresh',
      statusCode: response.status,
      responseTimeMs,
      errorMessage: error,
      metadata: { credentialShape: describeCredentialShape(clientId, clientSecret) },
    });
    throw new Error(`Failed to refresh Strava token: ${error}`);
  }

  const data = await response.json();
  await logStravaAuthEvent({
    endpoint: 'oauth.token.refresh',
    statusCode: response.status,
    responseTimeMs,
  });

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


    const response = await stravaFetch(
      `/athlete/activities?${params.toString()}`,
      accessToken
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[Strava API] Error on page ${page}:`, response.status, errorText);

      // If rate limited, return what we have so far
      if (response.status === 429) {
        break;
      }
      throw new Error(`Failed to fetch Strava activities: ${response.status}`);
    }

    const activities: StravaActivity[] = await response.json();

    if (activities.length === 0) {
      break; // No more activities
    }

    allActivities.push(...activities);

    if (activities.length < perPage) {
      break; // Last page
    }
  }


  // Filter to only running activities
  const runningActivities = allActivities.filter((a) =>
    RUNNING_ACTIVITY_TYPES.includes(a.type) || RUNNING_ACTIVITY_TYPES.includes(a.sport_type)
  );

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
 * Map Strava workout type to our workout type.
 * Checks activity name for explicit hints first, then falls back to
 * Strava's numeric workout_type field.
 */
export function mapStravaWorkoutType(stravaWorkoutType?: number, activityName?: string): string {
  // Check activity name for explicit hints first
  const name = (activityName || '').toLowerCase();
  if (name.includes('race') || name.includes('5k') || name.includes('10k')
    || name.includes('half marathon') || name.includes('marathon') || name.includes('15k')
    || name.includes('10 mile') || name.includes('10-mile') || name.includes('50k')
    || name.includes('half-marathon')) return 'race';
  if (name.includes('tempo')) return 'tempo';
  if (name.includes('interval') || name.includes('track') || name.includes('speed')) return 'interval';
  if (name.includes('long run') || name.includes('long ')) return 'long';
  if (name.includes('recovery')) return 'recovery';
  if (name.includes('progression') || name.includes('prog')) return 'tempo';

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
  stravaName: string;
  avgHeartRate?: number;
  elevationGainFeet?: number;
  polyline?: string;
  // Comprehensive Strava fields
  stravaDescription?: string;
  stravaKudosCount?: number;
  stravaCommentCount?: number;
  stravaAchievementCount?: number;
  stravaPhotoCount?: number;
  stravaAthleteCount?: number;
  stravaMaxSpeed?: number;
  stravaAverageCadence?: number;
  stravaSufferScore?: number;
  stravaPerceivedExertion?: number;
  stravaGearId?: string;
  stravaDeviceName?: string;
  startLatitude?: number;
  startLongitude?: number;
  endLatitude?: number;
  endLongitude?: number;
  stravaIsTrainer?: boolean;
  stravaIsCommute?: boolean;
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
    workoutType: mapStravaWorkoutType(activity.workout_type, activity.name),
    stravaName: activity.name || '',
    notes: activity.name || '',
    source: 'strava',
    stravaActivityId: activity.id,
    avgHeartRate: activity.average_heartrate ? Math.round(activity.average_heartrate) : undefined,
    elevationGainFeet: activity.total_elevation_gain
      ? Math.round(activity.total_elevation_gain * 3.28084)
      : undefined,
    polyline: activity.map?.summary_polyline || activity.map?.polyline || undefined,
    // Comprehensive Strava fields
    stravaDescription: activity.description || undefined,
    stravaKudosCount: activity.kudos_count ?? undefined,
    stravaCommentCount: activity.comment_count ?? undefined,
    stravaAchievementCount: activity.achievement_count ?? undefined,
    stravaPhotoCount: activity.photos?.count ?? activity.photo_count ?? undefined,
    stravaAthleteCount: activity.athlete_count ?? undefined,
    stravaMaxSpeed: activity.max_speed ? +(activity.max_speed * 2.23694).toFixed(2) : undefined, // m/s → mph
    stravaAverageCadence: activity.average_cadence ?? undefined,
    stravaSufferScore: activity.suffer_score ?? undefined,
    stravaPerceivedExertion: activity.perceived_exertion ?? undefined,
    stravaGearId: activity.gear_id || undefined,
    stravaDeviceName: activity.device_name || undefined,
    startLatitude: activity.start_latlng?.[0] ?? undefined,
    startLongitude: activity.start_latlng?.[1] ?? undefined,
    endLatitude: activity.end_latlng?.[0] ?? undefined,
    endLongitude: activity.end_latlng?.[1] ?? undefined,
    stravaIsTrainer: activity.trainer != null ? Boolean(activity.trainer) : undefined,
    stravaIsCommute: activity.commute != null ? Boolean(activity.commute) : undefined,
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
  { zone: 1, name: 'Recovery', min: 0, max: 0.6, color: '#38bdf8' },      // sky-400
  { zone: 2, name: 'Aerobic', min: 0.6, max: 0.7, color: '#0ea5e9' },     // sky-500
  { zone: 3, name: 'Tempo', min: 0.7, max: 0.8, color: '#6366f1' },       // indigo-500
  { zone: 4, name: 'Threshold', min: 0.8, max: 0.9, color: '#8b5cf6' },   // violet-500
  { zone: 5, name: 'VO2max', min: 0.9, max: 1.0, color: '#ef4444' },      // red-500
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
