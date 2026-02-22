export type EffortLevel = 'all_out' | 'hard' | 'moderate' | 'easy';

/**
 * Infer effort level from workout attributes (HR ratio and workout type).
 */
export function inferEffortFromWorkout(workout: {
  workoutType: string;
  avgHr: number | null;
  maxHr: number | null;
}): EffortLevel {
  const wt = (workout.workoutType || '').toLowerCase();
  const avgHr = workout.avgHr || 0;
  const maxHr = workout.maxHr || 0;
  const hrRatio = maxHr > 0 ? avgHr / maxHr : null;

  if (wt === 'race') {
    if (hrRatio != null && hrRatio >= 0.9) return 'all_out';
    if (hrRatio != null && hrRatio >= 0.84) return 'hard';
    return 'moderate';
  }
  if (wt === 'interval' || wt === 'threshold' || wt === 'tempo') return 'hard';
  return 'moderate';
}

/**
 * Get days until a race.
 */
export function getDaysUntilRace(raceDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const race = new Date(raceDate);
  race.setHours(0, 0, 0, 0);
  const diffTime = race.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get weeks until a race.
 */
export function getWeeksUntilRace(raceDate: string): number {
  return Math.ceil(getDaysUntilRace(raceDate) / 7);
}

/**
 * Format race time (seconds to H:MM:SS or MM:SS).
 */
export function formatRaceTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse race time (H:MM:SS or MM:SS to seconds).
 * Basic version - use parseRaceTimeWithDistance for smart inference.
 */
export function parseRaceTime(timeString: string): number {
  const parts = timeString.split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Smart race time parsing that infers format based on distance.
 *
 * For marathon/half marathon:
 * - "3:30" → 3 hours 30 minutes (not 3 min 30 sec)
 * - "1:45" → 1 hour 45 minutes
 * - "3:30:00" → 3 hours 30 minutes 0 seconds (explicit)
 *
 * For shorter races (5K, 10K, etc.):
 * - "25:30" → 25 minutes 30 seconds
 * - "1:05:30" → 1 hour 5 minutes 30 seconds (explicit)
 *
 * @param timeString - Time input from user
 * @param distanceLabel - Race distance (e.g., "marathon", "half_marathon", "5K")
 */
export function parseRaceTimeWithDistance(timeString: string, distanceLabel: string): number {
  const parts = timeString.split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  // Explicit H:MM:SS format - always use as-is
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  // Two-part format (X:XX) - infer based on distance and value
  if (parts.length === 2) {
    const [first, second] = parts;
    const isLongRace = ['marathon', 'half_marathon', '50K', '50_mile', '100K', '100_mile'].includes(distanceLabel);

    // For long races, smart inference:
    // - If first part is small (1-6) and second part looks like minutes (0-59), assume H:MM
    // - "3:30" for marathon → 3:30:00 (3 hours 30 min)
    // - "1:45" for half → 1:45:00 (1 hour 45 min)
    if (isLongRace && first <= 6 && second <= 59) {
      // Likely hours:minutes - marathon times are typically 2:30-6:00
      // Half marathon times are typically 1:15-3:00
      return first * 3600 + second * 60;
    }

    // For 10K or if values are larger, could still be hours:minutes
    // "1:05" for 10K → likely 1:05:00 (1 hour 5 min) not 1 min 5 sec
    if (distanceLabel === '10K' && first === 1 && second <= 59) {
      // 10K times around 1 hour are common
      return first * 3600 + second * 60;
    }

    // Default: treat as MM:SS for shorter races or larger first values
    // "25:30" → 25 min 30 sec (5K time)
    // "45:00" → 45 min 0 sec (10K time)
    return first * 60 + second;
  }

  return 0;
}

/**
 * Get a helpful placeholder based on distance.
 */
export function getTimeInputPlaceholder(distanceLabel: string): string {
  switch (distanceLabel) {
    case 'marathon':
      return '3:30:00 or 3:30';
    case 'half_marathon':
      return '1:45:00 or 1:45';
    case '10K':
      return '45:00 or 1:05:00';
    case '5K':
      return '25:00';
    case '10_mile':
      return '1:15:00';
    default:
      return 'H:MM:SS or MM:SS';
  }
}

/**
 * Get example times for a distance.
 */
export function getTimeInputExample(distanceLabel: string): string {
  switch (distanceLabel) {
    case 'marathon':
      return 'e.g., 3:30 for 3 hours 30 min';
    case 'half_marathon':
      return 'e.g., 1:45 for 1 hour 45 min';
    case '10K':
      return 'e.g., 45:00 for 45 minutes';
    case '5K':
      return 'e.g., 25:30 for 25 min 30 sec';
    default:
      return 'H:MM:SS for hours, MM:SS for minutes';
  }
}
