'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GitCompare, Loader2, ChevronRight, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import {
  findSimilarWorkouts,
  compareWorkouts,
  estimateRunningPower,
  getEfficiencyMetrics,
  type SimilarWorkout,
  type WorkoutComparison,
} from '@/actions/workout-compare';

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
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-amber-500" />
          Similar Workouts
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
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
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <GitCompare className="w-5 h-5 text-amber-500" />
        Similar Workouts
      </h2>

      <div className="space-y-2">
        {similar.map((w) => (
          <Link
            key={w.id}
            href={`/workout/${w.id}`}
            className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-xs font-bold text-amber-600">{w.similarity}%</span>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-900">{w.name}</p>
                <p className="text-xs text-stone-500">
                  {formatDate(w.date)} · {w.distanceMiles.toFixed(1)} mi
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {w.avgPaceSeconds && (
                <span className="text-sm font-mono text-stone-600">
                  {formatPace(w.avgPaceSeconds)}/mi
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </div>
          </Link>
        ))}
      </div>
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
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Running Power
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (!power) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        Running Power
        <span className="text-xs font-normal text-stone-400 ml-auto">Estimated</span>
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-stone-900">{power.avgPower}</p>
          <p className="text-xs text-stone-500">Avg Power (W)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-stone-900">{power.normalizedPower}</p>
          <p className="text-xs text-stone-500">Norm Power (W)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-stone-900">{power.powerPerKg}</p>
          <p className="text-xs text-stone-500">W/kg</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-stone-900">{power.efficiency}%</p>
          <p className="text-xs text-stone-500">Efficiency</p>
        </div>
      </div>

      <p className="text-xs text-stone-400 mt-4 pt-4 border-t border-stone-100">
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
      decouplingStatus = { label: 'Good', color: 'text-amber-600' };
    } else if (pd < 8) {
      decouplingStatus = { label: 'Fair', color: 'text-yellow-600' };
    } else {
      decouplingStatus = { label: 'High', color: 'text-red-600' };
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-emerald-500" />
        Efficiency Metrics
      </h2>

      <div className="space-y-4">
        {hasPaceDecoupling && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-stone-600">Pace Decoupling</span>
              <span className={`text-sm font-semibold ${decouplingStatus?.color}`}>
                {metrics.paceDecoupling! > 0 ? '+' : ''}{metrics.paceDecoupling}%
              </span>
            </div>
            <p className="text-xs text-stone-400">
              {decouplingStatus?.label} - {metrics.paceDecoupling! < 5
                ? 'Your pace stayed consistent throughout'
                : 'Pace slowed in second half'}
            </p>
          </div>
        )}

        {hasAerobicEfficiency && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-stone-600">Aerobic Efficiency</span>
              <span className="text-sm font-semibold text-stone-900">
                {metrics.aerobicEfficiency} sec/bpm
              </span>
            </div>
            <p className="text-xs text-stone-400">
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
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <p className="text-stone-500 text-center">Unable to compare workouts</p>
      </div>
    );
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <GitCompare className="w-5 h-5 text-purple-500" />
        Workout Comparison
      </h2>

      {/* Workout headers */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-stone-100">
        <div />
        <div className="text-center">
          <Link href={`/workout/${comparison.workout1.id}`} className="text-sm font-medium text-amber-600 hover:text-amber-700">
            {comparison.workout1.name}
          </Link>
          <p className="text-xs text-stone-400">{formatDate(comparison.workout1.date)}</p>
        </div>
        <div className="text-center">
          <Link href={`/workout/${comparison.workout2.id}`} className="text-sm font-medium text-amber-600 hover:text-amber-700">
            {comparison.workout2.name}
          </Link>
          <p className="text-xs text-stone-400">{formatDate(comparison.workout2.date)}</p>
        </div>
      </div>

      {/* Differences */}
      <div className="space-y-3">
        {comparison.differences.map((diff) => (
          <div key={diff.metric} className="grid grid-cols-3 gap-4 items-center">
            <span className="text-sm text-stone-600">{diff.label}</span>
            <div className="text-center">
              <span className={`text-sm font-mono ${diff.better === 1 ? 'text-green-600 font-semibold' : 'text-stone-700'}`}>
                {diff.metric === 'pace' ? formatPace(diff.value1 as number) : diff.value1}
              </span>
            </div>
            <div className="text-center flex items-center justify-center gap-1">
              <span className={`text-sm font-mono ${diff.better === 2 ? 'text-green-600 font-semibold' : 'text-stone-700'}`}>
                {diff.metric === 'pace' ? formatPace(diff.value2 as number) : diff.value2}
              </span>
              {diff.diff !== 0 && (
                <span className={`text-xs ${diff.better === 2 ? 'text-green-500' : diff.better === 1 ? 'text-red-500' : 'text-stone-400'}`}>
                  ({diff.diff > 0 ? '+' : ''}{diff.metric === 'pace' ? `${diff.diff}s` : diff.diff})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lap comparison if available */}
      {comparison.lapComparison && comparison.lapComparison.length > 0 && (
        <div className="mt-6 pt-6 border-t border-stone-100">
          <h3 className="text-sm font-medium text-stone-700 mb-3">Lap-by-Lap</h3>
          <div className="space-y-2">
            {comparison.lapComparison.slice(0, 10).map((lap) => (
              <div key={lap.lap} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-stone-400">Lap {lap.lap}</span>
                <span className="w-16 font-mono text-stone-600">
                  {lap.pace1 ? formatPace(lap.pace1) : '-'}
                </span>
                <div className="flex-1 flex items-center justify-center">
                  {lap.diff !== null && (
                    <span className={`text-xs ${lap.diff < 0 ? 'text-green-500' : lap.diff > 0 ? 'text-red-500' : 'text-stone-400'}`}>
                      {lap.diff < 0 ? <TrendingDown className="w-3 h-3 inline" /> : lap.diff > 0 ? <TrendingUp className="w-3 h-3 inline" /> : <Minus className="w-3 h-3 inline" />}
                      {Math.abs(lap.diff)}s
                    </span>
                  )}
                </div>
                <span className="w-16 font-mono text-stone-600 text-right">
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
