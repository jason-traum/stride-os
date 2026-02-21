'use client';

import { useState, useEffect } from 'react';
import { Users, User, Loader2, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';
import {
  getTrainingPartnerData,
  type TrainingPartnerResult,
  type GroupStats,
  type TypeBreakdown,
} from '@/actions/training-partner';
import { formatPace } from '@/lib/utils';

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

/**
 * Format a pace differential in seconds to a human-readable string.
 * Negative means group is faster than solo.
 */
function formatDifferential(diffSeconds: number | null): string {
  if (diffSeconds == null) return '--';
  const abs = Math.abs(Math.round(diffSeconds));
  if (abs < 2) return 'same pace';
  const min = Math.floor(abs / 60);
  const sec = abs % 60;
  const prefix = diffSeconds < 0 ? '' : '+';
  if (min > 0) {
    return `${prefix}${diffSeconds < 0 ? '-' : ''}${min}:${sec.toString().padStart(2, '0')}/mi`;
  }
  return `${prefix}${diffSeconds < 0 ? '-' : ''}${sec}s/mi`;
}

/**
 * Stat row for the comparison cards.
 */
function StatRow({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs text-textTertiary">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-textPrimary font-mono">{value}</span>
        {subtext && <span className="text-xs text-textTertiary ml-1">{subtext}</span>}
      </div>
    </div>
  );
}

/**
 * Comparison card for solo or group stats.
 */
function StatsCard({
  title,
  icon,
  stats,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  stats: GroupStats;
  accent: string;
}) {
  return (
    <div className="bg-bgTertiary rounded-lg p-4 flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-md ${accent}`}>
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-textPrimary">{title}</h4>
          <p className="text-xs text-textTertiary">{stats.count} runs</p>
        </div>
      </div>
      <div className="divide-y divide-borderSecondary">
        <StatRow
          label="Avg Pace"
          value={stats.avgPaceSeconds ? formatPace(stats.avgPaceSeconds) : '--'}
          subtext="/mi"
        />
        <StatRow
          label="Avg Distance"
          value={stats.avgDistanceMiles > 0 ? stats.avgDistanceMiles.toFixed(1) : '--'}
          subtext="mi"
        />
        {stats.avgHr && (
          <StatRow
            label="Avg HR"
            value={stats.avgHr.toString()}
            subtext="bpm"
          />
        )}
        {stats.avgRpe && (
          <StatRow
            label="Avg RPE"
            value={stats.avgRpe.toString()}
            subtext="/10"
          />
        )}
        {stats.avgMood && (
          <StatRow
            label="Avg Mood"
            value={stats.avgMood.toString()}
            subtext="/10"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Generate the headline summary text.
 */
function getSummaryText(data: TrainingPartnerResult): string {
  if (!data.hasEnoughGroupData) {
    return 'Not enough group runs to draw conclusions yet.';
  }

  const diff = data.paceDifferentialSeconds;
  if (diff == null) return 'Unable to compare paces between solo and group runs.';

  const abs = Math.abs(Math.round(diff));
  if (abs < 3) {
    return 'You run at similar paces solo and with partners.';
  }

  const fasterOn = diff < 0 ? 'group' : 'solo';
  const sec = abs;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  const timeStr = min > 0
    ? `${min}:${remSec.toString().padStart(2, '0')}/mi`
    : `${sec}s/mi`;

  return `Your average pace is ${timeStr} faster on ${fasterOn} runs.`;
}

/**
 * Differential arrow/icon for the type breakdown.
 */
function DiffIndicator({ diff }: { diff: number | null }) {
  if (diff == null) return <Minus className="w-3.5 h-3.5 text-textTertiary" />;
  const abs = Math.abs(Math.round(diff));
  if (abs < 3) return <Minus className="w-3.5 h-3.5 text-textTertiary" />;
  if (diff < 0) return <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />; // group faster = good
  return <ArrowUp className="w-3.5 h-3.5 text-rose-400" />; // group slower
}

export function TrainingPartnerEffectCard() {
  const [data, setData] = useState<TrainingPartnerResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTrainingPartnerData().then(result => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-dream-500" />
            Training Partner Effect
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
            <Users className="w-5 h-5 text-dream-500" />
            Training Partner Effect
          </h2>
          <p className="text-sm text-textTertiary">
            No workouts with athlete count data. This requires Strava activities with group run information.
          </p>
        </div>
      </AnimatedSection>
    );
  }

  const summaryText = getSummaryText(data);
  const diff = data.paceDifferentialSeconds;
  const absDiff = diff != null ? Math.abs(Math.round(diff)) : 0;
  const fasterOnGroup = diff != null && diff < 0;

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-dream-500" />
          <h3 className="font-semibold text-primary">Training Partner Effect</h3>
        </div>

        {/* Summary headline with pace differential */}
        <div className="mb-4 p-3 bg-bgTertiary rounded-lg">
          {data.hasEnoughGroupData && diff != null && absDiff >= 3 ? (
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-bold font-mono ${fasterOnGroup ? 'text-emerald-400' : 'text-sky-400'}`}>
                {formatDifferential(diff)}
              </div>
              <p className="text-sm text-textSecondary flex-1">{summaryText}</p>
            </div>
          ) : (
            <p className="text-sm text-textSecondary">{summaryText}</p>
          )}
          <p className="text-xs text-textTertiary mt-1.5">
            {data.totalAnalyzed} runs analyzed ({data.solo.count} solo, {data.group.count} group)
          </p>
        </div>

        {/* Side-by-side comparison cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <StatsCard
            title="Solo"
            icon={<User className="w-4 h-4 text-sky-400" />}
            stats={data.solo}
            accent="bg-sky-500/10"
          />
          <StatsCard
            title="Group"
            icon={<Users className="w-4 h-4 text-dream-400" />}
            stats={data.group}
            accent="bg-dream-500/10"
          />
        </div>

        {/* Per-type breakdown */}
        {data.typeBreakdowns.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-2">By Workout Type</h4>
            <div className="space-y-1.5">
              {data.typeBreakdowns.map(tb => {
                const diffSec = tb.paceDifferentialSeconds;
                const absDiffSec = diffSec != null ? Math.abs(Math.round(diffSec)) : 0;
                const diffColor = diffSec == null || absDiffSec < 3
                  ? 'text-textTertiary'
                  : diffSec < 0
                    ? 'text-emerald-400'
                    : 'text-rose-400';

                return (
                  <div key={tb.workoutType} className="flex items-center gap-3 py-1">
                    <span className="text-xs text-textSecondary w-20 flex-shrink-0">
                      {getTypeLabel(tb.workoutType)}
                    </span>
                    {/* Solo / Group counts */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-sky-400" />
                        <span className="text-xs text-textTertiary">{tb.solo.count}</span>
                      </div>
                      <span className="text-xs text-textTertiary">/</span>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-dream-400" />
                        <span className="text-xs text-textTertiary">{tb.group.count}</span>
                      </div>
                    </div>
                    {/* Solo pace -> Group pace */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-textSecondary">
                        {tb.solo.avgPaceSeconds ? formatPace(tb.solo.avgPaceSeconds) : '--'}
                      </span>
                      <DiffIndicator diff={diffSec} />
                      <span className="text-xs font-mono text-textSecondary">
                        {tb.group.avgPaceSeconds ? formatPace(tb.group.avgPaceSeconds) : '--'}
                      </span>
                    </div>
                    {/* Differential */}
                    <span className={`text-xs font-mono w-16 text-right flex-shrink-0 ${diffColor}`}>
                      {diffSec != null && absDiffSec >= 3 ? formatDifferential(diffSec) : '--'}
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
