'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn, parseLocalDate } from '@/lib/utils';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import type { FitnessMetrics, RampRateRisk } from '@/lib/training/fitness-calculations';

interface FitnessTrendChartProps {
  data: FitnessMetrics[];
  currentCtl: number;
  currentAtl: number;
  currentTsb: number;
  status: {
    status: 'fresh' | 'optimal' | 'tired' | 'overreached';
    label: string;
    color: string;
  };
  ctlChange: number | null;
  rampRate?: number | null;
  rampRateRisk?: RampRateRisk;
}

type TimeRange = '1M' | '3M' | '6M';

export function FitnessTrendChart({
  data,
  currentCtl,
  currentAtl,
  currentTsb,
  status,
  ctlChange,
  rampRate,
  rampRateRisk,
}: FitnessTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Filter data based on time range
  const filteredData = useMemo(() => {
    const now = new Date();
    let cutoff: Date;

    switch (timeRange) {
      case '1M':
        cutoff = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case '3M':
        cutoff = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case '6M':
        cutoff = new Date(now.setMonth(now.getMonth() - 6));
        break;
    }

    const cutoffStr = cutoff.toISOString().split('T')[0];
    return data.filter(d => d.date >= cutoffStr);
  }, [data, timeRange]);

  // Calculate chart dimensions
  const chartHeight = 200;
  const chartPadding = { top: 20, right: 10, bottom: 30, left: 40 };

  // Calculate scales
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _minValue, _maxValue, ctlPath, atlPath, tsbPath, zeroY } = useMemo(() => {
    if (filteredData.length === 0) {
      return { minValue: -20, maxValue: 60, ctlPath: '', atlPath: '', tsbPath: '', zeroY: 0 };
    }

    const allValues = filteredData.flatMap(d => [d.ctl, d.atl, d.tsb]);
    const min = Math.min(...allValues, -10);
    const max = Math.max(...allValues, 50);
    const padding = (max - min) * 0.1;
    const minVal = Math.floor(min - padding);
    const maxVal = Math.ceil(max + padding);

    const width = 100; // Percentage width
    const yScale = (v: number) =>
      chartPadding.top + ((maxVal - v) / (maxVal - minVal)) * (chartHeight - chartPadding.top - chartPadding.bottom);
    const xScale = (i: number) =>
      chartPadding.left + (i / (filteredData.length - 1)) * (width - chartPadding.left - chartPadding.right);

    const zero = yScale(0);

    // Build SVG paths (coordinates are in viewBox units, not percentages)
    const buildPath = (getValue: (d: FitnessMetrics) => number) => {
      return filteredData
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(getValue(d))}`)
        .join(' ');
    };

    return {
      minValue: minVal,
      maxValue: maxVal,
      ctlPath: buildPath(d => d.ctl),
      atlPath: buildPath(d => d.atl),
      tsbPath: buildPath(d => d.tsb),
      zeroY: zero,
    };
  }, [filteredData, chartHeight]);

  if (data.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h3 className="font-semibold text-primary mb-4">Fitness Trend</h3>
        <div className="h-48 flex items-center justify-center text-textTertiary">
          Not enough data to show fitness trends
        </div>
      </div>
    );
  }

  const hoveredData = hoveredIndex !== null ? filteredData[hoveredIndex] : null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-primary">Fitness Trend</h3>
          <p className="text-xs text-textTertiary mt-0.5">CTL/ATL/TSB tracking</p>
        </div>
        <div className="flex gap-1">
          {(['1M', '3M', '6M'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded transition-colors',
                timeRange === range
                  ? 'bg-accent-dream text-white'
                  : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Ramp Rate Warning - show when elevated or high risk */}
      {rampRateRisk && (rampRateRisk.level === 'elevated' || rampRateRisk.level === 'high') && (
        <div className={cn(
          'flex items-start gap-3 p-3 rounded-lg mb-4',
          rampRateRisk.level === 'high' ? 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800' : 'bg-surface-1 border border-default'
        )}>
          <AlertTriangle className={cn(
            'w-5 h-5 flex-shrink-0 mt-0.5',
            rampRateRisk.level === 'high' ? 'text-red-600' : 'text-dream-600'
          )} />
          <div>
            <div className={cn(
              'font-medium text-sm',
              rampRateRisk.level === 'high' ? 'text-red-800' : 'text-textSecondary'
            )}>
              {rampRateRisk.label}: {rampRateRisk.message}
            </div>
            {rampRateRisk.recommendation && (
              <div className={cn(
                'text-xs mt-1',
                rampRateRisk.level === 'high' ? 'text-red-700 dark:text-red-300' : 'text-dream-700 dark:text-dream-300'
              )}>
                {rampRateRisk.recommendation}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current Values */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">{currentCtl.toFixed(0)}</div>
          <div className="text-xs text-textTertiary">Fitness (CTL)</div>
          {ctlChange !== null && (
            <div className={cn('text-xs mt-0.5', ctlChange >= 0 ? 'text-dream-600' : 'text-rose-600')}>
              {ctlChange >= 0 ? '+' : ''}{ctlChange.toFixed(1)} vs 4wk ago
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-dream-600">{currentAtl.toFixed(0)}</div>
          <div className="text-xs text-textTertiary">Fatigue (ATL)</div>
        </div>
        <div className="text-center">
          <div className={cn('text-2xl font-bold', status.color)}>{currentTsb.toFixed(0)}</div>
          <div className="text-xs text-textTertiary">Form (TSB)</div>
        </div>
        <div className="text-center">
          <div className={cn('text-lg font-semibold', status.color)}>{status.label}</div>
          <div className="text-xs text-textTertiary">Status</div>
        </div>
        {/* Ramp Rate */}
        <div className="text-center">
          {rampRate !== null && rampRate !== undefined ? (
            <>
              <div className={cn('text-2xl font-bold flex items-center justify-center gap-1', rampRateRisk?.color || 'text-textSecondary')}>
                <TrendingUp className="w-4 h-4" />
                {rampRate > 0 ? '+' : ''}{rampRate.toFixed(1)}
              </div>
              <div className="text-xs text-textTertiary">Ramp Rate</div>
              {rampRateRisk && (
                <div className={cn('text-xs mt-0.5', rampRateRisk.color)}>
                  {rampRateRisk.label}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-tertiary">--</div>
              <div className="text-xs text-textTertiary">Ramp Rate</div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div
        className="relative"
        style={{ height: chartHeight }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* SVG Chart */}
        <svg
          className="w-full h-full"
          viewBox={`0 0 100 ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          <line
            x1={`${chartPadding.left}%`}
            y1={zeroY}
            x2="100%"
            y2={zeroY}
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Zero line label */}
          <text
            x={`${chartPadding.left - 2}%`}
            y={zeroY}
            className="text-[8px] fill-stone-400"
            textAnchor="end"
            dominantBaseline="middle"
          >
            0
          </text>

          {/* CTL Area (green fill) */}
          {ctlPath && (
            <>
              <path
                d={`${ctlPath} L 100 ${chartHeight - chartPadding.bottom} L ${chartPadding.left} ${chartHeight - chartPadding.bottom} Z`}
                fill="url(#ctlGradient)"
                className={cn('transition-opacity duration-500', mounted ? 'opacity-30' : 'opacity-0')}
              />
              <path
                d={ctlPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                className={cn('transition-all duration-500', mounted ? 'opacity-100' : 'opacity-0')}
              />
            </>
          )}

          {/* ATL Line (dashed) */}
          {atlPath && (
            <path
              d={atlPath}
              fill="none"
              stroke="#a8a29e"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              className={cn('transition-all duration-500', mounted ? 'opacity-100' : 'opacity-0')}
            />
          )}

          {/* TSB Line (blue) */}
          {tsbPath && (
            <path
              d={tsbPath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              className={cn('transition-all duration-500', mounted ? 'opacity-100' : 'opacity-0')}
            />
          )}

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="ctlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>

        {/* Interactive overlay for hover */}
        <div className="absolute inset-0" style={{ left: `${chartPadding.left}%` }}>
          {filteredData.map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 cursor-crosshair"
              style={{
                left: `${(i / (filteredData.length - 1)) * 100}%`,
                width: `${100 / filteredData.length}%`,
                transform: 'translateX(-50%)',
              }}
              onMouseEnter={() => setHoveredIndex(i)}
            />
          ))}
        </div>

        {/* Tooltip */}
        {hoveredData && hoveredIndex !== null && (
          <div
            className="absolute bg-stone-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none z-10"
            style={{
              left: `${chartPadding.left + (hoveredIndex / (filteredData.length - 1)) * (100 - chartPadding.left - chartPadding.right)}%`,
              top: '10px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-medium mb-1">
              {parseLocalDate(hoveredData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-400">CTL: {hoveredData.ctl.toFixed(0)}</span>
              <span className="text-dream-400">ATL: {hoveredData.atl.toFixed(0)}</span>
              <span className="text-dream-400">TSB: {hoveredData.tsb.toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-emerald-500 rounded-sm opacity-60" />
          <span className="text-textSecondary">Fitness (CTL)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5" style={{ borderTop: '2px dashed #a8a29e' }} />
          <span className="text-textSecondary">Fatigue (ATL)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-blue-50 dark:bg-blue-9500" />
          <span className="text-textSecondary">Form (TSB)</span>
        </div>
      </div>
    </div>
  );
}
