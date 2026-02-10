/**
 * Vibe Check Tool
 *
 * Instead of asking "what workout do you want?", this tool helps the coach
 * understand HOW the runner is actually doing and adapt accordingly.
 */

export const vibeCheckDefinition = {
  name: 'vibe_check',
  description: `Assess runner's current state before prescribing workouts. Use this when:
  - About to prescribe a workout (especially hard ones)
  - Runner seems off or mentions fatigue/stress
  - It's been 3+ days since last check-in
  - Before key workouts in the training plan`,
  input_schema: {
    type: 'object',
    properties: {
      check_type: {
        type: 'string',
        enum: ['pre_workout', 'weekly', 'post_workout', 'general'],
        description: 'Type of vibe check'
      },
      planned_workout: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          intensity: { type: 'string' }
        },
        description: 'What was originally planned (if applicable)'
      }
    },
    required: ['check_type']
  }
};

export async function performVibeCheck(params: {
  check_type: string;
  planned_workout?: any;
  profileId: number;
}) {
  // In real implementation, this would:
  // 1. Look at recent workouts and assessments
  // 2. Check sleep/stress/fatigue trends
  // 3. Analyze workout execution quality
  // 4. Return current state assessment

  // For now, return a structured assessment
  return {
    assessment: {
      overall_readiness: 'moderate', // low, moderate, high
      fatigue_indicators: {
        physical: 'normal',
        mental: 'slightly_elevated',
        cumulative: 'building'
      },
      recent_execution: {
        last_hard_workout: '3 days ago - Tempo run',
        execution_quality: 'on_target',
        recovery_since: 'adequate'
      },
      life_context: {
        recent_stressors: ['work deadline mentioned', 'weather has been poor'],
        positive_factors: ['excited about upcoming race', 'hit weekly mileage']
      }
    },
    recommendation: {
      proceed_as_planned: true,
      suggested_modifications: [
        'Consider starting conservatively',
        'Add extra warmup time',
        'Have a Plan B if legs feel heavy'
      ],
      alternative_workouts: [
        {
          name: 'Tempo Intervals',
          reason: 'Easier to manage if fatigue shows up'
        },
        {
          name: 'Progressive Long Run',
          reason: 'Builds into effort based on feel'
        }
      ]
    },
    questions_for_runner: [
      "How did you sleep last night? (1-10)",
      "Any soreness or niggles today?",
      "Energy levels compared to normal?"
    ]
  };
}

/**
 * Adaptive Workout Adjustment Tool
 */
export const adaptWorkoutDefinition = {
  name: 'adapt_workout',
  description: `Modify planned workout based on runner's current state. Use after vibe_check
  or when runner expresses fatigue, stress, or other concerns.`,
  input_schema: {
    type: 'object',
    properties: {
      original_workout: {
        type: 'object',
        description: 'The originally planned workout'
      },
      runner_feedback: {
        type: 'object',
        properties: {
          energy_level: {
            type: 'number',
            description: '1-10 scale'
          },
          legs_feel: {
            type: 'string',
            enum: ['heavy', 'normal', 'springy', 'sore']
          },
          time_available: {
            type: 'number',
            description: 'Minutes available'
          },
          mental_state: {
            type: 'string',
            enum: ['excited', 'ready', 'anxious', 'dreading', 'neutral']
          }
        }
      },
      context: {
        type: 'object',
        properties: {
          days_until_race: { type: 'number' },
          recent_training_load: { type: 'string' },
          weather_conditions: { type: 'object' }
        }
      }
    },
    required: ['original_workout', 'runner_feedback']
  }
};

export function adaptWorkout(params: any) {
  const { original_workout, runner_feedback, context } = params;

  // Decision tree for adaptations
  if (runner_feedback.energy_level < 5 && runner_feedback.legs_feel === 'heavy') {
    return {
      adapted_workout: {
        name: 'Recovery-Focused ' + original_workout.name,
        type: 'easy_quality',
        structure: 'Easy run with 4x20sec gentle pickups',
        rationale: 'High fatigue detected - maintaining quality with much lower load'
      },
      key_changes: [
        'Reduced volume by 40%',
        'Changed continuous effort to short intervals',
        'Added flexibility to stop if needed'
      ]
    };
  }

  if (runner_feedback.time_available < original_workout.estimated_minutes * 0.7) {
    return {
      adapted_workout: {
        name: 'Time-Crunched ' + original_workout.name,
        type: original_workout.type,
        structure: compressWorkout(original_workout),
        rationale: 'Maintaining stimulus in reduced time'
      },
      key_changes: [
        'Shortened warmup/cooldown',
        'Reduced recovery periods',
        'Maintained key work'
      ]
    };
  }

  // Default: proceed with minor adjustments
  return {
    adapted_workout: original_workout,
    key_changes: ['No major changes needed - listen to your body'],
    permission_to_modify: 'Feel free to cut it short if things go south'
  };
}

function compressWorkout(workout: any): string {
  // Logic to compress workout while maintaining key stimulus
  const compressionStrategies: Record<string, string> = {
    tempo: '3x8min @ tempo with 90s recovery instead of continuous',
    interval: 'Reduce reps by 25%, maintain pace',
    long_run: 'Cap at 90 minutes, add progression element',
    easy: 'Whatever time you have at comfortable pace'
  };

  return compressionStrategies[workout.type] || workout.structure;
}