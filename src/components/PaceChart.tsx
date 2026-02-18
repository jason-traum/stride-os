'use client';

import { useEffect, useMemo, useState } from 'react';
import { Timer } from 'lucide-react';
import { cn, formatPace } from '@/lib/utils';
import { buildInterpolatedMileSplitsFromLaps, type MileSplit } from '@/lib/mile-split-interpolation';

interface Lap {
  lapNumber: number;
  distanceMiles: number;
  durationSeconds: number;
  avgPaceSeconds: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainFeet: number | null;
  lapType: string;
}

interface PaceChartProps {
  laps: Lap[];
  mileSplits?: MileSplit[];
  mileSplitSource?: 'stream' | 'laps';
  avgPaceSeconds: number | null;
  workoutType: string;
}

interface PaceSplit {
  index: number;
  kind: 'mile' | 'lap';
  distanceMiles: number;
  durationSeconds: number;
  avgPaceSeconds: number;
  shortLabel: string;
  longLabel: string;
}

function toPaceSplitsFromMiles(miles: MileSplit[]): PaceSplit[] {
  return miles.map((split) => ({
    index: split.lapNumber,
    kind: 'mile' as const,
    distanceMiles: split.distanceMiles,
    durationSeconds: split.durationSeconds,
    avgPaceSeconds: split.avgPaceSeconds,
    shortLabel: `M${split.lapNumber}`,
    longLabel: split.distanceMiles >= 0.995
      ? `Mile ${split.lapNumber}`
      : `Mile ${split.lapNumber} (${split.distanceMiles.toFixed(2)}mi partial)`,
  }));
}

function toLapSplits(laps: Lap[]): PaceSplit[] {
  return laps
    .filter((lap) => lap.distanceMiles > 0 && lap.durationSeconds > 0)
    .map((lap, i) => ({
      index: i + 1,
      kind: 'lap' as const,
      distanceMiles: lap.distanceMiles,
      durationSeconds: lap.durationSeconds,
      avgPaceSeconds: lap.avgPaceSeconds,
      shortLabel: `L${i + 1}`,
      longLabel: `Lap ${i + 1} (${lap.distanceMiles.toFixed(2)}mi)`,
    }));
}

