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

  // Categorize runs by type AND heart rate data
  // Heart rate based classification helps when workout types aren't specified
  const easyRuns: { pace: number; hr?: number }[] = [];
  const tempoRuns: { pace: number; hr?: number }[] = [];
  const intervalRuns: { pace: number; hr?: number }[] = [];
  const longRuns: { pace: number; hr?: number }[] = [];
  const races: { pace: number; hr?: number }[] = [];

  // First pass: collect HR data to estimate max HR
  const runHRs = runsWithPace
    .filter(w => w.avgHr && w.avgHr > 100 && w.avgHr < 220)
    .map(w => w.avgHr!);
  const maxHRs = runsWithPace
    .filter(w => w.maxHr && w.maxHr > 120 && w.maxHr < 230)
    .map(w => w.maxHr!);

  // Estimate max HR from highest observed or highest average + buffer
  const estimatedMaxHR = maxHRs.length > 0
    ? Math.max(...maxHRs)
    : runHRs.length > 0
      ? Math.max(...runHRs) + 15
      : null;

  for (const run of runsWithPace) {
    const pace = run.avgPaceSeconds!;
    const hr = run.avgHr || undefined;
    const type = run.workoutType?.toLowerCase() || '';
    const distance = run.distanceMiles || 0;

    // Calculate effort percentage if we have HR data
    let effortPct: number | null = null;
    if (hr && estimatedMaxHR) {
      effortPct = (hr / estimatedMaxHR) * 100;
    }

    // Classify by explicit type first
    if (type === 'race') {
      races.push({ pace, hr });
    } else if (type === 'interval' || type === 'intervals' || type === 'speed' || type === 'track') {
      intervalRuns.push({ pace, hr });
    } else if (type === 'tempo' || type === 'threshold' || type === 'lt') {
      tempoRuns.push({ pace, hr });
    } else if (type === 'long' || type === 'long_run' || distance >= 10) {
      longRuns.push({ pace, hr });
    } else if (type === 'easy' || type === 'recovery' || type === 'base') {
      easyRuns.push({ pace, hr });
    } else if (effortPct !== null) {
      // Use HR to classify untyped runs
      if (effortPct >= 90) {
        // Very hard effort - likely interval or race effort
        intervalRuns.push({ pace, hr });
      } else if (effortPct >= 82) {
        // Tempo/threshold effort
        tempoRuns.push({ pace, hr });
      } else if (effortPct >= 75) {
        // Moderate effort - could be steady or uptempo easy
        easyRuns.push({ pace, hr }); // Be conservative
      } else {
        // Easy effort
        easyRuns.push({ pace, hr });
      }
    } else {
      // No HR, no type - default to easy
      easyRuns.push({ pace, hr });
    }
  }

  // Extract just paces for percentile calculations
  const easyPaces = easyRuns.map(r => r.pace);
  const tempoPaces = tempoRuns.map(r => r.pace);
  const intervalPaces = intervalRuns.map(r => r.pace);
  const longPaces = longRuns.map(r => r.pace);
  const racePaces = races.map(r => r.pace);

  // Calculate inferred paces
  let inferredEasy: number | null = null;
  let inferredTempo: number | null = null;
  let inferredThreshold: number | null = null;
  let inferredInterval: number | null = null;
  let estimatedVdot = 0;
  let source = '';

  // Priority 1: Use race data to calculate VDOT and derive all paces
  if (racePaces.length > 0) {
    // Find best race (fastest pace)
    const bestRacePace = Math.min(...racePaces);
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

  // Priority 2: Use HR-correlated tempo runs (most reliable for estimating fitness)
  if (!inferredTempo && tempoPaces.length >= 2) {
    // Get runs with HR data for better accuracy
    const tempoWithHR = tempoRuns.filter(r => r.hr);
    if (tempoWithHR.length >= 2 && estimatedMaxHR) {
      // Use runs where HR was in tempo zone (82-88% max)
      const validTempoRuns = tempoWithHR.filter(r =>
        r.hr! >= estimatedMaxHR * 0.80 && r.hr! <= estimatedMaxHR * 0.90
      );
      if (validTempoRuns.length > 0) {
        inferredTempo = Math.round(percentile(validTempoRuns.map(r => r.pace), 50));
        source = 'tempo_with_hr';
      }
    }

    // Fallback to pace-only
    if (!inferredTempo) {
      inferredTempo = Math.round(percentile(tempoPaces, 50));
      source = 'tempo_analysis';
    }

    // Derive other paces from tempo
    inferredEasy = inferredTempo + 55;
    inferredThreshold = inferredTempo - 12;
    inferredInterval = inferredTempo - 40;
    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy);
  }

  // Priority 3: Use easy runs with HR validation
  if (!inferredEasy && easyPaces.length >= 5) {
    // If we have HR data, find truly easy runs (under 75% max HR)
    const easyWithHR = easyRuns.filter(r => r.hr);
    if (easyWithHR.length >= 3 && estimatedMaxHR) {
      const trueEasyRuns = easyWithHR.filter(r => r.hr! <= estimatedMaxHR * 0.76);
      if (trueEasyRuns.length >= 2) {
        // Use 50th percentile of validated easy runs
        inferredEasy = Math.round(percentile(trueEasyRuns.map(r => r.pace), 50));
        source = 'easy_with_hr';
      }
    }

    // Fallback to pace-only
    if (!inferredEasy) {
      inferredEasy = Math.round(percentile(easyPaces, 60));
      source = 'easy_pace_analysis';
    }

    // Derive other paces from easy
    inferredTempo = Math.max(inferredEasy - 55, 300);
    inferredThreshold = Math.max(inferredEasy - 70, 285);
    inferredInterval = Math.max(inferredEasy - 95, 270);
    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy);
  }

  // Priority 4: Use interval data
  if (!inferredInterval && intervalPaces.length >= 3) {
    inferredInterval = Math.round(percentile(intervalPaces, 40));

    // Derive other paces from interval
    inferredThreshold = inferredInterval + 25;
    inferredTempo = inferredInterval + 40;
    inferredEasy = inferredInterval + 85;

    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy!);
    source = 'interval_analysis';
  }

  // Priority 5: Use long run data with HR validation
  if (!inferredEasy && longPaces.length >= 3) {
    const longWithHR = longRuns.filter(r => r.hr);
    let longRunPace: number;

    if (longWithHR.length >= 2 && estimatedMaxHR) {
      // Aerobic long runs should be around 70-78% max HR
      const aerobicLongRuns = longWithHR.filter(r =>
        r.hr! >= estimatedMaxHR * 0.68 && r.hr! <= estimatedMaxHR * 0.80
      );
      if (aerobicLongRuns.length > 0) {
        longRunPace = Math.round(percentile(aerobicLongRuns.map(r => r.pace), 50));
        source = 'long_run_with_hr';
      } else {
        longRunPace = Math.round(percentile(longPaces, 50));
        source = 'long_run_analysis';
      }
    } else {
      longRunPace = Math.round(percentile(longPaces, 50));
      source = 'long_run_analysis';
    }

    // Long run is typically 20-40 sec/mile slower than easy
    inferredEasy = longRunPace - 25;
    inferredTempo = Math.max(inferredEasy - 55, 300);
    inferredThreshold = Math.max(inferredEasy - 70, 285);
    inferredInterval = Math.max(inferredEasy - 95, 270);

    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy);
  }

  // Fallback: Use all runs if we have enough data
  if (!inferredEasy && runsWithPace.length >= 10) {
    const allPaces = runsWithPace.map(w => w.avgPaceSeconds!);
    inferredEasy = Math.round(percentile(allPaces, 70));
    inferredTempo = Math.round(percentile(allPaces, 35));
    inferredThreshold = Math.round(percentile(allPaces, 25));
    inferredInterval = Math.round(percentile(allPaces, 15));

    estimatedVdot = estimateVDOTFromEasyPace(inferredEasy);
    source = 'all_runs_analysis';
  }

  // Determine confidence level - HR data increases confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  const totalDataPoints = easyRuns.length + tempoRuns.length + intervalRuns.length + races.length;
  const hasHRData = runHRs.length >= 5;

  if (racePaces.length >= 1 || (tempoPaces.length >= 5 && easyPaces.length >= 10)) {
    confidence = 'high';
  } else if (totalDataPoints >= 15 && (tempoPaces.length >= 3 || easyPaces.length >= 8)) {
    confidence = hasHRData ? 'high' : 'medium';
  } else if (hasHRData && totalDataPoints >= 8) {
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
    estimatedVdot: Math.min(85, estimatedVdot || defaultVdot),
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
 * Estimate TRIMP (Training Impulse) for a workout
 * If HR data is available, use HR-based calculation
 * Otherwise, estimate from pace and RPE
 */
export function estimateTrimp(
  durationMinutes: number,
  avgHr?: number,
  maxHr?: number,
  avgPace?: number,
  rpe?: number,
  workoutType?: string
): number {
  // If we have HR data, use Banister's TRIMP formula
  if (avgHr && maxHr) {
    const restingHr = 60; // Assume average resting HR
    const hrReserve = (avgHr - restingHr) / (maxHr - restingHr);
    const genderFactor = 1.92; // Male factor, use 1.67 for female
    const trimp = durationMinutes * hrReserve * 0.64 * Math.exp(genderFactor * hrReserve);
    return Math.round(trimp);
  }

  // Estimate from pace and/or RPE
  let effortMultiplier = 1.0;

  if (rpe) {
    // RPE 1-10 scale
    effortMultiplier = 0.5 + (rpe / 10) * 1.0; // Range: 0.5 to 1.5
  } else if (workoutType) {
    // Estimate based on workout type
    const typeMultipliers: Record<string, number> = {
      'recovery': 0.6,
      'easy': 0.7,
      'long': 0.8,
      'steady': 0.9,
      'tempo': 1.1,
      'threshold': 1.2,
      'interval': 1.3,
      'race': 1.4,
    };
    effortMultiplier = typeMultipliers[workoutType.toLowerCase()] || 0.8;
  }

  // Simple estimate: duration * effort multiplier
  return Math.round(durationMinutes * effortMultiplier);
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
