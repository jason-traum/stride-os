'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GitBranch, Loader2, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';
import {
  getSplitTendencyData,
  type SplitTendencyResult,
  type SplitTypeSummary,
} from '@/actions/split-tendency';

// Time range options
const TIME_RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
] as const;

// Colors for split types
const SPLIT_COLORS = {
  negative_split: '#22c55e', // green-500 — good pacing
  even_split: '#38bdf8',     // sky-400 — neutral
  positive_split: '#f87171', // red-400 — went out too fast
};

// Workout type labels
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
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
  return labels[type] || type;
}

// Custom tooltip for the stacked bar chart
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || !label) return null;
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div className="bg-bgPrimary border border-borderPrimary rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold text-textPrimary mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-textSecondary">{entry.name}:</span>
          <span className="text-textPrimary font-medium">{entry.value}</span>
          <span className="text-textTertiary">({total > 0 ? Math.round((entry.value / total) * 100) : 0}%)</span>
        </div>
      ))}
      <div className="border-t border-borderSecondary mt-1.5 pt-1.5 text-textTertiary">
        Total: {total} workouts
      </div>
    </div>
  );
}

/**
 * Generate coaching insight for a specific workout type
 */
function getTypeInsight(summary: SplitTypeSummary): string | null {
  const { workoutType, positiveCount, negativeCount, evenCount, avgDifferential, totalCount } = summary;
  if (totalCount < 2) return null;

  const label = getTypeLabel(workoutType).toLowerCase();
  const posPct = Math.round((positiveCount / totalCount) * 100);
  const negPct = Math.round((negativeCount / totalCount) * 100);
  const absDiff = Math.abs(avgDifferential);

  if (posPct >= 60 && absDiff >= 5) {
    return `You tend to go out too fast on ${label} runs — try starting ${absDiff}s/mi slower.`;
  }
  if (negPct >= 60) {
    return `Great pacing on ${label} runs — you consistently run negative splits.`;
  }
  if (posPct >= 40 && negPct >= 40) {
    return `Your ${label} pacing is inconsistent — about equal positive and negative splits.`;
  }
  return null;
}

