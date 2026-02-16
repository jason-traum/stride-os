import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPace(totalSeconds: number | null | undefined): string {
  if (!totalSeconds) return '--:--';
  if (totalSeconds >= 1800) return '-'; // 30+ min/mi is not meaningful pace data
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '--:--';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function formatDistance(miles: number | null | undefined): string {
  if (!miles) return '0.0';
  return miles.toFixed(2);
}

export function calculatePace(distanceMiles: number, durationMinutes: number): number {
  if (!distanceMiles || !durationMinutes) return 0;
  return Math.round((durationMinutes * 60) / distanceMiles);
}

/**
 * Parse a date string safely, avoiding timezone issues.
 * For date-only strings (YYYY-MM-DD), appends noon to prevent day shifting.
 */
export function parseLocalDate(dateString: string): Date {
  // If it's just a date (YYYY-MM-DD), append noon to avoid timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(dateString + 'T12:00:00');
  }
  return new Date(dateString);
}

export function formatDate(dateString: string): string {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateLong(dateString: string): string {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get today's date string in the user's local timezone (America/New_York).
 * Avoids the UTC issue where 11pm ET on Sunday becomes Monday in UTC.
 */
export function getTodayString(): string {
  return toLocalDateString(new Date());
}

/**
 * Convert a Date to a YYYY-MM-DD string in the user's local timezone.
 * Uses America/New_York to avoid UTC day-boundary issues on Vercel servers.
 */
export function toLocalDateString(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function getVerdictColor(verdict: string | null | undefined): string {
  switch (verdict) {
    case 'great': return 'bg-green-600 dark:bg-green-600 text-white';
    case 'good': return 'bg-green-100 dark:bg-green-800/60 text-green-800 dark:text-green-100';
    case 'fine': return 'bg-yellow-100 dark:bg-yellow-800/60 text-yellow-800 dark:text-yellow-100';
    case 'rough': return 'bg-orange-100 dark:bg-orange-800/60 text-orange-800 dark:text-orange-100';
    case 'awful': return 'bg-red-500 dark:bg-red-600 text-white';
    default: return 'bg-bgTertiary text-textSecondary';
  }
}

export function getVerdictEmoji(verdict: string | null | undefined): string {
  switch (verdict) {
    case 'great': return '';
    case 'good': return '';
    case 'fine': return '';
    case 'rough': return '';
    case 'awful': return '';
    default: return '';
  }
}

export function getWorkoutTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    recovery: 'Recovery',
    easy: 'Easy',
    steady: 'Steady',
    marathon: 'Marathon Pace',
    tempo: 'Tempo',
    threshold: 'Threshold',
    interval: 'Interval',
    repetition: 'Repetition',
    long: 'Long Run',
    race: 'Race',
    cross_train: 'Cross Train',
    other: 'Other',
  };
  return labels[type] || type;
}

export function getWorkoutTypeColor(type: string): string {
  // Performance Spectrum v3: steel → sky → teal → blue → indigo → violet → red → crimson
  const colors: Record<string, string> = {
    recovery: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    easy: 'bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200',
    long: 'bg-teal-50 dark:bg-teal-900 text-teal-800 dark:text-teal-200',
    steady: 'bg-sky-50 dark:bg-sky-900 text-sky-700 dark:text-sky-200',
    marathon: 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
    tempo: 'bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200',
    threshold: 'bg-violet-50 dark:bg-violet-900 text-violet-700 dark:text-violet-200',
    interval: 'bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200',
    repetition: 'bg-rose-50 dark:bg-rose-900 text-rose-700 dark:text-rose-200',
    race: 'bg-amber-50 dark:bg-amber-900 text-amber-700 dark:text-amber-200',
    cross_train: 'bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200',
    other: 'bg-stone-100 dark:bg-stone-800 text-secondary dark:text-stone-300',
  };
  return colors[type] || 'bg-stone-100 dark:bg-stone-800 text-secondary dark:text-stone-300';
}
