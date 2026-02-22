// analysis-tools - Coach tool implementations
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


async function getFitnessTrend(input: Record<string, unknown>) {
  const weeksBack = (input.weeks_back as number) || 8;
  const workoutType = input.workout_type as string | undefined;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (weeksBack * 7));
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // Get workouts with both pace and RPE data
  const fitnessTrendProfileId = await getActiveProfileId();
  const allWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: fitnessTrendProfileId
      ? and(eq(workouts.profileId, fitnessTrendProfileId), gte(workouts.date, cutoffStr))
      : gte(workouts.date, cutoffStr),
    with: { assessment: true },
    orderBy: [asc(workouts.date)],
  });

  // Filter to workouts with pace and RPE
  let relevantWorkouts = allWorkouts.filter((w: WorkoutWithRelations) =>
    w.avgPaceSeconds &&
    w.assessment?.rpe &&
    w.distanceMiles && w.distanceMiles >= 2 // At least 2 miles for meaningful data
  );

  if (workoutType) {
    relevantWorkouts = relevantWorkouts.filter((w: WorkoutWithRelations) => w.workoutType === workoutType);
  } else {
    // Default to easy runs for most consistent comparison
    relevantWorkouts = relevantWorkouts.filter((w: WorkoutWithRelations) =>
      w.workoutType === 'easy' || w.workoutType === 'recovery' || w.workoutType === 'long'
    );
  }

  if (relevantWorkouts.length < 4) {
    return {
      has_sufficient_data: false,
      message: `Not enough workouts with pace and RPE data (found ${relevantWorkouts.length}, need at least 4).`,
      tip: 'Log RPE with your runs to enable fitness trend analysis.',
    };
  }

  // Calculate efficiency score for each workout: seconds/mile per RPE point
  // Lower is better (faster pace at same effort)
  const dataPoints = relevantWorkouts.map((w: WorkoutWithRelations) => ({
    date: w.date,
    pace_seconds: w.avgPaceSeconds!,
    rpe: w.assessment!.rpe,
    efficiency: w.avgPaceSeconds! / w.assessment!.rpe, // seconds per RPE point
    type: w.workoutType,
  }));

  // Split into early period and recent period
  const midpoint = Math.floor(dataPoints.length / 2);
  const earlyPeriod = dataPoints.slice(0, midpoint);
  const recentPeriod = dataPoints.slice(midpoint);

  const avgEarlyEfficiency = earlyPeriod.reduce((sum, d) => sum + d.efficiency, 0) / earlyPeriod.length;
  const avgRecentEfficiency = recentPeriod.reduce((sum, d) => sum + d.efficiency, 0) / recentPeriod.length;

  // Calculate percentage change (negative is improvement)
  const efficiencyChange = ((avgRecentEfficiency - avgEarlyEfficiency) / avgEarlyEfficiency) * 100;

  // Also look at pace at similar RPE
  const targetRpe = 5; // Use RPE 5 as baseline for easy running
  const earlyAtTargetRpe = earlyPeriod.filter(d => d.rpe >= targetRpe - 1 && d.rpe <= targetRpe + 1);
  const recentAtTargetRpe = recentPeriod.filter(d => d.rpe >= targetRpe - 1 && d.rpe <= targetRpe + 1);

  let paceComparison = null;
  if (earlyAtTargetRpe.length >= 2 && recentAtTargetRpe.length >= 2) {
    const avgEarlyPace = earlyAtTargetRpe.reduce((sum, d) => sum + d.pace_seconds, 0) / earlyAtTargetRpe.length;
    const avgRecentPace = recentAtTargetRpe.reduce((sum, d) => sum + d.pace_seconds, 0) / recentAtTargetRpe.length;
    paceComparison = {
      early_avg_pace: formatPaceFromTraining(Math.round(avgEarlyPace)),
      recent_avg_pace: formatPaceFromTraining(Math.round(avgRecentPace)),
      change_seconds: Math.round(avgRecentPace - avgEarlyPace),
      at_rpe: `${targetRpe - 1}-${targetRpe + 1}`,
    };
  }

  // Determine trend
  let trend: string;
  let interpretation: string;

  if (efficiencyChange < -5) {
    trend = 'Improving';
    interpretation = 'You\'re getting faster at the same effort level—fitness is building.';
  } else if (efficiencyChange > 5) {
    trend = 'Declining';
    interpretation = 'Running feels harder for the same pace. Could be fatigue accumulation, or external factors (heat, stress, sleep).';
  } else {
    trend = 'Stable';
    interpretation = 'Fitness is holding steady. Consistent training is working.';
  }

  return {
    has_sufficient_data: true,
    workouts_analyzed: relevantWorkouts.length,
    period: `${weeksBack} weeks`,
    workout_type_filter: workoutType || 'easy/recovery/long runs',

    efficiency_trend: {
      early_period_efficiency: Math.round(avgEarlyEfficiency * 10) / 10,
      recent_period_efficiency: Math.round(avgRecentEfficiency * 10) / 10,
      change_percent: Math.round(efficiencyChange * 10) / 10,
      note: 'Efficiency = pace (sec/mi) per RPE point. Lower is better.',
    },

    pace_at_similar_effort: paceComparison,

    trend,
    interpretation,

    recent_data_points: dataPoints.slice(-5).map(d => ({
      date: d.date,
      pace: formatPaceFromTraining(d.pace_seconds),
      rpe: d.rpe,
    })),
  };
}

