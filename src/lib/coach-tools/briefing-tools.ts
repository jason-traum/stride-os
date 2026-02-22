// briefing-tools - Coach tool implementations
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

// Cross-module imports for functions called by briefing tools
import { getInjuryStatus, type Injury } from './health-tools';
import { getFatigueIndicators } from './analysis-tools';
import { getTrainingLoad } from './fitness-tools';
import { getCurrentWeather } from './outfit-tools';
import { getOutfitRecommendationTool } from './outfit-tools';

async function getContextSummary() {
  const s = await getSettingsForProfile();

  // Get goal race (A priority race that's upcoming)
  const today = new Date().toISOString().split('T')[0];
  const contextProfileId = await getActiveProfileId();
  const goalRaceFilter = contextProfileId
    ? and(eq(races.profileId, contextProfileId), eq(races.priority, 'A'), gte(races.date, today))
    : and(eq(races.priority, 'A'), gte(races.date, today));
  const goalRace = await db.query.races.findFirst({
    where: goalRaceFilter,
    orderBy: [asc(races.date)],
  });

  // Get current training week
  let currentWeek = null;
  let totalWeeks = 0;
  if (goalRace) {
    currentWeek = await db.query.trainingBlocks.findFirst({
      where: and(
        eq(trainingBlocks.raceId, goalRace.id),
        lte(trainingBlocks.startDate, today),
        gte(trainingBlocks.endDate, today)
      ),
    });

    // Get total weeks in plan
    const allWeeks = await db.query.trainingBlocks.findMany({
      where: eq(trainingBlocks.raceId, goalRace.id),
    });
    totalWeeks = allWeeks.length;
  }

  // Calculate weeks until race
  let weeksUntilRace = null;
  let daysUntilRace = null;
  if (goalRace) {
    const raceDate = new Date(goalRace.date);
    const todayDate = new Date(today);
    daysUntilRace = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    weeksUntilRace = Math.ceil(daysUntilRace / 7);
  }

  // Get injury status
  const injuryStatus = await getInjuryStatus();

  // Get fatigue indicators
  const fatigueData = await getFatigueIndicators({ days_back: 7 });

  // Get training load
  const loadData = await getTrainingLoad();

  // Fetch threshold pace and recovery model in parallel (non-blocking)
  let thresholdContext: {
    threshold_pace: string;
    confidence: number;
    method: string;
  } | null = null;
  let recoveryContext: {
    recovery_score: number;
    hours_until_ready: number;
    ready_for_quality: boolean;
    personal_recovery_rate: string;
    recommendations: string[];
  } | null = null;

  try {
    const [thresholdResult, recoveryResult] = await Promise.all([
      getThresholdEstimate().catch(() => null),
      getRecoveryAnalysis().catch(() => null),
    ]);

    if (thresholdResult?.success && thresholdResult.data.method !== 'insufficient_data') {
      const t = thresholdResult.data;
      thresholdContext = {
        threshold_pace: formatPaceFromTraining(t.thresholdPaceSecondsPerMile),
        confidence: Math.round(t.confidence * 100),
        method: t.method,
      };
    }

    if (recoveryResult?.success) {
      const r = recoveryResult.data;
      recoveryContext = {
        recovery_score: r.recoveryScore,
        hours_until_ready: r.estimatedRecoveryHours,
        ready_for_quality: r.readyForQuality,
        personal_recovery_rate: r.personalRecoveryRate,
        recommendations: r.recommendations,
      };
    }
  } catch {
    // Threshold/recovery unavailable, continue without them
  }

  // Check for travel notes in coach context
  let travelStatus = null;
  if (s?.coachContext) {
    const travelMatch = s.coachContext.match(/\[TRAVEL: ([^\]]+)\]/);
    if (travelMatch) {
      travelStatus = travelMatch[1];
    }
  }

  // Build summary
  const alerts: string[] = [];

  // Injury alerts
  if (injuryStatus.active_injuries && injuryStatus.active_injuries.length > 0) {
    alerts.push(`Active injury: ${injuryStatus.active_injuries.map((i: Injury) => i.body_part).join(', ')}`);
  }

  // Fatigue alerts
  if (fatigueData.overall_status === 'Fatigue Accumulation' || fatigueData.overall_status === 'Elevated Fatigue') {
    alerts.push(`Fatigue status: ${fatigueData.overall_status}`);
  }

  // Training load alerts
  if (loadData.status === 'High Risk' || loadData.status === 'Caution') {
    alerts.push(`Training load: ${loadData.status}`);
  }

  // Recovery model alerts
  if (recoveryContext && !recoveryContext.ready_for_quality && recoveryContext.hours_until_ready > 0) {
    alerts.push(`Recovery model: ${Math.round(recoveryContext.hours_until_ready)}h until ready for quality work`);
  }

  // Travel alerts
  if (travelStatus) {
    alerts.push(`Currently traveling: ${travelStatus}`);
  }

  // Build training journey context
  const trainingJourney = goalRace ? {
    goal_race: {
      name: goalRace.name,
      date: goalRace.date,
      distance: goalRace.distanceLabel,
      target_time: goalRace.targetTimeSeconds
        ? formatSecondsToTime(goalRace.targetTimeSeconds)
        : null,
    },
    countdown: {
      days_until_race: daysUntilRace,
      weeks_until_race: weeksUntilRace,
    },
    current_phase: currentWeek ? {
      phase: currentWeek.phase,
      week_number: currentWeek.weekNumber,
      total_weeks: totalWeeks,
      week_focus: currentWeek.focus,
      target_mileage: currentWeek.targetMileage,
    } : null,
    phase_description: currentWeek ? getPhaseDescription(currentWeek.phase, weeksUntilRace || 0) : null,
  } : null;

  return {
    // THE MOST IMPORTANT THING: Where are they in their training journey?
    training_journey: trainingJourney,

    has_alerts: alerts.length > 0,
    alerts,

    injuries: {
      active: injuryStatus.active_injuries?.length || 0,
      restrictions: injuryStatus.restrictions || [],
    },

    fatigue: {
      status: fatigueData.overall_status || 'Unknown',
      key_indicators: fatigueData.signals?.slice(0, 3) || [],
    },

    training_load: {
      status: loadData.status,
      acwr: loadData.acwr,
    },

    // Auto-detected threshold pace from workout history
    threshold_pace: thresholdContext,

    // Personalized recovery model
    recovery_model: recoveryContext,

    travel: travelStatus,

    coach_context: s?.coachContext?.replace(/\[TRAVEL:.*?\]/g, '').trim() || null,

    summary: trainingJourney
      ? `${weeksUntilRace} weeks until ${goalRace?.name}. Currently in ${currentWeek?.phase || 'training'} phase (week ${currentWeek?.weekNumber || '?'} of ${totalWeeks}).${alerts.length > 0 ? ' Heads up: ' + alerts.join('. ') : ''}`
      : alerts.length > 0
        ? `Heads up: ${alerts.join('. ')}`
        : 'No goal race set. Training in maintenance mode.',
  };
}

