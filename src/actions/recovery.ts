'use server';

import { db, workouts } from '@/lib/db';
import { desc, gte, eq, and } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { parseLocalDate } from '@/lib/utils';

/**
 * Recovery and freshness estimations
 */

export interface RecoveryStatus {
  recoveryHours: number;
  recoveryDescription: string;
  readyForHardWorkout: boolean;
  readyForEasyRun: boolean;
  suggestedNextWorkout: string;
  fatigueFactor: number; // 0-100
  formStatus: 'peaked' | 'fresh' | 'neutral' | 'tired' | 'very_tired';
}

export interface WeeklyLoadAnalysis {
  current7DayLoad: number;
  previous7DayLoad: number;
  acuteToChronicRatio: number;
  riskLevel: 'low' | 'optimal' | 'high' | 'very_high';
  recommendation: string;
}

export interface TrainingInsight {
  type: 'success' | 'warning' | 'suggestion' | 'achievement';
  title: string;
  message: string;
  metric?: string;
}

/**
 * Estimate training load for a workout (if not stored)
 */
function estimateLoad(durationMinutes: number | null, paceSeconds: number | null, workoutType: string | null): number {
  if (!durationMinutes) return 0;

  // Intensity factor based on workout type
  const intensityFactors: Record<string, number> = {
    recovery: 0.5,
    easy: 0.65,
    long: 0.7,
    steady: 0.75,
    tempo: 0.85,
    threshold: 0.9,
    interval: 0.95,
    race: 1.0,
  };

  const intensity = intensityFactors[workoutType || 'easy'] || 0.65;

  // Base load is duration * intensity^2
  // This makes harder workouts disproportionately more stressful
  return Math.round(durationMinutes * Math.pow(intensity, 2));
}

/**
 * Estimate recovery status based on recent training
 */
export async function getRecoveryStatus(): Promise<RecoveryStatus> {
  const profileId = await getActiveProfileId();
  const today = new Date();
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);

  const dateFilter = gte(workouts.date, threeDaysAgo.toISOString().split('T')[0]);
  const whereCondition = profileId
    ? and(dateFilter, eq(workouts.profileId, profileId))
    : dateFilter;

  const recentWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  if (recentWorkouts.length === 0) {
    return {
      recoveryHours: 0,
      recoveryDescription: 'Well rested',
      readyForHardWorkout: true,
      readyForEasyRun: true,
      suggestedNextWorkout: 'Any workout type',
      fatigueFactor: 10,
      formStatus: 'fresh',
    };
  }

  // Calculate fatigue factor based on recency and intensity
  let totalFatigue = 0;

  for (const w of recentWorkouts) {
    const workoutDate = parseLocalDate(w.date);
    const hoursSince = (today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60);
    const load = w.trainingLoad || estimateLoad(w.durationMinutes, w.avgPaceSeconds, w.workoutType);

    // Fatigue decays exponentially - half-life of ~24 hours
    const decayFactor = Math.pow(0.5, hoursSince / 24);
    totalFatigue += load * decayFactor;
  }

  // Normalize to 0-100
  const fatigueFactor = Math.min(100, Math.round(totalFatigue / 2));

  // Determine form status
  let formStatus: RecoveryStatus['formStatus'];
  if (fatigueFactor < 20) formStatus = 'peaked';
  else if (fatigueFactor < 35) formStatus = 'fresh';
  else if (fatigueFactor < 55) formStatus = 'neutral';
  else if (fatigueFactor < 75) formStatus = 'tired';
  else formStatus = 'very_tired';

  // Calculate recovery recommendations
  const lastWorkout = recentWorkouts[0];
  const lastWorkoutDate = parseLocalDate(lastWorkout.date);
  const hoursSinceLastWorkout = (today.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60);
  const lastWorkoutType = lastWorkout.workoutType || 'easy';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _lastWorkoutLoad = lastWorkout.trainingLoad || estimateLoad(lastWorkout.durationMinutes, lastWorkout.avgPaceSeconds, lastWorkoutType);

  // Base recovery time in hours (harder workouts need more recovery)
  const baseRecoveryHours: Record<string, number> = {
    recovery: 12,
    easy: 18,
    long: 36,
    steady: 24,
    tempo: 30,
    threshold: 36,
    interval: 36,
    race: 72,
  };

  const recoveryNeeded = baseRecoveryHours[lastWorkoutType] || 24;
  const recoveryRemaining = Math.max(0, recoveryNeeded - hoursSinceLastWorkout);

  // Determine suggestions
  let suggestedNextWorkout: string;
  let readyForHardWorkout = false;
  let readyForEasyRun = false;

  if (recoveryRemaining <= 0 && fatigueFactor < 50) {
    suggestedNextWorkout = 'Ready for quality workout or long run';
    readyForHardWorkout = true;
    readyForEasyRun = true;
  } else if (recoveryRemaining <= 6 && fatigueFactor < 65) {
    suggestedNextWorkout = 'Easy run or recovery jog recommended';
    readyForEasyRun = true;
  } else if (fatigueFactor < 80) {
    suggestedNextWorkout = 'Light activity or rest day';
    readyForEasyRun = hoursSinceLastWorkout > 12;
  } else {
    suggestedNextWorkout = 'Rest day recommended';
  }

  let recoveryDescription: string;
  if (formStatus === 'peaked') recoveryDescription = 'Fully recovered - prime for racing';
  else if (formStatus === 'fresh') recoveryDescription = 'Well recovered - ready for any workout';
  else if (formStatus === 'neutral') recoveryDescription = 'Normal fatigue - standard training OK';
  else if (formStatus === 'tired') recoveryDescription = 'Accumulated fatigue - prioritize recovery';
  else recoveryDescription = 'High fatigue - rest strongly recommended';

  return {
    recoveryHours: Math.round(recoveryRemaining),
    recoveryDescription,
    readyForHardWorkout,
    readyForEasyRun,
    suggestedNextWorkout,
    fatigueFactor,
    formStatus,
  };
}

