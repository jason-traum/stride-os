import { getAnalyticsData } from '@/actions/analytics';
import { BarChart2, TrendingUp, Activity, Clock, Target } from 'lucide-react';

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

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  // Calculate max weekly mileage for chart scaling
  const maxWeeklyMiles = Math.max(...data.weeklyStats.map(w => w.totalMiles), 1);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Your running stats from the last 90 days</p>
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
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-slate-900">Weekly Mileage</h2>
        </div>

        {data.weeklyStats.length > 0 ? (
          <div className="space-y-3">
            {data.weeklyStats.map((week) => {
              const weekDate = new Date(week.weekStart);
              const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const barWidth = (week.totalMiles / maxWeeklyMiles) * 100;

              return (
                <div key={week.weekStart} className="flex items-center gap-3">
                  <div className="w-16 text-xs text-slate-500 flex-shrink-0">{weekLabel}</div>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  </div>
                  <div className="w-16 text-sm font-medium text-slate-700 text-right">
                    {week.totalMiles.toFixed(1)} mi
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">No workout data yet</p>
        )}
      </div>

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

      {/* Recent Paces */}
      {data.recentPaces.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Recent Paces</h2>
          <div className="space-y-2">
            {data.recentPaces.slice(-10).map((pace, index) => {
              const date = new Date(pace.date);
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={index} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">{dateStr}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getTypeColor(pace.workoutType)}`}>
                      {getTypeLabel(pace.workoutType)}
                    </span>
                  </div>
                  <span className="font-medium text-slate-900">{formatPace(pace.paceSeconds)}/mi</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
