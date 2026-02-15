'use server';

import { db, workouts } from '@/lib/db';
import { gte, and, eq } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';

export async function debugStravaBackfill(daysBack: number = 30) {
  const profileId = await getActiveProfileId();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // Get ALL workouts in date range
  const allWorkouts = await db.query.workouts.findMany({
    where: and(
      gte(workouts.date, cutoffStr),
      eq(workouts.profileId, profileId)
    ),
    orderBy: workouts.date,
  });

  // Count by status
  const withStravaId = allWorkouts.filter(w => w.stravaActivityId).length;
  const withoutStravaId = allWorkouts.filter(w => !w.stravaActivityId).length;
  const stravaSource = allWorkouts.filter(w => w.source === 'strava').length;
  const manualSource = allWorkouts.filter(w => w.source === 'manual').length;

  // Get sample of workouts without Strava ID
  const unmatchedSample = allWorkouts
    .filter(w => !w.stravaActivityId)
    .slice(0, 5)
    .map(w => ({
      id: w.id,
      date: w.date,
      distance: w.distanceMiles,
      duration: w.durationMinutes,
      source: w.source,
    }));

  return {
    profileId,
    cutoffDate: cutoffStr,
    totalWorkouts: allWorkouts.length,
    withStravaId,
    withoutStravaId,
    bySource: {
      strava: stravaSource,
      manual: manualSource,
      other: allWorkouts.length - stravaSource - manualSource,
    },
    unmatchedSample,
    message: withoutStravaId === 0
      ? 'All workouts already have Strava IDs! Try the "Resync Existing Laps" option.'
      : `Found ${withoutStravaId} workouts to potentially match`,
  };
}