'use server';

import { db } from '@/lib/db';
import { workouts, workoutSegments } from '@/lib/schema';
import { desc, eq, gte, and, inArray } from 'drizzle-orm';
import { analyzeWorkoutsForBestEfforts, type EffortAnalysis } from '@/lib/best-efforts';
import { createProfileAction } from '@/lib/action-utils';

// Map workout segments to the lap format expected by best-efforts lib
function segmentsToLaps(segments: typeof workoutSegments.$inferSelect[]) {
  return segments
    .sort((a, b) => a.segmentNumber - b.segmentNumber)
    .map((seg) => ({
      lapIndex: seg.segmentNumber,
      distanceMeters: (seg.distanceMiles || 0) * 1609.34,
      elapsedTimeSeconds: seg.durationSeconds || (seg.paceSecondsPerMile && seg.distanceMiles
        ? Math.round(seg.paceSecondsPerMile * seg.distanceMiles)
        : 0),
    }));
}

/**
 * Get best efforts analysis for the current user
 */
export const getBestEffortsAnalysis = createProfileAction(
  async (profileId: number, days: number = 365): Promise<EffortAnalysis> => {
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get workouts with lap data
    const recentWorkouts = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, startDateStr)
        )
      )
      .orderBy(desc(workouts.date));

    if (recentWorkouts.length === 0) {
      return {
        bestEfforts: [],
        recentPRs: [],
        notifications: ['No workouts found. Start logging runs to see your best efforts!'],
      };
    }

    // Get all segments for these workouts in one query
    const workoutIds = recentWorkouts.map(w => w.id);
    const allSegments = await db
      .select()
      .from(workoutSegments)
      .where(inArray(workoutSegments.workoutId, workoutIds));

    // Group segments by workout
    const segmentsByWorkout = new Map<number, typeof allSegments>();
    allSegments.forEach(seg => {
      if (workoutIds.includes(seg.workoutId)) {
        const list = segmentsByWorkout.get(seg.workoutId) || [];
        list.push(seg);
        segmentsByWorkout.set(seg.workoutId, list);
      }
    });

    // Prepare data for analysis (map segments to laps format)
    const workoutsWithLaps = recentWorkouts.map(workout => ({
      workout,
      laps: segmentsToLaps(segmentsByWorkout.get(workout.id) || []),
    }));

    // Filter to only workouts that have segment/lap data
    const workoutsWithLapData = workoutsWithLaps.filter(w => w.laps.length > 0);

    if (workoutsWithLapData.length === 0) {
      return {
        bestEfforts: [],
        recentPRs: [],
        notifications: [
          'No lap/segment data found.',
          'Make sure your runs are synced with lap data from Strava or your watch.',
          'Laps are needed to detect efforts within your runs.',
        ],
      };
    }

    // Analyze for best efforts
    const analysis = analyzeWorkoutsForBestEfforts(workoutsWithLapData);

    // Add helpful notifications if no efforts found
    if (analysis.bestEfforts.length === 0) {
      analysis.notifications.push(
        'No standard distance efforts detected yet.',
        'Best efforts are found when you run close to standard distances (400m, 1mi, 5K, etc).',
        'Keep running and we\'ll automatically detect your PRs!'
      );
    } else if (analysis.recentPRs.length === 0) {
      analysis.notifications.push(
        'No recent PRs in the last 30 days.',
        'Time to chase some new personal records!'
      );
    }

    return analysis;
  },
  'getBestEffortsAnalysis'
);

/**
 * Get best efforts as flat array - for race predictor and other consumers
 */
export async function getBestEfforts(days: number = 365): Promise<import('@/lib/best-efforts').BestEffort[]> {
  const result = await getBestEffortsAnalysis(days);
  if (!result.success) return [];
  return result.data.bestEfforts;
}

/**
 * Get best efforts for a specific workout
 */
export const getWorkoutBestEfforts = createProfileAction(
  async (profileId: number, workoutId: number) => {
    // Get the workout
    const workoutResult = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.id, workoutId),
          eq(workouts.profileId, profileId)
        )
      )
      .limit(1);

    if (workoutResult.length === 0) {
      return { efforts: [], nearMisses: [] };
    }

    const workout = workoutResult[0];

    // Get segments for this workout
    const segments = await db
      .select()
      .from(workoutSegments)
      .where(eq(workoutSegments.workoutId, workoutId))
      .orderBy(workoutSegments.segmentNumber);

    const laps = segmentsToLaps(segments);

    if (laps.length === 0) {
      return { efforts: [], nearMisses: [] };
    }

    // Get all-time analysis to compare against
    const allTimeResult = await getBestEffortsAnalysis(365 * 5); // 5 years
    if (!allTimeResult.success) {
      return { efforts: [], nearMisses: [] };
    }

    // Create map of historical bests
    const historicalBests = new Map();
    allTimeResult.data.bestEfforts
      .filter(e => e.rankAllTime === 1)
      .forEach(e => {
        historicalBests.set(e.distance, e);
      });

    // Import functions we need
    const { detectBestEffortsInWorkout, findNearMisses } = await import('@/lib/best-efforts');

    // Detect efforts in this specific workout
    const efforts = detectBestEffortsInWorkout(workout, laps, historicalBests);
    const nearMisses = findNearMisses(workout, laps, historicalBests);

    return { efforts, nearMisses };
  },
  'getWorkoutBestEfforts'
);
