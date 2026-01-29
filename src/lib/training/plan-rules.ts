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
 */
export function calculatePhaseWeeks(
  distribution: PhasePercentages,
  totalWeeks: number
): Record<TrainingPhase, number> {
  const taperWeeks = Math.max(1, Math.round(totalWeeks * distribution.taper));
  const peakWeeks = Math.max(1, Math.round(totalWeeks * distribution.peak));
  const buildWeeks = Math.max(2, Math.round(totalWeeks * distribution.build));
  const baseWeeks = Math.max(1, totalWeeks - taperWeeks - peakWeeks - buildWeeks);

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
 */
function getTaperSchedule(taperWeeks: number): number[] {
  if (taperWeeks === 1) {
    return [0.50];  // Race week: 50% volume
  }
  if (taperWeeks === 2) {
    return [0.75, 0.50];  // 75%, then 50% race week
  }
  if (taperWeeks === 3) {
    return [0.80, 0.65, 0.50];  // 80%, 65%, 50% race week
  }
  // 4+ weeks (marathon taper)
  return [0.85, 0.75, 0.60, 0.50];
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

  // First, try preferred quality days
  for (const qualityDay of preferredQualityDays) {
    if (qualityPlaced >= qualitySessionsPerWeek) break;

    const idx = getDayIndex(qualityDay);
    const dayBeforeLong = (longRunDayIndex - 1 + 7) % 7;
    const dayAfterLong = (longRunDayIndex + 1) % 7;

    // Skip if it's a rest day, long run day, or adjacent to long run
    if (
      structure.days[idx].runType === 'rest' ||
      structure.days[idx].runType === 'long' ||
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
    const dayBeforeLong = (longRunDayIndex - 1 + 7) % 7;
    const dayAfterLong = (longRunDayIndex + 1) % 7;

    // Try Tuesday/Thursday pattern if not already used
    const candidateDays = [1, 3, 2, 4]; // Tue, Thu, Wed, Fri

    for (const candidateIdx of candidateDays) {
      if (qualityPlaced >= qualitySessionsPerWeek) break;

      if (
        structure.days[candidateIdx].runType !== 'rest' &&
        structure.days[candidateIdx].runType !== 'long' &&
        structure.days[candidateIdx].runType !== 'quality' &&
        candidateIdx !== dayBeforeLong &&
        candidateIdx !== dayAfterLong
      ) {
        structure.days[candidateIdx].runType = 'quality';
        structure.days[candidateIdx].isKeyWorkout = true;
        qualityDays.push(DAYS_ORDER[candidateIdx]);
        qualityPlaced++;
      }
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
  const dayBeforeLong = (longRunDayIndex - 1 + 7) % 7;
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
      return weekInPhase === 0 ? 'long_run_mp' : 'long_run_simulation';
    }
    if (phase === 'build') {
      return weekInPhase % 2 === 0 ? 'long_run_easy' : 'long_run_progression';
    }
  }

  // Half marathon: Steady/progression long runs
  if (raceDistanceMeters >= 20000) {
    if (phase === 'peak' || phase === 'build') {
      return weekInPhase % 2 === 0 ? 'long_run_easy' : 'long_run_progression';
    }
  }

  // Default: Easy long runs in base, progression in build/peak
  if (phase === 'base') {
    return 'long_run_easy';
  }
  if (phase === 'build' || phase === 'peak') {
    return weekInPhase % 3 === 2 ? 'long_run_progression' : 'long_run_easy';
  }

  // Taper: Shorter easy long runs
  return 'long_run_easy';
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
    return qualitySessionNumber === 1 ? 'tempo_short' : 'strides';
  }

  // Base phase: Aerobic development focus
  if (phase === 'base') {
    return qualitySessionNumber === 1 ? 'fartlek_classic' : 'hill_short';
  }

  // Build phase: Progressive intensity
  if (phase === 'build') {
    if (qualitySessionNumber === 1) {
      // Primary quality: tempo/threshold
      return weekInPhase % 2 === 0 ? 'tempo_steady' : 'threshold_cruise_intervals';
    } else {
      // Secondary quality: VO2max development
      return weekInPhase % 3 === 0 ? 'vo2max_800s' : 'vo2max_400s';
    }
  }

  // Peak phase: Race-specific
  if (phase === 'peak') {
    // Marathon
    if (raceDistanceMeters >= 40000) {
      return qualitySessionNumber === 1 ? 'mp_intervals' : 'tempo_progressive';
    }
    // Half marathon
    if (raceDistanceMeters >= 20000) {
      return qualitySessionNumber === 1 ? 'hmp_workout' : 'threshold_cruise_intervals';
    }
    // 10K and shorter
    return qualitySessionNumber === 1 ? 'vo2max_mile_repeats' : 'tempo_steady';
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
