/**
 * Strava Integration
 *
 * Handles OAuth authentication and activity syncing from Strava API
 */

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth';

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
  const clientId = process.env.STRAVA_CLIENT_ID;

  if (!clientId) {
    throw new Error('STRAVA_CLIENT_ID environment variable not set');
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
  const clientId = process.env.STRAVA_CLIENT_ID;
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
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange Strava code: ${error}`);
  }

  const data = await response.json();

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
  const clientId = process.env.STRAVA_CLIENT_ID;
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
  const response = await fetch(`${STRAVA_API_BASE}/athlete`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

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
  } = {}
): Promise<StravaActivity[]> {
  const params = new URLSearchParams();

  if (options.after) {
    params.set('after', options.after.toString());
  }
  if (options.before) {
    params.set('before', options.before.toString());
  }
  if (options.page) {
    params.set('page', options.page.toString());
  }
  params.set('per_page', (options.perPage || 100).toString());

  const response = await fetch(
    `${STRAVA_API_BASE}/athlete/activities?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Strava activities');
  }

  const activities: StravaActivity[] = await response.json();

  // Filter to only running activities
  return activities.filter((a) =>
    RUNNING_ACTIVITY_TYPES.includes(a.type) || RUNNING_ACTIVITY_TYPES.includes(a.sport_type)
  );
}

/**
 * Get a single activity with detailed data
 */
export async function getStravaActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  const response = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Strava activity ${activityId}`);
  }

  return response.json();
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
    durationMinutes: Math.round(durationMinutes * 10) / 10,
    avgPaceSeconds,
    workoutType: mapStravaWorkoutType(activity.workout_type),
    notes: activity.name || '',
    source: 'strava',
    stravaActivityId: activity.id,
    avgHeartRate: activity.average_heartrate,
    elevationGainFeet: activity.total_elevation_gain
      ? Math.round(activity.total_elevation_gain * 3.28084)
      : undefined,
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
