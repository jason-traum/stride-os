'use client';

import { useState, useTransition } from 'react';
import { X, Clock, ArrowRight, Check } from 'lucide-react';

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

  if (!isOpen) return null;

  const handleTimeSelect = (minutes: number) => {
    setSelectedTime(minutes);
    onTimeSelect(minutes);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-stone-900">Short on Time?</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Time Selection */}
        {!rewritten && (
          <div className="p-4">
            <p className="text-stone-600 mb-4">How much time do you have?</p>
            <div className="grid grid-cols-4 gap-2">
              {TIME_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => handleTimeSelect(minutes)}
                  className={`py-3 px-2 rounded-lg border-2 transition-all font-medium ${
                    selectedTime === minutes
                      ? 'border-teal-500 bg-slate-50 text-teal-700'
                      : 'border-stone-200 hover:border-teal-300 text-stone-700'
                  }`}
                  disabled={isLoading}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            {isLoading && (
              <div className="mt-4 text-center text-stone-500">
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
            <div className="bg-stone-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Original</span>
              </div>
              <h3 className="font-semibold text-stone-900">{original.name}</h3>
              <div className="flex items-center gap-3 text-sm text-stone-600 mt-1">
                {original.distance && <span>{original.distance} mi</span>}
                {original.duration && <span>{original.duration} min</span>}
                <span className="capitalize">{original.type}</span>
              </div>
              <p className="text-sm text-stone-500 mt-2">{original.description}</p>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-stone-400" />
            </div>

            {/* Rewritten */}
            <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-teal-600 uppercase tracking-wide">
                  Adapted for {selectedTime} min
                </span>
              </div>
              <h3 className="font-semibold text-stone-900">{rewritten.name}</h3>
              <div className="flex items-center gap-3 text-sm text-stone-600 mt-1">
                {rewritten.distance && <span>{rewritten.distance} mi</span>}
                <span>{rewritten.duration} min</span>
                <span className="capitalize">{rewritten.type}</span>
              </div>
              <p className="text-sm text-stone-700 mt-2">{rewritten.description}</p>

              {rewritten.structure && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Warmup:</span>
                      <span className="text-stone-700">{rewritten.structure.warmup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Main:</span>
                      <span className="text-stone-700">{rewritten.structure.main}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Cooldown:</span>
                      <span className="text-stone-700">{rewritten.structure.cooldown}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onKeepOriginal}
                className="flex-1 py-3 px-4 border border-stone-200 rounded-xl text-stone-700 font-medium hover:bg-stone-50 transition-colors"
              >
                Keep Original
              </button>
              <button
                onClick={() => onAccept(rewritten)}
                className="flex-1 py-3 px-4 bg-teal-600 rounded-xl text-white font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
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
