'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
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
  /** Per-second altitude stream in meters from Strava */
  altitudeStream?: number[];
  /** Per-second distance stream in meters from Strava */
  distanceStream?: number[];
}

const METERS_TO_FEET = 3.28084;
const METERS_TO_MILES = 0.000621371;

/** Downsample to a target number of points using bucket averaging */
function downsamplePaired(
  distances: number[],
  altitudes: number[],
  maxPoints: number
): { distance: number; altitude: number }[] {
  if (distances.length <= maxPoints) {
    return distances.map((d, i) => ({ distance: d, altitude: altitudes[i] }));
  }
  const step = distances.length / maxPoints;
  const result: { distance: number; altitude: number }[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let distSum = 0;
    let altSum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      distSum += distances[j];
      altSum += altitudes[j];
      count++;
    }
    if (count > 0) {
      result.push({ distance: distSum / count, altitude: altSum / count });
    }
  }
  return result;
}

/** Light smoothing pass — rolling average to reduce GPS altitude noise */
function smoothAltitude(data: { distance: number; altitude: number }[], windowSize: number) {
  const half = Math.floor(windowSize / 2);
  return data.map((point, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length, i + half + 1);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += data[j].altitude;
    }
    return { ...point, altitude: sum / (end - start) };
  });
}

/** Custom tooltip for the Recharts area chart */
function ElevationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { distanceMi: number; altitudeFt: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-bgSecondary border border-borderPrimary rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="text-textTertiary mb-1">{data.distanceMi.toFixed(2)} mi</div>
      <div className="flex items-center gap-1.5 text-emerald-400">
        <Mountain className="w-3 h-3" />
        <span className="font-semibold">{Math.round(data.altitudeFt)} ft</span>
      </div>
    </div>
  );
}

