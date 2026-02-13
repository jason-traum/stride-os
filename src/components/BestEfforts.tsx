'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Medal, TrendingUp, Loader2, Zap, Crown } from 'lucide-react';
import { formatPace } from '@/lib/utils';
// TODO: Fix imports - these functions don't exist in best-efforts.ts
// import {
//   getBestEfforts,
//   getBestMileSplits,
//   getPaceCurve,
//   getWorkoutRanking,
//   type BestEffort,
//   type WorkoutRanking,
// } from '@/actions/best-efforts';

// Temporary type definitions to prevent errors
type BestEffort = {
  distance: string;
  time: number;
  date: string;
  workoutId: number;
  improvement?: number;
  pace: number;
};

type WorkoutRanking = {
  distance: string;
  rank: number;
  total: number;
  percentile: number;
};

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
    // TODO: Implement getBestEfforts
    // getBestEfforts().then(data => {
    //   setEfforts(data);
    //   setLoading(false);
    // });
    setEfforts([]);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-secondary" />
          Personal Bests
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (efforts.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-secondary" />
          Personal Bests
        </h2>
        <p className="text-sm text-textTertiary">No completed efforts at standard distances yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-secondary" />
        Personal Bests
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-textTertiary border-b border-borderSecondary">
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
                    {effort.isRace && <Medal className="w-4 h-4 text-secondary" />}
                    <span className="font-medium text-textPrimary">{effort.distance}</span>
                  </div>
                </td>
                <td className="py-3 font-mono text-textPrimary">{formatTime(effort.timeSeconds)}</td>
                <td className="py-3 text-textSecondary">{formatPace(effort.paceSeconds)}/mi</td>
                <td className="py-3">
                  <Link
                    href={`/workout/${effort.workoutId}`}
                    className="text-teal-600 hover:text-teal-700 dark:text-teal-300"
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
    // TODO: Implement getBestMileSplits
    // getBestMileSplits(5).then(data => {
    //   setSplits(data);
    //   setLoading(false);
    // });
    setSplits([]);
    setLoading(false);
  }, []);

  if (loading || splits.length === 0) {
    return null;
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-rose-500" />
        Fastest Mile Splits
      </h2>

      <div className="space-y-2">
        {splits.map((split, i) => (
          <div key={`${split.workoutId}-${split.lapNumber}`} className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i === 0 ? 'bg-surface-2 text-primary' :
              i === 1 ? 'bg-stone-200 text-textSecondary' :
              i === 2 ? 'bg-rose-50 text-rose-700' :
              'bg-stone-100 text-textTertiary'
            }`}>
              {i + 1}
            </span>
            <span className="font-mono font-semibold text-textPrimary">{formatPace(split.paceSeconds)}</span>
            <span className="text-sm text-textTertiary">Mile {split.lapNumber}</span>
            <Link
              href={`/workout/${split.workoutId}`}
              className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-300 ml-auto"
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
 * Shows projection bars with actual race times as dots overlaid
 */
export function PaceCurveChart() {
  const [curveData, setCurveData] = useState<{
    distanceMiles: number;
    distanceLabel: string;
    bestPaceSeconds: number;
    bestTimeSeconds: number;
    date: string;
    workoutId: number;
    isEstimated: boolean;
    actualPaceSeconds?: number;
    actualTimeSeconds?: number;
    actualWorkoutId?: number;
    actualDate?: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Implement getPaceCurve
    Promise.resolve([]).then(data => {
      setCurveData(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-500" />
          Pace Curve
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (curveData.length < 2) {
    return null;
  }

  // Calculate chart dimensions - include both projections and actuals in range
  const allPaces = curveData.flatMap(d => [d.bestPaceSeconds, d.actualPaceSeconds].filter(Boolean) as number[]);
  const minPace = Math.min(...allPaces);
  const maxPace = Math.max(...allPaces);
  const paceRange = maxPace - minPace || 60;

  // Check what we have
  const hasProjections = curveData.some(d => d.isEstimated);
  const hasActuals = curveData.some(d => d.actualPaceSeconds !== undefined || !d.isEstimated);

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-textPrimary flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-600" />
          Pace Curve
        </h2>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-violet-400" />
          <span className="text-textSecondary">Projected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-teal-600 border-2 border-white shadow" />
          <span className="text-textSecondary">Actual PR</span>
        </div>
        {hasActuals && hasProjections && (
          <div className="flex items-center gap-1.5 text-tertiary">
            (dots show your real race times)
          </div>
        )}
      </div>

      {/* Visual chart - bars for projections, dots for actuals */}
      <div className="h-48 flex items-end gap-1 pt-12 relative">
        {curveData.map((point) => {
          // Bar height based on projection (or actual if no projection)
          const barPace = point.bestPaceSeconds;
          const barHeight = ((maxPace - barPace) / paceRange) * 100 + 10;
          const barHeightPx = Math.max(Math.min((barHeight / 100) * 140, 140), 8);

          // Dot position based on actual PR (if different from bar)
          const actualPace = point.actualPaceSeconds;
          let dotHeightPx: number | null = null;
          if (actualPace !== undefined) {
            const dotHeight = ((maxPace - actualPace) / paceRange) * 100 + 10;
            dotHeightPx = Math.max(Math.min((dotHeight / 100) * 140, 140), 8);
          }

          // If not estimated and no separate actual, the bar IS the actual
          const barIsActual = !point.isEstimated && actualPace === undefined;

          return (
            <div
              key={point.distanceLabel}
              className="flex-1 flex flex-col items-center justify-end group min-w-0 relative"
            >
              {/* Container for bar and dot */}
              <div className="w-full flex flex-col items-center justify-end relative" style={{ height: '140px' }}>
                {/* Projection bar */}
                <div
                  className={`w-full rounded-t transition-colors relative ${
                    barIsActual
                      ? 'bg-gradient-to-t from-teal-600 to-teal-400'
                      : 'bg-gradient-to-t from-violet-500 to-violet-300'
                  }`}
                  style={{ height: `${barHeightPx}px` }}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-800 text-white text-xs px-2 py-1.5 rounded whitespace-nowrap z-30 pointer-events-none">
                    <div>{formatPace(barPace)}/mi {point.isEstimated ? '(proj)' : '(PR)'}</div>
                    {actualPace !== undefined && (
                      <div className="text-teal-300">Actual: {formatPace(actualPace)}/mi</div>
                    )}
                  </div>
                </div>

                {/* Actual PR dot - positioned absolutely based on pace */}
                {dotHeightPx !== null && (
                  <Link
                    href={`/workout/${point.actualWorkoutId}`}
                    className="absolute left-1/2 transform -translate-x-1/2 z-20"
                    style={{ bottom: `${dotHeightPx - 6}px` }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-bgSecondary border-[3px] border-teal-600 shadow-lg hover:scale-125 transition-transform"
                      title={`Actual PR: ${formatPace(actualPace!)}/mi (${formatTime(point.actualTimeSeconds!)})`}
                    />
                  </Link>
                )}

                {/* If bar is actual (no separate dot), show dot at top of bar */}
                {barIsActual && (
                  <Link
                    href={`/workout/${point.workoutId}`}
                    className="absolute left-1/2 transform -translate-x-1/2 z-20"
                    style={{ bottom: `${barHeightPx - 6}px` }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-bgSecondary border-[3px] border-teal-600 shadow-lg hover:scale-125 transition-transform"
                      title={`PR: ${formatPace(barPace)}/mi`}
                    />
                  </Link>
                )}
              </div>

              <span className="text-[10px] sm:text-xs text-textTertiary mt-1 truncate w-full text-center">
                {point.distanceLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Table below - show both projection and actual if different */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs">
          <tbody>
            {/* Projection row */}
            <tr>
              {curveData.map(point => (
                <td key={point.distanceLabel} className="text-center px-1">
                  <span className={`font-mono ${point.isEstimated ? 'text-violet-600' : 'text-teal-700 dark:text-teal-300 font-semibold'}`}>
                    {formatPace(point.bestPaceSeconds)}
                  </span>
                </td>
              ))}
            </tr>
            {/* Actual row (if any actuals exist) */}
            {hasActuals && (
              <tr>
                {curveData.map(point => {
                  const actualPace = point.actualPaceSeconds ?? (!point.isEstimated ? point.bestPaceSeconds : undefined);
                  return (
                    <td key={point.distanceLabel} className="text-center px-1">
                      {actualPace !== undefined ? (
                        <span className="font-mono text-teal-600 font-semibold">
                          {formatPace(actualPace)}
                          <span className="text-teal-400">*</span>
                        </span>
                      ) : (
                        <span className="text-tertiary">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
            {/* Time row */}
            <tr>
              {curveData.map(point => {
                const time = point.actualTimeSeconds ?? point.bestTimeSeconds;
                return (
                  <td key={point.distanceLabel} className="text-center px-1 text-tertiary">
                    {formatTime(time)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-tertiary mt-2 text-center">
        * = Actual race PR · Bars show Riegel projection from best reference effort
      </p>
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
    // TODO: Implement getWorkoutRanking
    // getWorkoutRanking(workoutId).then(data => {
    //   setRanking(data);
    //   setLoading(false);
    // });
    setRanking(null);
    setLoading(false);
  }, [workoutId]);

  if (loading || !ranking) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
      ranking.isBest
        ? 'bg-surface-2 text-primary'
        : ranking.rank <= 3
        ? 'bg-teal-50 text-textSecondary'
        : 'bg-stone-100 text-textSecondary'
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
          <span className="text-textTertiary">({ranking.distance})</span>
          {ranking.percentFromBest > 0 && (
            <span className="text-tertiary">+{ranking.percentFromBest}%</span>
          )}
        </>
      )}
    </div>
  );
}
