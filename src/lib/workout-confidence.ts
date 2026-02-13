/**
 * Workout Confidence Score
 * Predicts likelihood of successfully completing a workout based on multiple factors
 */

import type { ReadinessFactors } from '@/lib/readiness';

export interface WorkoutDetails {
  type: 'easy' | 'tempo' | 'threshold' | 'interval' | 'long_run' | 'race';
  plannedDistanceMiles?: number;
  plannedDurationMinutes?: number;
  plannedIntensity?: number; // 1-10 scale
  isKeyWorkout?: boolean;
}

export interface ConfidenceFactors {
  // Readiness components
  readinessScore: number;
  tsb?: number;
  sleepQuality?: number;
  soreness?: number;

  // Recent training
  similarWorkoutSuccess?: number; // Success rate of similar workouts (0-1)
  daysSinceLastHard?: number;
  consecutiveTrainingDays?: number;
  weeklyMileagePercent?: number; // Current week vs average (e.g., 1.1 = 110%)

  // Environmental
  weatherSeverity?: number; // 0-100, higher is worse
  timeOfDayMatch?: boolean; // Running at usual time

  // Workout specific
  workoutDifficulty?: number; // 1-10 scale
  distanceVsUsual?: number; // Ratio to typical run distance
}

export interface ConfidenceResult {
  score: number; // 0-100
  category: 'high' | 'good' | 'moderate' | 'low';
  factors: {
    positive: string[];
    negative: string[];
    suggestions: string[];
  };
  recommendation: string;
  adjustments?: {
    pace?: string;
    distance?: string;
    intensity?: string;
  };
}

/**
 * Calculate workout confidence score
 */
