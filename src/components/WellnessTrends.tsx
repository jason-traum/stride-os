'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Loader2, Activity, TrendingUp, TrendingDown, Minus, Heart } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';
import { TimeRangeSelector, TIME_RANGES_SHORT, getRangeDays, filterByTimeRange } from '@/components/shared/TimeRangeSelector';
import { parseLocalDate } from '@/lib/utils';
import {
  getWellnessTrends,
  type WellnessTrendsResult,
  type WellnessDataPoint,
  type TrendDirection,
} from '@/actions/wellness-trends';

// ── Constants ───────────────────────────────────────────────────────────

const COLORS = {
  hrv: '#14b8a6',           // teal-500
  hrvFill: '#14b8a6',
  hrvRolling: '#0d9488',    // teal-600
  restingHR: '#f43f5e',     // rose-500
  restingHRRolling: '#e11d48', // rose-600
} as const;

const TIME_RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTrendIcon(trend: TrendDirection) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    case 'declining':
      return <TrendingDown className="w-4 h-4 text-rose-400" />;
    case 'stable':
      return <Minus className="w-4 h-4 text-textTertiary" />;
  }
}

function getTrendColor(trend: TrendDirection): string {
  switch (trend) {
    case 'improving':
      return 'text-emerald-400';
    case 'declining':
      return 'text-rose-400';
    case 'stable':
      return 'text-textSecondary';
  }
}

function formatTrendPct(pct: number | null): string {
  if (pct === null) return '--';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
}

