'use server';

import { db, workouts, workoutSegments } from '@/lib/db';
import { eq, and, gte, desc } from 'drizzle-orm';
import { parseLocalDate } from '@/lib/utils';

export interface WorkoutComparison {
  workout1: WorkoutSummary;
  workout2: WorkoutSummary;
  differences: {
    metric: string;
    value1: string | number;
    value2: string | number;
    diff: number;
    diffPct: number;
    better: 1 | 2 | 0;
    label: string;
  }[];
  lapComparison?: {
    lap: number;
    pace1: number | null;
    pace2: number | null;
    diff: number | null;
  }[];
}

export interface WorkoutSummary {
  id: number;
  date: string;
  name: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPaceSeconds: number | null;
  elevationGainFeet: number | null;
  avgHeartRate: number | null;
  workoutType: string;
  weatherTempF: number | null;
}

export interface SimilarWorkout {
  id: number;
  date: string;
  name: string;
  distanceMiles: number;
  avgPaceSeconds: number | null;
  similarity: number; // 0-100
}

/**
 * Compare two workouts
 */
export async function compareWorkouts(
  id1: number,
  id2: number
): Promise<WorkoutComparison | null> {
  const [w1, w2] = await Promise.all([
    db.query.workouts.findFirst({ where: eq(workouts.id, id1) }),
    db.query.workouts.findFirst({ where: eq(workouts.id, id2) }),
  ]);

  if (!w1 || !w2) return null;

  const workout1: WorkoutSummary = {
    id: w1.id,
    date: w1.date,
    name: w1.name || 'Workout',
    distanceMiles: w1.distanceMiles || 0,
    durationMinutes: w1.durationMinutes || 0,
    avgPaceSeconds: w1.avgPaceSeconds,
    elevationGainFeet: w1.elevationGainFeet,
    avgHeartRate: w1.avgHeartRate,
    workoutType: w1.workoutType || 'easy',
    weatherTempF: w1.weatherTempF,
  };

  const workout2: WorkoutSummary = {
    id: w2.id,
    date: w2.date,
    name: w2.name || 'Workout',
    distanceMiles: w2.distanceMiles || 0,
    durationMinutes: w2.durationMinutes || 0,
    avgPaceSeconds: w2.avgPaceSeconds,
    elevationGainFeet: w2.elevationGainFeet,
    avgHeartRate: w2.avgHeartRate,
    workoutType: w2.workoutType || 'easy',
    weatherTempF: w2.weatherTempF,
  };

  const differences: WorkoutComparison['differences'] = [];

  // Distance
  if (workout1.distanceMiles > 0 && workout2.distanceMiles > 0) {
    const diff = workout1.distanceMiles - workout2.distanceMiles;
    const diffPct = (diff / workout2.distanceMiles) * 100;
    differences.push({
      metric: 'distance',
      value1: workout1.distanceMiles,
      value2: workout2.distanceMiles,
      diff: Math.round(diff * 100) / 100,
      diffPct: Math.round(diffPct * 10) / 10,
      better: diff > 0 ? 1 : diff < 0 ? 2 : 0,
      label: 'Distance (mi)',
    });
  }

  // Duration
  if (workout1.durationMinutes > 0 && workout2.durationMinutes > 0) {
    const diff = workout1.durationMinutes - workout2.durationMinutes;
    const diffPct = (diff / workout2.durationMinutes) * 100;
    differences.push({
      metric: 'duration',
      value1: workout1.durationMinutes,
      value2: workout2.durationMinutes,
      diff: Math.round(diff),
      diffPct: Math.round(diffPct * 10) / 10,
      better: 0, // Longer isn't necessarily better
      label: 'Duration (min)',
    });
  }

  // Pace (lower is better)
  if (workout1.avgPaceSeconds && workout2.avgPaceSeconds) {
    const diff = workout1.avgPaceSeconds - workout2.avgPaceSeconds;
    const diffPct = (diff / workout2.avgPaceSeconds) * 100;
    differences.push({
      metric: 'pace',
      value1: workout1.avgPaceSeconds,
      value2: workout2.avgPaceSeconds,
      diff: Math.round(diff),
      diffPct: Math.round(diffPct * 10) / 10,
      better: diff < 0 ? 1 : diff > 0 ? 2 : 0,
      label: 'Avg Pace (sec/mi)',
    });
  }

  // Elevation
  if (workout1.elevationGainFeet && workout2.elevationGainFeet) {
    const diff = workout1.elevationGainFeet - workout2.elevationGainFeet;
    const diffPct = (diff / workout2.elevationGainFeet) * 100;
    differences.push({
      metric: 'elevation',
      value1: workout1.elevationGainFeet,
      value2: workout2.elevationGainFeet,
      diff: Math.round(diff),
      diffPct: Math.round(diffPct * 10) / 10,
      better: 0,
      label: 'Elevation (ft)',
    });
  }

  // Heart Rate (lower at same pace is better, but context matters)
  if (workout1.avgHeartRate && workout2.avgHeartRate) {
    const diff = workout1.avgHeartRate - workout2.avgHeartRate;
    const diffPct = (diff / workout2.avgHeartRate) * 100;
    differences.push({
      metric: 'heartRate',
      value1: workout1.avgHeartRate,
      value2: workout2.avgHeartRate,
      diff: Math.round(diff),
      diffPct: Math.round(diffPct * 10) / 10,
      better: 0,
      label: 'Avg HR (bpm)',
    });
  }

  // Get lap data for comparison
  const [laps1, laps2] = await Promise.all([
    db.query.workoutSegments.findMany({
      where: eq(workoutSegments.workoutId, id1),
      orderBy: [workoutSegments.segmentNumber],
    }),
    db.query.workoutSegments.findMany({
      where: eq(workoutSegments.workoutId, id2),
      orderBy: [workoutSegments.segmentNumber],
    }),
  ]);

  let lapComparison: WorkoutComparison['lapComparison'] | undefined;

  if (laps1.length > 0 && laps2.length > 0) {
    const maxLaps = Math.max(laps1.length, laps2.length);
    lapComparison = [];

    for (let i = 0; i < maxLaps; i++) {
      const l1 = laps1[i];
      const l2 = laps2[i];
      const pace1 = l1?.paceSecondsPerMile || null;
      const pace2 = l2?.paceSecondsPerMile || null;

      lapComparison.push({
        lap: i + 1,
        pace1,
        pace2,
        diff: pace1 && pace2 ? pace1 - pace2 : null,
      });
    }
  }

  return {
    workout1,
    workout2,
    differences,
    lapComparison,
  };
}

