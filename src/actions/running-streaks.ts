'use server';

import { db, workouts, Workout } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { toLocalDateString, parseLocalDate } from '@/lib/utils';
import { createProfileAction } from '@/lib/action-utils';

// ==================== Types ====================

export interface StreakData {
  /** Consecutive days with at least one run, counting back from today */
  currentStreak: number;
  /** All-time longest consecutive running days */
  longestStreak: number;
  /** Whether the current streak is live (ran today or yesterday) */
  streakStatus: 'active' | 'broken' | 'no_data';
  /** % of weeks in the last 3 months that had 3+ runs */
  weeklyConsistency: number;
  /** Runs per month for the last 12 months */
  monthlyConsistency: MonthlyConsistencyEntry[];
  /** Runs so far this week vs typical week average */
  currentWeekStatus: {
    runsThisWeek: number;
    typicalRunsPerWeek: number;
  };
  /** Day-level heatmap for the last 12 weeks (84 days) */
  heatmap: HeatmapDay[];
}

export interface MonthlyConsistencyEntry {
  /** YYYY-MM */
  month: string;
  /** Human-friendly label, e.g. "Jan 2026" */
  label: string;
  runCount: number;
}

export interface HeatmapDay {
  /** YYYY-MM-DD */
  date: string;
  /** True if at least one run logged */
  hasRun: boolean;
  /** 0 = Monday, 6 = Sunday */
  dayOfWeek: number;
  /** Week index, 0 = oldest week in the 12-week window */
  weekIndex: number;
}

// ==================== Implementation ====================

async function _getStreakData(profileId: number): Promise<StreakData> {
  const allWorkouts: Pick<Workout, 'date'>[] = await db
    .select({ date: workouts.date })
    .from(workouts)
    .where(eq(workouts.profileId, profileId))
    .orderBy(desc(workouts.date));

  if (allWorkouts.length === 0) {
    return emptyStreakData();
  }

  // Unique sorted dates (descending)
  const workoutDatesSet = new Set(allWorkouts.map(w => w.date));
  const datesDesc = Array.from(workoutDatesSet).sort((a, b) => b.localeCompare(a));
  const datesAsc = [...datesDesc].reverse();

  const today = toLocalDateString(new Date());
  const yesterday = toLocalDateString(new Date(Date.now() - 86400000));

  // ---- Current streak ----
  let currentStreak = 0;
  const streakActive = datesDesc[0] === today || datesDesc[0] === yesterday;

  if (streakActive) {
    const checkDate = parseLocalDate(datesDesc[0]);
    for (const date of datesDesc) {
      const checkStr = toLocalDateString(checkDate);
      if (date === checkStr) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (date < checkStr) {
        break;
      }
    }
  }

  // ---- Longest streak ----
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < datesAsc.length; i++) {
    const prevDate = parseLocalDate(datesAsc[i - 1]);
    const currDate = parseLocalDate(datesAsc[i]);
    const diffDays = Math.round(
      (currDate.getTime() - prevDate.getTime()) / 86400000
    );

    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // ---- Weekly consistency (last 3 months, weeks with 3+ runs) ----
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsCutoff = toLocalDateString(threeMonthsAgo);

  // Build week buckets for last 3 months
  const weekRunCounts = new Map<string, number>();
  for (const dateStr of datesAsc) {
    if (dateStr < threeMonthsCutoff) continue;
    const date = parseLocalDate(dateStr);
    const mondayStr = getMondayStr(date);
    weekRunCounts.set(mondayStr, (weekRunCounts.get(mondayStr) || 0) + 1);
  }

  // Count total weeks in the 3-month window (not just weeks with runs)
  const totalWeeksIn3Months = countWeeksBetween(threeMonthsCutoff, today);
  const weeksWithThreePlus = Array.from(weekRunCounts.values()).filter(c => c >= 3).length;
  const weeklyConsistency = totalWeeksIn3Months > 0
    ? Math.round((weeksWithThreePlus / totalWeeksIn3Months) * 100)
    : 0;

  // ---- Monthly consistency (last 12 months) ----
  const monthlyConsistency: MonthlyConsistencyEntry[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Count unique run days in this month
    let runCount = 0;
    for (const dateStr of datesAsc) {
      const parsed = parseLocalDate(dateStr);
      if (parsed.getFullYear() === year && parsed.getMonth() === month) {
        runCount++;
      }
    }

    monthlyConsistency.push({ month: monthKey, label, runCount });
  }

  // ---- Current week status ----
  const todayDate = parseLocalDate(today);
  const currentMonday = getMondayStr(todayDate);
  const runsThisWeek = weekRunCounts.get(currentMonday) || 0;

  // Typical runs per week = average over last 3 months (excluding current incomplete week)
  const completedWeekCounts = Array.from(weekRunCounts.entries())
    .filter(([monday]) => monday !== currentMonday)
    .map(([, count]) => count);
  const typicalRunsPerWeek = completedWeekCounts.length > 0
    ? Math.round(
        (completedWeekCounts.reduce((sum, c) => sum + c, 0) / completedWeekCounts.length) * 10
      ) / 10
    : 0;

  // ---- 12-week heatmap ----
  const heatmap = build12WeekHeatmap(workoutDatesSet);

  return {
    currentStreak,
    longestStreak,
    streakStatus: streakActive ? 'active' : 'broken',
    weeklyConsistency,
    monthlyConsistency,
    currentWeekStatus: {
      runsThisWeek,
      typicalRunsPerWeek,
    },
    heatmap,
  };
}

