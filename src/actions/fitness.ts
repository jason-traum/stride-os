'use server';

import { db, workouts, type Workout } from '@/lib/db';
import { desc, gte, lte, eq, and, asc } from 'drizzle-orm';
import { toLocalDateString } from '@/lib/utils';
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
import {
  analyzeRecovery,
  type RecoveryAnalysis,
  type RecoveryWorkout,
} from '@/lib/training/recovery-model';

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
  hasData: boolean;         // false when no workout data exists
  confidence: number;       // 0 = no data, 0.5 = limited (<7 days), 1.0 = good
  message?: string;         // explanation when confidence is low
}

/**
 * Get fitness trend data for charts
 * @param days Number of days to include (default 90)
 * @param profileId Optional profile ID to filter by
 */
export async function getFitnessTrendData(days: number = 90, profileId?: number, asOfDate?: Date): Promise<FitnessTrendData> {
  // Calculate date range
  const endDate = asOfDate ?? new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days - 42); // Extra 42 days for CTL warmup

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get workouts in range
  const conditions = [gte(workouts.date, startDateStr)];
  if (profileId) conditions.push(eq(workouts.profileId, profileId));
  if (asOfDate) conditions.push(lte(workouts.date, endDateStr));
  const whereConditions = and(...conditions);

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
        w.avgPaceSeconds || undefined,
        w.intervalAdjustedTrimp
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
  const fourWeeksAgo = new Date(endDate);
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

  // Determine data sufficiency
  const workoutDays = workoutLoads.length;
  const hasData = workoutDays > 0;
  let confidence: number;
  let message: string | undefined;

  if (workoutDays === 0) {
    confidence = 0;
    message = 'No workout data available — log some runs to see fitness trends';
  } else if (workoutDays < 7) {
    confidence = 0.3;
    message = 'Need at least a week of training data for reliable fitness metrics';
  } else if (workoutDays < 28) {
    confidence = 0.6;
    message = 'Limited training history — metrics will become more accurate over time';
  } else {
    confidence = 1.0;
  }

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
    hasData,
    confidence,
    message,
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

  const oneWeekAgoStr = toLocalDateString(oneWeekAgo);
  const twoWeeksAgoStr = toLocalDateString(twoWeeksAgo);
  const nowStr = toLocalDateString(now);

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
      w.avgPaceSeconds || undefined,
      w.intervalAdjustedTrimp
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

// ---------------------------------------------------------------------------
// Load Dashboard Data
// ---------------------------------------------------------------------------

export interface WeeklyMileageRamp {
  weekStart: string;
  miles: number;
  previousMiles: number | null;
  rampPercent: number | null;
  risk: 'green' | 'yellow' | 'red';
}

export interface DailyTrimpEntry {
  date: string;
  trimp: number;
  workoutType: string | null;
}

export interface LoadDashboardData {
  // CTL/ATL/TSB trend data
  fitness: FitnessTrendData;
  // Last 4 weeks of daily TRIMP
  dailyTrimp: DailyTrimpEntry[];
  // Weekly mileage ramp rates
  weeklyMileageRamp: WeeklyMileageRamp[];
  // Personalized recovery model output (null if not enough data)
  recovery: RecoveryAnalysis | null;
}

/**
 * Get all data needed for the training load dashboard
 */
