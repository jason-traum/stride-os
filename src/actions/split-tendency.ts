'use server';

import { db } from '@/lib/db';
import { workouts, workoutSegments } from '@/lib/schema';
import { desc, eq, gte, and, inArray } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

// Split classification types
export type SplitType = 'negative_split' | 'positive_split' | 'even_split';

// Per-workout split result
export interface WorkoutSplitData {
  workoutId: number;
  date: string;
  splitType: SplitType;
  differentialSeconds: number; // positive = second half slower (positive split), negative = second half faster (negative split)
  workoutType: string;
  distanceMiles: number;
  firstHalfPace: number; // seconds per mile
  secondHalfPace: number; // seconds per mile
}

// Summary per workout type
export interface SplitTypeSummary {
  workoutType: string;
  negativeCount: number;
  positiveCount: number;
  evenCount: number;
  avgDifferential: number; // average seconds/mile differential (positive = tends to go out too fast)
  totalCount: number;
}

// Full response
export interface SplitTendencyResult {
  workouts: WorkoutSplitData[];
  summaryByType: SplitTypeSummary[];
  overallNegativePct: number;
  overallPositivePct: number;
  overallEvenPct: number;
  totalAnalyzed: number;
}

/**
 * Classify a split differential as negative, positive, or even.
 * Threshold: 5 seconds/mile.
 * differentialSeconds = secondHalfPace - firstHalfPace
 *   positive => second half slower => positive split (went out too fast)
 *   negative => second half faster => negative split (good pacing)
 */
function classifySplit(differentialSeconds: number): SplitType {
  if (differentialSeconds > 5) return 'positive_split';
  if (differentialSeconds < -5) return 'negative_split';
  return 'even_split';
}

/**
 * Get split tendency analysis for all qualifying workouts.
 * Filters to running workouts with 3+ segments and > 2 miles distance.
 */
