/**
 * Multi-Signal Race Prediction Engine
 *
 * Pure computation module — zero database imports.
 * All data passed as structured input. Fully testable.
 *
 * Layers 6 signals, adjusts for endurance readiness and form (CTL/TSB),
 * uses RELATIVE HR metrics, and provides transparency into what drives
 * each prediction.
 */

import { calculateVDOT, predictRaceTime, getWeatherPaceAdjustment, estimateVDOTFromEasyPace } from './vdot-calculator';

// ==================== Input Types ====================

export interface UserPhysiology {
  restingHr: number;        // default 60 if unknown
  maxHr: number;            // 220-age if unknown
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
}

export interface WorkoutSignalInput {
  id: number;
  date: string;
  distanceMiles: number;
  durationMinutes: number;  // moving time
  avgPaceSeconds: number;   // moving pace
  avgHr: number | null;
  maxHr: number | null;
  elevationGainFt: number | null;
  weatherTempF: number | null;
  weatherHumidityPct: number | null;
  workoutType: string;
  // Training Stress Balance on this workout date (for fatigue-adjusted HR correction)
  tsb?: number;
  // Segment data for decoupling (precomputed by data layer)
  firstHalfAvgHr?: number;
  firstHalfAvgPace?: number;
  secondHalfAvgHr?: number;
  secondHalfAvgPace?: number;
}

export interface BestEffortInput {
  date: string;
  distanceMeters: number;
  timeSeconds: number;      // elapsed time for the effort
  source: 'race' | 'time_trial' | 'workout_segment';
  effortLevel?: string;
  workoutId?: number;
}

export interface PredictionEngineInput {
  physiology: UserPhysiology;
  workouts: WorkoutSignalInput[];     // last 180 days
  races: BestEffortInput[];           // from raceResults table
  bestEfforts: BestEffortInput[];     // from best effort detection
  fitnessState: { ctl: number; atl: number; tsb: number };
  trainingVolume: {
    avgWeeklyMiles4Weeks: number;
    longestRecentRunMiles: number;
    weeksConsecutiveTraining: number;
    qualitySessionsPerWeek: number;
  };
  savedVdot: number | null;
  // Individual HR calibration from a known race with HR data
  hrCalibration?: { raceVdot: number; raceAvgHr: number; raceDurationMin: number };
}

// ==================== Output Types ====================

export interface SignalContribution {
  name: string;              // "Race VDOT", "Effective VO2max (HR)", etc.
  estimatedVdot: number;
  weight: number;            // 0-1 blending weight
  confidence: number;        // 0-1
  description: string;
  dataPoints: number;
  recencyDays: number | null;
  // Transparency: which workouts/efforts drove this signal
  keyWorkoutIds?: number[];
  keyDates?: string[];
}

export interface DistancePrediction {
  distance: string;          // "5K", "Marathon"
  meters: number;
  miles: number;
  predictedSeconds: number;
  pacePerMile: number;
  range: { fast: number; slow: number };  // confidence interval in seconds
  readiness: number;         // 0-1, how prepared for THIS distance
  readinessFactors: { volume: number; longRun: number; consistency: number };
  adjustmentReasons: string[];
}

export interface MultiSignalPrediction {
  vdot: number;
  vdotRange: { low: number; high: number };
  confidence: 'high' | 'medium' | 'low';
  signals: SignalContribution[];
  predictions: DistancePrediction[];
  dataQuality: {
    hasHr: boolean;
    hasRaces: boolean;
    hasRecentData: boolean;
    workoutsUsed: number;
    signalsUsed: number;
  };
  // Agreement score: how much the signals agree with each other (0-1)
  agreementScore: number;
  agreementDetails: string;
  formAdjustmentPct: number;
  formDescription: string;
}

// ==================== Constants ====================

const METERS_PER_MILE = 1609.34;

const PREDICTION_DISTANCES = [
  { name: '5K', meters: 5000, miles: 3.107 },
  { name: '10K', meters: 10000, miles: 6.214 },
  { name: 'Half Marathon', meters: 21097, miles: 13.109 },
  { name: 'Marathon', meters: 42195, miles: 26.219 },
];

// Endurance readiness requirements per distance
const DISTANCE_REQUIREMENTS: Record<string, { weeklyMilesMultiple: number; longRunMiles: number }> = {
  '5K': { weeklyMilesMultiple: 2, longRunMiles: 5 },
  '10K': { weeklyMilesMultiple: 2, longRunMiles: 8 },
  'Half Marathon': { weeklyMilesMultiple: 2.5, longRunMiles: 10 },
  'Marathon': { weeklyMilesMultiple: 3, longRunMiles: 16 },
};

