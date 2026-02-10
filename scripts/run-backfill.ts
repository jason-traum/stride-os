import { db, workouts, userSettings } from '../src/lib/db';
import { eq, and, isNull, gte } from 'drizzle-orm';
import {
  refreshStravaToken,
  isTokenExpired,
} from '../src/lib/strava';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runBackfill() {
  console.log('Current system time:', new Date().toISOString());
  console.log('Running Strava backfill...\n');

  // Get settings with Strava credentials (profile 1 = Jason)
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, 1),
  });

  if (!settings?.stravaAccessToken || !settings?.stravaRefreshToken) {
    console.error('Strava not connected. Please connect Strava first.');
    process.exit(1);
  }

  // Refresh token if needed
  let token = settings.stravaAccessToken;
  if (isTokenExpired(settings.stravaTokenExpiresAt)) {
    console.log('Refreshing Strava token...');
    const newTokens = await refreshStravaToken(settings.stravaRefreshToken);
    token = newTokens.accessToken;
    await db.update(userSettings)
      .set({
        stravaAccessToken: newTokens.accessToken,
        stravaRefreshToken: newTokens.refreshToken,
        stravaTokenExpiresAt: newTokens.expiresAt,
      })
      .where(eq(userSettings.id, settings.id));
  }

  // Get workouts without Strava IDs
  const workoutsToMatch = await db.query.workouts.findMany({
    where: isNull(workouts.stravaActivityId),
  });

  console.log(`Found ${workoutsToMatch.length} workouts without Strava IDs\n`);

  if (workoutsToMatch.length === 0) {
    console.log('No workouts to backfill!');
    process.exit(0);
  }

  // Fetch ALL Strava activities (paginated, most recent first)
  console.log('Fetching all Strava activities...');
  let allActivities: any[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const activities = await res.json();
    if (!Array.isArray(activities) || activities.length === 0) break;

    // Filter to runs only
    const runs = activities.filter((a: any) => a.type === 'Run');
    allActivities.push(...runs);
    console.log(`  Page ${page}: ${activities.length} activities (${runs.length} runs)`);

    if (activities.length < 200) break;
    page++;
    await sleep(500);
  }

  console.log(`\nTotal Strava runs fetched: ${allActivities.length}`);

  // Build lookup by date for faster matching
  const stravaByDate: Record<string, any[]> = {};
  for (const activity of allActivities) {
    const date = activity.start_date_local.split('T')[0];
    if (!stravaByDate[date]) stravaByDate[date] = [];
    stravaByDate[date].push(activity);
  }

  let matched = 0;
  let elevationUpdated = 0;
  let noMatch = 0;
  const errors: string[] = [];
  const usedStravaIds = new Set<number>();

  // Also collect IDs already used in the database
  const existingStravaIds = await db.query.workouts.findMany({
    columns: { stravaActivityId: true },
    where: eq(workouts.source, 'strava'),
  });
  for (const w of existingStravaIds) {
    if (w.stravaActivityId) usedStravaIds.add(Number(w.stravaActivityId));
  }

  // Try to match each workout
  for (const workout of workoutsToMatch) {
    const workoutDate = workout.date;
    const workoutDistance = workout.distanceMiles || 0;
    const workoutDuration = workout.durationMinutes || 0;

    const candidates = stravaByDate[workoutDate] || [];

    // Find best matching Strava activity
    let bestMatch: any = null;
    let bestDistanceDiff = Infinity;

    for (const activity of candidates) {
      // Skip if already used
      if (usedStravaIds.has(activity.id)) continue;

      const activityDistance = activity.distance / 1609.34; // meters to miles
      const activityDuration = activity.moving_time / 60; // seconds to minutes

      // Distance within 10% or 0.3 miles
      const distanceDiff = Math.abs(activityDistance - workoutDistance);
      const distanceMatch = distanceDiff < 0.3 || (workoutDistance > 0 && distanceDiff / workoutDistance < 0.1);

      // Duration within 20% or 10 minutes
      const durationDiff = Math.abs(activityDuration - workoutDuration);
      const durationMatch = durationDiff < 10 || (workoutDuration > 0 && durationDiff / workoutDuration < 0.2);

      if (distanceMatch && durationMatch && distanceDiff < bestDistanceDiff) {
        bestMatch = activity;
        bestDistanceDiff = distanceDiff;
      }
    }

    if (bestMatch) {
      try {
        const elevationFeet = bestMatch.total_elevation_gain
          ? Math.round(bestMatch.total_elevation_gain * 3.28084)
          : null;

        await db.update(workouts)
          .set({
            stravaActivityId: String(bestMatch.id),
            elevationGainFt: elevationFeet,
          })
          .where(eq(workouts.id, workout.id));

        usedStravaIds.add(bestMatch.id);
        matched++;
        if (elevationFeet) elevationUpdated++;
        console.log(`  ✓ ${workoutDate} ${workoutDistance.toFixed(1)}mi → Strava #${bestMatch.id} (${elevationFeet || 0}ft elev)`);
      } catch (err) {
        errors.push(`Failed to update workout ${workout.id}: ${err}`);
      }
    } else {
      noMatch++;
      if (candidates.length > 0) {
        const candStr = candidates.map((c: any) =>
          `${(c.distance/1609.34).toFixed(1)}mi/${Math.round(c.moving_time/60)}min`
        ).join(', ');
        console.log(`  ✗ ${workoutDate} ${workoutDistance.toFixed(1)}mi/${workoutDuration}min - no match (candidates: ${candStr})`);
      }
    }
  }

  console.log('\n--- Backfill Complete ---');
  console.log(`Matched: ${matched}`);
  console.log(`Elevation updated: ${elevationUpdated}`);
  console.log(`No match found: ${noMatch}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.forEach(e => console.log(`  - ${e}`));
  }

  process.exit(0);
}

runBackfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
