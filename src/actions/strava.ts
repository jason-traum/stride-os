'use server';

import { db, userSettings, workouts } from '@/lib/db';
import { eq, and, gte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  exchangeStravaCode,
  refreshStravaToken,
  deauthorizeStrava,
  getStravaActivities,
  convertStravaActivity,
  isTokenExpired,
  getStravaAthlete,
} from '@/lib/strava';
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
        await db.insert(workouts).values({
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
        });

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
