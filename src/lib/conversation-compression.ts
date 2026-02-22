import { db } from '@/lib/db';
import { conversationSummaries } from '@/lib/db/coaching-memory';
import { eq, and } from 'drizzle-orm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CompressedConversation {
  messages: Message[];
  summary: string;
  tokenCount: number;
}

// Compress conversations older than N messages
export async function compressConversation(
  messages: Message[],
  profileId: number,
  keepRecentCount: number = 10
): Promise<CompressedConversation> {
  if (messages.length <= keepRecentCount) {
    return {
      messages,
      summary: '',
      tokenCount: estimateTokens(messages)
    };
  }

  // Split messages
  const oldMessages = messages.slice(0, -keepRecentCount);
  const recentMessages = messages.slice(-keepRecentCount);

  // Get or create summary of old messages
  const summary = await getOrCreateSummary(oldMessages, profileId);

  // Return compressed version
  return {
    messages: [
      {
        role: 'assistant',
        content: `[Previous conversation summary: ${summary}]`
      },
      ...recentMessages
    ],
    summary,
    tokenCount: estimateTokens(recentMessages) + estimateTokens([{ role: 'assistant', content: summary }])
  };
}

// Store conversation summaries in database for dedup / fast recall
async function getOrCreateSummary(messages: Message[], profileId: number): Promise<string> {
  const messageHash = hashMessages(messages);

  // Check if we already have a summary for these messages
  try {
    const existing = await db
      .select()
      .from(conversationSummaries)
      .where(
        and(
          eq(conversationSummaries.profileId, profileId),
          eq(conversationSummaries.messageHash, messageHash)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0].summary;
    }
  } catch {
    // Table may not exist yet in some environments; fall through to create summary
  }

  // Create summary of key information
  const summary = createManualSummary(messages);

  // Store for future use
  try {
    const today = new Date().toISOString().split('T')[0];
    await db.insert(conversationSummaries).values({
      profileId,
      conversationDate: today,
      messageHash,
      summary,
      messageCount: messages.length,
      keyDecisions: null,
      keyPreferences: null,
      keyFeedback: null,
      tags: null,
    });
  } catch {
    // Non-fatal: summary will be regenerated next time if insert fails
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Manual summary extraction with NLP heuristics
// ---------------------------------------------------------------------------

/**
 * Extract the sentence containing a keyword match for context.
 * Returns the sentence trimmed to maxLen characters.
 */
function extractSentence(text: string, keywordIdx: number, maxLen = 140): string {
  const before = text.lastIndexOf('.', keywordIdx);
  const after = text.indexOf('.', keywordIdx);
  const start = before === -1 ? 0 : before + 1;
  const end = after === -1 ? text.length : after + 1;
  return text.slice(start, end).trim().slice(0, maxLen);
}

/**
 * Create a high-quality summary of conversation messages using NLP heuristics.
 *
 * Extracts:
 * - Workout details (distances, types, paces)
 * - Injury specifics (body part, severity cues)
 * - Goals (race targets, time goals)
 * - Preferences (time-of-day, surface, workout types)
 * - Constraints (schedule, availability)
 * - Training feedback (how workouts felt)
 * - Key decisions / plans made
 * - Patterns the athlete described
 */
function createManualSummary(messages: Message[]): string {
  const extracted = {
    workouts: [] as string[],
    injuries: [] as string[],
    goals: [] as string[],
    preferences: [] as string[],
    constraints: [] as string[],
    feedback: [] as string[],
    decisions: [] as string[],
    patterns: [] as string[],
  };

  for (const msg of messages) {
    const text = msg.content;
    const lower = text.toLowerCase();

    // --- Workouts: distances, paces, workout types ---
    const distanceMatch = lower.match(
      /(\d+(?:\.\d+)?)\s*(miles?|mi|k|km|kilometers?)\b/
    );
    if (distanceMatch) {
      extracted.workouts.push(extractSentence(text, lower.indexOf(distanceMatch[0])));
    }

    const paceMatch = lower.match(
      /(\d{1,2}:\d{2})\s*(?:\/\s*(?:mi(?:le)?|km)|pace|per\s+(?:mile|km))/
    );
    if (paceMatch) {
      extracted.workouts.push(extractSentence(text, lower.indexOf(paceMatch[0])));
    }

    const workoutTypes = ['tempo', 'interval', 'long run', 'easy run', 'fartlek',
      'hill repeats', 'track workout', 'speed work', 'recovery run', 'strides'];
    for (const wt of workoutTypes) {
      const idx = lower.indexOf(wt);
      if (idx !== -1) {
        extracted.workouts.push(extractSentence(text, idx));
        break; // one per message
      }
    }

    // --- Injuries: specific body parts and severity cues ---
    const injuryTerms = ['injury', 'pain', 'hurt', 'sore', 'ache', 'strain',
      'tendonitis', 'plantar fasciitis', 'shin splint', 'stress fracture',
      'it band', 'knee', 'hip', 'ankle', 'hamstring', 'calf', 'achilles',
      'quad', 'foot', 'heel', 'back pain'];
    for (const term of injuryTerms) {
      const idx = lower.indexOf(term);
      if (idx !== -1) {
        extracted.injuries.push(extractSentence(text, idx));
        break;
      }
    }

    // --- Goals: race targets, time goals, qualification ---
    const goalPatterns = [
      /(?:goal|target|aiming|aim(?:ing)?|hoping?|want(?:ing)?\s+to)\s+[^.!?]{5,80}/,
      /(?:qualify|bq|boston\s*qualif)/,
      /(?:sub-?\d|under\s+\d)/,
      /(?:pr|personal\s+(?:record|best)|pb)\s+[^.!?]{3,60}/,
    ];
    for (const pat of goalPatterns) {
      const match = lower.match(pat);
      if (match) {
        extracted.goals.push(extractSentence(text, lower.indexOf(match[0])));
        break;
      }
    }

    // --- Race results ---
    const raceTimeMatch = lower.match(
      /(?:ran|finished|completed|raced|did)\s+(?:a\s+)?(?:the\s+)?(?:marathon|half(?:\s*marathon)?|5k|10k|mile|ultra)\s+(?:in\s+)?(\d{1,2}:\d{2}(?::\d{2})?)/
    );
    if (raceTimeMatch) {
      extracted.goals.push(extractSentence(text, lower.indexOf(raceTimeMatch[0])));
    }

    // --- Preferences ---
    const prefTriggers = [
      'prefer', 'favorite', 'love running', 'enjoy', 'like to run',
      'like running', 'hate', 'dislike', 'avoid', "can't stand",
      "don't like", 'morning run', 'evening run', 'afternoon run',
      'run before work', 'run after work', 'treadmill', 'trail',
    ];
    for (const trigger of prefTriggers) {
      const idx = lower.indexOf(trigger);
      if (idx !== -1) {
        extracted.preferences.push(extractSentence(text, idx));
        break;
      }
    }

    // --- Constraints ---
    const constraintTriggers = [
      'can only', "can't run", 'cannot run', 'limited to', 'max of',
      'only have', 'days per week', 'times per week', 'hours per week',
      'work schedule', 'family', 'kids', 'childcare', 'travel',
      'busy', 'time constraint',
    ];
    for (const trigger of constraintTriggers) {
      const idx = lower.indexOf(trigger);
      if (idx !== -1) {
        extracted.constraints.push(extractSentence(text, idx));
        break;
      }
    }

    // --- Feedback on training ---
    const feedbackTriggers = [
      'felt great', 'felt good', 'felt amazing', 'felt terrible', 'felt awful',
      'felt easy', 'felt hard', 'too easy', 'too hard', 'crushed it',
      'struggled', 'bonked', 'hit the wall', 'strong finish', 'died at the end',
      'legs felt', 'breathing was', 'heart rate was', 'pace felt',
    ];
    for (const trigger of feedbackTriggers) {
      const idx = lower.indexOf(trigger);
      if (idx !== -1) {
        extracted.feedback.push(extractSentence(text, idx));
        break;
      }
    }

    // --- Decisions / plans (from assistant messages) ---
    if (msg.role === 'assistant') {
      const decisionPatterns = [/i(?:'ll| will) ([^.!?]{5,100})/, /let(?:'s| us) ([^.!?]{5,100})/];
      for (const pat of decisionPatterns) {
        const match = lower.match(pat);
        if (match) {
          extracted.decisions.push(extractSentence(text, lower.indexOf(match[0])));
          break;
        }
      }
    }

    // --- Patterns ("I always...", "I usually...", "I tend to...") ---
    if (msg.role === 'user') {
      const patternTriggers = [
        'i always', 'i usually', 'i tend to', "i've noticed",
        'i noticed', 'every time', 'whenever i', 'consistently',
        'my pattern', 'i never',
      ];
      for (const trigger of patternTriggers) {
        const idx = lower.indexOf(trigger);
        if (idx !== -1) {
          extracted.patterns.push(extractSentence(text, idx));
          break;
        }
      }
    }
  }

  // Deduplicate within each category (simple exact-match dedup)
  for (const key of Object.keys(extracted) as (keyof typeof extracted)[]) {
    extracted[key] = Array.from(new Set(extracted[key]));
  }

  // Build summary, capping each category to avoid bloat
  const parts: string[] = [];
  const MAX_PER_CAT = 3;

  if (extracted.workouts.length > 0) {
    parts.push(`Workouts discussed: ${extracted.workouts.slice(-MAX_PER_CAT).join('; ')}`);
  }
  if (extracted.injuries.length > 0) {
    parts.push(`Injury concerns: ${extracted.injuries.slice(-MAX_PER_CAT).join('; ')}`);
  }
  if (extracted.goals.length > 0) {
    parts.push(`Goals: ${extracted.goals.slice(-MAX_PER_CAT).join('; ')}`);
  }
  if (extracted.preferences.length > 0) {
    parts.push(`Preferences: ${extracted.preferences.slice(-MAX_PER_CAT).join('; ')}`);
  }
  if (extracted.constraints.length > 0) {
    parts.push(`Constraints: ${extracted.constraints.slice(-MAX_PER_CAT).join('; ')}`);
  }
  if (extracted.feedback.length > 0) {
    parts.push(`Training feedback: ${extracted.feedback.slice(-MAX_PER_CAT).join('; ')}`);
  }
  if (extracted.decisions.length > 0) {
    parts.push(`Decisions: ${extracted.decisions.slice(-MAX_PER_CAT).join('; ')}`);
  }
  if (extracted.patterns.length > 0) {
    parts.push(`Patterns noted: ${extracted.patterns.slice(-MAX_PER_CAT).join('; ')}`);
  }

  return parts.length > 0 ? parts.join('. ') : 'General training discussion';
}

// Simple hash function for message deduplication
function hashMessages(messages: Message[]): string {
  const str = messages.map(m => `${m.role}:${m.content.slice(0, 100)}`).join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Estimate token count (rough approximation)
export function estimateTokens(messages: Message[]): number {
  const text = messages.map(m => m.content).join(' ');
  // Rough estimate: 1 token ~= 4 characters
  return Math.ceil(text.length / 4);
}
