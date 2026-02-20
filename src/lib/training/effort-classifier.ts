/**
 * Effort Classification System — 7-Stage Deterministic Pipeline
 *
 * Replaces the simple if/else pace-based classification in EnhancedSplits.tsx
 * with a context-aware, GPS-glitch-robust, HR-trend-aware classifier.
 *
 * Stages:
 *   1. Resolve Zones — from VDOT, manual settings, or run data
 *   2. Infer Run Mode — easy_run / workout / race
 *   3. Raw Per-Split Classification
 *   4. Rolling Window Smoothing (3-split window)
 *   5. Anomaly Detection
 *   6. Contextual Hysteresis
 *   7. Confidence Scoring
 */

import { calculatePaceZones } from './vdot-calculator';
import type { ZoneDistribution } from './types';

// ======================== Types ========================

export type EffortCategory =
  | 'warmup' | 'cooldown' | 'recovery'  // structural
  | 'easy' | 'steady' | 'marathon' | 'tempo' | 'threshold' | 'interval'  // effort
  | 'anomaly';  // data quality

export type RunMode = 'easy_run' | 'workout' | 'race';

export interface ClassifiedSplit {
  lapNumber: number;
  category: EffortCategory;
  categoryLabel: string;
  confidence: number;
  rawCategory: EffortCategory;
  anomalyReason?: string;
  hrAgreement?: boolean;
}

export interface ClassifyOptions {
  vdot?: number | null;
  easyPace?: number | null;
  tempoPace?: number | null;
  thresholdPace?: number | null;
  intervalPace?: number | null;
  marathonPace?: number | null;
  workoutType?: string;
  avgPaceSeconds?: number | null;
  /** Weather+elevation pace adjustment in sec/mi (positive = slower conditions) */
  conditionAdjustment?: number;
}

interface Lap {
  lapNumber: number;
  distanceMiles: number;
  durationSeconds: number;
  avgPaceSeconds: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainFeet: number | null;
  lapType: string;
}

export interface ZoneBoundaries {
  recovery?: number; // pace >= this → Recovery (optional, falls back to 900s)
  easy: number;      // pace >= this → Easy (higher = slower)
  steady: number;    // pace >= this → Steady
  marathon: number;  // pace >= this → Marathon
  tempo: number;     // pace >= this → Tempo
  threshold: number; // pace >= this → Threshold
  interval: number;  // pace >= this → still Threshold; pace < this → Interval
}

// ======================== Labels ========================

const CATEGORY_LABELS: Record<EffortCategory, string> = {
  warmup: 'Warmup',
  cooldown: 'Cooldown',
  recovery: 'Recovery',
  easy: 'Easy',
  steady: 'Steady',
  marathon: 'Marathon',
  tempo: 'Tempo',
  threshold: 'Threshold',
  interval: 'Interval',
  anomaly: 'Anomaly',
};

// ======================== Stage 1: Resolve Zones ========================

