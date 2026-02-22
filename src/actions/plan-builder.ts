'use server';

import { db, races, trainingBlocks, plannedWorkouts, userSettings } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { generateMacroPlan } from '@/lib/training/plan-generator';
import type { MacroPlanBlock } from '@/lib/training/plan-generator';
import { generateWindowWorkouts } from '@/lib/training/window-generator';
import { calculatePaceZones } from '@/lib/training/vdot-calculator';
import { createWeeklyStructure } from '@/lib/training/plan-rules';
import type { PlanGenerationInput, TrainingPhase, AthleteProfile } from '@/lib/training/types';
import { RACE_DISTANCES } from '@/lib/training/types';
import type { Race, UserSettings, TrainingBlock } from '@/lib/schema';
import { getActiveProfileId } from '@/lib/profile-server';
import { assessCurrentFitness } from '@/lib/training/fitness-assessment';

// ==================== Types ====================

export interface PlanBuilderConfig {
  // Step 1: Goal
  goalType: 'race' | 'general_fitness';
  raceId?: number; // existing race ID

  // Step 2: Configuration
  startingWeeklyMileage: number;
  peakWeeklyMileage: number;
  daysPerWeek: number;
  longRunDay: string;
  qualityDays: string[];
  qualitySessionsPerWeek: number;
  planDurationWeeks?: number; // if null, auto-calculate from race date
  aggressiveness: 'conservative' | 'moderate' | 'aggressive';

  // Step 3: Template
  templateId?: string; // standard plan template or 'custom'
}

export interface PlanPreview {
  totalWeeks: number;
  weeklyMileages: number[];
  phases: Array<{
    phase: string;
    weeks: number;
    startWeek: number;
  }>;
  peakMileage: number;
  peakWeek: number;
  totalMiles: number;
}

export interface PlanBuilderResult {
  success: boolean;
  error?: string;
  raceId?: number;
  planPreview?: PlanPreview;
}

// ==================== Data Fetching ====================

/**
 * Get the user's current training data for pre-filling the builder.
 */
export async function getPlanBuilderDefaults() {
  const profileId = await getActiveProfileId();
  if (!profileId) {
    return null;
  }

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });

  // Get fitness assessment for current mileage
  const fitness = await assessCurrentFitness(profileId);

  // Get upcoming A races
  const today = new Date().toISOString().split('T')[0];
  const upcomingRaces = await db.query.races.findMany({
    orderBy: [asc(races.date)],
  });
  const filteredRaces = upcomingRaces.filter(
    (r: Race) => r.date >= today && r.status !== 'completed'
  );

  return {
    currentWeeklyMileage:
      settings?.currentWeeklyMileage ||
      Math.round(fitness.typicalWeeklyMileage) ||
      20,
    peakWeeklyMileage:
      settings?.peakWeeklyMileageTarget ||
      fitness.suggestedPeakMileage ||
      Math.round(
        (settings?.currentWeeklyMileage ||
          fitness.typicalWeeklyMileage ||
          20) * 1.3
      ),
    currentRunsPerWeek:
      settings?.runsPerWeekCurrent || Math.round(fitness.runsPerWeek) || 4,
    longRunDay: settings?.preferredLongRunDay || 'sunday',
    qualityDays: settings?.preferredQualityDays
      ? JSON.parse(settings.preferredQualityDays)
      : ['tuesday', 'thursday'],
    qualitySessionsPerWeek: settings?.qualitySessionsPerWeek ?? 2,
    aggressiveness: settings?.planAggressiveness || 'moderate',
    vdot: settings?.vdot || null,
    races: filteredRaces.map((r: Race) => ({
      id: r.id,
      name: r.name,
      date: r.date,
      distanceLabel: r.distanceLabel,
      distanceMeters: r.distanceMeters,
      priority: r.priority,
      trainingPlanGenerated: r.trainingPlanGenerated,
    })),
  };
}

// ==================== Preview ====================

/**
 * Generate a mileage preview without creating DB records.
 */
