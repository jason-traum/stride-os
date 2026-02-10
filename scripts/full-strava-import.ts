/**
 * Full Strava Import
 * Fetches ALL Strava activities and imports any that are missing from the database.
 */
import { db, workouts, userSettings } from '../src/lib/db';
import { eq, and } from 'drizzle-orm';
import {
  refreshStravaToken,
  getStravaActivityLaps,
  convertStravaLap,
  classifyLaps,
  isTokenExpired,
} from '../src/lib/strava';
import { saveWorkoutLaps } from '../src/actions/laps';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function convertStravaActivity(activity: any) {
  const distanceMiles = activity.distance / 1609.34;
  const durationMinutes = Math.round(activity.moving_time / 60);
  const avgPaceSeconds = distanceMiles > 0
    ? Math.round(activity.moving_time / distanceMiles)
    : 0;
  const elevationFeet = activity.total_elevation_gain
    ? Math.round(activity.total_elevation_gain * 3.28084)
    : null;

  return {
    date: activity.start_date_local.split('T')[0],
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationMinutes,
    avgPaceSeconds,
    avgHeartRate: activity.average_heartrate || null,
    elevationGainFt: elevationFeet,
    workoutType: classifyWorkoutType(activity),
    notes: activity.name || null,
    routeName: null,
  };
}

function classifyWorkoutType(activity: any): string {
  if (activity.workout_type === 1) return 'race';
  if (activity.workout_type === 3) return 'long';

  const distanceMiles = activity.distance / 1609.34;
  const durationMin = activity.moving_time / 60;

  if (distanceMiles >= 10) return 'long';
  if (distanceMiles <= 3 && durationMin <= 35) return 'recovery';
  return 'easy';
}

async function fullImport() {
  console.log('=== Full Strava Import ===');
  console.log('Time:', new Date().toISOString(), '\n');

  // Get credentials
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, 1),
  });

  if (!settings?.stravaAccessToken || !settings?.stravaRefreshToken) {
    console.error('Strava not connected.');
    process.exit(1);
  }

  let token = settings.stravaAccessToken;
  if (isTokenExpired(settings.stravaTokenExpiresAt)) {
    console.log('Refreshing token...');
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

  // 1. Fetch ALL Strava running activities
  console.log('Fetching all Strava activities...');
  let allRuns: any[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const activities = await res.json();
    if (!Array.isArray(activities) || activities.length === 0) break;

    const runs = activities.filter((a: any) => a.type === 'Run');
    allRuns.push(...runs);
    console.log(`  Page ${page}: ${activities.length} activities (${runs.length} runs)`);

    if (activities.length < 200) break;
    page++;
    await sleep(500);
  }

  console.log(`\nTotal Strava runs: ${allRuns.length}`);

  // 2. Get all existing Strava IDs from database
  const existingWorkouts = await db.query.workouts.findMany({
    columns: { id: true, stravaActivityId: true, date: true, distanceMiles: true },
  });

  const existingStravaIds = new Set(
    existingWorkouts
      .filter(w => w.stravaActivityId)
      .map(w => String(w.stravaActivityId))
  );

  console.log(`Existing workouts in DB: ${existingWorkouts.length}`);
  console.log(`With Strava IDs: ${existingStravaIds.size}`);

  // 3. Find activities not yet in database
  const missing = allRuns.filter(a => !existingStravaIds.has(String(a.id)));
  console.log(`\nMissing from database: ${missing.length} activities\n`);

  if (missing.length === 0) {
    console.log('Everything is synced!');
    process.exit(0);
  }

  // 4. Check for potential duplicates by date+distance
  let imported = 0;
  let skipped = 0;
  let linkedExisting = 0;
  const errors: string[] = [];

  // Build lookup of existing workouts by date
  const existingByDate: Record<string, typeof existingWorkouts> = {};
  for (const w of existingWorkouts) {
    if (!existingByDate[w.date]) existingByDate[w.date] = [];
    existingByDate[w.date].push(w);
  }

  for (const activity of missing) {
    const data = convertStravaActivity(activity);

    // Check if a workout exists on this date with similar distance (no Strava ID)
    const sameDayWorkouts = existingByDate[data.date] || [];
    const possibleMatch = sameDayWorkouts.find(w => {
      if (w.stravaActivityId) return false; // Already linked
      const distDiff = Math.abs((w.distanceMiles || 0) - data.distanceMiles);
      return distDiff < 0.3 || (data.distanceMiles > 0 && distDiff / data.distanceMiles < 0.1);
    });

    if (possibleMatch) {
      // Link existing workout to Strava
      try {
        await db.update(workouts)
          .set({
            stravaActivityId: String(activity.id),
            elevationGainFt: data.elevationGainFt,
            source: 'strava',
          })
          .where(eq(workouts.id, possibleMatch.id));
        possibleMatch.stravaActivityId = String(activity.id); // Mark as used
        linkedExisting++;
        console.log(`  ↔ Linked: ${data.date} ${data.distanceMiles}mi → Strava #${activity.id}`);
      } catch (err) {
        errors.push(`Link failed for ${data.date}: ${err}`);
      }
      continue;
    }

    // Import as new workout
    try {
      const insertResult = await db.insert(workouts).values({
        profileId: settings.profileId,
        date: data.date,
        distanceMiles: data.distanceMiles,
        durationMinutes: data.durationMinutes,
        avgPaceSeconds: data.avgPaceSeconds,
        workoutType: data.workoutType,
        notes: data.notes,
        source: 'strava',
        stravaActivityId: String(activity.id),
        avgHeartRate: data.avgHeartRate,
        elevationGainFt: data.elevationGainFt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).returning({ id: workouts.id });

      const newId = insertResult[0]?.id;

      // Try to fetch laps
      if (newId) {
        try {
          const stravaLaps = await getStravaActivityLaps(token, String(activity.id));
          if (stravaLaps.length > 0) {
            const convertedLaps = classifyLaps(stravaLaps.map(convertStravaLap));
            await saveWorkoutLaps(newId, convertedLaps);
          }
        } catch {
          // Skip laps on error (rate limiting etc)
        }
      }

      imported++;
      console.log(`  + Import: ${data.date} ${data.distanceMiles}mi ${data.workoutType} (${data.elevationGainFt || 0}ft) → #${newId}`);

      // Rate limit - Strava allows ~100 requests per 15 min
      await sleep(300);
    } catch (err) {
      errors.push(`Import failed for ${data.date} ${data.distanceMiles}mi: ${err}`);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`New workouts imported: ${imported}`);
  console.log(`Linked to existing: ${linkedExisting}`);
  console.log(`Skipped: ${skipped}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  }

  process.exit(0);
}

fullImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