function getPhaseDescription(phase: string, _weeksOut: number): string {
  switch (phase) {
    case 'base':
      return 'Building aerobic foundation. Focus on easy miles, consistency, and gradually increasing volume. Quality work is light - mostly strides and easy fartlek.';
    case 'build':
      return 'Adding intensity while maintaining volume. Two quality sessions per week - tempo/threshold work and some faster intervals. This is where fitness really develops.';
    case 'peak':
      return 'Race-specific preparation. Highest intensity, volume starts to level off. Key workouts matter most now. Sharpening for race day.';
    case 'taper':
      return 'Reducing volume while maintaining intensity. Trust your fitness - the hay is in the barn. Focus on rest, nutrition, and arriving fresh.';
    case 'recovery':
      return 'Post-race or recovery period. Easy running only, rebuilding before next training block.';
    default:
      return 'General training period.';
  }
}

async function getPreRunBriefing(input: Record<string, unknown>) {
  const includeOutfit = input.include_outfit !== false;

  // Get today's planned workout
  const today = new Date().toISOString().split('T')[0];
  const plannedWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  // Get training journey context (goal race, phase, weeks out)
  const briefingProfileId = await getActiveProfileId();
  const goalRace = await db.query.races.findFirst({
    where: briefingProfileId
      ? and(eq(races.profileId, briefingProfileId), eq(races.priority, 'A'), gte(races.date, today))
      : and(eq(races.priority, 'A'), gte(races.date, today)),
    orderBy: [asc(races.date)],
  });

  let trainingContext = null;
  if (goalRace) {
    const currentWeek = await db.query.trainingBlocks.findFirst({
      where: and(
        eq(trainingBlocks.raceId, goalRace.id),
        lte(trainingBlocks.startDate, today),
        gte(trainingBlocks.endDate, today)
      ),
    });

    const raceDate = new Date(goalRace.date);
    const todayDate = new Date(today);
    const daysUntilRace = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeksUntilRace = Math.ceil(daysUntilRace / 7);

    trainingContext = {
      goal_race: goalRace.name,
      race_date: goalRace.date,
      race_distance: goalRace.distanceLabel,
      target_time: goalRace.targetTimeSeconds ? formatSecondsToTime(goalRace.targetTimeSeconds) : null,
      weeks_until_race: weeksUntilRace,
      days_until_race: daysUntilRace,
      current_phase: currentWeek?.phase || null,
      week_number: currentWeek?.weekNumber || null,
      week_focus: currentWeek?.focus || null,
    };
  }

  // Get weather
  let weather = null;
  try {
    weather = await getCurrentWeather();
  } catch {
    // Weather fetch failed, continue without it
  }

  // Get injury status
  const injuries = await getInjuryStatus();

  // Get fatigue indicators (quick check)
  const fatigue = await getFatigueIndicators({ days_back: 7 });

  // Get pace zones
  const s = await getSettingsForProfile();
  const vdot = s?.vdot || 40;
  const paceZones = calculatePaceZones(vdot);

  // Build alerts
  const alerts: string[] = [];

  if (injuries.has_restrictions) {
    alerts.push(`Injury restrictions active: ${injuries.restrictions.join(', ')}`);
  }

  if (fatigue.overall_status === 'Fatigue Accumulation' || fatigue.overall_status === 'Elevated Fatigue') {
    alerts.push(`Fatigue level: ${fatigue.overall_status}. Consider taking it easy.`);
  }

  // Weather alerts - check for challenging conditions based on severity score
  if (weather && 'severity_score' in weather && weather.severity_score && weather.severity_score >= 60) {
    const label = weather.severity_label || 'challenging';
    alerts.push(`Weather: ${label} conditions (severity ${weather.severity_score}/100). Consider adjusting your run.`);
  }

  // Build workout info
  let workoutInfo = null;
  if (plannedWorkout) {
    const formatPace = (seconds: number | null) => {
      if (!seconds) return null;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
    };

    workoutInfo = {
      name: plannedWorkout.name,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      target_pace: formatPace(plannedWorkout.targetPaceSecondsPerMile),
      description: plannedWorkout.description,
      is_key_workout: plannedWorkout.isKeyWorkout,
    };

    // Check if workout conflicts with restrictions
    if (injuries.has_restrictions) {
      const conflicts: string[] = [];
      if (injuries.restrictions.includes('no_running')) {
        conflicts.push('No running restriction active - consider cross-training instead');
      }
      if (injuries.restrictions.includes('easy_only') &&
          ['tempo', 'interval', 'threshold'].includes(plannedWorkout.workoutType)) {
        conflicts.push('Quality workout planned but easy-only restriction active');
      }
      if (injuries.restrictions.includes('no_speed_work') &&
          ['interval', 'tempo'].includes(plannedWorkout.workoutType)) {
        conflicts.push('Speed work planned but no-speed-work restriction active');
      }
      if (conflicts.length > 0) {
        alerts.push(...conflicts);
      }
    }
  }

  // Get outfit recommendation if requested
  let outfit = null;
  if (includeOutfit && weather) {
    try {
      outfit = await getOutfitRecommendationTool({
        workout_type: plannedWorkout?.workoutType || 'easy',
        distance_miles: plannedWorkout?.targetDistanceMiles || 5,
      });
    } catch {
      // Outfit fetch failed
    }
  }

  // Pace guidance based on workout type
  let paceGuidance = null;
  if (plannedWorkout && paceZones) {
    const type = plannedWorkout.workoutType;
    if (type === 'easy' || type === 'recovery') {
      paceGuidance = {
        zone: 'Easy',
        range: paceZones.easy ? `${formatPaceFromTraining(paceZones.easy - 30)}-${formatPaceFromTraining(paceZones.easy + 30)}` : null,
        feel: 'Conversational. Should be able to chat easily.',
      };
    } else if (type === 'tempo' || type === 'threshold') {
      paceGuidance = {
        zone: 'Tempo/Threshold',
        range: paceZones.tempo ? formatPaceFromTraining(paceZones.tempo) : null,
        feel: 'Comfortably hard. Can speak in short sentences.',
      };
    } else if (type === 'interval') {
      paceGuidance = {
        zone: 'Interval',
        range: paceZones.interval ? formatPaceFromTraining(paceZones.interval) : null,
        feel: 'Hard but controlled. Focus on recovery between reps.',
      };
    } else if (type === 'long') {
      paceGuidance = {
        zone: 'Long Run',
        range: paceZones.easy ? `${formatPaceFromTraining(paceZones.easy - 30)}-${formatPaceFromTraining(paceZones.easy + 30)}` : null,
        feel: 'Easy to moderate. Time on feet matters more than pace.',
      };
    }
  }

  // Build workout purpose based on training context
  let workoutPurpose = null;
  if (plannedWorkout && trainingContext) {
    const type = plannedWorkout.workoutType;
    const phase = trainingContext.current_phase;
    const weeksOut = trainingContext.weeks_until_race;

    if (type === 'easy' || type === 'recovery') {
      workoutPurpose = 'Recovery and aerobic maintenance. Keep it truly easy—this run supports the hard work.';
    } else if (type === 'long') {
      if (phase === 'base') {
        workoutPurpose = 'Building endurance foundation. Time on feet is the goal, not pace.';
      } else if (phase === 'build') {
        workoutPurpose = 'Extending your endurance while volume is high. Stay controlled.';
      } else if (phase === 'peak' && weeksOut && weeksOut <= 4) {
        workoutPurpose = 'Final long run. Confidence builder. Don\'t overdo it—fitness is already there.';
      }
    } else if (type === 'tempo' || type === 'threshold') {
      workoutPurpose = 'Lactate threshold development. This pace teaches your body to clear lactate at race effort.';
    } else if (type === 'interval') {
      workoutPurpose = 'VO2max development. Hard but controlled—focus on hitting paces and full recovery between reps.';
    }
  }

  return {
    date: today,

    // Training journey context - the most important framing
    training_context: trainingContext,

    has_alerts: alerts.length > 0,
    alerts,

    workout: workoutInfo || { message: 'No workout planned for today. Easy run or rest day.' },
    workout_purpose: workoutPurpose,
    pace_guidance: paceGuidance,

    weather: weather && 'temperature_f' in weather ? {
      temp_f: weather.temperature_f,
      feels_like_f: weather.feels_like_f,
      conditions: weather.condition,
      severity: weather.severity_label,
    } : null,

    outfit: outfit || null,

    ready_to_run: alerts.length === 0,
    pre_run_checklist: [
      plannedWorkout?.isKeyWorkout ? 'Key workout - make sure you\'re fresh and fueled' : null,
      weather?.temperature_f && weather.temperature_f > 70 ? 'Warm out - hydrate before and consider carrying water' : null,
      weather?.temperature_f && weather.temperature_f < 40 ? 'Cold out - longer warmup recommended' : null,
      plannedWorkout?.workoutType === 'interval' ? 'Dynamic warmup before intervals (leg swings, high knees)' : null,
    ].filter(Boolean),
  };
}

