// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getWorkouts, getWorkoutCount } from '@/actions/workouts';
import { GroupedWorkoutList } from '@/components/GroupedWorkoutList';
import { WeeklyStatsCard } from '@/components/WeeklyStatsCard';
import { WeeklyMileageChart } from '@/components/charts/WeeklyMileageChart';
import { DemoHistory } from '@/components/DemoHistory';
import { DemoWrapper } from '@/components/DemoWrapper';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { Clock } from 'lucide-react';
import { getActiveProfileId } from '@/lib/profile-server';
import { getWeeklyStats, getAnalyticsData } from '@/actions/analytics';
import { getSettings } from '@/actions/settings';

const PAGE_SIZE = 30;

async function ServerHistory() {
  const profileId = await getActiveProfileId();
  const [workouts, totalCount, weeklyStats, analyticsResult, settings] = await Promise.all([
    getWorkouts(PAGE_SIZE, profileId),
    getWorkoutCount(profileId),
    getWeeklyStats(profileId),
    getAnalyticsData(profileId).catch((e) => {
      console.error('Failed to load analytics data for history:', e);
      return null;
    }),
    getSettings(profileId),
  ]);

  const weeklyTarget = settings?.weeklyVolumeTargetMiles ?? undefined;

  // Map analytics weekly data for the chart
  const chartData = (analyticsResult?.weeklyStats ?? []).map(w => ({
    weekStart: w.weekStart,
    miles: Math.round(w.totalMiles * 10) / 10,
    minutes: Math.round(w.totalMinutes),
  }));

  return (
    <AnimatedList>
      <AnimatedListItem>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-semibold text-textPrimary">History</h1>
          <div className="flex items-center gap-3">
            {totalCount > 0 && (
              <span className="text-sm text-textTertiary">{totalCount} runs</span>
            )}
            <Link
              href="/log"
              className="btn-primary text-sm"
            >
              Log Run
            </Link>
          </div>
        </div>
      </AnimatedListItem>

      {workouts.length === 0 ? (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-8 text-center shadow-sm">
          <div className="text-textTertiary mb-4">
            <Clock className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-lg font-medium text-textPrimary mb-2">No workouts yet</h2>
          <p className="text-textSecondary mb-4">Start logging your runs to track your progress.</p>
          <Link
            href="/log"
            className="btn-primary inline-flex items-center text-sm"
          >
            Log your first run
          </Link>
        </div>
      ) : (
        <AnimatedList className="space-y-6">
          {/* This Week Summary */}
          <AnimatedListItem>
            <WeeklyStatsCard stats={weeklyStats} weeklyTarget={weeklyTarget} />
          </AnimatedListItem>

          {/* Weekly Volume Bars */}
          {chartData.length > 0 && (
            <AnimatedListItem>
              <WeeklyMileageChart data={chartData} weeklyTarget={weeklyTarget} />
            </AnimatedListItem>
          )}

          {/* Grouped Workout List */}
          <AnimatedListItem>
            <GroupedWorkoutList initialWorkouts={workouts} totalCount={totalCount} pageSize={PAGE_SIZE} />
          </AnimatedListItem>
        </AnimatedList>
      )}
    </AnimatedList>
  );
}

export default function HistoryPage() {
  return (
    <DemoWrapper
      demoComponent={<DemoHistory />}
      serverComponent={<ServerHistory />}
    />
  );
}
