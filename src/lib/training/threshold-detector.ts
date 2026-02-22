/**
 * Lactate Threshold Pace Detector
 *
 * Estimates a runner's lactate threshold pace from workout history alone,
 * without requiring race results or manual VDOT entry.
 *
 * Three-signal approach:
 *   1. Threshold-effort extraction: find steady-state hard runs (20-40 min, low pace variance)
 *   2. Pace-HR deflection analysis: find the pace where HR response steepens (Conconi-like)
 *   3. Sustainability boundary: find the fastest pace the runner can hold without
 *      cardiac drift exceeding physiological thresholds
 *
 * Returns an estimated threshold pace (seconds/mile) with confidence 0-1.
 *
 * Pure algorithm -- no DB, no API calls. Data in, analysis out.
 */

import type { PaceZones } from './types';
import { calculatePaceZones } from './vdot-calculator';

// ==================== Input Types ====================

/** Minimal workout data needed for threshold detection */
export interface ThresholdWorkoutData {
  id?: number;
  date: string;                    // ISO date string
  distanceMiles: number;
  durationSeconds: number;         // total moving time
  averagePaceSecondsPerMile: number;
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  elevationGainFeet?: number | null;
  /** Per-mile or per-km splits, if available */
  splits?: ThresholdSplitData[];
}

export interface ThresholdSplitData {
  splitNumber: number;
  distanceMiles: number;
  durationSeconds: number;
  paceSecondsPerMile: number;
  heartRate?: number | null;
}

// ==================== Output Types ====================

export interface ThresholdEstimate {
  /** Estimated threshold pace in seconds per mile (lower = faster) */
  thresholdPaceSecondsPerMile: number;
  /** Confidence 0-1 in the estimate */
  confidence: number;
  /** How the estimate was derived */
  method: ThresholdMethod;
  /** Supporting evidence */
  evidence: ThresholdEvidence;
  /** Optional VDOT validation if a known VDOT is provided */
  vdotValidation?: VdotValidation;
}

export type ThresholdMethod =
  | 'threshold_efforts'     // From identified threshold-effort workouts
  | 'hr_deflection'         // From pace-HR deflection point analysis
  | 'sustainability_boundary' // From sustainable vs unsustainable pace patterns
  | 'combined'              // Weighted blend of multiple signals
  | 'insufficient_data';    // Not enough data for a reliable estimate

export interface ThresholdEvidence {
  /** Workouts identified as threshold-effort runs */
  thresholdEfforts: IdentifiedThresholdEffort[];
  /** Pace-HR data points used for deflection analysis */
  paceHrPoints: PaceHrPoint[];
  /** The detected deflection point pace, if found */
  deflectionPace?: number;
  /** The sustainability boundary pace, if found */
  sustainabilityBoundaryPace?: number;
  /** Number of workouts analyzed */
  workoutsAnalyzed: number;
  /** Number with HR data */
  workoutsWithHR: number;
  /** Date range of data used */
  dateRange: { earliest: string; latest: string };
}

export interface IdentifiedThresholdEffort {
  workoutDate: string;
  pace: number;              // seconds/mile
  durationSeconds: number;
  averageHR?: number;
  paceVariability: number;   // coefficient of variation (0 = perfectly steady)
  score: number;             // 0-1 how "threshold-like" this workout is
}

export interface PaceHrPoint {
  pace: number;              // seconds/mile
  heartRate: number;         // bpm
  workoutDate: string;
}

export interface VdotValidation {
  vdotThresholdPace: number; // seconds/mile from VDOT tables
  estimatedThresholdPace: number;
  differenceSeconds: number; // positive = our estimate is slower
  agreement: 'strong' | 'moderate' | 'weak';
}

// ==================== Configuration ====================

