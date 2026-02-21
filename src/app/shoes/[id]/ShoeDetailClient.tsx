'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Footprints, AlertTriangle, AlertCircle, RotateCcw,
  Check, X, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateShoe, retireShoe, unretireShoe, resetShoeOverrides } from '@/actions/shoes';
import type { ShoeDetailWorkout } from '@/actions/shoes';
import type { Shoe } from '@/lib/schema';

const CATEGORY_LABELS: Record<string, string> = {
  daily_trainer: 'Daily Trainer',
  tempo: 'Tempo',
  race: 'Race',
  trail: 'Trail',
  recovery: 'Recovery',
};

const CATEGORY_OPTIONS = ['daily_trainer', 'tempo', 'race', 'trail', 'recovery'] as const;

const INTENDED_USE_OPTIONS = ['easy', 'tempo', 'long', 'intervals', 'race'] as const;

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  recovery: 'Recovery', easy: 'Easy', steady: 'Steady', marathon: 'Marathon',
  tempo: 'Tempo', threshold: 'Threshold', interval: 'Interval',
  repetition: 'Repetition', long: 'Long', race: 'Race',
  cross_train: 'Cross Train', other: 'Other',
};

const WORKOUT_TYPE_COLORS: Record<string, string> = {
  recovery: 'bg-slate-700/50 text-slate-300',
  easy: 'bg-sky-900/40 text-sky-300',
  steady: 'bg-blue-900/40 text-blue-300',
  marathon: 'bg-violet-900/40 text-violet-300',
  tempo: 'bg-purple-900/40 text-purple-300',
  threshold: 'bg-orange-900/40 text-orange-300',
  interval: 'bg-red-900/40 text-red-300',
  repetition: 'bg-rose-900/40 text-rose-300',
  long: 'bg-teal-900/40 text-teal-300',
  race: 'bg-amber-900/40 text-amber-300',
  cross_train: 'bg-emerald-900/40 text-emerald-300',
  other: 'bg-gray-700/50 text-gray-300',
};

function formatPace(seconds: number | null): string {
  if (!seconds) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLastUsed(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getRetirementInfo(miles: number, isRetired: boolean) {
  if (isRetired) return null;
  if (miles >= 500) return { level: 'critical' as const, label: 'Past lifespan', color: 'text-red-400' };
  if (miles >= 400) return { level: 'alert' as const, label: 'Replace soon', color: 'text-orange-400' };
  if (miles >= 300) return { level: 'warn' as const, label: 'Consider replacing', color: 'text-amber-400' };
  return null;
}

function getProgressColor(miles: number): string {
  if (miles >= 400) return 'bg-red-500';
  if (miles >= 300) return 'bg-amber-500';
  return 'bg-emerald-500';
}

// Inline editable text field
function EditableField({
  value,
  onSave,
  label,
  isOverridden,
  isStravaLinked,
  multiline,
  type = 'text',
}: {
  value: string;
  onSave: (val: string) => void;
  label: string;
  isOverridden?: boolean;
  isStravaLinked?: boolean;
  multiline?: boolean;
  type?: 'text' | 'date';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    const commonProps = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) save();
        if (e.key === 'Escape') cancel();
      },
      onBlur: save,
      className: 'w-full px-2 py-1 bg-bgPrimary border border-dream-500 rounded text-sm text-textPrimary focus:outline-none focus:ring-1 focus:ring-dream-500',
    };

    return (
      <div>
        <span className="text-[11px] text-textTertiary uppercase tracking-wide">{label}</span>
        {multiline ? (
          <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} rows={3} {...commonProps} />
        ) : type === 'date' ? (
          <input ref={inputRef as React.RefObject<HTMLInputElement>} type="date" {...commonProps} />
        ) : (
          <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" {...commonProps} />
        )}
      </div>
    );
  }

  return (
    <div
      className="group cursor-pointer"
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-textTertiary uppercase tracking-wide">{label}</span>
        {isOverridden && isStravaLinked && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/30 text-amber-400 border border-amber-700/30">
            User override
          </span>
        )}
        <Pencil className="w-3 h-3 text-textTertiary opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className={cn(
        'text-sm text-textPrimary mt-0.5',
        !value && 'text-textTertiary italic',
      )}>
        {value || `No ${label.toLowerCase()}`}
      </p>
    </div>
  );
}

