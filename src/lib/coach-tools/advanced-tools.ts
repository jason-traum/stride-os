// advanced-tools - Coach tool implementations
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


async function getPrepForTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Get tomorrow's planned workout
  const tomorrowWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, tomorrowStr),
  });

  if (!tomorrowWorkout) {
    return {
      date: tomorrowStr,
      day: tomorrow.toLocaleDateString('en-US', { weekday: 'long' }),
      workout: null,
      message: 'Rest day tomorrow! Take it easy.',
    };
  }

  // Get user settings
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const s = await getSettingsForProfile();

  // Get weather forecast (would need weather API for tomorrow)
  // For now, use generic recommendations
  const prep = {
    date: tomorrowStr,
    day: tomorrow.toLocaleDateString('en-US', { weekday: 'long' }),
    workout: {
      name: tomorrowWorkout.name,
      type: tomorrowWorkout.workoutType,
      distance: tomorrowWorkout.targetDistanceMiles,
      pace: tomorrowWorkout.targetPaceSecondsPerMile
        ? formatPaceFromTraining(tomorrowWorkout.targetPaceSecondsPerMile)
        : null,
      is_key_workout: tomorrowWorkout.isKeyWorkout,
    },
    preparation: {
      tonight: [
        'Lay out your running clothes',
        tomorrowWorkout.isKeyWorkout ? 'Get to bed on time - quality sleep for quality workout' : 'Normal bedtime routine',
        'Charge your watch/phone',
      ],
      morning: [
        tomorrowWorkout.workoutType === 'long'
          ? 'Eat breakfast 2-3 hours before'
          : 'Light snack or coffee as usual',
        'Dynamic warmup before hard efforts',
      ],
    },
    gear_checklist: [
      'Running shoes',
      'Watch/GPS',
      tomorrowWorkout.targetDistanceMiles && tomorrowWorkout.targetDistanceMiles >= 10
        ? 'Hydration/fuel'
        : null,
      tomorrowWorkout.workoutType === 'interval' ? 'Track access or measured segment' : null,
    ].filter(Boolean),
    mental_note: tomorrowWorkout.isKeyWorkout
      ? 'Key workout tomorrow - trust your training and execute the plan!'
      : 'Enjoy the run!',
  };

  return prep;
}

async function overrideWorkoutStructure(input: Record<string, unknown>) {
  let workoutId = input.workout_id as number | undefined;
  const structure = input.structure as string;
  const workoutType = input.workout_type as string | undefined;

  // If no workout_id provided, get the most recent workout for this profile
  if (!workoutId) {
    const overrideProfileId = await getActiveProfileId();
    const recent = await db.query.workouts.findFirst({
      where: overrideProfileId ? eq(workouts.profileId, overrideProfileId) : undefined,
      orderBy: [desc(workouts.createdAt)],
    });
    if (!recent) {
      return {
        success: false,
        error: 'No workouts found to update',
      };
    }
    workoutId = recent.id;
  }

  // Get the workout to update
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId as number),
  });

  if (!workout) {
    return {
      success: false,
      error: `Workout ${workoutId} not found`,
    };
  }

  // Build update object
  const updateData: Partial<typeof workouts.$inferInsert> = {
    structureOverride: structure,
    updatedAt: new Date().toISOString(),
  };

  // Update workout type if provided
  if (workoutType) {
    updateData.category = workoutType;
    updateData.workoutType = workoutType as WorkoutType;
  }

  // Update the workout
  await db
    .update(workouts)
    .set(updateData)
    .where(eq(workouts.id, workoutId as number));

  return {
    success: true,
    workout_id: workoutId,
    date: workout.date,
    original_type: workout.workoutType,
    new_type: workoutType || workout.workoutType,
    structure_override: structure,
    message: `Updated workout from ${workout.date}. Structure set to: "${structure}"${workoutType ? `, type changed to ${workoutType}` : ''}.`,
  };
}

async function getPerformanceModel() {
  // Fetch performance model and analytics in parallel
  const [model, fatigueResult, splitResult, economyResult] = await Promise.all([
    buildPerformanceModel(),
    getFatigueResistanceData(180).catch(() => null),  // 6 months
    getSplitTendencyData(180).catch(() => null),       // 6 months
    getRunningEconomyData(180).catch(() => null),      // 6 months
  ]);

  // Format paces for readability
  const formatPace = (seconds: number) => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  // Build fatigue resistance summary for coach
  let fatigueResistanceSummary: Record<string, unknown> | null = null;
  if (fatigueResult && fatigueResult.success && fatigueResult.data.timeSeries.length > 0) {
    const fr = fatigueResult.data;
    const typeBreakdown: Record<string, string> = {};
    for (const [type, data] of Object.entries(fr.stats.averageByType)) {
      if (data.count >= 2) {
        typeBreakdown[type] = `${data.avg}% (${data.count} runs)`;
      }
    }
    fatigueResistanceSummary = {
      average_percent: fr.stats.average,
      trend: fr.stats.trend,
      interpretation: fr.stats.average >= 100
        ? 'Excellent pacer - tends to negative split or hold pace well.'
        : fr.stats.average >= 97
          ? 'Good fatigue resistance - minor fade in the final quarter is normal.'
          : fr.stats.average >= 93
            ? 'Moderate fade late in runs. Could benefit from tempo work and progressive long runs.'
            : 'Notable pace drop-off late in runs. Focus on even pacing and fatigue resistance workouts.',
      by_workout_type: Object.keys(typeBreakdown).length > 0 ? typeBreakdown : undefined,
      data_points: fr.timeSeries.length,
    };
  }

  // Build split tendency summary for coach
  let splitTendencySummary: Record<string, unknown> | null = null;
  if (splitResult && splitResult.success && splitResult.data.totalAnalyzed > 0) {
    const sp = splitResult.data;
    const typeTendencies: Record<string, string> = {};
    for (const summary of sp.summaryByType) {
      if (summary.totalCount >= 2) {
        const dominant = summary.positiveCount > summary.negativeCount
          ? 'positive split'
          : summary.negativeCount > summary.positiveCount
            ? 'negative split'
            : 'even split';
        typeTendencies[summary.workoutType] = `tends to ${dominant} (avg ${summary.avgDifferential > 0 ? '+' : ''}${summary.avgDifferential}s/mi, ${summary.totalCount} runs)`;
      }
    }
    splitTendencySummary = {
      overall_positive_pct: sp.overallPositivePct,
      overall_negative_pct: sp.overallNegativePct,
      overall_even_pct: sp.overallEvenPct,
      interpretation: sp.overallPositivePct > 60
        ? 'Tends to go out too fast. Work on starting conservative and building into runs.'
        : sp.overallNegativePct > 50
          ? 'Great pacer - tends to finish strong with negative splits.'
          : 'Relatively even pacing overall. Good discipline.',
      by_workout_type: Object.keys(typeTendencies).length > 0 ? typeTendencies : undefined,
      total_analyzed: sp.totalAnalyzed,
    };
  }

  // Build running economy summary for coach
  let runningEconomySummary: Record<string, unknown> | null = null;
  if (economyResult && economyResult.success && economyResult.data.totalAnalyzed > 0) {
    const re = economyResult.data;
    const trendInfo = re.trend;
    runningEconomySummary = {
      data_points: re.totalAnalyzed,
      reference_hr: re.referenceHR,
      trend: trendInfo ? {
        direction: trendInfo.improving ? 'improving' : 'stable_or_declining',
        percent_change: trendInfo.percentChange,
        first_normalized_pace: formatPace(trendInfo.firstNormalizedPace),
        latest_normalized_pace: formatPace(trendInfo.lastNormalizedPace),
      } : null,
      interpretation: trendInfo
        ? trendInfo.improving
          ? `Running economy is improving - normalized easy pace went from ${formatPace(trendInfo.firstNormalizedPace)} to ${formatPace(trendInfo.lastNormalizedPace)} (${Math.abs(trendInfo.percentChange).toFixed(1)}% improvement in cardiac cost).`
          : trendInfo.percentChange > 3
            ? `Running economy has declined slightly - cardiac cost up ${trendInfo.percentChange.toFixed(1)}%. Could indicate fatigue, heat, or detraining.`
            : 'Running economy is stable - holding steady aerobic fitness.'
        : 'Not enough data points to determine economy trend.',
    };
  }

  return {
    fitness_level: {
      estimated_vdot: model.estimatedVdot,
      confidence: model.vdotConfidence,
      vdot_range: `${model.vdotRange.low} - ${model.vdotRange.high}`,
    },
    data_quality: {
      total_data_points: model.dataPoints,
      races: model.sources.races,
      time_trials: model.sources.timeTrials,
      workout_efforts: model.sources.workoutBestEfforts,
      most_recent_performance: model.mostRecentPerformance,
      note: model.dataPoints === 0
        ? 'No performance data found. Add race results or time trials for accurate pace recommendations.'
        : model.vdotConfidence === 'high'
          ? 'Strong data - pace recommendations are well-calibrated.'
          : 'Limited data - consider racing or time-trialing to improve accuracy.',
    },
    trend: {
      direction: model.trend,
      vdot_change_per_month: model.trendMagnitude,
      interpretation: model.trend === 'improving'
        ? 'Fitness is trending upward!'
        : model.trend === 'declining'
          ? 'Fitness has declined recently - may indicate overtraining or time off.'
          : model.trend === 'stable'
            ? 'Fitness is holding steady.'
            : 'Not enough data to determine trend.',
    },
    recommended_paces: {
      easy: `${formatPace(model.paces.easy.low)} - ${formatPace(model.paces.easy.high)}`,
      steady: `${formatPace(model.paces.steady.low)} - ${formatPace(model.paces.steady.high)}`,
      tempo: formatPace(model.paces.tempo),
      threshold: formatPace(model.paces.threshold),
      interval: formatPace(model.paces.interval),
      repetition: formatPace(model.paces.repetition),
      marathon_goal: formatPace(model.paces.marathon),
      half_marathon_goal: formatPace(model.paces.halfMarathon),
    },

    // Training analytics (roadmap 3.15)
    training_analytics: {
      fatigue_resistance: fatigueResistanceSummary,
      split_tendency: splitTendencySummary,
      running_economy: runningEconomySummary,
    },

    coach_guidance: model.vdotConfidence === 'low'
      ? 'I\'m estimating your paces based on limited data. A recent 5K or 10K race would help me dial in your training zones much better.'
      : model.trend === 'improving'
        ? 'Your recent performances show great progress! Your paces have been updated to reflect your improved fitness.'
        : 'Your pace zones are based on your recent race results and workout data.',
  };
}

