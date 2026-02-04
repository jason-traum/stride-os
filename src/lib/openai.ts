import OpenAI from 'openai';

// Initialize OpenAI client
// API key should be set in environment variable OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type OpenAIModel =
  | 'gpt-5.2'           // GPT-5.2 Thinking - best for complex planning
  | 'gpt-5.2-chat-latest' // GPT-5.2 Instant - fast, everyday tasks
  | 'gpt-5.2-pro'       // GPT-5.2 Pro - highest quality, hardest problems
  | 'gpt-4o'            // GPT-4o - fallback/budget option
  | 'gpt-4o-mini';      // GPT-4o Mini - cheapest option

export interface OpenAICompletionOptions {
  model?: OpenAIModel;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh'; // For GPT-5.2 Pro/Thinking
}

/**
 * Generate a completion using OpenAI
 */
export async function generateOpenAICompletion(
  prompt: string,
  options: OpenAICompletionOptions = {}
): Promise<string> {
  const {
    model = 'gpt-5.2',
    maxTokens = 2048,
    temperature = 0.7,
    systemPrompt,
    reasoningEffort,
  } = options;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  // Build request options
  const requestOptions: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  // Add reasoning effort for supported models
  if (reasoningEffort && (model === 'gpt-5.2' || model === 'gpt-5.2-pro')) {
    // @ts-expect-error - reasoning parameter may not be in types yet
    requestOptions.reasoning = { effort: reasoningEffort };
  }

  const response = await openai.chat.completions.create(requestOptions);

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate a streaming completion using OpenAI
 */
export async function* generateOpenAICompletionStream(
  prompt: string,
  options: OpenAICompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const {
    model = 'gpt-5.2',
    maxTokens = 2048,
    temperature = 0.7,
    systemPrompt,
  } = options;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  const stream = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

export { openai };
