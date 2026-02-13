import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPace(totalSeconds: number | null | undefined): string {
  if (!totalSeconds) return '--:--';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
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

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getVerdictColor(verdict: string | null | undefined): string {
  switch (verdict) {
    case 'great': return 'bg-green-500 dark:bg-green-600 text-white';
    case 'good': return 'bg-green-400 dark:bg-green-500 text-white';
    case 'fine': return 'bg-yellow-400 dark:bg-yellow-500 text-primary dark:text-gray-100';
    case 'rough': return 'bg-orange-400 dark:bg-orange-500 text-white';
    case 'awful': return 'bg-red-500 dark:bg-red-600 text-white';
    default: return 'bg-gray-300 dark:bg-gray-600 text-secondary dark:text-gray-300';
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
    long: 'Long Run',
    steady: 'Steady',
    marathon: 'Marathon Pace',
    tempo: 'Tempo',
    threshold: 'Threshold',
    interval: 'Interval',
    race: 'Race',
    cross_train: 'Cross Train',
    other: 'Other',
  };
  return labels[type] || type;
}

export function getWorkoutTypeColor(type: string): string {
  // Centralized workout type colors for badges/chips
  // Import from workout-colors.ts for consistency
  const colors: Record<string, string> = {
    recovery: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200',
    easy: 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200',
    long: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
    steady: 'bg-surface-2 dark:bg-slate-800 text-secondary dark:text-slate-300',
    marathon: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200',
    tempo: 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200',
    threshold: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    interval: 'bg-fuchsia-100 dark:bg-fuchsia-900 text-fuchsia-800 dark:text-fuchsia-200',
    race: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
    cross_train: 'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200',
    other: 'bg-stone-100 dark:bg-stone-800 text-secondary dark:text-stone-300',
  };
  return colors[type] || 'bg-stone-100 dark:bg-stone-800 text-secondary dark:text-stone-300';
}