export function SplitTendencyCard() {
  const [data, setData] = useState<SplitTendencyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(365);

  useEffect(() => {
    setLoading(true);
    getSplitTendencyData(selectedDays).then(result => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, [selectedDays]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.summaryByType
      .filter(s => s.totalCount >= 2)
      .map(s => ({
        type: getTypeLabel(s.workoutType),
        'Negative Split': s.negativeCount,
        'Even Split': s.evenCount,
        'Positive Split': s.positiveCount,
      }));
  }, [data]);

  // Generate insights
  const insights = useMemo(() => {
    if (!data) return [];
    return data.summaryByType
      .map(getTypeInsight)
      .filter((i): i is string => i !== null);
  }, [data]);

  // Worst offender type (highest avg positive differential)
  const worstType = useMemo(() => {
    if (!data || data.summaryByType.length === 0) return null;
    const positiveTypes = data.summaryByType.filter(s => s.avgDifferential > 5 && s.totalCount >= 2);
    if (positiveTypes.length === 0) return null;
    return positiveTypes.sort((a, b) => b.avgDifferential - a.avgDifferential)[0];
  }, [data]);

  if (loading) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-dream-500" />
            Split Tendency
          </h2>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
          </div>
        </div>
      </AnimatedSection>
    );
  }

  if (!data || data.totalAnalyzed === 0) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-dream-500" />
            Split Tendency
          </h2>
          <p className="text-sm text-textTertiary">Not enough segment data yet. Workouts need 3+ segments and &gt; 2 miles to analyze pacing splits.</p>
        </div>
      </AnimatedSection>
    );
  }

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Header with time range selector */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-dream-500" />
            <h3 className="font-semibold text-primary">Split Tendency</h3>
          </div>
          <div className="flex gap-1">
            {TIME_RANGES.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => setSelectedDays(days)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  selectedDays === days
                    ? 'bg-dream-600 text-white'
                    : 'bg-bgTertiary text-textTertiary hover:text-textSecondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary headline */}
        <div className="mb-4 p-3 bg-bgTertiary rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            {data.overallNegativePct >= data.overallPositivePct ? (
              <TrendingDown className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingUp className="w-4 h-4 text-rose-400" />
            )}
            <span className="text-sm font-medium text-textPrimary">
              {data.totalAnalyzed} workouts analyzed
            </span>
          </div>
          <p className="text-sm text-textSecondary">
            You run negative splits <span className="font-semibold text-emerald-400">{data.overallNegativePct}%</span> of the time
            {data.overallPositivePct > 0 && (
              <>, positive splits <span className="font-semibold text-rose-400">{data.overallPositivePct}%</span></>
            )}
            {data.overallEvenPct > 0 && (
              <>, even splits <span className="font-semibold text-sky-400">{data.overallEvenPct}%</span></>
            )}
            .
            {worstType && (
              <> On {getTypeLabel(worstType.workoutType).toLowerCase()} runs, you tend to go out <span className="font-semibold text-rose-400">{Math.abs(worstType.avgDifferential)}s/mi</span> too fast.</>
            )}
          </p>
        </div>

        {/* Stacked Bar Chart */}
        {chartData.length > 0 && (
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="25%">
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="Negative Split" stackId="splits" fill={SPLIT_COLORS.negative_split} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Even Split" stackId="splits" fill={SPLIT_COLORS.even_split} />
                <Bar dataKey="Positive Split" stackId="splits" fill={SPLIT_COLORS.positive_split} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SPLIT_COLORS.negative_split }} />
                <span className="text-xs text-textTertiary">Negative</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SPLIT_COLORS.even_split }} />
                <span className="text-xs text-textTertiary">Even</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SPLIT_COLORS.positive_split }} />
                <span className="text-xs text-textTertiary">Positive</span>
              </div>
            </div>
          </div>
        )}

        {/* Per-type insights */}
        {insights.length > 0 && (
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-bgTertiary rounded-lg">
                <Info className="w-4 h-4 text-dream-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-textSecondary">{insight}</p>
              </div>
            ))}
          </div>
        )}

        {/* Per-type breakdown table */}
        {data.summaryByType.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-2">By Workout Type</h4>
            <div className="space-y-1.5">
              {data.summaryByType.map(summary => {
                const total = summary.totalCount;
                const negPct = total > 0 ? (summary.negativeCount / total) * 100 : 0;
                const evenPct = total > 0 ? (summary.evenCount / total) * 100 : 0;
                const posPct = total > 0 ? (summary.positiveCount / total) * 100 : 0;
                const diffLabel = summary.avgDifferential > 0
                  ? `+${summary.avgDifferential}s/mi`
                  : `${summary.avgDifferential}s/mi`;

                return (
                  <div key={summary.workoutType} className="flex items-center gap-3">
                    <span className="text-xs text-textSecondary w-20 flex-shrink-0">{getTypeLabel(summary.workoutType)}</span>
                    <div className="flex-1 h-4 rounded-full overflow-hidden flex bg-bgTertiary">
                      {negPct > 0 && (
                        <div
                          style={{ width: `${negPct}%`, backgroundColor: SPLIT_COLORS.negative_split }}
                          className="h-full transition-all"
                        />
                      )}
                      {evenPct > 0 && (
                        <div
                          style={{ width: `${evenPct}%`, backgroundColor: SPLIT_COLORS.even_split }}
                          className="h-full transition-all"
                        />
                      )}
                      {posPct > 0 && (
                        <div
                          style={{ width: `${posPct}%`, backgroundColor: SPLIT_COLORS.positive_split }}
                          className="h-full transition-all"
                        />
                      )}
                    </div>
                    <span className={`text-xs font-mono w-16 text-right flex-shrink-0 ${
                      summary.avgDifferential > 5 ? 'text-rose-400' :
                      summary.avgDifferential < -5 ? 'text-emerald-400' :
                      'text-textTertiary'
                    }`}>
                      {diffLabel}
                    </span>
                    <span className="text-xs text-textTertiary w-6 text-right flex-shrink-0">{total}</span>
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
