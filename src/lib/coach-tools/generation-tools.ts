// generation-tools - Coach tool implementations
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


async function generateTrainingPlan(input: Record<string, unknown>) {
  const raceId = input.race_id as number;
  const profileId = await getActiveProfileId();

  // Get race details
  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!race) {
    return { error: 'Race not found. Please add a race first using add_race.' };
  }

  // Get user settings
  const settings = await db.query.userSettings.findFirst({
    where: profileId ? eq(userSettings.profileId, profileId) : undefined
  });
  if (!settings) {
    return { error: 'User settings not found. Please complete onboarding first.' };
  }

  // Validate minimum required data
  if (!settings.currentWeeklyMileage) {
    return { error: 'Please set your current weekly mileage first.' };
  }

  // Import plan generator dynamically to avoid circular dependencies
  const { generateTrainingPlan: generatePlan } = await import('@/lib/training/plan-generator');
  const { calculatePaceZones } = await import('@/lib/training/vdot-calculator');

  const today = new Date();
  const raceDate = new Date(race.date);
  const totalWeeks = Math.floor((raceDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));

  if (totalWeeks < 4) {
    return { error: 'Not enough time for a proper training plan. Need at least 4 weeks before the race.' };
  }

  const paceZones = settings.vdot && settings.vdot >= 15 && settings.vdot <= 85 ? calculatePaceZones(settings.vdot) : undefined;

  // Parse preferred quality days from settings (stored as JSON string)
  let preferredQualityDays: string[] = ['tuesday', 'thursday'];
  try {
    if (settings.preferredQualityDays) {
      preferredQualityDays = JSON.parse(settings.preferredQualityDays as string);
    }
  } catch {
    // Use defaults
  }

  // Parse required rest days from settings
  let requiredRestDays: string[] = [];
  try {
    if (settings.requiredRestDays) {
      requiredRestDays = JSON.parse(settings.requiredRestDays as string);
    }
  } catch {
    // Use defaults
  }

  // Get intermediate races (B/C races between now and the goal race)
  const allRaces = await db.query.races.findMany({
    where: eq(races.profileId, race.profileId),
    orderBy: [asc(races.date)],
  });
  const startDate = today.toISOString().split('T')[0];
  const intermediateRaces = allRaces
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.id !== race.id && r.date >= startDate && r.date < race.date)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      name: r.name,
      date: r.date,
      distanceMeters: r.distanceMeters,
      priority: r.priority as 'B' | 'C',
    }));

  try {
    const generatedPlan = generatePlan({
      raceId: race.id,
      raceDate: race.date,
      raceDistanceMeters: race.distanceMeters,
      raceDistanceLabel: race.distanceLabel,
      startDate,
      currentWeeklyMileage: settings.currentWeeklyMileage || 25,
      peakWeeklyMileageTarget: settings.peakWeeklyMileageTarget || (settings.currentWeeklyMileage || 25) * 1.3,
      runsPerWeek: settings.runsPerWeekTarget || settings.runsPerWeekCurrent || 5,
      preferredLongRunDay: (settings.preferredLongRunDay as string) || 'saturday',
      preferredQualityDays,
      requiredRestDays,
      planAggressiveness: (settings.planAggressiveness as 'conservative' | 'moderate' | 'aggressive') || 'moderate',
      qualitySessionsPerWeek: settings.qualitySessionsPerWeek || 2,
      paceZones,
      currentLongRunMax: settings.currentLongRunMax || undefined,
      intermediateRaces: intermediateRaces.length > 0 ? intermediateRaces : undefined,
    });

    // Save training blocks to database (one per week)
    const now = new Date().toISOString();
    const blockInserts = generatedPlan.weeks.map((week: typeof generatedPlan.weeks[number]) => ({
      raceId: race.id,
      name: `Week ${week.weekNumber} - ${week.phase.charAt(0).toUpperCase() + week.phase.slice(1)}`,
      phase: week.phase as 'base' | 'build' | 'peak' | 'taper' | 'recovery',
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      targetMileage: Math.round(week.targetMileage),
      focus: week.focus,
      createdAt: now,
    }));

    await db.insert(trainingBlocks).values(blockInserts);

    // Save planned workouts to database
    const workoutInserts = generatedPlan.weeks.flatMap((week: typeof generatedPlan.weeks[number]) =>
      week.workouts.map((workout: typeof week.workouts[number]) => ({
        raceId: race.id,
        date: workout.date,
        name: workout.name,
        workoutType: workout.workoutType as 'easy' | 'steady' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery' | 'cross_train' | 'other',
        targetDistanceMiles: workout.targetDistanceMiles || null,
        targetDurationMinutes: workout.targetDurationMinutes || null,
        targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile || null,
        description: workout.description,
        rationale: workout.rationale || null,
        isKeyWorkout: workout.isKeyWorkout,
        status: 'scheduled' as const,
        createdAt: now,
        updatedAt: now,
      }))
    );

    await db.insert(plannedWorkouts).values(workoutInserts);

    // Update race to mark plan as generated
    await db.update(races)
      .set({ trainingPlanGenerated: true })
      .where(eq(races.id, race.id));

    return {
      success: true,
      message: `Training plan generated for ${race.name}!`,
      summary: {
        total_weeks: generatedPlan.totalWeeks,
        phases: generatedPlan.phases.map((p: typeof generatedPlan.phases[number]) => ({
          phase: p.phase,
          weeks: p.weeks,
          focus: p.focus,
        })),
        total_workouts: workoutInserts.length,
        peak_mileage: generatedPlan.summary.peakMileage,
      },
    };
  } catch (error) {
    return {
      error: `Failed to generate plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function getStandardPlansHandler(input: Record<string, unknown>) {
  const raceDistance = input.race_distance as 'marathon' | 'half_marathon' | '10K' | '5K' | undefined;
  const author = input.author as string | undefined;
  const planId = input.plan_id as string | undefined;

  // If specific plan ID requested
  if (planId) {
    const plan = getStandardPlan(planId);
    if (!plan) {
      return {
        error: `Plan not found: ${planId}`,
        available_plans: standardPlans.map(p => ({ id: p.id, name: p.name, author: p.author })),
      };
    }

    return {
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        author: plan.author,
        description: plan.description,
        philosophy: plan.philosophy,
        race_distance: plan.raceDistance,
        weeks: plan.weeks,
        peak_week_miles: plan.peakWeekMiles,
        runs_per_week: plan.runsPerWeek,
        quality_sessions_per_week: plan.qualitySessionsPerWeek,
        max_long_run_miles: plan.maxLongRunMiles,
        key_workouts: plan.keyWorkouts,
        suitable_for: plan.suitableFor,
        required_weekly_mileage: plan.requiredWeeklyMileage,
        taper_weeks: plan.taperWeeks,
      },
    };
  }

  // Filter by author
  if (author) {
    const authorPlans = getPlansByAuthor(author);
    return {
      success: true,
      author: author,
      plans: authorPlans.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        race_distance: p.raceDistance,
        weeks: p.weeks,
        peak_week_miles: p.peakWeekMiles,
        suitable_for: p.suitableFor,
        required_weekly_mileage: p.requiredWeeklyMileage,
      })),
    };
  }

  // Get user settings to find suitable plans
  const profileId = await getActiveProfileId();
  const settings = await db.query.userSettings.findFirst({
    where: profileId ? eq(userSettings.profileId, profileId) : undefined
  });
  const currentMileage = settings?.currentWeeklyMileage || 25;

  // Filter by race distance if provided
  let plans = standardPlans;
  if (raceDistance) {
    plans = plans.filter(p => p.raceDistance === raceDistance);
  }

  // Sort by suitability (closest match to current mileage)
  const sortedPlans = plans.sort((a, b) => {
    const diffA = Math.abs(a.requiredWeeklyMileage - currentMileage);
    const diffB = Math.abs(b.requiredWeeklyMileage - currentMileage);
    return diffA - diffB;
  });

  return {
    success: true,
    current_weekly_mileage: currentMileage,
    race_distance_filter: raceDistance || 'all',
    plans: sortedPlans.map(p => ({
      id: p.id,
      name: p.name,
      author: p.author,
      description: p.description,
      race_distance: p.raceDistance,
      weeks: p.weeks,
      peak_week_miles: p.peakWeekMiles,
      runs_per_week: p.runsPerWeek,
      suitable_for: p.suitableFor,
      required_weekly_mileage: p.requiredWeeklyMileage,
      fits_current_fitness: p.requiredWeeklyMileage <= currentMileage,
    })),
    recommendation: sortedPlans.length > 0 && sortedPlans[0].requiredWeeklyMileage <= currentMileage
      ? `Based on your current ${currentMileage} miles/week, ${sortedPlans[0].name} would be a good fit.`
      : `You may need to build your base before starting these plans. Current: ${currentMileage} mi/week.`,
  };
}

async function rewriteWorkoutForTime(input: Record<string, unknown>) {
  const minutes = input.minutes as number;
  const preserveWarmup = input.preserve_warmup !== false;

  // Get today's planned workout
  const today = new Date().toISOString().split('T')[0];
  const plannedWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!plannedWorkout) {
    return {
      error: 'No planned workout found for today',
      suggestion: `With ${minutes} minutes, consider an easy ${Math.round(minutes / 10)} mile run.`,
    };
  }

  // Get user settings for pacing
  const s = await getSettingsForProfile();
  const easyPace = s?.easyPaceSeconds || 540;

  // Calculate what's achievable in the time
  const minWarmup = preserveWarmup ? 10 : 5;
  const minCooldown = 5;
  const availableMainTime = minutes - minWarmup - minCooldown;

  if (minutes < 25) {
    // Under 25 minutes - just do easy effort
    const estimatedMiles = Math.round((minutes * 60 / easyPace) * 10) / 10;
    return {
      original: {
        name: plannedWorkout.name,
        type: plannedWorkout.workoutType,
        distance: plannedWorkout.targetDistanceMiles,
        duration: plannedWorkout.targetDurationMinutes,
      },
      rewritten: {
        name: 'Quick Easy Run',
        type: 'easy',
        distance: estimatedMiles,
        duration: minutes,
        description: `Easy-paced run for ${minutes} minutes. Focus on moving well rather than hitting targets.`,
      },
      reasoning: 'Under 25 minutes is best spent on easy effort to maintain fitness without fatigue.',
      original_intent_preserved: false,
      note: plannedWorkout.workoutType !== 'easy'
        ? `Consider rescheduling your ${plannedWorkout.workoutType} to a day with more time.`
        : 'Original intent maintained.',
    };
  }

  // Determine how to preserve training intent
  const workoutType = plannedWorkout.workoutType;
  let rewritten;

  if (workoutType === 'easy' || workoutType === 'recovery') {
    // Easy runs - just shorten
    const estimatedMiles = Math.round((minutes * 60 / easyPace) * 10) / 10;
    rewritten = {
      name: `Shortened ${plannedWorkout.name}`,
      type: workoutType,
      distance: estimatedMiles,
      duration: minutes,
      description: `Easy run for ${minutes} minutes.`,
    };
  } else if (workoutType === 'long') {
    // Long runs - if less than 60% of planned, suggest postpone
    const originalDuration = plannedWorkout.targetDurationMinutes || 90;
    if (minutes < originalDuration * 0.6) {
      return {
        original: {
          name: plannedWorkout.name,
          type: workoutType,
          distance: plannedWorkout.targetDistanceMiles,
          duration: originalDuration,
        },
        recommendation: 'postpone',
        reasoning: `${minutes} minutes is less than 60% of your planned long run. Suggest postponing to tomorrow or the weekend.`,
        alternative: {
          name: 'Easy Run',
          type: 'easy',
          distance: Math.round((minutes * 60 / easyPace) * 10) / 10,
          duration: minutes,
          description: `Easy run to keep the streak going. Reschedule long run when you have more time.`,
        },
      };
    }
    // Reduce long run but keep it meaningful
    const reducedMiles = Math.round((minutes * 60 / easyPace) * 10) / 10;
    rewritten = {
      name: 'Medium-Long Run',
      type: 'long',
      distance: reducedMiles,
      duration: minutes,
      description: `Shortened long run. Maintain easy pace throughout.`,
    };
  } else if (workoutType === 'tempo' || workoutType === 'threshold') {
    // Quality workouts - preserve intensity, reduce volume
    const tempoPace = s?.tempoPaceSeconds || 420;
    const tempoTime = Math.max(10, availableMainTime - 5); // At least 10 min of tempo
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _tempoMiles = Math.round((tempoTime * 60 / tempoPace) * 10) / 10;

    rewritten = {
      name: `Shortened ${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}`,
      type: workoutType,
      distance: null,
      duration: minutes,
      structure: {
        warmup: `${minWarmup} min easy`,
        main: `${tempoTime} min at ${workoutType} effort`,
        cooldown: `${minCooldown} min easy`,
      },
      description: `Warmup ${minWarmup} min, then ${tempoTime} min at ${workoutType} pace, cool down ${minCooldown} min.`,
    };
  } else if (workoutType === 'interval') {
    // Intervals - reduce reps but keep intensity
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _intervalPace = s?.intervalPaceSeconds || 360;
    const reps = Math.max(3, Math.floor(availableMainTime / 4)); // ~4 min per rep with recovery

    rewritten = {
      name: 'Shortened Intervals',
      type: 'interval',
      duration: minutes,
      structure: {
        warmup: `${minWarmup} min easy`,
        main: `${reps} x 400m with 90s jog recovery`,
        cooldown: `${minCooldown} min easy`,
      },
      description: `Warmup, then ${reps} x 400m at interval effort, cool down. Quality over quantity.`,
    };
  } else {
    // Default fallback
    const estimatedMiles = Math.round((minutes * 60 / easyPace) * 10) / 10;
    rewritten = {
      name: 'Adapted Workout',
      type: 'easy',
      distance: estimatedMiles,
      duration: minutes,
      description: `${minutes} minute easy run. Original workout adapted for time.`,
    };
  }

  return {
    original: {
      name: plannedWorkout.name,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      duration: plannedWorkout.targetDurationMinutes,
      description: plannedWorkout.description,
    },
    rewritten,
    reasoning: `Adapted ${plannedWorkout.workoutType} workout to fit ${minutes} minute window while preserving training intent.`,
    original_intent_preserved: workoutType === 'easy' || workoutType === 'recovery' || minutes >= 40,
  };
}

async function explainWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number | undefined;

  // Get the workout (most recent for this profile if no ID provided)
  let workout;
  if (workoutId) {
    workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
      with: { assessment: true, segments: true },
    });
  } else {
    const explainProfileId = await getActiveProfileId();
    workout = await db.query.workouts.findFirst({
      where: explainProfileId ? eq(workouts.profileId, explainProfileId) : undefined,
      with: { assessment: true, segments: true },
      orderBy: [desc(workouts.date), desc(workouts.createdAt)],
    });
  }

  if (!workout) {
    return { error: 'Workout not found' };
  }

  // Get user settings
  const s = await getSettingsForProfile();

  // Get recent workouts for context
  const explainCutoff = new Date();
  explainCutoff.setDate(explainCutoff.getDate() - 7);
  const explainContextProfileId = await getActiveProfileId();
  const recentWorkouts = await db.query.workouts.findMany({
    where: explainContextProfileId
      ? and(eq(workouts.profileId, explainContextProfileId), gte(workouts.date, explainCutoff.toISOString().split('T')[0]))
      : gte(workouts.date, explainCutoff.toISOString().split('T')[0]),
    with: { assessment: true },
    orderBy: [desc(workouts.date)],
  });

  // Run classification
  const classification = classifyRun(workout as Workout, s as UserSettings, workout.segments as WorkoutSegment[]);

  // Check data quality
  const dataQuality = checkDataQuality(workout as Workout, workout.segments as WorkoutSegment[]);

  // Generate explanation context
  const context = generateExplanationContext(
    workout as Workout,
    classification,
    dataQuality,
    s as UserSettings,
    recentWorkouts.filter((w: typeof recentWorkouts[number]) => w.id !== workout.id) as Workout[],
    workout.assessment as {
      sleepQuality?: number;
      sleepHours?: number;
      stress?: number;
      soreness?: number;
      fueling?: number;
      hydration?: number;
      rpe?: number;
    } | undefined
  );

  // Build the explanation
  const factors = context.factors;
  const reasons = context.likelyReasons;
  const suggestions = context.suggestions;

  let mainExplanation = '';
  if (factors.length === 0) {
    mainExplanation = 'No obvious factors detected. Sometimes runs just feel harder than expected - that\'s normal.';
  } else if (factors.length === 1) {
    mainExplanation = `This workout was likely affected by ${factors[0]}.`;
  } else {
    mainExplanation = `Multiple factors may have contributed: ${factors.slice(0, 3).join(', ')}.`;
  }

  // Tomorrow suggestion
  let tomorrowSuggestion = 'Listen to your body tomorrow and adjust accordingly.';
  if (context.suggestions.includes('Consider a lighter day tomorrow')) {
    tomorrowSuggestion = 'Take it easier tomorrow - your body may need recovery.';
  } else if (factors.includes('poor sleep') || factors.includes('sleep deficit')) {
    tomorrowSuggestion = 'Prioritize sleep tonight. Tomorrow will feel better with rest.';
  } else if (factors.includes('challenging weather')) {
    tomorrowSuggestion = 'The weather was tough. Tomorrow might feel much better.';
  }

  return {
    workout: {
      date: workout.date,
      type: workout.workoutType,
      distance: workout.distanceMiles,
      pace: workout.avgPaceSeconds ? formatPaceFromTraining(workout.avgPaceSeconds) : null,
      verdict: workout.assessment?.verdict,
      rpe: workout.assessment?.rpe,
    },
    classification: {
      category: classification.category,
      confidence: Math.round(classification.confidence * 100),
      summary: classification.summary,
    },
    explanation: mainExplanation,
    contributing_factors: factors,
    likely_reasons: reasons,
    suggestions,
    tomorrow_suggestion: tomorrowSuggestion,
    data_quality: {
      score: dataQuality.overallScore,
      summary: getDataQualitySummary(dataQuality),
    },
  };
}

async function explainRecommendation(input: Record<string, unknown>) {
  const recommendationType = input.recommendation_type as string;
  const context = input.context as string | undefined;

  const explanations: Record<string, { principle: string; factors: string[]; evidence: string }> = {
    pace_adjustment: {
      principle: 'Pace adjustments account for conditions that affect running economy.',
      factors: ['Temperature', 'Humidity', 'Wind', 'Altitude', 'Terrain'],
      evidence: 'Research shows heat adds ~2% per 10°F above 55°F; altitude reduces performance ~3% per 3,000ft.',
    },
    workout_modification: {
      principle: 'Modifications preserve training intent while adapting to circumstances.',
      factors: ['Time constraints', 'Fatigue level', 'Weather', 'Schedule conflicts'],
      evidence: 'Maintaining workout frequency with adjusted volume is better than skipping entirely.',
    },
    rest_day: {
      principle: 'Rest is when adaptation happens. Strategic rest prevents overtraining.',
      factors: ['Accumulated fatigue', 'High stress', 'Poor sleep streak', 'Elevated RPE trend'],
      evidence: 'Studies show performance gains come during recovery, not during hard efforts.',
    },
    intensity_change: {
      principle: 'Training zones should match your current fitness and recovery state.',
      factors: ['Current VDOT', 'Recent performance', 'Fatigue indicators', 'Training phase'],
      evidence: 'Running easy runs too fast is the most common training mistake - it compromises recovery.',
    },
    plan_adjustment: {
      principle: 'Plans should adapt to life. Rigid adherence can lead to burnout or injury.',
      factors: ['Life stress', 'Illness', 'Work demands', 'Plan adherence rate'],
      evidence: 'Successful training comes from consistent, sustainable effort over months.',
    },
  };

  const explanation = explanations[recommendationType] || {
    principle: 'Recommendations are based on your training history and current state.',
    factors: ['Recent training load', 'Recovery indicators', 'Goals'],
    evidence: 'Personalized coaching adapts to your unique situation.',
  };

  return {
    recommendation_type: recommendationType,
    context: context || 'General guidance',
    underlying_principle: explanation.principle,
    factors_considered: explanation.factors,
    supporting_evidence: explanation.evidence,
    additional_context: 'Every recommendation aims to help you train consistently while avoiding injury.',
  };
}

async function convertToTreadmill(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number | undefined;
  const inclinePercent = (input.incline_percent as number) || 1;

  // Get the workout (today's planned if no ID)
  let plannedWorkout;
  if (workoutId) {
    plannedWorkout = await db.query.plannedWorkouts.findFirst({
      where: eq(plannedWorkouts.id, workoutId),
    });
  } else {
    const today = new Date().toISOString().split('T')[0];
    plannedWorkout = await db.query.plannedWorkouts.findFirst({
      where: eq(plannedWorkouts.date, today),
    });
  }

  if (!plannedWorkout) {
    return { error: 'No planned workout found' };
  }

  // Base conversion: add incline OR slow pace
  const targetPace = plannedWorkout.targetPaceSecondsPerMile;
  const adjustedPace = targetPace ? targetPace + 15 : null; // Add 15 sec/mi

  let treadmillVersion;

  if (plannedWorkout.workoutType === 'easy' || plannedWorkout.workoutType === 'recovery') {
    treadmillVersion = {
      name: `Treadmill ${plannedWorkout.name}`,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      incline: inclinePercent,
      pace_adjustment: '+15 sec/mi OR use 1% incline at original pace',
      description: `Set incline to ${inclinePercent}% to simulate outdoor resistance. Keep effort easy.`,
      tips: [
        'Use a fan to simulate airflow',
        'Vary pace/incline slightly to reduce monotony',
        'Consider a show or music to pass time',
      ],
    };
  } else if (plannedWorkout.workoutType === 'tempo' || plannedWorkout.workoutType === 'threshold') {
    treadmillVersion = {
      name: `Treadmill ${plannedWorkout.name}`,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      incline: inclinePercent,
      pace_adjustment: adjustedPace ? `Target ${formatPaceFromTraining(adjustedPace)}/mi at ${inclinePercent}% incline` : 'Maintain effort level',
      description: `Tempo effort on treadmill at ${inclinePercent}% incline. Use effort/HR more than pace.`,
      tips: [
        'Treadmill tempo often feels harder mentally',
        'Break it into segments if needed',
        'Focus on effort, not exact pace',
      ],
    };
  } else if (plannedWorkout.workoutType === 'interval') {
    treadmillVersion = {
      name: `Treadmill Intervals`,
      type: 'interval',
      description: 'Adapted interval workout for treadmill',
      structure: {
        warmup: '10 min easy at 1% incline',
        main: 'Intervals: Increase speed for work, decrease for recovery',
        cooldown: '5-10 min easy',
      },
      tips: [
        'Use speed changes rather than stopping',
        'Know your interval speeds before starting',
        'Recovery can be slow jog (4-5 mph) rather than standing',
      ],
    };
  } else if (plannedWorkout.workoutType === 'long') {
    // Hill workouts become incline intervals
    treadmillVersion = {
      name: `Treadmill Long Run`,
      type: 'long',
      distance: plannedWorkout.targetDistanceMiles,
      incline: inclinePercent,
      description: `Long run on treadmill. Use ${inclinePercent}% incline and vary between 0-2% to simulate rolling terrain.`,
      tips: [
        'Entertainment is essential for long treadmill runs',
        'Break into 20-30 min mental segments',
        'Take a bathroom/water break halfway if needed',
        'Slight incline variations help prevent repetitive strain',
      ],
    };
  } else {
    treadmillVersion = {
      name: `Treadmill ${plannedWorkout.name}`,
      type: plannedWorkout.workoutType,
      incline: inclinePercent,
      pace_adjustment: '+15-20 sec/mi or 1% incline',
      description: `Adapted for treadmill with ${inclinePercent}% base incline.`,
    };
  }

  return {
    original: {
      name: plannedWorkout.name,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      pace: plannedWorkout.targetPaceSecondsPerMile
        ? formatPaceFromTraining(plannedWorkout.targetPaceSecondsPerMile)
        : null,
    },
    treadmill_version: treadmillVersion,
    general_tips: [
      'Treadmill running is NOT cheating - it\'s a valid training tool',
      'Set incline to 1% to better simulate outdoor running',
      'Stay hydrated - you can\'t feel wind cooling you down',
      'Use this time for focused training without weather/safety concerns',
    ],
  };
}

async function generateRaceChecklist(input: Record<string, unknown>) {
  const raceId = input.race_id as number;

  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!race) {
    return { error: 'Race not found' };
  }

  const raceDate = new Date(race.date);
  const daysUntilRace = Math.ceil((raceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Determine race type for specific advice
  const isMarathon = race.distanceLabel.toLowerCase().includes('marathon') && !race.distanceLabel.toLowerCase().includes('half');
  const isHalf = race.distanceLabel.toLowerCase().includes('half');
  const is5k = race.distanceLabel === '5K';
  const is10k = race.distanceLabel === '10K';

  const checklist = {
    race: {
      name: race.name,
      date: race.date,
      distance: race.distanceLabel,
      days_until: daysUntilRace,
    },
    gear_prep: {
      timing: 'By Wednesday',
      items: [
        { item: 'Race outfit laid out', description: 'NOTHING NEW ON RACE DAY - wear what you\'ve trained in' },
        { item: 'Race shoes ready', description: 'Should have 50-100 miles on them already' },
        { item: 'Bib number attached', description: 'Pin it the night before' },
        { item: 'Watch/GPS charged', description: 'Full charge, know your target pace' },
        { item: 'Weather-appropriate layers', description: 'Check race day forecast' },
      ],
    },
    nutrition: {
      week_before: [
        'Maintain normal diet early in week',
        isMarathon || isHalf ? 'Increase carbs slightly Wed-Fri' : 'Normal eating',
        'Stay well hydrated all week',
        'Avoid new or unusual foods',
      ],
      day_before: [
        'Carb-focused dinner, nothing too heavy',
        'Avoid high fiber, spicy, or greasy foods',
        'Stop drinking alcohol',
        'Lay out race morning nutrition',
      ],
      race_morning: isMarathon
        ? ['Eat 3 hours before start', 'Familiar foods only', '400-600 calories', 'Coffee if you normally drink it']
        : isHalf
        ? ['Eat 2-3 hours before start', 'Light breakfast', '300-400 calories']
        : ['Light snack 1-2 hours before', 'Banana, toast, or energy bar'],
      during_race: isMarathon
        ? ['Hydrate at every station', 'Fuel every 45 min', 'Know your gel/nutrition plan']
        : isHalf
        ? ['Hydrate every 2-3 miles', 'One gel around mile 8-9 if needed']
        : ['Hydration only, no need for fuel'],
    },
    logistics: {
      timing: 'By Thursday',
      items: [
        { item: 'Know start time and location', checked: false },
        { item: 'Plan transportation and parking', checked: false },
        { item: 'Know bag check situation', checked: false },
        { item: 'Set multiple alarms for race morning', checked: false },
        { item: 'Know corral assignment', checked: false },
        { item: 'Have backup plans for bathroom', checked: false },
      ],
    },
    mental_prep: {
      week_before: [
        'Visualize the race going well',
        'Review your race plan and pacing strategy',
        'Remember: fitness is already banked, taper is for freshness',
        'Trust your training',
      ],
      day_before: [
        'Light shakeout jog if desired',
        'Avoid race expo stress (go early, don\'t walk too much)',
        'Early to bed (even if you can\'t sleep, rest helps)',
        'Review race morning routine',
      ],
      race_morning: [
        'Stick to your routine',
        'Arrive with plenty of time',
        'Don\'t get swept up in start line excitement',
        'Remember your pace plan for the first mile',
      ],
    },
    pacing_reminders: is5k
      ? ['First 400m will feel slow - that\'s correct', 'Settle in by mile 1', 'Empty the tank last half mile']
      : is10k
      ? ['First mile should feel easy', 'Build into race pace', 'Final 2K can push']
      : isHalf
      ? ['First 3 miles EASY', 'Settle into goal pace miles 4-10', 'Run the last 5K with what you have left']
      : isMarathon
      ? ['SLOW first 10K - bank time = bonk later', 'Goal pace miles 10-20', 'Survive and surge after mile 20']
      : ['Start conservative', 'Build through the middle', 'Finish strong'],
  };

  return checklist;
}

async function activateBusyWeek(input: Record<string, unknown>) {
  const reason = input.reason as string | undefined;
  const reductionPercent = (input.reduction_percent as number) || 40;
  const preserveKeyWorkout = input.preserve_key_workout !== false;

  // Get this week's workouts
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const startStr = startOfWeek.toISOString().split('T')[0];
  const endStr = endOfWeek.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  // Get future workouts this week
  const weekWorkouts = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, todayStr),
      lte(plannedWorkouts.date, endStr),
      eq(plannedWorkouts.status, 'scheduled')
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  if (weekWorkouts.length === 0) {
    return { message: 'No planned workouts remaining this week to modify.' };
  }

  // Identify key workout if preserving
  const keyWorkout = preserveKeyWorkout
    ? weekWorkouts.find((w: typeof weekWorkouts[number]) => w.isKeyWorkout || w.workoutType === 'tempo' || w.workoutType === 'long')
    : null;

  const modifications = [];
  const scaleFactor = 1 - (reductionPercent / 100);

  for (const workout of weekWorkouts) {
    if (keyWorkout && workout.id === keyWorkout.id) {
      // Reduce key workout by half the normal reduction
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * (1 - reductionPercent / 200) * 10) / 10
        : null;
      modifications.push({
        workout_id: workout.id,
        original: { name: workout.name, type: workout.workoutType, distance: workout.targetDistanceMiles },
        modified: { type: workout.workoutType, distance: newDistance, note: 'Reduced but preserved as key workout' },
      });

      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          description: `[Busy Week] ${workout.description}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(plannedWorkouts.id, workout.id));
    } else {
      // Convert to easy and reduce
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
        : null;
      modifications.push({
        workout_id: workout.id,
        original: { name: workout.name, type: workout.workoutType, distance: workout.targetDistanceMiles },
        modified: { type: 'easy', distance: newDistance, note: 'Converted to easy' },
      });

      await db.update(plannedWorkouts)
        .set({
          workoutType: 'easy' as const,
          name: 'Easy Run',
          targetDistanceMiles: newDistance,
          description: `[Busy Week] Easy run - scaled back from ${workout.name}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(plannedWorkouts.id, workout.id));
    }
  }

  return {
    success: true,
    message: `Busy week mode activated. Reduced volume by ${reductionPercent}%.`,
    reason: reason || 'Life demands',
    modifications,
    key_workout_preserved: keyWorkout ? keyWorkout.name : null,
    tip: 'Remember: a reduced week is better than no running. Stay consistent with what you can do.',
  };
}

async function setTravelMode(input: Record<string, unknown>) {
  const startDate = input.start_date as string;
  const endDate = input.end_date as string;
  const destination = input.destination as string | undefined;
  const hasTreadmill = input.has_treadmill as boolean | undefined;
  const hasGym = input.has_gym as boolean | undefined;

  // Update coach settings
  await db.update(userSettings)
    .set({
      updatedAt: new Date().toISOString(),
    });

  // Get workouts during travel period
  const travelWorkouts = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startDate),
      lte(plannedWorkouts.date, endDate),
      eq(plannedWorkouts.status, 'scheduled')
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  const adjustments = [];

  for (const workout of travelWorkouts) {
    let newType = workout.workoutType;
    let newDescription = workout.description;
    let adjustmentNote = '';

    if (!hasTreadmill && (workout.workoutType === 'tempo' || workout.workoutType === 'interval')) {
      // Convert quality to easy if no treadmill for bad weather
      newType = 'easy' as const;
      newDescription = `[Travel] Easy run instead of ${workout.workoutType}. Explore your surroundings!`;
      adjustmentNote = 'No treadmill - converted to easy outdoor exploration run';
    } else if (workout.workoutType === 'long') {
      // Reduce long runs during travel
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * 0.7 * 10) / 10
        : null;
      newDescription = `[Travel] Reduced long run. Enjoy a new route!`;
      adjustmentNote = 'Long run reduced for travel';

      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          description: newDescription,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(plannedWorkouts.id, workout.id));

      adjustments.push({
        date: workout.date,
        original: workout.name,
        adjusted: `Reduced long run (${newDistance} mi)`,
        note: adjustmentNote,
      });
      continue;
    }

    if (newType !== workout.workoutType) {
      await db.update(plannedWorkouts)
        .set({
          workoutType: newType,
          description: newDescription,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(plannedWorkouts.id, workout.id));

      adjustments.push({
        date: workout.date,
        original: workout.name,
        adjusted: `Easy run`,
        note: adjustmentNote,
      });
    } else {
      adjustments.push({
        date: workout.date,
        original: workout.name,
        adjusted: workout.name,
        note: 'No change needed',
      });
    }
  }

  return {
    success: true,
    travel_period: { start: startDate, end: endDate },
    destination,
    facilities: {
      treadmill: hasTreadmill || false,
      gym: hasGym || false,
    },
    workouts_affected: travelWorkouts.length,
    adjustments,
    tips: [
      'Running in new places is a great way to explore',
      'Adjust for timezone - morning runs help with jet lag',
      destination?.toLowerCase().includes('altitude') || destination?.toLowerCase().includes('denver') || destination?.toLowerCase().includes('boulder')
        ? 'Altitude will make runs feel harder - slow down!'
        : 'Have fun with your travel runs',
    ],
  };
}

async function generateReturnPlan(input: Record<string, unknown>) {
  const daysAway = input.days_away as number;
  const reason = (input.reason as string) || 'other';

  // Get user settings for baseline
  const s = await getSettingsForProfile();
  const baseWeeklyMileage = s?.currentWeeklyMileage || 25;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const easyPace = s?.easyPaceSeconds || 540;

  let returnPlan;
  let weeklyProgression;

  if (daysAway <= 4) {
    // Short break - minimal adjustment
    returnPlan = {
      phase: 'Quick Return',
      duration: '1-2 days',
      first_run: {
        type: 'easy',
        distance: 3,
        pace_note: 'Easy pace, add 10-15 sec/mi',
        description: 'Short and easy. Just shake out the legs.',
      },
      progression: 'Resume normal training after 1-2 easy runs',
    };
    weeklyProgression = null;
  } else if (daysAway <= 7) {
    // Week off - gradual return
    returnPlan = {
      phase: 'Gradual Return',
      duration: '3-4 days',
      first_run: {
        type: 'easy',
        distance: 2,
        pace_note: 'Very easy, no pace pressure',
        description: 'Just 20-25 minutes of easy jogging.',
      },
      days: [
        { day: 1, workout: '20-25 min easy' },
        { day: 2, workout: 'Rest or cross-train' },
        { day: 3, workout: '30 min easy' },
        { day: 4, workout: 'Rest' },
        { day: 5, workout: '35-40 min easy, then resume normal schedule' },
      ],
    };
    weeklyProgression = null;
  } else if (daysAway <= 14) {
    // Two weeks off - week of building
    returnPlan = {
      phase: 'Building Back',
      duration: '1 week',
      first_run: {
        type: 'easy',
        distance: 2,
        pace_note: 'Conversational pace',
        description: 'Start with a short, easy run.',
      },
      week_plan: [
        { day: 'Day 1', workout: '20 min easy' },
        { day: 'Day 2', workout: 'Rest' },
        { day: 'Day 3', workout: '25 min easy' },
        { day: 'Day 4', workout: 'Rest or cross-train' },
        { day: 'Day 5', workout: '30 min easy' },
        { day: 'Day 6', workout: 'Rest' },
        { day: 'Day 7', workout: '35-40 min easy' },
      ],
      next_week: 'Resume ~70% of normal volume',
    };
    weeklyProgression = [
      { week: 1, mileage: Math.round(baseWeeklyMileage * 0.5), note: 'Return week' },
      { week: 2, mileage: Math.round(baseWeeklyMileage * 0.7), note: 'Building' },
      { week: 3, mileage: Math.round(baseWeeklyMileage * 0.85), note: 'Approaching normal' },
      { week: 4, mileage: baseWeeklyMileage, note: 'Back to normal' },
    ];
  } else {
    // Extended time off - multi-week progression
    const weeksOff = Math.ceil(daysAway / 7);
    const returnWeeks = Math.min(weeksOff, 6);

    returnPlan = {
      phase: 'Extended Return',
      duration: `${returnWeeks} weeks`,
      first_run: {
        type: 'easy',
        distance: 1.5,
        pace_note: 'Whatever feels comfortable',
        description: 'Short and gentle. No expectations.',
      },
      note: `After ${weeksOff} weeks off, your cardiovascular fitness has decreased but it will come back faster than it was built.`,
    };

    weeklyProgression = [];
    for (let i = 1; i <= returnWeeks; i++) {
      const percentage = Math.min(40 + (i - 1) * 15, 100);
      weeklyProgression.push({
        week: i,
        mileage: Math.round(baseWeeklyMileage * (percentage / 100)),
        note: i === 1 ? 'Very easy start' :
              i === returnWeeks ? 'Back to normal' :
              `Building (${percentage}%)`,
      });
    }
  }

  // Special considerations by reason
  const specialConsiderations = [];
  if (reason === 'illness') {
    specialConsiderations.push('Wait until fever-free for 24 hours before running');
    specialConsiderations.push('Listen to your body - illness can linger');
    specialConsiderations.push('If symptoms return, stop and rest more');
  } else if (reason === 'injury') {
    specialConsiderations.push('Ensure pain-free before starting');
    specialConsiderations.push('Some discomfort is okay, pain is not');
    specialConsiderations.push('If injury symptoms return, stop immediately');
  }

  return {
    days_away: daysAway,
    reason,
    return_plan: returnPlan,
    weekly_progression: weeklyProgression,
    special_considerations: specialConsiderations.length > 0 ? specialConsiderations : null,
    mindset: [
      'Fitness comes back faster than it was built',
      'Consistency beats intensity in the return phase',
      'The goal is to avoid a setback, not to catch up',
    ],
  };
}

async function setCoachMode(input: Record<string, unknown>) {
  const mode = input.mode as 'advisor' | 'autopilot';

  // This would update a coach settings record
  // For now, return confirmation
  return {
    success: true,
    mode,
    description: mode === 'advisor'
      ? 'Coach will suggest changes for your approval before making them.'
      : 'Coach will automatically apply minor changes (schedule swaps, easy conversions) and flag major changes for approval.',
    auto_apply_in_autopilot: [
      'Converting quality to easy based on fatigue',
      'Swapping workout days within the same week',
      'Adjusting pace targets for weather',
      'Reducing distance by up to 20%',
    ],
    always_require_approval: [
      'Skipping key workouts',
      'Major plan restructuring',
      'Changes affecting race week',
      'Adding unscheduled hard workouts',
    ],
  };
}

export {
  generateTrainingPlan,
  getStandardPlansHandler,
  rewriteWorkoutForTime,
  explainWorkout,
  explainRecommendation,
  convertToTreadmill,
  generateRaceChecklist,
  activateBusyWeek,
  setTravelMode,
  generateReturnPlan,
  setCoachMode,
};