export function calculateWorkoutConfidence(
  workout: WorkoutDetails,
  factors: ConfidenceFactors
): ConfidenceResult {
  let baseScore = 70; // Start with reasonable confidence
  const positiveFacts: string[] = [];
  const negativeFacts: string[] = [];
  const suggestions: string[] = [];
  const adjustments: ConfidenceResult['adjustments'] = {};

  // Readiness impact (±20 points)
  const readinessImpact = (factors.readinessScore - 50) * 0.4;
  baseScore += readinessImpact;

  if (factors.readinessScore >= 70) {
    positiveFacts.push(`High readiness (${factors.readinessScore}/100)`);
  } else if (factors.readinessScore < 50) {
    negativeFacts.push(`Low readiness (${factors.readinessScore}/100)`);
    suggestions.push('Consider an easier effort today');
  }

  // TSB impact (±15 points)
  if (factors.tsb !== undefined) {
    if (factors.tsb < -20) {
      baseScore -= 15;
      negativeFacts.push(`Very fatigued (TSB: ${factors.tsb})`);
      adjustments.intensity = 'Reduce by 10-15%';
    } else if (factors.tsb < -10) {
      baseScore -= 8;
      negativeFacts.push(`Fatigued (TSB: ${factors.tsb})`);
    } else if (factors.tsb > 10) {
      baseScore += 10;
      positiveFacts.push(`Well rested (TSB: ${factors.tsb})`);
    } else {
      baseScore += 5;
      positiveFacts.push(`Balanced training load`);
    }
  }

  // Sleep impact (±10 points)
  if (factors.sleepQuality !== undefined) {
    if (factors.sleepQuality >= 4) {
      baseScore += 5;
      positiveFacts.push('Good sleep quality');
    } else if (factors.sleepQuality <= 2) {
      baseScore -= 10;
      negativeFacts.push('Poor sleep quality');
      suggestions.push('Keep effort conversational');
    }
  }

  // Soreness impact (±10 points)
  if (factors.soreness !== undefined) {
    if (factors.soreness >= 4) {
      baseScore -= 10;
      negativeFacts.push(`High soreness (${factors.soreness}/5)`);
      if (workout.type !== 'easy') {
        suggestions.push('Consider switching to an easy run');
      }
    } else if (factors.soreness >= 3) {
      baseScore -= 5;
      negativeFacts.push('Moderate soreness');
    } else {
      positiveFacts.push('Minimal soreness');
    }
  }

  // Recent similar workout success (±15 points)
  if (factors.similarWorkoutSuccess !== undefined) {
    const successScore = factors.similarWorkoutSuccess * 15;
    baseScore += successScore - 7.5; // Center around neutral

    if (factors.similarWorkoutSuccess >= 0.8) {
      positiveFacts.push('Recent similar workouts went well');
    } else if (factors.similarWorkoutSuccess < 0.5) {
      negativeFacts.push('Recent similar workouts were challenging');
      suggestions.push('Start conservatively and assess');
    }
  }

  // Recovery timing (±10 points)
  if (factors.daysSinceLastHard !== undefined) {
    if (workout.type === 'tempo' || workout.type === 'threshold' || workout.type === 'interval') {
      if (factors.daysSinceLastHard < 2) {
        baseScore -= 10;
        negativeFacts.push(`Only ${factors.daysSinceLastHard} day(s) since last hard effort`);
        suggestions.push('Consider postponing or reducing intensity');
      } else if (factors.daysSinceLastHard >= 3) {
        baseScore += 5;
        positiveFacts.push(`Well recovered (${factors.daysSinceLastHard} days since hard effort)`);
      }
    }
  }

  // Consecutive days impact (±8 points)
  if (factors.consecutiveTrainingDays !== undefined) {
    if (factors.consecutiveTrainingDays >= 5) {
      baseScore -= 8;
      negativeFacts.push(`${factors.consecutiveTrainingDays} consecutive days of training`);
      suggestions.push('Consider a rest day soon');
    } else if (factors.consecutiveTrainingDays === 0) {
      baseScore += 5;
      positiveFacts.push('Fresh off a rest day');
    }
  }

  // Weekly mileage context (±10 points)
  if (factors.weeklyMileagePercent !== undefined) {
    if (factors.weeklyMileagePercent > 1.2) {
      baseScore -= 8;
      negativeFacts.push('Weekly mileage 20%+ above normal');
      adjustments.distance = 'Consider reducing by 10-20%';
    } else if (factors.weeklyMileagePercent < 0.8) {
      baseScore += 5;
      positiveFacts.push('Lower mileage week');
    }
  }

  // Weather impact (±15 points)
  if (factors.weatherSeverity !== undefined) {
    if (factors.weatherSeverity >= 70) {
      baseScore -= 15;
      negativeFacts.push('Challenging weather conditions');
      adjustments.pace = 'Adjust pace for conditions';
    } else if (factors.weatherSeverity >= 40) {
      baseScore -= 7;
      negativeFacts.push('Moderate weather challenges');
    } else {
      baseScore += 5;
      positiveFacts.push('Good weather conditions');
    }
  }

  // Time of day (±5 points)
  if (factors.timeOfDayMatch !== undefined) {
    if (factors.timeOfDayMatch) {
      baseScore += 5;
      positiveFacts.push('Running at usual time');
    } else {
      baseScore -= 5;
      negativeFacts.push('Running at unusual time');
      suggestions.push('Allow extra warmup time');
    }
  }

  // Workout difficulty adjustment (±10 points)
  if (workout.type === 'interval' || workout.type === 'threshold') {
    baseScore -= 5; // Harder workouts inherently less certain

    if (factors.distanceVsUsual && factors.distanceVsUsual > 1.3) {
      baseScore -= 5;
      negativeFacts.push('Longer than typical for this workout type');
    }
  }

  // Ensure score is within bounds
  const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Categorize
  let category: ConfidenceResult['category'];
  let recommendation: string;

  if (finalScore >= 80) {
    category = 'high';
    recommendation = 'Conditions are excellent. Execute as planned and push yourself!';
  } else if (finalScore >= 65) {
    category = 'good';
    recommendation = 'Good conditions for your workout. Listen to your body and adjust if needed.';
  } else if (finalScore >= 50) {
    category = 'moderate';
    recommendation = 'Proceed with caution. Be ready to modify based on how you feel.';
  } else {
    category = 'low';
    recommendation = 'Consider modifying or postponing. Your body may need more recovery.';
  }

  // Add specific suggestions based on score
  if (finalScore < 60 && workout.type !== 'easy') {
    suggestions.push('Have a backup plan (easier workout) ready');
  }

  if (negativeFacts.length > positiveFacts.length * 2) {
    suggestions.push('Multiple factors suggest caution today');
  }

  return {
    score: finalScore,
    category,
    factors: {
      positive: positiveFacts,
      negative: negativeFacts,
      suggestions,
    },
    recommendation,
    adjustments: Object.keys(adjustments).length > 0 ? adjustments : undefined,
  };
}

/**
 * Get a simple confidence message for quick display
 */
export function getConfidenceMessage(score: number, workoutType: string): string {
  if (score >= 80) {
    return `${score}% confident - Great day for ${workoutType === 'interval' ? 'speed work' : 'this workout'}!`;
  } else if (score >= 65) {
    return `${score}% confident - Good to go, listen to your body`;
  } else if (score >= 50) {
    return `${score}% confident - Start easy and assess`;
  } else {
    return `${score}% confident - Consider an easier option today`;
  }
}

/**
 * Calculate historical success rate for similar workouts
 */
export function calculateSimilarWorkoutSuccess(
  workoutType: string,
  recentWorkouts: Array<{
    workoutType: string;
    completed: boolean;
    verdict?: string;
  }>
): number {
  const similarWorkouts = recentWorkouts.filter(w => w.workoutType === workoutType);

  if (similarWorkouts.length === 0) return 0.7; // Default to neutral

  const successCount = similarWorkouts.filter(w => {
    if (!w.completed) return false;
    if (w.verdict && ['great', 'good'].includes(w.verdict)) return true;
    return w.completed; // Count as success if completed without bad verdict
  }).length;

  return successCount / similarWorkouts.length;
}