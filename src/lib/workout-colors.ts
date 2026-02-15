/**
 * Centralized Workout Color System
 *
 * All workout type colors should be imported from here to ensure consistency.
 *
 * Color Palette — cool to warm (low intensity → high intensity):
 * - Recovery/Easy: Sky blue (cool, calm)
 * - Long: Indigo (endurance, distinct from easy)
 * - Steady/Marathon: Teal (moderate effort)
 * - Tempo: Amber (warming up)
 * - Threshold: Orange (warm)
 * - Interval: Red (hot, VO2max)
 * - Repetition: Deep red/crimson (hottest, sprint)
 * - Race: Purple (special achievement)
 * - Cross-train: Violet
 */

// Tailwind CSS class mappings for backgrounds
// Ordered lowest → highest intensity
export const workoutTypeBgColors: Record<string, string> = {
  recovery: 'bg-sky-300',          // lightest blue
  easy: 'bg-sky-500',              // blue
  long: 'bg-indigo-400',           // indigo (endurance)
  steady: 'bg-teal-400',           // teal
  marathon: 'bg-teal-600',         // deep teal
  tempo: 'bg-amber-500',           // amber/gold
  threshold: 'bg-orange-500',      // orange
  interval: 'bg-red-500',          // red
  repetition: 'bg-red-700',        // deep red
  race: 'bg-purple-500',           // purple (achievement)
  cross_train: 'bg-violet-400',
  other: 'bg-stone-400',
};

// Tailwind CSS class mappings for light backgrounds (cards, badges)
export const workoutTypeBgLightColors: Record<string, string> = {
  recovery: 'bg-sky-50',
  easy: 'bg-sky-50',
  long: 'bg-indigo-50',
  steady: 'bg-teal-50',
  marathon: 'bg-teal-50',
  tempo: 'bg-amber-50',
  threshold: 'bg-orange-50',
  interval: 'bg-red-50',
  repetition: 'bg-red-50',
  race: 'bg-purple-50',
  cross_train: 'bg-violet-50',
  other: 'bg-stone-50',
};

// Tailwind CSS class mappings for text colors
export const workoutTypeTextColors: Record<string, string> = {
  recovery: 'text-sky-700',
  easy: 'text-sky-700',
  long: 'text-indigo-700',
  steady: 'text-teal-700',
  marathon: 'text-teal-700',
  tempo: 'text-amber-700',
  threshold: 'text-orange-700',
  interval: 'text-red-700',
  repetition: 'text-red-800',
  race: 'text-purple-700',
  cross_train: 'text-violet-700',
  other: 'text-secondary',
};

// Hex colors for charts (SVG, canvas, etc.)
export const workoutTypeHexColors: Record<string, string> = {
  recovery: '#7dd3fc',   // sky-300
  easy: '#0ea5e9',       // sky-500
  long: '#818cf8',       // indigo-400
  steady: '#2dd4bf',     // teal-400
  marathon: '#0d9488',   // teal-600
  tempo: '#f59e0b',      // amber-500
  threshold: '#f97316',  // orange-500
  interval: '#ef4444',   // red-500
  repetition: '#b91c1c', // red-700
  race: '#a855f7',       // purple-500
  cross_train: '#a78bfa', // violet-400
  other: '#a8a29e',      // stone-400
};

// HSL colors for ActivityHeatmap and other components needing HSL
export const workoutTypeHslColors: Record<string, { h: number; s: number; l: number }> = {
  recovery: { h: 199, s: 95, l: 74 },   // sky-300
  easy: { h: 199, s: 89, l: 48 },       // sky-500
  long: { h: 234, s: 89, l: 74 },       // indigo-400
  steady: { h: 168, s: 64, l: 50 },     // teal-400
  marathon: { h: 175, s: 84, l: 29 },   // teal-600
  tempo: { h: 38, s: 92, l: 50 },       // amber-500
  threshold: { h: 25, s: 95, l: 53 },   // orange-500
  interval: { h: 0, s: 84, l: 60 },     // red-500
  repetition: { h: 0, s: 73, l: 42 },   // red-700
  race: { h: 271, s: 91, l: 65 },       // purple-500
  cross_train: { h: 255, s: 92, l: 76 }, // violet-400
  other: { h: 30, s: 6, l: 63 },        // stone-400
};

// Training zone colors (for HR zones, effort distribution)
export const trainingZoneBgColors = {
  zone1: 'bg-sky-400',        // Easy/Recovery
  zone2: 'bg-teal-400',       // Moderate/Aerobic
  zone3: 'bg-amber-500',      // Tempo/Threshold
  zone4: 'bg-orange-500',     // Hard/VO2max
  zone5: 'bg-red-600',        // Max effort
};

export const trainingZoneHexColors = {
  zone1: '#38bdf8',  // sky-400
  zone2: '#2dd4bf',  // teal-400
  zone3: '#f59e0b',  // amber-500
  zone4: '#f97316',  // orange-500
  zone5: '#dc2626',  // red-600
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
  steady: { bg: 'bg-teal-100', text: 'text-teal-700', hex: '#2dd4bf' },
  marathon: { bg: 'bg-teal-100', text: 'text-teal-700', hex: '#0d9488' },
  tempo: { bg: 'bg-amber-100', text: 'text-amber-700', hex: '#f59e0b' },
  threshold: { bg: 'bg-orange-100', text: 'text-orange-700', hex: '#f97316' },
  interval: { bg: 'bg-red-100', text: 'text-red-700', hex: '#ef4444' },
  repetition: { bg: 'bg-red-100', text: 'text-red-800', hex: '#b91c1c' },
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
  steady: { 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488' },
  marathon: { 300: '#2dd4bf', 400: '#14b8a6', 500: '#0d9488', 600: '#0f766e' },
  tempo: { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
  threshold: { 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c' },
  interval: { 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
  repetition: { 300: '#f87171', 400: '#ef4444', 500: '#dc2626', 600: '#b91c1c' },
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