export function resolveZones(laps: Lap[], options: ClassifyOptions): ZoneBoundaries {
  // Weather/elevation adjustment: shift all zone boundaries slower (higher sec/mi)
  // so that a 7:50 run at 90°F is correctly classified as "easy" if adj = +15s
  const adj = options.conditionAdjustment || 0;

  // Priority 1: VDOT-based zones
  if (options.vdot && options.vdot > 0) {
    const zones = calculatePaceZones(options.vdot);
    return {
      // Keep classifier boundaries aligned with the same VDOT curve used in settings.
      recovery: zones.recovery + adj,
      easy: zones.easy + adj,
      steady: zones.generalAerobic + adj,
      marathon: zones.marathon + adj,
      tempo: zones.tempo + adj,
      threshold: zones.threshold + adj,
      interval: zones.interval + adj,
    };
  }

  // Priority 2: Manual pace settings
  if (options.easyPace && options.easyPace > 0) {
    const marathonBound = options.marathonPace && options.marathonPace > 0
      ? options.marathonPace
      : options.easyPace - 45;
    const tempoBound = options.tempoPace && options.tempoPace > 0
      ? options.tempoPace
      : marathonBound - 25;
    const thresholdBound = options.thresholdPace && options.thresholdPace > 0
      ? options.thresholdPace
      : tempoBound - 15;
    const intervalBound = options.intervalPace && options.intervalPace > 0
      ? options.intervalPace
      : thresholdBound - 15;
    const steadyBound = Math.round((options.easyPace + marathonBound) / 2);
    return {
      easy: options.easyPace + adj,
      steady: steadyBound + adj,
      marathon: marathonBound + adj,
      tempo: tempoBound + adj,
      threshold: thresholdBound + adj,
      interval: intervalBound + adj,
    };
  }

  // Priority 3: Estimate from the run's own data
  // Note: no condition adjustment here — boundaries are derived from the run's own
  // (already-affected) paces, so shifting would double-count
  const validPaces = laps
    .map(l => l.avgPaceSeconds)
    .filter(p => p > 180 && p < 900);

  if (validPaces.length === 0) {
    // Fallback uses avgPaceSeconds (raw, unadjusted) — apply condition adjustment
    const fallback = options.avgPaceSeconds || 500;
    return {
      easy: fallback + 40 + adj,
      steady: fallback + 10 + adj,
      marathon: fallback - 20 + adj,
      tempo: fallback - 45 + adj,
      threshold: fallback - 60 + adj,
      interval: fallback - 85 + adj,
    };
  }

  const sorted = [...validPaces].sort((a, b) => a - b);
  const medianPace = sorted[Math.floor(sorted.length / 2)];

  // Median-derived zones use the run's own lap paces which are already affected by
  // conditions, but the classification stage compares raw lap paces against these
  // boundaries, so we still need to shift by adj to avoid mis-classifying
  // condition-affected runs as harder than they are.
  return {
    easy: medianPace + 20 + adj,
    steady: medianPace - 10 + adj,
    marathon: medianPace - 30 + adj,
    tempo: medianPace - 45 + adj,
    threshold: medianPace - 60 + adj,
    interval: medianPace - 85 + adj,
  };
}

// ======================== Stage 2: Infer Run Mode ========================

function inferRunMode(laps: Lap[], options: ClassifyOptions, zones: ZoneBoundaries): RunMode {
  const wt = (options.workoutType || '').toLowerCase();

  // Explicit workout types
  if (wt === 'race') return 'race';
  if (wt === 'interval' || wt === 'speed' || wt === 'tempo' || wt === 'threshold') return 'workout';
  if (wt === 'easy' || wt === 'recovery') return 'easy_run';

  // Infer from data
  const validPaces = laps
    .map(l => l.avgPaceSeconds)
    .filter(p => p > 180 && p < 900);

  if (validPaces.length < 2) return 'easy_run';

  const mean = validPaces.reduce((a, b) => a + b, 0) / validPaces.length;
  const variance = validPaces.reduce((sum, p) => sum + (p - mean) ** 2, 0) / validPaces.length;
  const cv = Math.sqrt(variance) / mean;

  // Count splits at or above tempo
  const fastSplits = validPaces.filter(p => p <= zones.tempo).length;
  const fastProportion = fastSplits / validPaces.length;

  // High variability with some fast splits → workout (intervals)
  if (cv > 0.08 && fastProportion > 0.2) return 'workout';

  // Most splits are fast with low variability → race
  if (fastProportion > 0.7 && cv < 0.05) return 'race';

  // Default: easy run
  return 'easy_run';
}

// ======================== Stage 3: Raw Classification ========================

function classifyRaw(pace: number, zones: ZoneBoundaries): EffortCategory {
  // Recovery: VDOT-based threshold when available, else 15:00/mi for walking/stopped
  const recoveryThreshold = zones.recovery ?? 900;
  if (pace > recoveryThreshold) return 'recovery';

  // Higher pace value = slower; zone boundaries are in sec/mi
  if (pace >= zones.easy) return 'easy';
  if (pace >= zones.steady) return 'steady';
  if (pace >= zones.marathon) return 'marathon';
  if (pace >= zones.tempo) return 'tempo';
  if (pace >= zones.threshold) return 'threshold';
  return 'interval';  // anything faster than threshold is interval/VO2max territory
}

