'use server';

import { db, workouts } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  getStravaActivities,
  getStravaActivityStreams,
  calculateHRZones,
} from '@/lib/strava';
import { getSettings } from './settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { getCachedWorkoutStreams } from '@/lib/workout-stream-cache';
import { getValidAccessToken } from './strava-auth';
import { fetchAndCacheStravaStreams } from './strava-import';

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
    altitude: number[];
    cadence: number[];
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

    const cached = await getCachedWorkoutStreams(workoutId);
    if (cached) {
      return {
        success: true,
        data: cached.data,
      };
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

    await fetchAndCacheStravaStreams({
      accessToken,
      activityId,
      workoutId,
      profileId: workout.profileId,
      fallbackMaxHr: workout.maxHr || workout.avgHeartRate || 185,
    });

    const freshCached = await getCachedWorkoutStreams(workoutId);
    if (!freshCached) {
      return { success: false, error: 'Stream data not available' };
    }

    // Backfill estimated max HR against profile age if possible.
    const settings = await getSettings();
    let maxHr = freshCached.data.maxHr || workout.maxHr || 185;
    if (settings?.age) {
      maxHr = Math.max(maxHr, 220 - settings.age);
    }

    return {
      success: true,
      data: {
        ...freshCached.data,
        maxHr,
      },
    };
  } catch (error) {
    console.error('Failed to get workout streams:', error);
    return { success: false, error: 'Failed to fetch stream data' };
  }
}