/**
 * Analyze weekly training load and injury risk
 */
export async function getWeeklyLoadAnalysis(): Promise<WeeklyLoadAnalysis> {
  const profileId = await getActiveProfileId();
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);

  const dateFilter = gte(workouts.date, fourWeeksAgo.toISOString().split('T')[0]);
  const whereCondition = profileId
    ? and(dateFilter, eq(workouts.profileId, profileId))
    : dateFilter;

  const allWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  // Calculate loads
  const current7Day = allWorkouts
    .filter(w => parseLocalDate(w.date) >= oneWeekAgo)
    .reduce((sum, w) => sum + (w.trainingLoad || estimateLoad(w.durationMinutes, w.avgPaceSeconds, w.workoutType)), 0);

  const previous7Day = allWorkouts
    .filter(w => {
      const d = parseLocalDate(w.date);
      return d >= twoWeeksAgo && d < oneWeekAgo;
    })
    .reduce((sum, w) => sum + (w.trainingLoad || estimateLoad(w.durationMinutes, w.avgPaceSeconds, w.workoutType)), 0);

  const fourWeekAvg = allWorkouts
    .reduce((sum, w) => sum + (w.trainingLoad || estimateLoad(w.durationMinutes, w.avgPaceSeconds, w.workoutType)), 0) / 4;

  // Calculate acute:chronic ratio
  const acuteToChronicRatio = fourWeekAvg > 0
    ? Math.round((current7Day / fourWeekAvg) * 100) / 100
    : 1;

  // Determine risk level
  let riskLevel: WeeklyLoadAnalysis['riskLevel'];
  let recommendation: string;

  if (acuteToChronicRatio < 0.8) {
    riskLevel = 'low';
    recommendation = 'Training load is low. Safe to increase volume or intensity.';
  } else if (acuteToChronicRatio <= 1.3) {
    riskLevel = 'optimal';
    recommendation = 'Training load is in the optimal zone. Keep it up!';
  } else if (acuteToChronicRatio <= 1.5) {
    riskLevel = 'high';
    recommendation = 'Training load is elevated. Monitor for fatigue and consider backing off.';
  } else {
    riskLevel = 'very_high';
    recommendation = 'Training load is very high. High injury risk - reduce intensity.';
  }

  return {
    current7DayLoad: current7Day,
    previous7DayLoad: previous7Day,
    acuteToChronicRatio,
    riskLevel,
    recommendation,
  };
}

/**
 * Generate training insights based on recent patterns
 */
