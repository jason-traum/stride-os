// TODO: Create conversationSummaries table
// import { conversationSummaries } from '@/lib/schema';

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
  const summary = await getOrCreateSummary(oldMessages, _profileId);

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

// Store conversation summaries in database
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getOrCreateSummary(messages: Message[], profileId: number): Promise<string> {
  // Check if we already have a summary for these messages
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _messageHash = hashMessages(messages);

  // TODO: Uncomment when conversationSummaries table is created
  // const existing = await db.query.conversationSummaries.findFirst({
  //   where: and(
  //     eq(conversationSummaries.profileId, profileId),
  //     eq(conversationSummaries.messageHash, messageHash)
  //   )
  // });

  // if (existing) {
  //   return existing.summary;
  // }

  // Create summary of key information
  const summary = createManualSummary(messages);

  // TODO: Uncomment when conversationSummaries table is created
  // Store for future use
  // await db.insert(conversationSummaries).values({
  //   profileId,
  //   messageHash,
  //   summary,
  //   messageCount: messages.length,
  //   createdAt: new Date().toISOString()
  // });

  return summary;
}

// Create a summary without using the API
function createManualSummary(messages: Message[]): string {
  const keyInfo = {
    workoutsDiscussed: [] as string[],
    injuries: [] as string[],
    goals: [] as string[],
    preferences: [] as string[],
    keyDecisions: [] as string[]
  };

  // Extract key information from messages
  messages.forEach(msg => {
    const content = msg.content.toLowerCase();

    // Extract workout info
    if (content.includes('workout') || content.includes('run') || content.includes('miles')) {
      const workoutMatch = content.match(/(\d+)\s*(miles?|mi|k|km)/);
      if (workoutMatch) {
        keyInfo.workoutsDiscussed.push(workoutMatch[0]);
      }
    }

    // Extract injury mentions
    if (content.includes('injury') || content.includes('pain') || content.includes('hurt')) {
      keyInfo.injuries.push('injury discussed');
    }

    // Extract goals
    if (content.includes('goal') || content.includes('race') || content.includes('target')) {
      keyInfo.goals.push('goals mentioned');
    }
  });

  // Build summary
  const parts = [];
  if (keyInfo.workoutsDiscussed.length > 0) {
    parts.push(`Discussed workouts: ${keyInfo.workoutsDiscussed.slice(-3).join(', ')}`);
  }
  if (keyInfo.injuries.length > 0) {
    parts.push('Injury concerns mentioned');
  }
  if (keyInfo.goals.length > 0) {
    parts.push('Training goals discussed');
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
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}