/**
 * Find similar workouts to a given workout
 */
export async function findSimilarWorkouts(
  workoutId: number,
  limit: number = 5
): Promise<SimilarWorkout[]> {
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || !workout.distanceMiles) return [];

  // Find workouts with similar distance (within 15%)
  const minDist = workout.distanceMiles * 0.85;
  const maxDist = workout.distanceMiles * 1.15;

  const similar = await db.query.workouts.findMany({
    where: and(
      gte(workouts.distanceMiles, minDist),
    ),
    orderBy: [desc(workouts.date)],
    limit: 50,
  });

  // Calculate similarity score and filter
  const results: SimilarWorkout[] = similar
    .filter(w => w.id !== workoutId && w.distanceMiles && w.distanceMiles <= maxDist)
    .map(w => {
      // Distance similarity (50% weight)
      const distDiff = Math.abs((w.distanceMiles || 0) - (workout.distanceMiles || 0));
      const distSim = 1 - (distDiff / (workout.distanceMiles || 1));

      // Type similarity (30% weight)
      const typeSim = w.workoutType === workout.workoutType ? 1 : 0.5;

      // Date proximity (20% weight) - more recent is more relevant
      const daysDiff = Math.abs(
        (parseLocalDate(w.date).getTime() - parseLocalDate(workout.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      const dateSim = Math.max(0, 1 - daysDiff / 365);

      const similarity = Math.round((distSim * 50 + typeSim * 30 + dateSim * 20));

      return {
        id: w.id,
        date: w.date,
        name: w.name || 'Workout',
        distanceMiles: w.distanceMiles || 0,
        avgPaceSeconds: w.avgPaceSeconds,
        similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Estimate running power (watts) for a workout
 * Based on simplified physics model
 */
export async function estimateRunningPower(workoutId: number): Promise<{
  avgPower: number;
  normalizedPower: number;
  powerPerKg: number;
  efficiency: number;
} | null> {
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || !workout.avgPaceSeconds || !workout.distanceMiles) {
    return null;
  }

  // Assume 70kg runner if no weight data
  const weightKg = 70;

  // Speed in m/s
  const speedMps = 1609.34 / workout.avgPaceSeconds;

  // Base power formula: P = (body_mass * g * Cr * v) + (0.5 * Cd * A * rho * v^3)
  // Cr = rolling resistance (~0.98 for running)
  // Cd = drag coefficient (~0.9)
  // A = frontal area (~0.5 m^2)
  // rho = air density (~1.225 kg/m^3)

  const g = 9.81;
  const Cr = 0.98;
  const Cd = 0.9;
  const A = 0.5;
  const rho = 1.225;

  // Running efficiency factor (mechanical efficiency ~25%)
  const efficiency = 0.25;

  // Calculate metabolic power
  const groundPower = weightKg * g * Cr * speedMps;
  const airPower = 0.5 * Cd * A * rho * Math.pow(speedMps, 3);

  // Add elevation component if available
  let elevPower = 0;
  if (workout.elevationGainFeet && workout.durationMinutes) {
    const elevMeters = workout.elevationGainFeet * 0.3048;
    const climbRate = elevMeters / (workout.durationMinutes * 60); // m/s
    elevPower = weightKg * g * climbRate;
  }

  const mechanicalPower = groundPower + airPower + elevPower;
  const metabolicPower = mechanicalPower / efficiency;

  // Simplified normalized power (would need second-by-second data for real NP)
  const normalizedPower = metabolicPower * 1.05; // 5% higher as approximation

  return {
    avgPower: Math.round(metabolicPower),
    normalizedPower: Math.round(normalizedPower),
    powerPerKg: Math.round((metabolicPower / weightKg) * 10) / 10,
    efficiency: Math.round(efficiency * 100),
  };
}

/**
 * Get workout efficiency metrics
 */
export async function getEfficiencyMetrics(workoutId: number): Promise<{
  paceDecoupling: number | null;
  cardiacDrift: number | null;
  aerobicEfficiency: number | null;
} | null> {
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: {
      segments: {
        orderBy: [workoutSegments.segmentNumber],
      },
    },
  });

  if (!workout || !workout.segments || workout.segments.length < 4) {
    return null;
  }

  const segments = workout.segments;
  const halfPoint = Math.floor(segments.length / 2);

  // First half and second half segments
  const firstHalf = segments.slice(0, halfPoint);
  const secondHalf = segments.slice(halfPoint);

  // Calculate pace decoupling (second half vs first half)
  const firstHalfPace = firstHalf
    .filter(s => s.paceSecondsPerMile)
    .reduce((sum, s) => sum + s.paceSecondsPerMile!, 0) / firstHalf.length;

  const secondHalfPace = secondHalf
    .filter(s => s.paceSecondsPerMile)
    .reduce((sum, s) => sum + s.paceSecondsPerMile!, 0) / secondHalf.length;

  const paceDecoupling = firstHalfPace > 0
    ? Math.round(((secondHalfPace - firstHalfPace) / firstHalfPace) * 100 * 10) / 10
    : null;

  // Cardiac drift (would need HR data per segment)
  // For now return null - this would need HR stream data
  const cardiacDrift = null;

  // Aerobic efficiency (pace per beat if we have HR)
  let aerobicEfficiency = null;
  if (workout.avgPaceSeconds && workout.avgHeartRate) {
    // Seconds per mile per bpm - lower is more efficient
    aerobicEfficiency = Math.round((workout.avgPaceSeconds / workout.avgHeartRate) * 100) / 100;
  }

  return {
    paceDecoupling,
    cardiacDrift,
    aerobicEfficiency,
  };
}
