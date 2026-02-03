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
    easy: 'bg-green-100 text-green-700',
    long: 'bg-blue-100 text-blue-700',
    tempo: 'bg-orange-100 text-orange-700',
    interval: 'bg-red-100 text-red-700',
    recovery: 'bg-cyan-100 text-cyan-700',
    race: 'bg-purple-100 text-purple-700',
  };
  return colors[type] || 'bg-slate-100 text-slate-700';
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
        <h1 className="text-2xl font-display font-semibold text-slate-900">History</h1>
        <Link
          href="/log"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Log Run
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="text-slate-300 mb-4">
            <Clock className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-lg font-medium text-slate-900 mb-2">No workouts yet</h2>
          <p className="text-slate-500 mb-4">Start logging your runs to track your progress.</p>
          <Link
            href="/log"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Log your first run
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((workout) => (
            <div
              key={workout.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-900">
                      {formatDate(workout.date)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(workout.workoutType)}`}>
                      {getTypeLabel(workout.workoutType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span>{workout.distanceMiles.toFixed(1)} mi</span>
                    <span>{formatDuration(workout.durationMinutes)}</span>
                    <span>{formatPace(workout.avgPaceSeconds)}/mi</span>
                  </div>
                  {workout.notes && (
                    <p className="text-sm text-slate-500 mt-1">{workout.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-slate-400 mt-6">
        Demo Mode - Data stored locally in your browser
      </p>
    </div>
  );
}