function detectStructural(
  laps: Lap[],
  rawCategories: EffortCategory[],
  zones: ZoneBoundaries,
  runMode: RunMode,
): EffortCategory[] {
  const result = [...rawCategories];
  const n = laps.length;
  if (n < 5) return result;

  const skipCategories: EffortCategory[] = ['warmup', 'cooldown', 'recovery', 'anomaly'];

  // Only use valid-pace splits for median calculation
  const validPaces = laps
    .map(l => l.avgPaceSeconds)
    .filter(p => p > 180 && p < 900);
  const medianPace = validPaces.length > 0
    ? [...validPaces].sort((a, b) => a - b)[Math.floor(validPaces.length / 2)]
    : zones.steady;

  // Warmup: first 1-2 splits if significantly slower than run median
  // but not if they're recovery-pace (rest periods don't count as warmup)
  if (laps[0].avgPaceSeconds > medianPace + 20 && laps[0].avgPaceSeconds < 900) {
    result[0] = 'warmup';
    // Check second split too
    if (n > 5 && laps[1].avgPaceSeconds > medianPace + 15 && laps[1].avgPaceSeconds < 900) {
      result[1] = 'warmup';
    }
  }

  // Cooldown: last split(s) if significantly slower after faster splits
  // but not if they're recovery-pace rest periods
  if (n >= 5) {
    const lastPace = laps[n - 1].avgPaceSeconds;
    const prevPace = laps[n - 2].avgPaceSeconds;
    if (lastPace > medianPace + 20 && lastPace < 900 && lastPace > prevPace + 10) {
      result[n - 1] = 'cooldown';
    }
  }

  // In race mode: for marathon+ distance races, reclassify sustained main-body
  // splits as "marathon" when they fall in the tempo-marathon boundary zone.
  // This handles cases where a runner's VDOT-predicted marathon pace is slower
  // than their actual race pace (e.g., PR attempts).
  if (runMode === 'race') {
    const totalDist = laps.reduce((sum, l) => sum + l.distanceMiles, 0);
    if (totalDist >= 25) {
      // Marathon-distance race: main-body splits between marathon and tempo zones
      // should be classified as "marathon" not "tempo"
      for (let i = 0; i < laps.length; i++) {
        if (skipCategories.includes(result[i])) continue;
        if (result[i] === 'tempo') {
          const pace = laps[i].avgPaceSeconds;
          // Within 40s faster than marathon boundary → still marathon effort in a marathon
          if (pace < zones.marathon && pace >= zones.marathon - 40) {
            result[i] = 'marathon';
          }
        }
      }
    }
  }

  // In workout mode: mark very slow splits as recovery (rest between intervals)
  if (runMode === 'workout') {
    for (let i = 0; i < n; i++) {
      if (result[i] === 'recovery') continue; // already marked by classifyRaw
      // Slow splits that are clearly rest periods
      if (laps[i].avgPaceSeconds > zones.easy + 30) {
        result[i] = 'recovery';
      }
    }
  }

  return result;
}

// ======================== Stage 4: Rolling Window Smoothing ========================

function smoothCategories(categories: EffortCategory[], anomalies: boolean[]): EffortCategory[] {
  const result = [...categories];
  const n = categories.length;
  if (n < 3) return result;

  const skipCategories: EffortCategory[] = ['warmup', 'cooldown', 'recovery', 'anomaly'];

  for (let i = 1; i < n - 1; i++) {
    // Skip structural, recovery, and anomaly splits
    if (skipCategories.includes(result[i])) continue;
    if (anomalies[i]) continue;

    const prev = result[i - 1];
    const curr = result[i];
    const next = result[i + 1];

    // Skip if neighbors are structural/recovery
    if (skipCategories.includes(prev) || skipCategories.includes(next)) continue;

    // If both neighbors agree and current differs → smooth to match
    if (prev === next && curr !== prev) {
      result[i] = prev;
    }
  }

  return result;
}

