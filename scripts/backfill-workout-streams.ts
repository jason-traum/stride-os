/**
 * One-time stream backfill/recheck for older Strava workouts.
 *
 * Usage:
 *   node --import tsx scripts/backfill-workout-streams.ts
 *   node --import tsx scripts/backfill-workout-streams.ts --profile=1 --from=2023-08-01
 *   node --import tsx scripts/backfill-workout-streams.ts --profile=1 --from=2023-08-01 --force
 */

import { db, userSettings, workouts } from '../src/lib/db';
import { and, asc, eq, gte, isNotNull } from 'drizzle-orm';
import {
  getStravaActivityStreams,
  isTokenExpired,
  refreshStravaToken,
} from '../src/lib/strava';
import {
  cacheWorkoutStreams,
  getCachedWorkoutStreams,
} from '../src/lib/workout-stream-cache';

type CliOptions = {
  profileId: number;
  fromDate: string;
  force: boolean;
  delayMs: number;
  limit?: number;
};

type TargetWorkout = {
  id: number;
  profileId: number | null;
  date: string;
  stravaActivityId: number | null;
  avgHeartRate: number | null;
  maxHr: number | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv: string[]): CliOptions {
  const profileRaw = argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1] || '1';
  const fromDate = argv.find((arg) => arg.startsWith('--from='))?.split('=')[1] || '2023-08-01';
  const delayRaw = argv.find((arg) => arg.startsWith('--delay='))?.split('=')[1] || '250';
  const force = argv.includes('--force');
  const limitRaw = argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1];

  const profileId = Number(profileRaw);
  if (!Number.isFinite(profileId) || profileId <= 0) {
    throw new Error(`Invalid --profile value: ${profileRaw}`);
  }

  const delayMs = Number(delayRaw);
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error(`Invalid --delay value: ${delayRaw}`);
  }

  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limitRaw && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error(`Invalid --limit value: ${limitRaw}`);
  }

  return {
    profileId,
    fromDate,
    force,
    delayMs,
    limit,
  };
}

async function getValidStravaToken(profileId: number): Promise<string> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });

  if (!settings?.stravaAccessToken || !settings.stravaRefreshToken) {
    throw new Error(`No Strava token found for profile ${profileId}`);
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

function toStreamPayload(workout: TargetWorkout, streams: Awaited<ReturnType<typeof getStravaActivityStreams>>) {
  const hrStream = streams.find((s) => s.type === 'heartrate');
  const timeStream = streams.find((s) => s.type === 'time');
  const distanceStream = streams.find((s) => s.type === 'distance');
  const velocityStream = streams.find((s) => s.type === 'velocity_smooth');
  const altitudeStream = streams.find((s) => s.type === 'altitude');
  const cadenceStream = streams.find((s) => s.type === 'cadence');

  if (!timeStream || timeStream.data.length < 2) {
    return null;
  }

  const distanceMiles = distanceStream
    ? distanceStream.data.map((d) => d * 0.000621371)
    : timeStream.data.map((_, i) => i * 0.005);

  const paceSecondsPerMile = velocityStream
    ? velocityStream.data.map((v) => (v > 0 ? 1609.34 / v : 0))
    : [];

  const altitudeFeet = altitudeStream
    ? altitudeStream.data.map((a) => a * 3.28084)
    : [];

  // Strava returns cadence as steps per minute for one foot; multiply by 2 for total spm
  const cadenceSpm = cadenceStream
    ? cadenceStream.data.map((c) => c * 2)
    : [];

  let maxHr = workout.maxHr || workout.avgHeartRate || 185;
  if (hrStream && hrStream.data.length > 0) {
    const streamMax = Math.max(...hrStream.data);
    if (Number.isFinite(streamMax) && streamMax > maxHr) {
      maxHr = streamMax;
    }
  }

  return {
    distance: distanceMiles,
    heartrate: hrStream?.data || [],
    velocity: paceSecondsPerMile,
    altitude: altitudeFeet,
    cadence: cadenceSpm,
    time: timeStream.data,
    maxHr,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('=== Workout Stream Backfill/Recheck ===');
  console.log(`profile=${options.profileId} from=${options.fromDate} force=${options.force} delayMs=${options.delayMs} limit=${options.limit || 'none'}`);

  const accessToken = await getValidStravaToken(options.profileId);

  const rows = await db.query.workouts.findMany({
    where: and(
      eq(workouts.profileId, options.profileId),
      eq(workouts.source, 'strava'),
      gte(workouts.date, options.fromDate),
      isNotNull(workouts.stravaActivityId),
    ),
    columns: {
      id: true,
      profileId: true,
      date: true,
      stravaActivityId: true,
      avgHeartRate: true,
      maxHr: true,
    },
    orderBy: [asc(workouts.date)],
  });

  const targets = options.limit ? rows.slice(0, options.limit) : rows;

  console.log(`eligible_workouts=${rows.length} processing=${targets.length}`);

  let verified = 0;
  let refreshed = 0;
  let missingCached = 0;
  let noStreamData = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const workout = targets[i] as TargetWorkout;

    if (!options.force) {
      const cached = await getCachedWorkoutStreams(workout.id);
      if (cached && cached.data.time.length >= 20 && cached.data.distance.length >= 20) {
        verified++;
        if ((i + 1) % 25 === 0) {
          console.log(`progress=${i + 1}/${targets.length} verified=${verified} refreshed=${refreshed} no_stream=${noStreamData} failed=${failed}`);
        }
        continue;
      }
      if (!cached) missingCached++;
    }

    if (!workout.stravaActivityId) {
      failed++;
      continue;
    }

    const streams = await getStravaActivityStreams(
      accessToken,
      workout.stravaActivityId,
      ['heartrate', 'time', 'distance', 'velocity_smooth', 'altitude', 'cadence']
    );

    const payload = toStreamPayload(workout, streams);
    if (!payload) {
      noStreamData++;
      if ((i + 1) % 25 === 0) {
        console.log(`progress=${i + 1}/${targets.length} verified=${verified} refreshed=${refreshed} no_stream=${noStreamData} failed=${failed}`);
      }
      if (options.delayMs > 0) await sleep(options.delayMs);
      continue;
    }

    const cachedOk = await cacheWorkoutStreams({
      workoutId: workout.id,
      profileId: workout.profileId,
      source: 'strava',
      data: payload,
    });

    if (cachedOk) {
      refreshed++;
    } else {
      failed++;
    }

    if ((i + 1) % 25 === 0) {
      console.log(`progress=${i + 1}/${targets.length} verified=${verified} refreshed=${refreshed} no_stream=${noStreamData} failed=${failed}`);
    }

    if (options.delayMs > 0) await sleep(options.delayMs);
  }

  console.log('--- Done ---');
  console.log(`verified=${verified}`);
  console.log(`refreshed=${refreshed}`);
  console.log(`missing_cached_initially=${missingCached}`);
  console.log(`no_stream_data=${noStreamData}`);
  console.log(`failed=${failed}`);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
