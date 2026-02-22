'use client';

import { useState } from 'react';
import { MessageCircle, Search, Calendar, Tag, TrendingUp, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { GroupedInteractions } from '@/lib/coach-history';

interface CoachHistoryViewProps {
  groupedHistory: GroupedInteractions[];
  stats?: {
    totalInteractions: number;
    topTopics: { topic: string; count: number }[];
    averagePerWeek: number;
    mostActiveTime: string;
  } | null;
}

export function CoachHistoryView({ groupedHistory, stats }: CoachHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter interactions based on search and tag
  const filteredHistory = groupedHistory.map(group => ({
    ...group,
    interactions: group.interactions.filter(interaction => {
      const matchesSearch = searchQuery === '' ||
        interaction.userMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        interaction.coachResponse.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTag = !selectedTag || interaction.tags.includes(selectedTag);

      return matchesSearch && matchesTag;
    })
  })).filter(group => group.interactions.length > 0);

  const getTagColor = (tag: string) => {
    const colors: Record<string, string> = {
      training: 'bg-blue-950 text-blue-300',
      pacing: 'bg-purple-950 text-purple-300',
      injury: 'bg-red-950 text-red-300',
      racing: 'bg-green-950 text-green-300',
      recovery: 'bg-orange-950 text-orange-300',
      nutrition: 'bg-yellow-950 text-yellow-300',
      gear: 'bg-indigo-950 text-indigo-300',
      conditions: 'bg-dream-500/10 text-dream-300',
      mental: 'bg-pink-950 text-pink-300',
      advice: 'bg-bgTertiary text-textSecondary',
      'how-to': 'bg-surface-2 text-secondary',
      explanation: 'bg-amber-950 text-amber-300',
    };
    return colors[tag] || 'bg-bgTertiary text-textSecondary';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-primary mb-4">Your Coach Stats</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <MessageCircle className="w-8 h-8 text-dream-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">{stats.totalInteractions}</p>
              <p className="text-xs text-textTertiary">Total Chats</p>
            </div>
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">{stats.averagePerWeek}</p>
              <p className="text-xs text-textTertiary">Per Week</p>
            </div>
            <div className="text-center">
              <Clock className="w-8 h-8 text-dream-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">{stats.mostActiveTime}</p>
              <p className="text-xs text-textTertiary">Peak Time</p>
            </div>
            <div className="text-center">
              <Tag className="w-8 h-8 text-dream-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">{stats.topTopics[0]?.topic || 'N/A'}</p>
              <p className="text-xs text-textTertiary">Top Topic</p>
            </div>
          </div>

          {/* Top Topics */}
          {stats.topTopics.length > 0 && (
            <div className="mt-4 pt-4 border-t border-borderPrimary">
              <p className="text-sm font-medium text-textSecondary mb-2">Your Top Topics</p>
              <div className="flex flex-wrap gap-2">
                {stats.topTopics.map(({ topic, count }) => (
                  <button
                    key={topic}
                    onClick={() => setSelectedTag(selectedTag === topic ? null : topic)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      selectedTag === topic
                        ? getTagColor(topic)
                        : "bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover"
                    )}
                  >
                    {topic} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your conversation history..."
          className="w-full pl-10 pr-4 py-3 bg-bgSecondary border border-borderPrimary rounded-xl focus:outline-none focus:border-dream-500 focus:ring-1 focus:ring-dream-500"
        />
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-8 text-center">
          <MessageCircle className="w-12 h-12 text-tertiary mx-auto mb-3" />
          <p className="text-textTertiary">
            {searchQuery || selectedTag
              ? 'No conversations match your search'
              : 'No coach conversations yet'}
          </p>
          {!searchQuery && !selectedTag && (
            <p className="text-sm text-tertiary mt-1">
              Ask your AI coach for training advice!
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredHistory.map(group => (
            <div key={group.date}>
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-tertiary" />
                <h4 className="text-sm font-medium text-textSecondary">{formatDate(group.date)}</h4>
              </div>

              {/* Interactions */}
              <div className="space-y-3">
                {group.interactions.map(interaction => (
                  <div
                    key={interaction.id}
                    className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 hover:border-accentTeal transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === interaction.id ? null : interaction.id)}
                  >
                    {/* User Message */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 bg-dream-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-dream-300">You</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-primary font-medium line-clamp-2">
                          {interaction.userMessage}
                        </p>
                        <p className="text-xs text-textTertiary mt-1">
                          {formatDistanceToNow(new Date(interaction.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {/* Coach Response Preview or Full */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-dream-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-dream-700">AI</span>
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          "text-sm text-textSecondary",
                          expandedId !== interaction.id && "line-clamp-3"
                        )}>
                          {interaction.coachResponse}
                        </p>

                        {/* Tags */}
                        {interaction.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {interaction.tags.map(tag => (
                              <span
                                key={tag}
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-medium",
                                  getTagColor(tag)
                                )}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Context (if expanded) */}
                        {expandedId === interaction.id && interaction.context && (
                          <div className="mt-3 pt-3 border-t border-borderSecondary">
                            <p className="text-xs text-textTertiary uppercase tracking-wide mb-1">Context</p>
                            <div className="text-xs text-textSecondary space-y-1">
                              {interaction.context.readinessScore && (
                                <p>Readiness: {interaction.context.readinessScore}/100</p>
                              )}
                              {interaction.context.phase && (
                                <p>Training Phase: {interaction.context.phase}</p>
                              )}
                              {interaction.context.workoutId && (
                                <p>Related to a workout</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}