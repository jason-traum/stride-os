/**
 * Performance-Based Pace Model
 *
 * Instead of relying solely on VDOT calculations, this model:
 * 1. Analyzes actual race results and best efforts
 * 2. Weights recent performances more heavily
 * 3. Considers performance consistency
 * 4. Derives pace zones from real-world data
 *
 * This gives a more accurate picture of current fitness than a single VDOT number.
 */

import { db, workouts, raceResults, workoutSegments } from '@/lib/db';
import { eq, desc, gte, and, sql } from 'drizzle-orm';
import { calculateVDOT, calculatePaceZones } from './vdot-calculator';
import { getActiveProfileId } from '@/lib/profile-server';

export interface PerformanceDataPoint {
  date: string;
  distanceMeters: number;
  timeSeconds: number;
  source: 'race' | 'time_trial' | 'workout_segment' | 'best_effort';
  weight: number; // 0-1, based on recency and reliability
  impliedVdot: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface PerformancePaceModel {
  // Core metrics
  estimatedVdot: number;
  vdotConfidence: 'high' | 'medium' | 'low';
  vdotRange: { low: number; high: number };

  // Data quality
  dataPoints: number;
  mostRecentPerformance: string | null;
  oldestPerformance: string | null;

  // Trend
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  trendMagnitude: number | null; // VDOT change per month

  // Derived paces (in seconds per mile)
  paces: {
    easy: { low: number; high: number };
    steady: { low: number; high: number };
    tempo: number;
    threshold: number;
    interval: number;
    repetition: number;
    marathon: number;
    halfMarathon: number;
  };

  // Source breakdown
  sources: {
    races: number;
    timeTrials: number;
    workoutBestEfforts: number;
  };
}

/**
 * Calculate VDOT from a performance (distance in meters, time in seconds)
 */
function calculateVdotFromPerformance(distanceMeters: number, timeSeconds: number): number {
  // Using Daniels' formula approximation
  // VO2 = -4.60 + 0.182258 × (v) + 0.000104 × (v)²
  // where v = velocity in meters per minute

  const velocityMpm = (distanceMeters / timeSeconds) * 60;
  const vo2 = -4.6 + 0.182258 * velocityMpm + 0.000104 * Math.pow(velocityMpm, 2);

  // Oxygen cost adjustment for duration
  const durationMinutes = timeSeconds / 60;
  let pctVO2max: number;

  if (durationMinutes <= 3.5) {
    pctVO2max = 0.8;
  } else if (durationMinutes <= 7) {
    pctVO2max = 0.85;
  } else if (durationMinutes <= 15) {
    pctVO2max = 0.9;
  } else if (durationMinutes <= 30) {
    pctVO2max = 0.93;
  } else if (durationMinutes <= 60) {
    pctVO2max = 0.95;
  } else if (durationMinutes <= 120) {
    pctVO2max = 0.97;
  } else {
    pctVO2max = 0.98;
  }

  const vdot = vo2 / pctVO2max;
  return Math.round(vdot * 10) / 10;
}

/**
 * Get weight for a data point based on recency
 */
function getRecencyWeight(dateStr: string): number {
  const now = new Date();
  const date = new Date(dateStr);
  const daysAgo = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  // Exponential decay with half-life of 90 days
  const halfLife = 90;
  return Math.exp(-0.693 * daysAgo / halfLife);
}

/**
 * Get weight based on data source reliability
 */
function getSourceWeight(source: PerformanceDataPoint['source']): number {
  switch (source) {
    case 'race':
      return 1.0; // Races are most reliable - max effort, measured course
    case 'time_trial':
      return 0.9; // Time trials are nearly as good
    case 'best_effort':
      return 0.6; // Best efforts from workouts are less controlled
    case 'workout_segment':
      return 0.5; // Segments from intervals may not be max effort
    default:
      return 0.5;
  }
}

/**
 * Collect performance data points from various sources
 */
async function collectPerformanceData(
  profileId: number,
  lookbackDays: number = 365
): Promise<PerformanceDataPoint[]> {
  const dataPoints: PerformanceDataPoint[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // 1. Get race results
  const races = await db.query.raceResults.findMany({
    where: and(
      eq(raceResults.profileId, profileId),
      gte(raceResults.date, cutoffStr)
    ),
    orderBy: [desc(raceResults.date)],
  });

  for (const race of races) {
    if (race.distanceMeters && race.finishTimeSeconds) {
      const recencyWeight = getRecencyWeight(race.date);
      const sourceWeight = getSourceWeight('race');
      const impliedVdot = calculateVdotFromPerformance(race.distanceMeters, race.finishTimeSeconds);

      dataPoints.push({
        date: race.date,
        distanceMeters: race.distanceMeters,
        timeSeconds: race.finishTimeSeconds,
        source: 'race',
        weight: recencyWeight * sourceWeight,
        impliedVdot,
        confidence: race.effortLevel === 'all_out' ? 'high' : 'medium',
      });
    }
  }

  // 2. Get workouts marked as time trials or races
  const timeTrialWorkouts = await db.query.workouts.findMany({
    where: and(
      eq(workouts.profileId, profileId),
      gte(workouts.date, cutoffStr),
      sql`(${workouts.workoutType} = 'race' OR ${workouts.notes} LIKE '%time trial%')`
    ),
    orderBy: [desc(workouts.date)],
  });

  for (const workout of timeTrialWorkouts) {
    if (workout.distanceMiles && workout.durationMinutes) {
      const distanceMeters = workout.distanceMiles * 1609.34;
      const timeSeconds = workout.durationMinutes * 60;
      const recencyWeight = getRecencyWeight(workout.date);
      const sourceWeight = getSourceWeight('time_trial');
      const impliedVdot = calculateVdotFromPerformance(distanceMeters, timeSeconds);

      dataPoints.push({
        date: workout.date,
        distanceMeters,
        timeSeconds,
        source: 'time_trial',
        weight: recencyWeight * sourceWeight,
        impliedVdot,
        confidence: 'medium',
      });
    }
  }

  // 3. Get best efforts from interval segments (hard efforts with consistent pacing)
  // Look for workout segments that represent hard efforts
  const hardSegments = await db.query.workoutSegments.findMany({
    where: and(
      gte(workoutSegments.createdAt, cutoffStr),
      sql`${workoutSegments.segmentType} IN ('work', 'steady')`
    ),
    orderBy: [desc(workoutSegments.createdAt)],
    limit: 50,
  });

  // Group segments by workout and find representative efforts
  type SegmentType = typeof hardSegments[number];
  const segmentsByWorkout = new Map<number, SegmentType[]>();
  for (const seg of hardSegments) {
    const existing = segmentsByWorkout.get(seg.workoutId) || [];
    existing.push(seg);
    segmentsByWorkout.set(seg.workoutId, existing);
  }

  for (const entry of Array.from(segmentsByWorkout.entries())) {
    const [workoutId, segments] = entry;
    // For each workout, take the fastest consistent segment
    if (segments.length >= 2) {
      // Sort by pace (fastest first)
      const sorted = segments
        .filter((s: SegmentType): s is SegmentType & { distanceMiles: number; durationSeconds: number } =>
          s.distanceMiles != null && s.durationSeconds != null
        )
        .sort((a: SegmentType, b: SegmentType) => (a.paceSecondsPerMile || 999) - (b.paceSecondsPerMile || 999));

      if (sorted.length > 0) {
        const fastest = sorted[0];
        const distanceMeters = fastest.distanceMiles * 1609.34;
        const timeSeconds = fastest.durationSeconds;

        if (distanceMeters > 400 && timeSeconds > 60) { // Ignore very short segments
          const workout = await db.query.workouts.findFirst({
            where: eq(workouts.id, workoutId),
          });

          if (workout) {
            const recencyWeight = getRecencyWeight(workout.date);
            const sourceWeight = getSourceWeight('workout_segment');
            const impliedVdot = calculateVdotFromPerformance(distanceMeters, timeSeconds);

            dataPoints.push({
              date: workout.date,
              distanceMeters,
              timeSeconds,
              source: 'workout_segment',
              weight: recencyWeight * sourceWeight,
              impliedVdot,
              confidence: 'low',
            });
          }
        }
      }
    }
  }

  return dataPoints;
}

/**
 * Calculate weighted average VDOT from performance data
 */
function calculateWeightedVdot(dataPoints: PerformanceDataPoint[]): {
  vdot: number;
  variance: number;
  confidence: 'high' | 'medium' | 'low';
} {
  if (dataPoints.length === 0) {
    return { vdot: 0, variance: 0, confidence: 'low' };
  }

  // Weighted average
  const totalWeight = dataPoints.reduce((sum, dp) => sum + dp.weight, 0);
  const weightedVdot = dataPoints.reduce((sum, dp) => sum + dp.impliedVdot * dp.weight, 0) / totalWeight;

  // Weighted variance
  const weightedVariance = dataPoints.reduce((sum, dp) => {
    const diff = dp.impliedVdot - weightedVdot;
    return sum + dp.weight * diff * diff;
  }, 0) / totalWeight;

  // Confidence based on data quantity and consistency
  let confidence: 'high' | 'medium' | 'low';
  const stdDev = Math.sqrt(weightedVariance);
  const hasHighQualityData = dataPoints.some(dp => dp.source === 'race' && dp.confidence === 'high');

  if (dataPoints.length >= 3 && hasHighQualityData && stdDev < 2) {
    confidence = 'high';
  } else if (dataPoints.length >= 2 && stdDev < 4) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    vdot: Math.round(weightedVdot * 10) / 10,
    variance: Math.round(weightedVariance * 100) / 100,
    confidence,
  };
}

/**
 * Calculate performance trend over time
 */
function calculateTrend(dataPoints: PerformanceDataPoint[]): {
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  magnitude: number | null;
} {
  if (dataPoints.length < 3) {
    return { trend: 'insufficient_data', magnitude: null };
  }

  // Sort by date
  const sorted = [...dataPoints].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Split into older and newer halves
  const midpoint = Math.floor(sorted.length / 2);
  const olderData = sorted.slice(0, midpoint);
  const newerData = sorted.slice(midpoint);

  const olderAvg = olderData.reduce((sum, dp) => sum + dp.impliedVdot, 0) / olderData.length;
  const newerAvg = newerData.reduce((sum, dp) => sum + dp.impliedVdot, 0) / newerData.length;

  const change = newerAvg - olderAvg;

  // Calculate time span in months
  const oldestDate = new Date(sorted[0].date);
  const newestDate = new Date(sorted[sorted.length - 1].date);
  const monthsSpan = (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const changePerMonth = monthsSpan > 0 ? change / monthsSpan : 0;

  let trend: 'improving' | 'stable' | 'declining';
  if (change > 0.5) {
    trend = 'improving';
  } else if (change < -0.5) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return {
    trend,
    magnitude: Math.round(changePerMonth * 10) / 10,
  };
}

/**
 * Derive pace zones from VDOT with confidence-based ranges
 */
function derivePaces(vdot: number, variance: number): PerformancePaceModel['paces'] {
  const zones = calculatePaceZones(vdot);
  const uncertainty = Math.sqrt(variance);

  // Add uncertainty to create ranges for easy pace
  const easyLow = zones.easy - Math.round(uncertainty * 3); // 3 sec slower per VDOT point
  const easyHigh = zones.easy + Math.round(uncertainty * 3);

  const steadyLow = zones.tempo + 30; // Steady is between easy and tempo
  const steadyHigh = zones.tempo + 60;

  return {
    easy: { low: easyLow, high: easyHigh },
    steady: { low: steadyLow, high: steadyHigh },
    tempo: zones.tempo,
    threshold: zones.threshold,
    interval: zones.interval,
    repetition: zones.repetition,
    marathon: zones.marathon,
    halfMarathon: zones.halfMarathon,
  };
}

/**
 * Build the complete performance-based pace model
 */
export async function buildPerformanceModel(
  profileId?: number
): Promise<PerformancePaceModel> {
  const pid = profileId ?? await getActiveProfileId();

  if (!pid) {
    // Return default model
    return {
      estimatedVdot: 40,
      vdotConfidence: 'low',
      vdotRange: { low: 35, high: 45 },
      dataPoints: 0,
      mostRecentPerformance: null,
      oldestPerformance: null,
      trend: 'insufficient_data',
      trendMagnitude: null,
      paces: derivePaces(40, 25),
      sources: { races: 0, timeTrials: 0, workoutBestEfforts: 0 },
    };
  }

  // Collect data
  const dataPoints = await collectPerformanceData(pid);

  // Calculate weighted VDOT
  const { vdot, variance, confidence } = calculateWeightedVdot(dataPoints);

  // If no data, fall back to user's saved VDOT or default
  const finalVdot = vdot > 0 ? vdot : 40;
  const finalVariance = vdot > 0 ? variance : 25;

  // Calculate trend
  const { trend, magnitude } = calculateTrend(dataPoints);

  // Get date range
  const sortedByDate = [...dataPoints].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const mostRecent = sortedByDate[0]?.date || null;
  const oldest = sortedByDate[sortedByDate.length - 1]?.date || null;

  // Count sources
  const sources = {
    races: dataPoints.filter(dp => dp.source === 'race').length,
    timeTrials: dataPoints.filter(dp => dp.source === 'time_trial').length,
    workoutBestEfforts: dataPoints.filter(dp => dp.source === 'workout_segment' || dp.source === 'best_effort').length,
  };

  // Calculate VDOT range based on variance
  const stdDev = Math.sqrt(finalVariance);
  const vdotRange = {
    low: Math.round((finalVdot - stdDev * 1.5) * 10) / 10,
    high: Math.round((finalVdot + stdDev * 1.5) * 10) / 10,
  };

  return {
    estimatedVdot: finalVdot,
    vdotConfidence: confidence,
    vdotRange,
    dataPoints: dataPoints.length,
    mostRecentPerformance: mostRecent,
    oldestPerformance: oldest,
    trend,
    trendMagnitude: magnitude,
    paces: derivePaces(finalVdot, finalVariance),
    sources,
  };
}

/**
 * Get recommended paces for a specific workout type
 */
export async function getRecommendedPaces(
  workoutType: string,
  profileId?: number
): Promise<{ pace: number; range?: { low: number; high: number }; note: string }> {
  const model = await buildPerformanceModel(profileId);

  switch (workoutType) {
    case 'easy':
    case 'recovery':
      return {
        pace: Math.round((model.paces.easy.low + model.paces.easy.high) / 2),
        range: model.paces.easy,
        note: model.vdotConfidence === 'high'
          ? 'Based on your recent performances'
          : 'Estimated - more race data will improve accuracy',
      };
    case 'steady':
      return {
        pace: Math.round((model.paces.steady.low + model.paces.steady.high) / 2),
        range: model.paces.steady,
        note: 'Aerobic pace, conversational but purposeful',
      };
    case 'tempo':
      return {
        pace: model.paces.tempo,
        note: 'Comfortably hard - sustainable for 40-60 minutes',
      };
    case 'threshold':
      return {
        pace: model.paces.threshold,
        note: 'Lactate threshold - sustainable for 20-30 minutes',
      };
    case 'interval':
      return {
        pace: model.paces.interval,
        note: 'VO2max pace - sustainable for 3-5 minutes with recovery',
      };
    case 'long':
      return {
        pace: model.paces.easy.high,
        range: { low: model.paces.easy.low, high: model.paces.marathon },
        note: 'Start easy, finish at marathon pace if feeling good',
      };
    case 'marathon':
    case 'race':
      return {
        pace: model.paces.marathon,
        note: model.vdotConfidence === 'high'
          ? 'Goal marathon pace based on recent performances'
          : 'Estimated - consider running a tune-up race',
      };
    default:
      return {
        pace: Math.round((model.paces.easy.low + model.paces.easy.high) / 2),
        range: model.paces.easy,
        note: 'Default to easy pace',
      };
  }
}
