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

interface DemoSettings {
  name?: string;
  age?: number;
  yearsRunning?: number;
  currentWeeklyMileage?: number;
  vdot?: number;
  easyPaceSeconds?: number;
  tempoPaceSeconds?: number;
  [key: string]: unknown;
}

interface DemoWorkout {
  date: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPaceSeconds: number;
  workoutType: string;
}

interface DemoShoe {
  name: string;
  brand: string;
  model: string;
  totalMiles: number;
}

interface DemoData {
  settings: DemoSettings | null;
  workouts: DemoWorkout[];
  shoes: DemoShoe[];
}

function buildDemoSystemPrompt(demoData: DemoData): string {
  const { settings, workouts, shoes } = demoData;

  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  const demoContext = `
## DEMO MODE CONTEXT

You are coaching a demo user. Here is their data:

**Athlete Profile:**
- Name: ${settings?.name || 'Demo Runner'}
- Age: ${settings?.age || 32}
- Years Running: ${settings?.yearsRunning || 4}
- Current Weekly Mileage: ${settings?.currentWeeklyMileage || 35} miles
- VDOT: ${settings?.vdot || 45}
- Easy Pace: ${settings?.easyPaceSeconds ? formatPace(settings.easyPaceSeconds) : '9:00/mi'}
- Tempo Pace: ${settings?.tempoPaceSeconds ? formatPace(settings.tempoPaceSeconds) : '7:30/mi'}

**Recent Workouts:**
${workouts.slice(0, 5).map(w => `- ${w.date}: ${w.distanceMiles}mi ${w.workoutType} @ ${formatPace(w.avgPaceSeconds)}`).join('\n') || 'No recent workouts'}

**Shoes:**
${shoes.map(s => `- ${s.name} (${s.brand} ${s.model}): ${s.totalMiles} miles`).join('\n') || 'No shoes logged'}

**Important:** In demo mode, tools that access the database won't have data. Instead, use the context above to respond helpfully. Act as if you have this runner's full history and provide personalized coaching based on this data.

`;

  return demoContext + COACH_SYSTEM_PROMPT;
}

export async function POST(request: Request) {
  try {
    const { messages, newMessage, isDemo, demoData } = await request.json() as {
      messages: Message[];
      newMessage: string;
      isDemo?: boolean;
      demoData?: DemoData;
    };

    // Build system prompt - include demo context if in demo mode
    const systemPrompt = isDemo && demoData
      ? buildDemoSystemPrompt(demoData)
      : COACH_SYSTEM_PROMPT;

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
              system: systemPrompt,
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
