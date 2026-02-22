// race-tools - Coach tool implementations
// Auto-generated from coach-tools.ts split

// Coach tools for Claude function calling

import { db, workouts, assessments, shoes, userSettings, clothingItems, races, raceResults, plannedWorkouts, trainingBlocks, sorenessEntries, canonicalRoutes, coachActions } from '@/lib/db';
import { eq, desc, gte, asc, and, lte, lt } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { fetchCurrentWeather, type WeatherCondition } from '../weather';
import { calculateConditionsSeverity, calculatePaceAdjustment, parsePaceToSeconds } from '../conditions';
import { calculateVibesTemp, getOutfitRecommendation, matchWardrobeItems, getCategoryLabel } from '../outfit';
import { calculatePace, formatPace as formatPaceFromTraining } from '../utils';
import { format, addDays, startOfWeek } from 'date-fns';
import { calculateVDOT, calculatePaceZones } from '../training/vdot-calculator';
import { RACE_DISTANCES } from '../training/types';
import { detectAlerts } from '../alerts';
import { enhancedPrescribeWorkout } from '../enhanced-prescribe-workout';
import type { WorkoutType, Verdict, NewAssessment, ClothingCategory, TemperaturePreference, OutfitRating, ExtremityRating, RacePriority, Workout, Assessment, Shoe, ClothingItem, PlannedWorkout, Race, CanonicalRoute, WorkoutSegment, UserSettings } from '../schema';
import { performVibeCheck, adaptWorkout, vibeCheckDefinition, adaptWorkoutDefinition } from '../vibe-check-tool';
import { MasterPlanGenerator } from '../master-plan';
import { DetailedWindowGenerator } from '../detailed-window-generator';
import { CoachingMemory } from '../coaching-memory';

// New feature imports
import {
  classifyRun,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  computeQualityRatio,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  computeTRIMP,
} from '../training/run-classifier';
import {
  computeExecutionScore,
  parseExecutionDetails,
} from '../training/execution-scorer';
import {
  checkDataQuality,
  parseDataQualityFlags,
  getDataQualitySummary,
  type DataQualityFlags,
} from '../training/data-quality';
import {
  getRouteProgressSummary,
} from '../training/route-matcher';
import { generateExplanationContext } from '../training/workout-processor';
import {
  standardPlans,
  getStandardPlan,
  getPlansByAuthor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSuitablePlans,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type StandardPlanTemplate,
} from '../training/standard-plans';
import { buildPerformanceModel } from '../training/performance-model';
import { getCoachingKnowledge, getRelatedTopics, getTopicWithRelated, type KnowledgeTopic } from '../coach-knowledge';
import { isPublicAccessMode } from '../access-mode';

// Analytics imports for coach context (roadmap 3.15)
import { getFatigueResistanceData } from '@/actions/fatigue-resistance';
import { getSplitTendencyData } from '@/actions/split-tendency';
import { getRunningEconomyData } from '@/actions/running-economy';

// Threshold detection & recovery model imports
import { getThresholdEstimate } from '@/actions/threshold';
import { getRecoveryAnalysis } from '@/actions/recovery';


// Shared utilities from split modules
import { getSettingsForProfile, recordCoachAction, formatPace, parseTimeToSeconds, formatTimeFromSeconds, formatSecondsToTime, getDateDaysAgo, getWeekStart, groupByWorkoutType, buildProfileUpdates, updateUserVDOTFromResult, createPendingCoachAction } from './shared';
import type { WorkoutWithRelations, DemoContext, DemoAction } from './types';


async function getRaces(input: Record<string, unknown>) {
  const includePast = input.include_past as boolean || false;
  const today = new Date().toISOString().split('T')[0];

  const racesProfileId = await getActiveProfileId();
  const allRaces: Race[] = await db.query.races.findMany({
    where: racesProfileId ? eq(races.profileId, racesProfileId) : undefined,
    orderBy: [asc(races.date)],
  });

  const filteredRaces = includePast
    ? allRaces
    : allRaces.filter((r: Race) => r.date >= today);

  if (filteredRaces.length === 0) {
    return {
      has_races: false,
      message: 'No upcoming races.',
    };
  }

  return {
    has_races: true,
    races: filteredRaces.map(r => {
      const raceDate = new Date(r.date);
      const todayDate = new Date(today);
      const daysUntil = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: r.id,
        name: r.name,
        date: r.date,
        distance: r.distanceLabel,
        priority: r.priority,
        days_until: daysUntil,
        is_past: r.date < today,
        target_time: r.targetTimeSeconds ? formatTimeFromSeconds(r.targetTimeSeconds) : null,
        has_training_plan: r.trainingPlanGenerated,
      };
    }),
  };
}

