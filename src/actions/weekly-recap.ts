'use server';

import { db, workouts } from '@/lib/db';
import { desc, gte, lte, eq, and } from 'drizzle-orm';
import { toLocalDateString } from '@/lib/utils';
import { createProfileAction } from '@/lib/action-utils';
import { getFitnessTrendData } from './fitness';
import type { Workout } from '@/lib/schema';

// --- Types ---

export interface WeeklyRecapData {
  weekLabel: string; // e.g. "Feb 17-23"
  weekStartDate: string; // ISO date
  weekEndDate: string; // ISO date
  totalMiles: number;
  totalRuns: number;
  totalDurationMinutes: number;
  avgPaceSeconds: number | null;
  keyWorkout: KeyWorkoutHighlight | null;
  fitnessTrend: 'up' | 'down' | 'stable';
  ctlStart: number | null;
  ctlEnd: number | null;
  ctlChange: number | null;
}

export interface KeyWorkoutHighlight {
  id: number;
  workoutType: string;
  distanceMiles: number | null;
  durationMinutes: number | null;
  avgPaceSeconds: number | null;
  stravaName: string | null;
  date: string;
  trimp: number | null;
}

// --- Helpers ---

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // getDay: 0=Sun, 1=Mon, ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getSunday(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

function formatWeekLabel(monday: Date, sunday: Date): string {
  const monMonth = monday.toLocaleDateString('en-US', { month: 'short' });
  const sunMonth = sunday.toLocaleDateString('en-US', { month: 'short' });
  const monDay = monday.getDate();
  const sunDay = sunday.getDate();

  if (monMonth === sunMonth) {
    return `${monMonth} ${monDay}-${sunDay}`;
  }
  return `${monMonth} ${monDay} - ${sunMonth} ${sunDay}`;
}

// --- Main Action ---

export const getWeeklyRecap = createProfileAction(
  async (profileId: number): Promise<WeeklyRecapData | null> => {
    const now = new Date();
    const monday = getMonday(now);
    const sunday = getSunday(monday);

    const mondayStr = toLocalDateString(monday);
    const sundayStr = toLocalDateString(sunday);

    // Fetch all workouts for the current week
    const weekWorkouts: Workout[] = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, mondayStr),
          lte(workouts.date, sundayStr)
        )
      )
      .orderBy(desc(workouts.date));

    if (weekWorkouts.length === 0) {
      return null;
    }

    // Aggregate stats
    const totalMiles = weekWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
    const totalRuns = weekWorkouts.length;
    const totalDurationMinutes = weekWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

    const withPace = weekWorkouts.filter(w => w.avgPaceSeconds && w.avgPaceSeconds > 0 && w.avgPaceSeconds < 1800);
    const avgPaceSeconds = withPace.length > 0
      ? Math.round(withPace.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / withPace.length)
      : null;

    // Identify key workout: highest TRIMP, or longest run, or fastest pace
    let keyWorkout: KeyWorkoutHighlight | null = null;
    if (weekWorkouts.length > 0) {
      // Sort by: trimp desc, then distance desc, then pace asc (fastest)
      const sorted = [...weekWorkouts].sort((a, b) => {
        const trimpA = a.intervalAdjustedTrimp || a.trimp || 0;
        const trimpB = b.intervalAdjustedTrimp || b.trimp || 0;
        if (trimpB !== trimpA) return trimpB - trimpA;

        const distA = a.distanceMiles || 0;
        const distB = b.distanceMiles || 0;
        if (distB !== distA) return distB - distA;

        const paceA = a.avgPaceSeconds || 9999;
        const paceB = b.avgPaceSeconds || 9999;
        return paceA - paceB;
      });

      const top = sorted[0];
      keyWorkout = {
        id: top.id,
        workoutType: top.workoutType,
        distanceMiles: top.distanceMiles,
        durationMinutes: top.durationMinutes,
        avgPaceSeconds: top.avgPaceSeconds,
        stravaName: top.stravaName,
        date: top.date,
        trimp: top.intervalAdjustedTrimp || top.trimp,
      };
    }

    // Fitness trend: CTL change over the week
    let fitnessTrend: 'up' | 'down' | 'stable' = 'stable';
    let ctlStart: number | null = null;
    let ctlEnd: number | null = null;
    let ctlChange: number | null = null;

    try {
      // Get fitness data as of monday (start of week) and now (end)
      const fitnessNow = await getFitnessTrendData(14, profileId);
      const fitnessWeekStart = await getFitnessTrendData(14, profileId, monday);

      if (fitnessNow.metrics.length > 0 && fitnessWeekStart.metrics.length > 0) {
        ctlEnd = Math.round(fitnessNow.currentCtl * 10) / 10;
        ctlStart = Math.round(fitnessWeekStart.currentCtl * 10) / 10;
        ctlChange = Math.round((ctlEnd - ctlStart) * 10) / 10;

        if (ctlChange > 1) {
          fitnessTrend = 'up';
        } else if (ctlChange < -1) {
          fitnessTrend = 'down';
        } else {
          fitnessTrend = 'stable';
        }
      }
    } catch {
      // Fitness data might not be available
    }

    return {
      weekLabel: formatWeekLabel(monday, sunday),
      weekStartDate: mondayStr,
      weekEndDate: sundayStr,
      totalMiles,
      totalRuns,
      totalDurationMinutes,
      avgPaceSeconds,
      keyWorkout,
      fitnessTrend,
      ctlStart,
      ctlEnd,
      ctlChange,
    };
  },
  'getWeeklyRecap'
);
