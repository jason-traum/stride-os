'use client';

import { cn } from '@/lib/utils';

export interface TimeRangeOption {
  label: string;
  days: number;
}

export const TIME_RANGES_SHORT: TimeRangeOption[] = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

export const TIME_RANGES_EXTENDED: TimeRangeOption[] = [
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '3Y', days: 1095 },
];

interface TimeRangeSelectorProps {
  ranges?: TimeRangeOption[];
  selected: string;
  onChange: (label: string) => void;
  size?: 'sm' | 'xs';
}

export function TimeRangeSelector({
  ranges = TIME_RANGES_SHORT,
  selected,
  onChange,
  size = 'sm',
}: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1">
      {ranges.map(r => (
        <button
          key={r.label}
          onClick={() => onChange(r.label)}
          className={cn(
            'font-medium rounded transition-colors',
            size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
            selected === r.label
              ? 'bg-accent-dream text-white'
              : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** Get the number of days for a given range label */
export function getRangeDays(label: string, ranges: TimeRangeOption[] = TIME_RANGES_SHORT): number {
  return ranges.find(r => r.label === label)?.days ?? 90;
}

/** Filter date-keyed data by a day count cutoff */
export function filterByTimeRange<T extends { date: string }>(data: T[], days: number): T[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return data.filter(d => d.date >= cutoffStr);
}
