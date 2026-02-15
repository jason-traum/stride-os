'use server';

import { db, races, trainingBlocks, plannedWorkouts, PlannedWorkout, userSettings, workouts } from '@/lib/db';
import { eq, asc, and, gte, lte, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { generateTrainingPlan, generateMacroPlan } from '@/lib/training/plan-generator';
import type { MacroPlanBlock, MacroPlan } from '@/lib/training/plan-generator';
import { generateWindowWorkouts } from '@/lib/training/window-generator';
import type { CompletedWorkoutSummary } from '@/lib/training/window-generator';
import { calculatePaceZones } from '@/lib/training/vdot-calculator';
import { createWeeklyStructure } from '@/lib/training/plan-rules';
import type { PlanGenerationInput, GeneratedPlan } from '@/lib/training/types';
import type { Race } from '@/lib/schema';
import { parseLocalDate } from '@/lib/utils';
import { assessCurrentFitness, formatFitnessAssessment } from '@/lib/training/fitness-assessment';
import { getActiveProfileId } from '@/lib/profile-server';

// ==================== Plan Generation ====================

/**
 * Extended plan type that includes fitness assessment
 */
export interface GeneratedPlanWithFitness extends GeneratedPlan {
  fitnessAssessment: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fitnessData: any;
}

/**
 * Generate a training plan for a race.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generatePlanForRace(_raceId: number): Promise<GeneratedPlanWithFitness> {
  // Get race details
  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!race) {
    throw new Error('Race not found');
  }

  // Get profile ID
  const profileId = await getActiveProfileId();
  if (!profileId) {
    throw new Error('No active profile found.');
  }

  // Get user settings first (for fallback and preferences)
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId)
  });
  if (!settings) {
    throw new Error('User settings not found. Please complete onboarding first.');
  }

  // Assess current fitness from actual workout history
  const fitness = await assessCurrentFitness(profileId);

  // If no workout history, use settings as fallback
  if (fitness.totalRuns === 0 || fitness.typicalWeeklyMileage === 0) {
    if (!settings.currentWeeklyMileage) {
      throw new Error('No training history found. Please set your current weekly mileage in settings or log some workouts first.');
    }
    // Update fitness data with settings
    fitness.currentAvgMileage = settings.currentWeeklyMileage;
    fitness.currentMedianMileage = settings.currentWeeklyMileage;
    fitness.typicalWeeklyMileage = settings.currentWeeklyMileage;
    fitness.suggestedPeakMileage = settings.peakWeeklyMileageTarget || Math.round(settings.currentWeeklyMileage * 1.3);
    fitness.runsPerWeek = settings.runsPerWeekCurrent || 4;
    fitness.avgLongRun = settings.currentLongRunMax || Math.round(settings.currentWeeklyMileage * 0.3);
    fitness.confidenceLevel = 'low';
  }

  // Log the fitness assessment for debugging
  console.log('Fitness Assessment:', fitness);
  console.log(formatFitnessAssessment(fitness));

  // Fetch ALL races to determine start date and incorporate B/C races
  const allRaces = await db.query.races.findMany({
    orderBy: asc(races.date),
  });

  // Find the correct start date:
  // - If there's an A race before this one, start after that race (+ 2 weeks recovery)
  // - Otherwise start from today
  const targetRaceDate = parseLocalDate(race.date);
  const today = new Date();
  let planStartDate = today;

  // Find prior A races (races before this one with priority 'A')
  const priorARaces = allRaces.filter((r: Race) => {
    const rDate = parseLocalDate(r.date);
    return r.priority === 'A' && rDate < targetRaceDate && r.id !== race.id;
  });

  if (priorARaces.length > 0) {
    // Start 2 weeks after the most recent prior A race
    const lastPriorARace = priorARaces[priorARaces.length - 1];
    const recoveryStart = parseLocalDate(lastPriorARace.date);
    recoveryStart.setDate(recoveryStart.getDate() + 14); // 2 weeks recovery

    // Use the later of: recovery start or today
    if (recoveryStart > today) {
      planStartDate = recoveryStart;
    }
  }

  // Find B/C races that fall within the plan timeframe
  const intermediateRaces = allRaces.filter((r: Race) => {
    const rDate = parseLocalDate(r.date);
    return (r.priority === 'B' || r.priority === 'C') &&
           rDate > planStartDate &&
           rDate < targetRaceDate &&
           r.id !== race.id;
  }).map((r: Race) => ({
    id: r.id,
    name: r.name,
    date: r.date,
    distanceMeters: r.distanceMeters,
    distanceLabel: r.distanceLabel,
    priority: r.priority as 'B' | 'C',
  }));

  // Build plan generation input
  const paceZones = settings.vdot ? calculatePaceZones(settings.vdot) : undefined;

  // Build athlete profile from extended settings
  const athleteProfile = {
    comfortVO2max: settings.comfortVO2max ?? undefined,
    comfortTempo: settings.comfortTempo ?? undefined,
    comfortHills: settings.comfortHills ?? undefined,
    comfortLongRuns: settings.comfortLongRuns ?? undefined,
    comfortTrackWork: settings.comfortTrackWork ?? undefined,
    yearsRunning: settings.yearsRunning ?? undefined,
    speedworkExperience: settings.speedworkExperience as 'none' | 'beginner' | 'intermediate' | 'advanced' | undefined,
    highestWeeklyMileageEver: settings.highestWeeklyMileageEver ?? undefined,
    needsExtraRest: settings.needsExtraRest ?? undefined,
    stressLevel: settings.stressLevel as 'low' | 'moderate' | 'high' | 'very_high' | undefined,
    commonInjuries: settings.commonInjuries ? JSON.parse(settings.commonInjuries) : undefined,
    weekdayAvailabilityMinutes: settings.weekdayAvailabilityMinutes ?? undefined,
    weekendAvailabilityMinutes: settings.weekendAvailabilityMinutes ?? undefined,
    trainBy: settings.trainBy as 'pace' | 'heart_rate' | 'feel' | 'mixed' | undefined,
    heatSensitivity: settings.heatSensitivity ?? undefined,
  };

  const input: PlanGenerationInput = {
    // User settings are primary source (explicitly set by user), fitness assessment is fallback
    currentWeeklyMileage: settings.currentWeeklyMileage || fitness.typicalWeeklyMileage || 20,
    peakWeeklyMileageTarget: settings.peakWeeklyMileageTarget || fitness.suggestedPeakMileage || Math.round((settings.currentWeeklyMileage || fitness.typicalWeeklyMileage || 20) * 1.3),
    currentLongRunMax: settings.currentLongRunMax || fitness.avgLongRun || undefined,
    runsPerWeek: settings.runsPerWeekTarget || settings.runsPerWeekCurrent || Math.round(fitness.runsPerWeek) || 5,
    preferredLongRunDay: settings.preferredLongRunDay || 'sunday',
    preferredQualityDays: settings.preferredQualityDays
      ? JSON.parse(settings.preferredQualityDays)
      : ['tuesday', 'thursday'],
    requiredRestDays: settings.requiredRestDays
      ? JSON.parse(settings.requiredRestDays)
      : [],
    planAggressiveness: settings.planAggressiveness || 'moderate',
    qualitySessionsPerWeek: settings.qualitySessionsPerWeek || 2,
    raceId: race.id,
    raceDate: race.date,
    raceDistanceMeters: race.distanceMeters,
    raceDistanceLabel: race.distanceLabel,
    vdot: settings.vdot ?? undefined,
    paceZones,
    startDate: planStartDate.toISOString().split('T')[0],
    intermediateRaces, // B/C races to incorporate
    athleteProfile, // Extended profile for intelligent workout selection
  };

  // Generate the plan
  const plan = generateTrainingPlan(input);
  plan.raceName = race.name;

  // Save to database
  await savePlanToDatabase(plan, race.id);

  // Mark race as having a training plan
  await db.update(races)
    .set({ trainingPlanGenerated: true, updatedAt: new Date().toISOString() })
    .where(eq(races.id, raceId));

  revalidatePath('/plan');
  revalidatePath('/races');
  revalidatePath('/today');

  // Return plan with fitness assessment
  return {
    ...plan,
    fitnessAssessment: formatFitnessAssessment(fitness),
    fitnessData: fitness
  };
}

/**
 * Save generated plan to database.
 */
async function savePlanToDatabase(plan: GeneratedPlan, raceId: number) {
  const now = new Date().toISOString();

  // Delete existing training blocks and planned workouts for this race
  const existingBlocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, raceId),
  });

  for (const block of existingBlocks) {
    await db.delete(plannedWorkouts).where(eq(plannedWorkouts.trainingBlockId, block.id));
  }

  await db.delete(trainingBlocks).where(eq(trainingBlocks.raceId, raceId));

  // BATCH insert all training blocks at once
  const blockValues = [];
  for (const phase of plan.phases) {
    const phaseWeeks = plan.weeks.filter(w => w.phase === phase.phase);
    for (const week of phaseWeeks) {
      blockValues.push({
        raceId,
        name: `${phase.phase.charAt(0).toUpperCase() + phase.phase.slice(1)} - Week ${week.weekNumber}`,
        phase: phase.phase,
        startDate: week.startDate,
        endDate: week.endDate,
        weekNumber: week.weekNumber,
        targetMileage: week.targetMileage,
        focus: week.focus,
        createdAt: now,
      });
    }
  }

  const insertedBlocks = await db.insert(trainingBlocks).values(blockValues).returning();

  // Build a lookup: phase+weekNumber → blockId
  const blockLookup = new Map<string, number>();
  for (const block of insertedBlocks) {
    blockLookup.set(`${block.phase}-${block.weekNumber}`, block.id);
  }

  // Map plan workout types to schema workout types
  const workoutTypeMap: Record<string, 'easy' | 'steady' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery' | 'cross_train' | 'other'> = {
    'easy': 'easy',
    'long': 'long',
    'quality': 'tempo',
    'rest': 'recovery',
    'tempo': 'tempo',
    'threshold': 'tempo',
    'interval': 'interval',
    'race': 'race',
  };

  // BATCH insert all planned workouts at once
  const workoutValues = [];
  for (const week of plan.weeks) {
    const blockId = blockLookup.get(`${week.phase}-${week.weekNumber}`);
    if (!blockId) continue;

    for (const workout of week.workouts) {
      workoutValues.push({
        raceId,
        trainingBlockId: blockId,
        date: workout.date,
        templateId: null,
        workoutType: workoutTypeMap[workout.workoutType] || 'other',
        name: workout.name,
        description: workout.description,
        targetDistanceMiles: workout.targetDistanceMiles ?? null,
        targetDurationMinutes: workout.targetDurationMinutes ?? null,
        targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile ?? null,
        structure: workout.structure ? JSON.stringify(workout.structure) : null,
        rationale: workout.rationale,
        isKeyWorkout: workout.isKeyWorkout,
        alternatives: workout.alternatives ? JSON.stringify(workout.alternatives) : null,
        status: 'scheduled' as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (workoutValues.length > 0) {
    await db.insert(plannedWorkouts).values(workoutValues);
  }
}

// ==================== Macro Plan + Window Generation ====================

/**
 * Extended plan result that includes macro plan + fitness info.
 */
export interface MacroPlanResult extends MacroPlan {
  fitnessAssessment: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fitnessData: any;
}

/**
 * Generate a macro plan (roadmap) for a race, then generate the first 3 weeks of workouts.
 * Replaces generatePlanForRace() for new plans.
 */
export async function generateMacroPlanForRace(raceId: number): Promise<MacroPlanResult> {
  const race = await db.query.races.findFirst({ where: eq(races.id, raceId) });
  if (!race) throw new Error('Race not found');

  const profileId = await getActiveProfileId();
  if (!profileId) throw new Error('No active profile found.');

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId)
  });
  if (!settings) throw new Error('User settings not found. Please complete onboarding first.');

  // Supplementary fitness assessment
  const fitness = await assessCurrentFitness(profileId);
  if (fitness.totalRuns === 0 || fitness.typicalWeeklyMileage === 0) {
    if (!settings.currentWeeklyMileage) {
      throw new Error('No training history found. Please set your current weekly mileage in settings or log some workouts first.');
    }
    fitness.currentAvgMileage = settings.currentWeeklyMileage;
    fitness.currentMedianMileage = settings.currentWeeklyMileage;
    fitness.typicalWeeklyMileage = settings.currentWeeklyMileage;
    fitness.suggestedPeakMileage = settings.peakWeeklyMileageTarget || Math.round(settings.currentWeeklyMileage * 1.3);
    fitness.runsPerWeek = settings.runsPerWeekCurrent || 4;
    fitness.avgLongRun = settings.currentLongRunMax || Math.round(settings.currentWeeklyMileage * 0.3);
    fitness.confidenceLevel = 'low';
  }

  // Determine plan start date (same logic as generatePlanForRace)
  const allRaces = await db.query.races.findMany({ orderBy: asc(races.date) });
  const targetRaceDate = parseLocalDate(race.date);
  const today = new Date();
  let planStartDate = today;

  const priorARaces = allRaces.filter((r: Race) => {
    const rDate = parseLocalDate(r.date);
    return r.priority === 'A' && rDate < targetRaceDate && r.id !== race.id;
  });

  if (priorARaces.length > 0) {
    const lastPriorARace = priorARaces[priorARaces.length - 1];
    const recoveryStart = parseLocalDate(lastPriorARace.date);
    recoveryStart.setDate(recoveryStart.getDate() + 14);
    if (recoveryStart > today) planStartDate = recoveryStart;
  }

  // Find intermediate B/C races
  const intermediateRaces = allRaces.filter((r: Race) => {
    const rDate = parseLocalDate(r.date);
    return (r.priority === 'B' || r.priority === 'C') &&
           rDate > planStartDate && rDate < targetRaceDate && r.id !== race.id;
  }).map((r: Race) => ({
    id: r.id, name: r.name, date: r.date,
    distanceMeters: r.distanceMeters, distanceLabel: r.distanceLabel,
    priority: r.priority as 'B' | 'C',
  }));

  // Settings are primary source, fitness is fallback (use ?? not ||)
  const input: PlanGenerationInput = {
    currentWeeklyMileage: settings.currentWeeklyMileage ?? fitness.typicalWeeklyMileage ?? 20,
    peakWeeklyMileageTarget: settings.peakWeeklyMileageTarget ?? fitness.suggestedPeakMileage ?? Math.round((settings.currentWeeklyMileage ?? fitness.typicalWeeklyMileage ?? 20) * 1.3),
    currentLongRunMax: settings.currentLongRunMax ?? fitness.avgLongRun ?? undefined,
    runsPerWeek: (settings.runsPerWeekTarget ?? settings.runsPerWeekCurrent ?? Math.round(fitness.runsPerWeek)) || 5,
    preferredLongRunDay: settings.preferredLongRunDay || 'sunday',
    preferredQualityDays: settings.preferredQualityDays ? JSON.parse(settings.preferredQualityDays) : ['tuesday', 'thursday'],
    requiredRestDays: settings.requiredRestDays ? JSON.parse(settings.requiredRestDays) : [],
    planAggressiveness: settings.planAggressiveness || 'moderate',
    qualitySessionsPerWeek: settings.qualitySessionsPerWeek ?? 2,
    raceId: race.id,
    raceDate: race.date,
    raceDistanceMeters: race.distanceMeters,
    raceDistanceLabel: race.distanceLabel,
    vdot: settings.vdot ?? undefined,
    paceZones: settings.vdot ? calculatePaceZones(settings.vdot) : undefined,
    startDate: planStartDate.toISOString().split('T')[0],
    intermediateRaces,
    athleteProfile: buildAthleteProfile(settings),
  };

  // Generate macro plan
  const macroPlan = generateMacroPlan(input);
  macroPlan.raceName = race.name;

  // Save macro plan blocks to database (no workouts yet)
  await saveMacroPlanToDatabase(macroPlan, race.id);

  // Mark race as having a training plan
  await db.update(races)
    .set({ trainingPlanGenerated: true, updatedAt: new Date().toISOString() })
    .where(eq(races.id, raceId));

  // Generate first 3 weeks of workouts
  await generateWindowForRace(raceId, 1);

  revalidatePath('/plan');
  revalidatePath('/races');
  revalidatePath('/today');

  return {
    ...macroPlan,
    fitnessAssessment: formatFitnessAssessment(fitness),
    fitnessData: fitness,
  };
}

