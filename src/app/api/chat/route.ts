import Anthropic from '@anthropic-ai/sdk';
import {
  coachToolDefinitions,
  executeCoachTool,
  isMutatingCoachTool,
  PUBLIC_MODE_READ_ONLY_ERROR,
  type DemoContext
} from '@/lib/coach-tools';
import { COACH_SYSTEM_PROMPT } from '@/lib/coach-prompt';
import { getPersonaPromptModifier } from '@/lib/coach-personas';
import { getSettings } from '@/actions/settings';
import type { CoachPersona } from '@/lib/schema';
import { getActiveProfileId } from '@/lib/profile-server';
import { parseLocalDate, formatPace } from '@/lib/utils';
import { compressConversation } from '@/lib/simple-conversation-compress';
import { MultiModelRouter, type ModelSelection } from '@/lib/multi-model-router';
import { processConversationInsights, recallRelevantContext } from '@/lib/coaching-memory-integration';
import { CoachingMemory } from '@/lib/coaching-memory';
import { logApiUsage } from '@/actions/api-usage';
import { getWorkouts } from '@/actions/workouts';
import { getUpcomingRaces, getRaceResults } from '@/actions/races';
import { getCurrentWeekPlan, getTodaysWorkout, getTrainingSummary } from '@/actions/training-plan';
import { getFitnessTrendData } from '@/actions/fitness';
import { getVdotTrend } from '@/actions/vdot-history';
import { LocalIntelligence } from '@/lib/local-intelligence';
import { cookies } from 'next/headers';
import {
  resolveAuthRoleFromGetter,
  resolveEffectivePublicMode,
  resolveSessionModeOverrideFromGetter,
} from '@/lib/auth-access';

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
      return (r.message as string) || `Added ${r.name || 'race'} on ${r.date || '?'}`;
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

const SIMPLE_TOOL_NAMES = new Set([
  'get_user_settings',
  'get_recent_workouts',
  'get_training_summary',
  'get_pace_zones',
  'get_todays_planned_workout',
  'get_planned_workout_by_date',
  'get_context_summary',
  'get_proactive_alerts',
  'get_fitness_trend',
  'get_readiness_score',
  'predict_race_time',
  'get_current_weather',
  'get_outfit_recommendation',
]);

const MODERATE_TOOL_NAMES = new Set([
  ...Array.from(SIMPLE_TOOL_NAMES),
  'prescribe_workout',
  'suggest_next_workout',
  'modify_todays_workout',
  'update_planned_workout',
  'suggest_workout_modification',
  'reschedule_workout',
  'skip_workout',
  'swap_workouts',
  'convert_to_easy',
  'make_down_week',
  'log_workout',
  'log_assessment',
  'add_race',
  'get_training_load',
  'analyze_workout_patterns',
  'analyze_recovery_pattern',
  'compare_workouts',
  'get_fatigue_indicators',
  'estimate_workout_quality',
  'get_performance_model',
]);

function getToolsForTurn(
  message: string,
  complexity: 'simple' | 'moderate' | 'complex'
): Anthropic.Tool[] {
  if (complexity === 'complex') {
    return coachToolDefinitions as Anthropic.Tool[];
  }

  const lower = message.toLowerCase();
  const mutationHint = /\b(add|delete|remove|update|modify|swap|move|resched|skip|generate|apply|change)\b/.test(lower);
  if (mutationHint && complexity !== 'simple') {
    return coachToolDefinitions as Anthropic.Tool[];
  }

  const allowed = complexity === 'simple' ? SIMPLE_TOOL_NAMES : MODERATE_TOOL_NAMES;
  const filtered = coachToolDefinitions.filter(t => allowed.has(t.name));
  if (filtered.length < 5) {
    return coachToolDefinitions as Anthropic.Tool[];
  }
  return filtered as Anthropic.Tool[];
}

