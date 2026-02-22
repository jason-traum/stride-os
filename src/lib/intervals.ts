/**
 * Intervals.icu Integration
 *
 * Handles API authentication and activity syncing from Intervals.icu
 * Intervals.icu uses API key authentication (not OAuth)
 */

const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';

export interface IntervalsActivity {
  id: string;
  start_date_local: string; // ISO date-time
  type: string; // "Run", "Ride", etc.
  name: string;
  moving_time: number; // seconds
  elapsed_time: number;
  distance: number; // meters
  total_elevation_gain?: number;
  average_speed?: number; // m/s
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  icu_training_load?: number; // Intervals.icu calculated load
  icu_intensity?: number;
  icu_efficiency_factor?: number;
  icu_rpe?: number; // User-entered RPE
  description?: string;
  workout_doc?: {
    description?: string;
  };
  source?: string; // "STRAVA", "GARMIN", etc.
  external_id?: string;
}

export interface IntervalsAthlete {
  id: string;
  name: string;
  email?: string;
  ctl?: number; // Current CTL (fitness)
  atl?: number; // Current ATL (fatigue)
  rampRate?: number;
  sportSettings?: Array<{
    type: string;
    types: string[];
  }>;
}

export interface IntervalsWellness {
  id: string;
  date: string; // YYYY-MM-DD
  sleepQuality?: number;
  sleepDuration?: number; // minutes
  fatigue?: number;
  soreness?: number;
  stress?: number;
  mood?: number;
  motivation?: number;
  injury?: number;
  hrv?: number;
  hrvSDNN?: number;
  restingHR?: number;
  weight?: number;
  notes?: string;
}

/**
 * Validate API key by fetching athlete profile
 */
export async function validateIntervalsApiKey(
  athleteId: string,
  apiKey: string
): Promise<{ valid: boolean; athlete?: IntervalsAthlete; error?: string }> {
  try {
    const response = await fetch(`${INTERVALS_API_BASE}/athlete/${athleteId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`,
      },
    });

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (response.status === 404) {
      return { valid: false, error: 'Athlete ID not found' };
    }

    if (!response.ok) {
      return { valid: false, error: `API error: ${response.status}` };
    }

    const athlete = await response.json();
    return { valid: true, athlete };
  } catch (error) {
    console.error('Intervals.icu validation error:', error);
    return { valid: false, error: 'Connection failed' };
  }
}

/**
 * Get athlete profile
 */
export async function getIntervalsAthlete(
  athleteId: string,
  apiKey: string
): Promise<IntervalsAthlete> {
  const response = await fetch(`${INTERVALS_API_BASE}/athlete/${athleteId}`, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch athlete: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch activities from Intervals.icu
 */
export async function getIntervalsActivities(
  athleteId: string,
  apiKey: string,
  options: {
    oldest?: string; // ISO date YYYY-MM-DD
    newest?: string;
  } = {}
): Promise<IntervalsActivity[]> {
  const params = new URLSearchParams();

  if (options.oldest) {
    params.set('oldest', options.oldest);
  }
  if (options.newest) {
    params.set('newest', options.newest);
  }

  const url = `${INTERVALS_API_BASE}/athlete/${athleteId}/activities${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('Intervals.icu API error:', response.status, errorText);
    throw new Error(`Intervals.icu API error (${response.status}): ${errorText.slice(0, 100)}`);
  }

  const activities: IntervalsActivity[] = await response.json();


  // Check if activities are Strava-sourced (limited data available)
  const stravaSourced = activities.filter(a =>
    a.source === 'STRAVA' || (a as unknown as Record<string, unknown>)._note?.toString().includes('STRAVA')
  );
  if (stravaSourced.length > 0 && stravaSourced.length === activities.length) {
    throw new Error('Your Intervals.icu activities are synced from Strava. Due to API restrictions, please connect Strava directly instead for full activity data.');
  }

  // Filter to only running activities (case-insensitive)
  const runningActivities = activities.filter((a) => {
    const type = a.type?.toLowerCase() || '';
    return type.includes('run') || type === 'running';
  });

  return runningActivities;
}

/**
 * Get a single activity with full details
 */
export async function getIntervalsActivity(
  athleteId: string,
  apiKey: string,
  activityId: string
): Promise<IntervalsActivity> {
  const response = await fetch(
    `${INTERVALS_API_BASE}/athlete/${athleteId}/activities/${activityId}`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch activity: ${response.status}`);
  }

  return response.json();
}

