// Coach tools shared types and constants

import type { Workout, Assessment, Shoe } from '../schema';

export type WorkoutWithRelations = Workout & {
  assessment?: Assessment | null;
  shoe?: Shoe | null;
};

// Demo mode types
export interface DemoContext {
  isDemo: true;
  settings: {
    name?: string;
    age?: number;
    yearsRunning?: number;
    currentWeeklyMileage?: number;
    vdot?: number;
    easyPaceSeconds?: number;
    tempoPaceSeconds?: number;
    thresholdPaceSeconds?: number;
    intervalPaceSeconds?: number;
    marathonPaceSeconds?: number;
    halfMarathonPaceSeconds?: number;
    planAggressiveness?: string;
    preferredLongRunDay?: string;
    qualitySessionsPerWeek?: number;
    peakWeeklyMileageTarget?: number;
    [key: string]: unknown;
  } | null;
  workouts: Array<{
    id: number;
    date: string;
    distanceMiles: number;
    durationMinutes: number;
    avgPaceSeconds: number;
    workoutType: string;
    notes?: string;
    assessment?: {
      verdict: 'great' | 'good' | 'fine' | 'rough' | 'awful';
      rpe: number;
      legsFeel?: number;
      sleepQuality?: number;
      stress?: number;
      soreness?: number;
      note?: string;
    };
  }>;
  shoes: Array<{
    id: number;
    name: string;
    brand: string;
    model: string;
    totalMiles: number;
  }>;
  races: Array<{
    id: number;
    name: string;
    date: string;
    distanceMeters: number;
    distanceLabel: string;
    priority: 'A' | 'B' | 'C';
    targetTimeSeconds: number | null;
    trainingPlanGenerated: boolean;
  }>;
  plannedWorkouts: Array<{
    id: number;
    date: string;
    name: string;
    workoutType: string;
    targetDistanceMiles: number;
    targetDurationMinutes?: number;
    targetPaceSecondsPerMile?: number;
    description: string;
    rationale?: string;
    isKeyWorkout: boolean;
    status: 'scheduled' | 'completed' | 'skipped';
    phase?: string;
    weekNumber?: number;
  }>;
}

// Demo action types for client-side application
export interface DemoAction {
  demoAction: string;
  data: unknown;
  message?: string;
}

export const PUBLIC_MODE_READ_ONLY_ERROR = "Oops, can't do that in guest mode! Public mode is read-only.";
