/**
 * Training Plan Generator
 *
 * Core algorithm for generating personalized training plans based on user profile,
 * race goals, and proven coaching methodologies.
 */

import {
  TrainingPhase,
  PlanGenerationInput,
  GeneratedPlan,
  PlannedWeek,
  PlannedWorkoutDefinition,
  PhaseDistribution,
  PaceZones,
} from './types';
import {
  getPhasePercentages,
  calculatePhaseWeeks,
  calculateMileageProgression,
  createWeeklyStructure,
  getLongRunType,
  getQualityWorkoutType,
  DAYS_ORDER,
} from './plan-rules';
import { getWorkoutTemplate, ALL_WORKOUT_TEMPLATES } from './workout-templates';

// ==================== Main Generator ====================

/**
 * Generate a complete training plan for a race.
 */
export function generateTrainingPlan(input: PlanGenerationInput): GeneratedPlan {
  // Calculate total weeks
  const today = new Date(input.startDate);
  const raceDate = new Date(input.raceDate);
  const totalWeeks = Math.floor((raceDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));

  if (totalWeeks < 4) {
    throw new Error('Not enough time for a proper training plan. Need at least 4 weeks.');
  }

  // Get phase distribution
  const phasePercentages = getPhasePercentages(input.raceDistanceMeters, totalWeeks);
  const phaseWeeks = calculatePhaseWeeks(phasePercentages, totalWeeks);

  // Calculate mileage progression
  const mileages = calculateMileageProgression(
    input.currentWeeklyMileage,
    input.peakWeeklyMileageTarget,
    totalWeeks,
    phaseWeeks,
    input.planAggressiveness
  );

  // Create weekly structure template
  const weeklyStructure = createWeeklyStructure(
    input.runsPerWeek,
    input.preferredLongRunDay,
    input.preferredQualityDays,
    input.requiredRestDays,
    input.qualitySessionsPerWeek
  );

  // Build phases array
  const phases = buildPhases(phaseWeeks, input.raceDistanceMeters);

  // Generate weekly plans
  const weeks: PlannedWeek[] = [];
  let weekNumber = 1;
  let weekStartDate = new Date(input.startDate);

  // Adjust to start on Monday
  const dayOfWeek = weekStartDate.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
  if (daysUntilMonday > 0) {
    weekStartDate.setDate(weekStartDate.getDate() + daysUntilMonday);
  }

  let currentPhase: TrainingPhase = 'base';
  let weekInPhase = 0;
  let phaseTransitionWeek = phaseWeeks.base;

  for (let i = 0; i < totalWeeks; i++) {
    // Determine current phase
    if (weekNumber > phaseTransitionWeek) {
      if (currentPhase === 'base') {
        currentPhase = 'build';
        phaseTransitionWeek += phaseWeeks.build;
        weekInPhase = 0;
      } else if (currentPhase === 'build') {
        currentPhase = 'peak';
        phaseTransitionWeek += phaseWeeks.peak;
        weekInPhase = 0;
      } else if (currentPhase === 'peak') {
        currentPhase = 'taper';
        weekInPhase = 0;
      }
    }

    const targetMileage = mileages[i] || mileages[mileages.length - 1];
    const isDownWeek = i > 0 && targetMileage < mileages[i - 1] * 0.85;

    // Calculate week end date
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    // Generate workouts for this week
    const workouts = generateWeekWorkouts(
      weekStartDate,
      currentPhase,
      weekInPhase,
      getCurrentPhaseWeeks(currentPhase, phaseWeeks),
      targetMileage,
      weeklyStructure,
      input.raceDistanceMeters,
      input.qualitySessionsPerWeek,
      isDownWeek,
      input.paceZones
    );

    // Calculate actual weekly stats
    const longRunMiles = workouts.find(w => w.workoutType === 'long')?.targetDistanceMiles || 0;

    weeks.push({
      weekNumber,
      startDate: weekStartDate.toISOString().split('T')[0],
      endDate: weekEndDate.toISOString().split('T')[0],
      phase: currentPhase,
      targetMileage,
      longRunMiles,
      qualitySessions: isDownWeek ? Math.max(1, input.qualitySessionsPerWeek - 1) : input.qualitySessionsPerWeek,
      focus: getPhaseFocus(currentPhase, weekInPhase),
      isDownWeek,
      workouts,
    });

    // Advance to next week
    weekNumber++;
    weekInPhase++;
    weekStartDate = new Date(weekStartDate);
    weekStartDate.setDate(weekStartDate.getDate() + 7);
  }

  // Calculate summary
  const totalMiles = weeks.reduce((sum, w) => sum + w.targetMileage, 0);
  const peakWeek = weeks.reduce((max, w) => w.targetMileage > max.targetMileage ? w : max, weeks[0]);
  const qualitySessionsTotal = weeks.reduce((sum, w) => sum + w.qualitySessions, 0);
  const longRunsTotal = weeks.filter(w => w.longRunMiles > 0).length;

  return {
    raceId: input.raceId,
    raceName: '', // Will be filled in by caller
    raceDate: input.raceDate,
    raceDistance: input.raceDistanceLabel,
    totalWeeks,
    phases,
    weeks,
    summary: {
      totalMiles,
      peakMileageWeek: peakWeek.weekNumber,
      peakMileage: peakWeek.targetMileage,
      qualitySessionsTotal,
      longRunsTotal,
    },
  };
}

