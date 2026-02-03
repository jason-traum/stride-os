// Execution Scorer - Deterministic engine for scoring workout execution
// Feature 15: Workout Execution Score

import type { Workout, PlannedWorkout, WorkoutSegment, UserSettings } from '../schema';

export interface ExecutionScoreComponents {
  paceAccuracy: number;      // 0-100, 30% weight
  zoneAdherence: number;     // 0-100, 25% weight
  completionRate: number;    // 0-100, 25% weight
  consistency: number;       // 0-100, 20% weight
}

export interface ExecutionScore {
  overall: number;           // 0-100
  components: ExecutionScoreComponents;
  diagnosis: string;         // Template-based explanation
  suggestion: string;        // Actionable advice for next time
  highlights: string[];      // What went well
  concerns: string[];        // What could improve
}

export interface WeatherData {
  tempF?: number;
  feelsLikeF?: number;
  humidity?: number;
  windMph?: number;
  conditions?: string;
}

/**
 * Compute execution score comparing actual workout to planned workout
 */
export function computeExecutionScore(
  actual: Workout,
  planned: PlannedWorkout,
  segments?: WorkoutSegment[],
  weather?: WeatherData,
  userSettings?: UserSettings | null
): ExecutionScore {
  const components: ExecutionScoreComponents = {
    paceAccuracy: computePaceAccuracy(actual, planned, weather),
    zoneAdherence: computeZoneAdherence(actual, planned, segments, userSettings),
    completionRate: computeCompletionRate(actual, planned),
    consistency: computeConsistency(segments),
  };

  // Weighted average
  const overall = Math.round(
    components.paceAccuracy * 0.30 +
    components.zoneAdherence * 0.25 +
    components.completionRate * 0.25 +
    components.consistency * 0.20
  );

  const { diagnosis, suggestion, highlights, concerns } = generateFeedback(
    components,
    actual,
    planned,
    weather
  );

  return {
    overall,
    components,
    diagnosis,
    suggestion,
    highlights,
    concerns,
  };
}

/**
 * Score pace accuracy (how close to target pace)
 */
function computePaceAccuracy(
  actual: Workout,
  planned: PlannedWorkout,
  weather?: WeatherData
): number {
  const actualPace = actual.avgPaceSeconds;
  const targetPace = planned.targetPaceSecondsPerMile;

  if (!actualPace || !targetPace) {
    // Can't compare paces - give neutral score
    return 75;
  }

  // Adjust target pace for weather conditions
  const adjustedTarget = adjustPaceForConditions(targetPace, weather, planned.workoutType);

  // Calculate deviation percentage
  const deviation = Math.abs(actualPace - adjustedTarget) / adjustedTarget;

  // Scoring:
  // 0-2% deviation = 100
  // 2-5% deviation = 90-99
  // 5-10% deviation = 70-89
  // 10-20% deviation = 50-69
  // >20% deviation = scaled down from 50

  if (deviation <= 0.02) return 100;
  if (deviation <= 0.05) return Math.round(100 - (deviation - 0.02) * 333);
  if (deviation <= 0.10) return Math.round(90 - (deviation - 0.05) * 400);
  if (deviation <= 0.20) return Math.round(70 - (deviation - 0.10) * 200);
  return Math.max(20, Math.round(50 - (deviation - 0.20) * 100));
}

/**
 * Adjust target pace based on weather conditions
 */
function adjustPaceForConditions(
  basePace: number,
  weather?: WeatherData,
  workoutType?: string
): number {
  if (!weather) return basePace;

  let adjustmentPercent = 0;

  // Temperature adjustment (deviation from ideal ~55°F)
  const temp = weather.feelsLikeF ?? weather.tempF;
  if (temp !== undefined) {
    if (temp > 75) {
      adjustmentPercent += (temp - 75) * 0.5; // +0.5% per degree above 75
    } else if (temp > 65) {
      adjustmentPercent += (temp - 65) * 0.2; // +0.2% per degree above 65
    } else if (temp < 35) {
      adjustmentPercent += (35 - temp) * 0.3; // +0.3% per degree below 35
    }
  }

  // Wind adjustment
  if (weather.windMph && weather.windMph > 10) {
    adjustmentPercent += (weather.windMph - 10) * 0.2; // +0.2% per mph above 10
  }

  // Humidity adjustment (high humidity in heat)
  if (weather.humidity && temp && temp > 70 && weather.humidity > 60) {
    adjustmentPercent += (weather.humidity - 60) * 0.05; // +0.05% per % above 60
  }

  // Easy runs get full adjustment, quality work gets less
  const adjustmentMultiplier = workoutType === 'easy' || workoutType === 'recovery' ? 1.0 : 0.5;

  // Apply adjustment (slower pace = higher seconds)
  return Math.round(basePace * (1 + (adjustmentPercent / 100) * adjustmentMultiplier));
}

/**
 * Score zone adherence (staying in correct training zones)
 */
