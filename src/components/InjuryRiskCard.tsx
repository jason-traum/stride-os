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
      case 'low': return 'text-green-600 bg-green-50';
      case 'moderate': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-stone-600 bg-stone-50';
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
                : "bg-stone-200"
            )}
          />
        ))}
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
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
          <span className="text-2xl font-bold text-stone-900">{data.riskScore}%</span>
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
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          Injury Risk Assessment
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-stone-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-stone-500" />
          )}
        </button>
      </div>

      {/* Risk Score Display */}
      <div className={cn(
        "rounded-lg p-4 mb-4",
        data.riskLevel === 'critical' ? "bg-red-50" :
        data.riskLevel === 'high' ? "bg-orange-50" :
        data.riskLevel === 'moderate' ? "bg-yellow-50" :
        "bg-green-50"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-stone-600">Overall Risk Score</p>
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
          <div className="border-t border-red-200 pt-3 mt-3">
            {data.warnings.map((warning, index) => (
              <div key={index} className="flex items-start gap-2 text-sm text-red-700 mb-1">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Key Risk Factors */}
      <div className="space-y-3 mb-4">
        <h4 className="text-sm font-medium text-stone-700">Risk Factors</h4>
        {data.factors.slice(0, expanded ? undefined : 3).map((factor, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-stone-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              {getFactorIcon(factor.impact, factor.score)}
              <div>
                <p className="text-sm font-medium text-stone-900">{factor.factor}</p>
                <p className="text-xs text-stone-600">{factor.description}</p>
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
        <h4 className="text-sm font-medium text-stone-700">Recommendations</h4>
        {data.recommendations.slice(0, expanded ? undefined : 2).map((rec, index) => (
          <div key={index} className="flex items-start gap-2 text-sm text-stone-600">
            <span className="text-indigo-600">•</span>
            <span>{rec}</span>
          </div>
        ))}
      </div>

      {/* Historical Injuries (if expanded) */}
      {expanded && data.historicalInjuries && data.historicalInjuries.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <h4 className="text-sm font-medium text-stone-700 mb-2">Injury History</h4>
          <div className="space-y-2">
            {data.historicalInjuries.map((injury, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-stone-600">
                <Activity className="w-4 h-4 text-stone-400" />
                <span>{injury.type}</span>
                {injury.notes && (
                  <span className="text-xs text-stone-400">({injury.notes})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}