import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Fitness | Analytics | Dreamy',
  description: 'Fitness assessment, VDOT timeline, threshold pace, training zones, and physiological trends.',
};

import { getAnalyticsData } from '@/actions/analytics';
import { getFitnessTrendData, getLoadDashboardData } from '@/actions/fitness';
import { getSettings } from '@/actions/settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { FitnessTrendChart } from '@/components/charts';
import { FitnessAssessmentCard } from '@/components/FitnessAssessment';
import { LoadStatusCards } from '@/components/LoadStatusCards';
import { VdotTimeline } from '@/components/VdotTimeline';
import { ThresholdPaceCard } from '@/components/ThresholdPaceCard';
import { ZoneBoundariesCard } from '@/components/ZoneBoundariesCard';
import { WellnessTrends } from '@/components/WellnessTrends';
import { RecoveryModelCard } from '@/components/RecoveryModelCard';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { DreamySheep } from '@/components/DreamySheep';
import { EmptyState } from '@/components/EmptyState';

export default async function FitnessPage() {
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
    getLoadDashboardData(profileId).catch((e) => {
      console.error('Failed to load dashboard data:', e);
      return null;
    }),
    getSettings(profileId),
  ]);

  if (!data || data.totalWorkouts === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm">
        <div className="flex flex-col items-center pt-8 pb-2">
          <DreamySheep mood="encouraging" size="lg" withSpeechBubble="Log some runs and I'll assess your fitness!" />
        </div>
        <EmptyState variant="analytics" />
      </div>
    );
  }

  const fitness = loadData?.fitness;
  const recovery = loadData?.recovery;

  return (
    <AnimatedList className="space-y-6">
      {/* Fitness Assessment Grade */}
      <AnimatedListItem>
        <FitnessAssessmentCard />
      </AnimatedListItem>

      {/* Load Status Cards (CTL/ATL/TSB/Ramp/Status/Load) */}
      {fitness?.hasData && (
        <AnimatedListItem>
          <LoadStatusCards
            currentCtl={fitness.currentCtl}
            currentAtl={fitness.currentAtl}
            currentTsb={fitness.currentTsb}
            status={fitness.status}
            ctlChange={fitness.ctlChange}
            rampRate={fitness.rampRate}
            rampRateRisk={fitness.rampRateRisk}
            weeklyLoad={fitness.weeklyLoad}
            optimalRange={fitness.optimalRange}
          />
        </AnimatedListItem>
      )}

      {/* Fitness Trend (CTL/ATL/TSB) */}
      {fitnessData?.hasData && fitnessData.metrics.length > 7 && (
        <AnimatedListItem>
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
        </AnimatedListItem>
      )}

      {/* VDOT Fitness Timeline */}
      <AnimatedListItem>
        <VdotTimeline currentVdot={settings?.vdot ?? null} showPredictions={false} />
      </AnimatedListItem>

      {/* Threshold Pace + Zone Boundaries */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ThresholdPaceCard />
          <ZoneBoundariesCard />
        </div>
      </AnimatedListItem>

      {/* HRV & Wellness Trends */}
      <AnimatedListItem>
        <WellnessTrends />
      </AnimatedListItem>

      {/* Recovery Model */}
      {recovery && recovery.confidence > 0 && (
        <AnimatedListItem>
          <RecoveryModelCard recovery={recovery} />
        </AnimatedListItem>
      )}
    </AnimatedList>
  );
}
