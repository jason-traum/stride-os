/**
 * Enhanced coach tool for interpreting workout requests
 *
 * This tool acts as a pre-processor for prescribe_workout to better understand
 * nuanced requests like "super advanced tempo workout"
 */

import { WorkoutRequestInterpreter } from './workout-request-interpreter';

export const interpretWorkoutRequestTool = {
  name: 'interpret_workout_request',
  description: `Interpret vague or nuanced workout requests before prescribing. Use this when:
  - User asks for "super advanced" or "extremely hard" workouts
  - Request is vague like "something challenging"
  - Multiple interpretations are possible
  - You need to understand modifiers like intensity, duration, or complexity`,
  input_schema: {
    type: 'object',
    properties: {
      user_request: {
        type: 'string',
        description: 'The raw workout request from the user'
      },
      context: {
        type: 'object',
        description: 'User context like fitness level, recent workouts',
        properties: {
          fitness_level: { type: 'string' },
          recent_workout_types: { type: 'array', items: { type: 'string' } },
          stated_goal: { type: 'string' }
        }
      }
    },
    required: ['user_request']
  }
};

export async function interpretWorkoutRequest(params: {
  user_request: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any;
}): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interpretation: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enhanced_params: any;
  clarification_needed?: string;
  recommended_action: string;
}> {
  const interpreter = new WorkoutRequestInterpreter();
  const interpretation = interpreter.interpret(params.user_request);

  // If clarification needed, return that
  if (interpretation.clarificationNeeded) {
    return {
      interpretation,
      enhanced_params: {},
      clarification_needed: interpretation.clarificationNeeded,
      recommended_action: 'ask_user'
    };
  }

  // Enhance the parameters
  const enhanced_params = interpreter.enhanceWorkoutRequest(
    interpretation,
    params.context || {}
  );

  // Special handling for "super advanced" requests
  if (params.user_request.toLowerCase().includes('super advanced')) {
    enhanced_params.preference = 'advanced';
    enhanced_params.select_elite_variation = true;

    // Map to specific advanced templates based on workout type
    if (interpretation.workoutType === 'tempo') {
      enhanced_params.specific_templates = [
        'norwegian_double',
        'canova_special_block',
        'progressive_tempo',
        'tempo_sandwich'
      ];
    } else if (interpretation.workoutType === 'vo2max') {
      enhanced_params.specific_templates = [
        'kenyan_diagonals',
        'critical_velocity',
        'oregon_30_40s',
        'vo2max_ladder'
      ];
    }
  }

  return {
    interpretation,
    enhanced_params,
    recommended_action: 'prescribe_workout',
    clarification_needed: undefined
  };
}