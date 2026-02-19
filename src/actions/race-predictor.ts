'use server';

import { getBestEfforts } from './best-efforts';
import { parseLocalDate, formatPace } from '@/lib/utils';
import { buildPerformanceModel } from '@/lib/training/performance-model';
import { predictRaceTime, calculateAdjustedVDOT } from '@/lib/training/vdot-calculator';
import { generatePredictions, type MultiSignalPrediction, type PredictionEngineInput, type WorkoutSignalInput, type BestEffortInput } from '@/lib/training/race-prediction-engine';
import { db, workouts, raceResults, workoutSegments, workoutFitnessSignals } from '@/lib/db';
import { eq, desc, gte, lte, and } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { getSettings } from './settings';
import { getFitnessTrendData } from './fitness';

/**
 * Race prediction using various models
 */

// Standard race distances in miles
const RACE_DISTANCES = [
  { name: '1 Mile', miles: 1, meters: 1609 },
  { name: '5K', miles: 3.107, meters: 5000 },
  { name: '10K', miles: 6.214, meters: 10000 },
  { name: 'Half Marathon', miles: 13.109, meters: 21097 },
  { name: 'Marathon', miles: 26.219, meters: 42195 },
];

export interface RacePrediction {
  distance: string;
  distanceMiles: number;
  predictedTimeSeconds: number;
  predictedPaceSeconds: number;
  confidence: 'high' | 'medium' | 'low';
  basedOn: string;
}

export interface RacePredictionResult {
  predictions: RacePrediction[];
  vdot: number | null;
  fitnessLevel: string;
  methodology: string;
}

/**
 * Riegel formula for race time prediction
 * T2 = T1 * (D2/D1)^1.06
 */
function riegelPredict(knownTimeSeconds: number, knownDistanceMiles: number, targetDistanceMiles: number): number {
  const exponent = 1.06;
  return knownTimeSeconds * Math.pow(targetDistanceMiles / knownDistanceMiles, exponent);
}

/**
 * Cameron formula (more aggressive for shorter distances)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function cameronPredict(knownTimeSeconds: number, knownDistanceMiles: number, targetDistanceMiles: number): number {
  // a = 13.49681 - 0.000030363*d + 835.7114/d^0.7905
  const calcA = (d: number) => 13.49681 - 0.000030363 * d + 835.7114 / Math.pow(d, 0.7905);
  const d1 = knownDistanceMiles * 1609.34;
  const d2 = targetDistanceMiles * 1609.34;
  const a1 = calcA(d1);
  const a2 = calcA(d2);
  return knownTimeSeconds * (a2 / a1);
}

/**
 * Get fitness level description from VDOT
 */
function getFitnessLevel(vdot: number): string {
  if (vdot >= 70) return 'Elite';
  if (vdot >= 60) return 'Highly Competitive';
  if (vdot >= 55) return 'Competitive';
  if (vdot >= 50) return 'Advanced';
  if (vdot >= 45) return 'Intermediate';
  if (vdot >= 40) return 'Developing';
  if (vdot >= 35) return 'Beginner';
  return 'Novice';
}

// Map best effort distance names to RACE_DISTANCES format
const DISTANCE_ALIASES: Record<string, string> = {
  '1mi': '1 Mile',
  '400m': '1 Mile', // approximate
  '800m': '1 Mile',
  '1K': '5K',
  '10mi': 'Half Marathon',
};

/**
 * Get race predictions based on best efforts
 */
