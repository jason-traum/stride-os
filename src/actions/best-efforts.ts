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
 * Estimate pace at a target distance using Riegel's formula
 * time2 = time1 * (distance2 / distance1) ^ 1.06
 */
function estimatePaceAtDistance(
  knownPace: number,
  knownDistance: number,
  targetDistance: number
): number {
  // Riegel formula: T2 = T1 * (D2/D1)^1.06
  const knownTime = knownPace * knownDistance;
  const estimatedTime = knownTime * Math.pow(targetDistance / knownDistance, 1.06);
  return estimatedTime / targetDistance;
}

/**
 * Calculate equivalent mile pace from a performance (for comparing across distances)
 * Uses inverse Riegel to normalize all performances to 1-mile equivalent
 */
function getEquivalentMilePace(paceSeconds: number, distanceMiles: number): number {
  return estimatePaceAtDistance(paceSeconds, distanceMiles, 1);
}

/**
 * Get pace curve data (best pace at various distances)
 * Shows actual PRs alongside projections calculated from best reference effort
 */
export async function getPaceCurve(): Promise<{
  distanceMiles: number;
  distanceLabel: string;
  bestPaceSeconds: number;      // Projection or actual (whichever is used for bar)
  bestTimeSeconds: number;
  date: string;
  workoutId: number;
  isEstimated: boolean;         // true = projection, false = actual PR
  actualPaceSeconds?: number;   // Actual PR if different from projection
  actualTimeSeconds?: number;
  actualWorkoutId?: number;
  actualDate?: string;
}[]> {
  const profileId = await getActiveProfileId();

  // Define distance points for the curve
  const distancePoints = [
    { miles: 1, label: '1 mi', tolerance: 0.1 },
    { miles: 2, label: '2 mi', tolerance: 0.15 },
    { miles: 3.107, label: '5K', tolerance: 0.15 },
    { miles: 5, label: '5 mi', tolerance: 0.2 },
    { miles: 6.214, label: '10K', tolerance: 0.25 },
    { miles: 10, label: '10 mi', tolerance: 0.3 },
    { miles: 13.109, label: 'Half', tolerance: 0.4 },
    { miles: 26.219, label: 'Marathon', tolerance: 0.5 },
  ];

  const whereCondition = profileId
    ? and(gte(workouts.distanceMiles, 0.9), eq(workouts.profileId, profileId))
    : gte(workouts.distanceMiles, 0.9);

  const allWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  // Get all segments for best mile split analysis
  const segments = await db.query.workoutSegments.findMany({
    with: { workout: true },
  });

  type SegmentWithWorkout = typeof segments[number];
  const profileSegments = profileId
    ? segments.filter((s: SegmentWithWorkout) => s.workout?.profileId === profileId)
    : segments;

  // Step 1: Collect all ACTUAL performances (races and hard efforts)
  // These are PRs we'll show as dots
  const actualPerformances: {
    distanceMiles: number;
    paceSeconds: number;
    timeSeconds: number;
    date: string;
    workoutId: number;
    isRace: boolean;
  }[] = [];

  // Add race performances
  for (const w of allWorkouts) {
    if (!w.avgPaceSeconds || !w.distanceMiles) continue;
    if (w.workoutType === 'race') {
      actualPerformances.push({
        distanceMiles: w.distanceMiles,
        paceSeconds: w.avgPaceSeconds,
        timeSeconds: Math.round(w.avgPaceSeconds * w.distanceMiles),
        date: w.date,
        workoutId: w.id,
        isRace: true,
      });
    }
  }

  // Step 2: Find the BEST reference performance for projections
  // Compare all races using equivalent mile pace (Riegel-normalized)
  // This way a 5:16 mile and a 7:05 marathon can be fairly compared
  let bestReference: {
    distanceMiles: number;
    paceSeconds: number;
    date: string;
    workoutId: number;
  } | null = null;
  let bestEquivalentMilePace = 999999;

  // Find the race that implies the fastest equivalent mile pace
  // Filter out obvious non-competitive efforts (pace > 10:00/mi for races under 10mi)
  for (const perf of actualPerformances) {
    if (perf.isRace) {
      // Skip likely non-competitive races (very slow for the distance)
      if (perf.distanceMiles < 10 && perf.paceSeconds > 600) continue; // > 10:00/mi for short races
      if (perf.distanceMiles >= 10 && perf.paceSeconds > 720) continue; // > 12:00/mi for long races

      const equivMilePace = getEquivalentMilePace(perf.paceSeconds, perf.distanceMiles);
      if (equivMilePace < bestEquivalentMilePace) {
        bestEquivalentMilePace = equivMilePace;
        bestReference = perf;
      }
    }
  }

  // If no race data, use best mile split from segments
  if (!bestReference) {
    const mileSegments = profileSegments
      .filter((s: SegmentWithWorkout) =>
        s.distanceMiles &&
        s.distanceMiles >= 0.95 &&
        s.distanceMiles <= 1.05 &&
        s.paceSecondsPerMile &&
        s.paceSecondsPerMile > 180 &&
        s.paceSecondsPerMile < 600
      )
      .sort((a: SegmentWithWorkout, b: SegmentWithWorkout) =>
        (a.paceSecondsPerMile || 999) - (b.paceSecondsPerMile || 999)
      );

    if (mileSegments.length > 0) {
      const bestMile = mileSegments[0];
      if (bestMile.paceSecondsPerMile && bestMile.workout) {
        bestReference = {
          distanceMiles: 1,
          paceSeconds: bestMile.paceSecondsPerMile,
          date: bestMile.workout.date,
          workoutId: bestMile.workoutId,
        };
      }
    }
  }

  // If still no reference, use best tempo/interval workout
  if (!bestReference) {
    for (const w of allWorkouts) {
      if (!w.avgPaceSeconds || !w.distanceMiles) continue;
      if (w.workoutType === 'tempo' || w.workoutType === 'interval') {
        const equivMilePace = getEquivalentMilePace(w.avgPaceSeconds, w.distanceMiles);
        if (equivMilePace < bestEquivalentMilePace) {
          bestEquivalentMilePace = equivMilePace;
          bestReference = {
            distanceMiles: w.distanceMiles,
            paceSeconds: w.avgPaceSeconds,
            date: w.date,
            workoutId: w.id,
          };
        }
      }
    }
  }

  // Step 3: Build the pace curve with both actuals and projections
  const curveData: {
    distanceMiles: number;
    distanceLabel: string;
    bestPaceSeconds: number;
    bestTimeSeconds: number;
    date: string;
    workoutId: number;
    isEstimated: boolean;
    actualPaceSeconds?: number;
    actualTimeSeconds?: number;
    actualWorkoutId?: number;
    actualDate?: string;
  }[] = [];

  for (const point of distancePoints) {
    // Find actual PR at this distance (if any)
    const actualAtDistance = actualPerformances
      .filter(p => Math.abs(p.distanceMiles - point.miles) <= point.tolerance)
      .sort((a, b) => a.paceSeconds - b.paceSeconds)[0];

    // Calculate projection from best reference
    let projectedPace: number | null = null;
    if (bestReference) {
      projectedPace = Math.round(estimatePaceAtDistance(
        bestReference.paceSeconds,
        bestReference.distanceMiles,
        point.miles
      ));
    }

    if (actualAtDistance && projectedPace) {
      // We have BOTH actual and projection - show projection as bar, actual as dot
      curveData.push({
        distanceMiles: point.miles,
        distanceLabel: point.label,
        bestPaceSeconds: projectedPace,
        bestTimeSeconds: Math.round(projectedPace * point.miles),
        date: bestReference!.date,
        workoutId: bestReference!.workoutId,
        isEstimated: true,
        actualPaceSeconds: actualAtDistance.paceSeconds,
        actualTimeSeconds: actualAtDistance.timeSeconds,
        actualWorkoutId: actualAtDistance.workoutId,
        actualDate: actualAtDistance.date,
      });
    } else if (actualAtDistance) {
      // Only actual, no projection possible
      curveData.push({
        distanceMiles: point.miles,
        distanceLabel: point.label,
        bestPaceSeconds: actualAtDistance.paceSeconds,
        bestTimeSeconds: actualAtDistance.timeSeconds,
        date: actualAtDistance.date,
        workoutId: actualAtDistance.workoutId,
        isEstimated: false,
      });
    } else if (projectedPace && bestReference) {
      // Only projection, no actual
      curveData.push({
        distanceMiles: point.miles,
        distanceLabel: point.label,
        bestPaceSeconds: projectedPace,
        bestTimeSeconds: Math.round(projectedPace * point.miles),
        date: bestReference.date,
        workoutId: bestReference.workoutId,
        isEstimated: true,
      });
    }
  }

  // Sort by distance
  curveData.sort((a, b) => a.distanceMiles - b.distanceMiles);

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
