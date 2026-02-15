'use client';

import { useMemo } from 'react';
import { Heart } from 'lucide-react';
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

interface HRTrendChartProps {
  laps: Lap[];
  maxHr: number;
}

const HR_ZONES = [
  { name: 'Z1', label: 'Recovery', min: 0, max: 0.6, color: 'var(--accent-blue)', bgOpacity: 0.08 },
  { name: 'Z2', label: 'Aerobic', min: 0.6, max: 0.7, color: 'var(--accent-teal)', bgOpacity: 0.08 },
  { name: 'Z3', label: 'Tempo', min: 0.7, max: 0.8, color: '#eab308', bgOpacity: 0.08 },
  { name: 'Z4', label: 'Threshold', min: 0.8, max: 0.9, color: 'var(--accent-orange)', bgOpacity: 0.08 },
  { name: 'Z5', label: 'VO2max', min: 0.9, max: 1.0, color: '#ef4444', bgOpacity: 0.08 },
];

function getZoneColor(hrPercent: number): string {
  if (hrPercent >= 0.9) return '#ef4444';
  if (hrPercent >= 0.8) return 'var(--accent-orange)';
  if (hrPercent >= 0.7) return '#eab308';
  if (hrPercent >= 0.6) return 'var(--accent-teal)';
  return 'var(--accent-blue)';
}

