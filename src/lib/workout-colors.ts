/**
 * Centralized Workout Color System — Performance Spectrum v3
 *
 * Steel → Sky → Teal → Blue → Indigo → Violet → Red → Crimson
 * Calm → Focused → Intense → Maximal
 *
 * Sibling pairs for physiologically similar zones:
 * - Restorative: Recovery / Easy (steel → sky)
 * - Aerobic: Steady / Marathon Pace (sky → blue)
 * - Hard: Tempo / Threshold (indigo → violet)
 * - Max: Interval / Repetition (red → crimson)
 * - Standalone: Long Run (teal), Race (gold)
 */

// Exact hex colors — source of truth
export const WORKOUT_COLORS = {
  recovery: '#8a9bb8',   // hsl(218, 22%, 63%) — muted steel
  easy: '#5ea8c8',       // hsl(200, 46%, 58%) — soft sky
  long: '#14b8a6',       // hsl(173, 80%, 40%) — teal anchor
  steady: '#0ea5e9',     // hsl(199, 89%, 48%) — bright sky
  marathon: '#3b82f6',   // hsl(217, 91%, 60%) — true blue
  tempo: '#6366f1',      // hsl(239, 84%, 67%) — indigo
  threshold: '#8b5cf6',  // hsl(258, 90%, 66%) — violet
  interval: '#e04545',   // hsl(0, 72%, 57%) — signal red
  repetition: '#d42a5c', // hsl(340, 67%, 50%) — crimson rose
  race: '#f59e0b',       // hsl(38, 92%, 50%) — gold
  cross_train: '#a78bfa', // violet-400
  other: '#a8a29e',      // stone-400
} as const;

// Continuous gradient stops (0–100% intensity)
export const INTENSITY_STOPS = [
  { at: 0, color: '#5ea8c8' },    // sky
  { at: 0.25, color: '#0ea5e9' }, // bright sky
  { at: 0.5, color: '#6366f1' },  // indigo
  { at: 0.75, color: '#8b5cf6' }, // violet
  { at: 1, color: '#e04545' },    // red
] as const;

// Tailwind CSS class mappings for backgrounds (closest matches)
export const workoutTypeBgColors: Record<string, string> = {
  recovery: 'bg-slate-400',         // steel
  easy: 'bg-sky-400',               // sky
  long: 'bg-teal-500',              // teal
  steady: 'bg-sky-500',             // bright sky
  marathon: 'bg-blue-500',          // blue
  tempo: 'bg-indigo-500',           // indigo
  threshold: 'bg-violet-500',       // violet
  interval: 'bg-red-500',           // red
  repetition: 'bg-rose-600',        // crimson
  race: 'bg-amber-500',             // gold
  cross_train: 'bg-violet-400',
  other: 'bg-stone-400',
};

// Tailwind CSS class mappings for light backgrounds (cards, badges)
export const workoutTypeBgLightColors: Record<string, string> = {
  recovery: 'bg-slate-100',
  easy: 'bg-sky-100',
  long: 'bg-teal-50',
  steady: 'bg-sky-50',
  marathon: 'bg-blue-50',
  tempo: 'bg-indigo-50',
  threshold: 'bg-violet-50',
  interval: 'bg-red-50',
  repetition: 'bg-rose-50',
  race: 'bg-amber-50',
  cross_train: 'bg-violet-50',
  other: 'bg-stone-50',
};

// Tailwind CSS class mappings for text colors
export const workoutTypeTextColors: Record<string, string> = {
  recovery: 'text-slate-700',
  easy: 'text-sky-700',
  long: 'text-teal-700',
  steady: 'text-sky-700',
  marathon: 'text-blue-700',
  tempo: 'text-indigo-700',
  threshold: 'text-violet-700',
  interval: 'text-red-700',
  repetition: 'text-rose-700',
  race: 'text-amber-700',
  cross_train: 'text-violet-700',
  other: 'text-secondary',
};

// Hex colors for charts (SVG, canvas, etc.)
export const workoutTypeHexColors: Record<string, string> = {
  recovery: WORKOUT_COLORS.recovery,
  easy: WORKOUT_COLORS.easy,
  long: WORKOUT_COLORS.long,
  steady: WORKOUT_COLORS.steady,
  marathon: WORKOUT_COLORS.marathon,
  tempo: WORKOUT_COLORS.tempo,
  threshold: WORKOUT_COLORS.threshold,
  interval: WORKOUT_COLORS.interval,
  repetition: WORKOUT_COLORS.repetition,
  race: WORKOUT_COLORS.race,
  cross_train: WORKOUT_COLORS.cross_train,
  other: WORKOUT_COLORS.other,
};

