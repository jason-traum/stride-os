'use server';

import { db, workouts, assessments, Workout } from '@/lib/db';
import { desc, gte, eq, inArray } from 'drizzle-orm';

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
  }>;
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  // Get all workouts from the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(gte(workouts.date, cutoffDate))
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
    const date = new Date(workout.date);
    // Get Monday of the week
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekStart = monday.toISOString().split('T')[0];

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

  // Calculate workout type distribution (including minutes for Training Focus)
  const typeMap = new Map<string, { count: number; miles: number; minutes: number }>();

  for (const workout of recentWorkouts) {
    const type = workout.workoutType || 'other';
    const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
    existing.count += 1;
    existing.miles += workout.distanceMiles || 0;
    existing.minutes += workout.durationMinutes || 0;
    typeMap.set(type, existing);
  }

  const workoutTypeDistribution = Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      miles: Math.round(data.miles * 10) / 10,
      minutes: Math.round(data.minutes),
    }))
    .sort((a, b) => b.count - a.count);

  // Get recent paces for trend chart
  const recentPaces = recentWorkouts
    .filter(w => w.avgPaceSeconds)
    .slice(0, 20)
    .map(w => ({
      date: w.date,
      paceSeconds: w.avgPaceSeconds!,
      workoutType: w.workoutType || 'other',
    }))
    .reverse();

  return {
    totalWorkouts,
    totalMiles: Math.round(totalMiles * 10) / 10,
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
export async function getWeeklyStats(): Promise<WeeklyStats> {
  const now = new Date();
  // Get Monday of current week
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const weekStart = monday.toISOString().split('T')[0];

  // Get last week's Monday for comparison
  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastWeekStart = lastMonday.toISOString().split('T')[0];

  // Get this week's workouts
  const weekWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(gte(workouts.date, weekStart))
    .orderBy(desc(workouts.date));

  // Get last week's workouts for comparison
  const lastWeekWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(gte(workouts.date, lastWeekStart))
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
export async function getRunningStreak() {
  const allWorkouts: Workout[] = await db
    .select()
    .from(workouts)
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

  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Check if streak is active (ran today or yesterday)
  if (sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr) {
    currentStreak = 1;
    const checkDate = new Date(sortedDates[0]);

    for (let i = 1; i < sortedDates.length; i++) {
      checkDate.setDate(checkDate.getDate() - 1);
      const checkStr = checkDate.toISOString().split('T')[0];

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
export async function getVolumeSummaryData(): Promise<{
  thisWeekMiles: number;
  lastWeekMiles: number;
  thisMonthMiles: number;
  lastMonthMiles: number;
  ytdMiles: number;
}> {
  const now = new Date();

  // This week (Monday to today)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + mondayOffset);
  const thisMondayStr = thisMonday.toISOString().split('T')[0];

  // Last week
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastMondayStr = lastMonday.toISOString().split('T')[0];

  // This month
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthStartStr = thisMonthStart.toISOString().split('T')[0];

  // Last month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStartStr = lastMonthStart.toISOString().split('T')[0];

  // YTD
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const ytdStartStr = ytdStart.toISOString().split('T')[0];

  // Get all workouts from YTD start
  const allWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(gte(workouts.date, ytdStartStr))
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
}

/**
 * Get daily activity data for heatmap
 */
export async function getDailyActivityData(months: number = 12): Promise<DailyActivityData[]> {
  // Get workouts from the last N months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const cutoffDate = startDate.toISOString().split('T')[0];

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(gte(workouts.date, cutoffDate))
    .orderBy(desc(workouts.date));

  // Group by date, aggregating workout data
  // For days with multiple workouts, we'll sum miles/duration and average pace/HR
  const dailyMap = new Map<string, {
    miles: number;
    durationMinutes: number;
    totalPaceWeighted: number;
    totalHrWeighted: number;
    workoutTypes: string[];
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
      workoutTypes: [],
      count: 0,
    };

    existing.miles += miles;
    existing.durationMinutes += duration;
    if (workout.avgPaceSeconds && miles > 0) {
      existing.totalPaceWeighted += workout.avgPaceSeconds * miles;
    }
    if (workout.avgHr && miles > 0) {
      existing.totalHrWeighted += workout.avgHr * miles;
    }
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
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Daily data for current week circles view
 */
export interface DailyWorkoutData {
  date: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  dayLabel: string; // "Mon", "Tue", etc.
  hasWorkout: boolean;
  miles: number;
  workoutType: string | null;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Get current week's daily workout data for circles visualization
 */
export async function getCurrentWeekDays(): Promise<DailyWorkoutData[]> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Get Monday of current week
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  // Generate all 7 days of the week (Mon-Sun)
  const days: DailyWorkoutData[] = [];
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    days.push({
      date: dateStr,
      dayOfWeek: (i + 1) % 7, // Adjusted to match JS getDay() where 0=Sunday
      dayLabel: dayLabels[i],
      hasWorkout: false,
      miles: 0,
      workoutType: null,
      isToday: dateStr === today,
      isFuture: dateStr > today,
    });
  }

  // Get this week's workouts
  const weekStart = monday.toISOString().split('T')[0];
  const weekWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(gte(workouts.date, weekStart))
    .orderBy(desc(workouts.date));

  // Map workouts to days
  for (const workout of weekWorkouts) {
    const day = days.find(d => d.date === workout.date);
    if (day) {
      day.hasWorkout = true;
      day.miles += workout.distanceMiles || 0;
      // Keep the first workout type (could have multiple workouts per day)
      if (!day.workoutType) {
        day.workoutType = workout.workoutType;
      }
    }
  }

  // Round miles
  for (const day of days) {
    day.miles = Math.round(day.miles * 10) / 10;
  }

  return days;
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
export async function getCalendarData(): Promise<CalendarWorkoutDay[]> {
  // Get workouts from the last 12 months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);
  const cutoffDate = startDate.toISOString().split('T')[0];

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(gte(workouts.date, cutoffDate))
    .orderBy(desc(workouts.date));

  return recentWorkouts.map(w => ({
    date: w.date,
    miles: Math.round((w.distanceMiles || 0) * 10) / 10,
    workoutType: w.workoutType || 'other',
    workoutId: w.id,
  }));
}
