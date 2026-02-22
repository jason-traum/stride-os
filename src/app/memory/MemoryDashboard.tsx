'use client';

import { useState, useMemo } from 'react';
import {
  Brain,
  Clock,
  Target,
  Heart,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Trash2,
  Search,
  X,
  Sparkles,
  Eye,
  ShieldCheck,
  ShieldAlert,
  CalendarClock,
} from 'lucide-react';
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
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-900/20',
    borderColor: 'border-blue-800/50',
    activeBg: 'bg-blue-900/30',
    activeBorder: 'border-blue-600',
    dotColor: 'bg-blue-400',
  },
  injury: {
    label: 'Injuries & Health',
    icon: AlertTriangle,
    iconColor: 'text-red-400',
    bgColor: 'bg-red-900/20',
    borderColor: 'border-red-800/50',
    activeBg: 'bg-red-900/30',
    activeBorder: 'border-red-600',
    dotColor: 'bg-red-400',
  },
  goal: {
    label: 'Goals',
    icon: Target,
    iconColor: 'text-green-400',
    bgColor: 'bg-green-900/20',
    borderColor: 'border-green-800/50',
    activeBg: 'bg-green-900/30',
    activeBorder: 'border-green-600',
    dotColor: 'bg-green-400',
  },
  constraint: {
    label: 'Constraints',
    icon: Clock,
    iconColor: 'text-orange-400',
    bgColor: 'bg-orange-900/20',
    borderColor: 'border-orange-800/50',
    activeBg: 'bg-orange-900/30',
    activeBorder: 'border-orange-600',
    dotColor: 'bg-orange-400',
  },
  pattern: {
    label: 'Patterns',
    icon: TrendingUp,
    iconColor: 'text-dream-400',
    bgColor: 'bg-dream-900/20',
    borderColor: 'border-dream-800/50',
    activeBg: 'bg-dream-900/30',
    activeBorder: 'border-dream-600',
    dotColor: 'bg-dream-400',
  },
  feedback: {
    label: 'Feedback',
    icon: MessageSquare,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-900/20',
    borderColor: 'border-amber-800/50',
    activeBg: 'bg-amber-900/30',
    activeBorder: 'border-amber-600',
    dotColor: 'bg-amber-400',
  },
};

type CategoryKey = keyof typeof categoryConfig;