// ======================== Stage 5: Anomaly Detection ========================

interface AnomalyResult {
  isAnomaly: boolean;
  reason?: string;
}

function detectAnomaly(lap: Lap): AnomalyResult {
  const pace = lap.avgPaceSeconds;

  // GPS tunnel/underpass artifact — impossibly fast
  if (pace < 180) {
    return { isAnomaly: true, reason: `Pace ${formatPaceShort(pace)} is below 3:00/mi — likely GPS artifact` };
  }

  // Very short split with normal running pace — likely GPS noise
  // (Short splits with very slow pace are rest periods, not anomalies)
  if (lap.distanceMiles < 0.15 && pace <= 900) {
    return { isAnomaly: true, reason: `Very short split (${lap.distanceMiles.toFixed(2)} mi) — insufficient data` };
  }

  return { isAnomaly: false };
}

function formatPaceShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ======================== Stage 6: Contextual Hysteresis ========================

const EFFORT_ORDER: EffortCategory[] = ['easy', 'steady', 'marathon', 'tempo', 'threshold', 'interval'];

function applyHysteresis(
  laps: Lap[],
  categories: EffortCategory[],
  zones: ZoneBoundaries,
  runMode: RunMode,
): EffortCategory[] {
  const result = [...categories];
  const skipCategories: EffortCategory[] = ['warmup', 'cooldown', 'recovery', 'anomaly'];

  // Buffer bands for hysteresis (in seconds/mi)
  const PROMOTE_BUFFER = 5;   // Must be 5s faster than boundary to promote
  const DEMOTE_BUFFER = 3;    // Must be 3s slower than boundary to demote

  const zoneBoundaryArray = [
    { boundary: zones.easy, lower: 'steady' as EffortCategory, upper: 'easy' as EffortCategory },
    { boundary: zones.steady, lower: 'marathon' as EffortCategory, upper: 'steady' as EffortCategory },
    { boundary: zones.marathon, lower: 'tempo' as EffortCategory, upper: 'marathon' as EffortCategory },
    { boundary: zones.tempo, lower: 'threshold' as EffortCategory, upper: 'tempo' as EffortCategory },
    { boundary: zones.threshold, lower: 'interval' as EffortCategory, upper: 'threshold' as EffortCategory },
  ];

  for (let i = 0; i < laps.length; i++) {
    if (skipCategories.includes(result[i])) continue;

    const pace = laps[i].avgPaceSeconds;
    const prevCategory = i > 0 ? result[i - 1] : null;

    // Apply hysteresis: if previous split had a category, require stronger evidence to change
    if (prevCategory && !skipCategories.includes(prevCategory) && EFFORT_ORDER.includes(prevCategory)) {
      for (const zb of zoneBoundaryArray) {
        const distFromBoundary = zb.boundary - pace; // positive = faster than boundary

        if (Math.abs(distFromBoundary) < Math.max(PROMOTE_BUFFER, DEMOTE_BUFFER)) {
          if (prevCategory === zb.upper && distFromBoundary > 0 && distFromBoundary < PROMOTE_BUFFER) {
            result[i] = zb.upper;
          } else if (prevCategory === zb.lower && distFromBoundary < 0 && Math.abs(distFromBoundary) < DEMOTE_BUFFER) {
            result[i] = zb.lower;
          }
        }
      }
    }

    // Run mode context adjustments
    if (runMode === 'easy_run') {
      // Bias toward Easy/Steady on easy runs
      const effortIdx = EFFORT_ORDER.indexOf(result[i]);
      if (effortIdx >= 3) { // tempo or harder
        const relevantBoundary = effortIdx === 3 ? zones.tempo
          : effortIdx === 4 ? zones.threshold
          : zones.threshold - 15;
        if (pace > relevantBoundary - PROMOTE_BUFFER) {
          result[i] = EFFORT_ORDER[Math.max(0, effortIdx - 1)];
        }
      }
    } else if (runMode === 'race') {
      // Bias toward the dominant effort category
      const effortCounts = new Map<EffortCategory, number>();
      for (const cat of result) {
        if (!skipCategories.includes(cat)) {
          effortCounts.set(cat, (effortCounts.get(cat) || 0) + 1);
        }
      }
      let dominant: EffortCategory = 'steady';
      let maxCount = 0;
      for (const [cat, count] of effortCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominant = cat;
        }
      }
      const currIdx = EFFORT_ORDER.indexOf(result[i]);
      const domIdx = EFFORT_ORDER.indexOf(dominant);
      if (currIdx >= 0 && domIdx >= 0 && Math.abs(currIdx - domIdx) === 1) {
        const relevantBoundary = currIdx < domIdx
          ? zoneBoundaryArray[currIdx]?.boundary
          : zoneBoundaryArray[domIdx]?.boundary;
        if (relevantBoundary !== undefined) {
          const dist = Math.abs(pace - relevantBoundary);
          if (dist < 8) {
            result[i] = dominant;
          }
        }
      }
    }
  }

  // Detect recovery splits in workout mode
  // (catches splits that weren't caught in structural detection)
  if (runMode === 'workout') {
    const isHard = (c: EffortCategory) =>
      c === 'tempo' || c === 'threshold' || c === 'interval';

    for (let i = 1; i < laps.length - 1; i++) {
      if (skipCategories.includes(result[i])) continue;
      const prev = result[i - 1];
      const next = result[i + 1];

      // A slow split between two hard splits → recovery
      if (isHard(prev) && isHard(next) && (result[i] === 'easy' || result[i] === 'steady')) {
        result[i] = 'recovery';
      }
      // Slow split adjacent to hard effort in workout context
      if ((isHard(prev) || isHard(next)) && laps[i].avgPaceSeconds > zones.easy) {
        result[i] = 'recovery';
      }
    }
  }

  return result;
}

