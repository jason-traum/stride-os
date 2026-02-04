'use server';

import { db, workouts, userSettings } from '@/lib/db';
import { eq, and, isNull, gte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  refreshStravaToken,
  getStravaActivities,
  getStravaActivityLaps,
  convertStravaLap,
  classifyLaps,
  isTokenExpired,
} from '@/lib/strava';
import { saveWorkoutLaps } from './laps';
import { getActiveProfileId } from '@/lib/profile-server';

export interface BackfillResult {
  matched: number;
  lapsAdded: number;
  errors: string[];
  details: Array<{
    workoutId: number;
    date: string;
    stravaId: number;
    lapCount: number;
  }>;
}

// Helper for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Match existing workouts to Strava activities and backfill IDs + laps
 *
 * Matching criteria:
 * - Same date
 * - Distance within 5% or 0.2 miles
 * - Duration within 10% or 5 minutes
 */
export async function backfillStravaIds(
  options: {
    daysBack?: number;
    dryRun?: boolean;
    resyncExistingLaps?: boolean;
    profileId?: number; // Optional: pass explicitly for CLI usage (bypasses cookies)
    rateLimitDelayMs?: number; // Delay between API calls to avoid rate limits (default: 200ms)
  } = {}
): Promise<BackfillResult> {
  const { daysBack = 90, dryRun = false, resyncExistingLaps = false, profileId: explicitProfileId, rateLimitDelayMs = 200 } = options;

  const result: BackfillResult = {
    matched: 0,
    lapsAdded: 0,
    errors: [],
    details: [],
  };

  try {
    // Get Strava credentials - use explicit profileId if provided (CLI), otherwise from cookies
    let profileId: number | undefined = explicitProfileId;
    if (profileId === undefined) {
      try {
        profileId = await getActiveProfileId();
      } catch {
        // cookies() not available (CLI context) - will query without profile filter
      }
    }
    const settings = await db.query.userSettings.findFirst({
      where: profileId ? eq(userSettings.profileId, profileId) : undefined,
    });

    if (!settings?.stravaAccessToken || !settings?.stravaRefreshToken) {
      result.errors.push('Strava not connected. Please connect Strava first.');
      return result;
    }

    // Refresh token if needed
    let accessToken = settings.stravaAccessToken;
    if (isTokenExpired(settings.stravaTokenExpiresAt)) {
      const newTokens = await refreshStravaToken(settings.stravaRefreshToken);
      accessToken = newTokens.accessToken;

      // Update stored tokens
      await db.update(userSettings)
        .set({
          stravaAccessToken: newTokens.accessToken,
          stravaRefreshToken: newTokens.refreshToken,
          stravaTokenExpiresAt: newTokens.expiresAt,
        })
        .where(eq(userSettings.id, settings.id));
    }

    // Calculate date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Get workouts without Strava IDs (or all if resyncExistingLaps)
    const workoutsToMatch = await db.query.workouts.findMany({
      where: and(
        gte(workouts.date, cutoffStr),
        profileId ? eq(workouts.profileId, profileId) : undefined,
        resyncExistingLaps ? undefined : isNull(workouts.stravaActivityId)
      ),
    });

    if (workoutsToMatch.length === 0) {
      result.errors.push('No workouts found to match in the specified date range.');
      return result;
    }

    // Fetch Strava activities for the same period
    // Strava API returns activities in reverse chronological order
    const stravaActivities = await getStravaActivities(accessToken, 1, 200, cutoffDate.getTime() / 1000);

    if (stravaActivities.length === 0) {
      result.errors.push('No Strava activities found in the specified date range.');
      return result;
    }

    // Build a map of Strava activities by date for faster lookup
    const stravaByDate = new Map<string, typeof stravaActivities>();
    for (const activity of stravaActivities) {
      const date = activity.start_date_local.split('T')[0];
      if (!stravaByDate.has(date)) {
        stravaByDate.set(date, []);
      }
      stravaByDate.get(date)!.push(activity);
    }

    // Match workouts to Strava activities
    for (const workout of workoutsToMatch) {
      const dateActivities = stravaByDate.get(workout.date);
      if (!dateActivities) continue;

      // Find best match by distance and duration
      let bestMatch: typeof stravaActivities[0] | null = null;
      let bestScore = Infinity;

      for (const activity of dateActivities) {
        // Convert Strava distance (meters) to miles
        const stravaDistMiles = activity.distance / 1609.34;
        const stravaDurationMin = activity.moving_time / 60;

        const workoutDist = workout.distanceMiles || 0;
        const workoutDuration = workout.durationMinutes || 0;

        // Calculate match score (lower is better)
        const distDiff = Math.abs(stravaDistMiles - workoutDist);
        const distPct = workoutDist > 0 ? distDiff / workoutDist : distDiff;

        const durationDiff = Math.abs(stravaDurationMin - workoutDuration);
        const durationPct = workoutDuration > 0 ? durationDiff / workoutDuration : durationDiff;

        // Accept if within tolerances
        const distOk = distDiff < 0.2 || distPct < 0.05;
        const durationOk = durationDiff < 5 || durationPct < 0.1;

        if (distOk && durationOk) {
          const score = distPct + durationPct;
          if (score < bestScore) {
            bestScore = score;
            bestMatch = activity;
          }
        }
      }

      if (bestMatch) {
        result.matched++;

        if (!dryRun) {
          // Update workout with Strava ID
          await db.update(workouts)
            .set({ stravaActivityId: bestMatch.id })
            .where(eq(workouts.id, workout.id));

          // Fetch and save laps (with rate limiting)
          try {
            // Rate limit delay before API call
            if (rateLimitDelayMs > 0) {
              await sleep(rateLimitDelayMs);
            }

            const stravaLaps = await getStravaActivityLaps(accessToken, bestMatch.id);
            if (stravaLaps.length > 0) {
              const convertedLaps = classifyLaps(stravaLaps.map(convertStravaLap));
              await saveWorkoutLaps(workout.id, convertedLaps);
              result.lapsAdded += stravaLaps.length;

              result.details.push({
                workoutId: workout.id,
                date: workout.date,
                stravaId: bestMatch.id,
                lapCount: stravaLaps.length,
              });
            }
          } catch (lapError) {
            result.errors.push(`Failed to fetch laps for workout ${workout.id}: ${lapError}`);
          }
        } else {
          // Dry run - just record what would happen
          result.details.push({
            workoutId: workout.id,
            date: workout.date,
            stravaId: bestMatch.id,
            lapCount: 0, // Unknown in dry run
          });
        }
      }
    }

    if (!dryRun && result.matched > 0) {
      revalidatePath('/history');
      revalidatePath('/analytics');
    }

  } catch (error) {
    result.errors.push(`Backfill failed: ${error}`);
  }

  return result;
}

