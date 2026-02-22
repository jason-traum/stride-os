'use server';

import { db, workouts, stravaBestEfforts } from '@/lib/db';
import { desc, gte, lte, eq, and } from 'drizzle-orm';
import { toLocalDateString } from '@/lib/utils';
import { createProfileAction } from '@/lib/action-utils';
import { getFitnessTrendData } from './fitness';
import type { Workout } from '@/lib/schema';

// --- Types ---

export type InsightType = 'trend_up' | 'trend_down' | 'milestone' | 'pattern' | 'alert' | 'encouragement';

export interface WeeklyInsight {
  type: InsightType;
  title: string;
  description: string;
  metric?: string;
  icon: string; // lucide icon name
  importance: number; // higher = more important, for sorting
}

// --- Helpers ---

interface PeriodStats {
  totalMiles: number;
  totalMinutes: number;
  workoutCount: number;
  runsPerWeek: number;
  avgPaceSeconds: number | null;
  longestRunMiles: number;
  workoutTypes: Map<string, number>;
  weeks: number;
}

function computePeriodStats(runs: Workout[], weeks: number): PeriodStats {
  const totalMiles = runs.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalMinutes = runs.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
  const workoutCount = runs.length;
  const runsPerWeek = weeks > 0 ? workoutCount / weeks : 0;

  const withPace = runs.filter(w => w.avgPaceSeconds && w.avgPaceSeconds > 0);
  const avgPaceSeconds = withPace.length > 0
    ? Math.round(withPace.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / withPace.length)
    : null;

  const longestRunMiles = runs.reduce((max, w) => Math.max(max, w.distanceMiles || 0), 0);

  const workoutTypes = new Map<string, number>();
  for (const w of runs) {
    const type = w.workoutType || 'other';
    workoutTypes.set(type, (workoutTypes.get(type) || 0) + 1);
  }

  return { totalMiles, totalMinutes, workoutCount, runsPerWeek, avgPaceSeconds, longestRunMiles, workoutTypes, weeks };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function formatPaceStr(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// --- Main Engine ---

export const getWeeklyInsights = createProfileAction(
  async (profileId: number): Promise<WeeklyInsight[]> => {
    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const eightWeeksAgo = new Date(now);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const nowStr = toLocalDateString(now);
    const fourWeeksAgoStr = toLocalDateString(fourWeeksAgo);
    const eightWeeksAgoStr = toLocalDateString(eightWeeksAgo);

    // Fetch workouts for both periods
    const allWorkouts: Workout[] = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, eightWeeksAgoStr),
          lte(workouts.date, nowStr)
        )
      )
      .orderBy(desc(workouts.date));

    const recentRuns = allWorkouts.filter(w => w.date >= fourWeeksAgoStr);
    const previousRuns = allWorkouts.filter(w => w.date < fourWeeksAgoStr);

    // Need some data to generate insights
    if (recentRuns.length < 2) {
      return [];
    }

    const recent = computePeriodStats(recentRuns, 4);
    const previous = computePeriodStats(previousRuns, 4);

    const insights: WeeklyInsight[] = [];

    // 1. Volume change (weekly mileage)
    const recentWeeklyMiles = recent.totalMiles / 4;
    const previousWeeklyMiles = previous.totalMiles / 4;
    const volumeChange = pctChange(recentWeeklyMiles, previousWeeklyMiles);

    if (volumeChange !== null && Math.abs(volumeChange) >= 10) {
      if (volumeChange > 0) {
        insights.push({
          type: 'trend_up',
          title: `Mileage Up ${volumeChange}%`,
          description: `Averaging ${recentWeeklyMiles.toFixed(1)} mi/week, up from ${previousWeeklyMiles.toFixed(1)} mi/week last month.`,
          metric: `${recentWeeklyMiles.toFixed(1)} mi/wk`,
          icon: 'TrendingUp',
          importance: 80,
        });
      } else {
        insights.push({
          type: 'trend_down',
          title: `Mileage Down ${Math.abs(volumeChange)}%`,
          description: `Averaging ${recentWeeklyMiles.toFixed(1)} mi/week, down from ${previousWeeklyMiles.toFixed(1)} mi/week last month.`,
          metric: `${recentWeeklyMiles.toFixed(1)} mi/wk`,
          icon: 'TrendingDown',
          importance: 75,
        });
      }
    }

    // 2. Pace improvement (compare avg easy-run pace)
    const recentEasy = recentRuns.filter(w =>
      (w.workoutType === 'easy' || w.workoutType === 'recovery') && w.avgPaceSeconds
    );
    const previousEasy = previousRuns.filter(w =>
      (w.workoutType === 'easy' || w.workoutType === 'recovery') && w.avgPaceSeconds
    );

    if (recentEasy.length >= 2 && previousEasy.length >= 2) {
      const recentAvgEasy = Math.round(
        recentEasy.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / recentEasy.length
      );
      const previousAvgEasy = Math.round(
        previousEasy.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / previousEasy.length
      );
      const paceDiff = previousAvgEasy - recentAvgEasy; // positive = faster

      if (Math.abs(paceDiff) >= 5) { // at least 5 sec/mi difference
        if (paceDiff > 0) {
          insights.push({
            type: 'trend_up',
            title: `Easy Pace Faster by ${paceDiff}s`,
            description: `Your easy pace improved to ${formatPaceStr(recentAvgEasy)}/mi from ${formatPaceStr(previousAvgEasy)}/mi.`,
            metric: formatPaceStr(recentAvgEasy),
            icon: 'Gauge',
            importance: 70,
          });
        } else {
          insights.push({
            type: 'pattern',
            title: `Easy Pace Slowed by ${Math.abs(paceDiff)}s`,
            description: `Easy pace is ${formatPaceStr(recentAvgEasy)}/mi, up from ${formatPaceStr(previousAvgEasy)}/mi. Could be heat, fatigue, or intentional.`,
            metric: formatPaceStr(recentAvgEasy),
            icon: 'Gauge',
            importance: 50,
          });
        }
      }
    }

    // 3. Consistency change (runs per week)
    const consistencyChange = pctChange(recent.runsPerWeek, previous.runsPerWeek);

    if (consistencyChange !== null && Math.abs(consistencyChange) >= 20) {
      if (consistencyChange > 0) {
        insights.push({
          type: 'trend_up',
          title: `More Consistent`,
          description: `Running ${recent.runsPerWeek.toFixed(1)}x/week, up from ${previous.runsPerWeek.toFixed(1)}x/week. Consistency drives progress.`,
          metric: `${recent.runsPerWeek.toFixed(1)}x/wk`,
          icon: 'CalendarCheck',
          importance: 65,
        });
      } else {
        insights.push({
          type: 'trend_down',
          title: `Fewer Runs Per Week`,
          description: `Running ${recent.runsPerWeek.toFixed(1)}x/week, down from ${previous.runsPerWeek.toFixed(1)}x/week.`,
          metric: `${recent.runsPerWeek.toFixed(1)}x/wk`,
          icon: 'CalendarMinus',
          importance: 60,
        });
      }
    }

    // 4. Long run progress
    if (recent.longestRunMiles > 0 && previous.longestRunMiles > 0) {
      const longRunDiff = recent.longestRunMiles - previous.longestRunMiles;
      const longRunPct = pctChange(recent.longestRunMiles, previous.longestRunMiles);

      if (longRunPct !== null && longRunDiff >= 1) {
        insights.push({
          type: 'milestone',
          title: `Long Run Up to ${recent.longestRunMiles.toFixed(1)} mi`,
          description: `Your longest run grew from ${previous.longestRunMiles.toFixed(1)} mi to ${recent.longestRunMiles.toFixed(1)} mi. Great endurance building.`,
          metric: `${recent.longestRunMiles.toFixed(1)} mi`,
          icon: 'Route',
          importance: 72,
        });
      }
    }

    // 5. New PRs (strava best efforts with prRank = 1 in recent period)
    try {
      const recentPRs = await db
        .select()
        .from(stravaBestEfforts)
        .innerJoin(workouts, eq(stravaBestEfforts.workoutId, workouts.id))
        .where(
          and(
            eq(workouts.profileId, profileId),
            eq(stravaBestEfforts.prRank, 1),
            gte(stravaBestEfforts.createdAt, fourWeeksAgoStr)
          )
        )
        .orderBy(desc(stravaBestEfforts.createdAt));

      if (recentPRs.length > 0) {
        const prNames = recentPRs.slice(0, 3).map(row => row.strava_best_efforts.name).join(', ');
        insights.push({
          type: 'milestone',
          title: recentPRs.length === 1 ? `New PR!` : `${recentPRs.length} New PRs!`,
          description: `Set personal records in ${prNames}. Hard work is paying off.`,
          icon: 'Award',
          importance: 90,
        });
      }
    } catch {
      // stravaBestEfforts table might not exist in all environments
    }

    // 6. Training load trend (CTL/ATL)
    try {
      const fitnessData = await getFitnessTrendData(56, profileId);
      if (fitnessData.metrics.length > 28) {
        const ctlChange = fitnessData.ctlChange;
        if (ctlChange !== null && Math.abs(ctlChange) >= 3) {
          if (ctlChange > 0) {
            insights.push({
              type: 'trend_up',
              title: `Fitness Rising`,
              description: `Your chronic training load (CTL) increased by ${ctlChange.toFixed(0)} points over the last 4 weeks. You're getting fitter.`,
              metric: `CTL ${fitnessData.currentCtl.toFixed(0)}`,
              icon: 'Activity',
              importance: 78,
            });
          } else {
            insights.push({
              type: 'alert',
              title: `Fitness Declining`,
              description: `Your CTL dropped by ${Math.abs(ctlChange).toFixed(0)} points over 4 weeks. Consider if this is planned recovery or unintended.`,
              metric: `CTL ${fitnessData.currentCtl.toFixed(0)}`,
              icon: 'AlertTriangle',
              importance: 76,
            });
          }
        }

        // TSB-based freshness insight
        const tsb = fitnessData.currentTsb;
        if (tsb > 15) {
          insights.push({
            type: 'encouragement',
            title: `Well Rested`,
            description: `Your form balance is +${tsb.toFixed(0)}. You're fresh and ready to perform.`,
            metric: `TSB +${tsb.toFixed(0)}`,
            icon: 'Battery',
            importance: 40,
          });
        } else if (tsb < -20) {
          insights.push({
            type: 'alert',
            title: `Heavy Training Load`,
            description: `Your form balance is ${tsb.toFixed(0)}. You're accumulating fatigue. Prioritize recovery.`,
            metric: `TSB ${tsb.toFixed(0)}`,
            icon: 'AlertTriangle',
            importance: 82,
          });
        }
      }
    } catch {
      // Fitness data might not be available
    }

    // 7. Workout variety
    const recentTypeCount = recent.workoutTypes.size;
    const previousTypeCount = previous.workoutTypes.size;

    if (recentTypeCount > previousTypeCount && recentTypeCount >= 3) {
      insights.push({
        type: 'pattern',
        title: `More Workout Variety`,
        description: `Training with ${recentTypeCount} different workout types this month, up from ${previousTypeCount}. Good mix of stimuli.`,
        metric: `${recentTypeCount} types`,
        icon: 'Shuffle',
        importance: 45,
      });
    } else if (recentTypeCount === 1 && recent.workoutCount >= 4) {
      insights.push({
        type: 'pattern',
        title: `All Same Pace`,
        description: `All ${recent.workoutCount} runs this month have been the same type. Consider mixing in different efforts.`,
        icon: 'Repeat',
        importance: 55,
      });
    }

    // 8. Milestone: total mileage
    const totalRecentMiles = recent.totalMiles;
    if (totalRecentMiles >= 100) {
      insights.push({
        type: 'milestone',
        title: `100+ Mile Month`,
        description: `You've logged ${totalRecentMiles.toFixed(0)} miles in the last 4 weeks. Impressive volume.`,
        metric: `${totalRecentMiles.toFixed(0)} mi`,
        icon: 'Trophy',
        importance: 68,
      });
    } else if (totalRecentMiles >= 50 && previous.totalMiles < 50) {
      insights.push({
        type: 'milestone',
        title: `50+ Mile Month`,
        description: `You've hit ${totalRecentMiles.toFixed(0)} miles in 4 weeks, crossing the 50-mile mark.`,
        metric: `${totalRecentMiles.toFixed(0)} mi`,
        icon: 'Trophy',
        importance: 60,
      });
    }

    // Sort by importance (highest first) and take top 5
    insights.sort((a, b) => b.importance - a.importance);
    return insights.slice(0, 5);
  },
  'getWeeklyInsights'
);