async function getWeeklyReview(input: Record<string, unknown>) {
  const weekOffset = (input.week_offset as number) ?? -1; // Default to last week

  // Calculate week dates
  const today = new Date();
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  // Get training journey context
  const todayStr = today.toISOString().split('T')[0];
  const reviewProfileId = await getActiveProfileId();
  const goalRace = await db.query.races.findFirst({
    where: reviewProfileId
      ? and(eq(races.profileId, reviewProfileId), eq(races.priority, 'A'), gte(races.date, todayStr))
      : and(eq(races.priority, 'A'), gte(races.date, todayStr)),
    orderBy: [asc(races.date)],
  });

  let trainingContext = null;
  let reviewedWeekContext = null;
  if (goalRace) {
    // Get the training week being reviewed
    reviewedWeekContext = await db.query.trainingBlocks.findFirst({
      where: and(
        eq(trainingBlocks.raceId, goalRace.id),
        lte(trainingBlocks.startDate, startStr),
        gte(trainingBlocks.endDate, startStr)
      ),
    });

    // Get current week for countdown
    const raceDate = new Date(goalRace.date);
    const daysUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const weeksUntilRace = Math.ceil(daysUntilRace / 7);

    trainingContext = {
      goal_race: goalRace.name,
      race_date: goalRace.date,
      weeks_until_race: weeksUntilRace,
      reviewed_week: reviewedWeekContext ? {
        phase: reviewedWeekContext.phase,
        week_number: reviewedWeekContext.weekNumber,
        focus: reviewedWeekContext.focus,
        target_mileage: reviewedWeekContext.targetMileage,
      } : null,
    };
  }

  // Get completed workouts
  const recapProfileId = await getActiveProfileId();
  const completedWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: recapProfileId
      ? and(eq(workouts.profileId, recapProfileId), gte(workouts.date, startStr), lte(workouts.date, endStr))
      : and(gte(workouts.date, startStr), lte(workouts.date, endStr)),
    with: { assessment: true },
    orderBy: [asc(workouts.date)],
  });

  // Get planned workouts
  const plannedForWeek = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startStr),
      lte(plannedWorkouts.date, endStr)
    ),
  });

  // Calculate metrics
  const totalMiles = completedWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalRuns = completedWorkouts.length;
  const avgPace = completedWorkouts.filter(w => w.avgPaceSeconds).length > 0
    ? completedWorkouts.reduce((sum, w) => sum + (w.avgPaceSeconds || 0), 0) /
      completedWorkouts.filter(w => w.avgPaceSeconds).length
    : null;

  // Assessment metrics
  const assessedWorkouts = completedWorkouts.filter(w => w.assessment);
  const avgRpe = assessedWorkouts.length > 0
    ? assessedWorkouts.reduce((sum, w) => sum + (w.assessment?.rpe || 0), 0) / assessedWorkouts.length
    : null;

  const verdictCounts: Record<string, number> = {};
  assessedWorkouts.forEach(w => {
    const v = w.assessment?.verdict;
    if (v) verdictCounts[v] = (verdictCounts[v] || 0) + 1;
  });

  // Plan adherence
  const plannedMiles = plannedForWeek.reduce((sum: number, p: { targetDistanceMiles: number | null }) => sum + (p.targetDistanceMiles || 0), 0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _plannedWorkoutCount = plannedForWeek.filter((p: { status: string }) => p.status === 'scheduled' || p.status === 'completed').length;
  const completedPlanned = plannedForWeek.filter((p: { status: string }) => p.status === 'completed').length;
  const skippedWorkouts = plannedForWeek.filter((p: { status: string }) => p.status === 'skipped').length;

  // Identify highlights and concerns
  const highlights: string[] = [];
  const concerns: string[] = [];

  // Good week indicators
  if (verdictCounts['great'] && verdictCounts['great'] >= 2) {
    highlights.push(`${verdictCounts['great']} workouts rated "great"`);
  }
  if (totalMiles >= plannedMiles * 0.9 && plannedMiles > 0) {
    highlights.push(`Hit ${Math.round((totalMiles / plannedMiles) * 100)}% of planned mileage`);
  }
  if (avgRpe && avgRpe <= 5.5 && totalMiles > 20) {
    highlights.push('Good volume at manageable effort');
  }

  // Key workouts
  const keyWorkouts = completedWorkouts.filter(w =>
    w.workoutType === 'tempo' || w.workoutType === 'interval' || w.workoutType === 'long'
  );
  if (keyWorkouts.length >= 2) {
    highlights.push(`Completed ${keyWorkouts.length} key workouts`);
  }

  // Concerns
  if (verdictCounts['rough'] && verdictCounts['rough'] >= 2) {
    concerns.push(`${verdictCounts['rough']} workouts felt rough`);
  }
  if (verdictCounts['awful']) {
    concerns.push(`${verdictCounts['awful']} workout(s) felt awful - worth investigating`);
  }
  if (skippedWorkouts >= 2) {
    concerns.push(`${skippedWorkouts} workouts skipped`);
  }
  if (avgRpe && avgRpe > 7) {
    concerns.push(`High average RPE (${avgRpe.toFixed(1)}) - training felt hard`);
  }

  // Workout breakdown by type
  const byType: Record<string, { count: number; miles: number }> = {};
  completedWorkouts.forEach(w => {
    if (!byType[w.workoutType]) byType[w.workoutType] = { count: 0, miles: 0 };
    byType[w.workoutType].count++;
    byType[w.workoutType].miles += w.distanceMiles || 0;
  });

  return {
    week: `${startStr} to ${endStr}`,
    week_offset: weekOffset,

    // Training journey context
    training_context: trainingContext,

    summary: {
      total_miles: Math.round(totalMiles * 10) / 10,
      total_runs: totalRuns,
      avg_pace: avgPace ? formatPaceFromTraining(Math.round(avgPace)) : null,
      avg_rpe: avgRpe ? Math.round(avgRpe * 10) / 10 : null,
    },

    plan_adherence: plannedMiles > 0 ? {
      planned_miles: Math.round(plannedMiles * 10) / 10,
      actual_miles: Math.round(totalMiles * 10) / 10,
      percent_completed: Math.round((totalMiles / plannedMiles) * 100),
      workouts_completed: completedPlanned,
      workouts_skipped: skippedWorkouts,
    } : null,

    workout_breakdown: Object.entries(byType).map(([type, data]) => ({
      type,
      count: data.count,
      miles: Math.round(data.miles * 10) / 10,
    })),

    verdicts: verdictCounts,

    highlights,
    concerns,

    daily_log: completedWorkouts.map(w => ({
      date: w.date,
      type: w.workoutType,
      miles: w.distanceMiles,
      pace: w.avgPaceSeconds ? formatPaceFromTraining(w.avgPaceSeconds) : null,
      verdict: w.assessment?.verdict || null,
      rpe: w.assessment?.rpe || null,
    })),

    coaching_note: generateWeeklyCoachingNote(highlights, concerns, totalMiles, avgRpe),
  };
}

