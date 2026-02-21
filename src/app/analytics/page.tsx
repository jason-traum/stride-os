import type { Metadata } from 'next';

// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics | Dreamy',
  description: 'Track your running performance with training analytics, pace trends, and fitness insights.',
};

import { getAnalyticsData, getDailyActivityData, getVolumeSummaryData, getCalendarData } from '@/actions/analytics';
import { getFitnessTrendData, getTrainingLoadData } from '@/actions/fitness';
import { getSettings } from '@/actions/settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { TrendingUp, Activity, Clock, Target } from 'lucide-react';
import { WeeklyMileageChart, FitnessTrendChart, TrainingLoadBar, PaceTrendChart, ActivityHeatmap, TrainingFocusChart } from '@/components/charts';
import { DemoAnalytics } from '@/components/DemoAnalytics';
import { EmptyState } from '@/components/EmptyState';
import { VolumeSummaryCards } from '@/components/VolumeSummaryCards';
import { MonthlyCalendar } from '@/components/MonthlyCalendar';
import { BestEffortsTable, BestMileSplits, PaceCurveChart } from '@/components/BestEfforts';
import { TrainingDistributionChart, WeeklyRollupTable, MonthlyRollupCards, TrainingLoadRecommendation } from '@/components/TrainingDistribution';
import { RacePredictorCard, GoalRaceCalculator } from '@/components/RacePredictor';
import { ZoneBoundariesCard } from '@/components/ZoneBoundariesCard';
import { MilestonesCard, DayOfWeekChart, WeatherPerformanceCard } from '@/components/RunningStats';
import { RecoveryStatusCard, WeeklyLoadCard, TrainingInsightsCard } from '@/components/RecoveryStatus';
import { FitnessAssessmentCard, MilestoneProgressCard } from '@/components/FitnessAssessment';
import { PRTimelineCard, YearlyComparisonCard, CumulativeMilesChart, MilestoneTrackerCard, PaceProgressionCard } from '@/components/ProgressTracking';
import { VdotTimeline } from '@/components/VdotTimeline';
import { SplitTendencyCard } from '@/components/SplitTendency';
import { FatigueResistance } from '@/components/FatigueResistance';
import { RecategorizeButton } from '@/components/RecategorizeButton';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { DreamySheep } from '@/components/DreamySheep';
import { formatPace, formatDuration } from '@/lib/utils';

// Get workout type color
function getTypeColor(type: string): string {
  // Performance Spectrum v3: steel → sky → teal → blue → indigo → violet → red → crimson
  const colors: Record<string, string> = {
    recovery: 'bg-slate-500',
    easy: 'bg-sky-500',
    long: 'bg-dream-600',
    steady: 'bg-sky-600',
    marathon: 'bg-blue-600',
    tempo: 'bg-indigo-600',
    threshold: 'bg-violet-600',
    interval: 'bg-red-600',
    repetition: 'bg-rose-700',
    race: 'bg-amber-600',
    cross_train: 'bg-violet-500',
    other: 'bg-stone-500',
  };
  return colors[type] || colors.other;
}

// Get workout type label
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    recovery: 'Recovery',
    easy: 'Easy',
    steady: 'Steady',
    marathon: 'Marathon',
    tempo: 'Tempo',
    threshold: 'Threshold',
    interval: 'Interval',
    repetition: 'Repetition',
    long: 'Long',
    race: 'Race',
    cross_train: 'Cross Train',
    other: 'Other',
  };
  return labels[type] || type;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-2">
      <div className="h-px flex-1 bg-borderSecondary" />
      <span className="text-textTertiary uppercase tracking-wide text-xs font-medium">{label}</span>
      <div className="h-px flex-1 bg-borderSecondary" />
    </div>
  );
}

