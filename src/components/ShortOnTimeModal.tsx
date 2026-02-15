'use client';

import { useState } from 'react';
import { X, Clock, ArrowRight, Check } from 'lucide-react';
import { useModalBodyLock } from '@/hooks/useModalBodyLock';

interface OriginalWorkout {
  name: string;
  type: string;
  distance: number | null;
  duration: number | null;
  description: string;
}

interface RewrittenWorkout {
  name: string;
  type: string;
  distance: number | null;
  duration: number;
  description: string;
  structure?: {
    warmup: string;
    main: string;
    cooldown: string;
  };
}

interface ShortOnTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (rewritten: RewrittenWorkout) => void;
  onKeepOriginal: () => void;
  original: OriginalWorkout | null;
  rewritten: RewrittenWorkout | null;
  isLoading?: boolean;
  onTimeSelect: (minutes: number) => void;
}

const TIME_PRESETS = [15, 20, 25, 30, 35, 40, 45, 60];

export function ShortOnTimeModal({
  isOpen,
  onClose,
  onAccept,
  onKeepOriginal,
  original,
  rewritten,
  isLoading,
  onTimeSelect,
}: ShortOnTimeModalProps) {
  const [selectedTime, setSelectedTime] = useState<number | null>(null);

  // Prevent body scrolling when modal is open
  useModalBodyLock(isOpen);

  if (!isOpen) return null;

  const handleTimeSelect = (minutes: number) => {
    setSelectedTime(minutes);
    onTimeSelect(minutes);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bgSecondary rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-borderPrimary">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-primary">Short on Time?</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-interactive-hover rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-textTertiary" />
          </button>
        </div>

        {/* Time Selection */}
        {!rewritten && (
          <div className="p-4">
            <p className="text-textSecondary mb-4">How much time do you have?</p>
            <div className="grid grid-cols-4 gap-2">
              {TIME_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => handleTimeSelect(minutes)}
                  className={`py-3 px-2 rounded-lg border-2 transition-all font-medium ${
                    selectedTime === minutes
                      ? 'border-teal-500 bg-surface-1 text-teal-700 dark:text-teal-300'
                      : 'border-borderPrimary hover:border-teal-300 text-textSecondary'
                  }`}
                  disabled={isLoading}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            {isLoading && (
              <div className="mt-4 text-center text-textTertiary">
                <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-2" />
                Adapting your workout...
              </div>
            )}
          </div>
        )}

        {/* Comparison View */}
        {rewritten && original && (
          <div className="p-4 space-y-4">
            {/* Original */}
            <div className="bg-bgTertiary rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-textTertiary uppercase tracking-wide">Original</span>
              </div>
              <h3 className="font-semibold text-primary">{original.name}</h3>
              <div className="flex items-center gap-3 text-sm text-textSecondary mt-1">
                {original.distance && <span>{original.distance} mi</span>}
                {original.duration && <span>{original.duration} min</span>}
                <span className="capitalize">{original.type}</span>
              </div>
              <p className="text-sm text-textTertiary mt-2">{original.description}</p>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-tertiary" />
            </div>

            {/* Rewritten */}
            <div className="bg-surface-1 rounded-xl p-4 border-2 border-default">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-teal-600 uppercase tracking-wide">
                  Adapted for {selectedTime} min
                </span>
              </div>
              <h3 className="font-semibold text-primary">{rewritten.name}</h3>
              <div className="flex items-center gap-3 text-sm text-textSecondary mt-1">
                {rewritten.distance && <span>{rewritten.distance} mi</span>}
                <span>{rewritten.duration} min</span>
                <span className="capitalize">{rewritten.type}</span>
              </div>
              <p className="text-sm text-textSecondary mt-2">{rewritten.description}</p>

              {rewritten.structure && (
                <div className="mt-3 pt-3 border-t border-default">
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-textTertiary">Warmup:</span>
                      <span className="text-textSecondary">{rewritten.structure.warmup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textTertiary">Main:</span>
                      <span className="text-textSecondary">{rewritten.structure.main}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textTertiary">Cooldown:</span>
                      <span className="text-textSecondary">{rewritten.structure.cooldown}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onKeepOriginal}
                className="flex-1 py-3 px-4 border border-borderPrimary rounded-xl text-textSecondary font-medium hover:bg-bgTertiary transition-colors"
              >
                Keep Original
              </button>
              <button
                onClick={() => onAccept(rewritten)}
                className="btn-primary flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Use Adapted
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