export function PaceChart({ laps, mileSplits, mileSplitSource, avgPaceSeconds }: PaceChartProps) {
  const resolvedMileSplits = useMemo(() => {
    const fromSource = mileSplits && mileSplits.length > 0
      ? mileSplits
      : buildInterpolatedMileSplitsFromLaps(laps);
    return toPaceSplitsFromMiles(fromSource);
  }, [mileSplits, laps]);

  const hasMileSplits = resolvedMileSplits.length > 0;
  const resolvedMileSplitSource = hasMileSplits ? (mileSplitSource || 'laps') : null;
  const [viewMode, setViewMode] = useState<'mile' | 'lap'>(hasMileSplits ? 'mile' : 'lap');

  useEffect(() => {
    if (viewMode === 'mile' && !hasMileSplits) {
      setViewMode('lap');
    }
  }, [viewMode, hasMileSplits]);

  const lapSplits = useMemo(() => toLapSplits(laps), [laps]);
  const activeSplits = viewMode === 'mile' ? resolvedMileSplits : lapSplits;

  const chartData = useMemo(() => {
    if (activeSplits.length < 2) return null;

    const paces = activeSplits.map((s) => s.avgPaceSeconds);
    const minPace = Math.min(...paces);
    const maxPace = Math.max(...paces);

    const range = maxPace - minPace || 60;
    const paddedMin = minPace - range * 0.1;
    const paddedMax = maxPace + range * 0.1;

    const weightedAvg = activeSplits.reduce((sum, split) => sum + split.durationSeconds, 0) /
      activeSplits.reduce((sum, split) => sum + split.distanceMiles, 0);

    return {
      minPace: paddedMin,
      maxPace: paddedMax,
      range: paddedMax - paddedMin,
      weightedAvg: Number.isFinite(weightedAvg) ? weightedAvg : avgPaceSeconds || null,
    };
  }, [activeSplits, avgPaceSeconds]);

  if (!chartData) {
    return null;
  }

  const { minPace, maxPace, range, weightedAvg } = chartData;
  const paces = activeSplits.map((s) => s.avgPaceSeconds);

  const width = 100;
  const height = 40;
  const padding = { top: 2, bottom: 2, left: 0, right: 0 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = activeSplits.map((split, i) => {
    const x = padding.left + (i / (activeSplits.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((split.avgPaceSeconds - minPace) / range) * chartHeight;
    return { x, y, pace: split.avgPaceSeconds };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;
  const avgY = weightedAvg
    ? padding.top + chartHeight - ((weightedAvg - minPace) / range) * chartHeight
    : null;

  const mid = Math.ceil(paces.length / 2);
  const firstHalf = paces.slice(0, mid);
  const secondHalf = paces.slice(mid);
  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.length
    ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    : firstHalfAvg;
  const splitDiff = secondHalfAvg - firstHalfAvg;

  let splitAnalysis = 'Even splits';
  let splitColor = 'text-green-500';
  if (splitDiff < -5) {
    splitAnalysis = 'Negative split';
    splitColor = 'text-accentTeal';
  } else if (splitDiff > 5) {
    splitAnalysis = 'Positive split';
    splitColor = 'text-accentPink';
  }

  const fastestIdx = paces.indexOf(Math.min(...paces));
  const slowestIdx = paces.indexOf(Math.max(...paces));
  const activeLabel = viewMode === 'mile' ? 'Mile' : 'Lap';

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-textPrimary flex items-center gap-2">
          <Timer className="w-5 h-5 text-accentTeal" />
          Pace Analysis
        </h2>
        <span className={`text-xs font-medium ${splitColor}`}>{splitAnalysis}</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setViewMode('mile')}
          disabled={!hasMileSplits}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border transition-colors',
            !hasMileSplits
              ? 'bg-surface-2 border-borderSecondary text-textTertiary/50 cursor-not-allowed'
              : viewMode === 'mile'
              ? 'bg-dream-500/15 border-dream-500/30 text-primary'
              : 'bg-surface-2 border-borderSecondary text-textTertiary hover:text-primary'
          )}
        >
          Mile Splits (Interpolated)
        </button>
        <button
          onClick={() => setViewMode('lap')}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border transition-colors',
            viewMode === 'lap'
              ? 'bg-dream-500/15 border-dream-500/30 text-primary'
              : 'bg-surface-2 border-borderSecondary text-textTertiary hover:text-primary'
          )}
        >
          Laps / Intervals (Actual)
        </button>
      </div>

      <p className="text-[11px] text-textTertiary mb-4">
        {viewMode === 'mile' ? (
          resolvedMileSplitSource === 'stream'
            ? 'Mile splits come from raw stream interpolation (distance + elapsed time), not equalized lap chunks.'
            : hasMileSplits
              ? 'Mile splits are estimated from fine-grained lap data.'
              : 'Mile splits unavailable: need raw stream data (or finer laps).'
        ) : 'Exact lap/interval segments with true segment distance.'}
      </p>

      <div className="relative mb-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" preserveAspectRatio="none">
          <defs>
            <linearGradient id="paceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-orange)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--accent-orange)" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill="url(#paceGradient)" />

          {avgY !== null && avgY >= padding.top && avgY <= height - padding.bottom && (
            <line
              x1={padding.left}
              y1={avgY}
              x2={width - padding.right}
              y2={avgY}
              stroke="var(--text-tertiary)"
              strokeWidth="0.3"
              strokeDasharray="2,2"
            />
          )}

          <path d={linePath} fill="none" stroke="var(--accent-orange)" strokeWidth="1" strokeLinejoin="round" />

          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1"
              fill={i === fastestIdx ? 'var(--accent-dream)' : i === slowestIdx ? 'var(--accent-pink)' : 'var(--accent-orange)'}
            />
          ))}
        </svg>

        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-tertiary -translate-x-full pr-2">
          <span>{formatPace(Math.round(minPace))}</span>
          <span>{formatPace(Math.round(maxPace))}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-textTertiary">Fastest</p>
          <p className="font-semibold text-green-600">
            {activeSplits[fastestIdx].longLabel}: {formatPace(paces[fastestIdx])}
          </p>
        </div>
        <div>
          <p className="text-xs text-textTertiary">Slowest</p>
          <p className="font-semibold text-rose-500">
            {activeSplits[slowestIdx].longLabel}: {formatPace(paces[slowestIdx])}
          </p>
        </div>
        <div>
          <p className="text-xs text-textTertiary">Variance</p>
          <p className="font-semibold text-textSecondary">
            {Math.round(Math.max(...paces) - Math.min(...paces))}s
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-borderSecondary">
        <p className="text-xs text-textTertiary mb-2">{activeLabel} Pace Profile</p>
        <div className="flex gap-1 items-end h-12">
          {activeSplits.map((split, i) => {
            const normalizedHeight = 1 - (split.avgPaceSeconds - Math.min(...paces)) / (range || 1);
            const heightPercent = 20 + normalizedHeight * 80;

            let bgColor = 'bg-sky-400';
            if (i === fastestIdx) bgColor = 'bg-rose-500';
            else if (i === slowestIdx) bgColor = 'bg-amber-400';

            return (
              <div
                key={`${split.kind}-${split.index}-${i}`}
                className={`flex-1 ${bgColor} rounded-t transition-all hover:opacity-80`}
                style={{ height: `${heightPercent}%` }}
                title={`${split.longLabel}: ${formatPace(split.avgPaceSeconds)}/mi`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
