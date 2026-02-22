// philosophy-tools - Coach tool implementations
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

// Cross-module imports
import { getInjuryStatus } from './health-tools';
import { getFatigueIndicators } from './analysis-tools';

function getTrainingPhilosophy(input: Record<string, unknown>) {
  const topic = input.topic as string | undefined;

  const philosophies: Record<string, { title: string; explanation: string; keyPoints: string[] }> = {
    periodization: {
      title: 'Training Periodization',
      explanation: 'Periodization divides training into phases with specific goals. Each phase builds on the previous one, progressing from general aerobic fitness to race-specific sharpness.',
      keyPoints: [
        'Base Phase: Build aerobic capacity with easy running, gradually increasing volume',
        'Build Phase: Introduce quality workouts (tempo, threshold) while maintaining volume',
        'Peak/Specific Phase: Race-specific workouts, VO2max, goal-pace training',
        'Taper Phase: Reduce volume while maintaining intensity to arrive fresh at race',
        'Recovery Phase: Easy running and rest after goal races',
      ],
    },
    polarized_training: {
      title: '80/20 Polarized Training',
      explanation: 'Research by Stephen Seiler shows elite endurance athletes spend ~80% of training at low intensity and ~20% at high intensity, with minimal time in the "moderate" zone. This approach maximizes aerobic development while allowing recovery.',
      keyPoints: [
        '80% easy: Zone 1-2, conversational pace, builds aerobic base without excessive stress',
        '20% hard: Zone 4-5, tempo/threshold/intervals, provides stimulus for adaptation',
        'Avoid the "gray zone": Moderate effort feels productive but compromises both recovery and stimulus',
        'Easy days truly easy, hard days truly hard',
        'Supported by Norwegian Method (even more polarized) and extensive research',
      ],
    },
    workout_types: {
      title: 'Understanding Workout Types',
      explanation: 'Different workouts target different physiological systems. A well-designed plan includes variety to develop all aspects of fitness.',
      keyPoints: [
        'Easy Runs: Aerobic development, recovery, fat oxidation (60-70% of training)',
        'Long Runs: Endurance, mental toughness, glycogen management',
        'Tempo: Lactate threshold improvement, sustained effort practice',
        'Intervals: VO2max development, running economy, speed',
        'Strides/Hills: Neuromuscular activation, form, strength',
        'Recovery: Active recovery, maintains fitness without stress',
      ],
    },
    recovery: {
      title: 'Recovery and Adaptation',
      explanation: 'Training stress + recovery = adaptation. Without adequate recovery, fitness doesn\'t improve and injury risk increases. Recovery is where gains are actually made.',
      keyPoints: [
        'Sleep: 7-9 hours; most crucial recovery factor',
        '48-hour rule: Allow 48 hours between hard efforts',
        'Down weeks: Reduce volume 20-30% every 3-4 weeks',
        'Active recovery: Easy movement beats complete rest',
        'Listen to your body: Persistent fatigue, elevated HR, poor sleep are warning signs',
        'Nutrition timing: Carbs and protein within 30 min post-workout aids recovery',
      ],
    },
    tapering: {
      title: 'Race Tapering',
      explanation: 'Tapering reduces training volume while maintaining intensity to allow the body to fully recover and peak on race day. Done correctly, it can improve performance 2-3%.',
      keyPoints: [
        'Duration: 2-3 weeks for marathon, 1-2 weeks for shorter races',
        'Volume reduction: Cut volume 40-60%, not intensity',
        'Maintain sharpness: Keep some race-pace work, shorter duration',
        'Trust the process: Feeling antsy and restless is normal',
        'Sleep more: Bank rest in final week',
        'Don\'t try anything new: Race week is not for experiments',
      ],
    },
    base_building: {
      title: 'Aerobic Base Building',
      explanation: 'The aerobic base is the foundation of all endurance performance. Building it requires patience—mostly easy running with gradual volume increases.',
      keyPoints: [
        '10% rule: Increase weekly volume no more than 10% per week',
        'Consistency > intensity: Regular easy running beats sporadic hard efforts',
        'Time on feet: Duration matters as much as pace',
        'Patience: Aerobic adaptations take 6-12 weeks to manifest',
        'Heart rate training: Keep easy runs truly easy (Zone 2)',
        'Maffetone method: 180 minus age as HR ceiling for base building',
      ],
    },
    speed_development: {
      title: 'Speed Development',
      explanation: 'Speed work improves VO2max, running economy, and neuromuscular coordination. It should be added after establishing an aerobic base.',
      keyPoints: [
        'Prerequisites: 4-6 weeks of consistent base running first',
        'Start conservative: Shorter intervals, fewer reps, longer recovery',
        'Progressive overload: Gradually increase volume or decrease rest',
        'Track work: Provides precise distance and surface',
        'Fartlek: Unstructured speed play, good introduction to faster running',
        'Recovery: Quality over quantity; skip if overly fatigued',
      ],
    },
    long_runs: {
      title: 'Long Run Philosophy',
      explanation: 'The long run is the cornerstone of distance training. It builds endurance, mental toughness, and teaches the body to use fat for fuel.',
      keyPoints: [
        'Easy pace: Most long runs should be conversational, 1-2 min slower than race pace',
        'Progressive: Finish faster than you start, negative splits',
        'Race-pace segments: Include goal-pace miles in later phases',
        'Fueling practice: Long runs are the time to test race nutrition',
        'Peak distance: 20-22 miles for marathon, 12-15 for half marathon',
        'Recovery: May need 2-3 days of easy running after longest runs',
      ],
    },
    race_pacing: {
      title: 'Race Pacing Strategy',
      explanation: 'Even pacing (or slight negative splits) is the most efficient way to race. Starting too fast leads to disproportionate energy expenditure and late-race struggles.',
      keyPoints: [
        'Even splits: Aim for consistent mile times throughout',
        'Bank time myth: Going out fast doesn\'t "bank" time, it costs it',
        'First mile: Should feel easy, almost too slow',
        'Negative split: Slightly faster second half is ideal',
        'Know your limits: Pace should feel sustainable at halfway',
        'Weather adjustment: Slow pace 1-2%+ for heat, humidity, wind',
      ],
    },
  };

  if (topic && philosophies[topic]) {
    return philosophies[topic];
  }

  // Return overview of all topics
  return {
    available_topics: Object.entries(philosophies).map(([key, value]) => ({
      topic: key,
      title: value.title,
    })),
    note: 'Call again with a specific topic for detailed information.',
  };
}

