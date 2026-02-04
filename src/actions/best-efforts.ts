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
 * Get pace curve data (best pace at various distances)
 * Uses actual race/hard effort data + estimates from segment data
 */
export async function getPaceCurve(): Promise<{
  distanceMiles: number;
  distanceLabel: string;
  bestPaceSeconds: number;
  bestTimeSeconds: number;
  date: string;
  workoutId: number;
  isEstimated: boolean;
}[]> {
  const profileId = await getActiveProfileId();

  // Define distance points for the curve
  const distancePoints = [
    { miles: 1, label: '1 mi' },
    { miles: 2, label: '2 mi' },
    { miles: 3.107, label: '5K' },
    { miles: 5, label: '5 mi' },
    { miles: 6.214, label: '10K' },
    { miles: 10, label: '10 mi' },
    { miles: 13.109, label: 'Half' },
    { miles: 26.219, label: 'Marathon' },
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

  // Find reference performances (races, time trials, or fast workouts)
  // These are our "anchor" points for the pace curve
  const referencePerformances: {
    distanceMiles: number;
    paceSeconds: number;
    date: string;
    workoutId: number;
    quality: number; // Higher = more reliable (race > tempo > easy)
  }[] = [];

  // 1. Add race performances (highest quality)
  for (const w of allWorkouts) {
    if (!w.avgPaceSeconds || !w.distanceMiles) continue;

    if (w.workoutType === 'race') {
      referencePerformances.push({
        distanceMiles: w.distanceMiles,
        paceSeconds: w.avgPaceSeconds,
        date: w.date,
        workoutId: w.id,
        quality: 10,
      });
    } else if (w.workoutType === 'tempo' || w.workoutType === 'interval') {
      // Tempo/interval workouts are decent reference points
      referencePerformances.push({
        distanceMiles: w.distanceMiles,
        paceSeconds: w.avgPaceSeconds,
        date: w.date,
        workoutId: w.id,
        quality: 5,
      });
    }
  }

  // 2. Find best mile splits from segments (great for 1mi reference)
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

  // Add best mile split as reference
  if (mileSegments.length > 0) {
    const bestMile = mileSegments[0];
    if (bestMile.paceSecondsPerMile && bestMile.workout) {
      referencePerformances.push({
        distanceMiles: 1,
        paceSeconds: bestMile.paceSecondsPerMile,
        date: bestMile.workout.date,
        workoutId: bestMile.workoutId,
        quality: 8, // Mile splits from real data are reliable
      });
    }
  }

  // 3. Find best 2-mile continuous effort from segments
  // Group segments by workout and find consecutive fast miles
  const segmentsByWorkout = new Map<number, SegmentWithWorkout[]>();
  for (const s of profileSegments) {
    if (!segmentsByWorkout.has(s.workoutId)) {
      segmentsByWorkout.set(s.workoutId, []);
    }
    segmentsByWorkout.get(s.workoutId)!.push(s);
  }

  for (const [workoutId, segs] of Array.from(segmentsByWorkout.entries())) {
    // Sort by segment number
    segs.sort((a, b) => a.segmentNumber - b.segmentNumber);

    // Find best consecutive 2-mile effort
    for (let i = 0; i < segs.length - 1; i++) {
      const seg1 = segs[i];
      const seg2 = segs[i + 1];

      if (!seg1.paceSecondsPerMile || !seg2.paceSecondsPerMile) continue;
      if (!seg1.distanceMiles || !seg2.distanceMiles) continue;

      // Check if both are ~1 mile segments
      if (seg1.distanceMiles >= 0.9 && seg1.distanceMiles <= 1.1 &&
          seg2.distanceMiles >= 0.9 && seg2.distanceMiles <= 1.1) {
        const avgPace = (seg1.paceSecondsPerMile + seg2.paceSecondsPerMile) / 2;
        const workout = seg1.workout;

        if (workout && avgPace > 180 && avgPace < 600) {
          referencePerformances.push({
            distanceMiles: 2,
            paceSeconds: avgPace,
            date: workout.date,
            workoutId: workoutId,
            quality: 7,
          });
        }
      }
    }
  }

  // Now build the pace curve
  const curveData: {
    distanceMiles: number;
    distanceLabel: string;
    bestPaceSeconds: number;
    bestTimeSeconds: number;
    date: string;
    workoutId: number;
    isEstimated: boolean;
  }[] = [];

  for (const point of distancePoints) {
    // First, look for direct matches (within 10%)
    const directMatches = referencePerformances.filter(r =>
      Math.abs(r.distanceMiles - point.miles) <= point.miles * 0.1
    );

    if (directMatches.length > 0) {
      // Use the best direct match (fastest pace, weighted by quality)
      directMatches.sort((a, b) => {
        // Sort by pace, but boost high-quality performances
        const aPaceAdjusted = a.paceSeconds * (1 - (a.quality * 0.01));
        const bPaceAdjusted = b.paceSeconds * (1 - (b.quality * 0.01));
        return aPaceAdjusted - bPaceAdjusted;
      });

      const best = directMatches[0];
      curveData.push({
        distanceMiles: point.miles,
        distanceLabel: point.label,
        bestPaceSeconds: Math.round(best.paceSeconds),
        bestTimeSeconds: Math.round(best.paceSeconds * point.miles),
        date: best.date,
        workoutId: best.workoutId,
        isEstimated: false,
      });
    } else {
      // No direct match - estimate from best reference performance
      // Find best reference that we can extrapolate from
      const validRefs = referencePerformances.filter(r => r.quality >= 5);

      if (validRefs.length > 0) {
        // Find the reference closest in distance for best extrapolation
        let bestEstimate = 999999;
        let bestRef = validRefs[0];

        for (const ref of validRefs) {
          const estimated = estimatePaceAtDistance(ref.paceSeconds, ref.distanceMiles, point.miles);
          // Prefer extrapolations from similar distances
          const distanceRatio = Math.max(ref.distanceMiles / point.miles, point.miles / ref.distanceMiles);
          const adjusted = estimated * (1 + (distanceRatio - 1) * 0.1); // Penalize far extrapolations

          if (adjusted < bestEstimate) {
            bestEstimate = estimated; // Use actual estimate, not adjusted
            bestRef = ref;
          }
        }

        curveData.push({
          distanceMiles: point.miles,
          distanceLabel: point.label,
          bestPaceSeconds: Math.round(bestEstimate),
          bestTimeSeconds: Math.round(bestEstimate * point.miles),
          date: bestRef.date,
          workoutId: bestRef.workoutId,
          isEstimated: true,
        });
      }
    }
  }

  // Sort by distance
  curveData.sort((a, b) => a.distanceMiles - b.distanceMiles);

  // Validate the curve makes sense (pace should increase with distance)
  // Enforce monotonicity - longer distances MUST have slower (higher) paces
  // First pass: forward - ensure each point is at least as slow as the previous
  for (let i = 1; i < curveData.length; i++) {
    if (curveData[i].bestPaceSeconds < curveData[i-1].bestPaceSeconds) {
      // This point is faster than a shorter distance - physiologically impossible
      // Adjust to be slightly slower than the previous point
      const minPace = curveData[i-1].bestPaceSeconds + 2; // At least 2 seconds slower per mile
      curveData[i].bestPaceSeconds = minPace;
      curveData[i].bestTimeSeconds = Math.round(minPace * curveData[i].distanceMiles);
      // Mark as adjusted if it was actual data
      if (!curveData[i].isEstimated) {
        curveData[i].isEstimated = true; // Mark as adjusted since we modified actual data
      }
    }
  }

  // Second pass: backward - ensure shorter distances aren't slower than longer ones
  for (let i = curveData.length - 2; i >= 0; i--) {
    if (curveData[i].bestPaceSeconds > curveData[i+1].bestPaceSeconds) {
      // Shorter distance is slower than longer - adjust the shorter one to be faster
      const maxPace = curveData[i+1].bestPaceSeconds - 2;
      curveData[i].bestPaceSeconds = maxPace;
      curveData[i].bestTimeSeconds = Math.round(maxPace * curveData[i].distanceMiles);
      if (!curveData[i].isEstimated) {
        curveData[i].isEstimated = true;
      }
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
