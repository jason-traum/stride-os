'use server';

import { db } from '@/lib/db';
import { workouts, workoutSegments } from '@/lib/schema';
import { eq, gte, and, inArray, asc } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

export interface FatigueResistancePoint {
  date: string;
  fatigueResistance: number; // percentage: >100 = negative split, <100 = slowed down
  workoutType: string;
  distanceMiles: number;
}

export interface FatigueResistanceStats {
  average: number;
  averageByType: Record<string, { avg: number; count: number }>;
  trend: 'improving' | 'stable' | 'declining';
  trendSlope: number; // positive = improving (less fadeout over time)
}

export interface FatigueResistanceData {
  timeSeries: FatigueResistancePoint[];
  stats: FatigueResistanceStats;
}

/**
 * Calculate fatigue resistance for a runner's workouts.
 *
 * Fatigue resistance = (avg pace of first 75% of segments / avg pace of last 25%) * 100
 *
 * - Score > 100 = negative split (got faster in last quarter) - great!
 * - Score = 100 = even pacing
 * - Score < 100 = positive split (slowed down) - typical
 *
 * Uses pace in seconds/mile, so lower pace = faster.
 * Formula: first75_pace / last25_pace means:
 *   If last 25% is slower (higher pace number), ratio < 1 => score < 100
 *   If last 25% is faster (lower pace number), ratio > 1 => score > 100
 */
export const getFatigueResistanceData = createProfileAction(
  async (profileId: number, days: number = 365): Promise<FatigueResistanceData> => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get running workouts with meaningful distance (> 2 miles)
    const runWorkouts = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, startDateStr),
          gte(workouts.distanceMiles, 2),
        )
      )
      .orderBy(asc(workouts.date));

    // Filter out non-running workout types
    const nonRunTypes = new Set(['cross_train', 'other']);
    const filteredWorkouts = runWorkouts.filter((w: { workoutType: string }) => !nonRunTypes.has(w.workoutType));

    if (filteredWorkouts.length === 0) {
      return {
        timeSeries: [],
        stats: { average: 0, averageByType: {}, trend: 'stable', trendSlope: 0 },
      };
    }

    // Get all segments for these workouts in one query
    const workoutIds = filteredWorkouts.map((w: { id: number }) => w.id);
    const allSegments = await db
      .select()
      .from(workoutSegments)
      .where(inArray(workoutSegments.workoutId, workoutIds));

    // Group segments by workout
    const segmentsByWorkout = new Map<number, (typeof allSegments)[number][]>();
    for (const seg of allSegments) {
      const list = segmentsByWorkout.get(seg.workoutId) || [];
      list.push(seg);
      segmentsByWorkout.set(seg.workoutId, list);
    }

    // Calculate fatigue resistance for each workout
    const timeSeries: FatigueResistancePoint[] = [];

    for (const workout of filteredWorkouts) {
      const segments = segmentsByWorkout.get(workout.id);
      if (!segments || segments.length < 4) continue;

      // Sort by segment number
      const sorted = [...segments]
        .sort((a, b) => a.segmentNumber - b.segmentNumber)
        .filter(s => s.paceSecondsPerMile && s.paceSecondsPerMile > 0);

      if (sorted.length < 4) continue;

      // Split into first 75% and last 25%
      const splitIndex = Math.floor(sorted.length * 0.75);
      const first75 = sorted.slice(0, splitIndex);
      const last25 = sorted.slice(splitIndex);

      if (first75.length === 0 || last25.length === 0) continue;

      // Calculate weighted average pace (weighted by distance if available, else equal weight)
      const weightedAvgPace = (segs: typeof sorted) => {
        let totalDist = 0;
        let totalTime = 0;
        let hasDistance = false;

        for (const seg of segs) {
          const dist = seg.distanceMiles || 0;
          const pace = seg.paceSecondsPerMile!;

          if (dist > 0) {
            hasDistance = true;
            totalDist += dist;
            totalTime += pace * dist;
          }
        }

        if (hasDistance && totalDist > 0) {
          return totalTime / totalDist;
        }

        // Fallback: simple average
        const paces = segs.map(s => s.paceSecondsPerMile!);
        return paces.reduce((a, b) => a + b, 0) / paces.length;
      };

      const first75Pace = weightedAvgPace(first75);
      const last25Pace = weightedAvgPace(last25);

      if (last25Pace <= 0 || first75Pace <= 0) continue;

      const fatigueResistance = Math.round((first75Pace / last25Pace) * 1000) / 10;

      // Sanity check: reject extreme outliers (likely data issues)
      if (fatigueResistance < 60 || fatigueResistance > 140) continue;

      timeSeries.push({
        date: workout.date,
        fatigueResistance,
        workoutType: workout.workoutType,
        distanceMiles: Math.round((workout.distanceMiles || 0) * 10) / 10,
      });
    }

    // Calculate aggregate stats
    const stats = calculateStats(timeSeries);

    return { timeSeries, stats };
  },
  'getFatigueResistanceData'
);

function calculateStats(timeSeries: FatigueResistancePoint[]): FatigueResistanceStats {
  if (timeSeries.length === 0) {
    return { average: 0, averageByType: {}, trend: 'stable', trendSlope: 0 };
  }

  // Overall average
  const average = Math.round(
    (timeSeries.reduce((sum, d) => sum + d.fatigueResistance, 0) / timeSeries.length) * 10
  ) / 10;

  // Average by workout type
  const byType: Record<string, { total: number; count: number }> = {};
  for (const point of timeSeries) {
    if (!byType[point.workoutType]) {
      byType[point.workoutType] = { total: 0, count: 0 };
    }
    byType[point.workoutType].total += point.fatigueResistance;
    byType[point.workoutType].count += 1;
  }

  const averageByType: Record<string, { avg: number; count: number }> = {};
  for (const [type, data] of Object.entries(byType)) {
    averageByType[type] = {
      avg: Math.round((data.total / data.count) * 10) / 10,
      count: data.count,
    };
  }

  // Trend: simple linear regression on the time series
  let trendSlope = 0;
  let trend: 'improving' | 'stable' | 'declining' = 'stable';

  if (timeSeries.length >= 5) {
    const n = timeSeries.length;
    const xValues = timeSeries.map((_, i) => i);
    const yValues = timeSeries.map(d => d.fatigueResistance);

    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) ** 2;
    }

    trendSlope = denominator !== 0 ? Math.round((numerator / denominator) * 1000) / 1000 : 0;

    // Positive slope = improving (fatigue resistance going up, meaning less fadeout)
    if (trendSlope > 0.05) trend = 'improving';
    else if (trendSlope < -0.05) trend = 'declining';
    else trend = 'stable';
  }

  return { average, averageByType, trend, trendSlope };
}
