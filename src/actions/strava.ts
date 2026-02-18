'use server';

import { db, userSettings, workouts, workoutSegments } from '@/lib/db';
import { eq, and, gte, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  exchangeStravaCode,
  refreshStravaToken,
  deauthorizeStrava,
  getStravaActivities,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getStravaActivity,
  getStravaActivityLaps,
  getStravaActivityStreams,
  convertStravaActivity,
  convertStravaLap,
  classifyLaps,
  calculateHRZones,
  isTokenExpired,
  getStravaAthlete,
} from '@/lib/strava';
import { saveWorkoutLaps } from './laps';
import { getSettings } from './settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { recordVdotEntry } from './vdot-history';
import { calculateVDOT } from '@/lib/training/vdot-calculator';
import { syncVdotFromPredictionEngine } from './vdot-sync';
import { computeWorkoutFitnessSignals } from './fitness-signals';

export interface StravaConnectionStatus {
  isConnected: boolean;
  athleteId?: number;
  lastSyncAt?: string;
  autoSync: boolean;
}

async function getOrCreateSettingsForProfile(profileId?: number) {
  if (profileId === undefined) {
    return getSettings();
  }

  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });
  if (existing) return existing;

  const now = new Date().toISOString();
  const [created] = await db.insert(userSettings).values({
    profileId,
    name: '',
    createdAt: now,
    updatedAt: now,
  }).returning();
  return created;
}

/**
 * Get current Strava connection status for the active profile
 */
export async function getStravaStatus(): Promise<StravaConnectionStatus> {
  const profileId = await getActiveProfileId();
  const settings = await getOrCreateSettingsForProfile(profileId);

  if (!settings || !settings.stravaAccessToken) {
    return {
      isConnected: false,
      autoSync: true,
    };
  }

  return {
    isConnected: true,
    athleteId: settings.stravaAthleteId ?? undefined,
    lastSyncAt: settings.stravaLastSyncAt ?? undefined,
    autoSync: settings.stravaAutoSync ?? true,
  };
}

/**
 * Handle OAuth callback - exchange code for tokens
 */