// ==================== Helper Functions ====================

function buildPhases(
  phaseWeeks: Record<TrainingPhase, number>,
  raceDistanceMeters: number
): PhaseDistribution[] {
  return [
    {
      phase: 'base',
      weeks: phaseWeeks.base,
      focus: getPhaseDescription('base', raceDistanceMeters),
      intensityDistribution: { easy: 85, moderate: 10, hard: 5 },
    },
    {
      phase: 'build',
      weeks: phaseWeeks.build,
      focus: getPhaseDescription('build', raceDistanceMeters),
      intensityDistribution: { easy: 80, moderate: 12, hard: 8 },
    },
    {
      phase: 'peak',
      weeks: phaseWeeks.peak,
      focus: getPhaseDescription('peak', raceDistanceMeters),
      intensityDistribution: { easy: 75, moderate: 15, hard: 10 },
    },
    {
      phase: 'taper',
      weeks: phaseWeeks.taper,
      focus: getPhaseDescription('taper', raceDistanceMeters),
      intensityDistribution: { easy: 80, moderate: 15, hard: 5 },
    },
  ];
}

function getPhaseDescription(phase: TrainingPhase, raceDistanceMeters: number): string {
  const isMarathon = raceDistanceMeters >= 40000;
  const isHalf = raceDistanceMeters >= 20000;

  switch (phase) {
    case 'base':
      return 'Build aerobic foundation with easy running, strides, and light fartlek work';
    case 'build':
      if (isMarathon) return 'Progressive intensity with tempo runs and marathon-pace development';
      if (isHalf) return 'Tempo and threshold work to build lactate tolerance';
      return 'VO2max and tempo work to build speed endurance';
    case 'peak':
      if (isMarathon) return 'Race-specific workouts and marathon pace simulation';
      if (isHalf) return 'Sharpen with half marathon pace and threshold work';
      return 'Peak fitness with race-pace sharpening';
    case 'taper':
      return 'Reduce volume while maintaining intensity; arrive fresh and ready';
    default:
      return 'Training phase';
  }
}

function getPhaseFocus(
  phase: TrainingPhase,
  weekInPhase: number
): string {
  if (phase === 'base') {
    if (weekInPhase === 0) return 'Establishing baseline with easy aerobic running';
    if (weekInPhase === 1) return 'Building aerobic capacity with longer easy runs';
    return 'Continuing aerobic development with fartlek and hills';
  }

  if (phase === 'build') {
    if (weekInPhase === 0) return 'Introducing tempo work';
    if (weekInPhase < 3) return 'Progressive tempo and threshold development';
    return 'Building race-specific fitness';
  }

  if (phase === 'peak') {
    if (weekInPhase === 0) return 'Sharpening with race-pace work';
    return 'Fine-tuning and maintaining peak fitness';
  }

  // Taper
  if (weekInPhase === 0) return 'Beginning taper - reducing volume';
  return 'Final preparation for race day';
}