async function analyzeRecoveryPattern(input: Record<string, unknown>) {
  const weeksBack = (input.weeks_back as number) || 6;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (weeksBack * 7));
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const recoveryProfileId = await getActiveProfileId();
  const allWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: recoveryProfileId
      ? and(eq(workouts.profileId, recoveryProfileId), gte(workouts.date, cutoffStr))
      : gte(workouts.date, cutoffStr),
    with: { assessment: true },
    orderBy: [asc(workouts.date)],
  });

  if (allWorkouts.length < 6) {
    return {
      has_sufficient_data: false,
      message: 'Need more workout data to analyze recovery patterns.',
    };
  }

  // Identify hard efforts (tempo, interval, long, or high RPE)
  const hardEfforts = allWorkouts.filter((w: WorkoutWithRelations) =>
    w.workoutType === 'tempo' ||
    w.workoutType === 'interval' ||
    w.workoutType === 'steady' ||
    w.workoutType === 'long' ||
    (w.assessment?.rpe && w.assessment.rpe >= 7)
  );

  // Look at the workout AFTER each hard effort
  const recoveryAnalysis: Array<{
    hard_workout: string;
    hard_date: string;
    next_workout: string;
    next_date: string;
    days_between: number;
    next_rpe: number | null;
    next_legs_feel: number | null;
    next_verdict: string | null;
    recovery_quality: string;
  }> = [];

  for (const hardWorkout of hardEfforts) {
    const hardDate = new Date(hardWorkout.date + 'T12:00:00');

    // Find the next workout
    const nextWorkout = allWorkouts.find((w: WorkoutWithRelations) => {
      const wDate = new Date(w.date + 'T12:00:00');
      return wDate > hardDate;
    });

    if (nextWorkout && nextWorkout.assessment) {
      const nextDate = new Date(nextWorkout.date + 'T12:00:00');
      const daysBetween = Math.round((nextDate.getTime() - hardDate.getTime()) / (1000 * 60 * 60 * 24));

      // Assess recovery quality
      let recoveryQuality = 'Unknown';
      const nextRpe = nextWorkout.assessment.rpe;
      const nextLegsFeel = nextWorkout.assessment.legsFeel;
      const nextVerdict = nextWorkout.assessment.verdict;

      if (nextWorkout.workoutType === 'easy' || nextWorkout.workoutType === 'recovery') {
        // For easy runs, high RPE or bad legs = poor recovery
        if (nextRpe && nextRpe >= 6) {
          recoveryQuality = 'Sluggish';
        } else if (nextLegsFeel !== null && nextLegsFeel >= 7) {
          recoveryQuality = 'Heavy legs';
        } else if (nextVerdict === 'rough' || nextVerdict === 'awful') {
          recoveryQuality = 'Struggled';
        } else if (nextVerdict === 'great' || nextVerdict === 'good') {
          recoveryQuality = 'Good';
        } else {
          recoveryQuality = 'Adequate';
        }
      } else {
        // For quality sessions, check if they could perform
        if (nextVerdict === 'great' || nextVerdict === 'good') {
          recoveryQuality = 'Performed well';
        } else if (nextVerdict === 'rough' || nextVerdict === 'awful') {
          recoveryQuality = 'Underperformed';
        } else {
          recoveryQuality = 'Adequate';
        }
      }

      recoveryAnalysis.push({
        hard_workout: `${hardWorkout.workoutType} (${hardWorkout.distanceMiles}mi)`,
        hard_date: hardWorkout.date,
        next_workout: `${nextWorkout.workoutType} (${nextWorkout.distanceMiles}mi)`,
        next_date: nextWorkout.date,
        days_between: daysBetween,
        next_rpe: nextRpe || null,
        next_legs_feel: nextLegsFeel || null,
        next_verdict: nextVerdict || null,
        recovery_quality: recoveryQuality,
      });
    }
  }

  // Summarize patterns
  const goodRecoveries = recoveryAnalysis.filter(r =>
    r.recovery_quality === 'Good' || r.recovery_quality === 'Adequate' || r.recovery_quality === 'Performed well'
  ).length;
  const poorRecoveries = recoveryAnalysis.filter(r =>
    r.recovery_quality === 'Sluggish' || r.recovery_quality === 'Heavy legs' ||
    r.recovery_quality === 'Struggled' || r.recovery_quality === 'Underperformed'
  ).length;

  const avgDaysBetween = recoveryAnalysis.length > 0
    ? Math.round(recoveryAnalysis.reduce((sum, r) => sum + r.days_between, 0) / recoveryAnalysis.length * 10) / 10
    : 0;

  // Insights
  const insights: string[] = [];

  if (poorRecoveries > goodRecoveries) {
    insights.push('Recovery is a pattern issue. Consider more rest between hard efforts or easier easy days.');
  }

  if (avgDaysBetween < 1.5 && poorRecoveries > 2) {
    insights.push('Hard efforts are close together. May need more recovery time between quality sessions.');
  }

  const backToBackHard = recoveryAnalysis.filter(r =>
    r.days_between <= 1 &&
    (r.next_workout.includes('tempo') || r.next_workout.includes('interval') || r.next_workout.includes('long'))
  );
  if (backToBackHard.length > 0) {
    insights.push(`${backToBackHard.length} instances of back-to-back hard efforts. This can work (Hansons style) but requires good overall recovery.`);
  }

  return {
    has_sufficient_data: true,
    hard_efforts_analyzed: hardEfforts.length,
    recovery_instances: recoveryAnalysis.length,

    summary: {
      good_recoveries: goodRecoveries,
      poor_recoveries: poorRecoveries,
      avg_days_between_hard_efforts: avgDaysBetween,
    },

    insights,

    recent_recovery_data: recoveryAnalysis.slice(-5),
  };
}

