import Anthropic from '@anthropic-ai/sdk';
import { coachToolDefinitions, executeCoachTool } from '@/lib/coach-tools';
import { COACH_SYSTEM_PROMPT } from '@/lib/coach-prompt';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  try {
    const { messages, newMessage } = await request.json() as {
      messages: Message[];
      newMessage: string;
    };

    // Build conversation history for Claude
    const conversationHistory: Anthropic.MessageParam[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add the new user message
    conversationHistory.push({
      role: 'user',
      content: newMessage,
    });

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let assistantMessage = '';
          let continueLoop = true;

          while (continueLoop) {
            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1024,
              system: COACH_SYSTEM_PROMPT,
              tools: coachToolDefinitions as Anthropic.Tool[],
              messages: conversationHistory,
            });

            // Process the response
            for (const block of response.content) {
              if (block.type === 'text') {
                assistantMessage += block.text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: block.text })}\n\n`));
              } else if (block.type === 'tool_use') {
                // Execute the tool
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', tool: block.name })}\n\n`));

                try {
                  const toolResult = await executeCoachTool(block.name, block.input as Record<string, unknown>);

                  // Add assistant's tool use and the result to conversation
                  conversationHistory.push({
                    role: 'assistant',
                    content: response.content,
                  });

                  conversationHistory.push({
                    role: 'user',
                    content: [{
                      type: 'tool_result',
                      tool_use_id: block.id,
                      content: JSON.stringify(toolResult),
                    }],
                  });
                } catch (toolError) {
                  console.error('Tool execution error:', toolError);

                  // Send error result
                  conversationHistory.push({
                    role: 'assistant',
                    content: response.content,
                  });

                  conversationHistory.push({
                    role: 'user',
                    content: [{
                      type: 'tool_result',
                      tool_use_id: block.id,
                      content: JSON.stringify({ error: 'Tool execution failed' }),
                      is_error: true,
                    }],
                  });
                }
              }
            }

            // Check if we need to continue (tool use requires another call)
            if (response.stop_reason === 'tool_use') {
              // Continue the loop to get Claude's response after tool use
              continueLoop = true;
            } else {
              continueLoop = false;
            }
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', content: assistantMessage })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: 'An error occurred while processing your request.' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