// ======================== Stage 7: Confidence Scoring ========================

function scoreConfidence(
  lap: Lap,
  category: EffortCategory,
  rawCategory: EffortCategory,
  zones: ZoneBoundaries,
  prevLap: Lap | null,
  nextLap: Lap | null,
  isAnomaly: boolean,
): { confidence: number; hrAgreement?: boolean } {
  if (isAnomaly) return { confidence: 0.2 };

  const pace = lap.avgPaceSeconds;
  let confidence = 0.8;

  // Recovery splits from very slow paces → high confidence (clearly resting)
  if (category === 'recovery' && pace > 900) {
    return { confidence: 0.9 };
  }

  // Check distance from zone boundaries
  const boundaries = [zones.easy, zones.steady, zones.marathon, zones.tempo, zones.threshold, zones.interval];
  const minDistToBoundary = Math.min(...boundaries.map(b => Math.abs(pace - b)));
  if (minDistToBoundary > 15) confidence += 0.1;
  if (minDistToBoundary < 5) confidence -= 0.2;

  // Check neighbor agreement (only with valid-pace neighbors)
  const neighborsAgree = checkNeighborAgreement(category, prevLap, nextLap, zones);
  if (!neighborsAgree) confidence -= 0.2;

  // Smoothing changed the category
  if (rawCategory !== category && !(['warmup', 'cooldown', 'recovery'] as EffortCategory[]).includes(category)) {
    confidence -= 0.1;
  }

  // HR agreement check
  let hrAgreement: boolean | undefined;
  if (lap.avgHeartRate && lap.avgHeartRate > 0) {
    hrAgreement = checkHRAgreement(lap.avgHeartRate, category);
    if (hrAgreement) {
      confidence += 0.1;
    } else {
      confidence -= 0.2;
    }
  }

  // Short splits get slightly lower confidence
  if (lap.distanceMiles < 0.5) {
    confidence -= 0.1;
  }

  return {
    confidence: Math.max(0.2, Math.min(1.0, Math.round(confidence * 100) / 100)),
    hrAgreement,
  };
}

