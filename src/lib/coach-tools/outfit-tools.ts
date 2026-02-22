// outfit-tools - Coach tool implementations
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


async function getCurrentWeather() {
  const s = await getSettingsForProfile();

  if (!s?.latitude || !s?.longitude) {
    return { error: 'No location configured' };
  }

  const weather = await fetchCurrentWeather(s.latitude, s.longitude);

  if (!weather) {
    return { error: 'Could not fetch weather' };
  }

  const severity = calculateConditionsSeverity(weather);

  return {
    temperature_f: weather.temperature,
    feels_like_f: weather.feelsLike,
    humidity_pct: weather.humidity,
    wind_mph: weather.windSpeed,
    condition: weather.conditionText,
    severity_score: severity.severityScore,
    severity_label: severity.primaryFactor,
    description: severity.description,
  };
}

async function calculateAdjustedPace(input: Record<string, unknown>) {
  const targetPace = input.target_pace as string;
  const workoutType = input.workout_type as WorkoutType;

  const paceSeconds = parsePaceToSeconds(targetPace);
  if (!paceSeconds) {
    return { error: 'Invalid pace format. Use "7:30" format.' };
  }

  const s = await getSettingsForProfile();

  if (!s?.latitude || !s?.longitude) {
    return { error: 'No location configured for weather' };
  }

  const weather = await fetchCurrentWeather(s.latitude, s.longitude);
  if (!weather) {
    return { error: 'Could not fetch weather' };
  }

  const severity = calculateConditionsSeverity(weather);
  const adjustment = calculatePaceAdjustment(
    paceSeconds,
    severity,
    workoutType,
    s.heatAcclimatizationScore || 50
  );

  return {
    original_pace: adjustment.originalPace,
    adjusted_pace: adjustment.adjustedPace,
    adjustment_seconds: adjustment.adjustmentSeconds,
    reason: adjustment.reason,
    recommendation: adjustment.recommendation,
    warnings: adjustment.warnings,
  };
}

async function getOutfitRecommendationTool(input: Record<string, unknown>) {
  const distanceMiles = (input.distance_miles as number) || 5;
  const workoutType = (input.workout_type as WorkoutType) || 'easy';
  const overrideTemp = input.feels_like_temp as number | undefined;

  const s = await getSettingsForProfile();

  let feelsLikeTemp: number;
  let weatherData: { temperature: number; feelsLike: number; humidity: number; windSpeed: number; weatherCode: number; condition: WeatherCondition; conditionText: string } | null = null;

  if (overrideTemp !== undefined) {
    feelsLikeTemp = overrideTemp;
    weatherData = {
      temperature: overrideTemp,
      feelsLike: overrideTemp,
      humidity: 50,
      windSpeed: 5,
      weatherCode: 0,
      condition: 'clear',
      conditionText: 'Clear',
    };
  } else {
    if (!s?.latitude || !s?.longitude) {
      return { error: 'No location configured. Please set location in settings or provide feels_like_temp.' };
    }

    const weather = await fetchCurrentWeather(s.latitude, s.longitude);
    if (!weather) {
      return { error: 'Could not fetch weather' };
    }
    feelsLikeTemp = weather.feelsLike;
    weatherData = {
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      weatherCode: weather.weatherCode,
      condition: weather.condition,
      conditionText: weather.conditionText,
    };
  }

  const temperaturePreference = (s?.temperaturePreference as TemperaturePreference) || 'neutral';

  const vt = calculateVibesTemp(feelsLikeTemp, workoutType, distanceMiles, temperaturePreference);
  const recommendation = getOutfitRecommendation(vt, weatherData!, workoutType);

  // Get wardrobe items to match (filter by profileId)
  const profileId = await getActiveProfileId();
  const wardrobeFilter = profileId
    ? and(eq(clothingItems.isActive, true), eq(clothingItems.profileId, profileId))
    : eq(clothingItems.isActive, true);
  const wardrobe = await db.select().from(clothingItems).where(wardrobeFilter);
  const matchedItems = matchWardrobeItems(recommendation, wardrobe);

  return {
    vibes_temp: vt.vibesTemp,
    vt_breakdown: vt.breakdown,
    weather: weatherData,
    workout_type: workoutType,
    distance_miles: distanceMiles,
    recommendation: {
      top: {
        suggestion: recommendation.top.recommendation,
        your_items: matchedItems.top.map(i => i.name),
        note: recommendation.top.note,
      },
      bottom: {
        suggestion: recommendation.bottom.recommendation,
        your_items: matchedItems.bottom.map(i => i.name),
        note: recommendation.bottom.note,
      },
      gloves: recommendation.gloves.categories.length > 0 ? {
        suggestion: recommendation.gloves.recommendation,
        your_items: matchedItems.gloves.map(i => i.name),
        note: recommendation.gloves.note,
      } : null,
      headwear: vt.vibesTemp < 30 ? {
        suggestion: recommendation.headwear.recommendation,
        your_items: matchedItems.headwear.map(i => i.name),
        note: recommendation.headwear.note,
      } : null,
      add_ons: recommendation.addOns.shell || recommendation.addOns.buff ? {
        shell: recommendation.addOns.shell,
        buff: recommendation.addOns.buff,
        notes: recommendation.addOns.notes,
      } : null,
    },
    tips: recommendation.warmUpNotes,
    summary: recommendation.summary,
  };
}

