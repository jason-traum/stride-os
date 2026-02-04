'use server';

import { db, workouts, workoutSegments } from '@/lib/db';
import { desc, gte, and, eq } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import type { Workout, WorkoutSegment } from '@/lib/schema';

// Standard distances in miles
const STANDARD_DISTANCES = [
  { name: '1 Mile', miles: 1, tolerance: 0.05 },
  { name: '5K', miles: 3.107, tolerance: 0.1 },
  { name: '10K', miles: 6.214, tolerance: 0.15 },
  { name: 'Half Marathon', miles: 13.109, tolerance: 0.2 },
  { name: 'Marathon', miles: 26.219, tolerance: 0.3 },
];

export interface BestEffort {
  distance: string;
  distanceMiles: number;
  paceSeconds: number;
  timeSeconds: number;
  date: string;
  workoutId: number;
  isRace: boolean;
}

export interface WorkoutRanking {
  distance: string;
  rank: number;
  totalEfforts: number;
  isBest: boolean;
  bestPaceSeconds: number;
  currentPaceSeconds: number;
  percentFromBest: number;
}

/**
 * Get best efforts for standard distances
 */
export async function getBestEfforts(): Promise<BestEffort[]> {
  const profileId = await getActiveProfileId();
  const whereCondition = profileId
    ? and(gte(workouts.distanceMiles, 0.9), eq(workouts.profileId, profileId))
    : gte(workouts.distanceMiles, 0.9);

  const allWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  const bestEfforts: BestEffort[] = [];

  for (const dist of STANDARD_DISTANCES) {
    // Find workouts that match this distance (within tolerance)
    const matchingWorkouts = allWorkouts.filter((w: Workout) => {
      if (!w.distanceMiles || !w.avgPaceSeconds) return false;
      const diff = Math.abs(w.distanceMiles - dist.miles);
      return diff <= dist.tolerance;
    });

    if (matchingWorkouts.length === 0) continue;

    // Sort by pace (fastest first)
    matchingWorkouts.sort((a: Workout, b: Workout) => (a.avgPaceSeconds || 999) - (b.avgPaceSeconds || 999));

    const best = matchingWorkouts[0];
    if (best.avgPaceSeconds && best.distanceMiles) {
      bestEfforts.push({
        distance: dist.name,
        distanceMiles: best.distanceMiles,
        paceSeconds: best.avgPaceSeconds,
        timeSeconds: Math.round(best.avgPaceSeconds * best.distanceMiles),
        date: best.date,
        workoutId: best.id,
        isRace: best.workoutType === 'race',
      });
    }
  }

  return bestEfforts;
}

/**
 * Get best mile splits from all workouts (from lap data)
 */
export async function getBestMileSplits(limit: number = 10): Promise<{
  paceSeconds: number;
  workoutId: number;
  date: string;
  lapNumber: number;
}[]> {
  const profileId = await getActiveProfileId();

  // Get all segments that are approximately 1 mile
  const segments = await db.query.workoutSegments.findMany({
    where: and(
      gte(workoutSegments.distanceMiles, 0.9),
    ),
    with: {
      workout: true,
    },
    orderBy: [workoutSegments.paceSecondsPerMile],
  });

  // Filter by profile if active
  type SegmentWithWorkout = typeof segments[number];
  const profileFilteredSegments = profileId
    ? segments.filter((s: SegmentWithWorkout) => s.workout?.profileId === profileId)
    : segments;

  // Filter to ~1 mile segments and sort by pace
  const mileSegments = profileFilteredSegments
    .filter((s: SegmentWithWorkout) => s.distanceMiles && s.distanceMiles >= 0.9 && s.distanceMiles <= 1.1)
    .filter((s: SegmentWithWorkout) => s.paceSecondsPerMile && s.paceSecondsPerMile > 180 && s.paceSecondsPerMile < 900) // Reasonable paces
    .sort((a: SegmentWithWorkout, b: SegmentWithWorkout) => (a.paceSecondsPerMile || 999) - (b.paceSecondsPerMile || 999))
    .slice(0, limit);

  return mileSegments.map((s: SegmentWithWorkout) => ({
    paceSeconds: s.paceSecondsPerMile || 0,
    workoutId: s.workoutId,
    date: s.workout?.date || '',
    lapNumber: s.segmentNumber,
  }));
}

/**
 * Get ranking for a specific workout compared to others at similar distance
 */
export async function getWorkoutRanking(workoutId: number): Promise<WorkoutRanking | null> {
  const profileId = await getActiveProfileId();

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || !workout.distanceMiles || !workout.avgPaceSeconds) {
    return null;
  }

  // Find the closest standard distance
  let closestDist = STANDARD_DISTANCES[0];
  let minDiff = Math.abs(workout.distanceMiles - closestDist.miles);

  for (const dist of STANDARD_DISTANCES) {
    const diff = Math.abs(workout.distanceMiles - dist.miles);
    if (diff < minDiff) {
      minDiff = diff;
      closestDist = dist;
    }
  }

  // Only rank if within tolerance
  if (minDiff > closestDist.tolerance * 2) {
    return null;
  }

  // Get all workouts at this distance
  const whereCondition = profileId
    ? and(gte(workouts.distanceMiles, closestDist.miles - closestDist.tolerance), eq(workouts.profileId, profileId))
    : gte(workouts.distanceMiles, closestDist.miles - closestDist.tolerance);

  const similarWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
  });

  const validWorkouts = similarWorkouts
    .filter((w: Workout) => {
      if (!w.distanceMiles || !w.avgPaceSeconds) return false;
      const diff = Math.abs(w.distanceMiles - closestDist.miles);
      return diff <= closestDist.tolerance;
    })
    .sort((a: Workout, b: Workout) => (a.avgPaceSeconds || 999) - (b.avgPaceSeconds || 999));

  if (validWorkouts.length === 0) return null;

  const rank = validWorkouts.findIndex(w => w.id === workoutId) + 1;
  const best = validWorkouts[0];
  const percentFromBest = best.avgPaceSeconds
    ? Math.round(((workout.avgPaceSeconds - best.avgPaceSeconds) / best.avgPaceSeconds) * 100 * 10) / 10
    : 0;

  return {
    distance: closestDist.name,
    rank,
    totalEfforts: validWorkouts.length,
    isBest: rank === 1,
    bestPaceSeconds: best.avgPaceSeconds || 0,
    currentPaceSeconds: workout.avgPaceSeconds,
    percentFromBest,
  };
}

