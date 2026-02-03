// Run Auto-Categorizer - Deterministic engine for classifying workouts
// Feature 4: Intelligent Run Auto-Categorization

import type { Workout, UserSettings, WorkoutSegment } from '../schema';
import type { PaceZones } from './types';
import { calculatePaceZones } from './vdot-calculator';

// Run categories with their characteristics
export type RunCategory =
  | 'easy'
  | 'recovery'
  | 'long_run'
  | 'tempo'
  | 'threshold'
  | 'progression'
  | 'fartlek'
  | 'intervals'
  | 'hill_repeats'
  | 'race'
  | 'shakeout'
  | 'cross_training';

export interface ClassificationSignals {
  paceZone: string;
  hrZone?: string;
  durationCategory: 'short' | 'medium' | 'long' | 'very_long';
  structureType?: 'steady' | 'intervals' | 'progression' | 'varied';
  elevationProfile?: 'flat' | 'rolling' | 'hilly' | 'very_hilly';
  paceVariability?: 'steady' | 'variable' | 'highly_variable';
}

export interface ClassificationResult {
  category: RunCategory;
  confidence: number; // 0-1
  summary: string; // e.g., "Easy 6-miler with steady 8:45 pace"
  signals: ClassificationSignals;
  alternativeCategories?: Array<{ category: RunCategory; confidence: number }>;
}

interface PaceAnalysis {
  zone: string;
  percentOfEasy: number;
  percentOfTempo: number;
  percentOfThreshold: number;
}

/**
 * Classify a workout based on its characteristics
 */
export function classifyRun(
  workout: Workout,
  userSettings: UserSettings | null,
  segments?: WorkoutSegment[]
): ClassificationResult {
  // Handle cross-training (no distance or very short)
  if (workout.workoutType === 'cross_train' || !workout.distanceMiles || workout.distanceMiles < 0.5) {
    return {
      category: 'cross_training',
      confidence: 0.95,
      summary: formatCrossTrainingSummary(workout),
      signals: {
        paceZone: 'n/a',
        durationCategory: getDurationCategory(workout.durationMinutes || 0),
      },
    };
  }

  // Handle explicit race type
  if (workout.workoutType === 'race') {
    return {
      category: 'race',
      confidence: 0.98,
      summary: formatRaceSummary(workout),
      signals: {
        paceZone: 'race',
        durationCategory: getDurationCategory(workout.durationMinutes || 0),
      },
    };
  }

  // Get pace zones if available
  const paceZones = userSettings?.vdot ? calculatePaceZones(userSettings.vdot) : null;

  // Analyze the workout characteristics
  const paceAnalysis = analyzePace(workout, paceZones, userSettings);
  const durationCategory = getDurationCategory(workout.durationMinutes || 0);
  const elevationProfile = analyzeElevation(workout);
  const paceVariability = segments ? analyzePaceVariability(segments) : 'steady';
  const structureType = detectStructure(segments, workout);

  // Build signals
  const signals: ClassificationSignals = {
    paceZone: paceAnalysis.zone,
    durationCategory,
    structureType,
    elevationProfile,
    paceVariability,
  };

  // Add HR zone if available
  if (workout.avgHr && userSettings?.restingHr) {
    signals.hrZone = getHRZone(workout.avgHr, userSettings.restingHr, userSettings.age || 30);
  }

  // Determine category based on signals
  const result = determineCategory(workout, signals, paceAnalysis, segments);

  // Generate summary
  result.summary = generateSummary(workout, result.category, signals);
  result.signals = signals;

  return result;
}

/**
 * Analyze pace relative to training zones
 */
