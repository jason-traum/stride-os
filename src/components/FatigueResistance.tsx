'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import { Loader2, Shield } from 'lucide-react';
import { getFatigueResistanceData, type FatigueResistanceData, type FatigueResistancePoint } from '@/actions/fatigue-resistance';
import { getWorkoutTypeHexColor } from '@/lib/workout-colors';
import { parseLocalDate } from '@/lib/utils';
import { TimeRangeSelector, TIME_RANGES_SHORT, getRangeDays, filterByTimeRange } from '@/components/shared/TimeRangeSelector';
import { AnimatedSection } from '@/components/AnimatedSection';

// Custom dot that colors by workout type
function WorkoutDot(props: {
  cx?: number;
  cy?: number;
  payload?: FatigueResistancePoint;
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
      stroke="#1e1e2e"
      strokeWidth={1.5}
    />
  );
}

// Custom tooltip
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: FatigueResistancePoint }[] }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const date = parseLocalDate(data.date);
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const typeLabels: Record<string, string> = {
    recovery: 'Recovery', easy: 'Easy', steady: 'Steady', marathon: 'Marathon',
    tempo: 'Tempo', threshold: 'Threshold', interval: 'Interval',
    repetition: 'Repetition', long: 'Long', race: 'Race',
  };

  const label = data.fatigueResistance >= 100 ? 'Negative split' : 'Positive split';

  return (
    <div className="bg-bgSecondary border border-borderPrimary rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-textPrimary">{formattedDate}</p>
      <div className="flex items-center gap-2 mt-1">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ backgroundColor: getWorkoutTypeHexColor(data.workoutType) }}
        />
        <span className="text-textSecondary">{typeLabels[data.workoutType] || data.workoutType}</span>
        <span className="text-textTertiary">{data.distanceMiles} mi</span>
      </div>
      <p className="mt-1">
        <span className="font-bold text-textPrimary">{data.fatigueResistance.toFixed(1)}%</span>
        <span className="text-textTertiary ml-1.5">{label}</span>
      </p>
    </div>
  );
}

// Type legend item
function LegendItem({ type, label }: { type: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: getWorkoutTypeHexColor(type) }}
      />
      <span className="text-textTertiary">{label}</span>
    </div>
  );
}