function handleGetCoachingKnowledge(input: Record<string, unknown>) {
  const topic = input.topic as KnowledgeTopic;
  const includeRelated = input.include_related as boolean;

  if (!topic) {
    return {
      error: 'Topic is required',
      available_topics: [
        'training_philosophies', 'periodization', 'workout_types', 'pacing_zones',
        'race_specific', 'nutrition_fueling', 'recovery_adaptation', 'injury_management',
        'mental_performance', 'special_populations', 'weather_conditions', 'tapering', 'plan_adjustment',
        'race_prediction_reasoning', 'advanced_pattern_analysis', 'strength_training', 'cross_training',
        'sleep_optimization', 'race_execution', 'running_form', 'shoe_guidance', 'heart_rate_training',
        'women_running', 'ultra_trail', 'doubles_training', 'goal_setting', 'workout_library',
        'race_day_timeline', 'workout_prescriptions'
      ],
    };
  }

  if (includeRelated) {
    const { primary, related } = getTopicWithRelated(topic);
    const relatedTopics = getRelatedTopics(topic);

    return {
      topic,
      knowledge: primary,
      related_topics: relatedTopics,
      related_knowledge: related,
      usage_note: 'Primary topic and related topics provided for comprehensive coaching. Synthesize as needed.',
    };
  }

  const knowledge = getCoachingKnowledge(topic);

  return {
    topic,
    knowledge,
    related_topics_available: getRelatedTopics(topic),
    usage_note: 'Use include_related=true to also fetch related topics for comprehensive answers.',
  };
}

