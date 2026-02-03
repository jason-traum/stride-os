'use server';

import { db, userSettings, workouts } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  validateIntervalsApiKey,
  getIntervalsActivities,
  convertIntervalsActivity,
  getIntervalsFitness,
} from '@/lib/intervals';
import { getSettings } from './settings';

export interface IntervalsConnectionStatus {
  isConnected: boolean;
  athleteId?: string;
  lastSyncAt?: string;
  autoSync: boolean;
}

/**
 * Get current Intervals.icu connection status
 */
export async function getIntervalsStatus(): Promise<IntervalsConnectionStatus> {
  const settings = await getSettings();

  if (!settings || !settings.intervalsAthleteId || !settings.intervalsApiKey) {
    return {
      isConnected: false,
      autoSync: true,
    };
  }

  return {
    isConnected: true,
    athleteId: settings.intervalsAthleteId,
    lastSyncAt: settings.intervalsLastSyncAt ?? undefined,
    autoSync: settings.intervalsAutoSync ?? true,
  };
}

/**
 * Connect to Intervals.icu using API key
 */
export async function connectIntervals(
  athleteId: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate the API key
    const validation = await validateIntervalsApiKey(athleteId, apiKey);

    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid credentials' };
    }

    const settings = await getSettings();

    if (!settings) {
      return { success: false, error: 'User settings not found' };
    }

    // Save credentials to settings
    await db.update(userSettings)
      .set({
        intervalsAthleteId: athleteId,
        intervalsApiKey: apiKey,
        intervalsAutoSync: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');

    return { success: true };
  } catch (error) {
    console.error('Failed to connect Intervals.icu:', error);
    return { success: false, error: 'Failed to connect to Intervals.icu' };
  }
}

/**
 * Disconnect Intervals.icu account
 */
export async function disconnectIntervals(): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getSettings();

    if (!settings) {
      return { success: false, error: 'Settings not found' };
    }

    // Clear credentials from settings
    await db.update(userSettings)
      .set({
        intervalsAthleteId: null,
        intervalsApiKey: null,
        intervalsLastSyncAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');

    return { success: true };
  } catch (error) {
    console.error('Failed to disconnect Intervals.icu:', error);
    return { success: false, error: 'Failed to disconnect from Intervals.icu' };
  }
}

/**
 * Sync activities from Intervals.icu
 */
