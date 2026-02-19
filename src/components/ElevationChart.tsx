'use client';

import { useMemo } from 'react';
import { Mountain, TrendingUp, TrendingDown } from 'lucide-react';
import { ELEVATION_COLORS } from '@/lib/chart-colors';

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
    const hasElevation = laps.some((l) => l.elevationGainFeet !== null && l.elevationGainFeet !== 0);
    if (!hasElevation || laps.length < 2) return null;

    let totalGain = 0;
    let totalLoss = 0;
    const changes = laps.map((lap) => {
      const change = lap.elevationGainFeet || 0;
      if (change > 0) totalGain += change;
      else totalLoss += Math.abs(change);
      return change;
    });

    const maxAbsChange = Math.max(...changes.map(Math.abs)) || 1;

    // Find steepest climb
    let steepestMile = 0;
    let steepestGain = 0;
    changes.forEach((c, i) => {
      if (c > steepestGain) {
        steepestMile = i + 1;
        steepestGain = c;
      }
    });

    return { changes, totalGain, totalLoss, maxAbsChange, steepestMile, steepestGain };
  }, [laps]);

  // Fallback: no per-lap data but we have a total
  if (!chartData && totalElevationGain && totalElevationGain > 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary flex items-center gap-2 mb-4">
          <Mountain className="w-5 h-5 text-emerald-500" />
          Elevation
        </h2>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">Total Gain</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">+{totalElevationGain} ft</p>
          <p className="text-xs text-tertiary mt-2">Per-mile breakdown unavailable</p>
        </div>
      </div>
    );
  }

  if (!chartData) return null;

  const { changes, totalGain, totalLoss, maxAbsChange, steepestMile, steepestGain } = chartData;
  const netElevation = totalGain - totalLoss;
  const displayGain = totalGain || totalElevationGain || 0;

  // SVG dimensions for per-mile elevation bar chart
  const svgWidth = 100;
  const svgHeight = 50;
  const barPadding = 1;
  const barWidth = (svgWidth - barPadding * (changes.length + 1)) / changes.length;
  const midY = svgHeight / 2;
  const maxBarHeight = svgHeight / 2 - 2; // leave space at edges

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-textPrimary flex items-center gap-2 mb-3">
        <Mountain className="w-5 h-5 text-emerald-500" />
        Elevation by Mile
      </h2>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <div className="bg-emerald-950/40 rounded-lg py-2 px-3">
          <div className="flex items-center justify-center gap-1 text-emerald-500">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Gain</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">+{displayGain}</p>
          <p className="text-[10px] text-emerald-500/70">ft</p>
        </div>
        <div className="bg-red-950/40 rounded-lg py-2 px-3">
          <div className="flex items-center justify-center gap-1 text-red-500">
            <TrendingDown className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Loss</span>
          </div>
          <p className="text-lg font-bold text-red-400">{totalLoss > 0 ? `-${totalLoss}` : '--'}</p>
          <p className="text-[10px] text-red-500/70">ft</p>
        </div>
        <div className="bg-bgTertiary rounded-lg py-2 px-3">
          <div className="flex items-center justify-center gap-1 text-textSecondary">
            <span className="text-xs font-medium">Net</span>
          </div>
          <p className={`text-lg font-bold ${totalLoss > 0 ? (netElevation >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-textTertiary'}`}>
            {totalLoss > 0 ? `${netElevation >= 0 ? '+' : ''}${netElevation}` : '--'}
          </p>
          <p className="text-[10px] text-textTertiary">ft</p>
        </div>
      </div>

      {/* SVG bar chart: per-mile elevation change */}
      <div className="relative">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-32" preserveAspectRatio="none">
          {/* Center line */}
          <line x1="0" y1={midY} x2={svgWidth} y2={midY} stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.3" />

          {/* Bars */}
          {changes.map((change, i) => {
            const barHeight = (Math.abs(change) / maxAbsChange) * maxBarHeight;
            const isGain = change >= 0;
            const x = barPadding + i * (barWidth + barPadding);
            const y = isGain ? midY - barHeight : midY;

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 0.5)}
                rx={0.5}
                fill={isGain ? ELEVATION_COLORS.gain : ELEVATION_COLORS.loss}
                opacity={0.85}
              >
                <title>Mile {i + 1}: {change >= 0 ? '+' : ''}{change} ft</title>
              </rect>
            );
          })}
        </svg>

        {/* Mile labels below */}
        <div className="flex" style={{ paddingLeft: `${barPadding}%`, paddingRight: `${barPadding}%` }}>
          {changes.map((_, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-[9px] text-textTertiary">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-between text-xs text-tertiary mt-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-emerald-400" /> Gain
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-red-400" /> Loss
        </span>
      </div>

      {/* Stats */}
      {steepestGain > 0 && (
        <div className="mt-4 pt-4 border-t border-borderSecondary text-sm">
          <p className="text-xs text-textTertiary">Biggest Climb</p>
          <p className="font-semibold text-emerald-500">
            Mile {steepestMile}: +{steepestGain} ft
          </p>
        </div>
      )}
    </div>
  );
}
