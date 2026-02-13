'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { isDemoMode, getDemoWorkouts, type DemoWorkout } from '@/lib/demo-mode';

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

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    easy: 'bg-teal-50 text-teal-700 dark:text-teal-300',
    long: 'bg-teal-100 text-teal-700 dark:text-teal-300',
    tempo: 'bg-rose-50 text-rose-700',
    interval: 'bg-fuchsia-50 text-fuchsia-700 dark:text-fuchsia-300',
    recovery: 'bg-cyan-50 text-cyan-700',
    race: 'bg-purple-100 text-purple-700',
  };
  return colors[type] || 'bg-stone-100 text-textSecondary';
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    easy: 'Easy',
    long: 'Long',
    tempo: 'Tempo',
    interval: 'Interval',
    recovery: 'Recovery',
    race: 'Race',
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
