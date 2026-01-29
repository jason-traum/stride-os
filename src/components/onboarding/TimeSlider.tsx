'use client';

interface TimeSliderProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  description?: string;
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
}

export function TimeSlider({
  value,
  onChange,
  label,
  description,
  min,
  max,
  step = 15,
  formatValue,
}: TimeSliderProps) {
  const formatDefault = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (remainingMins === 0) return `${hours}h`;
    return `${hours}h ${remainingMins}m`;
  };

  const format = formatValue || formatDefault;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      {description && (
        <p className="text-xs text-slate-500 mb-2">{description}</p>
      )}
      <div className="flex items-center space-x-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <span className="w-16 text-right text-white font-medium text-sm">
          {format(value)}
        </span>
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