async function prescribeWorkout(input: Record<string, unknown>) {
  // Check if user wants the original algorithm or template-based
  const useTemplates = input.use_templates === true; // Default to false - use real data by default

  if (useTemplates) {
    try {
      // Use the enhanced template-based prescription
      const result = await enhancedPrescribeWorkout(input);
      return result;
    } catch (error) {
      console.error('[prescribeWorkout] Template selection failed, falling back to original:', error);
      // Fall back to original algorithm
    }
  }

  // Original algorithm continues below...
  const workoutType = input.workout_type as string;
  const targetDistance = input.target_distance as string;
  const phase = input.phase as string;
  const weeklyMileage = input.weekly_mileage as number;

  // Get user settings for paces
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  const settings = await db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1);
  const userSettingsData = settings[0] || {};

  // Get recent workout data for context
  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(eq(workouts.profileId, profileId))
    .orderBy(desc(workouts.date))
    .limit(20); // Get more workouts for better analysis

  const formatPace = (seconds: number) => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  // Get prescription knowledge
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _prescriptionKnowledge = getCoachingKnowledge('workout_prescriptions');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _workoutLibrary = getCoachingKnowledge('workout_library');

  // Use actual user paces from their settings
  const easyPace = userSettingsData.easyPaceSeconds || 540; // 9:00 default
  const tempoPace = userSettingsData.tempoPaceSeconds || 450; // 7:30 default
  const thresholdPace = userSettingsData.thresholdPaceSeconds || 420; // 7:00 default
  const intervalPace = userSettingsData.intervalPaceSeconds || 390; // 6:30 default
  const marathonPace = userSettingsData.marathonPaceSeconds || (tempoPace + 15);
  const halfMarathonPace = userSettingsData.halfMarathonPaceSeconds || thresholdPace;

  // Get user's actual training data
  const actualWeeklyMileage = weeklyMileage || userSettingsData.currentWeeklyMileage || 25;
  const peakWeeklyTarget = userSettingsData.peakWeeklyMileageTarget || 50;
  const currentLongRunMax = userSettingsData.currentLongRunMax || 10;
  const vdot = userSettingsData.vdot || 45;
  const aggressiveness = userSettingsData.planAggressiveness || 'moderate';

  // Analyze recent training load
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const recentWeekWorkouts = recentWorkouts.filter((w: typeof recentWorkouts[number]) => new Date(w.date) >= last7Days);
  const recentMileage = recentWeekWorkouts.reduce((sum: number, w: typeof recentWorkouts[number]) => sum + (w.distanceMiles || 0), 0);

  // Find recent similar workouts to check progression
  const recentSimilarWorkouts = recentWorkouts.filter((w: typeof recentWorkouts[number]) => w.workoutType === workoutType);
  const lastSimilarWorkout = recentSimilarWorkouts[0];

  // Calculate appropriate mileage multiplier based on actual user data
  const baseMultiplier = actualWeeklyMileage / 40; // Base on 40 mpw as standard
  const fitnessMultiplier = Math.sqrt(vdot / 45); // Adjust for fitness level
  const progressionFactor = aggressiveness === 'aggressive' ? 1.1 : aggressiveness === 'conservative' ? 0.9 : 1.0;
  const mileageMultiplier = Math.min(Math.max(baseMultiplier * fitnessMultiplier * progressionFactor, 0.5), 2.0);

  // Calculate hard efforts this week
  const hardEffortsThisWeek = recentWeekWorkouts.filter((w: typeof recentWorkouts[number]) =>
    w.workoutType && ['tempo', 'threshold', 'vo2max', 'race'].includes(w.workoutType)
  ).length;

  // Build prescription based on workout type
  let prescription: {
    workout_type: string;
    structure: string;
    target_paces: string;
    total_distance: string;
    warmup: string;
    cooldown: string;
    rationale: string;
    adjustments: string;
  };

  // Calculate CTL/ATL/TSB for training load management (moved before switch to avoid use-before-declaration)
  const calculateTrainingMetrics = (metricsWorkouts: typeof recentWorkouts) => {
    const today = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;

    const calculateTSS = (workout: typeof metricsWorkouts[0]) => {
      if (!workout.distanceMiles || !workout.avgPaceSeconds) return 0;
      const intensityFactor = Math.max(0.5, Math.min(1.2, easyPace / workout.avgPaceSeconds));
      const durationHours = (workout.durationMinutes || workout.distanceMiles * workout.avgPaceSeconds / 60) / 60;
      return Math.round(durationHours * Math.pow(intensityFactor, 2) * 100);
    };

    const last42Days = metricsWorkouts.filter((w: typeof metricsWorkouts[number]) => {
      const workoutDate = new Date(w.date);
      const daysAgo = (today.getTime() - workoutDate.getTime()) / dayInMs;
      return daysAgo <= 42;
    });

    let ctl = 0;
    let atl = 0;
    const ctlDecay = 1 / 42;
    const atlDecay = 1 / 7;

    last42Days.sort((a: typeof metricsWorkouts[number], b: typeof metricsWorkouts[number]) => new Date(a.date).getTime() - new Date(b.date).getTime());

    last42Days.forEach((workout: typeof metricsWorkouts[number]) => {
      const tss = calculateTSS(workout);
      const daysAgo = (today.getTime() - new Date(workout.date).getTime()) / dayInMs;
      if (daysAgo <= 42) {
        ctl = ctl * (1 - ctlDecay) + tss * ctlDecay;
      }
      if (daysAgo <= 7) {
        atl = atl * (1 - atlDecay) + tss * atlDecay;
      }
    });

    const tsb = ctl - atl;
    return { ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(tsb) };
  };

  const trainingMetrics = calculateTrainingMetrics(recentWorkouts);

  switch (workoutType) {
    case 'tempo':
      // Calculate tempo duration based on user's fitness and recent training
      const baseTempoMinutes = vdot < 40 ? 15 : vdot < 50 ? 20 : vdot < 60 ? 25 : 30;
      let tempoMin = Math.round(baseTempoMinutes * mileageMultiplier);
      let tempoMax = Math.round((baseTempoMinutes + 10) * mileageMultiplier);

      // Check if user has done tempo recently and adjust
      const recentTempo = recentSimilarWorkouts[0];
      if (recentTempo && recentTempo.durationMinutes) {
        const lastTempoDuration = Math.round(recentTempo.durationMinutes * 0.8); // Estimate tempo portion
        tempoMin = Math.round(lastTempoDuration * 1.05); // 5% progression
        tempoMax = Math.round(lastTempoDuration * 1.15); // Up to 15% increase
      }

      // Adjust based on TSB
      if (trainingMetrics.tsb < -15) {
        // Very fatigued - reduce volume
        tempoMin = Math.round(tempoMin * 0.8);
        tempoMax = Math.round(tempoMax * 0.85);
      } else if (trainingMetrics.tsb > 10) {
        // Well rested - can handle slightly more
        tempoMax = Math.round(tempoMax * 1.1);
      }

      prescription = {
        workout_type: 'Tempo Run',
        structure: `${tempoMin}-${tempoMax} minutes continuous at tempo pace`,
        target_paces: `Tempo pace: ${formatPace(tempoPace)} (comfortably hard, RPE 6-7)`,
        total_distance: `${Math.round((tempoMin + tempoMax) / 2 * tempoPace / 60 + 3)} miles total including warmup/cooldown`,
        warmup: `${Math.round(1.5 * mileageMultiplier)} miles easy with 4 strides`,
        cooldown: `${Math.round(1.5 * mileageMultiplier)} miles easy`,
        rationale: `Develops lactate threshold. Based on your VDOT of ${vdot} and recent training load (CTL: ${trainingMetrics.ctl}, TSB: ${trainingMetrics.tsb}).`,
        adjustments: trainingMetrics.tsb < -10 ?
                    'High training load detected - keep effort controlled and stop if form deteriorates' :
                    trainingMetrics.tsb > 5 ?
                    'Good recovery status - you can push the pace if feeling strong' :
                    phase === 'peak' ? 'In peak phase - can push duration to upper range' :
                    phase === 'base' ? 'In base phase - stay at lower end of range' :
                    'Build duration gradually through the phase',
      };
      break;

    case 'threshold':
      // Determine interval count and duration based on fitness level
      let intervalCount = vdot < 40 ? 3 : vdot < 50 ? 4 : vdot < 60 ? 5 : 6;
      const intervalMinutes = vdot < 45 ? 6 : vdot < 55 ? 8 : 10;
      let recoveryMinutes = aggressiveness === 'aggressive' ? 2 : aggressiveness === 'conservative' ? 3 : 2.5;

      // Adjust based on TSB
      if (trainingMetrics.tsb < -15) {
        // Very fatigued - reduce reps and increase recovery
        intervalCount = Math.max(3, intervalCount - 1);
        recoveryMinutes = recoveryMinutes + 0.5;
      } else if (trainingMetrics.tsb < -10 && hardEffortsThisWeek > 1) {
        // Fatigued with recent hard work - maintain reps but increase recovery
        recoveryMinutes = recoveryMinutes + 0.5;
      }

      // Calculate total threshold volume
      const thresholdVolume = intervalCount * intervalMinutes * thresholdPace / 60;
      const totalWithRecovery = thresholdVolume + (intervalCount - 1) * recoveryMinutes * easyPace / 60;

      prescription = {
        workout_type: 'Threshold Intervals',
        structure: `${intervalCount} x ${intervalMinutes} minutes at threshold pace with ${recoveryMinutes} min recovery jog`,
        target_paces: `Threshold pace: ${formatPace(thresholdPace)} (RPE 7-8), Recovery: ${formatPace(easyPace)}`,
        total_distance: `${Math.round(totalWithRecovery + 3.5)} miles total including warmup/cooldown`,
        warmup: `${Math.round(2 * mileageMultiplier)} miles easy with 4 strides`,
        cooldown: `${Math.round(1.5 * mileageMultiplier)} miles easy`,
        rationale: `Accumulates ${intervalCount * intervalMinutes} minutes at threshold. Based on VDOT ${vdot}, CTL: ${trainingMetrics.ctl}, TSB: ${trainingMetrics.tsb}.`,
        adjustments: trainingMetrics.tsb < -10 ?
          `Fatigue level elevated (TSB: ${trainingMetrics.tsb}) - extended recovery between intervals. Focus on quality over quantity.` :
          lastSimilarWorkout ?
          `Last threshold workout: ${new Date(lastSimilarWorkout.date).toLocaleDateString()}. ${trainingMetrics.tsb > 5 ? 'Good recovery - consider reducing recovery time if feeling strong.' : 'Maintain prescribed recovery periods.'}` :
          'First threshold workout in recent training - focus on hitting pace targets',
      };
      break;

    case 'vo2max':
      // Determine interval structure based on target race and fitness
      let intervalDistance: string;
      let reps: number;

      if (targetDistance === '5K' || targetDistance === '5k') {
        intervalDistance = vdot < 45 ? '800m' : '1000m';
        reps = vdot < 40 ? 4 : vdot < 50 ? 5 : 6;
      } else {
        intervalDistance = vdot < 45 ? '1000m' : vdot < 55 ? '1200m' : '1600m';
        reps = vdot < 45 ? 4 : 5;
      }

      // Adjust based on TSB - VO2max workouts are very demanding
      if (trainingMetrics.tsb < -20) {
        // Very fatigued - significantly reduce volume
        reps = Math.max(3, reps - 2);
        intervalDistance = intervalDistance === '1600m' ? '1200m' :
                          intervalDistance === '1200m' ? '1000m' : intervalDistance;
      } else if (trainingMetrics.tsb < -10) {
        // Moderately fatigued - reduce by 1 rep
        reps = Math.max(3, reps - 1);
      } else if (hardEffortsThisWeek >= 2) {
        // Already had quality work this week - be conservative
        reps = Math.max(3, reps - 1);
      }

      // Convert interval distance to miles
      const intervalMiles = intervalDistance === '800m' ? 0.5 :
                           intervalDistance === '1000m' ? 0.62 :
                           intervalDistance === '1200m' ? 0.75 : 1.0;

      const intervalTotalMiles = reps * intervalMiles;
      const recoveryMiles = reps * intervalMiles * 0.8; // Slightly less than interval distance

      prescription = {
        workout_type: 'VO2max Intervals',
        structure: `${reps} x ${intervalDistance} at 5K pace with ${intervalDistance === '800m' ? '400m' :
                    intervalDistance === '1000m' ? '600m' : '800m'} recovery jog`,
        target_paces: `Interval pace: ${formatPace(intervalPace)} (RPE 8-9, hard but controlled), Recovery: ${formatPace(easyPace + 30)}`,
        total_distance: `${Math.round(intervalTotalMiles + recoveryMiles + 3.5)} miles total`,
        warmup: '2 miles easy with 4-6 strides',
        cooldown: `${Math.round(1.5 * mileageMultiplier)} miles easy`,
        rationale: `${reps} reps at VO2max pace totaling ${intervalTotalMiles.toFixed(1)} miles. Adjusted for CTL: ${trainingMetrics.ctl}, TSB: ${trainingMetrics.tsb}. Structure optimized for ${targetDistance || 'general fitness'}.`,
        adjustments: trainingMetrics.tsb < -10 ?
          `High fatigue detected (TSB: ${trainingMetrics.tsb}) - volume reduced. Focus on quality execution of each rep.` :
          hardEffortsThisWeek >= 2 ?
          `You've had ${hardEffortsThisWeek} hard efforts this week - volume adjusted accordingly.` :
          recentMileage < actualWeeklyMileage * 0.8 ?
          'Recent mileage is lower than usual - adjusted volume to match current fitness' :
          trainingMetrics.tsb > 10 ?
          'Well rested - push hard but maintain form. Last rep should still be achievable.' :
          'Maintain consistent pace across all reps. Last rep should feel hard but doable.',
      };
      break;

    case 'long_run':
      // Calculate long run distance based on current fitness and target
      const baseLongRun = currentLongRunMax || Math.round(actualWeeklyMileage * 0.35);
      let longDistance: number;

      // Progressive build based on recent long runs
      const recentLongRuns = recentWorkouts.filter((w: typeof recentWorkouts[number]) =>
        w.workoutType === 'long_run' && w.distanceMiles && w.distanceMiles >= baseLongRun * 0.8
      );

      if (recentLongRuns.length > 0) {
        const lastLongRun = recentLongRuns[0];
        const daysSinceLastLong = Math.floor((new Date().getTime() - new Date(lastLongRun.date).getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastLong < 5) {
          // Too soon for another long run
          longDistance = Math.round(baseLongRun * 0.7); // Recovery long run
        } else if (daysSinceLastLong < 14) {
          // Normal progression
          longDistance = Math.min(Math.round((lastLongRun.distanceMiles || baseLongRun) * 1.1), peakWeeklyTarget * 0.35);
        } else {
          // Been a while, be conservative
          longDistance = baseLongRun;
        }
      } else {
        longDistance = baseLongRun;
      }

      // Add quality component based on phase and target race
      let structure: string;
      if (phase === 'build' || phase === 'peak') {
        if (targetDistance === 'marathon') {
          const mpMiles = Math.round(longDistance * 0.4);
          structure = `${longDistance} miles with ${mpMiles} miles at marathon pace in the middle`;
        } else if (targetDistance === 'half_marathon') {
          const tempoMiles = Math.round(longDistance * 0.25);
          structure = `${longDistance} miles with final ${tempoMiles} miles at half marathon pace`;
        } else {
          structure = `${longDistance} miles easy with optional progression in final 2-3 miles`;
        }
      } else {
        structure = `${longDistance} miles at comfortable, conversational pace`;
      }

      prescription = {
        workout_type: 'Long Run',
        structure,
        target_paces: `Easy: ${formatPace(easyPace)}${
          phase === 'build' || phase === 'peak' ? `, Marathon pace: ${formatPace(marathonPace)}, Half Marathon pace: ${formatPace(halfMarathonPace)}` : ''
        }`,
        total_distance: `${longDistance} miles`,
        warmup: 'First 2 miles very easy to warm up',
        cooldown: phase === 'build' || phase === 'peak' ? 'Last mile easy to cool down' : 'Gradual slowdown in final mile',
        rationale: `${Math.round(longDistance / actualWeeklyMileage * 100)}% of weekly mileage. ${
          targetDistance ? `Building endurance for ${targetDistance}.` : 'Building aerobic base.'
        }`,
        adjustments: currentLongRunMax && longDistance > currentLongRunMax ?
          `This is ${longDistance - currentLongRunMax} miles longer than your recent max. Take it easy and focus on completion.` :
          'Focus on maintaining steady effort rather than pace, especially on hills.',
      };
      break;

    case 'fartlek':
      // Calculate fartlek duration based on fitness and recent training
      const fartlekMinutes = Math.round((45 + (vdot - 45) * 0.5) * mileageMultiplier);
      const surgeCount = Math.round(fartlekMinutes / 8); // Roughly one surge every 8 minutes

      prescription = {
        workout_type: 'Fartlek',
        structure: `${fartlekMinutes} minutes total: ${surgeCount} surges of 1-3 minutes at tempo-to-5K effort with 1-2 min easy between`,
        target_paces: `Surges: ${formatPace(tempoPace)} to ${formatPace(intervalPace)}, Recovery: ${formatPace(easyPace)}`,
        total_distance: `${Math.round(fartlekMinutes * easyPace / 60 / 1.1)} miles (will vary based on effort)`,
        warmup: 'First 10 minutes of the run serves as warmup',
        cooldown: 'Last 10 minutes easy',
        rationale: `Unstructured speed work for ${targetDistance || 'general fitness'}. Great for breaking monotony.`,
        adjustments: aggressiveness === 'aggressive' ?
          'Push the surges harder - aim for 5K effort on most' :
          'Keep surges controlled - should feel invigorating, not exhausting',
      };
      break;

    case 'progression':
      // Scale progression run based on fitness and target race
      const progressionMiles = Math.round(Math.min(actualWeeklyMileage * 0.25, 10) * mileageMultiplier);
      const tempoFinishMiles = Math.min(Math.round(progressionMiles * 0.3), 3);

      prescription = {
        workout_type: 'Progression Run',
        structure: `${progressionMiles} miles: First ${progressionMiles - tempoFinishMiles} miles easy, gradually increasing pace, final ${tempoFinishMiles} miles at tempo`,
        target_paces: `Start: ${formatPace(easyPace + 30)}, Middle: ${formatPace(easyPace)}, Finish: ${formatPace(tempoPace)}`,
        total_distance: `${progressionMiles} miles`,
        warmup: 'The gradual start serves as your warmup',
        cooldown: 'Short 5-min walk after finishing fast',
        rationale: `Simulates ${targetDistance || 'race'} fatigue. Teaches pacing discipline and mental toughness.`,
        adjustments: recentWeekWorkouts.some((w: typeof recentWorkouts[number]) => w.workoutType === 'tempo' || w.workoutType === 'threshold') ?
          'You\'ve had quality work this week - keep the progression controlled' :
          'No hard efforts this week - you can push the final miles harder',
      };
      break;

    default:
      // Calculate easy run distance based on weekly schedule and recent hard efforts
      const easyMiles = hardEffortsThisWeek > 1 ?
        Math.round(4 * mileageMultiplier) : // More recovery needed
        Math.round(6 * mileageMultiplier);  // Standard easy run

      prescription = {
        workout_type: 'Easy Run',
        structure: `${easyMiles}-${easyMiles + 2} miles at conversational pace`,
        target_paces: `Easy pace: ${formatPace(easyPace)} (RPE 3-5, can hold conversation)`,
        total_distance: `${easyMiles}-${easyMiles + 2} miles`,
        warmup: 'Start with 5 min very easy to warm up',
        cooldown: 'Gradual cooldown in final 0.5 mile',
        rationale: hardEffortsThisWeek > 1 ?
          `Recovery run - you've had ${hardEffortsThisWeek} hard efforts this week` :
          'Aerobic maintenance run. Building easy volume for endurance base.',
        adjustments: recentMileage > actualWeeklyMileage ?
          'Recent volume is high - keep this run on the shorter side' :
          'Can add 4-6 strides at the end for neuromuscular maintenance',
      };
  }

  // Adjust prescription based on TSB
  let tsbAdjustment = '';
  if (trainingMetrics.tsb < -20) {
    tsbAdjustment = 'Very fatigued (TSB: ' + trainingMetrics.tsb + ') - consider reducing intensity or volume';
  } else if (trainingMetrics.tsb < -10) {
    tsbAdjustment = 'Moderately fatigued (TSB: ' + trainingMetrics.tsb + ') - be cautious with hard efforts';
  } else if (trainingMetrics.tsb > 10) {
    tsbAdjustment = 'Well rested (TSB: ' + trainingMetrics.tsb + ') - good time for a quality workout';
  } else {
    tsbAdjustment = 'Balanced training load (TSB: ' + trainingMetrics.tsb + ')';
  }

  // Calculate training stress and recovery needs
  const avgPaceLastWeek = recentWeekWorkouts.length > 0 ?
    recentWeekWorkouts.reduce((sum: number, w: typeof recentWorkouts[number]) => sum + (w.avgPaceSeconds || easyPace), 0) / recentWeekWorkouts.length :
    easyPace;

  const trainingStress = {
    weekly_volume: `${recentMileage.toFixed(1)} miles last 7 days (target: ${actualWeeklyMileage})`,
    volume_status: recentMileage < actualWeeklyMileage * 0.8 ? 'Below target' :
                   recentMileage > actualWeeklyMileage * 1.2 ? 'Above target' : 'On target',
    recent_quality: hardEffortsThisWeek > 0 ?
      `${hardEffortsThisWeek} hard workout(s) in past week` :
      'No hard workouts in past week',
    fitness_indicators: {
      vdot: vdot,
      easy_pace: formatPace(easyPace),
      recent_avg_pace: formatPace(Math.round(avgPaceLastWeek)),
    },
    training_metrics: {
      ctl: trainingMetrics.ctl,
      atl: trainingMetrics.atl,
      tsb: trainingMetrics.tsb,
      tsb_status: tsbAdjustment
    }
  };

  const result = {
    prescription,
    context: {
      phase: phase || 'not specified',
      target_race: targetDistance || 'not specified',
      weekly_mileage: actualWeeklyMileage,
      recent_training: {
        total_runs: recentWorkouts.length,
        days_covered: 20,
        similar_workouts: recentSimilarWorkouts.length,
        last_similar: lastSimilarWorkout ?
          `${new Date(lastSimilarWorkout.date).toLocaleDateString()} (${Math.floor((new Date().getTime() - new Date(lastSimilarWorkout.date).getTime()) / (1000 * 60 * 60 * 24))} days ago)` :
          'None found',
      },
      training_stress: trainingStress,
      user_profile: {
        current_fitness: `VDOT ${vdot}`,
        training_approach: aggressiveness,
        long_run_fitness: `Recent max: ${currentLongRunMax} miles`,
      },
    },
    coach_notes: trainingMetrics.tsb < -20 ?
      `Very high fatigue level (TSB: ${trainingMetrics.tsb}). Strongly consider an easy run or rest day instead. If you proceed, reduce intensity and stop if form deteriorates.` :
      trainingMetrics.tsb < -10 ?
      `Elevated fatigue (TSB: ${trainingMetrics.tsb}). Workout adjusted for current training load. Focus on quality over quantity and don't force the pace.` :
      trainingMetrics.tsb > 15 ?
      `Very well rested (TSB: ${trainingMetrics.tsb}). Great opportunity for a breakthrough workout! Push yourself while maintaining good form.` :
      trainingMetrics.tsb > 5 ?
      `Good recovery status (TSB: ${trainingMetrics.tsb}). You should feel strong today - aim for the upper end of prescribed ranges.` :
      recentMileage > actualWeeklyMileage * 1.1 ?
      `Training load is high but balanced (TSB: ${trainingMetrics.tsb}). Listen to your body and adjust effort as needed.` :
      recentMileage < actualWeeklyMileage * 0.7 ?
      `Training volume is low - build back gradually. Current fitness (CTL: ${trainingMetrics.ctl}) reflects recent lighter training.` :
      `Training metrics are balanced (CTL: ${trainingMetrics.ctl}, TSB: ${trainingMetrics.tsb}). Execute workout as prescribed, adjusting for conditions.`,
  };

  return result;
}

