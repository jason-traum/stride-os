// Interval Stress Model
// Computes per-segment TRIMP with rest discount factors for interval workouts.
// Prevents rest periods from diluting the training load of quality interval sessions.

import type { Workout, UserSettings, WorkoutSegment } from '../schema';
import { computeConditionAdjustment } from './run-classifier';

// --- Types ---

export interface IntervalStressResult {
  intervalAdjustedTrimp: number;
  rawSegmentTrimpSum: number;
  workTrimp: number;
  restTrimp: number;
  warmupCooldownTrimp: number;
  discountFactor: number;
  restToWorkRatio: number | null;
  workDurationSec: number;
  restDurationSec: number;
  recoveryType: 'active' | 'passive' | 'mixed';
  isCruiseInterval: boolean;
  segmentCount: number;
}

type RecoveryType = 'active' | 'passive' | 'mixed';

// Pace zones that count as "work" for rest-to-work ratio
const WORK_ZONES = new Set(['tempo', 'threshold', 'interval', 'marathon']);
// Pace zones that count as "rest" for rest-to-work ratio
const REST_ZONES = new Set(['recovery']);
// Segment types that count as "work"
const WORK_SEGMENT_TYPES = new Set(['work', 'intervals', 'strides']);
// Segment types that count as "rest"
const REST_SEGMENT_TYPES = new Set(['recovery']);

// --- Discount factor lookup ---
// [maxRestToWorkRatio, activeDiscount, passiveDiscount]
const DISCOUNT_TABLE: [number, number, number][] = [
  [0.02, 1.00, 1.00],   // continuous
  [0.17, 0.965, 0.925],  // ~1:6
  [0.33, 0.925, 0.875],  // ~1:3
  [0.50, 0.875, 0.825],  // ~1:2
  [1.00, 0.825, 0.750],  // ~1:1
];

// --- Core functions ---

/**
 * Compute TRIMP for a single segment using the Banister formula.
 * Same formula as computeTRIMP() in run-classifier.ts but scoped to one segment.
 */
export function computeSegmentTrimp(
  segment: WorkoutSegment,
  userSettings: UserSettings | null,
  conditionAdjustment: number
): number {
  const durationSec = segment.durationSeconds;
  if (!durationSec || durationSec <= 0) return 0;
  const durationMin = durationSec / 60;

  const avgHr = segment.avgHr;
  if (avgHr && avgHr > 0) {
    // HR-based Banister TRIMP
    const age = userSettings?.age || 30;
    const maxHr = 220 - age;
    const restingHr = userSettings?.restingHr || 60;
    const hrReserveFraction = (avgHr - restingHr) / (maxHr - restingHr);
    const hrFraction = Math.max(0, Math.min(1, hrReserveFraction));

    const gender = userSettings?.gender;
    const yFactor = gender === 'female'
      ? hrFraction * 1.67 * Math.exp(1.92 * hrFraction)
      : hrFraction * 1.92 * Math.exp(1.92 * hrFraction);

    return durationMin * yFactor;
  }

  // Pace fallback
  const rawPace = segment.paceSecondsPerMile;
  if (!rawPace || rawPace <= 0) {
    return durationMin * 1.0; // Minimal default
  }

  const pace = rawPace - conditionAdjustment;
  const intensityFactor = pace < 360 ? 2.5 :
                          pace < 420 ? 2.0 :
                          pace < 480 ? 1.6 :
                          pace < 540 ? 1.3 :
                          pace < 600 ? 1.1 :
                          1.0;

  return durationMin * intensityFactor;
}

/**
 * Classify whether recovery segments represent active or passive recovery.
 * Active: has pace ≤ 900 sec/mi (15:00/mi) and meaningful distance.
 * Passive: no pace, pace > 900, or negligible distance relative to duration.
 */