/**
 * Build athlete profile from settings.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAthleteProfile(settings: any) {
  return {
    comfortVO2max: settings.comfortVO2max ?? undefined,
    comfortTempo: settings.comfortTempo ?? undefined,
    comfortHills: settings.comfortHills ?? undefined,
    comfortLongRuns: settings.comfortLongRuns ?? undefined,
    comfortTrackWork: settings.comfortTrackWork ?? undefined,
    yearsRunning: settings.yearsRunning ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    speedworkExperience: settings.speedworkExperience as any,
    highestWeeklyMileageEver: settings.highestWeeklyMileageEver ?? undefined,
    needsExtraRest: settings.needsExtraRest ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stressLevel: settings.stressLevel as any,
    commonInjuries: settings.commonInjuries ? JSON.parse(settings.commonInjuries) : undefined,
    weekdayAvailabilityMinutes: settings.weekdayAvailabilityMinutes ?? undefined,
    weekendAvailabilityMinutes: settings.weekendAvailabilityMinutes ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trainBy: settings.trainBy as any,
    heatSensitivity: settings.heatSensitivity ?? undefined,
    mlrPreference: settings.mlrPreference ?? undefined,
    progressiveLongRunsOk: settings.progressiveLongRunsOk ?? undefined,
  };
}

/**
 * Save macro plan blocks to database (without planned workouts).
 */
