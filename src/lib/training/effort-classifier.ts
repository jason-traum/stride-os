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

// ======================== Types ========================

export type EffortCategory =
  | 'warmup' | 'cooldown' | 'recovery'  // structural
  | 'steady' | 'marathon' | 'tempo' | 'threshold' | 'interval'  // effort
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

interface ZoneBoundaries {
  steady: number;   // pace >= this → Steady (higher = slower)
  marathon: number;  // pace >= this → Marathon
  tempo: number;     // pace >= this → Tempo
  threshold: number; // pace >= this → Threshold
  // pace < threshold → Interval
}

// ======================== Labels ========================

const CATEGORY_LABELS: Record<EffortCategory, string> = {
  warmup: 'Warmup',
  cooldown: 'Cooldown',
  recovery: 'Recovery',
  steady: 'Steady',
  marathon: 'Marathon',
  tempo: 'Tempo',
  threshold: 'Threshold',
  interval: 'Interval',
  anomaly: 'Anomaly',
};

// ======================== Stage 1: Resolve Zones ========================

function resolveZones(laps: Lap[], options: ClassifyOptions): ZoneBoundaries {
  // Priority 1: VDOT-based zones
  if (options.vdot && options.vdot > 0) {
    const zones = calculatePaceZones(options.vdot);
    return {
      steady: zones.easy,         // Easy pace = steady boundary
      marathon: zones.marathon,
      tempo: zones.tempo,
      threshold: zones.threshold,
    };
  }

  // Priority 2: Manual pace settings
  if (options.easyPace && options.easyPace > 0) {
    return {
      steady: options.easyPace,
      marathon: options.marathonPace && options.marathonPace > 0
        ? options.marathonPace
        : options.easyPace - 30,
      tempo: options.tempoPace && options.tempoPace > 0
        ? options.tempoPace
        : options.easyPace - 60,
      threshold: options.thresholdPace && options.thresholdPace > 0
        ? options.thresholdPace
        : options.easyPace - 75,
    };
  }

  // Priority 3: Estimate from the run's own data
  const validPaces = laps
    .map(l => l.avgPaceSeconds)
    .filter(p => p > 180 && p < 900);

  if (validPaces.length === 0) {
    const fallback = options.avgPaceSeconds || 500;
    return {
      steady: fallback + 30,
      marathon: fallback,
      tempo: fallback - 30,
      threshold: fallback - 45,
    };
  }

  const sorted = [...validPaces].sort((a, b) => a - b);
  const medianPace = sorted[Math.floor(sorted.length / 2)];

  // Use median as the "steady" anchor and derive zones from % offsets
  return {
    steady: medianPace + 20,      // slightly slower than median → steady
    marathon: medianPace - 10,    // ~10s faster than median
    tempo: medianPace - 40,       // ~40s faster
    threshold: medianPace - 55,   // ~55s faster
  };
}

// ======================== Stage 2: Infer Run Mode ========================

function inferRunMode(laps: Lap[], options: ClassifyOptions, zones: ZoneBoundaries): RunMode {
  const wt = (options.workoutType || '').toLowerCase();

  // Explicit workout types
  if (wt === 'race') return 'race';
  if (wt === 'interval' || wt === 'tempo' || wt === 'threshold') return 'workout';
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
  // Higher pace value = slower; zone boundaries are in sec/mi
  if (pace >= zones.steady) return 'steady';
  if (pace >= zones.marathon) return 'marathon';
  if (pace >= zones.tempo) return 'tempo';
  if (pace >= zones.threshold) return 'threshold';
  return 'interval';
}

function detectStructural(
  laps: Lap[],
  rawCategories: EffortCategory[],
  zones: ZoneBoundaries,
): EffortCategory[] {
  const result = [...rawCategories];
  const n = laps.length;
  if (n < 5) return result;

  const validPaces = laps
    .map(l => l.avgPaceSeconds)
    .filter(p => p > 180 && p < 900);
  const medianPace = validPaces.length > 0
    ? [...validPaces].sort((a, b) => a - b)[Math.floor(validPaces.length / 2)]
    : zones.steady;

  // Warmup: first 1-2 splits if significantly slower than run median
  if (laps[0].avgPaceSeconds > medianPace + 20) {
    result[0] = 'warmup';
    // Check second split too
    if (n > 5 && laps[1].avgPaceSeconds > medianPace + 15) {
      result[1] = 'warmup';
    }
  }

  // Cooldown: last split(s) if significantly slower after faster splits
  if (n >= 5) {
    const lastPace = laps[n - 1].avgPaceSeconds;
    const prevPace = laps[n - 2].avgPaceSeconds;
    if (lastPace > medianPace + 20 && lastPace > prevPace + 10) {
      result[n - 1] = 'cooldown';
    }
  }

  // Recovery: in workout mode, splits between hard efforts that are much slower
  // (detected later in hysteresis stage based on run mode)

  return result;
}