export function classifyRecoveryType(recoverySegments: WorkoutSegment[]): RecoveryType {
  if (recoverySegments.length === 0) return 'passive';

  let activeCount = 0;
  let passiveCount = 0;

  for (const seg of recoverySegments) {
    const pace = seg.paceSecondsPerMile;
    const dist = seg.distanceMiles || 0;
    const dur = seg.durationSeconds || 0;

    // Active: has a real pace ≤ 15:00/mi and covers meaningful distance
    const hasActivePace = pace != null && pace > 0 && pace <= 900;
    const hasMeaningfulDistance = dist > 0.02 && dur > 0 && (dist / (dur / 3600)) > 1.0; // > 1 mph

    if (hasActivePace && hasMeaningfulDistance) {
      activeCount++;
    } else {
      passiveCount++;
    }
  }

  if (activeCount > 0 && passiveCount > 0) return 'mixed';
  return activeCount > 0 ? 'active' : 'passive';
}

/**
 * Compute rest-to-work ratio from classified segments.
 * Work = segments with work pace zones or work segment types.
 * Rest = segments with recovery zone or recovery segment type.
 * Warmup/cooldown/easy/steady excluded from ratio calculation.
 */
export function computeRestToWorkRatio(segments: WorkoutSegment[]): {
  ratio: number | null;
  workDurationSec: number;
  restDurationSec: number;
} {
  let workDurationSec = 0;
  let restDurationSec = 0;

  for (const seg of segments) {
    const dur = seg.durationSeconds || 0;
    const zone = seg.paceZone;
    const type = seg.segmentType;

    const isWork = (zone && WORK_ZONES.has(zone)) || WORK_SEGMENT_TYPES.has(type);
    const isRest = (zone && REST_ZONES.has(zone)) || REST_SEGMENT_TYPES.has(type);

    if (isWork) {
      workDurationSec += dur;
    } else if (isRest) {
      restDurationSec += dur;
    }
    // warmup/cooldown/easy/steady → excluded
  }

  if (workDurationSec === 0) {
    return { ratio: null, workDurationSec, restDurationSec };
  }

  return {
    ratio: restDurationSec / workDurationSec,
    workDurationSec,
    restDurationSec,
  };
}

/**
 * Compute the discount factor based on rest-to-work ratio and recovery type.
 * Returns 0.70–1.00. Mixed recovery averages active + passive factors.
 */
export function computeDiscountFactor(
  restToWorkRatio: number | null,
  recoveryType: RecoveryType
): number {
  if (restToWorkRatio === null || restToWorkRatio <= 0.02) return 1.0;

  // Find the bracket
  let activeDiscount = 0.825; // default to worst case for very long rest
  let passiveDiscount = 0.750;

  for (const [maxRatio, active, passive] of DISCOUNT_TABLE) {
    if (restToWorkRatio <= maxRatio) {
      activeDiscount = active;
      passiveDiscount = passive;
      break;
    }
  }

  // For ratios exceeding 1.0, use the bottom of the table
  if (restToWorkRatio > 1.0) {
    activeDiscount = 0.825;
    passiveDiscount = 0.750;
  }

  if (recoveryType === 'active') return activeDiscount;
  if (recoveryType === 'passive') return passiveDiscount;
  // mixed = average
  return (activeDiscount + passiveDiscount) / 2;
}

/**
 * Check Daniels' cruise interval exception:
 * Threshold-pace intervals with ≤1min rest per mile of work → no discount.
 * All work segments must be within 95-110% of threshold pace.
 */
export function checkCruiseIntervalException(
  segments: WorkoutSegment[],
  userSettings: UserSettings | null
): boolean {
  const thresholdPace = userSettings?.thresholdPaceSeconds;
  if (!thresholdPace || thresholdPace <= 0) return false;

  const workSegs: WorkoutSegment[] = [];
  const restSegs: WorkoutSegment[] = [];

  for (const seg of segments) {
    const zone = seg.paceZone;
    const type = seg.segmentType;

    if ((zone && WORK_ZONES.has(zone)) || WORK_SEGMENT_TYPES.has(type)) {
      workSegs.push(seg);
    } else if ((zone && REST_ZONES.has(zone)) || REST_SEGMENT_TYPES.has(type)) {
      restSegs.push(seg);
    }
  }

  if (workSegs.length === 0) return false;

  // Check all work segments are threshold pace (95-110% of threshold)
  const minPace = thresholdPace * 0.95; // 5% faster is still threshold
  const maxPace = thresholdPace * 1.10; // 10% slower is still threshold

  for (const seg of workSegs) {
    const pace = seg.paceSecondsPerMile;
    if (!pace || pace < minPace || pace > maxPace) return false;
  }

  // Check rest ≤ 1min per mile of work
  const totalWorkMiles = workSegs.reduce((sum, s) => sum + (s.distanceMiles || 0), 0);
  const totalRestSec = restSegs.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  if (totalWorkMiles <= 0) return false;
  return (totalRestSec / totalWorkMiles) <= 60; // ≤ 60 seconds rest per mile
}