async function compareWorkouts(input: Record<string, unknown>) {
  const workoutId1 = input.workout_id_1 as number;
  const workoutId2 = input.workout_id_2 as number;

  const workout1 = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId1),
    with: { assessment: true, shoe: true },
  });

  const workout2 = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId2),
    with: { assessment: true, shoe: true },
  });

  if (!workout1 || !workout2) {
    return { success: false, error: `Workout not found: ${!workout1 ? workoutId1 : workoutId2}` };
  }

  const formatWorkout = (w: WorkoutWithRelations) => ({
    id: w.id,
    date: w.date,
    type: w.workoutType,
    distance_miles: w.distanceMiles,
    duration_minutes: w.durationMinutes,
    pace: w.avgPaceSeconds ? formatPaceFromTraining(w.avgPaceSeconds) : null,
    rpe: w.assessment?.rpe || null,
    verdict: w.assessment?.verdict || null,
    legs_feel: w.assessment?.legsFeel || null,
    notes: w.notes || null,
  });

  const w1 = formatWorkout(workout1);
  const w2 = formatWorkout(workout2);

  // Calculate differences
  const comparison: Record<string, string> = {};

  if (w1.distance_miles && w2.distance_miles) {
    const diff = w2.distance_miles - w1.distance_miles;
    comparison.distance = diff > 0 ? `+${diff.toFixed(1)} mi` : `${diff.toFixed(1)} mi`;
  }

  if (workout1.avgPaceSeconds && workout2.avgPaceSeconds) {
    const diff = workout2.avgPaceSeconds - workout1.avgPaceSeconds;
    const sign = diff > 0 ? '+' : '';
    comparison.pace = `${sign}${Math.round(diff)} sec/mi (${diff < 0 ? 'faster' : 'slower'})`;
  }

  if (w1.rpe && w2.rpe) {
    const diff = w2.rpe - w1.rpe;
    comparison.rpe = diff === 0 ? 'Same' : (diff > 0 ? `+${diff} (harder)` : `${diff} (easier)`);
  }

  // Efficiency comparison (if we have pace and RPE for both)
  let efficiencyNote = null;
  if (workout1.avgPaceSeconds && workout2.avgPaceSeconds && w1.rpe && w2.rpe) {
    const eff1 = workout1.avgPaceSeconds / w1.rpe;
    const eff2 = workout2.avgPaceSeconds / w2.rpe;
    const effDiff = ((eff2 - eff1) / eff1) * 100;

    if (Math.abs(effDiff) > 3) {
      efficiencyNote = effDiff < 0
        ? `Workout 2 was more efficient (${Math.abs(Math.round(effDiff))}% better pace per RPE point)`
        : `Workout 1 was more efficient (workout 2 was ${Math.round(effDiff)}% less efficient)`;
    } else {
      efficiencyNote = 'Similar efficiency (pace relative to effort)';
    }
  }

  return {
    workout_1: w1,
    workout_2: w2,
    comparison,
    efficiency_note: efficiencyNote,
    days_apart: Math.round(
      (new Date(w2.date + 'T12:00:00').getTime() - new Date(w1.date + 'T12:00:00').getTime())
      / (1000 * 60 * 60 * 24)
    ),
  };
}

