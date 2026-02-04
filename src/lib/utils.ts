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
    case 'great': return 'bg-green-500 text-white';
    case 'good': return 'bg-green-400 text-white';
    case 'fine': return 'bg-yellow-400 text-gray-900';
    case 'rough': return 'bg-orange-400 text-white';
    case 'awful': return 'bg-red-500 text-white';
    default: return 'bg-gray-300 text-gray-700';
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
    easy: 'Easy',
    steady: 'Steady',
    tempo: 'Tempo',
    interval: 'Interval',
    long: 'Long Run',
    race: 'Race',
    recovery: 'Recovery',
    cross_train: 'Cross Train',
    other: 'Other',
  };
  return labels[type] || type;
}

export function getWorkoutTypeColor(type: string): string {
  const colors: Record<string, string> = {
    easy: 'bg-amber-100 text-amber-800',
    steady: 'bg-purple-100 text-purple-800',
    tempo: 'bg-orange-100 text-orange-800',
    interval: 'bg-red-100 text-red-800',
    long: 'bg-green-100 text-green-800',
    race: 'bg-yellow-100 text-yellow-800',
    recovery: 'bg-teal-100 text-teal-800',
    cross_train: 'bg-indigo-100 text-indigo-800',
    other: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}
