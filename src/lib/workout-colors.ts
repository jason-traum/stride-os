/**
 * Centralized Workout Color System
 *
 * All workout type colors should be imported from here to ensure consistency.
 *
 * Color Palette — steel blue → teal → rose → orange → magenta
 * (slowest → fastest, no green/yellow):
 * - Recovery/Easy: Sky (cool blue)
 * - Steady/Marathon: Teal (blue-green)
 * - Tempo/Threshold: Rose (warm pink-red)
 * - Interval: Orange (hot)
 * - Repetition: Fuchsia (magenta)
 * - Long: Indigo (endurance)
 * - Race: Purple (peak performance)
 * - Cross-train: Pink
 */

// Tailwind CSS class mappings for backgrounds
// Ordered slowest → fastest
export const workoutTypeBgColors: Record<string, string> = {
  recovery: 'bg-sky-300',          // light blue
  easy: 'bg-sky-500',              // medium blue
  steady: 'bg-teal-400',           // teal
  marathon: 'bg-teal-600',         // deep teal
  tempo: 'bg-rose-400',            // soft rose
  threshold: 'bg-rose-600',        // deep rose
  interval: 'bg-orange-500',       // orange
  repetition: 'bg-fuchsia-500',    // magenta
  long: 'bg-indigo-400',           // indigo
  race: 'bg-purple-500',           // purple
  cross_train: 'bg-pink-400',
  other: 'bg-stone-400',
};

// Tailwind CSS class mappings for light backgrounds (cards, badges)
export const workoutTypeBgLightColors: Record<string, string> = {
  recovery: 'bg-sky-50',
  easy: 'bg-sky-50',
  steady: 'bg-teal-50',
  marathon: 'bg-teal-50',
  tempo: 'bg-rose-50',
  threshold: 'bg-rose-50',
  interval: 'bg-orange-50',
  repetition: 'bg-fuchsia-50',
  long: 'bg-indigo-50',
  race: 'bg-purple-50',
  cross_train: 'bg-pink-50',
  other: 'bg-stone-50',
};

// Tailwind CSS class mappings for text colors
export const workoutTypeTextColors: Record<string, string> = {
  recovery: 'text-sky-700',
  easy: 'text-sky-700',
  steady: 'text-teal-700',
  marathon: 'text-teal-700',
  tempo: 'text-rose-700',
  threshold: 'text-rose-700',
  interval: 'text-orange-700',
  repetition: 'text-fuchsia-700',
  long: 'text-indigo-700',
  race: 'text-purple-700',
  cross_train: 'text-pink-700',
  other: 'text-secondary',
};

// Hex colors for charts (SVG, canvas, etc.)
export const workoutTypeHexColors: Record<string, string> = {
  recovery: '#7dd3fc',   // sky-300
  easy: '#0ea5e9',       // sky-500
  steady: '#2dd4bf',     // teal-400
  marathon: '#0d9488',   // teal-600
  tempo: '#fb7185',      // rose-400
  threshold: '#e11d48',  // rose-600
  interval: '#f97316',   // orange-500
  repetition: '#d946ef', // fuchsia-500
  long: '#818cf8',       // indigo-400
  race: '#a855f7',       // purple-500
  cross_train: '#f472b6', // pink-400
  other: '#a8a29e',      // stone-400
};

// HSL colors for ActivityHeatmap and other components needing HSL
export const workoutTypeHslColors: Record<string, { h: number; s: number; l: number }> = {
  recovery: { h: 199, s: 95, l: 74 },   // sky-300
  easy: { h: 199, s: 89, l: 48 },       // sky-500
  steady: { h: 168, s: 64, l: 50 },     // teal-400
  marathon: { h: 175, s: 84, l: 29 },   // teal-600
  tempo: { h: 353, s: 94, l: 71 },      // rose-400
  threshold: { h: 343, s: 81, l: 49 },  // rose-600
  interval: { h: 25, s: 95, l: 53 },    // orange-500
  repetition: { h: 293, s: 84, l: 61 }, // fuchsia-500
  long: { h: 234, s: 89, l: 74 },       // indigo-400
  race: { h: 271, s: 91, l: 65 },       // purple-500
  cross_train: { h: 330, s: 86, l: 70 }, // pink-400
  other: { h: 30, s: 6, l: 63 },        // stone-400
};

// Training zone colors (for HR zones, effort distribution)
export const trainingZoneBgColors = {
  zone1: 'bg-sky-400',        // Easy/Recovery
  zone2: 'bg-teal-400',       // Moderate/Aerobic
  zone3: 'bg-rose-400',       // Tempo/Threshold
  zone4: 'bg-orange-500',     // Hard/VO2max
  zone5: 'bg-fuchsia-600',    // Max effort
};

export const trainingZoneHexColors = {
  zone1: '#38bdf8',  // sky-400
  zone2: '#2dd4bf',  // teal-400
  zone3: '#fb7185',  // rose-400
  zone4: '#f97316',  // orange-500
  zone5: '#c026d3',  // fuchsia-600
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
  tempo: { bg: 'bg-rose-100', text: 'text-rose-700', hex: '#fb7185' },
  threshold: { bg: 'bg-rose-100', text: 'text-rose-700', hex: '#e11d48' },
  interval: { bg: 'bg-orange-100', text: 'text-orange-700', hex: '#f97316' },
  repetition: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', hex: '#d946ef' },
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
  tempo: { 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
  threshold: { 300: '#fb7185', 400: '#f43f5e', 500: '#e11d48', 600: '#be123c' },
  interval: { 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c' },
  repetition: { 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3' },
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