async function addRace(input: Record<string, unknown>) {
  const name = input.name as string;
  const date = input.date as string;
  const distance = input.distance as string;
  const priority = input.priority as RacePriority;
  const targetTime = input.target_time as string | undefined;
  const location = input.location as string | undefined;

  // Validate required fields
  if (!name || !date || !distance) {
    console.error('[addRace] Missing required fields:', { name, date, distance });
    return { error: 'Missing required fields: name, date, and distance are required' };
  }

  // Get active profile
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  // Parse target time if provided
  let targetTimeSeconds: number | null = null;
  if (targetTime) {
    targetTimeSeconds = parseTimeToSeconds(targetTime);
  }

  // Get distance in meters
  const distanceInfo = RACE_DISTANCES[distance];
  const distanceMeters = distanceInfo?.meters || 0;

  if (!distanceMeters) {
    console.warn('[addRace] Unknown distance label:', distance, '- Available:', Object.keys(RACE_DISTANCES).join(', '));
    return { error: `Unknown distance: ${distance}. Use one of: ${Object.keys(RACE_DISTANCES).join(', ')}` };
  }

  const now = new Date().toISOString();

  try {
    const [race] = await db.insert(races).values({
      profileId: profileId || null,
      name,
      date,
      distanceMeters,
      distanceLabel: distance,
      priority: priority || 'B',
      targetTimeSeconds,
      targetPaceSecondsPerMile: targetTimeSeconds && distanceInfo
        ? Math.round(targetTimeSeconds / distanceInfo.miles)
        : null,
      location: location || null,
      notes: null,
      trainingPlanGenerated: false,
      createdAt: now,
      updatedAt: now,
    }).returning();

    const raceDate = new Date(date);
    const today = new Date();
    const daysUntil = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const weeksUntil = Math.ceil(daysUntil / 7);

    return {
      success: true,
      message: `Added ${name} (${distance}) on ${date}`,
      race_id: race.id,
      days_until: daysUntil,
      weeks_until: weeksUntil,
      note: daysUntil > 42
        ? 'Consider generating a training plan for this race.'
        : daysUntil > 14
        ? 'Not enough time for a full training block, but I can help plan your taper.'
        : 'Race is coming up soon! Focus on rest and final preparations.',
    };
  } catch (dbError) {
    console.error('[addRace] Database error:', dbError);
    return { error: `Failed to add race: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}` };
  }
}

async function addRaceResult(input: Record<string, unknown>) {
  const raceName = input.race_name as string | undefined;
  const date = input.date as string;
  const distance = input.distance as string;
  const finishTime = input.finish_time as string;
  const effortLevel = (input.effort_level as 'all_out' | 'hard' | 'moderate' | 'easy') || 'all_out';
  const conditions = input.conditions as string | undefined;
  const notes = input.notes as string | undefined;

  // Get active profile
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  // Parse finish time
  const finishTimeSeconds = parseTimeToSeconds(finishTime);
  if (!finishTimeSeconds) {
    return { error: 'Invalid finish time format. Use H:MM:SS or MM:SS.' };
  }

  // Get distance in meters
  const distanceInfo = RACE_DISTANCES[distance];
  const distanceMeters = distanceInfo?.meters || 0;

  // Calculate VDOT
  const calculatedVdot = calculateVDOT(distanceMeters, finishTimeSeconds);

  const now = new Date().toISOString();

  await db.insert(raceResults).values({
    profileId: profileId || null,
    raceName: raceName || null,
    date,
    distanceMeters,
    distanceLabel: distance,
    finishTimeSeconds,
    calculatedVdot,
    effortLevel,
    conditions: conditions || null,
    notes: notes || null,
    createdAt: now,
  });

  // Update user's VDOT and pace zones
  await updateUserVDOTFromResult(calculatedVdot, effortLevel);

  const zones = calculatePaceZones(calculatedVdot);

  return {
    success: true,
    message: `Race result logged: ${distance} in ${finishTime}`,
    calculated_vdot: calculatedVdot,
    new_pace_zones: {
      easy: formatPaceFromTraining(zones.easy),
      tempo: formatPaceFromTraining(zones.tempo),
      interval: formatPaceFromTraining(zones.interval),
    },
    note: effortLevel !== 'all_out'
      ? 'Note: Since this wasn\'t an all-out effort, your true fitness may be higher.'
      : 'VDOT and pace zones have been updated based on this result.',
  };
}

