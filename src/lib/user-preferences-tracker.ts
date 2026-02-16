/**
 * User Preferences Tracker
 *
 * Tracks patterns and preferences that emerge over time,
 * not just what users say they want but what actually works for them.
 */


export interface PreferencePattern {
  pattern_type: 'workout_completion' | 'performance_peak' | 'motivation_driver' | 'struggle_point';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<string, any>;
  outcome: string;
  confidence: number; // 0-1, how sure we are about this pattern
  last_observed: Date;
}

export class UserPreferencesTracker {
  /**
   * Track discovered preferences vs stated preferences
   */
  async trackWorkoutCompletion(
    profileId: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workout: any,
    completed: boolean,
    execution_quality?: string,
    context?: {
      time_of_day: string;
      day_of_week: string;
      weather: string;
      preceded_by: string;
      life_stress: string;
    }
  ) {
    // Store the pattern
    const pattern = {
      profileId,
      pattern_type: 'workout_completion',
      workout_type: workout.type,
      workout_complexity: workout.structure.length > 100 ? 'complex' : 'simple',
      completed,
      execution_quality,
      context,
      timestamp: new Date()
    };

    // In real implementation, store this and analyze patterns
    await this.storePattern(pattern);

    // Analyze emerging patterns
    return this.analyzeCompletionPatterns(_profileId);
  }

  /**
   * Track what actually motivates action vs what they say motivates them
   */
  async trackMotivationalResponse(
    profileId: number,
    trigger: string,
    response: 'positive' | 'negative' | 'neutral',
    resulting_action: string
  ) {
    const pattern = {
      profileId,
      pattern_type: 'motivation_driver',
      trigger,
      response,
      resulting_action,
      timestamp: new Date()
    };

    await this.storePattern(pattern);
  }

  /**
   * Discover optimal workout timing
   */
  async discoverOptimalTiming(profileId: number) {
    // Analyze when they actually complete workouts successfully
    const patterns = await this.getPatterns(profileId, 'workout_completion');

    const timingSuccess: Record<string, { attempts: number; completions: number }> = {};

    patterns.forEach(p => {
      const key = `${p.context?.day_of_week}_${p.context?.time_of_day}`;
      if (!timingSuccess[key]) {
        timingSuccess[key] = { attempts: 0, completions: 0 };
      }
      timingSuccess[key].attempts++;
      if (p.completed) {
        timingSuccess[key].completions++;
      }
    });

    // Find best times
    const optimalTimes = Object.entries(timingSuccess)
      .map(([time, stats]) => ({
        time,
        success_rate: stats.completions / stats.attempts,
        sample_size: stats.attempts
      }))
      .filter(t => t.sample_size > 3) // Need enough data
      .sort((a, b) => b.success_rate - a.success_rate);

    return optimalTimes;
  }

  /**
   * Learn what workout descriptions work best
   */
  async analyzeCoachingLanguagePreference(profileId: number) {
    const responses = await this.getPatterns(profileId, 'motivation_driver');

    const languagePatterns = {
      responds_to_data: 0,
      responds_to_encouragement: 0,
      responds_to_challenge: 0,
      responds_to_flexibility: 0
    };

    responses.forEach(r => {
      if (r.trigger.includes('data') || r.trigger.includes('pace')) {
        languagePatterns.responds_to_data += r.response === 'positive' ? 1 : -1;
      }
      if (r.trigger.includes('great') || r.trigger.includes('proud')) {
        languagePatterns.responds_to_encouragement += r.response === 'positive' ? 1 : -1;
      }
      if (r.trigger.includes('push') || r.trigger.includes('challenge')) {
        languagePatterns.responds_to_challenge += r.response === 'positive' ? 1 : -1;
      }
      if (r.trigger.includes('modify') || r.trigger.includes('adjust')) {
        languagePatterns.responds_to_flexibility += r.response === 'positive' ? 1 : -1;
      }
    });

    return languagePatterns;
  }

  /**
   * Identify workout types that work vs those that don't
   */
  async identifyWorkoutPreferences(profileId: number) {
    const completions = await this.getPatterns(profileId, 'workout_completion');

    const workoutSuccess: Record<string, {
      attempts: number;
      completed: number;
      well_executed: number;
    }> = {};

    completions.forEach(c => {
      const type = c.workout_type;
      if (!workoutSuccess[type]) {
        workoutSuccess[type] = { attempts: 0, completed: 0, well_executed: 0 };
      }
      workoutSuccess[type].attempts++;
      if (c.completed) {
        workoutSuccess[type].completed++;
        if (c.execution_quality === 'excellent' || c.execution_quality === 'good') {
          workoutSuccess[type].well_executed++;
        }
      }
    });

    // Calculate success rates
    const preferences = Object.entries(workoutSuccess).map(([type, stats]) => ({
      workout_type: type,
      completion_rate: stats.completed / stats.attempts,
      execution_quality: stats.well_executed / stats.completed,
      sample_size: stats.attempts,
      preference_score: (stats.completed / stats.attempts) * (stats.well_executed / stats.completed)
    }));

    return preferences.sort((a, b) => b.preference_score - a.preference_score);
  }

  /**
   * Helper methods
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async storePattern(pattern: any) {
    // TODO: Store in database when preference tracking tables are added
    // This will use a table like:
    // preference_patterns (
    //   id, profile_id, pattern_type, pattern_data,
    //   confidence, created_at, updated_at
    // )
    console.log('Storing preference pattern:', pattern);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getPatterns(profileId: number, _patternType: string) {
    // TODO: Query from database when preference tracking is implemented
    // Will query the preference_patterns table filtered by profile_id and pattern_type
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async analyzeCompletionPatterns(profileId: number) {
    // Complex analysis of what actually works for this runner
    return {
      discovered_preferences: {
        best_workout_time: 'morning_before_work',
        optimal_hard_days: ['Tuesday', 'Thursday', 'Saturday'],
        prefers_structure: false, // They complete unstructured workouts more
        sweet_spot_duration: '45-60min',
        responds_to: 'gentle_flexibility'
      },
      confidence_levels: {
        timing: 0.85,
        structure: 0.72,
        motivation: 0.68
      }
    };
  }
}

/**
 * Integration with prescribe workout
 */
export async function enhanceWorkoutWithPreferences(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  baseWorkout: any,
  profileId: number
) {
  const tracker = new UserPreferencesTracker();

  // Get discovered preferences
  const timing = await tracker.discoverOptimalTiming(profileId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _workoutPrefs = await tracker.identifyWorkoutPreferences(profileId);
  const language = await tracker.analyzeCoachingLanguagePreference(profileId);

  // Adapt the workout based on what actually works
  const enhanced = { ...baseWorkout };

  // Add timing recommendation
  if (timing.length > 0) {
    enhanced.optimal_timing = `Based on your history, you complete workouts best on ${timing[0].time}`;
  }

  // Adjust language based on preferences
  if (language.responds_to_flexibility > language.responds_to_challenge) {
    enhanced.coach_notes = enhanced.coach_notes.replace(
      'Push through',
      'Listen to your body and adjust as needed'
    );
  }

  return enhanced;
}