/** Tunable constants for the algorithm */
export const THRESHOLD_CONFIG = {
  // Threshold effort identification
  MIN_DURATION_SECONDS: 20 * 60,       // 20 min minimum steady effort
  MAX_DURATION_SECONDS: 40 * 60,       // 40 min maximum
  MAX_PACE_CV: 0.06,                   // Max coefficient of variation for "steady"
  MIN_PACE_RATIO_VS_EASY: 0.72,       // Must be at least 28% faster than easy pace (pace ratio)
  MAX_PACE_RATIO_VS_EASY: 0.92,       // Must not be more than ~8% faster than easy (too easy)
  MAX_ELEVATION_GAIN_PER_MILE: 80,     // ft/mi -- skip hilly runs

  // HR deflection analysis
  MIN_HR_WORKOUTS: 5,                  // Need at least 5 workouts with HR for deflection
  HR_DEFLECTION_SENSITIVITY: 0.5,      // Min ratio of max slope increase to avg slope magnitude
  PACE_BIN_WIDTH_SECONDS: 15,          // Bin width for grouping paces in deflection analysis

  // Sustainability boundary
  CARDIAC_DRIFT_THRESHOLD: 0.05,       // 5% HR drift = unsustainable
  MIN_SPLITS_FOR_DRIFT: 3,            // Need at least 3 splits to compute drift
  SUSTAINABLE_DURATION_MIN: 20 * 60,   // Must hold pace for 20+ min to count as sustainable

  // Recency weighting
  RECENCY_HALF_LIFE_DAYS: 60,          // Workouts lose half their weight after 60 days
  MAX_AGE_DAYS: 180,                   // Ignore workouts older than 6 months

  // Confidence
  MIN_THRESHOLD_EFFORTS_FOR_HIGH_CONF: 3,
  MIN_THRESHOLD_EFFORTS_FOR_MEDIUM_CONF: 2,
} as const;

// ==================== Main Entry Point ====================

/**
 * Detect a runner's lactate threshold pace from their workout history.
 *
 * @param workouts - Array of workouts with pace and optional HR data.
 *                   Should cover at least 4-8 weeks of training for best results.
 * @param options  - Optional: known VDOT for validation, config overrides
 * @returns ThresholdEstimate with pace, confidence, and supporting evidence
 */
export function detectThresholdPace(
  workouts: ThresholdWorkoutData[],
  options?: {
    knownVdot?: number;
    config?: Partial<typeof THRESHOLD_CONFIG>;
  }
): ThresholdEstimate {
  const config = { ...THRESHOLD_CONFIG, ...options?.config };

  // Filter to recent, valid workouts
  const validWorkouts = filterValidWorkouts(workouts, config);

  if (validWorkouts.length < 3) {
    return buildInsufficientDataResult(workouts);
  }

  // Sort by date (newest first) for recency weighting
  validWorkouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const dateRange = {
    earliest: validWorkouts[validWorkouts.length - 1].date,
    latest: validWorkouts[0].date,
  };

  // Signal 1: Identify threshold-effort workouts
  const thresholdEfforts = identifyThresholdEfforts(validWorkouts, config);

  // Signal 2: Pace-HR deflection analysis
  const workoutsWithHR = validWorkouts.filter(w => w.averageHeartRate && w.averageHeartRate > 0);
  const paceHrPoints = buildPaceHrPoints(workoutsWithHR);
  const deflectionPace = workoutsWithHR.length >= config.MIN_HR_WORKOUTS
    ? findDeflectionPoint(paceHrPoints, config)
    : undefined;

  // Signal 3: Sustainability boundary
  const sustainabilityPace = findSustainabilityBoundary(validWorkouts, config);

  // Combine signals
  const estimate = combineSignals(
    thresholdEfforts,
    deflectionPace,
    sustainabilityPace,
    config,
    dateRange
  );

  // Build evidence
  estimate.evidence = {
    thresholdEfforts,
    paceHrPoints,
    deflectionPace,
    sustainabilityBoundaryPace: sustainabilityPace,
    workoutsAnalyzed: validWorkouts.length,
    workoutsWithHR: workoutsWithHR.length,
    dateRange,
  };

  // Validate against VDOT if provided
  if (options?.knownVdot && estimate.method !== 'insufficient_data') {
    estimate.vdotValidation = validateAgainstVdot(
      estimate.thresholdPaceSecondsPerMile,
      options.knownVdot
    );
  }

  return estimate;
}

