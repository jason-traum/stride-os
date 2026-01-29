/**
 * VDOT Calculator
 *
 * Based on Jack Daniels' Running Formula.
 * VDOT is a measure of running ability that can be used to calculate training paces.
 *
 * The formulas used are approximations of Daniels' tables.
 */

import { PaceZones, RACE_DISTANCES, formatPace } from './types';

// ==================== VDOT Calculation ====================

/**
 * Calculate VDOT from a race result.
 * Uses the velocity at VO2max formula.
 *
 * @param distanceMeters - Race distance in meters
 * @param timeSeconds - Finish time in seconds
 * @returns VDOT value (typically 30-85 for recreational to elite runners)
 */
export function calculateVDOT(distanceMeters: number, timeSeconds: number): number {
  // Velocity in meters per minute
  const velocity = distanceMeters / (timeSeconds / 60);

  // Percent of VO2max used (based on time)
  const timeMinutes = timeSeconds / 60;
  const percentVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMinutes) +
                        0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  // VO2 at this velocity
  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;

  // VDOT = VO2 / percent
  const vdot = vo2 / percentVO2max;

  return Math.round(vdot * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate velocity (meters per minute) for a given VDOT and percent of VO2max.
 */
function velocityFromVDOT(vdot: number, percentVO2max: number): number {
  const vo2 = vdot * percentVO2max;
  // Solve the quadratic: VO2 = -4.60 + 0.182258*v + 0.000104*v^2
  // 0.000104*v^2 + 0.182258*v + (-4.60 - VO2) = 0
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.60 - vo2;
  const discriminant = b * b - 4 * a * c;
  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

/**
 * Convert velocity (meters per minute) to pace (seconds per mile).
 */
function velocityToPaceSecondsPerMile(velocity: number): number {
  const metersPerMile = 1609.34;
  const minutesPerMile = metersPerMile / velocity;
  return Math.round(minutesPerMile * 60);
}

// ==================== Pace Zone Calculation ====================

/**
 * Calculate all training paces from VDOT.
 * Based on Jack Daniels' training intensity zones.
 */
export function calculatePaceZones(vdot: number): PaceZones {
  // Recovery: ~55-60% VO2max
  const recoveryVelocity = velocityFromVDOT(vdot, 0.55);

  // Easy: ~59-74% VO2max
  const easyVelocity = velocityFromVDOT(vdot, 0.65);

  // General Aerobic: ~65-75% VO2max
  const gaVelocity = velocityFromVDOT(vdot, 0.70);

  // Marathon: ~75-80% VO2max
  const marathonVelocity = velocityFromVDOT(vdot, 0.78);

  // Half Marathon: ~80-85% VO2max
  const halfMarathonVelocity = velocityFromVDOT(vdot, 0.83);

  // Tempo: ~83-88% VO2max
  const tempoVelocity = velocityFromVDOT(vdot, 0.85);

  // Threshold: ~88-92% VO2max (lactate threshold)
  const thresholdVelocity = velocityFromVDOT(vdot, 0.88);

  // VO2max/Interval: ~95-100% VO2max
  const vo2maxVelocity = velocityFromVDOT(vdot, 0.95);

  // Interval: Same as VO2max for most purposes
  const intervalVelocity = velocityFromVDOT(vdot, 0.97);

  // Repetition: ~105-110% VO2max (can exceed 100% briefly)
  const repetitionVelocity = velocityFromVDOT(vdot, 1.05);

  return {
    recovery: velocityToPaceSecondsPerMile(recoveryVelocity),
    easy: velocityToPaceSecondsPerMile(easyVelocity),
    generalAerobic: velocityToPaceSecondsPerMile(gaVelocity),
    marathon: velocityToPaceSecondsPerMile(marathonVelocity),
    halfMarathon: velocityToPaceSecondsPerMile(halfMarathonVelocity),
    tempo: velocityToPaceSecondsPerMile(tempoVelocity),
    threshold: velocityToPaceSecondsPerMile(thresholdVelocity),
    vo2max: velocityToPaceSecondsPerMile(vo2maxVelocity),
    interval: velocityToPaceSecondsPerMile(intervalVelocity),
    repetition: velocityToPaceSecondsPerMile(repetitionVelocity),
    vdot,
  };
}

/**
 * Estimate VDOT from an easy pace (useful when no race result is available).
 * Easy pace is typically 65% of VO2max.
 */
export function estimateVDOTFromEasyPace(easyPaceSecondsPerMile: number): number {
  const metersPerMile = 1609.34;
  const velocity = metersPerMile / (easyPaceSecondsPerMile / 60);

  // Work backwards from easy pace
  // VO2 at easy = vdot * 0.65
  // VO2 = -4.60 + 0.182258*v + 0.000104*v^2
  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  const vdot = vo2 / 0.65;

  return Math.round(vdot * 10) / 10;
}

// ==================== Race Time Prediction ====================

/**
 * Predict race time from VDOT.
 *
 * @param vdot - VDOT value
 * @param distanceMeters - Race distance
 * @returns Predicted time in seconds
 */
export function predictRaceTime(vdot: number, distanceMeters: number): number {
  // Iterate to find the time that matches this VDOT
  // Start with an estimate based on velocity at 80% VO2max
  const estimatedVelocity = velocityFromVDOT(vdot, 0.80);
  let timeSeconds = distanceMeters / estimatedVelocity * 60;

  // Refine with a few iterations
  for (let i = 0; i < 10; i++) {
    const calculatedVDOT = calculateVDOT(distanceMeters, timeSeconds);
    if (Math.abs(calculatedVDOT - vdot) < 0.1) break;

    // Adjust time based on difference
    const ratio = vdot / calculatedVDOT;
    timeSeconds = timeSeconds / ratio;
  }

  return Math.round(timeSeconds);
}

// ==================== Pace Descriptions ====================

export interface PaceZoneDescription {
  zone: string;
  pace: string;
  effortDescription: string;
  purpose: string;
}

/**
 * Get human-readable descriptions for all pace zones.
 */
export function getPaceZoneDescriptions(zones: PaceZones): PaceZoneDescription[] {
  return [
    {
      zone: 'Recovery',
      pace: formatPace(zones.recovery),
      effortDescription: 'Very easy jog. Should feel almost too slow. 30-50% effort.',
      purpose: 'Active recovery, blood flow without training stress.'
    },
    {
      zone: 'Easy',
      pace: formatPace(zones.easy),
      effortDescription: 'Conversational pace. Can speak in full sentences. 50-65% effort.',
      purpose: 'Aerobic base building, daily training pace.'
    },
    {
      zone: 'General Aerobic',
      pace: formatPace(zones.generalAerobic),
      effortDescription: 'Comfortable but purposeful. Can speak in sentences. 60-70% effort.',
      purpose: 'Higher aerobic stimulus, good for medium-long runs.'
    },
    {
      zone: 'Marathon',
      pace: formatPace(zones.marathon),
      effortDescription: 'Comfortably hard. Can speak in short phrases. 70-80% effort.',
      purpose: 'Marathon race pace, long run goal pace segments.'
    },
    {
      zone: 'Half Marathon',
      pace: formatPace(zones.halfMarathon),
      effortDescription: 'Hard but sustainable. Few words at a time. 78-85% effort.',
      purpose: 'Half marathon race pace, sustained tempo efforts.'
    },
    {
      zone: 'Tempo',
      pace: formatPace(zones.tempo),
      effortDescription: 'Comfortably hard. Threshold of conversation. 78-88% effort.',
      purpose: 'Lactate clearance, controlled discomfort.'
    },
    {
      zone: 'Threshold',
      pace: formatPace(zones.threshold),
      effortDescription: 'Hard. At the edge of sustainable. 82-88% effort.',
      purpose: 'Lactate threshold improvement, ~1 hour race pace.'
    },
    {
      zone: 'VO2max',
      pace: formatPace(zones.vo2max),
      effortDescription: 'Very hard. Can only say a few words. 90-95% effort.',
      purpose: 'Maximum aerobic capacity development.'
    },
    {
      zone: 'Interval',
      pace: formatPace(zones.interval),
      effortDescription: 'Very hard. Near maximum sustainable. 90-95% effort.',
      purpose: '5K race pace, VO2max intervals.'
    },
    {
      zone: 'Repetition',
      pace: formatPace(zones.repetition),
      effortDescription: 'All out. Maximum effort. 95-100% effort.',
      purpose: 'Speed development, running economy.'
    }
  ];
}

// ==================== Weather Adjustments ====================

/**
 * Adjust pace for weather conditions.
 * Returns the number of seconds to add per mile.
 *
 * @param temperature - Temperature in Fahrenheit
 * @param humidity - Humidity percentage (0-100)
 * @param dewPoint - Dew point in Fahrenheit (optional)
 * @returns Seconds to add per mile (positive = slower)
 */
export function getWeatherPaceAdjustment(
  temperature: number,
  humidity: number,
  dewPoint?: number
): number {
  let adjustment = 0;

  // Temperature adjustments (ideal is 50-55°F)
  if (temperature > 55) {
    // Heat adjustments (exponential increase above 70°F)
    if (temperature > 70) {
      const excess = temperature - 70;
      adjustment += excess * 1.5; // 1.5 sec/mi per degree above 70
      if (temperature > 80) {
        adjustment += (temperature - 80) * 2; // Additional penalty above 80
      }
    } else if (temperature > 55) {
      adjustment += (temperature - 55) * 0.5; // Mild penalty 55-70
    }

    // Humidity compounds heat
    if (temperature > 65 && humidity > 60) {
      adjustment += (humidity - 60) * 0.3;
    }
  } else if (temperature < 40) {
    // Cold adjustments (minor, mostly about comfort)
    adjustment += (40 - temperature) * 0.2;
  }

  // Dew point is often a better indicator than humidity
  if (dewPoint !== undefined && dewPoint > 60) {
    adjustment += (dewPoint - 60) * 0.5;
  }

  return Math.round(adjustment);
}

/**
 * Adjust all pace zones for weather.
 */
export function adjustPaceZonesForWeather(
  zones: PaceZones,
  temperature: number,
  humidity: number,
  dewPoint?: number
): PaceZones {
  const adjustment = getWeatherPaceAdjustment(temperature, humidity, dewPoint);

  if (adjustment === 0) return zones;

  return {
    ...zones,
    recovery: zones.recovery + adjustment,
    easy: zones.easy + adjustment,
    generalAerobic: zones.generalAerobic + adjustment,
    marathon: zones.marathon + adjustment,
    halfMarathon: zones.halfMarathon + adjustment,
    tempo: zones.tempo + adjustment,
    threshold: zones.threshold + Math.round(adjustment * 0.8), // Slightly less adjustment for hard efforts
    vo2max: zones.vo2max + Math.round(adjustment * 0.5),
    interval: zones.interval + Math.round(adjustment * 0.5),
    repetition: zones.repetition + Math.round(adjustment * 0.3),
  };
}

// ==================== Race Equivalent Calculator ====================

/**
 * Calculate equivalent race times for all standard distances.
 */
export function getEquivalentRaceTimes(vdot: number): Record<string, { time: number; pace: number }> {
  const results: Record<string, { time: number; pace: number }> = {};

  for (const [key, distance] of Object.entries(RACE_DISTANCES)) {
    const time = predictRaceTime(vdot, distance.meters);
    const pace = Math.round(time / distance.miles);
    results[key] = { time, pace };
  }

  return results;
}

// ==================== Utility Functions ====================

/**
 * Get pace for a specific zone from PaceZones object.
 */
export function getPaceForZone(zones: PaceZones, zone: string): number | undefined {
  const zoneMap: Record<string, keyof PaceZones> = {
    'recovery': 'recovery',
    'easy': 'easy',
    'easy_long': 'easy', // Same as easy
    'general_aerobic': 'generalAerobic',
    'steady': 'generalAerobic',
    'marathon': 'marathon',
    'half_marathon': 'halfMarathon',
    'tempo': 'tempo',
    'threshold': 'threshold',
    'vo2max': 'vo2max',
    'interval': 'interval',
    'repetition': 'repetition',
  };

  const key = zoneMap[zone.toLowerCase()];
  if (key && key !== 'vdot') {
    return zones[key] as number;
  }
  return undefined;
}