export async function getLoadDashboardData(profileId?: number): Promise<LoadDashboardData> {
  // Fetch fitness trend data (365 days for a full year view)
  const fitness = await getFitnessTrendData(365, profileId);

  // Get last 28 days of daily TRIMP
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

  const trimpConditions = profileId
    ? and(gte(workouts.date, fourWeeksAgoStr), eq(workouts.profileId, profileId))
    : gte(workouts.date, fourWeeksAgoStr);

  const trimpWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(trimpConditions)
    .orderBy(asc(workouts.date));

  // Build daily TRIMP entries (aggregate multiple workouts per day)
  const trimpByDate = new Map<string, { trimp: number; workoutType: string | null }>();
  for (const w of trimpWorkouts) {
    if (!w.durationMinutes || w.durationMinutes <= 0) continue;
    const load = calculateWorkoutLoad(
      w.durationMinutes,
      w.workoutType || 'easy',
      w.distanceMiles || undefined,
      w.avgPaceSeconds || undefined,
      w.intervalAdjustedTrimp
    );
    const existing = trimpByDate.get(w.date);
    if (existing) {
      existing.trimp += load;
    } else {
      trimpByDate.set(w.date, { trimp: load, workoutType: w.workoutType });
    }
  }

  // Fill all 28 days (include rest days as 0)
  const dailyTrimp: DailyTrimpEntry[] = [];
  const cursor = new Date(fourWeeksAgo);
  const today = new Date();
  while (cursor <= today) {
    const dateStr = cursor.toISOString().split('T')[0];
    const entry = trimpByDate.get(dateStr);
    dailyTrimp.push({
      date: dateStr,
      trimp: entry?.trimp ?? 0,
      workoutType: entry?.workoutType ?? null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Calculate weekly mileage ramp rates (last 6 weeks for 5 comparisons)
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
  const sixWeeksAgoStr = sixWeeksAgo.toISOString().split('T')[0];

  const rampConditions = profileId
    ? and(gte(workouts.date, sixWeeksAgoStr), eq(workouts.profileId, profileId))
    : gte(workouts.date, sixWeeksAgoStr);

  const rampWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(rampConditions)
    .orderBy(asc(workouts.date));

  // Group into ISO weeks (Mon-Sun)
  const weeklyMiles = new Map<string, number>();
  for (const w of rampWorkouts) {
    const d = new Date(w.date + 'T12:00:00');
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const weekKey = monday.toISOString().split('T')[0];
    weeklyMiles.set(weekKey, (weeklyMiles.get(weekKey) || 0) + (w.distanceMiles || 0));
  }

  // Convert to sorted array and calculate ramp rates
  const sortedWeeks = Array.from(weeklyMiles.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const weeklyMileageRamp: WeeklyMileageRamp[] = sortedWeeks.map(([weekStart, miles], i) => {
    const previousMiles = i > 0 ? sortedWeeks[i - 1][1] : null;
    let rampPercent: number | null = null;
    if (previousMiles !== null && previousMiles > 0) {
      rampPercent = Math.round(((miles - previousMiles) / previousMiles) * 100);
    }
    let risk: 'green' | 'yellow' | 'red' = 'green';
    if (rampPercent !== null) {
      if (rampPercent > 15) risk = 'red';
      else if (rampPercent > 10) risk = 'yellow';
    }
    return {
      weekStart,
      miles: Math.round(miles * 10) / 10,
      previousMiles: previousMiles !== null ? Math.round(previousMiles * 10) / 10 : null,
      rampPercent,
      risk,
    };
  });

  // Personalized recovery model
  let recovery: RecoveryAnalysis | null = null;
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

  const recoveryConditions = profileId
    ? and(gte(workouts.date, ninetyDaysAgoStr), eq(workouts.profileId, profileId))
    : gte(workouts.date, ninetyDaysAgoStr);

  const recoveryWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(recoveryConditions)
    .orderBy(asc(workouts.date));

  if (recoveryWorkouts.length >= 5) {
    const recoveryInput: RecoveryWorkout[] = recoveryWorkouts
      .filter(w => w.durationMinutes && w.durationMinutes > 0)
      .map(w => ({
        date: w.date,
        category: (w.workoutType || 'easy') as RecoveryWorkout['category'],
        trimp: w.trainingLoad ?? calculateWorkoutLoad(
          w.durationMinutes!,
          w.workoutType || 'easy',
          w.distanceMiles || undefined,
          w.avgPaceSeconds || undefined,
          w.intervalAdjustedTrimp
        ),
        durationMinutes: w.durationMinutes!,
        averageHR: w.avgHeartRate ?? undefined,
      }));

    recovery = analyzeRecovery({ workouts: recoveryInput });
  }

  return {
    fitness,
    dailyTrimp,
    weeklyMileageRamp,
    recovery,
  };
}