function computeZoneAdherence(
  actual: Workout,
  planned: PlannedWorkout,
  segments?: WorkoutSegment[],
  userSettings?: UserSettings | null
): number {
  // Determine target zone based on workout type
  const targetZone = getTargetZone(planned.workoutType);

  if (!segments || segments.length === 0) {
    // Without segments, estimate from overall pace
    return estimateZoneAdherenceFromPace(actual, planned, targetZone, userSettings);
  }

  // Calculate time spent in correct zone
  let timeInZone = 0;
  let totalTime = 0;

  for (const segment of segments) {
    const segmentTime = segment.durationSeconds || 0;
    const segmentPace = segment.paceSecondsPerMile;

    if (!segmentTime || !segmentPace) continue;

    totalTime += segmentTime;

    // Check if segment is in appropriate zone
    const inZone = isInZone(segmentPace, targetZone, segment.segmentType, userSettings);
    if (inZone) {
      timeInZone += segmentTime;
    }
  }

  if (totalTime === 0) return 75;

  return Math.round((timeInZone / totalTime) * 100);
}

function getTargetZone(workoutType: string): string {
  const zoneMap: Record<string, string> = {
    easy: 'easy',
    recovery: 'recovery',
    long: 'easy_aerobic',
    tempo: 'tempo',
    threshold: 'threshold',
    interval: 'vo2max',
    race: 'race',
    steady: 'aerobic',
  };
  return zoneMap[workoutType] || 'easy';
}

function isInZone(
  pace: number,
  targetZone: string,
  segmentType: string,
  userSettings?: UserSettings | null
): boolean {
  // Get reference paces
  const easyPace = userSettings?.easyPaceSeconds || 540; // 9:00 default
  const tempoPace = userSettings?.tempoPaceSeconds || 450; // 7:30 default
  const thresholdPace = userSettings?.thresholdPaceSeconds || 420; // 7:00 default

  // Recovery/warmup/cooldown segments should be easy pace
  if (segmentType === 'warmup' || segmentType === 'cooldown' || segmentType === 'recovery') {
    return pace >= easyPace * 0.95; // Easy or slower
  }

  // Zone checking for work segments
  switch (targetZone) {
    case 'easy':
    case 'recovery':
      return pace >= easyPace * 0.9; // Easy pace or slower
    case 'easy_aerobic':
      return pace >= easyPace * 0.85 && pace <= easyPace * 1.1; // Within 15% of easy
    case 'aerobic':
      return pace >= tempoPace * 1.1 && pace <= easyPace * 0.95; // Between easy and tempo
    case 'tempo':
      return pace >= tempoPace * 0.95 && pace <= tempoPace * 1.05; // Within 5% of tempo
    case 'threshold':
      return pace >= thresholdPace * 0.95 && pace <= thresholdPace * 1.05; // Within 5% of threshold
    case 'vo2max':
      return pace <= thresholdPace * 0.95; // Faster than threshold
    case 'race':
      return true; // Any pace is acceptable for race effort
    default:
      return true;
  }
}

function estimateZoneAdherenceFromPace(
  actual: Workout,
  planned: PlannedWorkout,
  targetZone: string,
  userSettings?: UserSettings | null
): number {
  const actualPace = actual.avgPaceSeconds;
  if (!actualPace) return 75;

  const easyPace = userSettings?.easyPaceSeconds || 540;
  const tempoPace = userSettings?.tempoPaceSeconds || 450;

  // Simple check: was overall effort appropriate for the workout type?
  switch (targetZone) {
    case 'easy':
    case 'recovery':
    case 'easy_aerobic':
      // Should be easy - penalty for going too fast
      if (actualPace < easyPace * 0.85) return 60; // Too fast
      if (actualPace >= easyPace * 0.9) return 95; // Good
      return 80;
    case 'tempo':
    case 'threshold':
      // Should be hard - penalty for going too slow or too fast
      if (actualPace > tempoPace * 1.1) return 60; // Too slow
      if (actualPace < tempoPace * 0.85) return 70; // Maybe too fast
      return 90;
    default:
      return 80;
  }
}

/**
 * Score completion rate (distance/duration achieved vs planned)
 */
function computeCompletionRate(actual: Workout, planned: PlannedWorkout): number {
  // Check distance completion
  if (planned.targetDistanceMiles && actual.distanceMiles) {
    const completionPct = (actual.distanceMiles / planned.targetDistanceMiles) * 100;

    // Full credit for completing 95%+
    if (completionPct >= 95) return 100;
    // Linear scale below 95%
    if (completionPct >= 50) return Math.round(completionPct);
    // Steep penalty below 50%
    return Math.round(completionPct * 0.8);
  }

  // Check duration completion
  if (planned.targetDurationMinutes && actual.durationMinutes) {
    const completionPct = (actual.durationMinutes / planned.targetDurationMinutes) * 100;

    if (completionPct >= 95) return 100;
    if (completionPct >= 50) return Math.round(completionPct);
    return Math.round(completionPct * 0.8);
  }

  // No target to compare - neutral score
  return 85;
}

/**
 * Score consistency (even pacing throughout)
 */
