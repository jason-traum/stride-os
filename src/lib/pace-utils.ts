/**
 * Pace and duration estimation utilities
 */

import type { WorkoutType } from './schema';

// Average paces by workout type (seconds per mile) - used as fallback
const DEFAULT_PACES: Record<WorkoutType, number> = {
  easy: 9 * 60 + 30, // 9:30/mi
  steady: 8 * 60 + 30, // 8:30/mi
  tempo: 7 * 60 + 30, // 7:30/mi
  interval: 7 * 60, // 7:00/mi
  long: 9 * 60 + 45, // 9:45/mi
  race: 7 * 60 + 15, // 7:15/mi
  recovery: 10 * 60 + 30, // 10:30/mi
  cross_train: 0,
  other: 9 * 60, // 9:00/mi
};

// Typical duration ranges by workout type (minutes)
const TYPICAL_DURATIONS: Record<WorkoutType, { min: number; max: number }> = {
  easy: { min: 30, max: 60 },
  steady: { min: 40, max: 70 },
  tempo: { min: 30, max: 50 },
  interval: { min: 40, max: 70 },
  long: { min: 75, max: 180 },
  race: { min: 15, max: 300 },
  recovery: { min: 20, max: 40 },
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
    case 'tempo':
      return paceZones.tempo || DEFAULT_PACES.tempo;
    case 'interval':
      return paceZones.interval || DEFAULT_PACES.interval;
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
