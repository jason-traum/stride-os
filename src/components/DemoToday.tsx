'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ChevronRight, Check, Calendar, Target, Flag, Zap } from 'lucide-react';
import { getDemoSettings, getDemoWorkouts, type DemoWorkout, type DemoSettings } from '@/lib/demo-mode';
import { getDemoPlannedWorkouts, getDemoRaces, type DemoPlannedWorkout, type DemoRace } from '@/lib/demo-actions';
import { parseLocalDate } from '@/lib/utils';

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getWorkoutTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    recovery: 'Recovery',
    easy: 'Easy',
    steady: 'Steady',
    marathon: 'Marathon Pace',
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

function getWorkoutTypeColor(type: string): string {
  // Performance Spectrum v3: steel → sky → teal → blue → indigo → violet → red → crimson
  const colors: Record<string, string> = {
    recovery: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    easy: 'bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200',
    long: 'bg-teal-50 dark:bg-teal-900 text-teal-800 dark:text-teal-200',
    steady: 'bg-sky-50 dark:bg-sky-900 text-sky-700 dark:text-sky-200',
    marathon: 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
    tempo: 'bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200',
    threshold: 'bg-violet-50 dark:bg-violet-900 text-violet-700 dark:text-violet-200',
    interval: 'bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200',
    repetition: 'bg-rose-50 dark:bg-rose-900 text-rose-700 dark:text-rose-200',
    race: 'bg-amber-50 dark:bg-amber-900 text-amber-700 dark:text-amber-200',
    cross_train: 'bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200',
    other: 'bg-stone-100 dark:bg-stone-800 text-secondary dark:text-stone-300',
  };
  return colors[type] || 'bg-stone-100 dark:bg-stone-800 text-secondary dark:text-stone-300';
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function DemoToday() {
  const [settings, setSettings] = useState<DemoSettings | null>(null);
  const [workouts, setWorkouts] = useState<DemoWorkout[]>([]);
  const [plannedWorkouts, setPlannedWorkouts] = useState<DemoPlannedWorkout[]>([]);
  const [races, setRaces] = useState<DemoRace[]>([]);
  const [mounted, setMounted] = useState(false);

  // Function to refresh all demo data
  const refreshData = () => {
    setSettings(getDemoSettings());
    setWorkouts(getDemoWorkouts());
    setPlannedWorkouts(getDemoPlannedWorkouts());
    setRaces(getDemoRaces());
  };

  useEffect(() => {
    setMounted(true);
    refreshData();

    // Listen for demo data changes from coach chat
    const handleDemoDataChange = () => {
      refreshData();
    };

    window.addEventListener('demo-data-changed', handleDemoDataChange);
    return () => {
      window.removeEventListener('demo-data-changed', handleDemoDataChange);
    };
  }, []);

  if (!mounted) {
    return <div className="animate-pulse">Loading...</div>;
  }

  const today = new Date();
  const todayString = getTodayString();
  const greeting = getGreeting();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Find today's logged workout(s)
  const todaysWorkouts = workouts.filter((w) => w.date === todayString);
  const hasRunToday = todaysWorkouts.length > 0;

  // Find today's planned workout
  const todaysPlannedWorkout = plannedWorkouts.find((w) => w.date === todayString);

  // Recent workouts excluding today (sorted by date descending)
  const otherRecentWorkouts = workouts
    .filter((w) => w.date !== todayString)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // Get next race
  const nextRace = races
    .filter((r) => parseLocalDate(r.date) > today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const daysUntilRace = nextRace
    ? Math.ceil((parseLocalDate(nextRace.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate weekly stats (Monday start)
  const weekStart = new Date(today);
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(today.getDate() - daysToMonday);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const thisWeekWorkouts = workouts.filter((w) => w.date >= weekStartStr);
  const weeklyMileage = thisWeekWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);
  const weeklyRuns = thisWeekWorkouts.length;

  // Calculate streak
  let streak = 0;
  const checkDate = new Date(today);
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (workouts.some((w) => w.date === dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-textPrimary">
            {greeting}{settings?.name ? `, ${settings.name}` : ''}!
          </h1>
          <p className="text-textTertiary mt-1">{dateStr}</p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-2 bg-rose-50 text-rose-700 px-3 py-1.5 rounded-full">
            <span className="font-medium text-sm">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Training Summary Banner */}
      {nextRace ? (
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-sky-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <Flag className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-textPrimary">{nextRace.name}</p>
              <p className="text-xs text-textTertiary">
                {nextRace.distanceLabel} • {daysUntilRace} days
              </p>
            </div>
          </div>
          <Link href="/plan" className="link-primary text-sm">
            View Plan
          </Link>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-indigo-600 to-teal-600 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-bgSecondary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Get Your Personalized Training Plan</h2>
              <p className="text-indigo-100 text-sm mt-1">
                Set a goal race and we&apos;ll build an adaptive training plan tailored to your fitness level.
              </p>
              <Link
                href="/races"
                className="inline-flex items-center gap-2 bg-bgSecondary text-indigo-600 px-4 py-2 rounded-lg font-semibold shadow-sm hover:shadow-md mt-3 hover:bg-indigo-50 transition-colors text-sm"
              >
                <Flag className="w-4 h-4" />
                Set Your Goal Race
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Today's Planned Workout */}
      {todaysPlannedWorkout && !hasRunToday && (
        <div className="bg-bgSecondary rounded-xl border-2 border-default shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-indigo-500 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">Today&apos;s Workout</span>
                {todaysPlannedWorkout.isKeyWorkout && (
                  <span className="px-2 py-0.5 text-xs bg-bgSecondary/20 rounded-full">Key Workout</span>
                )}
              </div>
              {todaysPlannedWorkout.phase && (
                <span className="text-xs text-teal-100 capitalize">{todaysPlannedWorkout.phase} phase</span>
              )}
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-textPrimary text-lg">{todaysPlannedWorkout.name}</h3>
            <p className="text-textSecondary text-sm mt-1">{todaysPlannedWorkout.description}</p>

            {/* Workout stats */}
            <div className="flex flex-wrap gap-4 mt-3">
              {todaysPlannedWorkout.targetDistanceMiles && (
                <div className="flex items-center text-sm text-textSecondary">
                  <Target className="w-4 h-4 mr-1 text-tertiary" />
                  {todaysPlannedWorkout.targetDistanceMiles} miles
                </div>
              )}
              {todaysPlannedWorkout.targetPaceSecondsPerMile && (
                <div className="flex items-center text-sm text-textSecondary">
                  <Zap className="w-4 h-4 mr-1 text-tertiary" />
                  {formatPace(todaysPlannedWorkout.targetPaceSecondsPerMile)}/mi
                </div>
              )}
            </div>

            {/* Rationale */}
            {todaysPlannedWorkout.rationale && (
              <div className="mt-3 pt-3 border-t border-borderSecondary">
                <p className="text-xs text-textTertiary uppercase tracking-wide mb-1">Purpose</p>
                <p className="text-sm text-textSecondary">{todaysPlannedWorkout.rationale}</p>
              </div>
            )}

            {/* Action */}
            <div className="mt-4 flex gap-2">
              <Link
                href="/log"
                className="btn-primary flex-1 text-center py-2.5 rounded-xl"
              >
                Log This Workout
              </Link>
              <Link
                href="/plan"
                className="px-4 py-2.5 border border-strong rounded-xl text-textSecondary hover:bg-bgTertiary transition-colors"
              >
                View Plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Today's Run - Celebration! */}
      {hasRunToday && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-bgSecondary/20 rounded-full flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Great job today!</h2>
              <p className="text-green-100 text-sm">You got your run in</p>
            </div>
          </div>

          {todaysWorkouts.map((workout) => (
            <div
              key={workout.id}
              className="bg-bgSecondary/10 rounded-lg p-4 mt-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {getWorkoutTypeLabel(workout.workoutType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-green-100">
                    <span>{workout.distanceMiles.toFixed(1)} mi</span>
                    <span>{formatDuration(workout.durationMinutes)}</span>
                    <span>{formatPace(workout.avgPaceSeconds)} /mi</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Run CTA */}
      {!hasRunToday ? (
        <Link
          href="/log"
          className="block bg-accentTeal hover:bg-accentTeal-hover text-white rounded-xl p-5 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Log a Run</h2>
              <p className="text-teal-100 text-sm mt-0.5">Record your workout and track progress</p>
            </div>
            <Plus className="w-6 h-6" />
          </div>
        </Link>
      ) : (
        <Link
          href="/log"
          className="block bg-bgSecondary hover:bg-bgTertiary border border-borderPrimary rounded-xl p-4 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center">
                <Plus className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="font-medium text-textPrimary">Log another run</p>
                <p className="text-sm text-textTertiary">Double day?</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-tertiary" />
          </div>
        </Link>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/pace-calculator"
          className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 hover:border-strong transition-colors shadow-sm"
        >
          <p className="font-medium text-textPrimary">Pace Calculator</p>
          <p className="text-sm text-textTertiary">Full calculator</p>
        </Link>
        <Link
          href="/history"
          className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 hover:border-strong transition-colors shadow-sm"
        >
          <p className="font-medium text-textPrimary">Workout History</p>
          <p className="text-sm text-textTertiary">View all runs</p>
        </Link>
      </div>

      {/* Weekly Stats */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4">This Week</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-textPrimary">{weeklyMileage.toFixed(1)}</p>
            <p className="text-sm text-textTertiary">miles</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-textPrimary">{weeklyRuns}</p>
            <p className="text-sm text-textTertiary">runs</p>
          </div>
        </div>
        {settings?.peakWeeklyMileageTarget && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-textSecondary">Weekly target</span>
              <span className="text-textPrimary font-medium">{settings.peakWeeklyMileageTarget} mi</span>
            </div>
            <div className="h-2 bg-bgTertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${Math.min((weeklyMileage / settings.peakWeeklyMileageTarget) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Recent Workouts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-textPrimary">Recent Workouts</h2>
          <Link href="/history" className="link-primary text-sm">
            View all
          </Link>
        </div>

        {otherRecentWorkouts.length === 0 && !hasRunToday ? (
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 text-center text-textTertiary shadow-sm">
            <p>No workouts logged yet.</p>
            <p className="text-sm mt-1">Log your first run to get started!</p>
          </div>
        ) : otherRecentWorkouts.length === 0 ? (
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 text-center text-textTertiary shadow-sm">
            <p>Today was your first logged run!</p>
            <p className="text-sm mt-1">Keep it up and build your streak.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {otherRecentWorkouts.map((workout) => (
              <div
                key={workout.id}
                className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-textPrimary">
                        {formatDate(workout.date)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getWorkoutTypeColor(
                          workout.workoutType
                        )}`}
                      >
                        {getWorkoutTypeLabel(workout.workoutType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-textSecondary">
                      <span>{workout.distanceMiles.toFixed(1)} mi</span>
                      <span>{formatPace(workout.avgPaceSeconds)} /mi</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-sm text-tertiary mt-6">
        Demo Mode - Data stored locally in your browser
      </p>
    </div>
  );
}