/**
 * Get pace curve data (best pace at various distances)
 */
export async function getPaceCurve(): Promise<{
  distanceMiles: number;
  distanceLabel: string;
  bestPaceSeconds: number;
  bestTimeSeconds: number;
  date: string;
  workoutId: number;
}[]> {
  const profileId = await getActiveProfileId();

  // Define distance points for the curve
  const distancePoints = [
    { miles: 1, label: '1 mi' },
    { miles: 2, label: '2 mi' },
    { miles: 3.107, label: '5K' },
    { miles: 4, label: '4 mi' },
    { miles: 5, label: '5 mi' },
    { miles: 6.214, label: '10K' },
    { miles: 8, label: '8 mi' },
    { miles: 10, label: '10 mi' },
    { miles: 13.109, label: 'Half' },
    { miles: 15, label: '15 mi' },
    { miles: 18, label: '18 mi' },
    { miles: 20, label: '20 mi' },
    { miles: 26.219, label: 'Marathon' },
  ];

  const whereCondition = profileId
    ? and(gte(workouts.distanceMiles, 0.9), eq(workouts.profileId, profileId))
    : gte(workouts.distanceMiles, 0.9);

  const allWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  const curveData: {
    distanceMiles: number;
    distanceLabel: string;
    bestPaceSeconds: number;
    bestTimeSeconds: number;
    date: string;
    workoutId: number;
  }[] = [];

  for (const point of distancePoints) {
    // Find workouts at or longer than this distance
    const eligibleWorkouts = allWorkouts.filter(w =>
      w.distanceMiles && w.distanceMiles >= point.miles * 0.95 && w.avgPaceSeconds
    );

    if (eligibleWorkouts.length === 0) continue;

    // For each workout, calculate what the pace would be for this distance
    // (use actual pace for exact matches, or estimate for longer runs)
    let bestForDistance: typeof allWorkouts[0] | null = null;
    let bestPace = 999999;

    for (const w of eligibleWorkouts) {
      if (!w.avgPaceSeconds || !w.distanceMiles) continue;

      // If workout is close to target distance, use actual pace
      if (Math.abs(w.distanceMiles - point.miles) <= point.miles * 0.1) {
        if (w.avgPaceSeconds < bestPace) {
          bestPace = w.avgPaceSeconds;
          bestForDistance = w;
        }
      }
    }

    if (bestForDistance && bestForDistance.avgPaceSeconds) {
      curveData.push({
        distanceMiles: point.miles,
        distanceLabel: point.label,
        bestPaceSeconds: bestForDistance.avgPaceSeconds,
        bestTimeSeconds: Math.round(bestForDistance.avgPaceSeconds * point.miles),
        date: bestForDistance.date,
        workoutId: bestForDistance.id,
      });
    }
  }

  return curveData;
}

/**
 * Check if current workout set any new bests
 */
export async function checkForNewBests(workoutId: number): Promise<{
  isNewBest: boolean;
  distance?: string;
  previousBestPace?: number;
  newBestPace?: number;
}> {
  const profileId = await getActiveProfileId();

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || !workout.distanceMiles || !workout.avgPaceSeconds) {
    return { isNewBest: false };
  }

  // Find matching standard distance
  for (const dist of STANDARD_DISTANCES) {
    const diff = Math.abs(workout.distanceMiles - dist.miles);
    if (diff <= dist.tolerance) {
      // Get all other workouts at this distance
      const whereCondition = profileId
        ? and(gte(workouts.distanceMiles, dist.miles - dist.tolerance), eq(workouts.profileId, profileId))
        : gte(workouts.distanceMiles, dist.miles - dist.tolerance);

      const others = await db.query.workouts.findMany({
        where: whereCondition,
      });

      const validOthers = others
        .filter(w => w.id !== workoutId)
        .filter(w => {
          if (!w.distanceMiles || !w.avgPaceSeconds) return false;
          return Math.abs(w.distanceMiles - dist.miles) <= dist.tolerance;
        })
        .sort((a, b) => (a.avgPaceSeconds || 999) - (b.avgPaceSeconds || 999));

      if (validOthers.length === 0) {
        // First effort at this distance
        return {
          isNewBest: true,
          distance: dist.name,
          newBestPace: workout.avgPaceSeconds,
        };
      }

      const previousBest = validOthers[0];
      if (previousBest.avgPaceSeconds && workout.avgPaceSeconds < previousBest.avgPaceSeconds) {
        return {
          isNewBest: true,
          distance: dist.name,
          previousBestPace: previousBest.avgPaceSeconds,
          newBestPace: workout.avgPaceSeconds,
        };
      }

      return { isNewBest: false };
    }
  }

  return { isNewBest: false };
}