export async function getRacePredictions(): Promise<RacePredictionResult> {
  const rawEfforts = await getBestEfforts();

  // Map to format expected by race predictor (date, distanceMiles, paceSeconds, isRace)
  const bestEfforts = rawEfforts.map((e) => {
    const distanceMiles = e.distanceMeters / 1609.34;
    const distanceName = DISTANCE_ALIASES[e.distance] || e.distance;
    return {
      ...e,
      date: e.workoutDate,
      distanceMiles,
      paceSeconds: distanceMiles > 0 ? e.timeSeconds / distanceMiles : 0,
      isRace: false,
      distance: distanceName,
    };
  });

  if (bestEfforts.length === 0) {
    return {
      predictions: [],
      vdot: null,
      fitnessLevel: 'Unknown',
      methodology: 'No race data available for predictions',
    };
  }

  // Use pre-computed adjusted VDOT from best efforts (already corrected for weather + elevation)
  const vdots: { vdot: number; distance: string; weight: number }[] = [];

  for (const effort of bestEfforts) {
    const distInfo = RACE_DISTANCES.find(d => d.name === effort.distance);
    if (!distInfo) continue;

    const vdot = effort.equivalentVDOT;
    if (!vdot) continue;

    // Skip physically impossible VDOT values (world record is ~85)
    if (vdot > 85 || vdot < 15) continue;

    // Weight by recency and race vs training (races weighted higher)
    let weight = 1;
    if (effort.isRace) weight *= 1.5;

    // Recent efforts weighted higher
    const daysSince = Math.floor((Date.now() - parseLocalDate(effort.date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 30) weight *= 1.3;
    else if (daysSince < 60) weight *= 1.1;

    vdots.push({ vdot, distance: effort.distance, weight });
  }

  if (vdots.length === 0) {
    return {
      predictions: [],
      vdot: null,
      fitnessLevel: 'Unknown',
      methodology: 'Unable to calculate VDOT from efforts',
    };
  }

  // Calculate weighted average VDOT
  const totalWeight = vdots.reduce((sum, v) => sum + v.weight, 0);
  const avgVdot = Math.max(15, Math.min(85,
    vdots.reduce((sum, v) => sum + v.vdot * v.weight, 0) / totalWeight
  ));

  // Find best single effort for Riegel predictions
  const bestEffort = bestEfforts.reduce((best, effort) =>
    (best.isRace || !effort.isRace) && best.paceSeconds <= effort.paceSeconds ? best : effort
  );

  // Generate predictions for all standard distances
  const predictions: RacePrediction[] = [];

  for (const dist of RACE_DISTANCES) {
    // Use VDOT-based prediction as primary
    const vdotTime = predictRaceTime(avgVdot, dist.meters);

    // Also calculate Riegel prediction from best effort
    const riegelTime = riegelPredict(bestEffort.timeSeconds, bestEffort.distanceMiles, dist.miles);

    // Average the two methods (VDOT weighted slightly higher as more sophisticated)
    const predictedTime = (vdotTime * 0.6 + riegelTime * 0.4);

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'medium';

    // High confidence if we have actual data at or near this distance
    const hasNearbyData = bestEfforts.some(e =>
      Math.abs(e.distanceMiles - dist.miles) / dist.miles < 0.3
    );

    if (hasNearbyData) {
      confidence = 'high';
    } else if (dist.miles > 13.1 && !bestEfforts.some(e => e.distanceMiles >= 10)) {
      // Low confidence for marathon predictions without long race data
      confidence = 'low';
    }

    // Check if this is a distance we already have data for
    const existingEffort = bestEfforts.find(e => e.distance === dist.name);

    predictions.push({
      distance: dist.name,
      distanceMiles: dist.miles,
      predictedTimeSeconds: Math.round(predictedTime),
      predictedPaceSeconds: Math.round(predictedTime / dist.miles),
      confidence,
      basedOn: existingEffort
        ? `PR: ${formatTime(existingEffort.timeSeconds)}`
        : `Estimated from ${bestEffort.distance} PR`,
    });
  }

  return {
    predictions,
    vdot: Math.round(avgVdot * 10) / 10,
    fitnessLevel: getFitnessLevel(avgVdot),
    methodology: `Based on ${vdots.length} effort${vdots.length > 1 ? 's' : ''}, weighted VDOT: ${Math.round(avgVdot)}`,
  };
}

/**
 * Calculate velocity (m/min) from VO2 using inverse of Daniels formula
 * VO2 = -4.60 + 0.182258*v + 0.000104*v^2
 * Solving quadratic: v = (-b + sqrt(b^2 - 4ac)) / 2a
 */
function velocityFromVO2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.60 - vo2;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 200; // Fallback

  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

/**
 * Convert velocity (m/min) to pace (seconds per mile)
 */
function velocityToPace(velocityMPerMin: number): number {
  if (velocityMPerMin <= 0) return 600; // Fallback to 10:00/mi
  const metersPerMile = 1609.34;
  const minutesPerMile = metersPerMile / velocityMPerMin;
  return Math.round(minutesPerMile * 60);
}

/**
 * Get training pace (sec/mi) at a given %VO2max for a VDOT value
 */
function getTrainingPace(vdot: number, percentVO2max: number): number {
  const targetVO2 = vdot * (percentVO2max / 100);
  const velocity = velocityFromVO2(targetVO2);
  return velocityToPace(velocity);
}

/**
 * Get pace recommendations for different training zones based on VDOT
 * Uses Jack Daniels' training pace methodology
 */
export async function getVDOTPaces(): Promise<{
  vdot: number;
  paces: {
    type: string;
    description: string;
    paceRange: string;
    paceSecondsMin: number;
    paceSecondsMax: number;
  }[];
} | null> {
  const result = await getRacePredictions();

  if (!result.vdot) return null;

  const vdot = result.vdot;

  // Calculate training paces using Daniels %VO2max zones
  // Easy: 59-74% VO2max
  const easyPaceMax = getTrainingPace(vdot, 59); // Slowest easy pace
  const easyPaceMin = getTrainingPace(vdot, 74); // Fastest easy pace

  // Steady: 74-79% VO2max (between easy and marathon)
  const steadyPace = getTrainingPace(vdot, 76);

  // Marathon: 75-84% VO2max
  const marathonPace = getTrainingPace(vdot, 79);

  // Threshold (Tempo): 83-88% VO2max
  const thresholdPace = getTrainingPace(vdot, 86);

  // Interval: 95-100% VO2max
  const intervalPace = getTrainingPace(vdot, 98);

  // Repetition: 105-110% VO2max (supramaximal)
  const repPace = getTrainingPace(vdot, 108);

  return {
    vdot,
    paces: [
      {
        type: 'Easy',
        description: 'Recovery and easy runs',
        paceRange: `${formatPace(easyPaceMin)}/mi - ${formatPace(easyPaceMax)}/mi`,
        paceSecondsMin: easyPaceMin,
        paceSecondsMax: easyPaceMax,
      },
      {
        type: 'Steady',
        description: 'Long runs, aerobic development',
        paceRange: `${formatPace(steadyPace)}/mi`,
        paceSecondsMin: steadyPace,
        paceSecondsMax: steadyPace,
      },
      {
        type: 'Marathon',
        description: 'Marathon-specific training',
        paceRange: `${formatPace(marathonPace)}/mi`,
        paceSecondsMin: marathonPace,
        paceSecondsMax: marathonPace,
      },
      {
        type: 'Threshold',
        description: 'Tempo runs, cruise intervals',
        paceRange: `${formatPace(thresholdPace)}/mi`,
        paceSecondsMin: thresholdPace,
        paceSecondsMax: thresholdPace,
      },
      {
        type: 'Interval',
        description: 'VO2max intervals (3-5 min)',
        paceRange: `${formatPace(intervalPace)}/mi`,
        paceSecondsMin: intervalPace,
        paceSecondsMax: intervalPace,
      },
      {
        type: 'Repetition',
        description: 'Fast reps (200-400m)',
        paceRange: `${formatPace(repPace)}/mi`,
        paceSecondsMin: repPace,
        paceSecondsMax: repPace,
      },
    ],
  };
}

// Helper to format time
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}


// ==================== Performance Model Predictions ====================

export interface PerformanceModelPrediction {
  distance: string;
  distanceLabel: string;
  meters: number;
  predictedTimeSeconds: number;
  predictedPaceSeconds: number;
}

export interface PerformanceModelResult {
  vdot: number;
  confidence: 'high' | 'medium' | 'low';
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  trendMagnitude: number | null;
  dataPoints: number;
  predictions: PerformanceModelPrediction[];
  sources: { races: number; timeTrials: number; workoutBestEfforts: number };
}

const PREDICTION_DISTANCES = [
  { label: '5K', name: '5K', meters: 5000, miles: 3.107 },
  { label: '10K', name: '10K', meters: 10000, miles: 6.214 },
  { label: 'Half Marathon', name: 'half_marathon', meters: 21097, miles: 13.109 },
  { label: 'Marathon', name: 'marathon', meters: 42195, miles: 26.219 },
];

/**
 * Get race predictions using the performance model (weighted VDOT from all sources).
 * Used on the races page for a clear view of predicted race times.
 */
export async function getPerformanceModelPredictions(
  profileId?: number
): Promise<PerformanceModelResult | null> {
  const model = await buildPerformanceModel(profileId);

  if (model.dataPoints === 0) return null;

  const vdot = model.estimatedVdot;
  if (vdot < 15 || vdot > 85) return null;

  const predictions: PerformanceModelPrediction[] = PREDICTION_DISTANCES.map(dist => {
    const timeSeconds = predictRaceTime(vdot, dist.meters);
    return {
      distance: dist.label,
      distanceLabel: dist.name,
      meters: dist.meters,
      predictedTimeSeconds: timeSeconds,
      predictedPaceSeconds: Math.round(timeSeconds / dist.miles),
    };
  });

  return {
    vdot,
    confidence: model.vdotConfidence,
    trend: model.trend,
    trendMagnitude: model.trendMagnitude,
    dataPoints: model.dataPoints,
    predictions,
    sources: model.sources,
  };
}

// ==================== Multi-Signal Comprehensive Predictions ====================

export type { MultiSignalPrediction };

/**
 * Get comprehensive race predictions using the multi-signal engine.
 * Collects data from DB, builds structured input, calls the pure engine.
 */
export async function getComprehensiveRacePredictions(
  profileId?: number,
  asOfDate?: Date
): Promise<MultiSignalPrediction | null> {
  try {
    const pid = profileId ?? await getActiveProfileId();
    if (!pid) {
      console.warn('[getComprehensiveRacePredictions] No active profile');
      return null;
    }

    const settings = await getSettings(pid);
    if (!settings) return null;

    const referenceDate = asOfDate ?? new Date();
    const asOfDateStr = referenceDate.toISOString().split('T')[0];
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - 1095); // 3 years of workout data
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Build query conditions with optional upper bound for backtest
    const workoutConditions = [eq(workouts.profileId, pid), gte(workouts.date, cutoffStr)];
    if (asOfDate) workoutConditions.push(lte(workouts.date, asOfDateStr));

    const raceConditions = [eq(raceResults.profileId, pid)];
    if (asOfDate) raceConditions.push(lte(raceResults.date, asOfDateStr));

    // Note: Don't filter segments by createdAt for the asOfDate upper bound.
    // Segments represent real workout data regardless of when they were imported
    // (e.g. Strava backfill). The workoutId join handles temporal scoping.
    const segmentConditions = [gte(workoutSegments.createdAt, cutoffStr)];

    // Parallel data collection
    const [recentWorkouts, races, allSegments, fitnessTrend, rawBestEfforts] = await Promise.all([
      // 1. Workouts (last 3 years) with relevant fields
      db.query.workouts.findMany({
        where: and(...workoutConditions),
        orderBy: [desc(workouts.date)],
      }),
      // 2. Race results (filtered by asOfDate when backtesting)
      db.query.raceResults.findMany({
        where: and(...raceConditions),
        orderBy: [desc(raceResults.date)],
      }),
      // 3. All segments for workouts in range (for decoupling)
      db.query.workoutSegments.findMany({
        where: and(...segmentConditions),
      }),
      // 4. Fitness metrics (CTL/ATL/TSB) — 180 days for current form
      getFitnessTrendData(180, pid, asOfDate),
      // 5. Best efforts (3 years)
      getBestEfforts(1095, asOfDate),
    ]);

    // Build segment lookup by workoutId
    type SegRow = typeof allSegments[number];
    const segsByWorkout = new Map<number, SegRow[]>();
    for (const seg of allSegments) {
      const existing = segsByWorkout.get(seg.workoutId) || [];
      existing.push(seg);
      segsByWorkout.set(seg.workoutId, existing);
    }

    // Build date→TSB lookup for per-workout fatigue correction
    const tsbByDate = new Map<string, number>();
    for (const m of fitnessTrend.metrics) {
      tsbByDate.set(m.date, m.tsb);
    }

    // Build WorkoutSignalInput array
    type WorkoutRow = typeof recentWorkouts[number];
    const workoutInputs: WorkoutSignalInput[] = recentWorkouts
      .filter((w: WorkoutRow) => w.distanceMiles && w.distanceMiles > 0 && w.durationMinutes && w.durationMinutes > 0 && !w.excludeFromEstimates)
      .map((w: WorkoutRow) => {
        const segs = segsByWorkout.get(w.id) || [];

        // Compute first/second half HR + pace for decoupling
        let firstHalfAvgHr: number | undefined;
        let firstHalfAvgPace: number | undefined;
        let secondHalfAvgHr: number | undefined;
        let secondHalfAvgPace: number | undefined;

        if (segs.length >= 4) {
          const mid = Math.floor(segs.length / 2);
          const firstHalf = segs.slice(0, mid);
          const secondHalf = segs.slice(mid);

          const hrFirst = firstHalf.filter((s: SegRow) => s.avgHr).map((s: SegRow) => s.avgHr!);
          const hrSecond = secondHalf.filter((s: SegRow) => s.avgHr).map((s: SegRow) => s.avgHr!);
          const paceFirst = firstHalf.filter((s: SegRow) => s.paceSecondsPerMile).map((s: SegRow) => s.paceSecondsPerMile!);
          const paceSecond = secondHalf.filter((s: SegRow) => s.paceSecondsPerMile).map((s: SegRow) => s.paceSecondsPerMile!);

          if (hrFirst.length > 0) firstHalfAvgHr = hrFirst.reduce((sum: number, v: number) => sum + v, 0) / hrFirst.length;
          if (hrSecond.length > 0) secondHalfAvgHr = hrSecond.reduce((sum: number, v: number) => sum + v, 0) / hrSecond.length;
          if (paceFirst.length > 0) firstHalfAvgPace = paceFirst.reduce((sum: number, v: number) => sum + v, 0) / paceFirst.length;
          if (paceSecond.length > 0) secondHalfAvgPace = paceSecond.reduce((sum: number, v: number) => sum + v, 0) / paceSecond.length;
        }

        return {
          id: w.id,
          date: w.date,
          distanceMiles: w.distanceMiles!,
          durationMinutes: w.durationMinutes!,
          avgPaceSeconds: w.avgPaceSeconds || Math.round((w.durationMinutes! * 60) / w.distanceMiles!),
          avgHr: w.avgHr || w.avgHeartRate || null,
          maxHr: w.maxHr || null,
          elevationGainFt: w.elevationGainFt || w.elevationGainFeet || null,
          weatherTempF: w.weatherTempF || null,
          weatherHumidityPct: w.weatherHumidityPct || null,
          workoutType: w.workoutType || 'easy',
          tsb: tsbByDate.get(w.date),
          firstHalfAvgHr,
          firstHalfAvgPace,
          secondHalfAvgHr,
          secondHalfAvgPace,
        };
      });

    // Build workout lookup for enriching races/efforts with weather/elevation
    const workoutById = new Map<number, WorkoutRow>();
    for (const w of recentWorkouts) {
      workoutById.set(w.id, w);
    }

    const inferEffortFromWorkout = (w: WorkoutRow): 'all_out' | 'hard' | 'moderate' | 'easy' => {
      const wt = (w.workoutType || '').toLowerCase();
      const avgHr = w.avgHr || w.avgHeartRate || 0;
      const maxHr = w.maxHr || 0;
      const hrRatio = maxHr > 0 ? avgHr / maxHr : null;

      if (wt === 'race') {
        if (hrRatio != null && hrRatio >= 0.9) return 'all_out';
        if (hrRatio != null && hrRatio >= 0.84) return 'hard';
        return 'moderate';
      }
      if (wt === 'interval' || wt === 'threshold' || wt === 'tempo') return 'hard';
      return 'moderate';
    };

    // Build race inputs (enriched with weather/elevation from linked workout)
    type RaceRow = typeof races[number];
    const raceInputs: BestEffortInput[] = races
      .filter((r: RaceRow) => r.distanceMeters > 0 && r.finishTimeSeconds > 0)
      .map((r: RaceRow) => {
        const parentWorkout = r.workoutId ? workoutById.get(r.workoutId) : undefined;
        return {
          date: r.date,
          distanceMeters: r.distanceMeters,
          timeSeconds: r.finishTimeSeconds,
          source: 'race' as const,
          effortLevel: r.effortLevel || undefined,
          workoutId: r.workoutId ?? undefined,
          weatherTempF: parentWorkout?.weatherTempF ?? undefined,
          weatherHumidityPct: parentWorkout?.weatherHumidityPct ?? undefined,
          elevationGainFt: parentWorkout?.elevationGainFt ?? parentWorkout?.elevationGainFeet ?? undefined,
        };
      });

    // Auto-detect additional race-like efforts from imported workouts when no explicit race result exists.
    const linkedRaceWorkoutIds = new Set(
      races.map((r: RaceRow) => r.workoutId).filter((id): id is number => id != null)
    );
    const importedRaceEfforts: BestEffortInput[] = recentWorkouts
      .filter((w: WorkoutRow) => {
        if (!w.distanceMiles || !w.durationMinutes || w.distanceMiles <= 0 || w.durationMinutes <= 0) return false;
        if (linkedRaceWorkoutIds.has(w.id)) return false;
        const wt = (w.workoutType || '').toLowerCase();
        return wt === 'race' || wt === 'time_trial';
      })
      .map((w: WorkoutRow) => ({
        date: w.date,
        distanceMeters: Math.round((w.distanceMiles || 0) * 1609.34),
        timeSeconds: Math.round((w.durationMinutes || 0) * 60),
        source: 'time_trial' as const,
        effortLevel: inferEffortFromWorkout(w),
        workoutId: w.id,
        weatherTempF: w.weatherTempF ?? undefined,
        weatherHumidityPct: w.weatherHumidityPct ?? undefined,
        elevationGainFt: w.elevationGainFt ?? w.elevationGainFeet ?? undefined,
      }));

    const allRaceInputs: BestEffortInput[] = [...raceInputs, ...importedRaceEfforts];

    // Build best effort inputs (enriched with weather/elevation from parent workout)
    const bestEffortInputs: BestEffortInput[] = rawBestEfforts
      .filter(e => e.distanceMeters > 0 && e.timeSeconds > 0)
      .map(e => {
        const parentWorkout = e.workoutId ? workoutById.get(e.workoutId) : undefined;
        return {
          date: e.workoutDate,
          distanceMeters: e.distanceMeters,
          timeSeconds: e.timeSeconds,
          source: 'workout_segment' as const,
          workoutId: e.workoutId,
          weatherTempF: parentWorkout?.weatherTempF ?? undefined,
          weatherHumidityPct: parentWorkout?.weatherHumidityPct ?? undefined,
          elevationGainFt: parentWorkout?.elevationGainFt ?? parentWorkout?.elevationGainFeet ?? undefined,
        };
      });

    // Augment with stream-analyzed best segment VDOTs (stored in fitness signals)
    try {
      const fitnessSignalRows = await db.query.workoutFitnessSignals.findMany({
        where: and(
          eq(workoutFitnessSignals.profileId, pid),
        ),
      });
      for (const sig of fitnessSignalRows) {
        if (!sig.bestSegmentVdot || sig.bestSegmentVdot < 15) continue;
        // Only include medium/high confidence segments
        if (sig.bestSegmentConfidence === 'low') continue;
        const parentWorkout = workoutById.get(sig.workoutId);
        if (!parentWorkout) continue;
        // Reverse-engineer a synthetic best effort from the VDOT
        // Use 1 mile distance as the canonical representation
        const syntheticTime = predictRaceTime(sig.bestSegmentVdot, 1609.34);
        bestEffortInputs.push({
          date: parentWorkout.date,
          distanceMeters: 1609.34,
          timeSeconds: syntheticTime,
          source: 'workout_segment' as const,
          workoutId: sig.workoutId,
          weatherTempF: parentWorkout.weatherTempF ?? undefined,
          weatherHumidityPct: parentWorkout.weatherHumidityPct ?? undefined,
          elevationGainFt: parentWorkout.elevationGainFt ?? parentWorkout.elevationGainFeet ?? undefined,
        });
      }
    } catch {
      // Non-critical — continue with lap-based best efforts only
    }

    // Compute training volume
    const fourWeeksAgo = new Date(referenceDate);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeekWorkouts = recentWorkouts.filter((w: WorkoutRow) =>
      w.date >= fourWeeksAgo.toISOString().split('T')[0] && w.distanceMiles
    );

    const totalMiles4Weeks = fourWeekWorkouts.reduce((s: number, w: WorkoutRow) => s + (w.distanceMiles || 0), 0);
    const avgWeeklyMiles4Weeks = totalMiles4Weeks / 4;
    const longestRecentRunMiles = Math.max(0, ...fourWeekWorkouts.map((w: WorkoutRow) => w.distanceMiles || 0));

    // Consecutive training weeks
    let weeksConsecutiveTraining = 0;
    for (let weekBack = 0; weekBack < 20; weekBack++) {
      const weekStart = new Date(referenceDate);
      weekStart.setDate(weekStart.getDate() - (weekBack + 1) * 7);
      const weekEnd = new Date(referenceDate);
      weekEnd.setDate(weekEnd.getDate() - weekBack * 7);
      const weekStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      const hasRun = recentWorkouts.some((w: WorkoutRow) => w.date >= weekStr && w.date < weekEndStr);
      if (hasRun) weeksConsecutiveTraining++;
      else break;
    }

    // Quality sessions per week (tempo, threshold, interval, race in last 4 weeks)
    const qualityTypes = ['tempo', 'threshold', 'interval', 'repetition', 'race'];
    const qualitySessions = fourWeekWorkouts.filter((w: WorkoutRow) => qualityTypes.includes(w.workoutType)).length;
    const qualitySessionsPerWeek = qualitySessions / 4;

    // Physiology
    const age = settings.age || null;
    const restingHr = settings.restingHr || 60;
    const maxHrFromSettings = age ? 220 - age : 185;
    // Use highest observed HR across workouts if higher
    const maxHrFromData = Math.max(0, ...recentWorkouts.map((w: WorkoutRow) => w.maxHr || 0));
    const maxHr = Math.max(maxHrFromSettings, maxHrFromData);

    // HR calibration: find a race result that has matching workout HR data
    let hrCalibration: PredictionEngineInput['hrCalibration'] | undefined;
    for (const race of races) {
      if (!race.distanceMeters || !race.finishTimeSeconds) continue;
      // Find a workout on the same date with HR (need it for weather/elevation data too)
      const matchingWorkout = recentWorkouts.find((w: WorkoutRow) =>
        w.date === race.date && (w.avgHr || w.avgHeartRate)
      );
      const raceVdot = calculateAdjustedVDOT(race.distanceMeters, race.finishTimeSeconds, {
        weatherTempF: matchingWorkout?.weatherTempF,
        weatherHumidityPct: matchingWorkout?.weatherHumidityPct,
        elevationGainFt: matchingWorkout?.elevationGainFt ?? matchingWorkout?.elevationGainFeet,
      });
      if (raceVdot < 15 || raceVdot > 85) continue;

      if (matchingWorkout) {
        hrCalibration = {
          raceVdot,
          raceAvgHr: matchingWorkout.avgHr || matchingWorkout.avgHeartRate || 0,
          raceDurationMin: race.finishTimeSeconds / 60,
        };
        break;
      }
    }

    // Build engine input
    const engineInput: PredictionEngineInput = {
      physiology: {
        restingHr,
        maxHr,
        age,
        gender: settings.gender || null,
      },
      workouts: workoutInputs,
      races: allRaceInputs,
      bestEfforts: bestEffortInputs,
      fitnessState: {
        ctl: fitnessTrend.currentCtl,
        atl: fitnessTrend.currentAtl,
        tsb: fitnessTrend.currentTsb,
      },
      trainingVolume: {
        avgWeeklyMiles4Weeks: Math.round(avgWeeklyMiles4Weeks * 10) / 10,
        longestRecentRunMiles: Math.round(longestRecentRunMiles * 10) / 10,
        weeksConsecutiveTraining,
        qualitySessionsPerWeek: Math.round(qualitySessionsPerWeek * 10) / 10,
      },
      savedVdot: settings.vdot || null,
      hrCalibration,
      asOfDate,
    };

    // Call the pure engine
    return generatePredictions(engineInput);
  } catch (error) {
    console.error('[getComprehensiveRacePredictions] Error:', error instanceof Error ? error.message : error);
    console.error('[getComprehensiveRacePredictions] Stack:', error instanceof Error ? error.stack : 'no stack');
    return null;
  }
}
