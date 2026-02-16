'use client';

import { useState } from 'react';
import { User, ChevronRight, Star, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ProfileCompleteness {
  percentage: number;
  completedFields: string[];
  missingFields: {
    field: string;
    label: string;
    importance: 'high' | 'medium' | 'low';
    description: string;
  }[];
  suggestions: string[];
}

interface ProfileCompletenessCardProps {
  data: ProfileCompleteness;
  variant?: 'full' | 'compact';
}

export function ProfileCompletenessCard({ data, variant = 'full' }: ProfileCompletenessCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-9500';
    if (percentage >= 60) return 'bg-blue-9500';
    if (percentage >= 40) return 'bg-yellow-9500';
    return 'bg-orange-500';
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return 'text-red-600 bg-red-950 border-red-800';
      case 'medium': return 'text-yellow-600 bg-yellow-950 border-yellow-800';
      case 'low': return 'text-green-600 bg-green-950 border-green-800';
      default: return 'text-textSecondary bg-bgTertiary border-borderPrimary';
    }
  };

  if (variant === 'compact') {
    return (
      <Link href="/profile">
        <div className="card-interactive p-4 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-dream-500/20 rounded-xl group-hover:scale-105 transition-transform">
                  <User className="w-5 h-5 text-dream-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">Profile Completion</p>
                  <p className="text-2xl font-bold text-primary">{data.percentage}%</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-tertiary group-hover:text-dream-500 transition-colors" />
            </div>
            <div className="mt-3">
              <div className="h-2 bg-bgTertiary rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    getProgressColor(data.percentage)
                  )}
                  style={{ width: `${data.percentage}%` }}
                />
              </div>
              <p className="text-xs text-textTertiary mt-2">
                {data.missingFields.filter(f => f.importance === 'high').length > 0
                  ? `${data.missingFields.filter(f => f.importance === 'high').length} high-priority fields missing`
                  : 'Complete more fields for better recommendations'}
              </p>
            </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="w-5 h-5 text-dream-500" />
          Profile Completeness
        </h3>
        <span className="text-2xl font-bold text-dream-500">{data.percentage}%</span>
      </div>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="h-4 bg-bgTertiary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 relative",
                getProgressColor(data.percentage)
              )}
              style={{ width: `${data.percentage}%` }}
            >
              {data.percentage >= 20 && (
                <div className="absolute inset-0 bg-bgSecondary/20 animate-pulse" />
              )}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-textTertiary">
            <span>Getting Started</span>
            <span>Complete Profile</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-950 p-3 rounded-lg text-center">
            <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">{data.completedFields.length}</p>
            <p className="text-xs text-green-300">Completed</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg text-center">
            <AlertCircle className="w-5 h-5 text-orange-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-600">{data.missingFields.length}</p>
            <p className="text-xs text-orange-700">Remaining</p>
          </div>
        </div>

        {/* Suggestions */}
        {data.suggestions.length > 0 && (
          <div className="bg-dream-500/10 p-4 rounded-lg">
            <p className="text-sm font-medium text-dream-300 mb-2 flex items-center gap-1">
              <Star className="w-4 h-4" />
              Next Steps
            </p>
            {data.suggestions.slice(0, 2).map((suggestion, index) => (
              <p key={index} className="text-xs text-dream-400 mb-1">
                • {suggestion}
              </p>
            ))}
          </div>
        )}

        {/* Missing Fields Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full py-2 text-sm font-semibold text-dream-400 hover:text-dream-300 transition-colors flex items-center justify-center gap-2"
        >
          {showDetails ? 'Hide' : 'Show'} Missing Fields
          <ChevronRight className={cn(
            "w-4 h-4 transition-transform",
            showDetails && "rotate-90"
          )} />
        </button>

        {/* Missing Fields Details */}
        {showDetails && (
          <div className="space-y-2">
            {['high', 'medium', 'low'].map(importance => {
              const fields = data.missingFields.filter(f => f.importance === importance);
              if (fields.length === 0) return null;

              return (
                <div key={importance} className="space-y-1">
                  <p className="text-xs font-medium text-textSecondary uppercase mb-1">
                    {importance} Priority
                  </p>
                  {fields.map((field) => (
                    <div
                      key={field.field}
                      className={cn(
                        "p-3 rounded-lg border text-sm",
                        getImportanceColor(importance)
                      )}
                    >
                      <p className="font-medium mb-1">{field.label}</p>
                      <p className="text-xs opacity-90">{field.description}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* CTA Button */}
        <Link
          href="/profile"
          className="block w-full py-3 px-4 bg-dream-600 hover:bg-dream-700 text-white font-semibold rounded-xl text-center transition-all shadow-sm"
        >
          Complete Your Profile
        </Link>
      </div>
    </div>
  );
}