export async function syncIntervalsActivities(options?: {
  since?: string; // ISO date YYYY-MM-DD
  fullSync?: boolean;
}): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  error?: string;
}> {
  try {
    const settings = await getSettings();

    if (!settings || !settings.intervalsAthleteId || !settings.intervalsApiKey) {
      return { success: false, imported: 0, skipped: 0, error: 'Not connected to Intervals.icu' };
    }

    // Determine date range
    let oldestDate: string;

    if (options?.fullSync) {
      // Full sync: last 365 days
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      oldestDate = oneYearAgo.toISOString().split('T')[0];
    } else if (options?.since) {
      oldestDate = options.since;
    } else if (settings.intervalsLastSyncAt) {
      // Incremental sync: since last sync
      oldestDate = settings.intervalsLastSyncAt.split('T')[0];
    } else {
      // First sync: last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      oldestDate = ninetyDaysAgo.toISOString().split('T')[0];
    }

    const newestDate = new Date().toISOString().split('T')[0];

    console.log(`[Intervals Sync] Fetching activities from ${oldestDate} to ${newestDate}`);
    console.log(`[Intervals Sync] Athlete ID: ${settings.intervalsAthleteId}`);

    // Fetch activities from Intervals.icu
    const activities = await getIntervalsActivities(
      settings.intervalsAthleteId,
      settings.intervalsApiKey,
      { oldest: oldestDate, newest: newestDate }
    );

    console.log(`[Intervals Sync] Received ${activities.length} running activities from API`);

    let imported = 0;
    let skipped = 0;

    // Import each activity
    for (const activity of activities) {
      try {
        // Check if already imported (by Intervals.icu ID)
        const existingWorkout = await db.query.workouts.findFirst({
          where: eq(workouts.intervalsActivityId, activity.id),
        });

        if (existingWorkout) {
          console.log(`[Intervals Sync] Skipping ${activity.id}: already imported`);
          skipped++;
          continue;
        }

        // Convert and prepare workout data
        const workoutData = convertIntervalsActivity(activity);

        // Check for duplicate by date and distance
        const existingByDate = await db.query.workouts.findFirst({
          where: and(
            eq(workouts.date, workoutData.date),
          ),
        });

        if (existingByDate) {
          const distanceDiff = Math.abs((existingByDate.distanceMiles || 0) - workoutData.distanceMiles);
          if (distanceDiff < 0.2) {
            // Likely same workout, update with Intervals.icu ID
            console.log(`[Intervals Sync] Linking ${activity.id} to existing workout on ${workoutData.date}`);
            await db.update(workouts)
              .set({
                intervalsActivityId: activity.id,
                trainingLoad: workoutData.trainingLoad,
                source: existingByDate.source === 'manual' ? 'intervals' : existingByDate.source,
              })
              .where(eq(workouts.id, existingByDate.id));
            skipped++;
            continue;
          }
        }

        // Import new workout
        console.log(`[Intervals Sync] Importing ${activity.id}: ${workoutData.date} - ${workoutData.distanceMiles}mi`);
        await db.insert(workouts).values({
          date: workoutData.date,
          distanceMiles: workoutData.distanceMiles,
          durationMinutes: workoutData.durationMinutes,
          avgPaceSeconds: workoutData.avgPaceSeconds,
          workoutType: workoutData.workoutType,
          notes: workoutData.notes,
          source: 'intervals',
          intervalsActivityId: activity.id,
          avgHeartRate: workoutData.avgHeartRate,
          elevationGainFeet: workoutData.elevationGainFeet,
          trainingLoad: workoutData.trainingLoad,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        imported++;
      } catch (error) {
        console.error(`[Intervals Sync] Failed to import activity ${activity.id}:`, error);
        skipped++;
      }
    }

    console.log(`[Intervals Sync] Complete: ${imported} imported, ${skipped} skipped`);

    // Update last sync time
    await db.update(userSettings)
      .set({
        intervalsLastSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/history');
    revalidatePath('/analytics');
    revalidatePath('/today');

    return { success: true, imported, skipped };
  } catch (error) {
    console.error('Failed to sync Intervals.icu activities:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync activities';
    return { success: false, imported: 0, skipped: 0, error: errorMessage };
  }
}

/**
 * Toggle auto-sync setting
 */
export async function setIntervalsAutoSync(enabled: boolean): Promise<{ success: boolean }> {
  try {
    const settings = await getSettings();
    if (!settings) {
      return { success: false };
    }

    await db.update(userSettings)
      .set({
        intervalsAutoSync: enabled,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Failed to update Intervals.icu auto-sync:', error);
    return { success: false };
  }
}

/**
 * Get current fitness metrics from Intervals.icu
 */
export async function getIntervalsFitnessData(): Promise<{
  success: boolean;
  ctl?: number;
  atl?: number;
  tsb?: number;
  error?: string;
}> {
  try {
    const settings = await getSettings();

    if (!settings || !settings.intervalsAthleteId || !settings.intervalsApiKey) {
      return { success: false, error: 'Not connected to Intervals.icu' };
    }

    const fitness = await getIntervalsFitness(
      settings.intervalsAthleteId,
      settings.intervalsApiKey
    );

    if (!fitness) {
      return { success: false, error: 'Could not fetch fitness data' };
    }

    return {
      success: true,
      ctl: fitness.ctl,
      atl: fitness.atl,
      tsb: fitness.tsb,
    };
  } catch (error) {
    console.error('Failed to get Intervals.icu fitness:', error);
    return { success: false, error: 'Failed to fetch fitness data' };
  }
}
