/**
 * Window Generator
 *
 * Generates detailed daily workouts for a rolling window of macro blocks (typically 3 weeks).
 * Uses macro block targets (mileage, long run, quality count) as authoritative inputs.
 *
 * Adaptation logic analyzes actual-vs-planned deltas rather than simple completion rates:
 * - Did the runner do similar volume but different workout types? (self-coaching, not struggling)
 * - Did they consistently run less volume? (may need target adjustment)
 * - Did intensity shift? (higher RPE at lower volume = fatigue signal)
 * - Did they rearrange days? (schedule flexibility, not non-compliance)
 */

import type {
  TrainingPhase,
  PaceZones,
  AthleteProfile,
  IntermediateRace,
  PlannedWorkoutDefinition,
} from './types';
import {
  createWeeklyStructure,
  getLongRunType,
  getQualityWorkoutType,
  DAYS_ORDER,
  getComfortAdjustedWorkout,
  getExperienceBasedProgression,
  getTimeConstrainedDistance,
} from './plan-rules';
import { getWorkoutTemplate, ALL_WORKOUT_TEMPLATES } from './workout-templates';
import { parseLocalDate, formatPace } from '@/lib/utils';
import type { MacroPlanBlock } from './plan-generator';

// ==================== Types ====================

export interface CompletedWorkoutSummary {
  date: string;
  workoutType: string;
  distanceMiles: number;
  durationMinutes?: number;
  avgPaceSeconds?: number;
  rpe?: number;
  plannedType?: string;      // What was prescribed
  plannedDistance?: number;   // What distance was prescribed
  wasPlanned: boolean;       // Whether this matched a planned workout
}

export interface WindowGenerationInput {
  blocks: MacroPlanBlock[];
  raceDate: string;
  raceDistanceMeters: number;
  raceDistanceLabel: string;
  weeklyStructure: ReturnType<typeof createWeeklyStructure>;
  paceZones?: PaceZones;
  athleteProfile?: AthleteProfile;
  intermediateRaces?: IntermediateRace[];
  recentWorkouts?: CompletedWorkoutSummary[];
  qualitySessionsPerWeek: number;
}

export interface TrainingAdaptation {
  mileageAdjustment: number;       // Multiplier (e.g., 0.9 = reduce 10%)
  qualityAdjustment: number;       // Change to quality sessions (-1, 0)
  intensityAdjustment: number;     // Multiplier for intensity targets
  reasoning: string;               // Human-readable explanation
}

// ==================== Adaptation Analysis ====================

/**
 * Analyze recent workouts vs planned to determine if adjustments are needed.
 *
 * Key insight: not following the plan != failing. We look for:
 * 1. Volume delta — are they consistently running more or less total?
 * 2. Workout substitutions — different types but similar effort = smart self-coaching
 * 3. RPE trends — high RPE at lower volume = fatigue signal
 * 4. Consistency — sporadic training vs. regular but different
 */
