'use server';

import { db } from '@/lib/db';
import { workouts, workoutSegments } from '@/lib/schema';
import { eq, and, desc, gte, inArray } from 'drizzle-orm';

interface PaceDecayData {
  overallDecayRate: number | null;
  byDistance: {
    short: number | null;  // < 5 miles
    medium: number | null; // 5-10 miles
    long: number | null;   // > 10 miles
  };
  byType: {
    easy: number | null;
    tempo: number | null;
    interval: number | null;
    long_run: number | null;
  };
  insights: string[];
  recommendations: string[];
}

interface SplitData {
  distancePercent: number;
  paceSeconds: number;
}

/**
 * Calculate how much pace decays (slows down) throughout runs
 * Returns decay rate as seconds per mile per 10% of run
 */
export async function analyzePaceDecay(profileId: number): Promise<PaceDecayData> {
  try {
    // Get workouts from last 90 days with segment/split data
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const workoutRows = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, ninetyDaysAgo.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(workouts.date));

    // Fetch segments for these workouts
    const workoutIds = workoutRows.map((w) => w.id);
    const allSegments = workoutIds.length > 0
      ? await db
          .select()
          .from(workoutSegments)
          .where(inArray(workoutSegments.workoutId, workoutIds))
      : [];

    // Map segments to workouts (as split format: distancePercent, paceSeconds)
    const segmentsByWorkout = new Map<number, typeof allSegments>();
    allSegments.forEach((seg) => {
      const list = segmentsByWorkout.get(seg.workoutId) || [];
      list.push(seg);
      segmentsByWorkout.set(seg.workoutId, list);
    });

    const recentWorkouts = workoutRows.map((workout) => {
      const segments = (segmentsByWorkout.get(workout.id) || [])
        .sort((a, b) => a.segmentNumber - b.segmentNumber);
      const totalMiles = workout.distanceMiles || segments.reduce((s, seg) => s + (seg.distanceMiles || 0), 0);
      const splits = segments.map((seg, i) => {
        const distMiles = seg.distanceMiles || 0;
        const distancePercent = totalMiles > 0 ? (distMiles / totalMiles) * 100 : 0;
        const paceSeconds = seg.paceSecondsPerMile || (seg.durationSeconds && distMiles > 0
          ? seg.durationSeconds / distMiles
          : 0);
        return { distancePercent, paceSeconds };
      });
      return { workout, splits };
    });

    if (recentWorkouts.length === 0) {
      return {
        overallDecayRate: null,
        byDistance: { short: null, medium: null, long: null },
        byType: { easy: null, tempo: null, interval: null, long_run: null },
        insights: ['No recent workout data available to analyze pace decay.'],
        recommendations: ['Sync workouts from Strava or Garmin to enable pace decay analysis.']
      };
    }

    // Analyze pace decay for each workout
    const decayRates: { [key: string]: number[] } = {
      overall: [],
      short: [],
      medium: [],
      long: [],
      easy: [],
      tempo: [],
      interval: [],
      long_run: []
    };

    for (const { workout, splits: workoutSplits } of recentWorkouts) {
      if (!workoutSplits || workoutSplits.length < 5) continue; // Need enough splits

      // Build cumulative distance percent and use pace data
      const splitData: SplitData[] = [];
      let cumulativePercent = 0;

      for (const split of workoutSplits) {
        if (split.paceSeconds <= 0) continue;
        cumulativePercent += split.distancePercent;
        splitData.push({
          distancePercent: cumulativePercent,
          paceSeconds: split.paceSeconds
        });
      }

      if (splitData.length < 5) continue;

      // Calculate decay rate using linear regression
      const decayRate = calculateDecayRate(splitData);
      if (decayRate === null) continue;

      // Add to overall
      decayRates.overall.push(decayRate);

      // Categorize by distance
      const distanceMiles = workout.distanceMiles || 0;
      if (distanceMiles < 5) {
        decayRates.short.push(decayRate);
      } else if (distanceMiles <= 10) {
        decayRates.medium.push(decayRate);
      } else {
        decayRates.long.push(decayRate);
      }

      // Categorize by type
      if (workout.workoutType && decayRates[workout.workoutType]) {
        decayRates[workout.workoutType].push(decayRate);
      }
    }

    // Calculate averages
    const avgDecayRate = (rates: number[]) =>
      rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

    const result: PaceDecayData = {
      overallDecayRate: avgDecayRate(decayRates.overall),
      byDistance: {
        short: avgDecayRate(decayRates.short),
        medium: avgDecayRate(decayRates.medium),
        long: avgDecayRate(decayRates.long)
      },
      byType: {
        easy: avgDecayRate(decayRates.easy),
        tempo: avgDecayRate(decayRates.tempo),
        interval: avgDecayRate(decayRates.interval),
        long_run: avgDecayRate(decayRates.long_run)
      },
      insights: [],
      recommendations: []
    };

    // Generate insights
    if (result.overallDecayRate !== null) {
      const decayPerMile = result.overallDecayRate * 10; // Convert to per 10%

      if (decayPerMile < 2) {
        result.insights.push('Excellent pacing! You maintain very consistent pace throughout runs.');
      } else if (decayPerMile < 5) {
        result.insights.push('Good pacing control with minimal slowdown during runs.');
      } else if (decayPerMile < 10) {
        result.insights.push('Moderate pace decay - you tend to slow down as runs progress.');
      } else {
        result.insights.push('Significant pace decay detected - you start too fast and slow considerably.');
      }

      // Distance-based insights
      if (result.byDistance.long && result.byDistance.short) {
        const longDecay = result.byDistance.long * 10;
        const shortDecay = result.byDistance.short * 10;

        if (longDecay > shortDecay * 2) {
          result.insights.push('Pace decay is much worse on long runs - consider starting more conservatively.');
        }
      }

      // Type-based insights
      if (result.byType.tempo && result.byType.easy) {
        const tempoDecay = result.byType.tempo * 10;
        const easyDecay = result.byType.easy * 10;

        if (tempoDecay > easyDecay * 1.5) {
          result.insights.push('Tempo runs show more decay than easy runs - you may be starting too aggressively.');
        }
      }
    }

    // Generate recommendations
    if (result.overallDecayRate !== null) {
      const decayPerMile = result.overallDecayRate * 10;

      if (decayPerMile > 5) {
        result.recommendations.push('Start runs 10-15 seconds per mile slower than target pace.');
        result.recommendations.push('Practice negative splits - aim to run the second half slightly faster.');
      }

      if (result.byDistance.long && result.byDistance.long * 10 > 8) {
        result.recommendations.push('For long runs, start at conversational pace and only speed up after warming up.');
      }

      if (result.byType.interval && result.byType.interval * 10 < 3) {
        result.recommendations.push('Your interval pacing is excellent - use this as a model for other workouts.');
      }
    }

    return result;

  } catch (error) {
    console.error('Error analyzing pace decay:', error);
    return {
      overallDecayRate: null,
      byDistance: { short: null, medium: null, long: null },
      byType: { easy: null, tempo: null, interval: null, long_run: null },
      insights: ['Error analyzing pace decay.'],
      recommendations: []
    };
  }
}

/**
 * Calculate decay rate using linear regression
 * Returns seconds per mile per 10% of run distance
 */
function calculateDecayRate(splits: SplitData[]): number | null {
  if (splits.length < 2) return null;

  // Only use splits from 10% to 90% to avoid warm-up/cool-down effects
  const filteredSplits = splits.filter(s => s.distancePercent >= 10 && s.distancePercent <= 90);
  if (filteredSplits.length < 2) return null;

  // Linear regression: pace = m * distance_percent + b
  const n = filteredSplits.length;
  const sumX = filteredSplits.reduce((sum, s) => sum + s.distancePercent, 0);
  const sumY = filteredSplits.reduce((sum, s) => sum + s.paceSeconds, 0);
  const sumXY = filteredSplits.reduce((sum, s) => sum + s.distancePercent * s.paceSeconds, 0);
  const sumX2 = filteredSplits.reduce((sum, s) => sum + s.distancePercent * s.distancePercent, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Return decay rate per 10% of distance
  return slope * 10;
}