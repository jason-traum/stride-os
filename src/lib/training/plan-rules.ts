/**
 * Training Plan Rules
 *
 * Defines the logic for training phase distribution, mileage progression,
 * workout selection, and weekly structure. Based on proven methodologies from
 * Lydiard, Pfitzinger, Daniels, Hansons, Canova, and 80/20 principles.
 */

import { TrainingPhase, PlanAggressiveness, WeeklyStructure } from './types';

// ==================== Phase Distribution ====================

export interface PhasePercentages {
  base: number;      // Percentage of total weeks
  build: number;
  peak: number;
  taper: number;
}

/**
 * Get phase distribution based on race distance and total weeks available.
 * Longer races need more base building; shorter races can emphasize build/peak.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getPhasePercentages(raceDistanceMeters: number, totalWeeks: number): PhasePercentages {
  // Marathon (42K)
  if (raceDistanceMeters >= 40000) {
    return {
      base: 0.30,
      build: 0.40,
      peak: 0.15,
      taper: 0.15,
    };
  }

  // Half Marathon (21K)
  if (raceDistanceMeters >= 20000) {
    return {
      base: 0.25,
      build: 0.45,
      peak: 0.15,
      taper: 0.15,
    };
  }

  // 10K-15K
  if (raceDistanceMeters >= 10000) {
    return {
      base: 0.20,
      build: 0.50,
      peak: 0.15,
      taper: 0.15,
    };
  }

  // 5K
  return {
    base: 0.20,
    build: 0.50,
    peak: 0.20,
    taper: 0.10,
  };
}

/**
 * Calculate the number of weeks in each phase.
 * Taper is capped at sensible maximums regardless of plan length.
 */
export function calculatePhaseWeeks(
  distribution: PhasePercentages,
  totalWeeks: number,
  raceDistanceMeters?: number
): Record<TrainingPhase, number> {
  // Cap taper at sensible maximums based on race distance
  // Marathon: 3 weeks, Half: 2 weeks, shorter: 1-2 weeks
  let maxTaperWeeks = 2;
  if (raceDistanceMeters && raceDistanceMeters >= 40000) {
    maxTaperWeeks = 3; // Marathon
  } else if (raceDistanceMeters && raceDistanceMeters >= 20000) {
    maxTaperWeeks = 2; // Half marathon
  } else {
    maxTaperWeeks = Math.min(2, Math.ceil(totalWeeks * 0.1)); // 10K and shorter
  }

  const taperWeeks = Math.min(maxTaperWeeks, Math.max(1, Math.round(totalWeeks * distribution.taper)));

  // Peak should be 2-4 weeks max
  const maxPeakWeeks = 4;
  const peakWeeks = Math.min(maxPeakWeeks, Math.max(2, Math.round(totalWeeks * distribution.peak)));

  // Build gets the bulk of remaining time after base
  const remainingAfterTaperPeak = totalWeeks - taperWeeks - peakWeeks;
  const buildWeeks = Math.max(2, Math.round(remainingAfterTaperPeak * (distribution.build / (distribution.base + distribution.build))));
  const baseWeeks = Math.max(1, remainingAfterTaperPeak - buildWeeks);

  return {
    recovery: 0, // Not used in plan generation
    base: baseWeeks,
    build: buildWeeks,
    peak: peakWeeks,
    taper: taperWeeks,
  };
}

// ==================== Mileage Progression ====================

/**
 * Get weekly mileage increase rate based on plan aggressiveness.
 */
export function getWeeklyIncreaseRate(aggressiveness: PlanAggressiveness): number {
  switch (aggressiveness) {
    case 'conservative': return 0.08;  // 8% weekly increase
    case 'moderate': return 0.10;      // 10% weekly increase
    case 'aggressive': return 0.12;    // 12% weekly increase
    default: return 0.10;
  }
}

/**
 * Get down week frequency (every N weeks, reduce volume).
 */