export function MemoryDashboard({ groupedInsights, summaries, profileId }: MemoryDashboardProps) {
  const [activeTab, setActiveTab] = useState<'insights' | 'summaries'>('insights');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const { showToast } = useToast();

  const categories = Object.keys(categoryConfig) as CategoryKey[];

  // Compute total count and all insights flat list
  const allInsights = useMemo(() => {
    return Object.values(groupedInsights).flat();
  }, [groupedInsights]);

  const totalInsights = allInsights.length;

  // Filtered insights based on category + search
  const filteredInsights = useMemo(() => {
    let insights = selectedCategory === 'all'
      ? allInsights
      : (groupedInsights[selectedCategory] || []);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      insights = insights.filter(i =>
        i.insight.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.subcategory && i.subcategory.toLowerCase().includes(q))
      );
    }

    return insights;
  }, [allInsights, groupedInsights, selectedCategory, searchQuery]);

  const handleDeleteInsight = async (insightId: number) => {
    if (deletingIds.has(insightId)) return;

    setDeletingIds(prev => new Set(prev).add(insightId));
    setConfirmDeleteId(null);

    try {
      const result = await deleteCoachingInsight(insightId, profileId);

      if (result.success) {
        showToast('Memory removed', 'success');
      } else {
        showToast(result.error || 'Failed to remove memory', 'error');
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

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 0.85) return { label: 'High', color: 'bg-green-500', textColor: 'text-green-400' };
    if (confidence >= 0.7) return { label: 'Good', color: 'bg-blue-500', textColor: 'text-blue-400' };
    if (confidence >= 0.5) return { label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-400' };
    return { label: 'Low', color: 'bg-text-tertiary', textColor: 'text-textTertiary' };
  };

  const getStaleness = (lastValidated: string) => {
    const daysAgo = Math.floor((Date.now() - new Date(lastValidated).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo <= 7) return { label: 'Fresh', color: 'text-green-400', icon: ShieldCheck };
    if (daysAgo <= 30) return { label: 'Recent', color: 'text-blue-400', icon: ShieldCheck };
    if (daysAgo <= 90) return { label: 'Aging', color: 'text-yellow-400', icon: ShieldAlert };
    return { label: 'Stale', color: 'text-orange-400', icon: ShieldAlert };
  };

  const getAgeLabel = (dateStr: string) => {
    const daysAgo = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo < 7) return `${daysAgo}d ago`;
    if (daysAgo < 30) return `${Math.floor(daysAgo / 7)}w ago`;
    if (daysAgo < 365) return `${Math.floor(daysAgo / 30)}mo ago`;
    return `${Math.floor(daysAgo / 365)}y ago`;
  };

  return (
    <div className="space-y-5">
      {/* Stats Summary */}
      <div className="p-4 bg-surface-1 rounded-xl border border-default">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-dream-900/30">
            <Brain className="w-5 h-5 text-dream-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-textPrimary">
              Your coach knows <span className="text-dream-400 font-semibold">{totalInsights}</span>{' '}
              {totalInsights === 1 ? 'thing' : 'things'} about you
            </p>
            <p className="text-xs text-textTertiary mt-0.5">
              {summaries.length} conversation {summaries.length === 1 ? 'summary' : 'summaries'} recorded
            </p>
          </div>
        </div>
        {totalInsights > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => {
              const count = (groupedInsights[cat] || []).length;
              if (count === 0) return null;
              const config = categoryConfig[cat];
              return (
                <span
                  key={cat}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    config.bgColor,
                    config.iconColor
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
                  {count} {config.label.toLowerCase()}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-surface-1 p-1 rounded-lg border border-default">
        <button
          onClick={() => setActiveTab('insights')}
          className={cn(
            'flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2',
            activeTab === 'insights'
              ? 'bg-surface-2 text-textPrimary shadow-sm'
              : 'text-textSecondary hover:text-textPrimary hover:bg-surface-2/50'
          )}
        >
          <Brain className="w-4 h-4" />
          Memories
          {totalInsights > 0 && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              activeTab === 'insights' ? 'bg-dream-900/40 text-dream-400' : 'bg-surface-2 text-textTertiary'
            )}>
              {totalInsights}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('summaries')}
          className={cn(
            'flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2',
            activeTab === 'summaries'
              ? 'bg-surface-2 text-textPrimary shadow-sm'
              : 'text-textSecondary hover:text-textPrimary hover:bg-surface-2/50'
          )}
        >
          <MessageSquare className="w-4 h-4" />
          Conversations
          {summaries.length > 0 && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              activeTab === 'summaries' ? 'bg-dream-900/40 text-dream-400' : 'bg-surface-2 text-textTertiary'
            )}>
              {summaries.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'insights' ? (
        <div className="space-y-4">
          {/* Search */}
          {totalInsights > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textTertiary" />
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 bg-surface-1 border border-default rounded-lg text-sm text-textPrimary placeholder:text-textTertiary focus:outline-none focus:border-dream-600 focus:ring-1 focus:ring-dream-600/30 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textTertiary hover:text-textSecondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Category Filter Chips */}
          {totalInsights > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  selectedCategory === 'all'
                    ? 'bg-dream-900/30 text-dream-400 border-dream-600'
                    : 'bg-surface-1 text-textSecondary border-default hover:border-strong hover:text-textPrimary'
                )}
              >
                All ({totalInsights})
              </button>
              {categories.map(category => {
                const config = categoryConfig[category];
                const count = (groupedInsights[category] || []).length;
                if (count === 0) return null;
                const Icon = config.icon;

                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(
                      category === selectedCategory ? 'all' : category
                    )}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5',
                      selectedCategory === category
                        ? `${config.activeBg} ${config.iconColor} ${config.activeBorder}`
                        : 'bg-surface-1 text-textSecondary border-default hover:border-strong hover:text-textPrimary'
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {config.label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Insights List */}
          {filteredInsights.length > 0 ? (
            <div className="space-y-2">
              {searchQuery && (
                <p className="text-xs text-textTertiary">
                  {filteredInsights.length} {filteredInsights.length === 1 ? 'result' : 'results'} for &ldquo;{searchQuery}&rdquo;
                </p>
              )}
              {filteredInsights.map(insight => {
                const confidence = getConfidenceLevel(insight.confidence);
                const staleness = getStaleness(insight.lastValidated);
                const StalenessIcon = staleness.icon;
                const catConfig = categoryConfig[insight.category as CategoryKey];
                const CatIcon = catConfig?.icon || Brain;
                const isConfirmingDelete = confirmDeleteId === insight.id;

                return (
                  <div
                    key={insight.id}
                    className={cn(
                      'p-4 bg-surface-1 rounded-lg border transition-all group',
                      isConfirmingDelete
                        ? 'border-red-800/50 bg-red-950/20'
                        : 'border-default hover:border-strong'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Category Icon */}
                      <div className={cn(
                        'p-1.5 rounded-md shrink-0 mt-0.5',
                        catConfig?.bgColor || 'bg-surface-2'
                      )}>
                        <CatIcon className={cn('w-3.5 h-3.5', catConfig?.iconColor || 'text-textTertiary')} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-textPrimary leading-relaxed">{insight.insight}</p>

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                          {/* Confidence Bar */}
                          <div className="flex items-center gap-1.5" title={`${Math.round(insight.confidence * 100)}% confidence`}>
                            <div className="w-12 h-1 bg-surface-2 rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all', confidence.color)}
                                style={{ width: `${Math.round(insight.confidence * 100)}%` }}
                              />
                            </div>
                            <span className={cn('text-[10px] font-medium', confidence.textColor)}>
                              {confidence.label}
                            </span>
                          </div>

                          {/* Source Badge */}
                          <span className="inline-flex items-center gap-1 text-[10px] text-textTertiary">
                            {insight.source === 'explicit' ? (
                              <>
                                <Eye className="w-2.5 h-2.5" />
                                Direct
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-2.5 h-2.5" />
                                Inferred
                              </>
                            )}
                          </span>

                          {/* Staleness */}
                          <span className={cn('inline-flex items-center gap-1 text-[10px]', staleness.color)}>
                            <StalenessIcon className="w-2.5 h-2.5" />
                            {staleness.label}
                          </span>

                          {/* Age */}
                          <span className="text-[10px] text-textTertiary flex items-center gap-1">
                            <CalendarClock className="w-2.5 h-2.5" />
                            {getAgeLabel(insight.createdAt)}
                          </span>

                          {/* Expiration */}
                          {insight.expiresAt && (
                            <span className="text-[10px] text-orange-400">
                              Expires {getAgeLabel(insight.expiresAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete Button / Confirmation */}
                      <div className="shrink-0 ml-1">
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteInsight(insight.id)}
                              disabled={deletingIds.has(insight.id)}
                              className="px-2 py-1 text-[10px] font-medium bg-red-900/50 text-red-300 rounded hover:bg-red-900/70 transition-colors"
                            >
                              Remove
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-[10px] font-medium bg-surface-2 text-textSecondary rounded hover:bg-surface-3 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(insight.id)}
                            disabled={deletingIds.has(insight.id)}
                            className={cn(
                              'p-1.5 text-textTertiary hover:text-red-400 hover:bg-red-950/50 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100',
                              deletingIds.has(insight.id) && 'opacity-50 cursor-not-allowed'
                            )}
                            title="Remove this memory"
                          >
                            <Trash2 className={cn('w-3.5 h-3.5', deletingIds.has(insight.id) && 'animate-pulse')} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : totalInsights === 0 ? (
            <div className="text-center py-16">
              <div className="p-4 rounded-2xl bg-surface-1 inline-block mb-4">
                <Brain className="w-10 h-10 text-textTertiary" />
              </div>
              <p className="text-textSecondary font-medium">No memories yet</p>
              <p className="text-sm text-textTertiary mt-1 max-w-xs mx-auto">
                Your coach will learn about your preferences, goals, and patterns as you chat
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-8 h-8 text-textTertiary mx-auto mb-3" />
              <p className="text-textSecondary text-sm">No memories match your search</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="text-xs text-dream-400 hover:text-dream-300 mt-2 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.length > 0 ? (
            summaries.map(summary => (
              <div
                key={summary.id}
                className="p-4 bg-surface-1 rounded-lg border border-default hover:border-strong transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-textPrimary text-sm">
                      {new Date(summary.conversationDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h4>
                    <p className="text-xs text-textTertiary mt-0.5">{summary.messageCount} messages</p>
                  </div>
                  {summary.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {summary.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-surface-2 text-textTertiary text-[10px] rounded-full font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-sm text-textSecondary mb-3 leading-relaxed">{summary.summary}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {summary.keyDecisions.length > 0 && (
                    <div className="p-2.5 rounded-md bg-surface-2/50">
                      <h5 className="font-medium text-textPrimary mb-1.5 text-xs flex items-center gap-1.5">
                        <Target className="w-3 h-3 text-green-400" />
                        Decisions
                      </h5>
                      <ul className="space-y-1">
                        {summary.keyDecisions.map((decision, idx) => (
                          <li key={idx} className="text-textTertiary text-xs leading-relaxed">
                            {decision}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.keyPreferences.length > 0 && (
                    <div className="p-2.5 rounded-md bg-surface-2/50">
                      <h5 className="font-medium text-textPrimary mb-1.5 text-xs flex items-center gap-1.5">
                        <Heart className="w-3 h-3 text-blue-400" />
                        Preferences
                      </h5>
                      <ul className="space-y-1">
                        {summary.keyPreferences.map((pref, idx) => (
                          <li key={idx} className="text-textTertiary text-xs leading-relaxed">
                            {pref}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.keyFeedback.length > 0 && (
                    <div className="p-2.5 rounded-md bg-surface-2/50">
                      <h5 className="font-medium text-textPrimary mb-1.5 text-xs flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-amber-400" />
                        Feedback
                      </h5>
                      <ul className="space-y-1">
                        {summary.keyFeedback.map((feedback, idx) => (
                          <li key={idx} className="text-textTertiary text-xs leading-relaxed">
                            {feedback}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <div className="p-4 rounded-2xl bg-surface-1 inline-block mb-4">
                <MessageSquare className="w-10 h-10 text-textTertiary" />
              </div>
              <p className="text-textSecondary font-medium">No conversation summaries yet</p>
              <p className="text-sm text-textTertiary mt-1 max-w-xs mx-auto">
                Summaries will appear here after longer coaching sessions
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
