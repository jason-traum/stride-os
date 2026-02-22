// fitness-tools - Coach tool implementations
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


async function getReadinessScore() {
  // Get recent workouts with assessments
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const readinessProfileId = await getActiveProfileId();
  const recentWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: readinessProfileId
      ? and(eq(workouts.profileId, readinessProfileId), gte(workouts.date, cutoffStr))
      : gte(workouts.date, cutoffStr),
    with: {
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
  });

  // Calculate components
  let score = 100;
  const factors: Array<{ factor: string; impact: number; note: string }> = [];

  // 1. Training Load (recent mileage compared to typical)
  const last7DaysMiles = recentWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.distanceMiles || 0), 0);
  const s = await getSettingsForProfile();
  const weeklyTarget = s?.currentWeeklyMileage || 25;

  if (last7DaysMiles > weeklyTarget * 1.3) {
    const impact = -15;
    score += impact;
    factors.push({ factor: 'High training load', impact, note: `${Math.round(last7DaysMiles)} miles this week (${Math.round((last7DaysMiles / weeklyTarget) * 100)}% of typical)` });
  } else if (last7DaysMiles < weeklyTarget * 0.5) {
    const impact = 10;
    score += impact;
    factors.push({ factor: 'Light training load', impact, note: 'Well rested from reduced volume' });
  }

  // 2. Recent RPE trend
  const assessedWorkouts = recentWorkouts.filter((w: WorkoutWithRelations) => w.assessment?.rpe);
  if (assessedWorkouts.length >= 2) {
    const avgRpe = assessedWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.assessment?.rpe || 0), 0) / assessedWorkouts.length;
    if (avgRpe > 7.5) {
      const impact = -10;
      score += impact;
      factors.push({ factor: 'High perceived effort', impact, note: `Average RPE of ${avgRpe.toFixed(1)} recently` });
    } else if (avgRpe < 5) {
      const impact = 5;
      score += impact;
      factors.push({ factor: 'Low perceived effort', impact, note: 'Workouts feeling manageable' });
    }
  }

  // 3. Sleep quality
  const sleepWorkouts = recentWorkouts.filter((w: WorkoutWithRelations) => w.assessment?.sleepQuality);
  if (sleepWorkouts.length >= 2) {
    const avgSleep = sleepWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.assessment?.sleepQuality || 0), 0) / sleepWorkouts.length;
    if (avgSleep < 5) {
      const impact = -15;
      score += impact;
      factors.push({ factor: 'Poor sleep quality', impact, note: `Average sleep quality ${avgSleep.toFixed(1)}/10` });
    } else if (avgSleep >= 8) {
      const impact = 10;
      score += impact;
      factors.push({ factor: 'Good sleep quality', impact, note: 'Well rested' });
    }
  }

  // 4. Soreness
  const sorenessWorkouts = recentWorkouts.filter(w => w.assessment?.soreness);
  if (sorenessWorkouts.length > 0) {
    const latestSoreness = sorenessWorkouts[0].assessment?.soreness || 0;
    if (latestSoreness > 7) {
      const impact = -20;
      score += impact;
      factors.push({ factor: 'High soreness', impact, note: `Soreness level ${latestSoreness}/10` });
    } else if (latestSoreness <= 3) {
      const impact = 5;
      score += impact;
      factors.push({ factor: 'Low soreness', impact, note: 'Muscles feeling fresh' });
    }
  }

  // 5. Stress
  const stressWorkouts = recentWorkouts.filter(w => w.assessment?.stress);
  if (stressWorkouts.length > 0) {
    const latestStress = stressWorkouts[0].assessment?.stress || 0;
    if (latestStress > 7) {
      const impact = -10;
      score += impact;
      factors.push({ factor: 'High stress', impact, note: `Stress level ${latestStress}/10` });
    }
  }

  // 6. Verdict trend (rough/awful workouts)
  const roughWorkouts = recentWorkouts.filter(w =>
    w.assessment?.verdict === 'rough' || w.assessment?.verdict === 'awful'
  );
  if (roughWorkouts.length >= 2) {
    const impact = -15;
    score += impact;
    factors.push({ factor: 'Recent tough workouts', impact, note: `${roughWorkouts.length} rough/awful workouts in the past week` });
  }

  // 7. Days since last rest
  const workoutDates = recentWorkouts.map(w => w.date).sort().reverse();
  if (workoutDates.length >= 7) {
    // Ran every day for a week
    const impact = -10;
    score += impact;
    factors.push({ factor: 'No recent rest days', impact, note: 'Consider a rest day' });
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Generate recommendation
  let recommendation: string;
  let suggestedWorkout: string;

  if (score >= 80) {
    recommendation = 'You are well-rested and ready for a hard effort.';
    suggestedWorkout = 'Good day for a key workout or tempo run.';
  } else if (score >= 60) {
    recommendation = 'Moderate readiness. A normal training day should be fine.';
    suggestedWorkout = 'Stick to the plan, but listen to your body.';
  } else if (score >= 40) {
    recommendation = 'Readiness is lower than ideal. Consider scaling back.';
    suggestedWorkout = 'Easy run or consider a rest day.';
  } else {
    recommendation = 'Low readiness. Recovery should be the priority.';
    suggestedWorkout = 'Rest day or very light recovery jog.';
  }

  // Fetch personalized recovery model for deeper recovery insight
  let recoveryModel: {
    recovery_score: number;
    estimated_hours_until_ready: number;
    ready_for_quality: boolean;
    personal_recovery_rate: string;
    model_confidence: number;
    recommendations: string[];
  } | null = null;
  try {
    const recoveryResult = await getRecoveryAnalysis();
    if (recoveryResult.success) {
      const r = recoveryResult.data;
      recoveryModel = {
        recovery_score: r.recoveryScore,
        estimated_hours_until_ready: r.estimatedRecoveryHours,
        ready_for_quality: r.readyForQuality,
        personal_recovery_rate: r.personalRecoveryRate,
        model_confidence: Math.round(r.confidence * 100),
        recommendations: r.recommendations,
      };
      // Let the recovery model refine the readiness recommendation
      if (!r.readyForQuality && score >= 60) {
        recommendation += ` However, recovery model estimates ${Math.round(r.estimatedRecoveryHours)} more hours before your next quality session.`;
      }
    }
  } catch {
    // Recovery model unavailable, continue with base readiness score
  }

  return {
    score,
    label: score >= 80 ? 'Ready to Go' : score >= 60 ? 'Moderate' : score >= 40 ? 'Caution' : 'Rest Needed',
    factors,
    recommendation,
    suggested_workout: suggestedWorkout,
    recent_stats: {
      workouts_last_7_days: recentWorkouts.length,
      miles_last_7_days: Math.round(last7DaysMiles * 10) / 10,
    },
    recovery_model: recoveryModel,
  };
}

