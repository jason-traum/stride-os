'use server';

import { db, workouts } from '@/lib/db';
import { desc, gte, eq, and } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { calculateVDOT, calculatePaceZones, estimateVDOTFromEasyPace } from '@/lib/training/vdot-calculator';

export interface InferredPaces {
  easyPaceSeconds: number;
  tempoPaceSeconds: number;
  thresholdPaceSeconds: number;
  intervalPaceSeconds: number;
  marathonPaceSeconds: number;
  halfMarathonPaceSeconds: number;
  estimatedVdot: number;
  confidence: 'high' | 'medium' | 'low';
  dataPoints: {
    easyRuns: number;
    tempoRuns: number;
    intervalRuns: number;
    races: number;
  };
  source: string;
}

/**
 * Percentile calculation for array of numbers
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

/**
 * Infer training paces from recent workout data
 * Uses actual workout paces to estimate current fitness level
 */
export async function inferPacesFromWorkouts(days: number = 90): Promise<InferredPaces> {
  const profileId = await getActiveProfileId();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const dateFilter = gte(workouts.date, cutoffStr);
  const whereCondition = profileId
    ? and(dateFilter, eq(workouts.profileId, profileId))
    : dateFilter;

  const recentWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  // Filter to runs with valid pace data
  const runsWithPace = recentWorkouts.filter(w =>
    w.avgPaceSeconds &&
    w.avgPaceSeconds > 240 && // Faster than 4:00/mile
    w.avgPaceSeconds < 900 && // Slower than 15:00/mile
    w.distanceMiles &&
    w.distanceMiles >= 1
  );

  // Categorize runs by type
  const easyRuns: number[] = [];
  const tempoRuns: number[] = [];
  const intervalRuns: number[] = [];
  const longRuns: number[] = [];
  const races: number[] = [];

  for (const run of runsWithPace) {
    const pace = run.avgPaceSeconds!;
    const type = run.workoutType?.toLowerCase() || '';
    const distance = run.distanceMiles || 0;

    if (type === 'race') {
      races.push(pace);
    } else if (type === 'interval' || type === 'intervals' || type === 'speed' || type === 'track') {
      intervalRuns.push(pace);
    } else if (type === 'tempo' || type === 'threshold' || type === 'lt') {
      tempoRuns.push(pace);
    } else if (type === 'long' || type === 'long_run' || distance >= 10) {
      longRuns.push(pace);
    } else if (type === 'easy' || type === 'recovery' || type === 'base') {
      easyRuns.push(pace);
    } else {
      // Default: classify by pace relative to median
      // If we have some data, use median to classify
      if (easyRuns.length > 0 || tempoRuns.length > 0) {
        // Will classify after initial pass
      }
      easyRuns.push(pace); // Default to easy
    }
  }

  // Calculate inferred paces
  let inferredEasy: number | null = null;
  let inferredTempo: number | null = null;
  let inferredThreshold: number | null = null;
  let inferredInterval: number | null = null;
  let estimatedVdot = 0;
  let source = '';

  // Priority 1: Use race data to calculate VDOT and derive all paces
  if (races.length > 0) {
    // Find best race (fastest pace)
    const bestRacePace = Math.min(...races);
    const bestRace = runsWithPace.find(w => w.workoutType === 'race' && w.avgPaceSeconds === bestRacePace);

    if (bestRace && bestRace.distanceMiles) {
      const distanceMeters = bestRace.distanceMiles * 1609.34;
      const timeSeconds = bestRace.avgPaceSeconds! * bestRace.distanceMiles;
      estimatedVdot = calculateVDOT(distanceMeters, timeSeconds);
      const zones = calculatePaceZones(estimatedVdot);

      inferredEasy = zones.easy;
      inferredTempo = zones.tempo;
      inferredThreshold = zones.threshold;
      inferredInterval = zones.interval;
      source = 'race_result';
    }
  }

  // Priority 2: Use tempo/threshold runs to estimate
  if (!inferredTempo && tempoRuns.length >= 3) {
    // Use 50th percentile of tempo runs
    inferredTempo = Math.round(percentile(tempoRuns, 50));

    // Derive other paces from tempo (tempo is roughly 85% VO2max)
    // Easy is roughly 30-40 sec/mile slower
    // Threshold is roughly 10-15 sec/mile faster
    // Interval is roughly 25-35 sec/mile faster
    inferredEasy = inferredTempo + 60;
    inferredThreshold = inferredTempo - 15;
    inferredInterval = inferredTempo - 45;

    // Estimate VDOT from tempo pace
    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy);
    source = 'tempo_analysis';
  }

  // Priority 3: Use easy run data
  if (!inferredEasy && easyRuns.length >= 5) {
    // Use 60th percentile of easy runs (typical easy pace, not recovery)
    inferredEasy = Math.round(percentile(easyRuns, 60));

    // Derive other paces from easy
    inferredTempo = Math.max(inferredEasy - 60, 300); // At least 5:00/mile
    inferredThreshold = Math.max(inferredEasy - 75, 285);
    inferredInterval = Math.max(inferredEasy - 105, 270);

    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy);
    source = 'easy_pace_analysis';
  }

  // Priority 4: Use interval data
  if (!inferredInterval && intervalRuns.length >= 3) {
    inferredInterval = Math.round(percentile(intervalRuns, 40));

    // Derive other paces from interval
    inferredThreshold = inferredInterval + 25;
    inferredTempo = inferredInterval + 40;
    inferredEasy = inferredInterval + 90;

    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy!);
    source = 'interval_analysis';
  }

  // Priority 5: Use long run data as proxy for easy pace
  if (!inferredEasy && longRuns.length >= 3) {
    // Long run pace is typically 30-60 sec slower than easy
    const longRunPace = Math.round(percentile(longRuns, 50));
    inferredEasy = longRunPace - 30; // Long runs slightly slower than easy
    inferredTempo = Math.max(inferredEasy - 60, 300);
    inferredThreshold = Math.max(inferredEasy - 75, 285);
    inferredInterval = Math.max(inferredEasy - 105, 270);

    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy);
    source = 'long_run_analysis';
  }

  // Fallback: Use all runs if we have enough data
  if (!inferredEasy && runsWithPace.length >= 10) {
    const allPaces = runsWithPace.map(w => w.avgPaceSeconds!);
    inferredEasy = Math.round(percentile(allPaces, 70)); // 70th percentile as easy
    inferredTempo = Math.round(percentile(allPaces, 35));
    inferredThreshold = Math.round(percentile(allPaces, 25));
    inferredInterval = Math.round(percentile(allPaces, 15));

    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy);
    source = 'all_runs_analysis';
  }

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'low';
  const totalDataPoints = easyRuns.length + tempoRuns.length + intervalRuns.length + races.length;

  if (races.length >= 1 || (tempoRuns.length >= 5 && easyRuns.length >= 10)) {
    confidence = 'high';
  } else if (totalDataPoints >= 15 && (tempoRuns.length >= 3 || easyRuns.length >= 8)) {
    confidence = 'medium';
  }

  // Default paces if still null
  const defaultVdot = 40; // Reasonable default for recreational runner
  const defaultZones = calculatePaceZones(defaultVdot);

  return {
    easyPaceSeconds: inferredEasy || defaultZones.easy,
    tempoPaceSeconds: inferredTempo || defaultZones.tempo,
    thresholdPaceSeconds: inferredThreshold || defaultZones.threshold,
    intervalPaceSeconds: inferredInterval || defaultZones.interval,
    marathonPaceSeconds: estimatedVdot > 0
      ? calculatePaceZones(estimatedVdot).marathon
      : defaultZones.marathon,
    halfMarathonPaceSeconds: estimatedVdot > 0
      ? calculatePaceZones(estimatedVdot).halfMarathon
      : defaultZones.halfMarathon,
    estimatedVdot: estimatedVdot || defaultVdot,
    confidence,
    dataPoints: {
      easyRuns: easyRuns.length,
      tempoRuns: tempoRuns.length,
      intervalRuns: intervalRuns.length,
      races: races.length,
    },
    source: source || 'defaults',
  };
}

