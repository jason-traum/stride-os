/**
 * Pace and duration estimation utilities
 */

import type { WorkoutType } from './schema';

// Average paces by workout type (seconds per mile) - used as fallback
const DEFAULT_PACES: Record<WorkoutType, number> = {
  recovery: 10 * 60 + 30, // 10:30/mi
  easy: 9 * 60 + 30, // 9:30/mi
  steady: 8 * 60 + 30, // 8:30/mi
  marathon: 8 * 60, // 8:00/mi
  tempo: 7 * 60 + 30, // 7:30/mi
  threshold: 7 * 60 + 15, // 7:15/mi
  interval: 7 * 60, // 7:00/mi
  repetition: 6 * 60 + 30, // 6:30/mi
  long: 9 * 60 + 45, // 9:45/mi
  race: 7 * 60 + 15, // 7:15/mi
  cross_train: 0,
  other: 9 * 60, // 9:00/mi
};

// Typical duration ranges by workout type (minutes)
const TYPICAL_DURATIONS: Record<WorkoutType, { min: number; max: number }> = {
  recovery: { min: 20, max: 40 },
  easy: { min: 30, max: 60 },
  steady: { min: 40, max: 70 },
  marathon: { min: 40, max: 90 },
  tempo: { min: 30, max: 50 },
  threshold: { min: 30, max: 55 },
  interval: { min: 40, max: 70 },
  repetition: { min: 35, max: 60 },
  long: { min: 75, max: 180 },
  race: { min: 15, max: 300 },
  cross_train: { min: 30, max: 90 },
  other: { min: 20, max: 90 },
};

interface PaceZones {
  easy?: number;
  tempo?: number;
  threshold?: number;
  interval?: number;
  marathon?: number;
  halfMarathon?: number;
}

/**
 * Get the appropriate pace for a workout type based on user's pace zones
 */
export function getPaceForWorkoutType(
  workoutType: WorkoutType,
  paceZones?: PaceZones | null
): number {
  if (!paceZones) {
    return DEFAULT_PACES[workoutType];
  }

  switch (workoutType) {
    case 'easy':
    case 'recovery':
    case 'long':
      return paceZones.easy || DEFAULT_PACES[workoutType];
    case 'steady':
      // Steady is between easy and tempo
      return Math.round(((paceZones.easy || 570) + (paceZones.tempo || 450)) / 2);
    case 'marathon':
      return paceZones.marathon || DEFAULT_PACES.marathon;
    case 'tempo':
      return paceZones.tempo || DEFAULT_PACES.tempo;
    case 'threshold':
      return paceZones.threshold || DEFAULT_PACES.threshold;
    case 'interval':
      return paceZones.interval || DEFAULT_PACES.interval;
    case 'repetition':
      // Repetition is faster than interval pace
      return Math.round((paceZones.interval || DEFAULT_PACES.interval) * 0.93);
    case 'race':
      return paceZones.halfMarathon || paceZones.marathon || DEFAULT_PACES.race;
    default:
      return DEFAULT_PACES[workoutType];
  }
}

/**
 * Estimate duration from distance and workout type
 */
export function estimateDuration(
  distanceMiles: number,
  workoutType: WorkoutType,
  paceZones?: PaceZones | null
): number {
  const paceSeconds = getPaceForWorkoutType(workoutType, paceZones);
  const durationSeconds = distanceMiles * paceSeconds;
  return Math.round(durationSeconds / 60);
}

/**
 * Estimate distance from duration and workout type
 */
