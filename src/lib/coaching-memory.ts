/**
 * Coaching Memory System
 *
 * Extracts and stores key information from coaching conversations
 * to build a persistent knowledge base about the athlete.
 *
 * Uses keyword + context-window NLP heuristics (no LLM calls).
 * Deduplicates via Jaccard similarity on word sets.
 * Scores relevance by keyword overlap + recency decay.
 */

import { db } from '@/lib/db';
import { eq, and, desc, isNull, gte, or } from 'drizzle-orm';
import {
  coachingInsights,
  conversationSummaries,
  type CoachingInsight,
  type ConversationSummary,
} from '@/lib/db/coaching-memory';

// ---------------------------------------------------------------------------
// NLP helpers (pure functions, no external deps)
// ---------------------------------------------------------------------------

/** Common English stopwords to exclude from similarity/relevance scoring */
const STOPWORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'can', 'may', 'might', 'shall', 'must', 'need',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'about', 'between', 'through', 'during', 'after', 'before',
  'and', 'but', 'or', 'nor', 'not', 'so', 'if', 'then', 'than', 'that',
  'this', 'these', 'those', 'what', 'which', 'who', 'whom', 'how', 'when',
  'where', 'there', 'here', 'all', 'each', 'every', 'both', 'few', 'more',
  'some', 'any', 'no', 'only', 'very', 'just', 'also', 'too', 'really',
  'much', 'many', 'such', 'own', 'same', 'other', 'another',
  'up', 'out', 'off', 'over', 'again', 'still', 'already',
  'going', 'get', 'got', 'go', 'went', 'come', 'came',
  'been', 'being', 'bit', 'like', 'thing', 'things', 'lot',
]);

/** Tokenize text into meaningful words, lowercased, no punctuation */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

/** Tokenize and remove stopwords for content comparison */
function contentWords(text: string): Set<string> {
  return new Set(tokenize(text).filter(w => !STOPWORDS.has(w)));
}