async function saveMacroPlanToDatabase(plan: MacroPlan, raceId: number) {
  const now = new Date().toISOString();

  // Delete existing blocks and workouts for this race
  const existingBlocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, raceId),
  });
  for (const block of existingBlocks) {
    await db.delete(plannedWorkouts).where(eq(plannedWorkouts.trainingBlockId, block.id));
  }
  await db.delete(trainingBlocks).where(eq(trainingBlocks.raceId, raceId));

  // Batch insert all macro blocks
  const blockValues = plan.blocks.map(block => ({
    raceId,
    name: `${block.phase.charAt(0).toUpperCase() + block.phase.slice(1)} - Week ${block.weekNumber}`,
    phase: block.phase,
    startDate: block.startDate,
    endDate: block.endDate,
    weekNumber: block.weekNumber,
    targetMileage: block.targetMileage,
    longRunTarget: block.longRunTarget,
    qualitySessionsTarget: block.qualitySessionsTarget,
    isDownWeek: block.isDownWeek,
    focus: block.focus,
    createdAt: now,
  }));

  await db.insert(trainingBlocks).values(blockValues);
}

/**
 * Generate detailed workouts for the next 3 weeks that don't have workouts yet.
 */
export async function generateWindowForRace(raceId: number, startWeek?: number): Promise<void> {
  const race = await db.query.races.findFirst({ where: eq(races.id, raceId) });
  if (!race) throw new Error('Race not found');

  const profileId = await getActiveProfileId();
  if (!profileId) throw new Error('No active profile found.');

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId)
  });
  if (!settings) return;

  // Get all training blocks for this race
  const allBlocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, raceId),
    orderBy: [asc(trainingBlocks.weekNumber)],
  });

  if (allBlocks.length === 0) return;

  // Find blocks that need workouts generated
  let blocksNeedingWorkouts: typeof allBlocks;

  if (startWeek) {
    // Start from specific week, take 3
    blocksNeedingWorkouts = allBlocks.filter(b => b.weekNumber >= startWeek).slice(0, 3);
  } else {
    // Find blocks without planned workouts
    const blocksWithoutWorkouts: typeof allBlocks = [];
    for (const block of allBlocks) {
      const workoutCount = await db.query.plannedWorkouts.findFirst({
        where: eq(plannedWorkouts.trainingBlockId, block.id),
      });
      if (!workoutCount) {
        blocksWithoutWorkouts.push(block);
        if (blocksWithoutWorkouts.length >= 3) break;
      }
    }
    blocksNeedingWorkouts = blocksWithoutWorkouts;
  }

  if (blocksNeedingWorkouts.length === 0) return;

  // Build macro block structures for the window generator
  const macroblocks: MacroPlanBlock[] = blocksNeedingWorkouts.map(b => ({
    weekNumber: b.weekNumber,
    startDate: b.startDate,
    endDate: b.endDate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    phase: b.phase as any,
    targetMileage: b.targetMileage || 0,
    longRunTarget: b.longRunTarget || Math.round((b.targetMileage || 0) * 0.3),
    qualitySessionsTarget: b.qualitySessionsTarget ?? 2,
    isDownWeek: b.isDownWeek || false,
    focus: b.focus || '',
  }));

  // Get recent completed workouts for adaptation analysis
  const threeWeeksAgo = new Date();
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
  const threeWeeksAgoStr = threeWeeksAgo.toISOString().split('T')[0];

  const recentWorkoutRows = await db.query.workouts.findMany({
    where: and(
      eq(workouts.profileId, profileId),
      gte(workouts.date, threeWeeksAgoStr)
    ),
    orderBy: [desc(workouts.date)],
  });

  // Match actual workouts to planned workouts for adaptation analysis
  const recentWorkoutSummaries: CompletedWorkoutSummary[] = [];
  for (const w of recentWorkoutRows) {
    let plannedType: string | undefined;
    let plannedDistance: number | undefined;
    let wasPlanned = false;

    if (w.plannedWorkoutId) {
      const planned = await db.query.plannedWorkouts.findFirst({
        where: eq(plannedWorkouts.id, w.plannedWorkoutId),
      });
      if (planned) {
        plannedType = planned.workoutType;
        plannedDistance = planned.targetDistanceMiles ?? undefined;
        wasPlanned = true;
      }
    }

    recentWorkoutSummaries.push({
      date: w.date,
      workoutType: w.workoutType,
      distanceMiles: w.distanceMiles || 0,
      durationMinutes: w.durationMinutes ?? undefined,
      avgPaceSeconds: w.avgPaceSeconds ?? undefined,
      plannedType,
      plannedDistance,
      wasPlanned,
    });
  }

  // Get RPE from assessments if available
  for (const summary of recentWorkoutSummaries) {
    const workout = recentWorkoutRows.find(w => w.date === summary.date);
    if (workout) {
      const assessment = await db.query.assessments?.findFirst({
        where: eq((await import('@/lib/db')).assessments.workoutId, workout.id),
      }).catch(() => null);
      if (assessment) {
        summary.rpe = assessment.rpe;
      }
    }
  }

  // Get B/C races in window timeframe
  const allRaces = await db.query.races.findMany({ orderBy: asc(races.date) });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _raceDate = parseLocalDate(race.date);
  const windowStart = parseLocalDate(macroblocks[0].startDate);
  const windowEnd = parseLocalDate(macroblocks[macroblocks.length - 1].endDate);

  const intermediateRaces = allRaces.filter((r: Race) => {
    const rDate = parseLocalDate(r.date);
    return (r.priority === 'B' || r.priority === 'C') &&
           rDate >= windowStart && rDate <= windowEnd && r.id !== race.id;
  }).map((r: Race) => ({
    id: r.id, name: r.name, date: r.date,
    distanceMeters: r.distanceMeters, distanceLabel: r.distanceLabel,
    priority: r.priority as 'B' | 'C',
  }));

  // Build weekly structure
  const weeklyStructure = createWeeklyStructure(
    settings.runsPerWeekTarget || settings.runsPerWeekCurrent || 5,
    settings.preferredLongRunDay || 'sunday',
    settings.preferredQualityDays ? JSON.parse(settings.preferredQualityDays) : ['tuesday', 'thursday'],
    settings.requiredRestDays ? JSON.parse(settings.requiredRestDays) : [],
    settings.qualitySessionsPerWeek ?? 2
  );

  const paceZones = settings.vdot ? calculatePaceZones(settings.vdot) : undefined;

  // Generate workouts
  const windowResult = generateWindowWorkouts({
    blocks: macroblocks,
    raceDate: race.date,
    raceDistanceMeters: race.distanceMeters,
    raceDistanceLabel: race.distanceLabel,
    weeklyStructure,
    paceZones,
    athleteProfile: buildAthleteProfile(settings),
    intermediateRaces,
    recentWorkouts: recentWorkoutSummaries,
    qualitySessionsPerWeek: settings.qualitySessionsPerWeek ?? 2,
  });

  // Save workouts to database
  const now = new Date().toISOString();
  const workoutTypeMap: Record<string, 'easy' | 'steady' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery' | 'cross_train' | 'other'> = {
    'easy': 'easy', 'long': 'long', 'quality': 'tempo', 'rest': 'recovery',
    'tempo': 'tempo', 'threshold': 'tempo', 'interval': 'interval', 'race': 'race',
  };

  for (const block of blocksNeedingWorkouts) {
    const weekWorkouts = windowResult.get(block.weekNumber);
    if (!weekWorkouts || weekWorkouts.length === 0) continue;

    const workoutValues = weekWorkouts.map(workout => ({
      raceId,
      trainingBlockId: block.id,
      date: workout.date,
      templateId: null,
      workoutType: workoutTypeMap[workout.workoutType] || 'other',
      name: workout.name,
      description: workout.description,
      targetDistanceMiles: workout.targetDistanceMiles ?? null,
      targetDurationMinutes: workout.targetDurationMinutes ?? null,
      targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile ?? null,
      structure: workout.structure ? JSON.stringify(workout.structure) : null,
      rationale: workout.rationale,
      isKeyWorkout: workout.isKeyWorkout,
      alternatives: workout.alternatives ? JSON.stringify(workout.alternatives) : null,
      status: 'scheduled' as const,
      createdAt: now,
      updatedAt: now,
    }));

    if (workoutValues.length > 0) {
      await db.insert(plannedWorkouts).values(workoutValues);
    }
  }

  revalidatePath('/plan');
  revalidatePath('/today');
}

