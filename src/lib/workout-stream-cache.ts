import { db, workoutStreams } from '@/lib/db';
import { eq } from 'drizzle-orm';

export interface WorkoutStreamData {
  distance: number[];
  heartrate: number[];
  velocity: number[];
  altitude: number[];
  time: number[];
  maxHr: number;
}

export interface CachedWorkoutStreams {
  data: WorkoutStreamData;
  hasGpsGaps: boolean;
  gpsGapCount: number;
}

function safeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => Number.isFinite(v));
}

function clampToCommonLength(data: WorkoutStreamData): WorkoutStreamData {
  const lengths = [
    data.distance.length,
    data.time.length,
    data.heartrate.length || data.time.length,
    data.velocity.length || data.time.length,
    data.altitude.length || data.time.length,
  ].filter((n) => n > 0);

  const minLen = lengths.length > 0 ? Math.min(...lengths) : 0;
  if (minLen <= 0) {
    return {
      distance: [],
      heartrate: [],
      velocity: [],
      altitude: [],
      time: [],
      maxHr: data.maxHr || 0,
    };
  }

  return {
    distance: data.distance.slice(0, minLen),
    heartrate: data.heartrate.slice(0, minLen),
    velocity: data.velocity.slice(0, minLen),
    altitude: data.altitude.slice(0, minLen),
    time: data.time.slice(0, minLen),
    maxHr: data.maxHr || 0,
  };
}

function computeGpsGapCount(distance: number[], time: number[]): number {
  if (distance.length < 2 || time.length < 2) return 0;

  let gaps = 0;
  for (let i = 1; i < distance.length && i < time.length; i++) {
    const dt = time[i] - time[i - 1];
    const dd = distance[i] - distance[i - 1];
    if (!Number.isFinite(dt) || !Number.isFinite(dd)) continue;
    if (dt > 3) gaps++;
    if (dt > 0 && dd / dt > 0.02) gaps++;
    if (dd < -0.001) gaps++;
  }
  return gaps;
}

export async function getCachedWorkoutStreams(workoutId: number): Promise<CachedWorkoutStreams | null> {
  try {
    const row = await db.query.workoutStreams.findFirst({
      where: eq(workoutStreams.workoutId, workoutId),
    });

    if (!row) return null;

    const data = clampToCommonLength({
      distance: safeNumberArray(JSON.parse(row.distanceMiles)),
      heartrate: safeNumberArray(row.heartrate ? JSON.parse(row.heartrate) : []),
      velocity: safeNumberArray(row.paceSecondsPerMile ? JSON.parse(row.paceSecondsPerMile) : []),
      altitude: safeNumberArray(row.altitudeFeet ? JSON.parse(row.altitudeFeet) : []),
      time: safeNumberArray(JSON.parse(row.timeSeconds)),
      maxHr: row.maxHr || 0,
    });

    if (data.time.length < 2) return null;

    return {
      data,
      hasGpsGaps: !!row.hasGpsGaps,
      gpsGapCount: row.gpsGapCount || 0,
    };
  } catch {
    return null;
  }
}

export async function cacheWorkoutStreams(params: {
  workoutId: number;
  profileId?: number | null;
  source?: string;
  data: WorkoutStreamData;
}): Promise<boolean> {
  try {
    const normalized = clampToCommonLength(params.data);
    if (normalized.time.length < 2) return false;

    const gpsGapCount = computeGpsGapCount(normalized.distance, normalized.time);
    const now = new Date().toISOString();

    const payload = {
      workoutId: params.workoutId,
      profileId: params.profileId ?? null,
      source: params.source || 'strava',
      sampleCount: normalized.time.length,
      distanceMiles: JSON.stringify(normalized.distance),
      timeSeconds: JSON.stringify(normalized.time),
      heartrate: normalized.heartrate.length > 0 ? JSON.stringify(normalized.heartrate) : null,
      paceSecondsPerMile: normalized.velocity.length > 0 ? JSON.stringify(normalized.velocity) : null,
      altitudeFeet: normalized.altitude.length > 0 ? JSON.stringify(normalized.altitude) : null,
      maxHr: normalized.maxHr || null,
      hasGpsGaps: gpsGapCount > 0,
      gpsGapCount,
      updatedAt: now,
    };

    const existing = await db.query.workoutStreams.findFirst({
      where: eq(workoutStreams.workoutId, params.workoutId),
    });

    if (existing) {
      await db.update(workoutStreams)
        .set(payload)
        .where(eq(workoutStreams.workoutId, params.workoutId));
    } else {
      await db.insert(workoutStreams).values({
        ...payload,
        createdAt: now,
      });
    }

    return true;
  } catch {
    return false;
  }
}