export function getDownWeekFrequency(aggressiveness: PlanAggressiveness): number {
  switch (aggressiveness) {
    case 'conservative': return 3;  // Down week every 3 weeks
    case 'moderate': return 4;      // Down week every 4 weeks
    case 'aggressive': return 4;    // Down week every 4 weeks
    default: return 4;
  }
}

/**
 * Get down week reduction percentage.
 */
export function getDownWeekReduction(aggressiveness: PlanAggressiveness): number {
  switch (aggressiveness) {
    case 'conservative': return 0.30;  // Reduce by 30%
    case 'moderate': return 0.25;      // Reduce by 25%
    case 'aggressive': return 0.20;    // Reduce by 20%
    default: return 0.25;
  }
}

/**
 * Calculate weekly mileage progression throughout the plan.
 * Returns an array of target weekly mileages.
 */
export function calculateMileageProgression(
  startMileage: number,
  peakMileage: number,
  totalWeeks: number,
  phaseWeeks: Record<TrainingPhase, number>,
  aggressiveness: PlanAggressiveness
): number[] {
  const increaseRate = getWeeklyIncreaseRate(aggressiveness);
  const downWeekFreq = getDownWeekFrequency(aggressiveness);
  const downReduction = getDownWeekReduction(aggressiveness);

  const mileages: number[] = [];
  let currentMileage = startMileage;
  let weeksSinceDownWeek = 0;

  // Base phase: gradual increase
  for (let i = 0; i < phaseWeeks.base; i++) {
    weeksSinceDownWeek++;

    if (weeksSinceDownWeek >= downWeekFreq) {
      // Down week
      mileages.push(Math.round(currentMileage * (1 - downReduction)));
      weeksSinceDownWeek = 0;
    } else {
      mileages.push(Math.round(currentMileage));
      currentMileage = Math.min(peakMileage * 0.85, currentMileage * (1 + increaseRate));
    }
  }

  // Build phase: increase toward peak
  const buildStartMileage = currentMileage;
  const buildEndMileage = peakMileage * 0.95;
  const buildIncrement = (buildEndMileage - buildStartMileage) / Math.max(1, phaseWeeks.build - 1);

  for (let i = 0; i < phaseWeeks.build; i++) {
    weeksSinceDownWeek++;

    if (weeksSinceDownWeek >= downWeekFreq) {
      // Down week
      mileages.push(Math.round(currentMileage * (1 - downReduction)));
      weeksSinceDownWeek = 0;
    } else {
      currentMileage = buildStartMileage + (buildIncrement * i);
      mileages.push(Math.round(currentMileage));
    }
  }

  // Peak phase: maintain near peak
  currentMileage = peakMileage;
  for (let i = 0; i < phaseWeeks.peak; i++) {
    weeksSinceDownWeek++;

    if (weeksSinceDownWeek >= downWeekFreq && i < phaseWeeks.peak - 1) {
      // Down week (but not the last peak week)
      mileages.push(Math.round(currentMileage * (1 - downReduction)));
      weeksSinceDownWeek = 0;
    } else {
      mileages.push(Math.round(currentMileage));
    }
  }

  // Taper phase: reduce volume progressively
  const taperReductions = getTaperSchedule(phaseWeeks.taper);
  for (let i = 0; i < phaseWeeks.taper; i++) {
    mileages.push(Math.round(peakMileage * taperReductions[i]));
  }

  return mileages;
}

/**
 * Get taper reduction schedule based on taper length.
 * Returns an array of reduction factors for each week.
 */
