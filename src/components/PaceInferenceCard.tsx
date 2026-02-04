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
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-stone-900">Smart Pace Inference</h3>
        </div>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  const { inferred, current, differences, recommendation } = comparison;

  const confidenceColors = {
    high: 'text-green-600 bg-green-50',
    medium: 'text-amber-600 bg-amber-50',
    low: 'text-stone-600 bg-stone-100',
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
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-stone-900">Smart Pace Inference</h3>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', confidenceColors[inferred.confidence])}>
          {inferred.confidence === 'high' ? 'High Confidence' : inferred.confidence === 'medium' ? 'Medium Confidence' : 'Low Confidence'}
        </span>
      </div>

      <p className="text-sm text-stone-600 mb-4">
        Based on {inferred.dataPoints.easyRuns + inferred.dataPoints.tempoRuns + inferred.dataPoints.intervalRuns + inferred.dataPoints.races} recent workouts
        {inferred.source !== 'defaults' && (
          <span className="text-stone-400"> · {inferred.source.replace(/_/g, ' ')}</span>
        )}
      </p>

      {/* Pace comparison table */}
      <div className="border border-stone-100 rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-stone-600">Zone</th>
              <th className="text-center py-2 px-3 font-medium text-stone-600">Current</th>
              <th className="text-center py-2 px-3 font-medium text-stone-600">Inferred</th>
              <th className="text-center py-2 px-3 font-medium text-stone-600">Diff</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Easy', current: current.easyPaceSeconds, inferred: inferred.easyPaceSeconds, diff: differences.easy },
              { name: 'Tempo', current: current.tempoPaceSeconds, inferred: inferred.tempoPaceSeconds, diff: differences.tempo },
              { name: 'Threshold', current: current.thresholdPaceSeconds, inferred: inferred.thresholdPaceSeconds, diff: differences.threshold },
              { name: 'Interval', current: current.intervalPaceSeconds, inferred: inferred.intervalPaceSeconds, diff: differences.interval },
            ].map((row, i) => (
              <tr key={row.name} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                <td className="py-2 px-3 font-medium text-stone-900">{row.name}</td>
                <td className="py-2 px-3 text-center text-stone-600">
                  {row.current ? formatPace(row.current) : '—'}
                </td>
                <td className="py-2 px-3 text-center font-mono text-stone-900">
                  {formatPace(row.inferred)}
                </td>
                <td className="py-2 px-3 text-center">
                  {row.diff !== null && (
                    <span className={cn(
                      'text-xs font-medium',
                      row.diff < -5 ? 'text-green-600' : row.diff > 5 ? 'text-red-600' : 'text-stone-400'
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
      <div className="flex items-center gap-2 text-sm text-stone-600 mb-4">
        <TrendingUp className="w-4 h-4" />
        <span>Estimated VDOT: <span className="font-semibold text-stone-900">{inferred.estimatedVdot}</span></span>
        {current.vdot && (
          <span className="text-stone-400">
            (current: {current.vdot})
          </span>
        )}
      </div>

      {/* Recommendation */}
      <div className={cn(
        'text-sm p-3 rounded-lg mb-4',
        inferred.confidence === 'low' ? 'bg-stone-50 text-stone-600' :
          differences.easy && differences.easy < -10 ? 'bg-green-50 text-green-700' :
            differences.easy && differences.easy > 15 ? 'bg-amber-50 text-amber-700' :
              'bg-amber-50 text-amber-700'
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
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-500 text-white hover:bg-amber-600'
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
      <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-4 gap-2 text-xs text-center">
        <div>
          <div className="font-semibold text-stone-900">{inferred.dataPoints.easyRuns}</div>
          <div className="text-stone-500">Easy</div>
        </div>
        <div>
          <div className="font-semibold text-stone-900">{inferred.dataPoints.tempoRuns}</div>
          <div className="text-stone-500">Tempo</div>
        </div>
        <div>
          <div className="font-semibold text-stone-900">{inferred.dataPoints.intervalRuns}</div>
          <div className="text-stone-500">Interval</div>
        </div>
        <div>
          <div className="font-semibold text-stone-900">{inferred.dataPoints.races}</div>
          <div className="text-stone-500">Races</div>
        </div>
      </div>
    </div>
  );
}
