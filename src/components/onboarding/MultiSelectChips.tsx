'use client';

interface MultiSelectChipsProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
  description?: string;
  maxSelections?: number;
}

export function MultiSelectChips({
  options,
  selected,
  onChange,
  label,
  description,
  maxSelections,
}: MultiSelectChipsProps) {
  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else if (!maxSelections || selected.length < maxSelections) {
      onChange([...selected, value]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-tertiary mb-2">
        {label}
      </label>
      {description && (
        <p className="text-xs text-textTertiary mb-3">{description}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          const isDisabled = !isSelected && !!maxSelections && selected.length >= maxSelections;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToggle(option.value)}
              disabled={isDisabled}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-teal-600 text-white border-2 border-teal-300'
                  : isDisabled
                  ? 'bg-stone-800 text-textTertiary cursor-not-allowed border-2 border-transparent'
                  : 'bg-stone-700 text-tertiary hover:bg-stone-600 border-2 border-transparent'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {maxSelections && (
        <p className="text-xs text-textTertiary mt-2">
          Select up to {maxSelections} ({selected.length}/{maxSelections})
        </p>
      )}
    </div>
  );
}
