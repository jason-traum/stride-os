'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { Sun, Loader2, Sparkles } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';
import { TimeRangeSelector, TIME_RANGES_EXTENDED, getRangeDays } from '@/components/shared/TimeRangeSelector';
import { getWorkoutTypeHexColor, WORKOUT_COLORS } from '@/lib/workout-colors';
import { formatPace } from '@/lib/utils';
import {
  getTimeOfDayData,
  type TimeOfDayResult,
  type TimeBucket,
  type TimeBucketStats,
} from '@/actions/time-of-day';

// ============================================================
// Constants
// ============================================================

const BUCKET_ORDER: TimeBucket[] = [
  'Early Morning',
  'Morning',
  'Mid-Morning',
  'Midday',
  'Afternoon',
  'Evening',
  'Night',
];

const BUCKET_SHORT_LABELS: Record<TimeBucket, string> = {
  'Early Morning': '5-7a',
  'Morning': '7-9a',
  'Mid-Morning': '9-11a',
  'Midday': '11a-1p',
  'Afternoon': '1-4p',
  'Evening': '4-7p',
  'Night': '7-10p',
};

const TYPE_LABELS: Record<string, string> = {
  recovery: 'Recovery',
  easy: 'Easy',
  long: 'Long',
  steady: 'Steady',
  marathon: 'Marathon',
  tempo: 'Tempo',
  threshold: 'Threshold',
  interval: 'Intervals',
  repetition: 'Reps',
  race: 'Race',
};

function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

// All types that commonly appear
const STACKED_TYPES = [
  'easy', 'long', 'recovery', 'steady', 'marathon',
  'tempo', 'threshold', 'interval', 'repetition', 'race',
];

// ============================================================
// Custom Tooltip
// ============================================================

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || !label) return null;

  // Find the pace entry
  const paceEntry = payload.find(p => p.dataKey === 'avgPaceSeconds');
  const typeEntries = payload.filter(
    p => p.dataKey !== 'avgPaceSeconds' && p.value > 0
  );
  const totalRuns = typeEntries.reduce((sum, p) => sum + (p.value || 0), 0);

  return (
    <div className="bg-bgPrimary border border-borderPrimary rounded-lg p-3 shadow-xl text-xs max-w-[200px]">
      <p className="font-semibold text-textPrimary mb-1.5">{label}</p>
      {paceEntry && paceEntry.value > 0 && (
        <p className="text-textSecondary mb-1.5">
          Avg pace: <span className="font-semibold text-dream-400">{formatPace(paceEntry.value)}/mi</span>
        </p>
      )}
      {typeEntries.map(entry => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-0.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-textSecondary truncate">{entry.name}:</span>
          <span className="text-textPrimary font-medium">{entry.value}</span>
        </div>
      ))}
      <div className="border-t border-borderSecondary mt-1.5 pt-1.5 text-textTertiary">
        Total: {totalRuns} runs
      </div>
    </div>
  );
}

// ============================================================
// Component
// ============================================================

