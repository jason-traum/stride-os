/**
 * Centralized Workout Color System
 *
 * All workout type colors should be imported from here to ensure consistency.
 *
 * Color Palette (paired by intensity, slowest → fastest):
 * - Recovery/Easy: Sky (cool blue)
 * - Steady/Marathon: Emerald (green)
 * - Tempo/Threshold: Amber/Orange (warm)
 * - Interval/Repetition: Rose/Red (hot)
 * - Long: Indigo (endurance)
 * - Race: Purple (peak performance)
 * - Cross-train: Pink
 */

// Tailwind CSS class mappings for backgrounds
// Ordered slowest → fastest, paired colors per intensity tier
export const workoutTypeBgColors: Record<string, string> = {
  recovery: 'bg-sky-300',          // Pair 1 (cool) - lighter
  easy: 'bg-sky-500',              // Pair 1 (cool) - deeper
  steady: 'bg-emerald-400',        // Pair 2 (moderate) - lighter
  marathon: 'bg-emerald-600',      // Pair 2 (moderate) - deeper
  tempo: 'bg-amber-400',           // Pair 3 (warm) - lighter
  threshold: 'bg-orange-500',      // Pair 3 (warm) - deeper
  interval: 'bg-rose-500',         // Pair 4 (hot) - lighter
  repetition: 'bg-red-500',        // Pair 4 (hot) - deeper
  long: 'bg-indigo-400',           // Structural - endurance
  race: 'bg-purple-500',           // Structural - peak performance
  cross_train: 'bg-pink-400',
  other: 'bg-stone-400',
};

// Tailwind CSS class mappings for light backgrounds (cards, badges)
export const workoutTypeBgLightColors: Record<string, string> = {
  recovery: 'bg-sky-50',
  easy: 'bg-sky-50',
  steady: 'bg-emerald-50',
  marathon: 'bg-emerald-50',
  tempo: 'bg-amber-50',
  threshold: 'bg-orange-50',
  interval: 'bg-rose-50',
  repetition: 'bg-red-50',
  long: 'bg-indigo-50',
  race: 'bg-purple-50',
  cross_train: 'bg-pink-50',
  other: 'bg-stone-50',
};

// Tailwind CSS class mappings for text colors
export const workoutTypeTextColors: Record<string, string> = {
  recovery: 'text-sky-700',
  easy: 'text-sky-700',
  steady: 'text-emerald-700',
  marathon: 'text-emerald-700',
  tempo: 'text-amber-700',
  threshold: 'text-orange-700',
  interval: 'text-rose-700',
  repetition: 'text-red-700',
  long: 'text-indigo-700',
  race: 'text-purple-700',
  cross_train: 'text-pink-700',
  other: 'text-secondary',
};

// Hex colors for charts (SVG, canvas, etc.)
export const workoutTypeHexColors: Record<string, string> = {
  recovery: '#7dd3fc',   // sky-300
  easy: '#0ea5e9',       // sky-500
  steady: '#34d399',     // emerald-400
  marathon: '#059669',   // emerald-600
  tempo: '#fbbf24',      // amber-400
  threshold: '#f97316',  // orange-500
  interval: '#f43f5e',   // rose-500
  repetition: '#ef4444', // red-500
  long: '#818cf8',       // indigo-400
  race: '#a855f7',       // purple-500
  cross_train: '#f472b6', // pink-400
  other: '#a8a29e',      // stone-400
};

// HSL colors for ActivityHeatmap and other components needing HSL
export const workoutTypeHslColors: Record<string, { h: number; s: number; l: number }> = {
  recovery: { h: 199, s: 95, l: 74 },   // sky-300
  easy: { h: 199, s: 89, l: 48 },       // sky-500
  steady: { h: 160, s: 67, l: 52 },     // emerald-400
  marathon: { h: 161, s: 94, l: 30 },   // emerald-600
  tempo: { h: 45, s: 96, l: 56 },       // amber-400
  threshold: { h: 25, s: 95, l: 53 },   // orange-500
  interval: { h: 350, s: 89, l: 60 },   // rose-500
  repetition: { h: 0, s: 84, l: 60 },   // red-500
  long: { h: 234, s: 89, l: 74 },       // indigo-400
  race: { h: 271, s: 91, l: 65 },       // purple-500
  cross_train: { h: 330, s: 86, l: 70 }, // pink-400
  other: { h: 30, s: 6, l: 63 },        // stone-400
};

// Training zone colors (for HR zones, effort distribution)
export const trainingZoneBgColors = {
  zone1: 'bg-sky-400',        // Easy/Recovery
  zone2: 'bg-emerald-400',    // Moderate/Aerobic
  zone3: 'bg-amber-400',      // Tempo/Threshold
  zone4: 'bg-rose-500',       // Hard/VO2max
  zone5: 'bg-purple-600',     // Max effort
};

export const trainingZoneHexColors = {
  zone1: '#38bdf8',  // sky-400
  zone2: '#34d399',  // emerald-400
  zone3: '#fbbf24',  // amber-400
  zone4: '#f43f5e',  // rose-500
  zone5: '#9333ea',  // purple-600
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
  warmup: { bg: 'bg-sky-100', text: 'text-sky-700', hex: '#7dd3fc' },
  cooldown: { bg: 'bg-sky-100', text: 'text-sky-700', hex: '#7dd3fc' },
  recovery: { bg: 'bg-sky-100', text: 'text-sky-700', hex: '#7dd3fc' },
  easy: { bg: 'bg-sky-100', text: 'text-sky-700', hex: '#0ea5e9' },
  long: { bg: 'bg-indigo-100', text: 'text-indigo-700', hex: '#818cf8' },
  steady: { bg: 'bg-emerald-100', text: 'text-emerald-700', hex: '#34d399' },
  marathon: { bg: 'bg-emerald-100', text: 'text-emerald-700', hex: '#059669' },
  tempo: { bg: 'bg-amber-100', text: 'text-amber-700', hex: '#fbbf24' },
  threshold: { bg: 'bg-orange-100', text: 'text-orange-700', hex: '#f97316' },
  interval: { bg: 'bg-rose-100', text: 'text-rose-700', hex: '#f43f5e' },
  repetition: { bg: 'bg-red-100', text: 'text-red-700', hex: '#ef4444' },
  race: { bg: 'bg-purple-100', text: 'text-purple-700', hex: '#a855f7' },
  anomaly: { bg: 'bg-yellow-100', text: 'text-yellow-700', hex: '#fbbf24' },
};

// Hex colors for segment visual bars (different intensities)
export const segmentBarColors: Record<string, Record<number, string>> = {
  warmup: { 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
  cooldown: { 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
  recovery: { 300: '#bae6fd', 400: '#7dd3fc', 500: '#38bdf8', 600: '#0ea5e9' },
  easy: { 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
  long: { 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5' },
  steady: { 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669' },
  marathon: { 300: '#34d399', 400: '#10b981', 500: '#059669', 600: '#047857' },
  tempo: { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
  threshold: { 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c' },
  interval: { 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
  repetition: { 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
  race: { 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
  anomaly: { 300: '#fde68a', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
};

export function getSegmentCategoryColor(category: string): { bg: string; text: string; hex: string } {
  return segmentCategoryColors[category] || { bg: 'bg-stone-100', text: 'text-secondary', hex: '#a8a29e' };
}

export function getSegmentBarColor(category: string, intensity: number): string {
  const colors = segmentBarColors[category];
  if (!colors) return '#a8a29e'; // stone-400 fallback
  return colors[intensity] || colors[400];
}