// ── Custom Tooltip ──────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !label) return null;

  const hrv = payload.find(p => p.dataKey === 'hrv');
  const restingHR = payload.find(p => p.dataKey === 'restingHR');
  const hrvRolling = payload.find(p => p.dataKey === 'hrvRollingAvg');
  const restingHRRolling = payload.find(p => p.dataKey === 'restingHRRollingAvg');

  // Skip tooltip when there's no data at all for this day
  const hasData = (hrv?.value != null) || (restingHR?.value != null);
  if (!hasData) return null;

  return (
    <div className="bg-bgPrimary border border-borderPrimary rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold text-textPrimary mb-1.5">{formatDate(label)}</p>
      <div className="space-y-1">
        {hrv?.value != null && (
          <div className="flex justify-between gap-4">
            <span className="text-textTertiary">HRV</span>
            <span className="font-medium" style={{ color: COLORS.hrv }}>{Math.round(hrv.value)} ms</span>
          </div>
        )}
        {hrvRolling?.value != null && (
          <div className="flex justify-between gap-4">
            <span className="text-textTertiary">HRV (7d avg)</span>
            <span className="font-medium" style={{ color: COLORS.hrvRolling }}>{hrvRolling.value.toFixed(1)} ms</span>
          </div>
        )}
        {restingHR?.value != null && (
          <div className="flex justify-between gap-4">
            <span className="text-textTertiary">Resting HR</span>
            <span className="font-medium" style={{ color: COLORS.restingHR }}>{Math.round(restingHR.value)} bpm</span>
          </div>
        )}
        {restingHRRolling?.value != null && (
          <div className="flex justify-between gap-4">
            <span className="text-textTertiary">RHR (7d avg)</span>
            <span className="font-medium" style={{ color: COLORS.restingHRRolling }}>{restingHRRolling.value.toFixed(1)} bpm</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export function WellnessTrends() {
  const [fullData, setFullData] = useState<WellnessTrendsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState('3M');

  // Fetch a full year of data once, filter client-side
  useEffect(() => {
    setLoading(true);
    setError(null);
    getWellnessTrends(365).then(result => {
      if (result.success) {
        setFullData(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
  }, []);

  // Filter data by selected time range
  const filteredData = useMemo(() => {
    if (!fullData) return [];
    const days = getRangeDays(selectedRange, TIME_RANGES);
    return filterByTimeRange(fullData.dataPoints, days);
  }, [fullData, selectedRange]);

  // Compute Y-axis domains from filtered data
  const { hrvDomain, restingHRDomain } = useMemo(() => {
    const hrvValues = filteredData
      .map(d => [d.hrv, d.hrvRollingAvg])
      .flat()
      .filter((v): v is number => v !== null);

    const restingHRValues = filteredData
      .map(d => [d.restingHR, d.restingHRRollingAvg])
      .flat()
      .filter((v): v is number => v !== null);

    return {
      hrvDomain: hrvValues.length > 0
        ? [Math.floor(Math.min(...hrvValues) * 0.85), Math.ceil(Math.max(...hrvValues) * 1.1)]
        : [0, 100] as [number, number],
      restingHRDomain: restingHRValues.length > 0
        ? [Math.floor(Math.min(...restingHRValues) * 0.9), Math.ceil(Math.max(...restingHRValues) * 1.1)]
        : [30, 80] as [number, number],
    };
  }, [filteredData]);

  // Recompute summary for selected range
  const rangeSummary = useMemo(() => {
    if (!fullData) return null;

    // For the full dataset, use the pre-computed summary
    if (selectedRange === '1Y') return fullData.summary;

    // For shorter ranges, recompute from filtered data
    const withHrv = filteredData.filter(d => d.hrv !== null);
    const withRHR = filteredData.filter(d => d.restingHR !== null);

    if (withHrv.length === 0 && withRHR.length === 0) return fullData.summary;

    // Current = last rolling average
    const currentHrv = [...filteredData].reverse().find(d => d.hrvRollingAvg !== null)?.hrvRollingAvg ?? null;
    const currentRestingHR = [...filteredData].reverse().find(d => d.restingHRRollingAvg !== null)?.restingHRRollingAvg ?? null;

    // Baseline = first rolling average in this range
    const baselineHrv = filteredData.find(d => d.hrvRollingAvg !== null)?.hrvRollingAvg ?? null;
    const baselineRHR = filteredData.find(d => d.restingHRRollingAvg !== null)?.restingHRRollingAvg ?? null;

    const hrvTrendPct = currentHrv && baselineHrv && baselineHrv !== 0
      ? Math.round(((currentHrv - baselineHrv) / baselineHrv) * 1000) / 10
      : null;
    const rhrTrendPct = currentRestingHR && baselineRHR && baselineRHR !== 0
      ? Math.round(((currentRestingHR - baselineRHR) / baselineRHR) * 1000) / 10
      : null;

    const threshold = 3;
    const hrvTrend: TrendDirection = hrvTrendPct === null ? 'stable'
      : Math.abs(hrvTrendPct) < threshold ? 'stable'
      : hrvTrendPct > 0 ? 'improving' : 'declining';
    const rhrTrend: TrendDirection = rhrTrendPct === null ? 'stable'
      : Math.abs(rhrTrendPct) < threshold ? 'stable'
      : rhrTrendPct < 0 ? 'improving' : 'declining';

    return {
      ...fullData.summary,
      currentHrv,
      hrvBaseline: baselineHrv,
      hrvTrendPct,
      hrvTrend,
      currentRestingHR,
      restingHRBaseline: baselineRHR,
      restingHRTrendPct: rhrTrendPct,
      restingHRTrend: rhrTrend,
      daysWithData: withHrv.length + withRHR.length,
    };
  }, [fullData, filteredData, selectedRange]);

  // Check if there is meaningful data to show
  const hasData = filteredData.some(d => d.hrv !== null || d.restingHR !== null);

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h3 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-500" />
            HRV &amp; Wellness Trends
          </h3>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
          </div>
        </div>
      </AnimatedSection>
    );
  }

  if (error || !fullData || !hasData) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h3 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-500" />
            HRV &amp; Wellness Trends
          </h3>
          <p className="text-sm text-textTertiary">
            {error
              ? `Unable to load wellness data: ${error}`
              : 'No HRV or resting heart rate data available. Connect Intervals.icu and log wellness entries to see trends here.'}
          </p>
        </div>
      </AnimatedSection>
    );
  }

  // Generate tick positions for x-axis (evenly spaced dates)
  const tickInterval = Math.max(1, Math.floor(filteredData.length / 6));

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Header with time range selector */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-500" />
            <h3 className="font-semibold text-textPrimary">HRV &amp; Wellness Trends</h3>
          </div>
          <TimeRangeSelector
            ranges={TIME_RANGES}
            selected={selectedRange}
            onChange={setSelectedRange}
          />
        </div>

        {/* Summary Stats */}
        {rangeSummary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* Current HRV */}
            <div className="bg-bgTertiary rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Activity className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-xs text-textTertiary">Current HRV</span>
              </div>
              <div className="text-xl font-bold text-teal-400">
                {rangeSummary.currentHrv !== null ? `${rangeSummary.currentHrv.toFixed(0)}` : '--'}
              </div>
              <div className="text-[10px] text-textTertiary">ms (7d avg)</div>
            </div>

            {/* HRV Trend */}
            <div className="bg-bgTertiary rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {getTrendIcon(rangeSummary.hrvTrend)}
                <span className="text-xs text-textTertiary">HRV Trend</span>
              </div>
              <div className={`text-xl font-bold ${getTrendColor(rangeSummary.hrvTrend)}`}>
                {formatTrendPct(rangeSummary.hrvTrendPct)}
              </div>
              <div className="text-[10px] text-textTertiary">vs baseline</div>
            </div>

            {/* Current Resting HR */}
            <div className="bg-bgTertiary rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-xs text-textTertiary">Resting HR</span>
              </div>
              <div className="text-xl font-bold text-rose-400">
                {rangeSummary.currentRestingHR !== null ? `${rangeSummary.currentRestingHR.toFixed(0)}` : '--'}
              </div>
              <div className="text-[10px] text-textTertiary">bpm (7d avg)</div>
            </div>

            {/* Resting HR Trend */}
            <div className="bg-bgTertiary rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {getTrendIcon(rangeSummary.restingHRTrend)}
                <span className="text-xs text-textTertiary">RHR Trend</span>
              </div>
              <div className={`text-xl font-bold ${getTrendColor(rangeSummary.restingHRTrend)}`}>
                {formatTrendPct(rangeSummary.restingHRTrendPct)}
              </div>
              <div className="text-[10px] text-textTertiary">vs baseline</div>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="mb-3">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart
              data={filteredData}
              margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="hrvGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.hrvFill} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.hrvFill} stopOpacity={0.03} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" opacity={0.3} />

              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                tickFormatter={(val: string) => formatDate(val)}
                axisLine={{ stroke: 'var(--border-secondary)' }}
                tickLine={false}
                interval={tickInterval}
                minTickGap={35}
              />

              {/* Left Y-axis: HRV */}
              <YAxis
                yAxisId="hrv"
                orientation="left"
                domain={hrvDomain}
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
                width={40}
                label={{
                  value: 'HRV (ms)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 15,
                  style: { fontSize: 10, fill: COLORS.hrv },
                }}
              />

              {/* Right Y-axis: Resting HR */}
              <YAxis
                yAxisId="rhr"
                orientation="right"
                domain={restingHRDomain}
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
                width={40}
                label={{
                  value: 'RHR (bpm)',
                  angle: 90,
                  position: 'insideRight',
                  offset: 15,
                  style: { fontSize: 10, fill: COLORS.restingHR },
                }}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* HRV area fill */}
              <Area
                yAxisId="hrv"
                type="monotone"
                dataKey="hrv"
                stroke={COLORS.hrv}
                strokeWidth={1.5}
                fill="url(#hrvGradient)"
                dot={false}
                activeDot={{ r: 4, fill: COLORS.hrv, stroke: '#1e293b', strokeWidth: 1.5 }}
                connectNulls={false}
                isAnimationActive={false}
              />

              {/* HRV 7-day rolling average */}
              <Line
                yAxisId="hrv"
                type="monotone"
                dataKey="hrvRollingAvg"
                stroke={COLORS.hrvRolling}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />

              {/* Resting HR line */}
              <Line
                yAxisId="rhr"
                type="monotone"
                dataKey="restingHR"
                stroke={COLORS.restingHR}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: COLORS.restingHR, stroke: '#1e293b', strokeWidth: 1.5 }}
                connectNulls={false}
                isAnimationActive={false}
              />

              {/* Resting HR 7-day rolling average */}
              <Line
                yAxisId="rhr"
                type="monotone"
                dataKey="restingHRRollingAvg"
                stroke={COLORS.restingHRRolling}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS.hrv }} />
            <span className="text-textSecondary">HRV</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: COLORS.hrvRolling }} />
            <span className="text-textSecondary">HRV (7d avg)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS.restingHR }} />
            <span className="text-textSecondary">Resting HR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: COLORS.restingHRRolling }} />
            <span className="text-textSecondary">RHR (7d avg)</span>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
