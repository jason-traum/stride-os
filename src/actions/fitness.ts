'use server';

import { db, workouts, type Workout } from '@/lib/db';
import { desc, gte, eq, and } from 'drizzle-orm';
import {
  calculateWorkoutLoad,
  calculateFitnessMetrics,
  fillDailyLoadGaps,
  getFitnessStatus,
  calculateOptimalLoadRange,
  calculateRampRate,
  getRampRateRisk,
  type FitnessMetrics,
  type DailyLoad,
  type RampRateRisk,
} from '@/lib/training/fitness-calculations';

export interface FitnessTrendData {
  metrics: FitnessMetrics[];
  currentCtl: number;
  currentAtl: number;
  currentTsb: number;
  status: ReturnType<typeof getFitnessStatus>;
  weeklyLoad: number;
  optimalRange: { min: number; max: number };
  ctlChange: number | null; // vs 4 weeks ago
  rampRate: number | null; // CTL change per week
  rampRateRisk: RampRateRisk;
}

/**
 * Get fitness trend data for charts
 * @param days Number of days to include (default 90)
 * @param profileId Optional profile ID to filter by
 */
export async function getFitnessTrendData(days: number = 90, profileId?: number): Promise<FitnessTrendData> {
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days - 42); // Extra 42 days for CTL warmup

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get workouts in range
  const whereConditions = profileId
    ? and(gte(workouts.date, startDateStr), eq(workouts.profileId, profileId))
    : gte(workouts.date, startDateStr);

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  // Convert workouts to daily loads
  const workoutLoads: DailyLoad[] = recentWorkouts
    .filter(w => w.durationMinutes && w.durationMinutes > 0)
    .map(w => ({
      date: w.date,
      load: calculateWorkoutLoad(
        w.durationMinutes!,
        w.workoutType || 'easy',
        w.distanceMiles || undefined,
        w.avgPaceSeconds || undefined
      ),
    }));

  // Fill gaps with rest days
  const dailyLoads = fillDailyLoadGaps(workoutLoads, startDateStr, endDateStr);

  // Calculate metrics
  const metrics = calculateFitnessMetrics(dailyLoads);

  // Get current values (last day with data)
  const currentMetrics = metrics[metrics.length - 1] || {
    ctl: 0,
    atl: 0,
    tsb: 0,
    dailyLoad: 0,
    date: endDateStr,
  };

  // Get metrics from 4 weeks ago for comparison
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];
  const pastMetrics = metrics.find(m => m.date === fourWeeksAgoStr);
  const ctlChange = pastMetrics
    ? Math.round((currentMetrics.ctl - pastMetrics.ctl) * 10) / 10
    : null;

  // Calculate 7-day load
  const last7Days = metrics.slice(-7);
  const weeklyLoad = last7Days.reduce((sum, m) => sum + m.dailyLoad, 0);

  // Trim metrics to requested range (remove warmup period)
  const displayStartDate = new Date();
  displayStartDate.setDate(displayStartDate.getDate() - days);
  const displayStartStr = displayStartDate.toISOString().split('T')[0];
  const displayMetrics = metrics.filter(m => m.date >= displayStartStr);

  // Calculate ramp rate (4-week rate of CTL change)
  const rampRate = calculateRampRate(metrics, 4);
  const rampRateRisk = getRampRateRisk(rampRate);

  return {
    metrics: displayMetrics,
    currentCtl: currentMetrics.ctl,
    currentAtl: currentMetrics.atl,
    currentTsb: currentMetrics.tsb,
    status: getFitnessStatus(currentMetrics.tsb),
    weeklyLoad: Math.round(weeklyLoad),
    optimalRange: calculateOptimalLoadRange(currentMetrics.ctl),
    ctlChange,
    rampRate,
    rampRateRisk,
  };
}

/**
 * Get training load data for the load bar visualization
 * @param profileId Optional profile ID to filter by
 */
export async function getTrainingLoadData(profileId?: number): Promise<{
  current7DayLoad: number;
  previous7DayLoad: number;
  optimalMin: number;
  optimalMax: number;
  loadStatus: 'low' | 'optimal' | 'high';
  percentChange: number | null;
}> {
  // Get last 28 days of workouts for calculating optimal range
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);
  const startDateStr = startDate.toISOString().split('T')[0];

  const whereConditions = profileId
    ? and(gte(workouts.date, startDateStr), eq(workouts.profileId, profileId))
    : gte(workouts.date, startDateStr);

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  // Group by week
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];
  const nowStr = now.toISOString().split('T')[0];

  // Calculate loads
  let current7DayLoad = 0;
  let previous7DayLoad = 0;
  let fourWeekTotal = 0;

  for (const w of recentWorkouts) {
    if (!w.durationMinutes) continue;

    const load = calculateWorkoutLoad(
      w.durationMinutes,
      w.workoutType || 'easy',
      w.distanceMiles || undefined,
      w.avgPaceSeconds || undefined
    );

    fourWeekTotal += load;

    if (w.date >= oneWeekAgoStr && w.date <= nowStr) {
      current7DayLoad += load;
    } else if (w.date >= twoWeeksAgoStr && w.date < oneWeekAgoStr) {
      previous7DayLoad += load;
    }
  }

  // Calculate optimal range as 80-120% of 4-week average weekly load
  const avgWeeklyLoad = fourWeekTotal / 4;
  const optimalMin = Math.round(avgWeeklyLoad * 0.8);
  const optimalMax = Math.round(avgWeeklyLoad * 1.2);

  // Determine status
  let loadStatus: 'low' | 'optimal' | 'high' = 'optimal';
  if (current7DayLoad < optimalMin) {
    loadStatus = 'low';
  } else if (current7DayLoad > optimalMax) {
    loadStatus = 'high';
  }

  // Calculate percent change
  const percentChange = previous7DayLoad > 0
    ? Math.round(((current7DayLoad - previous7DayLoad) / previous7DayLoad) * 100)
    : null;

  return {
    current7DayLoad: Math.round(current7DayLoad),
    previous7DayLoad: Math.round(previous7DayLoad),
    optimalMin,
    optimalMax,
    loadStatus,
    percentChange,
  };
}
