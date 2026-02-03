// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

import { getAnalyticsData, getDailyActivityData, getVolumeSummaryData, getCalendarData } from '@/actions/analytics';
import { getFitnessTrendData, getTrainingLoadData } from '@/actions/fitness';
import { getSettings } from '@/actions/settings';
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
    easy: 'bg-green-500',
    long: 'bg-blue-500',
    tempo: 'bg-orange-500',
    interval: 'bg-red-500',
    recovery: 'bg-cyan-500',
    race: 'bg-purple-500',
    steady: 'bg-yellow-500',
    cross_train: 'bg-pink-500',
    other: 'bg-slate-500',
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
  const [data, fitnessData, loadData, dailyActivity, volumeData, calendarData, settings] = await Promise.all([
    getAnalyticsData(),
    getFitnessTrendData(90),
    getTrainingLoadData(),
    getDailyActivityData(12),
    getVolumeSummaryData(),
    getCalendarData(),
    getSettings(),
  ]);

  // Transform weekly stats for the chart
  const chartData = data.weeklyStats.map(w => ({
    weekStart: w.weekStart,
    miles: w.totalMiles,
  }));

  // Show empty state if no workouts
  if (data.totalWorkouts === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-display font-semibold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Your running stats from the last 90 days</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <EmptyState variant="analytics" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Your running stats from the last 90 days</p>
      </div>

      {/* Recovery & Training Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <RecoveryStatusCard />
        <WeeklyLoadCard />
        <TrainingInsightsCard />
      </div>

      {/* Volume Summary Cards */}
      <div className="mb-6">
        <VolumeSummaryCards
          thisWeekMiles={volumeData.thisWeekMiles}
          lastWeekMiles={volumeData.lastWeekMiles}
          thisMonthMiles={volumeData.thisMonthMiles}
          lastMonthMiles={volumeData.lastMonthMiles}
          ytdMiles={volumeData.ytdMiles}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium">Workouts</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{data.totalWorkouts}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium">Total Miles</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{data.totalMiles}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Time Running</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatDuration(data.totalMinutes)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Avg Pace</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {data.avgPaceSeconds ? formatPace(data.avgPaceSeconds) : '--'}
            <span className="text-sm font-normal text-slate-500">/mi</span>
          </p>
        </div>
      </div>

      {/* Weekly Mileage Chart */}
      <div className="mb-6">
        <WeeklyMileageChart data={chartData} />
      </div>

      {/* Fitness Trend Chart (CTL/ATL/TSB) */}
      {fitnessData.metrics.length > 7 && (
        <div className="mb-6">
          <FitnessTrendChart
            data={fitnessData.metrics}
            currentCtl={fitnessData.currentCtl}
            currentAtl={fitnessData.currentAtl}
            currentTsb={fitnessData.currentTsb}
            status={fitnessData.status}
            ctlChange={fitnessData.ctlChange}
          />
        </div>
      )}

      {/* Training Load Bar */}
      {loadData.current7DayLoad > 0 && (
        <div className="mb-6">
          <TrainingLoadBar
            currentLoad={loadData.current7DayLoad}
            optimalMin={loadData.optimalMin}
            optimalMax={loadData.optimalMax}
            previousLoad={loadData.previous7DayLoad}
            percentChange={loadData.percentChange}
          />
        </div>
      )}

      {/* Personal Bests & Pace Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BestEffortsTable />
        <BestMileSplits />
      </div>

      <div className="mb-6">
        <PaceCurveChart />
      </div>

      {/* Race Predictions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <RacePredictorCard />
        <VDOTPacesCard />
      </div>

      <div className="mb-6">
        <GoalRaceCalculator />
      </div>

      {/* Training Distribution Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TrainingDistributionChart />
        <TrainingLoadRecommendation />
      </div>

      {/* Training Focus - 80/20 Analysis */}
      {data.workoutTypeDistribution.length > 0 && (
        <div className="mb-6">
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
        </div>
      )}

      {/* Workout Type Distribution */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">Workout Types</h2>

        {data.workoutTypeDistribution.length > 0 ? (
          <>
            {/* Distribution bar */}
            <div className="h-8 rounded-full overflow-hidden flex mb-4">
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

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {data.workoutTypeDistribution.map((type) => (
                <div key={type.type} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getTypeColor(type.type)}`} />
                  <span className="text-sm text-slate-700">
                    {getTypeLabel(type.type)}: <span className="font-medium">{type.count}</span>
                    <span className="text-slate-400 ml-1">({type.miles} mi)</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-slate-500 text-center py-8">No workout data yet</p>
        )}
      </div>

      {/* Pace Trend Chart */}
      {data.recentPaces.length > 3 && (
        <div className="mb-6">
          <PaceTrendChart data={data.recentPaces} />
        </div>
      )}

      {/* Activity Heatmap */}
      {dailyActivity.length > 0 && (
        <div className="mb-6">
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

      {/* Monthly Calendar */}
      {calendarData.length > 0 && (
        <div className="mb-6">
          <MonthlyCalendar workouts={calendarData} />
        </div>
      )}

      {/* Weekly Rollup Table */}
      <div className="mb-6">
        <WeeklyRollupTable />
      </div>

      {/* Monthly Rollup Cards */}
      <div className="mb-6">
        <MonthlyRollupCards />
      </div>

      {/* Running Stats & Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <RunningStreakCard />
        <MilestonesCard />
        <DayOfWeekChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <WeatherPerformanceCard />
        <FunFactsCard />
      </div>

      {/* Fitness Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <FitnessAssessmentCard />
        <FitnessAgeCard />
        <MilestoneProgressCard />
      </div>

      {/* Progress Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PRTimelineCard />
        <YearlyComparisonCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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
