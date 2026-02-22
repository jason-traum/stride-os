'use server';

import { db, workouts, workoutSegments, plannedWorkouts, assessments, userSettings, Workout } from '@/lib/db';
import { desc, gte, eq, inArray, and, or, isNull } from 'drizzle-orm';
import { parseLocalDate, toLocalDateString } from '@/lib/utils';
import { classifySplitEfforts } from '@/lib/training/effort-classifier';
import { computeConditionAdjustment } from '@/lib/training/run-classifier';
import { getActiveProfileId } from '@/lib/profile-server';

// Shared condition: exclude workouts flagged for exclusion
function notExcluded() {
  return and(
    or(eq(workouts.excludeFromEstimates, false), isNull(workouts.excludeFromEstimates)),
    or(eq(workouts.autoExcluded, false), isNull(workouts.autoExcluded))
  );
}

// Base weekly stats for analytics charts
export interface WeeklyStatsBase {
  weekStart: string;
  totalMiles: number;
  totalMinutes: number;
  workoutCount: number;
}

// Extended weekly stats for Today page card
export interface WeeklyStats {
  weekStart: string;
  totalMiles: number;
  totalMinutes: number;
  workoutCount: number;
  runCount: number;
  avgPace: number | null;
  avgRpe: number | null;
  longestRun: number;
  weekOverWeekMileageChange: number | null;
}

export interface WorkoutTypeDistribution {
  type: string;
  count: number;
  miles: number;
  minutes: number;
}

export interface AnalyticsData {
  // Summary stats
  totalWorkouts: number;
  totalMiles: number;
  totalMinutes: number;
  avgPaceSeconds: number | null;

  // Weekly breakdown (last 12 weeks)
  weeklyStats: WeeklyStatsBase[];

  // Workout type distribution
  workoutTypeDistribution: WorkoutTypeDistribution[];

  // Recent workouts for pace trend
  recentPaces: Array<{
    date: string;
    paceSeconds: number;
    workoutType: string;
    fastestSplitSeconds?: number; // Fastest segment pace (any distance)
    goalPaceSeconds?: number; // Target pace from planned workout or zones
    goalSource?: string; // Where goal came from: 'planned', 'easy_zone', 'tempo_zone', etc.
  }>;
}