function getMaxTokensForComplexity(complexity: 'simple' | 'moderate' | 'complex'): number {
  if (complexity === 'simple') return 900;
  if (complexity === 'moderate') return 1800;
  return 3200;
}

function buildLocalResponseStream(payload: {
  response: string;
  confidence: number;
}) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: payload.response })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'metadata',
        modelUsage: {
          iterations: 0,
          toolsUsed: [],
          estimatedCost: 0,
          modelsUsed: 0,
          method: 'local',
          confidence: payload.confidence,
        }
      })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      controller.close();
    },
  });
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

function formatTargetTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function buildAthleteContext(profileId: number): Promise<string> {
  try {
    const [settings, recentWorkouts, workoutsForQuality, todaysWorkout, weekPlan, upcomingRaces, raceResults, trainingSummary, fitnessTrend, vdotTrend] = await Promise.all([
      getSettings(profileId),
      getWorkouts(5, profileId),
      getWorkouts(40, profileId),
      getTodaysWorkout(),
      getCurrentWeekPlan(),
      getUpcomingRaces(profileId),
      getRaceResults(profileId),
      getTrainingSummary(),
      getFitnessTrendData(42, profileId),
      getVdotTrend(90, profileId),
    ]);

    if (!settings) return '';

    // Build athlete profile line
    const profileParts = [settings.name || 'Athlete'];
    if (settings.age) profileParts.push(`${settings.age}`);
    if (settings.yearsRunning) profileParts.push(`running ${settings.yearsRunning} years`);
    if (settings.vdot) profileParts.push(`VDOT ${Number(settings.vdot).toFixed(1)}`);

    // Build paces line
    const paceParts: string[] = [];
    if (settings.easyPaceSeconds) paceParts.push(`Easy ${formatPace(settings.easyPaceSeconds)}/mi`);
    if (settings.marathonPaceSeconds) paceParts.push(`Marathon ${formatPace(settings.marathonPaceSeconds)}/mi`);
    if (settings.tempoPaceSeconds) paceParts.push(`Tempo ${formatPace(settings.tempoPaceSeconds)}/mi`);
    if (settings.thresholdPaceSeconds) paceParts.push(`Threshold ${formatPace(settings.thresholdPaceSeconds)}/mi`);
    if (settings.intervalPaceSeconds) paceParts.push(`Interval ${formatPace(settings.intervalPaceSeconds)}/mi`);

    // Upcoming races (within 26 weeks)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 26 * 7);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relevantRaces = upcomingRaces.filter((r: any) => parseLocalDate(r.date) <= maxDate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raceLines = relevantRaces.map((r: any) => {
      const d = Math.ceil((parseLocalDate(r.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      let line = `- ${r.name} [race_id=${r.id}] (${r.distanceLabel}, ${r.priority}-priority): ${r.date} (${d} days)`;
      if (r.targetTimeSeconds) line += ` — Target: ${formatTargetTime(r.targetTimeSeconds)}`;
      if (r.trainingPlanGenerated) line += ` [has plan]`;
      return line;
    });

    // Past race results (most recent 5)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raceResultLines = raceResults.slice(0, 5).map((r: any) => {
      const time = formatTargetTime(r.finishTimeSeconds);
      let line = `- ${r.date}: ${r.distanceLabel} in ${time}`;
      if (r.raceName) line += ` (${r.raceName})`;
      if (r.effortLevel && r.effortLevel !== 'all_out') line += ` [${r.effortLevel}]`;
      if (r.calculatedVdot) line += ` — VDOT ${r.calculatedVdot.toFixed(1)}`;
      return line;
    });

    // Training phase
    let phaseLine = 'No active training plan';
    if (trainingSummary.currentPhase && weekPlan.currentBlock) {
      phaseLine = `${trainingSummary.currentPhase.charAt(0).toUpperCase() + trainingSummary.currentPhase.slice(1)} phase`;
      if (weekPlan.currentBlock.weekNumber) {
        phaseLine += `, Week ${weekPlan.currentBlock.weekNumber}`;
      }
      if (trainingSummary.phaseFocus) {
        phaseLine += ` — ${trainingSummary.phaseFocus}`;
      }
    }

    // Today's workout
    let todayLine = 'Rest day or no workout planned';
    if (todaysWorkout) {
      todayLine = `${todaysWorkout.name}`;
      if (todaysWorkout.targetDistanceMiles) {
        todayLine += ` — ${todaysWorkout.targetDistanceMiles}mi`;
      }
      if (todaysWorkout.description) {
        todayLine += ` (${todaysWorkout.description.slice(0, 100)})`;
      }
      if (todaysWorkout.isKeyWorkout) {
        todayLine += ' [KEY]';
      }
    }

    // This week's workouts
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().toISOString().split('T')[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weekLines = weekPlan.workouts.map((w: any) => {
      const d = new Date(w.date + 'T12:00:00');
      const dayName = dayNames[d.getDay()];
      const isToday = w.date === today;
      let line = `- ${dayName}: ${w.name} ${w.targetDistanceMiles ? `${w.targetDistanceMiles}mi` : ''}`;
      if (w.status !== 'scheduled') line += ` [${w.status}]`;
      if (isToday) line += ' ← TODAY';
      return line;
    });

    // Recent workouts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentLines = recentWorkouts.map((w: any) => {
      const pace = w.durationMinutes && w.distanceMiles
        ? `${formatPace(Math.round((w.durationMinutes * 60) / w.distanceMiles))}/mi`
        : '';
      let line = `- ${w.date}: ${w.distanceMiles?.toFixed(1)}mi ${w.workoutType}`;
      if (pace) line += ` @ ${pace}`;
      if (w.assessment?.verdict) line += ` — "${w.assessment.verdict}"`;
      if (w.assessment?.rpe) line += ` (RPE ${w.assessment.rpe})`;
      return line;
    });

    const excludedRecent = workoutsForQuality.filter((w: any) => !!w.excludeFromEstimates);
    const excludedReasons = excludedRecent
      .map((w: any) => w.excludeReason)
      .filter((r: unknown): r is string => typeof r === 'string' && r.trim().length > 0)
      .slice(0, 3);
    const exclusionLine = `${excludedRecent.length} of ${workoutsForQuality.length} recent workouts excluded from fitness estimates`;

    const vdotTrendLine = vdotTrend.change != null
      ? `${vdotTrend.trend} (${vdotTrend.change > 0 ? '+' : ''}${vdotTrend.change.toFixed(1)} over 90d)`
      : vdotTrend.trend;
    const loadTrendLine = [
      `CTL ${fitnessTrend.currentCtl.toFixed(1)}`,
      `ATL ${fitnessTrend.currentAtl.toFixed(1)}`,
      `TSB ${fitnessTrend.currentTsb.toFixed(1)}`,
      fitnessTrend.ctlChange != null ? `CTL Δ4w ${fitnessTrend.ctlChange > 0 ? '+' : ''}${fitnessTrend.ctlChange.toFixed(1)}` : null,
      fitnessTrend.rampRate != null ? `Ramp ${fitnessTrend.rampRate > 0 ? '+' : ''}${fitnessTrend.rampRate.toFixed(1)}/wk (${fitnessTrend.rampRateRisk})` : null,
    ].filter(Boolean).join(' | ');

    const contextBlock = `## CURRENT ATHLETE SNAPSHOT (auto-loaded — do NOT call get_context_summary)

**Athlete:** ${profileParts.join(', ')}
${paceParts.length > 0 ? `**Paces:** ${paceParts.join(' | ')}\n` : ''}**Weekly Mileage:** ${settings.currentWeeklyMileage || '?'} mi/week${settings.peakWeeklyMileageTarget ? ` (target: ${settings.peakWeeklyMileageTarget})` : ''}

**Upcoming Races:**
${raceLines.length > 0 ? raceLines.join('\n') : 'No upcoming races'}
${raceResultLines.length > 0 ? `**Recent Race Results:**\n${raceResultLines.join('\n')}\n` : ''}**Training Phase:** ${phaseLine}
**Fitness trend:** ${loadTrendLine}
**VDOT trend:** ${vdotTrendLine}
**Estimate quality:** ${exclusionLine}
${excludedReasons.length > 0 ? `**Excluded reasons:** ${excludedReasons.join(' | ')}` : ''}

**Today's Workout:** ${todayLine}

**This Week:**
${weekLines.length > 0 ? weekLines.join('\n') : 'No workouts planned this week'}
Week total: ${weekPlan.completedMiles}/${weekPlan.totalMiles} mi completed

**Last ${recentWorkouts.length} Runs:**
${recentLines.length > 0 ? recentLines.join('\n') : 'No recent workouts'}`;

    return contextBlock;
  } catch (error) {
    console.error('Failed to build athlete context:', error);
    return '';
  }
}

