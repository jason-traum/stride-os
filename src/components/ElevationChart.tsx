'use client';

import { useMemo } from 'react';
import { Mountain, TrendingUp, TrendingDown } from 'lucide-react';

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

interface ElevationChartProps {
  laps: Lap[];
  totalElevationGain: number | null;
}

export function ElevationChart({ laps, totalElevationGain }: ElevationChartProps) {
  const chartData = useMemo(() => {
    // Check if we have elevation data
    const hasElevation = laps.some((l) => l.elevationGainFeet !== null && l.elevationGainFeet !== 0);
    if (!hasElevation || laps.length < 2) return null;

    // Build cumulative elevation profile
    // Each lap's gain contributes to a running elevation "profile"
    const elevations: number[] = [0];
    let cumulative = 0;
    laps.forEach((lap) => {
      cumulative += lap.elevationGainFeet || 0;
      elevations.push(cumulative);
    });

    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations);
    const range = maxElev - minElev || 1;

    return {
      elevations,
      minElev,
      maxElev,
      range,
    };
  }, [laps]);

  // Show a simpler view if no per-lap elevation but we have total
  if (!chartData && totalElevationGain && totalElevationGain > 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2 mb-4">
          <Mountain className="w-5 h-5 text-emerald-500" />
          Elevation
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="font-medium">{totalElevationGain} ft gain</span>
          </div>
        </div>
      </div>
    );
  }

  if (!chartData) {
    return null;
  }

  const { elevations, minElev, maxElev, range } = chartData;

  // Calculate total gain and loss
  let totalGain = 0;
  let totalLoss = 0;
  laps.forEach((lap) => {
    const gain = lap.elevationGainFeet || 0;
    if (gain > 0) totalGain += gain;
    else totalLoss += Math.abs(gain);
  });

  // Chart dimensions
  const width = 100;
  const height = 40;
  const padding = { top: 2, bottom: 2, left: 0, right: 0 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate points
  const points = elevations.map((elev, i) => {
    const x = padding.left + (i / (elevations.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((elev - minElev) / range) * chartHeight;
    return { x, y, elev };
  });

  // Create area path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  // Find steepest segments
  const steepestClimb = laps.reduce(
    (max, lap, i) => (lap.elevationGainFeet || 0) > max.gain ? { mile: i + 1, gain: lap.elevationGainFeet || 0 } : max,
    { mile: 0, gain: 0 }
  );

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2">
          <Mountain className="w-5 h-5 text-emerald-500" />
          Elevation Profile
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-emerald-600">
            <TrendingUp className="w-4 h-4" />
            {totalGain || totalElevationGain || 0} ft
          </span>
          {totalLoss > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <TrendingDown className="w-4 h-4" />
              {totalLoss} ft
            </span>
          )}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative mb-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28" preserveAspectRatio="none">
          <defs>
            <linearGradient id="elevGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill="url(#elevGradient)" />

          {/* Main line */}
          <path d={linePath} fill="none" stroke="#10b981" strokeWidth="1" strokeLinejoin="round" />

          {/* Mile markers */}
          {points.slice(1, -1).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="0.8" fill="#10b981" />
          ))}
        </svg>
      </div>

      {/* Elevation change per mile */}
      <div className="text-sm">
        <p className="text-xs text-stone-500 mb-2">Elevation Change by Mile</p>
        <div className="flex gap-1 items-center h-16 relative">
          {/* Center line (zero elevation change) */}
          <div className="absolute left-0 right-0 top-1/2 h-px bg-stone-200" />

          {laps.map((lap, i) => {
            const change = lap.elevationGainFeet || 0;
            const maxChange = Math.max(...laps.map((l) => Math.abs(l.elevationGainFeet || 0))) || 1;
            const heightPercent = Math.min(45, Math.max(5, (Math.abs(change) / maxChange) * 45));
            const isGain = change >= 0;

            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-center h-full relative">
                <div
                  className={`w-full ${isGain ? 'bg-emerald-400' : 'bg-red-400'} rounded transition-all hover:opacity-80 absolute ${
                    isGain ? 'bottom-1/2' : 'top-1/2'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                  title={`Mile ${i + 1}: ${change >= 0 ? '+' : ''}${change} ft`}
                />
                <span className="absolute bottom-0 text-[9px] text-stone-400">{i + 1}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-stone-400 mt-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-400" /> Gain
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-red-400" /> Loss
          </span>
        </div>
      </div>

      {/* Stats row */}
      {(steepestClimb.gain > 0 || totalLoss > 0) && (
        <div className="flex gap-4 mt-4 pt-4 border-t border-stone-100 text-sm">
          {steepestClimb.gain > 0 && (
            <div>
              <p className="text-xs text-stone-500">Biggest Climb</p>
              <p className="font-semibold text-emerald-600">
                Mile {steepestClimb.mile}: +{steepestClimb.gain} ft
              </p>
            </div>
          )}
          {totalLoss > 0 && (
            <div>
              <p className="text-xs text-stone-500">Total Descent</p>
              <p className="font-semibold text-red-500">-{totalLoss} ft</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
