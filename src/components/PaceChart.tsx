'use client';

import { useMemo } from 'react';
import { Timer } from 'lucide-react';
import { formatPace } from '@/lib/utils';

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
  avgPaceSeconds: number | null;
  workoutType: string;
}

export function PaceChart({ laps, avgPaceSeconds, workoutType }: PaceChartProps) {
  const chartData = useMemo(() => {
    if (!laps.length) return null;

    const paces = laps.map((l) => l.avgPaceSeconds);
    const minPace = Math.min(...paces);
    const maxPace = Math.max(...paces);

    // Add padding to range
    const range = maxPace - minPace || 60;
    const paddedMin = minPace - range * 0.1;
    const paddedMax = maxPace + range * 0.1;

    return {
      paces,
      minPace: paddedMin,
      maxPace: paddedMax,
      range: paddedMax - paddedMin,
    };
  }, [laps]);

  if (!chartData || laps.length < 2) {
    return null;
  }

  const { paces, minPace, maxPace, range } = chartData;

  // Chart dimensions
  const width = 100;
  const height = 40;
  const padding = { top: 2, bottom: 2, left: 0, right: 0 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate points for the line
  const points = paces.map((pace, i) => {
    const x = padding.left + (i / (paces.length - 1)) * chartWidth;
    // Invert Y since lower pace = faster
    const y = padding.top + chartHeight - ((pace - minPace) / range) * chartHeight;
    return { x, y, pace };
  });

  // Create path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Create area path (for gradient fill)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  // Average pace line Y position
  const avgY = avgPaceSeconds
    ? padding.top + chartHeight - ((avgPaceSeconds - minPace) / range) * chartHeight
    : null;

  // Detect splits pattern (negative split, positive split, even)
  const firstHalfAvg = paces.slice(0, Math.ceil(paces.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(paces.length / 2);
  const secondHalfAvg = paces.slice(Math.ceil(paces.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(paces.length / 2);
  const splitDiff = secondHalfAvg - firstHalfAvg;

  let splitAnalysis = '';
  let splitColor = 'text-stone-500';
  if (Math.abs(splitDiff) < 5) {
    splitAnalysis = 'Even splits';
    splitColor = 'text-green-600';
  } else if (splitDiff < -5) {
    splitAnalysis = 'Negative split';
    splitColor = 'text-amber-600';
  } else {
    splitAnalysis = 'Positive split';
    splitColor = 'text-orange-500';
  }

  // Calculate fastest and slowest
  const fastestIdx = paces.indexOf(Math.min(...paces));
  const slowestIdx = paces.indexOf(Math.max(...paces));

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2">
          <Timer className="w-5 h-5 text-amber-500" />
          Pace Analysis
        </h2>
        <span className={`text-xs font-medium ${splitColor}`}>{splitAnalysis}</span>
      </div>

      {/* SVG Chart */}
      <div className="relative mb-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" preserveAspectRatio="none">
          <defs>
            <linearGradient id="paceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill="url(#paceGradient)" />

          {/* Average pace line */}
          {avgY !== null && avgY >= padding.top && avgY <= height - padding.bottom && (
            <line
              x1={padding.left}
              y1={avgY}
              x2={width - padding.right}
              y2={avgY}
              stroke="#78716c"
              strokeWidth="0.3"
              strokeDasharray="2,2"
            />
          )}

          {/* Main line */}
          <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round" />

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1"
              fill={i === fastestIdx ? '#22c55e' : i === slowestIdx ? '#ef4444' : '#f59e0b'}
            />
          ))}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-stone-400 -translate-x-full pr-2">
          <span>{formatPace(Math.round(minPace))}</span>
          <span>{formatPace(Math.round(maxPace))}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-stone-500">Fastest</p>
          <p className="font-semibold text-green-600">
            Mile {fastestIdx + 1}: {formatPace(paces[fastestIdx])}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500">Slowest</p>
          <p className="font-semibold text-orange-500">
            Mile {slowestIdx + 1}: {formatPace(paces[slowestIdx])}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500">Variance</p>
          <p className="font-semibold text-stone-700">
            {Math.round(Math.max(...paces) - Math.min(...paces))}s
          </p>
        </div>
      </div>

      {/* Pace progression visualization */}
      <div className="mt-4 pt-4 border-t border-stone-100">
        <p className="text-xs text-stone-500 mb-2">Pace by Mile</p>
        <div className="flex gap-1 items-end h-12">
          {paces.map((pace, i) => {
            const normalizedHeight = 1 - (pace - Math.min(...paces)) / (range || 1);
            const heightPercent = 20 + normalizedHeight * 80;

            let bgColor = 'bg-amber-400';
            if (i === fastestIdx) bgColor = 'bg-green-500';
            else if (i === slowestIdx) bgColor = 'bg-orange-500';

            return (
              <div
                key={i}
                className={`flex-1 ${bgColor} rounded-t transition-all hover:opacity-80`}
                style={{ height: `${heightPercent}%` }}
                title={`Mile ${i + 1}: ${formatPace(pace)}/mi`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