function checkNeighborAgreement(
  category: EffortCategory,
  prevLap: Lap | null,
  nextLap: Lap | null,
  zones: ZoneBoundaries,
): boolean {
  let agree = 0;
  let total = 0;

  if (prevLap && prevLap.avgPaceSeconds > 180 && prevLap.avgPaceSeconds < 900) {
    total++;
    if (classifyRaw(prevLap.avgPaceSeconds, zones) === category) agree++;
  }
  if (nextLap && nextLap.avgPaceSeconds > 180 && nextLap.avgPaceSeconds < 900) {
    total++;
    if (classifyRaw(nextLap.avgPaceSeconds, zones) === category) agree++;
  }

  return total === 0 || agree > 0;
}

function checkHRAgreement(hr: number, category: EffortCategory): boolean {
  const hrZones: Record<string, [number, number]> = {
    recovery: [60, 130],
    easy: [90, 145],
    steady: [120, 155],
    marathon: [140, 165],
    tempo: [150, 175],
    threshold: [160, 185],
    interval: [165, 200],
  };

  const zone = hrZones[category];
  if (!zone) return true; // structural categories always "agree"
  return hr >= zone[0] && hr <= zone[1];
}

// ======================== Entry Point ========================

export interface ClassificationWithZones {
  splits: ClassifiedSplit[];
  zones: ZoneBoundaries;
}

function _classifyInternal(laps: Lap[], options: ClassifyOptions): ClassificationWithZones {
  if (!laps.length) return { splits: [], zones: { easy: 0, steady: 0, marathon: 0, tempo: 0, threshold: 0, interval: 0 } };

  // Stage 1: Resolve zone boundaries
  const zones = resolveZones(laps, options);

  // Stage 2: Infer run mode
  const runMode = inferRunMode(laps, options, zones);

  // Stage 3: Raw per-split classification
  // (includes recovery for very slow splits like rest periods)
  let categories: EffortCategory[] = laps.map(lap => classifyRaw(lap.avgPaceSeconds, zones));

  // Detect structural categories (warmup/cooldown/recovery in workouts)
  categories = detectStructural(laps, categories, zones, runMode);

  const rawCategories = [...categories];

  // Stage 5: Anomaly detection (conservative — only truly implausible data)
  const anomalyResults: AnomalyResult[] = laps.map((lap) => detectAnomaly(lap));
  const anomalies = anomalyResults.map(a => a.isAnomaly);

  // Mark anomalies in categories
  anomalies.forEach((isAnomaly, i) => {
    if (isAnomaly) categories[i] = 'anomaly';
  });

  // Stage 4: Rolling window smoothing (skip anomalies and recovery)
  categories = smoothCategories(categories, anomalies);

  // Stage 6: Contextual hysteresis
  categories = applyHysteresis(laps, categories, zones, runMode);

  // Re-apply anomalies (hysteresis shouldn't override them)
  anomalies.forEach((isAnomaly, i) => {
    if (isAnomaly) categories[i] = 'anomaly';
  });

  // Stage 7: Confidence scoring + build results
  const splits = laps.map((lap, i): ClassifiedSplit => {
    const category = categories[i];
    const { confidence, hrAgreement } = scoreConfidence(
      lap,
      category,
      rawCategories[i],
      zones,
      i > 0 ? laps[i - 1] : null,
      i < laps.length - 1 ? laps[i + 1] : null,
      anomalies[i],
    );

    return {
      lapNumber: lap.lapNumber,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      confidence,
      rawCategory: rawCategories[i],
      anomalyReason: anomalyResults[i].reason,
      hrAgreement,
    };
  });

  return { splits, zones };
}

export function classifySplitEfforts(laps: Lap[], options: ClassifyOptions): ClassifiedSplit[] {
  return _classifyInternal(laps, options).splits;
}