export function TimeOfDayAnalysis() {
  const [data, setData] = useState<TimeOfDayResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1Y');

  useEffect(() => {
    setLoading(true);
    const days = getRangeDays(timeRange, TIME_RANGES_EXTENDED);
    getTimeOfDayData(days).then(result => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, [timeRange]);

  // Determine which workout types are actually present in the data
  const presentTypes = useMemo(() => {
    if (!data) return [];
    const typeSet = new Set<string>();
    for (const bucket of data.buckets) {
      for (const type of Object.keys(bucket.typeCounts)) {
        typeSet.add(type);
      }
    }
    // Return in stacked order, filtering to only present types
    return STACKED_TYPES.filter(t => typeSet.has(t));
  }, [data]);

  // Build chart data: one entry per bucket with type counts + avg pace
  const chartData = useMemo(() => {
    if (!data) return [];
    return BUCKET_ORDER.map(bucketName => {
      const bucket = data.buckets.find(b => b.bucket === bucketName);
      const entry: Record<string, string | number> = {
        bucket: BUCKET_SHORT_LABELS[bucketName],
        bucketFull: bucketName,
      };

      // Add type counts
      for (const type of presentTypes) {
        entry[type] = bucket?.typeCounts[type] || 0;
      }

      // Add pace for line
      entry.avgPaceSeconds = bucket?.avgPaceSeconds || 0;

      return entry;
    });
  }, [data, presentTypes]);

  // Pace Y-axis domain
  const paceDomain = useMemo(() => {
    if (!chartData.length) return [0, 600];
    const paces = chartData
      .map(d => d.avgPaceSeconds as number)
      .filter(p => p > 0);
    if (paces.length === 0) return [0, 600];
    const min = Math.min(...paces);
    const max = Math.max(...paces);
    const padding = Math.max((max - min) * 0.2, 10);
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData]);

  // Summary text
  const summaryText = useMemo(() => {
    if (!data || !data.peakBucket || !data.peakAvgPace) return null;

    const parts: string[] = [];

    // Peak performance
    parts.push(
      `You run fastest in the ${data.peakBucket.toLowerCase()}, averaging ${formatPace(data.peakAvgPace)}/mi.`
    );

    // Most common time for top workout types
    const topTypes = data.typeDistributions.slice(0, 3);
    for (const td of topTypes) {
      if (td.dominantPct >= 40 && td.totalCount >= 3) {
        parts.push(
          `${Math.round(td.dominantPct)}% of your ${getTypeLabel(td.workoutType).toLowerCase()} runs are in the ${td.dominantBucket.toLowerCase()}.`
        );
      }
    }

    return parts;
  }, [data]);

  // ---- Render ----

  if (loading) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Sun className="w-5 h-5 text-dream-500" />
            Time of Day Analysis
          </h2>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
          </div>
        </div>
      </AnimatedSection>
    );
  }

  if (!data || data.totalAnalyzed === 0) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Sun className="w-5 h-5 text-dream-500" />
            Time of Day Analysis
          </h2>
          <p className="text-sm text-textTertiary">
            No start time data available yet. Run the start time backfill to populate
            time-of-day data from your Strava activities.
          </p>
        </div>
      </AnimatedSection>
    );
  }

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-textPrimary flex items-center gap-2">
            <Sun className="w-5 h-5 text-dream-500" />
            Time of Day
          </h2>
          <TimeRangeSelector
            ranges={TIME_RANGES_EXTENDED}
            selected={timeRange}
            onChange={setTimeRange}
          />
        </div>

        {/* Summary */}
        {summaryText && summaryText.length > 0 && (
          <div className="mb-4 p-3 bg-bgTertiary rounded-lg">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-dream-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-textSecondary space-y-0.5">
                {summaryText.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Peak Performance Window */}
        {data.peakBucket && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide font-medium text-textTertiary">
              Peak window
            </span>
            <span className="px-2 py-0.5 bg-dream-600/20 text-dream-400 text-xs font-medium rounded-full">
              {data.peakBucket} ({BUCKET_SHORT_LABELS[data.peakBucket]})
            </span>
            {data.peakAvgPace && (
              <span className="text-xs text-textTertiary">
                avg {formatPace(data.peakAvgPace)}/mi
              </span>
            )}
          </div>
        )}

        {/* Stacked Bar Chart + Pace Line */}
        {chartData.length > 0 && (
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
              >
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-secondary)' }}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis
                  yAxisId="count"
                  tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="pace"
                  orientation="right"
                  domain={paceDomain}
                  reversed
                  tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v > 0 ? formatPace(v) : '')}
                  width={48}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                />

                {/* Stacked bars by workout type */}
                {presentTypes.map((type, i) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    name={getTypeLabel(type)}
                    stackId="types"
                    yAxisId="count"
                    fill={getWorkoutTypeHexColor(type)}
                    radius={
                      i === presentTypes.length - 1
                        ? [4, 4, 0, 0]
                        : [0, 0, 0, 0]
                    }
                  />
                ))}

                {/* Pace line overlay */}
                <Line
                  type="monotone"
                  dataKey="avgPaceSeconds"
                  name="Avg Pace"
                  yAxisId="pace"
                  stroke={WORKOUT_COLORS.threshold}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: WORKOUT_COLORS.threshold, stroke: '#1e1e2e', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: WORKOUT_COLORS.threshold, stroke: '#1e1e2e', strokeWidth: 2 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 text-xs">
              {presentTypes.map(type => (
                <div key={type} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: getWorkoutTypeHexColor(type) }}
                  />
                  <span className="text-textTertiary">{getTypeLabel(type)}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 border-t-2"
                  style={{ borderColor: WORKOUT_COLORS.threshold }}
                />
                <span className="text-textTertiary">Avg Pace</span>
              </div>
            </div>
          </div>
        )}

        {/* Bucket Detail Table */}
        {data.buckets.some(b => b.count > 0) && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wide text-textTertiary font-medium mb-2">
              By Time Slot
            </p>
            <div className="space-y-1.5">
              {data.buckets
                .filter(b => b.count > 0)
                .map(bucket => {
                  const isPeak = bucket.bucket === data.peakBucket;
                  return (
                    <div
                      key={bucket.bucket}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        isPeak ? 'bg-dream-600/10 border border-dream-600/20' : 'bg-bgTertiary'
                      }`}
                    >
                      <div className="flex-shrink-0 w-20">
                        <span className="text-xs text-textSecondary font-medium">
                          {BUCKET_SHORT_LABELS[bucket.bucket]}
                        </span>
                        {isPeak && (
                          <span className="ml-1 text-[9px] text-dream-400 font-medium">
                            PEAK
                          </span>
                        )}
                      </div>

                      {/* Mini bar showing count */}
                      <div className="flex-1">
                        <div className="h-3 rounded-full overflow-hidden flex bg-bgPrimary/50">
                          {presentTypes.map(type => {
                            const count = bucket.typeCounts[type] || 0;
                            if (count === 0) return null;
                            const pct = (count / data.totalAnalyzed) * 100;
                            return (
                              <div
                                key={type}
                                style={{
                                  width: `${Math.max(pct, 1)}%`,
                                  backgroundColor: getWorkoutTypeHexColor(type),
                                }}
                                className="h-full transition-all"
                              />
                            );
                          })}
                        </div>
                      </div>

                      <span className="text-xs text-textSecondary w-8 text-right flex-shrink-0">
                        {bucket.count}
                      </span>

                      <span className="text-xs font-mono w-14 text-right flex-shrink-0 text-textSecondary">
                        {bucket.avgPaceSeconds ? formatPace(bucket.avgPaceSeconds) : '--'}
                      </span>

                      {bucket.avgHr && (
                        <span className="text-xs font-mono w-10 text-right flex-shrink-0 text-textTertiary">
                          {bucket.avgHr} bpm
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Per-type time distribution */}
        {data.typeDistributions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-borderPrimary">
            <p className="text-[10px] uppercase tracking-wide text-textTertiary font-medium mb-2">
              Workout Type Timing
            </p>
            <div className="space-y-2">
              {data.typeDistributions.slice(0, 5).map(td => (
                <div key={td.workoutType} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                    <span
                      className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                      style={{ backgroundColor: getWorkoutTypeHexColor(td.workoutType) }}
                    />
                    <span className="text-xs text-textSecondary truncate">
                      {getTypeLabel(td.workoutType)}
                    </span>
                  </div>
                  <div className="flex-1 h-4 rounded-full overflow-hidden flex bg-bgTertiary">
                    {BUCKET_ORDER.map(bucketName => {
                      const pct = td.bucketPcts[bucketName] || 0;
                      if (pct <= 0) return null;
                      // Use a gradient approach: earlier times lighter, later darker
                      const bucketIdx = BUCKET_ORDER.indexOf(bucketName);
                      const opacity = 0.4 + (bucketIdx / BUCKET_ORDER.length) * 0.6;
                      return (
                        <div
                          key={bucketName}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: getWorkoutTypeHexColor(td.workoutType),
                            opacity,
                          }}
                          className="h-full transition-all"
                          title={`${bucketName}: ${pct}%`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs text-textTertiary w-16 text-right flex-shrink-0">
                    {td.dominantPct}% {BUCKET_SHORT_LABELS[td.dominantBucket].split('-')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-textTertiary mt-3">
          {data.totalAnalyzed} runs analyzed
        </p>
      </div>
    </AnimatedSection>
  );
}