export const getSplitTendencyData = createProfileAction(
  async (profileId: number, days: number = 365): Promise<SplitTendencyResult> => {
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Non-running workout types to exclude
    const excludeTypes = ['cross_train', 'other'];

    // Get qualifying workouts (running, > 2 miles)
    const qualifyingWorkouts: import('@/lib/schema').Workout[] = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, startDateStr)
        )
      )
      .orderBy(desc(workouts.date));

    // Filter to running workouts with meaningful distance
    const runningWorkouts = qualifyingWorkouts.filter(
      (w: import('@/lib/schema').Workout) => w.distanceMiles && w.distanceMiles > 2 && !excludeTypes.includes(w.workoutType)
    );

    if (runningWorkouts.length === 0) {
      return {
        workouts: [],
        summaryByType: [],
        overallNegativePct: 0,
        overallPositivePct: 0,
        overallEvenPct: 0,
        totalAnalyzed: 0,
      };
    }

    // Get all segments for these workouts in one query
    const workoutIds = runningWorkouts.map((w: import('@/lib/schema').Workout) => w.id);
    const allSegments: import('@/lib/schema').WorkoutSegment[] = await db
      .select()
      .from(workoutSegments)
      .where(inArray(workoutSegments.workoutId, workoutIds));

    // Group segments by workout
    const segmentsByWorkout = new Map<number, import('@/lib/schema').WorkoutSegment[]>();
    allSegments.forEach((seg: import('@/lib/schema').WorkoutSegment) => {
      const list = segmentsByWorkout.get(seg.workoutId) || [];
      list.push(seg);
      segmentsByWorkout.set(seg.workoutId, list);
    });

    // Analyze each workout
    const splitResults: WorkoutSplitData[] = [];

    for (const workout of runningWorkouts) {
      const segments = segmentsByWorkout.get(workout.id);
      if (!segments || segments.length < 3) continue;

      // Sort segments by segment number
      const sorted = [...segments].sort((a, b) => a.segmentNumber - b.segmentNumber);

      // Calculate pace for each segment (need both distance and pace or duration)
      const segmentsWithPace = sorted.filter(s => {
        // Need distance and either pace or duration to calculate pace
        if (!s.distanceMiles || s.distanceMiles <= 0) return false;
        if (s.paceSecondsPerMile && s.paceSecondsPerMile > 0) return true;
        if (s.durationSeconds && s.durationSeconds > 0) return true;
        return false;
      });

      if (segmentsWithPace.length < 3) continue;

      // Get pace per mile for each segment
      const paces = segmentsWithPace.map(s => {
        if (s.paceSecondsPerMile && s.paceSecondsPerMile > 0) {
          return s.paceSecondsPerMile;
        }
        // Calculate from duration / distance
        return Math.round((s.durationSeconds || 0) / (s.distanceMiles || 1));
      });

      // Split into first half and second half
      const midpoint = Math.floor(paces.length / 2);
      const firstHalf = paces.slice(0, midpoint);
      const secondHalf = paces.slice(paces.length - midpoint); // Take from end to handle odd counts

      if (firstHalf.length === 0 || secondHalf.length === 0) continue;

      // Distance-weighted average pace for each half
      const firstHalfDistances = segmentsWithPace.slice(0, midpoint).map(s => s.distanceMiles || 0);
      const secondHalfDistances = segmentsWithPace.slice(paces.length - midpoint).map(s => s.distanceMiles || 0);

      const firstHalfTotalDist = firstHalfDistances.reduce((a, b) => a + b, 0);
      const secondHalfTotalDist = secondHalfDistances.reduce((a, b) => a + b, 0);

      let firstHalfPace: number;
      let secondHalfPace: number;

      if (firstHalfTotalDist > 0 && secondHalfTotalDist > 0) {
        // Distance-weighted average
        firstHalfPace = Math.round(
          firstHalf.reduce((sum, p, i) => sum + p * firstHalfDistances[i], 0) / firstHalfTotalDist
        );
        secondHalfPace = Math.round(
          secondHalf.reduce((sum, p, i) => sum + p * secondHalfDistances[i], 0) / secondHalfTotalDist
        );
      } else {
        // Simple average fallback
        firstHalfPace = Math.round(firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length);
        secondHalfPace = Math.round(secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length);
      }

      const differential = secondHalfPace - firstHalfPace;
      const splitType = classifySplit(differential);

      splitResults.push({
        workoutId: workout.id,
        date: workout.date,
        splitType,
        differentialSeconds: differential,
        workoutType: workout.workoutType,
        distanceMiles: workout.distanceMiles || 0,
        firstHalfPace,
        secondHalfPace,
      });
    }

    // Build summary by workout type
    const typeMap = new Map<string, { neg: number; pos: number; even: number; diffs: number[] }>();

    for (const result of splitResults) {
      const entry = typeMap.get(result.workoutType) || { neg: 0, pos: 0, even: 0, diffs: [] };
      if (result.splitType === 'negative_split') entry.neg++;
      else if (result.splitType === 'positive_split') entry.pos++;
      else entry.even++;
      entry.diffs.push(result.differentialSeconds);
      typeMap.set(result.workoutType, entry);
    }

    const summaryByType: SplitTypeSummary[] = Array.from(typeMap.entries())
      .map(([workoutType, data]) => ({
        workoutType,
        negativeCount: data.neg,
        positiveCount: data.pos,
        evenCount: data.even,
        avgDifferential: Math.round(data.diffs.reduce((a, b) => a + b, 0) / data.diffs.length),
        totalCount: data.neg + data.pos + data.even,
      }))
      .sort((a, b) => b.totalCount - a.totalCount);

    // Overall percentages
    const total = splitResults.length;
    const negCount = splitResults.filter(r => r.splitType === 'negative_split').length;
    const posCount = splitResults.filter(r => r.splitType === 'positive_split').length;
    const evenCount = splitResults.filter(r => r.splitType === 'even_split').length;

    return {
      workouts: splitResults,
      summaryByType,
      overallNegativePct: total > 0 ? Math.round((negCount / total) * 100) : 0,
      overallPositivePct: total > 0 ? Math.round((posCount / total) * 100) : 0,
      overallEvenPct: total > 0 ? Math.round((evenCount / total) * 100) : 0,
      totalAnalyzed: total,
    };
  },
  'getSplitTendencyData'
);
