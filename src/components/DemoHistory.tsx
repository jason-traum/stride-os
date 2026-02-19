'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { isDemoMode, getDemoWorkouts, type DemoWorkout } from '@/lib/demo-mode';
import { formatPace } from '@/lib/utils';

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

function getTypeColor(type: string): string {
  // Performance Spectrum v3: steel → sky → teal → blue → indigo → violet → red → crimson
  const colors: Record<string, string> = {
    recovery: 'bg-slate-800 text-slate-300',
    easy: 'bg-sky-900 text-sky-200',
    long: 'bg-dream-900 text-dream-200',
    steady: 'bg-sky-900 text-sky-200',
    marathon: 'bg-blue-900 text-blue-200',
    tempo: 'bg-indigo-900 text-indigo-200',
    threshold: 'bg-violet-900 text-violet-200',
    interval: 'bg-red-900 text-red-200',
    repetition: 'bg-rose-900 text-rose-200',
    race: 'bg-amber-900 text-amber-200',
    cross_train: 'bg-violet-900 text-violet-200',
    other: 'bg-surface-2 text-textSecondary',
  };
  return colors[type] || 'bg-surface-2 text-textSecondary';
}

function getTypeLabel(type: string): string {
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

export function DemoHistory() {
  const [workouts, setWorkouts] = useState<DemoWorkout[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  const loadWorkouts = () => {
    const demoWorkouts = getDemoWorkouts();
    // Sort by date descending
    demoWorkouts.sort((a, b) => b.date.localeCompare(a.date));
    setWorkouts(demoWorkouts);
  };

  useEffect(() => {
    if (isDemoMode()) {
      setIsDemo(true);
      loadWorkouts();

      // Listen for demo data changes from coach chat
      const handleDemoDataChange = () => {
        loadWorkouts();
      };

      window.addEventListener('demo-data-changed', handleDemoDataChange);
      return () => {
        window.removeEventListener('demo-data-changed', handleDemoDataChange);
      };
    }
  }, []);

  if (!isDemo) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-semibold text-textPrimary">History</h1>
        <Link
          href="/log"
          className="btn-primary rounded-lg text-sm"
        >
          Log Run
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-8 text-center shadow-sm">
          <div className="text-tertiary mb-4">
            <Clock className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-lg font-medium text-textPrimary mb-2">No workouts yet</h2>
          <p className="text-textTertiary mb-4">Start logging your runs to track your progress.</p>
          <Link
            href="/log"
            className="btn-primary rounded-lg text-sm"
          >
            Log your first run
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((workout) => (
            <div
              key={workout.id}
              className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:border-strong transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-textPrimary">
                      {formatDate(workout.date)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(workout.workoutType)}`}>
                      {getTypeLabel(workout.workoutType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-textSecondary">
                    <span>{workout.distanceMiles.toFixed(1)} mi</span>
                    <span>{formatDuration(workout.durationMinutes)}</span>
                    <span>{formatPace(workout.avgPaceSeconds)}/mi</span>
                  </div>
                  {workout.notes && (
                    <p className="text-sm text-textTertiary mt-1">{workout.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-tertiary mt-6">
        Demo Mode - Data stored locally in your browser
      </p>
    </div>
  );
}
