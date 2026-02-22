'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AnimatedSection } from '@/components/AnimatedSection';
import { getPeriodizationData } from '@/actions/periodization';
import type {
  PeriodizationData,
  MacroCycleData,
  MesoCycleData,
  MicroCycleData,
  PeriodizationPhase,
} from '@/actions/periodization';
import {
  Calendar,
  Flag,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Circle,
  Minus,
  TrendingDown,
} from 'lucide-react';

// ── Phase Colors ───────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; bar: string; dot: string }> = {
  base: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    bar: 'bg-emerald-500/70',
    dot: 'bg-emerald-500',
  },
  build: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    bar: 'bg-blue-500/70',
    dot: 'bg-blue-500',
  },
  peak: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    bar: 'bg-amber-500/70',
    dot: 'bg-amber-500',
  },
  taper: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    bar: 'bg-purple-500/70',
    dot: 'bg-purple-500',
  },
  recovery: {
    bg: 'bg-stone-500/10',
    border: 'border-stone-500/30',
    text: 'text-stone-400',
    bar: 'bg-stone-500/70',
    dot: 'bg-stone-500',
  },
};

function getPhaseColor(phase: string) {
  return PHASE_COLORS[phase] || PHASE_COLORS.build;
}

function getPhaseLabel(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Workout Type Badge ─────────────────────────────────────────────────

const WORKOUT_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  easy: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Easy' },
  recovery: { bg: 'bg-stone-500/15', text: 'text-stone-400', label: 'Recovery' },
  long: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Long Run' },
  tempo: { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'Tempo' },
  threshold: { bg: 'bg-rose-500/15', text: 'text-rose-400', label: 'Threshold' },
  interval: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Intervals' },
  race: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Race' },
  steady: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', label: 'Steady' },
  cross_train: { bg: 'bg-violet-500/15', text: 'text-violet-400', label: 'Cross' },
  other: { bg: 'bg-stone-500/15', text: 'text-stone-400', label: 'Other' },
};

function getWorkoutStyle(type: string | null) {
  if (!type) return null;
  return WORKOUT_TYPE_STYLES[type] || WORKOUT_TYPE_STYLES.other;
}

// ── Main Component ─────────────────────────────────────────────────────

export function PeriodizationView() {
  const [data, setData] = useState<PeriodizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getPeriodizationData();
      if (result.success) {
        setData(result.data);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <PeriodizationSkeleton />;
  }

  if (!data || !data.hasTrainingPlan) {
    return null; // Don't render anything if no training plan
  }

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-primary">Training Periodization</h3>
          {data.macro && (
            <span className="text-xs text-textTertiary">
              {data.macro.totalWeeks} week plan
            </span>
          )}
        </div>

        {/* Macro Cycle */}
        {data.macro && <MacroCycleView data={data.macro} />}

        {/* Meso Cycle */}
        {data.meso && data.meso.weeks.length > 0 && (
          <MesoCycleView data={data.meso} />
        )}

        {/* Micro Cycle */}
        {data.micro && <MicroCycleView data={data.micro} />}
      </div>
    </AnimatedSection>
  );
}

// ── Macro Cycle View ───────────────────────────────────────────────────

