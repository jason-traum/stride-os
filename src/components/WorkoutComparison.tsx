'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GitCompare, Loader2, ChevronRight, Zap, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, Heart, BarChart3 } from 'lucide-react';
import { formatPace, getWorkoutTypeLabel } from '@/lib/utils';
import {
  findSimilarWorkouts,
  compareWorkouts,
  estimateRunningPower,
  getEfficiencyMetrics,
  type SimilarWorkout,
  type WorkoutComparison,
} from '@/actions/workout-compare';
import {
  getWorkoutComparison,
  type WorkoutComparisonResult,
  type ComparisonWorkout,
} from '@/actions/workout-comparison';

/**
 * Similar Workouts List
 */
export function SimilarWorkoutsList({ workoutId }: { workoutId: number }) {
  const [similar, setSimilar] = useState<SimilarWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    findSimilarWorkouts(workoutId, 5).then(data => {
      setSimilar(data);
      setLoading(false);
    });
  }, [workoutId]);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-dream-500" />
          Similar Workouts
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (similar.length === 0) {
    return null;
  }

  // Format date
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <GitCompare className="w-5 h-5 text-dream-500" />
        Similar Workouts
      </h2>

      <div className="space-y-2">
        {similar.map((w) => (
          <Link
            key={w.id}
            href={`/workout/${w.id}`}
            className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-bgTertiary transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-dream-50 flex items-center justify-center">
                <span className="text-xs font-bold text-dream-600">{w.similarity}%</span>
              </div>
              <div>
                <p className="text-sm font-medium text-primary">{w.name}</p>
                <p className="text-xs text-textTertiary">
                  {formatDate(w.date)} · {w.distanceMiles.toFixed(1)} mi
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {w.avgPaceSeconds && (
                <span className="text-sm font-mono text-textSecondary">
                  {formatPace(w.avgPaceSeconds)}/mi
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-tertiary" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Workout Comparison Card — "Compare this tempo to your last 5 tempos"
 * Highlights improvement in pace, HR, and efficiency.
 */
export function WorkoutComparisonCard({ workoutId }: { workoutId: number }) {
  const [data, setData] = useState<WorkoutComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkoutComparison(workoutId).then((result) => {
      if (result.success) {
        setData(result.data);
      }
      setLoading(false);
    });
  }, [workoutId]);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-dream-500" />
          Workout Comparison
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatDist(miles: number | null): string {
    if (!miles) return '--';
    return miles.toFixed(1);
  }

  function DeltaIndicator({ value, invert = false }: { value: number | null; invert?: boolean }) {
    if (value === null || value === 0) return <Minus className="w-3 h-3 text-textTertiary" />;
    // For pace/efficiency: negative = improvement (faster/more efficient). For HR at same pace: lower can be better.
    // invert=true means lower is better (pace, efficiency, HR)
    const isGood = invert ? value < 0 : value > 0;
    const absVal = Math.abs(value);
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
        {value < 0 ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
        {absVal}
      </span>
    );
  }

  function WorkoutRow({ w, isTarget }: { w: ComparisonWorkout; isTarget: boolean }) {
    const paceDelta = isTarget ? null :
      (data!.target.avgPaceSeconds != null && w.avgPaceSeconds != null
        ? data!.target.avgPaceSeconds - w.avgPaceSeconds
        : null);
    const hrDelta = isTarget ? null :
      (data!.target.avgHR != null && w.avgHR != null
        ? data!.target.avgHR - w.avgHR
        : null);

    return (
      <Link
        href={isTarget ? '#' : `/workout/${w.id}`}
        className={`grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-2 rounded-lg text-sm ${
          isTarget
            ? 'bg-dream-500/10 border border-dream-500/20'
            : 'hover:bg-bgTertiary transition-colors'
        }`}
        onClick={isTarget ? (e: React.MouseEvent) => e.preventDefault() : undefined}
      >
        {/* Date */}
        <span className={`text-xs w-14 ${isTarget ? 'font-semibold text-dream-400' : 'text-textTertiary'}`}>
          {isTarget ? 'This' : formatDate(w.date)}
        </span>

        {/* Distance */}
        <span className="text-textSecondary font-mono text-right">
          {formatDist(w.distanceMiles)}
          <span className="text-textTertiary text-xs ml-0.5">mi</span>
        </span>

        {/* Pace + delta */}
        <div className="flex items-center justify-end gap-1">
          <span className={`font-mono ${isTarget ? 'text-textPrimary font-semibold' : 'text-textSecondary'}`}>
            {formatPace(w.avgPaceSeconds)}
          </span>
          {!isTarget && paceDelta !== null && (
            <DeltaIndicator value={paceDelta} invert />
          )}
        </div>

        {/* HR + delta */}
        <div className="flex items-center justify-end gap-1">
          {w.avgHR ? (
            <>
              <span className={`font-mono ${isTarget ? 'text-textPrimary font-semibold' : 'text-textSecondary'}`}>
                {w.avgHR}
              </span>
              {!isTarget && hrDelta !== null && (
                <DeltaIndicator value={hrDelta} invert />
              )}
            </>
          ) : (
            <span className="text-textTertiary">--</span>
          )}
        </div>
      </Link>
    );
  }

  const typeLabel = getWorkoutTypeLabel(data.workoutType);

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <h2 className="font-semibold text-textPrimary flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-dream-500" />
          vs. Last {data.previous.length} {typeLabel}{data.previous.length !== 1 ? 's' : ''}
        </h2>
        {data.paceRank === 1 && data.totalCompared > 1 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400">
            Fastest
          </span>
        )}
      </div>

      {/* Summary line */}
      <p className="text-sm text-textSecondary mb-4">{data.summary}</p>

      {/* Column headers */}
      <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center px-3 mb-1">
        <span className="text-xs text-textTertiary w-14">Date</span>
        <span className="text-xs text-textTertiary text-right">Dist</span>
        <span className="text-xs text-textTertiary text-right">Pace</span>
        <span className="text-xs text-textTertiary text-right flex items-center justify-end gap-0.5">
          <Heart className="w-3 h-3" /> HR
        </span>
      </div>

      {/* Target workout row */}
      <div className="space-y-1">
        <WorkoutRow w={data.target} isTarget />

        {/* Previous workouts */}
        {data.previous.map((w) => (
          <WorkoutRow key={w.id} w={w} isTarget={false} />
        ))}
      </div>

      {/* Delta summary chips */}
      {(data.deltas.paceVsAvg !== null || data.deltas.hrVsAvg !== null) && (
        <div className="mt-4 pt-3 border-t border-borderSecondary flex flex-wrap gap-3 text-xs">
          {data.deltas.paceVsAvg !== null && (
            <div className="flex items-center gap-1">
              <span className="text-textTertiary">vs avg pace:</span>
              <span className={`font-semibold ${data.deltas.paceVsAvg < 0 ? 'text-emerald-400' : data.deltas.paceVsAvg > 0 ? 'text-red-400' : 'text-textSecondary'}`}>
                {data.deltas.paceVsAvg < 0 ? '' : '+'}{data.deltas.paceVsAvg}s/mi
              </span>
            </div>
          )}
          {data.deltas.hrVsAvg !== null && (
            <div className="flex items-center gap-1">
              <span className="text-textTertiary">vs avg HR:</span>
              <span className={`font-semibold ${data.deltas.hrVsAvg < 0 ? 'text-emerald-400' : data.deltas.hrVsAvg > 0 ? 'text-amber-400' : 'text-textSecondary'}`}>
                {data.deltas.hrVsAvg < 0 ? '' : '+'}{data.deltas.hrVsAvg} bpm
              </span>
            </div>
          )}
          {data.deltas.efficiencyVsLast !== null && (
            <div className="flex items-center gap-1">
              <span className="text-textTertiary">efficiency:</span>
              <span className={`font-semibold ${data.deltas.efficiencyVsLast < 0 ? 'text-emerald-400' : data.deltas.efficiencyVsLast > 0 ? 'text-amber-400' : 'text-textSecondary'}`}>
                {data.deltas.efficiencyVsLast < 0 ? '' : '+'}{data.deltas.efficiencyVsLast} sec/bpm
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Running Power Estimate Card
 */
export function RunningPowerCard({ workoutId }: { workoutId: number }) {
  const [power, setPower] = useState<{
    avgPower: number;
    normalizedPower: number;
    powerPerKg: number;
    efficiency: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    estimateRunningPower(workoutId).then(data => {
      setPower(data);
      setLoading(false);
    });
  }, [workoutId]);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-secondary" />
          Running Power
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!power) {
    return null;
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-secondary" />
        Running Power
        <span className="text-xs font-normal text-tertiary ml-auto">Estimated</span>
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{power.avgPower}</p>
          <p className="text-xs text-textTertiary">Avg Power (W)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{power.normalizedPower}</p>
          <p className="text-xs text-textTertiary">Norm Power (W)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{power.powerPerKg}</p>
          <p className="text-xs text-textTertiary">W/kg</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{power.efficiency}%</p>
          <p className="text-xs text-textTertiary">Efficiency</p>
        </div>
      </div>

      <p className="text-xs text-tertiary mt-4 pt-4 border-t border-borderSecondary">
        Estimated metabolic power based on pace, distance, and elevation.
        Assumes 70kg body weight.
      </p>
    </div>
  );
}

/**
 * Efficiency Metrics Card
 */
export function EfficiencyMetricsCard({ workoutId }: { workoutId: number }) {
  const [metrics, setMetrics] = useState<{
    paceDecoupling: number | null;
    cardiacDrift: number | null;
    aerobicEfficiency: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEfficiencyMetrics(workoutId).then(data => {
      setMetrics(data);
      setLoading(false);
    });
  }, [workoutId]);

  if (loading || !metrics) {
    return null;
  }

  const hasPaceDecoupling = metrics.paceDecoupling !== null;
  const hasAerobicEfficiency = metrics.aerobicEfficiency !== null;

  if (!hasPaceDecoupling && !hasAerobicEfficiency) {
    return null;
  }

  // Evaluate pace decoupling
  let decouplingStatus: { label: string; color: string } | null = null;
  if (hasPaceDecoupling) {
    const pd = metrics.paceDecoupling!;
    if (pd < 3) {
      decouplingStatus = { label: 'Excellent', color: 'text-green-600' };
    } else if (pd < 5) {
      decouplingStatus = { label: 'Good', color: 'text-dream-600' };
    } else if (pd < 8) {
      decouplingStatus = { label: 'Fair', color: 'text-secondary' };
    } else {
      decouplingStatus = { label: 'High', color: 'text-red-600' };
    }
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-emerald-500" />
        Efficiency Metrics
      </h2>

      <div className="space-y-4">
        {hasPaceDecoupling && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-textSecondary">Pace Decoupling</span>
              <span className={`text-sm font-semibold ${decouplingStatus?.color}`}>
                {metrics.paceDecoupling! > 0 ? '+' : ''}{metrics.paceDecoupling}%
              </span>
            </div>
            <p className="text-xs text-tertiary">
              {decouplingStatus?.label} - {metrics.paceDecoupling! < 5
                ? 'Your pace stayed consistent throughout'
                : 'Pace slowed in second half'}
            </p>
          </div>
        )}

        {hasAerobicEfficiency && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-textSecondary">Aerobic Efficiency</span>
              <span className="text-sm font-semibold text-primary">
                {metrics.aerobicEfficiency} sec/bpm
              </span>
            </div>
            <p className="text-xs text-tertiary">
              Pace per heartbeat - lower is more efficient
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Workout Comparison View
 */
export function WorkoutComparisonView({
  workoutId1,
  workoutId2,
}: {
  workoutId1: number;
  workoutId2: number;
}) {
  const [comparison, setComparison] = useState<WorkoutComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    compareWorkouts(workoutId1, workoutId2).then(data => {
      setComparison(data);
      setLoading(false);
    });
  }, [workoutId1, workoutId2]);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <p className="text-textTertiary text-center">Unable to compare workouts</p>
      </div>
    );
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <GitCompare className="w-5 h-5 text-dream-500" />
        Workout Comparison
      </h2>

      {/* Workout headers */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-borderSecondary">
        <div />
        <div className="text-center">
          <Link href={`/workout/${comparison.workout1.id}`} className="link-primary text-sm">
            {comparison.workout1.name}
          </Link>
          <p className="text-xs text-tertiary">{formatDate(comparison.workout1.date)}</p>
        </div>
        <div className="text-center">
          <Link href={`/workout/${comparison.workout2.id}`} className="link-primary text-sm">
            {comparison.workout2.name}
          </Link>
          <p className="text-xs text-tertiary">{formatDate(comparison.workout2.date)}</p>
        </div>
      </div>

      {/* Differences */}
      <div className="space-y-3">
        {comparison.differences.map((diff) => (
          <div key={diff.metric} className="grid grid-cols-3 gap-4 items-center">
            <span className="text-sm text-textSecondary">{diff.label}</span>
            <div className="text-center">
              <span className={`text-sm font-mono ${diff.better === 1 ? 'text-green-600 font-semibold' : 'text-textSecondary'}`}>
                {diff.metric === 'pace' ? formatPace(diff.value1 as number) : diff.value1}
              </span>
            </div>
            <div className="text-center flex items-center justify-center gap-1">
              <span className={`text-sm font-mono ${diff.better === 2 ? 'text-green-600 font-semibold' : 'text-textSecondary'}`}>
                {diff.metric === 'pace' ? formatPace(diff.value2 as number) : diff.value2}
              </span>
              {diff.diff !== 0 && (
                <span className={`text-xs ${diff.better === 2 ? 'text-green-500' : diff.better === 1 ? 'text-red-500' : 'text-tertiary'}`}>
                  ({diff.diff > 0 ? '+' : ''}{diff.metric === 'pace' ? `${diff.diff}s` : diff.diff})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lap comparison if available */}
      {comparison.lapComparison && comparison.lapComparison.length > 0 && (
        <div className="mt-6 pt-6 border-t border-borderSecondary">
          <h3 className="text-sm font-medium text-textSecondary mb-3">Lap-by-Lap</h3>
          <div className="space-y-2">
            {comparison.lapComparison.slice(0, 10).map((lap) => (
              <div key={lap.lap} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-tertiary">Lap {lap.lap}</span>
                <span className="w-16 font-mono text-textSecondary">
                  {lap.pace1 ? formatPace(lap.pace1) : '-'}
                </span>
                <div className="flex-1 flex items-center justify-center">
                  {lap.diff !== null && (
                    <span className={`text-xs ${lap.diff < 0 ? 'text-green-500' : lap.diff > 0 ? 'text-red-500' : 'text-tertiary'}`}>
                      {lap.diff < 0 ? <TrendingDown className="w-3 h-3 inline" /> : lap.diff > 0 ? <TrendingUp className="w-3 h-3 inline" /> : <Minus className="w-3 h-3 inline" />}
                      {Math.abs(lap.diff)}s
                    </span>
                  )}
                </div>
                <span className="w-16 font-mono text-textSecondary text-right">
                  {lap.pace2 ? formatPace(lap.pace2) : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
