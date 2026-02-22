// profile-tools - Coach tool implementations
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


async function getUserProfile() {
  const s = await getSettingsForProfile();

  if (!s) {
    return {
      has_profile: false,
      message: 'No user profile found. User needs to complete onboarding.',
      missing_fields: ['all'],
    };
  }

  // Check what's missing
  const missingFields: string[] = [];
  if (!s.name) missingFields.push('name');
  if (!s.currentWeeklyMileage) missingFields.push('current_weekly_mileage');
  if (!s.runsPerWeekCurrent) missingFields.push('runs_per_week');
  if (!s.vdot) missingFields.push('vdot (add a race result)');
  if (!s.preferredLongRunDay) missingFields.push('preferred_long_run_day');
  if (!s.latitude) missingFields.push('location');

  return {
    has_profile: true,
    onboarding_completed: s.onboardingCompleted || false,
    name: s.name,
    age: s.age,
    years_running: s.yearsRunning,
    athletic_background: s.athleticBackground,
    resting_hr: s.restingHr,
    // Training state
    current_weekly_mileage: s.currentWeeklyMileage,
    runs_per_week: s.runsPerWeekCurrent,
    current_long_run_max: s.currentLongRunMax,
    // Goals
    peak_weekly_mileage_target: s.peakWeeklyMileageTarget,
    runs_per_week_target: s.runsPerWeekTarget,
    quality_sessions_per_week: s.qualitySessionsPerWeek,
    // Preferences
    preferred_long_run_day: s.preferredLongRunDay,
    preferred_quality_days: s.preferredQualityDays ? JSON.parse(s.preferredQualityDays) : null,
    required_rest_days: s.requiredRestDays ? JSON.parse(s.requiredRestDays) : null,
    plan_aggressiveness: s.planAggressiveness,
    // Training philosophy
    training_philosophy: s.trainingPhilosophy,
    training_philosophies: s.trainingPhilosophies ? JSON.parse(s.trainingPhilosophies) : s.trainingPhilosophy ? [s.trainingPhilosophy] : null,
    down_week_frequency: s.downWeekFrequency,
    long_run_style: s.longRunMaxStyle,
    fatigue_management_style: s.fatigueManagementStyle,
    workout_variety_pref: s.workoutVarietyPref,
    mlr_preference: s.mlrPreference,
    progressive_long_runs_ok: s.progressiveLongRunsOk,
    // Comfort levels
    comfort_vo2max: s.comfortVO2max,
    comfort_tempo: s.comfortTempo,
    comfort_hills: s.comfortHills,
    comfort_long_runs: s.comfortLongRuns,
    comfort_track_work: s.comfortTrackWork,
    open_to_doubles: s.openToDoubles,
    train_by: s.trainBy,
    speedwork_experience: s.speedworkExperience,
    workout_complexity: s.workoutComplexity,
    coaching_detail_level: s.coachingDetailLevel,
    // Fitness
    vdot: s.vdot,
    heat_acclimatization_score: s.heatAcclimatizationScore,
    // Recovery
    typical_sleep_hours: s.typicalSleepHours,
    sleep_quality: s.sleepQuality,
    stress_level: s.stressLevel,
    needs_extra_rest: s.needsExtraRest,
    common_injuries: s.commonInjuries ? JSON.parse(s.commonInjuries) : null,
    current_injuries: s.currentInjuries,
    injury_history: s.injuryHistory,
    // Schedule & environment
    preferred_run_time: s.preferredRunTime,
    surface_preference: s.surfacePreference,
    group_vs_solo: s.groupVsSolo,
    heat_sensitivity: s.heatSensitivity,
    cold_sensitivity: s.coldSensitivity,
    // Race PRs
    marathon_pr: s.marathonPR,
    half_marathon_pr: s.halfMarathonPR,
    ten_k_pr: s.tenKPR,
    five_k_pr: s.fiveKPR,
    // Context
    coach_context: s.coachContext,
    // Missing
    missing_fields: missingFields.length > 0 ? missingFields : null,
  };
}

async function updateUserProfile(input: Record<string, unknown>) {
  const s = await getSettingsForProfile();

  if (!s) {
    return { error: 'No user profile found' };
  }

  const updates = buildProfileUpdates(input);

  if (Object.keys(updates).length === 0) {
    return { success: false, message: 'No valid fields provided' };
  }

  updates.updatedAt = new Date().toISOString();

  await db.update(userSettings)
    .set(updates)
    .where(eq(userSettings.id, s.id));

  return {
    success: true,
    message: 'Profile updated',
    updated_fields: Object.keys(updates).filter(k => k !== 'updatedAt'),
  };
}

export {
  getUserProfile,
  updateUserProfile,
};
