'use client';

import { useState, useTransition } from 'react';
import { X, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logQuickWorkout } from '@/actions/quick-log';
import { useModalBodyLock } from '@/hooks/useModalBodyLock';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultDistance?: number;
  defaultDuration?: number;
  defaultType?: string;
}

const WORKOUT_TYPES = [
  { value: 'recovery', label: 'Recovery', color: 'bg-slate-900/40 text-slate-300 border-slate-600' },
  { value: 'easy', label: 'Easy', color: 'bg-sky-900/40 text-sky-200 border-sky-600' },
  { value: 'long', label: 'Long', color: 'bg-dream-900/40 text-dream-200 border-dream-600' },
  { value: 'steady', label: 'Steady', color: 'bg-sky-900/30 text-sky-200 border-sky-600' },
  { value: 'marathon', label: 'Marathon', color: 'bg-blue-900/40 text-blue-200 border-blue-600' },
  { value: 'tempo', label: 'Tempo', color: 'bg-indigo-900/40 text-indigo-200 border-indigo-600' },
  { value: 'threshold', label: 'Threshold', color: 'bg-violet-900/40 text-violet-200 border-violet-600' },
  { value: 'interval', label: 'Interval', color: 'bg-red-900/40 text-red-200 border-red-600' },
  { value: 'repetition', label: 'Repetition', color: 'bg-rose-900/40 text-rose-200 border-rose-600' },
  { value: 'race', label: 'Race', color: 'bg-amber-900/40 text-amber-200 border-amber-600' },
];

const EFFORT_LEVELS = [
  { value: 1, label: 'Very Easy' },
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Very Hard' },
];

export function QuickLogModal({
  isOpen,
  onClose,
  onSuccess,
  defaultDistance = 5,
  defaultDuration = 45,
  defaultType = 'easy',
}: QuickLogModalProps) {
  const [isPending, startTransition] = useTransition();
  const [distance, setDistance] = useState(defaultDistance);
  const [duration, setDuration] = useState(defaultDuration);
  const [workoutType, setWorkoutType] = useState(defaultType);
  const [effort, setEffort] = useState(3);

  // Prevent body scrolling when modal is open
  useModalBodyLock(isOpen);

  if (!isOpen) return null;

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await logQuickWorkout({
        distanceMiles: distance,
        durationMinutes: duration,
        workoutType,
        effort,
      });
      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        console.error('Failed to log workout:', result.error);
      }
    });
  };

  // Calculate pace
  const paceSeconds = duration * 60 / distance;
  const paceMinutes = Math.floor(paceSeconds / 60);
  const paceRemainder = Math.round(paceSeconds % 60);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bgSecondary rounded-2xl max-w-lg w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-borderPrimary">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-dream-600" />
            <h2 className="text-lg font-semibold text-primary">Quick Log Run</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-interactive-hover rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-textTertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Distance Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-textSecondary">Distance</label>
              <span className="text-2xl font-bold text-dream-600">{distance.toFixed(1)} mi</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="26.2"
              step="0.1"
              value={distance}
              onChange={(e) => setDistance(parseFloat(e.target.value))}
              className="w-full h-2 bg-bgTertiary rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-textTertiary mt-1">
              <span>0.5</span>
              <span>5</span>
              <span>10</span>
              <span>20</span>
              <span>26.2</span>
            </div>
          </div>

          {/* Duration Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-textSecondary">Duration</label>
              <span className="text-2xl font-bold text-dream-600">{duration} min</span>
            </div>
            <input
              type="range"
              min="5"
              max="240"
              step="1"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full h-2 bg-bgTertiary rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-textTertiary mt-1">
              <span>5</span>
              <span>30</span>
              <span>60</span>
              <span>120</span>
              <span>240</span>
            </div>
          </div>

          {/* Calculated Pace */}
          <div className="bg-surface-1 rounded-lg p-3 text-center">
            <p className="text-sm text-textTertiary">Average Pace</p>
            <p className="text-2xl font-bold text-primary">
              {paceMinutes}:{paceRemainder.toString().padStart(2, '0')}/mi
            </p>
          </div>

          {/* Workout Type */}
          <div>
            <label className="text-sm font-medium text-textSecondary mb-2 block">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {WORKOUT_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setWorkoutType(type.value)}
                  className={cn(
                    'py-2 px-3 rounded-lg border-2 font-medium transition-all text-sm',
                    workoutType === type.value
                      ? type.color
                      : 'border-borderPrimary text-textSecondary hover:border-strong'
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Effort Level */}
          <div>
            <label className="text-sm font-medium text-textSecondary mb-3 block">
              How did it feel?
            </label>
            <div className="flex justify-between items-end">
              {EFFORT_LEVELS.map(level => (
                <button
                  key={level.value}
                  onClick={() => setEffort(level.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all',
                    effort === level.value
                      ? 'bg-dream-100 scale-110'
                      : 'hover:bg-bgTertiary'
                  )}
                >
                  <span className={cn(
                    'text-sm font-medium',
                    effort === level.value ? 'text-dream-300' : 'text-textTertiary'
                  )}>
                    {level.value}
                  </span>
                  <span className={cn(
                    'text-xs',
                    effort === level.value ? 'text-dream-300 font-medium' : 'text-textTertiary'
                  )}>
                    {level.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-borderPrimary">
          <button
            onClick={onClose}
            className="btn-secondary flex-1 py-3 px-4 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="btn-primary flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Logging...
              </>
            ) : (
              <>
                Log Run
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #7c6cf0;
          border-radius: 50%;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #7c6cf0;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}