/**
 * Auto-extend window if current week has a training block but no planned workouts.
 * Called by getCurrentWeekPlan() and getTodaysWorkout().
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function extendWindowIfNeeded(raceId?: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Find current training block
  const currentBlock = await db.query.trainingBlocks.findFirst({
    where: and(
      lte(trainingBlocks.startDate, today),
      gte(trainingBlocks.endDate, today)
    ),
  });

  if (!currentBlock || !currentBlock.raceId) return;

  // Check if this block has workouts
  const existingWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.trainingBlockId, currentBlock.id),
  });

  if (existingWorkout) return; // Already has workouts

  // Generate workouts for this block and the next 2
  await generateWindowForRace(currentBlock.raceId, currentBlock.weekNumber);
}

// ==================== Plan Retrieval ====================

/**
 * Get the training plan for a race.
 */
export async function getTrainingPlan(raceId: number) {
  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!race) {
    return null;
  }

  const blocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, raceId),
    orderBy: [asc(trainingBlocks.startDate)],
  });

  // Get all planned workouts for each block
  const workoutsByBlock: Record<number, typeof plannedWorkouts.$inferSelect[]> = {};

  for (const block of blocks) {
    const blockWorkouts = await db.query.plannedWorkouts.findMany({
      where: eq(plannedWorkouts.trainingBlockId, block.id),
      orderBy: [asc(plannedWorkouts.date)],
    });
    workoutsByBlock[block.id] = blockWorkouts;
  }

  return {
    race,
    blocks,
    workoutsByBlock,
  };
}