export async function previewPlan(
  config: PlanBuilderConfig
): Promise<PlanPreview | null> {
  const profileId = await getActiveProfileId();
  if (!profileId) return null;

  // Get race info if targeting a race
  let raceDate: string;
  let raceDistanceMeters: number;
  let raceDistanceLabel: string;

  if (config.goalType === 'race' && config.raceId) {
    const race = await db.query.races.findFirst({
      where: eq(races.id, config.raceId),
    });
    if (!race) return null;
    raceDate = race.date;
    raceDistanceMeters = race.distanceMeters;
    raceDistanceLabel = race.distanceLabel;
  } else {
    // General fitness: set a "virtual" race 12-24 weeks out
    const weeks = config.planDurationWeeks || 12;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + weeks * 7);
    raceDate = endDate.toISOString().split('T')[0];
    raceDistanceMeters = 21097; // half marathon distance for phase calculation
    raceDistanceLabel = 'half_marathon';
  }

  const totalWeeks =
    config.planDurationWeeks ||
    Math.floor(
      (new Date(raceDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)
    );

  if (totalWeeks < 4) return null;

  const input: PlanGenerationInput = {
    currentWeeklyMileage: config.startingWeeklyMileage,
    peakWeeklyMileageTarget: config.peakWeeklyMileage,
    runsPerWeek: config.daysPerWeek,
    preferredLongRunDay: config.longRunDay,
    preferredQualityDays: config.qualityDays,
    requiredRestDays: [],
    planAggressiveness: config.aggressiveness,
    qualitySessionsPerWeek: config.qualitySessionsPerWeek,
    raceId: config.raceId || 0,
    raceDate,
    raceDistanceMeters,
    raceDistanceLabel,
    startDate: new Date().toISOString().split('T')[0],
  };

  try {
    const macroPlan = generateMacroPlan(input);

    // Build phase summaries
    const phaseMap = new Map<
      string,
      { phase: string; startWeek: number; weeks: number }
    >();
    for (const block of macroPlan.blocks) {
      const existing = phaseMap.get(block.phase);
      if (existing) {
        existing.weeks++;
      } else {
        phaseMap.set(block.phase, {
          phase: block.phase,
          startWeek: block.weekNumber,
          weeks: 1,
        });
      }
    }

    return {
      totalWeeks: macroPlan.totalWeeks,
      weeklyMileages: macroPlan.blocks.map((b) => b.targetMileage),
      phases: Array.from(phaseMap.values()),
      peakMileage: macroPlan.summary.peakMileage,
      peakWeek: macroPlan.summary.peakMileageWeek,
      totalMiles: macroPlan.summary.totalMiles,
    };
  } catch {
    return null;
  }
}

// ==================== Plan Generation ====================

/**
 * Generate the full training plan from builder config.
 */
