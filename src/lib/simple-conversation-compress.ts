/**
 * Simple conversation compression to prevent massive API delays
 *
 * When conversation history gets too long (30+ messages), compress older messages
 * to reduce tokens sent to Claude.
 */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function compressConversation(messages: Message[], maxMessages: number = 20): Message[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  console.log(`[Compress] Compressing ${messages.length} messages down to ${maxMessages}`);

  // Always keep the first message (might be system context)
  const firstMessage = messages[0];

  // Keep the most recent messages
  const recentMessages = messages.slice(-(maxMessages - 2));

  // Summarize the middle messages
  const middleMessages = messages.slice(1, messages.length - (maxMessages - 2));
  const summary = createSummary(middleMessages);

  return [
    firstMessage,
    {
      role: 'assistant',
      content: `[Previous conversation summary: ${summary}]`
    },
    ...recentMessages
  ];
}

function createSummary(messages: Message[]): string {
  // Count workout prescriptions, questions answered, etc
  const userQuestions = messages.filter(m => m.role === 'user').length;
  const workoutMentions = messages.filter(m =>
    m.content.toLowerCase().includes('workout') ||
    m.content.toLowerCase().includes('tempo') ||
    m.content.toLowerCase().includes('run')
  ).length;

  return `${userQuestions} previous interactions covering workout prescriptions, training advice, and coaching guidance. Recent topics included training plans and workout recommendations.`;
}