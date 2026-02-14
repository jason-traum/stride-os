'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InjuryRiskAssessment } from '@/lib/injury-risk';

interface InjuryRiskCardProps {
  data: InjuryRiskAssessment;
  variant?: 'full' | 'compact';
}

export function InjuryRiskCard({ data, variant = 'full' }: InjuryRiskCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getRiskColor = (level: InjuryRiskAssessment['riskLevel']) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-50 dark:bg-green-950';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50 dark:bg-red-950';
      default: return 'text-textSecondary bg-bgTertiary';
    }
  };

  const getFactorIcon = (impact: string, score: number) => {
    if (impact === 'positive') {
      return <Shield className="w-4 h-4 text-green-600" />;
    } else if (score >= 70) {
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    } else if (score >= 50) {
      return <TrendingUp className="w-4 h-4 text-orange-600" />;
    } else {
      return <TrendingDown className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getRiskMeter = (score: number) => {
    const segments = 10;
    const filledSegments = Math.round((score / 100) * segments);

    return (
      <div className="flex gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-6 w-2 rounded-sm",
              i < filledSegments
                ? score >= 75 ? "bg-red-500"
                : score >= 50 ? "bg-orange-500"
                : score >= 30 ? "bg-yellow-500"
                : "bg-green-500"
                : "bg-bgTertiary"
            )}
          />
        ))}
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Injury Risk
          </h3>
          <span className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            getRiskColor(data.riskLevel)
          )}>
            {data.riskLevel}
          </span>
        </div>

        <div className="flex items-center justify-between">
          {getRiskMeter(data.riskScore)}
          <span className="text-2xl font-bold text-primary">{data.riskScore}%</span>
        </div>

        {data.warnings.length > 0 && (
          <p className="text-xs text-red-600 mt-2">
            ⚠️ {data.warnings[0]}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          Injury Risk Assessment
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-surface-interactive-hover rounded-lg transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-textTertiary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-textTertiary" />
          )}
        </button>
      </div>

      {/* Risk Score Display */}
      <div className={cn(
        "rounded-lg p-4 mb-4",
        data.riskLevel === 'critical' ? "bg-red-50 dark:bg-red-950" :
        data.riskLevel === 'high' ? "bg-orange-50" :
        data.riskLevel === 'moderate' ? "bg-yellow-50 dark:bg-yellow-950" :
        "bg-green-50 dark:bg-green-950"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-textSecondary">Overall Risk Score</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className={cn(
                "text-3xl font-bold",
                data.riskLevel === 'critical' ? "text-red-600" :
                data.riskLevel === 'high' ? "text-orange-600" :
                data.riskLevel === 'moderate' ? "text-yellow-600" :
                "text-green-600"
              )}>
                {data.riskScore}%
              </span>
              <span className={cn(
                "text-sm font-medium uppercase",
                getRiskColor(data.riskLevel).split(' ')[0]
              )}>
                {data.riskLevel} Risk
              </span>
            </div>
          </div>
          <div className="text-right">
            {getRiskMeter(data.riskScore)}
          </div>
        </div>

        {/* Warnings */}
        {data.warnings.length > 0 && (
          <div className="border-t border-red-200 dark:border-red-800 pt-3 mt-3">
            {data.warnings.map((warning, index) => (
              <div key={index} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 mb-1">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Key Risk Factors */}
      <div className="space-y-3 mb-4">
        <h4 className="text-sm font-medium text-textSecondary">Risk Factors</h4>
        {data.factors.slice(0, expanded ? undefined : 3).map((factor, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-bgTertiary rounded-lg"
          >
            <div className="flex items-center gap-3">
              {getFactorIcon(factor.impact, factor.score)}
              <div>
                <p className="text-sm font-medium text-primary">{factor.factor}</p>
                <p className="text-xs text-textSecondary">{factor.description}</p>
              </div>
            </div>
            <span className={cn(
              "text-sm font-medium",
              factor.impact === 'positive' ? "text-green-600" :
              factor.score >= 70 ? "text-red-600" :
              factor.score >= 50 ? "text-orange-600" :
              "text-yellow-600"
            )}>
              {factor.score}%
            </span>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-textSecondary">Recommendations</h4>
        {data.recommendations.slice(0, expanded ? undefined : 2).map((rec, index) => (
          <div key={index} className="flex items-start gap-2 text-sm text-textSecondary">
            <span className="text-indigo-600">•</span>
            <span>{rec}</span>
          </div>
        ))}
      </div>

      {/* Historical Injuries (if expanded) */}
      {expanded && data.historicalInjuries && data.historicalInjuries.length > 0 && (
        <div className="mt-4 pt-4 border-t border-borderSecondary">
          <h4 className="text-sm font-medium text-textSecondary mb-2">Injury History</h4>
          <div className="space-y-2">
            {data.historicalInjuries.map((injury, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-textSecondary">
                <Activity className="w-4 h-4 text-tertiary" />
                <span>{injury.type}</span>
                {injury.notes && (
                  <span className="text-xs text-tertiary">({injury.notes})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}