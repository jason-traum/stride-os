/**
 * Unified AI Interface
 *
 * Supports both Claude and OpenAI providers, with provider selection
 * based on user settings.
 */

import Anthropic from '@anthropic-ai/sdk';
import { generateOpenAICompletion, type OpenAIModel } from './openai';

// Lazy-initialize Anthropic client (only on server side when actually needed)
let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic();
  }
  return anthropic;
}

export type AIProvider = 'claude' | 'openai';
export type ClaudeModel = 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514';

export interface AICompletionOptions {
  provider?: AIProvider;
  claudeModel?: ClaudeModel;
  openaiModel?: OpenAIModel;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Generate a completion using the configured AI provider
 */
export async function generateAICompletion(
  prompt: string,
  options: AICompletionOptions = {}
): Promise<string> {
  const {
    provider = 'claude',
    claudeModel = 'claude-sonnet-4-20250514',
    openaiModel = 'gpt-5.2',
    maxTokens = 2048,
    temperature = 0.7,
    systemPrompt,
  } = options;

  if (provider === 'openai') {
    return generateOpenAICompletion(prompt, {
      model: openaiModel,
      maxTokens,
      temperature,
      systemPrompt,
    });
  }

  // Default to Claude
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt },
  ];

  const response = await getAnthropicClient().messages.create({
    model: claudeModel,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : '';
}

/**
 * Get display name for AI model
 */
export function getModelDisplayName(provider: AIProvider, model: string): string {
  if (provider === 'openai') {
    const names: Record<string, string> = {
      'gpt-5.2': 'GPT-5.2 Thinking',
      'gpt-5.2-chat-latest': 'GPT-5.2 Instant',
      'gpt-5.2-pro': 'GPT-5.2 Pro',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
    };
    return names[model] || model;
  }

  // Claude
  const names: Record<string, string> = {
    'claude-sonnet-4-20250514': 'Claude Sonnet 4',
    'claude-opus-4-20250514': 'Claude Opus 4',
  };
  return names[model] || model;
}

/**
 * Get model capabilities/description
 */
export function getModelDescription(provider: AIProvider, model: string): string {
  if (provider === 'openai') {
    const descriptions: Record<string, string> = {
      'gpt-5.2': 'Best for complex planning and decision support',
      'gpt-5.2-chat-latest': 'Fast, everyday tasks',
      'gpt-5.2-pro': 'Highest quality for hardest problems',
      'gpt-4o': 'Balanced performance and cost',
      'gpt-4o-mini': 'Budget-friendly option',
    };
    return descriptions[model] || '';
  }

  // Claude
  const descriptions: Record<string, string> = {
    'claude-sonnet-4-20250514': 'Fast, capable, great for most tasks',
    'claude-opus-4-20250514': 'Most intelligent, best for complex reasoning',
  };
  return descriptions[model] || '';
}
