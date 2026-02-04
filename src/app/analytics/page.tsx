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
import { RunningStreakCard, MilestonesCard, DayOfWeekChart, WeatherPerformanceCard, FunFactsCard } from '@/components/RunningStats';
import { RecoveryStatusCard, WeeklyLoadCard, TrainingInsightsCard } from '@/components/RecoveryStatus';
import { FitnessAssessmentCard, FitnessAgeCard, MilestoneProgressCard } from '@/components/FitnessAssessment';
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

// Get workout type color
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    easy: 'bg-teal-300',      // Lighter mint green for easy
    long: 'bg-teal-400',
    tempo: 'bg-rose-400',
    interval: 'bg-fuchsia-500',
    recovery: 'bg-cyan-300',
    race: 'bg-purple-500',
    steady: 'bg-slate-400',
    cross_train: 'bg-pink-400',
    other: 'bg-stone-400',
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
          <h1 className="text-2xl font-display font-semibold text-stone-900">Analytics</h1>
          <p className="text-sm text-stone-500 mt-1">Your running stats from the last 90 days</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <EmptyState variant="analytics" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-stone-900">Analytics</h1>
        <p className="text-sm text-stone-500 mt-1">Your running stats from the last 90 days</p>
      </div>

      {/* === SECTION 1: Quick Overview === */}
      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-stone-500 mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Workouts</span>
          </div>
          <p className="text-xl font-bold text-stone-900">{data.totalWorkouts}</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-stone-500 mb-1">
            <Target className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Miles</span>
          </div>
          <p className="text-xl font-bold text-stone-900">{data.totalMiles}</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-stone-500 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Time</span>
          </div>
          <p className="text-xl font-bold text-stone-900">{formatDuration(data.totalMinutes)}</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-stone-500 mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Avg Pace</span>
          </div>
          <p className="text-xl font-bold text-stone-900">
            {data.avgPaceSeconds ? formatPace(data.avgPaceSeconds) : '--'}
            <span className="text-xs font-normal text-stone-500">/mi</span>
          </p>
        </div>
      </div>

      {/* Volume Summary + Recovery Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <VolumeSummaryCards
          thisWeekMiles={volumeData.thisWeekMiles}
          lastWeekMiles={volumeData.lastWeekMiles}
          thisMonthMiles={volumeData.thisMonthMiles}
          lastMonthMiles={volumeData.lastMonthMiles}
          ytdMiles={volumeData.ytdMiles}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RecoveryStatusCard />
          <WeeklyLoadCard />
          <TrainingInsightsCard />
        </div>
      </div>

      {/* === SECTION 2: Training Load & Fitness === */}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <RacePredictorCard />
        <VDOTPacesCard />
      </div>

      <div className="mb-4">
        <GoalRaceCalculator />
      </div>

      {/* === SECTION 5: Activity History === */}
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
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <h2 className="font-semibold text-stone-900 mb-3 text-sm">Workout Types</h2>
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
                    <span className="text-xs text-stone-700">
                      {getTypeLabel(type.type)}: <span className="font-medium">{type.count}</span>
                      <span className="text-stone-400 ml-0.5">({type.miles}mi)</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-stone-500 text-center py-6 text-sm">No workout data yet</p>
          )}
        </div>
      </div>

      {/* Rollup Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <WeeklyRollupTable />
        <MonthlyRollupCards />
      </div>

      {/* === SECTION 6: Stats & Progress === */}
      {/* Running Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <RunningStreakCard />
        <MilestonesCard />
        <WeatherPerformanceCard />
        <FunFactsCard />
      </div>

      {/* Day of Week + Fitness Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <DayOfWeekChart />
        <FitnessAssessmentCard />
      </div>

      {/* === SECTION 7: Long-term Progress === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <FitnessAgeCard />
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