/**
 * Get the current week's plan.
 */
export async function getCurrentWeekPlan() {
  // Auto-extend window if needed
  await extendWindowIfNeeded();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get the Monday of this week
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - daysToMonday);
  const mondayStr = monday.toISOString().split('T')[0];

  // Get the Sunday of this week
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const sundayStr = sunday.toISOString().split('T')[0];

  // Get workouts for this week
  const weekWorkouts: PlannedWorkout[] = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, mondayStr),
      lte(plannedWorkouts.date, sundayStr)
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  // Get today's workout
  const todaysWorkout = weekWorkouts.find((w: PlannedWorkout) => w.date === todayStr);

  // Get the current training block
  const currentBlock = await db.query.trainingBlocks.findFirst({
    where: and(
      lte(trainingBlocks.startDate, todayStr),
      gte(trainingBlocks.endDate, todayStr)
    ),
  });

  return {
    weekStart: mondayStr,
    weekEnd: sundayStr,
    workouts: weekWorkouts,
    todaysWorkout,
    currentBlock,
    totalMiles: weekWorkouts.reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0),
    completedMiles: weekWorkouts
      .filter((w: PlannedWorkout) => w.status === 'completed')
      .reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0),
  };
}

/**
 * Get today's planned workout.
 */
export async function getTodaysWorkout() {
  // Auto-extend window if needed
  await extendWindowIfNeeded();

  const today = new Date().toISOString().split('T')[0];

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!workout) {
    return null;
  }

  // Get the training block for phase info
  let block = null;
  if (workout.trainingBlockId) {
    block = await db.query.trainingBlocks.findFirst({
      where: eq(trainingBlocks.id, workout.trainingBlockId),
    });
  }

  return {
    ...workout,
    phase: block?.phase,
    phaseFocus: block?.focus,
  };
}

