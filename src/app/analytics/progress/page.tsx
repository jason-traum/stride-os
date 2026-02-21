import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Progress | Analytics | Dreamy',
  description: 'Long-term trends, milestones, and year-over-year comparisons.',
};

import { MilestonesCard, DayOfWeekChart, WeatherPerformanceCard } from '@/components/RunningStats';
import { FitnessAssessmentCard, MilestoneProgressCard } from '@/components/FitnessAssessment';
import { PRTimelineCard, YearlyComparisonCard, CumulativeMilesChart, MilestoneTrackerCard, PaceProgressionCard } from '@/components/ProgressTracking';
import { DeviceTrackingCard } from '@/components/DeviceTracking';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';

export default function ProgressPage() {
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
