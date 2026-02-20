'use client';

import { useState, useEffect } from 'react';
import { Layers, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { getVDOTPaces } from '@/actions/race-predictor';

type VDOTPacesResult = NonNullable<Awaited<ReturnType<typeof getVDOTPaces>>>;

const ZONE_COLORS: Record<string, string> = {
  Easy: 'bg-sky-500',
  Steady: 'bg-sky-600',
  Marathon: 'bg-blue-600',
  Tempo: 'bg-indigo-600',
  Threshold: 'bg-violet-600',
  Interval: 'bg-red-600',
  Repetition: 'bg-rose-700',
};

export function ZoneBoundariesCard() {
  const [data, setData] = useState<VDOTPacesResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVDOTPaces().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-dream-500" />
          Classifier Zones
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const hasFormDiff = !!data.paces[0]?.currentPaceRange;
  const isFatigued = data.formAdjustmentPct > 0;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-primary flex items-center gap-2">
          <Layers className="w-5 h-5 text-dream-500" />
          Classifier Zones
        </h2>
        <span className="text-xs text-textTertiary">
          VDOT {data.vdot}
        </span>
      </div>

      {/* Form status banner */}
      {hasFormDiff && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-4 text-xs font-medium ${
          isFatigued
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        }`}>
          {isFatigued
            ? <TrendingDown className="w-3.5 h-3.5" />
            : <TrendingUp className="w-3.5 h-3.5" />
          }
          {data.formDescription}
        </div>
      )}

      {/* Zone table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-textTertiary text-xs uppercase tracking-wide">
              <th className="text-left pb-2 font-medium">Zone</th>
              <th className="text-right pb-2 font-medium">Peaked</th>
              {hasFormDiff && (
                <th className="text-right pb-2 font-medium">Current</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-borderSecondary">
            {data.paces.map((pace) => (
              <tr key={pace.type}>
                <td className="py-2.5 flex items-center gap-2.5">
                  <div className={`w-2 h-6 rounded-full ${ZONE_COLORS[pace.type] || 'bg-gray-500'}`} />
                  <span className="font-medium text-primary">{pace.type}</span>
                </td>
                <td className="py-2.5 text-right font-mono text-textSecondary whitespace-nowrap">
                  {pace.paceRange}
                </td>
                {hasFormDiff && (
                  <td className={`py-2.5 text-right font-mono whitespace-nowrap ${
                    isFatigued ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {pace.currentPaceRange || pace.paceRange}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-borderSecondary">
        <p className="text-xs text-textTertiary">
          These pace ranges determine how your splits are auto-categorized. Peaked paces reflect your fitness ceiling; current paces account for training load.
        </p>
      </div>
    </div>
  );
}
