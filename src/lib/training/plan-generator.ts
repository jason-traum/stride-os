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
  AthleteProfile,
  IntermediateRace,
} from './types';
import {
  getPhasePercentages,
  calculatePhaseWeeks,
  calculateMileageProgression,
  createWeeklyStructure,
  getLongRunType,
  getQualityWorkoutType,
  DAYS_ORDER,
  getComfortAdjustedWorkout,
  getExperienceBasedProgression,
  getTimeConstrainedDistance,
} from './plan-rules';
import { getWorkoutTemplate, ALL_WORKOUT_TEMPLATES } from './workout-templates';
import { parseLocalDate } from '@/lib/utils';

// ==================== Main Generator ====================

/**
 * Generate a complete training plan for a race.
 */
export function generateTrainingPlan(input: PlanGenerationInput): GeneratedPlan {
  // Calculate total weeks
  const today = parseLocalDate(input.startDate);
  const raceDate = parseLocalDate(input.raceDate);
  const totalWeeks = Math.floor((raceDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));

  if (totalWeeks < 4) {
    throw new Error('Not enough time for a proper training plan. Need at least 4 weeks.');
  }

  // Get phase distribution
  const phasePercentages = getPhasePercentages(input.raceDistanceMeters, totalWeeks);
  const phaseWeeks = calculatePhaseWeeks(phasePercentages, totalWeeks, input.raceDistanceMeters);

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
  let weekStartDate = parseLocalDate(input.startDate);

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
      input.paceZones,
      input.raceDate,
      input.raceDistanceLabel,
      input.intermediateRaces,
      input.currentLongRunMax,
      input.athleteProfile
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
  paceZones?: PaceZones,
  raceDate?: string,
  raceDistanceLabel?: string,
  intermediateRaces?: IntermediateRace[],
  currentLongRunMax?: number,
  athleteProfile?: AthleteProfile
): PlannedWorkoutDefinition[] {
  const workouts: PlannedWorkoutDefinition[] = [];
  const raceDateObj = raceDate ? new Date(raceDate) : null;

  // Calculate distance distribution
  // Long run caps based on race distance: Marathon = 22mi, Half = 16mi, shorter = 12mi
  const maxLongRun = raceDistanceMeters >= 40000 ? 22 :
                     raceDistanceMeters >= 20000 ? 16 : 12;

  // Calculate long run based on phase and user's current ability
  const longRunPct = phase === 'taper' ? 0.25 : 0.30;
  let longRunMiles = Math.round(targetMileage * longRunPct);

  // Don't regress below user's current long run ability in base/build phases
  // If they can already do 18, don't start them at 11
  if (currentLongRunMax && phase !== 'taper') {
    longRunMiles = Math.max(longRunMiles, Math.min(currentLongRunMax, maxLongRun));
  }

  // Cap at max for the race distance
  longRunMiles = Math.min(longRunMiles, maxLongRun);

  // Apply taper reduction in final weeks
  if (phase === 'taper') {
    // Taper long runs: Week 1 of taper = 60% of max, Week 2 = 40%, Race week = short
    const taperReduction = weekInPhase === 0 ? 0.6 : weekInPhase === 1 ? 0.4 : 0.25;
    longRunMiles = Math.round(maxLongRun * taperReduction);
  }

  const remainingMiles = targetMileage - longRunMiles;

  // Count run days (excluding long run)
  let runDaysCount = 0;
  for (const day of structure.days) {
    if (day.runType !== 'rest' && day.runType !== 'long') {
      runDaysCount++;
    }
  }
  const rawEasyRunMiles = runDaysCount > 0 ? Math.round(remainingMiles / runDaysCount) : 0;

  // Quality sessions for this week
  const qualitySessions = isDownWeek ? Math.max(1, qualitySessionsPerWeek - 1) : qualitySessionsPerWeek;
  let qualitySessionCount = 0;

  // Adjust easy run distance: subtract estimated quality session mileage and cap at 9mi
  const qualityMilesEstimate = qualitySessions * (rawEasyRunMiles + 2);
  const adjustedRemaining = targetMileage - longRunMiles - qualityMilesEstimate;
  const easyDaysCount = runDaysCount - qualitySessions;
  const easyRunMiles = easyDaysCount > 0
    ? Math.min(Math.round(adjustedRemaining / easyDaysCount), 9)
    : rawEasyRunMiles;

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayStructure = structure.days[dayIndex];
    const workoutDate = new Date(weekStartDate);
    workoutDate.setDate(workoutDate.getDate() + dayIndex);
    const dateStr = workoutDate.toISOString().split('T')[0];

    // Check if this is race day
    if (raceDateObj && dateStr === raceDate) {
      workouts.push({
        date: dateStr,
        dayOfWeek: DAYS_ORDER[dayIndex],
        templateId: 'race',
        workoutType: 'race',
        name: `Race Day: ${raceDistanceLabel || 'Goal Race'}`,
        description: 'Goal race! Trust your training and execute your race plan.',
        targetDistanceMiles: raceDistanceMeters ? raceDistanceMeters / 1609.34 : undefined,
        rationale: 'This is what you\'ve been training for!',
        isKeyWorkout: true,
      });
      continue;
    }

    // Check days relative to race for race week structure
    if (raceDateObj) {
      const daysUntilRace = Math.floor((raceDateObj.getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));

      // Day before race: Shakeout only
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

      // 2 days before race: Rest or very easy
      if (daysUntilRace === 2) {
        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'easy_run',
          workoutType: 'easy',
          name: 'Easy Jog',
          description: 'Very easy 2-3 miles to stay loose. Keep it short and relaxed.',
          targetDistanceMiles: 2.5,
          targetPaceSecondsPerMile: paceZones?.easy,
          rationale: 'Rest and recovery before race day.',
          isKeyWorkout: false,
        });
        continue;
      }

      // 3-4 days before race (Tuesday/Wednesday for Sunday race): Race-pace tune-up
      if (daysUntilRace >= 3 && daysUntilRace <= 5 && DAYS_ORDER[dayIndex] === 'tuesday') {
        const isMarathon = raceDistanceMeters && raceDistanceMeters >= 40000;
        const isHalf = raceDistanceMeters && raceDistanceMeters >= 20000;
        const racePace = isMarathon ? paceZones?.marathon : (isHalf ? paceZones?.halfMarathon : paceZones?.tempo);
        const repDistance = isMarathon ? '2 miles' : '1 mile';
        const repCount = isMarathon ? 2 : 3;

        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'race_tune_up',
          workoutType: 'tempo',
          name: `Race Pace Tune-Up: ${repCount}x${repDistance}`,
          description: `Warm up 1-2 miles easy, then ${repCount}x${repDistance} at goal race pace with 2-3 min jog recovery. Cool down easy. Last quality session before the race!`,
          targetDistanceMiles: isMarathon ? 8 : 6,
          targetPaceSecondsPerMile: racePace,
          rationale: 'Final sharpening workout to dial in race pace and build confidence.',
          isKeyWorkout: true,
        });
        continue;
      }

      // Other days in race week (within 7 days): Easy runs only, short
      if (daysUntilRace <= 7 && daysUntilRace > 2) {
        if (dayStructure.runType === 'rest') continue;
        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'easy_run',
          workoutType: 'easy',
          name: 'Easy Run',
          description: 'Short and easy to stay fresh. 3-5 miles at a comfortable pace.',
          targetDistanceMiles: Math.min(5, targetMileage / 5),
          targetPaceSecondsPerMile: paceZones?.easy,
          rationale: 'Maintain fitness while prioritizing freshness for race day.',
          isKeyWorkout: false,
        });
        continue;
      }
    }

    // Check for intermediate B/C races
    if (intermediateRaces && intermediateRaces.length > 0) {
      const matchingRace = intermediateRaces.find(r => r.date === dateStr);

      if (matchingRace) {
        // This is a B/C race day
        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'race',
          workoutType: 'race',
          name: `${matchingRace.priority} Race: ${matchingRace.name}`,
          description: `Tune-up race! Run hard but smart - this is training for your A race.`,
          targetDistanceMiles: matchingRace.distanceMeters / 1609.34,
          rationale: matchingRace.priority === 'B'
            ? 'B race - run hard, treat as quality workout and race simulation.'
            : 'C race - run for fun, no pressure. Good training stimulus.',
          isKeyWorkout: true,
        });
        continue;
      }

      // Check if we're in mini-taper for a B race (2-3 days before)
      let bRaceHandled = false;
      for (const bRace of intermediateRaces.filter(r => r.priority === 'B')) {
        const bRaceDate = parseLocalDate(bRace.date);
        const daysUntilBRace = Math.floor((bRaceDate.getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));

        // Day before B race: easy shakeout
        if (daysUntilBRace === 1) {
          workouts.push({
            date: dateStr,
            dayOfWeek: DAYS_ORDER[dayIndex],
            templateId: 'shakeout',
            workoutType: 'easy',
            name: `Pre-Race Shakeout (${bRace.name})`,
            description: '2-3 miles easy with a few strides. Stay fresh for tomorrow.',
            targetDistanceMiles: 2.5,
            targetPaceSecondsPerMile: paceZones?.easy,
            rationale: 'Light shakeout before tune-up race.',
            isKeyWorkout: false,
          });
          bRaceHandled = true;
          break;
        }

        // 2 days before B race: easy
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

        // Day after B race: recovery
        if (daysUntilBRace === -1) {
          workouts.push({
            date: dateStr,
            dayOfWeek: DAYS_ORDER[dayIndex],
            templateId: 'recovery_run',
            workoutType: 'recovery',
            name: 'Post-Race Recovery',
            description: 'Very easy recovery jog or rest. Listen to your body.',
            targetDistanceMiles: 3,
            targetPaceSecondsPerMile: paceZones?.recovery || (paceZones?.easy ? paceZones.easy + 30 : undefined),
            rationale: 'Recovery from tune-up race effort.',
            isKeyWorkout: false,
          });
          bRaceHandled = true;
          break;
        }
      }
      if (bRaceHandled) continue; // Skip to next day — don't fall through to long/quality/easy
    }

    // Skip any days after race day
    if (raceDateObj && workoutDate > raceDateObj) {
      continue;
    }

    if (dayStructure.runType === 'rest') {
      continue; // Skip rest days
    }

    if (dayStructure.runType === 'long') {
      // Check if long run is too close to any race (within 2 days)
      let tooCloseToRace = false;
      if (raceDateObj) {
        const daysToGoal = Math.floor((raceDateObj.getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysToGoal >= 0 && daysToGoal <= 2) tooCloseToRace = true;
      }
      if (intermediateRaces) {
        for (const r of intermediateRaces) {
          const rDate = parseLocalDate(r.date);
          const daysToR = Math.floor((rDate.getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));
          if (daysToR >= 0 && daysToR <= 2) tooCloseToRace = true;
        }
      }

      if (tooCloseToRace) {
        // Replace with short easy run instead of long run
        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: 'easy_run',
          workoutType: 'easy',
          name: 'Easy Run',
          description: 'Short easy run — race is within 2 days.',
          targetDistanceMiles: 4,
          targetPaceSecondsPerMile: paceZones?.easy,
          rationale: 'Long run replaced with easy run due to upcoming race proximity.',
          isKeyWorkout: false,
        });
      } else {
        // Normal long run
        const longRunType = getLongRunType(phase, weekInPhase, totalPhaseWeeks, raceDistanceMeters);
        const template = findTemplateByType(longRunType, 'long');
        const targetPace = getTemplatePace(template, paceZones) || paceZones?.easy;

        workouts.push({
          date: dateStr,
          dayOfWeek: DAYS_ORDER[dayIndex],
          templateId: template?.id || 'easy_long_run',
          workoutType: 'long',
          name: getWorkoutNameWithPace(template, paceZones),
          description: template?.description || `Easy long run of ${longRunMiles} miles`,
          targetDistanceMiles: longRunMiles,
          targetPaceSecondsPerMile: targetPace,
          structure: template?.structure,
          rationale: getRationale(phase, 'long', weekInPhase, raceDistanceMeters),
          isKeyWorkout: true,
          alternatives: getAlternatives('long', phase),
        });
      }
    } else if (dayStructure.runType === 'quality' && qualitySessionCount < qualitySessions) {
      // Quality workout
      qualitySessionCount++;
      let qualityType = getQualityWorkoutType(
        phase,
        weekInPhase,
        qualitySessionCount,
        raceDistanceMeters
      );

      // Apply profile-based adjustments
      if (athleteProfile) {
        // Adjust based on comfort levels
        qualityType = getComfortAdjustedWorkout(qualityType, athleteProfile);

        // For inexperienced runners, delay VO2max work
        const progression = getExperienceBasedProgression(athleteProfile);
        if (progression.startWithFartlek && phase === 'base' && weekInPhase < 2) {
          // Use fartlek instead of structured work in early base
          if (qualityType.includes('interval') || qualityType.includes('tempo')) {
            qualityType = 'classic_fartlek';
          }
        }
        if (progression.delayVO2maxWeeks > weekInPhase && qualityType.includes('800') || qualityType.includes('400') || qualityType.includes('mile_repeats')) {
          // Substitute with threshold work
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
        targetDistanceMiles: easyRunMiles + 2, // Quality runs tend to be slightly longer
        targetDurationMinutes: template?.typicalDistanceMilesMax ? template.typicalDistanceMilesMax * 8 : 60,
        targetPaceSecondsPerMile: targetPace || getQualityPace(qualityType, paceZones),
        structure: template?.structure,
        rationale: getRationale(phase, 'quality', weekInPhase, raceDistanceMeters),
        isKeyWorkout: true,
        alternatives: getAlternatives('quality', phase),
      });
    } else {
      // Easy run - apply time constraints if profile available
      const isWeekday = dayIndex < 5; // Mon-Fri
      const constrainedMiles = getTimeConstrainedDistance(
        easyRunMiles,
        isWeekday,
        athleteProfile,
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

/**
 * Format pace in seconds per mile to a readable string (e.g., "7:15/mi")
 */
function formatPace(paceSeconds: number): string {
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
}

/**
 * Get the appropriate pace for a template based on its paceZone
 */
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

/**
 * Generate a descriptive workout name with target pace if available
 */
function getWorkoutNameWithPace(
  template: ReturnType<typeof getWorkoutTemplate>,
  paceZones?: PaceZones
): string {
  if (!template) return 'Quality Workout';

  const baseName = template.name;
  const pace = getTemplatePace(template, paceZones);

  if (pace) {
    return `${baseName} @ ${formatPace(pace)}`;
  }

  return baseName;
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

// ==================== Profile-Aware Workout Selection ====================

/**
 * Substitution map for workout types based on comfort level.
 * If comfort level is below 3, substitute with an easier workout.
 */
const WORKOUT_SUBSTITUTIONS: Record<string, string> = {
  // VO2max substitutions (if comfortVO2max < 3)
  'yasso_800s': 'cruise_intervals',
  'short_intervals_400m': 'structured_fartlek',
  'long_intervals_1000m': 'steady_tempo',
  'mile_repeats': 'cruise_intervals',
  'ladder_workout': 'classic_fartlek',

  // Hill substitutions (if comfortHills < 3)
  'short_hill_repeats': 'classic_fartlek',
  'long_hill_repeats': 'steady_tempo',

  // Tempo substitutions (if comfortTempo < 3)
  'steady_tempo': 'classic_fartlek',
  'progressive_tempo': 'structured_fartlek',
  'cruise_intervals': 'structured_fartlek',
};

/**
 * Get a profile-adjusted workout type based on athlete comfort levels.
 */
export function getProfileAdjustedWorkoutType(
  originalType: string,
  profile?: AthleteProfile
): string {
  if (!profile) return originalType;

  // Check VO2max comfort
  if (profile.comfortVO2max !== undefined && profile.comfortVO2max < 3) {
    if (originalType.includes('800') || originalType.includes('400') ||
        originalType.includes('1000') || originalType.includes('mile_repeats') ||
        originalType.includes('ladder')) {
      return WORKOUT_SUBSTITUTIONS[originalType] || 'steady_tempo';
    }
  }

  // Check hills comfort
  if (profile.comfortHills !== undefined && profile.comfortHills < 3) {
    if (originalType.includes('hill')) {
      return WORKOUT_SUBSTITUTIONS[originalType] || 'classic_fartlek';
    }
  }

  // Check tempo comfort
  if (profile.comfortTempo !== undefined && profile.comfortTempo < 3) {
    if (originalType.includes('tempo') || originalType.includes('cruise')) {
      return WORKOUT_SUBSTITUTIONS[originalType] || 'classic_fartlek';
    }
  }

  return originalType;
}

/**
 * Adjust mileage caps based on athlete experience.
 */
export function getExperienceAdjustedMileage(
  targetMileage: number,
  profile?: AthleteProfile
): number {
  if (!profile) return targetMileage;

  // Cap based on historical mileage
  if (profile.highestWeeklyMileageEver) {
    // Don't exceed 120% of historical peak
    const historicalCap = profile.highestWeeklyMileageEver * 1.2;
    targetMileage = Math.min(targetMileage, historicalCap);
  }

  // Reduce if new to running
  if (profile.yearsRunning !== undefined && profile.yearsRunning < 2) {
    // Conservative approach for newer runners
    targetMileage = Math.min(targetMileage, 45);
  }

  // Reduce if speedwork beginner
  if (profile.speedworkExperience === 'none') {
    targetMileage = Math.min(targetMileage, 40);
  }

  return Math.round(targetMileage);
}

/**
 * Determine if workout should be scaled down based on recovery needs.
 */
export function getRecoveryAdjustmentFactor(profile?: AthleteProfile): number {
  if (!profile) return 1.0;

  let factor = 1.0;

  // Reduce intensity if high stress
  if (profile.stressLevel === 'very_high') {
    factor *= 0.85;
  } else if (profile.stressLevel === 'high') {
    factor *= 0.92;
  }

  // Reduce if needs extra rest
  if (profile.needsExtraRest) {
    factor *= 0.90;
  }

  return factor;
}

/**
 * Cap workout duration based on time availability.
 */
export function getTimeConstrainedDuration(
  targetMinutes: number,
  isWeekend: boolean,
  profile?: AthleteProfile
): number {
  if (!profile) return targetMinutes;

  const availability = isWeekend
    ? profile.weekendAvailabilityMinutes
    : profile.weekdayAvailabilityMinutes;

  if (availability && targetMinutes > availability) {
    return availability;
  }

  return targetMinutes;
}

/**
 * Check if athlete should introduce speedwork gradually.
 */
export function needsGradualSpeedworkIntro(profile?: AthleteProfile): boolean {
  if (!profile) return false;

  return profile.speedworkExperience === 'none' ||
         (profile.yearsRunning !== undefined && profile.yearsRunning < 1);
}

/**
 * Get injury-aware workout modifications.
 */
export function getInjuryAwareModifications(
  workoutType: string,
  profile?: AthleteProfile
): { substitute?: string; addRest?: boolean } {
  if (!profile?.commonInjuries || profile.commonInjuries.length === 0) {
    return {};
  }

  const injuries = profile.commonInjuries;

  // Shin splints - reduce high-impact work
  if (injuries.includes('shin_splints')) {
    if (workoutType.includes('interval') || workoutType.includes('400')) {
      return { addRest: true }; // Add extra recovery between hard days
    }
  }

  // Achilles - be careful with hills and speed
  if (injuries.includes('achilles')) {
    if (workoutType.includes('hill')) {
      return { substitute: 'classic_fartlek' };
    }
  }

  // Plantar fasciitis - avoid excessive long run build-up
  if (injuries.includes('plantar_fasciitis')) {
    // Just flag for awareness, don't substitute
    return { addRest: true };
  }

  return {};
}