function getTaperSchedule(taperWeeks: number): number[] {
  if (taperWeeks <= 0) return [];
  if (taperWeeks === 1) {
    return [0.50];  // Race week: 50% volume
  }
  if (taperWeeks === 2) {
    return [0.75, 0.50];  // 75%, then 50% race week
  }
  if (taperWeeks === 3) {
    return [0.80, 0.65, 0.50];  // 80%, 65%, 50% race week
  }
  if (taperWeeks === 4) {
    return [0.85, 0.75, 0.60, 0.50];
  }

  // For 5+ week tapers (long marathon plans), gradually reduce
  // Start at 90% and decrease progressively to 50% race week
  const schedule: number[] = [];
  for (let i = 0; i < taperWeeks; i++) {
    // Calculate reduction: starts at 0.90, ends at 0.50
    const progress = i / (taperWeeks - 1);
    const reduction = 0.90 - (progress * 0.40);
    schedule.push(Math.round(reduction * 100) / 100);
  }
  return schedule;
}

// ==================== Weekly Structure ====================

/**
 * Days of week in order (0 = Monday).
 */
export const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Get index for a day of week.
 */
export function getDayIndex(day: string): number {
  return DAYS_ORDER.indexOf(day.toLowerCase());
}

/**
 * Get day name from index.
 */
export function getDayName(index: number): string {
  return DAYS_ORDER[index % 7];
}

/**
 * Create a weekly structure template based on user preferences.
 */
export function createWeeklyStructure(
  runsPerWeek: number,
  preferredLongRunDay: string,
  preferredQualityDays: string[],
  requiredRestDays: string[],
  qualitySessionsPerWeek: number
): WeeklyStructure {
  const longRunDayIndex = getDayIndex(preferredLongRunDay);

  // Initialize all days as potential easy days
  const structure: WeeklyStructure = {
    days: DAYS_ORDER.map((day) => ({
      dayOfWeek: day,
      runType: 'rest',
      isKeyWorkout: false,
    })),
    longRunDay: preferredLongRunDay,
    qualityDays: [],
    restDays: requiredRestDays,
  };

  // Mark required rest days
  for (const restDay of requiredRestDays) {
    const idx = getDayIndex(restDay);
    structure.days[idx].runType = 'rest';
  }

  // Place long run
  if (!requiredRestDays.includes(preferredLongRunDay)) {
    structure.days[longRunDayIndex].runType = 'long';
    structure.days[longRunDayIndex].isKeyWorkout = true;
  }

  // Place quality sessions (avoid day before/after long run)
  let qualityPlaced = 0;
  const qualityDays: string[] = [];
  const dayBeforeLong = (longRunDayIndex - 1 + 7) % 7;
  const dayAfterLong = (longRunDayIndex + 1) % 7;

  // First, try preferred quality days
  for (const qualityDay of preferredQualityDays) {
    if (qualityPlaced >= qualitySessionsPerWeek) break;

    const idx = getDayIndex(qualityDay);

    // Skip if it's a required rest day, long run day, or adjacent to long run
    if (
      requiredRestDays.includes(qualityDay) ||
      idx === longRunDayIndex ||
      idx === dayBeforeLong ||
      idx === dayAfterLong
    ) {
      continue;
    }

    structure.days[idx].runType = 'quality';
    structure.days[idx].isKeyWorkout = true;
    qualityDays.push(qualityDay);
    qualityPlaced++;
  }

  // If we still need more quality days, find suitable ones
  if (qualityPlaced < qualitySessionsPerWeek) {
    // Try Tuesday/Thursday pattern if not already used
    const candidateDays = [1, 3, 2, 4]; // Tue, Thu, Wed, Fri

    for (const candidateIdx of candidateDays) {
      if (qualityPlaced >= qualitySessionsPerWeek) break;

      const dayName = DAYS_ORDER[candidateIdx];

      // Skip if already placed, required rest, long run, or adjacent to long run
      if (
        structure.days[candidateIdx].runType === 'quality' ||
        structure.days[candidateIdx].runType === 'long' ||
        requiredRestDays.includes(dayName) ||
        candidateIdx === dayBeforeLong ||
        candidateIdx === dayAfterLong
      ) {
        continue;
      }

      structure.days[candidateIdx].runType = 'quality';
      structure.days[candidateIdx].isKeyWorkout = true;
      qualityDays.push(dayName);
      qualityPlaced++;
    }
  }

  structure.qualityDays = qualityDays;

  // Fill remaining run days with easy runs
  let runDaysPlaced = 1 + qualityPlaced; // long run + quality sessions
  for (let i = 0; i < 7 && runDaysPlaced < runsPerWeek; i++) {
    if (structure.days[i].runType === 'rest') {
      // Check if this is a required rest day
      if (!requiredRestDays.includes(DAYS_ORDER[i])) {
        structure.days[i].runType = 'easy';
        runDaysPlaced++;
      }
    }
  }

  // Day before long run should be easy or rest (recovery)
  // (dayBeforeLong already calculated above)
  if (structure.days[dayBeforeLong].runType === 'quality') {
    structure.days[dayBeforeLong].runType = 'easy';
    structure.days[dayBeforeLong].isKeyWorkout = false;
  }

  return structure;
}