export async function getTrainingInsights(): Promise<TrainingInsight[]> {
  const profileId = await getActiveProfileId();
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const dateFilter = gte(workouts.date, thirtyDaysAgo.toISOString().split('T')[0]);
  const whereCondition = profileId
    ? and(dateFilter, eq(workouts.profileId, profileId))
    : dateFilter;

  const recentWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  const insights: TrainingInsight[] = [];

  if (recentWorkouts.length === 0) {
    insights.push({
      type: 'suggestion',
      title: 'Start Tracking',
      message: 'Log your workouts to get personalized training insights.',
    });
    return insights;
  }

  // Consistency check
  const uniqueDays = new Set(recentWorkouts.map(w => w.date)).size;
  const avgRunsPerWeek = (uniqueDays / 30) * 7;

  if (avgRunsPerWeek >= 4) {
    insights.push({
      type: 'success',
      title: 'Great Consistency',
      message: `You're averaging ${avgRunsPerWeek.toFixed(1)} runs per week. Consistency is key to improvement!`,
      metric: `${avgRunsPerWeek.toFixed(1)} runs/week`,
    });
  } else if (avgRunsPerWeek < 2) {
    insights.push({
      type: 'suggestion',
      title: 'Build Consistency',
      message: 'Try to run at least 3 times per week to maintain and build fitness.',
      metric: `${avgRunsPerWeek.toFixed(1)} runs/week`,
    });
  }

  // Easy/hard balance — use auto-detected category (autoCategory or zoneDominant)
  // rather than user-entered workoutType which is often unset for imported workouts
  const easyRuns = recentWorkouts.filter(w => {
    const cat = (w.autoCategory || w.zoneDominant || w.workoutType || '').toLowerCase();
    return ['easy', 'recovery'].includes(cat);
  }).length;
  const hardRuns = recentWorkouts.filter(w => {
    const cat = (w.autoCategory || w.zoneDominant || w.workoutType || '').toLowerCase();
    return ['tempo', 'interval', 'threshold', 'race', 'speed'].includes(cat);
  }).length;

  const easyPct = (easyRuns / recentWorkouts.length) * 100;

  if (easyPct < 70 && hardRuns > 2) {
    insights.push({
      type: 'warning',
      title: 'Too Much Intensity',
      message: `Only ${Math.round(easyPct)}% of your runs are easy. Aim for 80% easy to prevent burnout.`,
      metric: `${Math.round(easyPct)}% easy`,
    });
  } else if (easyPct >= 75 && hardRuns >= 1) {
    insights.push({
      type: 'success',
      title: 'Good Intensity Balance',
      message: 'You have a healthy mix of easy and hard efforts.',
      metric: `${Math.round(easyPct)}% easy`,
    });
  }

  // Long run check
  const longRuns = recentWorkouts.filter(w =>
    w.workoutType === 'long' || (w.distanceMiles && w.distanceMiles >= 10)
  );

  if (longRuns.length === 0 && recentWorkouts.length > 8) {
    insights.push({
      type: 'suggestion',
      title: 'Add a Long Run',
      message: 'Consider adding a weekly long run to build endurance.',
    });
  }

  // Pace improvement
  const sortedByDate = [...recentWorkouts]
    .filter(w => w.avgPaceSeconds && w.workoutType === 'easy')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sortedByDate.length >= 4) {
    const firstHalf = sortedByDate.slice(0, Math.floor(sortedByDate.length / 2));
    const secondHalf = sortedByDate.slice(Math.floor(sortedByDate.length / 2));

    const firstAvgPace = firstHalf.reduce((sum, w) => sum + (w.avgPaceSeconds || 0), 0) / firstHalf.length;
    const secondAvgPace = secondHalf.reduce((sum, w) => sum + (w.avgPaceSeconds || 0), 0) / secondHalf.length;

    const improvement = firstAvgPace - secondAvgPace;

    if (improvement > 5) {
      insights.push({
        type: 'achievement',
        title: 'Getting Faster!',
        message: `Your easy pace has improved by ${Math.round(improvement)} seconds over the past month.`,
        metric: `-${Math.round(improvement)}s/mi`,
      });
    }
  }

  // Weekly mileage trend
  const weeklyMiles = new Map<string, number>();
  for (const w of recentWorkouts) {
    const date = parseLocalDate(w.date);
    const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate() + date.getDay()) / 7)}`;
    weeklyMiles.set(weekKey, (weeklyMiles.get(weekKey) || 0) + (w.distanceMiles || 0));
  }

  const weeklyValues = [...weeklyMiles.values()];
  if (weeklyValues.length >= 3) {
    const recentAvg = weeklyValues.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const previousAvg = weeklyValues.slice(2).reduce((a, b) => a + b, 0) / (weeklyValues.length - 2);

    const mileageChange = ((recentAvg - previousAvg) / previousAvg) * 100;

    if (mileageChange > 15) {
      insights.push({
        type: 'warning',
        title: 'Rapid Mileage Increase',
        message: `Weekly mileage up ${Math.round(mileageChange)}%. Keep increases under 10% to prevent injury.`,
        metric: `+${Math.round(mileageChange)}%`,
      });
    } else if (mileageChange >= 5 && mileageChange <= 15) {
      insights.push({
        type: 'success',
        title: 'Safe Mileage Build',
        message: `Weekly mileage up ${Math.round(mileageChange)}% - right in the sweet spot.`,
        metric: `+${Math.round(mileageChange)}%`,
      });
    }
  }

  return insights.slice(0, 5); // Return top 5 insights
}
