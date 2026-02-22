import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Training | Analytics | Dreamy',
  description: 'Deep dive into training load, volume, and physiological trends.',
};

import { getAnalyticsData } from '@/actions/analytics';
import { getFitnessTrendData, getTrainingLoadData } from '@/actions/fitness';
import { getSettings } from '@/actions/settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { WeeklyMileageChart, FitnessTrendChart, TrainingLoadBar, TrainingFocusChart } from '@/components/charts';
import { TrainingDistributionChart, TrainingLoadRecommendation } from '@/components/TrainingDistribution';
import { VdotTimeline } from '@/components/VdotTimeline';
import { ThresholdPaceCard } from '@/components/ThresholdPaceCard';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { DreamySheep } from '@/components/DreamySheep';
import { EmptyState } from '@/components/EmptyState';

export default async function TrainingPage() {
  const profileId = await getActiveProfileId();
  const [data, fitnessData, loadData, settings] = await Promise.all([
    getAnalyticsData(profileId).catch((e) => {
      console.error('Failed to load analytics data:', e);
      return null;
    }),
    getFitnessTrendData(365, profileId).catch((e) => {
      console.error('Failed to load fitness trend data:', e);
      return null;
    }),
    getTrainingLoadData(profileId).catch((e) => {
      console.error('Failed to load training load data:', e);
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
    <AnimatedList>
      {/* Weekly Volume + Next Week Recommendation */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2">
            <WeeklyMileageChart
              data={chartData}
              weeklyTarget={settings?.weeklyVolumeTargetMiles ?? undefined}
            />
          </div>
          <TrainingLoadRecommendation />
        </div>
      </AnimatedListItem>

      {/* Fitness Trend + Training Distribution | Training Load Bar + Training Focus */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-4">
            {fitnessData?.hasData && fitnessData.metrics.length > 7 ? (
              <FitnessTrendChart
                data={fitnessData.metrics}
                currentCtl={fitnessData.currentCtl}
                currentAtl={fitnessData.currentAtl}
                currentTsb={fitnessData.currentTsb}
                status={fitnessData.status}
                ctlChange={fitnessData.ctlChange}
                rampRate={fitnessData.rampRate}
                rampRateRisk={fitnessData.rampRateRisk}
              />
            ) : fitnessData?.message ? (
              <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
                <h3 className="font-semibold text-primary mb-2">Fitness Trend</h3>
                <p className="text-sm text-textTertiary">{fitnessData.message}</p>
              </div>
            ) : null}
            <TrainingDistributionChart />
          </div>
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
            <ThresholdPaceCard />
          </div>
        </div>
      </AnimatedListItem>

      {/* VDOT Fitness Timeline */}
      <AnimatedListItem>
        <div className="mb-4">
          <VdotTimeline currentVdot={settings?.vdot ?? null} />
        </div>
      </AnimatedListItem>
    </AnimatedList>
  );
}