function analyzePace(
  workout: Workout,
  paceZones: PaceZones | null,
  userSettings: UserSettings | null
): PaceAnalysis {
  const pace = workout.avgPaceSeconds;

  if (!pace) {
    return { zone: 'unknown', percentOfEasy: 0, percentOfTempo: 0, percentOfThreshold: 0 };
  }

  // If we have VDOT-based zones, use them
  if (paceZones) {
    const percentOfEasy = (paceZones.easy / pace) * 100;
    const percentOfTempo = (paceZones.tempo / pace) * 100;
    const percentOfThreshold = (paceZones.threshold / pace) * 100;

    let zone = 'unknown';
    if (pace >= paceZones.recovery) zone = 'recovery';
    else if (pace >= paceZones.easy) zone = 'easy';
    else if (pace >= paceZones.generalAerobic) zone = 'aerobic';
    else if (pace >= paceZones.marathon) zone = 'marathon';
    else if (pace >= paceZones.tempo) zone = 'tempo';
    else if (pace >= paceZones.threshold) zone = 'threshold';
    else if (pace >= paceZones.vo2max) zone = 'vo2max';
    else zone = 'faster';

    return { zone, percentOfEasy, percentOfTempo, percentOfThreshold };
  }

  // Fallback: use user's easy pace if available
  const easyPace = userSettings?.easyPaceSeconds;
  const tempoPace = userSettings?.tempoPaceSeconds;
  const thresholdPace = userSettings?.thresholdPaceSeconds;

  if (easyPace) {
    const percentOfEasy = (easyPace / pace) * 100;
    const percentOfTempo = tempoPace ? (tempoPace / pace) * 100 : 0;
    const percentOfThreshold = thresholdPace ? (thresholdPace / pace) * 100 : 0;

    let zone = 'unknown';
    if (pace > easyPace * 1.1) zone = 'recovery';
    else if (pace >= easyPace * 0.95) zone = 'easy';
    else if (!tempoPace || pace > tempoPace * 1.05) zone = 'aerobic';
    else if (pace >= tempoPace * 0.95) zone = 'tempo';
    else if (!thresholdPace || pace >= thresholdPace * 0.95) zone = 'threshold';
    else zone = 'faster';

    return { zone, percentOfEasy, percentOfTempo, percentOfThreshold };
  }

  // No reference paces available - use generic classification based on absolute pace
  // This is very rough but better than nothing
  return {
    zone: 'unknown',
    percentOfEasy: 100,
    percentOfTempo: 0,
    percentOfThreshold: 0,
  };
}

/**
 * Categorize duration
 */
function getDurationCategory(minutes: number): 'short' | 'medium' | 'long' | 'very_long' {
  if (minutes < 30) return 'short';
  if (minutes < 60) return 'medium';
  if (minutes < 90) return 'long';
  return 'very_long';
}

/**
 * Analyze elevation profile
 */
function analyzeElevation(workout: Workout): 'flat' | 'rolling' | 'hilly' | 'very_hilly' {
  const elevGain = workout.elevationGainFt || workout.elevationGainFeet || 0;
  const distance = workout.distanceMiles || 1;
  const gainPerMile = elevGain / distance;

  if (gainPerMile < 50) return 'flat';
  if (gainPerMile < 100) return 'rolling';
  if (gainPerMile < 200) return 'hilly';
  return 'very_hilly';
}

/**
 * Analyze pace variability from segments
 */
function analyzePaceVariability(
  segments: WorkoutSegment[]
): 'steady' | 'variable' | 'highly_variable' {
  if (!segments || segments.length < 2) return 'steady';

  const paces = segments
    .filter(s => s.paceSecondsPerMile && s.paceSecondsPerMile > 0)
    .map(s => s.paceSecondsPerMile!);

  if (paces.length < 2) return 'steady';

  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
  const variance = paces.reduce((sum, p) => sum + Math.pow(p - avgPace, 2), 0) / paces.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / avgPace;

  if (coefficientOfVariation < 0.05) return 'steady';
  if (coefficientOfVariation < 0.15) return 'variable';
  return 'highly_variable';
}

/**
 * Detect workout structure from segments
 */
function detectStructure(
  segments: WorkoutSegment[] | undefined,
  workout: Workout
): 'steady' | 'intervals' | 'progression' | 'varied' {
  if (!segments || segments.length < 3) return 'steady';

  const workSegments = segments.filter(s => s.segmentType === 'work');
  const recoverySegments = segments.filter(s => s.segmentType === 'recovery');

  // Check for interval pattern (alternating work/recovery)
  if (workSegments.length >= 3 && recoverySegments.length >= 2) {
    return 'intervals';
  }

  // Check for progression (getting faster throughout)
  const paces = segments
    .filter(s => s.paceSecondsPerMile && s.paceSecondsPerMile > 0)
    .map(s => s.paceSecondsPerMile!);

  if (paces.length >= 3) {
    const isProgression = paces.every((p, i) => i === 0 || p <= paces[i - 1] + 10);
    if (isProgression && paces[0] - paces[paces.length - 1] > 30) {
      return 'progression';
    }
  }

  // Check for varied pacing (fartlek-style)
  const variability = analyzePaceVariability(segments);
  if (variability === 'highly_variable') {
    return 'varied';
  }

  return 'steady';
}