/** Jaccard similarity between two word sets: |A & B| / |A | B| */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  a.forEach(w => {
    if (b.has(w)) intersection++;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Extract the sentence(s) surrounding a keyword match for context.
 * Returns the sentence containing the keyword, trimmed to a max length.
 */
function extractContextWindow(text: string, keywordIndex: number, maxLen = 200): string {
  // Find sentence boundaries around the keyword
  const before = text.lastIndexOf('.', keywordIndex);
  const after = text.indexOf('.', keywordIndex);
  const start = before === -1 ? 0 : before + 1;
  const end = after === -1 ? text.length : after + 1;

  let sentence = text.slice(start, end).trim();
  if (sentence.length > maxLen) {
    // Center the window on the keyword
    const kRelative = keywordIndex - start;
    const windowStart = Math.max(0, kRelative - Math.floor(maxLen / 2));
    sentence = sentence.slice(windowStart, windowStart + maxLen).trim();
  }
  return sentence;
}

// ---------------------------------------------------------------------------
// Extraction rules: keyword triggers with category, subcategory, confidence
// ---------------------------------------------------------------------------

interface ExtractionRule {
  /** Keywords that trigger this rule (any match activates) */
  triggers: string[];
  /** Additional context keywords that boost confidence when co-occurring */
  contextBoost?: string[];
  category: CoachingInsight['category'];
  subcategory?: string;
  /** Base confidence for this rule type */
  baseConfidence: number;
}

const EXTRACTION_RULES: ExtractionRule[] = [
  // --- Injuries ---
  {
    triggers: ['injury', 'injured', 'hurt', 'hurts', 'hurting', 'pain', 'painful',
      'sore', 'soreness', 'ache', 'aching', 'strain', 'strained', 'sprain',
      'torn', 'tear', 'tendon', 'tendonitis', 'plantar', 'fasciitis',
      'shin splints', 'stress fracture', 'it band', 'itb', 'knee pain',
      'hip pain', 'ankle', 'hamstring', 'calf', 'achilles', 'quad'],
    contextBoost: ['doctor', 'pt', 'physical therapy', 'rest', 'recovery',
      'swollen', 'inflamed', 'inflammation', 'x-ray', 'mri', 'brace'],
    category: 'injury',
    baseConfidence: 0.75,
  },
  // --- Goals ---
  {
    triggers: ['goal', 'goals', 'target', 'aiming', 'aim', 'dream', 'aspire',
      'hope to', 'want to run', 'want to finish', 'qualify', 'bq',
      'boston qualify', 'pr', 'personal record', 'personal best', 'pb',
      'break', 'sub-', 'under'],
    contextBoost: ['marathon', 'half marathon', '5k', '10k', 'race', 'time',
      'pace', 'minutes', 'hours'],
    category: 'goal',
    baseConfidence: 0.7,
  },
  // --- Race results (stored as feedback with subcategory) ---
  {
    triggers: ['ran a', 'finished in', 'race result', 'race went', 'crossed the finish',
      'final time', 'chip time', 'gun time', 'placed', 'placement', 'age group',
      'overall place'],
    contextBoost: ['marathon', 'half', '5k', '10k', 'mile', 'ultra', 'minutes',
      'hours', 'seconds', 'pr', 'pb'],
    category: 'feedback',
    subcategory: 'race_result',
    baseConfidence: 0.85,
  },
  // --- Preferences ---
  {
    triggers: ['prefer', 'preference', 'favorite', 'favourite', 'love running',
      'enjoy', 'like to run', 'like running', 'rather', 'hate', 'dislike',
      'can\'t stand', 'don\'t like', 'avoid'],
    contextBoost: ['morning', 'evening', 'afternoon', 'night', 'treadmill',
      'trail', 'road', 'track', 'alone', 'group', 'music', 'podcast',
      'easy', 'hard', 'tempo', 'interval', 'long run', 'speed work'],
    category: 'preference',
    baseConfidence: 0.7,
  },
  // --- Time-of-day / scheduling preferences ---
  {
    triggers: ['morning run', 'evening run', 'afternoon run', 'run before work',
      'run after work', 'lunch run', 'early morning', 'wake up to run'],
    category: 'preference',
    subcategory: 'schedule',
    baseConfidence: 0.75,
  },
  // --- Training feedback ---
  {
    triggers: ['felt great', 'felt good', 'felt amazing', 'felt terrible', 'felt awful',
      'felt easy', 'felt hard', 'too easy', 'too hard', 'crushed it', 'struggled',
      'bonked', 'hit the wall', 'second wind', 'strong finish', 'died at the end',
      'legs felt', 'breathing was', 'heart rate was', 'pace felt'],
    contextBoost: ['workout', 'run', 'session', 'tempo', 'interval', 'long run',
      'race', 'miles', 'km'],
    category: 'feedback',
    subcategory: 'training',
    baseConfidence: 0.7,
  },
  // --- Constraints ---
  {
    triggers: ['can only', 'can\'t run', 'cannot run', 'limited to', 'max of',
      'only have', 'days per week', 'times per week', 'hours per week',
      'work schedule', 'family', 'kids', 'childcare', 'travel', 'commute',
      'busy', 'time constraint'],
    category: 'constraint',
    baseConfidence: 0.75,
  },
  // --- Patterns / observations ---
  {
    triggers: ['always', 'usually', 'tend to', 'noticed that', 'i\'ve noticed',
      'pattern', 'every time', 'whenever', 'consistently'],
    contextBoost: ['run', 'training', 'workout', 'pace', 'heart rate', 'sleep',
      'nutrition', 'weather', 'cold', 'hot', 'tired', 'energized'],
    category: 'pattern',
    baseConfidence: 0.65,
  },
  // --- Personal info (stored as preference with subcategory) ---
  {
    triggers: ['years old', 'year old', 'my age', 'i weigh', 'my weight',
      'i\'m from', 'i live in', 'my name', 'started running', 'been running',
      'running for', 'years of experience', 'beginner', 'intermediate',
      'advanced', 'elite', 'first marathon', 'first race', 'new to running',
      'returning from', 'coming back from'],
    category: 'preference',
    subcategory: 'personal',
    baseConfidence: 0.8,
  },
];

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

/** Max characters for the memory context block injected into system prompt */
const MAX_CONTEXT_CHARS = 1500;

export class CoachingMemory {
  /**
   * Extract insights from a conversation using keyword + context-window heuristics.
   *
   * For each user message, scans for trigger keywords from EXTRACTION_RULES.
   * When a trigger fires, extracts the surrounding sentence as the insight text,
   * classifies it, and assigns a confidence score boosted by co-occurring context words.
   * Also handles explicit "remember that" style directives at high confidence.
   *
   * Deduplicates *within* the extraction batch via Jaccard similarity before returning.
   */
  async extractInsights(
    messages: Array<{ role: string; content: string }>,
    profileId: number
  ): Promise<CoachingInsight[]> {
    const raw: Omit<CoachingInsight, 'id' | 'createdAt' | 'lastValidated'>[] = [];

    for (const message of messages) {
      if (message.role !== 'user') continue;
      const text = message.content;
      const lower = text.toLowerCase();

      // --- 1. Keyword + context-window extraction ---
      for (const rule of EXTRACTION_RULES) {
        for (const trigger of rule.triggers) {
          const idx = lower.indexOf(trigger);
          if (idx === -1) continue;

          // Extract the sentence around the trigger as insight text
          const insightText = extractContextWindow(text, idx);
          if (insightText.length < 8) continue; // skip trivially short matches

          // Calculate confidence: base + boosts
          let confidence = rule.baseConfidence;

          // Boost if context words co-occur
          if (rule.contextBoost) {
            const boostHits = rule.contextBoost.filter(kw => lower.includes(kw)).length;
            confidence += Math.min(boostHits * 0.05, 0.15);
          }

          // Boost if the message is short/focused (more signal, less noise)
          if (text.length < 120) confidence += 0.05;

          confidence = Math.min(confidence, 0.95);

          raw.push({
            profileId,
            category: rule.category,
            subcategory: rule.subcategory ?? null,
            insight: insightText,
            confidence,
            source: 'inferred',
            extractedFrom: text.slice(0, 200),
            metadata: JSON.stringify({ trigger, subcategory: rule.subcategory ?? null }),
            isActive: true,
            expiresAt: null,
          });

          // Only take first trigger match per rule per message to avoid duplicates
          break;
        }
      }

      // --- 2. Explicit directives ("remember that ...", "note: ...") ---
      const explicitPatterns = [
        { phrase: 'remember that', conf: 0.92 },
        { phrase: 'remember,', conf: 0.92 },
        { phrase: 'keep in mind', conf: 0.9 },
        { phrase: 'don\'t forget', conf: 0.9 },
        { phrase: 'important:', conf: 0.88 },
        { phrase: 'note:', conf: 0.85 },
        { phrase: 'fyi', conf: 0.8 },
        { phrase: 'just so you know', conf: 0.82 },
        { phrase: 'for context', conf: 0.78 },
      ];

      for (const { phrase, conf } of explicitPatterns) {
        const idx = lower.indexOf(phrase);
        if (idx === -1) continue;

        // Extract everything after the phrase up to the end of the sentence
        const afterPhrase = text.slice(idx + phrase.length).trim();
        // Grab up to the first sentence-ending punctuation or 200 chars
        const sentenceEnd = afterPhrase.search(/[.!?\n]/);
        const insightText = sentenceEnd > 0
          ? afterPhrase.slice(0, sentenceEnd).trim()
          : afterPhrase.slice(0, 200).trim();

        if (insightText.length < 5) continue;

        // Infer category from the insight text itself
        const category = inferCategoryFromText(insightText);

        raw.push({
          profileId,
          category,
          subcategory: null,
          insight: insightText,
          confidence: conf,
          source: 'explicit',
          extractedFrom: text.slice(0, 200),
          metadata: JSON.stringify({ directive: phrase }),
          isActive: true,
          expiresAt: null,
        });
      }

      // --- 3. Structured data extraction: race times, distances, paces ---
      const raceTimeMatch = lower.match(
        /(?:ran|finished|completed|raced|did)\s+(?:a\s+)?(?:the\s+)?(?:marathon|half(?:\s*marathon)?|5k|10k|mile|ultra|50k|100k|100\s*miler?)\s+(?:in\s+)?(\d{1,2}:\d{2}(?::\d{2})?)/
      );
      if (raceTimeMatch) {
        const fullSentence = extractContextWindow(text, lower.indexOf(raceTimeMatch[0]));
        raw.push({
          profileId,
          category: 'feedback',
          subcategory: 'race_result',
          insight: fullSentence,
          confidence: 0.92,
          source: 'inferred',
          extractedFrom: text.slice(0, 200),
          metadata: JSON.stringify({ type: 'race_time', time: raceTimeMatch[1] }),
          isActive: true,
          expiresAt: null,
        });
      }

      // Weekly mileage statements
      const mileageMatch = lower.match(
        /(?:running|averaging|doing|at)\s+(?:about\s+)?(\d{1,3})\s*(?:miles?|mi|km|kilometers?)\s*(?:per|a|\/)\s*week/
      );
      if (mileageMatch) {
        const fullSentence = extractContextWindow(text, lower.indexOf(mileageMatch[0]));
        raw.push({
          profileId,
          category: 'pattern',
          subcategory: 'mileage',
          insight: fullSentence,
          confidence: 0.82,
          source: 'inferred',
          extractedFrom: text.slice(0, 200),
          metadata: JSON.stringify({ type: 'weekly_mileage', value: mileageMatch[1] }),
          isActive: true,
          expiresAt: null,
        });
      }
    }

    // --- 4. Intra-batch deduplication via Jaccard similarity ---
    const deduped = deduplicateBatch(raw);

    return deduped as CoachingInsight[];
  }

  /**
   * Store insights with Jaccard-based deduplication against existing DB rows.
   *
   * For each new insight:
   * - If a semantically similar insight (Jaccard >= 0.5) already exists in the
   *   same category, update it (refresh text, bump confidence, update timestamp)
   *   rather than inserting a duplicate.
   * - Otherwise insert as a new row.
   */
  async storeInsights(insights: Omit<CoachingInsight, 'id' | 'createdAt' | 'lastValidated'>[]): Promise<void> {
    if (insights.length === 0) return;

    // Batch-fetch existing active insights for this profile to reduce DB calls
    const profileId = insights[0].profileId;
    const existing = await db
      .select()
      .from(coachingInsights)
      .where(
        and(
          eq(coachingInsights.profileId, profileId),
          eq(coachingInsights.isActive, true)
        )
      );

    for (const insight of insights) {
      // Find the most similar existing insight in the same category
      const insightWords = contentWords(insight.insight);
      let bestMatch: (typeof existing)[number] | null = null;
      let bestSimilarity = 0;

      for (const e of existing) {
        if (e.category !== insight.category) continue;
        const existingWords = contentWords(e.insight);
        const sim = jaccardSimilarity(insightWords, existingWords);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          bestMatch = e;
        }
      }

      const DEDUP_THRESHOLD = 0.5;

      if (bestMatch && bestSimilarity >= DEDUP_THRESHOLD) {
        // Update existing insight: prefer the newer, longer, higher-confidence version
        const useNewText = insight.insight.length > bestMatch.insight.length
          || insight.confidence > bestMatch.confidence;
        const newConfidence = Math.max(insight.confidence, bestMatch.confidence);

        await db
          .update(coachingInsights)
          .set({
            ...(useNewText ? { insight: insight.insight } : {}),
            confidence: newConfidence,
            lastValidated: new Date().toISOString(),
            metadata: insight.metadata
              ? (typeof insight.metadata === 'string' ? insight.metadata : JSON.stringify(insight.metadata))
              : bestMatch.metadata,
          })
          .where(eq(coachingInsights.id, bestMatch.id));
      } else {
        // Insert new insight
        await db.insert(coachingInsights).values({
          ...insight,
          metadata: insight.metadata
            ? (typeof insight.metadata === 'string' ? insight.metadata : JSON.stringify(insight.metadata))
            : null,
        });
      }
    }
  }

  /**
   * Get relevant insights for current context.
   *
   * Scoring: keyword overlap (Jaccard on content words) + category relevance
   * boost + recency decay. Returns top-K, capped by total character budget.
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
      .limit(limit * 5); // Fetch a generous candidate pool

    if (insights.length === 0) return [];

    const contextTokens = contentWords(context);
    const contextLower = context.toLowerCase();
    const now = Date.now();

    // Infer what categories the current message is about
    const contextCategory = inferCategoryFromText(context);

    // Score each insight
    const scored = insights.map((insight: CoachingInsight) => {
      const insightTokens = contentWords(insight.insight);

      // 1. Keyword overlap score (0..1)
      const overlap = jaccardSimilarity(contextTokens, insightTokens);

      // 2. Category relevance boost
      let categoryBoost = 0;
      if (insight.category === contextCategory) categoryBoost = 0.25;
      // Also check for explicit category keywords in context
      const categoryKeywords: Record<string, string[]> = {
        injury: ['injury', 'hurt', 'pain', 'sore', 'ache', 'recover'],
        goal: ['goal', 'race', 'target', 'qualify', 'pr', 'pb', 'time'],
        preference: ['prefer', 'like', 'love', 'hate', 'enjoy', 'favorite'],
        feedback: ['felt', 'workout', 'session', 'hard', 'easy', 'struggle'],
        constraint: ['schedule', 'time', 'busy', 'can\'t', 'limited', 'only'],
        pattern: ['always', 'usually', 'tend', 'notice', 'pattern'],
      };
      const catKws = categoryKeywords[insight.category] ?? [];
      if (catKws.some(kw => contextLower.includes(kw))) categoryBoost = Math.max(categoryBoost, 0.2);

      // 3. Recency decay: insights validated recently get a small boost
      const ageMs = now - new Date(insight.lastValidated).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      // Decay: 0.15 for today, decaying to 0 over ~90 days
      const recencyBoost = Math.max(0, 0.15 * (1 - ageDays / 90));

      // 4. Base confidence contributes
      const confidenceScore = insight.confidence * 0.3;

      const totalScore = overlap + categoryBoost + recencyBoost + confidenceScore;

      // Parse metadata if it exists
      let metadata: Record<string, unknown> | null = null;
      try {
        metadata = insight.metadata ? JSON.parse(insight.metadata) : null;
      } catch {
        metadata = null;
      }

      return {
        ...insight,
        metadata,
        relevanceScore: totalScore,
      };
    });

    // Sort by relevance score descending
    scored.sort((a: { relevanceScore: number }, b: { relevanceScore: number }) => b.relevanceScore - a.relevanceScore);

    // Return top-K, but cap total text size to MAX_CONTEXT_CHARS
    const result: typeof scored = [];
    let totalChars = 0;
    for (const s of scored) {
      if (result.length >= limit) break;
      const insightLen = s.insight.length + 20; // overhead for formatting
      if (totalChars + insightLen > MAX_CONTEXT_CHARS && result.length > 0) break;
      totalChars += insightLen;
      result.push(s);
    }

    return result;
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

  async storeConversationSummary(
    profileId: number,
    messages: Array<{ role: string; content: string }>
  ): Promise<void> {
    if (messages.length < 6) return;

    const summary = await this.consolidateConversation(messages, 'all');
    const keyDecisions: string[] = [];
    const keyPreferences: string[] = [];
    const keyFeedback: string[] = [];
    const tagSet = new Set<string>();

    for (const message of messages) {
      const content = message.content;
      const lower = content.toLowerCase();

      if (message.role === 'assistant' && (lower.includes("i'll") || lower.includes('i will'))) {
        keyDecisions.push(content.slice(0, 160));
      }
      if (message.role === 'user' && (lower.includes('prefer') || lower.includes('like') || lower.includes('avoid'))) {
        keyPreferences.push(content.slice(0, 160));
      }
      if (message.role === 'user' && (lower.includes('felt') || lower.includes('too hard') || lower.includes('too easy'))) {
        keyFeedback.push(content.slice(0, 160));
      }

      const tags = await this.tagMessage(content);
      for (const tag of tags) tagSet.add(tag);
    }

    const today = new Date().toISOString().split('T')[0];
    await db.insert(conversationSummaries).values({
      profileId,
      conversationDate: today,
      messageCount: messages.length,
      summary,
      keyDecisions: keyDecisions.length ? JSON.stringify(keyDecisions.slice(0, 8)) : null,
      keyPreferences: keyPreferences.length ? JSON.stringify(keyPreferences.slice(0, 8)) : null,
      keyFeedback: keyFeedback.length ? JSON.stringify(keyFeedback.slice(0, 8)) : null,
      tags: tagSet.size ? JSON.stringify(Array.from(tagSet).slice(0, 12)) : null,
    });

    // Keep storage bounded.
    const existing = await db
      .select({ id: conversationSummaries.id })
      .from(conversationSummaries)
      .where(eq(conversationSummaries.profileId, profileId))
      .orderBy(desc(conversationSummaries.createdAt));

    if (existing.length > 100) {
      const stale = existing.slice(100);
      for (const row of stale) {
        await db.delete(conversationSummaries).where(eq(conversationSummaries.id, row.id));
      }
    }
  }

  async getLatestConversationSummary(profileId: number): Promise<ConversationSummary | null> {
    const rows = await db
      .select()
      .from(conversationSummaries)
      .where(eq(conversationSummaries.profileId, profileId))
      .orderBy(desc(conversationSummaries.createdAt))
      .limit(1);

    return rows[0] || null;
  }

  /**
   * Auto-tag messages for easy retrieval
   */
  async tagMessage(content: string): Promise<string[]> {
    const tags: string[] = [];
    const lower = content.toLowerCase();

    const tagPatterns: Record<string, string[]> = {
      'injury': ['hurt', 'pain', 'injury', 'injured', 'sore', 'soreness', 'strain',
        'tendon', 'plantar', 'shin splint', 'stress fracture', 'achilles'],
      'race': ['marathon', '5k', '10k', 'half marathon', 'race', 'ultra', 'relay',
        'race day', 'race result', 'finish line', 'bib'],
      'workout': ['tempo', 'interval', 'long run', 'easy run', 'workout', 'fartlek',
        'hill repeats', 'track', 'speed work', 'strides', 'recovery run'],
      'schedule': ['reschedule', 'swap', 'move', 'skip', 'rest day', 'day off',
        'can\'t run', 'busy', 'travel'],
      'goal': ['goal', 'target', 'aim', 'want to', 'qualify', 'bq', 'pr', 'pb',
        'personal best', 'personal record', 'sub-'],
      'feedback': ['felt', 'was hard', 'was easy', 'struggled', 'crushed',
        'bonked', 'hit the wall', 'strong', 'tired', 'exhausted', 'energized'],
      'nutrition': ['fuel', 'fueling', 'gel', 'hydration', 'water', 'electrolyte',
        'carb', 'calorie', 'diet', 'eating'],
      'gear': ['shoes', 'watch', 'garmin', 'coros', 'apple watch', 'vest', 'shorts',
        'apparel', 'foam roller', 'treadmill'],
    };

    for (const [tag, keywords] of Object.entries(tagPatterns)) {
      if (keywords.some(kw => lower.includes(kw))) {
        tags.push(tag);
      }
    }

    return tags;
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/**
 * Infer the most likely category for a piece of text based on keyword density.
 */
function inferCategoryFromText(text: string): CoachingInsight['category'] {
  const lower = text.toLowerCase();

  const categorySignals: Record<CoachingInsight['category'], string[]> = {
    injury: ['injury', 'hurt', 'pain', 'sore', 'ache', 'strain', 'tendon',
      'plantar', 'shin', 'fracture', 'doctor', 'pt', 'swollen', 'achilles'],
    goal: ['goal', 'target', 'aim', 'qualify', 'pr', 'pb', 'dream', 'race',
      'marathon', 'sub-', 'want to run', 'hope to'],
    feedback: ['felt', 'workout was', 'run was', 'session', 'crushed', 'struggled',
      'bonked', 'easy', 'hard', 'pace was', 'finished in', 'race result'],
    preference: ['prefer', 'like', 'love', 'hate', 'enjoy', 'favorite', 'avoid',
      'morning', 'evening', 'trail', 'road', 'treadmill'],
    constraint: ['can\'t', 'cannot', 'only have', 'limited', 'schedule', 'busy',
      'work', 'family', 'travel', 'time constraint', 'days per week'],
    pattern: ['always', 'usually', 'tend to', 'notice', 'every time', 'whenever',
      'consistently', 'pattern'],
  };

  let bestCategory: CoachingInsight['category'] = 'preference';
  let bestScore = 0;

  for (const [cat, signals] of Object.entries(categorySignals)) {
    const hits = signals.filter(s => lower.includes(s)).length;
    if (hits > bestScore) {
      bestScore = hits;
      bestCategory = cat as CoachingInsight['category'];
    }
  }

  return bestCategory;
}

/**
 * Deduplicate a batch of extracted insights using Jaccard similarity.
 * Within the same category, if two insights are >= 0.6 similar, keep the
 * one with higher confidence (or the longer one as tiebreaker).
 */
function deduplicateBatch(
  insights: Omit<CoachingInsight, 'id' | 'createdAt' | 'lastValidated'>[]
): Omit<CoachingInsight, 'id' | 'createdAt' | 'lastValidated'>[] {
  const result: typeof insights = [];

  for (const candidate of insights) {
    const candidateWords = contentWords(candidate.insight);
    let isDuplicate = false;

    for (let i = 0; i < result.length; i++) {
      const existing = result[i];
      if (existing.category !== candidate.category) continue;

      const existingWords = contentWords(existing.insight);
      const sim = jaccardSimilarity(candidateWords, existingWords);

      if (sim >= 0.6) {
        isDuplicate = true;
        // Keep the better version
        if (
          candidate.confidence > existing.confidence ||
          (candidate.confidence === existing.confidence && candidate.insight.length > existing.insight.length)
        ) {
          result[i] = candidate;
        }
        break;
      }
    }

    if (!isDuplicate) {
      result.push(candidate);
    }
  }

  return result;
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

  // Store unique insights (Jaccard dedup against DB)
  if (insights.length > 0) {
    await memory.storeInsights(insights);
  }

  // Return summary of what was learned
  return {
    insightsFound: insights.length,
    categories: Array.from(new Set(insights.map(i => i.category))),
    examples: insights.slice(0, 3).map(i => i.insight)
  };
}