function getCurrentPhaseWeeks(phase: TrainingPhase, phaseWeeks: Record<TrainingPhase, number>): number {
  return phaseWeeks[phase];
}

function generateWeekWorkouts(
  weekStartDate: Date,
  phase: TrainingPhase,
  weekInPhase: number,
  totalPhaseWeeks: number,
  targetMileage: number,
  structure: ReturnType<typeof createWeeklyStructure>,
  raceDistanceMeters: number,
  qualitySessionsPerWeek: number,
  isDownWeek: boolean,
  paceZones?: PaceZones
): PlannedWorkoutDefinition[] {
  const workouts: PlannedWorkoutDefinition[] = [];

  // Calculate distance distribution
  const longRunPct = phase === 'taper' ? 0.25 : 0.30;
  const longRunMiles = Math.round(targetMileage * longRunPct);
  const remainingMiles = targetMileage - longRunMiles;

  // Count run days (excluding long run)
  let runDaysCount = 0;
  for (const day of structure.days) {
    if (day.runType !== 'rest' && day.runType !== 'long') {
      runDaysCount++;
    }
  }
  const easyRunMiles = runDaysCount > 0 ? Math.round(remainingMiles / runDaysCount) : 0;

  // Quality sessions for this week
  const qualitySessions = isDownWeek ? Math.max(1, qualitySessionsPerWeek - 1) : qualitySessionsPerWeek;
  let qualitySessionCount = 0;

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayStructure = structure.days[dayIndex];
    const workoutDate = new Date(weekStartDate);
    workoutDate.setDate(workoutDate.getDate() + dayIndex);
    const dateStr = workoutDate.toISOString().split('T')[0];

    if (dayStructure.runType === 'rest') {
      continue; // Skip rest days
    }

    if (dayStructure.runType === 'long') {
      // Long run
      const longRunType = getLongRunType(phase, weekInPhase, totalPhaseWeeks, raceDistanceMeters);
      const template = findTemplateByType(longRunType, 'long_run');

      workouts.push({
        date: dateStr,
        dayOfWeek: DAYS_ORDER[dayIndex],
        templateId: template?.id || 'long_run_easy',
        workoutType: 'long',
        name: template?.name || 'Long Run',
        description: template?.description || `Easy long run of ${longRunMiles} miles`,
        targetDistanceMiles: longRunMiles,
        targetPaceSecondsPerMile: paceZones?.easy,
        structure: template?.structure,
        rationale: getRationale(phase, 'long', weekInPhase, raceDistanceMeters),
        isKeyWorkout: true,
        alternatives: getAlternatives('long', phase),
      });
    } else if (dayStructure.runType === 'quality' && qualitySessionCount < qualitySessions) {
      // Quality workout
      qualitySessionCount++;
      const qualityType = getQualityWorkoutType(
        phase,
        weekInPhase,
        qualitySessionCount,
        raceDistanceMeters
      );
      const template = getWorkoutTemplate(qualityType);

      workouts.push({
        date: dateStr,
        dayOfWeek: DAYS_ORDER[dayIndex],
        templateId: template?.id || qualityType,
        workoutType: 'quality',
        name: template?.name || 'Quality Workout',
        description: template?.description || 'Quality training session',
        targetDistanceMiles: easyRunMiles + 2, // Quality runs tend to be slightly longer
        targetDurationMinutes: template?.typicalDistanceMilesMax ? template.typicalDistanceMilesMax * 8 : 60,
        targetPaceSecondsPerMile: getQualityPace(qualityType, paceZones),
        structure: template?.structure,
        rationale: getRationale(phase, 'quality', weekInPhase, raceDistanceMeters),
        isKeyWorkout: true,
        alternatives: getAlternatives('quality', phase),
      });
    } else {
      // Easy run
      workouts.push({
        date: dateStr,
        dayOfWeek: DAYS_ORDER[dayIndex],
        templateId: 'easy_run',
        workoutType: 'easy',
        name: 'Easy Run',
        description: `Easy aerobic run of ${easyRunMiles} miles`,
        targetDistanceMiles: easyRunMiles,
        targetPaceSecondsPerMile: paceZones?.easy,
        rationale: 'Recovery and aerobic maintenance between harder efforts',
        isKeyWorkout: false,
      });
    }
  }

  return workouts;
}