function generateWeeklyCoachingNote(
  highlights: string[],
  concerns: string[],
  totalMiles: number,
  avgRpe: number | null
): string {
  if (concerns.length > highlights.length) {
    return 'Tough week. Focus on recovery before pushing hard again. One rough week doesn\'t define your training.';
  }
  if (highlights.length >= 2 && concerns.length === 0) {
    return 'Strong week! You\'re building fitness. Keep the consistency going.';
  }
  if (totalMiles > 0 && (!avgRpe || avgRpe <= 6)) {
    return 'Solid training week. You\'re putting in the work without overdoing it.';
  }
  return 'Another week in the books. Consistency over time is what builds fitness.';
}

async function suggestNextWorkout(input: Record<string, unknown>) {
  const availableTime = input.available_time_minutes as number | undefined;
  const preference = input.preference as string | undefined;

  // Get recent workouts
  const suggestProfileId = await getActiveProfileId();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const recentWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: suggestProfileId
      ? and(eq(workouts.profileId, suggestProfileId), gte(workouts.date, cutoff.toISOString().split('T')[0]))
      : gte(workouts.date, cutoff.toISOString().split('T')[0]),
    with: { assessment: true },
    orderBy: [desc(workouts.date)],
  });

  // Get injury status
  const injuries = await getInjuryStatus();

  // Get fatigue indicators
  const fatigue = await getFatigueIndicators({ days_back: 7 });

  // Get user settings for pace zones
  const s = await getSettingsForProfile();
  const paceZones = s?.vdot ? calculatePaceZones(s.vdot) : null;

  // Analyze recent training
  const recentMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const lastWorkout = recentWorkouts[0];
  const lastWorkoutDate = lastWorkout ? new Date(lastWorkout.date) : null;
  const daysSinceLastRun = lastWorkoutDate
    ? Math.floor((Date.now() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const recentHardWorkouts = recentWorkouts.filter(w =>
    w.workoutType === 'tempo' || w.workoutType === 'interval' || w.workoutType === 'steady'
  );
  const recentLongRuns = recentWorkouts.filter(w => w.workoutType === 'long');

  // Determine what makes sense
  let suggestedType = 'easy';
  let suggestedDistance = 5;
  const reasoning: string[] = [];

  // Check restrictions first
  const restrictionsList = injuries.restrictions as string[];
  if (restrictionsList.includes('no_running')) {
    return {
      suggestion: 'Cross-train',
      type: 'cross_train',
      reasoning: ['Active injury restriction - no running currently'],
      alternatives: ['Pool running', 'Cycling', 'Elliptical'],
    };
  }

  if (restrictionsList.includes('easy_only')) {
    suggestedType = 'easy';
    reasoning.push('Easy only due to injury restriction');
  } else if (fatigue.overall_status === 'Fatigue Accumulation') {
    suggestedType = 'easy';
    reasoning.push('Fatigue indicators suggest recovery needed');
  } else if (preference === 'easy' || preference === 'short') {
    suggestedType = 'easy';
    reasoning.push('Based on your preference');
  } else if (daysSinceLastRun >= 3) {
    suggestedType = 'easy';
    reasoning.push('Been a few days - ease back in');
  } else if (preference === 'hard' && recentHardWorkouts.length < 2) {
    suggestedType = 'tempo';
    reasoning.push('Ready for quality work');
  } else if (preference === 'long' && recentLongRuns.length === 0) {
    suggestedType = 'long';
    reasoning.push('No long run this week yet');
  } else {
    // Default logic
    if (lastWorkout?.workoutType === 'tempo' || lastWorkout?.workoutType === 'interval') {
      suggestedType = 'easy';
      reasoning.push('Recovery after yesterday\'s quality session');
    } else if (recentHardWorkouts.length === 0 && recentMiles > 15) {
      suggestedType = 'tempo';
      reasoning.push('Good base this week, ready for quality');
    } else if (recentLongRuns.length === 0 && recentMiles > 20) {
      suggestedType = 'long';
      reasoning.push('Week needs a long run');
    } else {
      suggestedType = 'easy';
      reasoning.push('Easy running builds aerobic base');
    }
  }

  // Determine distance
  if (availableTime) {
    // Estimate pace based on type
    const easyPace = paceZones?.easy || 540; // 9:00 default
    const tempoTargetPace = paceZones?.tempo || 420; // 7:00 default

    const paceToUse = suggestedType === 'easy' ? easyPace : tempoTargetPace;
    suggestedDistance = Math.round((availableTime / (paceToUse / 60)) * 10) / 10;
    reasoning.push(`Based on ${availableTime} minutes available`);
  } else {
    if (suggestedType === 'easy') suggestedDistance = 5;
    else if (suggestedType === 'tempo') suggestedDistance = 6;
    else if (suggestedType === 'long') suggestedDistance = Math.max(10, recentMiles * 0.3);
  }

  // Cap based on restrictions
  if (restrictionsList.includes('reduced_mileage')) {
    suggestedDistance = Math.min(suggestedDistance, 6);
    reasoning.push('Distance capped due to mileage restriction');
  }

  // Fetch threshold pace and recovery status in parallel for pace guidance
  let thresholdPaceInfo: {
    threshold_pace: string;
    confidence: number;
    method: string;
    tempo_range: string;
  } | null = null;
  let recoveryInfo: {
    ready_for_quality: boolean;
    hours_until_ready: number;
    recovery_score: number;
  } | null = null;

  try {
    const [thresholdResult, recoveryResult] = await Promise.all([
      getThresholdEstimate().catch(() => null),
      getRecoveryAnalysis().catch(() => null),
    ]);

    if (thresholdResult?.success && thresholdResult.data.method !== 'insufficient_data') {
      const t = thresholdResult.data;
      const thresholdSec = t.thresholdPaceSecondsPerMile;
      thresholdPaceInfo = {
        threshold_pace: formatPaceFromTraining(thresholdSec),
        confidence: Math.round(t.confidence * 100),
        method: t.method,
        // Tempo range: threshold +5 to -5 sec/mi
        tempo_range: `${formatPaceFromTraining(thresholdSec - 5)}-${formatPaceFromTraining(thresholdSec + 5)}/mi`,
      };
    }

    if (recoveryResult?.success) {
      const r = recoveryResult.data;
      recoveryInfo = {
        ready_for_quality: r.readyForQuality,
        hours_until_ready: r.estimatedRecoveryHours,
        recovery_score: r.recoveryScore,
      };
      // Override suggestion if recovery model says not ready for quality
      if (!r.readyForQuality && (suggestedType === 'tempo' || suggestedType === 'interval')) {
        suggestedType = 'easy';
        reasoning.push(`Recovery model: ${Math.round(r.estimatedRecoveryHours)}h until ready for quality work`);
      }
    }
  } catch {
    // Threshold/recovery fetch failed, continue with VDOT-based pacing
  }

  // Build the suggestion — use auto-detected threshold pace when available
  let paceGuidance: string;
  if (suggestedType === 'easy') {
    paceGuidance = paceZones?.easy
      ? `${formatPaceFromTraining(paceZones.easy - 30)}-${formatPaceFromTraining(paceZones.easy + 30)}/mi`
      : 'Conversational pace';
  } else if (suggestedType === 'tempo' || suggestedType === 'threshold') {
    if (thresholdPaceInfo) {
      paceGuidance = `${thresholdPaceInfo.tempo_range} (auto-detected threshold: ${thresholdPaceInfo.threshold_pace}/mi)`;
    } else if (paceZones?.tempo) {
      paceGuidance = `${formatPaceFromTraining(paceZones.tempo)}/mi`;
    } else {
      paceGuidance = 'Comfortably hard';
    }
  } else {
    paceGuidance = 'Easy pace, focus on time on feet';
  }

  const result = {
    suggestion: `${suggestedType.charAt(0).toUpperCase() + suggestedType.slice(1)} ${suggestedDistance} miles`,
    type: suggestedType,
    distance_miles: suggestedDistance,
    pace_guidance: paceGuidance,
    reasoning,
    context: {
      days_since_last_run: daysSinceLastRun,
      recent_miles_7_days: Math.round(recentMiles * 10) / 10,
      recent_hard_workouts: recentHardWorkouts.length,
      fatigue_status: fatigue.overall_status,
    },
    // Threshold pace from auto-detection (if available)
    threshold_pace: thresholdPaceInfo,
    // Recovery model status
    recovery_status: recoveryInfo,
    alternatives: suggestedType === 'easy'
      ? ['Rest day if feeling tired', 'Strides at the end if feeling good']
      : suggestedType === 'tempo'
        ? ['Fartlek for variety', 'Easy run if not feeling it']
        : ['Shorter run if time-crunched', 'Add strides in the middle'],
  };

  return result;
}

async function analyzeCompletedWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { assessment: true },
  });

  if (!workout) {
    return { success: false, error: 'Workout not found' };
  }

  // Find the planned workout for this date
  const plannedWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, workout.date),
  });

  const analysis: {
    workout_date: string;
    actual: Record<string, unknown>;
    planned: Record<string, unknown> | null;
    comparison: string[];
    verdict_analysis: string | null;
    coaching_feedback: string[];
  } = {
    workout_date: workout.date,
    actual: {
      type: workout.workoutType,
      distance: workout.distanceMiles,
      pace: workout.avgPaceSeconds ? formatPaceFromTraining(workout.avgPaceSeconds) : null,
      duration: workout.durationMinutes,
      rpe: workout.assessment?.rpe,
      verdict: workout.assessment?.verdict,
    },
    planned: null,
    comparison: [],
    verdict_analysis: null,
    coaching_feedback: [],
  };

  if (plannedWorkout) {
    analysis.planned = {
      name: plannedWorkout.name,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      pace: plannedWorkout.targetPaceSecondsPerMile
        ? formatPaceFromTraining(plannedWorkout.targetPaceSecondsPerMile)
        : null,
    };

    // Compare distance
    if (workout.distanceMiles && plannedWorkout.targetDistanceMiles) {
      const distDiff = workout.distanceMiles - plannedWorkout.targetDistanceMiles;
      if (Math.abs(distDiff) < 0.5) {
        analysis.comparison.push('Distance: Hit the target ✓');
      } else if (distDiff > 0) {
        analysis.comparison.push(`Distance: Ran ${distDiff.toFixed(1)} more than planned`);
      } else {
        analysis.comparison.push(`Distance: Ran ${Math.abs(distDiff).toFixed(1)} less than planned`);
      }
    }

    // Compare pace
    if (workout.avgPaceSeconds && plannedWorkout.targetPaceSecondsPerMile) {
      const paceDiff = workout.avgPaceSeconds - plannedWorkout.targetPaceSecondsPerMile;
      if (Math.abs(paceDiff) <= 10) {
        analysis.comparison.push('Pace: Right on target ✓');
      } else if (paceDiff < 0) {
        analysis.comparison.push(`Pace: ${Math.abs(Math.round(paceDiff))} sec/mi faster than target`);
      } else {
        analysis.comparison.push(`Pace: ${Math.round(paceDiff)} sec/mi slower than target`);
      }
    }

    // Compare type
    if (workout.workoutType !== plannedWorkout.workoutType) {
      analysis.comparison.push(`Type: Did ${workout.workoutType} instead of ${plannedWorkout.workoutType}`);
    }
  }

  // Analyze verdict and RPE
  if (workout.assessment?.verdict) {
    const v = workout.assessment.verdict;
    const rpe = workout.assessment.rpe;

    if (v === 'great') {
      analysis.verdict_analysis = 'You rated this great - everything clicked today.';
      analysis.coaching_feedback.push('Nice work! These are the runs that build confidence.');
    } else if (v === 'good') {
      analysis.verdict_analysis = 'Solid effort. This is what consistent training looks like.';
    } else if (v === 'fine') {
      analysis.verdict_analysis = 'Got it done. Not every run needs to feel amazing.';
    } else if (v === 'rough') {
      analysis.verdict_analysis = 'Tough one. Worth checking sleep, stress, or fueling.';
      analysis.coaching_feedback.push('Rough runs happen. What matters is you showed up.');
      if (rpe && rpe >= 7) {
        analysis.coaching_feedback.push('High effort on a rough day - take it easier tomorrow.');
      }
    } else if (v === 'awful') {
      analysis.verdict_analysis = 'Really struggled. That\'s valuable data.';
      analysis.coaching_feedback.push('Awful runs are signals, not failures. Consider extra recovery.');
    }

    // RPE vs workout type analysis
    if (rpe && plannedWorkout) {
      if (plannedWorkout.workoutType === 'easy' && rpe > 5) {
        analysis.coaching_feedback.push(`RPE ${rpe} is high for an easy run. Slow down to make easy truly easy.`);
      }
      if (plannedWorkout.workoutType === 'tempo' && rpe < 6) {
        analysis.coaching_feedback.push('Tempo felt easier than expected. Fitness is building!');
      }
      if (plannedWorkout.workoutType === 'tempo' && rpe >= 9) {
        analysis.coaching_feedback.push('Tempo felt very hard. Might need to adjust target pace or prioritize recovery.');
      }
    }
  }

  if (analysis.coaching_feedback.length === 0) {
    analysis.coaching_feedback.push('Run logged. Keep building that consistency.');
  }

  return analysis;
}