export function ElevationChart({
  laps,
  totalElevationGain,
  altitudeStream,
  distanceStream,
}: ElevationChartProps) {
  // ──────────────────────────────────────────────
  // Stream-based terrain profile (Strava workouts)
  // ──────────────────────────────────────────────
  const streamProfile = useMemo(() => {
    if (!altitudeStream || !distanceStream) return null;
    if (altitudeStream.length < 10 || distanceStream.length < 10) return null;
    // Both streams should be the same length
    const len = Math.min(altitudeStream.length, distanceStream.length);

    // Downsample to ~400 points for smooth rendering
    const raw = downsamplePaired(
      distanceStream.slice(0, len),
      altitudeStream.slice(0, len),
      400
    );

    // Smooth to reduce GPS altitude jitter
    const smoothed = smoothAltitude(raw, 5);

    // Convert to feet / miles for display
    const chartPoints = smoothed.map((p) => ({
      distanceMi: p.distance * METERS_TO_MILES,
      altitudeFt: p.altitude * METERS_TO_FEET,
    }));

    // Compute gain / loss from the smoothed data
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < smoothed.length; i++) {
      const diff = (smoothed[i].altitude - smoothed[i - 1].altitude) * METERS_TO_FEET;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }

    // Min/max for the altitude range
    const altitudes = chartPoints.map((p) => p.altitudeFt);
    const minAlt = Math.min(...altitudes);
    const maxAlt = Math.max(...altitudes);

    // Find the steepest mile
    let steepestMile = 0;
    let steepestGain = 0;
    let currentMile = 1;
    let mileGain = 0;
    for (let i = 1; i < chartPoints.length; i++) {
      const diff = chartPoints[i].altitudeFt - chartPoints[i - 1].altitudeFt;
      if (diff > 0) mileGain += diff;
      if (chartPoints[i].distanceMi >= currentMile) {
        if (mileGain > steepestGain) {
          steepestGain = mileGain;
          steepestMile = currentMile;
        }
        currentMile++;
        mileGain = 0;
      }
    }
    // Check last partial mile
    if (mileGain > steepestGain) {
      steepestGain = mileGain;
      steepestMile = currentMile;
    }

    return {
      chartPoints,
      gain: Math.round(gain),
      loss: Math.round(loss),
      minAlt: Math.round(minAlt),
      maxAlt: Math.round(maxAlt),
      steepestMile,
      steepestGain: Math.round(steepestGain),
    };
  }, [altitudeStream, distanceStream]);

  // ──────────────────────────────────────────────
  // Lap-based fallback (non-Strava workouts)
  // ──────────────────────────────────────────────
  const lapData = useMemo(() => {
    const hasElevation = laps.some(
      (l) => l.elevationGainFeet !== null && l.elevationGainFeet !== 0
    );
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

  // ──────────────────────────────────────────────
  // Render: Stream-based terrain profile
  // ──────────────────────────────────────────────
  if (streamProfile) {
    const { chartPoints, gain, loss, minAlt, maxAlt, steepestMile, steepestGain } = streamProfile;
    const netElevation = gain - loss;
    const displayGain = gain || totalElevationGain || 0;
    // Pad the Y domain so the line doesn't touch edges
    const altRange = maxAlt - minAlt || 10;
    const yMin = Math.floor(minAlt - altRange * 0.05);
    const yMax = Math.ceil(maxAlt + altRange * 0.05);

    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary flex items-center gap-2 mb-3">
          <Mountain className="w-5 h-5 text-emerald-500" />
          Elevation Profile
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
            <p className="text-lg font-bold text-red-400">{loss > 0 ? `-${loss}` : '--'}</p>
            <p className="text-[10px] text-red-500/70">ft</p>
          </div>
          <div className="bg-bgTertiary rounded-lg py-2 px-3">
            <div className="flex items-center justify-center gap-1 text-textSecondary">
              <span className="text-xs font-medium">Net</span>
            </div>
            <p
              className={`text-lg font-bold ${
                loss > 0
                  ? netElevation >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                  : 'text-textTertiary'
              }`}
            >
              {loss > 0 ? `${netElevation >= 0 ? '+' : ''}${netElevation}` : '--'}
            </p>
            <p className="text-[10px] text-textTertiary">ft</p>
          </div>
        </div>

        {/* Recharts area chart — actual terrain */}
        <div className="w-full h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPoints} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="elevProfileGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-secondary)"
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="distanceMi"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(val: number) => `${val.toFixed(1)}`}
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: 'Distance (mi)',
                  position: 'insideBottom',
                  offset: -2,
                  fontSize: 10,
                  fill: 'var(--text-tertiary)',
                }}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(val: number) => `${Math.round(val)}`}
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
                width={45}
                label={{
                  value: 'ft',
                  position: 'insideTopLeft',
                  offset: 0,
                  fontSize: 10,
                  fill: 'var(--text-tertiary)',
                }}
              />
              <Tooltip
                content={<ElevationTooltip />}
                cursor={{ stroke: 'var(--text-tertiary)', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="altitudeFt"
                stroke="#34d399"
                strokeWidth={1.5}
                fill="url(#elevProfileGradient)"
                dot={false}
                activeDot={{ r: 3, fill: '#34d399', stroke: '#1e1e2e', strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Steepest climb callout */}
        {steepestGain > 0 && (
          <div className="mt-4 pt-4 border-t border-borderSecondary flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-textTertiary">Steepest Climb</p>
              <p className="font-semibold text-emerald-500">
                Mile {steepestMile}: +{steepestGain} ft
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-textTertiary">Elevation Range</p>
              <p className="font-semibold text-textSecondary">
                {minAlt} &ndash; {maxAlt} ft
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // Render: Fallback — just total elevation gain
  // ──────────────────────────────────────────────
  if (!lapData && totalElevationGain && totalElevationGain > 0) {
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

  // ──────────────────────────────────────────────
  // Render: Lap-based bar chart (per-mile gain/loss)
  // ──────────────────────────────────────────────
  if (!lapData) return null;

  const { changes, totalGain, totalLoss, maxAbsChange, steepestMile, steepestGain } = lapData;
  const netElevation = totalGain - totalLoss;
  const displayGain = totalGain || totalElevationGain || 0;

  const svgWidth = 100;
  const svgHeight = 50;
  const barPadding = 1;
  const barWidth = (svgWidth - barPadding * (changes.length + 1)) / changes.length;
  const midY = svgHeight / 2;
  const maxBarHeight = svgHeight / 2 - 2;

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
          <p
            className={`text-lg font-bold ${
              totalLoss > 0
                ? netElevation >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
                : 'text-textTertiary'
            }`}
          >
            {totalLoss > 0 ? `${netElevation >= 0 ? '+' : ''}${netElevation}` : '--'}
          </p>
          <p className="text-[10px] text-textTertiary">ft</p>
        </div>
      </div>

      {/* SVG bar chart: per-mile elevation change */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-32"
          preserveAspectRatio="none"
        >
          {/* Center line */}
          <line
            x1="0"
            y1={midY}
            x2={svgWidth}
            y2={midY}
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="0.3"
          />

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
                <title>
                  Mile {i + 1}: {change >= 0 ? '+' : ''}
                  {change} ft
                </title>
              </rect>
            );
          })}
        </svg>

        {/* Mile labels below */}
        <div
          className="flex"
          style={{ paddingLeft: `${barPadding}%`, paddingRight: `${barPadding}%` }}
        >
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
