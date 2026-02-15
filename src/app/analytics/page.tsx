// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

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
import { RacePredictorCard, VDOTPacesCard, GoalRaceCalculator } from '@/components/RacePredictor';
import { MilestonesCard, DayOfWeekChart, WeatherPerformanceCard } from '@/components/RunningStats';
import { RecoveryStatusCard, WeeklyLoadCard, TrainingInsightsCard } from '@/components/RecoveryStatus';
import { FitnessAssessmentCard, MilestoneProgressCard } from '@/components/FitnessAssessment';
import { PRTimelineCard, YearlyComparisonCard, CumulativeMilesChart, MilestoneTrackerCard, PaceProgressionCard } from '@/components/ProgressTracking';

function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Get workout type color (with dark mode support)
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    easy: 'bg-teal-400 dark:bg-teal-600',
    long: 'bg-indigo-400 dark:bg-indigo-600',
    tempo: 'bg-rose-400 dark:bg-rose-600',
    threshold: 'bg-red-500 dark:bg-red-700',
    interval: 'bg-fuchsia-500 dark:bg-fuchsia-700',
    recovery: 'bg-cyan-300 dark:bg-cyan-600',
    race: 'bg-purple-500 dark:bg-purple-700',
    steady: 'bg-slate-400 dark:bg-slate-600',
    marathon: 'bg-amber-500 dark:bg-amber-700',
    cross_train: 'bg-pink-400 dark:bg-pink-600',
    other: 'bg-stone-400 dark:bg-stone-600',
  };
  return colors[type] || colors.other;
}

// Get workout type label
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    easy: 'Easy',
    long: 'Long',
    tempo: 'Tempo',
    interval: 'Interval',
    recovery: 'Recovery',
    race: 'Race',
    steady: 'Steady',
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
    getAnalyticsData(profileId),
    getFitnessTrendData(90, profileId),
    getTrainingLoadData(profileId),
    getDailyActivityData(12, profileId),
    getVolumeSummaryData(profileId),
    getCalendarData(profileId),
    getSettings(profileId),
  ]);

  // Transform weekly stats for the chart (include time for toggle)
  const chartData = data.weeklyStats.map(w => ({
    weekStart: w.weekStart,
    miles: w.totalMiles,
    minutes: w.totalMinutes,
  }));

  // Show empty state if no workouts
  if (data.totalWorkouts === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-display font-semibold text-textPrimary">Analytics</h1>
          <p className="text-sm text-textTertiary mt-1">Your running stats from the last 90 days</p>
        </div>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm">
          <EmptyState variant="analytics" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-textPrimary">Analytics</h1>
        <p className="text-sm text-textTertiary mt-1">Your running stats from the last 90 days</p>
      </div>

      {/* === SECTION 1: Quick Overview === */}
      <SectionHeader label="Overview" />

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-bgSecondary rounded-lg border border-borderPrimary p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-textTertiary mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Workouts</span>
          </div>
          <p className="text-xl font-bold text-textPrimary">{data.totalWorkouts}</p>
        </div>
        <div className="bg-bgSecondary rounded-lg border border-borderPrimary p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-textTertiary mb-1">
            <Target className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Miles</span>
          </div>
          <p className="text-xl font-bold text-textPrimary">{data.totalMiles}</p>
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

      {/* Volume Summary - Full Width */}
      <div className="mb-4">
        <VolumeSummaryCards
          thisWeekMiles={volumeData.thisWeekMiles}
          lastWeekMiles={volumeData.lastWeekMiles}
          thisMonthMiles={volumeData.thisMonthMiles}
          lastMonthMiles={volumeData.lastMonthMiles}
          ytdMiles={volumeData.ytdMiles}
        />
      </div>

      {/* Recovery Status, Weekly Load, Training Insights - Separate Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <RecoveryStatusCard />
        <WeeklyLoadCard />
        <TrainingInsightsCard />
      </div>

      {/* === SECTION 2: Training Load & Fitness === */}
      <SectionHeader label="Training Load & Fitness" />

      {/* Weekly Volume + Next Week */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <WeeklyMileageChart
            data={chartData}
            weeklyTarget={settings?.weeklyVolumeTargetMiles ?? undefined}
          />
        </div>
        <TrainingLoadRecommendation />
      </div>

      {/* Fitness Trend + Training Load Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
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
        {loadData.current7DayLoad > 0 && (
          <TrainingLoadBar
            currentLoad={loadData.current7DayLoad}
            optimalMin={loadData.optimalMin}
            optimalMax={loadData.optimalMax}
            previousLoad={loadData.previous7DayLoad}
            percentChange={loadData.percentChange}
          />
        )}
      </div>

      {/* Training Distribution + Training Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <TrainingDistributionChart />
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

      {/* === SECTION 3: Performance Analysis === */}
      <SectionHeader label="Performance Analysis" />

      {/* Best Efforts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <BestEffortsTable />
        <BestMileSplits />
      </div>

      {/* Pace Curve + Pace Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PaceCurveChart />
        {data.recentPaces.length > 3 && (
          <PaceTrendChart data={data.recentPaces} />
        )}
      </div>

      {/* === SECTION 4: Race Planning === */}
      <SectionHeader label="Race Planning" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <RacePredictorCard />
        <VDOTPacesCard />
      </div>

      <div className="mb-4">
        <GoalRaceCalculator />
      </div>

      {/* === SECTION 5: Activity History === */}
      <SectionHeader label="Activity History" />

      {/* Activity Heatmap - full width (needs space) */}
      {dailyActivity.length > 0 && (
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
      )}

      {/* Calendar + Workout Types */}
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

      {/* Rollup Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <WeeklyRollupTable />
        <MonthlyRollupCards />
      </div>

      {/* === SECTION 6: Stats & Progress === */}
      <SectionHeader label="Stats & Progress" />

      {/* Running Stats Row - removed RunningStreakCard, FunFactsCard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <MilestonesCard />
        <WeatherPerformanceCard />
        <FitnessAssessmentCard />
      </div>

      {/* Day of Week */}
      <div className="mb-4">
        <DayOfWeekChart />
      </div>

      {/* === SECTION 7: Long-term Progress === */}
      <SectionHeader label="Long-term Progress" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <MilestoneProgressCard />
        <PRTimelineCard />
        <YearlyComparisonCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <CumulativeMilesChart />
        <MilestoneTrackerCard />
        <PaceProgressionCard />
      </div>
    </div>
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
