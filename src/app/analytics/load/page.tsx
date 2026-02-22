import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Training Load | Analytics | Dreamy',
  description: 'Transparent training load dashboard: CTL/ATL/TSB fitness model, ramp rate, and recovery.',
};

import { getLoadDashboardData } from '@/actions/fitness';
import { getActiveProfileId } from '@/lib/profile-server';
import { FitnessTrendChart } from '@/components/charts';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { DreamySheep } from '@/components/DreamySheep';
import { EmptyState } from '@/components/EmptyState';
import { LoadStatusCards } from '@/components/LoadStatusCards';
import { MileageRampTable } from '@/components/MileageRampTable';
import { DailyTrimpChart } from '@/components/DailyTrimpChart';
import { RecoveryModelCard } from '@/components/RecoveryModelCard';

export default async function LoadDashboardPage() {
  const profileId = await getActiveProfileId();
  const data = await getLoadDashboardData(profileId).catch((e) => {
    console.error('Failed to load dashboard data:', e);
    return null;
  });

  if (!data || !data.fitness.hasData) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm">
        <div className="flex flex-col items-center pt-8 pb-2">
          <DreamySheep mood="encouraging" size="lg" withSpeechBubble="Log some runs and I'll show you exactly how your fitness is built!" />
        </div>
        <EmptyState variant="analytics" />
      </div>
    );
  }

  const { fitness, dailyTrimp, weeklyMileageRamp, recovery } = data;

  return (
    <AnimatedList>
      {/* Intro */}
      <AnimatedListItem>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm mb-4">
          <h2 className="font-semibold text-textPrimary text-sm mb-1">How This Works</h2>
          <p className="text-xs text-textTertiary leading-relaxed">
            Your training load is modeled using exponentially-weighted moving averages of daily stress scores.{' '}
            <strong className="text-textSecondary">Fitness (CTL)</strong> is a 42-day rolling average representing your aerobic base.{' '}
            <strong className="text-textSecondary">Fatigue (ATL)</strong> is a 7-day rolling average of recent stress.{' '}
            <strong className="text-textSecondary">Form (TSB)</strong> = Fitness - Fatigue: positive means fresh, negative means you are building load.
            {fitness.confidence < 1 && fitness.message && (
              <span className="block mt-1 text-amber-500">{fitness.message}</span>
            )}
          </p>
        </div>
      </AnimatedListItem>

      {/* Current Status Cards */}
      <AnimatedListItem>
        <div className="mb-4">
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
        </div>
      </AnimatedListItem>

      {/* CTL/ATL/TSB Chart */}
      {fitness.metrics.length > 7 && (
        <AnimatedListItem>
          <div className="mb-4">
            <FitnessTrendChart
              data={fitness.metrics}
              currentCtl={fitness.currentCtl}
              currentAtl={fitness.currentAtl}
              currentTsb={fitness.currentTsb}
              status={fitness.status}
              ctlChange={fitness.ctlChange}
              rampRate={fitness.rampRate}
              rampRateRisk={fitness.rampRateRisk}
            />
          </div>
        </AnimatedListItem>
      )}

      {/* Mileage Ramp Rate + Daily TRIMP side by side */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <MileageRampTable weeks={weeklyMileageRamp} />
          <DailyTrimpChart entries={dailyTrimp} />
        </div>
      </AnimatedListItem>

      {/* Recovery Model */}
      {recovery && recovery.confidence > 0 && (
        <AnimatedListItem>
          <div className="mb-4">
            <RecoveryModelCard recovery={recovery} />
          </div>
        </AnimatedListItem>
      )}
    </AnimatedList>
  );
}
