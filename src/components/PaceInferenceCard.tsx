'use client';

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inferPacesFromWorkouts, comparePacesWithSettings, type InferredPaces } from '@/actions/pace-inference';

function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface PaceInferenceCardProps {
  onApplyPaces?: (paces: {
    easyPaceSeconds: number;
    tempoPaceSeconds: number;
    thresholdPaceSeconds: number;
    intervalPaceSeconds: number;
  }) => void;
}

export function PaceInferenceCard({ onApplyPaces }: PaceInferenceCardProps) {
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof comparePacesWithSettings>> | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    comparePacesWithSettings()
      .then(setComparison)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-teal-500" />
          <h3 className="font-semibold text-primary">Smart Pace Inference</h3>
        </div>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  const { inferred, current, differences, recommendation } = comparison;

  const confidenceColors = {
    high: 'text-green-600 bg-green-50 dark:bg-green-950',
    medium: 'text-teal-600 bg-surface-1',
    low: 'text-textSecondary bg-stone-100',
  };

  const handleApply = () => {
    if (onApplyPaces) {
      onApplyPaces({
        easyPaceSeconds: inferred.easyPaceSeconds,
        tempoPaceSeconds: inferred.tempoPaceSeconds,
        thresholdPaceSeconds: inferred.thresholdPaceSeconds,
        intervalPaceSeconds: inferred.intervalPaceSeconds,
      });
      setApplied(true);
      setTimeout(() => setApplied(false), 3000);
    }
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-teal-500" />
          <h3 className="font-semibold text-primary">Smart Pace Inference</h3>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', confidenceColors[inferred.confidence])}>
          {inferred.confidence === 'high' ? 'High Confidence' : inferred.confidence === 'medium' ? 'Medium Confidence' : 'Low Confidence'}
        </span>
      </div>

      <p className="text-sm text-textSecondary mb-4">
        Based on {inferred.dataPoints.easyRuns + inferred.dataPoints.tempoRuns + inferred.dataPoints.intervalRuns + inferred.dataPoints.races} recent workouts
        {inferred.source !== 'defaults' && (
          <span className="text-tertiary"> · {inferred.source.replace(/_/g, ' ')}</span>
        )}
      </p>

      {/* Pace comparison table */}
      <div className="border border-borderSecondary rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-bgTertiary">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-textSecondary">Zone</th>
              <th className="text-center py-2 px-3 font-medium text-textSecondary">Current</th>
              <th className="text-center py-2 px-3 font-medium text-textSecondary">Inferred</th>
              <th className="text-center py-2 px-3 font-medium text-textSecondary">Diff</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Easy', current: current.easyPaceSeconds, inferred: inferred.easyPaceSeconds, diff: differences.easy },
              { name: 'Tempo', current: current.tempoPaceSeconds, inferred: inferred.tempoPaceSeconds, diff: differences.tempo },
              { name: 'Threshold', current: current.thresholdPaceSeconds, inferred: inferred.thresholdPaceSeconds, diff: differences.threshold },
              { name: 'Interval', current: current.intervalPaceSeconds, inferred: inferred.intervalPaceSeconds, diff: differences.interval },
            ].map((row, i) => (
              <tr key={row.name} className={i % 2 === 0 ? 'bg-surface-1' : 'bg-bgTertiary/50'}>
                <td className="py-2 px-3 font-medium text-primary">{row.name}</td>
                <td className="py-2 px-3 text-center text-textSecondary">
                  {row.current ? formatPace(row.current) : '—'}
                </td>
                <td className="py-2 px-3 text-center font-mono text-primary">
                  {formatPace(row.inferred)}
                </td>
                <td className="py-2 px-3 text-center">
                  {row.diff !== null && (
                    <span className={cn(
                      'text-xs font-medium',
                      row.diff < -5 ? 'text-green-600' : row.diff > 5 ? 'text-red-600' : 'text-tertiary'
                    )}>
                      {row.diff > 0 ? '+' : ''}{row.diff}s
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Estimated VDOT */}
      <div className="flex items-center gap-2 text-sm text-textSecondary mb-4">
        <TrendingUp className="w-4 h-4" />
        <span>Estimated VDOT: <span className="font-semibold text-primary">{inferred.estimatedVdot}</span></span>
        {current.vdot && (
          <span className="text-tertiary">
            (current: {current.vdot})
          </span>
        )}
      </div>

      {/* Recommendation */}
      <div className={cn(
        'text-sm p-3 rounded-lg mb-4',
        inferred.confidence === 'low' ? 'bg-bgTertiary text-textSecondary' :
          differences.easy && differences.easy < -10 ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' :
            differences.easy && differences.easy > 15 ? 'bg-surface-1 text-teal-700 dark:text-teal-300' :
              'bg-surface-1 text-teal-700 dark:text-teal-300'
      )}>
        {inferred.confidence === 'low' ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{recommendation}</span>
          </div>
        ) : (
          recommendation
        )}
      </div>

      {/* Apply button */}
      {onApplyPaces && inferred.confidence !== 'low' && (
        <button
          onClick={handleApply}
          disabled={applied}
          className={cn(
            'w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors',
            applied
              ? 'bg-green-100 text-green-700 dark:text-green-300'
              : 'bg-teal-500 text-white hover:bg-teal-600'
          )}
        >
          {applied ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Paces Applied
            </span>
          ) : (
            'Apply Inferred Paces'
          )}
        </button>
      )}

      {/* Data breakdown */}
      <div className="mt-4 pt-4 border-t border-borderSecondary grid grid-cols-4 gap-2 text-xs text-center">
        <div>
          <div className="font-semibold text-primary">{inferred.dataPoints.easyRuns}</div>
          <div className="text-textTertiary">Easy</div>
        </div>
        <div>
          <div className="font-semibold text-primary">{inferred.dataPoints.tempoRuns}</div>
          <div className="text-textTertiary">Tempo</div>
        </div>
        <div>
          <div className="font-semibold text-primary">{inferred.dataPoints.intervalRuns}</div>
          <div className="text-textTertiary">Interval</div>
        </div>
        <div>
          <div className="font-semibold text-primary">{inferred.dataPoints.races}</div>
          <div className="text-textTertiary">Races</div>
        </div>
      </div>
    </div>
  );
}
