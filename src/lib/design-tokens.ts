/**
 * Design Tokens — Single source of truth for programmatic color access.
 *
 * For Tailwind CSS classes, use the tokens defined in tailwind.config.ts.
 * For CSS variables (surfaces, text, borders), use globals.css.
 * For workout-type colors, use workout-colors.ts.
 *
 * This file is for JS/TS code that needs raw color values
 * (Recharts, canvas, inline styles, etc.).
 */

// Brand palette (static hex values — use for server-rendered or non-DOM contexts)
export const brand = {
  dream: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#7c6cf0',
    600: '#6c5ce7',
    700: '#5b4dc7',
    800: '#4c3fb0',
    900: '#3b2f8c',
    950: '#1e1654',
  },
  warm: '#f0a06c',
} as const;

// Chart-specific tokens — CSS variable names for runtime resolution.
// Use getComputedStyle(document.documentElement).getPropertyValue(key) to read.
export const chartVars = {
  bg: '--chart-bg',
  grid: '--chart-grid',
  axis: '--chart-axis',
  tooltipBg: '--chart-tooltip-bg',
  tooltipBorder: '--chart-tooltip-border',
  brand: '--accent-brand',
  success: '--color-success',
  warning: '--color-warning',
  error: '--color-error',
  info: '--color-info',
} as const;

/**
 * Read a CSS variable's computed value at runtime.
 * Only call from client components (needs DOM).
 */
export function getCSSVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Get all chart colors resolved from CSS variables.
 * Only call from client components.
 */
export function getChartColors() {
  return {
    bg: getCSSVar('--chart-bg'),
    grid: getCSSVar('--chart-grid'),
    axis: getCSSVar('--chart-axis'),
    tooltipBg: getCSSVar('--chart-tooltip-bg'),
    tooltipBorder: getCSSVar('--chart-tooltip-border'),
    brand: getCSSVar('--accent-brand'),
    brandHover: getCSSVar('--accent-brand-hover'),
    success: getCSSVar('--color-success'),
    warning: getCSSVar('--color-warning'),
    error: getCSSVar('--color-error'),
    info: getCSSVar('--color-info'),
    textPrimary: getCSSVar('--text-primary'),
    textSecondary: getCSSVar('--text-secondary'),
    textTertiary: getCSSVar('--text-tertiary'),
    borderSubtle: getCSSVar('--border-subtle'),
    borderDefault: getCSSVar('--border-default'),
  };
}
