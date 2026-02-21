'use client';

import { useState, useEffect } from 'react';
import { Footprints, AlertTriangle, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { getShoeDashboard, type ShoeDashboardData, type ShoeDashboardItem, type RetirementAlert } from '@/actions/shoe-dashboard';
import { parseLocalDate, cn } from '@/lib/utils';
import { AnimatedSection } from '@/components/AnimatedSection';

// Type breakdown colors matching the workout color system
const TYPE_COLORS = {
  easy: { hex: '#5ea8c8', label: 'Easy' },     // sky
  tempo: { hex: '#8b5cf6', label: 'Tempo' },    // violet
  long: { hex: '#14b8a6', label: 'Long' },      // teal
  race: { hex: '#f59e0b', label: 'Race' },      // amber
  other: { hex: '#a8a29e', label: 'Other' },    // stone
} as const;

function formatLastUsed(dateStr: string | null): string {
  if (!dateStr) return 'Never used';
  const d = parseLocalDate(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getProgressColor(miles: number): string {
  if (miles >= 400) return 'bg-red-500';
  if (miles >= 300) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getProgressTrailColor(miles: number): string {
  if (miles >= 400) return 'bg-red-500/20';
  if (miles >= 300) return 'bg-amber-500/20';
  return 'bg-emerald-500/20';
}

function RetirementBadge({ alert }: { alert: RetirementAlert }) {
  if (alert === 'none') return null;

  const config = {
    warn: {
      label: 'Consider replacing',
      classes: 'bg-amber-900/30 text-amber-300 border-amber-700/40',
      Icon: AlertTriangle,
    },
    alert: {
      label: 'Replace soon',
      classes: 'bg-orange-900/30 text-orange-300 border-orange-700/40',
      Icon: AlertTriangle,
    },
    critical: {
      label: 'Past lifespan',
      classes: 'bg-red-900/30 text-red-300 border-red-700/40',
      Icon: AlertCircle,
    },
  }[alert];

  const { label, classes, Icon } = config;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border', classes)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function MileageProgressBar({ miles }: { miles: number }) {
  const maxMiles = 500;
  const pct = Math.min((miles / maxMiles) * 100, 100);

  return (
    <div className="w-full">
      <div className={cn('h-2 rounded-full overflow-hidden', getProgressTrailColor(miles))}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', getProgressColor(miles))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-textTertiary">{miles.toFixed(0)} mi</span>
        <span className="text-[10px] text-textTertiary">500 mi</span>
      </div>
    </div>
  );
}

function TypeBreakdownBar({ breakdown, totalMiles }: { breakdown: ShoeDashboardItem['typeBreakdown']; totalMiles: number }) {
  if (totalMiles === 0) return null;

  const segments = (Object.keys(TYPE_COLORS) as Array<keyof typeof TYPE_COLORS>)
    .map(key => ({
      key,
      miles: breakdown[key],
      pct: (breakdown[key] / totalMiles) * 100,
      ...TYPE_COLORS[key],
    }))
    .filter(s => s.miles > 0);

  if (segments.length === 0) return null;

  return (
    <div>
      {/* Stacked bar */}
      <div className="h-1.5 rounded-full overflow-hidden flex bg-bgTertiary">
        {segments.map(seg => (
          <div
            key={seg.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${seg.pct}%`, backgroundColor: seg.hex }}
            title={`${seg.label}: ${seg.miles.toFixed(1)} mi`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: seg.hex }}
            />
            <span className="text-[10px] text-textTertiary">
              {seg.label} {seg.miles.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShoeCard({ shoe }: { shoe: ShoeDashboardItem }) {
  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      daily_trainer: 'Daily Trainer',
      tempo: 'Tempo',
      race: 'Race',
      trail: 'Trail',
      recovery: 'Recovery',
    };
    return labels[cat] || cat;
  };

  return (
    <div className={cn(
      'bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm',
      shoe.isRetired && 'opacity-50',
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-textPrimary truncate">{shoe.name}</h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-bgTertiary text-textSecondary whitespace-nowrap">
              {getCategoryLabel(shoe.category)}
            </span>
            {shoe.isRetired && (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/50 text-slate-400 whitespace-nowrap">
                Retired
              </span>
            )}
          </div>
          <p className="text-xs text-textTertiary mt-0.5">{shoe.brand} {shoe.model}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold text-textPrimary tabular-nums">
            {shoe.totalMiles.toFixed(0)}
            <span className="text-xs font-normal text-textTertiary ml-0.5">mi</span>
          </p>
          <p className="text-[11px] text-textTertiary">
            {shoe.workoutCount} {shoe.workoutCount === 1 ? 'run' : 'runs'}
          </p>
        </div>
      </div>

      {/* Mileage progress bar */}
      {!shoe.isRetired && (
        <div className="mt-3">
          <MileageProgressBar miles={shoe.totalMiles} />
        </div>
      )}

      {/* Type breakdown bar */}
      <div className="mt-2.5">
        <TypeBreakdownBar breakdown={shoe.typeBreakdown} totalMiles={shoe.totalMiles} />
      </div>

      {/* Footer: last used + retirement alert */}
      <div className="flex items-center justify-between mt-3 gap-2">
        <span className="text-[11px] text-textTertiary">
          Last used: {formatLastUsed(shoe.lastUsedDate)}
        </span>
        <RetirementBadge alert={shoe.retirementAlert} />
      </div>
    </div>
  );
}

export function ShoeDashboard() {
  const [data, setData] = useState<ShoeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRetired, setShowRetired] = useState(false);

  useEffect(() => {
    setLoading(true);
    getShoeDashboard().then(result => {
      if (result.success) {
        setData(result.data);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <Footprints className="w-5 h-5 text-dream-500" />
          Shoe Mileage
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
        </div>
      </div>
    );
  }

  if (!data || data.shoes.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <Footprints className="w-5 h-5 text-dream-500" />
          Shoe Mileage
        </h2>
        <p className="text-sm text-textTertiary text-center py-4">
          No shoes tracked yet. Add shoes or sync from Strava.
        </p>
      </div>
    );
  }

  const activeShoes = data.shoes.filter(s => !s.isRetired);
  const retiredShoes = data.shoes.filter(s => s.isRetired);

  // Summary stats
  const totalActiveMiles = activeShoes.reduce((sum, s) => sum + s.totalMiles, 0);
  const shoesNeedingAttention = activeShoes.filter(
    s => s.retirementAlert !== 'none'
  ).length;

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-textPrimary flex items-center gap-2">
            <Footprints className="w-5 h-5 text-dream-500" />
            Shoe Mileage
          </h2>
          {shoesNeedingAttention > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-900/30 text-amber-300">
              <AlertTriangle className="w-3 h-3" />
              {shoesNeedingAttention} need{shoesNeedingAttention === 1 ? 's' : ''} attention
            </span>
          )}
        </div>

        {/* Summary row */}
        <div className="flex gap-4 mb-4 text-xs text-textTertiary">
          <span>
            <span className="font-medium text-textSecondary">{activeShoes.length}</span> active
          </span>
          {retiredShoes.length > 0 && (
            <span>
              <span className="font-medium text-textSecondary">{retiredShoes.length}</span> retired
            </span>
          )}
          <span>
            <span className="font-medium text-textSecondary">{totalActiveMiles.toFixed(0)}</span> total mi
          </span>
        </div>

        {/* Active shoe cards */}
        <div className="space-y-3">
          {activeShoes.map((shoe, i) => (
            <AnimatedSection key={shoe.id} delay={i * 0.05}>
              <ShoeCard shoe={shoe} />
            </AnimatedSection>
          ))}
        </div>

        {/* Retired shoes (collapsible) */}
        {retiredShoes.length > 0 && (
          <div className="mt-5">
            <button
              onClick={() => setShowRetired(!showRetired)}
              className="flex items-center gap-2 text-xs text-textTertiary hover:text-textSecondary transition-colors"
            >
              <ChevronRight
                className={cn('w-3.5 h-3.5 transition-transform', showRetired && 'rotate-90')}
              />
              Retired ({retiredShoes.length})
            </button>

            {showRetired && (
              <div className="space-y-3 mt-3">
                {retiredShoes.map((shoe, i) => (
                  <AnimatedSection key={shoe.id} delay={i * 0.05}>
                    <ShoeCard shoe={shoe} />
                  </AnimatedSection>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