// ======================== Stage 4: Rolling Window Smoothing ========================

function smoothCategories(categories: EffortCategory[], anomalies: boolean[]): EffortCategory[] {
  const result = [...categories];
  const n = categories.length;
  if (n < 3) return result;

  const structuralCategories: EffortCategory[] = ['warmup', 'cooldown', 'recovery', 'anomaly'];

  for (let i = 1; i < n - 1; i++) {
    // Skip structural and anomaly splits
    if (structuralCategories.includes(result[i])) continue;
    if (anomalies[i]) continue;

    const prev = result[i - 1];
    const curr = result[i];
    const next = result[i + 1];

    // Skip if neighbors are structural
    if (structuralCategories.includes(prev) || structuralCategories.includes(next)) continue;

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

function detectAnomaly(lap: Lap, prevLap: Lap | null, nextLap: Lap | null): AnomalyResult {
  const pace = lap.avgPaceSeconds;

  // GPS tunnel/underpass artifact
  if (pace < 180) {
    return { isAnomaly: true, reason: `Pace ${formatPaceShort(pace)} is below 3:00/mi — likely GPS artifact` };
  }

  // GPS signal loss / stopped moving
  if (pace > 900) {
    return { isAnomaly: true, reason: `Pace ${formatPaceShort(pace)} exceeds 15:00/mi — likely GPS signal loss` };
  }

  // Sudden GPS jump: pace change > 120s from both neighbors
  if (prevLap && nextLap) {
    const prevDiff = Math.abs(pace - prevLap.avgPaceSeconds);
    const nextDiff = Math.abs(pace - nextLap.avgPaceSeconds);
    if (prevDiff > 120 && nextDiff > 120) {
      return { isAnomaly: true, reason: 'Sudden pace change from both neighbors — likely GPS glitch' };
    }
  }

  // Partial split at end (< 0.5 miles often unreliable)
  if (lap.distanceMiles < 0.5) {
    return { isAnomaly: true, reason: `Short split (${lap.distanceMiles.toFixed(2)} mi) — insufficient data` };
  }

  return { isAnomaly: false };
}

function formatPaceShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ======================== Stage 6: Contextual Hysteresis ========================

const EFFORT_ORDER: EffortCategory[] = ['steady', 'marathon', 'tempo', 'threshold', 'interval'];

function applyHysteresis(
  laps: Lap[],
  categories: EffortCategory[],
  zones: ZoneBoundaries,
  runMode: RunMode,
): EffortCategory[] {
  const result = [...categories];
  const structuralCategories: EffortCategory[] = ['warmup', 'cooldown', 'recovery', 'anomaly'];

  // Buffer bands for hysteresis (in seconds/mi)
  const PROMOTE_BUFFER = 5;   // Must be 5s faster than boundary to promote
  const DEMOTE_BUFFER = 3;    // Must be 3s slower than boundary to demote

  const zoneBoundaryArray = [
    { boundary: zones.steady, lower: 'marathon' as EffortCategory, upper: 'steady' as EffortCategory },
    { boundary: zones.marathon, lower: 'tempo' as EffortCategory, upper: 'marathon' as EffortCategory },
    { boundary: zones.tempo, lower: 'threshold' as EffortCategory, upper: 'tempo' as EffortCategory },
    { boundary: zones.threshold, lower: 'interval' as EffortCategory, upper: 'threshold' as EffortCategory },
  ];

  for (let i = 0; i < laps.length; i++) {
    if (structuralCategories.includes(result[i])) continue;

    const pace = laps[i].avgPaceSeconds;
    const prevCategory = i > 0 ? result[i - 1] : null;

    // Apply hysteresis: if previous split had a category, require stronger evidence to change
    if (prevCategory && !structuralCategories.includes(prevCategory) && EFFORT_ORDER.includes(prevCategory)) {
      for (const zb of zoneBoundaryArray) {
        // If pace is near this boundary
        const distFromBoundary = zb.boundary - pace; // positive = faster than boundary

        if (Math.abs(distFromBoundary) < Math.max(PROMOTE_BUFFER, DEMOTE_BUFFER)) {
          if (prevCategory === zb.upper && distFromBoundary > 0 && distFromBoundary < PROMOTE_BUFFER) {
            // Near boundary, was in upper zone, not enough to promote → stay
            result[i] = zb.upper;
          } else if (prevCategory === zb.lower && distFromBoundary < 0 && Math.abs(distFromBoundary) < DEMOTE_BUFFER) {
            // Near boundary, was in lower zone, not enough to demote → stay
            result[i] = zb.lower;
          }
        }
      }
    }

    // Run mode context adjustments
    if (runMode === 'easy_run') {
      // Bias toward Steady on easy runs — only classify faster if clearly in zone
      const effortIdx = EFFORT_ORDER.indexOf(result[i]);
      if (effortIdx >= 2) { // tempo or harder
        // Check if pace is really clearly in that zone (at least 5s past boundary)
        const relevantBoundary = effortIdx === 2 ? zones.tempo
          : effortIdx === 3 ? zones.threshold
          : zones.threshold - 15;
        if (pace > relevantBoundary - PROMOTE_BUFFER) {
          // Not clearly in the faster zone → demote one level
          result[i] = EFFORT_ORDER[Math.max(0, effortIdx - 1)];
        }
      }
    } else if (runMode === 'race') {
      // Bias toward the dominant effort category
      const effortCounts = new Map<EffortCategory, number>();
      for (const cat of result) {
        if (!structuralCategories.includes(cat)) {
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
      // If this split is adjacent to the dominant category, pull it in
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
  if (runMode === 'workout') {
    for (let i = 1; i < laps.length - 1; i++) {
      if (structuralCategories.includes(result[i])) continue;
      const prev = result[i - 1];
      const next = result[i + 1];
      const isHard = (c: EffortCategory) =>
        c === 'tempo' || c === 'threshold' || c === 'interval';

      // A slow split between two hard splits → recovery
      if (isHard(prev) && isHard(next) && result[i] === 'steady') {
        result[i] = 'recovery';
      }
      // Or a steady split that is much slower than neighbors in workout context
      if (isHard(prev) || isHard(next)) {
        if (result[i] === 'steady' && laps[i].avgPaceSeconds > zones.steady + 15) {
          result[i] = 'recovery';
        }
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
  let confidence = 0.8; // Base: pace in zone, no HR, assume neighbors agree

  // Check distance from zone boundaries — farther from boundary = higher confidence
  const boundaries = [zones.steady, zones.marathon, zones.tempo, zones.threshold];
  const minDistToBoundary = Math.min(...boundaries.map(b => Math.abs(pace - b)));
  if (minDistToBoundary > 15) confidence += 0.1;
  if (minDistToBoundary < 5) confidence -= 0.2;

  // Check neighbor agreement
  const neighborsAgree = checkNeighborAgreement(category, prevLap, nextLap, zones);
  if (!neighborsAgree) confidence -= 0.2;

  // Smoothing changed the category
  if (rawCategory !== category && category !== 'warmup' && category !== 'cooldown' && category !== 'recovery') {
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
  // Rough HR zone expectations (assuming ~185 max HR)
  // These are approximate and work as a directional check
  const hrZones: Record<string, [number, number]> = {
    recovery: [90, 130],
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

export function classifySplitEfforts(laps: Lap[], options: ClassifyOptions): ClassifiedSplit[] {
  if (!laps.length) return [];

  // Stage 1: Resolve zone boundaries
  const zones = resolveZones(laps, options);

  // Stage 2: Infer run mode
  const runMode = inferRunMode(laps, options, zones);

  // Stage 3: Raw per-split classification
  let categories: EffortCategory[] = laps.map(lap => classifyRaw(lap.avgPaceSeconds, zones));

  // Detect structural categories (warmup/cooldown)
  categories = detectStructural(laps, categories, zones);

  const rawCategories = [...categories];

  // Stage 5: Anomaly detection (before smoothing so anomalies are excluded)
  const anomalyResults: AnomalyResult[] = laps.map((lap, i) =>
    detectAnomaly(lap, i > 0 ? laps[i - 1] : null, i < laps.length - 1 ? laps[i + 1] : null)
  );
  const anomalies = anomalyResults.map(a => a.isAnomaly);

  // Mark anomalies in categories
  anomalies.forEach((isAnomaly, i) => {
    if (isAnomaly) categories[i] = 'anomaly';
  });

  // Stage 4: Rolling window smoothing (skip anomalies)
  categories = smoothCategories(categories, anomalies);

  // Stage 6: Contextual hysteresis
  categories = applyHysteresis(laps, categories, zones, runMode);

  // Re-apply anomalies (hysteresis shouldn't override them)
  anomalies.forEach((isAnomaly, i) => {
    if (isAnomaly) categories[i] = 'anomaly';
  });

  // Stage 7: Confidence scoring + build results
  return laps.map((lap, i): ClassifiedSplit => {
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
}