/**
 * Get HR zone based on heart rate reserve method
 */
function getHRZone(avgHr: number, restingHr: number, age: number): string {
  const maxHr = 220 - age;
  const hrReserve = maxHr - restingHr;
  const intensityPercent = ((avgHr - restingHr) / hrReserve) * 100;

  if (intensityPercent < 60) return 'zone1';
  if (intensityPercent < 70) return 'zone2';
  if (intensityPercent < 80) return 'zone3';
  if (intensityPercent < 90) return 'zone4';
  return 'zone5';
}

/**
 * Determine the workout category based on all signals
 */
function determineCategory(
  workout: Workout,
  signals: ClassificationSignals,
  paceAnalysis: PaceAnalysis,
  segments?: WorkoutSegment[]
): ClassificationResult {
  const alternatives: Array<{ category: RunCategory; confidence: number }> = [];

  // Distance and duration
  const distance = workout.distanceMiles || 0;
  const duration = workout.durationMinutes || 0;

  // Check for intervals first (highest specificity)
  if (signals.structureType === 'intervals') {
    return {
      category: 'intervals',
      confidence: 0.9,
      summary: '',
      signals,
      alternativeCategories: [{ category: 'fartlek', confidence: 0.3 }],
    };
  }

  // Check for progression run
  if (signals.structureType === 'progression') {
    return {
      category: 'progression',
      confidence: 0.85,
      summary: '',
      signals,
      alternativeCategories: [{ category: 'tempo', confidence: 0.4 }],
    };
  }

  // Check for fartlek (varied pacing without clear interval structure)
  if (signals.structureType === 'varied' || signals.paceVariability === 'highly_variable') {
    return {
      category: 'fartlek',
      confidence: 0.75,
      summary: '',
      signals,
      alternativeCategories: [
        { category: 'intervals', confidence: 0.4 },
        { category: 'easy', confidence: 0.3 },
      ],
    };
  }

  // Check for hill repeats (hilly + variable pacing)
  if (signals.elevationProfile === 'very_hilly' && signals.paceVariability !== 'steady') {
    return {
      category: 'hill_repeats',
      confidence: 0.7,
      summary: '',
      signals,
      alternativeCategories: [{ category: 'easy', confidence: 0.4 }],
    };
  }

  // Check for long run (primarily duration/distance based)
  if (signals.durationCategory === 'very_long' || distance >= 13) {
    const isEasyPaced = paceAnalysis.zone === 'easy' || paceAnalysis.zone === 'recovery' || paceAnalysis.zone === 'aerobic';
    return {
      category: 'long_run',
      confidence: isEasyPaced ? 0.9 : 0.75,
      summary: '',
      signals,
      alternativeCategories: isEasyPaced ? [] : [{ category: 'tempo', confidence: 0.3 }],
    };
  }

  // Check for long run (medium-long)
  if (signals.durationCategory === 'long' || (distance >= 10 && distance < 13)) {
    const isEasyPaced = paceAnalysis.zone === 'easy' || paceAnalysis.zone === 'recovery' || paceAnalysis.zone === 'aerobic';
    if (isEasyPaced) {
      return {
        category: 'long_run',
        confidence: 0.8,
        summary: '',
        signals,
        alternativeCategories: [{ category: 'easy', confidence: 0.5 }],
      };
    }
  }

  // Pace-based classification for steady runs
  switch (paceAnalysis.zone) {
    case 'recovery':
      // Very short recovery runs are shakeouts
      if (distance < 4 && duration < 30) {
        return {
          category: 'shakeout',
          confidence: 0.8,
          summary: '',
          signals,
          alternativeCategories: [{ category: 'recovery', confidence: 0.6 }],
        };
      }
      return {
        category: 'recovery',
        confidence: 0.85,
        summary: '',
        signals,
        alternativeCategories: [{ category: 'easy', confidence: 0.4 }],
      };

    case 'easy':
    case 'aerobic':
      // Short easy runs
      if (distance < 4) {
        return {
          category: 'easy',
          confidence: 0.85,
          summary: '',
          signals,
          alternativeCategories: [{ category: 'shakeout', confidence: 0.3 }],
        };
      }
      return {
        category: 'easy',
        confidence: 0.9,
        summary: '',
        signals,
      };

    case 'marathon':
      // Marathon pace is between easy and tempo
      return {
        category: 'easy',
        confidence: 0.7,
        summary: '',
        signals,
        alternativeCategories: [{ category: 'tempo', confidence: 0.4 }],
      };

    case 'tempo':
      return {
        category: 'tempo',
        confidence: 0.85,
        summary: '',
        signals,
        alternativeCategories: [{ category: 'threshold', confidence: 0.3 }],
      };

    case 'threshold':
      return {
        category: 'threshold',
        confidence: 0.85,
        summary: '',
        signals,
        alternativeCategories: [{ category: 'tempo', confidence: 0.4 }],
      };

    case 'vo2max':
    case 'faster':
      // Fast steady runs are usually threshold or interval-type effort
      return {
        category: 'threshold',
        confidence: 0.7,
        summary: '',
        signals,
        alternativeCategories: [{ category: 'intervals', confidence: 0.4 }],
      };

    default:
      // Unknown zone - default to easy
      return {
        category: 'easy',
        confidence: 0.5,
        summary: '',
        signals,
        alternativeCategories: [
          { category: 'tempo', confidence: 0.3 },
          { category: 'recovery', confidence: 0.3 },
        ],
      };
  }
}