export function classifySplitEffortsWithZones(laps: Lap[], options: ClassifyOptions): ClassificationWithZones {
  return _classifyInternal(laps, options);
}

// ======================== Zone Distribution ========================

/**
 * Sum minutes per zone from classified splits + segment durations.
 */
export function computeZoneDistribution(
  classifiedSplits: ClassifiedSplit[],
  segments: { durationSeconds: number | null }[],
): ZoneDistribution {
  const dist: ZoneDistribution = {
    recovery: 0, easy: 0, steady: 0, marathon: 0,
    tempo: 0, threshold: 0, interval: 0,
    warmup: 0, cooldown: 0, anomaly: 0,
  };

  for (let i = 0; i < classifiedSplits.length; i++) {
    const cat = classifiedSplits[i].category;
    const minutes = (segments[i]?.durationSeconds || 0) / 60;
    if (cat in dist) {
      dist[cat as keyof ZoneDistribution] += minutes;
    }
  }

  // Round to one decimal
  for (const key of Object.keys(dist) as (keyof ZoneDistribution)[]) {
    dist[key] = Math.round(dist[key] * 10) / 10;
  }

  return dist;
}

/**
 * Derive the workout's main purpose from zone distribution.
 * - Preserves race/cross_train if explicitly set
 * - Excludes warmup/cooldown from main body calculation
 * - Remaps steady → easy (steady is an effort level, not a workout type)
 * - Marathon requires >60% dominance to classify as marathon
 * - Long run check: distance >=9mi or duration >=75min → "long"
 * - If >20% is hard work → call it by the dominant hard zone
 */
export function deriveWorkoutType(
  distribution: ZoneDistribution,
  workout: { workoutType?: string | null; distanceMiles?: number | null; durationMinutes?: number | null },
): string {
  const wt = workout.workoutType?.toLowerCase();

  // Preserve explicitly-set special types
  if (wt === 'race' || wt === 'cross_train') {
    return wt;
  }

  // Main body = everything except warmup, cooldown, anomaly
  const mainBody = {
    recovery: distribution.recovery,
    easy: distribution.easy,
    steady: distribution.steady,
    marathon: distribution.marathon,
    tempo: distribution.tempo,
    threshold: distribution.threshold,
    interval: distribution.interval,
  };

  const totalMainMinutes = Object.values(mainBody).reduce((a, b) => a + b, 0);
  if (totalMainMinutes === 0) return wt || 'easy';

  // Long run check (lowered from 10mi to 9mi)
  const totalAllMinutes = totalMainMinutes + distribution.warmup + distribution.cooldown;
  if ((workout.distanceMiles && workout.distanceMiles >= 9) ||
      (totalAllMinutes >= 75)) {
    return 'long';
  }

  // Find dominant zone
  const entries = Object.entries(mainBody) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const dominant = entries[0];
  const dominantPct = (dominant[1] / totalMainMinutes) * 100;

  // Recovery stays recovery
  if (dominant[0] === 'recovery') return 'recovery';

  // Threshold → tempo (functionally the same training stimulus)
  if (dominant[0] === 'threshold') return 'tempo';

  // If >50% is one zone, use that (steady, easy, marathon all stay distinct)
  if (dominantPct > 50) {
    return dominant[0];
  }

  // Check hard work (tempo + threshold + interval)
  const hardMinutes = mainBody.tempo + mainBody.threshold + mainBody.interval;
  const hardPct = (hardMinutes / totalMainMinutes) * 100;

  if (hardPct >= 20) {
    // Return the dominant hard zone — merge threshold into tempo
    const hardZones = [
      ['interval', mainBody.interval],
      ['tempo', mainBody.threshold + mainBody.tempo],
    ] as [string, number][];
    hardZones.sort((a, b) => b[1] - a[1]);
    return hardZones[0][0];
  }

  // Default to easy for aerobic-dominant runs
  return 'easy';
}
