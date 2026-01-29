// Training Intelligence System Types

// ==================== Plan & Phase Types ====================

export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper' | 'recovery';
export type RacePriority = 'A' | 'B' | 'C';
export type PlannedWorkoutStatus = 'scheduled' | 'completed' | 'skipped' | 'modified';

// ==================== User Profile Types ====================

export type Gender = 'male' | 'female' | 'other';
export type TimeSincePeakFitness = 'current' | '3_months' | '6_months' | '1_year' | '2_plus_years';
export type PlanAggressiveness = 'conservative' | 'moderate' | 'aggressive';
export type StressLevel = 'low' | 'moderate' | 'high' | 'very_high';
export type SurfacePreference = 'road' | 'trail' | 'track' | 'mixed';
export type WorkoutVarietyPreference = 'simple' | 'moderate' | 'varied';
export type GroupVsSolo = 'solo' | 'group' | 'either';
export type TrainBy = 'pace' | 'heart_rate' | 'feel' | 'mixed';

// ==================== Workout Template Types ====================

export type WorkoutTemplateCategory =
  | 'easy'
  | 'long'
  | 'medium_long'
  | 'tempo'
  | 'threshold'
  | 'vo2max'
  | 'fartlek'
  | 'hills'
  | 'recovery'
  | 'race_specific';

export type PaceZone =
  | 'recovery'
  | 'easy'
  | 'easy_long'
  | 'general_aerobic'
  | 'steady'
  | 'marathon'
  | 'half_marathon'
  | 'tempo'
  | 'threshold'
  | 'vo2max'
  | 'interval'
  | 'repetition';

export type IntensityLevel = 'easy' | 'moderate' | 'hard' | 'very_hard';

export interface WorkoutSegment {
  type: 'warmup' | 'cooldown' | 'work' | 'recovery' | 'steady' | 'intervals' | 'hills' | 'fartlek' | 'strides' | 'ladder';
  // Distance-based
  distanceMiles?: number;
  distanceMeters?: number;
  // Time-based
  durationMinutes?: number;
  durationSeconds?: number;
  // Interval-specific
  repeats?: number;
  workDistanceMiles?: number;
  workDistanceMeters?: number;
  workDurationMinutes?: number;
  workDurationSeconds?: number;
  restMinutes?: number;
  restSeconds?: number;
  restType?: 'jog' | 'walk' | 'stand';
  // Pace
  pace?: PaceZone;
  paceDescription?: string;
  // Effort (alternative to pace)
  effortMin?: number; // % of max
  effortMax?: number;
  // Notes
  notes?: string;
  // For percentage-based segments (e.g., "first 60% easy")
  percentage?: number;
  // For ladders
  distancesMeters?: number[];
}

export interface WorkoutStructure {
  segments: WorkoutSegment[];
  totalDistanceMiles?: number;
  totalWorkDistanceMiles?: number;
  estimatedDurationMinutes?: number;
}

export interface WorkoutTemplateDefinition {
  id: string;
  name: string;
  category: WorkoutTemplateCategory;
  phaseAppropriate: TrainingPhase[];
  description: string;
  structure: WorkoutStructure;
  targetEffortMin: number; // 0-100
  targetEffortMax: number;
  typicalDistanceMilesMin?: number;
  typicalDistanceMilesMax?: number;
  typicalDurationMinutesMin?: number;
  typicalDurationMinutesMax?: number;
  purpose: string;
  progressionNotes?: string;
  isKeyWorkout: boolean;
  intensityLevel: IntensityLevel;
}

// ==================== VDOT & Pacing Types ====================

export interface PaceZones {
  recovery: number;       // seconds per mile
  easy: number;
  generalAerobic: number;
  marathon: number;
  halfMarathon: number;
  tempo: number;
  threshold: number;
  vo2max: number;
  interval: number;
  repetition: number;
  vdot: number;
}

export interface RaceDistance {
  label: string;
  meters: number;
  miles: number;
}

export const RACE_DISTANCES: Record<string, RaceDistance> = {
  '5K': { label: '5K', meters: 5000, miles: 3.1 },
  '10K': { label: '10K', meters: 10000, miles: 6.2 },
  '15K': { label: '15K', meters: 15000, miles: 9.3 },
  '10_mile': { label: '10 Mile', meters: 16093, miles: 10 },
  'half_marathon': { label: 'Half Marathon', meters: 21097, miles: 13.1 },
  'marathon': { label: 'Marathon', meters: 42195, miles: 26.2 },
};

// ==================== Plan Generation Types ====================

export interface PlanGenerationInput {
  // User profile
  currentWeeklyMileage: number;
  peakWeeklyMileageTarget: number;
  runsPerWeek: number;
  preferredLongRunDay: string;
  preferredQualityDays: string[];
  requiredRestDays: string[];
  planAggressiveness: PlanAggressiveness;
  qualitySessionsPerWeek: number;
  // Race info
  raceId: number;
  raceDate: string;
  raceDistanceMeters: number;
  raceDistanceLabel: string;
  // Pacing
  vdot?: number;
  paceZones?: PaceZones;
  // Start date
  startDate: string;
}

export interface PhaseDistribution {
  phase: TrainingPhase;
  weeks: number;
  focus: string;
  intensityDistribution: {
    easy: number;    // percentage
    moderate: number;
    hard: number;
  };
}

export interface PlannedWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  phase: TrainingPhase;
  targetMileage: number;
  longRunMiles: number;
  qualitySessions: number;
  focus: string;
  isDownWeek: boolean;
  workouts: PlannedWorkoutDefinition[];
}

export interface PlannedWorkoutDefinition {
  date: string;
  dayOfWeek: string;
  templateId: string;
  workoutType: string;
  name: string;
  description: string;
  targetDistanceMiles?: number;
  targetDurationMinutes?: number;
  targetPaceSecondsPerMile?: number;
  structure?: WorkoutStructure;
  rationale: string;
  isKeyWorkout: boolean;
  alternatives?: string[];
}

export interface WeeklyStructureDay {
  dayOfWeek: string;
  runType: 'rest' | 'easy' | 'long' | 'quality';
  isKeyWorkout: boolean;
}

export interface WeeklyStructure {
  days: WeeklyStructureDay[];
  longRunDay: string;
  qualityDays: string[];
  restDays: string[];
}

export interface GeneratedPlan {
  raceId: number;
  raceName: string;
  raceDate: string;
  raceDistance: string;
  totalWeeks: number;
  phases: PhaseDistribution[];
  weeks: PlannedWeek[];
  summary: {
    totalMiles: number;
    peakMileageWeek: number;
    peakMileage: number;
    qualitySessionsTotal: number;
    longRunsTotal: number;
  };
}

// ==================== Pace Formatting Utilities ====================

export function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parsePace(paceString: string): number {
  const [mins, secs] = paceString.split(':').map(Number);
  return mins * 60 + (secs || 0);
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseTime(timeString: string): number {
  const parts = timeString.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Get the human-readable label for a race distance.
 * Converts 'half_marathon' to 'Half Marathon', etc.
 */
export function getDistanceLabel(distanceKey: string): string {
  const distance = RACE_DISTANCES[distanceKey];
  if (distance) {
    return distance.label;
  }
  // If it's already a readable label or unknown, return as-is
  return distanceKey;
}
