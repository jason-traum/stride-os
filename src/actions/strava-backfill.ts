'use server';

import { db, workouts, workoutSegments, workoutStreams } from '@/lib/db';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  getStravaActivities,
  getStravaActivityLaps,
  convertStravaLap,
  classifyLaps,
} from '@/lib/strava';
import { saveWorkoutLaps } from './laps';
import { getSettings } from './settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { getValidAccessToken } from './strava-auth';
import { fetchAndCacheStravaStreams } from './strava-import';

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
 * Backfill cached raw streams for Strava workouts.
 * Useful when stream storage is introduced after workouts are already imported.
 */
export async function syncStravaWorkoutStreams(limit: number = 120): Promise<{
  success: boolean;
  synced: number;
  skipped: number;
  error?: string;
}> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return { success: false, synced: 0, skipped: 0, error: 'Not connected to Strava' };
    }

    const profileId = await getActiveProfileId();
    const scope = profileId
      ? and(
        eq(workouts.source, 'strava'),
        eq(workouts.profileId, profileId),
        isNotNull(workouts.stravaActivityId)
      )
      : and(
        eq(workouts.source, 'strava'),
        isNotNull(workouts.stravaActivityId)
      );

    const stravaWorkouts = await db
      .select({
        id: workouts.id,
        profileId: workouts.profileId,
        stravaActivityId: workouts.stravaActivityId,
        maxHr: workouts.maxHr,
        avgHeartRate: workouts.avgHeartRate,
      })
      .from(workouts)
      .leftJoin(workoutStreams, eq(workoutStreams.workoutId, workouts.id))
      .where(and(scope, isNull(workoutStreams.id)))
      .orderBy(desc(workouts.date))
      .limit(limit);

    let synced = 0;
    let skipped = 0;

    for (const workout of stravaWorkouts) {
      if (!workout.stravaActivityId) {
        skipped++;
        continue;
      }

      try {
        await fetchAndCacheStravaStreams({
          accessToken,
          activityId: workout.stravaActivityId,
          workoutId: workout.id,
          profileId: workout.profileId,
          fallbackMaxHr: workout.maxHr || workout.avgHeartRate || null,
        });
        synced++;
      } catch (err) {
        console.warn(`Failed to cache streams for workout ${workout.id}:`, err);
        skipped++;
      }

      await new Promise(resolve => setTimeout(resolve, 120));
    }

    if (synced > 0) {
      revalidatePath('/history');
      revalidatePath('/workout');
    }

    return { success: true, synced, skipped };
  } catch (error) {
    console.error('Failed to sync Strava workout streams:', error);
    return { success: false, synced: 0, skipped: 0, error: 'Failed to sync workout streams' };
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