/**
 * Re-sync laps for a specific workout that already has a Strava ID
 */
export async function resyncWorkoutLaps(workoutId: number): Promise<{
  success: boolean;
  lapCount: number;
  error?: string;
}> {
  try {
    const profileId = await getActiveProfileId();

    // Get the workout
    const workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
    });

    if (!workout) {
      return { success: false, lapCount: 0, error: 'Workout not found' };
    }

    if (!workout.stravaActivityId) {
      return { success: false, lapCount: 0, error: 'Workout has no Strava activity ID' };
    }

    // Get Strava credentials
    const settings = await db.query.userSettings.findFirst({
      where: profileId ? eq(userSettings.profileId, profileId) : undefined,
    });

    if (!settings?.stravaAccessToken) {
      return { success: false, lapCount: 0, error: 'Strava not connected' };
    }

    // Refresh token if needed
    let accessToken = settings.stravaAccessToken;
    if (isTokenExpired(settings.stravaTokenExpiresAt)) {
      const newTokens = await refreshStravaToken(settings.stravaRefreshToken!);
      accessToken = newTokens.accessToken;
    }

    // Fetch and save laps
    const stravaLaps = await getStravaActivityLaps(accessToken, workout.stravaActivityId);
    if (stravaLaps.length > 0) {
      const convertedLaps = classifyLaps(stravaLaps.map(convertStravaLap));
      await saveWorkoutLaps(workoutId, convertedLaps);

      revalidatePath(`/workout/${workoutId}`);
      return { success: true, lapCount: stravaLaps.length };
    }

    return { success: true, lapCount: 0 };
  } catch (error) {
    return { success: false, lapCount: 0, error: `${error}` };
  }
}

/**
 * Get stats about workouts missing Strava IDs
 */
export async function getMissingStravaIdStats(explicitProfileId?: number): Promise<{
  totalWorkouts: number;
  withStravaId: number;
  withoutStravaId: number;
  withLaps: number;
  withoutLaps: number;
}> {
  let profileId: number | undefined = explicitProfileId;
  if (profileId === undefined) {
    try {
      profileId = await getActiveProfileId();
    } catch {
      // cookies() not available (CLI context) - will query without profile filter
    }
  }

  const allWorkouts = await db.query.workouts.findMany({
    where: profileId ? eq(workouts.profileId, profileId) : undefined,
    with: {
      segments: true,
    },
  });

  return {
    totalWorkouts: allWorkouts.length,
    withStravaId: allWorkouts.filter(w => w.stravaActivityId).length,
    withoutStravaId: allWorkouts.filter(w => !w.stravaActivityId).length,
    withLaps: allWorkouts.filter(w => w.segments && w.segments.length > 0).length,
    withoutLaps: allWorkouts.filter(w => !w.segments || w.segments.length === 0).length,
  };
}