export async function getAnalyticsData(profileId?: number): Promise<AnalyticsData> {
  const resolvedProfileId = profileId ?? await getActiveProfileId();

  // Use 90 days for summary stats (fast), 365 days only for pace trend
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = toLocalDateString(ninetyDaysAgo);

  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const paceCutoffDate = toLocalDateString(yearAgo);

  const whereConditions = resolvedProfileId
    ? and(gte(workouts.date, cutoffDate), eq(workouts.profileId, resolvedProfileId), notExcluded())
    : and(gte(workouts.date, cutoffDate), notExcluded());

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  // Calculate summary stats
  const totalWorkouts = recentWorkouts.length;
  const totalMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalMinutes = recentWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  // Calculate average pace from workouts with pace data
  const workoutsWithPace = recentWorkouts.filter(w => w.avgPaceSeconds);
  const avgPaceSeconds = workoutsWithPace.length > 0
    ? Math.round(workoutsWithPace.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / workoutsWithPace.length)
    : null;

  // Calculate weekly stats
  const weeklyMap = new Map<string, WeeklyStatsBase>();

  for (const workout of recentWorkouts) {
    const date = parseLocalDate(workout.date);
    // Get Monday of the week
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekStart = toLocalDateString(monday);

    const existing = weeklyMap.get(weekStart) || {
      weekStart,
      totalMiles: 0,
      totalMinutes: 0,
      workoutCount: 0,
    };

    existing.totalMiles += workout.distanceMiles || 0;
    existing.totalMinutes += workout.durationMinutes || 0;
    existing.workoutCount += 1;

    weeklyMap.set(weekStart, existing);
  }

  // Sort by week and take last 12 weeks
  const weeklyStats = Array.from(weeklyMap.values())
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-12);

  // Calculate effort distribution by segment (not by run-level type)
  // Fetch all segments for recent workouts to classify actual effort per mile
  const workoutIds = recentWorkouts.map(w => w.id);
  const allSegments = workoutIds.length > 0
    ? await db.query.workoutSegments.findMany({
        where: inArray(workoutSegments.workoutId, workoutIds),
      })
    : [];

  // Group segments by workout
  const segmentsByWorkout = new Map<number, typeof allSegments>();
  for (const seg of allSegments) {
    if (!segmentsByWorkout.has(seg.workoutId)) {
      segmentsByWorkout.set(seg.workoutId, []);
    }
    segmentsByWorkout.get(seg.workoutId)!.push(seg);
  }

  // Fetch user's pace settings for accurate zone classification
  const settingsWhere = profileId
    ? eq(userSettings.profileId, profileId)
    : undefined;
  const [settings] = settingsWhere
    ? await db.select().from(userSettings).where(settingsWhere).limit(1)
    : await db.select().from(userSettings).limit(1);

  const classifyOptions = {
    vdot: settings?.vdot ?? undefined,
    easyPace: settings?.easyPaceSeconds ?? undefined,
    marathonPace: settings?.marathonPaceSeconds ?? undefined,
    tempoPace: settings?.tempoPaceSeconds ?? undefined,
    thresholdPace: settings?.thresholdPaceSeconds ?? undefined,
  };

  // Classify each segment's effort and aggregate
  // Always reclassify from segments to use current zone boundaries
  const typeMap = new Map<string, { count: number; miles: number; minutes: number }>();

  for (const workout of recentWorkouts) {
    const segs = segmentsByWorkout.get(workout.id);

    if (segs && segs.length >= 2) {
      // Has segments — classify each one by actual effort using user's pace zones
      const sorted = [...segs].sort((a, b) => a.segmentNumber - b.segmentNumber);
      const laps = sorted.map(seg => ({
        lapNumber: seg.segmentNumber,
        distanceMiles: seg.distanceMiles || 1,
        durationSeconds: seg.durationSeconds || ((seg.paceSecondsPerMile || 480) * (seg.distanceMiles || 1)),
        avgPaceSeconds: seg.paceSecondsPerMile || 480,
        avgHeartRate: seg.avgHr,
        maxHeartRate: seg.maxHr,
        elevationGainFeet: seg.elevationGainFt,
        lapType: seg.segmentType || 'steady',
      }));

      const classified = classifySplitEfforts(laps, {
        workoutType: workout.workoutType || 'easy',
        avgPaceSeconds: workout.avgPaceSeconds,
        conditionAdjustment: computeConditionAdjustment(workout),
        ...classifyOptions,
      });

      for (let i = 0; i < classified.length; i++) {
        const cat = classified[i].category;
        // Normalize warmup/cooldown → easy, anomaly → other
        const type = (cat === 'warmup' || cat === 'cooldown') ? 'easy'
          : cat === 'anomaly' ? 'other'
          : cat;
        const segMiles = sorted[i].distanceMiles || 1;
        const segMinutes = (sorted[i].durationSeconds || 0) / 60;
        const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
        existing.count += 1; // count = number of segments
        existing.miles += segMiles;
        existing.minutes += segMinutes;
        typeMap.set(type, existing);
      }
    } else {
      // No segments — fall back to run-level type
      const type = workout.workoutType || 'other';
      const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
      existing.count += 1;
      existing.miles += workout.distanceMiles || 0;
      existing.minutes += workout.durationMinutes || 0;
      typeMap.set(type, existing);
    }
  }

  const workoutTypeDistribution = Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      miles: Math.round(data.miles * 10) / 10,
      minutes: Math.round(data.minutes),
    }))
    .sort((a, b) => {
      const order: Record<string, number> = {
        recovery: 0, easy: 1, long: 2, steady: 3, marathon: 4,
        tempo: 5, threshold: 6, interval: 7, repetition: 8,
        race: 9, cross_train: 10, other: 11,
      };
      return (order[a.type] ?? 99) - (order[b.type] ?? 99);
    });

  // Get recent paces for trend chart (use full year of data for longer trend view)
  const paceWhereConditions = profileId
    ? and(gte(workouts.date, paceCutoffDate), eq(workouts.profileId, profileId), notExcluded())
    : and(gte(workouts.date, paceCutoffDate), notExcluded());

  const paceWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(paceWhereConditions)
    .orderBy(desc(workouts.date));

  const workoutsForPaces = paceWorkouts
    .filter(w => w.avgPaceSeconds);

  const paceWorkoutIds = workoutsForPaces.map(w => w.id);

  // Fetch ALL segments for these workouts (any distance - pace is already normalized)
  const fastestSplitMap = new Map<number, number>();

  if (paceWorkoutIds.length > 0) {
    const paceSegments = await db.query.workoutSegments.findMany({
      where: inArray(workoutSegments.workoutId, paceWorkoutIds),
    });

    // Group segments by workout for analysis
    const paceSegmentsByWorkout = new Map<number, typeof paceSegments>();
    for (const seg of paceSegments) {
      if (!paceSegmentsByWorkout.has(seg.workoutId)) {
        paceSegmentsByWorkout.set(seg.workoutId, []);
      }
      paceSegmentsByWorkout.get(seg.workoutId)!.push(seg);
    }

    // For each workout, find the fastest work segment using smart classification
    for (const [workoutId, segs] of paceSegmentsByWorkout) {
      const validPaces = segs
        .map(s => s.paceSecondsPerMile)
        .filter((p): p is number => !!p && p > 180 && p < 600);

      if (validPaces.length === 0) continue;

      // Check if segments are already classified
      const hasWorkSegments = segs.some(s => s.segmentType === 'work');

      if (hasWorkSegments) {
        // Use existing classification
        const workPaces = segs
          .filter(s => s.segmentType === 'work')
          .map(s => s.paceSecondsPerMile)
          .filter((p): p is number => !!p && p > 180 && p < 600);

        if (workPaces.length > 0) {
          fastestSplitMap.set(workoutId, Math.min(...workPaces));
        }
      } else {
        // Smart classification: use Winsorized approach to find work intervals
        // Exclude recovery segments (much slower than median)
        const sortedPaces = [...validPaces].sort((a, b) => a - b);
        const medianPace = sortedPaces[Math.floor(sortedPaces.length / 2)];

        // Recovery threshold: > 45 seconds slower than median is likely rest
        const recoveryThreshold = medianPace + 45;

        // Filter out likely recovery/rest intervals
        const workPaces = validPaces.filter(p => p < recoveryThreshold);

        if (workPaces.length > 0) {
          // For interval workouts, look for the fast repeats
          // Use 25th percentile to get representative "work" pace (not just one fluke)
          const fastPaces = [...workPaces].sort((a, b) => a - b);
          const fastIdx = Math.min(Math.floor(fastPaces.length * 0.25), fastPaces.length - 1);
          fastestSplitMap.set(workoutId, fastPaces[fastIdx]);
        } else {
          // Fall back to fastest overall
          fastestSplitMap.set(workoutId, Math.min(...validPaces));
        }
      }
    }
  }

  // Fetch goal paces from linked planned workouts
  const goalPaceMap = new Map<number, { pace: number; source: string }>();
  const plannedWorkoutIds = workoutsForPaces
    .filter(w => w.plannedWorkoutId)
    .map(w => w.plannedWorkoutId as number);

  if (plannedWorkoutIds.length > 0) {
    const planned = await db.query.plannedWorkouts.findMany({
      where: inArray(plannedWorkouts.id, plannedWorkoutIds),
    });

    // Map planned workout ID to workout ID
    const plannedToWorkout = new Map<number, number>();
    for (const w of workoutsForPaces) {
      if (w.plannedWorkoutId) {
        plannedToWorkout.set(w.plannedWorkoutId, w.id);
      }
    }

    for (const p of planned) {
      const workoutId = plannedToWorkout.get(p.id);
      if (workoutId && p.targetPaceSecondsPerMile) {
        goalPaceMap.set(workoutId, {
          pace: p.targetPaceSecondsPerMile,
          source: 'planned'
        });
      }
    }
  }

  const recentPaces = workoutsForPaces
    .map(w => {
      const goalData = goalPaceMap.get(w.id);
      return {
        date: w.date,
        paceSeconds: w.avgPaceSeconds!,
        workoutType: w.workoutType || 'other',
        fastestSplitSeconds: fastestSplitMap.get(w.id),
        goalPaceSeconds: goalData?.pace,
        goalSource: goalData?.source,
      };
    })
    .reverse();

  return {
    totalWorkouts,
    totalMiles: Math.round(totalMiles),
    totalMinutes: Math.round(totalMinutes),
    avgPaceSeconds,
    weeklyStats,
    workoutTypeDistribution,
    recentPaces,
  };
}