export function HRTrendChart({ laps, maxHr }: HRTrendChartProps) {
  const chartData = useMemo(() => {
    const hrLaps = laps.filter(l => l.avgHeartRate !== null);
    if (hrLaps.length < 2) return null;

    const hrs = hrLaps.map(l => l.avgHeartRate!);
    const maxHrValues = hrLaps.filter(l => l.maxHeartRate).map(l => l.maxHeartRate!);

    const minHrVal = Math.min(...hrs);
    const maxHrVal = Math.max(...hrs, ...maxHrValues);

    // Chart range with padding
    const range = maxHrVal - minHrVal || 20;
    const paddedMin = Math.max(0, minHrVal - range * 0.15);
    const paddedMax = maxHrVal + range * 0.15;

    // Stats
    const avgHr = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
    const peakHr = Math.max(...hrs, ...maxHrValues);

    // HR drift: compare first half avg to second half avg
    const firstHalf = hrs.slice(0, Math.ceil(hrs.length / 2));
    const secondHalf = hrs.slice(Math.ceil(hrs.length / 2));
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const hrDrift = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

    return {
      hrLaps,
      hrs,
      minHr: paddedMin,
      maxHrDisplay: paddedMax,
      range: paddedMax - paddedMin,
      avgHr,
      peakHr,
      hrDrift,
    };
  }, [laps]);

  if (!chartData) {
    return null;
  }

  const { hrLaps, hrs, minHr, maxHrDisplay, range, avgHr, peakHr, hrDrift } = chartData;

  // Chart dimensions
  const width = 100;
  const height = 40;
  const padding = { top: 2, bottom: 2, left: 0, right: 0 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate points
  const points = hrs.map((hr, i) => {
    const x = padding.left + (i / (hrs.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((hr - minHr) / range) * chartHeight;
    const hrPercent = hr / maxHr;
    return { x, y, hr, hrPercent };
  });

  // Line path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Area path
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  // Average HR line Y position
  const avgY = padding.top + chartHeight - ((avgHr - minHr) / range) * chartHeight;

  // Zone bands
  const zoneBands = HR_ZONES.map(zone => {
    const zoneLow = zone.min * maxHr;
    const zoneHigh = zone.max * maxHr;

    // Clamp to chart range
    const clampedLow = Math.max(zoneLow, minHr);
    const clampedHigh = Math.min(zoneHigh, maxHrDisplay);

    if (clampedLow >= maxHrDisplay || clampedHigh <= minHr) return null;

    const yBottom = padding.top + chartHeight - ((clampedLow - minHr) / range) * chartHeight;
    const yTop = padding.top + chartHeight - ((clampedHigh - minHr) / range) * chartHeight;

    return {
      ...zone,
      yTop,
      yBottom,
      height: yBottom - yTop,
    };
  }).filter(Boolean);

  // Gradient stops based on HR zones per point
  const gradientStops = points.map((p, i) => ({
    offset: (i / (points.length - 1)) * 100,
    color: getZoneColor(p.hrPercent),
  }));

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-textPrimary flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-400" />
          Heart Rate Trend
        </h2>
        <span className={`text-xs font-medium ${
          hrDrift > 5 ? 'text-rose-500' :
          hrDrift > 2 ? 'text-amber-500' :
          'text-green-500'
        }`}>
          {hrDrift > 0 ? '+' : ''}{hrDrift.toFixed(1)}% drift
        </span>
      </div>

      {/* SVG Chart */}
      <div className="relative mb-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hrGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              {gradientStops.map((stop, i) => (
                <stop key={i} offset={`${stop.offset}%`} stopColor={stop.color} stopOpacity="0.25" />
              ))}
            </linearGradient>
            <linearGradient id="hrLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              {gradientStops.map((stop, i) => (
                <stop key={i} offset={`${stop.offset}%`} stopColor={stop.color} stopOpacity="1" />
              ))}
            </linearGradient>
          </defs>

          {/* Zone bands */}
          {zoneBands.map((band) => band && (
            <rect
              key={band.name}
              x={padding.left}
              y={band.yTop}
              width={chartWidth}
              height={band.height}
              fill={band.color}
              opacity={band.bgOpacity}
            />
          ))}

          {/* Area fill */}
          <path d={areaPath} fill="url(#hrGradient)" />

          {/* Average HR line */}
          {avgY >= padding.top && avgY <= height - padding.bottom && (
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

          {/* Main line */}
          <path d={linePath} fill="none" stroke="url(#hrLineGradient)" strokeWidth="1" strokeLinejoin="round" />

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1"
              fill={getZoneColor(p.hrPercent)}
            />
          ))}
        </svg>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-textTertiary">Avg HR</p>
          <p className="font-semibold text-textPrimary">
            {avgHr} <span className="text-xs font-normal text-textTertiary">bpm</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-textTertiary">Max HR</p>
          <p className="font-semibold text-textPrimary">
            {peakHr} <span className="text-xs font-normal text-textTertiary">bpm</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-textTertiary">HR Drift</p>
          <p className={`font-semibold ${
            hrDrift > 5 ? 'text-rose-500' :
            hrDrift > 2 ? 'text-amber-500' :
            'text-green-500'
          }`}>
            {hrDrift > 0 ? '+' : ''}{hrDrift.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* HR by mile visualization */}
      <div className="mt-4 pt-4 border-t border-borderSecondary">
        <p className="text-xs text-textTertiary mb-2">HR by Mile</p>
        <div className="flex gap-1 items-end h-12">
          {hrs.map((hr, i) => {
            const hrPercent = hr / maxHr;
            const normalizedHeight = (hr - Math.min(...hrs)) / ((Math.max(...hrs) - Math.min(...hrs)) || 1);
            const heightPercent = 20 + normalizedHeight * 80;

            let bgColor = 'bg-sky-400';
            if (hrPercent >= 0.9) bgColor = 'bg-red-500';
            else if (hrPercent >= 0.8) bgColor = 'bg-orange-500';
            else if (hrPercent >= 0.7) bgColor = 'bg-yellow-500';
            else if (hrPercent >= 0.6) bgColor = 'bg-sky-400';
            else bgColor = 'bg-blue-400';

            return (
              <div
                key={i}
                className={`flex-1 ${bgColor} rounded-t transition-all hover:opacity-80`}
                style={{ height: `${heightPercent}%` }}
                title={`Mile ${hrLaps[i].lapNumber}: ${hr} bpm`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
