'use client';

import { Sun, Moon, CheckCircle2, Circle, Shirt, Watch, Droplets, Zap } from 'lucide-react';
import { useState } from 'react';

interface TomorrowWorkout {
  name: string;
  type: string;
  distance: number | null;
  pace: string | null;
  is_key_workout: boolean;
}

interface PrepForTomorrowData {
  date: string;
  day: string;
  workout: TomorrowWorkout | null;
  preparation: {
    tonight: string[];
    morning: string[];
  };
  gear_checklist: (string | null)[];
  mental_note: string;
}

interface PrepForTomorrowCardProps {
  data: PrepForTomorrowData;
  onDismiss?: () => void;
}

export function PrepForTomorrowCard({ data, onDismiss }: PrepForTomorrowCardProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleItem = (item: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(item)) {
      newChecked.delete(item);
    } else {
      newChecked.add(item);
    }
    setCheckedItems(newChecked);
  };

  if (!data.workout) {
    // Rest day tomorrow
    return (
      <div className="bg-gradient-to-br from-stone-50 to-stone-100 rounded-xl border border-stone-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center">
            <Moon className="w-5 h-5 text-stone-600" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">Tomorrow: {data.day}</h3>
            <p className="text-sm text-stone-500">Rest Day</p>
          </div>
        </div>
        <p className="text-sm text-stone-600">
          No run scheduled. Enjoy the recovery - it&apos;s when the fitness gains happen!
        </p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-3 text-sm text-stone-500 hover:text-stone-700"
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  const gearItems = data.gear_checklist.filter(Boolean) as string[];

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sun className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Prep for Tomorrow</h3>
              <p className="text-indigo-100 text-sm">{data.day}</p>
            </div>
          </div>
          {data.workout.is_key_workout && (
            <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
              KEY
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Workout Preview */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h4 className="font-semibold text-stone-900 mb-1">{data.workout.name}</h4>
          <div className="flex items-center gap-3 text-sm text-stone-600">
            {data.workout.distance && (
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-purple-500" />
                {data.workout.distance} mi
              </span>
            )}
            {data.workout.pace && (
              <span className="flex items-center gap-1">
                <Watch className="w-4 h-4 text-indigo-500" />
                {data.workout.pace}
              </span>
            )}
            <span className="capitalize text-stone-400">{data.workout.type}</span>
          </div>
        </div>

        {/* Tonight Checklist */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Moon className="w-4 h-4 text-indigo-600" />
            <h4 className="font-medium text-stone-700 text-sm">Tonight</h4>
          </div>
          <div className="space-y-2">
            {data.preparation.tonight.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleItem(`tonight-${i}`)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/50 transition-colors text-left"
              >
                {checkedItems.has(`tonight-${i}`) ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-stone-300 flex-shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    checkedItems.has(`tonight-${i}`)
                      ? 'text-stone-400 line-through'
                      : 'text-stone-700'
                  }`}
                >
                  {item}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Gear Checklist */}
        {gearItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shirt className="w-4 h-4 text-indigo-600" />
              <h4 className="font-medium text-stone-700 text-sm">Gear Checklist</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {gearItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggleItem(`gear-${i}`)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    checkedItems.has(`gear-${i}`)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {checkedItems.has(`gear-${i}`) && '✓ '}
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Morning Tips */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sun className="w-4 h-4 text-yellow-500" />
            <h4 className="font-medium text-stone-700 text-sm">Morning</h4>
          </div>
          <ul className="text-sm text-stone-600 space-y-1">
            {data.preparation.morning.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Mental Note */}
        <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg p-3">
          <p className="text-sm text-indigo-800 font-medium">
            💪 {data.mental_note}
          </p>
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-full py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            Got it!
          </button>
        )}
      </div>
    </div>
  );
}