// ==================== Workout Selection Rules ====================

/**
 * Workout categories appropriate for each training phase.
 */
export const PHASE_WORKOUT_CATEGORIES: Record<TrainingPhase, string[]> = {
  recovery: ['easy_run', 'recovery_run'],
  base: ['easy_run', 'long_run', 'fartlek', 'hill'],
  build: ['easy_run', 'long_run', 'tempo', 'threshold', 'vo2max', 'fartlek'],
  peak: ['easy_run', 'long_run', 'race_specific', 'tempo', 'vo2max', 'threshold'],
  taper: ['easy_run', 'long_run_short', 'tempo_short', 'strides'],
};

/**
 * Get appropriate long run type for the phase and week.
 */
export function getLongRunType(
  phase: TrainingPhase,
  weekInPhase: number,
  totalPhaseWeeks: number,
  raceDistanceMeters: number
): string {
  // Marathon: Include MP long runs in build/peak
  if (raceDistanceMeters >= 40000) {
    if (phase === 'peak') {
      return weekInPhase === 0 ? 'marathon_pace_long_run' : 'marathon_simulation';
    }
    if (phase === 'build') {
      return weekInPhase % 2 === 0 ? 'easy_long_run' : 'progression_long_run';
    }
  }

  // Half marathon: Steady/progression long runs
  if (raceDistanceMeters >= 20000) {
    if (phase === 'peak' || phase === 'build') {
      return weekInPhase % 2 === 0 ? 'easy_long_run' : 'progression_long_run';
    }
  }

  // Default: Easy long runs in base, progression in build/peak
  if (phase === 'base') {
    return 'easy_long_run';
  }
  if (phase === 'build' || phase === 'peak') {
    return weekInPhase % 3 === 2 ? 'progression_long_run' : 'easy_long_run';
  }

  // Taper: Shorter easy long runs
  return 'easy_long_run';
}

/**
 * Get appropriate quality workout type for the phase.
 */
export function getQualityWorkoutType(
  phase: TrainingPhase,
  weekInPhase: number,
  qualitySessionNumber: number, // 1 or 2 (if 2 quality sessions per week)
  raceDistanceMeters: number
): string {
  // Taper: Light workouts only
  if (phase === 'taper') {
    return qualitySessionNumber === 1 ? 'steady_tempo' : 'easy_run_strides';
  }

  // Base phase: Aerobic development focus
  if (phase === 'base') {
    return qualitySessionNumber === 1 ? 'classic_fartlek' : 'short_hill_repeats';
  }

  // Build phase: Progressive intensity
  if (phase === 'build') {
    if (qualitySessionNumber === 1) {
      // Primary quality: tempo/threshold
      return weekInPhase % 2 === 0 ? 'steady_tempo' : 'cruise_intervals';
    } else {
      // Secondary quality: VO2max development
      return weekInPhase % 3 === 0 ? 'yasso_800s' : 'short_intervals_400m';
    }
  }

  // Peak phase: Race-specific
  if (phase === 'peak') {
    // Marathon
    if (raceDistanceMeters >= 40000) {
      return qualitySessionNumber === 1 ? 'marathon_pace_intervals' : 'progressive_tempo';
    }
    // Half marathon
    if (raceDistanceMeters >= 20000) {
      return qualitySessionNumber === 1 ? 'half_marathon_pace_workout' : 'cruise_intervals';
    }
    // 10K and shorter
    return qualitySessionNumber === 1 ? 'mile_repeats' : 'steady_tempo';
  }

  return 'easy_run';
}

