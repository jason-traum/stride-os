'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  Activity,
  Battery,
  Gauge,
  Route,
  Trophy,
  Shuffle,
  Repeat,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  CalendarCheck,
  CalendarMinus,
} from 'lucide-react';
import type { WeeklyInsight, InsightType } from '@/actions/weekly-insights';

interface WeeklyInsightsProps {
  insights: WeeklyInsight[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  Activity,
  Battery,
  Gauge,
  Route,
  Trophy,
  Shuffle,
  Repeat,
  Lightbulb,
  CalendarCheck,
  CalendarMinus,
};

const TYPE_STYLES: Record<InsightType, { bg: string; text: string; border: string; iconColor: string }> = {
  trend_up: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  trend_down: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  milestone: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
    iconColor: 'text-sky-400',
  },
  pattern: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
    iconColor: 'text-violet-400',
  },
  alert: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    iconColor: 'text-red-400',
  },
  encouragement: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
    iconColor: 'text-teal-400',
  },
};

function InsightCard({ insight }: { insight: WeeklyInsight }) {
  const style = TYPE_STYLES[insight.type];
  const IconComponent = ICON_MAP[insight.icon] || Lightbulb;

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border',
      style.bg,
      style.border
    )}>
      <div className={cn('flex-shrink-0 mt-0.5', style.iconColor)}>
        <IconComponent className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold', style.text)}>
            {insight.title}
          </span>
          {insight.metric && (
            <span className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium ml-auto flex-shrink-0',
              style.bg,
              style.text
            )}>
              {insight.metric}
            </span>
          )}
        </div>
        <p className="text-xs text-textSecondary mt-0.5 leading-relaxed">
          {insight.description}
        </p>
      </div>
    </div>
  );
}

export function WeeklyInsights({ insights }: WeeklyInsightsProps) {
  const [expanded, setExpanded] = useState(false);

  if (insights.length === 0) return null;

  const visibleInsights = expanded ? insights : insights.slice(0, 3);
  const hasMore = insights.length > 3;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-borderPrimary">
        <Lightbulb className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-textPrimary">Weekly Insights</span>
        <span className="text-[10px] text-textTertiary ml-auto">
          {insights.length} insight{insights.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Insight cards */}
      <div className="p-3 space-y-2">
        {visibleInsights.map((insight, i) => (
          <InsightCard key={`${insight.icon}-${i}`} insight={insight} />
        ))}
      </div>

      {/* Expand/collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-borderPrimary text-xs text-textTertiary hover:text-textSecondary transition-colors"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              Show {insights.length - 3} more <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