// HSL colors for ActivityHeatmap and other components needing HSL
export const workoutTypeHslColors: Record<string, { h: number; s: number; l: number }> = {
  recovery: { h: 218, s: 22, l: 63 },
  easy: { h: 200, s: 46, l: 58 },
  long: { h: 173, s: 80, l: 40 },
  steady: { h: 199, s: 89, l: 48 },
  marathon: { h: 217, s: 91, l: 60 },
  tempo: { h: 239, s: 84, l: 67 },
  threshold: { h: 258, s: 90, l: 66 },
  interval: { h: 0, s: 72, l: 57 },
  repetition: { h: 340, s: 67, l: 50 },
  race: { h: 38, s: 92, l: 50 },
  cross_train: { h: 255, s: 92, l: 76 },
  other: { h: 30, s: 6, l: 63 },
};

// Training zone colors (for HR zones, effort distribution)
export const trainingZoneBgColors = {
  zone1: 'bg-sky-400',        // Easy/Recovery
  zone2: 'bg-sky-500',        // Moderate/Aerobic
  zone3: 'bg-indigo-500',     // Tempo/Threshold
  zone4: 'bg-violet-500',     // Hard/VO2max
  zone5: 'bg-red-500',        // Max effort
};

export const trainingZoneHexColors = {
  zone1: '#5ea8c8',  // sky
  zone2: '#0ea5e9',  // bright sky
  zone3: '#6366f1',  // indigo
  zone4: '#8b5cf6',  // violet
  zone5: '#e04545',  // red
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
export const segmentCategoryColors: Record<string, { bg: string; text: string; hex: string }> = {
  warmup: { bg: 'bg-slate-100', text: 'text-slate-700', hex: WORKOUT_COLORS.recovery },
  cooldown: { bg: 'bg-slate-100', text: 'text-slate-700', hex: WORKOUT_COLORS.recovery },
  recovery: { bg: 'bg-slate-100', text: 'text-slate-700', hex: WORKOUT_COLORS.recovery },
  easy: { bg: 'bg-sky-100', text: 'text-sky-700', hex: WORKOUT_COLORS.easy },
  long: { bg: 'bg-teal-50', text: 'text-teal-700', hex: WORKOUT_COLORS.long },
  steady: { bg: 'bg-sky-50', text: 'text-sky-700', hex: WORKOUT_COLORS.steady },
  marathon: { bg: 'bg-blue-50', text: 'text-blue-700', hex: WORKOUT_COLORS.marathon },
  tempo: { bg: 'bg-indigo-50', text: 'text-indigo-700', hex: WORKOUT_COLORS.tempo },
  threshold: { bg: 'bg-violet-50', text: 'text-violet-700', hex: WORKOUT_COLORS.threshold },
  interval: { bg: 'bg-red-50', text: 'text-red-700', hex: WORKOUT_COLORS.interval },
  repetition: { bg: 'bg-rose-50', text: 'text-rose-700', hex: WORKOUT_COLORS.repetition },
  race: { bg: 'bg-amber-50', text: 'text-amber-700', hex: WORKOUT_COLORS.race },
  anomaly: { bg: 'bg-yellow-100', text: 'text-yellow-700', hex: '#fbbf24' },
};

// Hex colors for segment visual bars (different intensities)
export const segmentBarColors: Record<string, Record<number, string>> = {
  warmup: { 300: '#b4c0d4', 400: '#9dadc6', 500: '#8a9bb8', 600: '#7085a4' },
  cooldown: { 300: '#b4c0d4', 400: '#9dadc6', 500: '#8a9bb8', 600: '#7085a4' },
  recovery: { 300: '#c4cede', 400: '#b4c0d4', 500: '#8a9bb8', 600: '#7085a4' },
  easy: { 300: '#8ec4dc', 400: '#74b6d2', 500: '#5ea8c8', 600: '#4a94b4' },
  long: { 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488' },
  steady: { 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
  marathon: { 300: '#93b4f8', 400: '#6698f6', 500: '#3b82f6', 600: '#2563eb' },
  tempo: { 300: '#9698f5', 400: '#7c7ef3', 500: '#6366f1', 600: '#4f46e5' },
  threshold: { 300: '#b094f8', 400: '#9b78f7', 500: '#8b5cf6', 600: '#7c3aed' },
  interval: { 300: '#ec8080', 400: '#e66262', 500: '#e04545', 600: '#c73a3a' },
  repetition: { 300: '#e06488', 400: '#da4770', 500: '#d42a5c', 600: '#b82350' },
  race: { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
  anomaly: { 300: '#fde68a', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
};

export function getSegmentCategoryColor(category: string): { bg: string; text: string; hex: string } {
  return segmentCategoryColors[category] || { bg: 'bg-stone-100', text: 'text-secondary', hex: '#a8a29e' };
}

export function getSegmentBarColor(category: string, intensity: number): string {
  const colors = segmentBarColors[category];
  if (!colors) return '#a8a29e';
  return colors[intensity] || colors[400];
}
