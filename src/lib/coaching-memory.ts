/**
 * Coaching Memory System
 *
 * Extracts and stores key information from coaching conversations
 * to build a persistent knowledge base about the athlete
 */

import { db } from '@/lib/db';
import { eq, and, desc, isNull, gte, or } from 'drizzle-orm';
import {
  coachingInsights,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  conversationSummaries,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  insightConnections,
  type CoachingInsight,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type NewCoachingInsight,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type ConversationSummary,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type NewConversationSummary,
} from '@/lib/db/coaching-memory';

export class CoachingMemory {
  /**
   * Extract insights from a conversation
   */
  async extractInsights(messages: Array<{ role: string; content: string }>, profileId: number): Promise<CoachingInsight[]> {
    const insights: Omit<CoachingInsight, 'id' | 'createdAt' | 'lastValidated'>[] = [];

    // Pattern matching for different types of insights
    const patterns = {
      preferences: [
        /I (prefer|like|enjoy|love) (running|training) (.*)/i,
        /I (don't|hate|dislike) (.*)/i,
        /(morning|evening|afternoon) runs? (work|are) best/i,
      ],
      injuries: [
        /my (.*) (hurts?|aches?|is sore)/i,
        /dealing with (a|an) (.*) injury/i,
        /recovering from (.*)/i,
      ],
      goals: [
        /I want to (.*)/i,
        /my goal is (.*)/i,
        /trying to (.*)/i,
        /aiming for (.*)/i,
      ],
      constraints: [
        /I (can only|can't) (.*)/i,
        /I have (.*) available/i,
        /(work|family|schedule) (prevents?|limits?) (.*)/i,
      ],
      patterns: [
        /I (always|usually|tend to) (.*)/i,
        /I've noticed (.*)/i,
        /when I (.*), I (.*)/i,
      ],
      feedback: [
        /the (workout|run|session) (was|felt) (.*)/i,
        /I (struggled|crushed|loved|hated) (.*)/i,
        /(too easy|too hard|just right|perfect)/i,
      ]
    };

    // Analyze each message
    for (const message of messages) {
      if (message.role !== 'user') continue;

      for (const [category, categoryPatterns] of Object.entries(patterns)) {
        for (const pattern of categoryPatterns) {
          const match = message.content.match(pattern);
          if (match) {
            insights.push({
              profileId,
              category: category as CoachingInsight['category'],
              insight: match[0],
              confidence: 0.7, // Base confidence for pattern matching
              source: 'inferred',
              extractedFrom: message.content.slice(0, 100),
              metadata: { fullMatch: match }
            });
          }
        }
      }
    }

    // Look for explicit statements
    const explicitPhrases = [
      'remember that',
      'keep in mind',
      'don\'t forget',
      'important:',
      'note:'
    ];

    for (const message of messages) {
      if (message.role !== 'user') continue;

      for (const phrase of explicitPhrases) {
        if (message.content.toLowerCase().includes(phrase)) {
          const startIndex = message.content.toLowerCase().indexOf(phrase) + phrase.length;
          const insight = message.content.slice(startIndex).trim().split('.')[0];

          insights.push({
            profileId,
            category: 'preference', // Default, could be smarter
            insight: insight,
            confidence: 0.9, // High confidence for explicit statements
            source: 'explicit',
            extractedFrom: message.content.slice(0, 100)
          });
        }
      }
    }

    return insights as CoachingInsight[];
  }

  /**
   * Store insights with deduplication
   */
  async storeInsights(insights: Omit<CoachingInsight, 'id' | 'createdAt' | 'lastValidated'>[]): Promise<void> {
    if (insights.length === 0) return;

    // Check for existing similar insights to avoid duplicates
    for (const insight of insights) {
      // Look for similar existing insights
      const existing = await db
        .select()
        .from(coachingInsights)
        .where(
          and(
            eq(coachingInsights.profileId, insight.profileId),
            eq(coachingInsights.category, insight.category),
            eq(coachingInsights.isActive, true)
          )
        );

      // Simple deduplication - check if very similar insight exists
      const isDuplicate = existing.some(e =>
        e.insight.toLowerCase().includes(insight.insight.toLowerCase()) ||
        insight.insight.toLowerCase().includes(e.insight.toLowerCase())
      );

      if (!isDuplicate) {
        // Insert new insight
        await db.insert(coachingInsights).values({
          ...insight,
          metadata: insight.metadata ? JSON.stringify(insight.metadata) : null,
        });
      } else {
        // Update confidence of existing insight if new one has higher confidence
        const similarInsight = existing.find(e =>
          e.insight.toLowerCase().includes(insight.insight.toLowerCase()) ||
          insight.insight.toLowerCase().includes(e.insight.toLowerCase())
        );

        if (similarInsight && insight.confidence > similarInsight.confidence) {
          await db
            .update(coachingInsights)
            .set({
              confidence: insight.confidence,
              lastValidated: new Date().toISOString(),
            })
            .where(eq(coachingInsights.id, similarInsight.id));
        }
      }
    }
  }

  /**
   * Get relevant insights for current context
   */
  async getRelevantInsights(
    profileId: number,
    context: string,
    limit: number = 10
  ): Promise<CoachingInsight[]> {
    // Get active insights for this profile
    const insights = await db
      .select()
      .from(coachingInsights)
      .where(
        and(
          eq(coachingInsights.profileId, profileId),
          eq(coachingInsights.isActive, true),
          or(
            isNull(coachingInsights.expiresAt),
            gte(coachingInsights.expiresAt, new Date().toISOString())
          )
        )
      )
      .orderBy(desc(coachingInsights.confidence), desc(coachingInsights.lastValidated))
      .limit(limit * 2); // Get more than needed for filtering

    // Score insights by relevance to context
    const scoredInsights = insights.map(insight => {
      let score = insight.confidence;

      // Boost score if context mentions keywords from insight
      const insightWords = insight.insight.toLowerCase().split(' ');
      const contextWords = context.toLowerCase().split(' ');
      const commonWords = insightWords.filter(word => contextWords.includes(word));
      score += commonWords.length * 0.1;

      // Boost score for category relevance
      if (context.includes('injury') && insight.category === 'injury') score += 0.3;
      if (context.includes('goal') && insight.category === 'goal') score += 0.3;
      if (context.includes('prefer') && insight.category === 'preference') score += 0.3;

      // Parse metadata if it exists
      const metadata = insight.metadata ? JSON.parse(insight.metadata) : null;

      return {
        ...insight,
        metadata,
        relevanceScore: Math.min(score, 1),
      };
    });

    // Sort by relevance and return top N
    return scoredInsights
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Consolidate chat history into a summary
   */
  async consolidateConversation(
    messages: Array<{ role: string; content: string }>,
    focus: 'decisions' | 'preferences' | 'progress' | 'all' = 'all'
  ): Promise<string> {
    const summary = {
      decisions: [] as string[],
      preferences: [] as string[],
      progress: [] as string[],
      keyPoints: [] as string[]
    };

    // Extract key information based on focus
    for (const message of messages) {
      const content = message.content.toLowerCase();

      // Decisions
      if (focus === 'decisions' || focus === 'all') {
        if (content.includes('decided') || content.includes('will') || content.includes('plan to')) {
          summary.decisions.push(message.content.slice(0, 100));
        }
      }

      // Preferences
      if (focus === 'preferences' || focus === 'all') {
        if (content.includes('prefer') || content.includes('like') || content.includes('enjoy')) {
          summary.preferences.push(message.content.slice(0, 100));
        }
      }

      // Progress
      if (focus === 'progress' || focus === 'all') {
        if (content.includes('completed') || content.includes('ran') || content.includes('miles')) {
          summary.progress.push(message.content.slice(0, 100));
        }
      }
    }

    // Build consolidated summary
    let consolidatedSummary = '';

    if (summary.decisions.length > 0) {
      consolidatedSummary += `**Decisions Made:**\n${summary.decisions.map(d => `- ${d}`).join('\n')}\n\n`;
    }

    if (summary.preferences.length > 0) {
      consolidatedSummary += `**Preferences Noted:**\n${summary.preferences.map(p => `- ${p}`).join('\n')}\n\n`;
    }

    if (summary.progress.length > 0) {
      consolidatedSummary += `**Training Progress:**\n${summary.progress.map(p => `- ${p}`).join('\n')}\n\n`;
    }

    return consolidatedSummary || 'No significant information found to consolidate.';
  }

  /**
   * Auto-tag messages for easy retrieval
   */
  async tagMessage(content: string): Promise<string[]> {
    const tags: string[] = [];

    const tagPatterns = {
      'injury': [/hurt/, /pain/, /injury/, /sore/],
      'race': [/marathon/, /5k/, /10k/, /half/, /race/],
      'workout': [/tempo/, /interval/, /long run/, /easy/, /workout/],
      'schedule': [/reschedule/, /swap/, /move/, /skip/],
      'goal': [/goal/, /target/, /aim/, /want to/],
      'feedback': [/felt/, /was hard/, /was easy/, /struggled/, /crushed/]
    };

    for (const [tag, patterns] of Object.entries(tagPatterns)) {
      if (patterns.some(pattern => pattern.test(content.toLowerCase()))) {
        tags.push(tag);
      }
    }

    return tags;
  }
}

/**
 * Middleware to automatically extract insights after each conversation
 */
export async function processConversationInsights(
  messages: Array<{ role: string; content: string }>,
  profileId: number
) {
  const memory = new CoachingMemory();

  // Extract insights from the conversation
  const insights = await memory.extractInsights(messages, profileId);

  // Store unique insights
  if (insights.length > 0) {
    await memory.storeInsights(insights);
  }

  // Return summary of what was learned
  return {
    insightsFound: insights.length,
    categories: [...new Set(insights.map(i => i.category))],
    examples: insights.slice(0, 3).map(i => i.insight)
  };
}