// ==================== Plan Modification ====================

/**
 * Update a planned workout status.
 */
export async function updatePlannedWorkoutStatus(
  workoutId: number,
  status: 'scheduled' | 'completed' | 'skipped' | 'modified'
) {
  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({ status, updatedAt: now })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');
}

/**
 * Link a completed workout to a planned workout.
 */
export async function linkWorkoutToPlanned(workoutId: number, plannedWorkoutId: number) {
  // This would update the workouts table's plannedWorkoutId field
  // Implementation depends on your workouts schema
  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({ status: 'completed', updatedAt: now })
    .where(eq(plannedWorkouts.id, plannedWorkoutId));

  revalidatePath('/plan');
  revalidatePath('/today');
}

/**
 * Scale down a planned workout.
 */
export async function scaleDownPlannedWorkout(workoutId: number, factor: number = 0.75) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      targetDistanceMiles: workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * factor * 10) / 10
        : null,
      targetDurationMinutes: workout.targetDurationMinutes
        ? Math.round(workout.targetDurationMinutes * factor)
        : null,
      rationale: `${workout.rationale} (scaled to ${Math.round(factor * 100)}%)`,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');
}

/**
 * Swap a planned workout with an alternative.
 */
export async function swapPlannedWorkout(workoutId: number, alternativeTemplateId: string) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  // Get the alternative template
  const { getWorkoutTemplate } = await import('@/lib/training/workout-templates');
  const template = getWorkoutTemplate(alternativeTemplateId);

  if (!template) {
    throw new Error('Alternative template not found');
  }

  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      templateId: template.id,
      name: template.name,
      description: template.description,
      structure: JSON.stringify(template.structure),
      rationale: `Swapped from ${workout.name}: ${template.purpose}`,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');
}