async function getRaceDayPlan(input: Record<string, unknown>) {
  const raceId = input.race_id as number | undefined;
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  // Get the race
  let race;
  if (raceId) {
    const raceResults = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
    race = raceResults[0];
  } else {
    // Get next upcoming race
    const today = new Date().toISOString().split('T')[0];
    const upcomingRaces = await db
      .select()
      .from(races)
      .where(and(eq(races.profileId, profileId), gte(races.date, today)))
      .orderBy(asc(races.date))
      .limit(1);
    race = upcomingRaces[0];
  }

  if (!race) {
    return {
      error: 'No race found',
      suggestion: 'Add a race first with add_race tool',
    };
  }

  // Get user settings and calculate actual pace zones
  const userSettingsResult = await db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1);
  const userSettingsData = userSettingsResult[0] || {};

  // Get user's VDOT or calculate from recent races
  let vdot = userSettingsData.vdot;
  if (!vdot) {
    // Try to get VDOT from recent race results
    const recentRaceResults = await db
      .select()
      .from(raceResults)
      .where(eq(raceResults.profileId, profileId))
      .orderBy(desc(raceResults.date))
      .limit(1);

    if (recentRaceResults.length > 0) {
      const result = recentRaceResults[0];
      const calculated = calculateVDOT(result.distanceMeters, result.finishTimeSeconds);
      // Validate VDOT is within realistic range (15-85)
      if (calculated >= 15 && calculated <= 85) {
        vdot = calculated;
      }
    }
  }

  // Calculate personalized pace zones
  const paceZones = vdot && vdot >= 15 && vdot <= 85 ? calculatePaceZones(vdot) : null;
  const actualPaces = {
    easy: userSettingsData.easyPaceSeconds || paceZones?.easy || 600,
    marathon: userSettingsData.marathonPaceSeconds || paceZones?.marathon || 480,
    halfMarathon: userSettingsData.halfMarathonPaceSeconds || paceZones?.halfMarathon || 450,
    tempo: userSettingsData.tempoPaceSeconds || paceZones?.tempo || 420,
    threshold: userSettingsData.thresholdPaceSeconds || paceZones?.threshold || 400,
    interval: userSettingsData.intervalPaceSeconds || paceZones?.interval || 360,
  };

  const formatPace = (seconds: number) => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate race day pacing from target OR current fitness
  const targetTimeSeconds = race.targetTimeSeconds;
  const distanceMeters = race.distanceMeters;
  const distanceMiles = distanceMeters / 1609.34;
  const targetPaceSeconds = targetTimeSeconds ? Math.round(targetTimeSeconds / distanceMiles) : null;

  // Get race-specific pace from VDOT if no target set
  let racePaceSeconds = targetPaceSeconds;
  if (!racePaceSeconds && paceZones) {
    const distanceLabel = race.distanceLabel?.toLowerCase() || '';
    if (distanceLabel.includes('marathon') && !distanceLabel.includes('half')) {
      racePaceSeconds = actualPaces.marathon;
    } else if (distanceLabel.includes('half')) {
      racePaceSeconds = actualPaces.halfMarathon;
    } else if (distanceLabel.includes('10k')) {
      racePaceSeconds = actualPaces.threshold;
    } else if (distanceLabel.includes('5k')) {
      racePaceSeconds = actualPaces.interval;
    }
  }

  // Try to get weather forecast for race location
  let weatherInfo = null;
  if (userSettingsData.latitude && userSettingsData.longitude) {
    try {
      // Check if race is within 7 days for accurate forecast
      const daysUntil = Math.ceil((new Date(race.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7 && daysUntil >= 0) {
        const weather = await fetchCurrentWeather(userSettingsData.latitude, userSettingsData.longitude);
        if (weather) {
          const severity = calculateConditionsSeverity(weather);
          weatherInfo = {
            temperature: weather.temperature,
            conditions: weather.conditionText,
            humidity: weather.humidity,
            wind_speed: weather.windSpeed,
            severity: severity.severityScore,
            pace_adjustment: calculatePaceAdjustment(
              racePaceSeconds || actualPaces.marathon,
              severity,
              'race',
              userSettingsData.heatAcclimatizationScore || 50
            ),
          };
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // Weather fetch failed, continue without it
    }
  }

  // Get recent training summary for warmup recommendations
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 42); // Get 42 days for CTL calculation
  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.profileId, profileId), gte(workouts.date, cutoffDate.toISOString().split('T')[0])))
    .orderBy(desc(workouts.date))
    .limit(50);

  const avgMileage = recentWorkouts.filter((w: typeof recentWorkouts[number]) => {
    const workoutDate = new Date(w.date);
    const daysAgo = (new Date().getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000);
    return daysAgo <= 28;
  }).reduce((sum: number, w: typeof recentWorkouts[number]) => sum + (w.distanceMiles || 0), 0) / 4;

  // Calculate CTL/ATL/TSB for race readiness
  const calculateRaceReadiness = (workouts: typeof recentWorkouts) => {
    const today = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;

    const calculateTSS = (workout: typeof workouts[0]) => {
      if (!workout.distanceMiles || !workout.avgPaceSeconds) return 0;
      const easyPace = userSettingsData.easyPaceSeconds || 540;
      const intensityFactor = Math.max(0.5, Math.min(1.2, easyPace / workout.avgPaceSeconds));
      const durationHours = (workout.durationMinutes || workout.distanceMiles * workout.avgPaceSeconds / 60) / 60;
      return Math.round(durationHours * Math.pow(intensityFactor, 2) * 100);
    };

    let ctl = 0;
    let atl = 0;
    const ctlDecay = 1 / 42;
    const atlDecay = 1 / 7;

    const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedWorkouts.forEach(workout => {
      const tss = calculateTSS(workout);
      const daysAgo = (today.getTime() - new Date(workout.date).getTime()) / dayInMs;

      if (daysAgo <= 42) {
        ctl = ctl * (1 - ctlDecay) + tss * ctlDecay;
      }
      if (daysAgo <= 7) {
        atl = atl * (1 - atlDecay) + tss * atlDecay;
      }
    });

    const tsb = ctl - atl;
    return { ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(tsb) };
  };

  const trainingMetrics = calculateRaceReadiness(recentWorkouts);

  // Analyze recent race-pace workouts
  const racePaceWorkouts = recentWorkouts.filter((w: typeof recentWorkouts[number]) => {
    if (!w.avgPaceSeconds || !racePaceSeconds) return false;
    const paceDiff = Math.abs(w.avgPaceSeconds - racePaceSeconds);
    return paceDiff < 15 && w.distanceMiles && w.distanceMiles >= 3; // Within 15 sec/mi of race pace
  }).slice(0, 3); // Last 3 race-pace efforts

  // Build personalized pacing strategy
  const distanceLabel = race.distanceLabel?.toLowerCase() || '';
  let pacingStrategy: string;
  let splitTargets: Array<{ segment: string; pace: string; notes: string }> = [];

  if (distanceLabel.includes('marathon') && !distanceLabel.includes('half')) {
    const marathonPace = racePaceSeconds || actualPaces.marathon;
    const adjustedPace = weatherInfo?.pace_adjustment ?
      marathonPace + weatherInfo.pace_adjustment.adjustmentSeconds : marathonPace;

    splitTargets = [
      { segment: 'Miles 1-3', pace: formatPace(adjustedPace + 15), notes: 'Controlled start, let the crowd thin' },
      { segment: 'Miles 4-6', pace: formatPace(adjustedPace + 10), notes: 'Still warming up, should feel too easy' },
      { segment: 'Miles 7-13', pace: formatPace(adjustedPace), notes: 'Goal pace, find your rhythm' },
      { segment: 'Miles 14-20', pace: formatPace(adjustedPace), notes: 'Maintain focus, real race begins here' },
      { segment: 'Miles 21-23', pace: formatPace(adjustedPace), notes: 'Dig deep, rely on mental training' },
      { segment: 'Miles 24-26.2', pace: `${formatPace(adjustedPace)} or faster`, notes: 'Everything you have left' },
    ];

    const targetTime = targetTimeSeconds ? formatTime(targetTimeSeconds) :
      formatTime(marathonPace * distanceMiles);

    pacingStrategy = `MARATHON PACING PLAN
Target: ${targetTime} (${formatPace(marathonPace)}/mi average)
${weatherInfo ? `\nWeather adjustment: ${weatherInfo.pace_adjustment.recommendation}` : ''}

${splitTargets.map(s => `${s.segment}: ${s.pace} - ${s.notes}`).join('\n')}

FUELING STRATEGY:
- Pre-race: 200-300 cal 2-3 hours before
- During: ${Math.floor(distanceMiles / 5)} gels (every 5 miles starting at mile 5)
- Hydration: ${weatherInfo && weatherInfo.temperature > 65 ? 'Every aid station' : 'Every other aid station'}
- Practice your exact fueling plan during long runs`;

  } else if (distanceLabel.includes('half')) {
    const halfPace = racePaceSeconds || actualPaces.halfMarathon;
    const adjustedPace = weatherInfo?.pace_adjustment ?
      halfPace + weatherInfo.pace_adjustment.adjustmentSeconds : halfPace;

    splitTargets = [
      { segment: 'Mile 1', pace: formatPace(adjustedPace + 10), notes: 'Controlled start' },
      { segment: 'Miles 2-3', pace: formatPace(adjustedPace + 5), notes: 'Settle into rhythm' },
      { segment: 'Miles 4-10', pace: formatPace(adjustedPace), notes: 'Goal pace, stay steady' },
      { segment: 'Miles 11-12', pace: formatPace(adjustedPace), notes: 'Maintain when it gets hard' },
      { segment: 'Mile 13-13.1', pace: `${formatPace(adjustedPace - 5)} or faster`, notes: 'Empty the tank' },
    ];

    const targetTime = targetTimeSeconds ? formatTime(targetTimeSeconds) :
      formatTime(halfPace * distanceMiles);

    pacingStrategy = `HALF MARATHON PACING PLAN
Target: ${targetTime} (${formatPace(halfPace)}/mi average)
${weatherInfo ? `\nWeather adjustment: ${weatherInfo.pace_adjustment.recommendation}` : ''}

${splitTargets.map(s => `${s.segment}: ${s.pace} - ${s.notes}`).join('\n')}

FUELING: ${avgMileage > 40 ? '1 gel at mile 7' : 'Optional gel at mile 7-8'}`;

  } else if (distanceLabel.includes('10k')) {
    const tenKPace = racePaceSeconds || actualPaces.threshold;

    splitTargets = [
      { segment: 'Mile 1', pace: formatPace(tenKPace + 5), notes: 'Controlled, find position' },
      { segment: 'Miles 2-3', pace: formatPace(tenKPace), notes: 'Lock into goal pace' },
      { segment: 'Miles 4-5', pace: formatPace(tenKPace), notes: 'Stay strong when it hurts' },
      { segment: 'Mile 6-6.2', pace: `${formatPace(tenKPace - 5)} or faster`, notes: 'Final kick' },
    ];

    pacingStrategy = `10K PACING PLAN
Target: ${targetTimeSeconds ? formatTime(targetTimeSeconds) : formatTime(tenKPace * distanceMiles)}

${splitTargets.map(s => `${s.segment}: ${s.pace} - ${s.notes}`).join('\n')}

STRATEGY: This will hurt from mile 2 onward. That's normal. Focus on rhythm and breathing.`;

  } else {
    const fiveKPace = racePaceSeconds || actualPaces.interval;

    splitTargets = [
      { segment: 'First 800m', pace: formatPace(fiveKPace + 5), notes: 'Controlled start' },
      { segment: 'Mile 1-2', pace: formatPace(fiveKPace), notes: 'Goal pace, it will hurt' },
      { segment: 'Mile 2.5-3.1', pace: `${formatPace(fiveKPace)} or faster`, notes: 'Everything left' },
    ];

    pacingStrategy = `5K PACING PLAN
Target: ${targetTimeSeconds ? formatTime(targetTimeSeconds) : formatTime(fiveKPace * distanceMiles)}

${splitTargets.map(s => `${s.segment}: ${s.pace} - ${s.notes}`).join('\n')}

STRATEGY: After the first mile, it should feel hard. That's the correct effort. Stay mentally tough.`;
  }

  // Personalized warmup based on distance and fitness
  const warmupRoutine = distanceMiles > 13 ?
    ['5 min easy walk', '5 min easy jog', 'Dynamic stretches', 'Use the first mile as extended warmup'] :
    distanceMiles > 6 ?
    ['10 min easy jog', 'Dynamic stretches', '4x100m strides @ race pace', '5 min before start'] :
    ['15 min easy jog', 'Dynamic stretches', '6x100m strides building to race pace', '10 min before start'];

  const daysUntil = Math.ceil((new Date(race.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return {
    race: {
      name: race.name,
      date: race.date,
      distance: race.distanceLabel,
      target_time: targetTimeSeconds ? formatTime(targetTimeSeconds) :
        racePaceSeconds ? `Projected: ${formatTime(racePaceSeconds * distanceMiles)}` : 'Not set',
      target_pace: racePaceSeconds ? formatPace(racePaceSeconds) : 'Calculate from target time',
      days_until: daysUntil,
    },
    current_fitness: {
      vdot: vdot || 'Not calculated',
      recent_mileage: `${Math.round(avgMileage)} miles/week`,
      equivalent_performances: vdot ? {
        '5K': formatTime(calculatePaceZones(vdot).vo2max * 3.10686),
        '10K': formatTime(calculatePaceZones(vdot).threshold * 6.21371),
        'Half Marathon': formatTime(calculatePaceZones(vdot).halfMarathon * 13.1094),
        'Marathon': formatTime(calculatePaceZones(vdot).marathon * 26.2188),
      } : null,
    },
    race_readiness: {
      ctl: trainingMetrics.ctl,
      atl: trainingMetrics.atl,
      tsb: trainingMetrics.tsb,
      readiness_assessment: trainingMetrics.tsb < -20 ?
        'CAUTION: Very fatigued. Consider postponing race or adjusting goals significantly.' :
        trainingMetrics.tsb < -10 ?
        'Moderately fatigued. Adjust race goals by 2-3% slower.' :
        trainingMetrics.tsb < -5 ?
        'Slightly fatigued but raceable. Expect to work harder for goal pace.' :
        trainingMetrics.tsb > 15 ?
        'PEAK: Very well rested! Ideal conditions for a PR attempt.' :
        trainingMetrics.tsb > 5 ?
        'Well tapered. Good position for strong performance.' :
        'Balanced. Adequate recovery for race effort.',
      recent_race_pace_efforts: racePaceWorkouts.length > 0 ?
        racePaceWorkouts.map((w: typeof racePaceWorkouts[number]) => ({
          date: new Date(w.date).toLocaleDateString(),
          distance: `${w.distanceMiles?.toFixed(1)} miles`,
          pace: formatPace(w.avgPaceSeconds || racePaceSeconds || actualPaces.marathon),
          assessment: w.avgPaceSeconds && racePaceSeconds ?
            w.avgPaceSeconds <= racePaceSeconds ? 'On target' : 'Slightly slow' : 'Unknown'
        })) :
        'No recent race-pace efforts found',
      recommendation: trainingMetrics.tsb < -10 ?
        'Consider conservative pacing. Start 5-10 sec/mi slower than goal.' :
        trainingMetrics.tsb > 10 ?
        'Fitness peaked. Can be aggressive with pacing if conditions allow.' :
        'Execute planned pacing strategy. Trust your training.',
    },
    weather_forecast: weatherInfo ? {
      temperature: `${weatherInfo.temperature}°F`,
      conditions: weatherInfo.conditions,
      humidity: `${weatherInfo.humidity}%`,
      wind: `${weatherInfo.wind_speed} mph`,
      impact: weatherInfo.pace_adjustment.recommendation,
      adjusted_goal: weatherInfo.pace_adjustment.adjustedPace,
    } : daysUntil <= 7 ? 'No location set for weather forecast' : 'Check forecast closer to race day',
    pacing_strategy: pacingStrategy,
    split_targets: splitTargets,
    warmup_routine: warmupRoutine,
    race_week_plan: {
      nutrition: distanceMiles > 13 ? [
        '7 days out: Normal eating, stay hydrated',
        '4-6 days out: Increase carb percentage to 60-70%',
        '2-3 days out: High carb, lower fiber, familiar foods only',
        '1 day out: Light, early dinner. No new foods',
        'Race morning: Practiced breakfast 2-3 hours before',
      ] : [
        '2-3 days out: Slightly increase carbs',
        '1 day out: Normal eating, avoid heavy/spicy foods',
        'Race morning: Light breakfast 2+ hours before',
      ],
      taper: [
        `This week: ${Math.round(avgMileage * 0.7)}-${Math.round(avgMileage * 0.8)} miles total`,
        'Maintain intensity, reduce volume',
        '1-2 quality sessions with reduced reps',
        'Race pace strides 2-3 days before',
        'Trust the taper - less is more',
      ],
    },
    race_morning_timeline: [
      `${distanceMiles > 13 ? '3-4' : '2-3'} hours before: Wake, bathroom, eat tested breakfast`,
      `2 hours before: Hydrate (16-20oz), get dressed, apply Body Glide`,
      '90 min before: Leave for venue with extra time for parking',
      '60 min before: Check bag, final bathroom visit, light dynamic stretching',
      `${distanceMiles > 10 ? '30' : '45'} min before: Begin warmup routine`,
      '15 min before: Get to corral/start area, stay loose',
      '5 min before: Final mental prep, review pace strategy',
    ],
    personalized_tips: [
      // TSB-based tip
      trainingMetrics.tsb < -10 ?
        `Your TSB of ${trainingMetrics.tsb} indicates fatigue. Start conservatively and assess at halfway.` :
        trainingMetrics.tsb > 10 ?
        `Your TSB of ${trainingMetrics.tsb} shows excellent taper. You're primed for a strong effort!` :
        `Your TSB of ${trainingMetrics.tsb} is balanced. Execute your plan with confidence.`,

      // Recent performance tip
      racePaceWorkouts.length > 0 ?
        `Recent ${formatPace(racePaceSeconds || actualPaces.marathon)} pace efforts: ${racePaceWorkouts.map((w: typeof racePaceWorkouts[number]) => `${w.distanceMiles?.toFixed(1)}mi`).join(', ')}. ${
          racePaceWorkouts.every((w: typeof racePaceWorkouts[number]) => w.avgPaceSeconds && racePaceSeconds && w.avgPaceSeconds <= racePaceSeconds) ?
          'All on target - you\'re ready!' : 'Some were challenging - consider starting conservatively.'
        }` :
        'No recent race-pace work detected. Trust your fitness but start controlled.',

      // Mileage-based tip
      avgMileage > 60 ?
        `Your ${Math.round(avgMileage)} mi/week base is elite level. Use your endurance to negative split.` :
        avgMileage > 40 ?
        `Solid ${Math.round(avgMileage)} mi/week base. You've done the work - now execute.` :
        avgMileage > 25 ?
        `Your ${Math.round(avgMileage)} mi/week is appropriate. Focus on even pacing.` :
        `With ${Math.round(avgMileage)} mi/week, prioritize finishing strong over early speed.`,

      // Weather-specific tip
      weatherInfo && weatherInfo.temperature > 75 ?
        `Heat (${weatherInfo.temperature}°F) will impact performance. Start slower, take every water station.` :
        weatherInfo && weatherInfo.temperature < 40 ?
        `Cold (${weatherInfo.temperature}°F) - warm up thoroughly, consider arm warmers you can toss.` :
        weatherInfo && weatherInfo.wind_speed > 15 ?
        `Wind (${weatherInfo.wind_speed} mph) - draft when possible, adjust effort not pace into headwind.` :
        weatherInfo ?
        `Good conditions (${weatherInfo.temperature}°F). Stick to your planned pacing.` :
        'Check weather 2 days out to finalize clothing and pacing adjustments.',

      // Distance-specific tactical tip
      distanceMiles >= 26.2 ?
        `Marathon: Miles 1-10 should feel too easy. 11-20 controlled. 21-26 is where you race.` :
        distanceMiles >= 13.1 ?
        `Half Marathon: First 3 miles controlled. Miles 4-10 at goal pace. Final 5K is your racing.` :
        distanceMiles >= 6.2 ?
        `10K: After mile 2, it will hurt. That's normal - maintain rhythm and stay mentally strong.` :
        `5K: This is 18-25 minutes of discomfort. Embrace it - that's what racing feels like.`,

      // Final mental tip based on experience
      vdot && vdot > 55 ?
        'Your fitness indicates sub-elite level. Race tactically - position matters.' :
        vdot && vdot > 45 ?
        'Solid fitness level. Focus on your own race, not others around you.' :
        'Run YOUR race. The clock is your only competition.',
    ],
  };
}

async function rememberContext(input: Record<string, unknown>) {
  const contextType = input.context_type as string;
  const content = input.content as string;
  const importance = (input.importance as 'low' | 'medium' | 'high') || 'medium';

  const profileId = await getActiveProfileId();
  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  const now = new Date().toISOString();

  // Generate a unique key based on type and content hash
  const contextKey = `${contextType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // Import at function level to avoid circular dependency
    const { coachContext } = await import('@/lib/db');

    // Check if we already have too many contexts for this profile
    const existingContexts = await db
      .select()
      .from(coachContext)
      .where(eq(coachContext.profileId, profileId))
      .orderBy(desc(coachContext.createdAt));

    // Keep only last 100 contexts per profile
    if (existingContexts.length >= 100) {
      // Delete oldest contexts
      const toDelete = existingContexts.slice(99);
      for (const ctx of toDelete) {
        await db.delete(coachContext).where(eq(coachContext.id, ctx.id));
      }
    }

    // Insert new context
    await db.insert(coachContext).values({
      profileId,
      contextType,
      contextKey,
      contextValue: content,
      importance,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      message: `Remembered: ${content}`,
      context_type: contextType,
      importance,
    };
  } catch (error) {
    console.error('Error saving context:', error);
    return {
      success: false,
      error: 'Failed to save context',
    };
  }
}

async function recallContext(input: Record<string, unknown>) {
  const contextType = input.context_type as string;
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  try {
    // Import at function level to avoid circular dependency
    const { coachContext } = await import('@/lib/db');

    // Query contexts from database
    let contexts: Array<{ id: number; profileId: number; contextType: string; contextKey: string; contextValue: string; importance: string; createdAt: string; updatedAt: string }>;
    if (contextType && contextType !== 'all') {
      contexts = await db
        .select()
        .from(coachContext)
        .where(and(
          eq(coachContext.profileId, profileId),
          eq(coachContext.contextType, contextType)
        ))
        .orderBy(desc(coachContext.createdAt));
    } else {
      contexts = await db
        .select()
        .from(coachContext)
        .where(eq(coachContext.profileId, profileId))
        .orderBy(desc(coachContext.createdAt));
    }

    if (contexts.length === 0) {
      return {
        has_context: false,
        message: 'No context stored yet.',
      };
    }

    // Group by type
    const grouped: Record<string, string[]> = {};
    for (const ctx of contexts) {
      if (!grouped[ctx.contextType]) {
        grouped[ctx.contextType] = [];
      }
      grouped[ctx.contextType].push(`[${ctx.importance}] ${ctx.contextValue}`);
    }

    // Calculate time ago for recent contexts
    const recentContexts = contexts.slice(0, 10).map(c => {
      const minutesAgo = Math.round((new Date().getTime() - new Date(c.createdAt).getTime()) / 1000 / 60);
      const timeAgo = minutesAgo < 60
        ? `${minutesAgo} minutes ago`
        : minutesAgo < 1440
        ? `${Math.round(minutesAgo / 60)} hours ago`
        : `${Math.round(minutesAgo / 1440)} days ago`;

      return {
        type: c.contextType,
        content: c.contextValue,
        importance: c.importance,
        time_ago: timeAgo,
      };
    });

    return {
      has_context: true,
      context_count: contexts.length,
      contexts_by_type: grouped,
      recent_contexts: recentContexts,
      usage_note: 'Use this context to inform your coaching. Reference relevant past decisions and preferences.',
    };
  } catch (error) {
    console.error('Error recalling context:', error);
    return {
      has_context: false,
      error: 'Failed to retrieve context',
    };
  }
}

export {
  getPrepForTomorrow,
  overrideWorkoutStructure,
  getPerformanceModel,
  handleGetCoachingKnowledge,
  prescribeWorkout,
  getRaceDayPlan,
  rememberContext,
  recallContext,
};