async function getWardrobe(input: Record<string, unknown>) {
  const includeInactive = input.include_inactive as boolean || false;

  const profileId = await getActiveProfileId();
  let items: ClothingItem[] = profileId
    ? await db.select().from(clothingItems).where(eq(clothingItems.profileId, profileId))
    : await db.select().from(clothingItems);

  if (!includeInactive) {
    items = items.filter((i: ClothingItem) => i.isActive);
  }

  // Group by category type
  const grouped: Record<string, Array<{ id: number; name: string; warmth: number; notes: string | null }>> = {};

  for (const item of items) {
    const group = getCategoryLabel(item.category as ClothingCategory);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push({
      id: item.id,
      name: item.name,
      warmth: item.warmthRating,
      notes: item.notes,
    });
  }

  return {
    total_items: items.length,
    items_by_category: grouped,
  };
}

async function addClothingItem(input: Record<string, unknown>) {
  const name = input.name as string;
  const category = input.category as ClothingCategory;
  const warmthRating = Math.min(5, Math.max(1, input.warmth_rating as number));
  const notes = input.notes as string | undefined;

  const now = new Date().toISOString();

  const itemProfileId = await getActiveProfileId();
  const [item] = await db.insert(clothingItems).values({
    profileId: itemProfileId || null,
    name,
    category,
    warmthRating,
    notes: notes || null,
    isActive: true,
    createdAt: now,
  }).returning();

  return {
    success: true,
    message: `Added "${name}" to your wardrobe`,
    item: {
      id: item.id,
      name: item.name,
      category: getCategoryLabel(item.category as ClothingCategory),
      warmth_rating: item.warmthRating,
    },
  };
}

async function logOutfitFeedback(input: Record<string, unknown>) {
  let workoutId = input.workout_id as number | undefined;
  const outfitRating = input.outfit_rating as OutfitRating;
  const handsRating = input.hands_rating as ExtremityRating | undefined;
  const faceRating = input.face_rating as ExtremityRating | undefined;
  const removedLayers = input.removed_layers as string | undefined;

  // If no workout ID, get the most recent workout for this profile
  if (!workoutId) {
    const feedbackProfileId = await getActiveProfileId();
    const recentWorkout = await db.query.workouts.findFirst({
      where: feedbackProfileId ? eq(workouts.profileId, feedbackProfileId) : undefined,
      orderBy: [desc(workouts.date), desc(workouts.createdAt)],
    });

    if (!recentWorkout) {
      return { error: 'No workouts found to add feedback to' };
    }
    workoutId = recentWorkout.id;
  }

  // Check if assessment exists (workoutId is definitely defined at this point)
  const targetWorkoutId = workoutId as number;
  const existing = await db.query.assessments.findFirst({
    where: eq(assessments.workoutId, targetWorkoutId),
  });

  if (existing) {
    await db.update(assessments)
      .set({
        outfitRating,
        handsRating: handsRating || null,
        faceRating: faceRating || null,
        removedLayers: removedLayers || null,
      })
      .where(eq(assessments.id, existing.id));

    return {
      success: true,
      message: `Outfit feedback saved: ${outfitRating.replace('_', ' ')}`,
      workout_id: workoutId,
    };
  }

  // Create a minimal assessment if none exists
  const now = new Date().toISOString();
  await db.insert(assessments).values({
    workoutId,
    verdict: 'fine',
    rpe: 5,
    wasIntendedWorkout: 'yes',
    issues: '[]',
    legsTags: '[]',
    lifeTags: '[]',
    hydrationTags: '[]',
    outfitRating,
    handsRating: handsRating || null,
    faceRating: faceRating || null,
    removedLayers: removedLayers || null,
    createdAt: now,
  });

  return {
    success: true,
    message: `Outfit feedback saved: ${outfitRating.replace('_', ' ')}`,
    workout_id: workoutId,
    note: 'Created a basic assessment for this workout. You can add more details later.',
  };
}

export {
  getCurrentWeather,
  calculateAdjustedPace,
  getOutfitRecommendationTool,
  getWardrobe,
  addClothingItem,
  logOutfitFeedback,
};