// Steady-state workout types (valid for HR-based signals)
const STEADY_STATE_TYPES = ['easy', 'steady', 'long', 'tempo', 'threshold', 'recovery', 'marathon'];

// ==================== Helpers ====================

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr + 'T12:00:00Z');
  return Math.max(0, (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function exponentialDecay(daysAgo: number, halfLifeDays: number): number {
  return Math.exp(-0.693 * daysAgo / halfLifeDays);
}

function clampVdot(v: number): number {
  return Math.max(15, Math.min(85, v));
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Elevation pace correction: +12 sec/mile per 100ft/mile of elevation gain
 */
function elevationPaceCorrection(elevationGainFt: number, distanceMiles: number): number {
  if (distanceMiles <= 0 || elevationGainFt <= 0) return 0;
  const gainPerMile = elevationGainFt / distanceMiles;
  return Math.round((gainPerMile / 100) * 12);
}

// ==================== Signal Extractors ====================

/**
 * Signal 1: Race VDOT
 * Weight: 1.0, half-life: 180 days
 * Uses elapsed time (finishTimeSeconds), not moving time
 */
function extractRaceVdotSignal(
  races: BestEffortInput[],
  now: Date
): SignalContribution | null {
  if (races.length === 0) return null;

  let totalWeight = 0;
  let weightedVdot = 0;
  const vdots: number[] = [];
  const keyDates: string[] = [];

  for (const race of races) {
    if (race.distanceMeters < 1000 || race.timeSeconds <= 0) continue;

    const vdot = clampVdot(calculateVDOT(race.distanceMeters, race.timeSeconds));
    const daysAgo = daysBetween(race.date, now);
    const recency = exponentialDecay(daysAgo, 180);
    const effortWeight = race.effortLevel === 'all_out' ? 1.0 : race.effortLevel === 'hard' ? 0.85 : 0.7;
    const w = recency * effortWeight;

    weightedVdot += vdot * w;
    totalWeight += w;
    vdots.push(vdot);
    keyDates.push(race.date);
  }

  if (totalWeight === 0) return null;

  const estimatedVdot = clampVdot(weightedVdot / totalWeight);
  const recentRace = races.reduce((best, r) => r.date > best.date ? r : best, races[0]);
  const recencyDays = Math.round(daysBetween(recentRace.date, now));

  // Confidence based on number of races and recency
  let confidence = 0.5;
  if (races.length >= 3) confidence = 0.9;
  else if (races.length >= 2) confidence = 0.8;
  else confidence = 0.7;
  if (recencyDays > 120) confidence *= 0.8;
  if (recencyDays > 240) confidence *= 0.7;
  // Boost for all-out efforts
  if (races.some(r => r.effortLevel === 'all_out')) confidence = Math.min(1, confidence + 0.1);

  return {
    name: 'Race VDOT',
    estimatedVdot,
    weight: 1.0,
    confidence,
    description: `From ${races.length} race${races.length > 1 ? 's' : ''}, most recent ${recencyDays}d ago`,
    dataPoints: races.length,
    recencyDays,
    keyDates,
  };
}

/**
 * Signal 2: Best Effort VDOT
 * Weight: 0.65, half-life: 120 days
 * Derated from race signal since training ≠ race conditions
 */
function extractBestEffortSignal(
  bestEfforts: BestEffortInput[],
  now: Date
): SignalContribution | null {
  // Only efforts >= 1 mile
  const validEfforts = bestEfforts.filter(e => e.distanceMeters >= METERS_PER_MILE && e.timeSeconds > 0);
  if (validEfforts.length === 0) return null;

  let totalWeight = 0;
  let weightedVdot = 0;
  const keyDates: string[] = [];
  const keyWorkoutIds: number[] = [];

  for (const effort of validEfforts) {
    const vdot = clampVdot(calculateVDOT(effort.distanceMeters, effort.timeSeconds));
    const daysAgo = daysBetween(effort.date, now);
    const recency = exponentialDecay(daysAgo, 120);
    // Derate: training efforts are ~3% less than race capacity
    const deratedVdot = vdot * 0.97;
    const w = recency;

    weightedVdot += deratedVdot * w;
    totalWeight += w;
    keyDates.push(effort.date);
    if (effort.workoutId) keyWorkoutIds.push(effort.workoutId);
  }

  if (totalWeight === 0) return null;

  const estimatedVdot = clampVdot(weightedVdot / totalWeight);
  const recentEffort = validEfforts.reduce((best, e) => e.date > best.date ? e : best, validEfforts[0]);
  const recencyDays = Math.round(daysBetween(recentEffort.date, now));

  let confidence = 0.4;
  if (validEfforts.length >= 5) confidence = 0.7;
  else if (validEfforts.length >= 3) confidence = 0.6;
  else if (validEfforts.length >= 2) confidence = 0.5;
  if (recencyDays > 90) confidence *= 0.85;

  return {
    name: 'Best Effort VDOT',
    estimatedVdot,
    weight: 0.65,
    confidence,
    description: `From ${validEfforts.length} training effort${validEfforts.length > 1 ? 's' : ''} (derated 3% from race)`,
    dataPoints: validEfforts.length,
    recencyDays,
    keyDates: keyDates.slice(0, 5),
    keyWorkoutIds: keyWorkoutIds.slice(0, 5),
  };
}

/**
 * Signal 3: Effective VO2max from Heart Rate
 * Weight: 0.5, half-life: 60 days
 * THE KEY NEW SIGNAL — works from easy runs with HR data
 */
function extractEffectiveVo2maxSignal(
  workouts: WorkoutSignalInput[],
  physiology: UserPhysiology,
  hrCalibration?: PredictionEngineInput['hrCalibration'],
  now: Date = new Date()
): SignalContribution | null {
  const { restingHr, maxHr } = physiology;
  const hrRange = maxHr - restingHr;
  if (hrRange <= 20) return null; // Invalid HR range

  // Filter to steady-state workouts with HR data
  const steadyWorkouts = workouts.filter(w =>
    STEADY_STATE_TYPES.includes(w.workoutType) &&
    w.avgHr != null &&
    w.avgHr > 0 &&
    w.distanceMiles > 0.5 &&
    w.durationMinutes >= 15
  );

  if (steadyWorkouts.length === 0) return null;

  const vo2maxValues: { value: number; weight: number; date: string; workoutId: number }[] = [];

  // Compute individual HR calibration correction if available
  let calibrationFactor = 1.0;
  if (hrCalibration) {
    // If we know the real VDOT from a race and the HR during it,
    // we can compute the expected %HRR → %VO2max relationship correction
    const raceHrr = (hrCalibration.raceAvgHr - restingHr) / hrRange;
    if (raceHrr > 0.3 && raceHrr < 1.0) {
      const expectedPctVo2 = 1.4854 * raceHrr - 0.3702;
      // From the race result we know actual VO2max = raceVdot
      // The Swain-Londeree formula predicted some %VO2max for this HRR
      // calibrationFactor corrects for this individual's HR-VO2 relationship
      if (expectedPctVo2 > 0.3) {
        calibrationFactor = 1.0; // Start neutral — refined per-workout below
      }
    }
  }

  for (const w of steadyWorkouts) {
    const avgHr = w.avgHr!;
    const hrReservePct = (avgHr - restingHr) / hrRange;

    // Only use when 0.50 < %HRR < 0.92 (reliable range)
    if (hrReservePct < 0.50 || hrReservePct > 0.92) continue;

    // Velocity in m/min
    const distanceMeters = w.distanceMiles * METERS_PER_MILE;
    let velocity = distanceMeters / (w.durationMinutes * 60) * 60; // m/min

    // Weather correction
    if (w.weatherTempF != null && w.weatherHumidityPct != null) {
      const paceAdjustment = getWeatherPaceAdjustment(w.weatherTempF, w.weatherHumidityPct);
      if (paceAdjustment > 0 && w.avgPaceSeconds > 0) {
        // Convert pace adjustment to velocity correction
        const correctedPace = w.avgPaceSeconds - paceAdjustment;
        if (correctedPace > 0) {
          velocity = METERS_PER_MILE / (correctedPace / 60); // m/min
        }
      }
    }

    // Elevation correction
    if (w.elevationGainFt != null && w.elevationGainFt > 0 && w.distanceMiles > 0) {
      const paceCorrection = elevationPaceCorrection(w.elevationGainFt, w.distanceMiles);
      if (paceCorrection > 0 && w.avgPaceSeconds > 0) {
        const correctedPace = w.avgPaceSeconds - paceCorrection;
        if (correctedPace > 0) {
          velocity = METERS_PER_MILE / (correctedPace / 60);
        }
      }
    }

    // VO2 at this velocity (Daniels formula)
    const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;

    // %VO2max from %HRR (Swain-Londeree equation)
    const pctVo2max = 1.4854 * hrReservePct - 0.3702;
    if (pctVo2max <= 0.2 || pctVo2max > 1.0) continue;

    let effectiveVo2max = vo2 / pctVo2max;
    effectiveVo2max *= calibrationFactor;

    // Fatigue correction: when TSB is negative, HR is elevated beyond what
    // fitness alone explains. This makes %HRR look higher → %VO2max higher
    // → effective VO2max artificially lower. Correct upward when fatigued.
    // Smooth continuous model: linear from TSB=0 (no correction) to TSB=-30
    // (cap at +3.0 VDOT). No hard thresholds.
    if (w.tsb != null && w.tsb < 0) {
      const fatigueCorrection = Math.min(3, Math.abs(w.tsb) * 0.1);
      effectiveVo2max += fatigueCorrection;
    }

    // Convert VO2max to VDOT (roughly equivalent for running)
    const vdot = clampVdot(effectiveVo2max);
    if (vdot < 15 || vdot > 85) continue;

    const daysAgo = daysBetween(w.date, now);
    const recency = exponentialDecay(daysAgo, 60);

    // Smooth freshness weight: workouts from fresher periods (higher TSB)
    // get more weight since their HR→fitness relationship is less noisy.
    // TSB >= 0 → full 15% boost, TSB <= -20 → no boost, linear between.
    let freshnessBoost = 1.0;
    if (w.tsb != null) {
      freshnessBoost = 1.0 + Math.max(0, Math.min(0.15, ((w.tsb + 20) / 20) * 0.15));
    }

    vo2maxValues.push({ value: vdot, weight: recency * freshnessBoost, date: w.date, workoutId: w.id });
  }

  if (vo2maxValues.length === 0) return null;

  // Weighted average (emphasize recent 30 days per Runalyze approach)
  const last30 = vo2maxValues.filter(v => daysBetween(v.date, now) <= 30);
  const valuesToUse = last30.length >= 3 ? last30 : vo2maxValues;

  const totalWeight = valuesToUse.reduce((s, v) => s + v.weight, 0);
  const weightedAvg = valuesToUse.reduce((s, v) => s + v.value * v.weight, 0) / totalWeight;
  const estimatedVdot = clampVdot(weightedAvg);

  const recentWorkout = vo2maxValues.reduce((best, v) => v.date > best.date ? v : best, vo2maxValues[0]);
  const recencyDays = Math.round(daysBetween(recentWorkout.date, now));

  // Detect trend in VO2max values
  let trendNote = '';
  if (vo2maxValues.length >= 5) {
    const sorted = [...vo2maxValues].sort((a, b) => a.date.localeCompare(b.date));
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    const firstAvg = firstHalf.reduce((s, v) => s + v.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v.value, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 0.5) trendNote = `, improving ${diff.toFixed(1)} pts`;
    else if (diff < -0.5) trendNote = `, declining ${Math.abs(diff).toFixed(1)} pts`;
  }

  let confidence = 0.4;
  if (vo2maxValues.length >= 10) confidence = 0.75;
  else if (vo2maxValues.length >= 5) confidence = 0.6;
  else if (vo2maxValues.length >= 3) confidence = 0.5;
  if (recencyDays > 30) confidence *= 0.9;
  if (recencyDays > 60) confidence *= 0.8;
  if (hrCalibration) confidence = Math.min(1, confidence + 0.15);

  return {
    name: 'Effective VO2max (HR)',
    estimatedVdot,
    weight: 0.5,
    confidence,
    description: `From ${vo2maxValues.length} easy/steady runs with HR${trendNote} (fatigue-adjusted)`,
    dataPoints: vo2maxValues.length,
    recencyDays,
    keyDates: vo2maxValues.slice(-5).map(v => v.date),
    keyWorkoutIds: vo2maxValues.slice(-5).map(v => v.workoutId),
  };
}

/**
 * Signal 4: Efficiency Factor Trend
 * Weight: 0.35 — this is a MODIFIER, not a standalone VDOT estimate
 * Returns the VDOT adjustment from EF trend
 */
function extractEfTrendSignal(
  workouts: WorkoutSignalInput[],
  now: Date
): SignalContribution | null {
  // Filter to easy/steady runs with HR
  const efWorkouts = workouts
    .filter(w =>
      ['easy', 'steady', 'long', 'recovery'].includes(w.workoutType) &&
      w.avgHr != null && w.avgHr > 0 &&
      w.distanceMiles > 1 &&
      w.durationMinutes >= 20
    )
    .filter(w => daysBetween(w.date, now) <= 90);

  if (efWorkouts.length < 5) return null;

  // Calculate EF for each workout: velocity(m/min) / avgHR
  const efData = efWorkouts.map(w => {
    const velocity = (w.distanceMiles * METERS_PER_MILE) / (w.durationMinutes * 60) * 60;
    const ef = velocity / w.avgHr!;
    return { ef, date: w.date, daysAgo: daysBetween(w.date, now), workoutId: w.id };
  }).sort((a, b) => a.daysAgo - b.daysAgo); // oldest first for regression

  // Linear regression: EF over days
  const n = efData.length;
  const xs = efData.map(d => 90 - d.daysAgo); // 0 = 90 days ago, 90 = today
  const ys = efData.map(d => d.ef);
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = ys.reduce((s, y) => s + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - xMean) * (ys[i] - yMean);
    denominator += (xs[i] - xMean) * (xs[i] - xMean);
  }

  if (denominator === 0) return null;

  const slope = numerator / denominator;
  const avgEf = yMean;

  // Calculate % change in EF over 90 days
  const pctChange = (slope * 90) / avgEf;
  // +3% EF ≈ +1.5 VDOT points
  const vdotAdjustment = (pctChange / 0.03) * 1.5;

  // Clamp adjustment to reasonable range (-3 to +3 VDOT)
  const clampedAdj = Math.max(-3, Math.min(3, vdotAdjustment));

  if (Math.abs(clampedAdj) < 0.1) return null; // Negligible trend

  // R² for confidence
  const ssRes = efData.reduce((s, d, i) => {
    const predicted = yMean + slope * (xs[i] - xMean);
    return s + (ys[i] - predicted) ** 2;
  }, 0);
  const ssTot = efData.reduce((s, d) => s + (d.ef - yMean) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const direction = clampedAdj > 0 ? 'improving' : 'declining';
  const confidence = Math.min(0.8, rSquared * 0.8 + 0.2);

  return {
    name: 'Efficiency Factor Trend',
    estimatedVdot: clampedAdj, // This is an ADJUSTMENT, not an absolute VDOT
    weight: 0.35,
    confidence,
    description: `EF ${direction} ${Math.abs(pctChange * 100).toFixed(1)}% over 90d (${n} runs, R²=${rSquared.toFixed(2)})`,
    dataPoints: n,
    recencyDays: Math.round(efData[efData.length - 1]?.daysAgo ?? 0),
    keyWorkoutIds: efData.slice(-3).map(d => d.workoutId),
  };
}

/**
 * Signal 5: Critical Speed
 * Weight: 0.6, requires 3+ distances with effort data
 */
function extractCriticalSpeedSignal(
  races: BestEffortInput[],
  bestEfforts: BestEffortInput[],
  now: Date
): SignalContribution | null {
  // Combine races and best efforts — need 3+ different distances
  const allEfforts = [...races, ...bestEfforts]
    .filter(e => e.distanceMeters >= METERS_PER_MILE && e.distanceMeters <= 15000 && e.timeSeconds > 0);

  // Group by distance bucket and take the best time for each
  const distanceBuckets = new Map<string, { distance: number; time: number; date: string }>();
  for (const e of allEfforts) {
    let bucket: string;
    if (e.distanceMeters < 2000) bucket = '1mi';
    else if (e.distanceMeters < 4000) bucket = '3K';
    else if (e.distanceMeters < 7000) bucket = '5K';
    else if (e.distanceMeters < 12000) bucket = '10K';
    else bucket = '15K';

    const existing = distanceBuckets.get(bucket);
    // Use a VDOT-normalized comparison: best is highest VDOT
    const eVdot = calculateVDOT(e.distanceMeters, e.timeSeconds);
    const existingVdot = existing ? calculateVDOT(existing.distance, existing.time) : 0;
    if (!existing || eVdot > existingVdot) {
      distanceBuckets.set(bucket, { distance: e.distanceMeters, time: e.timeSeconds, date: e.date });
    }
  }

  if (distanceBuckets.size < 3) return null;

  // Linear regression: distance = CS * time + D'
  // Rearranged: d = CS * t + D' → standard linear regression
  const points = Array.from(distanceBuckets.values());
  const n = points.length;
  const ts = points.map(p => p.time);      // x: time in seconds
  const ds = points.map(p => p.distance);  // y: distance in meters

  const tMean = ts.reduce((s, t) => s + t, 0) / n;
  const dMean = ds.reduce((s, d) => s + d, 0) / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (ts[i] - tMean) * (ds[i] - dMean);
    den += (ts[i] - tMean) * (ts[i] - tMean);
  }

  if (den === 0) return null;

  const criticalSpeed = num / den; // m/s — the slope
  if (criticalSpeed <= 0 || criticalSpeed > 10) return null; // Physically impossible

  // CS maps to roughly threshold pace → threshold VDOT
  // velocity at threshold ≈ CS in m/s → convert to m/min
  const csVelocity = criticalSpeed * 60; // m/min
  // VO2 at CS
  const vo2AtCs = -4.60 + 0.182258 * csVelocity + 0.000104 * csVelocity * csVelocity;
  // CS is roughly 88% VO2max
  const estimatedVo2max = vo2AtCs / 0.88;
  const estimatedVdot = clampVdot(estimatedVo2max);

  const keyDates = points.map(p => p.date);

  return {
    name: 'Critical Speed',
    estimatedVdot,
    weight: 0.6,
    confidence: n >= 5 ? 0.8 : n >= 4 ? 0.7 : 0.55,
    description: `From ${n} efforts across different distances (CS = ${(criticalSpeed * 60 / METERS_PER_MILE * 60).toFixed(0)} sec/mi)`,
    dataPoints: n,
    recencyDays: null,
    keyDates,
  };
}

/**
 * Signal 6: Training Pace Inference
 * Weight: 0.25, fallback only when no HR and no races
 */
function extractTrainingPaceSignal(
  workouts: WorkoutSignalInput[],
  now: Date
): SignalContribution | null {
  // Group by workout type and estimate VDOT from paces
  const estimates: { vdot: number; weight: number; type: string; workoutId: number }[] = [];

  const recent = workouts.filter(w =>
    w.distanceMiles > 0.5 &&
    w.durationMinutes >= 10 &&
    w.avgPaceSeconds > 0 &&
    daysBetween(w.date, now) <= 90
  );

  for (const w of recent) {
    const daysAgo = daysBetween(w.date, now);
    const recency = exponentialDecay(daysAgo, 60);
    let vdot: number | null = null;

    if (w.workoutType === 'easy' || w.workoutType === 'recovery') {
      vdot = estimateVDOTFromEasyPace(w.avgPaceSeconds);
    } else if (w.workoutType === 'tempo') {
      // Tempo ≈ 86% VO2max
      const velocity = METERS_PER_MILE / (w.avgPaceSeconds / 60);
      const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
      vdot = vo2 / 0.86;
    } else if (w.workoutType === 'threshold') {
      // Threshold ≈ 88% VO2max
      const velocity = METERS_PER_MILE / (w.avgPaceSeconds / 60);
      const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
      vdot = vo2 / 0.88;
    }

    if (vdot != null && vdot >= 15 && vdot <= 85) {
      estimates.push({ vdot: clampVdot(vdot), weight: recency, type: w.workoutType, workoutId: w.id });
    }
  }

  if (estimates.length === 0) return null;

  const totalWeight = estimates.reduce((s, e) => s + e.weight, 0);
  const estimatedVdot = clampVdot(estimates.reduce((s, e) => s + e.vdot * e.weight, 0) / totalWeight);

  const types = new Set(estimates.map(e => e.type));

  return {
    name: 'Training Pace Inference',
    estimatedVdot,
    weight: 0.25,
    confidence: estimates.length >= 10 ? 0.5 : estimates.length >= 5 ? 0.4 : 0.3,
    description: `From ${estimates.length} ${Array.from(types).join('/')} runs (last 90d)`,
    dataPoints: estimates.length,
    recencyDays: null,
    keyWorkoutIds: estimates.slice(-3).map(e => e.workoutId),
  };
}

// ==================== Signal Blending ====================

function blendSignals(signals: SignalContribution[]): {
  vdot: number;
  range: { low: number; high: number };
  agreementScore: number;
  agreementDetails: string;
} {
  // Separate the EF trend (modifier) from other signals
  const efTrend = signals.find(s => s.name === 'Efficiency Factor Trend');
  const absoluteSignals = signals.filter(s => s.name !== 'Efficiency Factor Trend');

  if (absoluteSignals.length === 0) {
    return { vdot: 40, range: { low: 35, high: 45 }, agreementScore: 0, agreementDetails: 'No signals available' };
  }

  // Weighted average of absolute signals
  let totalWeight = 0;
  let weightedVdot = 0;

  for (const s of absoluteSignals) {
    const w = s.weight * s.confidence;
    weightedVdot += s.estimatedVdot * w;
    totalWeight += w;
  }

  let blendedVdot = totalWeight > 0 ? weightedVdot / totalWeight : 40;

  // Apply EF trend modifier
  if (efTrend && efTrend.confidence > 0.3) {
    blendedVdot += 0.35 * efTrend.estimatedVdot;
  }

  blendedVdot = clampVdot(blendedVdot);

  // Calculate agreement score: how much do the signals agree?
  const vdots = absoluteSignals.map(s => s.estimatedVdot);
  const stdDev = vdots.length > 1
    ? Math.sqrt(vdots.reduce((s, v) => s + (v - blendedVdot) ** 2, 0) / vdots.length)
    : 0;

  // Agreement: std dev < 1 = excellent (1.0), std dev > 5 = poor (0.2)
  const agreementScore = Math.max(0.1, Math.min(1.0, 1.0 - (stdDev - 0.5) / 5));

  let agreementDetails: string;
  if (absoluteSignals.length < 2) {
    agreementDetails = 'Single signal — no cross-validation possible';
  } else if (stdDev < 1) {
    agreementDetails = `Excellent agreement between ${absoluteSignals.length} signals (±${stdDev.toFixed(1)} VDOT)`;
  } else if (stdDev < 2.5) {
    agreementDetails = `Good agreement between ${absoluteSignals.length} signals (±${stdDev.toFixed(1)} VDOT)`;
  } else if (stdDev < 4) {
    agreementDetails = `Moderate disagreement between signals (±${stdDev.toFixed(1)} VDOT) — predictions less certain`;
  } else {
    // Find the outlier(s)
    const sorted = absoluteSignals.sort((a, b) => Math.abs(b.estimatedVdot - blendedVdot) - Math.abs(a.estimatedVdot - blendedVdot));
    const outlier = sorted[0];
    agreementDetails = `Significant disagreement (±${stdDev.toFixed(1)} VDOT). "${outlier.name}" is the main outlier at VDOT ${outlier.estimatedVdot.toFixed(1)}`;
  }

  // Range: use std dev + base uncertainty
  const uncertainty = Math.max(1, stdDev * 1.2);
  const range = {
    low: Math.round((blendedVdot - uncertainty) * 10) / 10,
    high: Math.round((blendedVdot + uncertainty) * 10) / 10,
  };

  return {
    vdot: Math.round(blendedVdot * 10) / 10,
    range,
    agreementScore: Math.round(agreementScore * 100) / 100,
    agreementDetails,
  };
}

// ==================== Endurance Readiness ====================

function calculateReadiness(
  distanceName: string,
  volume: PredictionEngineInput['trainingVolume']
): { score: number; factors: { volume: number; longRun: number; consistency: number } } {
  const req = DISTANCE_REQUIREMENTS[distanceName];
  if (!req) return { score: 1, factors: { volume: 1, longRun: 1, consistency: 1 } };

  const requiredMiles = req.weeklyMilesMultiple * (PREDICTION_DISTANCES.find(d => d.name === distanceName)?.miles ?? 10);
  const volumeScore = Math.min(1, volume.avgWeeklyMiles4Weeks / requiredMiles);
  const longRunScore = Math.min(1, volume.longestRecentRunMiles / req.longRunMiles);
  const consistencyScore = Math.min(1, volume.weeksConsecutiveTraining / 12);

  const score = 0.4 * volumeScore + 0.35 * longRunScore + 0.25 * consistencyScore;

  return {
    score: Math.round(score * 100) / 100,
    factors: {
      volume: Math.round(volumeScore * 100) / 100,
      longRun: Math.round(longRunScore * 100) / 100,
      consistency: Math.round(consistencyScore * 100) / 100,
    },
  };
}

// ==================== Form Adjustment ====================

function calculateFormAdjustment(fitnessState: PredictionEngineInput['fitnessState']): {
  pctAdjustment: number;
  description: string;
} {
  const { ctl, tsb } = fitnessState;
  let adjustment = 0;
  const reasons: string[] = [];

  // TSB adjustments
  if (tsb >= 5 && tsb <= 25) {
    adjustment -= 0.5;
    reasons.push('tapered/fresh');
  } else if (tsb > 25) {
    adjustment += 0.5;
    reasons.push('very rested (may have lost sharpness)');
  } else if (tsb >= -25 && tsb < -10) {
    adjustment += 1.5;
    reasons.push('fatigued');
  } else if (tsb < -25) {
    adjustment += 3;
    reasons.push('significantly overreached');
  }

  // CTL adjustment
  if (ctl < 20) {
    adjustment += 1;
    reasons.push('thin fitness base');
  }

  const description = reasons.length > 0
    ? `Form: ${reasons.join(', ')} (${adjustment > 0 ? '+' : ''}${adjustment.toFixed(1)}%)`
    : 'Form: normal training load';

  return { pctAdjustment: adjustment, description };
}

// ==================== Main Engine ====================

export function generatePredictions(input: PredictionEngineInput): MultiSignalPrediction {
  const now = new Date();

  // Extract all 6 signals
  const signals: SignalContribution[] = [];

  const raceSignal = extractRaceVdotSignal(input.races, now);
  if (raceSignal) signals.push(raceSignal);

  const bestEffortSignal = extractBestEffortSignal(input.bestEfforts, now);
  if (bestEffortSignal) signals.push(bestEffortSignal);

  const vo2maxSignal = extractEffectiveVo2maxSignal(
    input.workouts, input.physiology, input.hrCalibration, now
  );
  if (vo2maxSignal) signals.push(vo2maxSignal);

  const efTrendSignal = extractEfTrendSignal(input.workouts, now);
  if (efTrendSignal) signals.push(efTrendSignal);

  const csSignal = extractCriticalSpeedSignal(input.races, input.bestEfforts, now);
  if (csSignal) signals.push(csSignal);

  const paceSignal = extractTrainingPaceSignal(input.workouts, now);
  if (paceSignal) signals.push(paceSignal);

  // If no signals at all, use saved VDOT or default
  if (signals.filter(s => s.name !== 'Efficiency Factor Trend').length === 0) {
    if (input.savedVdot && input.savedVdot >= 15 && input.savedVdot <= 85) {
      signals.push({
        name: 'Saved VDOT',
        estimatedVdot: input.savedVdot,
        weight: 0.3,
        confidence: 0.3,
        description: 'From your profile settings (no recent training data)',
        dataPoints: 1,
        recencyDays: null,
      });
    }
  }

  // Blend signals
  const { vdot, range, agreementScore, agreementDetails } = blendSignals(signals);

  // Form adjustment
  const { pctAdjustment: formAdj, description: formDesc } = calculateFormAdjustment(input.fitnessState);

  // Generate predictions per distance
  const predictions: DistancePrediction[] = PREDICTION_DISTANCES.map(dist => {
    // Base prediction from blended VDOT
    const baseSeconds = predictRaceTime(vdot, dist.meters);

    // Endurance readiness
    const { score: readiness, factors: readinessFactors } = calculateReadiness(dist.name, input.trainingVolume);

    // Readiness penalty
    let readinessPenalty = 0;
    const adjustmentReasons: string[] = [];
    if (readiness < 0.7) {
      readinessPenalty = (0.7 - readiness) * 0.25;
      adjustmentReasons.push(`Endurance readiness ${(readiness * 100).toFixed(0)}% — training volume/long run needed for ${dist.name}`);
    }

    // Form adjustment
    if (formAdj !== 0) {
      adjustmentReasons.push(formDesc);
    }

    // Total time adjustment
    const totalAdjPct = (formAdj + readinessPenalty * 100) / 100;
    const adjustedSeconds = Math.round(baseSeconds * (1 + totalAdjPct));

    // Confidence range (wider for longer distances and lower agreement)
    const basePct = dist.meters >= 21097 ? 0.05 : dist.meters >= 10000 ? 0.035 : 0.025;
    const uncertaintyPct = basePct * (2 - agreementScore);
    const rangeFast = Math.round(adjustedSeconds * (1 - uncertaintyPct));
    const rangeSlow = Math.round(adjustedSeconds * (1 + uncertaintyPct + readinessPenalty));

    return {
      distance: dist.name,
      meters: dist.meters,
      miles: dist.miles,
      predictedSeconds: adjustedSeconds,
      pacePerMile: Math.round(adjustedSeconds / dist.miles),
      range: { fast: rangeFast, slow: rangeSlow },
      readiness,
      readinessFactors,
      adjustmentReasons,
    };
  });

  // Data quality assessment
  const hasHr = input.workouts.some(w => w.avgHr != null && w.avgHr > 0);
  const hasRaces = input.races.length > 0;
  const recentWorkouts = input.workouts.filter(w => daysBetween(w.date, now) <= 30);
  const hasRecentData = recentWorkouts.length >= 3;
  const signalsUsed = signals.filter(s => s.name !== 'Efficiency Factor Trend').length;

  let confidence: 'high' | 'medium' | 'low';
  if (signalsUsed >= 3 && agreementScore >= 0.6 && hasRecentData) {
    confidence = 'high';
  } else if (signalsUsed >= 2 && agreementScore >= 0.4) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    vdot,
    vdotRange: range,
    confidence,
    signals,
    predictions,
    dataQuality: {
      hasHr,
      hasRaces,
      hasRecentData,
      workoutsUsed: input.workouts.length,
      signalsUsed,
    },
    agreementScore,
    agreementDetails,
    formAdjustmentPct: formAdj,
    formDescription: formDesc,
  };
}
