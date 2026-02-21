'use server';

import { db } from '@/lib/db';
import { workouts, userSettings } from '@/lib/schema';
import { desc, eq, and, isNotNull, gte } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

// ── Types ──────────────────────────────────────────────────────────────

/** Single data point in the running economy time series */
export interface EconomyDataPoint {
  date: string;
  cardiacCost: number;        // avgHR * avgPaceSeconds — lower = better
  avgPace: number;            // seconds per mile
  avgHR: number;
  normalizedPace: number;     // estimated pace at reference HR (seconds/mi)
  workoutType: string;
  distanceMiles: number;
}

/** Linear regression trend result */
export interface EconomyTrend {
  slope: number;              // change in cardiac cost per day (negative = improving)
  improving: boolean;
  percentChange: number;      // % change over the period
  firstCardiacCost: number;   // trendline value at start
  lastCardiacCost: number;    // trendline value at end
  firstNormalizedPace: number;
  lastNormalizedPace: number;
}

/** Full response from getRunningEconomyData */
export interface RunningEconomyResult {
  dataPoints: EconomyDataPoint[];
  trend: EconomyTrend | null;
  referenceHR: number;        // HR used for normalization
  totalAnalyzed: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Simple linear regression: y = mx + b
 * Returns { slope, intercept, predict }
 */
function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 2) return null;

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    predict: (x: number) => slope * x + intercept,
  };
}

/**
 * Normalize a run's pace to a reference heart rate.
 *
 * Assumption: within easy/steady aerobic zones, the relationship between
 * HR and pace is approximately linear. If you ran pace P at HR H, then
 * at reference HR R you would run:
 *
 *   normalizedPace = avgPaceSeconds * (referenceHR / avgHR)
 *
 * If your HR was higher than reference, your normalized pace will be
 * faster (lower), reflecting that you "could have" run that pace at a
 * lower effort. If HR was lower, normalized pace will be slower.
 */
function normalizePace(avgPaceSeconds: number, avgHR: number, referenceHR: number): number {
  if (avgHR <= 0) return avgPaceSeconds;
  return Math.round(avgPaceSeconds * (referenceHR / avgHR));
}

// Workout types that reflect true aerobic economy (tempo+ confounds the metric)
const ECONOMY_TYPES = new Set(['easy', 'recovery', 'long', 'steady']);

// ── Server Action ──────────────────────────────────────────────────────

/**
 * Get running economy data: cardiac cost and normalized pace over time.
 *
 * Filters to easy/steady/recovery/long runs that have both avgPaceSeconds
 * and avgHR, then calculates cardiac cost (HR * pace) and normalizes
 * all runs to a common reference HR.
 */
export const getRunningEconomyData = createProfileAction(
  async (profileId: number, days: number = 365): Promise<RunningEconomyResult> => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Fetch user settings to determine reference HR
    const settings = await db
      .select({
        easyPaceSeconds: userSettings.easyPaceSeconds,
        restingHr: userSettings.restingHr,
      })
      .from(userSettings)
      .where(eq(userSettings.profileId, profileId))
      .limit(1);

    // Reference HR: use 150bpm as default. If user has resting HR, use
    // a midpoint that's slightly above their easy zone (~65% HRR + restHR).
    // Most easy running happens around 140-160bpm for recreational runners.
    let referenceHR = 150;
    const restHR = settings[0]?.restingHr;
    if (restHR && restHR > 30 && restHR < 100) {
      // Estimate easy zone midpoint: ~65% of HR reserve + resting HR
      // Assume max HR ~ 220 - age, but without age just use 190 as rough max
      // This puts reference around 140-155 for most runners
      referenceHR = Math.round(restHR + 0.65 * (190 - restHR));
    }

    // Query all workouts with both HR and pace data
    const allWorkouts = await db
      .select({
        id: workouts.id,
        date: workouts.date,
        avgPaceSeconds: workouts.avgPaceSeconds,
        avgHr: workouts.avgHr,
        workoutType: workouts.workoutType,
        distanceMiles: workouts.distanceMiles,
      })
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, startDateStr),
          isNotNull(workouts.avgPaceSeconds),
          isNotNull(workouts.avgHr)
        )
      )
      .orderBy(desc(workouts.date));

    // Internal row type for query results
    type WorkoutRow = {
      id: number;
      date: string;
      avgPaceSeconds: number | null;
      avgHr: number | null;
      workoutType: string;
      distanceMiles: number | null;
    };

    // Filter to easy/steady aerobic runs with valid data
    const qualifying = allWorkouts.filter((w: WorkoutRow) => {
      if (!w.avgPaceSeconds || !w.avgHr) return false;
      if (w.avgPaceSeconds <= 0 || w.avgHr <= 0) return false;
      if (!w.distanceMiles || w.distanceMiles < 1) return false;
      if (!ECONOMY_TYPES.has(w.workoutType)) return false;
      // Sanity: skip runs with unrealistic HR or pace
      if (w.avgHr < 80 || w.avgHr > 210) return false;
      if (w.avgPaceSeconds < 240 || w.avgPaceSeconds > 1200) return false; // 4:00-20:00/mi
      return true;
    });

    if (qualifying.length === 0) {
      return {
        dataPoints: [],
        trend: null,
        referenceHR,
        totalAnalyzed: 0,
      };
    }

    // Build data points (reverse to chronological order for charting)
    const dataPoints: EconomyDataPoint[] = qualifying
      .map((w: WorkoutRow) => ({
        date: w.date,
        cardiacCost: w.avgHr! * w.avgPaceSeconds!,
        avgPace: w.avgPaceSeconds!,
        avgHR: w.avgHr!,
        normalizedPace: normalizePace(w.avgPaceSeconds!, w.avgHr!, referenceHR),
        workoutType: w.workoutType,
        distanceMiles: Math.round((w.distanceMiles || 0) * 10) / 10,
      }))
      .reverse(); // chronological order

    // Calculate trend via linear regression on cardiac cost over time
    let trend: EconomyTrend | null = null;
    if (dataPoints.length >= 4) {
      // Use day-index as x (days since first data point)
      const firstDate = new Date(dataPoints[0].date + 'T12:00:00').getTime();
      const xs = dataPoints.map((d) => {
        const t = new Date(d.date + 'T12:00:00').getTime();
        return (t - firstDate) / (1000 * 60 * 60 * 24); // days
      });
      const ys = dataPoints.map((d) => d.cardiacCost);

      const reg = linearRegression(xs, ys);
      if (reg) {
        const firstVal = reg.predict(xs[0]);
        const lastVal = reg.predict(xs[xs.length - 1]);
        const pctChange = firstVal !== 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;

        // Also compute trendline for normalized pace
        const ysNorm = dataPoints.map((d) => d.normalizedPace);
        const regNorm = linearRegression(xs, ysNorm);
        const firstNorm = regNorm ? regNorm.predict(xs[0]) : dataPoints[0].normalizedPace;
        const lastNorm = regNorm ? regNorm.predict(xs[xs.length - 1]) : dataPoints[dataPoints.length - 1].normalizedPace;

        trend = {
          slope: reg.slope,
          improving: reg.slope < 0, // lower cardiac cost = improving
          percentChange: Math.round(pctChange * 10) / 10,
          firstCardiacCost: Math.round(firstVal),
          lastCardiacCost: Math.round(lastVal),
          firstNormalizedPace: Math.round(firstNorm),
          lastNormalizedPace: Math.round(lastNorm),
        };
      }
    }

    return {
      dataPoints,
      trend,
      referenceHR,
      totalAnalyzed: dataPoints.length,
    };
  },
  'getRunningEconomyData'
);
