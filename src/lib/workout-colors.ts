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
// Color spectrum: cyan → teal → indigo (long) → slate (steady) → amber (marathon) → rose → red → fuchsia → purple
export const workoutTypeBgColors: Record<string, string> = {
  recovery: 'bg-cyan-300',
  easy: 'bg-teal-400',
  long: 'bg-indigo-400',        // Distinct from easy - endurance/duration
  steady: 'bg-slate-400',       // Neutral gray - comfortable but working
  marathon: 'bg-amber-500',     // Goal pace - distinct orange
  tempo: 'bg-rose-400',         // Pushing effort
  threshold: 'bg-red-500',      // Hard effort - distinct from tempo
  interval: 'bg-fuchsia-500',   // Speed work
  race: 'bg-purple-500',        // Peak performance
  cross_train: 'bg-pink-400',
  other: 'bg-stone-400',
};

// Tailwind CSS class mappings for light backgrounds (cards, badges)
export const workoutTypeBgLightColors: Record<string, string> = {
  recovery: 'bg-cyan-50',
  easy: 'bg-teal-50',
  long: 'bg-indigo-50',
  steady: 'bg-slate-50',
  marathon: 'bg-amber-50',
  tempo: 'bg-rose-50',
  threshold: 'bg-red-50',
  interval: 'bg-fuchsia-50',
  race: 'bg-purple-50',
  cross_train: 'bg-pink-50',
  other: 'bg-stone-50',
};

// Tailwind CSS class mappings for text colors
export const workoutTypeTextColors: Record<string, string> = {
  recovery: 'text-cyan-700',
  easy: 'text-teal-700',
  long: 'text-indigo-700',
  steady: 'text-slate-700',
  marathon: 'text-amber-700',
  tempo: 'text-rose-700',
  threshold: 'text-red-700',
  interval: 'text-fuchsia-700',
  race: 'text-purple-700',
  cross_train: 'text-pink-700',
  other: 'text-stone-700',
};

// Hex colors for charts (SVG, canvas, etc.)
export const workoutTypeHexColors: Record<string, string> = {
  recovery: '#67e8f9',   // cyan-300
  easy: '#2dd4bf',       // teal-400
  long: '#818cf8',       // indigo-400
  steady: '#94a3b8',     // slate-400
  marathon: '#f59e0b',   // amber-500
  tempo: '#fb7185',      // rose-400
  threshold: '#ef4444',  // red-500
  interval: '#d946ef',   // fuchsia-500
  race: '#a855f7',       // purple-500
  cross_train: '#f472b6', // pink-400
  other: '#a8a29e',      // stone-400
};

// HSL colors for ActivityHeatmap and other components needing HSL
export const workoutTypeHslColors: Record<string, { h: number; s: number; l: number }> = {
  recovery: { h: 188, s: 86, l: 69 },  // cyan-300
  easy: { h: 166, s: 72, l: 50 },      // teal-400
  long: { h: 234, s: 89, l: 74 },      // indigo-400
  steady: { h: 215, s: 20, l: 65 },    // slate-400
  marathon: { h: 38, s: 92, l: 50 },   // amber-500
  tempo: { h: 351, s: 95, l: 72 },     // rose-400
  threshold: { h: 0, s: 84, l: 60 },   // red-500
  interval: { h: 292, s: 84, l: 58 },  // fuchsia-500
  race: { h: 271, s: 91, l: 65 },      // purple-500
  cross_train: { h: 330, s: 86, l: 70 }, // pink-400
  other: { h: 30, s: 6, l: 63 },       // stone-400
};

// Training zone colors (for HR zones, effort distribution)
// Uses fuchsia/magenta for hard efforts, reserves red for warnings/alerts only
export const trainingZoneBgColors = {
  zone1: 'bg-teal-400',      // Easy/Recovery
  zone2: 'bg-amber-400',     // Moderate/Aerobic
  zone3: 'bg-fuchsia-400',   // Tempo/Threshold (magenta instead of rose)
  zone4: 'bg-fuchsia-500',   // Hard/VO2max
  zone5: 'bg-purple-600',    // Max effort (purple instead of red)
};

export const trainingZoneHexColors = {
  zone1: '#2dd4bf',  // teal-400
  zone2: '#fbbf24',  // amber-400
  zone3: '#e879f9',  // fuchsia-400 (was rose-400)
  zone4: '#d946ef',  // fuchsia-500
  zone5: '#9333ea',  // purple-600 (was red-500)
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
  recovery: { bg: 'bg-cyan-100', text: 'text-cyan-700', hex: '#67e8f9' },
  easy: { bg: 'bg-teal-100', text: 'text-teal-700', hex: '#2dd4bf' },
  long: { bg: 'bg-indigo-100', text: 'text-indigo-700', hex: '#818cf8' },
  steady: { bg: 'bg-slate-100', text: 'text-slate-700', hex: '#94a3b8' },
  marathon: { bg: 'bg-amber-100', text: 'text-amber-700', hex: '#f59e0b' },
  tempo: { bg: 'bg-rose-100', text: 'text-rose-700', hex: '#fb7185' },
  threshold: { bg: 'bg-red-100', text: 'text-red-700', hex: '#ef4444' },
  interval: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', hex: '#d946ef' },
  race: { bg: 'bg-purple-100', text: 'text-purple-700', hex: '#a855f7' },
};

// Hex colors for segment visual bars (different intensities)
export const segmentBarColors: Record<string, Record<number, string>> = {
  warmup: { 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
  cooldown: { 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
  recovery: { 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2' },
  easy: { 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488' },
  long: { 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5' },
  steady: { 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569' },
  marathon: { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
  tempo: { 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
  threshold: { 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
  interval: { 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3' },
  race: { 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
};

export function getSegmentCategoryColor(category: string): { bg: string; text: string; hex: string } {
  return segmentCategoryColors[category] || { bg: 'bg-stone-100', text: 'text-stone-700', hex: '#a8a29e' };
}

export function getSegmentBarColor(category: string, intensity: number): string {
  const colors = segmentBarColors[category];
  if (!colors) return '#a8a29e'; // stone-400 fallback
  return colors[intensity] || colors[400];
}
