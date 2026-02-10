/**
 * Intelligent Workout Request Interpreter
 *
 * This module helps interpret vague or nuanced workout requests and translates them
 * into proper parameters for the prescribe_workout tool.
 */

interface InterpretedRequest {
  workoutType: string;
  preference: 'simple' | 'detailed' | 'advanced';
  modifiers: {
    intensity?: 'easy' | 'moderate' | 'hard' | 'extreme';
    duration?: 'short' | 'standard' | 'long';
    complexity?: 'basic' | 'structured' | 'complex';
  };
  suggestedParams: Record<string, any>;
  clarificationNeeded?: string;
}

export class WorkoutRequestInterpreter {
  /**
   * Interpret a natural language workout request
   */
  interpret(request: string): InterpretedRequest {
    const lower = request.toLowerCase();

    // Extract workout type
    const workoutType = this.extractWorkoutType(lower);

    // Extract preference level
    const preference = this.extractPreference(lower);

    // Extract modifiers
    const modifiers = this.extractModifiers(lower);

    // Build suggested parameters
    const suggestedParams = this.buildSuggestedParams(
      workoutType,
      preference,
      modifiers,
      lower
    );

    // Check if clarification is needed
    const clarificationNeeded = this.checkClarificationNeeded(
      workoutType,
      lower
    );

    return {
      workoutType,
      preference,
      modifiers,
      suggestedParams,
      clarificationNeeded
    };
  }

  private extractWorkoutType(request: string): string {
    // Direct matches
    if (request.includes('tempo')) return 'tempo';
    if (request.includes('threshold')) return 'threshold';
    if (request.includes('interval') || request.includes('speed')) return 'vo2max';
    if (request.includes('long run')) return 'long_run';
    if (request.includes('easy') || request.includes('recovery')) return 'easy';
    if (request.includes('fartlek')) return 'fartlek';
    if (request.includes('progression')) return 'progression';

    // Indirect matches
    if (request.includes('fast') && request.includes('short')) return 'vo2max';
    if (request.includes('sustained') || request.includes('steady')) return 'tempo';
    if (request.includes('marathon pace')) return 'tempo';
    if (request.includes('race pace')) return 'tempo';

    // Vague requests
    if (request.includes('hard')) return 'tempo'; // Default hard to tempo
    if (request.includes('quality')) return 'tempo';
    if (request.includes('workout')) return 'tempo'; // Generic workout

    return 'easy'; // Ultimate fallback
  }

  private extractPreference(request: string): 'simple' | 'detailed' | 'advanced' {
    // Advanced indicators
    if (request.includes('super advanced') || request.includes('extremely advanced')) {
      return 'advanced';
    }
    if (request.includes('advanced') || request.includes('complex')) {
      return 'advanced';
    }
    if (request.includes('elite') || request.includes('pro')) {
      return 'advanced';
    }
    if (request.includes('norwegian') || request.includes('canova')) {
      return 'advanced';
    }

    // Simple indicators
    if (request.includes('simple') || request.includes('basic')) {
      return 'simple';
    }
    if (request.includes('beginner') || request.includes('easy to follow')) {
      return 'simple';
    }

    // Detailed indicators
    if (request.includes('structured') || request.includes('detailed')) {
      return 'detailed';
    }

    return 'detailed'; // Default to middle ground
  }

  private extractModifiers(request: string): InterpretedRequest['modifiers'] {
    const modifiers: InterpretedRequest['modifiers'] = {};

    // Intensity
    if (request.includes('super hard') || request.includes('brutal')) {
      modifiers.intensity = 'extreme';
    } else if (request.includes('hard') || request.includes('tough')) {
      modifiers.intensity = 'hard';
    } else if (request.includes('moderate') || request.includes('medium')) {
      modifiers.intensity = 'moderate';
    } else if (request.includes('easy') || request.includes('light')) {
      modifiers.intensity = 'easy';
    }

    // Duration
    if (request.includes('quick') || request.includes('short')) {
      modifiers.duration = 'short';
    } else if (request.includes('long') || request.includes('extended')) {
      modifiers.duration = 'long';
    }

    // Complexity
    if (request.includes('varied') || request.includes('mix')) {
      modifiers.complexity = 'complex';
    } else if (request.includes('simple') || request.includes('straightforward')) {
      modifiers.complexity = 'basic';
    }

    return modifiers;
  }

  private buildSuggestedParams(
    workoutType: string,
    preference: string,
    modifiers: InterpretedRequest['modifiers'],
    request: string
  ): Record<string, any> {
    const params: Record<string, any> = {
      workout_type: workoutType,
      preference: preference
    };

    // Add phase hints based on request
    if (request.includes('peak') || request.includes('race prep')) {
      params.phase = 'peak';
    } else if (request.includes('base') || request.includes('building')) {
      params.phase = 'base';
    } else if (request.includes('taper')) {
      params.phase = 'taper';
    }

    // Add time constraints
    const timeMatch = request.match(/(\d+)\s*(min|minute|hour)/);
    if (timeMatch) {
      const duration = parseInt(timeMatch[1]);
      const unit = timeMatch[2];
      params.available_time = unit.includes('hour') ? duration * 60 : duration;
    }

    // Add distance hints
    if (request.includes('marathon')) {
      params.target_distance = 'marathon';
    } else if (request.includes('half')) {
      params.target_distance = 'half';
    } else if (request.includes('5k')) {
      params.target_distance = '5k';
    } else if (request.includes('10k')) {
      params.target_distance = '10k';
    }

    // Advanced specific parameters
    if (preference === 'advanced') {
      params.include_alternatives = true;
      params.include_adaptations = true;
    }

    return params;
  }

  private checkClarificationNeeded(
    workoutType: string,
    request: string
  ): string | undefined {
    // Very vague requests
    if (request === 'workout' || request === 'run') {
      return 'What type of workout are you looking for? (easy, tempo, speed, long run)';
    }

    // Conflicting signals
    if (request.includes('easy') && request.includes('hard')) {
      return 'I see mixed signals - are you looking for an easy run or a harder workout?';
    }

    // Time constraints without type
    if (request.match(/\d+\s*min/) && workoutType === 'easy') {
      return `I can give you a ${request.match(/\d+\s*min/)?.[0]} workout - what type would you prefer?`;
    }

    return undefined;
  }

  /**
   * Generate enhanced parameters for prescribe_workout based on interpretation
   */
  enhanceWorkoutRequest(
    interpretation: InterpretedRequest,
    userContext: any
  ): Record<string, any> {
    const enhanced = { ...interpretation.suggestedParams };

    // For "super advanced" requests, ensure we get the most complex workouts
    if (interpretation.preference === 'advanced' &&
        interpretation.modifiers.intensity === 'extreme') {
      enhanced.preference = 'advanced';
      enhanced.complexity_override = 'maximum';
      enhanced.include_olympic_variations = true;
    }

    // Adjust based on user fitness level if available
    if (userContext.fitnessLevel) {
      if (userContext.fitnessLevel === 'beginner' &&
          interpretation.preference === 'advanced') {
        enhanced.safety_adjusted = true;
        enhanced.preference = 'detailed'; // Step down for safety
      }
    }

    return enhanced;
  }
}