'use server';

import { createProfileAction } from '@/lib/action-utils';
import { getSettings } from './settings';
import { getIntervalsWellness, type IntervalsWellness } from '@/lib/intervals';
import { decryptToken } from '@/lib/token-crypto';

// ── Types ──────────────────────────────────────────────────────────────

/** Single day of wellness data */
export interface WellnessDataPoint {
  date: string;
  hrv: number | null;
  restingHR: number | null;
  hrvRollingAvg: number | null;
  restingHRRollingAvg: number | null;
  sleepQuality: number | null;
  sleepDuration: number | null;
  weight: number | null;
  mood: number | null;
  stress: number | null;
  fatigue: number | null;
}

/** Trend direction for a metric */
export type TrendDirection = 'improving' | 'declining' | 'stable';

/** Summary stats for wellness trends */
export interface WellnessSummary {
  currentHrv: number | null;
  hrvBaseline: number | null;
  hrvTrendPct: number | null;
  hrvTrend: TrendDirection;
  currentRestingHR: number | null;
  restingHRBaseline: number | null;
  restingHRTrendPct: number | null;
  restingHRTrend: TrendDirection;
  daysWithData: number;
  totalDays: number;
}

/** Full result from getWellnessTrends */
export interface WellnessTrendsResult {
  dataPoints: WellnessDataPoint[];
  summary: WellnessSummary;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Compute 7-day rolling average for a numeric array, respecting nulls */
function computeRollingAverage(
  values: (number | null)[],
  windowSize: number = 7
): (number | null)[] {
  return values.map((_, i) => {
    const windowStart = Math.max(0, i - windowSize + 1);
    const window = values.slice(windowStart, i + 1).filter((v): v is number => v !== null);
    if (window.length < 2) return null;
    return Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) / 10;
  });
}

/** Determine trend direction from a percentage change */
function getTrendDirection(pctChange: number | null, invertBetter: boolean = false): TrendDirection {
  if (pctChange === null) return 'stable';
  const threshold = 3; // Need >3% change to be considered a trend
  if (Math.abs(pctChange) < threshold) return 'stable';

  // For HRV, positive = improving. For resting HR, negative = improving.
  if (invertBetter) {
    return pctChange < 0 ? 'improving' : 'declining';
  }
  return pctChange > 0 ? 'improving' : 'declining';
}

/** Compute percentage change between two values */
function pctChange(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null || baseline === 0) return null;
  return Math.round(((current - baseline) / baseline) * 1000) / 10;
}

// ── Server Action ───────────────────────────────────────────────────────

export const getWellnessTrends = createProfileAction(
  async (profileId: number, days: number = 90): Promise<WellnessTrendsResult> => {
    const settings = await getSettings(profileId);

    if (!settings?.intervalsAthleteId || !settings?.intervalsApiKey) {
      return {
        dataPoints: [],
        summary: {
          currentHrv: null,
          hrvBaseline: null,
          hrvTrendPct: null,
          hrvTrend: 'stable',
          currentRestingHR: null,
          restingHRBaseline: null,
          restingHRTrendPct: null,
          restingHRTrend: 'stable',
          daysWithData: 0,
          totalDays: days,
        },
      };
    }

    const apiKey = decryptToken(settings.intervalsApiKey);

    // Fetch wellness data from Intervals.icu
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = new Date().toISOString().split('T')[0];

    const wellnessEntries: IntervalsWellness[] = await getIntervalsWellness(
      settings.intervalsAthleteId,
      apiKey,
      { oldest: startDateStr, newest: endDateStr }
    );

    // Build a map of date -> entry for easy lookup
    const entryMap = new Map<string, IntervalsWellness>();
    for (const entry of wellnessEntries) {
      entryMap.set(entry.date, entry);
    }

    // Build complete date range (fill gaps with nulls)
    const allDates: string[] = [];
    const current = new Date(startDateStr + 'T12:00:00');
    const end = new Date(endDateStr + 'T12:00:00');
    while (current <= end) {
      allDates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Extract HRV and resting HR arrays for rolling average calculation
    const hrvValues = allDates.map(d => {
      const entry = entryMap.get(d);
      if (!entry) return null;
      return entry.hrv ?? entry.hrvSDNN ?? null;
    });

    const restingHRValues = allDates.map(d => {
      const entry = entryMap.get(d);
      if (!entry) return null;
      return entry.restingHR ?? null;
    });

    // Compute rolling averages
    const hrvRolling = computeRollingAverage(hrvValues);
    const restingHRRolling = computeRollingAverage(restingHRValues);

    // Build data points
    const dataPoints: WellnessDataPoint[] = allDates.map((date, i) => {
      const entry = entryMap.get(date);
      return {
        date,
        hrv: hrvValues[i],
        restingHR: restingHRValues[i],
        hrvRollingAvg: hrvRolling[i],
        restingHRRollingAvg: restingHRRolling[i],
        sleepQuality: entry?.sleepQuality ?? null,
        sleepDuration: entry?.sleepDuration ? Math.round(entry.sleepDuration / 60 * 10) / 10 : null, // minutes -> hours
        weight: entry?.weight ?? null,
        mood: entry?.mood ?? null,
        stress: entry?.stress ?? null,
        fatigue: entry?.fatigue ?? null,
      };
    });

    // Filter to only dates that have at least some data for the data points array
    // (keep all dates for chart continuity, but count those with data)
    const daysWithData = dataPoints.filter(
      d => d.hrv !== null || d.restingHR !== null
    ).length;

    // Compute summary stats
    // Current = last non-null rolling average
    const currentHrvRolling = [...hrvRolling].reverse().find(v => v !== null) ?? null;
    const currentRestingHRRolling = [...restingHRRolling].reverse().find(v => v !== null) ?? null;

    // Baseline = average of first 14 days that have data
    const firstHrvValues = hrvValues.filter((v): v is number => v !== null).slice(0, 14);
    const firstRestingHRValues = restingHRValues.filter((v): v is number => v !== null).slice(0, 14);

    const hrvBaseline = firstHrvValues.length >= 3
      ? Math.round((firstHrvValues.reduce((a, b) => a + b, 0) / firstHrvValues.length) * 10) / 10
      : null;

    const restingHRBaseline = firstRestingHRValues.length >= 3
      ? Math.round((firstRestingHRValues.reduce((a, b) => a + b, 0) / firstRestingHRValues.length) * 10) / 10
      : null;

    const hrvTrendPct = pctChange(currentHrvRolling, hrvBaseline);
    const restingHRTrendPct = pctChange(currentRestingHRRolling, restingHRBaseline);

    const summary: WellnessSummary = {
      currentHrv: currentHrvRolling,
      hrvBaseline,
      hrvTrendPct,
      hrvTrend: getTrendDirection(hrvTrendPct, false), // higher HRV = better
      currentRestingHR: currentRestingHRRolling,
      restingHRBaseline,
      restingHRTrendPct,
      restingHRTrend: getTrendDirection(restingHRTrendPct, true), // lower resting HR = better
      daysWithData,
      totalDays: days,
    };

    return { dataPoints, summary };
  },
  'getWellnessTrends'
);