export function FatigueResistance() {
  const [data, setData] = useState<FatigueResistanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6M');

  useEffect(() => {
    async function fetchData() {
      // Fetch a full year of data; we filter client-side by time range
      const result = await getFatigueResistanceData(365);
      if (result.success) {
        setData(result.data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // Filter data by selected time range
  const filteredData = useMemo(() => {
    if (!data) return [];
    const days = getRangeDays(timeRange, TIME_RANGES_SHORT);
    return filterByTimeRange(data.timeSeries, days);
  }, [data, timeRange]);

  // Recalculate stats for filtered data
  const filteredStats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const average = Math.round(
      (filteredData.reduce((sum, d) => sum + d.fatigueResistance, 0) / filteredData.length) * 10
    ) / 10;

    // Determine tendency text
    let tendency: string;
    if (average >= 101) tendency = 'speed up';
    else if (average >= 99) tendency = 'maintain pace';
    else tendency = 'slow down';

    return { average, tendency };
  }, [filteredData]);

  // Unique workout types present in the filtered data (for legend)
  const workoutTypes = useMemo(() => {
    if (filteredData.length === 0) return [];
    const types = new Set(filteredData.map(d => d.workoutType));
    const typeLabels: Record<string, string> = {
      recovery: 'Recovery', easy: 'Easy', steady: 'Steady', marathon: 'Marathon',
      tempo: 'Tempo', threshold: 'Threshold', interval: 'Interval',
      repetition: 'Repetition', long: 'Long', race: 'Race',
    };
    return Array.from(types).map(t => ({ type: t, label: typeLabels[t] || t }));
  }, [filteredData]);

  // Chart data with formatted date for X axis
  const chartData = useMemo(() => {
    return filteredData.map(d => ({
      ...d,
      dateFormatted: parseLocalDate(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [filteredData]);

  // Y-axis domain: center around 100 with some padding
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [90, 110];
    const values = chartData.map(d => d.fatigueResistance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.15, 2);
    return [
      Math.floor(Math.min(min - padding, 95)),
      Math.ceil(Math.max(max + padding, 105)),
    ];
  }, [chartData]);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-dream-500" />
          Fatigue Resistance
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
        </div>
      </div>
    );
  }

  if (!data || data.timeSeries.length === 0) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-dream-500" />
            Fatigue Resistance
          </h2>
          <div className="h-32 flex items-center justify-center text-textTertiary text-sm">
            Need runs with 4+ segments and 2+ miles to analyze pacing fade
          </div>
        </div>
      </AnimatedSection>
    );
  }

  const trendLabel = data.stats.trend === 'improving'
    ? 'Improving'
    : data.stats.trend === 'declining'
      ? 'Declining'
      : 'Stable';

  const trendColor = data.stats.trend === 'improving'
    ? 'text-green-500'
    : data.stats.trend === 'declining'
      ? 'text-red-400'
      : 'text-textTertiary';

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-textPrimary flex items-center gap-2">
            <Shield className="w-5 h-5 text-dream-500" />
            Fatigue Resistance
          </h2>
          <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
        </div>

        {/* Summary */}
        {filteredStats && (
          <p className="text-xs text-textTertiary mb-3">
            Your average fatigue resistance is{' '}
            <span className="font-semibold text-textSecondary">{filteredStats.average.toFixed(1)}%</span>.
            You tend to{' '}
            <span className={
              filteredStats.tendency === 'speed up'
                ? 'text-green-500 font-medium'
                : filteredStats.tendency === 'slow down'
                  ? 'text-red-400 font-medium'
                  : 'text-textSecondary font-medium'
            }>
              {filteredStats.tendency}
            </span>{' '}
            in the last quarter of your runs.
            {data.stats.trend !== 'stable' && (
              <span className={`ml-1 ${trendColor}`}>
                Trend: {trendLabel}.
              </span>
            )}
          </p>
        )}

        {/* Legend */}
        {workoutTypes.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            {workoutTypes.map(wt => (
              <LegendItem key={wt.type} type={wt.type} label={wt.label} />
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-4 border-t border-dashed border-textTertiary" />
              <span className="text-textTertiary">Even pace (100%)</span>
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} />
                <XAxis
                  dataKey="dateFormatted"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#475569', strokeWidth: 0.5 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: '#94a3b8', strokeWidth: 0.5, strokeDasharray: '3 3' }}
                />
                <ReferenceLine
                  y={100}
                  stroke="#94a3b8"
                  strokeDasharray="6 3"
                  strokeWidth={1}
                  label={{
                    value: '100%',
                    position: 'right',
                    fill: '#94a3b8',
                    fontSize: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="fatigueResistance"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={<WorkoutDot />}
                  activeDot={{ r: 6, stroke: '#a78bfa', strokeWidth: 2, fill: '#1e1e2e' }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-textTertiary text-sm">
            No qualifying runs in this period
          </div>
        )}

        {/* Averages by workout type */}
        {Object.keys(data.stats.averageByType).length > 1 && (
          <div className="mt-3 pt-3 border-t border-borderPrimary">
            <p className="text-[10px] uppercase tracking-wide text-textTertiary font-medium mb-2">By workout type</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {Object.entries(data.stats.averageByType)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([type, { avg, count }]) => {
                  const typeLabels: Record<string, string> = {
                    recovery: 'Recovery', easy: 'Easy', steady: 'Steady', marathon: 'Marathon',
                    tempo: 'Tempo', threshold: 'Threshold', interval: 'Interval',
                    repetition: 'Repetition', long: 'Long', race: 'Race',
                  };
                  return (
                    <div key={type} className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: getWorkoutTypeHexColor(type) }}
                      />
                      <span className="text-textSecondary">
                        {typeLabels[type] || type}: <span className="font-medium">{avg.toFixed(1)}%</span>
                        <span className="text-textTertiary ml-0.5">({count})</span>
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