async function explainWorkoutDifficulty(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  // Get the workout with assessment
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { assessment: true },
  });

  if (!workout) {
    return { success: false, error: 'Workout not found' };
  }

  if (!workout.assessment) {
    return {
      success: false,
      error: 'No assessment found for this workout. Need RPE and verdict data to analyze difficulty.'
    };
  }

  // Gather data for analysis
  const workoutDate = new Date(workout.date);
  const factors: Array<{ factor: string; impact: 'harder' | 'easier' | 'neutral'; explanation: string }> = [];

  // 1. Sleep quality from assessment
  if (workout.assessment.sleepQuality !== null) {
    const sleepHours = workout.assessment.sleepQuality;
    if (sleepHours < 6) {
      factors.push({
        factor: 'Poor sleep',
        impact: 'harder',
        explanation: `${sleepHours} hours vs your usual 7-8 hours`,
      });
    } else if (sleepHours >= 8) {
      factors.push({
        factor: 'Good sleep',
        impact: 'easier',
        explanation: `${sleepHours} hours of quality rest`,
      });
    }
  }

  // 2. Training load / TSB
  const cutoffDate = new Date(workoutDate);
  cutoffDate.setDate(cutoffDate.getDate() - 28);
  const recentWorkouts = await db.query.workouts.findMany({
    where: and(
      eq(workouts.profileId, profileId),
      gte(workouts.date, cutoffDate.toISOString().split('T')[0]),
      lt(workouts.date, workout.date)
    ),
    with: { assessment: true },
    orderBy: [desc(workouts.date)],
  });

  // Calculate acute (7-day) and chronic (28-day) load
  const sevenDaysAgo = new Date(workoutDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const last7DaysWorkouts = recentWorkouts.filter((w: typeof recentWorkouts[number]) =>
    new Date(w.date) >= sevenDaysAgo
  );
  const acuteMiles = last7DaysWorkouts.reduce((sum: number, w: typeof recentWorkouts[number]) => sum + (w.distanceMiles || 0), 0);
  const chronicMiles = recentWorkouts.reduce((sum: number, w: typeof recentWorkouts[number]) => sum + (w.distanceMiles || 0), 0) / 4;

  // Training Stress Balance (simplified)
  const tsb = chronicMiles - acuteMiles;
  if (tsb < -10) {
    factors.push({
      factor: 'High fatigue',
      impact: 'harder',
      explanation: `TSB: ${tsb.toFixed(0)} (accumulated fatigue from ${acuteMiles.toFixed(0)}mi this week)`,
    });
  } else if (tsb > 5) {
    factors.push({
      factor: 'Well rested',
      impact: 'easier',
      explanation: `TSB: ${tsb.toFixed(0)} (fresh legs from lighter recent volume)`,
    });
  }

  // 3. Weather conditions
  if (workout.temperature !== null && workout.humidity !== null) {
    const heatIndex = workout.temperature + (workout.humidity > 60 ? 10 : 0);
    if (heatIndex > 75) {
      factors.push({
        factor: 'Hot conditions',
        impact: 'harder',
        explanation: `${workout.temperature}°F with ${workout.humidity}% humidity adds ~${Math.round(heatIndex - 70) * 3} sec/mi effort`,
      });
    } else if (workout.temperature < 35) {
      factors.push({
        factor: 'Cold conditions',
        impact: 'harder',
        explanation: `${workout.temperature}°F requires extra warmup and impacts efficiency`,
      });
    } else if (workout.temperature >= 45 && workout.temperature <= 65 && workout.humidity < 60) {
      factors.push({
        factor: 'Ideal conditions',
        impact: 'easier',
        explanation: `${workout.temperature}°F with low humidity`,
      });
    }
  }

  // 4. Days since last hard effort
  const hardWorkouts = recentWorkouts.filter((w: typeof recentWorkouts[number]) =>
    w.workoutType && ['tempo', 'threshold', 'interval', 'race'].includes(w.workoutType)
  );

  if (hardWorkouts.length > 0) {
    const lastHard = hardWorkouts[0];
    const daysSinceHard = Math.floor(
      (workoutDate.getTime() - new Date(lastHard.date).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceHard < 2) {
      factors.push({
        factor: 'Insufficient recovery',
        impact: 'harder',
        explanation: `Only ${daysSinceHard} days since last ${lastHard.workoutType} workout`,
      });
    } else if (daysSinceHard > 7) {
      factors.push({
        factor: 'Fresh for quality',
        impact: 'easier',
        explanation: `${daysSinceHard} days since last hard effort`,
      });
    }
  }

  // 5. Weekly mileage vs typical
  const userSettingsData = await db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1);
  const typicalWeekly = userSettingsData[0]?.currentWeeklyMileage || 30;

  if (acuteMiles > typicalWeekly * 1.2) {
    factors.push({
      factor: 'High weekly volume',
      impact: 'harder',
      explanation: `${acuteMiles.toFixed(0)}mi this week vs ${typicalWeekly}mi typical`,
    });
  }

  // 6. Specific workout factors
  if (workout.assessment.stress && workout.assessment.stress >= 8) {
    factors.push({
      factor: 'High life stress',
      impact: 'harder',
      explanation: 'Stress level 8+ impacts recovery and performance',
    });
  }

  if (workout.assessment.soreness && workout.assessment.soreness >= 7) {
    factors.push({
      factor: 'Muscle soreness',
      impact: 'harder',
      explanation: `Soreness level ${workout.assessment.soreness}/10 affects efficiency`,
    });
  }

  // 7. Time of day
  if (workout.timeOfRun) {
    if (workout.timeOfRun === 'early_morning' && workout.assessment.sleepQuality && workout.assessment.sleepQuality < 7) {
      factors.push({
        factor: 'Early morning + poor sleep',
        impact: 'harder',
        explanation: 'Body not fully awake, glycogen stores lower',
      });
    }
  }

  // Calculate predominant impact
  const harderCount = factors.filter(f => f.impact === 'harder').length;
  const easierCount = factors.filter(f => f.impact === 'easier').length;

  // Build explanation
  const rpe = workout.assessment.rpe;
  const verdict = workout.assessment.verdict;
  const pace = workout.avgPaceSeconds ? formatPaceFromTraining(workout.avgPaceSeconds) : null;

  let summary: string;
  if (verdict === 'awful' || verdict === 'rough' || (rpe && rpe >= 8)) {
    const topHardFactors = factors
      .filter(f => f.impact === 'harder')
      .slice(0, 3)
      .map(f => f.explanation)
      .join(', ');

    summary = topHardFactors
      ? `This run felt hard because: ${topHardFactors}.`
      : 'This run felt hard, likely due to accumulated fatigue or external factors.';
  } else if (verdict === 'great' || (rpe && rpe <= 5)) {
    const topEasyFactors = factors
      .filter(f => f.impact === 'easier')
      .slice(0, 2)
      .map(f => f.explanation)
      .join(' and ');

    summary = topEasyFactors
      ? `This run felt good because of ${topEasyFactors}.`
      : 'This run felt good - your body was ready for the effort.';
  } else {
    summary = `This run felt typical with ${harderCount} factors making it harder and ${easierCount} making it easier.`;
  }

  // Add pace vs effort insight
  if (pace && rpe) {
    const settings = await db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1);
    const easyPace = settings[0]?.easyPaceSeconds || 540;

    if (workout.workoutType === 'easy' && workout.avgPaceSeconds) {
      const paceVsTypical = workout.avgPaceSeconds - easyPace;
      if (paceVsTypical > 30 && rpe > 6) {
        summary += ` Your ${pace}/mi pace was ${Math.round(paceVsTypical)} seconds slower than usual, confirming the higher perceived effort.`;
      } else if (paceVsTypical < -20 && rpe <= 5) {
        summary += ` You ran ${Math.abs(Math.round(paceVsTypical))} seconds faster than usual at ${pace}/mi while it still felt easy - fitness improving!`;
      }
    }
  }

  return {
    success: true,
    workout_summary: {
      date: workout.date,
      type: workout.workoutType,
      distance: workout.distanceMiles,
      pace: pace,
      rpe: rpe,
      verdict: verdict,
    },
    explanation: summary,
    contributing_factors: factors,
    training_context: {
      acute_load: `${acuteMiles.toFixed(1)}mi last 7 days`,
      chronic_load: `${chronicMiles.toFixed(1)}mi/week average`,
      tsb: tsb.toFixed(0),
      days_since_hard_effort: hardWorkouts.length > 0
        ? Math.floor((workoutDate.getTime() - new Date(hardWorkouts[0].date).getTime()) / (1000 * 60 * 60 * 24))
        : 'N/A',
    },
    recommendation: tsb < -10
      ? 'Consider an easy day or rest tomorrow to allow adaptation.'
      : harderCount > easierCount
      ? 'Normal to feel this way given the circumstances. Stay consistent.'
      : 'Good conditions for quality work if feeling recovered.',
  };
}