export function analyzeTrainingAdaptation(
  recentWorkouts: CompletedWorkoutSummary[]
): TrainingAdaptation {
  if (recentWorkouts.length === 0) {
    return { mileageAdjustment: 1, qualityAdjustment: 0, intensityAdjustment: 1, reasoning: 'No recent data' };
  }

  // --- Volume Analysis ---
  // Compare actual weekly volume to what was planned
  const plannedWorkouts = recentWorkouts.filter(w => w.wasPlanned);
  const totalActualMiles = recentWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);
  const totalPlannedMiles = plannedWorkouts.reduce((sum, w) => sum + (w.plannedDistance || 0), 0);

  const volumeRatio = totalPlannedMiles > 0 ? totalActualMiles / totalPlannedMiles : 1;

  // --- RPE Trend Analysis ---
  const workoutsWithRpe = recentWorkouts.filter(w => w.rpe != null);
  const avgRpe = workoutsWithRpe.length > 0
    ? workoutsWithRpe.reduce((sum, w) => sum + (w.rpe || 0), 0) / workoutsWithRpe.length
    : 5;

  // --- Substitution Analysis ---
  // Did they do different workouts than planned? That's okay if volume/effort is similar
  const typeMatches = plannedWorkouts.filter(w => w.workoutType === w.plannedType).length;
  const typeMismatchRate = plannedWorkouts.length > 0
    ? 1 - (typeMatches / plannedWorkouts.length)
    : 0;

  // --- Quality Session Tracking ---
  const qualityTypes = ['tempo', 'interval', 'steady', 'race'];
  const actualQuality = recentWorkouts.filter(w =>
    qualityTypes.includes(w.workoutType)
  ).length;

  // --- Decision Logic ---
  let mileageAdjustment = 1;
  let qualityAdjustment = 0;
  let intensityAdjustment = 1;
  const reasons: string[] = [];

  // Consistently running less volume AND high RPE = genuinely struggling
  if (volumeRatio < 0.70 && avgRpe > 7) {
    mileageAdjustment = 0.90;
    reasons.push(`Volume ${Math.round(volumeRatio * 100)}% of planned with high RPE (${avgRpe.toFixed(1)}) — reducing targets 10%`);
  }
  // Running less but RPE is fine = they're choosing to run less, respect that
  else if (volumeRatio < 0.70 && avgRpe <= 6) {
    mileageAdjustment = 0.95;
    reasons.push(`Volume at ${Math.round(volumeRatio * 100)}% but effort is manageable — slight adjustment`);
  }
  // Running MORE than planned = they can handle more (or are ignoring easy day prescriptions)
  else if (volumeRatio > 1.15) {
    reasons.push(`Exceeding planned volume (${Math.round(volumeRatio * 100)}%) — maintaining targets`);
  }

  // High RPE trend regardless of volume = back off intensity
  if (avgRpe >= 8 && workoutsWithRpe.length >= 3) {
    intensityAdjustment = 0.95;
    reasons.push(`Sustained high RPE (${avgRpe.toFixed(1)}) — reducing intensity slightly`);
  }

  // Low quality session count relative to plan (but only if they're clearly skipping, not substituting)
  // If type mismatch is high but they're still running, they're self-coaching
  if (actualQuality === 0 && recentWorkouts.length >= 5 && typeMismatchRate < 0.5) {
    qualityAdjustment = -1;
    reasons.push('No quality sessions completed recently — reducing to 1/week');
  }

  return {
    mileageAdjustment,
    qualityAdjustment,
    intensityAdjustment,
    reasoning: reasons.length > 0 ? reasons.join('; ') : 'Training tracking well with plan',
  };
}

// ==================== Window Generation ====================

/**
 * Generate detailed daily workouts for a set of macro blocks.
 * Returns a Map of weekNumber → workouts for that week.
 */
export function generateWindowWorkouts(input: WindowGenerationInput): Map<number, PlannedWorkoutDefinition[]> {
  const result = new Map<number, PlannedWorkoutDefinition[]>();

  // Analyze adaptation if we have recent data
  let adaptation: TrainingAdaptation = {
    mileageAdjustment: 1,
    qualityAdjustment: 0,
    intensityAdjustment: 1,
    reasoning: 'No adaptation needed',
  };

  if (input.recentWorkouts && input.recentWorkouts.length > 0) {
    adaptation = analyzeTrainingAdaptation(input.recentWorkouts);
  }

  for (const block of input.blocks) {
    // Apply adaptation adjustments to the macro targets
    const adjustedMileage = Math.round(block.targetMileage * adaptation.mileageAdjustment);
    const adjustedLongRun = Math.round(block.longRunTarget * adaptation.mileageAdjustment);
    const adjustedQuality = Math.max(1, block.qualitySessionsTarget + adaptation.qualityAdjustment);

    const weekStartDate = parseLocalDate(block.startDate);

    const workouts = generateWeekFromBlock(
      weekStartDate,
      block.phase,
      block.weekNumber,
      adjustedMileage,
      adjustedLongRun,
      adjustedQuality,
      block.isDownWeek,
      input
    );

    result.set(block.weekNumber, workouts);
  }

  return result;
}

/**
 * Generate daily workouts for a single week from macro block targets.
 */
