'use client';

import { useState, useEffect } from 'react';
import { Battery, BatteryLow, BatteryMedium, BatteryFull, AlertTriangle, CheckCircle, Lightbulb, TrendingUp, Loader2, Zap, Activity } from 'lucide-react';
import {
  getRecoveryStatus,
  getWeeklyLoadAnalysis,
  getTrainingInsights,
  type RecoveryStatus,
  type WeeklyLoadAnalysis,
  type TrainingInsight,
} from '@/actions/recovery';

/**
 * Recovery Status Card
 */
export function RecoveryStatusCard() {
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecoveryStatus().then(data => {
      setStatus(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Battery className="w-5 h-5 text-dream-500" />
          Recovery Status
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!status) return null;

  // Battery icon based on fatigue
  const BatteryIcon = status.fatigueFactor < 25 ? BatteryFull :
    status.fatigueFactor < 50 ? BatteryMedium :
    status.fatigueFactor < 75 ? BatteryLow : Battery;

  const statusColors: Record<string, { bg: string; text: string; bar: string }> = {
    peaked: { bg: 'bg-dream-100 dark:bg-dream-900/40', text: 'text-dream-700 dark:text-dream-300', bar: 'bg-dream-500' },
    fresh: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-dream-400' },
    neutral: { bg: 'bg-bgTertiary', text: 'text-textSecondary', bar: 'bg-bgInteractive-hover' },
    tired: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-400' },
    very_tired: { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-500' },
  };

  const colors = statusColors[status.formStatus] || statusColors.neutral;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <BatteryIcon className={`w-5 h-5 ${colors.text}`} />
        Recovery Status
      </h2>

      {/* Form status badge */}
      <div className="flex items-center justify-between mb-4">
        <span className={`px-3 py-1.5 rounded-lg font-semibold capitalize ${colors.bg} ${colors.text}`}>
          {status.formStatus.replace('_', ' ')}
        </span>
        <span className="text-sm text-textTertiary">
          {100 - status.fatigueFactor}% recovered
        </span>
      </div>

      {/* Fatigue bar */}
      <div className="mb-4">
        <div className="h-3 bg-bgTertiary rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} transition-all duration-500`}
            style={{ width: `${100 - status.fatigueFactor}%` }}
          />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-textSecondary mb-4">{status.recoveryDescription}</p>

      {/* Readiness indicators */}
      <div className="flex gap-3 mb-4">
        <div className={`flex-1 p-3 rounded-lg text-center ${status.readyForHardWorkout ? 'bg-bgTertiary' : 'bg-bgTertiary'}`}>
          <p className={`text-xs ${status.readyForHardWorkout ? 'text-textSecondary' : 'text-tertiary'}`}>
            Hard Workout
          </p>
          <p className={`text-sm font-semibold ${status.readyForHardWorkout ? 'text-primary' : 'text-textTertiary'}`}>
            {status.readyForHardWorkout ? 'Ready' : 'Not Yet'}
          </p>
        </div>
        <div className={`flex-1 p-3 rounded-lg text-center ${status.readyForEasyRun ? 'bg-bgTertiary' : 'bg-bgTertiary'}`}>
          <p className={`text-xs ${status.readyForEasyRun ? 'text-textSecondary' : 'text-tertiary'}`}>
            Easy Run
          </p>
          <p className={`text-sm font-semibold ${status.readyForEasyRun ? 'text-primary' : 'text-textTertiary'}`}>
            {status.readyForEasyRun ? 'Ready' : 'Not Yet'}
          </p>
        </div>
      </div>

      {/* Suggestion */}
      <div className="bg-bgTertiary rounded-lg p-3 flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-secondary mt-0.5" />
        <div>
          <p className="text-sm font-medium text-textSecondary">Suggested</p>
          <p className="text-sm text-textSecondary">{status.suggestedNextWorkout}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Weekly Load Analysis Card
 */
export function WeeklyLoadCard() {
  const [analysis, setAnalysis] = useState<WeeklyLoadAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWeeklyLoadAnalysis().then(data => {
      setAnalysis(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-500" />
          Training Load
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const riskColors: Record<string, { bg: string; text: string }> = {
    low: { bg: 'bg-dream-50 dark:bg-dream-900/30', text: 'text-dream-700 dark:text-dream-300' },
    optimal: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
    high: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
    very_high: { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300' },
  };

  const colors = riskColors[analysis.riskLevel] || riskColors.optimal;

  // Calculate position on ACWR scale (0.8 to 1.5)
  const acwrPosition = Math.min(100, Math.max(0, ((analysis.acuteToChronicRatio - 0.6) / 1.0) * 100));

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-purple-500" />
        Training Load
      </h2>

      {/* Load comparison */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{analysis.current7DayLoad}</p>
          <p className="text-xs text-textTertiary">This Week</p>
        </div>
        <div className="text-center px-4">
          <TrendingUp className={`w-6 h-6 mx-auto ${
            analysis.current7DayLoad > analysis.previous7DayLoad ? 'text-dream-500' : 'text-tertiary'
          }`} />
          <p className="text-xs text-tertiary">vs</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-tertiary">{analysis.previous7DayLoad}</p>
          <p className="text-xs text-textTertiary">Last Week</p>
        </div>
      </div>

      {/* ACWR indicator */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-textTertiary mb-1">
          <span>Low</span>
          <span>Optimal</span>
          <span>High</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden relative bg-gradient-to-r from-dream-300 via-stone-300 to-rose-400">
          <div
            className="absolute w-3 h-5 bg-bgSecondary border-2 border-default rounded-full -top-1 transform -translate-x-1/2 shadow"
            style={{ left: `${acwrPosition}%` }}
          />
        </div>
        <p className="text-center text-sm mt-2">
          <span className="font-semibold">ACWR: {analysis.acuteToChronicRatio}</span>
        </p>
      </div>

      {/* Risk level badge */}
      <div className={`rounded-lg p-3 ${colors.bg}`}>
        <p className={`text-sm font-medium ${colors.text} capitalize`}>
          {analysis.riskLevel.replace('_', ' ')} Risk
        </p>
        <p className="text-sm text-textSecondary mt-1">{analysis.recommendation}</p>
      </div>
    </div>
  );
}

/**
 * Training Insights Card
 */
export function TrainingInsightsCard() {
  const [insights, setInsights] = useState<TrainingInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrainingInsights().then(data => {
      setInsights(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-secondary" />
          Training Insights
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (insights.length === 0) return null;

  const typeConfig: Record<string, { icon: typeof CheckCircle; bg: string; iconColor: string }> = {
    success: { icon: CheckCircle, bg: 'bg-dream-50 dark:bg-dream-900/20', iconColor: 'text-dream-600 dark:text-dream-400' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-amber-600 dark:text-amber-400' },
    suggestion: { icon: Lightbulb, bg: 'bg-bgTertiary', iconColor: 'text-textSecondary' },
    achievement: { icon: Zap, bg: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-500 dark:text-purple-400' },
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-secondary" />
        Training Insights
      </h2>

      <div className="space-y-3">
        {insights.map((insight, i) => {
          const config = typeConfig[insight.type] || typeConfig.suggestion;
          const Icon = config.icon;

          return (
            <div key={i} className={`rounded-lg p-3 ${config.bg}`}>
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 mt-0.5 ${config.iconColor}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-primary">{insight.title}</p>
                    {insight.metric && (
                      <span className="text-xs font-mono text-textTertiary">{insight.metric}</span>
                    )}
                  </div>
                  <p className="text-sm text-textSecondary mt-0.5">{insight.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