/**
 * Get stats for the current week (used on Today page)
 */
export async function getWeeklyStats(profileId?: number): Promise<WeeklyStats> {
  const resolvedProfileId = profileId ?? await getActiveProfileId();

  // Use timezone-aware date to avoid UTC day-boundary issues
  const now = new Date();
  const todayStr = toLocalDateString(now);
  const today = parseLocalDate(todayStr);
  // Get Monday of current week
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diff);
  const weekStart = toLocalDateString(monday);

  // Get last week's Monday for comparison
  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastWeekStart = toLocalDateString(lastMonday);

  // Get this week's workouts
  const thisWeekConditions = resolvedProfileId
    ? and(gte(workouts.date, weekStart), eq(workouts.profileId, resolvedProfileId), notExcluded())
    : and(gte(workouts.date, weekStart), notExcluded());

  const weekWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(thisWeekConditions)
    .orderBy(desc(workouts.date));

  // Get last week's workouts for comparison
  const lastWeekConditions = resolvedProfileId
    ? and(gte(workouts.date, lastWeekStart), eq(workouts.profileId, resolvedProfileId), notExcluded())
    : and(gte(workouts.date, lastWeekStart), notExcluded());

  const lastWeekWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(lastWeekConditions)
    .orderBy(desc(workouts.date));

  // Filter to just last week (not including this week)
  const actualLastWeekWorkouts = lastWeekWorkouts.filter((w: Workout) => w.date < weekStart);

  // Calculate stats
  const totalMiles = weekWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalMinutes = weekWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
  const workoutCount = weekWorkouts.length;

  // Calculate last week's miles for comparison
  const lastWeekMiles = actualLastWeekWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const weekOverWeekMileageChange = lastWeekMiles > 0
    ? Math.round(((totalMiles - lastWeekMiles) / lastWeekMiles) * 100)
    : null;

  // Calculate average pace
  const workoutsWithPace = weekWorkouts.filter(w => w.avgPaceSeconds);
  const avgPace = workoutsWithPace.length > 0
    ? Math.round(workoutsWithPace.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / workoutsWithPace.length)
    : null;

  // Find longest run
  const longestRun = Math.max(0, ...weekWorkouts.map(w => w.distanceMiles || 0));

  // Calculate average RPE from assessments
  let avgRpe: number | null = null;
  if (weekWorkouts.length > 0) {
    const workoutIds = weekWorkouts.map(w => w.id);
    const weekAssessments = await db
      .select()
      .from(assessments)
      .where(inArray(assessments.workoutId, workoutIds));

    const rpeValues = weekAssessments
      .map((a: { rpe: number | null }) => a.rpe)
      .filter((rpe: number | null): rpe is number => rpe !== null);

    if (rpeValues.length > 0) {
      avgRpe = Math.round((rpeValues.reduce((sum: number, rpe: number) => sum + rpe, 0) / rpeValues.length) * 10) / 10;
    }
  }

  return {
    weekStart,
    totalMiles: Math.round(totalMiles * 10) / 10,
    totalMinutes: Math.round(totalMinutes),
    workoutCount,
    runCount: workoutCount,
    avgPace,
    avgRpe,
    longestRun: Math.round(longestRun * 10) / 10,
    weekOverWeekMileageChange,
  };
}