// ==================== Signal 1: Threshold Effort Identification ====================

/**
 * Find workouts that look like threshold efforts:
 * - Steady pace (low coefficient of variation)
 * - 20-40 minute duration
 * - Hard but not maximal effort
 * - Relatively flat terrain
 */
export function identifyThresholdEfforts(
  workouts: ThresholdWorkoutData[],
  config: typeof THRESHOLD_CONFIG
): IdentifiedThresholdEffort[] {
  // Establish the runner's easy pace as the reference.
  // Easy pace = the pace they run most often (median of all paces).
  // Threshold is typically 15-25% faster than easy pace.
  const paces = workouts.map(w => w.averagePaceSecondsPerMile).sort((a, b) => a - b);
  const medianPace = paces[Math.floor(paces.length / 2)];
  // Use the 60th percentile (slower side) as the easy-pace reference
  // to avoid threshold workouts pulling the median too fast
  const easyPaceReference = paces[Math.floor(paces.length * 0.6)] || medianPace;

  const efforts: IdentifiedThresholdEffort[] = [];

  for (const w of workouts) {
    // Skip if outside duration window
    if (w.durationSeconds < config.MIN_DURATION_SECONDS) continue;
    if (w.durationSeconds > config.MAX_DURATION_SECONDS) continue;

    // Skip hilly runs
    if (w.elevationGainFeet && w.distanceMiles > 0) {
      const gainPerMile = w.elevationGainFeet / w.distanceMiles;
      if (gainPerMile > config.MAX_ELEVATION_GAIN_PER_MILE) continue;
    }

    // Check intensity: pace ratio relative to easy pace
    // A 420 sec/mi threshold vs 530 sec/mi easy = ratio of 0.79
    // Lower ratio = faster relative to easy (harder effort)
    const paceRatio = w.averagePaceSecondsPerMile / easyPaceReference;
    if (paceRatio < config.MIN_PACE_RATIO_VS_EASY) continue;  // Too fast (VO2max territory)
    if (paceRatio > config.MAX_PACE_RATIO_VS_EASY) continue;  // Too easy

    // Compute pace variability from splits if available
    let paceCV = 0;
    if (w.splits && w.splits.length >= 2) {
      paceCV = computeCoefficientOfVariation(w.splits.map(s => s.paceSecondsPerMile));
    }

    // Skip highly variable efforts (intervals, fartlek)
    if (paceCV > config.MAX_PACE_CV) continue;

    // Score this workout: how "threshold-like" is it?
    const score = scoreThresholdEffort(w, paceRatio, paceCV, config);

    efforts.push({
      workoutDate: w.date,
      pace: w.averagePaceSecondsPerMile,
      durationSeconds: w.durationSeconds,
      averageHR: w.averageHeartRate ?? undefined,
      paceVariability: paceCV,
      score,
    });
  }

  // Sort by score (best threshold-like workouts first)
  efforts.sort((a, b) => b.score - a.score);

  return efforts;
}

/**
 * Score how "threshold-like" a workout is (0-1).
 * Higher = more likely to be a genuine threshold effort.
 *
 * @param paceRatio - workout pace / easy pace reference (lower = faster relative to easy)
 */
function scoreThresholdEffort(
  workout: ThresholdWorkoutData,
  paceRatio: number,
  paceCV: number,
  _config: typeof THRESHOLD_CONFIG
): number {
  let score = 0;

  // Duration sweet spot: 25-35 min is ideal for threshold
  const durationMin = workout.durationSeconds / 60;
  if (durationMin >= 25 && durationMin <= 35) {
    score += 0.3;
  } else {
    // Taper off toward edges of 20-40 range
    const center = 30;
    const distFromCenter = Math.abs(durationMin - center);
    score += Math.max(0, 0.3 - distFromCenter * 0.02);
  }

  // Pace ratio sweet spot: ~0.80 is ideal for threshold
  // (threshold pace is typically ~80% of easy pace in seconds/mile)
  const idealRatio = 0.80;
  const ratioDistance = Math.abs(paceRatio - idealRatio);
  score += Math.max(0, 0.3 - ratioDistance * 2.5);

  // Pace steadiness: lower CV is better
  const steadinessScore = Math.max(0, 0.2 - paceCV * 4);
  score += steadinessScore;

  // HR consistency bonus: if HR is in a plausible threshold range (80-90% max)
  // We can't know max HR but avgHR > 155 for most runners suggests hard effort
  if (workout.averageHeartRate && workout.averageHeartRate > 150) {
    score += 0.1;
  }

  // Flat terrain bonus
  if (workout.elevationGainFeet && workout.distanceMiles > 0) {
    const gainPerMile = workout.elevationGainFeet / workout.distanceMiles;
    if (gainPerMile < 30) {
      score += 0.1;
    }
  } else {
    // No elevation data = assume flat, small bonus
    score += 0.05;
  }

  return Math.min(1, Math.max(0, score));
}

