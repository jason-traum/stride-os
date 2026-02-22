'use client';

import { useState, useTransition } from 'react';
import { cn, formatDistance, getWorkoutTypeLabel, getWorkoutTypeColor } from '@/lib/utils';
import { saveReflection } from '@/actions/reflections';
import { Check, ChevronRight, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import type { Workout } from '@/lib/schema';

function getContextualQuestion(
  workoutType: string,
  distanceMiles?: number | null
): { question: string; options: string[] } {
  switch (workoutType) {
    case 'interval':
    case 'repetition':
      return {
        question: 'Did you hit your target splits?',
        options: ['Nailed them', 'Close enough', 'Fell short', 'Way off'],
      };
    case 'tempo':
    case 'threshold':
      return {
        question: 'Were you able to hold the pace?',
        options: ['Locked in', 'Faded late', 'Struggled', 'Adjusted down'],
      };
    case 'long':
      return {
        question: 'How was your energy and fueling?',
        options: ['Strong throughout', 'Good until late', 'Struggled', 'Bonked'],
      };
    case 'easy':
    case 'recovery':
      return {
        question: 'Truly easy, or were you pushing it?',
        options: ['Genuinely easy', 'Mostly easy', 'A bit quick', 'Too fast'],
      };
    case 'race':
      return {
        question: 'How do you feel about the result?',
        options: ['Thrilled', 'Satisfied', 'Disappointed', 'DNF/DNS'],
      };
    case 'steady':
    case 'marathon':
      return {
        question: 'How did the effort feel?',
        options: ['Comfortable', 'Manageable', 'Hard', 'Too hard'],
      };
    default:
      if (distanceMiles && distanceMiles >= 10) {
        return {
          question: 'How was your energy and fueling?',
          options: ['Strong throughout', 'Good until late', 'Struggled', 'Bonked'],
        };
      }
      return {
        question: 'How did the run feel overall?',
        options: ['Great', 'Good', 'Tough', 'Rough'],
      };
  }
}

interface PostRunReflectionCardProps {
  workout: Workout;
}

const RPE_COLORS: Record<number, string> = {
  1: 'bg-emerald-500 text-white',
  2: 'bg-emerald-400 text-white',
  3: 'bg-green-400 text-white',
  4: 'bg-lime-400 text-gray-900',
  5: 'bg-yellow-400 text-gray-900',
  6: 'bg-yellow-500 text-gray-900',
  7: 'bg-orange-400 text-white',
  8: 'bg-orange-500 text-white',
  9: 'bg-red-500 text-white',
  10: 'bg-red-600 text-white',
};

const ENERGY_OPTIONS = [
  { value: 'fresh', label: 'Fresh', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'normal', label: 'Normal', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  { value: 'tired', label: 'Tired', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { value: 'exhausted', label: 'Exhausted', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
];

const PAIN_OPTIONS = [
  { value: 'none', label: 'No Pain', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'mild_soreness', label: 'Mild Soreness', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { value: 'something_concerning', label: 'Something Off', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
];

export function PostRunReflectionCard({ workout }: PostRunReflectionCardProps) {
  const [step, setStep] = useState(0);
  const [rpe, setRpe] = useState<number | null>(null);
  const [contextualAnswer, setContextualAnswer] = useState<string | null>(null);
  const [energyLevel, setEnergyLevel] = useState<string | null>(null);
  const [painReport, setPainReport] = useState<string | null>(null);
  const [painLocation, setPainLocation] = useState('');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const contextual = getContextualQuestion(workout.workoutType, workout.distanceMiles);

  const handleRpeSelect = (value: number) => {
    setRpe(value);
    setStep(1);
  };

  const handleContextualSelect = (value: string) => {
    setContextualAnswer(value);
    setStep(2);
  };

  const handleSave = () => {
    if (!rpe) return;

    startTransition(async () => {
      await saveReflection({
        workoutId: workout.id,
        rpe,
        energyLevel: energyLevel || undefined,
        painReport: painReport || undefined,
        painLocation: painReport === 'something_concerning' ? painLocation : undefined,
        contextualAnswer: contextualAnswer || undefined,
      });
      setSaved(true);
    });
  };

  if (saved) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm border-l-4 border-l-amber-500/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-textPrimary">Reflection saved</p>
            <p className="text-xs text-textTertiary">RPE {rpe} &middot; {getWorkoutTypeLabel(workout.workoutType)}</p>
          </div>
          <Link
            href={`/workout/${workout.id}?assess=true`}
            className="text-xs text-accentTeal hover:underline flex items-center gap-1"
          >
            Full Assessment <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden border-l-4 border-l-amber-500/40">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600/15 to-orange-600/15 px-4 py-3 border-b border-borderPrimary">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-textPrimary">Quick Reflection</span>
          <span className="text-xs text-textTertiary ml-auto">
            {formatDistance(workout.distanceMiles)} mi &middot;{' '}
            <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', getWorkoutTypeColor(workout.workoutType))}>
              {getWorkoutTypeLabel(workout.workoutType)}
            </span>
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Step 0: RPE */}
        {step >= 0 && (
          <div className={cn(step > 0 && 'opacity-50')}>
            <p className="text-sm text-textSecondary mb-2">How hard was that? (RPE)</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => step === 0 && handleRpeSelect(n)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-bold transition-all',
                    rpe === n
                      ? cn(RPE_COLORS[n], 'ring-2 ring-white/30 scale-110')
                      : 'bg-bgTertiary text-textTertiary hover:bg-bgTertiary/80',
                    step > 0 && 'pointer-events-none'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Contextual question */}
        {step >= 1 && (
          <div className={cn('mt-4', step > 1 && 'opacity-50')}>
            <p className="text-sm text-textSecondary mb-2">{contextual.question}</p>
            <div className="flex flex-wrap gap-2">
              {contextual.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => step === 1 && handleContextualSelect(opt)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    contextualAnswer === opt
                      ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                      : 'bg-bgTertiary text-textSecondary border-borderSecondary hover:border-borderPrimary',
                    step > 1 && 'pointer-events-none'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Energy + Pain */}
        {step >= 2 && (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-sm text-textSecondary mb-2">Energy level</p>
              <div className="flex flex-wrap gap-2">
                {ENERGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEnergyLevel(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      energyLevel === opt.value
                        ? opt.color
                        : 'bg-bgTertiary text-textSecondary border-borderSecondary hover:border-borderPrimary'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-textSecondary mb-2">Any pain or soreness?</p>
              <div className="flex flex-wrap gap-2">
                {PAIN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPainReport(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      painReport === opt.value
                        ? opt.color
                        : 'bg-bgTertiary text-textSecondary border-borderSecondary hover:border-borderPrimary'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {painReport === 'something_concerning' && (
              <input
                type="text"
                value={painLocation}
                onChange={(e) => setPainLocation(e.target.value)}
                placeholder="Where? (e.g., right knee, left calf)"
                className="w-full px-3 py-2 rounded-lg bg-bgTertiary border border-borderSecondary text-sm text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            )}

            <button
              onClick={handleSave}
              disabled={isPending}
              className={cn(
                'w-full py-2.5 rounded-xl text-sm font-medium transition-all',
                isPending
                  ? 'bg-violet-500/30 text-violet-300 cursor-wait'
                  : 'bg-violet-600 text-white hover:bg-violet-500'
              )}
            >
              {isPending ? 'Saving...' : 'Save Reflection'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
