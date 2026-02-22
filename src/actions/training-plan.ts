'use server';

// Re-export all public APIs from focused modules.
// This file preserves backward compatibility — callers can continue importing from './training-plan'.

// Plan generation
export {
  generatePlanForRace,
  generateMacroPlanForRace,
} from './training-plan-generation';
export type {
  GeneratedPlanWithFitness,
  MacroPlanResult,
} from './training-plan-generation';

// Plan retrieval
export {
  getTrainingPlan,
  getCurrentWeekPlan,
  getTodaysWorkout,
  getTrainingSummary,
} from './training-plan-retrieval';

// Plan modification
export {
  updatePlannedWorkoutStatus,
  scaleDownPlannedWorkout,
  applyAudible,
  swapPlannedWorkout,
  movePlannedWorkout,
  getWorkoutAlternatives,
  deletePlannedWorkout,
  resetAllTrainingPlans,
} from './training-plan-modification';