// ==================== Signal 2: Pace-HR Deflection Analysis ====================

/**
 * Build pace-HR data points from workouts that have HR data.
 * Each workout contributes one (pace, HR) point.
 */
export function buildPaceHrPoints(workouts: ThresholdWorkoutData[]): PaceHrPoint[] {
  return workouts
    .filter(w => w.averageHeartRate && w.averageHeartRate > 0)
    .map(w => ({
      pace: w.averagePaceSecondsPerMile,
      heartRate: w.averageHeartRate!,
      workoutDate: w.date,
    }))
    .sort((a, b) => b.pace - a.pace); // Sort slowest to fastest (high sec to low sec)
}

/**
 * Find the deflection point in the pace-HR relationship.
 *
 * Below threshold, HR increases roughly linearly with pace.
 * Above threshold, HR increases more steeply (disproportionate rise).
 *
 * We bin workouts by pace, compute average HR per bin, then look for where
 * the slope of the HR-vs-pace relationship steepens significantly.
 *
 * This is inspired by the Conconi test, adapted for field data.
 *
 * @returns The threshold pace (seconds/mile) at the deflection point, or undefined
 */
export function findDeflectionPoint(
  points: PaceHrPoint[],
  config: typeof THRESHOLD_CONFIG
): number | undefined {
  if (points.length < config.MIN_HR_WORKOUTS) return undefined;

  // Bin workouts by pace
  const bins = binByPace(points, config.PACE_BIN_WIDTH_SECONDS);

  // Need at least 4 bins to find a meaningful deflection
  if (bins.length < 4) return undefined;

  // Sort bins from slowest to fastest pace (highest seconds to lowest)
  bins.sort((a, b) => b.centerPace - a.centerPace);

  // Compute slopes between consecutive bins
  // Slope = change in HR / change in pace (negative pace change = getting faster)
  const slopes: { pace: number; slope: number }[] = [];
  for (let i = 1; i < bins.length; i++) {
    const dHR = bins[i].avgHR - bins[i - 1].avgHR;
    const dPace = bins[i].centerPace - bins[i - 1].centerPace; // negative (getting faster)

    if (dPace === 0) continue;

    // Slope: HR increase per second of pace decrease (should be positive)
    const slope = -dHR / dPace;
    slopes.push({
      pace: (bins[i].centerPace + bins[i - 1].centerPace) / 2,
      slope,
    });
  }

  if (slopes.length < 3) return undefined;

  // Find the deflection point using the "two-segment" approach:
  // For each candidate split point, compare the average slope in the
  // slow-pace region (below threshold) vs the fast-pace region (above threshold).
  // The deflection is where the fast-region slope is most disproportionately
  // steeper than the slow-region slope.
  //
  // Slopes are ordered from slow pace to fast pace (left = slow, right = fast).
  let bestRatio = 0;
  let bestSplitIndex = -1;

  for (let splitAt = 2; splitAt < slopes.length - 1; splitAt++) {
    // Average slope in the slow region (indices 0..splitAt-1)
    const slowSlopes = slopes.slice(0, splitAt);
    const avgSlow = slowSlopes.reduce((s, v) => s + v.slope, 0) / slowSlopes.length;

    // Average slope in the fast region (indices splitAt..end)
    const fastSlopes = slopes.slice(splitAt);
    const avgFast = fastSlopes.reduce((s, v) => s + v.slope, 0) / fastSlopes.length;

    // The deflection should show: avgFast >> avgSlow (both positive)
    if (avgSlow <= 0 || avgFast <= 0) continue;

    const ratio = avgFast / avgSlow;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestSplitIndex = splitAt;
    }
  }

  // Validate: the fast side should be meaningfully steeper than the slow side
  if (bestSplitIndex < 0 || bestRatio < 1.0 + config.HR_DEFLECTION_SENSITIVITY) {
    return undefined;
  }

  return Math.round(slopes[bestSplitIndex].pace);
}