// Server component for real data
async function ServerAnalytics() {
  const profileId = await getActiveProfileId();
  const [data, fitnessData, loadData, dailyActivity, volumeData, calendarData, settings] = await Promise.all([
    getAnalyticsData(profileId).catch((e) => {
      console.error('Failed to load analytics data:', e);
      return null;
    }),
    getFitnessTrendData(365, profileId),
    getTrainingLoadData(profileId),
    getDailyActivityData(12, profileId),
    getVolumeSummaryData(profileId),
    getCalendarData(profileId),
    getSettings(profileId),
  ]);

  // Transform weekly stats for the chart (include time for toggle)
  const chartData = (data?.weeklyStats ?? []).map(w => ({
    weekStart: w.weekStart,
    miles: w.totalMiles,
    minutes: w.totalMinutes,
  }));

  // Show empty state if no workouts or data failed to load
  if (!data || data.totalWorkouts === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-display font-semibold text-textPrimary">Analytics</h1>
          <p className="text-sm text-textTertiary mt-1">Your running stats from the last 90 days</p>
        </div>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm">
          <div className="flex flex-col items-center pt-8 pb-2">
            <DreamySheep mood="encouraging" size="lg" withSpeechBubble="Once you log some runs, I'll crunch the numbers for you!" />
          </div>
          <EmptyState variant="analytics" />
        </div>
      </div>
    );
  }

  return (
    <AnimatedList>
      <AnimatedListItem>
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-textPrimary">Analytics</h1>
            <p className="text-sm text-textTertiary mt-1">Your running stats from the last 90 days</p>
          </div>
          <RecategorizeButton />
        </div>
      </AnimatedListItem>

      {/* === SECTION 1: Quick Overview === */}
      <AnimatedListItem>
        <SectionHeader label="Overview" />
      </AnimatedListItem>

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

      {/* Recovery Status, Weekly Load, Training Insights - Separate Row */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <RecoveryStatusCard />
          <WeeklyLoadCard />
          <TrainingInsightsCard />
        </div>
      </AnimatedListItem>

      {/* === SECTION 2: Training Load & Fitness === */}
      <AnimatedListItem>
        <SectionHeader label="Training Load & Fitness" />
      </AnimatedListItem>

      {/* Weekly Volume + Next Week */}
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
          {/* Left column: Fitness Trend, then Training Distribution */}
          <div className="flex flex-col gap-4">
            {fitnessData.metrics.length > 7 && (
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
            )}
            <TrainingDistributionChart />
          </div>
          {/* Right column: Training Load Bar, then Training Focus */}
          <div className="flex flex-col gap-4">
            {loadData.current7DayLoad > 0 && (
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

      {/* VDOT Fitness Timeline */}
      <AnimatedListItem>
        <div className="mb-4">
          <VdotTimeline currentVdot={settings?.vdot ?? null} />
        </div>
      </AnimatedListItem>

      {/* === SECTION 3: Performance Analysis === */}
      <AnimatedListItem>
        <SectionHeader label="Performance Analysis" />
      </AnimatedListItem>

      {/* Best Efforts Side by Side */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <BestEffortsTable />
          <BestMileSplits />
        </div>
      </AnimatedListItem>

      {/* Pace Trend (full width) */}
      {data.recentPaces.length > 3 && (
        <AnimatedListItem>
          <div className="mb-4">
            <PaceTrendChart data={data.recentPaces} />
          </div>
        </AnimatedListItem>
      )}

      {/* Pace Curve + Split Tendency */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <PaceCurveChart />
          <SplitTendencyCard />
        </div>
      </AnimatedListItem>

      {/* Fatigue Resistance (full width) */}
      <AnimatedListItem>
        <div className="mb-4">
          <FatigueResistance />
        </div>
      </AnimatedListItem>

      {/* === SECTION 4: Race Planning === */}
      <AnimatedListItem>
        <SectionHeader label="Race Planning" />
      </AnimatedListItem>

      <AnimatedListItem>
        <div className="mb-4">
          <ZoneBoundariesCard />
        </div>
      </AnimatedListItem>

      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <RacePredictorCard />
          <GoalRaceCalculator />
        </div>
      </AnimatedListItem>

      {/* === SECTION 5: Activity History === */}
      <AnimatedListItem>
        <SectionHeader label="Activity History" />
      </AnimatedListItem>

      {/* Activity Heatmap - full width (needs space) */}
      {dailyActivity.length > 0 && (
        <AnimatedListItem>
          <div className="mb-4">
            <ActivityHeatmap
              data={dailyActivity}
              months={12}
              userThresholdPace={settings?.thresholdPaceSeconds ?? undefined}
              userEasyPace={settings?.easyPaceSeconds ?? undefined}
              userMaxHr={settings?.restingHr ? Math.round(settings.restingHr * 3.2) : undefined}
              userRestingHr={settings?.restingHr ?? undefined}
            />
          </div>
        </AnimatedListItem>
      )}

      {/* Calendar + Workout Types */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {calendarData.length > 0 && (
            <MonthlyCalendar workouts={calendarData} />
          )}
          {/* Workout Type Distribution */}
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
            <h2 className="font-semibold text-textPrimary mb-3 text-sm">Workout Types</h2>
            {data.workoutTypeDistribution.length > 0 ? (
              <>
                <div className="h-6 rounded-full overflow-hidden flex mb-3">
                  {data.workoutTypeDistribution.map((type) => {
                    const width = (type.count / data.totalWorkouts) * 100;
                    return (
                      <div
                        key={type.type}
                        className={`${getTypeColor(type.type)} first:rounded-l-full last:rounded-r-full`}
                        style={{ width: `${width}%` }}
                        title={`${getTypeLabel(type.type)}: ${type.count} workouts`}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {data.workoutTypeDistribution.map((type) => (
                    <div key={type.type} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${getTypeColor(type.type)}`} />
                      <span className="text-xs text-textSecondary">
                        {getTypeLabel(type.type)}: <span className="font-medium">{type.count}</span>
                        <span className="text-textTertiary ml-0.5">({type.miles}mi)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-textTertiary text-center py-6 text-sm">No workout data yet</p>
            )}
          </div>
        </div>
      </AnimatedListItem>

      {/* Rollup Tables */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <WeeklyRollupTable />
          <MonthlyRollupCards />
        </div>
      </AnimatedListItem>

      {/* === SECTION 6: Stats & Progress === */}
      <AnimatedListItem>
        <SectionHeader label="Stats & Progress" />
      </AnimatedListItem>

      {/* Running Stats Row - removed RunningStreakCard, FunFactsCard */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <MilestonesCard />
          <WeatherPerformanceCard />
          <FitnessAssessmentCard />
        </div>
      </AnimatedListItem>

      {/* Day of Week */}
      <AnimatedListItem>
        <div className="mb-4">
          <DayOfWeekChart />
        </div>
      </AnimatedListItem>

      {/* === SECTION 7: Long-term Progress === */}
      <AnimatedListItem>
        <SectionHeader label="Long-term Progress" />
      </AnimatedListItem>

      <AnimatedListItem>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <MilestoneProgressCard />
          <PRTimelineCard />
          <YearlyComparisonCard />
        </div>
      </AnimatedListItem>

      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <CumulativeMilesChart />
          <MilestoneTrackerCard />
          <PaceProgressionCard />
        </div>
      </AnimatedListItem>
    </AnimatedList>
  );
}

// Client wrapper that shows demo data when in demo mode
import { DemoWrapper } from '@/components/DemoWrapper';

export default function AnalyticsPage() {
  return (
    <DemoWrapper
      demoComponent={<DemoAnalytics />}
      serverComponent={<ServerAnalytics />}
    />
  );
}
