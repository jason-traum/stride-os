'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight, X, User } from 'lucide-react';
import type { UserSettings } from '@/lib/schema';

interface ProfileCompletionProps {
  settings: UserSettings;
  onDismiss?: () => void;
}

interface CompletionItem {
  key: keyof UserSettings;
  label: string;
  required: boolean;
  category: 'basic' | 'running' | 'preferences';
}

const COMPLETION_ITEMS: CompletionItem[] = [
  // Basic Info
  { key: 'age', label: 'Age', required: true, category: 'basic' },
  { key: 'restingHr', label: 'Resting Heart Rate', required: true, category: 'basic' },

  // Running Stats
  { key: 'weeklyMileage', label: 'Weekly Mileage', required: true, category: 'running' },
  { key: 'easyPaceSeconds', label: 'Easy Pace', required: true, category: 'running' },
  { key: 'tempoPaceSeconds', label: 'Tempo Pace', required: false, category: 'running' },
  { key: 'thresholdPaceSeconds', label: 'Threshold Pace', required: false, category: 'running' },
  { key: 'intervalPaceSeconds', label: 'Interval Pace', required: false, category: 'running' },
  { key: 'vdot', label: 'VDOT', required: false, category: 'running' },

  // Preferences
  { key: 'preferredRunTime', label: 'Preferred Run Time', required: false, category: 'preferences' },
  { key: 'runQualityDays', label: 'Quality Workout Days', required: false, category: 'preferences' },
];

export function ProfileCompletion({ settings, onDismiss }: ProfileCompletionProps) {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Calculate completion
  const completedItems = COMPLETION_ITEMS.filter(item => {
    const value = settings[item.key];
    return value !== null && value !== undefined && value !== '';
  });

  const requiredItems = COMPLETION_ITEMS.filter(item => item.required);
  const completedRequired = requiredItems.filter(item => {
    const value = settings[item.key];
    return value !== null && value !== undefined && value !== '';
  });

  const percentage = Math.round((completedItems.length / COMPLETION_ITEMS.length) * 100);
  const isComplete = completedRequired.length === requiredItems.length;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('profileCompletionDismissed', 'true');
    onDismiss?.();
  };

  // Don't show if complete or dismissed
  if (isComplete || dismissed) return null;

  // Check if previously dismissed
  if (typeof window !== 'undefined' && localStorage.getItem('profileCompletionDismissed') === 'true') {
    return null;
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accentTeal/20 rounded-lg">
              <User className="w-5 h-5 text-accentTeal" />
            </div>
            <div>
              <h3 className="font-semibold text-textPrimary">
                Complete Your Profile ({percentage}%)
              </h3>
              <p className="text-sm text-textSecondary">
                Add more details for better AI coaching accuracy
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-bgTertiary rounded-full h-2 mb-3">
            <div
              className="bg-accentTeal h-2 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {expanded && (
            <div className="space-y-2 mb-3">
              {['basic', 'running', 'preferences'].map(category => {
                const categoryItems = COMPLETION_ITEMS.filter(item => item.category === category);
                const categoryCompleted = categoryItems.filter(item => {
                  const value = settings[item.key];
                  return value !== null && value !== undefined && value !== '';
                });

                if (categoryCompleted.length === categoryItems.length) return null;

                return (
                  <div key={category}>
                    <p className="text-xs font-medium text-textTertiary uppercase mb-1">
                      {category === 'basic' ? 'Basic Info' : category === 'running' ? 'Running Stats' : 'Preferences'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {categoryItems.map(item => {
                        const isComplete = settings[item.key] !== null && settings[item.key] !== undefined && settings[item.key] !== '';
                        return (
                          <div
                            key={item.key}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                              isComplete
                                ? 'bg-accentTeal/20 text-accentTeal'
                                : 'bg-bgTertiary text-textSecondary'
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <Circle className="w-3 h-3" />
                            )}
                            {item.label}
                            {item.required && !isComplete && <span className="text-red-500">*</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-accentTeal hover:bg-accentTeal/90 text-white text-sm rounded-lg font-medium transition-colors"
            >
              Complete Profile
              <ChevronRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-1.5 text-sm text-textSecondary hover:text-primary dark:hover:text-stone-100 transition-colors"
            >
              {expanded ? 'Collapse' : 'Show Details'}
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 text-textTertiary hover:text-textPrimary transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}