/**
 * Generate a human-readable summary of the workout
 */
function generateSummary(
  workout: Workout,
  category: RunCategory,
  signals: ClassificationSignals
): string {
  const distance = workout.distanceMiles;
  const pace = workout.avgPaceSeconds;

  // Format distance
  const distanceStr = distance ? `${distance.toFixed(1)}-mile` : '';

  // Format pace
  const paceStr = pace ? formatPace(pace) : '';

  // Category-specific summaries
  switch (category) {
    case 'easy':
      if (distanceStr && paceStr) {
        return `Easy ${distanceStr}r at ${paceStr} pace`;
      }
      return `Easy run${distanceStr ? ` of ${distanceStr.replace('-mile', ' miles')}` : ''}`;

    case 'recovery':
      return `Recovery ${distanceStr || 'run'}${paceStr ? ` at relaxed ${paceStr} pace` : ''}`;

    case 'long_run':
      return `Long run of ${distanceStr.replace('-mile', ' miles')}${paceStr ? ` averaging ${paceStr}` : ''}`;

    case 'tempo':
      return `Tempo ${distanceStr || 'run'}${paceStr ? ` at ${paceStr} pace` : ''}`;

    case 'threshold':
      return `Threshold ${distanceStr || 'run'}${paceStr ? ` at ${paceStr} pace` : ''}`;

    case 'progression':
      return `Progression run${distanceStr ? ` of ${distanceStr.replace('-mile', ' miles')}` : ''}`;

    case 'fartlek':
      return `Fartlek ${distanceStr || 'session'} with varied pacing`;

    case 'intervals':
      return `Interval workout${distanceStr ? ` totaling ${distanceStr.replace('-mile', ' miles')}` : ''}`;

    case 'hill_repeats':
      const elevGain = workout.elevationGainFt || workout.elevationGainFeet || 0;
      return `Hill workout${distanceStr ? ` of ${distanceStr.replace('-mile', ' miles')}` : ''} (${elevGain}ft gain)`;

    case 'race':
      return `Race effort${distanceStr ? ` over ${distanceStr.replace('-mile', ' miles')}` : ''}${paceStr ? ` at ${paceStr} pace` : ''}`;

    case 'shakeout':
      return `Shakeout ${distanceStr || 'jog'}${paceStr ? ` at easy ${paceStr} pace` : ''}`;

    case 'cross_training':
      return `Cross-training session${workout.durationMinutes ? ` (${workout.durationMinutes} min)` : ''}`;

    default:
      return `${distanceStr || ''} run${paceStr ? ` at ${paceStr} pace` : ''}`.trim();
  }
}

