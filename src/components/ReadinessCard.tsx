'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Battery, BatteryLow, BatteryMedium, BatteryFull, Info, X, Moon, Dumbbell, Heart, Brain, Clock } from 'lucide-react';
import type { ReadinessResult } from '@/lib/readiness';

interface ReadinessCardProps {
  readiness: ReadinessResult;
  showBreakdown?: boolean;
}

function getBatteryIcon(score: number | null) {
  if (score === null) return Battery;
  if (score >= 75) return BatteryFull;
  if (score >= 50) return BatteryMedium;
  if (score >= 25) return BatteryLow;
  return Battery;
}

function getGaugeRotation(score: number | null): number {
  if (score === null) return -90; // Needle at far left
  // Map 0-100 to -90 to 90 degrees
  return -90 + (score / 100) * 180;
}

export function ReadinessCard({ readiness, showBreakdown = true }: ReadinessCardProps) {
  const [showInfo, setShowInfo] = useState(false);

  const BatteryIcon = getBatteryIcon(readiness.score);
  const gaugeRotation = getGaugeRotation(readiness.score);
  const isUnknown = readiness.score === null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BatteryIcon className={cn('w-5 h-5', readiness.color)} />
          <h3 className="font-semibold text-primary">Readiness</h3>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 hover:bg-surface-interactive-hover rounded-full transition-colors"
        >
          <Info className="w-4 h-4 text-tertiary" />
        </button>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="mb-4 p-3 bg-surface-1 rounded-lg text-sm text-textSecondary">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-2">
                <strong>Readiness</strong> estimates how prepared your body is for training based on:
              </p>
              <ul className="text-xs space-y-1 ml-2">
                <li>• Sleep quality and duration (35%)</li>
                <li>• Training load and fatigue (25%)</li>
                <li>• Physical state and soreness (25%)</li>
                <li>• Life stress and mood (15%)</li>
              </ul>
            </div>
            <button onClick={() => setShowInfo(false)} className="p-1 hover:bg-dream-500/10 rounded">
              <X className="w-4 h-4 text-tertiary" />
            </button>
          </div>
        </div>
      )}

      {/* Score Display */}
      <div className="flex items-center gap-6 mb-4">
        {/* Gauge */}
        <div className="relative w-24 h-12 overflow-hidden">
          {/* Background arc */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-8 border-borderSecondary" />
          {/* Colored arc segments */}
          <svg className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-12" viewBox="0 0 100 50">
            <defs>
              <linearGradient id="readinessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="35%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="75%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="url(#readinessGradient)"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </svg>
          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 w-0.5 h-10 bg-textPrimary origin-bottom rounded-full"
            style={{ transform: `translateX(-50%) rotate(${gaugeRotation}deg)` }}
          />
          {/* Center dot */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-textPrimary rounded-full" />
        </div>

        {/* Score and Label */}
        <div>
          <div className={cn('text-4xl font-bold', readiness.color)}>
            {isUnknown ? '--' : readiness.score}
          </div>
          <div className={cn('text-sm font-medium', readiness.color)}>{readiness.label}</div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-bgTertiary rounded-lg p-3 mb-4">
        <p className="text-sm text-textSecondary">{readiness.recommendation}</p>
        {readiness.limitingFactor && (
          <p className="text-xs text-textTertiary mt-1">
            Primary limiter: <span className="font-medium">{readiness.limitingFactor}</span>
          </p>
        )}
      </div>

      {/* Staleness Indicator */}
      {readiness.isStale && readiness.daysSinceAssessment !== undefined && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-amber-950/50 border border-amber-800/50">
          <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            Last assessed {readiness.daysSinceAssessment} {readiness.daysSinceAssessment === 1 ? 'day' : 'days'} ago
          </p>
        </div>
      )}

      {/* Breakdown */}
      {showBreakdown && !isUnknown && (
        <div className="grid grid-cols-4 gap-2">
          <BreakdownItem
            icon={Moon}
            label="Sleep"
            score={readiness.breakdown.sleep}
          />
          <BreakdownItem
            icon={Dumbbell}
            label="Training"
            score={readiness.breakdown.training}
          />
          <BreakdownItem
            icon={Heart}
            label="Physical"
            score={readiness.breakdown.physical}
          />
          <BreakdownItem
            icon={Brain}
            label="Life"
            score={readiness.breakdown.life}
          />
        </div>
      )}
    </div>
  );
}

function BreakdownItem({
  icon: Icon,
  label,
  score,
}: {
  icon: typeof Moon;
  label: string;
  score: number;
}) {
  const getBarColor = (s: number) => {
    if (s >= 70) return 'bg-green-500';
    if (s >= 50) return 'bg-dream-500';
    if (s >= 30) return 'bg-rose-400';
    return 'bg-red-500';
  };

  return (
    <div className="text-center">
      <Icon className="w-4 h-4 mx-auto text-tertiary mb-1" />
      <div className="h-1.5 bg-bgTertiary rounded-full overflow-hidden mb-1">
        <div
          className={cn('h-full rounded-full transition-all', getBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="text-[10px] text-textTertiary">{label}</div>
    </div>
  );
}
