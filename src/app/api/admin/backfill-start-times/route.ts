import { NextResponse } from 'next/server';
import { db, workouts, userSettings } from '@/lib/db';
import { eq, and, isNotNull, isNull } from 'drizzle-orm';
import { getStravaActivity, isTokenExpired, refreshStravaToken } from '@/lib/strava';
import { encryptToken, decryptToken } from '@/lib/token-crypto';

export const maxDuration = 300; // 5 minutes

/**
 * Backfill startTimeLocal for all Strava workouts that are missing it.
 * Uses the Strava detail API to fetch start_date_local, then extracts HH:MM.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const profileId = body.profileId;
  const batchSize = body.batchSize ?? 100;
  const delayMs = body.delayMs ?? 200;

  if (!profileId) {
    return NextResponse.json({ error: 'profileId required' }, { status: 400 });
  }

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });

  if (!settings?.stravaAccessToken || !settings?.stravaRefreshToken) {
    return NextResponse.json({ error: 'No Strava tokens' }, { status: 400 });
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

  // Find workouts with stravaActivityId but missing startTimeLocal
  const workoutsToBackfill = await db.query.workouts.findMany({
    where: and(
      isNotNull(workouts.stravaActivityId),
      isNull(workouts.startTimeLocal),
      eq(workouts.profileId, profileId),
    ),
    columns: {
      id: true,
      stravaActivityId: true,
    },
    limit: batchSize,
  });

  const result = { total: workoutsToBackfill.length, updated: 0, failed: 0 };

  for (const workout of workoutsToBackfill) {
    if (!workout.stravaActivityId) continue;

    try {
      const activity = await getStravaActivity(accessToken, workout.stravaActivityId);
      const startTimeLocal = activity.start_date_local?.split('T')[1]?.substring(0, 5) || null;

      if (startTimeLocal) {
        await db.update(workouts)
          .set({ startTimeLocal, updatedAt: new Date().toISOString() })
          .where(eq(workouts.id, workout.id));
        result.updated++;
      }
    } catch (error) {
      console.error(`[backfill-start-times] Failed for workout ${workout.id}:`, error);
      result.failed++;
    }

    await new Promise(r => setTimeout(r, delayMs));
  }

  return NextResponse.json(result);
}