function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatCrossTrainingSummary(workout: Workout): string {
  const duration = workout.durationMinutes;
  if (duration) {
    return `Cross-training session (${duration} minutes)`;
  }
  return 'Cross-training session';
}

function formatRaceSummary(workout: Workout): string {
  const distance = workout.distanceMiles;
  const pace = workout.avgPaceSeconds;

  let summary = 'Race';
  if (distance) {
    // Try to match common race distances
    if (distance >= 26 && distance <= 26.5) summary = 'Marathon';
    else if (distance >= 13 && distance <= 13.2) summary = 'Half marathon';
    else if (distance >= 6.1 && distance <= 6.3) summary = '10K';
    else if (distance >= 3 && distance <= 3.2) summary = '5K';
    else summary = `${distance.toFixed(1)}-mile race`;
  }

  if (pace) {
    summary += ` at ${formatPace(pace)} pace`;
  }

  return summary;
}

/**
 * Compute quality ratio - fraction of time spent at/above tempo effort
 */
export function computeQualityRatio(
  workout: Workout,
  segments: WorkoutSegment[] | undefined,
  userSettings: UserSettings | null
): number {
  const tempoPace = userSettings?.tempoPaceSeconds;

  if (!tempoPace || !segments || segments.length === 0) {
    // Without segments or reference pace, use overall pace
    const avgPace = workout.avgPaceSeconds;
    if (!avgPace || !tempoPace) return 0;

    // If average pace is at or faster than tempo, all time is "quality"
    return avgPace <= tempoPace ? 1 : 0;
  }

  // Calculate time spent at/above tempo pace
  let qualityTime = 0;
  let totalTime = 0;

  for (const segment of segments) {
    const segmentTime = segment.durationSeconds || 0;
    const segmentPace = segment.paceSecondsPerMile;

    totalTime += segmentTime;

    if (segmentPace && segmentPace <= tempoPace * 1.02) {
      // Within 2% of tempo pace counts as quality
      qualityTime += segmentTime;
    }
  }

  return totalTime > 0 ? qualityTime / totalTime : 0;
}

/**
 * Compute TRIMP (Training Impulse) score
 * Uses simplified Banister TRIMP formula
 */
export function computeTRIMP(
  workout: Workout,
  userSettings: UserSettings | null
): number {
  const duration = workout.durationMinutes;
  const avgHr = workout.avgHr || workout.avgHeartRate;

  if (!duration || !avgHr) {
    // Fall back to distance-based estimate if no HR data
    const distance = workout.distanceMiles || 0;
    const pace = workout.avgPaceSeconds || 600; // default 10:00/mi

    // Rough TRIMP estimate based on pace intensity
    // Faster pace = higher intensity factor
    const intensityFactor = pace < 360 ? 2.5 : // sub-6:00
                           pace < 420 ? 2.0 : // sub-7:00
                           pace < 480 ? 1.6 : // sub-8:00
                           pace < 540 ? 1.3 : // sub-9:00
                           pace < 600 ? 1.1 : // sub-10:00
                           1.0;

    return Math.round(duration * intensityFactor);
  }

  // Get max HR (estimate if not available)
  const age = userSettings?.age || 30;
  const maxHr = 220 - age;
  const restingHr = userSettings?.restingHr || 60;

  // Calculate heart rate reserve fraction
  const hrReserveFraction = (avgHr - restingHr) / (maxHr - restingHr);

  // Clamp to valid range
  const hrFraction = Math.max(0, Math.min(1, hrReserveFraction));

  // Gender-specific exponential weighting factor
  // Using male coefficients as default (female would use 1.67 and 1.92)
  const gender = userSettings?.gender;
  const yFactor = gender === 'female'
    ? hrFraction * 1.67 * Math.exp(1.92 * hrFraction)
    : hrFraction * 1.92 * Math.exp(1.92 * hrFraction);

  return Math.round(duration * yFactor);
}
