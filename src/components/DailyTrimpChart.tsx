'use client';

import { useMemo, useState } from 'react';
import { cn, parseLocalDate } from '@/lib/utils';
import type { DailyTrimpEntry } from '@/actions/fitness';

interface DailyTrimpChartProps {
  entries: DailyTrimpEntry[];
}

const typeColors: Record<string, string> = {
  recovery: 'bg-slate-500',
  easy: 'bg-sky-500',
  long: 'bg-dream-600',
  steady: 'bg-sky-600',
  tempo: 'bg-indigo-600',
  threshold: 'bg-violet-600',
  interval: 'bg-red-600',
  race: 'bg-amber-600',
  cross_train: 'bg-violet-500',
  other: 'bg-stone-500',
};

function getTypeColor(type: string | null): string {
  if (!type) return 'bg-stone-600';
  return typeColors[type] || typeColors.other;
}

function getTypeLabel(type: string | null): string {
  if (!type) return 'Rest';
  const labels: Record<string, string> = {
    recovery: 'Recovery',
    easy: 'Easy',
    long: 'Long',
    steady: 'Steady',
    tempo: 'Tempo',
    threshold: 'Threshold',
    interval: 'Interval',
    race: 'Race',
    cross_train: 'Cross Train',
    other: 'Other',
  };
  return labels[type] || type;
}

export function DailyTrimpChart({ entries }: DailyTrimpChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { maxTrimp, weekLabels } = useMemo(() => {
    const max = Math.max(...entries.map(e => e.trimp), 1);
    // Generate week start labels
    const labels: { index: number; label: string }[] = [];
    for (let i = 0; i < entries.length; i += 7) {
      const date = parseLocalDate(entries[i].date);
      labels.push({
        index: i,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    return { maxTrimp: max, weekLabels: labels };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <h3 className="font-semibold text-textPrimary mb-2 text-sm">Daily Training Load</h3>
        <p className="text-xs text-textTertiary">No workout data for the last 4 weeks.</p>
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="font-semibold text-textPrimary text-sm">Daily Training Load</h3>
        <p className="text-[10px] text-textTertiary mt-0.5">
          TRIMP (training impulse) per day &middot; Last 4 weeks
        </p>
      </div>

      {/* Bar chart */}
      <div className="relative">
        <div className="flex items-end gap-[2px] h-32" onMouseLeave={() => setHoveredIndex(null)}>
          {entries.map((entry, i) => {
            const heightPct = maxTrimp > 0 ? (entry.trimp / maxTrimp) * 100 : 0;
            const isRest = entry.trimp === 0;
            const isHovered = hoveredIndex === i;
            const dayOfWeek = parseLocalDate(entry.date).getDay();
            const isMonday = dayOfWeek === 1;

            return (
              <div
                key={entry.date}
                className={cn(
                  'relative flex-1 min-w-0 cursor-crosshair',
                  isMonday && i > 0 && 'ml-1',
                )}
                onMouseEnter={() => setHoveredIndex(i)}
              >
                <div className="flex flex-col items-center justify-end h-32">
                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-all duration-150',
                      isRest ? 'bg-bgTertiary' : getTypeColor(entry.workoutType),
                      isHovered && !isRest && 'opacity-80 ring-1 ring-white/30',
                      isHovered && isRest && 'bg-bgInteractive-hover',
                    )}
                    style={{
                      height: isRest ? '2px' : `${Math.max(heightPct, 3)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Week labels below chart */}
        <div className="flex mt-1.5">
          {weekLabels.map((wl) => (
            <div
              key={wl.index}
              className="text-[9px] text-textTertiary"
              style={{
                position: 'relative',
                left: `${(wl.index / entries.length) * 100}%`,
                width: `${(7 / entries.length) * 100}%`,
              }}
            >
              {wl.label}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {hoveredIndex !== null && entries[hoveredIndex] && (
          <div
            className="absolute bg-surface-1 border border-default text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none z-10"
            style={{
              left: `${(hoveredIndex / entries.length) * 100}%`,
              top: '-4px',
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-medium text-textPrimary">
              {parseLocalDate(entries[hoveredIndex].date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div className="text-textSecondary mt-0.5">
              {entries[hoveredIndex].trimp > 0 ? (
                <>
                  <span className="font-medium">{entries[hoveredIndex].trimp}</span> TRIMP
                  {entries[hoveredIndex].workoutType && (
                    <span className="text-textTertiary"> &middot; {getTypeLabel(entries[hoveredIndex].workoutType)}</span>
                  )}
                </>
              ) : (
                <span className="text-textTertiary">Rest day</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3">
        {Object.entries(typeColors).slice(0, 6).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className={cn('w-2 h-2 rounded-sm', color)} />
            <span className="text-[9px] text-textTertiary capitalize">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
