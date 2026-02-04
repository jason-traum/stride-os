/**
 * Centralized Workout Color System
 *
 * All workout type colors should be imported from here to ensure consistency.
 *
 * Color Palette:
 * - Easy/Recovery: Teal (soft, calming)
 * - Long: Teal-400 (slightly deeper)
 * - Tempo: Rose (moderate intensity)
 * - Threshold: Rose-500 (harder tempo)
 * - Interval: Fuchsia (high intensity)
 * - Race: Purple (peak performance)
 * - Steady: Slate (neutral)
 * - Cross-train: Pink (different activity)
 */

// Tailwind CSS class mappings for backgrounds
export const workoutTypeBgColors: Record<string, string> = {
  easy: 'bg-teal-300',
  recovery: 'bg-cyan-300',
  long: 'bg-teal-400',
  tempo: 'bg-rose-400',
  threshold: 'bg-rose-500',
  interval: 'bg-fuchsia-500',
  race: 'bg-purple-500',
  steady: 'bg-slate-400',
  cross_train: 'bg-pink-400',
  other: 'bg-stone-400',
};

// Tailwind CSS class mappings for light backgrounds (cards, badges)
export const workoutTypeBgLightColors: Record<string, string> = {
  easy: 'bg-teal-50',
  recovery: 'bg-cyan-50',
  long: 'bg-teal-100',
  tempo: 'bg-rose-50',
  threshold: 'bg-rose-100',
  interval: 'bg-fuchsia-50',
  race: 'bg-purple-50',
  steady: 'bg-slate-50',
  cross_train: 'bg-pink-50',
  other: 'bg-stone-50',
};

// Tailwind CSS class mappings for text colors
export const workoutTypeTextColors: Record<string, string> = {
  easy: 'text-teal-700',
  recovery: 'text-cyan-700',
  long: 'text-teal-800',
  tempo: 'text-rose-700',
  threshold: 'text-rose-800',
  interval: 'text-fuchsia-700',
  race: 'text-purple-700',
  steady: 'text-slate-700',
  cross_train: 'text-pink-700',
  other: 'text-stone-700',
};

// Hex colors for charts (SVG, canvas, etc.)
export const workoutTypeHexColors: Record<string, string> = {
  easy: '#5eead4',       // teal-300
  recovery: '#67e8f9',   // cyan-300
  long: '#2dd4bf',       // teal-400
  tempo: '#fb7185',      // rose-400
  threshold: '#f43f5e',  // rose-500
  interval: '#d946ef',   // fuchsia-500
  race: '#a855f7',       // purple-500
  steady: '#94a3b8',     // slate-400
  cross_train: '#f472b6', // pink-400
  other: '#a8a29e',      // stone-400
};

// HSL colors for ActivityHeatmap and other components needing HSL
export const workoutTypeHslColors: Record<string, { h: number; s: number; l: number }> = {
  easy: { h: 168, s: 76, l: 63 },      // teal-300
  recovery: { h: 188, s: 86, l: 69 },  // cyan-300
  long: { h: 166, s: 72, l: 50 },      // teal-400
  tempo: { h: 351, s: 95, l: 72 },     // rose-400
  threshold: { h: 350, s: 89, l: 60 }, // rose-500
  interval: { h: 292, s: 84, l: 58 },  // fuchsia-500
  race: { h: 271, s: 91, l: 65 },      // purple-500
  steady: { h: 215, s: 20, l: 65 },    // slate-400
  cross_train: { h: 330, s: 86, l: 70 }, // pink-400
  other: { h: 30, s: 6, l: 63 },       // stone-400
};

// Training zone colors (for HR zones, effort distribution)
export const trainingZoneBgColors = {
  zone1: 'bg-teal-400',      // Easy/Recovery
  zone2: 'bg-amber-400',     // Moderate/Aerobic
  zone3: 'bg-rose-400',      // Tempo/Threshold
  zone4: 'bg-fuchsia-500',   // Hard/VO2max
  zone5: 'bg-red-500',       // Max effort
};

export const trainingZoneHexColors = {
  zone1: '#2dd4bf',  // teal-400
  zone2: '#fbbf24',  // amber-400
  zone3: '#fb7185',  // rose-400
  zone4: '#d946ef',  // fuchsia-500
  zone5: '#ef4444',  // red-500
};

// Utility functions
export function getWorkoutTypeBgColor(type: string | null | undefined): string {
  if (!type) return workoutTypeBgColors.other;
  return workoutTypeBgColors[type] || workoutTypeBgColors.other;
}

export function getWorkoutTypeBgLightColor(type: string | null | undefined): string {
  if (!type) return workoutTypeBgLightColors.other;
  return workoutTypeBgLightColors[type] || workoutTypeBgLightColors.other;
}

export function getWorkoutTypeTextColor(type: string | null | undefined): string {
  if (!type) return workoutTypeTextColors.other;
  return workoutTypeTextColors[type] || workoutTypeTextColors.other;
}

export function getWorkoutTypeHexColor(type: string | null | undefined): string {
  if (!type) return workoutTypeHexColors.other;
  return workoutTypeHexColors[type] || workoutTypeHexColors.other;
}

export function getWorkoutTypeHslColor(type: string | null | undefined): { h: number; s: number; l: number } {
  if (!type) return workoutTypeHslColors.other;
  return workoutTypeHslColors[type] || workoutTypeHslColors.other;
}

// Combined class for badges/chips (light bg + text color)
export function getWorkoutTypeBadgeClasses(type: string | null | undefined): string {
  const bg = getWorkoutTypeBgLightColor(type);
  const text = getWorkoutTypeTextColor(type);
  return `${bg} ${text}`;
}

// Segment/Lap category colors (for EnhancedSplits, mile-by-mile analysis)
// These map effort categories to consistent colors
export const segmentCategoryColors: Record<string, { bg: string; text: string; hex: string }> = {
  warmup: { bg: 'bg-sky-100', text: 'text-sky-700', hex: '#7dd3fc' },       // sky-300
  cooldown: { bg: 'bg-sky-100', text: 'text-sky-700', hex: '#7dd3fc' },     // sky-300
  easy: { bg: 'bg-teal-100', text: 'text-teal-700', hex: '#5eead4' },       // teal-300
  steady: { bg: 'bg-slate-100', text: 'text-slate-700', hex: '#94a3b8' },   // slate-400
  tempo: { bg: 'bg-rose-50', text: 'text-rose-700', hex: '#fda4af' },       // rose-300
  threshold: { bg: 'bg-rose-100', text: 'text-rose-700', hex: '#fb7185' },  // rose-400
  interval: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', hex: '#e879f9' }, // fuchsia-400
  recovery: { bg: 'bg-cyan-100', text: 'text-cyan-700', hex: '#67e8f9' },   // cyan-300
};

// Hex colors for segment visual bars (different intensities)
export const segmentBarColors: Record<string, Record<number, string>> = {
  warmup: { 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
  cooldown: { 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
  easy: { 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488' },
  steady: { 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569' },
  tempo: { 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
  threshold: { 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
  interval: { 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3' },
  recovery: { 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2' },
};

export function getSegmentCategoryColor(category: string): { bg: string; text: string; hex: string } {
  return segmentCategoryColors[category] || { bg: 'bg-stone-100', text: 'text-stone-700', hex: '#a8a29e' };
}

export function getSegmentBarColor(category: string, intensity: number): string {
  const colors = segmentBarColors[category];
  if (!colors) return '#a8a29e'; // stone-400 fallback
  return colors[intensity] || colors[400];
}