async function analyzeWorkoutPatterns(input: Record<string, unknown>) {
  const weeksBack = (input.weeks_back as number) || 8;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (weeksBack * 7));
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const patternsProfileId = await getActiveProfileId();
  const periodWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: patternsProfileId
      ? and(eq(workouts.profileId, patternsProfileId), gte(workouts.date, cutoffStr))
      : gte(workouts.date, cutoffStr),
    with: {
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
  });

  if (periodWorkouts.length < 5) {
    return {
      has_data: false,
      message: 'Not enough workout data for analysis. Need at least 5 workouts.',
    };
  }

  // Analyze by workout type
  const byType: Record<string, {
    count: number;
    totalMiles: number;
    avgPace: number;
    avgRpe: number;
    verdicts: Record<string, number>;
  }> = {};

  for (const w of periodWorkouts) {
    if (!byType[w.workoutType]) {
      byType[w.workoutType] = { count: 0, totalMiles: 0, avgPace: 0, avgRpe: 0, verdicts: {} };
    }
    byType[w.workoutType].count++;
    byType[w.workoutType].totalMiles += w.distanceMiles || 0;
    if (w.avgPaceSeconds) byType[w.workoutType].avgPace += w.avgPaceSeconds;
    if (w.assessment?.rpe) byType[w.workoutType].avgRpe += w.assessment.rpe;
    if (w.assessment?.verdict) {
      byType[w.workoutType].verdicts[w.assessment.verdict] =
        (byType[w.workoutType].verdicts[w.assessment.verdict] || 0) + 1;
    }
  }

  // Calculate averages
  const typeAnalysis = Object.entries(byType).map(([type, data]) => {
    const workoutsWithPace = periodWorkouts.filter((w: WorkoutWithRelations) => w.workoutType === type && w.avgPaceSeconds).length;
    const workoutsWithRpe = periodWorkouts.filter((w: WorkoutWithRelations) => w.workoutType === type && w.assessment?.rpe).length;

    return {
      type,
      count: data.count,
      total_miles: Math.round(data.totalMiles * 10) / 10,
      avg_pace: workoutsWithPace > 0 ? formatPaceFromTraining(Math.round(data.avgPace / workoutsWithPace)) : null,
      avg_rpe: workoutsWithRpe > 0 ? Math.round((data.avgRpe / workoutsWithRpe) * 10) / 10 : null,
      most_common_verdict: Object.entries(data.verdicts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    };
  });

  // Weekly mileage trend
  const weeklyMileage: Array<{ week: string; miles: number }> = [];
  const weekMap = new Map<string, number>();

  for (const w of periodWorkouts) {
    const weekStart = getWeekStart(new Date(w.date + 'T00:00:00'));
    const existing = weekMap.get(weekStart) || 0;
    weekMap.set(weekStart, existing + (w.distanceMiles || 0));
  }

  weekMap.forEach((miles, week) => {
    weeklyMileage.push({ week, miles: Math.round(miles * 10) / 10 });
  });
  weeklyMileage.sort((a, b) => a.week.localeCompare(b.week));

  // Identify trends
  const insights: string[] = [];

  // Check if mileage is increasing
  if (weeklyMileage.length >= 3) {
    const recent3 = weeklyMileage.slice(-3);
    if (recent3[2].miles > recent3[0].miles * 1.15) {
      insights.push('Mileage has been increasing - good progression!');
    } else if (recent3[2].miles < recent3[0].miles * 0.85) {
      insights.push('Mileage has decreased recently - intentional taper or reduction?');
    }
  }

  // Check easy run pacing
  const easyRuns = typeAnalysis.find(t => t.type === 'easy');
  if (easyRuns && easyRuns.avg_rpe && easyRuns.avg_rpe > 5) {
    insights.push('Easy runs may be too hard (avg RPE > 5). Try slowing down.');
  }

  // Check for variety
  const workoutTypes = typeAnalysis.length;
  if (workoutTypes <= 2) {
    insights.push('Consider adding more workout variety (tempo, intervals, hills).');
  }

  // Check long run consistency
  const longRuns = typeAnalysis.find(t => t.type === 'long');
  if (longRuns && longRuns.count < weeksBack * 0.5) {
    insights.push('Long runs are inconsistent. Aim for weekly long runs.');
  }

  return {
    has_data: true,
    period: {
      weeks: weeksBack,
      total_workouts: periodWorkouts.length,
      total_miles: Math.round(periodWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) * 10) / 10,
    },
    by_workout_type: typeAnalysis,
    weekly_mileage: weeklyMileage,
    insights: insights.length > 0 ? insights : ['Training looks balanced. Keep it up!'],
  };
}

