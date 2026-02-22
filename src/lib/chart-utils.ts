import { parseLocalDate } from '@/lib/utils';
import { filterByTimeRange } from '@/components/shared/TimeRangeSelector';
import { getWorkoutTypeHexColor } from '@/lib/workout-colors';

/** Time range filtering (delegates to shared implementation) */
export function filterByRange<T extends { date: string }>(points: T[], days: number): T[] {
  return filterByTimeRange(points, days);
}

/** IQR-based outlier removal. Returns points within Q1 - k*IQR to Q3 + k*IQR. */
export function filterOutliersIQR<T>(points: T[], getValue: (p: T) => number, k = 1.5): T[] {
  if (points.length < 5) return points;
  const sorted = points.map(getValue).sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - k * iqr;
  const hi = q3 + k * iqr;
  return points.filter(p => {
    const v = getValue(p);
    return v >= lo && v <= hi;
  });
}

/** Smart X-axis date label computation */
export function computeDateLabels(
  points: { date: string }[],
  getX: (i: number) => number,
  rangeDays: number,
) {
  if (points.length < 2) return [];
  const targetCount = rangeDays > 365 ? 6 : rangeDays > 180 ? 5 : 4;
  const labels: { x: number; label: string }[] = [];
  const includeYear = rangeDays > 365;
  for (let t = 0; t <= targetCount; t++) {
    const idx = Math.round((t / targetCount) * (points.length - 1));
    const date = points[idx].date;
    const fmt: Intl.DateTimeFormatOptions = includeYear
      ? { month: 'short', year: '2-digit' }
      : { month: 'short', day: 'numeric' };
    labels.push({
      x: getX(idx),
      label: parseLocalDate(date).toLocaleDateString('en-US', fmt),
    });
  }
  return labels;
}

/** Get workout hex color (convenience re-export) */
export function getWorkoutColor(type: string) {
  return getWorkoutTypeHexColor(type);
}
