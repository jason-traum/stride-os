/**
 * VDOT Calculator
 *
 * Based on Jack Daniels' Running Formula.
 * VDOT is a measure of running ability that can be used to calculate training paces.
 *
 * The formulas used are approximations of Daniels' tables.
 */

import { PaceZones, RACE_DISTANCES } from './types';
import { formatPace } from '@/lib/utils';

// ==================== VDOT Calculation ====================

/**
 * Calculate VDOT from a race result.
 * Uses the velocity at VO2max formula.
 *
 * @param distanceMeters - Race distance in meters
 * @param timeSeconds - Finish time in seconds
 * @returns VDOT value clamped to 15-85 range
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

  // Clamp to physically possible range (15-85)
  const clamped = Math.max(15, Math.min(85, vdot));

  return Math.round(clamped * 10) / 10; // Round to 1 decimal
}

/**
 * Elevation pace correction: seconds per mile penalty for elevation gain.
 * ~12 sec/mi per 100 ft/mi of gain.
 */
export function elevationPaceCorrection(elevationGainFt: number, distanceMiles: number): number {
  if (distanceMiles <= 0 || elevationGainFt <= 0) return 0;
  const gainPerMile = elevationGainFt / distanceMiles;
  return Math.round((gainPerMile / 100) * 12);
}

/**
 * Calculate VDOT adjusted for weather and elevation conditions.
 * Corrects the raw time to estimate flat/ideal-conditions performance,
 * then calculates VDOT from the corrected time.
 *
 * @param distanceMeters - Race distance in meters
 * @param timeSeconds - Finish time in seconds
 * @param options - Weather and elevation data for correction
 * @returns Adjusted VDOT (higher than raw VDOT when conditions were tough)
 */
export function calculateAdjustedVDOT(
  distanceMeters: number,
  timeSeconds: number,
  options?: {
    weatherTempF?: number | null;
    weatherHumidityPct?: number | null;
    elevationGainFt?: number | null;
  }
): number {
  if (!options) return calculateVDOT(distanceMeters, timeSeconds);

  const distanceMiles = distanceMeters / 1609.34;
  let totalPaceAdj = 0;

  if (options.weatherTempF != null && options.weatherHumidityPct != null) {
    totalPaceAdj += getWeatherPaceAdjustment(options.weatherTempF, options.weatherHumidityPct);
  }
  if (options.elevationGainFt != null && options.elevationGainFt > 0 && distanceMiles > 0) {
    totalPaceAdj += elevationPaceCorrection(options.elevationGainFt, distanceMiles);
  }

  if (totalPaceAdj <= 0) return calculateVDOT(distanceMeters, timeSeconds);

  // Subtract the per-mile penalty across all miles
  const correctedTime = timeSeconds - (totalPaceAdj * distanceMiles);

  // Safety: never reduce by more than 15%
  const safeTime = Math.max(correctedTime, timeSeconds * 0.85);

  return calculateVDOT(distanceMeters, safeTime);
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
 * Approximate heat index from temp (°F) and relative humidity (%).
 * Simplified Rothfusz regression used by NWS.
 */
function heatIndex(tempF: number, rh: number): number {
  if (tempF < 68 || rh < 40) return tempF;
  // Rothfusz regression
  let hi = -42.379
    + 2.04901523 * tempF
    + 10.14333127 * rh
    - 0.22475541 * tempF * rh
    - 0.00683783 * tempF * tempF
    - 0.05481717 * rh * rh
    + 0.00122874 * tempF * tempF * rh
    + 0.00085282 * tempF * rh * rh
    - 0.00000199 * tempF * tempF * rh * rh;
  // Low-humidity adjustment
  if (rh < 13 && tempF >= 80 && tempF <= 112) {
    hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(tempF - 95)) / 17);
  }
  // High-humidity adjustment
  if (rh > 85 && tempF >= 80 && tempF <= 87) {
    hi += ((rh - 85) / 10) * ((87 - tempF) / 5);
  }
  return hi;
}

/**
 * Adjust pace for weather conditions.
 * Returns the number of seconds to add per mile.
 *
 * Conservative, research-backed formula. Intentionally understates
 * rather than overstates to maintain data integrity.
 *
 * Sources:
 * - Mantzios et al. 2022: 0.3-0.4% per 1°C outside optimal WBGT
 * - El Helou et al. 2012: Optimal 43-50°F for recreational marathoners
 * - Ely et al. 2007: Non-linear heat effect, slower runners more affected
 * - Periard et al. 2021: Humidity negligible below 65°F air temp
 *
 * See /methodology for full explanation.
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

  // Optimal racing temp: ~45°F (7°C)
  // Mid-range of research: elite males peak at 39°F, recreational 43-50°F
  // (El Helou 2012, Ely 2007)
  const OPTIMAL_TEMP = 45;

  if (temperature > OPTIMAL_TEMP) {
    if (temperature > 85) {
      // Severe heat zone: significant physiological stress
      // Base from mild + warm zones, plus escalating heat penalty
      adjustment += (70 - OPTIMAL_TEMP) * 0.4; // mild zone (10 sec)
      adjustment += (85 - 70) * 1.0;            // warm zone (15 sec)
      adjustment += (temperature - 85) * 1.5;   // severe zone
    } else if (temperature > 70) {
      // Warm zone: thermoregulation becomes limiting
      // ~1.0 sec/mi per °F (Mantzios: 0.3-0.4%/°C ≈ 0.7-1.0 sec/mi at 7:15 pace)
      adjustment += (70 - OPTIMAL_TEMP) * 0.4; // mild zone base (10 sec)
      adjustment += (temperature - 70) * 1.0;   // warm zone
    } else {
      // Mild zone: 45-70°F, ~0.4 sec/mi per °F
      // Conservative: below Mantzios mean of 0.74 sec/mi per °F
      adjustment += (temperature - OPTIMAL_TEMP) * 0.4;
    }

    // Humidity modifier: above 55°F air temp when humidity is high
    // Periard 2021 found negligible effect below ~65°F in lab settings,
    // but real-world race conditions with very high humidity (>70%) can
    // impair evaporative cooling even in the mid-50s during hard effort.
    // We use 55°F threshold with humidity >60% as a conservative middle ground.
    if (temperature > 65 && humidity > 50) {
      adjustment += (humidity - 50) * 0.1;
    } else if (temperature > 55 && humidity > 60) {
      // Smaller effect at moderate temps with very high humidity
      adjustment += (humidity - 60) * 0.05;
    }
  } else if (temperature < 35) {
    // Cold penalty: minor, partially mitigable by clothing
    // Mantzios 2022: ~0.3-0.4%/°C below optimal, but asymmetric —
    // "a little too cold is much better than a little too hot"
    adjustment += (35 - temperature) * 0.2;
  }

  // Dew point: supplementary signal for oppressive humidity (>60°F dew point)
  if (dewPoint !== undefined && dewPoint > 60) {
    adjustment += (dewPoint - 60) * 0.3;
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
