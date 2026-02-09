import Anthropic from '@anthropic-ai/sdk';
import { coachToolDefinitions, executeCoachTool, type DemoContext } from '@/lib/coach-tools';
import { COACH_SYSTEM_PROMPT } from '@/lib/coach-prompt';
import { getPersonaPromptModifier } from '@/lib/coach-personas';
import { getSettings } from '@/actions/settings';
import type { CoachPersona } from '@/lib/schema';
import { parseLocalDate } from '@/lib/utils';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Generate human-readable summary of tool execution results
function getToolResultSummary(toolName: string, result: unknown): string {
  if (!result || typeof result !== 'object') return 'Done';

  const r = result as Record<string, unknown>;

  switch (toolName) {
    case 'log_workout':
      return `Logged ${r.distanceMiles || r.distance || '?'}mi ${r.workoutType || 'run'}`;
    case 'add_race':
      return r.message || `Added ${r.name || 'race'} on ${r.date || '?'}`;
    case 'log_assessment':
      return `Recorded ${r.verdict || 'assessment'}`;
    case 'update_planned_workout':
    case 'modify_todays_workout':
      return r.preview ? 'Preview ready' : 'Workout updated';
    case 'swap_workouts':
      return 'Workouts swapped';
    case 'reschedule_workout':
      return `Rescheduled to ${r.newDate || '?'}`;
    case 'skip_workout':
      return 'Workout skipped';
    case 'convert_to_easy':
      return 'Converted to easy run';
    case 'make_down_week':
      return `Down week: ${r.affectedWorkoutIds ? (r.affectedWorkoutIds as number[]).length : '?'} workouts adjusted`;
    case 'log_injury':
      return `Logged ${r.bodyPart || 'injury'}`;
    case 'get_recent_workouts':
      return `Found ${Array.isArray(r.workouts) ? r.workouts.length : '?'} workouts`;
    case 'get_pace_zones':
      return 'Pace zones loaded';
    case 'get_current_weather':
      return r.temperature ? `${r.temperature}°F ${r.conditions || ''}` : 'Weather loaded';
    case 'get_outfit_recommendation':
      return 'Outfit recommendation ready';
    case 'predict_race_time':
      return r.predictedTime ? `Prediction: ${r.predictedTime}` : 'Prediction ready';
    default:
      if ('message' in r && typeof r.message === 'string') return r.message;
      if ('success' in r) return r.success ? 'Success' : 'Failed';
      return 'Done';
  }
}

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
  id: number;
  date: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPaceSeconds: number;
  workoutType: string;
  notes?: string;
  shoeId?: number;
  assessment?: {
    verdict: 'great' | 'good' | 'fine' | 'rough' | 'awful';
    rpe: number;
    legsFeel?: number;
    sleepQuality?: number;
    stress?: number;
    soreness?: number;
    note?: string;
  };
}

interface DemoShoe {
  id: number;
  name: string;
  brand: string;
  model: string;
  totalMiles: number;
}

interface DemoRace {
  id: number;
  name: string;
  date: string;
  distanceMeters: number;
  distanceLabel: string;
  priority: 'A' | 'B' | 'C';
  targetTimeSeconds: number | null;
  trainingPlanGenerated: boolean;
}

interface DemoPlannedWorkout {
  id: number;
  date: string;
  name: string;
  workoutType: string;
  targetDistanceMiles: number;
  targetDurationMinutes?: number;
  targetPaceSecondsPerMile?: number;
  description: string;
  rationale?: string;
  isKeyWorkout: boolean;
  status: 'scheduled' | 'completed' | 'skipped';
  phase?: string;
  weekNumber?: number;
}

interface DemoData {
  settings: DemoSettings | null;
  workouts: DemoWorkout[];
  shoes: DemoShoe[];
  races: DemoRace[];
  plannedWorkouts: DemoPlannedWorkout[];
}