/**
 * Main orchestrator: compute interval-adjusted TRIMP for a workout.
 *
 * 1. Compute per-segment TRIMP
 * 2. Bucket into work / rest / warmup-cooldown
 * 3. Calculate rest-to-work ratio + recovery type
 * 4. Check cruise interval exception
 * 5. Apply discount factor
 * 6. Graceful degradation: < 3 segments → return aggregate TRIMP unchanged
 */
export function computeIntervalStress(
  workout: Workout,
  segments: WorkoutSegment[],
  userSettings: UserSettings | null,
  aggregateTrimp: number
): IntervalStressResult {
  // Graceful degradation: too few segments to analyze
  if (segments.length < 3) {
    return {
      intervalAdjustedTrimp: aggregateTrimp,
      rawSegmentTrimpSum: aggregateTrimp,
      workTrimp: aggregateTrimp,
      restTrimp: 0,
      warmupCooldownTrimp: 0,
      discountFactor: 1.0,
      restToWorkRatio: null,
      workDurationSec: 0,
      restDurationSec: 0,
      recoveryType: 'passive',
      isCruiseInterval: false,
      segmentCount: segments.length,
    };
  }

  const conditionAdj = computeConditionAdjustment(workout);

  // Compute per-segment TRIMP and bucket
  let workTrimp = 0;
  let restTrimp = 0;
  let warmupCooldownTrimp = 0;
  let rawSum = 0;
  const recoverySegs: WorkoutSegment[] = [];

  for (const seg of segments) {
    const segTrimp = computeSegmentTrimp(seg, userSettings, conditionAdj);
    rawSum += segTrimp;

    const zone = seg.paceZone;
    const type = seg.segmentType;

    const isWarmupCooldown = type === 'warmup' || type === 'cooldown' ||
                              zone === 'warmup' || zone === 'cooldown';
    const isWork = (zone && WORK_ZONES.has(zone)) || WORK_SEGMENT_TYPES.has(type);
    const isRest = (zone && REST_ZONES.has(zone)) || REST_SEGMENT_TYPES.has(type);

    if (isWarmupCooldown) {
      warmupCooldownTrimp += segTrimp;
    } else if (isWork) {
      workTrimp += segTrimp;
    } else if (isRest) {
      restTrimp += segTrimp;
      recoverySegs.push(seg);
    } else {
      // easy/steady segments that aren't clearly work or rest → treat as warmup/cooldown bucket
      warmupCooldownTrimp += segTrimp;
    }
  }

  // Rest-to-work ratio
  const { ratio, workDurationSec, restDurationSec } = computeRestToWorkRatio(segments);

  // Recovery type
  const recoveryType = classifyRecoveryType(recoverySegs);

  // Cruise interval exception
  const isCruiseInterval = checkCruiseIntervalException(segments, userSettings);

  // Discount factor
  let discountFactor: number;
  if (isCruiseInterval) {
    discountFactor = 1.0;
  } else {
    discountFactor = computeDiscountFactor(ratio, recoveryType);
  }

  // Apply discount: warmup/cooldown at full value, work+rest discounted
  const adjusted = warmupCooldownTrimp + (workTrimp + restTrimp) * discountFactor;
  const intervalAdjustedTrimp = Math.round(adjusted);

  return {
    intervalAdjustedTrimp,
    rawSegmentTrimpSum: Math.round(rawSum),
    workTrimp: Math.round(workTrimp),
    restTrimp: Math.round(restTrimp),
    warmupCooldownTrimp: Math.round(warmupCooldownTrimp),
    discountFactor,
    restToWorkRatio: ratio,
    workDurationSec,
    restDurationSec,
    recoveryType,
    isCruiseInterval,
    segmentCount: segments.length,
  };
}
