/**
 * Plan Builder Tool for AI Coach
 *
 * Allows the coach to generate and discuss 2-week training plans
 */

import { PlanBuilder, refineWorkout } from './plan-builder';
import { addDays, startOfWeek } from 'date-fns';

export const generateTrainingBlockDefinition = {
  name: 'generate_training_block',
  description: `Generate a 2-week training plan template. Use when:
  - User asks for upcoming workouts
  - Planning future training
  - Discussing training structure
  - User wants to see what's coming up`,
  input_schema: {
    type: 'object',
    properties: {
      start_date: {
        type: 'string',
        description: 'Start date for the 2-week block (YYYY-MM-DD). Defaults to next Monday.'
      },
      phase: {
        type: 'string',
        enum: ['base', 'build', 'peak', 'taper', 'recovery'],
        description: 'Current training phase'
      },
      weekly_mileage: {
        type: 'number',
        description: 'Current weekly mileage target'
      },
      preferences: {
        type: 'object',
        properties: {
          long_run_day: {
            type: 'string',
            description: 'Preferred day for long runs'
          },
          hard_workout_days: {
            type: 'array',
            items: { type: 'string' },
            description: 'Preferred days for hard workouts'
          },
          rest_day: {
            type: 'string',
            description: 'Preferred rest day'
          }
        }
      }
    },
    required: ['phase', 'weekly_mileage']
  }
};

export async function generateTrainingBlock(input: Record<string, unknown>) {
  const phase = input.phase as string;
  const weeklyMileage = input.weekly_mileage as number;
  const startDateStr = input.start_date as string | undefined;
  const preferences = input.preferences as any;

  // Default to next Monday if no date provided
  const startDate = startDateStr
    ? new Date(startDateStr)
    : startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });

  // Get target race (in real implementation, would fetch from DB)
  const targetRace = {
    date: '2026-04-15',
    distance: 'half_marathon'
  };

  const builder = new PlanBuilder();
  const block = builder.generateTwoWeekBlock(
    startDate,
    phase,
    targetRace,
    weeklyMileage,
    preferences
  );

  // Add summary for the coach to discuss
  const summary = generateBlockSummary(block);

  return {
    training_block: block,
    summary,
    refinement_note: 'These are rough templates that will be refined based on fatigue, performance, and life context as each workout approaches.'
  };
}

export const refineUpcomingWorkoutDefinition = {
  name: 'refine_upcoming_workout',
  description: `Refine a planned workout based on runner's current state. Use when:
  - Preparing for a workout in the next 1-3 days
  - Runner asks about modifying upcoming workout
  - Vibe check suggests adaptation needed`,
  input_schema: {
    type: 'object',
    properties: {
      workout_date: {
        type: 'string',
        description: 'Date of the workout to refine (YYYY-MM-DD)'
      },
      runner_state: {
        type: 'object',
        properties: {
          fatigue_level: {
            type: 'string',
            enum: ['fresh', 'normal', 'accumulating', 'high']
          },
          stress_level: {
            type: 'string',
            enum: ['low', 'normal', 'high']
          },
          recent_execution: {
            type: 'string',
            enum: ['crushed_it', 'on_target', 'struggled']
          }
        }
      },
      planned_workout: {
        type: 'object',
        description: 'The original planned workout'
      }
    },
    required: ['workout_date', 'runner_state', 'planned_workout']
  }
};

export function refineUpcomingWorkout(input: Record<string, unknown>) {
  const workoutDate = new Date(input.workout_date as string);
  const runnerState = input.runner_state as any;
  const plannedWorkout = input.planned_workout as any;

  const daysOut = Math.ceil(
    (workoutDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const refinedWorkout = refineWorkout(plannedWorkout, runnerState, daysOut);

  // Generate adaptation recommendations
  const adaptations = [];

  if (runnerState.fatigue_level === 'high') {
    adaptations.push('Consider reducing volume by 20-30%');
    adaptations.push('Lower intensity targets slightly');
    adaptations.push('Add extra recovery between intervals');
  }

  if (runnerState.stress_level === 'high') {
    adaptations.push('Make the workout more flexible - run by feel');
    adaptations.push('Consider switching to fartlek format');
    adaptations.push('OK to cut short if needed');
  }

  if (runnerState.recent_execution === 'struggled') {
    adaptations.push('Start conservatively');
    adaptations.push('Have a Plan B ready (shorter/easier version)');
    adaptations.push('Focus on good form over pace');
  }

  return {
    original_workout: plannedWorkout,
    refined_workout: refinedWorkout,
    days_until_workout: daysOut,
    adaptation_recommendations: adaptations,
    confidence_level: daysOut <= 3 ? 'high' : 'moderate'
  };
}

function generateBlockSummary(block: any) {
  const week1 = block.weeks[0];
  const week2 = block.weeks[1];

  const keyWorkouts = [
    ...week1.workouts.filter((w: any) => w.priority >= 4),
    ...week2.workouts.filter((w: any) => w.priority >= 4)
  ];

  return {
    phase: block.phase,
    total_miles: week1.totalMileage + week2.totalMileage,
    key_workouts_count: keyWorkouts.length,
    progression: `${week1.totalMileage} → ${week2.totalMileage} miles`,
    themes: [week1.theme, week2.theme],
    hardest_days: keyWorkouts.map((w: any) => ({
      date: w.date,
      type: w.workoutType,
      focus: w.primaryFocus
    }))
  };
}