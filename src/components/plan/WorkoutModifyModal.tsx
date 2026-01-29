'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  X,
  Minus,
  ArrowRightLeft,
  Calendar,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

interface PlannedWorkout {
  id: number;
  date: string;
  name: string;
  description: string;
  workoutType: string;
  targetDistanceMiles: number | null;
  targetDurationMinutes: number | null;
  targetPaceSecondsPerMile: number | null;
  rationale: string | null;
  isKeyWorkout: boolean | null;
  status: 'scheduled' | 'completed' | 'skipped' | 'modified' | null;
  structure: string | null;
  alternatives: string | null;
}

interface WorkoutModifyModalProps {
  workout: PlannedWorkout;
  isOpen: boolean;
  onClose: () => void;
  onScaleDown: (factor: number) => Promise<void>;
  onSwap: (alternativeId: string) => Promise<void>;
  onMove: (newDate: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onMarkComplete: () => Promise<void>;
  onSkip: () => Promise<void>;
  alternatives?: Array<{ id: string; name: string; description: string }>;
}

const SCALE_OPTIONS = [
  { factor: 0.75, label: '75%', description: 'Light day - reduce volume' },
  { factor: 0.5, label: '50%', description: 'Recovery - half the work' },
  { factor: 0.25, label: '25%', description: 'Very easy - just move a bit' },
];

export function WorkoutModifyModal({
  workout,
  isOpen,
  onClose,
  onScaleDown,
  onSwap,
  onMove,
  onDelete,
  onMarkComplete,
  onSkip,
  alternatives = [],
}: WorkoutModifyModalProps) {
  const [activeTab, setActiveTab] = useState<'actions' | 'scale' | 'swap' | 'move'>('actions');
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState(workout.date);

  if (!isOpen) return null;

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
      onClose();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-900">{workout.name}</h3>
            <p className="text-sm text-slate-500">{formatDate(workout.date)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {['actions', 'scale', 'swap', 'move'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={cn(
                'flex-1 py-2 text-sm font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}

          {!loading && activeTab === 'actions' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">
                Quick actions for this workout
              </p>

              {workout.status === 'scheduled' && (
                <>
                  <button
                    onClick={() => handleAction(onMarkComplete)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-green-700">Mark Complete</p>
                      <p className="text-xs text-green-600">I did this workout</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleAction(onSkip)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-slate-500" />
                    <div className="text-left">
                      <p className="font-medium text-slate-700">Skip Workout</p>
                      <p className="text-xs text-slate-500">I could not do this one</p>
                    </div>
                  </button>
                </>
              )}

              <button
                onClick={() => handleAction(onDelete)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-5 h-5 text-red-500" />
                <div className="text-left">
                  <p className="font-medium text-red-600">Delete / Make Rest Day</p>
                  <p className="text-xs text-red-500">Remove this workout from the plan</p>
                </div>
              </button>
            </div>
          )}

          {!loading && activeTab === 'scale' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">
                Not feeling your best? Scale down the workout intensity.
              </p>

              {SCALE_OPTIONS.map((option) => (
                <button
                  key={option.factor}
                  onClick={() => handleAction(() => onScaleDown(option.factor))}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Minus className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium text-slate-700">{option.label}</p>
                    <p className="text-xs text-slate-500">{option.description}</p>
                  </div>
                  {workout.targetDistanceMiles && (
                    <span className="text-sm text-slate-500">
                      {(workout.targetDistanceMiles * option.factor).toFixed(1)} mi
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && activeTab === 'swap' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">
                Swap this workout for an alternative.
              </p>

              {alternatives.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <ArrowRightLeft className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p>No alternatives available</p>
                  <p className="text-sm">Try scaling down instead</p>
                </div>
              ) : (
                alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    onClick={() => handleAction(() => onSwap(alt.id))}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <ArrowRightLeft className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-700">{alt.name}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{alt.description}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {!loading && activeTab === 'move' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 mb-4">
                Reschedule this workout to a different day.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                onClick={() => handleAction(() => onMove(newDate))}
                disabled={newDate === workout.date}
                className={cn(
                  'w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-colors',
                  newDate === workout.date
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                <Calendar className="w-5 h-5" />
                Move to {formatDate(newDate)}
              </button>

              <p className="text-xs text-slate-500 text-center">
                If there is already a workout on that day, they will be swapped.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