function generateWeekFromBlock(
  weekStartDate: Date,
  phase: TrainingPhase,
  weekNumber: number,
  targetMileage: number,
  longRunTarget: number,
  qualitySessions: number,
  isDownWeek: boolean,
  input: WindowGenerationInput
): PlannedWorkoutDefinition[] {
  const workouts: PlannedWorkoutDefinition[] = [];
  const raceDateObj = parseLocalDate(input.raceDate);
  const structure = input.weeklyStructure;
  const paceZones = input.paceZones;

  // Long run miles from macro block (already adjusted)
  const longRunMiles = longRunTarget;

  // Distribute remaining miles across other run days
  const remainingMiles = targetMileage - longRunMiles;
  let runDaysCount = 0;
  for (const day of structure.days) {
    if (day.runType !== 'rest' && day.runType !== 'long') {
      runDaysCount++;
    }
  }

  // Estimate MLR distance (only if preference is on and not a down week)
  const mlrDistance = (input.athleteProfile?.mlrPreference && !isDownWeek && longRunMiles >= 12)
    ? Math.max(Math.min(Math.round(longRunMiles * 0.65), longRunMiles - 2), Math.min(8, longRunMiles - 2))
    : 0;
  const hasMLR = mlrDistance >= 8;

  // Estimate quality run distance and compute easy run distance (capped at 9mi)
  const qualityMilesEstimate = qualitySessions * (remainingMiles / Math.max(1, runDaysCount) + 2);
  const mlrMilesEstimate = hasMLR ? mlrDistance : 0;
  const adjustedRemaining = targetMileage - longRunMiles - qualityMilesEstimate - mlrMilesEstimate;
  const easyDaysCount = runDaysCount - qualitySessions - (hasMLR ? 1 : 0);
  const easyRunMiles = easyDaysCount > 0
    ? Math.min(Math.round(adjustedRemaining / easyDaysCount), 9)
    : Math.min(Math.round(remainingMiles / Math.max(1, runDaysCount)), 9);

  // Week-in-phase estimate (use weekNumber as rough proxy)
  const weekInPhase = Math.max(0, weekNumber - 1);

  let qualitySessionCount = 0;

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayStructure = structure.days[dayIndex];
    const workoutDate = new Date(weekStartDate);
    workoutDate.setDate(workoutDate.getDate() + dayIndex);
    const dateStr = workoutDate.toISOString().split('T')[0];

    // --- Race day check ---
    if (dateStr === input.raceDate) {
      workouts.push({
        date: dateStr,
        dayOfWeek: DAYS_ORDER[dayIndex],
        templateId: 'race',
        workoutType: 'race',
        name: `Race Day: ${input.raceDistanceLabel || 'Goal Race'}`,
        description: 'Goal race! Trust your training and execute your race plan.',
        targetDistanceMiles: input.raceDistanceMeters / 1609.34,
        rationale: 'This is what you\'ve been training for!',
        isKeyWorkout: true,
      });
      continue;
    }

    // --- Days relative to race ---
    if (raceDateObj) {
      const daysUntilRace = Math.floor((raceDateObj.getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));

      if (daysUntilRace === 1) {
        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'shakeout',
          workoutType: 'easy',
          name: 'Pre-Race Shakeout',
          description: 'Optional 2-3 mile easy jog with a few strides. Stay loose and relaxed.',
          targetDistanceMiles: 2,
          targetPaceSecondsPerMile: paceZones?.easy,
          rationale: 'Keep legs fresh while staying loose for tomorrow\'s race.',
          isKeyWorkout: false,
        });
        continue;
      }

      if (daysUntilRace === 2) {
        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'easy_run',
          workoutType: 'easy',
          name: 'Easy Jog',
          description: 'Very easy 2-3 miles to stay loose.',
          targetDistanceMiles: 2.5,
          targetPaceSecondsPerMile: paceZones?.easy,
          rationale: 'Rest and recovery before race day.',
          isKeyWorkout: false,
        });
        continue;
      }

      if (daysUntilRace >= 3 && daysUntilRace <= 5 && DAYS_ORDER[dayIndex] === 'tuesday') {
        const isMarathon = input.raceDistanceMeters >= 40000;
        const isHalf = input.raceDistanceMeters >= 20000;
        const racePace = isMarathon ? paceZones?.marathon : (isHalf ? paceZones?.halfMarathon : paceZones?.tempo);

        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'race_tune_up',
          workoutType: 'tempo',
          name: `Race Pace Tune-Up`,
          description: `Warm up easy, then ${isMarathon ? '2x2mi' : '3x1mi'} at goal race pace. Cool down easy.`,
          targetDistanceMiles: isMarathon ? 8 : 6,
          targetPaceSecondsPerMile: racePace,
          rationale: 'Final sharpening workout to dial in race pace.',
          isKeyWorkout: true,
        });
        continue;
      }

      if (daysUntilRace <= 7 && daysUntilRace > 2) {
        if (dayStructure.runType === 'rest') continue;
        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'easy_run',
          workoutType: 'easy',
          name: 'Easy Run',
          description: 'Short and easy to stay fresh.',
          targetDistanceMiles: Math.min(5, targetMileage / 5),
          targetPaceSecondsPerMile: paceZones?.easy,
          rationale: 'Maintain fitness while prioritizing freshness.',
          isKeyWorkout: false,
        });
        continue;
      }
    }

    // --- Intermediate B/C races ---
    if (input.intermediateRaces && input.intermediateRaces.length > 0) {
      const matchingRace = input.intermediateRaces.find(r => r.date === dateStr);

      if (matchingRace) {
        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'race',
          workoutType: 'race',
          name: `${matchingRace.priority} Race: ${matchingRace.name}`,
          description: 'Tune-up race! Run hard but smart.',
          targetDistanceMiles: matchingRace.distanceMeters / 1609.34,
          rationale: matchingRace.priority === 'B'
            ? 'B race — run hard, treat as quality workout and race simulation.'
            : 'C race — run for fun, good training stimulus.',
          isKeyWorkout: true,
        });
        continue;
      }

      // Mini-taper for B races
      let bRaceHandled = false;
      for (const bRace of input.intermediateRaces.filter(r => r.priority === 'B')) {
        const bRaceDate = parseLocalDate(bRace.date);
        const daysUntilBRace = Math.floor((bRaceDate.getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));

        if (daysUntilBRace === 1) {
          workouts.push({
            date: dateStr,
            dayOfWeek: DAYS_ORDER[dayIndex],
            templateId: 'shakeout',
            workoutType: 'easy',
            name: `Pre-Race Shakeout (${bRace.name})`,
            description: '2-3 miles easy with strides.',
            targetDistanceMiles: 2.5,
            targetPaceSecondsPerMile: paceZones?.easy,
            rationale: 'Light shakeout before tune-up race.',
            isKeyWorkout: false,
          });
          bRaceHandled = true;
          break;
        }

        if (daysUntilBRace === 2) {
          workouts.push({
            date: dateStr,
            dayOfWeek: DAYS_ORDER[dayIndex],
            templateId: 'easy_run',
            workoutType: 'easy',
            name: 'Easy Run',
            description: 'Easy mileage before tune-up race.',
            targetDistanceMiles: 4,
            targetPaceSecondsPerMile: paceZones?.easy,
            rationale: 'Stay fresh for upcoming tune-up race.',
            isKeyWorkout: false,
          });
          bRaceHandled = true;
          break;
        }

        if (daysUntilBRace === -1) {
          workouts.push({
            date: dateStr,
            dayOfWeek: DAYS_ORDER[dayIndex],
            templateId: 'recovery_run',
            workoutType: 'recovery',
            name: 'Post-Race Recovery',
            description: 'Very easy recovery jog or rest.',
            targetDistanceMiles: 3,
            targetPaceSecondsPerMile: paceZones?.recovery || (paceZones?.easy ? paceZones.easy + 30 : undefined),
            rationale: 'Recovery from tune-up race.',
            isKeyWorkout: false,
          });
          bRaceHandled = true;
          break;
        }
      }
      if (bRaceHandled) continue;
    }

    // Skip days after race
    if (raceDateObj && workoutDate > raceDateObj) continue;

    // --- Normal week generation ---
    if (dayStructure.runType === 'rest') continue;

    // --- MLR (Medium-Long Run) ---
    // If athlete prefers MLRs, convert one mid-week easy run into a medium-long run
    // MLR = ~60-70% of long run distance at easy/steady pace
    if (dayStructure.runType === 'easy' && input.athleteProfile?.mlrPreference && !isDownWeek) {
      const isMLRDay = isBestMLRDay(dayIndex, structure, workouts);
      if (isMLRDay) {
        const mlrDistance = Math.round(longRunMiles * 0.65);
        // MLR should be at least 8mi to be meaningful, but not more than the long run
        const effectiveMLR = Math.max(Math.min(mlrDistance, longRunMiles - 2), Math.min(8, longRunMiles - 2));
        if (effectiveMLR >= 8) {
          workouts.push({
            date: dateStr,
            dayOfWeek: DAYS_ORDER[dayIndex],
            templateId: 'medium_long_run',
            workoutType: 'easy',
            name: 'Medium-Long Run',
            description: `Steady ${effectiveMLR} miles at easy to general aerobic pace. Build endurance without the full long run fatigue.`,
            targetDistanceMiles: effectiveMLR,
            targetPaceSecondsPerMile: paceZones?.generalAerobic || paceZones?.easy,
            rationale: 'Mid-week mileage builder at comfortable effort — key for marathon preparation.',
            isKeyWorkout: false,
          });
          continue;
        }
      }
    }

    if (dayStructure.runType === 'long') {
      // Check if too close to a race
      let tooCloseToRace = false;
      if (raceDateObj) {
        const daysToGoal = Math.floor((raceDateObj.getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysToGoal >= 0 && daysToGoal <= 2) tooCloseToRace = true;
      }
      if (input.intermediateRaces) {
        for (const r of input.intermediateRaces) {
          const rDate = parseLocalDate(r.date);
          const daysToR = Math.floor((rDate.getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));
          if (daysToR >= 0 && daysToR <= 2) tooCloseToRace = true;
        }
      }

      if (tooCloseToRace) {
        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'easy_run',
          workoutType: 'easy',
          name: 'Easy Run',
          description: 'Short easy run — race is within 2 days.',
          targetDistanceMiles: 4,
          targetPaceSecondsPerMile: paceZones?.easy,
          rationale: 'Long run replaced due to upcoming race proximity.',
          isKeyWorkout: false,
        });
      } else {
        const longRunType = getLongRunType(phase, weekInPhase, 4, input.raceDistanceMeters);
        const template = findTemplateByType(longRunType, 'long');
        const targetPace = getTemplatePace(template, paceZones) || paceZones?.easy;

        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: template?.id || 'easy_long_run',
          workoutType: 'long',
          name: getWorkoutNameWithPace(template, paceZones),
          description: template?.description || `Long run of ${longRunMiles} miles`,
          targetDistanceMiles: longRunMiles,
          targetPaceSecondsPerMile: targetPace,
          structure: template?.structure,
          rationale: `Building endurance — ${phase} phase long run`,
          isKeyWorkout: true,
          alternatives: getAlternatives('long', phase),
        });
      }
    } else if (dayStructure.runType === 'quality' && qualitySessionCount < qualitySessions) {
      qualitySessionCount++;
      let qualityType = getQualityWorkoutType(phase, weekInPhase, qualitySessionCount, input.raceDistanceMeters);

      // Profile-based adjustments
      if (input.athleteProfile) {
        qualityType = getComfortAdjustedWorkout(qualityType, input.athleteProfile);
        const progression = getExperienceBasedProgression(input.athleteProfile);
        if (progression.startWithFartlek && phase === 'base' && weekInPhase < 2) {
          if (qualityType.includes('interval') || qualityType.includes('tempo')) {
            qualityType = 'classic_fartlek';
          }
        }
        if (progression.delayVO2maxWeeks > weekInPhase && (qualityType.includes('800') || qualityType.includes('400') || qualityType.includes('mile_repeats'))) {
          qualityType = 'cruise_intervals';
        }
      }

      const template = getWorkoutTemplate(qualityType);
      const targetPace = getTemplatePace(template, paceZones);

      workouts.push({
        date: dateStr,
        dayOfWeek: DAYS_ORDER[dayIndex],
        templateId: template?.id || qualityType,
        workoutType: 'quality',
        name: getWorkoutNameWithPace(template, paceZones),
        description: template?.description || 'Quality training session',
        targetDistanceMiles: easyRunMiles + 2,
        targetDurationMinutes: template?.typicalDistanceMilesMax ? Math.round(template.typicalDistanceMilesMax * 8) : 60,
        targetPaceSecondsPerMile: targetPace || getQualityPace(qualityType, paceZones),
        structure: template?.structure,
        rationale: `${phase} phase quality session`,
        isKeyWorkout: true,
        alternatives: getAlternatives('quality', phase),
      });
    } else {
      // Easy run
      const isWeekday = dayIndex < 5;
      const constrainedMiles = getTimeConstrainedDistance(
        easyRunMiles,
        isWeekday,
        input.athleteProfile,
        paceZones?.easy
      );

      workouts.push({
        date: dateStr,
        dayOfWeek: DAYS_ORDER[dayIndex],
        templateId: 'easy_run',
        workoutType: 'easy',
        name: 'Easy Run',
        description: `Easy aerobic run of ${constrainedMiles} miles`,
        targetDistanceMiles: constrainedMiles,
        targetPaceSecondsPerMile: paceZones?.easy,
        rationale: 'Recovery and aerobic maintenance',
        isKeyWorkout: false,
      });
    }
  }

  return workouts;
}