/**
 * Get wellness data (sleep, HRV, etc.)
 */
export async function getIntervalsWellness(
  athleteId: string,
  apiKey: string,
  options: {
    oldest?: string;
    newest?: string;
  } = {}
): Promise<IntervalsWellness[]> {
  const params = new URLSearchParams();

  if (options.oldest) {
    params.set('oldest', options.oldest);
  }
  if (options.newest) {
    params.set('newest', options.newest);
  }

  const url = `${INTERVALS_API_BASE}/athlete/${athleteId}/wellness${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch wellness: ${response.status}`);
  }

  return response.json();
}

/**
 * Map Intervals.icu activity type to our workout type
 * Uses training load and intensity to better categorize
 */
export function mapIntervalsWorkoutType(
  activity: IntervalsActivity
): string {
  const intensity = activity.icu_intensity;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _load = activity.icu_training_load;
  const distance = activity.distance / 1609.34; // Convert to miles

  // Check name for hints
  const nameLower = activity.name?.toLowerCase() || '';
  if (nameLower.includes('race') || nameLower.includes('5k') || nameLower.includes('10k') || nameLower.includes('marathon')) {
    return 'race';
  }
  if (nameLower.includes('tempo')) {
    return 'tempo';
  }
  if (nameLower.includes('interval') || nameLower.includes('speed') || nameLower.includes('track')) {
    return 'interval';
  }
  if (nameLower.includes('long') || nameLower.includes('lsd')) {
    return 'long';
  }
  if (nameLower.includes('recovery') || nameLower.includes('easy')) {
    return 'easy';
  }

  // Use intensity if available (0-100 scale)
  if (intensity !== undefined) {
    if (intensity >= 90) return 'race';
    if (intensity >= 80) return 'interval';
    if (intensity >= 70) return 'tempo';
    if (intensity >= 55) return 'steady';
    if (intensity < 50) return 'easy';
  }

  // Fallback to distance-based heuristics
  if (distance >= 13) return 'long';
  if (distance >= 8) return 'long';

  return 'easy'; // Default
}

/**
 * Convert Intervals.icu activity to our workout format
 */
export function convertIntervalsActivity(activity: IntervalsActivity): {
  date: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPaceSeconds: number;
  workoutType: string;
  notes: string;
  source: string;
  intervalsActivityId: string;
  avgHeartRate?: number;
  elevationGainFeet?: number;
  trainingLoad?: number;
} {
  const distanceMiles = activity.distance / 1609.34;
  const durationMinutes = activity.moving_time / 60;
  const avgPaceSeconds = distanceMiles > 0
    ? Math.round(activity.moving_time / distanceMiles)
    : 0;

  // Extract date (YYYY-MM-DD) from local time
  const date = activity.start_date_local.split('T')[0];

  // Build notes from activity name and description
  let notes = activity.name || '';
  if (activity.description) {
    notes += notes ? ` - ${activity.description}` : activity.description;
  }
  if (activity.workout_doc?.description) {
    notes += notes ? ` | ${activity.workout_doc.description}` : activity.workout_doc.description;
  }

  return {
    date,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationMinutes: Math.round(durationMinutes * 10) / 10,
    avgPaceSeconds,
    workoutType: mapIntervalsWorkoutType(activity),
    notes: notes.slice(0, 500), // Limit length
    source: 'intervals',
    intervalsActivityId: activity.id,
    avgHeartRate: activity.average_heartrate ? Math.round(activity.average_heartrate) : undefined,
    elevationGainFeet: activity.total_elevation_gain
      ? +(activity.total_elevation_gain * 3.28084).toFixed(1)
      : undefined,
    trainingLoad: activity.icu_training_load,
  };
}

/**
 * Get fitness data (CTL/ATL/TSB) from Intervals.icu
 */
export async function getIntervalsFitness(
  athleteId: string,
  apiKey: string
): Promise<{ ctl: number; atl: number; tsb: number } | null> {
  try {
    const athlete = await getIntervalsAthlete(athleteId, apiKey);

    if (athlete.ctl !== undefined && athlete.atl !== undefined) {
      return {
        ctl: athlete.ctl,
        atl: athlete.atl,
        tsb: athlete.ctl - athlete.atl,
      };
    }
    return null;
  } catch {
    return null;
  }
}
