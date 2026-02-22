import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Performance | Analytics | Dreamy',
  description: 'Personal records, pacing analysis, running efficiency, and route comparisons.',
};

import { getAnalyticsData } from '@/actions/analytics';
import { getActiveProfileId } from '@/lib/profile-server';
import { PaceTrendChart } from '@/components/charts';
import { BestEffortsTable, BestMileSplits, PaceCurveChart } from '@/components/BestEfforts';
import { RunningEconomyCard } from '@/components/RunningEconomy';
import { SplitTendencyCard } from '@/components/SplitTendency';
import { FatigueResistance } from '@/components/FatigueResistance';
import { PerformanceCharts } from './PerformanceCharts';
import { RouteComparisonCard } from '@/components/RouteComparison';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { DreamySheep } from '@/components/DreamySheep';
import { EmptyState } from '@/components/EmptyState';

export default async function PerformancePage() {
  const profileId = await getActiveProfileId();
  const data = await getAnalyticsData(profileId).catch((e) => {
    console.error('Failed to load analytics data:', e);
    return null;
  });

  if (!data || data.totalWorkouts === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm">
        <div className="flex flex-col items-center pt-8 pb-2">
          <DreamySheep mood="encouraging" size="lg" withSpeechBubble="Run some miles and I'll track your PRs!" />
        </div>
        <EmptyState variant="analytics" />
      </div>
    );
  }

  return (
    <AnimatedList className="space-y-6">
      {/* Best Efforts + Best Mile Splits */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BestEffortsTable />
          <BestMileSplits />
        </div>
      </AnimatedListItem>

      {/* Pace Curve */}
      <AnimatedListItem>
        <PaceCurveChart />
      </AnimatedListItem>

      {/* Pace Trend */}
      {data.recentPaces.length > 3 && (
        <AnimatedListItem>
          <PaceTrendChart data={data.recentPaces} />
        </AnimatedListItem>
      )}

      {/* Route Comparison */}
      <AnimatedListItem>
        <RouteComparisonCard />
      </AnimatedListItem>

      {/* Running Economy + Split Tendency */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RunningEconomyCard />
          <SplitTendencyCard />
        </div>
      </AnimatedListItem>

      {/* Fatigue Resistance */}
      <AnimatedListItem>
        <FatigueResistance />
      </AnimatedListItem>

      {/* Performance Analysis Charts */}
      <AnimatedListItem>
        <PerformanceCharts />
      </AnimatedListItem>
    </AnimatedList>
  );
}
