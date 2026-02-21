'use client';

import type { WorkoutAnalysis, EffortFactor } from '@/actions/workout-analysis';

const negativeImpactColors = {
  high: 'border-rose-500/30 bg-rose-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  low: 'border-slate-500/30 bg-slate-500/5',
};

const negativeImpactBadge = {
  high: 'bg-rose-500/20 text-rose-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-slate-500/20 text-slate-300',
};

const negativeBarColor = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-500',
};

const negativeBarWidth = {
  high: 'w-full',
  medium: 'w-2/3',
  low: 'w-1/3',
};

const positiveColors = 'border-emerald-500/30 bg-emerald-500/5';
const positiveBadge = 'bg-emerald-500/20 text-emerald-300';

function FactorRow({ factor, positive }: { factor: EffortFactor; positive?: boolean }) {
  const colors = positive ? positiveColors : negativeImpactColors[factor.impact];
  const badge = positive ? positiveBadge : negativeImpactBadge[factor.impact];
  const barColor = positive ? 'bg-emerald-500' : negativeBarColor[factor.impact];
  const barWidth = positive ? negativeBarWidth[factor.impact] : negativeBarWidth[factor.impact];

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${colors}`}>
      <span className="text-lg leading-none mt-0.5">{factor.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-textPrimary">{factor.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase ${badge}`}>
            {factor.impact}
          </span>
        </div>
        <p className="text-xs text-textSecondary mt-0.5">{factor.detail}</p>
        {/* Impact bar */}
        <div className="mt-1.5 h-1 rounded-full bg-bgTertiary overflow-hidden">
          <div className={`h-full rounded-full ${barColor} ${barWidth} transition-all`} />
        </div>
      </div>
    </div>
  );
}

export function WorkoutEffortAnalysis({ analysis }: { analysis: WorkoutAnalysis }) {
  const hasNegative = analysis.factors.length > 0;
  const hasPositive = analysis.positiveFactors.length > 0;

  if (!hasNegative && !hasPositive) return null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {hasNegative && (
        <>
          <h3 className="text-sm font-semibold text-textPrimary mb-1 flex items-center gap-2">
            <span className="text-base">🧠</span>
            Why This Felt Hard
          </h3>
          {analysis.summary && (
            <p className="text-xs text-textTertiary mb-3">{analysis.summary}</p>
          )}
          <div className="space-y-2">
            {analysis.factors.map((factor, i) => (
              <FactorRow key={i} factor={factor} />
            ))}
          </div>
        </>
      )}

      {hasPositive && (
        <div className={hasNegative ? 'mt-4 pt-4 border-t border-borderSecondary' : ''}>
          <h3 className="text-sm font-semibold text-textPrimary mb-3 flex items-center gap-2">
            <span className="text-base">{hasNegative ? '🌟' : '🧠'}</span>
            {hasNegative ? 'Working In Your Favor' : 'What Went Right'}
          </h3>
          <div className="space-y-2">
            {analysis.positiveFactors.map((factor, i) => (
              <FactorRow key={i} factor={factor} positive />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