function buildDemoSystemPrompt(demoData: DemoData, persona: CoachPersona | null = null): string {
  const { settings, workouts = [], shoes = [], races = [], plannedWorkouts = [] } = demoData;
  const personaModifier = getPersonaPromptModifier(persona);

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
- VDOT: ${settings?.vdot ? Number(settings.vdot).toFixed(1) : '45.0'}
- Easy Pace: ${settings?.easyPaceSeconds ? `${formatPace(settings.easyPaceSeconds)}/mi` : '9:00/mi'}
- Tempo Pace: ${settings?.tempoPaceSeconds ? `${formatPace(settings.tempoPaceSeconds)}/mi` : '7:30/mi'}
- Plan Aggressiveness: ${settings?.planAggressiveness || 'moderate'}

**Upcoming Races:**
${upcomingRaces.length > 0 ? upcomingRaces.map(r => {
  const daysUntil = Math.ceil((parseLocalDate(r.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  return `- ${r.name} (${r.distanceLabel}, ${r.priority}-priority): ${r.date} (${daysUntil} days)${r.targetTimeSeconds ? ` - Target: ${formatTime(r.targetTimeSeconds)}` : ''}`;
}).join('\n') : 'No upcoming races'}

**Today's Planned Workout:**
${todaysWorkout ? `${todaysWorkout.name} - ${todaysWorkout.description}
  Distance: ${todaysWorkout.targetDistanceMiles} miles${todaysWorkout.targetPaceSecondsPerMile ? ` @ ${formatPace(todaysWorkout.targetPaceSecondsPerMile)}/mi` : ''}
  Phase: ${todaysWorkout.phase || 'N/A'}` : 'Rest day or no workout planned'}

**This Week's Plan:**
${thisWeekWorkouts.length > 0 ? thisWeekWorkouts.map(w => {
  const dayName = new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
  return `- ${dayName} ${w.date}: ${w.name} (${w.targetDistanceMiles}mi ${w.workoutType})${w.status !== 'scheduled' ? ` [${w.status}]` : ''}`;
}).join('\n') : 'No workouts planned this week'}

**Recent Completed Workouts:**
${workouts.slice(0, 5).map(w => `- ${w.date}: ${w.distanceMiles.toFixed(1)}mi ${w.workoutType} @ ${formatPace(w.avgPaceSeconds)}/mi`).join('\n') || 'No recent workouts'}

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
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  const publicModeEnabled = resolveEffectivePublicMode({
    role: resolveAuthRoleFromGetter(getCookie),
    sessionOverride: resolveSessionModeOverrideFromGetter(getCookie),
  });

  try {
    const { messages, newMessage, isDemo, demoData } = await request.json() as {
      messages: Message[];
      newMessage: string;
      isDemo?: boolean;
      demoData?: DemoData;
    };


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
    let activeProfileId: number | undefined;
    let currentSettings: Awaited<ReturnType<typeof getSettings>> = null;
    if (!isDemo) {
      try {
        activeProfileId = await getActiveProfileId();
        currentSettings = await getSettings(activeProfileId);
        userPersona = (currentSettings?.coachPersona as CoachPersona) || null;
      } catch (settingsError) {
        console.warn(`[${requestId}] Failed to fetch settings:`, settingsError);
        // Settings not available, use default persona
      }
    }

    // Local fast-path for simple deterministic queries (zero model cost).
    if (!isDemo && currentSettings) {
      try {
        const localAI = new LocalIntelligence();
        const localResponse = await localAI.handleLocally(newMessage, currentSettings);
        if (localResponse.handled && localResponse.confidence >= 0.95 && localResponse.response) {
          return new Response(buildLocalResponseStream({
            response: localResponse.response,
            confidence: localResponse.confidence,
          }), {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        }
      } catch (localError) {
        console.warn(`[${requestId}] Local fast-path failed, falling back to model:`, localError);
      }
    }

    // Build system prompt - include demo context if in demo mode
    const personaModifier = getPersonaPromptModifier(userPersona);
    let systemPrompt = isDemo && demoData
      ? buildDemoSystemPrompt(demoData, userPersona)
      : COACH_SYSTEM_PROMPT + '\n\n' + personaModifier;

    // Inject athlete context for real users (so coach knows context immediately)
    if (!isDemo) {
      try {
        const profileId = activeProfileId ?? await getActiveProfileId();
        if (profileId) {
          const athleteContext = await buildAthleteContext(profileId);
          if (athleteContext) {
            systemPrompt = athleteContext + '\n\n' + systemPrompt;
          }

          // Also add relevant memories on first message
          if (messages.length === 0) {
            const context = await recallRelevantContext(profileId, newMessage);
            if (context.relevantMemories.length > 0) {
              systemPrompt += '\n\n**Relevant memories about this athlete:**\n';
              context.relevantMemories.forEach(memory => {
                systemPrompt += `- ${memory}\n`;
              });
            }
          }
        }
      } catch (error) {
        console.error(`[${requestId}] Failed to build athlete context:`, error);
      }
    }

    // Build conversation history for Claude
    let conversationHistory: Anthropic.MessageParam[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Compress aggressively to keep token costs down as history grows.
    if (conversationHistory.length > 18) {
      conversationHistory = compressConversation(conversationHistory as unknown as import('@/lib/simple-conversation-compress').Message[], 14) as unknown as Anthropic.MessageParam[];
    }

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

          let loopIteration = 0;
          const MAX_ITERATIONS = 10; // Safety limit to prevent infinite loops

          // Initialize multi-model router
          const modelRouter = new MultiModelRouter();
          const toolsUsedInConversation: string[] = [];
          let totalCost = 0;
          let totalInputTokens = 0;
          let totalOutputTokens = 0;

          // Track failed tool calls to prevent infinite retries
          const failedToolCalls = new Map<string, number>();
          let lastModelSelection: ModelSelection | null = null;

          while (continueLoop && loopIteration < MAX_ITERATIONS) {
            loopIteration++;

            // Select model based on message and context
            const latestMessage = conversationHistory[conversationHistory.length - 1];
            const messageContent = typeof latestMessage.content === 'string'
              ? latestMessage.content
              : (latestMessage.content[0] as { text?: string })?.text || '';

            const modelSelection = modelRouter.selectModel(
              messageContent,
              toolsUsedInConversation,
              conversationHistory.length,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              messages.find((m: any) => m.content?.includes('/model:'))?.content.match(/\/model:(\w+)/)?.[1]
            );
            lastModelSelection = modelSelection;
            const selectedTools = getToolsForTurn(messageContent, modelSelection.complexity)
              .filter((tool) => !publicModeEnabled || !isMutatingCoachTool(tool.name));
            const maxTokens = getMaxTokensForComplexity(modelSelection.complexity);

            const response = await anthropic.messages.create({
              model: modelSelection.model,
              max_tokens: maxTokens,
              system: systemPrompt,
              tools: selectedTools,
              messages: conversationHistory,
            });

            // Extract token usage from response and calculate actual cost
            if ('usage' in response && response.usage) {
              const actualInput = response.usage.input_tokens || 0;
              const actualOutput = response.usage.output_tokens || 0;
              totalInputTokens += actualInput;
              totalOutputTokens += actualOutput;
              // Calculate actual cost from real token counts
              const pricing = modelRouter.getModelPricing(modelSelection.model);
              totalCost += (actualInput / 1_000_000) * pricing.input +
                           (actualOutput / 1_000_000) * pricing.output;
            }


            // First, add the assistant's response (with tool uses) to conversation history
            let hasToolUse = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolResults: Array<{ tool_use_id: string; content: any }> = [];

            // Process the response
            for (const block of response.content) {
              if (block.type === 'text') {
                assistantMessage += block.text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: block.text })}\n\n`));
              } else if (block.type === 'tool_use') {
                hasToolUse = true;
                // Track tool usage
                toolsUsedInConversation.push(block.name);
                // Execute the tool
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
                  if (publicModeEnabled && isMutatingCoachTool(block.name)) {
                    const blockedResult = {
                      error: PUBLIC_MODE_READ_ONLY_ERROR,
                      code: 'PUBLIC_MODE_READ_ONLY',
                      tool: block.name,
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'tool_result',
                      tool: block.name,
                      success: false,
                      error: blockedResult.error
                    })}\n\n`));
                    toolResults.push({
                      tool_use_id: block.id,
                      content: JSON.stringify(blockedResult),
                    });
                    continue;
                  }

                  const toolResult = await executeCoachTool(
                    block.name,
                    block.input as Record<string, unknown>,
                    demoContext,
                    { publicModeEnabled }
                  );

                  // Check if tool returned an error
                  const isError = toolResult && typeof toolResult === 'object' && 'error' in toolResult;
                  if (isError) {
                    // Track failed tool calls
                    const toolKey = `${block.name}_${JSON.stringify(block.input)}`;
                    const failCount = (failedToolCalls.get(toolKey) || 0) + 1;
                    failedToolCalls.set(toolKey, failCount);

                    // If this tool/input combo has failed too many times, stop trying
                    if (failCount >= 3) {
                      console.error(`[${requestId}] Tool ${block.name} returned error 3 times with same input, stopping retries`);
                      // Send a message to Claude explaining the issue
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'text',
                        content: `\n\n[System: The ${block.name} tool has failed 3 times with the same parameters. Error: ${(toolResult as Record<string, unknown>).error}. Please try a different approach or fix the parameters.]`
                      })}\n\n`));
                      continueLoop = false;
                    }
                  }

                  // If tool returns a demo action, send it to the client
                  if (!isError && toolResult && typeof toolResult === 'object' && 'demoAction' in toolResult) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'demo_action', action: toolResult })}\n\n`));
                  }

                  // Send tool result to client for visibility
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'tool_result',
                    tool: block.name,
                    success: !isError,
                    summary: getToolResultSummary(block.name, toolResult)
                  })}\n\n`));

                  // Collect tool result for later
                  toolResults.push({
                    tool_use_id: block.id,
                    content: JSON.stringify(toolResult),
                  });
                } catch (toolError) {
                  console.error('=== CHAT ERROR (Tool) ===', block.name, toolError);
                  console.error(`[${requestId}] Tool ${block.name} FAILED:`, toolError);
                  if (toolError instanceof Error) {
                    console.error('Stack trace:', toolError.stack);
                  }
                  const errorMessage = toolError instanceof Error ? toolError.message : 'Unknown error';

                  // Track failed tool calls
                  const toolKey = `${block.name}_${JSON.stringify(block.input)}`;
                  const failCount = (failedToolCalls.get(toolKey) || 0) + 1;
                  failedToolCalls.set(toolKey, failCount);

                  // If this tool/input combo has failed too many times, stop trying
                  if (failCount >= 3) {
                    console.error(`[${requestId}] Tool ${block.name} failed 3 times with same input, stopping retries`);
                    continueLoop = false;
                  }

                  // Send tool error to client for visibility
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'tool_result',
                    tool: block.name,
                    success: false,
                    error: errorMessage
                  })}\n\n`));

                  // Collect error result
                  toolResults.push({
                    tool_use_id: block.id,
                    content: JSON.stringify({ error: errorMessage }),
                  });
                }
              }
            }

            // Now add the assistant response and all tool results to conversation history
            if (hasToolUse) {
              // Add assistant's response with tool uses
              conversationHistory.push({
                role: 'assistant',
                content: response.content,
              });

              // Add all tool results in a single user message
              if (toolResults.length > 0) {
                conversationHistory.push({
                  role: 'user',
                  content: toolResults.map(tr => ({
                    type: 'tool_result' as const,
                    tool_use_id: tr.tool_use_id,
                    content: tr.content,
                  })),
                });
              }
            }

            // Check if we need to continue (tool use or truncated response)
            if (response.stop_reason === 'tool_use' && hasToolUse && toolResults.length > 0) {
              // Continue the loop to get Claude's response after tool use
              continueLoop = true;
            } else if (response.stop_reason === 'max_tokens') {
              // Response was truncated — ask Claude to continue
              continueLoop = true;
            } else {
              continueLoop = false;
            }
          }

          // Check if we hit the iteration limit
          if (loopIteration >= MAX_ITERATIONS) {
            console.error(`[${requestId}] WARNING: Hit max iteration limit (${MAX_ITERATIONS})`);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'text',
              content: '\n\n[System: Maximum conversation iterations reached. Please try a simpler request.]'
            })}\n\n`));
          }

          // Send metadata about model usage
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'metadata',
            modelUsage: {
              iterations: loopIteration,
              toolsUsed: Array.from(new Set(toolsUsedInConversation)), // Unique tools
              estimatedCost: Math.round(totalCost * 10000) / 10000,
              modelsUsed: loopIteration // This could track each model used per iteration
            }
          })}\n\n`));

          // Extract insights and roll summaries periodically to keep memory fresh.
          if (!isDemo && !publicModeEnabled && messages.length > 0 && messages.length % 4 === 0) {
            try {
              const profileId = await getActiveProfileId();
              if (profileId) {
                const latestConversation = [
                  ...messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
                  { role: 'user', content: newMessage },
                  { role: 'assistant', content: assistantMessage.slice(0, 4000) },
                ];
                await processConversationInsights(latestConversation, profileId);

                if (latestConversation.length >= 10) {
                  const memory = new CoachingMemory();
                  await memory.storeConversationSummary(profileId, latestConversation);
                }
              }
            } catch (insightError) {
              console.error(`[${requestId}] Failed to extract insights:`, insightError);
              // Don't fail the request if insight extraction fails
            }
          }

          // Log API usage
          if (!isDemo && !publicModeEnabled) {
            try {
              const profileId = await getActiveProfileId();
              await logApiUsage({
                profileId: profileId || undefined,
                model: lastModelSelection?.model || 'unknown',
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                toolCalls: toolsUsedInConversation.length,
                estimatedCost: totalCost,
                metadata: {
                  iterations: loopIteration,
                  toolsUsed: Array.from(new Set(toolsUsedInConversation)),
                  requestId
                }
              });
            } catch (logError) {
              console.error(`[${requestId}] Failed to log API usage:`, logError);
            }
          }

          // Send completion signal (without content to avoid duplication)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('=== CHAT ERROR (Stream) ===', error);
          console.error(`[${requestId}] Stream error:`, error);
          if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
          }
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
