'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Activity, Clock, Target, Timer, Zap, Gauge, Trophy, Flag } from 'lucide-react';
import { isDemoMode, getDemoWorkouts, getDemoSettings, type DemoWorkout, type DemoSettings } from '@/lib/demo-mode';
import { WeeklyMileageChart, FitnessTrendChart, PaceTrendChart, ActivityHeatmap } from '@/components/charts';
import { getDemoRaceResults } from '@/lib/demo-actions';
import { calculatePaceZones, calculateRacePredictions } from '@/lib/training/vdot-calculator';
import { BestEffortsTable, PaceCurveChart } from '@/components/BestEfforts';
import { RunningStreakCard, MilestonesCard, DayOfWeekChart } from '@/components/RunningStats';
import { CumulativeMilesChart } from '@/components/ProgressTracking';

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
  const colors: Record<string, string> = {
    easy: 'bg-green-500',
    long: 'bg-amber-500',
    tempo: 'bg-orange-500',
    interval: 'bg-red-500',
    recovery: 'bg-cyan-500',
    race: 'bg-purple-500',
    steady: 'bg-yellow-500',
    cross_train: 'bg-pink-500',
    other: 'bg-stone-500',
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

// Format time for race predictions
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Get fitness level based on VDOT
function getFitnessLevel(vdot: number): string {
  if (vdot >= 70) return 'Elite';
  if (vdot >= 60) return 'Advanced';
  if (vdot >= 50) return 'Intermediate';
  if (vdot >= 40) return 'Recreational';
  return 'Beginner';
}

// Calculate race predictions from VDOT
function getRacePredictionsFromVdot(vdot: number) {
  const distances = [
    { name: '1 Mile', meters: 1609 },
    { name: '5K', meters: 5000 },
    { name: '10K', meters: 10000 },
    { name: 'Half Marathon', meters: 21097 },
    { name: 'Marathon', meters: 42195 },
  ];

  return distances.map(d => {
    // Calculate predicted time using VDOT formula (inverse of VDOT calculation)
    // This is an approximation based on Jack Daniels' tables
    const velocity = (vdot + 4.60) / 0.182258; // Simplified
    const timeMinutes = d.meters / velocity;
    const timeSeconds = Math.round(timeMinutes * 60);
    const paceSeconds = Math.round(timeSeconds / (d.meters / 1609.34));

    return {
      distance: d.name,
      predictedTimeSeconds: timeSeconds,
      predictedPaceSeconds: paceSeconds,
      confidence: 'high' as const,
    };
  });
}

export function DemoAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [settings, setSettings] = useState<DemoSettings | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const loadData = () => {
    const workouts = getDemoWorkouts();
    const demoSettings = getDemoSettings();
    setData(calculateDemoAnalytics(workouts));
    setSettings(demoSettings);
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

  const vdot = settings?.vdot || null;
  const racePredictions = vdot ? getRacePredictionsFromVdot(vdot) : null;
  const fitnessLevel = vdot ? getFitnessLevel(vdot) : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-stone-900">Analytics</h1>
        <p className="text-sm text-stone-500 mt-1">Your running stats from the last 90 days</p>
      </div>

      {/* VDOT & Fitness Card */}
      {vdot && (
        <div className="bg-gradient-to-r from-purple-50 to-amber-50 rounded-xl p-5 border border-purple-200 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-stone-900">Current Fitness</span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <p className="text-4xl font-bold text-purple-600">{vdot}</p>
                  <p className="text-sm text-stone-500">VDOT</p>
                </div>
                <div className="h-12 w-px bg-purple-200" />
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                    {fitnessLevel} Runner
                  </span>
                </div>
              </div>
            </div>
            {settings?.easyPaceSeconds && (
              <div className="text-right">
                <p className="text-sm text-stone-500">Easy Pace</p>
                <p className="text-xl font-bold text-stone-900">{formatPace(settings.easyPaceSeconds)}/mi</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-stone-500 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium">Workouts</span>
          </div>
          <p className="text-2xl font-bold text-stone-900">{data.totalWorkouts}</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-stone-500 mb-2">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium">Total Miles</span>
          </div>
          <p className="text-2xl font-bold text-stone-900">{data.totalMiles}</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-stone-500 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Time Running</span>
          </div>
          <p className="text-2xl font-bold text-stone-900">{formatDuration(data.totalMinutes)}</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-stone-500 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Avg Pace</span>
          </div>
          <p className="text-2xl font-bold text-stone-900">
            {data.avgPaceSeconds ? formatPace(data.avgPaceSeconds) : '--'}
            <span className="text-sm font-normal text-stone-500">/mi</span>
          </p>
        </div>
      </div>

      {/* Race Predictions & Training Paces */}
      {vdot && racePredictions && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Race Predictions Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-stone-900 flex items-center gap-2">
                <Timer className="w-5 h-5 text-purple-500" />
                Race Predictions
              </h2>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-bold text-sm">
                VDOT {vdot}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 border-b border-stone-100">
                    <th className="pb-2 font-medium">Distance</th>
                    <th className="pb-2 font-medium">Predicted</th>
                    <th className="pb-2 font-medium">Pace</th>
                  </tr>
                </thead>
                <tbody>
                  {racePredictions.map((pred) => (
                    <tr key={pred.distance} className="border-b border-stone-50">
                      <td className="py-3">
                        <span className="font-medium text-stone-900">{pred.distance}</span>
                      </td>
                      <td className="py-3">
                        <span className="font-mono font-semibold text-stone-900">
                          {formatTime(pred.predictedTimeSeconds)}
                        </span>
                      </td>
                      <td className="py-3 text-stone-600">
                        {formatPace(pred.predictedPaceSeconds)}/mi
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Training Paces Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-stone-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                Training Paces
              </h2>
              <span className="text-xs text-stone-500">Based on VDOT {vdot}</span>
            </div>

            <div className="space-y-3">
              {settings?.easyPaceSeconds && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full bg-green-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-stone-900">Easy</span>
                      <span className="font-mono text-stone-700">{formatPace(settings.easyPaceSeconds)}/mi</span>
                    </div>
                    <p className="text-xs text-stone-500">Conversational pace for recovery</p>
                  </div>
                </div>
              )}
              {settings?.marathonPaceSeconds && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full bg-amber-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-stone-900">Marathon</span>
                      <span className="font-mono text-stone-700">{formatPace(settings.marathonPaceSeconds)}/mi</span>
                    </div>
                    <p className="text-xs text-stone-500">Goal marathon race pace</p>
                  </div>
                </div>
              )}
              {settings?.thresholdPaceSeconds && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full bg-yellow-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-stone-900">Threshold</span>
                      <span className="font-mono text-stone-700">{formatPace(settings.thresholdPaceSeconds)}/mi</span>
                    </div>
                    <p className="text-xs text-stone-500">Lactate threshold effort</p>
                  </div>
                </div>
              )}
              {settings?.intervalPaceSeconds && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full bg-red-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-stone-900">Interval</span>
                      <span className="font-mono text-stone-700">{formatPace(settings.intervalPaceSeconds)}/mi</span>
                    </div>
                    <p className="text-xs text-stone-500">VO2max development</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Mileage Chart */}
      <div className="mb-6">
        <WeeklyMileageChart data={data.weeklyStats} />
      </div>

      {/* Pace Trend Chart */}
      {data.recentPaces.length > 3 && (
        <div className="mb-6">
          <PaceTrendChart data={data.recentPaces} />
        </div>
      )}

      {/* Best Efforts & Pace Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BestEffortsTable />
        <PaceCurveChart />
      </div>

      {/* Running Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <RunningStreakCard />
        <MilestonesCard />
        <DayOfWeekChart />
      </div>

      {/* Cumulative Miles */}
      <div className="mb-6">
        <CumulativeMilesChart />
      </div>

      {/* Workout Type Distribution */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm mb-6">
        <h2 className="font-semibold text-stone-900 mb-4">Workout Types</h2>

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
                  <span className="text-sm text-stone-700">
                    {getTypeLabel(type.type)}: <span className="font-medium">{type.count}</span>
                    <span className="text-stone-400 ml-1">({type.miles} mi)</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-stone-500 text-center py-8">No workout data yet</p>
        )}
      </div>

      <p className="text-center text-sm text-stone-400 mt-6">
        Demo Mode - Data stored locally in your browser
      </p>
    </div>
  );
}
