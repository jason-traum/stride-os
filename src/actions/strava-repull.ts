'use server';

import { db, workouts, userSettings, stravaBestEfforts } from '@/lib/db';
import { eq, and, isNotNull, isNull } from 'drizzle-orm';
import { getStravaActivity, convertStravaActivity, isTokenExpired, refreshStravaToken } from '@/lib/strava';
import type { StravaBestEffort as StravaBestEffortAPI } from '@/lib/strava';
import { encryptToken, decryptToken } from '@/lib/token-crypto';

export interface RepullResult {
  total: number;
  updated: number;
  failed: number;
  skipped: number;
}

/**
 * Re-pull detailed Strava data for existing workouts that are missing the new comprehensive fields.
 * Uses `startLatitude IS NULL` as the sentinel for workouts that need re-pulling.
 * Batched: processes `batchSize` per call with a delay between API calls.
 */
export async function stravaRepull(options?: {
  batchSize?: number;
  delayMs?: number;
  profileId?: number;
}): Promise<RepullResult> {
  const batchSize = options?.batchSize ?? 50;
  const delayMs = options?.delayMs ?? 300;

  const result: RepullResult = { total: 0, updated: 0, failed: 0, skipped: 0 };

  // Get the profile's settings for Strava auth
  const profileId = options?.profileId;
  if (!profileId) {
    return { ...result, failed: -1 }; // Indicate missing profileId
  }

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });

  if (!settings?.stravaAccessToken || !settings?.stravaRefreshToken) {
    return result;
  }

  // Get valid access token
  let accessToken: string;
  if (settings.stravaTokenExpiresAt && isTokenExpired(settings.stravaTokenExpiresAt)) {
    const newTokens = await refreshStravaToken(decryptToken(settings.stravaRefreshToken));
    await db.update(userSettings).set({
      stravaAccessToken: encryptToken(newTokens.accessToken),
      stravaRefreshToken: encryptToken(newTokens.refreshToken),
      stravaTokenExpiresAt: newTokens.expiresAt,
      updatedAt: new Date().toISOString(),
    }).where(eq(userSettings.id, settings.id));
    accessToken = newTokens.accessToken;
  } else {
    accessToken = decryptToken(settings.stravaAccessToken);
  }

  // Find workouts with stravaActivityId but missing startLatitude (sentinel for not-yet-repulled)
  const workoutsToRepull = await db.query.workouts.findMany({
    where: and(
      isNotNull(workouts.stravaActivityId),
      isNull(workouts.startLatitude),
      eq(workouts.profileId, profileId),
    ),
    columns: {
      id: true,
      stravaActivityId: true,
    },
    limit: batchSize,
  });

  result.total = workoutsToRepull.length;

  for (const workout of workoutsToRepull) {
    if (!workout.stravaActivityId) {
      result.skipped++;
      continue;
    }

    try {
      // Fetch full activity detail from Strava
      const activity = await getStravaActivity(accessToken, workout.stravaActivityId);
      const converted = convertStravaActivity(activity);

      // Update workout with all comprehensive fields
      await db.update(workouts)
        .set({
          stravaDescription: converted.stravaDescription,
          stravaKudosCount: converted.stravaKudosCount,
          stravaCommentCount: converted.stravaCommentCount,
          stravaAchievementCount: converted.stravaAchievementCount,
          stravaPhotoCount: converted.stravaPhotoCount,
          stravaAthleteCount: converted.stravaAthleteCount,
          stravaMaxSpeed: converted.stravaMaxSpeed,
          stravaAverageCadence: converted.stravaAverageCadence,
          stravaSufferScore: converted.stravaSufferScore,
          stravaPerceivedExertion: converted.stravaPerceivedExertion,
          stravaGearId: converted.stravaGearId,
          stravaDeviceName: converted.stravaDeviceName,
          startLatitude: converted.startLatitude ?? 0, // Use 0 as "no GPS" sentinel to mark as processed
          startLongitude: converted.startLongitude ?? 0,
          endLatitude: converted.endLatitude ?? 0,
          endLongitude: converted.endLongitude ?? 0,
          stravaIsTrainer: converted.stravaIsTrainer,
          stravaIsCommute: converted.stravaIsCommute,
          stravaName: converted.stravaName || undefined,
          startTimeLocal: converted.startTimeLocal,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workouts.id, workout.id));

      // Save best efforts if available
      if (activity.best_efforts && activity.best_efforts.length > 0) {
        try {
          await saveBestEfforts(workout.id, activity.best_efforts);
        } catch {
          // Non-critical
        }
      }

      result.updated++;
    } catch (error) {
      console.error(`[stravaRepull] Failed for workout ${workout.id} (strava ${workout.stravaActivityId}):`, error);
      result.failed++;
    }

    // Rate limit between API calls
    await new Promise(r => setTimeout(r, delayMs));
  }

  return result;
}

