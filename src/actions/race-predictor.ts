'use server';

import { db, workouts } from '@/lib/db';
import { desc, gte, eq } from 'drizzle-orm';
import { getBestEfforts, type BestEffort } from './best-efforts';

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

/**
 * Get race predictions based on best efforts
 */
export async function getRacePredictions(): Promise<RacePredictionResult> {
  const bestEfforts = await getBestEfforts();

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

    // Weight by recency and race vs training (races weighted higher)
    let weight = 1;
    if (effort.isRace) weight *= 1.5;

    // Recent efforts weighted higher
    const daysSince = Math.floor((Date.now() - new Date(effort.date).getTime()) / (1000 * 60 * 60 * 24));
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
  const avgVdot = vdots.reduce((sum, v) => sum + v.vdot * v.weight, 0) / totalWeight;

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
 * Get pace recommendations for different training zones based on VDOT
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

  // Calculate training paces from VDOT
  // These are based on Daniels' running formula approximations
  const easyPaceMin = Math.round(29.54 + 5.000663 * Math.pow(86 - vdot, 0.5) * 60);
  const easyPaceMax = Math.round(easyPaceMin * 1.1);

  const marathonPace = Math.round(29.54 + 5.000663 * Math.pow(79 - vdot, 0.5) * 60);
  const thresholdPace = Math.round(29.54 + 5.000663 * Math.pow(83 - vdot, 0.5) * 60);
  const intervalPace = Math.round(29.54 + 5.000663 * Math.pow(88 - vdot, 0.5) * 60);
  const repPace = Math.round(29.54 + 5.000663 * Math.pow(92 - vdot, 0.5) * 60);

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