function findTemplateByType(type: string, category: string): ReturnType<typeof getWorkoutTemplate> {
  // Try exact match first
  const template = getWorkoutTemplate(type);
  if (template) return template;

  // Find by category
  return ALL_WORKOUT_TEMPLATES.find(t => t.category === category);
}

function getQualityPace(workoutType: string, paceZones?: PaceZones): number | undefined {
  if (!paceZones) return undefined;

  if (workoutType.includes('tempo')) return paceZones.tempo;
  if (workoutType.includes('threshold')) return paceZones.threshold;
  if (workoutType.includes('vo2max') || workoutType.includes('interval')) return paceZones.interval;
  if (workoutType.includes('mp') || workoutType.includes('marathon')) return paceZones.marathon;
  if (workoutType.includes('hmp') || workoutType.includes('half_marathon')) return paceZones.halfMarathon;
  if (workoutType.includes('easy')) return paceZones.easy;

  return paceZones.tempo; // Default to tempo for quality workouts
}

function getRationale(
  phase: TrainingPhase,
  workoutType: string,
  weekInPhase: number,
  raceDistanceMeters: number
): string {
  const isMarathon = raceDistanceMeters >= 40000;

  if (workoutType === 'long') {
    if (phase === 'base') return 'Building aerobic endurance and teaching the body to burn fat efficiently';
    if (phase === 'build') return 'Developing endurance while introducing race-pace elements';
    if (phase === 'peak') return isMarathon
      ? 'Simulating race conditions and practicing fueling strategy'
      : 'Maintaining endurance while staying fresh for race day';
    return 'Keeping the legs moving while allowing recovery before race day';
  }

  if (workoutType === 'quality') {
    if (phase === 'base') return 'Light speedwork to maintain running economy without excessive stress';
    if (phase === 'build') return 'Building lactate threshold and race-specific fitness';
    if (phase === 'peak') return 'Sharpening and fine-tuning race pace';
    return 'Keeping legs snappy while tapering volume';
  }

  return 'Recovery running to support adaptation from harder workouts';
}

function getAlternatives(workoutType: string, phase: TrainingPhase): string[] {
  if (workoutType === 'long') {
    if (phase === 'base') return ['long_run_easy', 'medium_long_run'];
    if (phase === 'build') return ['long_run_progression', 'long_run_easy'];
    if (phase === 'peak') return ['long_run_mp', 'long_run_alternating'];
    return ['easy_run'];
  }

  if (workoutType === 'quality') {
    if (phase === 'base') return ['fartlek_classic', 'hill_short', 'strides'];
    if (phase === 'build') return ['tempo_steady', 'threshold_cruise_intervals', 'vo2max_800s'];
    if (phase === 'peak') return ['tempo_progressive', 'race_pace_intervals'];
    return ['strides', 'easy_run'];
  }

  return [];
}

// ==================== Plan Modification ====================

/**
 * Scale down a workout (for fatigue or time constraints).
 */
export function scaleDownWorkout(workout: PlannedWorkoutDefinition, factor: number = 0.75): PlannedWorkoutDefinition {
  return {
    ...workout,
    targetDistanceMiles: workout.targetDistanceMiles
      ? Math.round(workout.targetDistanceMiles * factor * 10) / 10
      : undefined,
    targetDurationMinutes: workout.targetDurationMinutes
      ? Math.round(workout.targetDurationMinutes * factor)
      : undefined,
    rationale: `${workout.rationale} (scaled down to ${Math.round(factor * 100)}%)`,
  };
}

/**
 * Swap a workout with an alternative.
 */
export function swapWorkout(
  workout: PlannedWorkoutDefinition,
  alternativeId: string
): PlannedWorkoutDefinition {
  const template = getWorkoutTemplate(alternativeId);
  if (!template) return workout;

  return {
    ...workout,
    templateId: template.id,
    name: template.name,
    description: template.description,
    structure: template.structure,
    rationale: `Swapped from ${workout.name}: ${template.purpose}`,
  };
}
