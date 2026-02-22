'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Battery, BatteryLow, BatteryMedium, BatteryFull,
  Moon, Dumbbell, Heart, Brain,
  TrendingDown, TrendingUp, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import type { ReadinessResult, ReadinessFactors } from '@/lib/readiness';

interface ReadinessDetailedCardProps {
  readiness: ReadinessResult;
  factors: ReadinessFactors;
  previousFactors?: ReadinessFactors; // For trend comparison
}

function getBatteryIcon(score: number | null) {
  if (score === null) return Battery;
  if (score >= 75) return BatteryFull;
  if (score >= 50) return BatteryMedium;
  if (score >= 25) return BatteryLow;
  return Battery;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-textTertiary';
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-dream-600';
  if (score >= 30) return 'text-amber-600';
  return 'text-red-600';
}

function getCategoryColor(score: number | null): string {
  if (score === null) return 'bg-bgTertiary text-textTertiary border-borderSecondary';
  if (score >= 70) return 'bg-green-950 text-green-300 border-green-800';
  if (score >= 50) return 'bg-dream-500/10 text-dream-300 border-dream-800';
  if (score >= 30) return 'bg-amber-950 text-amber-300 border-amber-800';
  return 'bg-red-950 text-red-300 border-red-800';
}

export function ReadinessDetailedCard({ readiness, factors, previousFactors }: ReadinessDetailedCardProps) {
  const [showDetails, setShowDetails] = useState(true);
  const BatteryIcon = getBatteryIcon(readiness.score);
  const isUnknown = readiness.score === null;

  // When readiness is unknown, breakdown scores are meaningless (all 0)
  const breakdownScore = (value: number): number | null => isUnknown ? null : value;

  // Format sleep hours
  const formatSleepHours = (hours?: number) => {
    if (!hours) return 'No data';
    return `${hours.toFixed(1)} hrs`;
  };

  // Format TSB with interpretation
  const formatTSB = (tsb?: number) => {
    if (tsb === undefined) return 'No data';
    if (tsb > 15) return `TSB: ${tsb.toFixed(0)} (very fresh)`;
    if (tsb > 5) return `TSB: ${tsb.toFixed(0)} (fresh)`;
    if (tsb > -10) return `TSB: ${tsb.toFixed(0)} (balanced)`;
    if (tsb > -20) return `TSB: ${tsb.toFixed(0)} (fatigued)`;
    return `TSB: ${tsb.toFixed(0)} (very fatigued)`;
  };

  // Get trend icon
  const getTrendIcon = (current?: number, previous?: number) => {
    if (!current || !previous) return null;
    const diff = current - previous;
    if (Math.abs(diff) < 0.1) return null;
    return diff > 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />;
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BatteryIcon className={cn('w-6 h-6', readiness.color)} />
            <div>
              <h3 className="font-semibold text-primary">Readiness Score</h3>
              <p className="text-xs text-textTertiary">How prepared you are to train today</p>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 hover:bg-surface-interactive-hover rounded-lg transition-colors flex items-center gap-1"
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-4 h-4 text-tertiary" />
                <span className="text-xs text-textTertiary">Hide</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-tertiary" />
                <span className="text-xs text-textTertiary">Details</span>
              </>
            )}
          </button>
        </div>

        {/* Score and Status */}
        <div className="flex items-end gap-4 mb-3">
          <div className={cn('text-5xl font-bold', readiness.color)}>
            {isUnknown ? '--' : readiness.score}
          </div>
          <div className="flex-1">
            <div className={cn('font-medium', readiness.color)}>{readiness.label}</div>
            <div className="text-sm text-textSecondary">{readiness.recommendation}</div>
          </div>
        </div>

        {/* Limiting Factor Alert */}
        {readiness.limitingFactor && readiness.score !== null && readiness.score < 70 && (
          <div className="flex items-center gap-2 p-3 bg-amber-950 rounded-lg border border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-amber-300">Primary limiter:</span>{' '}
              <span className="text-amber-400">{readiness.limitingFactor}</span>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="border-t border-borderPrimary p-5 space-y-3">
          {/* Sleep Category */}
          <CategoryBreakdown
            icon={Moon}
            title="Sleep"
            score={breakdownScore(readiness.breakdown.sleep)}
            details={[
              {
                label: 'Duration',
                value: formatSleepHours(factors.sleepHours),
                trend: getTrendIcon(factors.sleepHours, previousFactors?.sleepHours),
                status: factors.sleepHours && factors.sleepHours < 6 ? 'poor' :
                        factors.sleepHours && factors.sleepHours < 7 ? 'fair' : 'good'
              },
              {
                label: 'Quality',
                value: factors.sleepQuality ? `${factors.sleepQuality}/5` : 'No data',
                trend: getTrendIcon(factors.sleepQuality, previousFactors?.sleepQuality),
                status: factors.sleepQuality && factors.sleepQuality <= 2 ? 'poor' :
                        factors.sleepQuality && factors.sleepQuality <= 3 ? 'fair' : 'good'
              }
            ]}
          />

          {/* Training Category */}
          <CategoryBreakdown
            icon={Dumbbell}
            title="Training"
            score={breakdownScore(readiness.breakdown.training)}
            details={[
              {
                label: 'Fatigue',
                value: formatTSB(factors.tsb),
                trend: getTrendIcon(factors.tsb, previousFactors?.tsb),
                status: factors.tsb && factors.tsb < -20 ? 'poor' :
                        factors.tsb && factors.tsb < -10 ? 'fair' : 'good'
              },
              {
                label: 'Yesterday',
                value: factors.yesterdayRpe ? `RPE ${factors.yesterdayRpe}/10` :
                        factors.restDaysBefore && factors.restDaysBefore > 0 ? `Rest (${factors.restDaysBefore}d ago)` :
                        'No workout',
                status: factors.yesterdayRpe && factors.yesterdayRpe >= 8 ? 'fair' : 'good'
              }
            ]}
          />

          {/* Physical Category */}
          <CategoryBreakdown
            icon={Heart}
            title="Physical"
            score={breakdownScore(readiness.breakdown.physical)}
            details={[
              {
                label: 'Soreness',
                value: factors.soreness ? `${factors.soreness}/5` : 'No data',
                trend: getTrendIcon(factors.soreness ? -factors.soreness : undefined,
                                  previousFactors?.soreness ? -previousFactors.soreness : undefined),
                status: factors.soreness && factors.soreness >= 4 ? 'poor' :
                        factors.soreness && factors.soreness >= 3 ? 'fair' : 'good'
              },
              {
                label: 'Legs',
                value: factors.legsFeel ? ['Heavy', 'Tired', 'Normal', 'Good', 'Great'][factors.legsFeel - 1] : 'No data',
                status: factors.legsFeel && factors.legsFeel <= 2 ? 'poor' :
                        factors.legsFeel && factors.legsFeel <= 3 ? 'fair' : 'good'
              }
            ]}
          />

          {/* Life Category */}
          <CategoryBreakdown
            icon={Brain}
            title="Life"
            score={breakdownScore(readiness.breakdown.life)}
            details={[
              {
                label: 'Stress',
                value: factors.stress ? `${factors.stress}/5` : 'No data',
                trend: getTrendIcon(factors.stress ? -factors.stress : undefined,
                                  previousFactors?.stress ? -previousFactors.stress : undefined),
                status: factors.stress && factors.stress >= 4 ? 'poor' :
                        factors.stress && factors.stress >= 3 ? 'fair' : 'good'
              },
              {
                label: 'Mood',
                value: factors.mood ? ['Poor', 'Low', 'OK', 'Good', 'Great'][factors.mood - 1] : 'No data',
                status: factors.mood && factors.mood <= 2 ? 'poor' :
                        factors.mood && factors.mood <= 3 ? 'fair' : 'good'
              }
            ]}
          />
        </div>
      )}
    </div>
  );
}

interface CategoryBreakdownProps {
  icon: typeof Moon;
  title: string;
  score: number | null;
  details: Array<{
    label: string;
    value: string;
    trend?: React.ReactNode;
    status?: 'good' | 'fair' | 'poor';
  }>;
}

function CategoryBreakdown({ icon: Icon, title, score, details }: CategoryBreakdownProps) {
  const getDetailColor = (status?: 'good' | 'fair' | 'poor') => {
    switch (status) {
      case 'poor': return 'text-red-600';
      case 'fair': return 'text-amber-600';
      case 'good': return 'text-green-600';
      default: return 'text-textSecondary';
    }
  };

  return (
    <div className={cn('rounded-lg border p-3', getCategoryColor(score))}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="font-medium">{title}</span>
        </div>
        <span className={cn('font-bold', getScoreColor(score))}>
          {score !== null ? `${score}%` : '--'}
        </span>
      </div>
      <div className="space-y-1">
        {details.map((detail, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="text-textSecondary">{detail.label}:</span>
            <div className="flex items-center gap-1">
              <span className={cn('font-medium', getDetailColor(detail.status))}>
                {detail.value}
              </span>
              {detail.trend}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}