// ==================== Coach Tools ====================

/**
 * Move a planned workout to a different date.
 */
export async function movePlannedWorkout(workoutId: number, newDate: string) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  const now = new Date().toISOString();

  // Check if there's already a workout on the target date
  const existingWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, newDate),
  });

  if (existingWorkout && existingWorkout.id !== workoutId) {
    // Swap the dates
    await db.update(plannedWorkouts)
      .set({ date: workout.date, updatedAt: now })
      .where(eq(plannedWorkouts.id, existingWorkout.id));
  }

  await db.update(plannedWorkouts)
    .set({
      date: newDate,
      rationale: workout.rationale
        ? `${workout.rationale} (moved from ${workout.date})`
        : `Moved from ${workout.date}`,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');

  return { success: true };
}

/**
 * Get alternative workouts for a planned workout.
 */
export async function getWorkoutAlternatives(workoutId: number) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  // Get the current phase for phase-appropriate alternatives
  let currentPhase = 'build';
  if (workout.trainingBlockId) {
    const block = await db.query.trainingBlocks.findFirst({
      where: eq(trainingBlocks.id, workout.trainingBlockId),
    });
    if (block) {
      currentPhase = block.phase;
    }
  }

  // Parse stored alternatives if any
  const storedAlternatives = workout.alternatives
    ? JSON.parse(workout.alternatives) as string[]
    : [];

  // Get templates for alternatives
  const { getWorkoutTemplate, getTemplatesByCategory } = await import('@/lib/training/workout-templates');

  const alternatives = storedAlternatives.map(id => getWorkoutTemplate(id)).filter(Boolean);

  // If no stored alternatives, suggest some based on workout type
  if (alternatives.length === 0) {
    const category = workout.workoutType === 'tempo' || workout.workoutType === 'interval'
      ? 'threshold'
      : workout.workoutType === 'long'
        ? 'long'
        : 'easy';

    const categoryWorkouts = getTemplatesByCategory(category);
    alternatives.push(...categoryWorkouts.slice(0, 3));
  }

  return {
    workout,
    alternatives,
    currentPhase,
  };
}

/**
 * Delete a planned workout (convert to rest day).
 */
export async function deletePlannedWorkout(workoutId: number) {
  await db.delete(plannedWorkouts).where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');

  return { success: true };
}

/**
 * Add a note to a planned workout.
 */
