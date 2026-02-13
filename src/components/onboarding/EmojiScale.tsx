'use client';

interface EmojiScaleProps {
  value: number | null;
  onChange: (value: number) => void;
  label: string;
  description?: string;
}

const EMOJI_OPTIONS = [
  { value: 1, emoji: '😰', label: 'Uncomfortable' },
  { value: 2, emoji: '😕', label: 'Not great' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😍', label: 'Love it' },
];

export function EmojiScale({ value, onChange, label, description }: EmojiScaleProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-tertiary mb-2">
        {label}
      </label>
      {description && (
        <p className="text-xs text-textTertiary mb-3">{description}</p>
      )}
      <div className="flex justify-between gap-2">
        {EMOJI_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 flex flex-col items-center py-3 px-2 rounded-lg transition-all ${
              value === option.value
                ? 'bg-teal-600 border-2 border-teal-300 scale-105'
                : 'bg-stone-700 border-2 border-transparent hover:bg-stone-600'
            }`}
          >
            <span className="text-2xl mb-1">{option.emoji}</span>
            <span className={`text-[10px] ${value === option.value ? 'text-tertiary' : 'text-tertiary'}`}>
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