// ==================== Helpers ====================

/**
 * Determine if this day index is the best candidate for a medium-long run.
 * Picks the easy day furthest from the long run day, and only one per week
 * (checks that no MLR has already been added to the workouts array this week).
 */
function isBestMLRDay(
  dayIndex: number,
  structure: ReturnType<typeof createWeeklyStructure>,
  existingWorkouts: PlannedWorkoutDefinition[]
): boolean {
  // Only one MLR per week
  if (existingWorkouts.some(w => w.templateId === 'medium_long_run')) return false;

  // Find the long run day index
  const longRunDayIndex = structure.days.findIndex(d => d.runType === 'long');
  if (longRunDayIndex < 0) return false;

  // Find all easy day indices
  const easyDayIndices = structure.days
    .map((d, i) => d.runType === 'easy' ? i : -1)
    .filter(i => i >= 0);

  if (easyDayIndices.length === 0) return false;

  // Pick the easy day furthest from the long run (wrapping around the week)
  let bestDay = easyDayIndices[0];
  let bestDistance = 0;
  for (const idx of easyDayIndices) {
    const dist = Math.min(Math.abs(idx - longRunDayIndex), 7 - Math.abs(idx - longRunDayIndex));
    if (dist > bestDistance) {
      bestDistance = dist;
      bestDay = idx;
    }
  }

  return dayIndex === bestDay;
}

