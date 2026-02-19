'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn, parseLocalDate } from '@/lib/utils';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';
import { TimeRangeSelector, TIME_RANGES_SHORT, getRangeDays, filterByTimeRange } from '@/components/shared/TimeRangeSelector';
import { FITNESS_COLORS, CHART_UI_COLORS } from '@/lib/chart-colors';
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

// ViewBox dimensions — all SVG coordinates use these units
const VB_WIDTH = 500;
const VB_HEIGHT = 200;
const PAD = { top: 15, right: 10, bottom: 25, left: 38 };
const PLOT_W = VB_WIDTH - PAD.left - PAD.right;
const PLOT_H = VB_HEIGHT - PAD.top - PAD.bottom;

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
  const [timeRange, setTimeRange] = useState('3M');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Filter data based on time range
  const filteredData = useMemo(() => {
    return filterByTimeRange(data, getRangeDays(timeRange, TIME_RANGES_SHORT));
  }, [data, timeRange]);

  // Compute scales and paths
  const chart = useMemo(() => {
    if (filteredData.length < 2) {
      return null;
    }

    const allValues = filteredData.flatMap(d => [d.ctl, d.atl, d.tsb]);
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    // Ensure zero is always visible and give some breathing room
    const minVal = Math.floor(Math.min(dataMin, -5) - 5);
    const maxVal = Math.ceil(Math.max(dataMax, 40) + 5);
    const range = maxVal - minVal;

    const xScale = (i: number) => PAD.left + (i / (filteredData.length - 1)) * PLOT_W;
    const yScale = (v: number) => PAD.top + ((maxVal - v) / range) * PLOT_H;

    const zeroY = yScale(0);

    const buildPath = (getValue: (d: FitnessMetrics) => number) =>
      filteredData.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(getValue(d)).toFixed(1)}`).join(' ');

    const ctlPath = buildPath(d => d.ctl);
    const atlPath = buildPath(d => d.atl);
    const tsbPath = buildPath(d => d.tsb);

    // Area fill for CTL — close path to bottom of plot area
    const firstX = xScale(0).toFixed(1);
    const lastX = xScale(filteredData.length - 1).toFixed(1);
    const bottomY = (PAD.top + PLOT_H).toFixed(1);
    const ctlArea = `${ctlPath} L${lastX},${bottomY} L${firstX},${bottomY} Z`;

    // Grid lines at nice intervals
    const gridStep = range > 80 ? 20 : range > 40 ? 10 : 5;
    const gridLines: number[] = [];
    for (let v = Math.ceil(minVal / gridStep) * gridStep; v <= maxVal; v += gridStep) {
      gridLines.push(v);
    }

    return { ctlPath, atlPath, tsbPath, ctlArea, zeroY, yScale, xScale, gridLines, minVal, maxVal };
  }, [filteredData]);

  if (data.length === 0 || !chart) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h3 className="font-semibold text-primary mb-4">Fitness Trend</h3>
          <div className="h-48 flex items-center justify-center text-textTertiary">
            Not enough data to show fitness trends
          </div>
        </div>
      </AnimatedSection>
    );
  }

  const hoveredData = hoveredIndex !== null && hoveredIndex < filteredData.length ? filteredData[hoveredIndex] : null;

  return (
    <AnimatedSection>
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-primary">Fitness Trend</h3>
          <p className="text-xs text-textTertiary mt-0.5">CTL/ATL/TSB tracking</p>
        </div>
        <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
      </div>

      {/* Ramp Rate Warning */}
      {rampRateRisk && (rampRateRisk.level === 'elevated' || rampRateRisk.level === 'high') && (
        <div className={cn(
          'flex items-start gap-3 p-3 rounded-lg mb-4',
          rampRateRisk.level === 'high' ? 'bg-red-950 border border-red-800' : 'bg-surface-1 border border-default'
        )}>
          <AlertTriangle className={cn(
            'w-5 h-5 flex-shrink-0 mt-0.5',
            rampRateRisk.level === 'high' ? 'text-red-600' : 'text-dream-600'
          )} />
          <div>
            <div className={cn(
              'font-medium text-sm',
              rampRateRisk.level === 'high' ? 'text-red-300' : 'text-textSecondary'
            )}>
              {rampRateRisk.label}: {rampRateRisk.message}
            </div>
            {rampRateRisk.recommendation && (
              <div className={cn(
                'text-xs mt-1',
                rampRateRisk.level === 'high' ? 'text-red-300' : 'text-dream-300'
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
          <div className="text-2xl font-bold text-emerald-400">{currentCtl.toFixed(0)}</div>
          <div className="text-xs text-textTertiary">Fitness (CTL)</div>
          {ctlChange !== null && (
            <div className={cn('text-xs mt-0.5', ctlChange >= 0 ? 'text-dream-400' : 'text-rose-400')}>
              {ctlChange >= 0 ? '+' : ''}{ctlChange.toFixed(1)} vs 4wk ago
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-dream-400">{currentAtl.toFixed(0)}</div>
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
      <div className="relative" onMouseLeave={() => setHoveredIndex(null)}>
        <svg
          className="w-full"
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          preserveAspectRatio="none"
          style={{ height: 200 }}
        >
          <defs>
            <linearGradient id="ctlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FITNESS_COLORS.ctl} stopOpacity="0.35" />
              <stop offset="100%" stopColor={FITNESS_COLORS.ctl} stopOpacity="0.03" />
            </linearGradient>
            <clipPath id="plotArea">
              <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>

          {/* Grid lines */}
          {chart.gridLines.map(v => {
            const y = chart.yScale(v);
            return (
              <g key={v}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={VB_WIDTH - PAD.right}
                  y2={y}
                  stroke={v === 0 ? CHART_UI_COLORS.zeroLine : CHART_UI_COLORS.gridLineMinor}
                  strokeWidth={v === 0 ? 0.8 : 0.4}
                  strokeDasharray={v === 0 ? undefined : '3 3'}
                />
                <text
                  x={PAD.left - 4}
                  y={y}
                  fill={CHART_UI_COLORS.axisLabel}
                  fontSize="9"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {v}
                </text>
              </g>
            );
          })}

          {/* CTL Area fill */}
          <path
            d={chart.ctlArea}
            fill="url(#ctlGradient)"
            clipPath="url(#plotArea)"
            className={cn('transition-opacity duration-500', mounted ? 'opacity-100' : 'opacity-0')}
          />

          {/* CTL Line (green) */}
          <path
            d={chart.ctlPath}
            fill="none"
            stroke={FITNESS_COLORS.ctl}
            strokeWidth="2"
            clipPath="url(#plotArea)"
            className={cn('transition-opacity duration-500', mounted ? 'opacity-100' : 'opacity-0')}
          />

          {/* ATL Line (dashed gray) */}
          <path
            d={chart.atlPath}
            fill="none"
            stroke={FITNESS_COLORS.atl}
            strokeWidth="1.5"
            strokeDasharray="4 2"
            clipPath="url(#plotArea)"
            className={cn('transition-opacity duration-500', mounted ? 'opacity-100' : 'opacity-0')}
          />

          {/* TSB Line (blue) */}
          <path
            d={chart.tsbPath}
            fill="none"
            stroke={FITNESS_COLORS.tsb}
            strokeWidth="2"
            clipPath="url(#plotArea)"
            className={cn('transition-opacity duration-500', mounted ? 'opacity-100' : 'opacity-0')}
          />

          {/* Hover indicator line */}
          {hoveredIndex !== null && (
            <line
              x1={chart.xScale(hoveredIndex)}
              y1={PAD.top}
              x2={chart.xScale(hoveredIndex)}
              y2={PAD.top + PLOT_H}
              stroke={CHART_UI_COLORS.hoverLine}
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
          )}

          {/* Date labels */}
          {filteredData.length > 0 && (() => {
            const labelCount = filteredData.length > 60 ? 4 : filteredData.length > 20 ? 6 : 8;
            const step = Math.max(1, Math.floor(filteredData.length / labelCount));
            const labels: JSX.Element[] = [];
            for (let i = 0; i < filteredData.length; i += step) {
              const d = parseLocalDate(filteredData[i].date);
              labels.push(
                <text
                  key={i}
                  x={chart.xScale(i)}
                  y={VB_HEIGHT - 5}
                  fill={CHART_UI_COLORS.axisLabel}
                  fontSize="8"
                  textAnchor="middle"
                >
                  {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </text>
              );
            }
            return labels;
          })()}
        </svg>

        {/* Interactive overlay */}
        <div
          className="absolute inset-0 cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const pct = mouseX / rect.width;
            // Map pixel position to plot area
            const plotPct = (pct - PAD.left / VB_WIDTH) / (PLOT_W / VB_WIDTH);
            const idx = Math.round(plotPct * Math.max(filteredData.length - 1, 0));
            const clampedIdx = Math.max(0, Math.min(filteredData.length - 1, idx));
            setHoveredIndex(clampedIdx);
          }}
        />

        {/* Tooltip */}
        {hoveredData && hoveredIndex !== null && (
          <div
            className="absolute bg-surface-1 border border-default text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none z-10"
            style={{
              left: `${(chart.xScale(hoveredIndex) / VB_WIDTH) * 100}%`,
              top: '8px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-medium text-primary mb-1">
              {parseLocalDate(hoveredData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-500">CTL: {hoveredData.ctl.toFixed(0)}</span>
              <span className="text-stone-400">ATL: {hoveredData.atl.toFixed(0)}</span>
              <span className="text-blue-400">TSB: {hoveredData.tsb.toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-emerald-500 rounded-full" />
          <span className="text-textSecondary">Fitness (CTL)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 border-t-2 border-dashed border-stone-400" />
          <span className="text-textSecondary">Fatigue (ATL)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-500 rounded-full" />
          <span className="text-textSecondary">Form (TSB)</span>
        </div>
      </div>
    </div>
    </AnimatedSection>
  );
}
