'use server';

import { db, workouts, Workout } from '@/lib/db';
import { desc, gte } from 'drizzle-orm';

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

  // Calculate workout type distribution
  const typeMap = new Map<string, { count: number; miles: number }>();

  for (const workout of recentWorkouts) {
    const type = workout.workoutType || 'other';
    const existing = typeMap.get(type) || { count: 0, miles: 0 };
    existing.count += 1;
    existing.miles += workout.distanceMiles || 0;
    typeMap.set(type, existing);
  }

  const workoutTypeDistribution = Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      miles: Math.round(data.miles * 10) / 10,
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

  return {
    weekStart,
    totalMiles: Math.round(totalMiles * 10) / 10,
    totalMinutes: Math.round(totalMinutes),
    workoutCount,
    runCount: workoutCount,
    avgPace,
    avgRpe: null, // TODO: Calculate from assessments if needed
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
