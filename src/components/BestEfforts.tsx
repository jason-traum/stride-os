'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, TrendingUp, Loader2, Zap } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import { getBestEffortsAnalysis, getBestEfforts } from '@/actions/best-efforts';
import { getSettings } from '@/actions/settings';
import { predictRaceTime } from '@/lib/training/vdot-calculator';
import type { BestEffort } from '@/lib/best-efforts';

// TODO: Will be used when getWorkoutRanking is implemented
// type WorkoutRanking = {
//   distance: string;
//   rank: number;
//   total: number;
//   percentile: number;
// };

// Format seconds to time string (mm:ss or h:mm:ss)
function formatTime(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;

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
    getBestEfforts(365).then(data => {
      // Filter to only #1 ranked (best at each distance)
      const prs = data.filter(e => e.rankAllTime === 1);
      setEfforts(prs);
      setLoading(false);
    }).catch(() => setLoading(false));
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
              <th className="pb-2 font-medium">VDOT</th>
            </tr>
          </thead>
          <tbody>
            {efforts.map((effort) => (
              <tr key={effort.distance} className="border-b border-borderSecondary">
                <td className="py-3">
                  <span className="font-medium text-textPrimary">{effort.distance}</span>
                </td>
                <td className="py-3 font-mono text-textPrimary">{formatTime(effort.timeSeconds)}</td>
                <td className="py-3 text-textSecondary">{effort.pace}/mi</td>
                <td className="py-3">
                  <Link
                    href={`/workout/${effort.workoutId}`}
                    className="text-dream-300"
                  >
                    {formatDate(effort.workoutDate)}
                  </Link>
                </td>
                <td className="py-3 text-textTertiary text-xs">
                  {effort.equivalentVDOT ? effort.equivalentVDOT.toFixed(1) : '—'}
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
    getBestEfforts(365).then(data => {
      // Get 1-mile efforts ranked by time
      const mileEfforts = data
        .filter(e => e.distance === '1mi')
        .sort((a, b) => a.timeSeconds - b.timeSeconds)
        .slice(0, 5)
        .map(e => ({
          paceSeconds: e.timeSeconds, // For 1mi, timeSeconds ≈ paceSecondsPerMile
          workoutId: e.workoutId,
          date: e.workoutDate,
          lapNumber: e.rankAllTime || 0,
        }));
      setSplits(mileEfforts);
      setLoading(false);
    }).catch(() => setLoading(false));
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
              i === 1 ? 'bg-bgTertiary text-textSecondary' :
              i === 2 ? 'bg-rose-900/30 text-rose-300' :
              'bg-bgTertiary text-textTertiary'
            }`}>
              {i + 1}
            </span>
            <span className="font-mono font-semibold text-textPrimary">{formatPace(split.paceSeconds)}</span>
            <span className="text-sm text-textTertiary">#{split.lapNumber}</span>
            <Link
              href={`/workout/${split.workoutId}`}
              className="text-sm text-dream-300 ml-auto"
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
    async function loadPaceCurve() {
      try {
        // Fetch best efforts and settings in parallel
        const [effortsResult, settings] = await Promise.all([
          getBestEffortsAnalysis(),
          getSettings(),
        ]);

        // Standard distances with their miles equivalents
        const standardDistances = [
          { name: '400m', meters: 400, miles: 0.249 },
          { name: '800m', meters: 800, miles: 0.497 },
          { name: '1K', meters: 1000, miles: 0.621 },
          { name: '1mi', meters: 1609.34, miles: 1 },
          { name: '5K', meters: 5000, miles: 3.107 },
          { name: '10K', meters: 10000, miles: 6.214 },
          { name: '10mi', meters: 16093.4, miles: 10 },
          { name: 'Half Marathon', meters: 21097.5, miles: 13.109 },
          { name: 'Marathon', meters: 42195, miles: 26.219 },
        ];

        // Build a map of #1 ranked efforts by distance name
        const prByDistance = new Map<string, {
          timeSeconds: number;
          paceSeconds: number;
          workoutId: number;
          workoutDate: string;
        }>();

        if (effortsResult.success) {
          for (const effort of effortsResult.data.bestEfforts) {
            if (effort.rankAllTime === 1) {
              const distInfo = standardDistances.find(d => d.name === effort.distance);
              if (distInfo) {
                prByDistance.set(effort.distance, {
                  timeSeconds: effort.timeSeconds,
                  paceSeconds: effort.timeSeconds / distInfo.miles,
                  workoutId: effort.workoutId,
                  workoutDate: effort.workoutDate,
                });
              }
            }
          }
        }

        const vdot = settings?.vdot;
        const data: typeof curveData = [];

        for (const dist of standardDistances) {
          const pr = prByDistance.get(dist.name);
          const hasVdot = vdot != null && vdot >= 15 && vdot <= 85;

          if (hasVdot) {
            // Compute VDOT projection
            const predictedTime = predictRaceTime(vdot, dist.meters);
            const predictedPace = predictedTime / dist.miles;

            const entry: (typeof curveData)[number] = {
              distanceMiles: dist.miles,
              distanceLabel: dist.name,
              bestPaceSeconds: predictedPace,
              bestTimeSeconds: predictedTime,
              date: '',
              workoutId: 0,
              isEstimated: true,
            };

            // Overlay actual PR data if it exists
            if (pr) {
              entry.actualPaceSeconds = pr.paceSeconds;
              entry.actualTimeSeconds = pr.timeSeconds;
              entry.actualWorkoutId = pr.workoutId;
              entry.actualDate = pr.workoutDate;
            }

            data.push(entry);
          } else if (pr) {
            // No VDOT, but we have actual PR data -- bar IS the actual
            data.push({
              distanceMiles: dist.miles,
              distanceLabel: dist.name,
              bestPaceSeconds: pr.paceSeconds,
              bestTimeSeconds: pr.timeSeconds,
              date: pr.workoutDate,
              workoutId: pr.workoutId,
              isEstimated: false,
            });
          }
          // If no VDOT and no PR for this distance, skip it
        }

        setCurveData(data);
      } catch (err) {
        console.error('Failed to load pace curve data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPaceCurve();
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-dream-500" />
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
  const rawMinPace = Math.min(...allPaces);
  const rawMaxPace = Math.max(...allPaces);
  // Add 10% padding to top/bottom so bars don't touch edges
  const padding = (rawMaxPace - rawMinPace) * 0.1 || 30;
  const minPace = rawMinPace - padding;
  const maxPace = rawMaxPace + padding;
  const paceRange = maxPace - minPace;

  // Check what we have
  const hasProjections = curveData.some(d => d.isEstimated);
  const hasActuals = curveData.some(d => d.actualPaceSeconds !== undefined || !d.isEstimated);

  // Generate y-axis pace labels (3-4 evenly spaced ticks)
  const CHART_HEIGHT = 160;
  const tickCount = 4;
  const yTicks: { pace: number; pct: number }[] = [];
  for (let i = 0; i < tickCount; i++) {
    const pace = minPace + (paceRange * i) / (tickCount - 1);
    const pct = 1 - i / (tickCount - 1); // bottom = slow (high pace), top = fast (low pace)
    yTicks.push({ pace, pct });
  }

  // Helper: pace value -> bottom offset in px (faster pace = higher)
  const paceToBottom = (pace: number): number => {
    const ratio = (maxPace - pace) / paceRange; // 0 = slowest, 1 = fastest
    return Math.max(0, Math.min(CHART_HEIGHT, ratio * CHART_HEIGHT));
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-textPrimary flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-dream-600" />
          Pace Curve
        </h2>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {hasProjections && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-violet-400" />
            <span className="text-textSecondary">VDOT Projection</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-dream-600 border-2 border-white shadow" />
          <span className="text-textSecondary">Actual PR</span>
        </div>
      </div>

      {/* Visual chart with y-axis labels */}
      <div className="flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-2 flex-shrink-0" style={{ height: `${CHART_HEIGHT}px` }}>
          {yTicks.map((tick, i) => (
            <span key={i} className="text-[10px] text-textTertiary font-mono leading-none">
              {formatPace(Math.round(tick.pace))}
            </span>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 flex items-end gap-1 relative border-l border-b border-borderSecondary" style={{ height: `${CHART_HEIGHT}px` }}>
          {/* Horizontal grid lines */}
          {yTicks.map((tick, i) => (
            <div
              key={i}
              className="absolute w-full border-t border-borderSecondary/40"
              style={{ bottom: `${tick.pct * CHART_HEIGHT}px` }}
            />
          ))}

          {curveData.map((point) => {
            const barPace = point.bestPaceSeconds;
            const barHeightPx = paceToBottom(barPace);

            const actualPace = point.actualPaceSeconds;
            const barIsActual = !point.isEstimated && actualPace === undefined;

            return (
              <div
                key={point.distanceLabel}
                className="flex-1 flex flex-col items-center justify-end group min-w-0 relative z-10"
                style={{ height: `${CHART_HEIGHT}px` }}
              >
                {/* Bar */}
                <div
                  className={`w-full max-w-[32px] mx-auto rounded-t transition-colors relative ${
                    barIsActual
                      ? 'bg-gradient-to-t from-dream-600 to-dream-400'
                      : 'bg-gradient-to-t from-violet-500 to-violet-300'
                  }`}
                  style={{ height: `${Math.max(barHeightPx, 4)}px` }}
                >
                  {/* Tooltip */}
                  <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-800 text-white text-xs px-2 py-1.5 rounded whitespace-nowrap z-30 pointer-events-none">
                    <div>{formatPace(barPace)}/mi {point.isEstimated ? '(proj)' : '(PR)'}</div>
                    {actualPace !== undefined && (
                      <div className="text-dream-300">Actual: {formatPace(actualPace)}/mi</div>
                    )}
                  </div>
                </div>

                {/* Actual PR dot - positioned by pace value */}
                {actualPace !== undefined && (
                  <Link
                    href={`/workout/${point.actualWorkoutId}`}
                    className="absolute left-1/2 transform -translate-x-1/2 z-20"
                    style={{ bottom: `${paceToBottom(actualPace) - 6}px` }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-bgSecondary border-[3px] border-dream-600 shadow-lg hover:scale-125 transition-transform"
                      title={`Actual PR: ${formatPace(actualPace)}/mi (${formatTime(point.actualTimeSeconds!)})`}
                    />
                  </Link>
                )}

                {/* If bar IS the actual, dot at top of bar */}
                {barIsActual && (
                  <Link
                    href={`/workout/${point.workoutId}`}
                    className="absolute left-1/2 transform -translate-x-1/2 z-20"
                    style={{ bottom: `${paceToBottom(barPace) - 6}px` }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-bgSecondary border-[3px] border-dream-600 shadow-lg hover:scale-125 transition-transform"
                      title={`PR: ${formatPace(barPace)}/mi`}
                    />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex" style={{ marginLeft: '40px' }}>
        {curveData.map(point => (
          <div key={point.distanceLabel} className="flex-1 text-center">
            <span className="text-[10px] sm:text-xs text-textTertiary truncate block">
              {point.distanceLabel}
            </span>
          </div>
        ))}
      </div>

      {/* Table below - show both projection and actual if different */}
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-xs">
          <tbody>
            {/* Projection row */}
            <tr>
              {curveData.map(point => (
                <td key={point.distanceLabel} className="text-center px-1">
                  <span className={`font-mono ${point.isEstimated ? 'text-violet-600' : 'text-dream-300 font-semibold'}`}>
                    {formatPace(point.bestPaceSeconds)}
                  </span>
                </td>
              ))}
            </tr>
            {/* Actual row (if any actuals exist) */}
            {hasActuals && (
              <tr>
                {curveData.map(point => {
                  const ap = point.actualPaceSeconds ?? (!point.isEstimated ? point.bestPaceSeconds : undefined);
                  return (
                    <td key={point.distanceLabel} className="text-center px-1">
                      {ap !== undefined ? (
                        <span className="font-mono text-dream-600 font-semibold">
                          {formatPace(ap)}
                          <span className="text-dream-400">*</span>
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
        {hasProjections ? '* = Actual PR · Bars show VDOT-based projection' : '* = Actual PR'}
      </p>
    </div>
  );
}

/**
 * Workout Ranking Badge - shows where this workout ranks
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function WorkoutRankingBadge({ workoutId }: { workoutId: number }) {
  // TODO: Implement getWorkoutRanking — stub returns null until then
  return null;
}