/**
 * Calculate running streak (consecutive days with workouts)
 */
export async function getRunningStreak(profileId?: number) {
  const resolvedProfileId = profileId ?? await getActiveProfileId();
  const whereConditions = resolvedProfileId
    ? eq(workouts.profileId, resolvedProfileId)
    : undefined;

  const allWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  if (allWorkouts.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get unique dates with workouts
  const workoutDates = new Set(allWorkouts.map(w => w.date));
  const sortedDates = Array.from(workoutDates).sort().reverse();

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = toLocalDateString(today);
  const yesterdayStr = toLocalDateString(yesterday);

  // Check if streak is active (ran today or yesterday)
  if (sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr) {
    currentStreak = 1;
    const checkDate = new Date(sortedDates[0]);

    for (let i = 1; i < sortedDates.length; i++) {
      checkDate.setDate(checkDate.getDate() - 1);
      const checkStr = toLocalDateString(checkDate);

      if (sortedDates[i] === checkStr) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
  };
}

/**
 * Get volume summary data for cards
 */
export async function getVolumeSummaryData(profileId?: number): Promise<{
  thisWeekMiles: number;
  lastWeekMiles: number;
  thisMonthMiles: number;
  lastMonthMiles: number;
  ytdMiles: number;
}> {
  const resolvedProfileId = profileId ?? await getActiveProfileId();

  // Use timezone-aware dates to avoid UTC day-boundary issues
  const now = new Date();
  const todayStr = toLocalDateString(now);
  const today = parseLocalDate(todayStr);

  // This week (Monday to today)
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + mondayOffset);
  const thisMondayStr = toLocalDateString(thisMonday);

  // Last week
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastMondayStr = toLocalDateString(lastMonday);

  // This month
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthStartStr = toLocalDateString(thisMonthStart);

  // Last month
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthStartStr = toLocalDateString(lastMonthStart);

  // YTD
  const ytdStart = new Date(today.getFullYear(), 0, 1);
  const ytdStartStr = toLocalDateString(ytdStart);

  // Get all workouts from YTD start
  const whereConditions = resolvedProfileId
    ? and(gte(workouts.date, ytdStartStr), eq(workouts.profileId, resolvedProfileId), notExcluded())
    : and(gte(workouts.date, ytdStartStr), notExcluded());

  const allWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  // Calculate totals
  let thisWeekMiles = 0;
  let lastWeekMiles = 0;
  let thisMonthMiles = 0;
  let lastMonthMiles = 0;
  let ytdMiles = 0;

  for (const w of allWorkouts) {
    const miles = w.distanceMiles || 0;
    ytdMiles += miles;

    if (w.date >= thisMondayStr) {
      thisWeekMiles += miles;
    } else if (w.date >= lastMondayStr && w.date < thisMondayStr) {
      lastWeekMiles += miles;
    }

    if (w.date >= thisMonthStartStr) {
      thisMonthMiles += miles;
    } else if (w.date >= lastMonthStartStr && w.date < thisMonthStartStr) {
      lastMonthMiles += miles;
    }
  }

  return {
    thisWeekMiles: Math.round(thisWeekMiles * 10) / 10,
    lastWeekMiles: Math.round(lastWeekMiles * 10) / 10,
    thisMonthMiles: Math.round(thisMonthMiles * 10) / 10,
    lastMonthMiles: Math.round(lastMonthMiles * 10) / 10,
    ytdMiles: Math.round(ytdMiles * 10) / 10,
  };
}

/**
 * Extended daily activity data for heatmap with color system
 */
export interface DailyActivityData {
  date: string;
  miles: number;
  workoutType?: string;
  avgPaceSeconds?: number;
  avgHr?: number;
  durationMinutes?: number;
  trimp?: number;
  rpe?: number;
  workoutId?: number;
  workoutCount?: number;
}

/**
 * Estimate TRIMP when no stored value exists.
 * Uses HR if available (Banister formula), otherwise pace-based intensity.
 */
function estimateTrimp(
  durationMinutes: number,
  avgPaceSeconds?: number | null,
  avgHr?: number | null,
  workoutType?: string | null,
): number {
  if (avgHr && avgHr > 0) {
    // Simplified Banister TRIMP with assumed resting HR 60, max HR 190
    const restingHr = 60;
    const maxHr = 190;
    const hrFraction = Math.max(0, Math.min(1, (avgHr - restingHr) / (maxHr - restingHr)));
    const yFactor = hrFraction * 1.92 * Math.exp(1.92 * hrFraction);
    return Math.round(durationMinutes * yFactor);
  }

  // Pace-based intensity factor
  const pace = avgPaceSeconds || 600;
  let intensityFactor = pace < 360 ? 2.5 :
                        pace < 420 ? 2.0 :
                        pace < 480 ? 1.6 :
                        pace < 540 ? 1.3 :
                        pace < 600 ? 1.1 :
                        1.0;

  // Boost for known hard workout types
  if (workoutType) {
    const type = workoutType.toLowerCase();
    if (type === 'race') intensityFactor *= 1.3;
    else if (type === 'interval' || type === 'speed') intensityFactor *= 1.15;
    else if (type === 'tempo' || type === 'threshold') intensityFactor *= 1.1;
  }

  return Math.round(durationMinutes * intensityFactor);
}

/**
 * Get daily activity data for heatmap
 */
export async function getDailyActivityData(months: number = 12, profileId?: number): Promise<DailyActivityData[]> {
  // Get workouts from the last N months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const cutoffDateStr = toLocalDateString(startDate);

  const whereConditions = profileId
    ? and(gte(workouts.date, cutoffDateStr), eq(workouts.profileId, profileId), notExcluded())
    : and(gte(workouts.date, cutoffDateStr), notExcluded());

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  // Group by date, aggregating workout data
  // For days with multiple workouts, we'll sum miles/duration and average pace/HR
  const dailyMap = new Map<string, {
    miles: number;
    durationMinutes: number;
    totalPaceWeighted: number;
    totalHrWeighted: number;
    trimp: number;
    rpe: number | null;
    workoutTypes: string[];
    workoutIds: number[];
    count: number;
  }>();

  for (const workout of recentWorkouts) {
    const miles = workout.distanceMiles || 0;
    const duration = workout.durationMinutes || 0;
    const existing = dailyMap.get(workout.date) || {
      miles: 0,
      durationMinutes: 0,
      totalPaceWeighted: 0,
      totalHrWeighted: 0,
      trimp: 0,
      rpe: null,
      workoutTypes: [],
      workoutIds: [],
      count: 0,
    };

    existing.miles += miles;
    existing.durationMinutes += duration;
    existing.workoutIds.push(workout.id);
    if (workout.avgPaceSeconds && miles > 0) {
      existing.totalPaceWeighted += workout.avgPaceSeconds * miles;
    }
    if (workout.avgHr && miles > 0) {
      existing.totalHrWeighted += workout.avgHr * miles;
    }
    // Use stored TRIMP, or estimate from available data
    if (workout.trimp) {
      existing.trimp += workout.trimp;
    } else if (duration > 0) {
      existing.trimp += estimateTrimp(duration, workout.avgPaceSeconds, workout.avgHr || workout.avgHeartRate, workout.workoutType);
    }
    // RPE lives on the assessments table, not workouts — skip here
    if (workout.workoutType) {
      existing.workoutTypes.push(workout.workoutType);
    }
    existing.count++;

    dailyMap.set(workout.date, existing);
  }

  // Convert to array with computed averages
  return Array.from(dailyMap.entries())
    .map(([date, data]) => {
      // Determine dominant workout type for the day
      // Priority: race > interval/tempo/threshold > long > easy
      const typeOrder = ['race', 'interval', 'tempo', 'threshold', 'long', 'steady', 'easy', 'recovery'];
      let dominantType = data.workoutTypes[0] || undefined;
      for (const type of typeOrder) {
        if (data.workoutTypes.some(t => t?.toLowerCase().includes(type))) {
          dominantType = type;
          break;
        }
      }

      return {
        date,
        miles: Math.round(data.miles * 10) / 10,
        workoutType: dominantType,
        avgPaceSeconds: data.totalPaceWeighted > 0 && data.miles > 0
          ? Math.round(data.totalPaceWeighted / data.miles)
          : undefined,
        avgHr: data.totalHrWeighted > 0 && data.miles > 0
          ? Math.round(data.totalHrWeighted / data.miles)
          : undefined,
        durationMinutes: Math.round(data.durationMinutes),
        trimp: data.trimp > 0 ? Math.round(data.trimp) : undefined,
        rpe: data.rpe ?? undefined,
        workoutId: data.workoutIds[0],
        workoutCount: data.count,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calendar data for monthly calendar view
 */
export interface CalendarWorkoutDay {
  date: string;
  miles: number;
  workoutType: string;
  workoutId?: number;
}

/**
 * Get workout data for calendar view (last 12 months)
 */
export async function getCalendarData(profileId?: number): Promise<CalendarWorkoutDay[]> {
  // Get workouts from the last 12 months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);
  const cutoffDateStr = toLocalDateString(startDate);

  const whereConditions = profileId
    ? and(gte(workouts.date, cutoffDateStr), eq(workouts.profileId, profileId))
    : gte(workouts.date, cutoffDateStr);

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  return recentWorkouts.map(w => ({
    date: w.date,
    miles: Math.round((w.distanceMiles || 0) * 10) / 10,
    workoutType: w.workoutType || 'other',
    workoutId: w.id,
  }));
}

/**
 * Lightweight weekly volume data for charts with time range toggles.
 * Returns up to 3 years of weekly data (miles, minutes, trimp).
 */
export interface WeeklyVolumeEntry {
  weekStart: string;
  miles: number;
  minutes: number;
  trimp: number;
}

export async function getWeeklyVolumeData(profileId?: number): Promise<WeeklyVolumeEntry[]> {
  const resolvedProfileId = profileId ?? await getActiveProfileId();

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const cutoff = toLocalDateString(threeYearsAgo);

  const whereConditions = resolvedProfileId
    ? and(gte(workouts.date, cutoff), eq(workouts.profileId, resolvedProfileId), notExcluded())
    : and(gte(workouts.date, cutoff), notExcluded());

  const allWorkouts = await db
    .select({
      date: workouts.date,
      distanceMiles: workouts.distanceMiles,
      durationMinutes: workouts.durationMinutes,
      trimp: workouts.trimp,
    })
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  const weeklyMap = new Map<string, WeeklyVolumeEntry>();

  for (const w of allWorkouts) {
    const date = parseLocalDate(w.date);
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekStart = toLocalDateString(monday);

    const existing = weeklyMap.get(weekStart) || { weekStart, miles: 0, minutes: 0, trimp: 0 };
    existing.miles += w.distanceMiles || 0;
    existing.minutes += w.durationMinutes || 0;
    existing.trimp += w.trimp || 0;
    weeklyMap.set(weekStart, existing);
  }

  return Array.from(weeklyMap.values())
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Training focus (workout type distribution) for a configurable time range.
 * Uses segment-level classification for accurate effort distribution.
 */
export async function getTrainingFocusData(
  days: number,
  profileId?: number
): Promise<{ distribution: WorkoutTypeDistribution[]; totalMiles: number; totalMinutes: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = toLocalDateString(cutoffDate);

  const whereConditions = profileId
    ? and(gte(workouts.date, cutoff), eq(workouts.profileId, profileId), notExcluded())
    : and(gte(workouts.date, cutoff), notExcluded());

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  const totalMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalMinutes = recentWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  // Fetch segments for classification
  const workoutIds = recentWorkouts.map(w => w.id);
  const allSegments = workoutIds.length > 0
    ? await db.query.workoutSegments.findMany({
        where: inArray(workoutSegments.workoutId, workoutIds),
      })
    : [];

  const segmentsByWorkout = new Map<number, typeof allSegments>();
  for (const seg of allSegments) {
    if (!segmentsByWorkout.has(seg.workoutId)) {
      segmentsByWorkout.set(seg.workoutId, []);
    }
    segmentsByWorkout.get(seg.workoutId)!.push(seg);
  }

  // Fetch user settings for zone classification
  const settingsWhere = profileId ? eq(userSettings.profileId, profileId) : undefined;
  const [settings] = settingsWhere
    ? await db.select().from(userSettings).where(settingsWhere).limit(1)
    : await db.select().from(userSettings).limit(1);

  const classifyOptions = {
    vdot: settings?.vdot ?? undefined,
    easyPace: settings?.easyPaceSeconds ?? undefined,
    marathonPace: settings?.marathonPaceSeconds ?? undefined,
    tempoPace: settings?.tempoPaceSeconds ?? undefined,
    thresholdPace: settings?.thresholdPaceSeconds ?? undefined,
  };

  const typeMap = new Map<string, { count: number; miles: number; minutes: number }>();

  for (const workout of recentWorkouts) {
    const segs = segmentsByWorkout.get(workout.id);

    if (segs && segs.length >= 2) {
      const sorted = [...segs].sort((a, b) => a.segmentNumber - b.segmentNumber);
      const laps = sorted.map(seg => ({
        lapNumber: seg.segmentNumber,
        distanceMiles: seg.distanceMiles || 1,
        durationSeconds: seg.durationSeconds || ((seg.paceSecondsPerMile || 480) * (seg.distanceMiles || 1)),
        avgPaceSeconds: seg.paceSecondsPerMile || 480,
        avgHeartRate: seg.avgHr,
        maxHeartRate: seg.maxHr,
        elevationGainFeet: seg.elevationGainFt,
        lapType: seg.segmentType || 'steady',
      }));

      const classified = classifySplitEfforts(laps, {
        workoutType: workout.workoutType || 'easy',
        avgPaceSeconds: workout.avgPaceSeconds,
        conditionAdjustment: computeConditionAdjustment(workout),
        ...classifyOptions,
      });

      for (let i = 0; i < classified.length; i++) {
        const cat = classified[i].category;
        const type = (cat === 'warmup' || cat === 'cooldown') ? 'easy'
          : cat === 'anomaly' ? 'other'
          : cat;
        const segMiles = sorted[i].distanceMiles || 1;
        const segMinutes = (sorted[i].durationSeconds || 0) / 60;
        const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
        existing.count += 1;
        existing.miles += segMiles;
        existing.minutes += segMinutes;
        typeMap.set(type, existing);
      }
    } else {
      const type = workout.workoutType || 'other';
      const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
      existing.count += 1;
      existing.miles += workout.distanceMiles || 0;
      existing.minutes += workout.durationMinutes || 0;
      typeMap.set(type, existing);
    }
  }

  const distribution = Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      miles: Math.round(data.miles * 10) / 10,
      minutes: Math.round(data.minutes),
    }))
    .sort((a, b) => {
      const order: Record<string, number> = {
        recovery: 0, easy: 1, long: 2, steady: 3, marathon: 4,
        tempo: 5, threshold: 6, interval: 7, repetition: 8,
        race: 9, cross_train: 10, other: 11,
      };
      return (order[a.type] ?? 99) - (order[b.type] ?? 99);
    });

  return {
    distribution,
    totalMiles: Math.round(totalMiles),
    totalMinutes: Math.round(totalMinutes),
  };
}
