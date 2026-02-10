import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ContextManager } from '@/lib/context-manager';
import { LocalIntelligence } from '@/lib/local-intelligence';
import { compressConversation, estimateTokens } from '@/lib/conversation-compression';
import { coachToolDefinitions, executeCoachTool } from '@/lib/coach-tools';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  const { messages, newMessage, userSettings, profileId } = await request.json();

  try {
    // 1. Try to handle locally first (no API cost)
    const localAI = new LocalIntelligence();
    const localResponse = await localAI.handleLocally(newMessage, userSettings);

    if (localResponse.handled && localResponse.confidence > 0.8) {
      return new Response(JSON.stringify({
        response: localResponse.response,
        cost: 0,
        method: 'local'
      }));
    }

    // 2. Build optimized context
    const contextManager = new ContextManager();
    const context = await contextManager.buildContext(newMessage, messages, userSettings);

    // 3. Compress conversation if needed
    const compressed = await compressConversation(
      context.relevantHistory,
      profileId,
      10 // Keep only last 10 messages
    );

    // 4. Choose model based on query complexity
    const model = selectOptimalModel(newMessage, compressed.tokenCount);

    // 5. Make API call with optimized context
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      temperature: 0.7,
      system: context.systemPrompt,
      messages: [
        ...compressed.messages,
        { role: 'user', content: newMessage }
      ],
      tools: getRelevantTools(newMessage)
    });

    // 6. Process response
    let assistantResponse = '';
    const toolCalls = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        assistantResponse += block.text;
      } else if (block.type === 'tool_use') {
        const result = await executeCoachTool(
          block.name,
          block.input as Record<string, unknown>
        );
        toolCalls.push({ tool: block.name, result });
      }
    }

    // 7. Cache successful response
    if (response.stop_reason === 'end_turn') {
      await localAI.cacheResponse(newMessage, assistantResponse, toolCalls);
    }

    // 8. Return response with cost estimate
    const cost = estimateCost(model, compressed.tokenCount, assistantResponse.length);

    return new Response(JSON.stringify({
      response: assistantResponse,
      toolCalls,
      cost,
      method: 'api',
      model,
      tokensSaved: messages.length > compressed.messages.length
        ? estimateTokens(messages) - compressed.tokenCount
        : 0
    }));

  } catch (error) {
    console.error('Optimized chat error:', error);
    return new Response(JSON.stringify({ error: 'Chat failed' }), { status: 500 });
  }
}

// Select the cheapest model that can handle the query
function selectOptimalModel(query: string, contextTokens: number): string {
  const queryComplexity = analyzeComplexity(query);

  // Use Haiku for simple queries
  if (queryComplexity === 'simple' && contextTokens < 2000) {
    return 'claude-3-haiku-20240307';
  }

  // Use Sonnet for moderate complexity
  if (queryComplexity === 'moderate' || contextTokens < 4000) {
    return 'claude-3-sonnet-20240229';
  }

  // Use Opus only for complex queries
  return 'claude-3-opus-20240229';
}

function analyzeComplexity(query: string): 'simple' | 'moderate' | 'complex' {
  const lower = query.toLowerCase();

  // Simple queries
  if (lower.split(' ').length < 10 &&
      (lower.includes('pace') || lower.includes('vdot') || lower.includes('hello'))) {
    return 'simple';
  }

  // Complex queries
  if (lower.includes('plan') || lower.includes('analyze') || lower.includes('compare') ||
      lower.includes('why') || lower.includes('explain') || query.length > 200) {
    return 'complex';
  }

  return 'moderate';
}

// Only include tools relevant to the query
function getRelevantTools(query: string): Anthropic.Tool[] {
  const lower = query.toLowerCase();
  const allTools = coachToolDefinitions;

  // Filter tools based on query
  if (lower.includes('workout') || lower.includes('tomorrow')) {
    return allTools.filter(t =>
      ['prescribe_workout', 'get_planned_workout_by_date', 'suggest_next_workout'].includes(t.name)
    );
  }

  if (lower.includes('injury')) {
    return allTools.filter(t =>
      ['log_injury', 'get_injury_status', 'clear_injury'].includes(t.name)
    );
  }

  // Return minimal tool set for general queries
  return allTools.filter(t =>
    ['get_user_settings', 'get_recent_workouts', 'get_training_summary'].includes(t.name)
  );
}

// Estimate API cost
function estimateCost(model: string, inputTokens: number, outputChars: number): number {
  const outputTokens = Math.ceil(outputChars / 4);

  const pricing = {
    'claude-3-opus-20240229': { input: 15, output: 75 }, // per million tokens
    'claude-3-sonnet-20240229': { input: 3, output: 15 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
  };

  const modelPricing = pricing[model as keyof typeof pricing] || pricing['claude-3-sonnet-20240229'];

  const inputCost = (inputTokens / 1000000) * modelPricing.input;
  const outputCost = (outputTokens / 1000000) * modelPricing.output;

  return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimals
}