export async function generateCustomPlan(
  config: PlanBuilderConfig
): Promise<PlanBuilderResult> {
  const profileId = await getActiveProfileId();
  if (!profileId) {
    return { success: false, error: 'No active profile found.' };
  }

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });
  if (!settings) {
    return {
      success: false,
      error: 'User settings not found. Please complete onboarding first.',
    };
  }

  // Determine race info
  let raceId: number;
  let raceDate: string;
  let raceDistanceMeters: number;
  let raceDistanceLabel: string;

  if (config.goalType === 'race' && config.raceId) {
    const race = await db.query.races.findFirst({
      where: eq(races.id, config.raceId),
    });
    if (!race) {
      return { success: false, error: 'Race not found.' };
    }
    raceId = race.id;
    raceDate = race.date;
    raceDistanceMeters = race.distanceMeters;
    raceDistanceLabel = race.distanceLabel;
  } else {
    // General fitness: no specific race, use half marathon for structure
    const weeks = config.planDurationWeeks || 12;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + weeks * 7);
    raceDate = endDate.toISOString().split('T')[0];
    raceDistanceMeters = 21097;
    raceDistanceLabel = 'half_marathon';

    // Create a "virtual" race for plan tracking
    const now = new Date().toISOString();
    const [newRace] = await db
      .insert(races)
      .values({
        profileId,
        name: 'General Fitness Plan',
        date: raceDate,
        distanceMeters: raceDistanceMeters,
        distanceLabel: raceDistanceLabel,
        priority: 'A',
        status: 'upcoming',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    raceId = newRace.id;
  }

  try {
    // Build plan input
    const paceZones = settings.vdot
      ? calculatePaceZones(settings.vdot)
      : undefined;

    const input: PlanGenerationInput = {
      currentWeeklyMileage: config.startingWeeklyMileage,
      peakWeeklyMileageTarget: config.peakWeeklyMileage,
      currentLongRunMax: settings.currentLongRunMax ?? undefined,
      runsPerWeek: config.daysPerWeek,
      preferredLongRunDay: config.longRunDay,
      preferredQualityDays: config.qualityDays,
      requiredRestDays: settings.requiredRestDays
        ? JSON.parse(settings.requiredRestDays)
        : [],
      planAggressiveness: config.aggressiveness,
      qualitySessionsPerWeek: config.qualitySessionsPerWeek,
      raceId,
      raceDate,
      raceDistanceMeters,
      raceDistanceLabel,
      vdot: settings.vdot ?? undefined,
      paceZones,
      startDate: new Date().toISOString().split('T')[0],
      athleteProfile: buildAthleteProfile(settings),
    };

    // Generate macro plan
    const macroPlan = generateMacroPlan(input);

    // Save macro blocks to DB
    const now = new Date().toISOString();

    // Delete existing blocks/workouts for this race
    const existingBlocks = await db.query.trainingBlocks.findMany({
      where: eq(trainingBlocks.raceId, raceId),
    });
    for (const block of existingBlocks) {
      await db
        .delete(plannedWorkouts)
        .where(eq(plannedWorkouts.trainingBlockId, block.id));
    }
    await db.delete(trainingBlocks).where(eq(trainingBlocks.raceId, raceId));

    // Insert training blocks
    const blockValues = macroPlan.blocks.map((block) => ({
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

    const insertedBlocks = await db
      .insert(trainingBlocks)
      .values(blockValues)
      .returning();

    // Mark race as having a training plan
    await db
      .update(races)
      .set({ trainingPlanGenerated: true, updatedAt: now })
      .where(eq(races.id, raceId));

    // Generate first 3 weeks of detailed workouts
    const firstBlocks = insertedBlocks.slice(0, 3);
    if (firstBlocks.length > 0) {
      const macroblocks: MacroPlanBlock[] = firstBlocks.map((b: TrainingBlock) => ({
        weekNumber: b.weekNumber,
        startDate: b.startDate,
        endDate: b.endDate,
        phase: b.phase as TrainingPhase,
        targetMileage: b.targetMileage || 0,
        longRunTarget:
          b.longRunTarget || Math.round((b.targetMileage || 0) * 0.3),
        qualitySessionsTarget: b.qualitySessionsTarget ?? 2,
        isDownWeek: b.isDownWeek || false,
        focus: b.focus || '',
      }));

      const weeklyStructure = createWeeklyStructure(
        config.daysPerWeek,
        config.longRunDay,
        config.qualityDays,
        settings.requiredRestDays
          ? JSON.parse(settings.requiredRestDays)
          : [],
        config.qualitySessionsPerWeek
      );

      const windowResult = generateWindowWorkouts({
        blocks: macroblocks,
        raceDate,
        raceDistanceMeters,
        raceDistanceLabel,
        weeklyStructure,
        paceZones,
        athleteProfile: buildAthleteProfile(settings),
        intermediateRaces: [],
        recentWorkouts: [],
        qualitySessionsPerWeek: config.qualitySessionsPerWeek,
      });

      const workoutTypeMap: Record<
        string,
        | 'easy'
        | 'steady'
        | 'tempo'
        | 'interval'
        | 'long'
        | 'race'
        | 'recovery'
        | 'cross_train'
        | 'other'
      > = {
        easy: 'easy',
        long: 'long',
        quality: 'tempo',
        rest: 'recovery',
        tempo: 'tempo',
        threshold: 'tempo',
        interval: 'interval',
        race: 'race',
      };

      for (const block of firstBlocks) {
        const weekWorkouts = windowResult.get(block.weekNumber);
        if (!weekWorkouts || weekWorkouts.length === 0) continue;

        const workoutValues = weekWorkouts.map((workout) => ({
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
          structure: workout.structure
            ? JSON.stringify(workout.structure)
            : null,
          rationale: workout.rationale,
          isKeyWorkout: workout.isKeyWorkout,
          alternatives: workout.alternatives
            ? JSON.stringify(workout.alternatives)
            : null,
          status: 'scheduled' as const,
          createdAt: now,
          updatedAt: now,
        }));

        if (workoutValues.length > 0) {
          await db.insert(plannedWorkouts).values(workoutValues);
        }
      }
    }

    revalidatePath('/plan');
    revalidatePath('/races');
    revalidatePath('/today');

    return {
      success: true,
      raceId,
    };
  } catch (error) {
    console.error('Error generating custom plan:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unexpected error generating plan.',
    };
  }
}

// ==================== Helpers ====================

function buildAthleteProfile(settings: UserSettings): AthleteProfile {
  return {
    comfortVO2max: settings.comfortVO2max ?? undefined,
    comfortTempo: settings.comfortTempo ?? undefined,
    comfortHills: settings.comfortHills ?? undefined,
    comfortLongRuns: settings.comfortLongRuns ?? undefined,
    comfortTrackWork: settings.comfortTrackWork ?? undefined,
    yearsRunning: settings.yearsRunning ?? undefined,
    speedworkExperience: settings.speedworkExperience as AthleteProfile['speedworkExperience'],
    highestWeeklyMileageEver: settings.highestWeeklyMileageEver ?? undefined,
    needsExtraRest: settings.needsExtraRest ?? undefined,
    stressLevel: settings.stressLevel as AthleteProfile['stressLevel'],
    commonInjuries: settings.commonInjuries
      ? JSON.parse(settings.commonInjuries)
      : undefined,
    weekdayAvailabilityMinutes:
      settings.weekdayAvailabilityMinutes ?? undefined,
    weekendAvailabilityMinutes:
      settings.weekendAvailabilityMinutes ?? undefined,
    trainBy: settings.trainBy as AthleteProfile['trainBy'],
    heatSensitivity: settings.heatSensitivity ?? undefined,
    mlrPreference: settings.mlrPreference ?? undefined,
    progressiveLongRunsOk: settings.progressiveLongRunsOk ?? undefined,
  };
}