export async function connectStrava(
  code: string,
  redirectUri?: string,
  profileIdOverride?: number
): Promise<{ success: boolean; error?: string }> {
  try {

    const tokens = await exchangeStravaCode(code, redirectUri);

    const activeProfileId = profileIdOverride ?? await getActiveProfileId();
    const settings = await getOrCreateSettingsForProfile(activeProfileId);

    if (!settings) {
      console.error('[connectStrava] User settings not found');
      return { success: false, error: 'User settings not found' };
    }

    // Get athlete info
    await getStravaAthlete(tokens.accessToken);

    // Save tokens to settings
    await db.update(userSettings)
      .set({
        stravaAthleteId: tokens.athleteId,
        stravaAccessToken: tokens.accessToken,
        stravaRefreshToken: tokens.refreshToken,
        stravaTokenExpiresAt: tokens.expiresAt,
        stravaAutoSync: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');

    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('[connectStrava] Detailed error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    // Return the actual error message for debugging
    return { success: false, error: error.message || 'Failed to connect to Strava' };
  }
}

/**
 * Disconnect Strava account
 */
export async function disconnectStrava(): Promise<{ success: boolean; error?: string }> {
  try {
    const profileId = await getActiveProfileId();
    const settings = await getOrCreateSettingsForProfile(profileId);

    if (!settings || !settings.stravaAccessToken) {
      return { success: false, error: 'Not connected to Strava' };
    }

    // Try to deauthorize on Strava's side
    try {
      await deauthorizeStrava(settings.stravaAccessToken);
    } catch {
      // Continue even if deauthorization fails
      console.warn('Failed to deauthorize on Strava side');
    }

    // Clear tokens from settings
    await db.update(userSettings)
      .set({
        stravaAthleteId: null,
        stravaAccessToken: null,
        stravaRefreshToken: null,
        stravaTokenExpiresAt: null,
        stravaLastSyncAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');

    return { success: true };
  } catch (error) {
    console.error('Failed to disconnect Strava:', error);
    return { success: false, error: 'Failed to disconnect from Strava' };
  }
}

/**
 * Get a valid access token, refreshing if needed
 * Uses the active profile's settings
 */
async function getValidAccessToken(): Promise<string | null> {
  const profileId = await getActiveProfileId();
  const settings = await getOrCreateSettingsForProfile(profileId);

  if (!settings || !settings.stravaAccessToken || !settings.stravaRefreshToken) {
    return null;
  }

  // Check if token needs refresh
  if (settings.stravaTokenExpiresAt && isTokenExpired(settings.stravaTokenExpiresAt)) {
    try {
      const newTokens = await refreshStravaToken(settings.stravaRefreshToken);

      // Save new tokens
      await db.update(userSettings)
        .set({
          stravaAccessToken: newTokens.accessToken,
          stravaRefreshToken: newTokens.refreshToken,
          stravaTokenExpiresAt: newTokens.expiresAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userSettings.id, settings.id));

      return newTokens.accessToken;
    } catch (error) {
      console.error('Failed to refresh Strava token:', error);
      return null;
    }
  }

  return settings.stravaAccessToken;
}

/**
 * Sync activities from Strava
 * Uses the active profile's Strava connection
 */
export async function syncStravaActivities(options?: {
  since?: string; // ISO date
  until?: string; // ISO date — end of range (exclusive), defaults to now
  fullSync?: boolean;
}): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  error?: string;
}> {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return { success: false, imported: 0, skipped: 0, error: 'Not connected to Strava' };
    }

    // Use the active profile's settings
    const profileId = await getActiveProfileId();
    const settings = await getOrCreateSettingsForProfile(profileId);
    if (!settings) {
      return { success: false, imported: 0, skipped: 0, error: 'Settings not found' };
    }

    // Determine date range
    let afterTimestamp: number | undefined;

    if (options?.fullSync) {
      // Full sync: last 4 years
      const fourYearsAgo = new Date();
      fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
      afterTimestamp = Math.floor(fourYearsAgo.getTime() / 1000);
    } else if (options?.since) {
      afterTimestamp = Math.floor(new Date(options.since).getTime() / 1000);
    } else if (settings.stravaLastSyncAt) {
      // Incremental sync: since last sync
      afterTimestamp = Math.floor(new Date(settings.stravaLastSyncAt).getTime() / 1000);
    } else {
      // First sync: last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      afterTimestamp = Math.floor(ninetyDaysAgo.getTime() / 1000);
    }

    // Compute optional end-of-range timestamp
    let beforeTimestamp: number | undefined;
    if (options?.until) {
      beforeTimestamp = Math.floor(new Date(options.until).getTime() / 1000);
    }

    // Fetch activities from Strava
    const activities = await getStravaActivities(accessToken, {
      after: afterTimestamp,
      before: beforeTimestamp,
      perPage: 100,
      maxPages: 50, // Support larger syncs (up to 5000 activities)
    });


    // Filter for running activities only
    const RUNNING_ACTIVITY_TYPES = ['Run', 'VirtualRun', 'TrailRun'];
    const runActivities = activities.filter(activity =>
      RUNNING_ACTIVITY_TYPES.includes(activity.type)
    );


    let imported = 0;
    let skipped = 0;

    // Import each activity
    for (const activity of runActivities) {
      try {
        // Check if already imported (by checking if workout exists with this Strava ID)
        const existingWorkout = await db.query.workouts.findFirst({
          where: and(
            eq(workouts.stravaActivityId, activity.id),
          ),
        });

        if (existingWorkout) {
          skipped++;
          continue;
        }

        // Also check by date and distance (to avoid duplicates from manual entry)
        const workoutData = convertStravaActivity(activity);
        const existingByDate = await db.query.workouts.findFirst({
          where: and(
            eq(workouts.date, workoutData.date),
            gte(workouts.distanceMiles, workoutData.distanceMiles - 0.1),
          ),
        });

        if (existingByDate && Math.abs((existingByDate.distanceMiles || 0) - workoutData.distanceMiles) < 0.2) {
          // Likely same workout, update with Strava ID
          await db.update(workouts)
            .set({
              stravaActivityId: activity.id,
              source: 'strava',
            })
            .where(eq(workouts.id, existingByDate.id));
          skipped++;
          continue;
        }

        // Capture elapsed time (includes stops) separately from moving time
        const elapsedTimeMinutes = activity.elapsed_time
          ? Math.round(activity.elapsed_time / 60)
          : undefined;

        // Import new workout with profileId from settings
        const insertResult = await db.insert(workouts).values({
          profileId: settings.profileId,
          date: workoutData.date,
          distanceMiles: workoutData.distanceMiles,
          durationMinutes: workoutData.durationMinutes,
          elapsedTimeMinutes,
          avgPaceSeconds: workoutData.avgPaceSeconds,
          workoutType: workoutData.workoutType,
          notes: workoutData.notes,
          source: 'strava',
          stravaActivityId: activity.id,
          avgHeartRate: workoutData.avgHeartRate,
          elevationGainFeet: workoutData.elevationGainFeet,
          polyline: workoutData.polyline,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).returning({ id: workouts.id });

        const newWorkoutId = insertResult[0]?.id;

        // Fetch and save laps for this activity
        if (newWorkoutId) {
          try {
            const stravaLaps = await getStravaActivityLaps(accessToken, activity.id);
            if (stravaLaps.length > 0) {
              const convertedLaps = classifyLaps(stravaLaps.map(convertStravaLap));
              await saveWorkoutLaps(newWorkoutId, convertedLaps);
            }
          } catch (lapError) {
            console.warn(`Failed to fetch laps for activity ${activity.id}:`, lapError);
            // Continue without laps
          }

          // Compute fitness signals (non-critical)
          try {
            await computeWorkoutFitnessSignals(newWorkoutId, settings.profileId);
          } catch {
            // Don't fail sync for signal computation
          }
        }

        // Track if this is a race (Strava workout_type 1 or 11, or name-detected)
        if (workoutData.workoutType === 'race') {
          // Record this race workout to VDOT history
          if (workoutData.distanceMiles && workoutData.durationMinutes) {
            const distanceMeters = workoutData.distanceMiles * 1609.34;
            const timeSeconds = workoutData.durationMinutes * 60;
            const raceVdot = calculateVDOT(distanceMeters, timeSeconds);

            if (raceVdot >= 15 && raceVdot <= 85) {
              try {
                await recordVdotEntry(raceVdot, 'race', {
                  date: workoutData.date,
                  sourceId: newWorkoutId,
                  confidence: 'high',
                  notes: `Strava race: ${workoutData.notes || activity.name}`,
                  profileId: settings.profileId,
                });
              } catch {
                // Don't fail sync for history recording
              }
            }
          }
        }

        imported++;
      } catch (error) {
        console.error(`Failed to import activity ${activity.id}:`, error);
        skipped++;
      }
    }

    // Update last sync time
    await db.update(userSettings)
      .set({
        stravaLastSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    // Update VDOT using multi-signal prediction engine after every sync
    // Every workout (even easy runs with HR) can improve the estimate
    if (imported > 0) {
      try {
        await syncVdotFromPredictionEngine(settings.profileId);
      } catch (err) {
        console.error('[Strava Sync] VDOT sync failed:', err);
      }
    }

    revalidatePath('/history');
    revalidatePath('/analytics');
    revalidatePath('/today');
    revalidatePath('/races');

    return { success: true, imported, skipped };
  } catch (error) {
    console.error('Failed to sync Strava activities:', error);
    return { success: false, imported: 0, skipped: 0, error: 'Failed to sync activities' };
  }
}

/**
 * Sync laps for existing Strava workouts that don't have lap data
 */
export async function syncStravaLaps(): Promise<{
  success: boolean;
  synced: number;
  error?: string;
}> {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return { success: false, synced: 0, error: 'Not connected to Strava' };
    }

    // Get the active profile
    const profileId = await getActiveProfileId();

    // Find Strava workouts for this profile that might not have laps
    const stravaWorkouts = await db.query.workouts.findMany({
      where: profileId
        ? and(eq(workouts.source, 'strava'), eq(workouts.profileId, profileId))
        : eq(workouts.source, 'strava'),
    });

    let synced = 0;

    for (const workout of stravaWorkouts) {
      if (!workout.stravaActivityId) continue;

      // Check if workout already has laps
      const existingLaps = await db.query.workoutSegments.findFirst({
        where: eq(workoutSegments.workoutId, workout.id),
      });

      if (existingLaps) continue;

      // Fetch laps from Strava
      try {
        const stravaLaps = await getStravaActivityLaps(accessToken, workout.stravaActivityId);
        if (stravaLaps.length > 0) {
          const convertedLaps = classifyLaps(stravaLaps.map(convertStravaLap));
          await saveWorkoutLaps(workout.id, convertedLaps);
          synced++;
        }
      } catch (lapError) {
        console.warn(`Failed to fetch laps for workout ${workout.id}:`, lapError);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    revalidatePath('/history');

    return { success: true, synced };
  } catch (error) {
    console.error('Failed to sync Strava laps:', error);
    return { success: false, synced: 0, error: 'Failed to sync laps' };
  }
}

/**
 * Toggle auto-sync setting
 */
export async function setStravaAutoSync(enabled: boolean): Promise<{ success: boolean }> {
  try {
    const profileId = await getActiveProfileId();
    const settings = await getOrCreateSettingsForProfile(profileId);
    if (!settings) {
      return { success: false };
    }

    await db.update(userSettings)
      .set({
        stravaAutoSync: enabled,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Failed to update Strava auto-sync:', error);
    return { success: false };
  }
}

/**
 * Resync laps for a single workout
 */
export async function resyncWorkoutLaps(workoutId: number): Promise<{
  success: boolean;
  lapCount?: number;
  error?: string;
}> {
  try {
    const workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
    });

    if (!workout) {
      return { success: false, error: 'Workout not found' };
    }

    if (!workout.stravaActivityId) {
      return { success: false, error: 'No Strava activity ID - cannot resync laps' };
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return { success: false, error: 'Not connected to Strava' };
    }

    const stravaLaps = await getStravaActivityLaps(accessToken, workout.stravaActivityId);

    if (stravaLaps.length === 0) {
      return { success: true, lapCount: 0 };
    }

    const convertedLaps = classifyLaps(stravaLaps.map(convertStravaLap));
    await saveWorkoutLaps(workoutId, convertedLaps);

    revalidatePath(`/workout/${workoutId}`);
    revalidatePath('/history');

    return { success: true, lapCount: stravaLaps.length };
  } catch (error) {
    console.error('Failed to resync workout laps:', error);
    return { success: false, error: 'Failed to resync laps' };
  }
}

/**
 * Get lap sync health for a workout (for debugging)
 */
export async function getLapSyncHealth(workoutId: number): Promise<{
  hasStravaId: boolean;
  stravaActivityId?: number;
  lapCount: number;
  lastSyncAt?: string;
  canResync: boolean;
}> {
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: {
      segments: true,
    },
  });

  if (!workout) {
    return { hasStravaId: false, lapCount: 0, canResync: false };
  }

  const settings = await getSettings();
  const hasValidConnection = !!(settings?.stravaAccessToken);

  return {
    hasStravaId: !!workout.stravaActivityId,
    stravaActivityId: workout.stravaActivityId ?? undefined,
    lapCount: workout.segments?.length ?? 0,
    lastSyncAt: settings?.stravaLastSyncAt ?? undefined,
    canResync: !!workout.stravaActivityId && hasValidConnection,
  };
}

/**
 * Get HR zone breakdown for a specific workout
 */
export async function getWorkoutHRZones(workoutId: number): Promise<{
  success: boolean;
  zones?: { zone: number; name: string; seconds: number; percentage: number; color: string }[];
  error?: string;
}> {
  try {
    // Get the workout
    const workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
    });

    if (!workout) {
      return { success: false, error: 'Workout not found' };
    }

    if (!workout.stravaActivityId) {
      return { success: false, error: 'Not a Strava workout' };
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return { success: false, error: 'Not connected to Strava' };
    }

    // Fetch HR and time streams
    const streams = await getStravaActivityStreams(
      accessToken,
      workout.stravaActivityId,
      ['heartrate', 'time']
    );

    const hrStream = streams.find(s => s.type === 'heartrate');
    const timeStream = streams.find(s => s.type === 'time');

    if (!hrStream || !timeStream) {
      return { success: false, error: 'HR data not available for this activity' };
    }

    // Estimate max HR (use workout max HR, or 220 - age estimate, or default)
    const settings = await getSettings();
    let maxHr = workout.maxHr || 185;
    if (settings?.age) {
      maxHr = Math.max(maxHr, 220 - settings.age);
    }
    // Use highest HR in the stream if it's higher
    const streamMax = Math.max(...hrStream.data);
    if (streamMax > maxHr) {
      maxHr = streamMax;
    }

    const zones = calculateHRZones(hrStream.data, timeStream.data, maxHr);

    return { success: true, zones };
  } catch (error) {
    console.error('Failed to get HR zones:', error);
    return { success: false, error: 'Failed to fetch HR data' };
  }
}

/**
 * Get continuous activity streams (HR, pace, distance) for Strava-style charts.
 * If stravaActivityId is missing, attempts to find it by matching date/distance
 * against recent Strava activities and backfills the ID.
 */
export async function getWorkoutStreams(workoutId: number): Promise<{
  success: boolean;
  data?: {
    distance: number[];
    heartrate: number[];
    velocity: number[];
    time: number[];
    maxHr: number;
  };
  error?: string;
}> {
  try {
    const workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
    });

    if (!workout) {
      return { success: false, error: 'Workout not found' };
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return { success: false, error: 'Not connected to Strava' };
    }

    let activityId = workout.stravaActivityId;

    // If no stravaActivityId, try to find it by fetching recent Strava activities
    if (!activityId && workout.source === 'strava') {
      try {
        // Convert workout date to epoch range for that day
        const dayStart = new Date(workout.date + 'T00:00:00Z');
        const dayEnd = new Date(workout.date + 'T23:59:59Z');
        const after = Math.floor(dayStart.getTime() / 1000);
        const before = Math.floor(dayEnd.getTime() / 1000);

        const activities = await getStravaActivities(accessToken, { after, before, perPage: 10, maxPages: 1 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const runActivities = activities.filter((a: any) => a.type === 'Run');

        // Match by distance (within 0.2 mi)
        const distMiles = workout.distanceMiles || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matched = runActivities.find((a: any) => {
          const aMiles = (a.distance || 0) * 0.000621371;
          return Math.abs(aMiles - distMiles) < 0.3;
        });

        if (matched) {
          activityId = matched.id;
          // Backfill the stravaActivityId for future use
          await db.update(workouts)
            .set({ stravaActivityId: matched.id })
            .where(eq(workouts.id, workoutId));
        }
      } catch (e) {
        console.warn('[Strava] Failed to find activity ID by date match:', e);
      }
    }

    if (!activityId) {
      return { success: false, error: 'No Strava activity ID' };
    }

    const streams = await getStravaActivityStreams(
      accessToken,
      activityId,
      ['heartrate', 'time', 'distance', 'velocity_smooth', 'altitude']
    );

    const hrStream = streams.find(s => s.type === 'heartrate');
    const timeStream = streams.find(s => s.type === 'time');
    const distanceStream = streams.find(s => s.type === 'distance');
    const velocityStream = streams.find(s => s.type === 'velocity_smooth');
    const altitudeStream = streams.find(s => s.type === 'altitude');

    if (!timeStream) {
      return { success: false, error: 'Stream data not available' };
    }

    // Estimate max HR
    const settings = await getSettings();
    let maxHr = workout.maxHr || 185;
    if (settings?.age) {
      maxHr = Math.max(maxHr, 220 - settings.age);
    }
    if (hrStream) {
      const streamMax = Math.max(...hrStream.data);
      if (streamMax > maxHr) maxHr = streamMax;
    }

    // Distance from Strava is in meters, convert to miles
    const distanceMiles = distanceStream
      ? distanceStream.data.map(d => d * 0.000621371)
      : timeStream.data.map((_, i) => i);

    // Velocity from Strava is m/s, convert to seconds per mile (pace)
    const paceData = velocityStream
      ? velocityStream.data.map(v => v > 0 ? 1609.34 / v : 0)
      : [];

    // Altitude from Strava is in meters, convert to feet
    const altitudeFeet = altitudeStream
      ? altitudeStream.data.map((m: number) => m * 3.28084)
      : [];

    return {
      success: true,
      data: {
        distance: distanceMiles,
        heartrate: hrStream?.data || [],
        velocity: paceData,
        altitude: altitudeFeet,
        time: timeStream.data,
        maxHr,
      },
    };
  } catch (error) {
    console.error('Failed to get workout streams:', error);
    return { success: false, error: 'Failed to fetch stream data' };
  }
}

/**
 * Backfill polyline data for existing Strava workouts that don't have it.
 * Uses the list endpoint (efficient — returns summary_polyline) to batch-match.
 */
export async function backfillPolylines(): Promise<{
  success: boolean;
  updated: number;
  error?: string;
}> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return { success: false, updated: 0, error: 'Not connected to Strava' };
    }

    // Find Strava workouts without polyline
    const missingPolyline = await db.query.workouts.findMany({
      where: and(
        eq(workouts.source, 'strava'),
        isNull(workouts.polyline),
      ),
    });

    if (missingPolyline.length === 0) {
      return { success: true, updated: 0 };
    }

    // Build a lookup of stravaActivityId -> workoutId
    const activityIdToWorkout = new Map<number, number>();
    for (const w of missingPolyline) {
      if (w.stravaActivityId) {
        activityIdToWorkout.set(w.stravaActivityId, w.id);
      }
    }

    // Fetch activities from Strava list endpoint (includes summary_polyline)
    // Go back far enough to cover all workouts
    const oldestDate = missingPolyline.reduce((oldest, w) => {
      return w.date < oldest ? w.date : oldest;
    }, missingPolyline[0].date);

    const afterTimestamp = Math.floor(new Date(oldestDate).getTime() / 1000) - 86400;

    const activities = await getStravaActivities(accessToken, {
      after: afterTimestamp,
      perPage: 100,
      maxPages: 20, // Up to 2000 activities
    });

    let updated = 0;

    for (const activity of activities) {
      const workoutId = activityIdToWorkout.get(activity.id);
      if (!workoutId) continue;

      const polyline = activity.map?.summary_polyline || activity.map?.polyline;
      if (!polyline) continue;

      await db.update(workouts)
        .set({ polyline })
        .where(eq(workouts.id, workoutId));
      updated++;
    }

    if (updated > 0) {
      revalidatePath('/history');
    }

    return { success: true, updated };
  } catch (error) {
    console.error('Failed to backfill polylines:', error);
    return { success: false, updated: 0, error: 'Failed to backfill polylines' };
  }
}
