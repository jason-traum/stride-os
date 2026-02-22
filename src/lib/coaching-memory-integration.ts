/**
 * Integration points for coaching memory system
 */

import { CoachingMemory, processConversationInsights } from './coaching-memory';

// Re-export for use in other modules
export { processConversationInsights };

/**
 * Enhanced coach prompt that includes relevant memories
 */
export async function buildEnhancedCoachPrompt(
  basePrompt: string,
  profileId: number,
  currentContext: string
): Promise<string> {
  const memory = new CoachingMemory();

  // Get relevant insights based on current context
  const insights = await memory.getRelevantInsights(profileId, currentContext, 5);

  if (insights.length === 0) {
    return basePrompt;
  }

  // Build memory context
  let memoryContext = '\n\n**Relevant Information About This Athlete:**\n';

  // Group by category
  const groupedInsights = insights.reduce((acc, insight) => {
    if (!acc[insight.category]) acc[insight.category] = [];
    acc[insight.category].push(insight);
    return acc;
  }, {} as Record<string, typeof insights>);

  // Add insights by category
  for (const [category, categoryInsights] of Object.entries(groupedInsights)) {
    memoryContext += `\n${category.charAt(0).toUpperCase() + category.slice(1)}s:\n`;
    for (const insight of categoryInsights) {
      const confidence = insight.confidence > 0.8 ? '✓' : insight.confidence > 0.6 ? '?' : '~';
      memoryContext += `- ${confidence} ${insight.insight}`;
      if (insight.source === 'explicit') memoryContext += ' [stated directly]';
      memoryContext += '\n';
    }
  }

  return basePrompt + memoryContext;
}

/**
 * Auto-summarize long conversations
 */
export async function autoSummarizeConversation(
  messages: Array<{ role: string; content: string }>,
  profileId: number
): Promise<{
  summary: string;
  keyPoints: string[];
  suggestedActions: string[];
}> {
  const memory = new CoachingMemory();

  // Extract different types of information
  const consolidation = await memory.consolidateConversation(messages, 'all');

  // Extract key points using pattern matching
  const keyPoints: string[] = [];
  const suggestedActions: string[] = [];

  // Analyze assistant messages for commitments/plans
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  for (const message of assistantMessages) {
    // Look for action items
    if (message.content.includes('I\'ll') || message.content.includes('I will')) {
      const actionMatch = message.content.match(/(I'll|I will) ([^.!?]+)/);
      if (actionMatch) {
        suggestedActions.push(actionMatch[2].trim());
      }
    }

    // Look for key recommendations
    if (message.content.includes('recommend') || message.content.includes('suggest')) {
      const recommendMatch = message.content.match(/(recommend|suggest) ([^.!?]+)/);
      if (recommendMatch) {
        keyPoints.push(`Recommendation: ${recommendMatch[2].trim()}`);
      }
    }
  }

  // Tag all messages for categorization
  const allTags = new Set<string>();
  for (const message of messages) {
    const tags = await memory.tagMessage(message.content);
    tags.forEach(tag => allTags.add(tag));
  }

  // Build final summary
  let summary = consolidation;
  if (allTags.size > 0) {
    summary += `\n**Topics Discussed:** ${Array.from(allTags).join(', ')}`;
  }

  // Persist summary for future context recall.
  await memory.storeConversationSummary(profileId, messages);

  return {
    summary,
    keyPoints,
    suggestedActions
  };
}

/**
 * Smart context recall for beginning of conversations.
 *
 * Returns top-K most relevant memories scored by keyword overlap with
 * the current user message, weighted by recency. Total output is capped
 * to avoid bloating the system prompt.
 */
export async function recallRelevantContext(
  profileId: number,
  userMessage: string
): Promise<{
  recentContext: string;
  relevantMemories: string[];
  lastInteraction: string | null;
}> {
  const memory = new CoachingMemory();

  // Fetch a generous candidate pool (getRelevantInsights already does
  // keyword scoring, recency decay, and character-budget capping internally)
  const TOP_K = 6;
  const MAX_TOTAL_CHARS = 1200;
  const insights = await memory.getRelevantInsights(profileId, userMessage, TOP_K);

  // Format relevant memories with recency context, capping total length
  const relevantMemories: string[] = [];
  let totalChars = 0;

  for (const i of insights) {
    const ageInDays = Math.floor(
      (Date.now() - new Date(i.lastValidated).getTime()) / (1000 * 60 * 60 * 24)
    );
    const ageLabel = ageInDays === 0 ? 'today'
      : ageInDays === 1 ? 'yesterday'
      : ageInDays < 7 ? `${ageInDays}d ago`
      : ageInDays < 30 ? `${Math.floor(ageInDays / 7)}w ago`
      : `${Math.floor(ageInDays / 30)}mo ago`;
    const confLabel = i.confidence >= 0.85 ? 'high'
      : i.confidence >= 0.65 ? 'med' : 'low';
    const formatted = `[${i.category}] ${i.insight} (${ageLabel}, ${confLabel} conf)`;

    if (totalChars + formatted.length > MAX_TOTAL_CHARS && relevantMemories.length > 0) break;
    relevantMemories.push(formatted);
    totalChars += formatted.length;
  }

  const latestSummary = await memory.getLatestConversationSummary(profileId);
  const recentContext = latestSummary
    ? `Recent conversation focus: ${latestSummary.summary.slice(0, 220)}`
    : '';
  const lastInteraction = latestSummary
    ? `${latestSummary.conversationDate}: ${latestSummary.summary.slice(0, 220)}`
    : null;

  return {
    recentContext,
    relevantMemories,
    lastInteraction
  };
}

/**
 * Conflict detection in new information
 */
export function detectConflicts(
  newInsight: string,
  existingInsights: Array<{ insight: string; category: string }>
): Array<{ conflict: string; severity: 'minor' | 'major' }> {
  const conflicts: Array<{ conflict: string; severity: 'minor' | 'major' }> = [];

  // Simple conflict detection based on opposites
  const opposites = [
    ['morning', 'evening'],
    ['easy', 'hard'],
    ['love', 'hate'],
    ['prefer', 'avoid'],
    ['can', 'cannot'],
  ];

  for (const existing of existingInsights) {
    for (const [word1, word2] of opposites) {
      if (
        (newInsight.includes(word1) && existing.insight.includes(word2)) ||
        (newInsight.includes(word2) && existing.insight.includes(word1))
      ) {
        conflicts.push({
          conflict: `New: "${newInsight}" conflicts with existing: "${existing.insight}"`,
          severity: 'major'
        });
      }
    }
  }

  return conflicts;
}

/**
 * Example: How to use in the chat API
 */
export async function enhancedChatFlow(
  messages: Array<{ role: string; content: string }>,
  newMessage: string,
  profileId: number
) {
  // 1. Recall context at conversation start
  if (messages.length === 0) {
    const context = await recallRelevantContext(profileId, newMessage);
  }

  // 2. After processing the conversation
  const allMessages = [...messages, { role: 'user', content: newMessage }];

  // 3. Extract insights periodically (every 10 messages)
  if (allMessages.length % 10 === 0) {
    const insights = await processConversationInsights(allMessages, profileId);
  }

  // 4. Auto-summarize long conversations
  if (allMessages.length > 30) {
    const summary = await autoSummarizeConversation(allMessages, profileId);
  }
}
