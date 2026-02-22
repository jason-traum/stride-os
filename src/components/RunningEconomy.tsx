'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Loader2, Heart, TrendingUp, TrendingDown } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';
import { TimeRangeSelector, TIME_RANGES_SHORT, getRangeDays, filterByTimeRange } from '@/components/shared/TimeRangeSelector';
import { getWorkoutTypeHexColor } from '@/lib/workout-colors';
import { formatPace, parseLocalDate } from '@/lib/utils';
import {
  getRunningEconomyData,
  type RunningEconomyResult,
  type EconomyDataPoint,
} from '@/actions/running-economy';

// ── Helpers ────────────────────────────────────────────────────────────

function formatMonth(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    recovery: 'Recovery',
    easy: 'Easy',
    long: 'Long',
    steady: 'Steady',
  };
  return labels[type] || type;
}

// Compute trendline points for the visible data
function computeTrendLine(data: { dayIndex: number; normalizedPace: number }[]): { dayIndex: number; trend: number }[] {
  if (data.length < 4) return [];

  const xs = data.map(d => d.dayIndex);
  const ys = data.map(d => d.normalizedPace);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return [];

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // Return two points to draw a straight line across the chart
  return [
    { dayIndex: xs[0], trend: Math.round(slope * xs[0] + intercept) },
    { dayIndex: xs[xs.length - 1], trend: Math.round(slope * xs[xs.length - 1] + intercept) },
  ];
}