/**
 * Compare inferred paces with current settings
 */
export async function comparePacesWithSettings(): Promise<{
  inferred: InferredPaces;
  current: {
    easyPaceSeconds: number | null;
    tempoPaceSeconds: number | null;
    thresholdPaceSeconds: number | null;
    intervalPaceSeconds: number | null;
    vdot: number | null;
  };
  differences: {
    easy: number | null;
    tempo: number | null;
    threshold: number | null;
    interval: number | null;
    vdot: number | null;
  };
  recommendation: string;
}> {
  const profileId = await getActiveProfileId();

  // Get inferred paces
  const inferred = await inferPacesFromWorkouts(90);

  // Get current settings
  const { getSettings } = await import('./settings');
  const settings = await getSettings(profileId);

  const current = {
    easyPaceSeconds: settings?.easyPaceSeconds || null,
    tempoPaceSeconds: settings?.tempoPaceSeconds || null,
    thresholdPaceSeconds: settings?.thresholdPaceSeconds || null,
    intervalPaceSeconds: settings?.intervalPaceSeconds || null,
    vdot: settings?.vdot || null,
  };

  // Calculate differences (negative = inferred is faster)
  const differences = {
    easy: current.easyPaceSeconds ? inferred.easyPaceSeconds - current.easyPaceSeconds : null,
    tempo: current.tempoPaceSeconds ? inferred.tempoPaceSeconds - current.tempoPaceSeconds : null,
    threshold: current.thresholdPaceSeconds ? inferred.thresholdPaceSeconds - current.thresholdPaceSeconds : null,
    interval: current.intervalPaceSeconds ? inferred.intervalPaceSeconds - current.intervalPaceSeconds : null,
    vdot: current.vdot ? inferred.estimatedVdot - current.vdot : null,
  };

  // Generate recommendation
  let recommendation = '';

  if (inferred.confidence === 'low') {
    recommendation = 'Not enough workout data to make reliable pace recommendations. Keep logging your runs!';
  } else if (!current.easyPaceSeconds) {
    recommendation = 'No paces set in your profile. Consider using the inferred paces as a starting point.';
  } else {
    const avgDiff = [differences.easy, differences.tempo, differences.threshold, differences.interval]
      .filter((d): d is number => d !== null)
      .reduce((sum, d) => sum + d, 0) / 4;

    if (avgDiff < -10) {
      recommendation = 'Your recent workouts suggest you\'re fitter than your current pace settings. Consider updating to the inferred paces.';
    } else if (avgDiff > 15) {
      recommendation = 'Your recent workouts suggest your current paces may be too aggressive. Consider slowing down your easy runs.';
    } else {
      recommendation = 'Your current pace settings align well with your recent training data.';
    }
  }

  return {
    inferred,
    current,
    differences,
    recommendation,
  };
}
