'use client';

import { useState, useEffect } from 'react';
import { Shuffle, Loader2, Lightbulb, Trophy, Zap, Route, Timer, Flag } from 'lucide-react';
import {
  getShoeRotation,
  type ShoeRotationData,
  type ShoeRotationRow,
  type TypePreference,
} from '@/actions/shoe-rotation';
import { cn } from '@/lib/utils';
import { AnimatedSection } from '@/components/AnimatedSection';

type TypeGroup = 'easy' | 'tempo' | 'interval' | 'long' | 'race';

const TYPE_GROUP_LABELS: Record<TypeGroup, string> = {
  easy: 'Easy',
  tempo: 'Tempo',
  interval: 'Interval',
  long: 'Long',
  race: 'Race',
};

const TYPE_ICONS: Record<TypeGroup, typeof Zap> = {
  easy: Route,
  tempo: Timer,
  interval: Zap,
  long: Route,
  race: Flag,
};

const ROLE_COLORS: Record<string, string> = {
  'Daily Trainer': 'bg-sky-900/30 text-sky-300 border-sky-700/40',
  'Tempo Shoe': 'bg-violet-900/30 text-violet-300 border-violet-700/40',
  'Speed Work': 'bg-rose-900/30 text-rose-300 border-rose-700/40',
  'Long Run': 'bg-teal-900/30 text-teal-300 border-teal-700/40',
  'Race Day': 'bg-amber-900/30 text-amber-300 border-amber-700/40',
  'Mixed Use': 'bg-slate-800/40 text-slate-300 border-slate-700/40',
};

/**
 * Returns a heatmap intensity class for a cell based on its percentage.
 * Darker = more runs of that type use this shoe.
 */
function heatColor(percentage: number): string {
  if (percentage === 0) return 'bg-bgTertiary/30 text-textTertiary/50';
  if (percentage < 20) return 'bg-dream-900/20 text-dream-400/70';
  if (percentage < 40) return 'bg-dream-900/30 text-dream-400/80';
  if (percentage < 60) return 'bg-dream-800/40 text-dream-300';
  if (percentage < 80) return 'bg-dream-700/40 text-dream-200';
  return 'bg-dream-600/50 text-dream-100 font-medium';
}

function RotationScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (score / 100) * circumference;

  const scoreColor =
    score >= 70 ? 'text-emerald-400' :
    score >= 40 ? 'text-amber-400' :
    'text-red-400';

  const strokeColor =
    score >= 70 ? 'stroke-emerald-500' :
    score >= 40 ? 'stroke-amber-500' :
    'stroke-red-500';

  const scoreLabel =
    score >= 70 ? 'Great' :
    score >= 40 ? 'Fair' :
    'Low';

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
          <circle
            cx="24" cy="24" r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-bgTertiary"
          />
          <circle
            cx="24" cy="24" r="20"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className={strokeColor}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-sm font-bold tabular-nums', scoreColor)}>{score}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-textPrimary">Rotation Score</p>
        <p className={cn('text-xs font-medium', scoreColor)}>{scoreLabel}</p>
      </div>
    </div>
  );
}

function HeatmapMatrix({ rows }: { rows: ShoeRotationRow[] }) {
  const types: TypeGroup[] = ['easy', 'tempo', 'interval', 'long', 'race'];
  // Only show columns that have at least one workout
  const activeTypes = types.filter(t =>
    rows.some(r => r.cells[t].count > 0)
  );

  if (activeTypes.length === 0) return null;

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left py-2 pr-3 text-textTertiary font-medium whitespace-nowrap">Shoe</th>
            {activeTypes.map(t => (
              <th key={t} className="text-center py-2 px-1.5 text-textTertiary font-medium whitespace-nowrap">
                {TYPE_GROUP_LABELS[t]}
              </th>
            ))}
            <th className="text-center py-2 pl-3 text-textTertiary font-medium whitespace-nowrap">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borderPrimary/50">
          {rows.map(row => (
            <tr key={row.shoeId}>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    'truncate text-textPrimary max-w-[120px] sm:max-w-[160px]',
                    row.isRetired && 'text-textTertiary line-through',
                  )}>
                    {row.shoeName}
                  </span>
                </div>
              </td>
              {activeTypes.map(t => {
                const cell = row.cells[t];
                return (
                  <td key={t} className="py-2 px-1.5 text-center">
                    <div
                      className={cn(
                        'inline-flex items-center justify-center w-10 h-7 rounded-md text-[11px] tabular-nums',
                        heatColor(cell.percentage),
                      )}
                      title={`${cell.count} workouts (${cell.percentage}% of ${TYPE_GROUP_LABELS[t]} runs)`}
                    >
                      {cell.count > 0 ? cell.count : '\u2014'}
                    </div>
                  </td>
                );
              })}
              <td className="py-2 pl-3 text-center">
                <span className="text-textSecondary font-medium tabular-nums">
                  {row.totalWorkouts}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleBadges({ rows }: { rows: ShoeRotationRow[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map(row => {
        const colorClass = ROLE_COLORS[row.roleBadge] || ROLE_COLORS['Mixed Use'];
        return (
          <div
            key={row.shoeId}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border',
              colorClass,
            )}
          >
            {row.primaryRole && (() => {
              const Icon = TYPE_ICONS[row.primaryRole];
              return <Icon className="w-3 h-3" />;
            })()}
            <span className="truncate max-w-[100px]">{row.shoeName}</span>
            <span className="opacity-60">{row.roleBadge}</span>
          </div>
        );
      })}
    </div>
  );
}