async function suggestPlanAdjustment(input: Record<string, unknown>) {
  const reason = input.reason as string;
  const weeksAffected = (input.weeks_affected as number) || 1;
  const profileId = await getActiveProfileId();

  // Gather context
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [settings, recentWorkouts, injuries, fatigueData] = await Promise.all([
    db.query.userSettings.findFirst({
      where: profileId ? eq(userSettings.profileId, profileId) : undefined
    }),
    db.query.workouts.findMany({
      where: profileId ? eq(workouts.profileId, profileId) : undefined,
      orderBy: [desc(workouts.date)],
      limit: 14,
      with: { assessment: true },
    }),
    getInjuryStatus(),
    getFatigueIndicators({}),
  ]);

  // Get upcoming planned workouts
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 14);
  const upcomingPlanned = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, today),
      lte(plannedWorkouts.date, nextWeek.toISOString().split('T')[0])
    ),
    orderBy: [asc(plannedWorkouts.date)],
    limit: 14,
  });

  // Analyze the situation
  const completedWorkouts = recentWorkouts.filter((w: Workout) => w.date >= getDateDaysAgo(14));
  const recentRPEs = completedWorkouts
    .map((w: Workout & { assessment?: Assessment | null }) => w.assessment?.rpe)
    .filter((rpe: number | undefined | null): rpe is number => rpe !== undefined && rpe !== null);
  const avgRPE = recentRPEs.length > 0
    ? recentRPEs.reduce((a: number, b: number) => a + b, 0) / recentRPEs.length
    : null;

  const suggestions: string[] = [];
  const actions: string[] = [];

  // Analyze reason
  const reasonLower = reason.toLowerCase();

  if (reasonLower.includes('illness') || reasonLower.includes('sick') || reasonLower.includes('flu') || reasonLower.includes('cold')) {
    suggestions.push('After illness, return gradually. Start with easy running at reduced volume.');
    suggestions.push('Listen to your body - if you feel worse during a run, stop.');
    if (weeksAffected >= 2) {
      actions.push('Use convert_to_easy to make the first 3-4 days back all easy runs');
      actions.push('Use adjust_workout_distance to reduce distances by 30-40% in week 1 back');
      suggestions.push('Consider skipping quality workouts for the first week back.');
    } else {
      actions.push('Use convert_to_easy for the first 2-3 days back');
      suggestions.push('Resume quality work cautiously in the second week back.');
    }
  }

  if (reasonLower.includes('missed') || reasonLower.includes('break') || reasonLower.includes('vacation')) {
    suggestions.push(`After ${weeksAffected} week(s) off, rebuild gradually.`);
    if (weeksAffected >= 3) {
      suggestions.push('Significant time off requires 2-3 weeks of base rebuilding before quality work.');
      actions.push('Use make_down_week for the first week back');
      actions.push('Use skip_workout to skip the most intense quality sessions for 2 weeks');
    } else if (weeksAffected >= 1) {
      suggestions.push('A week or two off is okay - ease back but you\'ll regain fitness quickly.');
      actions.push('Use adjust_workout_distance to reduce distances by 20-30% in week 1');
    }
  }

  if (reasonLower.includes('overtrain') || reasonLower.includes('tired') || reasonLower.includes('fatigue') || reasonLower.includes('exhausted')) {
    suggestions.push('Signs of overtraining require immediate recovery focus.');
    suggestions.push('Cut volume and intensity significantly until you feel fresh again.');
    actions.push('Use make_down_week to reduce this week\'s load');
    actions.push('Use convert_to_easy to remove intensity from upcoming quality days');
    if (avgRPE && avgRPE > 7) {
      suggestions.push(`Your recent average RPE (${avgRPE.toFixed(1)}) is high - confirming need for recovery.`);
    }
  }

  if (reasonLower.includes('injury') || reasonLower.includes('pain') || reasonLower.includes('hurt')) {
    suggestions.push('Injury requires careful management. When in doubt, rest.');
    suggestions.push('See a medical professional if pain persists.');
    actions.push('Use log_injury to track the injury and get restricted workout guidance');
    actions.push('Use skip_workout or convert_to_easy for any workouts that aggravate it');
  }

  if (reasonLower.includes('race') && (reasonLower.includes('change') || reasonLower.includes('moved') || reasonLower.includes('different'))) {
    suggestions.push('Race date changes may require plan restructuring.');
    actions.push('Use update_race to update the race date');
    suggestions.push('If the race moved earlier, consider condensing the build phase.');
    suggestions.push('If the race moved later, you can extend base or add a mini-taper cycle.');
  }

  if (reasonLower.includes('busy') || reasonLower.includes('travel') || reasonLower.includes('work') || reasonLower.includes('stress')) {
    suggestions.push('High life stress impacts recovery - training should be adjusted.');
    suggestions.push('Prioritize sleep over training volume during busy periods.');
    actions.push('Use adjust_workout_distance to shorten workouts if time-crunched');
    actions.push('Use set_travel_status if traveling to track context');
    suggestions.push('Keep some running to maintain fitness but reduce expectations.');
  }

  // Add general guidance if no specific pattern matched
  if (suggestions.length === 0) {
    suggestions.push('When adjusting the plan, preserve key workouts if possible.');
    suggestions.push('Long runs and one quality session per week maintain fitness.');
    actions.push('Use get_week_workouts to see current week and identify what can flex');
    actions.push('Use swap_workouts if days need to be rearranged');
  }

  // Add injury context if relevant
  const injuryStatus = injuries as { has_active_injury?: boolean; active_injuries?: unknown[] };
  if (injuryStatus.has_active_injury) {
    suggestions.push('Note: You have active injuries logged - factor these into any plan changes.');
  }

  // Add fatigue context
  const fatigue = fatigueData as { fatigue_score?: number; recommendation?: string };
  if (fatigue.fatigue_score && fatigue.fatigue_score > 6) {
    suggestions.push(`Current fatigue level is elevated (${fatigue.fatigue_score}/10) - err on the side of more rest.`);
  }

  return {
    situation: reason,
    weeks_affected: weeksAffected,
    suggestions,
    recommended_tools: actions,
    context: {
      recent_avg_rpe: avgRPE?.toFixed(1) || 'unknown',
      upcoming_workouts_count: upcomingPlanned.length,
      active_injuries: injuryStatus.has_active_injury || false,
      fatigue_level: fatigue.fatigue_score || 'unknown',
    },
    general_principle: 'Consistency over time matters more than any single week. It\'s better to do less and stay healthy than push through and get injured.',
  };
}

export {
  getTrainingPhilosophy,
  suggestPlanAdjustment,
};