async function getUpcomingWeekPreview() {
  // Get this week and next week's workouts
  const today = new Date();
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + mondayOffset);

  const nextSunday = new Date(thisMonday);
  nextSunday.setDate(thisMonday.getDate() + 13); // This week + next week

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const startStr = thisMonday.toISOString().split('T')[0];
  const endStr = nextSunday.toISOString().split('T')[0];

  const upcomingWorkouts = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, today.toISOString().split('T')[0]),
      lte(plannedWorkouts.date, endStr),
      eq(plannedWorkouts.status, 'scheduled')
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  // Get injury status
  const injuries = await getInjuryStatus();

  // Get fatigue status
  const fatigue = await getFatigueIndicators({ days_back: 7 });

  // Identify key workouts
  type PlannedWorkoutType = { date: string; name: string; workoutType: string; targetDistanceMiles: number | null; targetPaceSecondsPerMile: number | null; isKeyWorkout: boolean };
  const keyWorkouts = upcomingWorkouts.filter((w: PlannedWorkoutType) => w.isKeyWorkout);

  // Calculate planned miles
  const plannedMiles = upcomingWorkouts.reduce((sum: number, w: PlannedWorkoutType) => sum + (w.targetDistanceMiles || 0), 0);

  // Check for concerns
  const concerns: string[] = [];

  if (injuries.has_restrictions) {
    const injuryRestrictions = injuries.restrictions as string[];
    const conflictingWorkouts = upcomingWorkouts.filter((w: PlannedWorkoutType) => {
      if (injuryRestrictions.includes('no_speed_work') &&
          ['tempo', 'interval'].includes(w.workoutType)) return true;
      if (injuryRestrictions.includes('no_hills') &&
          w.name.toLowerCase().includes('hill')) return true;
      if (injuryRestrictions.includes('no_long_runs') &&
          w.workoutType === 'long' && (w.targetDistanceMiles || 0) > 10) return true;
      return false;
    });
    if (conflictingWorkouts.length > 0) {
      concerns.push(`${conflictingWorkouts.length} workout(s) may conflict with injury restrictions`);
    }
  }

  if (fatigue.overall_status === 'Fatigue Accumulation') {
    concerns.push('Fatigue is high - consider modifying the week');
  }

  // Back-to-back quality check
  for (let i = 0; i < upcomingWorkouts.length - 1; i++) {
    const w1 = upcomingWorkouts[i];
    const w2 = upcomingWorkouts[i + 1];
    const d1 = new Date(w1.date);
    const d2 = new Date(w2.date);
    const daysBetween = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);

    if (daysBetween === 1 &&
        ['tempo', 'interval', 'long'].includes(w1.workoutType) &&
        ['tempo', 'interval', 'long'].includes(w2.workoutType)) {
      concerns.push(`Back-to-back hard efforts: ${w1.name} (${w1.date}) and ${w2.name} (${w2.date})`);
    }
  }

  const formatPace = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  return {
    period: `${today.toISOString().split('T')[0]} through ${endStr}`,
    total_workouts: upcomingWorkouts.length,
    total_planned_miles: Math.round(plannedMiles * 10) / 10,
    key_workouts: keyWorkouts.length,

    concerns,
    has_concerns: concerns.length > 0,

    workouts: upcomingWorkouts.map((w: PlannedWorkoutType) => ({
      date: w.date,
      day: new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
      name: w.name,
      type: w.workoutType,
      distance: w.targetDistanceMiles,
      pace: formatPace(w.targetPaceSecondsPerMile),
      is_key: w.isKeyWorkout,
    })),

    focus_areas: keyWorkouts.length > 0
      ? keyWorkouts.map((w: PlannedWorkoutType) => `${w.name} on ${new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}`)
      : ['Consistent easy running this week'],

    coaching_preview: generateWeekPreviewNote(keyWorkouts.length, plannedMiles, concerns.length),
  };
}

function generateWeekPreviewNote(keyWorkouts: number, plannedMiles: number, concernCount: number): string {
  if (concernCount > 0) {
    return 'Some things to watch this week. Address the concerns above before pushing hard.';
  }
  if (keyWorkouts >= 3) {
    return 'Big week ahead with multiple key sessions. Prioritize recovery between hard efforts.';
  }
  if (keyWorkouts === 0) {
    return 'Recovery-focused week. Use this time to absorb recent training.';
  }
  return `${keyWorkouts} key workout(s) and ${Math.round(plannedMiles)} miles planned. Solid week ahead.`;
}

export {
  getContextSummary,
  getPhaseDescription,
  getPreRunBriefing,
  getWeeklyReview,
  generateWeeklyCoachingNote,
  suggestNextWorkout,
  analyzeCompletedWorkout,
  explainWorkoutDifficulty,
  getUpcomingWeekPreview,
  generateWeekPreviewNote,
};
