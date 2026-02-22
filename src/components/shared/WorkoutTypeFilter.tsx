'use client';

import { getWorkoutTypeHexColor } from '@/lib/workout-colors';

interface WorkoutTypeFilterProps {
  available: string[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  size?: 'xs' | 'sm';
}

const TYPE_LABELS: Record<string, string> = {
  recovery: 'Recovery',
  easy: 'Easy',
  steady: 'Steady',
  marathon: 'Marathon',
  tempo: 'Tempo',
  threshold: 'Threshold',
  interval: 'Interval',
  repetition: 'Repetition',
  long: 'Long',
  race: 'Race',
  cross_train: 'Cross Train',
  other: 'Other',
};

export function WorkoutTypeFilter({
  available,
  selected,
  onChange,
  size = 'sm',
}: WorkoutTypeFilterProps) {
  const allSelected = available.length > 0 && available.every(t => selected.has(t));

  const toggleType = (type: string) => {
    const next = new Set(selected);
    if (next.has(type)) {
      // Don't allow deselecting the last type
      if (next.size > 1) next.delete(type);
    } else {
      next.add(type);
    }
    onChange(next);
  };

  const selectAll = () => {
    onChange(new Set(available));
  };

  const pill = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={selectAll}
        className={`${pill} rounded font-medium transition-colors ${
          allSelected
            ? 'bg-accent-dream text-white'
            : 'bg-bgTertiary text-textTertiary hover:text-textSecondary'
        }`}
      >
        All
      </button>
      {available.map(type => {
        const active = selected.has(type);
        return (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`${pill} rounded font-medium transition-colors capitalize ${
              active ? 'text-white' : 'bg-bgTertiary text-textTertiary hover:text-textSecondary'
            }`}
            style={active ? { backgroundColor: getWorkoutTypeHexColor(type) } : undefined}
          >
            {TYPE_LABELS[type] || type}
          </button>
        );
      })}
    </div>
  );
}
