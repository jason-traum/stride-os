'use client';

interface InjurySelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
  description?: string;
}

const INJURY_OPTIONS = [
  { value: 'shin_splints', label: 'Shin Splints', icon: '' },
  { value: 'it_band', label: 'IT Band', icon: '' },
  { value: 'plantar_fasciitis', label: 'Plantar Fasciitis', icon: '' },
  { value: 'achilles', label: 'Achilles', icon: '' },
  { value: 'knee', label: 'Knee Issues', icon: '' },
  { value: 'hip', label: 'Hip Issues', icon: '' },
  { value: 'none', label: 'No Injuries', icon: '' },
];

export function InjurySelector({
  selected,
  onChange,
  label,
  description,
}: InjurySelectorProps) {
  const handleToggle = (value: string) => {
    // If "none" is selected, clear all others
    if (value === 'none') {
      if (selected.includes('none')) {
        onChange([]);
      } else {
        onChange(['none']);
      }
      return;
    }

    // If selecting an injury, remove "none" if present
    let newSelected = selected.filter((v) => v !== 'none');

    if (newSelected.includes(value)) {
      newSelected = newSelected.filter((v) => v !== value);
    } else {
      newSelected = [...newSelected, value];
    }

    onChange(newSelected);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-tertiary mb-2">
        {label}
      </label>
      {description && (
        <p className="text-xs text-textTertiary mb-3">{description}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {INJURY_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.value);
          const isDisabled = option.value !== 'none' && selected.includes('none');

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToggle(option.value)}
              disabled={isDisabled}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                isSelected
                  ? option.value === 'none'
                    ? 'bg-green-600 text-white border-2 border-green-400'
                    : 'bg-rose-400 text-white border-2 border-rose-300'
                  : isDisabled
                  ? 'bg-surface-0 text-disabled cursor-not-allowed border-2 border-transparent'
                  : 'bg-surface-2 text-secondary hover:bg-surface-3 border-2 border-transparent'
              }`}
            >
              <span className="text-lg">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
