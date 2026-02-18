'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2, Activity } from 'lucide-react';
import {
  getVdotHistory,
  getVdotTrend,
  type VdotHistoryEntry,
} from '@/actions/vdot-history';
import { getEquivalentRaceTimes } from '@/lib/training/vdot-calculator';
import { formatRaceTime } from '@/lib/race-utils';
import { parseLocalDate } from '@/lib/utils';
import { MONTHLY_VDOT_START_DATE } from '@/lib/vdot-history-config';

interface VdotTimelineProps {
  currentVdot?: number | null;
}

export function VdotTimeline({ currentVdot }: VdotTimelineProps) {
  const [history, setHistory] = useState<VdotHistoryEntry[]>([]);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);
  const [trend, setTrend] = useState<{
    current: number | null;
    previous: number | null;
    change: number | null;
    changePercent: number | null;
    trend: 'improving' | 'stable' | 'declining' | 'unknown';
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [historyData, trendData] = await Promise.all([
        getVdotHistory({ startDate: MONTHLY_VDOT_START_DATE, limit: 240 }),
        getVdotTrend(90),
      ]);
      // Filter out any historically stored out-of-range values
      setHistory(historyData.filter(e => e.vdot >= 15 && e.vdot <= 85));
      setTrend(trendData);
      setLoading(false);
    }
    fetchData();
  }, []);

  const chartData = useMemo(() => {
    if (history.length < 2) return null;

    const sortedHistory = [...history].sort(
      (a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
    );

    const vdots = sortedHistory.map((h) => h.vdot);
    const rawMin = Math.min(...vdots);
    const rawMax = Math.max(...vdots);
    const rawRange = Math.max(rawMax - rawMin, 1);
    const minVdot = Math.floor((rawMin - rawRange * 0.2) * 10) / 10;
    const maxVdot = Math.ceil((rawMax + rawRange * 0.2) * 10) / 10;
    const range = Math.max(maxVdot - minVdot, 1);

    const plotTop = 4;
    const plotBottom = 34;
    const plotLeft = 6;
    const plotRight = 99;
    const plotHeight = plotBottom - plotTop;
    const plotWidth = plotRight - plotLeft;

    const points = sortedHistory.map((entry, i) => {
      const x = plotLeft + (i / Math.max(sortedHistory.length - 1, 1)) * plotWidth;
      const y = plotBottom - ((entry.vdot - minVdot) / range) * plotHeight;
      return { x, y, entry };
    });

    const linePath = points
      .map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
    const areaPath = `${linePath} L ${plotRight} ${plotBottom} L ${plotLeft} ${plotBottom} Z`;

    const yTickCount = 6;
    const yTicks = Array.from({ length: yTickCount }, (_, i) => {
      const value = minVdot + ((yTickCount - 1 - i) / (yTickCount - 1)) * range;
      const y = plotBottom - ((value - minVdot) / range) * plotHeight;
      return { value: Math.round(value * 10) / 10, y };
    });

    const targetTickCount = Math.min(8, sortedHistory.length);
    const tickIndexes = Array.from(
      new Set(
        Array.from({ length: targetTickCount }, (_, i) =>
          Math.round((i * (sortedHistory.length - 1)) / Math.max(targetTickCount - 1, 1))
        )
      )
    );
    const xTicks = tickIndexes.map((index) => {
      const date = parseLocalDate(sortedHistory[index].date);
      return {
        x: points[index].x,
        label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      };
    });

    return {
      entries: sortedHistory,
      minVdot,
      maxVdot,
      range,
      points,
      linePath,
      areaPath,
      yTicks,
      xTicks,
      plotTop,
      plotBottom,
      plotLeft,
      plotRight,
    };
  }, [history]);

  const equivalentTimes = useMemo(() => {
    const vdot = currentVdot || trend?.current;
    if (!vdot) return null;

    const raceTimes = getEquivalentRaceTimes(vdot);
    const distanceLabels: Record<string, string> = {
      '5K': '5K', '10K': '10K',
      'half_marathon': 'Half', 'marathon': 'Marathon',
    };

    return Object.entries(distanceLabels).map(([key, label]) => {
      const data = raceTimes[key];
      if (!data) return null;
      const paceMin = Math.floor(data.pace / 60);
      const paceSec = data.pace % 60;
      return {
        distance: label,
        time: formatRaceTime(data.time),
        pacePerMile: `${paceMin}:${paceSec.toString().padStart(2, '0')}`,
      };
    }).filter(Boolean) as { distance: string; time: string; pacePerMile: string }[];
  }, [currentVdot, trend]);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-dream-500" />
          Fitness Timeline
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  const displayVdot = currentVdot || trend?.current;
  const TrendIcon =
    trend?.trend === 'improving'
      ? TrendingUp
      : trend?.trend === 'declining'
        ? TrendingDown
        : Minus;
  const trendColor =
    trend?.trend === 'improving'
      ? 'text-green-600'
      : trend?.trend === 'declining'
        ? 'text-red-500'
        : 'text-textTertiary';
  const hoveredPoint = hoveredPointIndex !== null && chartData
    ? chartData.points[hoveredPointIndex] || null
    : null;
  const handleChartMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!chartData || !chartRef.current) return;

    const bounds = chartRef.current.getBoundingClientRect();
    if (bounds.width <= 0) return;

    const cursorX = ((event.clientX - bounds.left) / bounds.width) * 100;
    let closestIndex = 0;
    let closestDistance = Infinity;

    chartData.points.forEach((point, index) => {
      const distance = Math.abs(point.x - cursorX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setHoveredPointIndex(closestIndex);
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-dream-500" />
          Fitness Timeline
        </h2>
        {trend && trend.change !== null && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            {trend.change > 0 ? '+' : ''}
            {trend.change} VDOT ({trend.trend})
          </div>
        )}
      </div>

      {/* Current VDOT Display */}
      {displayVdot && (
        <div className="flex items-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-dream-600">{displayVdot.toFixed(1)}</p>
            <p className="text-xs text-textTertiary uppercase tracking-wide">Current VDOT</p>
          </div>

          {/* Equivalent Times */}
          {equivalentTimes && (
            <div className="flex-1 grid grid-cols-4 gap-2 text-center">
              {equivalentTimes.map((pred) => (
                <div key={pred.distance} className="p-2 bg-bgTertiary rounded-lg">
                  <p className="text-xs text-textTertiary">{pred.distance}</p>
                  <p className="font-semibold text-primary text-sm">{pred.time}</p>
                  <p className="text-xs text-tertiary">{pred.pacePerMile}/mi</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline Chart */}
      {chartData && chartData.entries.length >= 2 && (
        <div className="mb-4">
          <p className="text-xs text-textTertiary mb-2">
            Hover anywhere on the chart to inspect exact monthly values.
          </p>
          <div className="relative h-44">
            <svg
              ref={chartRef}
              viewBox="0 0 100 52"
              className="w-full h-full"
              preserveAspectRatio="none"
              onMouseMove={handleChartMouseMove}
              onMouseLeave={() => setHoveredPointIndex(null)}
            >
              <defs>
                <linearGradient id="vdotGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Y-axis grid + labels */}
              {chartData.yTicks.map((tick, i) => (
                <g key={`y-tick-${i}`}>
                  <line
                    x1={chartData.plotLeft}
                    y1={tick.y}
                    x2={chartData.plotRight}
                    y2={tick.y}
                    stroke="#334155"
                    strokeWidth="0.35"
                  />
                  <text
                    x="0.6"
                    y={tick.y + 0.9}
                    fill="#94a3b8"
                    fontSize="2.7"
                    textAnchor="start"
                  >
                    {tick.value.toFixed(1)}
                  </text>
                </g>
              ))}

              {/* X-axis baseline */}
              <line
                x1={chartData.plotLeft}
                y1={chartData.plotBottom}
                x2={chartData.plotRight}
                y2={chartData.plotBottom}
                stroke="#475569"
                strokeWidth="0.45"
              />

              {hoveredPoint && (
                <line
                  x1={hoveredPoint.x}
                  y1={chartData.plotTop}
                  x2={hoveredPoint.x}
                  y2={chartData.plotBottom}
                  stroke="#f59e0b"
                  strokeOpacity="0.35"
                  strokeDasharray="0.75 0.75"
                  strokeWidth="0.45"
                />
              )}

              <path d={chartData.areaPath} fill="url(#vdotGradient)" />
              <path
                d={chartData.linePath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="0.95"
                strokeLinejoin="round"
              />

              {chartData.points.map((point, i) => (
                <g key={point.entry.id}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={hoveredPointIndex === i ? 1.7 : point.entry.source === 'race' ? 1.4 : 1.05}
                    fill={point.entry.source === 'race' ? '#22c55e' : '#f59e0b'}
                  />
                </g>
              ))}

              {/* X-axis ticks + labels */}
              {chartData.xTicks.map((tick, i) => (
                <g key={`x-tick-${i}`}>
                  <line
                    x1={tick.x}
                    y1={chartData.plotBottom}
                    x2={tick.x}
                    y2={chartData.plotBottom + 1}
                    stroke="#64748b"
                    strokeWidth="0.35"
                  />
                  <text
                    x={tick.x}
                    y="46.2"
                    fill="#94a3b8"
                    fontSize="2.6"
                    textAnchor="middle"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}
            </svg>

            {hoveredPoint && (
              <div
                className="absolute z-10 rounded-md border border-borderPrimary bg-bgSecondary/95 px-2 py-1 text-xs shadow-sm pointer-events-none"
                style={{
                  left: `${hoveredPoint.x}%`,
                  top: `${(hoveredPoint.y / 52) * 100}%`,
                  transform: 'translate(-50%, -120%)',
                }}
              >
                <p className="font-medium text-primary">{hoveredPoint.entry.vdot.toFixed(1)} VDOT</p>
                <p className="text-textTertiary">
                  {parseLocalDate(hoveredPoint.entry.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-textTertiary">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#22c55e]" />
              Race-based estimate
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#f59e0b]" />
              Workout-based estimate
            </span>
          </div>
        </div>
      )}

      {history.length === 0 && !currentVdot && (
        <div className="text-center py-8 text-textTertiary">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No fitness history yet</p>
          <p className="text-xs mt-1">Complete a race or time trial to track your VDOT</p>
        </div>
      )}
    </div>
  );
}
