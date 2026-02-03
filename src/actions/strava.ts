'use server';

import { db, userSettings, workouts, workoutSegments } from '@/lib/db';
import { eq, and, gte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  exchangeStravaCode,
  refreshStravaToken,
  deauthorizeStrava,
  getStravaActivities,
  getStravaActivityLaps,
  getStravaActivityStreams,
  convertStravaActivity,
  convertStravaLap,
  calculateHRZones,
  isTokenExpired,
  getStravaAthlete,
} from '@/lib/strava';
import { saveWorkoutLaps } from './laps';
import { getSettings } from './settings';

export interface StravaConnectionStatus {
  isConnected: boolean;
  athleteId?: number;
  lastSyncAt?: string;
  autoSync: boolean;
}

/**
 * Get current Strava connection status
 */
export async function getStravaStatus(): Promise<StravaConnectionStatus> {
  const settings = await getSettings();

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
export async function connectStrava(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const tokens = await exchangeStravaCode(code);
    const settings = await getSettings();

    if (!settings) {
      return { success: false, error: 'User settings not found' };
    }

    // Get athlete info
    const athlete = await getStravaAthlete(tokens.accessToken);

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
  } catch (error) {
    console.error('Failed to connect Strava:', error);
    return { success: false, error: 'Failed to connect to Strava' };
  }
}

/**
 * Disconnect Strava account
 */
export async function disconnectStrava(): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getSettings();

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
 */
async function getValidAccessToken(): Promise<string | null> {
  const settings = await getSettings();

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
 */
export async function syncStravaActivities(options?: {
  since?: string; // ISO date
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

    const settings = await getSettings();
    if (!settings) {
      return { success: false, imported: 0, skipped: 0, error: 'Settings not found' };
    }

    // Determine date range
    let afterTimestamp: number | undefined;

    if (options?.fullSync) {
      // Full sync: last 365 days
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      afterTimestamp = Math.floor(oneYearAgo.getTime() / 1000);
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

    // Fetch activities from Strava
    const activities = await getStravaActivities(accessToken, {
      after: afterTimestamp,
      perPage: 100,
    });

    let imported = 0;
    let skipped = 0;

    // Import each activity
    for (const activity of activities) {
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

        // Import new workout
        const insertResult = await db.insert(workouts).values({
          date: workoutData.date,
          distanceMiles: workoutData.distanceMiles,
          durationMinutes: workoutData.durationMinutes,
          avgPaceSeconds: workoutData.avgPaceSeconds,
          workoutType: workoutData.workoutType,
          notes: workoutData.notes,
          source: 'strava',
          stravaActivityId: activity.id,
          avgHeartRate: workoutData.avgHeartRate,
          elevationGainFeet: workoutData.elevationGainFeet,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).returning({ id: workouts.id });

        const newWorkoutId = insertResult[0]?.id;

        // Fetch and save laps for this activity
        if (newWorkoutId) {
          try {
            const stravaLaps = await getStravaActivityLaps(accessToken, activity.id);
            if (stravaLaps.length > 0) {
              const convertedLaps = stravaLaps.map(convertStravaLap);
              await saveWorkoutLaps(newWorkoutId, convertedLaps);
            }
          } catch (lapError) {
            console.warn(`Failed to fetch laps for activity ${activity.id}:`, lapError);
            // Continue without laps
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

    revalidatePath('/history');
    revalidatePath('/analytics');
    revalidatePath('/today');

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

    // Find Strava workouts that might not have laps
    const stravaWorkouts = await db.query.workouts.findMany({
      where: and(
        eq(workouts.source, 'strava'),
      ),
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
          const convertedLaps = stravaLaps.map(convertStravaLap);
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
    const settings = await getSettings();
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
