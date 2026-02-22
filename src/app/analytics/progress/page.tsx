import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Progress | Analytics | Dreamy',
  description: 'Long-term trends, milestones, and year-over-year comparisons.',
};

import { getAnalyticsData } from '@/actions/analytics';
import { getActiveProfileId } from '@/lib/profile-server';
import { MilestonesCard, DayOfWeekChart, WeatherPerformanceCard } from '@/components/RunningStats';
import { FitnessAssessmentCard, MilestoneProgressCard } from '@/components/FitnessAssessment';
import { PRTimelineCard, YearlyComparisonCard, CumulativeMilesChart, MilestoneTrackerCard, PaceProgressionCard } from '@/components/ProgressTracking';
import { DeviceTrackingCard } from '@/components/DeviceTracking';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { DreamySheep } from '@/components/DreamySheep';
import { EmptyState } from '@/components/EmptyState';

export default async function ProgressPage() {
  const profileId = await getActiveProfileId();
  const data = await getAnalyticsData(profileId).catch((e) => {
    console.error('Failed to load analytics data:', e);
    return null;
  });

  if (!data || data.totalWorkouts === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm">
        <div className="flex flex-col items-center pt-8 pb-2">
          <DreamySheep mood="encouraging" size="lg" withSpeechBubble="Log some runs to track your long-term progress!" />
        </div>
        <EmptyState variant="analytics" />
      </div>
    );
  }

  return (
    <AnimatedList>
      {/* PR Timeline + Yearly Comparison + Milestone Progress */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <PRTimelineCard />
          <YearlyComparisonCard />
          <MilestoneProgressCard />
        </div>
      </AnimatedListItem>

      {/* Pace Progression + Cumulative Miles + Milestone Tracker */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <PaceProgressionCard />
          <CumulativeMilesChart />
          <MilestoneTrackerCard />
        </div>
      </AnimatedListItem>

      {/* Milestones + Weather + Fitness Assessment */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <MilestonesCard />
          <WeatherPerformanceCard />
          <FitnessAssessmentCard />
        </div>
      </AnimatedListItem>

      {/* Day of Week + Device Tracking */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <DayOfWeekChart />
          <DeviceTrackingCard />
        </div>
      </AnimatedListItem>
    </AnimatedList>
  );
}