async function updateRace(input: Record<string, unknown>) {
  const raceId = input.race_id as number;
  const targetTime = input.target_time as string | undefined;
  const date = input.date as string | undefined;
  const priority = input.priority as RacePriority | undefined;
  const name = input.name as string | undefined;
  const notes = input.notes as string | undefined;

  // Fetch existing race
  const existingRace = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!existingRace) {
    return { error: `Race with ID ${raceId} not found.` };
  }

  const updates: Partial<Race> = {
    updatedAt: new Date().toISOString(),
  };

  // Process target time change
  if (targetTime) {
    const targetTimeSeconds = parseTimeToSeconds(targetTime);
    if (!targetTimeSeconds) {
      return { error: 'Invalid target time format. Use H:MM:SS or MM:SS.' };
    }
    updates.targetTimeSeconds = targetTimeSeconds;

    // Update target pace if we have distance info
    if (existingRace.distanceMeters) {
      const miles = existingRace.distanceMeters / 1609.344;
      updates.targetPaceSecondsPerMile = Math.round(targetTimeSeconds / miles);
    }
  }

  if (date) {
    updates.date = date;
  }

  if (priority) {
    updates.priority = priority;
  }

  if (name) {
    updates.name = name;
  }

  if (notes !== undefined) {
    updates.notes = notes || null;
  }

  await db.update(races)
    .set(updates)
    .where(eq(races.id, raceId));

  // Fetch updated race
  const updatedRace = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  const changes: string[] = [];
  if (targetTime) changes.push(`target time to ${targetTime}`);
  if (date) changes.push(`date to ${date}`);
  if (priority) changes.push(`priority to ${priority}`);
  if (name) changes.push(`name to "${name}"`);
  if (notes !== undefined) changes.push('notes');

  return {
    success: true,
    message: `Updated ${existingRace.name}: ${changes.join(', ')}`,
    race: {
      id: updatedRace?.id,
      name: updatedRace?.name,
      date: updatedRace?.date,
      distance: updatedRace?.distanceLabel,
      priority: updatedRace?.priority,
      target_time: updatedRace?.targetTimeSeconds
        ? formatSecondsToTime(updatedRace.targetTimeSeconds)
        : null,
    },
    note: targetTime
      ? 'Consider if the training plan pace zones should be updated to reflect this new goal.'
      : undefined,
  };
}

async function deleteRace(input: Record<string, unknown>) {
  const raceId = input.race_id as number;

  // Fetch existing race
  const existingRace = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!existingRace) {
    return { error: `Race with ID ${raceId} not found.` };
  }

  await db.delete(races).where(eq(races.id, raceId));

  return {
    success: true,
    message: `Deleted race: ${existingRace.name} (${existingRace.date})`,
    deleted_race: {
      id: existingRace.id,
      name: existingRace.name,
      date: existingRace.date,
      distance: existingRace.distanceLabel,
    },
  };
}

async function predictRaceTime(input: Record<string, unknown>) {
  const distance = input.distance as string;
  const conditions = (input.conditions as string) || 'ideal';

  const s = await getSettingsForProfile();

  if (!s?.vdot) {
    return {
      error: 'No VDOT available. Add a race result to get predictions.',
      suggestion: 'Tell me about a recent race so I can calculate your VDOT.',
    };
  }

  const distanceInfo = RACE_DISTANCES[distance];
  if (!distanceInfo) {
    return { error: 'Unknown distance' };
  }

  // Base prediction from VDOT
  // Using Jack Daniels formula approximation
  const vdot = s.vdot;

  // Approximate race pace in seconds per mile based on VDOT and distance
  // This is a simplified version of the Daniels formula
  let predictedPacePerMile: number;

  if (distance === '5K') {
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles * 0.95;
  } else if (distance === '10K') {
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles;
  } else if (distance === 'half_marathon') {
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles * 1.06;
  } else if (distance === 'marathon') {
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles * 1.12;
  } else {
    // For other distances, interpolate
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles * 1.02;
  }

  let predictedTimeSeconds = Math.round(predictedPacePerMile * distanceInfo.miles);

  // Apply conditions adjustments
  let conditionsNote = '';
  if (conditions === 'warm') {
    predictedTimeSeconds = Math.round(predictedTimeSeconds * 1.03);
    conditionsNote = 'Added ~3% for warm conditions';
  } else if (conditions === 'hot') {
    predictedTimeSeconds = Math.round(predictedTimeSeconds * 1.08);
    conditionsNote = 'Added ~8% for hot conditions';
  } else if (conditions === 'cold') {
    predictedTimeSeconds = Math.round(predictedTimeSeconds * 0.99);
    conditionsNote = 'Slightly faster in cool conditions';
  } else if (conditions === 'hilly') {
    predictedTimeSeconds = Math.round(predictedTimeSeconds * 1.05);
    conditionsNote = 'Added ~5% for hilly course';
  }

  const predictedPace = Math.round(predictedTimeSeconds / distanceInfo.miles);

  // Calculate range (conservative to aggressive)
  const conservativeTime = Math.round(predictedTimeSeconds * 1.03);
  const aggressiveTime = Math.round(predictedTimeSeconds * 0.98);

  return {
    distance: distanceInfo.label,
    predicted_time: formatTimeFromSeconds(predictedTimeSeconds),
    predicted_pace: formatPaceFromTraining(predictedPace) + '/mi',
    range: {
      conservative: formatTimeFromSeconds(conservativeTime),
      aggressive: formatTimeFromSeconds(aggressiveTime),
    },
    based_on_vdot: vdot,
    conditions_adjustment: conditionsNote || 'None (ideal conditions)',
    confidence_note: 'Predictions are based on current VDOT. Actual performance depends on race-day execution, pacing, and conditions.',
  };
}

export {
  getRaces,
  addRace,
  addRaceResult,
  updateRace,
  deleteRace,
  predictRaceTime,
};
