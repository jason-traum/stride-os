'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Activity, Clock, Target } from 'lucide-react';
import { isDemoMode, getDemoWorkouts, type DemoWorkout } from '@/lib/demo-mode';
import { WeeklyMileageChart } from '@/components/charts';

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

function getTypeColor(type: string): string {
  // Performance Spectrum v3: steel → sky → teal → blue → indigo → violet → red → crimson
  const colors: Record<string, string> = {
    recovery: 'bg-slate-400',
    easy: 'bg-sky-400',
    long: 'bg-teal-500',
    steady: 'bg-sky-500',
    marathon: 'bg-blue-500',
    tempo: 'bg-indigo-500',
    threshold: 'bg-violet-500',
    interval: 'bg-red-500',
    repetition: 'bg-rose-600',
    race: 'bg-amber-500',
    cross_train: 'bg-violet-400',
    other: 'bg-stone-400',
  };
  return colors[type] || colors.other;
}

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

interface AnalyticsData {
  totalWorkouts: number;
  totalMiles: number;
  totalMinutes: number;
  avgPaceSeconds: number | null;
  weeklyStats: { weekStart: string; miles: number }[];
  workoutTypeDistribution: { type: string; count: number; miles: number }[];
  recentPaces: { date: string; paceSeconds: number; workoutType: string }[];
}

function calculateDemoAnalytics(workouts: DemoWorkout[]): AnalyticsData {
  const totalWorkouts = workouts.length;
  const totalMiles = workouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalMinutes = workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  const workoutsWithPace = workouts.filter(w => w.avgPaceSeconds);
  const avgPaceSeconds = workoutsWithPace.length > 0
    ? Math.round(workoutsWithPace.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / workoutsWithPace.length)
    : null;

  // Weekly stats
  const weeklyMap = new Map<string, number>();
  for (const workout of workouts) {
    const date = new Date(workout.date);
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekStart = monday.toISOString().split('T')[0];

    const existing = weeklyMap.get(weekStart) || 0;
    weeklyMap.set(weekStart, existing + (workout.distanceMiles || 0));
  }

  const weeklyStats = Array.from(weeklyMap.entries())
    .map(([weekStart, miles]) => ({ weekStart, miles }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-8);

  // Workout type distribution
  const typeMap = new Map<string, { count: number; miles: number }>();
  for (const workout of workouts) {
    const type = workout.workoutType || 'other';
    const existing = typeMap.get(type) || { count: 0, miles: 0 };
    existing.count += 1;
    existing.miles += workout.distanceMiles || 0;
    typeMap.set(type, existing);
  }

  const workoutTypeDistribution = Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      miles: Math.round(data.miles * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  // Recent paces
  const recentPaces = workouts
    .filter(w => w.avgPaceSeconds)
    .slice(0, 20)
    .map(w => ({
      date: w.date,
      paceSeconds: w.avgPaceSeconds!,
      workoutType: w.workoutType || 'other',
    }))
    .reverse();

  return {
    totalWorkouts,
    totalMiles: Math.round(totalMiles * 10) / 10,
    totalMinutes: Math.round(totalMinutes),
    avgPaceSeconds,
    weeklyStats,
    workoutTypeDistribution,
    recentPaces,
  };
}

export function DemoAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const loadData = () => {
    const workouts = getDemoWorkouts();
    setData(calculateDemoAnalytics(workouts));
  };

  useEffect(() => {
    if (isDemoMode()) {
      setIsDemo(true);
      loadData();

      // Listen for demo data changes from coach chat
      const handleDemoDataChange = () => {
        loadData();
      };

      window.addEventListener('demo-data-changed', handleDemoDataChange);
      return () => {
        window.removeEventListener('demo-data-changed', handleDemoDataChange);
      };
    }
  }, []);

  if (!isDemo || !data) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-textPrimary">Analytics</h1>
        <p className="text-sm text-textTertiary mt-1">Your running stats (Demo Mode)</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <div className="flex items-center gap-2 text-textTertiary mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium">Workouts</span>
          </div>
          <p className="text-2xl font-bold text-textPrimary">{data.totalWorkouts}</p>
        </div>

        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <div className="flex items-center gap-2 text-textTertiary mb-2">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium">Total Miles</span>
          </div>
          <p className="text-2xl font-bold text-textPrimary">{data.totalMiles}</p>
        </div>

        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <div className="flex items-center gap-2 text-textTertiary mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Time Running</span>
          </div>
          <p className="text-2xl font-bold text-textPrimary">{formatDuration(data.totalMinutes)}</p>
        </div>

        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <div className="flex items-center gap-2 text-textTertiary mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Avg Pace</span>
          </div>
          <p className="text-2xl font-bold text-textPrimary">
            {data.avgPaceSeconds ? formatPace(data.avgPaceSeconds) : '--'}
            <span className="text-sm font-normal text-textTertiary">/mi</span>
          </p>
        </div>
      </div>

      {/* Weekly Mileage Chart */}
      <div className="mb-6">
        <WeeklyMileageChart data={data.weeklyStats} />
      </div>

      {/* Workout Type Distribution */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm mb-6">
        <h2 className="font-semibold text-textPrimary mb-4">Workout Types</h2>

        {data.workoutTypeDistribution.length > 0 ? (
          <>
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

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {data.workoutTypeDistribution.map((type) => (
                <div key={type.type} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getTypeColor(type.type)}`} />
                  <span className="text-sm text-textSecondary">
                    {getTypeLabel(type.type)}: <span className="font-medium">{type.count}</span>
                    <span className="text-tertiary ml-1">({type.miles} mi)</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-textTertiary text-center py-8">No workout data yet</p>
        )}
      </div>

      {/* Recent Paces */}
      {data.recentPaces.length > 0 && (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4">Recent Paces</h2>
          <div className="space-y-2">
            {data.recentPaces.slice(-10).map((pace, index) => {
              const date = new Date(pace.date);
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={index} className="flex items-center justify-between py-1 border-b border-borderSecondary last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-textTertiary">{dateStr}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getTypeColor(pace.workoutType)}`}>
                      {getTypeLabel(pace.workoutType)}
                    </span>
                  </div>
                  <span className="font-medium text-textPrimary">{formatPace(pace.paceSeconds)}/mi</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
