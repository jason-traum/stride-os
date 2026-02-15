'use client';

import { useState } from 'react';
import { Brain, Clock, Target, Heart, AlertTriangle, TrendingUp, MessageSquare, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CoachingInsight, ConversationSummary } from '@/lib/db/coaching-memory';
import { deleteCoachingInsight } from './actions';
import { useToast } from '@/components/Toast';

interface MemoryDashboardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupedInsights: Record<string, (CoachingInsight & { metadata: any })[]>;
  summaries: (ConversationSummary & {
    keyDecisions: string[];
    keyPreferences: string[];
    keyFeedback: string[];
    tags: string[];
  })[];
  profileId: number;
}

const categoryConfig = {
  preference: {
    label: 'Preferences',
    icon: Heart,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  injury: {
    label: 'Injuries & Health',
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  goal: {
    label: 'Goals',
    icon: Target,
    color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  constraint: {
    label: 'Constraints',
    icon: Clock,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  pattern: {
    label: 'Patterns',
    icon: TrendingUp,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  feedback: {
    label: 'Feedback',
    icon: MessageSquare,
    color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30',
    borderColor: 'border-teal-200 dark:border-teal-800',
  },
};

export function MemoryDashboard({ groupedInsights, summaries, profileId }: MemoryDashboardProps) {
  const [activeTab, setActiveTab] = useState<'insights' | 'summaries'>('insights');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const { showToast } = useToast();

  const categories = Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>;

  const handleDeleteInsight = async (insightId: number) => {
    if (deletingIds.has(insightId)) return;

    setDeletingIds(prev => new Set(prev).add(insightId));

    try {
      const result = await deleteCoachingInsight(insightId, profileId);

      if (result.success) {
        showToast('Insight removed', 'success');
      } else {
        showToast(result.error || 'Failed to remove insight', 'error');
      }
    } catch {
      showToast('An error occurred', 'error');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(insightId);
        return next;
      });
    }
  };

  const getConfidenceIndicator = (confidence: number) => {
    if (confidence >= 0.8) return { icon: CheckCircle, color: 'text-green-600', label: 'High confidence' };
    if (confidence >= 0.6) return { icon: CheckCircle, color: 'text-yellow-600', label: 'Medium confidence' };
    return { icon: XCircle, color: 'text-tertiary', label: 'Low confidence' };
  };

  const getAgeLabel = (createdAt: string) => {
    const daysAgo = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo < 7) return `${daysAgo} days ago`;
    if (daysAgo < 30) return `${Math.floor(daysAgo / 7)} weeks ago`;
    return `${Math.floor(daysAgo / 30)} months ago`;
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-bgTertiary p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('insights')}
          className={cn(
            'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'insights'
              ? 'bg-bgSecondary text-textPrimary shadow-sm'
              : 'text-textSecondary hover:text-textPrimary'
          )}
        >
          <Brain className="w-4 h-4 inline-block mr-2" />
          Insights
        </button>
        <button
          onClick={() => setActiveTab('summaries')}
          className={cn(
            'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'summaries'
              ? 'bg-bgSecondary text-textPrimary shadow-sm'
              : 'text-textSecondary hover:text-textPrimary'
          )}
        >
          <MessageSquare className="w-4 h-4 inline-block mr-2" />
          Conversation Summaries
        </button>
      </div>

      {activeTab === 'insights' ? (
        <div className="space-y-6">
          {/* Category Overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map(category => {
              const config = categoryConfig[category];
              const insights = groupedInsights[category] || [];
              const Icon = config.icon;

              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category === selectedCategory ? null : category)}
                  className={cn(
                    'p-4 rounded-lg border transition-all',
                    selectedCategory === category
                      ? `${config.color} ${config.borderColor} border-2`
                      : 'bg-surface-1 border-default hover:border-strong'
                  )}
                >
                  <Icon className={cn('w-5 h-5 mb-2', selectedCategory === category ? '' : 'text-textSecondary')} />
                  <div className="font-medium text-sm">{config.label}</div>
                  <div className="text-xs text-textTertiary mt-1">
                    {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Insights List */}
          <div className="space-y-4">
            {selectedCategory ? (
              <div>
                <h3 className="text-lg font-medium text-primary mb-3">
                  {categoryConfig[selectedCategory as keyof typeof categoryConfig].label}
                </h3>
                <div className="space-y-2">
                  {(groupedInsights[selectedCategory] || []).map(insight => {
                    const confidence = getConfidenceIndicator(insight.confidence);
                    const ConfidenceIcon = confidence.icon;

                    return (
                      <div
                        key={insight.id}
                        className="p-4 bg-surface-1 rounded-lg border border-default hover:border-strong transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-primary">{insight.insight}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-textTertiary">
                              <span className="flex items-center gap-1">
                                <ConfidenceIcon className={cn('w-3 h-3', confidence.color)} />
                                {Math.round(insight.confidence * 100)}%
                              </span>
                              <span>{insight.source === 'explicit' ? 'Stated directly' : 'Inferred'}</span>
                              <span>{getAgeLabel(insight.createdAt)}</span>
                              {insight.expiresAt && (
                                <span className="text-orange-600">
                                  Expires {getAgeLabel(insight.expiresAt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteInsight(insight.id)}
                            disabled={deletingIds.has(insight.id)}
                            className={cn(
                              "ml-4 p-1.5 text-tertiary hover:text-red-600 hover:bg-red-50 dark:bg-red-950 rounded transition-colors",
                              deletingIds.has(insight.id) && "opacity-50 cursor-not-allowed"
                            )}
                            title="Delete insight"
                          >
                            <Trash2 className={cn("w-4 h-4", deletingIds.has(insight.id) && "animate-pulse")} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-textTertiary">
                <Brain className="w-12 h-12 mx-auto mb-4 text-tertiary" />
                <p>Select a category to view insights</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {summaries.length > 0 ? (
            summaries.map(summary => (
              <div
                key={summary.id}
                className="p-4 bg-surface-1 rounded-lg border border-default hover:border-strong transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-primary">
                      {new Date(summary.conversationDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h4>
                    <p className="text-xs text-textTertiary">{summary.messageCount} messages</p>
                  </div>
                  {summary.tags.length > 0 && (
                    <div className="flex gap-1">
                      {summary.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-bgTertiary text-textSecondary text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-sm text-secondary mb-3">{summary.summary}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {summary.keyDecisions.length > 0 && (
                    <div>
                      <h5 className="font-medium text-primary mb-1">Decisions</h5>
                      <ul className="space-y-1">
                        {summary.keyDecisions.map((decision, idx) => (
                          <li key={idx} className="text-textSecondary text-xs">• {decision}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.keyPreferences.length > 0 && (
                    <div>
                      <h5 className="font-medium text-primary mb-1">Preferences</h5>
                      <ul className="space-y-1">
                        {summary.keyPreferences.map((pref, idx) => (
                          <li key={idx} className="text-textSecondary text-xs">• {pref}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.keyFeedback.length > 0 && (
                    <div>
                      <h5 className="font-medium text-primary mb-1">Feedback</h5>
                      <ul className="space-y-1">
                        {summary.keyFeedback.map((feedback, idx) => (
                          <li key={idx} className="text-textSecondary text-xs">• {feedback}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-textTertiary">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-textTertiary" />
              <p className="text-textSecondary">No conversation summaries yet</p>
              <p className="text-sm mt-2 text-textTertiary">Summaries will appear here after longer coaching sessions</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}