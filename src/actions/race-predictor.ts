'use server';

import { getBestEfforts } from './best-efforts';
import { parseLocalDate } from '@/lib/utils';
import { buildPerformanceModel } from '@/lib/training/performance-model';
import { predictRaceTime } from '@/lib/training/vdot-calculator';

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
 * Calculate VDOT from a race performance
 * Based on Jack Daniels' running formula
 */
function calculateVDOT(distanceMeters: number, timeSeconds: number): number {
  // VO2 as function of velocity (meters/min)
  const velocity = distanceMeters / (timeSeconds / 60);

  // Percent VO2max sustained (function of time)
  const time = timeSeconds / 60; // minutes
  const percentVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * time) + 0.2989558 * Math.exp(-0.1932605 * time);

  // VO2 at this velocity
  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;

  // VDOT = VO2 / percent
  const vdot = vo2 / percentVO2max;

  return Math.round(vdot * 10) / 10;
}

/**
 * Predict race time from VDOT
 */
function predictTimeFromVDOT(vdot: number, distanceMeters: number): number {
  // Binary search for time that produces this VDOT
  let low = distanceMeters / 10; // Absurdly fast
  let high = distanceMeters * 2; // Very slow

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const testVdot = calculateVDOT(distanceMeters, mid);

    if (Math.abs(testVdot - vdot) < 0.1) {
      return mid;
    }

    if (testVdot > vdot) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
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

  // Calculate VDOT from each best effort
  const vdots: { vdot: number; distance: string; weight: number }[] = [];

  for (const effort of bestEfforts) {
    const distInfo = RACE_DISTANCES.find(d => d.name === effort.distance);
    if (!distInfo) continue;

    const vdot = calculateVDOT(distInfo.meters, effort.timeSeconds);

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
    const vdotTime = predictTimeFromVDOT(avgVdot, dist.meters);

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
        paceRange: `${formatPace(easyPaceMin)} - ${formatPace(easyPaceMax)}`,
        paceSecondsMin: easyPaceMin,
        paceSecondsMax: easyPaceMax,
      },
      {
        type: 'Steady',
        description: 'Long runs, aerobic development',
        paceRange: formatPace(steadyPace),
        paceSecondsMin: steadyPace,
        paceSecondsMax: steadyPace,
      },
      {
        type: 'Marathon',
        description: 'Marathon-specific training',
        paceRange: formatPace(marathonPace),
        paceSecondsMin: marathonPace,
        paceSecondsMax: marathonPace,
      },
      {
        type: 'Threshold',
        description: 'Tempo runs, cruise intervals',
        paceRange: formatPace(thresholdPace),
        paceSecondsMin: thresholdPace,
        paceSecondsMax: thresholdPace,
      },
      {
        type: 'Interval',
        description: 'VO2max intervals (3-5 min)',
        paceRange: formatPace(intervalPace),
        paceSecondsMin: intervalPace,
        paceSecondsMax: intervalPace,
      },
      {
        type: 'Repetition',
        description: 'Fast reps (200-400m)',
        paceRange: formatPace(repPace),
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

// Helper to format pace
function formatPace(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}/mi`;
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