// ==================== Helpers ====================

function emptyStreakData(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    streakStatus: 'no_data',
    weeklyConsistency: 0,
    monthlyConsistency: [],
    currentWeekStatus: { runsThisWeek: 0, typicalRunsPerWeek: 0 },
    heatmap: build12WeekHeatmap(new Set()),
  };
}

/** Get YYYY-MM-DD string for the Monday of the given date's week */
function getMondayStr(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDateString(d);
}

/** Count number of ISO weeks between two YYYY-MM-DD strings (inclusive of partial weeks) */
function countWeeksBetween(startStr: string, endStr: string): number {
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);

  // Snap to Mondays
  const startMonday = new Date(start);
  const startDay = startMonday.getDay();
  startMonday.setDate(startMonday.getDate() - (startDay === 0 ? 6 : startDay - 1));

  const endMonday = new Date(end);
  const endDay = endMonday.getDay();
  endMonday.setDate(endMonday.getDate() - (endDay === 0 ? 6 : endDay - 1));

  const diffMs = endMonday.getTime() - startMonday.getTime();
  return Math.floor(diffMs / (7 * 86400000)) + 1;
}

/** Build a 12-week (84 day) heatmap ending on today */
function build12WeekHeatmap(runDates: Set<string>): HeatmapDay[] {
  const today = parseLocalDate(toLocalDateString(new Date()));
  const todayDay = today.getDay();
  // End of current week = next Sunday
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (todayDay === 0 ? 0 : 7 - todayDay));

  // Start = 12 weeks before end of this week, on Monday
  const startDate = new Date(endOfWeek);
  startDate.setDate(endOfWeek.getDate() - 12 * 7 + 1);

  const heatmap: HeatmapDay[] = [];
  const cursor = new Date(startDate);

  for (let weekIdx = 0; weekIdx < 12; weekIdx++) {
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dateStr = toLocalDateString(cursor);
      // dayOfWeek: 0 = Monday ... 6 = Sunday
      const jsDay = cursor.getDay();
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

      heatmap.push({
        date: dateStr,
        hasRun: runDates.has(dateStr),
        dayOfWeek,
        weekIndex: weekIdx,
      });

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return heatmap;
}

// ==================== Public API ====================

export const getStreakData = createProfileAction(_getStreakData, 'getStreakData');