/** Save Strava best efforts for a workout (delete + re-insert) */
async function saveBestEfforts(workoutId: number, efforts: StravaBestEffortAPI[]) {
  // Delete existing efforts for this workout
  await db.delete(stravaBestEfforts).where(eq(stravaBestEfforts.workoutId, workoutId));

  if (efforts.length === 0) return;

  await db.insert(stravaBestEfforts).values(
    efforts.map(e => ({
      workoutId,
      stravaEffortId: e.id,
      name: e.name,
      distanceMeters: e.distance,
      elapsedTimeSeconds: e.elapsed_time,
      movingTimeSeconds: e.moving_time,
      prRank: e.pr_rank,
    }))
  );
}

/**
 * Backfill best efforts for all workouts that have a Strava activity ID.
 * Fetches detail endpoint for each workout and extracts best_efforts.
 */
export async function backfillBestEfforts(options?: {
  batchSize?: number;
  delayMs?: number;
  profileId?: number;
}): Promise<RepullResult> {
  const batchSize = options?.batchSize ?? 50;
  const delayMs = options?.delayMs ?? 300;
  const result: RepullResult = { total: 0, updated: 0, failed: 0, skipped: 0 };

  const profileId = options?.profileId;
  if (!profileId) return { ...result, failed: -1 };

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });

  if (!settings?.stravaAccessToken || !settings?.stravaRefreshToken) return result;

  let accessToken: string;
  if (settings.stravaTokenExpiresAt && isTokenExpired(settings.stravaTokenExpiresAt)) {
    const newTokens = await refreshStravaToken(decryptToken(settings.stravaRefreshToken));
    await db.update(userSettings).set({
      stravaAccessToken: encryptToken(newTokens.accessToken),
      stravaRefreshToken: encryptToken(newTokens.refreshToken),
      stravaTokenExpiresAt: newTokens.expiresAt,
      updatedAt: new Date().toISOString(),
    }).where(eq(userSettings.id, settings.id));
    accessToken = newTokens.accessToken;
  } else {
    accessToken = decryptToken(settings.stravaAccessToken);
  }

  // Find workouts with Strava IDs that don't yet have best efforts
  const workoutsNeedingEfforts: import('@/lib/schema').Workout[] = await db.query.workouts.findMany({
    where: and(
      isNotNull(workouts.stravaActivityId),
      eq(workouts.profileId, profileId),
    ),
    columns: { id: true, stravaActivityId: true },
    limit: batchSize,
  });

  // Filter to those without any best efforts
  const withEfforts = new Set<number>();
  const existingEfforts = await db.select({ workoutId: stravaBestEfforts.workoutId })
    .from(stravaBestEfforts);
  for (const e of existingEfforts) {
    withEfforts.add(e.workoutId);
  }

  const toProcess = workoutsNeedingEfforts.filter(w => !withEfforts.has(w.id));
  result.total = toProcess.length;

  for (const workout of toProcess) {
    if (!workout.stravaActivityId) { result.skipped++; continue; }

    try {
      const activity = await getStravaActivity(accessToken, workout.stravaActivityId);
      if (activity.best_efforts && activity.best_efforts.length > 0) {
        await saveBestEfforts(workout.id, activity.best_efforts);
        result.updated++;
      } else {
        result.skipped++;
      }
    } catch (error) {
      console.error(`[backfillBestEfforts] Failed for workout ${workout.id}:`, error);
      result.failed++;
    }

    await new Promise(r => setTimeout(r, delayMs));
  }

  return result;
}
