import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { OlympicCoachRouter } from '@/lib/olympic-coach-router';
import { OlympicSystemPrompts } from '@/lib/olympic-system-prompts';
import { ContextManager } from '@/lib/context-manager';
import { LocalIntelligence } from '@/lib/local-intelligence';
import { compressConversation } from '@/lib/conversation-compression';
import { coachToolDefinitions, executeCoachTool } from '@/lib/coach-tools';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  const { messages, newMessage, userSettings, profileId, forceModel } = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. Try local handling first for simple queries
        const localAI = new LocalIntelligence();
        const localResponse = await localAI.handleLocally(newMessage, userSettings);

        if (localResponse.handled && localResponse.confidence > 0.85 && !forceModel) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'text',
            content: localResponse.response
          })}\n\n`));

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'metadata',
            model: 'local',
            cost: 0,
            complexity: 'simple'
          })}\n\n`));

          controller.close();
          return;
        }

        // 2. Route to appropriate model
        const router = new OlympicCoachRouter();
        const classification = router.classifyAndRoute(newMessage, userSettings);

        // Allow user to override model selection
        const selectedModel = forceModel || classification.suggestedModel;

        // 3. Build optimized context
        const contextManager = new ContextManager();
        const context = await contextManager.buildContext(newMessage, messages, userSettings);

        // 4. Compress conversation
        const compressed = await compressConversation(
          context.relevantHistory,
          profileId,
          selectedModel.includes('haiku') ? 5 : 15 // Less context for cheaper models
        );

        // 5. Build Olympic-level system prompt
        const promptBuilder = new OlympicSystemPrompts();
        const systemPrompt = classification.complexity === 'expert'
          ? promptBuilder.getOlympicPlanningPrompt()
          : promptBuilder.buildSystemPrompt(
              classification.category,
              userSettings,
              classification.requiredExpertise,
              selectedModel.includes('opus')
            );

        // 6. Send metadata about the routing decision
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'metadata',
          model: selectedModel,
          complexity: classification.complexity,
          category: classification.category,
          expertise: classification.requiredExpertise,
          estimatedCost: classification.estimatedCost,
          tokensSaved: messages.length * 100 - compressed.tokenCount // Rough estimate
        })}\n\n`));

        // 7. Make API call
        let assistantContent = '';
        let toolCalls = [];

        const response = await anthropic.messages.create({
          model: selectedModel,
          max_tokens: selectedModel.includes('opus') ? 2048 : 1024,
          temperature: classification.category === 'injury' ? 0.3 : 0.7, // Lower temp for medical
          system: systemPrompt,
          messages: [
            ...compressed.messages,
            { role: 'user', content: newMessage }
          ],
          tools: getOptimizedTools(classification.category),
          stream: true
        });

        // 8. Stream response
        for await (const event of response) {
          if (event.type === 'content_block_start' && event.content_block.type === 'text') {
            // Starting text block
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            assistantContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'text',
              content: text
            })}\n\n`));
          } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
            const toolName = event.content_block.name;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'tool_call',
              tool: toolName
            })}\n\n`));
          } else if (event.type === 'content_block_stop' && event.content_block.type === 'tool_use') {
            // Tool execution would happen here
            // For now, we'll handle it after streaming completes
          }
        }

        // 9. Cache response if successful
        if (assistantContent) {
          await localAI.cacheResponse(newMessage, assistantContent, toolCalls);
        }

        // 10. Send final cost calculation
        const finalCost = calculateActualCost(
          selectedModel,
          compressed.tokenCount,
          assistantContent.length
        );

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          finalCost,
          tokensUsed: {
            input: compressed.tokenCount,
            output: Math.ceil(assistantContent.length / 4)
          }
        })}\n\n`));

        controller.close();

      } catch (error) {
        console.error('Olympic coach error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Get only the tools needed for specific query types
function getOptimizedTools(category: string): Anthropic.Tool[] {
  const toolMap: Record<string, string[]> = {
    training: [
      'prescribe_workout',
      'get_recent_workouts',
      'get_training_summary',
      'suggest_next_workout'
    ],
    racing: [
      'get_races',
      'add_race',
      'get_race_day_plan',
      'generate_training_plan'
    ],
    injury: [
      'log_injury',
      'get_injury_status',
      'clear_injury',
      'suggest_workout_modification'
    ],
    general: [
      'get_user_settings',
      'get_recent_workouts'
    ]
  };

  const relevantToolNames = toolMap[category] || toolMap.general;
  return coachToolDefinitions.filter(t => relevantToolNames.includes(t.name));
}

function calculateActualCost(model: string, inputTokens: number, outputChars: number): number {
  const outputTokens = Math.ceil(outputChars / 4);

  const pricing: Record<string, { input: number; output: number }> = {
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
    'claude-3-opus-20240229': { input: 15, output: 75 }
  };

  const modelPricing = pricing[model] || { input: 3, output: 15 };

  return (inputTokens / 1000000) * modelPricing.input +
         (outputTokens / 1000000) * modelPricing.output;
}