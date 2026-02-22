'use server';

import { db, workouts, type Workout } from '@/lib/db';
import { desc, gte, lte, eq, and, or, isNull } from 'drizzle-orm';
import { parseLocalDate, toLocalDateString } from '@/lib/utils';
import { getFitnessTrendData } from '@/actions/fitness';
import { getVdotHistory } from '@/actions/vdot-history';
import { getPersonalRecords } from '@/actions/personal-records';
import { createProfileAction } from '@/lib/action-utils';

// Shared condition: exclude workouts flagged for exclusion
function notExcluded() {
  return and(
    or(eq(workouts.excludeFromEstimates, false), isNull(workouts.excludeFromEstimates)),
    or(eq(workouts.autoExcluded, false), isNull(workouts.autoExcluded))
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkoutTypeBreakdown {
  type: string;
  count: number;
  miles: number;
  minutes: number;
  percentage: number; // percentage of total miles
}

export interface KeyWorkout {
  id: number;
  date: string;
  type: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPaceSeconds: number | null;
  label: string; // "Fastest", "Longest", "Hardest"
}

export interface WeeklyProgression {
  weekStart: string;
  weekLabel: string;
  miles: number;
  runs: number;
  minutes: number;
}

export interface FitnessTrend {
  startCtl: number;
  endCtl: number;
  startAtl: number;
  endAtl: number;
  startTsb: number;
  endTsb: number;
  ctlChange: number;
}

export interface VdotTrend {
  startVdot: number | null;
  endVdot: number | null;
  change: number | null;
}

export interface PrAchieved {
  distanceLabel: string;
  timeSeconds: number;
  date: string;
}

export interface ConsistencyMetrics {
  totalDaysInPeriod: number;
  daysRun: number;
  runPercentage: number;
  currentStreak: number;
  longestStreakInPeriod: number;
}

export interface DailyMileage {
  date: string;
  dayLabel: string;
  miles: number;
  runs: number;
}

export interface TrainingReportData {
  period: 'week' | 'month';
  periodLabel: string;
  startDate: string;
  endDate: string;
  generatedAt: string;

  // Summary
  totalMiles: number;
  totalRuns: number;
  totalMinutes: number;
  avgPaceSeconds: number | null;
  avgMilesPerRun: number | null;

  // Workout type breakdown
  workoutBreakdown: WorkoutTypeBreakdown[];

  // Daily mileage (for weekly reports)
  dailyMileage: DailyMileage[];

  // Weekly progression (for monthly reports)
  weeklyProgression: WeeklyProgression[];

  // Key workouts
  keyWorkouts: KeyWorkout[];

  // Fitness trend
  fitness: FitnessTrend | null;

  // VDOT trend
  vdot: VdotTrend;

  // PRs achieved
  prsAchieved: PrAchieved[];

  // Consistency
  consistency: ConsistencyMetrics;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekBounds(dateStr?: string): { start: string; end: string; label: string } {
  const ref = dateStr ? parseLocalDate(dateStr) : new Date();
  const dayOfWeek = ref.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const start = toLocalDateString(monday);
  const end = toLocalDateString(sunday);
  const label = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return { start, end, label };
}

function getMonthBounds(dateStr?: string): { start: string; end: string; label: string } {
  const ref = dateStr ? parseLocalDate(dateStr) : new Date();
  const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);

  const start = toLocalDateString(firstDay);
  const end = toLocalDateString(lastDay);
  const label = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return { start, end, label };
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + mondayOffset);
  return toLocalDateString(d);
}

function formatWeekLabel(mondayStr: string): string {
  const monday = parseLocalDate(mondayStr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function daysBetween(start: string, end: string): number {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// ─── Main Action ─────────────────────────────────────────────────────────────

export const getTrainingReportData = createProfileAction(
  async (profileId: number, period: 'week' | 'month', dateStr?: string): Promise<TrainingReportData> => {

  // Determine date bounds
  const bounds = period === 'week'
    ? getWeekBounds(dateStr)
    : getMonthBounds(dateStr);

  const { start, end, label } = bounds;

  // Fetch workouts in the period
  const conditions = [
    gte(workouts.date, start),
    lte(workouts.date, end),
    notExcluded(),
  ];
  if (profileId) conditions.push(eq(workouts.profileId, profileId));

  const periodWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(and(...conditions))
    .orderBy(desc(workouts.date));

  // ── Summary stats ──────────────────────────────────────────────────────
  const totalRuns = periodWorkouts.length;
  const totalMiles = periodWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalMinutes = periodWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  const workoutsWithPace = periodWorkouts.filter(w => w.avgPaceSeconds && w.avgPaceSeconds > 0);
  const avgPaceSeconds = workoutsWithPace.length > 0
    ? Math.round(workoutsWithPace.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / workoutsWithPace.length)
    : null;

  const avgMilesPerRun = totalRuns > 0
    ? Math.round((totalMiles / totalRuns) * 10) / 10
    : null;

  // ── Workout type breakdown ─────────────────────────────────────────────
  const typeMap = new Map<string, { count: number; miles: number; minutes: number }>();
  for (const w of periodWorkouts) {
    const type = w.workoutType || 'other';
    const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
    existing.count += 1;
    existing.miles += w.distanceMiles || 0;
    existing.minutes += w.durationMinutes || 0;
    typeMap.set(type, existing);
  }

  const typeOrder: Record<string, number> = {
    recovery: 0, easy: 1, long: 2, steady: 3, marathon: 4,
    tempo: 5, threshold: 6, interval: 7, repetition: 8,
    race: 9, cross_train: 10, other: 11,
  };

  const workoutBreakdown: WorkoutTypeBreakdown[] = Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      miles: Math.round(data.miles * 10) / 10,
      minutes: Math.round(data.minutes),
      percentage: totalMiles > 0 ? Math.round((data.miles / totalMiles) * 1000) / 10 : 0,
    }))
    .sort((a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99));

  // ── Weekly progression (for monthly reports) ───────────────────────────
  const weeklyProgression: WeeklyProgression[] = [];
  if (period === 'month') {
    const weekMap = new Map<string, { miles: number; runs: number; minutes: number }>();
    for (const w of periodWorkouts) {
      const weekStart = getMondayOfWeek(parseLocalDate(w.date));
      const existing = weekMap.get(weekStart) || { miles: 0, runs: 0, minutes: 0 };
      existing.miles += w.distanceMiles || 0;
      existing.runs += 1;
      existing.minutes += w.durationMinutes || 0;
      weekMap.set(weekStart, existing);
    }

    const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [weekStart, data] of sortedWeeks) {
      weeklyProgression.push({
        weekStart,
        weekLabel: formatWeekLabel(weekStart),
        miles: Math.round(data.miles * 10) / 10,
        runs: data.runs,
        minutes: Math.round(data.minutes),
      });
    }
  }

  // ── Daily mileage (for weekly reports) ──────────────────────────────────
  const dailyMileage: DailyMileage[] = [];
  if (period === 'week') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cursor = parseLocalDate(start);
    const endParsed = parseLocalDate(end);
    while (cursor <= endParsed) {
      const dateStr2 = toLocalDateString(cursor);
      const dayWorkouts = periodWorkouts.filter(w => w.date === dateStr2);
      dailyMileage.push({
        date: dateStr2,
        dayLabel: dayNames[cursor.getDay()],
        miles: Math.round(dayWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) * 10) / 10,
        runs: dayWorkouts.length,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // ── Key workouts ───────────────────────────────────────────────────────
  const keyWorkouts: KeyWorkout[] = [];
  const validWorkouts = periodWorkouts.filter(w => (w.distanceMiles || 0) > 0);

  if (validWorkouts.length > 0) {
    // Fastest (best avg pace)
    const withPace = validWorkouts.filter(w => w.avgPaceSeconds && w.avgPaceSeconds > 0);
    if (withPace.length > 0) {
      const fastest = withPace.reduce((a, b) => (a.avgPaceSeconds! < b.avgPaceSeconds! ? a : b));
      keyWorkouts.push({
        id: fastest.id,
        date: fastest.date,
        type: fastest.workoutType || 'other',
        distanceMiles: Math.round((fastest.distanceMiles || 0) * 10) / 10,
        durationMinutes: fastest.durationMinutes || 0,
        avgPaceSeconds: fastest.avgPaceSeconds,
        label: 'Fastest',
      });
    }

    // Longest
    const longest = validWorkouts.reduce((a, b) =>
      (a.distanceMiles || 0) > (b.distanceMiles || 0) ? a : b
    );
    // Avoid duplicate if fastest is same as longest
    if (!keyWorkouts.find(k => k.id === longest.id)) {
      keyWorkouts.push({
        id: longest.id,
        date: longest.date,
        type: longest.workoutType || 'other',
        distanceMiles: Math.round((longest.distanceMiles || 0) * 10) / 10,
        durationMinutes: longest.durationMinutes || 0,
        avgPaceSeconds: longest.avgPaceSeconds || null,
        label: 'Longest',
      });
    }

    // Hardest (highest TRIMP or interval-adjusted TRIMP)
    const withLoad = validWorkouts.filter(w => (w.intervalAdjustedTrimp || w.trimp || 0) > 0);
    if (withLoad.length > 0) {
      const hardest = withLoad.reduce((a, b) => {
        const loadA = a.intervalAdjustedTrimp || a.trimp || 0;
        const loadB = b.intervalAdjustedTrimp || b.trimp || 0;
        return loadA > loadB ? a : b;
      });
      if (!keyWorkouts.find(k => k.id === hardest.id)) {
        keyWorkouts.push({
          id: hardest.id,
          date: hardest.date,
          type: hardest.workoutType || 'other',
          distanceMiles: Math.round((hardest.distanceMiles || 0) * 10) / 10,
          durationMinutes: hardest.durationMinutes || 0,
          avgPaceSeconds: hardest.avgPaceSeconds || null,
          label: 'Hardest',
        });
      }
    }
  }

  // ── Fitness trend (CTL/ATL/TSB) ────────────────────────────────────────
  let fitness: FitnessTrend | null = null;
  try {
    const endDate = parseLocalDate(end);
    const startDate = parseLocalDate(start);
    const daysInPeriod = daysBetween(start, end);

    // Get fitness data as of start and end of period
    const endFitness = await getFitnessTrendData(daysInPeriod + 42, profileId, endDate);
    const startFitness = await getFitnessTrendData(42, profileId, startDate);

    if (endFitness.hasData) {
      fitness = {
        startCtl: Math.round(startFitness.currentCtl * 10) / 10,
        endCtl: Math.round(endFitness.currentCtl * 10) / 10,
        startAtl: Math.round(startFitness.currentAtl * 10) / 10,
        endAtl: Math.round(endFitness.currentAtl * 10) / 10,
        startTsb: Math.round(startFitness.currentTsb * 10) / 10,
        endTsb: Math.round(endFitness.currentTsb * 10) / 10,
        ctlChange: Math.round((endFitness.currentCtl - startFitness.currentCtl) * 10) / 10,
      };
    }
  } catch {
    // Fitness data not available
  }

  // ── VDOT trend ─────────────────────────────────────────────────────────
  let vdot: VdotTrend = { startVdot: null, endVdot: null, change: null };
  try {
    const vdotEntries = await getVdotHistory({
      startDate: start,
      endDate: end,
      profileId,
    });

    if (vdotEntries.length > 0) {
      const sorted = [...vdotEntries].sort((a, b) => a.date.localeCompare(b.date));
      const startVdot = sorted[0].vdot;
      const endVdot = sorted[sorted.length - 1].vdot;
      vdot = {
        startVdot,
        endVdot,
        change: Math.round((endVdot - startVdot) * 10) / 10,
      };
    }
  } catch {
    // VDOT data not available
  }

  // ── PRs achieved ───────────────────────────────────────────────────────
  const prsAchieved: PrAchieved[] = [];
  try {
    const prResult = await getPersonalRecords();
    if (prResult.success) {
      for (const record of prResult.data.records) {
        if (record.prDate >= start && record.prDate <= end) {
          prsAchieved.push({
            distanceLabel: record.distanceLabel,
            timeSeconds: record.prTimeSeconds,
            date: record.prDate,
          });
        }
      }
    }
  } catch {
    // PR data not available
  }

  // ── Consistency metrics ────────────────────────────────────────────────
  const totalDaysInPeriod = daysBetween(start, end);
  const uniqueDates = new Set(periodWorkouts.map(w => w.date));
  const daysRun = uniqueDates.size;

  // Calculate streak within period
  const sortedDates = Array.from(uniqueDates).sort();
  let longestStreakInPeriod = 0;
  let currentStreak = 0;
  let tempStreak = 1;

  if (sortedDates.length > 0) {
    longestStreakInPeriod = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = parseLocalDate(sortedDates[i - 1]);
      const curr = parseLocalDate(sortedDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreakInPeriod = Math.max(longestStreakInPeriod, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreakInPeriod = Math.max(longestStreakInPeriod, tempStreak);

    // Current streak: count backwards from end of period
    const today = toLocalDateString(new Date());
    const lastRunDate = sortedDates[sortedDates.length - 1];
    if (lastRunDate >= end || lastRunDate >= today) {
      currentStreak = 1;
      for (let i = sortedDates.length - 2; i >= 0; i--) {
        const curr = parseLocalDate(sortedDates[i + 1]);
        const prev = parseLocalDate(sortedDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  const consistency: ConsistencyMetrics = {
    totalDaysInPeriod,
    daysRun,
    runPercentage: totalDaysInPeriod > 0 ? Math.round((daysRun / totalDaysInPeriod) * 100) : 0,
    currentStreak,
    longestStreakInPeriod,
  };

  return {
    period,
    periodLabel: label,
    startDate: start,
    endDate: end,
    generatedAt: new Date().toISOString(),
    totalMiles: Math.round(totalMiles * 10) / 10,
    totalRuns,
    totalMinutes: Math.round(totalMinutes),
    avgPaceSeconds,
    avgMilesPerRun,
    workoutBreakdown,
    dailyMileage,
    weeklyProgression,
    keyWorkouts,
    fitness,
    vdot,
    prsAchieved,
    consistency,
  };
},
  'getTrainingReportData'
);