// ── Custom Chart Components ────────────────────────────────────────────

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: EconomyDataPoint & { dayIndex: number };
}) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  const color = getWorkoutTypeHexColor(payload.workoutType);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={color}
      stroke="#1e293b"
      strokeWidth={1.5}
      opacity={0.85}
    />
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: EconomyDataPoint & { dayIndex: number } }>;
}) {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-bgPrimary border border-borderPrimary rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold text-textPrimary mb-1.5">{formatMonth(d.date)}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-textTertiary">Actual Pace</span>
          <span className="text-textPrimary font-medium">{formatPace(d.avgPace)}/mi</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-textTertiary">Avg HR</span>
          <span className="text-textPrimary font-medium">{d.avgHR} bpm</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-textTertiary">Normalized Pace</span>
          <span className="text-dream-400 font-semibold">{formatPace(d.normalizedPace)}/mi</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-textTertiary">Type</span>
          <span className="text-textSecondary">{getTypeLabel(d.workoutType)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-textTertiary">Distance</span>
          <span className="text-textSecondary">{d.distanceMiles} mi</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function RunningEconomyCard() {
  const [fullData, setFullData] = useState<RunningEconomyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState('6M');

  // Fetch full year of data once, filter client-side
  useEffect(() => {
    setLoading(true);
    getRunningEconomyData(365).then(result => {
      if (result.success) setFullData(result.data);
      setLoading(false);
    });
  }, []);

  // Filter data points by selected time range
  const filteredPoints = useMemo(() => {
    if (!fullData) return [];
    const days = getRangeDays(selectedRange);
    return filterByTimeRange(fullData.dataPoints, days);
  }, [fullData, selectedRange]);

  // Prepare chart data with day indices for x-axis
  const chartData = useMemo(() => {
    if (filteredPoints.length === 0) return [];
    const firstDate = new Date(filteredPoints[0].date + 'T12:00:00').getTime();
    return filteredPoints.map(d => ({
      ...d,
      dayIndex: Math.round((new Date(d.date + 'T12:00:00').getTime() - firstDate) / (1000 * 60 * 60 * 24)),
    }));
  }, [filteredPoints]);

  // Compute trendline for filtered data
  const trendData = useMemo(() => computeTrendLine(chartData), [chartData]);

  // Compute local trend stats for the selected range
  const localTrend = useMemo(() => {
    if (trendData.length < 2) return null;
    const firstPace = trendData[0].trend;
    const lastPace = trendData[trendData.length - 1].trend;
    const diff = lastPace - firstPace; // negative = faster = improving
    const pctChange = firstPace > 0 ? Math.round((diff / firstPace) * 1000) / 10 : 0;
    return { firstPace, lastPace, diff, pctChange, improving: diff < 0 };
  }, [trendData]);

  // Build summary sentence
  const summaryText = useMemo(() => {
    if (!localTrend || !fullData || chartData.length < 4) return null;
    const rangeLabel = selectedRange === '1M' ? 'month' : selectedRange === '3M' ? '3 months' : selectedRange === '6M' ? '6 months' : 'year';

    if (localTrend.improving) {
      const pct = Math.abs(localTrend.pctChange);
      return `Your running economy has improved ${pct}% over the last ${rangeLabel}. You now run ${formatPace(localTrend.lastPace)}/mi at ${fullData.referenceHR}bpm, compared to ${formatPace(localTrend.firstPace)}/mi ${rangeLabel === 'month' ? 'a month ago' : rangeLabel + ' ago'}.`;
    } else if (localTrend.pctChange > 0.5) {
      const pct = Math.abs(localTrend.pctChange);
      return `Your running economy has declined ${pct}% over the last ${rangeLabel}. You ran ${formatPace(localTrend.firstPace)}/mi at ${fullData.referenceHR}bpm ${rangeLabel === 'month' ? 'a month ago' : rangeLabel + ' ago'}, versus ${formatPace(localTrend.lastPace)}/mi now.`;
    } else {
      return `Your running economy has been stable over the last ${rangeLabel}, averaging around ${formatPace(localTrend.lastPace)}/mi at ${fullData.referenceHR}bpm.`;
    }
  }, [localTrend, fullData, selectedRange, chartData.length]);

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-dream-500" />
            Running Economy
          </h2>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
          </div>
        </div>
      </AnimatedSection>
    );
  }

  if (!fullData || fullData.totalAnalyzed < 3) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-dream-500" />
            Running Economy
          </h2>
          <p className="text-sm text-textTertiary">
            Not enough data yet. Running economy needs easy/steady runs with heart rate data
            to track how your pace improves at the same effort level.
          </p>
        </div>
      </AnimatedSection>
    );
  }

  // Y-axis domain: find min/max normalized pace with some padding
  const paces = chartData.map(d => d.normalizedPace);
  const minPace = Math.min(...paces) - 15;
  const maxPace = Math.max(...paces) + 15;

  // Generate ticks: format x-axis dates
  const tickCount = Math.min(6, chartData.length);
  const step = Math.max(1, Math.floor(chartData.length / tickCount));
  const xTicks = chartData.filter((_, i) => i % step === 0).map(d => d.dayIndex);

  // Date lookup for x-axis labels
  const dayToDate = new Map(chartData.map(d => [d.dayIndex, d.date]));

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Header with time range selector */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-dream-500" />
            <h3 className="font-semibold text-textPrimary">Running Economy</h3>
          </div>
          <TimeRangeSelector
            selected={selectedRange}
            onChange={setSelectedRange}
          />
        </div>

        {/* Summary headline */}
        {summaryText && (
          <div className="mb-4 p-3 bg-bgTertiary rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              {localTrend?.improving ? (
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingUp className="w-4 h-4 text-rose-400" />
              )}
              <span className="text-sm font-medium text-textPrimary">
                Pace at {fullData.referenceHR}bpm
              </span>
            </div>
            <p className="text-sm text-textSecondary">{summaryText}</p>
          </div>
        )}

        {/* Chart: Normalized pace over time */}
        {chartData.length > 0 && (
          <div className="mb-3">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" opacity={0.3} />
                <XAxis
                  dataKey="dayIndex"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  ticks={xTicks}
                  minTickGap={35}
                  tickFormatter={(val: number) => {
                    const date = dayToDate.get(val);
                    if (!date) return '';
                    return formatMonth(date);
                  }}
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  axisLine={{ stroke: 'var(--border-secondary)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[minPace, maxPace]}
                  reversed
                  tickFormatter={(val: number) => formatPace(val)}
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#475569', strokeDasharray: '3 3' }} />

                {/* Trend line */}
                {trendData.length >= 2 && (
                  <Line
                    data={trendData}
                    dataKey="trend"
                    stroke={localTrend?.improving ? '#34d399' : '#f87171'}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                )}

                {/* Data points as scatter */}
                <Scatter
                  dataKey="normalizedPace"
                  shape={<CustomDot />}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-dream-500" />
                <span className="text-xs text-textTertiary">Normalized pace at {fullData.referenceHR}bpm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0 border-t-2 border-dashed" style={{ borderColor: localTrend?.improving ? '#34d399' : '#f87171' }} />
                <span className="text-xs text-textTertiary">Trend</span>
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="text-center">
            <p className="text-xs text-textTertiary mb-0.5">Runs Analyzed</p>
            <p className="text-sm font-semibold text-textPrimary">{filteredPoints.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-textTertiary mb-0.5">Ref. HR</p>
            <p className="text-sm font-semibold text-textPrimary">{fullData.referenceHR} bpm</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-textTertiary mb-0.5">Trend</p>
            <p className={`text-sm font-semibold ${
              localTrend?.improving ? 'text-emerald-400' :
              localTrend && localTrend.pctChange > 0.5 ? 'text-rose-400' :
              'text-textSecondary'
            }`}>
              {localTrend ? `${localTrend.improving ? '' : '+'}${localTrend.pctChange}%` : '--'}
            </p>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
