'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';

// ── Time Range Types ───────────────────────────────────────────────────

export interface ChartTimeRange {
  label: string;
  value: string;
}

export const CHART_TIME_RANGES: ChartTimeRange[] = [
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: '2Y', value: '2Y' },
  { label: 'All', value: 'ALL' },
];

// ── Props ──────────────────────────────────────────────────────────────

export interface ChartWrapperProps {
  /** Chart title displayed in the header */
  title: string;

  /** Optional subtitle below the title */
  subtitle?: string;

  /** The chart content (recharts ResponsiveContainer, SVG, etc.) */
  children: ReactNode;

  /** Show loading skeleton instead of children */
  loading?: boolean;

  /** Show empty state instead of children (when there is no data) */
  empty?: boolean;

  /** Custom empty state message */
  emptyMessage?: string;

  /** Custom empty state icon (defaults to BarChart3) */
  emptyIcon?: ReactNode;

  /**
   * Time range configuration. Pass an array of range options and the
   * controlled value/onChange to render a time range toggle in the header.
   */
  timeRanges?: ChartTimeRange[];
  selectedTimeRange?: string;
  onTimeRangeChange?: (value: string) => void;

  /** Optional content rendered to the right of the title (custom controls, legends) */
  headerRight?: ReactNode;

  /** Optional footer content below the chart (legends, summary stats) */
  footer?: ReactNode;

  /** Height of the chart area. Defaults to 'h-48 sm:h-56'. */
  chartHeight?: string;

  /** Additional class names for the outer container */
  className?: string;

  /** Additional class names for the chart area container */
  chartClassName?: string;

  /** Remove default padding (for charts that need full-bleed rendering) */
  noPadding?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────

export function ChartWrapper({
  title,
  subtitle,
  children,
  loading = false,
  empty = false,
  emptyMessage = 'Not enough data yet',
  emptyIcon,
  timeRanges,
  selectedTimeRange,
  onTimeRangeChange,
  headerRight,
  footer,
  chartHeight = 'h-48 sm:h-56',
  className,
  chartClassName,
  noPadding = false,
}: ChartWrapperProps) {
  // Internal state for uncontrolled time range usage
  const [internalRange, setInternalRange] = useState(
    selectedTimeRange || timeRanges?.[0]?.value || '3M'
  );

  const activeRange = selectedTimeRange ?? internalRange;
  const handleRangeChange = onTimeRangeChange ?? setInternalRange;

  return (
    <div
      className={cn(
        'bg-surface-1 rounded-xl border border-default shadow-sm',
        !noPadding && 'p-5',
        className
      )}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={cn('flex items-start justify-between gap-3', noPadding && 'px-5 pt-5')}>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-primary truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-tertiary mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Time range toggle */}
          {timeRanges && timeRanges.length > 0 && (
            <div className="flex gap-1">
              {timeRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => handleRangeChange(range.value)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-medium rounded transition-colors',
                    activeRange === range.value
                      ? 'bg-accent-dream text-white'
                      : 'bg-surface-2 text-secondary hover:text-primary hover:bg-surface-3'
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          )}

          {/* Custom header right content */}
          {headerRight}
        </div>
      </div>

      {/* ── Chart Area ─────────────────────────────────────────── */}
      <div className={cn('mt-4', noPadding && 'px-5')}>
        {loading ? (
          <ChartSkeleton height={chartHeight} />
        ) : empty ? (
          <ChartEmptyState
            message={emptyMessage}
            icon={emptyIcon}
            height={chartHeight}
          />
        ) : (
          <div className={cn(chartHeight, chartClassName)}>
            {children}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      {footer && !loading && !empty && (
        <div className={cn('mt-4 pt-3 border-t border-subtle', noPadding && 'mx-5 pb-5')}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────────

interface ChartSkeletonProps {
  height?: string;
}

export function ChartSkeleton({ height = 'h-48 sm:h-56' }: ChartSkeletonProps) {
  return (
    <div className={cn('relative', height)}>
      {/* Simulated axis lines */}
      <div className="absolute inset-0 flex flex-col justify-between py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-px bg-surface-2 animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>

      {/* Simulated bars / area shape */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end gap-1.5 px-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-surface-2 rounded-t animate-pulse"
            style={{
              height: `${20 + Math.sin(i * 0.8) * 30 + Math.random() * 20}%`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────

interface ChartEmptyStateProps {
  message?: string;
  icon?: ReactNode;
  height?: string;
}

export function ChartEmptyState({
  message = 'Not enough data yet',
  icon,
  height = 'h-48 sm:h-56',
}: ChartEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', height)}>
      <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mb-3">
        {icon || <BarChart3 className="w-5 h-5 text-tertiary" />}
      </div>
      <p className="text-sm text-tertiary">{message}</p>
      <p className="text-xs text-disabled mt-1">
        Log more runs to see trends here
      </p>
    </div>
  );
}

// ── Chart Legend ────────────────────────────────────────────────────────
// Helper component for consistent legend rendering below charts.

export interface ChartLegendItem {
  label: string;
  color: string;
  /** 'solid' (default) | 'dashed' — controls the swatch style */
  style?: 'solid' | 'dashed';
}

interface ChartLegendProps {
  items: ChartLegendItem[];
  className?: string;
}

export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <div className={cn('flex flex-wrap gap-4 text-xs', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.style === 'dashed' ? (
            <div
              className="w-3 h-0 border-t-2 border-dashed"
              style={{ borderColor: item.color }}
            />
          ) : (
            <div
              className="w-3 h-0.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span className="text-secondary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Chart Stat Row ─────────────────────────────────────────────────────
// Helper component for the summary stats row often shown below charts.

export interface ChartStat {
  label: string;
  value: string | number;
  color?: string;
}

interface ChartStatRowProps {
  stats: ChartStat[];
  className?: string;
}

export function ChartStatRow({ stats, className }: ChartStatRowProps) {
  return (
    <div className={cn('flex flex-wrap gap-4 text-sm', className)}>
      {stats.map((stat) => (
        <div key={stat.label}>
          <span className="text-tertiary">{stat.label}:</span>{' '}
          <span
            className={cn('font-medium', stat.color || 'text-primary')}
          >
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