export function estimateDistance(
  durationMinutes: number,
  workoutType: WorkoutType,
  paceZones?: PaceZones | null
): number {
  const paceSeconds = getPaceForWorkoutType(workoutType, paceZones);
  const distanceMiles = (durationMinutes * 60) / paceSeconds;
  return Math.round(distanceMiles * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate pace from distance and duration
 */
export function calculatePace(
  distanceMiles: number,
  durationMinutes: number
): number {
  if (distanceMiles <= 0) return 0;
  return Math.round((durationMinutes * 60) / distanceMiles);
}

/**
 * Format pace as mm:ss string
 */
export function formatPaceString(paceSeconds: number): string {
  const mins = Math.floor(paceSeconds / 60);
  const secs = paceSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse pace string (mm:ss) to seconds
 */
export function parsePaceString(paceString: string): number {
  const parts = paceString.split(':');
  if (parts.length !== 2) return 0;
  const mins = parseInt(parts[0]) || 0;
  const secs = parseInt(parts[1]) || 0;
  return mins * 60 + secs;
}

/**
 * Get suggested duration range for a workout type
 */
export function getSuggestedDurationRange(workoutType: WorkoutType): { min: number; max: number } {
  return TYPICAL_DURATIONS[workoutType];
}

/**
 * Check if estimated values seem reasonable
 */
export function validateEstimates(
  distanceMiles: number,
  durationMinutes: number,
  workoutType: WorkoutType
): { isValid: boolean; warning?: string } {
  const pace = calculatePace(distanceMiles, durationMinutes);
  const typicalRange = TYPICAL_DURATIONS[workoutType];

  // Check if duration is way outside typical range
  if (durationMinutes < typicalRange.min * 0.5 || durationMinutes > typicalRange.max * 2) {
    return {
      isValid: true,
      warning: `This duration is unusual for a ${workoutType} run`
    };
  }

  // Check if pace is unrealistic (slower than 15:00/mi or faster than 4:00/mi)
  if (pace > 15 * 60 || pace < 4 * 60) {
    return {
      isValid: true,
      warning: 'The calculated pace seems unusual - please verify'
    };
  }

  return { isValid: true };
}

// ==================== Pace Sanity Checks (Issue 11) ====================

/**
 * Pace bounds for different workout types and ability levels
 * Expressed as multipliers of VDOT-based threshold pace
 */
const PACE_BOUNDS = {
  // Easy/recovery: 1.20-1.50x threshold (slower)
  recovery: { minMultiplier: 1.30, maxMultiplier: 1.60 },
  easy: { minMultiplier: 1.20, maxMultiplier: 1.55 },
  long: { minMultiplier: 1.15, maxMultiplier: 1.45 },

  // Moderate intensity
  steady: { minMultiplier: 1.05, maxMultiplier: 1.20 },
  marathon: { minMultiplier: 1.00, maxMultiplier: 1.15 },
  tempo: { minMultiplier: 0.98, maxMultiplier: 1.10 },

  // Hard efforts
  threshold: { minMultiplier: 0.95, maxMultiplier: 1.05 },
  interval: { minMultiplier: 0.85, maxMultiplier: 1.00 },
  repetition: { minMultiplier: 0.78, maxMultiplier: 0.95 },
  race: { minMultiplier: 0.80, maxMultiplier: 1.15 }, // Wide range for different race distances

  // Other
  cross_train: { minMultiplier: 0, maxMultiplier: Infinity },
  other: { minMultiplier: 0.80, maxMultiplier: 1.60 },
};

/**
 * Absolute pace bounds (seconds per mile)
 * World record marathon pace is ~4:37/mi, casual walkers are ~20:00/mi
 */
const ABSOLUTE_PACE_BOUNDS = {
  minPace: 240, // 4:00/mi - faster than this is likely GPS error
  maxPace: 1200, // 20:00/mi - slower than this isn't really running
  warningMinPace: 300, // 5:00/mi - very elite pace
  warningMaxPace: 900, // 15:00/mi - very slow jog
};

export interface PaceSanityResult {
  isValid: boolean;
  isWarning: boolean;
  message?: string;
  suggestedPace?: number;
}

/**
 * Validate a workout pace against expected ranges (Issue 11)
 *
 * @param paceSeconds - Pace in seconds per mile
 * @param workoutType - Type of workout
 * @param thresholdPace - User's threshold pace in seconds/mile (optional)
 * @returns Validation result with optional warning/error message
 */
export function validatePace(
  paceSeconds: number,
  workoutType: WorkoutType,
  thresholdPace?: number
): PaceSanityResult {
  // Check absolute bounds first
  if (paceSeconds < ABSOLUTE_PACE_BOUNDS.minPace) {
    return {
      isValid: false,
      isWarning: false,
      message: `Pace of ${formatPaceString(paceSeconds)}/mi seems too fast - possible GPS error`,
      suggestedPace: ABSOLUTE_PACE_BOUNDS.warningMinPace,
    };
  }

  if (paceSeconds > ABSOLUTE_PACE_BOUNDS.maxPace) {
    return {
      isValid: false,
      isWarning: false,
      message: `Pace of ${formatPaceString(paceSeconds)}/mi is very slow - verify workout data`,
    };
  }

  // Warning zones (not errors, but notable)
  if (paceSeconds < ABSOLUTE_PACE_BOUNDS.warningMinPace) {
    return {
      isValid: true,
      isWarning: true,
      message: `Elite-level pace of ${formatPaceString(paceSeconds)}/mi - verify if intentional`,
    };
  }

  if (paceSeconds > ABSOLUTE_PACE_BOUNDS.warningMaxPace) {
    return {
      isValid: true,
      isWarning: true,
      message: `Very slow pace of ${formatPaceString(paceSeconds)}/mi - was this a walk?`,
    };
  }

  // If we have threshold pace, check type-specific bounds
  if (thresholdPace && workoutType !== 'cross_train') {
    const bounds = PACE_BOUNDS[workoutType] || PACE_BOUNDS.other;
    const expectedMinPace = thresholdPace * bounds.minMultiplier;
    const expectedMaxPace = thresholdPace * bounds.maxMultiplier;

    if (paceSeconds < expectedMinPace) {
      return {
        isValid: true,
        isWarning: true,
        message: `${formatPaceString(paceSeconds)}/mi is faster than expected for ${workoutType} run (expected ${formatPaceString(Math.round(expectedMinPace))}-${formatPaceString(Math.round(expectedMaxPace))}/mi)`,
        suggestedPace: Math.round(expectedMinPace),
      };
    }

    if (paceSeconds > expectedMaxPace) {
      return {
        isValid: true,
        isWarning: true,
        message: `${formatPaceString(paceSeconds)}/mi is slower than expected for ${workoutType} run (expected ${formatPaceString(Math.round(expectedMinPace))}-${formatPaceString(Math.round(expectedMaxPace))}/mi)`,
        suggestedPace: Math.round(expectedMaxPace),
      };
    }
  }

  return { isValid: true, isWarning: false };
}

/**
 * Validate interval workout structure (Issue 11)
 * Ensures interval workouts have proper work/rest pattern
 */
export interface IntervalStructure {
  numIntervals: number;
  workDuration: number; // seconds
  restDuration: number; // seconds
  workPace: number; // seconds per mile
  restPace?: number; // seconds per mile (for jog recovery)
}

export interface IntervalValidationResult {
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
}

export function validateIntervalStructure(
  structure: IntervalStructure,
  thresholdPace?: number
): IntervalValidationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check number of intervals
  if (structure.numIntervals < 3) {
    warnings.push('Fewer than 3 intervals may not provide sufficient training stimulus');
  }
  if (structure.numIntervals > 20) {
    warnings.push('More than 20 intervals is unusual - verify this is intentional');
  }

  // Check work duration (typical VO2max intervals are 2-5 min)
  if (structure.workDuration < 30) {
    suggestions.push('Very short intervals (<30s) are typically for speed/form work');
  }
  if (structure.workDuration > 600) {
    suggestions.push('Long intervals (>10min) are more like tempo efforts');
  }

  // Check work:rest ratio (typical is 1:1 to 1:0.5 for VO2max)
  const workRestRatio = structure.restDuration / structure.workDuration;
  if (workRestRatio < 0.25) {
    warnings.push('Very short recovery may lead to early fatigue - typical ratio is 1:0.5 to 1:1');
  }
  if (workRestRatio > 2) {
    suggestions.push('Long recovery suggests this may be repetition/speed work rather than VO2max intervals');
  }

  // Check work pace if threshold is known
  if (thresholdPace) {
    const expectedIntervalPace = thresholdPace * 0.90; // ~10% faster than threshold
    if (structure.workPace > thresholdPace * 1.05) {
      warnings.push(`Interval pace of ${formatPaceString(structure.workPace)}/mi is too slow for effective VO2max work`);
      suggestions.push(`Target ${formatPaceString(Math.round(expectedIntervalPace))}/mi or faster`);
    }
    if (structure.workPace < thresholdPace * 0.75) {
      warnings.push(`Interval pace of ${formatPaceString(structure.workPace)}/mi is very fast - ensure adequate recovery`);
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    suggestions,
  };
}