interface PaceBin {
  centerPace: number;
  avgHR: number;
  count: number;
}

/**
 * Group pace-HR points into bins by pace range.
 */
function binByPace(points: PaceHrPoint[], binWidth: number): PaceBin[] {
  if (points.length === 0) return [];

  const paces = points.map(p => p.pace);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);

  const bins: Map<number, { hrSum: number; count: number }> = new Map();

  for (const point of points) {
    const binIndex = Math.floor((point.pace - minPace) / binWidth);
    const existing = bins.get(binIndex) || { hrSum: 0, count: 0 };
    existing.hrSum += point.heartRate;
    existing.count += 1;
    bins.set(binIndex, existing);
  }

  return Array.from(bins.entries())
    .filter(([, bin]) => bin.count >= 1) // Keep all bins with data
    .map(([index, bin]) => ({
      centerPace: minPace + (index + 0.5) * binWidth,
      avgHR: bin.hrSum / bin.count,
      count: bin.count,
    }));
}

// ==================== Signal 3: Sustainability Boundary ====================

/**
 * Find the fastest pace that the runner can sustain without excessive cardiac drift.
 *
 * Cardiac drift: when HR rises over the course of a run even though pace stays constant,
 * it signals that the effort is above the lactate threshold.
 *
 * We look at workouts with split data, compute HR drift from first half to second half,
 * and find the pace boundary between "drifts <5%" and "drifts >5%".
 */
export function findSustainabilityBoundary(
  workouts: ThresholdWorkoutData[],
  config: typeof THRESHOLD_CONFIG
): number | undefined {
  const driftData: { pace: number; drift: number; date: string }[] = [];

  for (const w of workouts) {
    if (!w.splits || w.splits.length < config.MIN_SPLITS_FOR_DRIFT) continue;
    if (w.durationSeconds < config.SUSTAINABLE_DURATION_MIN) continue;

    // Only analyze splits that have HR data
    const splitsWithHR = w.splits.filter(s => s.heartRate && s.heartRate > 0);
    if (splitsWithHR.length < config.MIN_SPLITS_FOR_DRIFT) continue;

    // Compute HR drift: compare first half average HR to second half
    const midpoint = Math.floor(splitsWithHR.length / 2);
    const firstHalf = splitsWithHR.slice(0, midpoint);
    const secondHalf = splitsWithHR.slice(midpoint);

    const firstHalfHR = average(firstHalf.map(s => s.heartRate!));
    const secondHalfHR = average(secondHalf.map(s => s.heartRate!));

    if (firstHalfHR === 0) continue;

    const drift = (secondHalfHR - firstHalfHR) / firstHalfHR;

    // Also check pace didn't change much (we want steady-pace runs)
    const firstHalfPace = average(firstHalf.map(s => s.paceSecondsPerMile));
    const secondHalfPace = average(secondHalf.map(s => s.paceSecondsPerMile));
    const paceDrift = Math.abs(secondHalfPace - firstHalfPace) / firstHalfPace;
    if (paceDrift > 0.08) continue; // Skip if pace varied more than 8%

    driftData.push({
      pace: w.averagePaceSecondsPerMile,
      drift,
      date: w.date,
    });
  }

  if (driftData.length < 3) return undefined;

  // Sort by pace (slowest to fastest)
  driftData.sort((a, b) => b.pace - a.pace);

  // Find the boundary: fastest pace where drift is consistently below threshold
  const threshold = config.CARDIAC_DRIFT_THRESHOLD;

  // Collect sustainable paces (drift below threshold) and unsustainable (above)
  const sustainable = driftData.filter(d => d.drift < threshold);
  const unsustainable = driftData.filter(d => d.drift >= threshold);

  if (sustainable.length === 0 || unsustainable.length === 0) {
    // If all runs are sustainable or all are unsustainable, can't find boundary
    return undefined;
  }

  // The boundary is between the fastest sustainable pace and the slowest unsustainable pace
  const fastestSustainable = Math.min(...sustainable.map(d => d.pace));
  const slowestUnsustainable = Math.max(...unsustainable.map(d => d.pace));

  // If there's no clear separation, take the midpoint of the overlap zone
  // otherwise use the midpoint of the gap
  return Math.round((fastestSustainable + slowestUnsustainable) / 2);
}

