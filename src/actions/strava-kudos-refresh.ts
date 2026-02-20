'use server';

import { db, workouts, userSettings } from '@/lib/db';
import { eq, and, isNotNull, gte, or, isNull, lte } from 'drizzle-orm';
import { getStravaActivity, isTokenExpired, refreshStravaToken } from '@/lib/strava';
import { encryptToken, decryptToken } from '@/lib/token-crypto';

export interface KudosRefreshResult {
  checked: number;
  updated: number;
  failed: number;
}

/**
 * Refresh kudos/comment counts for recent Strava workouts.
 * - Regular workouts: check within 2 days of activity date
 * - Race workouts: check within 5 days of activity date
 * - Only re-checks if stravaKudosLastChecked is NULL or >6 hours old
 * - Max 20 activities per run to stay within Strava rate limits
 */
export async function refreshStravaKudos(options?: {
  maxActivities?: number;
  profileId?: number;
}): Promise<KudosRefreshResult> {
  const maxActivities = options?.maxActivities ?? 20;
  const result: KudosRefreshResult = { checked: 0, updated: 0, failed: 0 };

  // Find all profiles with Strava connections
  const profiles = options?.profileId
    ? await db.query.userSettings.findMany({
        where: and(
          eq(userSettings.profileId, options.profileId),
          isNotNull(userSettings.stravaAccessToken),
        ),
      })
    : await db.query.userSettings.findMany({
        where: isNotNull(userSettings.stravaAccessToken),
      });

  for (const settings of profiles) {
    if (!settings.stravaAccessToken || !settings.stravaRefreshToken || !settings.profileId) continue;

    // Get valid access token
    let accessToken: string;
    try {
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
    } catch {
      continue; // Skip this profile if token refresh fails
    }

    // Date boundaries
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const sixHoursAgo = new Date(now);
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
    const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];
    const sixHoursAgoStr = sixHoursAgo.toISOString();

    // Find eligible workouts:
    // (regular runs within 2 days) OR (races within 5 days)
    // AND kudos last checked is null or >6 hours ago
    const eligibleWorkouts = await db.query.workouts.findMany({
      where: and(
        isNotNull(workouts.stravaActivityId),
        eq(workouts.profileId, settings.profileId),
        or(
          // Regular workouts within 2 days
          gte(workouts.date, twoDaysAgoStr),
          // Race workouts within 5 days
          and(
            eq(workouts.workoutType, 'race'),
            gte(workouts.date, fiveDaysAgoStr),
          ),
        ),
        or(
          isNull(workouts.stravaKudosLastChecked),
          lte(workouts.stravaKudosLastChecked, sixHoursAgoStr),
        ),
      ),
      columns: {
        id: true,
        stravaActivityId: true,
        workoutType: true,
        date: true,
      },
      limit: maxActivities - result.checked,
    });

    for (const workout of eligibleWorkouts) {
      if (result.checked >= maxActivities) break;
      if (!workout.stravaActivityId) continue;

      try {
        const activity = await getStravaActivity(accessToken, workout.stravaActivityId);

        await db.update(workouts)
          .set({
            stravaKudosCount: activity.kudos_count ?? 0,
            stravaCommentCount: activity.comment_count ?? 0,
            stravaKudosLastChecked: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(workouts.id, workout.id));

        result.updated++;
      } catch (error) {
        console.error(`[kudosRefresh] Failed for workout ${workout.id}:`, error);
        result.failed++;
      }

      result.checked++;
      // Rate limit: 300ms between API calls
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return result;
}