export async function addWorkoutNote(workoutId: number, note: string) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  const now = new Date().toISOString();
  const updatedRationale = workout.rationale
    ? `${workout.rationale}\n\nNote: ${note}`
    : `Note: ${note}`;

  await db.update(plannedWorkouts)
    .set({
      rationale: updatedRationale,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');

  return { success: true };
}

/**
 * Get training summary for the coach.
 */
export async function getTrainingSummary() {
  const weekPlan = await getCurrentWeekPlan();
  const settings = await db.query.userSettings.findFirst();

  // Get upcoming races
  const today = new Date().toISOString().split('T')[0];
  const upcomingRaces = await db.query.races.findMany({
    where: gte(races.date, today),
    orderBy: [asc(races.date)],
  });

  const nextRace = upcomingRaces[0];
  let daysUntilRace: number | null = null;

  if (nextRace) {
    const raceDate = parseLocalDate(nextRace.date);
    const todayDate = new Date(today);
    daysUntilRace = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    currentWeek: weekPlan,
    currentPhase: weekPlan.currentBlock?.phase || null,
    phaseFocus: weekPlan.currentBlock?.focus || null,
    nextRace: nextRace ? {
      name: nextRace.name,
      date: nextRace.date,
      distance: nextRace.distanceLabel,
      daysUntil: daysUntilRace,
    } : null,
    vdot: settings?.vdot,
    weeklyMileageTarget: weekPlan.totalMiles,
    weeklyMileageCompleted: weekPlan.completedMiles,
  };
}

// ==================== Mileage Management ====================

/**
 * Update the target mileage for a specific training week/block.
 */
export async function updateWeekTargetMileage(blockId: number, targetMileage: number) {
  const now = new Date().toISOString();

  await db.update(trainingBlocks)
    .set({ targetMileage, createdAt: now })
    .where(eq(trainingBlocks.id, blockId));

  revalidatePath('/plan');
  revalidatePath('/today');

  return { success: true };
}

/**
 * Recalculate and update mileage progression for all weeks in a plan.
 * Call this after updating user settings to propagate new targets.
 */
export async function recalculatePlanMileage(raceId: number) {
  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!race) {
    throw new Error('Race not found');
  }

  const settings = await db.query.userSettings.findFirst();
  if (!settings || !settings.currentWeeklyMileage) {
    throw new Error('User settings not complete');
  }

  const blocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, raceId),
    orderBy: [asc(trainingBlocks.weekNumber)],
  });

  if (blocks.length === 0) {
    return { success: false, error: 'No training blocks found' };
  }

  // Import plan rules to recalculate mileage
  const { calculateMileageProgression, calculatePhaseWeeks, getPhasePercentages } = await import('@/lib/training/plan-rules');

  const totalWeeks = blocks.length;
  const phasePercentages = getPhasePercentages(race.distanceMeters, totalWeeks);
  const phaseWeeks = calculatePhaseWeeks(phasePercentages, totalWeeks, race.distanceMeters);

  const mileages = calculateMileageProgression(
    settings.currentWeeklyMileage,
    settings.peakWeeklyMileageTarget || Math.round(settings.currentWeeklyMileage * 1.5),
    totalWeeks,
    phaseWeeks,
    settings.planAggressiveness || 'moderate'
  );

  // Update each block's target mileage
  const now = new Date().toISOString();
  for (let i = 0; i < blocks.length; i++) {
    await db.update(trainingBlocks)
      .set({ targetMileage: mileages[i], createdAt: now })
      .where(eq(trainingBlocks.id, blocks[i].id));
  }

  revalidatePath('/plan');
  revalidatePath('/today');

  return { success: true, updatedWeeks: blocks.length };
}

// ==================== Reset Functions ====================

/**
 * Reset (delete) the training plan for a specific race.
 * Does NOT delete completed workouts - only planned workouts.
 */
export async function resetTrainingPlanForRace(raceId: number) {
  // Get all training blocks for this race
  const blocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, raceId),
  });

  // Delete planned workouts for each block (preserves completed workout links)
  for (const block of blocks) {
    await db.delete(plannedWorkouts).where(eq(plannedWorkouts.trainingBlockId, block.id));
  }

  // Delete the training blocks
  await db.delete(trainingBlocks).where(eq(trainingBlocks.raceId, raceId));

  // Mark the race as not having a generated plan
  await db.update(races)
    .set({ trainingPlanGenerated: false, updatedAt: new Date().toISOString() })
    .where(eq(races.id, raceId));

  revalidatePath('/plan');
  revalidatePath('/today');
  revalidatePath('/races');

  return { success: true };
}

/**
 * Reset ALL training plans (for all races).
 * Does NOT delete completed workouts or race results.
 */
export async function resetAllTrainingPlans() {
  // Delete all planned workouts
  await db.delete(plannedWorkouts);

  // Delete all training blocks
  await db.delete(trainingBlocks);

  // Mark all races as not having generated plans
  await db.update(races)
    .set({ trainingPlanGenerated: false, updatedAt: new Date().toISOString() });

  revalidatePath('/plan');
  revalidatePath('/today');
  revalidatePath('/races');

  return { success: true };
}
