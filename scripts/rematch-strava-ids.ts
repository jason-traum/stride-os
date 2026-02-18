/**
 * Repair Strava activity IDs by re-matching workouts to Strava activities.
 * This script only updates stravaActivityId (no lap fetching) to avoid rate-limit loops.
 *
 * Usage:
 *   node --import tsx scripts/rematch-strava-ids.ts --profile=1 --from=2023-08-01
 */

import { db, userSettings, workouts } from '../src/lib/db';
import { and, asc, eq, gte } from 'drizzle-orm';
import {
  getStravaActivities,
  isTokenExpired,
  refreshStravaToken,
  type StravaActivity,
} from '../src/lib/strava';

type CliOptions = {
  profileId: number;
  fromDate: string;
  maxPages: number;
};

const RUN_TYPES = new Set(['Run', 'VirtualRun', 'TrailRun']);

function parseArgs(argv: string[]): CliOptions {
  const profileRaw = argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1] || '1';
  const fromDate = argv.find((arg) => arg.startsWith('--from='))?.split('=')[1] || '2023-08-01';
  const maxPagesRaw = argv.find((arg) => arg.startsWith('--max-pages='))?.split('=')[1] || '25';

  const profileId = Number(profileRaw);
  const maxPages = Number(maxPagesRaw);

  if (!Number.isFinite(profileId) || profileId <= 0) throw new Error(`Invalid --profile: ${profileRaw}`);
  if (!Number.isFinite(maxPages) || maxPages <= 0) throw new Error(`Invalid --max-pages: ${maxPagesRaw}`);

  return { profileId, fromDate, maxPages };
}

async function getValidStravaToken(profileId: number): Promise<string> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });

  if (!settings?.stravaAccessToken || !settings.stravaRefreshToken) {
    throw new Error(`No Strava credentials for profile ${profileId}`);
  }

  if (!isTokenExpired(settings.stravaTokenExpiresAt || 0)) {
    return settings.stravaAccessToken;
  }

  const refreshed = await refreshStravaToken(settings.stravaRefreshToken);
  await db.update(userSettings)
    .set({
      stravaAccessToken: refreshed.accessToken,
      stravaRefreshToken: refreshed.refreshToken,
      stravaTokenExpiresAt: refreshed.expiresAt,
      stravaAthleteId: refreshed.athleteId ?? settings.stravaAthleteId ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userSettings.id, settings.id));

  return refreshed.accessToken;
}

function getWorkoutDateKey(activity: StravaActivity): string {
  return activity.start_date_local.split('T')[0];
}

function computeMatchScore(params: {
  workoutDistance: number;
  workoutDuration: number;
  activityDistanceMiles: number;
  activityDurationMin: number;
}): number {
  const distDiff = Math.abs(params.activityDistanceMiles - params.workoutDistance);
  const durDiff = Math.abs(params.activityDurationMin - params.workoutDuration);
  const distPct = params.workoutDistance > 0 ? distDiff / params.workoutDistance : distDiff;
  const durPct = params.workoutDuration > 0 ? durDiff / params.workoutDuration : durDiff;
  return distPct + durPct;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('=== Strava ID Rematch (ID-only) ===');
  console.log(`profile=${options.profileId} from=${options.fromDate} maxPages=${options.maxPages}`);

  const accessToken = await getValidStravaToken(options.profileId);

  const targets = await db.query.workouts.findMany({
    where: and(
      eq(workouts.profileId, options.profileId),
      eq(workouts.source, 'strava'),
      gte(workouts.date, options.fromDate),
    ),
    columns: {
      id: true,
      date: true,
      distanceMiles: true,
      durationMinutes: true,
      stravaActivityId: true,
    },
    orderBy: [asc(workouts.date)],
  });

  const after = Math.floor(new Date(`${options.fromDate}T00:00:00Z`).getTime() / 1000) - 86400;
  const activities = await getStravaActivities(accessToken, {
    after,
    perPage: 200,
    maxPages: options.maxPages,
  });

  const runActivities = activities.filter((a) => RUN_TYPES.has(a.type) || RUN_TYPES.has(a.sport_type));
  const activityByDate = new Map<string, StravaActivity[]>();
  const allActivityIds = new Set<number>();

  for (const activity of runActivities) {
    const key = getWorkoutDateKey(activity);
    const existing = activityByDate.get(key) || [];
    existing.push(activity);
    activityByDate.set(key, existing);
    allActivityIds.add(activity.id);
  }

  let updated = 0;
  let unchanged = 0;
  let unmatched = 0;
  let staleCurrentId = 0;

  for (const workout of targets) {
    const workoutDate = workout.date;
    const workoutDistance = workout.distanceMiles || 0;
    const workoutDuration = workout.durationMinutes || 0;
    const candidates = activityByDate.get(workoutDate) || [];

    if (workout.stravaActivityId && !allActivityIds.has(workout.stravaActivityId)) {
      staleCurrentId++;
    }

    let best: StravaActivity | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const activityDistanceMiles = candidate.distance / 1609.34;
      const activityDurationMin = candidate.moving_time / 60;

      const distDiff = Math.abs(activityDistanceMiles - workoutDistance);
      const distPct = workoutDistance > 0 ? distDiff / workoutDistance : distDiff;
      const durDiff = Math.abs(activityDurationMin - workoutDuration);
      const durPct = workoutDuration > 0 ? durDiff / workoutDuration : durDiff;

      const distOk = distDiff < 0.3 || distPct < 0.10;
      const durOk = durDiff < 5 || durPct < 0.15;
      if (!distOk || !durOk) continue;

      const score = computeMatchScore({
        workoutDistance,
        workoutDuration,
        activityDistanceMiles,
        activityDurationMin,
      });

      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (!best) {
      unmatched++;
      continue;
    }

    if (workout.stravaActivityId !== best.id) {
      await db.update(workouts)
        .set({ stravaActivityId: best.id })
        .where(eq(workouts.id, workout.id));
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log(`workouts_scanned=${targets.length}`);
  console.log(`strava_runs_fetched=${runActivities.length}`);
  console.log(`current_ids_not_in_fetch_window=${staleCurrentId}`);
  console.log(`updated_ids=${updated}`);
  console.log(`unchanged_ids=${unchanged}`);
  console.log(`unmatched=${unmatched}`);
}

main().catch((error) => {
  console.error('Rematch failed:', error);
  process.exit(1);
});