function MacroCycleView({ data }: { data: MacroCycleData }) {
  // Calculate the total duration for proportional widths
  const totalDays = useMemo(() => {
    const start = new Date(data.planStartDate + 'T00:00:00');
    const end = new Date(data.planEndDate + 'T00:00:00');
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [data.planStartDate, data.planEndDate]);

  // Current position as a percentage
  const currentPosition = useMemo(() => {
    const start = new Date(data.planStartDate + 'T00:00:00');
    const current = new Date(data.currentDate + 'T00:00:00');
    const daysSinceStart = Math.ceil((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(100, (daysSinceStart / totalDays) * 100));
  }, [data.planStartDate, data.currentDate, totalDays]);

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-textSecondary">
          <Calendar className="w-3.5 h-3.5" />
          <span>Macro Cycle</span>
        </div>
        <div className="flex items-center gap-1.5 text-textTertiary">
          <Flag className="w-3 h-3" />
          <span>{data.raceName} ({data.raceDistanceLabel})</span>
          <span className="text-textTertiary/50">|</span>
          <span>{formatDateShort(data.raceDate)}</span>
        </div>
      </div>

      {/* Phase bars */}
      <div className="relative">
        {/* Bar container */}
        <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden">
          {data.phases.map((phase) => {
            const phaseDays = Math.max(1, Math.ceil(
              (new Date(phase.endDate + 'T00:00:00').getTime() - new Date(phase.startDate + 'T00:00:00').getTime())
              / (1000 * 60 * 60 * 24)
            ));
            const widthPct = (phaseDays / totalDays) * 100;
            const colors = getPhaseColor(phase.phase);

            return (
              <div
                key={phase.phase}
                className={cn(
                  'relative flex items-center justify-center transition-all',
                  colors.bar,
                  'hover:brightness-110 cursor-default group'
                )}
                style={{ width: `${widthPct}%` }}
                title={`${getPhaseLabel(phase.phase)}: ${formatDateShort(phase.startDate)} - ${formatDateShort(phase.endDate)} (${phase.weekCount}w)`}
              >
                <span className="text-[10px] sm:text-xs font-medium text-white/90 truncate px-1">
                  {getPhaseLabel(phase.phase)}
                </span>
              </div>
            );
          })}
        </div>

        {/* "You are here" marker */}
        {currentPosition > 0 && currentPosition < 100 && (
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
            style={{ left: `${currentPosition}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-0.5 h-full bg-white/80" />
            <div className="absolute -bottom-5 flex items-center gap-0.5">
              <MapPin className="w-3 h-3 text-white/80" />
              <span className="text-[9px] text-white/70 whitespace-nowrap">Today</span>
            </div>
          </div>
        )}

        {/* Race marker at end */}
        <div className="absolute top-0 -right-0.5 bottom-0 flex items-center">
          <div className="w-1 h-full bg-amber-500/80 rounded-r" />
        </div>
      </div>

      {/* Phase details */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
        {data.phases.map((phase) => {
          const colors = getPhaseColor(phase.phase);
          const isCurrent = isPhaseCurrent(phase, data.currentDate);
          return (
            <div
              key={phase.phase}
              className={cn(
                'rounded-lg border p-2.5 text-xs transition-all',
                colors.bg,
                colors.border,
                isCurrent && 'ring-1 ring-white/20'
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className={cn('w-2 h-2 rounded-full', colors.dot)} />
                <span className={cn('font-medium', colors.text)}>
                  {getPhaseLabel(phase.phase)}
                </span>
                {isCurrent && (
                  <ChevronRight className={cn('w-3 h-3 ml-auto', colors.text)} />
                )}
              </div>
              <p className="text-textTertiary text-[10px] leading-tight">
                {formatDateShort(phase.startDate)} - {formatDateShort(phase.endDate)}
              </p>
              {phase.targetMileageMax > 0 && (
                <p className="text-textSecondary text-[10px] mt-0.5">
                  {phase.targetMileageMin === phase.targetMileageMax
                    ? `${phase.targetMileageMax} mi/wk`
                    : `${phase.targetMileageMin}-${phase.targetMileageMax} mi/wk`}
                </p>
              )}
              <p className="text-textTertiary text-[10px] mt-0.5 line-clamp-1">
                {phase.focus}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isPhaseCurrent(phase: PeriodizationPhase, currentDate: string): boolean {
  return phase.startDate <= currentDate && phase.endDate >= currentDate;
}

// ── Meso Cycle View ────────────────────────────────────────────────────

function MesoCycleView({ data }: { data: MesoCycleData }) {
  const maxMileage = Math.max(
    ...data.weeks.map(w => Math.max(w.targetMileage, w.actualMileage)),
    1
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-textSecondary">
          <Calendar className="w-3.5 h-3.5" />
          <span>Meso Cycle</span>
        </div>
        <div className="text-textTertiary text-[10px]">
          Planned vs Actual
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {data.weeks.map((week) => {
          const colors = getPhaseColor(week.phase);
          const targetPct = maxMileage > 0 ? (week.targetMileage / maxMileage) * 100 : 0;
          const actualPct = maxMileage > 0 ? (week.actualMileage / maxMileage) * 100 : 0;

          return (
            <div
              key={week.weekNumber}
              className={cn(
                'rounded-lg border p-2.5 transition-all',
                week.isCurrentWeek
                  ? 'border-white/20 bg-white/5 ring-1 ring-white/10'
                  : 'border-borderSecondary bg-bgTertiary/30'
              )}
            >
              {/* Week header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-textSecondary">
                    Wk {week.weekNumber}
                  </span>
                  {week.isCurrentWeek && (
                    <span className="text-[8px] bg-dream-500/20 text-dream-400 px-1 rounded">
                      NOW
                    </span>
                  )}
                </div>
                {week.isDownWeek && (
                  <span title="Down week">
                    <TrendingDown className="w-3 h-3 text-textTertiary" />
                  </span>
                )}
              </div>

              {/* Dual bar chart */}
              <div className="flex gap-1 h-16 items-end mb-1.5">
                {/* Target bar */}
                <div className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className={cn('w-full rounded-t', colors.bar, 'opacity-40')}
                    style={{ height: `${Math.max(targetPct, 3)}%` }}
                    title={`Target: ${week.targetMileage} mi`}
                  />
                </div>
                {/* Actual bar */}
                <div className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className={cn(
                      'w-full rounded-t',
                      week.actualMileage > 0 ? colors.bar : 'bg-stone-700/30',
                    )}
                    style={{ height: `${Math.max(actualPct, 3)}%` }}
                    title={`Actual: ${week.actualMileage} mi`}
                  />
                </div>
              </div>

              {/* Mileage labels */}
              <div className="flex justify-between text-[9px]">
                <span className="text-textTertiary">{week.targetMileage}</span>
                <span className={cn(
                  'font-medium',
                  week.actualMileage >= week.targetMileage * 0.9
                    ? 'text-emerald-400'
                    : week.actualMileage > 0
                      ? 'text-amber-400'
                      : 'text-textTertiary'
                )}>
                  {week.actualMileage > 0 ? week.actualMileage : '-'}
                </span>
              </div>

              {/* Quality session badges */}
              {week.qualitySessions.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1.5">
                  {week.qualitySessions.map((session, idx) => (
                    <span
                      key={idx}
                      className="text-[8px] font-medium bg-white/5 text-textSecondary px-1 py-0.5 rounded"
                      title={session.name}
                    >
                      {session.type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-textTertiary">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-blue-500/40 rounded-sm" />
          <span>Planned</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-blue-500/70 rounded-sm" />
          <span>Actual</span>
        </div>
      </div>
    </div>
  );
}

// ── Micro Cycle View ───────────────────────────────────────────────────

function MicroCycleView({ data }: { data: MicroCycleData }) {
  const colors = getPhaseColor(data.phase);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-textSecondary">
          <Calendar className="w-3.5 h-3.5" />
          <span>This Week</span>
          {data.weekNumber > 0 && (
            <span className="text-textTertiary text-[10px]">
              (Week {data.weekNumber} &middot; {getPhaseLabel(data.phase)})
            </span>
          )}
        </div>
      </div>

      {/* 7-day row */}
      <div className="grid grid-cols-7 gap-1">
        {data.days.map((day) => {
          const style = getWorkoutStyle(day.plannedWorkoutType);

          return (
            <div
              key={day.date}
              className={cn(
                'rounded-lg border p-2 text-center transition-all min-h-[72px] flex flex-col items-center justify-between',
                day.isToday
                  ? 'border-white/20 bg-white/5 ring-1 ring-white/10'
                  : day.isFuture
                    ? 'border-borderSecondary/50 bg-bgTertiary/20'
                    : 'border-borderSecondary bg-bgTertiary/30'
              )}
              title={day.plannedWorkoutName || day.dayLabel}
            >
              {/* Day label */}
              <span className={cn(
                'text-[10px] font-medium',
                day.isToday ? 'text-dream-400' : 'text-textTertiary'
              )}>
                {day.dayLabel}
              </span>

              {/* Status icon + workout badge */}
              <div className="flex flex-col items-center gap-1 my-1">
                {day.plannedWorkoutType ? (
                  <>
                    {/* Completion status */}
                    {day.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : day.isFuture ? (
                      <Circle className="w-4 h-4 text-textTertiary/40" />
                    ) : (
                      <Minus className="w-4 h-4 text-amber-400/60" />
                    )}

                    {/* Workout type badge */}
                    {style && (
                      <span className={cn(
                        'text-[8px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap',
                        style.bg,
                        style.text,
                        day.isKeyWorkout && 'ring-1 ring-current/30'
                      )}>
                        {style.label}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[9px] text-textTertiary/50">Rest</span>
                )}
              </div>

              {/* Actual miles */}
              {day.actualMiles !== null && day.actualMiles > 0 && (
                <span className="text-[9px] text-textSecondary">
                  {day.actualMiles} mi
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────

function PeriodizationSkeleton() {
  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 bg-bgTertiary rounded animate-pulse" />
        <div className="h-4 w-20 bg-bgTertiary rounded animate-pulse" />
      </div>

      {/* Macro skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-24 bg-bgTertiary rounded animate-pulse" />
        <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden">
          <div className="flex-[3] bg-bgTertiary animate-pulse" />
          <div className="flex-[4] bg-bgTertiary animate-pulse" style={{ animationDelay: '100ms' }} />
          <div className="flex-[2] bg-bgTertiary animate-pulse" style={{ animationDelay: '200ms' }} />
          <div className="flex-1 bg-bgTertiary animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      {/* Meso skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-20 bg-bgTertiary rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-bgTertiary rounded-lg animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>

      {/* Micro skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-20 bg-bgTertiary rounded animate-pulse" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[72px] bg-bgTertiary rounded-lg animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
