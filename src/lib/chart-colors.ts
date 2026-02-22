/**
 * Centralized Chart Color System
 *
 * All hex colors used in SVG charts, gradients, and visualizations.
 * For workout-type colors, see workout-colors.ts.
 */

// Fitness metric lines (CTL/ATL/TSB)
export const FITNESS_COLORS = {
  ctl: '#10b981',        // emerald-500 — Chronic Training Load (fitness)
  atl: '#a8a29e',        // stone-400  — Acute Training Load (fatigue)
  tsb: '#3b82f6',        // blue-500   — Training Stress Balance (form)
  ctlGradientStart: '#10b981',
  ctlGradientEnd: '#10b981',
} as const;

// Elevation chart colors
export const ELEVATION_COLORS = {
  gain: '#34d399',       // emerald-400
  loss: '#f87171',       // red-300
  profileLine: '#9ca3af', // gray-400
  profileFill: '#6b7280', // gray-500
} as const;

// Activity stream overlays
export const STREAM_COLORS = {
  pace: '#f97316',       // orange-500
  heartRate: '#ef4444',  // red-500
  cadence: '#8b5cf6',   // violet-500
} as const;

// Heart rate zone colors (for HR charts and zone bands)
// Canonical source: trainingZoneHexColors in workout-colors.ts
export const HR_ZONE_COLORS = {
  z1: '#5ea8c8',         // sky         — Recovery
  z2: '#0ea5e9',         // bright sky  — Aerobic
  z3: '#6366f1',         // indigo      — Tempo
  z4: '#8b5cf6',         // violet      — Threshold
  z5: '#e04545',         // red         — VO2max
} as const;

// Chart infrastructure (grid, axes, labels)
export const CHART_UI_COLORS = {
  gridLine: '#94a3b8',       // slate-400
  gridLineMinor: '#334155',  // slate-700
  axisLabel: '#94a3b8',      // slate-400
  zeroLine: '#94a3b8',       // slate-400
  hoverLine: '#94a3b8',      // slate-400
} as const;

// Utility: get HR zone color by percentage of max HR
export function getHrZoneColor(hrPercent: number): string {
  if (hrPercent >= 0.9) return HR_ZONE_COLORS.z5;
  if (hrPercent >= 0.8) return HR_ZONE_COLORS.z4;
  if (hrPercent >= 0.7) return HR_ZONE_COLORS.z3;
  if (hrPercent >= 0.6) return HR_ZONE_COLORS.z2;
  return HR_ZONE_COLORS.z1;
}
