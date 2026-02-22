'use server';

import { db, workouts, assessments, Workout } from '@/lib/db';
import { desc, gte, eq, inArray, and } from 'drizzle-orm';
import { parseLocalDate, toLocalDateString } from '@/lib/utils';
import { getActiveProfileId } from '@/lib/profile-server';
import { notExcluded } from './analytics-core';
import type { WeeklyStats } from './analytics-core';

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
