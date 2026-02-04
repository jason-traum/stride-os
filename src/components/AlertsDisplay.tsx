'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  TrendingUp,
  Moon,
  Activity,
  Flag,
  Trophy,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Heart,
} from 'lucide-react';
import type { Alert, AlertSeverity, AlertType } from '@/lib/alerts';

interface AlertsDisplayProps {
  alerts: Alert[];
  maxVisible?: number;
}

function getAlertIcon(type: AlertType) {
  switch (type) {
    case 'overtraining_warning':
    case 'recovery_needed':
      return AlertTriangle;
    case 'high_rpe_streak':
      return Activity;
    case 'low_sleep_pattern':
      return Moon;
    case 'mileage_spike':
    case 'consistency_decline':
      return TrendingUp;
    case 'plan_adherence_issue':
      return Flag;
    case 'race_approaching':
      return Flag;
    case 'milestone_achieved':
    case 'great_performance':
      return Trophy;
    default:
      return Sparkles;
  }
}

function getSeverityStyles(severity: AlertSeverity): {
  bg: string;
  border: string;
  icon: string;
  title: string;
} {
  switch (severity) {
    case 'urgent':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-500',
        title: 'text-red-800',
      };
    case 'warning':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-500',
        title: 'text-amber-800',
      };
    case 'celebration':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-500',
        title: 'text-green-800',
      };
    case 'info':
    default:
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-500',
        title: 'text-amber-800',
      };
  }
}

function AlertCard({
  alert,
  onDismiss,
}: {
  alert: Alert;
  onDismiss?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getAlertIcon(alert.type);
  const styles = getSeverityStyles(alert.severity);

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all',
        styles.bg,
        styles.border
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
            alert.severity === 'celebration' ? 'bg-green-100' : 'bg-white'
          )}
        >
          <Icon className={cn('w-4 h-4', styles.icon)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn('font-semibold text-sm', styles.title)}>
              {alert.title}
            </h3>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 hover:bg-white/50 rounded transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-stone-400" />
              </button>
            )}
          </div>

          <p className="text-sm text-stone-600 mt-1">{alert.message}</p>

          {alert.recommendation && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 mt-2 font-medium"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide recommendation
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show recommendation
                  </>
                )}
              </button>

              {expanded && (
                <div className="mt-2 p-3 bg-white/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Heart className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-stone-700">{alert.recommendation}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlertsDisplay({ alerts, maxVisible = 3 }: AlertsDisplayProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Filter out dismissed alerts
  const activeAlerts = alerts.filter(
    (alert) => !dismissedAlerts.has(`${alert.type}-${alert.title}`)
  );

  if (activeAlerts.length === 0) {
    return null;
  }

  // Sort alerts: urgent first, then warnings, then celebrations, then info
  const sortedAlerts = [...activeAlerts].sort((a, b) => {
    const severityOrder: Record<AlertSeverity, number> = {
      urgent: 0,
      warning: 1,
      celebration: 2,
      info: 3,
    };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const visibleAlerts = showAll
    ? sortedAlerts
    : sortedAlerts.slice(0, maxVisible);
  const hiddenCount = sortedAlerts.length - maxVisible;

  const handleDismiss = (alert: Alert) => {
    setDismissedAlerts((prev) => {
      const next = new Set(prev);
      next.add(`${alert.type}-${alert.title}`);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Coach Insights
        </h2>
        {activeAlerts.length > 0 && (
          <span className="text-xs text-stone-500">
            {activeAlerts.length} alert{activeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {visibleAlerts.map((alert, index) => (
          <AlertCard
            key={`${alert.type}-${index}`}
            alert={alert}
            onDismiss={() => handleDismiss(alert)}
          />
        ))}
      </div>

      {/* Show More/Less */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-sm text-stone-500 hover:text-stone-700 font-medium flex items-center justify-center gap-1"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {hiddenCount} more alert{hiddenCount !== 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  );
}