function InsightsList({ insights }: { insights: { text: string }[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-textTertiary uppercase tracking-wide flex items-center gap-1.5">
        <Lightbulb className="w-3.5 h-3.5" />
        Insights
      </h3>
      <ul className="space-y-1.5">
        {insights.map((insight, i) => (
          <li key={i} className="text-sm text-textSecondary leading-relaxed pl-4 relative">
            <span className="absolute left-0 top-[7px] w-1.5 h-1.5 rounded-full bg-dream-500/60" />
            {insight.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TypePreferenceList({ preferences }: { preferences: TypePreference[] }) {
  if (preferences.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-textTertiary uppercase tracking-wide flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5" />
        Go-To Shoes by Type
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {preferences.map(pref => {
          const Icon = TYPE_ICONS[pref.type];
          return (
            <div
              key={pref.type}
              className="bg-bgTertiary/50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Icon className="w-3 h-3 text-textTertiary" />
                <span className="text-[11px] text-textTertiary font-medium">{pref.label}</span>
              </div>
              <p className="text-xs text-textPrimary font-medium truncate">
                {pref.preferredShoeName ?? 'None'}
              </p>
              <p className="text-[10px] text-textTertiary">
                {pref.totalWorkouts} {pref.totalWorkouts === 1 ? 'run' : 'runs'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ShoeRotation() {
  const [data, setData] = useState<ShoeRotationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getShoeRotation().then(result => {
      if (result.success) {
        setData(result.data);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <Shuffle className="w-5 h-5 text-dream-500" />
          Shoe Rotation
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
        </div>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <Shuffle className="w-5 h-5 text-dream-500" />
          Shoe Rotation
        </h2>
        <p className="text-sm text-textTertiary text-center py-4">
          No shoe usage data yet. Assign shoes to workouts or sync from Strava.
        </p>
      </div>
    );
  }

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-textPrimary flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-dream-500" />
            Shoe Rotation
          </h2>
          <span className="text-xs text-textTertiary">
            {data.totalWorkoutsAnalyzed} runs analyzed
          </span>
        </div>

        {/* Score + Stats */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-borderPrimary">
          <RotationScoreRing score={data.rotationScore} />
          <div className="text-right space-y-1">
            <div>
              <span className="text-lg font-semibold text-textPrimary tabular-nums">
                {data.avgShoesPerWeek}
              </span>
              <span className="text-xs text-textTertiary ml-1">shoes/week</span>
            </div>
            <div>
              <span className="text-sm font-medium text-textSecondary tabular-nums">
                {data.rows.length}
              </span>
              <span className="text-xs text-textTertiary ml-1">shoes tracked</span>
            </div>
          </div>
        </div>

        {/* Role badges */}
        <div className="mb-5">
          <RoleBadges rows={data.rows} />
        </div>

        {/* Heatmap matrix */}
        <div className="mb-5">
          <h3 className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-2">
            Usage Matrix
          </h3>
          <HeatmapMatrix rows={data.rows} />
          <p className="text-[10px] text-textTertiary mt-1.5">
            Darker cells = higher percentage of that workout type
          </p>
        </div>

        {/* Go-to shoes by type */}
        <div className="mb-5">
          <TypePreferenceList preferences={data.typePreferences} />
        </div>

        {/* Insights */}
        {data.insights.length > 0 && (
          <div className="pt-4 border-t border-borderPrimary">
            <InsightsList insights={data.insights} />
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
