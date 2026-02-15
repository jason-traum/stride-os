'use server';

import { db } from '@/lib/db';
import { workouts, workoutSegments } from '@/lib/schema';
import { desc, eq, gte, and, inArray } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { analyzeWorkoutsForBestEfforts, type EffortAnalysis } from '@/lib/best-efforts';

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
export async function getBestEffortsAnalysis(days: number = 365): Promise<EffortAnalysis | null> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      console.log('[getBestEffortsAnalysis] No active profile');
      return null;
    }

    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get workouts with lap data
    console.log(`[getBestEffortsAnalysis] Fetching workouts since ${startDateStr}`);
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

    console.log(`[getBestEffortsAnalysis] Found ${recentWorkouts.length} workouts`);

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

    console.log(`[getBestEffortsAnalysis] Found ${allSegments.length} total segments`);

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
    console.log(`[getBestEffortsAnalysis] ${workoutsWithLapData.length} workouts have lap data`);

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

    console.log(`[getBestEffortsAnalysis] Found ${analysis.bestEfforts.length} best efforts`);
    return analysis;

  } catch (error) {
    console.error('[getBestEffortsAnalysis] Error:', error);
    return null;
  }
}

/**
 * Get best efforts as flat array - for race predictor and other consumers
 */
export async function getBestEfforts(days: number = 365): Promise<import('@/lib/best-efforts').BestEffort[]> {
  const analysis = await getBestEffortsAnalysis(days);
  if (!analysis) return [];
  return analysis.bestEfforts;
}

/**
 * Get best efforts for a specific workout
 */
export async function getWorkoutBestEfforts(workoutId: number): Promise<{
  efforts: any[];
  nearMisses: any[];
} | null> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) return null;

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

    if (workoutResult.length === 0) return null;

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
    const allTimeAnalysis = await getBestEffortsAnalysis(365 * 5); // 5 years
    if (!allTimeAnalysis) {
      return { efforts: [], nearMisses: [] };
    }

    // Create map of historical bests
    const historicalBests = new Map();
    allTimeAnalysis.bestEfforts
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

  } catch (error) {
    console.error('[getWorkoutBestEfforts] Error:', error);
    return null;
  }
}