export function ShoeDetailClient({
  shoe,
  workouts: initialWorkouts,
}: {
  shoe: Shoe;
  workouts: ShoeDetailWorkout[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const overrides: string[] = shoe.stravaOverrides ? JSON.parse(shoe.stravaOverrides) : [];
  const isStravaLinked = !!shoe.stravaGearId;

  const lastUsedDate = initialWorkouts.length > 0 ? initialWorkouts[0].date : null;
  const retirementInfo = getRetirementInfo(shoe.totalMiles, shoe.isRetired);
  const intendedUse: string[] = shoe.intendedUse ? JSON.parse(shoe.intendedUse) : [];

  const handleFieldSave = (field: string, value: string | string[] | null) => {
    startTransition(async () => {
      await updateShoe(shoe.id, { [field]: value });
      router.refresh();
    });
  };

  const handleRetireToggle = () => {
    startTransition(async () => {
      if (shoe.isRetired) {
        await unretireShoe(shoe.id);
      } else {
        await retireShoe(shoe.id);
      }
      router.refresh();
    });
  };

  const handleResetOverrides = () => {
    startTransition(async () => {
      await resetShoeOverrides(shoe.id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-display font-semibold text-textPrimary">{shoe.name}</h1>
            {shoe.isRetired && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800/50 text-slate-400">
                Retired
              </span>
            )}
          </div>
          <p className="text-sm text-textTertiary mt-0.5">{shoe.brand} {shoe.model}</p>
          {isStravaLinked && (
            <p className="text-[11px] text-textTertiary mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
              Synced from Strava
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold text-textPrimary tabular-nums">
            {shoe.totalMiles.toFixed(0)}
            <span className="text-sm font-normal text-textTertiary ml-1">mi</span>
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-4">
          {/* Mileage progress */}
          <div className="col-span-2">
            <span className="text-[11px] text-textTertiary uppercase tracking-wide">Mileage</span>
            <div className="mt-1.5">
              <div className={cn('h-2.5 rounded-full overflow-hidden bg-bgTertiary')}>
                <div
                  className={cn('h-full rounded-full transition-all', getProgressColor(shoe.totalMiles))}
                  style={{ width: `${Math.min((shoe.totalMiles / 500) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-textTertiary">{shoe.totalMiles.toFixed(0)} mi</span>
                <span className="text-xs text-textTertiary">500 mi</span>
              </div>
            </div>
          </div>

          {/* Workout count */}
          <div>
            <span className="text-[11px] text-textTertiary uppercase tracking-wide">Runs</span>
            <p className="text-lg font-semibold text-textPrimary mt-1">{initialWorkouts.length}</p>
          </div>

          {/* Last used */}
          <div>
            <span className="text-[11px] text-textTertiary uppercase tracking-wide">Last used</span>
            <p className="text-sm text-textPrimary mt-1">{formatLastUsed(lastUsedDate)}</p>
          </div>
        </div>

        {/* Retirement alert */}
        {retirementInfo && (
          <div className={cn(
            'flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-sm',
            retirementInfo.level === 'critical' && 'bg-red-950/30 border border-red-800/30',
            retirementInfo.level === 'alert' && 'bg-orange-950/30 border border-orange-800/30',
            retirementInfo.level === 'warn' && 'bg-amber-950/30 border border-amber-800/30',
          )}>
            {retirementInfo.level === 'critical' ? (
              <AlertCircle className={cn('w-4 h-4 shrink-0', retirementInfo.color)} />
            ) : (
              <AlertTriangle className={cn('w-4 h-4 shrink-0', retirementInfo.color)} />
            )}
            <span className={retirementInfo.color}>{retirementInfo.label}</span>
          </div>
        )}
      </div>

      {/* Info card with inline editing */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-medium text-textSecondary flex items-center gap-2">
          <Footprints className="w-4 h-4" />
          Details
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <EditableField
            label="Name"
            value={shoe.name}
            onSave={(v) => handleFieldSave('name', v)}
            isOverridden={overrides.includes('name')}
            isStravaLinked={isStravaLinked}
          />
          <EditableField
            label="Brand"
            value={shoe.brand}
            onSave={(v) => handleFieldSave('brand', v)}
            isOverridden={overrides.includes('brand')}
            isStravaLinked={isStravaLinked}
          />
          <EditableField
            label="Model"
            value={shoe.model}
            onSave={(v) => handleFieldSave('model', v)}
            isOverridden={overrides.includes('model')}
            isStravaLinked={isStravaLinked}
          />
          <EditableField
            label="Purchase Date"
            value={shoe.purchaseDate || ''}
            onSave={(v) => handleFieldSave('purchaseDate', v || null)}
            type="date"
          />
        </div>

        {/* Category pill selector */}
        <div>
          <span className="text-[11px] text-textTertiary uppercase tracking-wide">Category</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                onClick={() => handleFieldSave('category', cat)}
                disabled={isPending}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                  shoe.category === cat
                    ? 'bg-dream-600 text-white'
                    : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Intended use multi-toggle */}
        <div>
          <span className="text-[11px] text-textTertiary uppercase tracking-wide">Intended Use</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {INTENDED_USE_OPTIONS.map((use) => {
              const isSelected = intendedUse.includes(use);
              return (
                <button
                  key={use}
                  onClick={() => {
                    const next = isSelected
                      ? intendedUse.filter((u) => u !== use)
                      : [...intendedUse, use];
                    handleFieldSave('intendedUse', next);
                  }}
                  disabled={isPending}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize',
                    isSelected
                      ? 'bg-dream-600 text-white'
                      : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                  )}
                >
                  {use}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <EditableField
          label="Notes"
          value={shoe.notes || ''}
          onSave={(v) => handleFieldSave('notes', v || null)}
          multiline
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleRetireToggle}
          disabled={isPending}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            shoe.isRetired
              ? 'bg-dream-600 text-white hover:bg-dream-700'
              : 'bg-bgTertiary text-textSecondary hover:bg-red-900/30 hover:text-red-300 border border-borderPrimary'
          )}
        >
          {shoe.isRetired ? 'Unretire' : 'Retire Shoe'}
        </button>

        {isStravaLinked && overrides.length > 0 && (
          <button
            onClick={handleResetOverrides}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-bgTertiary text-textSecondary hover:text-amber-300 border border-borderPrimary transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Overrides
          </button>
        )}
      </div>

      {/* Workout list */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-borderPrimary">
          <h2 className="text-sm font-medium text-textSecondary">
            Runs ({initialWorkouts.length})
          </h2>
        </div>

        {initialWorkouts.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-textTertiary">
            No runs recorded with this shoe yet.
          </div>
        ) : (
          <div className="divide-y divide-borderPrimary max-h-[500px] overflow-y-auto">
            {initialWorkouts.map((w) => (
              <Link
                key={w.id}
                href={`/workout/${w.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-bgTertiary/50 transition-colors"
              >
                {/* Date */}
                <div className="w-20 shrink-0">
                  <span className="text-xs text-textTertiary">{formatDate(w.date)}</span>
                </div>

                {/* Name + type badge */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-textPrimary truncate">
                    {w.stravaName || WORKOUT_TYPE_LABELS[w.workoutType] || 'Run'}
                  </p>
                </div>

                {/* Type badge */}
                <span className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap',
                  WORKOUT_TYPE_COLORS[w.workoutType] || 'bg-bgTertiary text-textSecondary'
                )}>
                  {WORKOUT_TYPE_LABELS[w.workoutType] || w.workoutType}
                </span>

                {/* Distance */}
                <div className="w-14 text-right shrink-0">
                  <span className="text-sm text-textPrimary tabular-nums">
                    {w.distanceMiles ? `${w.distanceMiles.toFixed(1)}` : '--'}
                  </span>
                  <span className="text-[10px] text-textTertiary ml-0.5">mi</span>
                </div>

                {/* Duration */}
                <div className="w-14 text-right shrink-0 hidden sm:block">
                  <span className="text-xs text-textTertiary">{formatDuration(w.durationMinutes)}</span>
                </div>

                {/* Pace */}
                <div className="w-16 text-right shrink-0">
                  <span className="text-xs text-textTertiary tabular-nums">{formatPace(w.avgPaceSeconds)}</span>
                  {w.avgPaceSeconds && <span className="text-[10px] text-textTertiary">/mi</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
