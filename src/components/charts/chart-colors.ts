/**
 * Standardized Chart Color Palette
 *
 * Provides consistent colors for chart lines, bars, areas, and gradients
 * across all charts in the app. Uses CSS variables for dark mode support
 * where applicable, and static hex values for SVG/canvas contexts.
 *
 * For workout-type-specific colors, see @/lib/workout-colors.ts.
 * For lower-level chart infrastructure colors, see @/lib/chart-colors.ts.
 */

// ── Primary Series Palette ─────────────────────────────────────────────
// Use these in order for multi-series charts (line charts, stacked bars, etc.)
// Selected to be distinguishable, accessible, and consistent with the dream theme.

export const CHART_SERIES_COLORS = [
  '#a78bfa',  // dream/violet — primary accent
  '#10b981',  // emerald — success/fitness
  '#f97316',  // orange — pace/effort
  '#3b82f6',  // blue — form/info
  '#f43f5e',  // rose — heart rate/warning
  '#eab308',  // yellow — caution
  '#06b6d4',  // cyan — cooldown/recovery
  '#8b5cf6',  // violet — threshold
  '#ec4899',  // pink — accent-pink
  '#14b8a6',  // teal — secondary green
] as const;

// ── Semantic Colors ────────────────────────────────────────────────────
// Named colors for specific data types — use these when the data type is known.

export const CHART_SEMANTIC_COLORS = {
  // Performance metrics
  pace: '#f97316',           // orange-500
  heartRate: '#ef4444',      // red-500
  distance: '#a78bfa',       // dream violet
  elevation: '#10b981',      // emerald-500
  cadence: '#06b6d4',        // cyan-500

  // Fitness model
  fitness: '#10b981',        // emerald-500 (CTL)
  fatigue: '#a8a29e',        // stone-400 (ATL)
  form: '#3b82f6',           // blue-500 (TSB)

  // Status
  positive: '#10b981',       // emerald-500
  negative: '#ef4444',       // red-500
  neutral: '#a8a29e',        // stone-400
  warning: '#f59e0b',        // amber-500

  // Volume
  mileage: '#a78bfa',        // dream violet
  duration: '#3b82f6',       // blue-500
  load: '#8b5cf6',           // violet-500
} as const;

// ── Gradient Presets ───────────────────────────────────────────────────
// Common gradient definitions for area charts (SVG linearGradient stops).

export const CHART_GRADIENTS = {
  dream: {
    start: '#a78bfa',
    startOpacity: 0.35,
    end: '#a78bfa',
    endOpacity: 0.05,
  },
  emerald: {
    start: '#10b981',
    startOpacity: 0.35,
    end: '#10b981',
    endOpacity: 0.05,
  },
  orange: {
    start: '#f97316',
    startOpacity: 0.25,
    end: '#f97316',
    endOpacity: 0.02,
  },
  blue: {
    start: '#3b82f6',
    startOpacity: 0.25,
    end: '#3b82f6',
    endOpacity: 0.02,
  },
  rose: {
    start: '#f43f5e',
    startOpacity: 0.2,
    end: '#f43f5e',
    endOpacity: 0.02,
  },
} as const;

// ── Recharts Theme Defaults ────────────────────────────────────────────
// Standard styling for recharts components. Apply these to CartesianGrid,
// XAxis, YAxis, and Tooltip for consistent appearance.

export const RECHARTS_THEME = {
  grid: {
    stroke: 'var(--chart-grid)',
    strokeDasharray: '3 3',
    strokeOpacity: 0.6,
  },
  axis: {
    tick: {
      fontSize: 11,
      fill: 'var(--chart-axis)',
    },
    axisLine: false as const,
    tickLine: false as const,
  },
  tooltip: {
    contentStyle: {
      backgroundColor: 'var(--chart-tooltip-bg)',
      border: '1px solid var(--chart-tooltip-border)',
      borderRadius: '0.5rem',
      fontSize: '0.75rem',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
    labelStyle: {
      color: 'var(--text-secondary)',
      fontWeight: 500,
      marginBottom: '0.25rem',
    },
    cursor: {
      stroke: 'var(--chart-axis)',
      strokeWidth: 1,
      strokeDasharray: '3 3',
    },
  },
} as const;

// ── Utility ────────────────────────────────────────────────────────────

/** Get a series color by index. Wraps around if index exceeds palette length. */
export function getSeriesColor(index: number): string {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}

/** Get an array of N series colors. */
export function getSeriesColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => getSeriesColor(i));
}