async function getFatigueIndicators(input: Record<string, unknown>) {
  const daysBack = (input.days_back as number) || 14;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const fatigueProfileId = await getActiveProfileId();
  const recentWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: fatigueProfileId
      ? and(eq(workouts.profileId, fatigueProfileId), gte(workouts.date, cutoffStr))
      : gte(workouts.date, cutoffStr),
    with: { assessment: true },
    orderBy: [desc(workouts.date)],
  });

  const assessedWorkouts = recentWorkouts.filter((w: WorkoutWithRelations) => w.assessment);

  if (assessedWorkouts.length < 3) {
    return {
      has_sufficient_data: false,
      message: 'Need at least 3 assessed workouts for fatigue analysis.',
    };
  }

  // Collect metrics
  const rpeValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.rpe).filter(Boolean) as number[];
  const legsFeelValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.legsFeel).filter((v): v is number => v !== null && v !== undefined);
  const sleepValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.sleepQuality).filter((v): v is number => v !== null && v !== undefined);
  const stressValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.stress).filter((v): v is number => v !== null && v !== undefined);
  const sorenessValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.soreness).filter((v): v is number => v !== null && v !== undefined);
  const verdicts = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.verdict).filter(Boolean) as string[];

  // Calculate averages and trends
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  // Look at trend (first half vs second half)
  const trend = (arr: number[]) => {
    if (arr.length < 4) return 'insufficient data';
    const mid = Math.floor(arr.length / 2);
    const first = avg(arr.slice(0, mid));
    const second = avg(arr.slice(mid));
    if (first === null || second === null) return 'insufficient data';
    const diff = second - first;
    if (Math.abs(diff) < 0.5) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  };

  // Fatigue signals
  const signals: Array<{ indicator: string; status: string; details: string }> = [];

  // RPE trend
  if (rpeValues.length >= 3) {
    const avgRpe = avg(rpeValues)!;
    const rpeTrend = trend(rpeValues);
    if (avgRpe > 7) {
      signals.push({ indicator: 'RPE', status: 'Warning', details: `High average RPE (${avgRpe.toFixed(1)}). Workouts feeling hard.` });
    } else if (rpeTrend === 'increasing') {
      signals.push({ indicator: 'RPE', status: 'Watch', details: 'RPE trending upward. Same effort feeling harder.' });
    } else {
      signals.push({ indicator: 'RPE', status: 'OK', details: `Average RPE: ${avgRpe.toFixed(1)}` });
    }
  }

  // Legs feel trend
  if (legsFeelValues.length >= 3) {
    const avgLegs = avg(legsFeelValues)!;
    const legsTrend = trend(legsFeelValues);
    if (avgLegs > 6) {
      signals.push({ indicator: 'Legs', status: 'Warning', details: `Heavy legs pattern (avg ${avgLegs.toFixed(1)}/10). May need extra recovery.` });
    } else if (legsTrend === 'increasing') {
      signals.push({ indicator: 'Legs', status: 'Watch', details: 'Legs feeling progressively heavier.' });
    } else {
      signals.push({ indicator: 'Legs', status: 'OK', details: `Average legs feel: ${avgLegs.toFixed(1)}/10` });
    }
  }

  // Sleep
  if (sleepValues.length >= 3) {
    const avgSleep = avg(sleepValues)!;
    if (avgSleep < 5) {
      signals.push({ indicator: 'Sleep', status: 'Warning', details: `Poor sleep quality (avg ${avgSleep.toFixed(1)}/10). Recovery compromised.` });
    } else if (avgSleep >= 7) {
      signals.push({ indicator: 'Sleep', status: 'Good', details: `Good sleep quality (avg ${avgSleep.toFixed(1)}/10)` });
    } else {
      signals.push({ indicator: 'Sleep', status: 'OK', details: `Average sleep quality: ${avgSleep.toFixed(1)}/10` });
    }
  }

  // Stress
  if (stressValues.length >= 3) {
    const avgStress = avg(stressValues)!;
    if (avgStress > 7) {
      signals.push({ indicator: 'Stress', status: 'Warning', details: `High stress (avg ${avgStress.toFixed(1)}/10). Consider easier training.` });
    }
  }

  // Soreness
  if (sorenessValues.length >= 3) {
    const avgSoreness = avg(sorenessValues)!;
    if (avgSoreness > 6) {
      signals.push({ indicator: 'Soreness', status: 'Warning', details: `High soreness (avg ${avgSoreness.toFixed(1)}/10). Muscles need recovery.` });
    }
  }

  // Verdict pattern
  if (verdicts.length >= 3) {
    const roughCount = verdicts.filter(v => v === 'rough' || v === 'awful').length;
    const greatCount = verdicts.filter(v => v === 'great' || v === 'good').length;

    if (roughCount >= verdicts.length / 2) {
      signals.push({ indicator: 'Verdicts', status: 'Warning', details: `${roughCount}/${verdicts.length} workouts rated rough/awful. Training not going well.` });
    } else if (greatCount >= verdicts.length * 0.6) {
      signals.push({ indicator: 'Verdicts', status: 'Good', details: `${greatCount}/${verdicts.length} workouts rated good/great.` });
    }
  }

  // Overall assessment
  const warningCount = signals.filter(s => s.status === 'Warning').length;
  const watchCount = signals.filter(s => s.status === 'Watch').length;

  let overallStatus: string;
  let recommendation: string;

  if (warningCount >= 3) {
    overallStatus = 'Fatigue Accumulation';
    recommendation = 'Multiple warning signs. Strongly recommend a down week or extra rest days.';
  } else if (warningCount >= 2 || (warningCount >= 1 && watchCount >= 2)) {
    overallStatus = 'Elevated Fatigue';
    recommendation = 'Signs of fatigue building. Consider reducing intensity or adding recovery.';
  } else if (watchCount >= 2) {
    overallStatus = 'Monitor';
    recommendation = 'Some early warning signs. Keep tracking and be ready to back off.';
  } else {
    overallStatus = 'Well Recovered';
    recommendation = 'Fatigue indicators look good. Continue as planned.';
  }

  return {
    period: `Last ${daysBack} days`,
    workouts_assessed: assessedWorkouts.length,

    signals,

    overall_status: overallStatus,
    recommendation,

    raw_averages: {
      rpe: avg(rpeValues)?.toFixed(1) || null,
      legs_feel: avg(legsFeelValues)?.toFixed(1) || null,
      sleep_quality: avg(sleepValues)?.toFixed(1) || null,
      stress: avg(stressValues)?.toFixed(1) || null,
      soreness: avg(sorenessValues)?.toFixed(1) || null,
    },
  };
}