// ==================== Validation Rules ====================

/**
 * Validate that hard days are properly spaced (no back-to-back).
 */
export function validateHardEasyPattern(structure: WeeklyStructure): boolean {
  const keyWorkoutIndices: number[] = [];

  for (let i = 0; i < 7; i++) {
    if (structure.days[i].isKeyWorkout) {
      keyWorkoutIndices.push(i);
    }
  }

  // Check for adjacent key workouts (including wrap-around)
  for (let i = 0; i < keyWorkoutIndices.length; i++) {
    const current = keyWorkoutIndices[i];
    const next = keyWorkoutIndices[(i + 1) % keyWorkoutIndices.length];

    // Check if adjacent (accounting for week wrap)
    const diff = Math.abs(current - next);
    if (diff === 1 || diff === 6) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate expected weekly effort distribution (80/20 rule).
 */
export function calculateEffortDistribution(structure: WeeklyStructure): {
  easyPercent: number;
  hardPercent: number;
} {
  let easyDays = 0;
  let hardDays = 0;

  for (const day of structure.days) {
    if (day.runType === 'rest') continue;
    if (day.isKeyWorkout) {
      hardDays++;
    } else {
      easyDays++;
    }
  }

  const totalRunDays = easyDays + hardDays;
  if (totalRunDays === 0) return { easyPercent: 100, hardPercent: 0 };

  return {
    easyPercent: Math.round((easyDays / totalRunDays) * 100),
    hardPercent: Math.round((hardDays / totalRunDays) * 100),
  };
}

// ==================== Profile-Aware Workout Selection ====================

import type { AthleteProfile } from './types';

/**
 * Workout substitution rules based on comfort levels.
 * Key: original workout type, Value: substitutions ordered by preference
 */
const COMFORT_SUBSTITUTIONS: Record<string, { comfortKey: keyof AthleteProfile; alternatives: string[] }> = {
  // VO2max workouts - if low comfort, use more tempo/threshold work
  yasso_800s: { comfortKey: 'comfortVO2max', alternatives: ['cruise_intervals', 'progressive_tempo', 'steady_tempo'] },
  short_intervals_400m: { comfortKey: 'comfortVO2max', alternatives: ['classic_fartlek', 'structured_fartlek', 'steady_tempo'] },
  long_intervals_1000m: { comfortKey: 'comfortVO2max', alternatives: ['cruise_intervals', 'threshold_intervals', 'progressive_tempo'] },
  mile_repeats: { comfortKey: 'comfortVO2max', alternatives: ['cruise_intervals', 'progressive_tempo', 'steady_tempo'] },
  ladder_workout: { comfortKey: 'comfortVO2max', alternatives: ['structured_fartlek', 'cruise_intervals', 'progressive_tempo'] },

  // Tempo workouts - if low comfort, use fartlek or easy progressions
  steady_tempo: { comfortKey: 'comfortTempo', alternatives: ['classic_fartlek', 'progression_long_run', 'general_aerobic'] },
  progressive_tempo: { comfortKey: 'comfortTempo', alternatives: ['structured_fartlek', 'medium_long_pickup', 'general_aerobic'] },
  cruise_intervals: { comfortKey: 'comfortTempo', alternatives: ['structured_fartlek', 'classic_fartlek', 'medium_long_pickup'] },

  // Hill workouts - if low comfort, use flat fartlek
  short_hill_repeats: { comfortKey: 'comfortHills', alternatives: ['classic_fartlek', 'easy_run_strides', 'structured_fartlek'] },
  long_hill_repeats: { comfortKey: 'comfortHills', alternatives: ['progressive_tempo', 'cruise_intervals', 'structured_fartlek'] },
};

/**
 * Get a workout type adjusted for athlete comfort levels.
 * Returns the original if comfort is high enough (>=3), otherwise a substitute.
 */
export function getComfortAdjustedWorkout(
  originalWorkoutType: string,
  profile?: AthleteProfile
): string {
  if (!profile) return originalWorkoutType;

  const substitution = COMFORT_SUBSTITUTIONS[originalWorkoutType];
  if (!substitution) return originalWorkoutType;

  const comfortLevel = profile[substitution.comfortKey] as number | undefined;

  // If comfort is 3 or higher (neutral or above), use original
  if (!comfortLevel || comfortLevel >= 3) return originalWorkoutType;

  // Low comfort (1-2): use first alternative
  // Very low comfort (1): might want even easier option
  const alternativeIndex = comfortLevel === 1 ? 1 : 0;
  return substitution.alternatives[Math.min(alternativeIndex, substitution.alternatives.length - 1)] || originalWorkoutType;
}

/**
 * Determine if an athlete should use a more gradual progression based on experience.
 */
export function getExperienceBasedProgression(profile?: AthleteProfile): {
  startWithFartlek: boolean;
  delayVO2maxWeeks: number;
  conservativeMileage: boolean;
} {
  if (!profile) {
    return { startWithFartlek: false, delayVO2maxWeeks: 0, conservativeMileage: false };
  }

  const speedworkExp = profile.speedworkExperience || 'intermediate';
  const yearsRunning = profile.yearsRunning || 3;
  const highestMileage = profile.highestWeeklyMileageEver || 40;

  return {
    // Start with fartlek instead of structured intervals if inexperienced
    startWithFartlek: speedworkExp === 'none' || speedworkExp === 'beginner',
    // Delay VO2max work for inexperienced runners
    delayVO2maxWeeks: speedworkExp === 'none' ? 4 : speedworkExp === 'beginner' ? 2 : 0,
    // Use conservative mileage for newer runners
    conservativeMileage: yearsRunning < 2 || highestMileage < 30,
  };
}

/**
 * Get recovery adjustments based on profile.
 */
export function getRecoveryAdjustments(profile?: AthleteProfile): {
  extraRestDays: boolean;
  reduceIntensityPct: number;
  avoidBackToBackHard: boolean;
} {
  if (!profile) {
    return { extraRestDays: false, reduceIntensityPct: 0, avoidBackToBackHard: true };
  }

  const stressLevel = profile.stressLevel || 'moderate';
  const needsExtraRest = profile.needsExtraRest || false;

  let reduceIntensityPct = 0;
  if (stressLevel === 'high') reduceIntensityPct = 10;
  if (stressLevel === 'very_high') reduceIntensityPct = 20;

  return {
    extraRestDays: needsExtraRest || stressLevel === 'very_high',
    reduceIntensityPct,
    avoidBackToBackHard: true,
  };
}

/**
 * Adjust workout duration based on time constraints.
 */
export function getTimeConstrainedDistance(
  plannedMiles: number,
  isWeekday: boolean,
  profile?: AthleteProfile,
  paceSecondsPerMile?: number
): number {
  if (!profile) return plannedMiles;

  const availableMinutes = isWeekday
    ? profile.weekdayAvailabilityMinutes
    : profile.weekendAvailabilityMinutes;

  if (!availableMinutes || !paceSecondsPerMile) return plannedMiles;

  // Calculate max distance based on available time (with 10 min buffer for warm-up/cool-down)
  const effectiveMinutes = Math.max(20, availableMinutes - 10);
  const maxMilesFromTime = effectiveMinutes / (paceSecondsPerMile / 60);

  // Return the lesser of planned and time-constrained
  return Math.min(plannedMiles, Math.round(maxMilesFromTime * 10) / 10);
}
