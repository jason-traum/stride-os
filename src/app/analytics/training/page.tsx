import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Training | Analytics | Dreamy',
  description: 'Training volume, distribution, periodization, load management, and ramp rates.',
};

import { getAnalyticsData } from '@/actions/analytics';
import { getTrainingLoadData, getLoadDashboardData } from '@/actions/fitness';
import { getSettings } from '@/actions/settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { WeeklyMileageChart, TrainingLoadBar, TrainingFocusChart } from '@/components/charts';
import { TrainingDistributionChart, TrainingLoadRecommendation } from '@/components/TrainingDistribution';
import { MileageRampTable } from '@/components/MileageRampTable';
import { DailyTrimpChart } from '@/components/DailyTrimpChart';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { DreamySheep } from '@/components/DreamySheep';
import { EmptyState } from '@/components/EmptyState';
import { PeriodizationView } from '@/components/PeriodizationView';

export default async function TrainingPage() {
  const profileId = await getActiveProfileId();
  const [data, loadData, dashboardData, settings] = await Promise.all([
    getAnalyticsData(profileId).catch((e) => {
      console.error('Failed to load analytics data:', e);
      return null;
    }),
    getTrainingLoadData(profileId).catch((e) => {
      console.error('Failed to load training load data:', e);
      return null;
    }),
    getLoadDashboardData(profileId).catch((e) => {
      console.error('Failed to load load dashboard data:', e);
      return null;
    }),
    getSettings(profileId),
  ]);

  const chartData = (data?.weeklyStats ?? []).map(w => ({
    weekStart: w.weekStart,
    miles: w.totalMiles,
    minutes: w.totalMinutes,
  }));

  if (!data || data.totalWorkouts === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm">
        <div className="flex flex-col items-center pt-8 pb-2">
          <DreamySheep mood="encouraging" size="lg" withSpeechBubble="Log some runs and I'll analyze your training load!" />
        </div>
        <EmptyState variant="analytics" />
      </div>
    );
  }

  return (
    <AnimatedList className="space-y-6">
      {/* Training Periodization */}
      <AnimatedListItem>
        <PeriodizationView />
      </AnimatedListItem>

      {/* Weekly Volume + Next Week Recommendation */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <WeeklyMileageChart
              data={chartData}
              weeklyTarget={settings?.weeklyVolumeTargetMiles ?? undefined}
            />
          </div>
          <TrainingLoadRecommendation />
        </div>
      </AnimatedListItem>

      {/* Training Distribution + Training Load Bar */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TrainingDistributionChart />
          <div className="flex flex-col gap-4">
            {loadData && loadData.current7DayLoad > 0 && (
              <TrainingLoadBar
                currentLoad={loadData.current7DayLoad}
                optimalMin={loadData.optimalMin}
                optimalMax={loadData.optimalMax}
                previousLoad={loadData.previous7DayLoad}
                percentChange={loadData.percentChange}
              />
            )}
            {data.workoutTypeDistribution.length > 0 && (
              <TrainingFocusChart
                data={data.workoutTypeDistribution.map(d => ({
                  workoutType: d.type,
                  count: d.count,
                  miles: d.miles,
                  minutes: d.minutes,
                }))}
                totalMiles={data.totalMiles}
                totalMinutes={data.totalMinutes}
              />
            )}
          </div>
        </div>
      </AnimatedListItem>

      {/* Mileage Ramp + Daily TRIMP (from old Load tab) */}
      {dashboardData?.fitness?.hasData && (
        <AnimatedListItem>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MileageRampTable weeks={dashboardData.weeklyMileageRamp} />
            <DailyTrimpChart entries={dashboardData.dailyTrimp} />
          </div>
        </AnimatedListItem>
      )}
    </AnimatedList>
  );
}