function buildDemoSystemPrompt(demoData: DemoData, persona: CoachPersona | null = null): string {
  const { settings, workouts = [], shoes = [], races = [], plannedWorkouts = [] } = demoData;
  const personaModifier = getPersonaPromptModifier(persona);

  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get today's date and this week's planned workouts (Monday start)
  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date();
  const dayOfWeek = weekStart.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const thisWeekWorkouts = plannedWorkouts
    .filter(w => w.date >= weekStartStr && w.date <= weekEndStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const todaysWorkout = plannedWorkouts.find(w => w.date === today);

  // Get upcoming races
  const upcomingRaces = races
    .filter(r => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const demoContext = `
## DEMO MODE - FULL COACHING CAPABILITIES ACTIVE

You are coaching a demo user. You have FULL access to their data and can make changes to their training plan.

**Athlete Profile:**
- Name: ${settings?.name || 'Demo Runner'}
- Age: ${settings?.age || 32}
- Years Running: ${settings?.yearsRunning || 4}
- Current Weekly Mileage: ${settings?.currentWeeklyMileage || 35} miles
- VDOT: ${settings?.vdot || 45}
- Easy Pace: ${settings?.easyPaceSeconds ? formatPace(settings.easyPaceSeconds) : '9:00/mi'}
- Tempo Pace: ${settings?.tempoPaceSeconds ? formatPace(settings.tempoPaceSeconds) : '7:30/mi'}
- Plan Aggressiveness: ${settings?.planAggressiveness || 'moderate'}

**Upcoming Races:**
${upcomingRaces.length > 0 ? upcomingRaces.map(r => {
  const daysUntil = Math.ceil((parseLocalDate(r.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  return `- ${r.name} (${r.distanceLabel}, ${r.priority}-priority): ${r.date} (${daysUntil} days)${r.targetTimeSeconds ? ` - Target: ${formatTime(r.targetTimeSeconds)}` : ''}`;
}).join('\n') : 'No upcoming races'}

**Today's Planned Workout:**
${todaysWorkout ? `${todaysWorkout.name} - ${todaysWorkout.description}
  Distance: ${todaysWorkout.targetDistanceMiles} miles${todaysWorkout.targetPaceSecondsPerMile ? ` @ ${formatPace(todaysWorkout.targetPaceSecondsPerMile)}` : ''}
  Phase: ${todaysWorkout.phase || 'N/A'}` : 'Rest day or no workout planned'}

**This Week's Plan:**
${thisWeekWorkouts.length > 0 ? thisWeekWorkouts.map(w => {
  const dayName = new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
  return `- ${dayName} ${w.date}: ${w.name} (${w.targetDistanceMiles}mi ${w.workoutType})${w.status !== 'scheduled' ? ` [${w.status}]` : ''}`;
}).join('\n') : 'No workouts planned this week'}

**Recent Completed Workouts:**
${workouts.slice(0, 5).map(w => `- ${w.date}: ${w.distanceMiles.toFixed(1)}mi ${w.workoutType} @ ${formatPace(w.avgPaceSeconds)}`).join('\n') || 'No recent workouts'}

**Shoes:**
${shoes.map(s => `- ${s.name} (${s.brand} ${s.model}): ${s.totalMiles} miles`).join('\n') || 'No shoes logged'}

**IMPORTANT - Demo Mode Capabilities:**
In demo mode, you CAN and SHOULD use tools to help the athlete. When you use tools that modify data (like adding races, adjusting workouts, logging runs), the changes will be applied to the user's local demo data.

You can:
- Add new races to their calendar
- Modify their training plan (swap workouts, adjust distances, convert to easy, make down weeks)
- Log workouts for them
- Adjust their schedule for time trials, tune-up races, etc.

When making plan changes, ALWAYS explain what you're doing and why. For significant changes, propose the change first and ask for confirmation before executing.

`;

  return demoContext + COACH_SYSTEM_PROMPT + '\n\n' + personaModifier;
}

export async function POST(request: Request) {
  const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  console.log(`[${requestId}] Chat API request received`);

  try {
    const { messages, newMessage, isDemo, demoData } = await request.json() as {
      messages: Message[];
      newMessage: string;
      isDemo?: boolean;
      demoData?: DemoData;
    };

    console.log(`[${requestId}] Mode: ${isDemo ? 'DEMO' : 'PRODUCTION'}, Message: "${newMessage.slice(0, 100)}..."`);

    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(`[${requestId}] ANTHROPIC_API_KEY is not set!`);
      return new Response(
        JSON.stringify({ error: 'API configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user settings for persona (non-demo mode)
    let userPersona: CoachPersona | null = null;
    if (!isDemo) {
      try {
        const settings = await getSettings();
        userPersona = (settings?.coachPersona as CoachPersona) || null;
        console.log(`[${requestId}] User persona: ${userPersona || 'default'}`);
      } catch (settingsError) {
        console.warn(`[${requestId}] Failed to fetch settings:`, settingsError);
        // Settings not available, use default persona
      }
    }

    // Build system prompt - include demo context if in demo mode
    const personaModifier = getPersonaPromptModifier(userPersona);
    const systemPrompt = isDemo && demoData
      ? buildDemoSystemPrompt(demoData, userPersona)
      : COACH_SYSTEM_PROMPT + '\n\n' + personaModifier;

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
                console.log(`[${requestId}] Tool call: ${block.name}`, JSON.stringify(block.input).slice(0, 200));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', tool: block.name })}\n\n`));

                // Build demo context if in demo mode
                const demoContext: DemoContext | undefined = isDemo && demoData ? {
                  isDemo: true,
                  settings: demoData.settings,
                  workouts: demoData.workouts,
                  shoes: demoData.shoes,
                  races: demoData.races || [],
                  plannedWorkouts: demoData.plannedWorkouts || [],
                } : undefined;

                try {
                  const toolResult = await executeCoachTool(block.name, block.input as Record<string, unknown>, demoContext);
                  console.log(`[${requestId}] Tool ${block.name} result:`, JSON.stringify(toolResult).slice(0, 300));

                  // If tool returns a demo action, send it to the client
                  if (toolResult && typeof toolResult === 'object' && 'demoAction' in toolResult) {
                    console.log(`[${requestId}] Demo action:`, (toolResult as { demoAction: string }).demoAction);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'demo_action', action: toolResult })}\n\n`));
                  }

                  // Send tool result to client for visibility (success)
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'tool_result',
                    tool: block.name,
                    success: true,
                    summary: getToolResultSummary(block.name, toolResult)
                  })}\n\n`));

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
                  console.error(`[${requestId}] Tool ${block.name} FAILED:`, toolError);
                  const errorMessage = toolError instanceof Error ? toolError.message : 'Unknown error';

                  // Send tool error to client for visibility
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'tool_result',
                    tool: block.name,
                    success: false,
                    error: errorMessage
                  })}\n\n`));

                  // Send error result to Claude
                  conversationHistory.push({
                    role: 'assistant',
                    content: response.content,
                  });

                  conversationHistory.push({
                    role: 'user',
                    content: [{
                      type: 'tool_result',
                      tool_use_id: block.id,
                      content: JSON.stringify({ error: errorMessage }),
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
          console.log(`[${requestId}] Chat completed successfully`);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', content: assistantMessage })}\n\n`));
          controller.close();
        } catch (error) {
          console.error(`[${requestId}] Stream error:`, error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: `Error: ${errorMsg}` })}\n\n`));
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
