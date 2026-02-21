import { cn, getWorkoutTypeLabel, getWorkoutTypeColor } from '@/lib/utils';
import { Brain, CircleDot, ArrowDown, ArrowUp, Check } from 'lucide-react';
import type { TrainingCue } from '@/actions/training-cues';

interface SmartTrainingCueProps {
  cue: TrainingCue;
}

const CONFIDENCE_DOT: Record<string, string> = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-slate-400',
};

const IMPACT_COLORS: Record<string, string> = {
  positive: 'bg-emerald-500/15 text-emerald-400',
  neutral: 'bg-slate-500/15 text-slate-400',
  caution: 'bg-amber-500/15 text-amber-400',
  warning: 'bg-red-500/15 text-red-400',
};

const ALIGNMENT_CONFIG = {
  agrees: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    icon: Check,
    label: 'Aligns with your plan',
  },
  suggests_easier: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    icon: ArrowDown,
    label: 'Your body may want easier than planned',
  },
  suggests_harder: {
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    icon: ArrowUp,
    label: 'You could push harder than planned',
  },
};

export function SmartTrainingCue({ cue }: SmartTrainingCueProps) {
  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-borderPrimary">
        <Brain className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-medium text-textPrimary">Tomorrow&apos;s Suggestion</span>
        <div className="ml-auto flex items-center gap-1.5">
          <CircleDot className={cn('w-3 h-3', CONFIDENCE_DOT[cue.confidence])} />
          <span className="text-[10px] text-textTertiary capitalize">{cue.confidence} confidence</span>
        </div>
      </div>

      <div className="p-4">
        {/* Suggestion */}
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getWorkoutTypeColor(cue.suggestedType as any))}>
            {cue.suggestedType === 'rest' ? 'Rest' : getWorkoutTypeLabel(cue.suggestedType as any)}
          </span>
          {/* Only show name if it differs from the type label to avoid duplication */}
          {cue.suggestedName !== getWorkoutTypeLabel(cue.suggestedType as any) && (
            <span className="text-sm font-semibold text-textPrimary">{cue.suggestedName}</span>
          )}
          <span className="text-xs text-textTertiary ml-auto">{cue.distanceRange}</span>
        </div>

        {/* Reasoning */}
        <p className="text-sm text-textSecondary mb-3">{cue.reasoning}</p>

        {/* Factor pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {cue.factors.map((f) => (
            <span
              key={f.label}
              className={cn('px-2 py-0.5 rounded text-[10px] font-medium', IMPACT_COLORS[f.impact])}
            >
              {f.label}: {f.value}
            </span>
          ))}
        </div>

        {/* Plan alignment */}
        {cue.alignment && cue.plannedWorkout && (
          <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-xs', ALIGNMENT_CONFIG[cue.alignment].bg)}>
            {(() => {
              const AlignIcon = ALIGNMENT_CONFIG[cue.alignment!].icon;
              return <AlignIcon className={cn('w-3.5 h-3.5', ALIGNMENT_CONFIG[cue.alignment!].color)} />;
            })()}
            <span className={ALIGNMENT_CONFIG[cue.alignment].color}>
              {ALIGNMENT_CONFIG[cue.alignment].label}
            </span>
            <span className="text-textTertiary ml-auto">
              Plan: {cue.plannedWorkout.name}
              {cue.plannedWorkout.targetDistanceMiles && ` (${cue.plannedWorkout.targetDistanceMiles} mi)`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