async function getTrainingLoad() {
  const today = new Date();

  // Get last 28 days of workouts
  const cutoff28 = new Date(today);
  cutoff28.setDate(cutoff28.getDate() - 28);
  const cutoff7 = new Date(today);
  cutoff7.setDate(cutoff7.getDate() - 7);

  const loadProfileId = await getActiveProfileId();
  const all28Days: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: loadProfileId
      ? and(eq(workouts.profileId, loadProfileId), gte(workouts.date, cutoff28.toISOString().split('T')[0]))
      : gte(workouts.date, cutoff28.toISOString().split('T')[0]),
    with: {
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
  });

  const last7Days = all28Days.filter((w: WorkoutWithRelations) => w.date >= cutoff7.toISOString().split('T')[0]);

  // Calculate acute (7-day) and chronic (28-day) training load
  // Using a simplified TRIMP-like calculation: miles * RPE
  const calculateLoad = (workoutList: WorkoutWithRelations[]) => {
    return workoutList.reduce((sum: number, w: WorkoutWithRelations) => {
      const miles = w.distanceMiles || 0;
      const rpe = w.assessment?.rpe || 5; // Default to 5 if no RPE
      return sum + (miles * rpe);
    }, 0);
  };

  const acuteLoad = calculateLoad(last7Days);
  const chronicLoad = calculateLoad(all28Days) / 4; // Average weekly load over 4 weeks

  // Calculate acute:chronic workload ratio (ACWR)
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1;

  // Determine status
  let status: string;
  let recommendation: string;

  if (acwr < 0.8) {
    status = 'Undertrained';
    recommendation = 'Training load is lower than usual. Good for recovery, but consider ramping up if feeling fresh.';
  } else if (acwr <= 1.3) {
    status = 'Optimal';
    recommendation = 'Training load is in the sweet spot. Keep it steady.';
  } else if (acwr <= 1.5) {
    status = 'Caution';
    recommendation = 'Training load is elevated. Monitor fatigue and consider extra recovery.';
  } else {
    status = 'High Risk';
    recommendation = 'Training load spike detected. High injury risk. Recommend reducing volume.';
  }

  return {
    acute_load: {
      period: '7 days',
      value: Math.round(acuteLoad),
      miles: Math.round(last7Days.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.distanceMiles || 0), 0) * 10) / 10,
      workouts: last7Days.length,
    },
    chronic_load: {
      period: '28 days (avg/week)',
      value: Math.round(chronicLoad),
      total_miles: Math.round(all28Days.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) * 10) / 10,
      workouts: all28Days.length,
    },
    acwr: Math.round(acwr * 100) / 100,
    status,
    recommendation,
    interpretation: {
      'below_0.8': 'Undertrained - low injury risk but fitness may decline',
      '0.8_to_1.3': 'Optimal - good balance of training stress and recovery',
      '1.3_to_1.5': 'Caution - elevated load, monitor closely',
      'above_1.5': 'High risk - significant injury risk, reduce load',
    },
  };
}

async function getProactiveAlerts() {
  const alerts = await detectAlerts();

  if (alerts.length === 0) {
    return {
      alerts: [],
      message: 'No alerts at this time. Training looks good!',
    };
  }

  // Sort by severity (urgent first, then warnings, then info, then celebrations)
  const severityOrder = { urgent: 0, warning: 1, info: 2, celebration: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    alerts: alerts.map(alert => ({
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      recommendation: alert.recommendation,
    })),
    summary: {
      urgent: alerts.filter(a => a.severity === 'urgent').length,
      warnings: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
      celebrations: alerts.filter(a => a.severity === 'celebration').length,
    },
    coaching_notes: 'Address urgent and warning alerts first. Celebrate achievements to keep motivation high.',
  };
}

export {
  getReadinessScore,
  analyzeWorkoutPatterns,
  getTrainingLoad,
  getProactiveAlerts,
};