async function estimateWorkoutQuality(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { assessment: true },
  });

  if (!workout) {
    return { success: false, error: 'Workout not found' };
  }

  // Get user's pace zones for context
  const s = await getSettingsForProfile();
  const vdot = s?.vdot || 40;
  const paceZones = calculatePaceZones(vdot);

  const result: {
    workout_id: number;
    date: string;
    type: string;
    distance: number | null;
    pace: string | null;
    rpe: number | null;
    verdict: string | null;
    quality_assessment: string;
    details: string[];
    suggestions: string[];
  } = {
    workout_id: workout.id,
    date: workout.date,
    type: workout.workoutType,
    distance: workout.distanceMiles,
    pace: workout.avgPaceSeconds ? formatPaceFromTraining(workout.avgPaceSeconds) : null,
    rpe: workout.assessment?.rpe || null,
    verdict: workout.assessment?.verdict || null,
    quality_assessment: 'Unknown',
    details: [],
    suggestions: [],
  };

  if (!workout.assessment) {
    result.quality_assessment = 'No Assessment';
    result.suggestions.push('Add an assessment to get workout quality analysis.');
    return result;
  }

  const rpe = workout.assessment.rpe;
  const verdict = workout.assessment.verdict;
  const pace = workout.avgPaceSeconds;

  // Analyze based on workout type
  if (workout.workoutType === 'easy' || workout.workoutType === 'recovery') {
    // Easy runs should feel easy (RPE 3-5)
    if (rpe && rpe <= 5) {
      result.details.push('Effort level appropriate for easy run.');
      result.quality_assessment = 'Good';
    } else if (rpe && rpe <= 6) {
      result.details.push('Slightly harder than ideal for easy run.');
      result.quality_assessment = 'Acceptable';
      result.suggestions.push('Easy runs should feel conversational (RPE 3-5). Slow down if needed.');
    } else if (rpe && rpe > 6) {
      result.details.push('Too hard for an easy day.');
      result.quality_assessment = 'Too Intense';
      result.suggestions.push('This wasn\'t really easy. Easy days should be RPE 3-5. Going too hard prevents recovery.');
    }

    // Check pace vs easy pace zone (easy pace +/- 30 seconds per mile is typical range)
    if (pace && paceZones.easy) {
      const easyPace = paceZones.easy;
      const easyMin = easyPace - 30; // Faster end of easy range
      const easyMax = easyPace + 30; // Slower end of easy range
      if (pace < easyMin - 15) {
        result.details.push(`Pace was faster than easy zone (ran ${formatPaceFromTraining(pace)}, easy zone is ${formatPaceFromTraining(easyMin)}-${formatPaceFromTraining(easyMax)}).`);
        result.suggestions.push('Easy runs don\'t need to be fast. Slow down to build aerobic base efficiently.');
      }
    }
  } else if (workout.workoutType === 'tempo' || workout.workoutType === 'threshold') {
    // Tempo should be comfortably hard (RPE 6-8)
    if (rpe && rpe >= 6 && rpe <= 8) {
      result.details.push('Effort level appropriate for tempo work.');
      result.quality_assessment = verdict === 'great' || verdict === 'good' ? 'Excellent' : 'Good';
    } else if (rpe && rpe < 6) {
      result.details.push('Effort was lower than typical tempo (RPE 6-8).');
      result.quality_assessment = 'Undertrained';
      result.suggestions.push('Tempo should feel "comfortably hard." If it felt easy, the pace may have been too slow or you\'re getting fitter.');
    } else if (rpe && rpe > 8) {
      result.details.push('Effort was higher than ideal tempo (RPE 6-8).');
      result.quality_assessment = 'Overreached';
      result.suggestions.push('Tempo shouldn\'t feel maximal. If it was RPE 9+, the pace was too aggressive or you were fatigued.');
    }
  } else if (workout.workoutType === 'interval') {
    // Intervals should be hard (RPE 7-9)
    if (rpe && rpe >= 7 && rpe <= 9) {
      result.details.push('Effort level appropriate for intervals.');
      result.quality_assessment = verdict === 'great' || verdict === 'good' ? 'Excellent' : 'Good';
    } else if (rpe && rpe < 7) {
      result.details.push('Effort was lower than typical interval work (RPE 7-9).');
      result.quality_assessment = 'Could Push Harder';
      result.suggestions.push('Intervals should be hard but controlled. If it felt moderate, consider increasing pace or reducing rest.');
    } else if (rpe && rpe >= 10) {
      result.details.push('All-out effort. Intervals should be hard but not maximal.');
      result.quality_assessment = 'Overreached';
      result.suggestions.push('RPE 10 suggests the pace was too aggressive. Intervals should leave something in the tank.');
    }
  } else if (workout.workoutType === 'long') {
    // Long runs should be moderate (RPE 4-6, maybe 7 at the end)
    if (rpe && rpe <= 6) {
      result.details.push('Effort level appropriate for long run.');
      result.quality_assessment = verdict === 'great' || verdict === 'good' ? 'Excellent' : 'Good';
    } else if (rpe && rpe === 7) {
      result.details.push('Effort was moderate-hard for long run.');
      result.quality_assessment = 'Acceptable';
      result.suggestions.push('Long runs should mostly feel conversational. RPE 7 is OK for the last few miles but not the whole run.');
    } else if (rpe && rpe > 7) {
      result.details.push('Long run was too hard.');
      result.quality_assessment = 'Too Intense';
      result.suggestions.push('Long runs build endurance through time on feet, not intensity. Slow down to preserve the aerobic benefit.');
    }
  }

  // Add verdict context
  if (verdict) {
    if (verdict === 'great') {
      result.details.push('You rated this workout "great" - everything clicked.');
    } else if (verdict === 'rough' || verdict === 'awful') {
      result.details.push(`You rated this "${verdict}" - worth investigating why.`);
      if (!result.suggestions.some(s => s.includes('Check'))) {
        result.suggestions.push('Check recent sleep, stress, and recovery. Bad workouts often have external causes.');
      }
    }
  }

  return result;
}

export {
  getFitnessTrend,
  analyzeRecoveryPattern,
  compareWorkouts,
  getFatigueIndicators,
  estimateWorkoutQuality,
};
