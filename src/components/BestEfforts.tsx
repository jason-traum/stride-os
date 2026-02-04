'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Medal, TrendingUp, Loader2, Zap, Crown } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import {
  getBestEfforts,
  getBestMileSplits,
  getPaceCurve,
  getWorkoutRanking,
  type BestEffort,
  type WorkoutRanking,
} from '@/actions/best-efforts';

// Format seconds to time string (mm:ss or h:mm:ss)
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format date nicely
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Best Efforts Table - shows PRs at standard distances
 */
export function BestEffortsTable() {
  const [efforts, setEfforts] = useState<BestEffort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBestEfforts().then(data => {
      setEfforts(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-slate-600" />
          Personal Bests
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (efforts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-slate-600" />
          Personal Bests
        </h2>
        <p className="text-sm text-stone-500">No completed efforts at standard distances yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-slate-600" />
        Personal Bests
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="pb-2 font-medium">Distance</th>
              <th className="pb-2 font-medium">Time</th>
              <th className="pb-2 font-medium">Pace</th>
              <th className="pb-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {efforts.map((effort) => (
              <tr key={effort.distance} className="border-b border-stone-50">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    {effort.isRace && <Medal className="w-4 h-4 text-slate-600" />}
                    <span className="font-medium text-stone-900">{effort.distance}</span>
                  </div>
                </td>
                <td className="py-3 font-mono text-stone-900">{formatTime(effort.timeSeconds)}</td>
                <td className="py-3 text-stone-600">{formatPace(effort.paceSeconds)}/mi</td>
                <td className="py-3">
                  <Link
                    href={`/workout/${effort.workoutId}`}
                    className="text-teal-600 hover:text-teal-700"
                  >
                    {formatDate(effort.date)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Best Mile Splits - fastest individual miles from any workout
 */
export function BestMileSplits() {
  const [splits, setSplits] = useState<{
    paceSeconds: number;
    workoutId: number;
    date: string;
    lapNumber: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBestMileSplits(5).then(data => {
      setSplits(data);
      setLoading(false);
    });
  }, []);

  if (loading || splits.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-rose-500" />
        Fastest Mile Splits
      </h2>

      <div className="space-y-2">
        {splits.map((split, i) => (
          <div key={`${split.workoutId}-${split.lapNumber}`} className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i === 0 ? 'bg-slate-100 text-slate-800' :
              i === 1 ? 'bg-stone-200 text-stone-600' :
              i === 2 ? 'bg-rose-50 text-rose-700' :
              'bg-stone-100 text-stone-500'
            }`}>
              {i + 1}
            </span>
            <span className="font-mono font-semibold text-stone-900">{formatPace(split.paceSeconds)}</span>
            <span className="text-sm text-stone-500">Mile {split.lapNumber}</span>
            <Link
              href={`/workout/${split.workoutId}`}
              className="text-sm text-teal-600 hover:text-teal-700 ml-auto"
            >
              {formatDate(split.date)}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Pace Curve Chart - visual representation of best paces at various distances
 */
export function PaceCurveChart() {
  const [curveData, setCurveData] = useState<{
    distanceMiles: number;
    distanceLabel: string;
    bestPaceSeconds: number;
    bestTimeSeconds: number;
    date: string;
    workoutId: number;
    isEstimated?: boolean;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaceCurve().then(data => {
      setCurveData(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-500" />
          Pace Curve
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (curveData.length < 2) {
    return null;
  }

  // Calculate chart dimensions
  const minPace = Math.min(...curveData.map(d => d.bestPaceSeconds));
  const maxPace = Math.max(...curveData.map(d => d.bestPaceSeconds));
  const paceRange = maxPace - minPace || 60;

  const hasEstimated = curveData.some(d => d.isEstimated);
  const hasActual = curveData.some(d => !d.isEstimated);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-600" />
          Pace Curve
        </h2>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {hasActual && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-teal-600" />
            <span className="text-stone-600">Actual (from workouts)</span>
          </div>
        )}
        {hasEstimated && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-stone-400 border border-dashed border-stone-500" />
            <span className="text-stone-600">Projected</span>
          </div>
        )}
      </div>

      {/* Visual chart - added pt-8 for tooltip space */}
      <div className="h-40 flex items-end gap-1 pt-8">
        {curveData.map((point) => {
          // Invert: faster pace = taller bar
          const height = ((maxPace - point.bestPaceSeconds) / paceRange) * 100 + 20;
          // Convert percentage to pixels (128px usable after pt-8)
          const heightPx = Math.min((height / 100) * 128, 128);

          return (
            <Link
              key={point.distanceLabel}
              href={`/workout/${point.workoutId}`}
              className="flex-1 flex flex-col items-center justify-end group min-w-0"
            >
              <div
                className={`w-full rounded-t transition-colors relative ${
                  point.isEstimated
                    ? 'bg-gradient-to-t from-stone-400 to-stone-300 hover:from-stone-500 hover:to-stone-400 border-2 border-dashed border-stone-500'
                    : 'bg-gradient-to-t from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600'
                }`}
                style={{ height: `${heightPx}px` }}
                title={`${point.distanceLabel}: ${formatPace(point.bestPaceSeconds)}/mi${point.isEstimated ? ' (projected)' : ''}`}
              >
                <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  {formatPace(point.bestPaceSeconds)}/mi{point.isEstimated ? '*' : ''}
                </div>
              </div>
              <span className="text-[10px] sm:text-xs text-stone-500 mt-1 truncate w-full text-center">
                {point.distanceLabel}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Table below */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <tbody>
            <tr>
              {curveData.map(point => (
                <td key={point.distanceLabel} className="text-center px-1">
                  <span className="font-mono text-stone-700">{formatPace(point.bestPaceSeconds)}</span>
                </td>
              ))}
            </tr>
            <tr>
              {curveData.map(point => (
                <td key={point.distanceLabel} className="text-center px-1 text-stone-400">
                  {formatTime(point.bestTimeSeconds)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Workout Ranking Badge - shows where this workout ranks
 */
export function WorkoutRankingBadge({ workoutId }: { workoutId: number }) {
  const [ranking, setRanking] = useState<WorkoutRanking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkoutRanking(workoutId).then(data => {
      setRanking(data);
      setLoading(false);
    });
  }, [workoutId]);

  if (loading || !ranking) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
      ranking.isBest
        ? 'bg-slate-100 text-slate-800'
        : ranking.rank <= 3
        ? 'bg-teal-50 text-stone-700'
        : 'bg-stone-100 text-stone-700'
    }`}>
      {ranking.isBest ? (
        <>
          <Crown className="w-4 h-4" />
          <span className="font-semibold">PR!</span>
          <span>{ranking.distance}</span>
        </>
      ) : (
        <>
          <span className="font-semibold">#{ranking.rank}</span>
          <span>of {ranking.totalEfforts}</span>
          <span className="text-stone-500">({ranking.distance})</span>
          {ranking.percentFromBest > 0 && (
            <span className="text-stone-400">+{ranking.percentFromBest}%</span>
          )}
        </>
      )}
    </div>
  );
}
