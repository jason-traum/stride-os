import type { Metadata } from 'next';

// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics | Dreamy',
  description: 'Track your running performance with training analytics, pace trends, and fitness insights.',
};

import { getAnalyticsData, getVolumeSummaryData } from '@/actions/analytics';
import { getTrainingLoadData } from '@/actions/fitness';
import { getSettings } from '@/actions/settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { TrendingUp, Activity, Clock, Target } from 'lucide-react';
import { WeeklyMileageChart, TrainingLoadBar } from '@/components/charts';
import { DemoAnalytics } from '@/components/DemoAnalytics';
import { EmptyState } from '@/components/EmptyState';
import { VolumeSummaryCards } from '@/components/VolumeSummaryCards';
import { RecoveryStatusCard, WeeklyLoadCard, TrainingInsightsCard } from '@/components/RecoveryStatus';
import { VdotTimeline } from '@/components/VdotTimeline';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { DreamySheep } from '@/components/DreamySheep';
import { DemoWrapper } from '@/components/DemoWrapper';
import { formatPace, formatDuration } from '@/lib/utils';

// Server component for real data
async function ServerAnalytics() {
  const profileId = await getActiveProfileId();
  const [data, loadData, volumeData, settings] = await Promise.all([
    getAnalyticsData(profileId).catch((e) => {
      console.error('Failed to load analytics data:', e);
      return null;
    }),
    getTrainingLoadData(profileId),
    getVolumeSummaryData(profileId),
    getSettings(profileId),
  ]);

  // Transform weekly stats for the chart
  const chartData = (data?.weeklyStats ?? []).map(w => ({
    weekStart: w.weekStart,
    miles: w.totalMiles,
    minutes: w.totalMinutes,
  }));

  // Show empty state if no workouts or data failed to load
  if (!data || data.totalWorkouts === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm">
        <div className="flex flex-col items-center pt-8 pb-2">
          <DreamySheep mood="encouraging" size="lg" withSpeechBubble="Once you log some runs, I'll crunch the numbers for you!" />
        </div>
        <EmptyState variant="analytics" />
      </div>
    );
  }

  return (
    <AnimatedList>
      {/* Summary Stats Row */}
      <AnimatedListItem>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-bgSecondary rounded-lg border border-borderPrimary p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-textTertiary mb-1">
              <Activity className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Workouts</span>
            </div>
            <p className="text-xl font-bold text-textPrimary">
              <AnimatedCounter value={data.totalWorkouts} duration={1200} />
            </p>
          </div>
          <div className="bg-bgSecondary rounded-lg border border-borderPrimary p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-textTertiary mb-1">
              <Target className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Miles</span>
            </div>
            <p className="text-xl font-bold text-textPrimary">
              <AnimatedCounter value={data.totalMiles} duration={1200} />
            </p>
          </div>
          <div className="bg-bgSecondary rounded-lg border border-borderPrimary p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-textTertiary mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Time</span>
            </div>
            <p className="text-xl font-bold text-textPrimary">{formatDuration(data.totalMinutes)}</p>
          </div>
          <div className="bg-bgSecondary rounded-lg border border-borderPrimary p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-textTertiary mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Avg Pace</span>
            </div>
            <p className="text-xl font-bold text-textPrimary">
              {data.avgPaceSeconds ? formatPace(data.avgPaceSeconds) : '--'}
              <span className="text-xs font-normal text-textTertiary">/mi</span>
            </p>
          </div>
        </div>
      </AnimatedListItem>

      {/* Volume Summary - Full Width */}
      <AnimatedListItem>
        <div className="mb-4">
          <VolumeSummaryCards
            thisWeekMiles={volumeData.thisWeekMiles}
            lastWeekMiles={volumeData.lastWeekMiles}
            thisMonthMiles={volumeData.thisMonthMiles}
            lastMonthMiles={volumeData.lastMonthMiles}
            ytdMiles={volumeData.ytdMiles}
          />
        </div>
      </AnimatedListItem>

      {/* Recovery Status, Weekly Load, Training Insights */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <RecoveryStatusCard />
          <WeeklyLoadCard />
          <TrainingInsightsCard />
        </div>
      </AnimatedListItem>

      {/* Weekly Mileage Chart */}
      <AnimatedListItem>
        <div className="mb-4">
          <WeeklyMileageChart
            data={chartData}
            weeklyTarget={settings?.weeklyVolumeTargetMiles ?? undefined}
          />
        </div>
      </AnimatedListItem>

      {/* Training Load Bar */}
      {loadData.current7DayLoad > 0 && (
        <AnimatedListItem>
          <div className="mb-4">
            <TrainingLoadBar
              currentLoad={loadData.current7DayLoad}
              optimalMin={loadData.optimalMin}
              optimalMax={loadData.optimalMax}
              previousLoad={loadData.previous7DayLoad}
              percentChange={loadData.percentChange}
            />
          </div>
        </AnimatedListItem>
      )}

      {/* VDOT Fitness Timeline */}
      <AnimatedListItem>
        <div className="mb-4">
          <VdotTimeline currentVdot={settings?.vdot ?? null} />
        </div>
      </AnimatedListItem>
    </AnimatedList>
  );
}

export default function AnalyticsPage() {
  return (
    <DemoWrapper
      demoComponent={<DemoAnalytics />}
      serverComponent={<ServerAnalytics />}
    />
  );
}