function findTemplateByType(type: string, category: string) {
  const template = getWorkoutTemplate(type);
  if (template) return template;
  return ALL_WORKOUT_TEMPLATES.find(t => t.category === category);
}

function getTemplatePace(template: ReturnType<typeof getWorkoutTemplate>, paceZones?: PaceZones): number | undefined {
  if (!template?.paceZone || !paceZones) return undefined;
  const zoneMap: Record<string, number | undefined> = {
    easy: paceZones.easy,
    generalAerobic: paceZones.generalAerobic,
    marathon: paceZones.marathon,
    halfMarathon: paceZones.halfMarathon,
    tempo: paceZones.tempo,
    threshold: paceZones.threshold,
    vo2max: paceZones.vo2max,
    interval: paceZones.interval,
  };
  return zoneMap[template.paceZone];
}

function getWorkoutNameWithPace(template: ReturnType<typeof getWorkoutTemplate>, paceZones?: PaceZones): string {
  if (!template) return 'Quality Workout';
  const pace = getTemplatePace(template, paceZones);
  return pace ? `${template.name} @ ${formatPace(pace)}/mi` : template.name;
}

function getQualityPace(workoutType: string, paceZones?: PaceZones): number | undefined {
  if (!paceZones) return undefined;
  if (workoutType.includes('tempo')) return paceZones.tempo;
  if (workoutType.includes('threshold')) return paceZones.threshold;
  if (workoutType.includes('vo2max') || workoutType.includes('interval')) return paceZones.interval;
  if (workoutType.includes('mp') || workoutType.includes('marathon')) return paceZones.marathon;
  if (workoutType.includes('hmp') || workoutType.includes('half_marathon')) return paceZones.halfMarathon;
  return paceZones.tempo;
}

function getAlternatives(workoutType: string, phase: TrainingPhase): string[] {
  if (workoutType === 'long') {
    if (phase === 'base') return ['easy_long_run', 'medium_long_run'];
    if (phase === 'build') return ['progression_long_run', 'easy_long_run'];
    if (phase === 'peak') return ['marathon_pace_long_run', 'alternating_pace_long_run'];
    return ['easy_run'];
  }
  if (workoutType === 'quality') {
    if (phase === 'base') return ['classic_fartlek', 'short_hill_repeats', 'easy_run_strides'];
    if (phase === 'build') return ['steady_tempo', 'cruise_intervals', 'yasso_800s'];
    if (phase === 'peak') return ['progressive_tempo', 'marathon_pace_intervals'];
    return ['easy_run_strides', 'easy_run'];
  }
  return [];
}