// ==================== Signal Combination ====================

/**
 * Combine the three signals into a single threshold estimate.
 *
 * Priority: threshold efforts > HR deflection > sustainability boundary
 * When multiple signals agree, confidence increases.
 */
function combineSignals(
  thresholdEfforts: IdentifiedThresholdEffort[],
  deflectionPace: number | undefined,
  sustainabilityPace: number | undefined,
  config: typeof THRESHOLD_CONFIG,
  dateRange: { earliest: string; latest: string }
): ThresholdEstimate {
  const signals: { pace: number; weight: number; method: ThresholdMethod }[] = [];

  // Signal 1: Threshold efforts (highest weight)
  if (thresholdEfforts.length > 0) {
    // Use score-weighted average of top threshold efforts
    const topEfforts = thresholdEfforts.slice(0, 5);
    const weightedSum = topEfforts.reduce((sum, e) => sum + e.pace * e.score, 0);
    const weightSum = topEfforts.reduce((sum, e) => sum + e.score, 0);
    const effortPace = weightedSum / weightSum;

    // Weight depends on how many good efforts we found
    const effortWeight = thresholdEfforts.length >= config.MIN_THRESHOLD_EFFORTS_FOR_HIGH_CONF
      ? 0.5
      : thresholdEfforts.length >= config.MIN_THRESHOLD_EFFORTS_FOR_MEDIUM_CONF
        ? 0.35
        : 0.2;

    signals.push({ pace: effortPace, weight: effortWeight, method: 'threshold_efforts' });
  }

  // Signal 2: HR deflection
  if (deflectionPace !== undefined) {
    signals.push({ pace: deflectionPace, weight: 0.3, method: 'hr_deflection' });
  }

  // Signal 3: Sustainability boundary
  if (sustainabilityPace !== undefined) {
    signals.push({ pace: sustainabilityPace, weight: 0.2, method: 'sustainability_boundary' });
  }

  if (signals.length === 0) {
    return buildInsufficientDataResult([]);
  }

  // Normalize weights
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const weightedPace = signals.reduce((sum, s) => sum + s.pace * (s.weight / totalWeight), 0);

  // Compute confidence
  let confidence = computeConfidence(signals, thresholdEfforts, config);

  // Agreement bonus: if signals agree within 15 seconds, boost confidence
  if (signals.length >= 2) {
    const paces = signals.map(s => s.pace);
    const range = Math.max(...paces) - Math.min(...paces);
    if (range <= 15) {
      confidence = Math.min(1, confidence + 0.15);
    } else if (range <= 30) {
      confidence = Math.min(1, confidence + 0.05);
    } else if (range > 45) {
      // Signals disagree significantly -- penalize confidence
      confidence = Math.max(0.1, confidence - 0.15);
    }
  }

  // Determine primary method
  const method: ThresholdMethod = signals.length > 1
    ? 'combined'
    : signals[0].method;

  return {
    thresholdPaceSecondsPerMile: Math.round(weightedPace),
    confidence: Math.round(confidence * 100) / 100,
    method,
    evidence: {
      thresholdEfforts: [],
      paceHrPoints: [],
      workoutsAnalyzed: 0,
      workoutsWithHR: 0,
      dateRange,
    },
  };
}

