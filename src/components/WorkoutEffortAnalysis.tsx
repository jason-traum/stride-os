'use client';

import type { WorkoutAnalysis } from '@/actions/workout-analysis';

const impactColors = {
  high: 'border-rose-500/30 bg-rose-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  low: 'border-sky-500/30 bg-sky-500/5',
};

const impactBadge = {
  high: 'bg-rose-500/20 text-rose-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-sky-500/20 text-sky-300',
};

export function WorkoutEffortAnalysis({ analysis }: { analysis: WorkoutAnalysis }) {
  if (analysis.factors.length === 0) return null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-textPrimary mb-3 flex items-center gap-2">
        <span className="text-base">🧠</span>
        Why This Felt Hard
      </h3>

      {analysis.summary && (
        <p className="text-xs text-textTertiary mb-3">{analysis.summary}</p>
      )}

      <div className="space-y-2">
        {analysis.factors.map((factor, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg border ${impactColors[factor.impact]}`}
          >
            <span className="text-lg leading-none mt-0.5">{factor.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-textPrimary">{factor.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase ${impactBadge[factor.impact]}`}>
                  {factor.impact}
                </span>
              </div>
              <p className="text-xs text-textSecondary mt-0.5">{factor.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