function computeConsistency(segments?: WorkoutSegment[]): number {
  if (!segments || segments.length < 3) {
    // Without segments, can't evaluate consistency
    return 80;
  }

  // Get paces for steady/work segments (exclude warmup/cooldown)
  const steadySegments = segments.filter(
    s => s.segmentType === 'steady' || s.segmentType === 'work'
  );

  if (steadySegments.length < 2) {
    return 85;
  }

  const paces = steadySegments
    .filter(s => s.paceSecondsPerMile && s.paceSecondsPerMile > 0)
    .map(s => s.paceSecondsPerMile!);

  if (paces.length < 2) {
    return 80;
  }

  // Calculate coefficient of variation
  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
  const variance = paces.reduce((sum, p) => sum + Math.pow(p - avgPace, 2), 0) / paces.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / avgPace;

  // Scoring based on CV:
  // <3% = excellent (95-100)
  // 3-5% = good (85-94)
  // 5-8% = acceptable (70-84)
  // >8% = inconsistent (below 70)

  if (cv < 0.03) return Math.round(95 + (0.03 - cv) * 166);
  if (cv < 0.05) return Math.round(85 + (0.05 - cv) * 500);
  if (cv < 0.08) return Math.round(70 + (0.08 - cv) * 500);
  return Math.max(30, Math.round(70 - (cv - 0.08) * 500));
}

/**
 * Generate human-readable feedback based on scores
 */
function generateFeedback(
  components: ExecutionScoreComponents,
  actual: Workout,
  planned: PlannedWorkout,
  weather?: WeatherData
): {
  diagnosis: string;
  suggestion: string;
  highlights: string[];
  concerns: string[];
} {
  const highlights: string[] = [];
  const concerns: string[] = [];

  // Analyze each component
  if (components.paceAccuracy >= 90) {
    highlights.push('Excellent pace control');
  } else if (components.paceAccuracy < 70) {
    const actualPace = actual.avgPaceSeconds;
    const targetPace = planned.targetPaceSecondsPerMile;
    if (actualPace && targetPace) {
      if (actualPace < targetPace) {
        concerns.push('Ran faster than target pace');
      } else {
        concerns.push('Ran slower than target pace');
      }
    }
  }

  if (components.zoneAdherence >= 90) {
    highlights.push('Stayed in target training zone');
  } else if (components.zoneAdherence < 70) {
    concerns.push('Spent significant time outside target zone');
  }

  if (components.completionRate >= 95) {
    highlights.push('Completed full workout');
  } else if (components.completionRate < 80) {
    concerns.push('Cut workout short');
  }

  if (components.consistency >= 90) {
    highlights.push('Very consistent pacing');
  } else if (components.consistency < 70) {
    concerns.push('Pace varied significantly');
  }

  // Generate diagnosis
  let diagnosis: string;
  const overallScore = Math.round(
    components.paceAccuracy * 0.30 +
    components.zoneAdherence * 0.25 +
    components.completionRate * 0.25 +
    components.consistency * 0.20
  );

  if (overallScore >= 90) {
    diagnosis = 'Excellent execution. You nailed this workout.';
  } else if (overallScore >= 80) {
    diagnosis = 'Solid execution with minor areas to refine.';
  } else if (overallScore >= 70) {
    diagnosis = 'Decent effort but room for improvement.';
  } else if (overallScore >= 60) {
    diagnosis = 'Workout deviated from plan - consider what affected execution.';
  } else {
    diagnosis = 'Challenging day. Sometimes the body needs different than planned.';
  }

  // Add weather context
  if (weather?.tempF && weather.tempF > 80) {
    diagnosis += ' Hot conditions likely affected performance.';
  } else if (weather?.windMph && weather.windMph > 15) {
    diagnosis += ' Strong wind made this tougher than usual.';
  }

  // Generate suggestion
  let suggestion: string;
  const lowestComponent = Object.entries(components)
    .sort(([, a], [, b]) => a - b)[0];

  switch (lowestComponent[0]) {
    case 'paceAccuracy':
      if (actual.avgPaceSeconds && planned.targetPaceSecondsPerMile) {
        if (actual.avgPaceSeconds < planned.targetPaceSecondsPerMile) {
          suggestion = 'Try starting more conservatively next time to better hit target pace.';
        } else {
          suggestion = 'Review target pace - it may need adjustment based on current fitness.';
        }
      } else {
        suggestion = 'Focus on hitting target pace more precisely.';
      }
      break;
    case 'zoneAdherence':
      suggestion = 'Use a watch or app to monitor effort and stay in the right zone throughout.';
      break;
    case 'completionRate':
      suggestion = 'If you need to cut short, prioritize completing the key portions of the workout.';
      break;
    case 'consistency':
      suggestion = 'Try to start slightly slower and maintain even effort throughout.';
      break;
    default:
      suggestion = 'Keep up the good work!';
  }

  return { diagnosis, suggestion, highlights, concerns };
}

/**
 * Generate execution score JSON for storage
 */
export function serializeExecutionDetails(score: ExecutionScore): string {
  return JSON.stringify({
    overall: score.overall,
    components: score.components,
    highlights: score.highlights,
    concerns: score.concerns,
  });
}

/**
 * Parse execution score JSON from storage
 */
export function parseExecutionDetails(json: string): Partial<ExecutionScore> | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