/**
 * Compute confidence score (0-1) based on data quality and signal agreement.
 */
function computeConfidence(
  signals: { pace: number; weight: number; method: ThresholdMethod }[],
  thresholdEfforts: IdentifiedThresholdEffort[],
  config: typeof THRESHOLD_CONFIG
): number {
  let confidence = 0.2; // Base confidence

  // More threshold efforts = more confident
  if (thresholdEfforts.length >= config.MIN_THRESHOLD_EFFORTS_FOR_HIGH_CONF) {
    confidence += 0.3;
  } else if (thresholdEfforts.length >= config.MIN_THRESHOLD_EFFORTS_FOR_MEDIUM_CONF) {
    confidence += 0.2;
  } else if (thresholdEfforts.length >= 1) {
    confidence += 0.1;
  }

  // More independent signals = more confident
  if (signals.length >= 3) {
    confidence += 0.2;
  } else if (signals.length >= 2) {
    confidence += 0.1;
  }

  // High-scoring threshold efforts boost confidence
  if (thresholdEfforts.length > 0) {
    const avgScore = thresholdEfforts.slice(0, 3).reduce((s, e) => s + e.score, 0) /
      Math.min(3, thresholdEfforts.length);
    confidence += avgScore * 0.15;
  }

  return Math.min(0.95, confidence);
}

// ==================== VDOT Validation ====================

/**
 * Compare detected threshold pace against VDOT-derived threshold pace.
 */
export function validateAgainstVdot(
  estimatedPace: number,
  knownVdot: number
): VdotValidation {
  const zones: PaceZones = calculatePaceZones(knownVdot);
  const vdotThresholdPace = zones.threshold;

  const diff = estimatedPace - vdotThresholdPace;
  const absDiff = Math.abs(diff);

  let agreement: 'strong' | 'moderate' | 'weak';
  if (absDiff <= 10) {
    agreement = 'strong';
  } else if (absDiff <= 20) {
    agreement = 'moderate';
  } else {
    agreement = 'weak';
  }

  return {
    vdotThresholdPace,
    estimatedThresholdPace: estimatedPace,
    differenceSeconds: diff,
    agreement,
  };
}

// ==================== Utility Functions ====================

/**
 * Filter workouts to valid, recent runs suitable for analysis.
 */
function filterValidWorkouts(
  workouts: ThresholdWorkoutData[],
  config: typeof THRESHOLD_CONFIG
): ThresholdWorkoutData[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  return workouts.filter(w => {
    // Must have distance, duration, and pace
    if (!w.distanceMiles || w.distanceMiles < 0.5) return false;
    if (!w.durationSeconds || w.durationSeconds < 300) return false; // 5 min minimum
    if (!w.averagePaceSecondsPerMile || w.averagePaceSecondsPerMile <= 0) return false;

    // Must be recent enough
    const workoutDate = new Date(w.date);
    if (workoutDate < cutoff) return false;

    // Sanity check pace: between 4:00/mi and 15:00/mi
    if (w.averagePaceSecondsPerMile < 240 || w.averagePaceSecondsPerMile > 900) return false;

    return true;
  });
}

/** Build a result for insufficient data */
function buildInsufficientDataResult(workouts: ThresholdWorkoutData[]): ThresholdEstimate {
  return {
    thresholdPaceSecondsPerMile: 0,
    confidence: 0,
    method: 'insufficient_data',
    evidence: {
      thresholdEfforts: [],
      paceHrPoints: [],
      workoutsAnalyzed: workouts.length,
      workoutsWithHR: workouts.filter(w => w.averageHeartRate && w.averageHeartRate > 0).length,
      dateRange: workouts.length > 0
        ? {
            earliest: workouts.reduce((min, w) => w.date < min ? w.date : min, workouts[0].date),
            latest: workouts.reduce((max, w) => w.date > max ? w.date : max, workouts[0].date),
          }
        : { earliest: '', latest: '' },
    },
  };
}

/** Compute the coefficient of variation (stddev / mean) */
export function computeCoefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** Compute the average of an array */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
