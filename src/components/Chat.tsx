'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { QUICK_ACTIONS } from '@/lib/coach-prompt';
import { saveChatMessage } from '@/actions/chat';
import { Send, Loader2 } from 'lucide-react';
import { cn, parseLocalDate } from '@/lib/utils';
import { useDemoMode } from './DemoModeProvider';
import { useProfile } from '@/lib/profile-context';
import { getDemoSettings, getDemoWorkouts, getDemoShoes, addDemoWorkout, saveDemoSettings, updateDemoWorkoutAssessment, type DemoSettings, type DemoAssessment } from '@/lib/demo-mode';
import { getDemoRaces, getDemoPlannedWorkouts, addDemoRace, saveDemoPlannedWorkouts, generateDemoTrainingPlan, addDemoRaceResult, addDemoInjury, clearDemoInjury, type DemoRace, type DemoPlannedWorkout, type DemoInjury } from '@/lib/demo-actions';
import { calculateVDOT, calculatePaceZones } from '@/lib/training/vdot-calculator';
import { RACE_DISTANCES } from '@/lib/training/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Format tool names for display
function formatToolName(toolName: string): string {
  const toolLabels: Record<string, string> = {
    log_workout: 'Logging workout',
    add_race: 'Adding race',
    log_assessment: 'Recording assessment',
    get_recent_workouts: 'Fetching workouts',
    get_workout_detail: 'Loading workout details',
    get_todays_workout: 'Checking today\'s workout',
    get_todays_planned_workout: 'Loading today\'s plan',
    get_weekly_plan: 'Loading weekly plan',
    get_week_workouts: 'Loading week\'s workouts',
    update_planned_workout: 'Updating workout',
    modify_todays_workout: 'Modifying today\'s workout',
    swap_workouts: 'Swapping workouts',
    reschedule_workout: 'Rescheduling workout',
    skip_workout: 'Skipping workout',
    convert_to_easy: 'Converting to easy run',
    make_down_week: 'Creating down week',
    insert_rest_day: 'Adding rest day',
    adjust_workout_distance: 'Adjusting distance',
    get_pace_zones: 'Loading pace zones',
    get_current_weather: 'Checking weather',
    get_outfit_recommendation: 'Getting outfit suggestion',
    get_training_summary: 'Analyzing training',
    get_fitness_trend: 'Analyzing fitness',
    get_fatigue_indicators: 'Checking fatigue',
    get_readiness_score: 'Calculating readiness',
    predict_race_time: 'Predicting race time',
    get_shoes: 'Loading shoes',
    log_injury: 'Recording injury',
    get_races: 'Loading races',
    get_user_settings: 'Loading settings',
    search_workouts: 'Searching workouts',
  };
  return toolLabels[toolName] || toolName.replace(/_/g, ' ');
}

interface ChatProps {
  initialMessages?: Message[];
  compact?: boolean;
  onboardingMode?: boolean;
  pendingPrompt?: string | null;
  onPendingPromptSent?: () => void;
  coachName?: string;
  coachColor?: string;
}

export function Chat({
  initialMessages = [],
  compact = false,
  onboardingMode = false,
  pendingPrompt = null,
  onPendingPromptSent,
  coachName = 'Coach',
  coachColor = 'blue'
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [, forceUpdate] = useState(0);
  const [modelUsage, setModelUsage] = useState<{
    iterations: number;
    toolsUsed: string[];
    estimatedCost: number;
    modelsUsed: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { isDemo } = useDemoMode();
  const { activeProfile } = useProfile();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Force visibility of new messages
  useEffect(() => {
    if (messages.length > 0) {
      console.log('[Chat] Messages updated, count:', messages.length);
      console.log('[Chat] Last message:', messages[messages.length - 1]?.content?.slice(0, 50));
    }
  }, [messages]);

  // Track onboarding trigger using ref to avoid dependency issues
  const onboardingTriggered = useRef(false);
  const pendingPromptHandled = useRef(false);

  // Auto-trigger onboarding conversation - defined early but we use a ref to track
  useEffect(() => {
    if (onboardingMode && !onboardingTriggered.current && messages.length === 0 && !isLoading) {
      onboardingTriggered.current = true;
      // Automatically send the onboarding greeting
      const onboardingMessage = "Hi! I just finished setting up my profile. What else would you like to know about me to help with my training?";
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        handleSubmit(onboardingMessage);
      }, 100);
    }
  }, [onboardingMode, messages.length, isLoading]);

  // Handle pending prompt from quick actions
  useEffect(() => {
    if (pendingPrompt && !pendingPromptHandled.current && !isLoading) {
      pendingPromptHandled.current = true;
      handleSubmit(pendingPrompt);
      onPendingPromptSent?.();
    }
  }, [pendingPrompt, isLoading]);

  // Update loading message based on how long we've been waiting
  useEffect(() => {
    if (!isLoading || !loadingStartTime) {
      setLoadingMessage('');
      return;
    }

    const updateLoadingMessage = () => {
      const elapsed = Date.now() - loadingStartTime;
      if (elapsed > 30000) {
        setLoadingMessage('This is taking longer than usual. The coach is thinking hard...');
      } else if (elapsed > 15000) {
        setLoadingMessage('Still working on your request...');
      } else if (elapsed > 5000) {
        setLoadingMessage('Analyzing your training data...');
      }
    };

    updateLoadingMessage();
    const interval = setInterval(updateLoadingMessage, 5000);
    return () => clearInterval(interval);
  }, [isLoading, loadingStartTime]);

  // Reset the pending prompt handled ref when pendingPrompt changes
  useEffect(() => {
    if (!pendingPrompt) {
      pendingPromptHandled.current = false;
    }
  }, [pendingPrompt]);

  const handleSubmit = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLoadingStartTime(Date.now());
    setStreamingContent('');
    setExecutingTool(null);

    // Save user message to database
    await saveChatMessage('user', text, activeProfile?.id);

    try {
      // In demo mode, pass demo data to the API
      const demoData = isDemo ? {
        settings: getDemoSettings(),
        workouts: getDemoWorkouts(),
        shoes: getDemoShoes(),
        races: getDemoRaces(),
        plannedWorkouts: getDemoPlannedWorkouts(),
      } : undefined;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          newMessage: text,
          isDemo,
          demoData,
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      // Show immediate feedback
      setExecutingTool('Connecting to coach...');
      console.log('[Chat] Starting to read response stream...');

      // Track if we've received any data
      let receivedAnyData = false;

      // Safety timeout - if no 'done' event after 90 seconds, force completion
      const safetyTimeout = setTimeout(() => {
        console.error('[Chat] Safety timeout triggered - no done event received');
        if (fullContent && messages[messages.length - 1]?.content !== fullContent) {
          setMessages(prev => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: fullContent,
            },
          ]);
        }
        setIsLoading(false);
        setStreamingContent('');
        setExecutingTool(null);
      }, 90000);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        console.log('[Chat] Received chunk, length:', chunk.length);

        const lines = buffer.split('\n');

        // Process all complete lines (ending with \n)
        // Keep the last line in buffer only if it doesn't end with \n
        if (buffer.endsWith('\n')) {
          buffer = '';
        } else {
          buffer = lines.pop() || '';
        }

        for (const line of lines) {
          if (line.trim() === '') continue; // Skip empty lines

          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              console.log('[Chat] Parsing SSE data:', jsonStr.slice(0, 100));
              const data = JSON.parse(jsonStr);
              receivedAnyData = true;

              if (data.type === 'text') {
                fullContent += data.content;
                console.log('[Chat] Received text, total length:', fullContent.length);
                setStreamingContent(prev => {
                  console.log('[Chat] Updating streaming content from', prev?.length || 0, 'to', fullContent.length);
                  return fullContent;
                });
                // Clear executing tool when we start getting text
                if (executingTool) {
                  setExecutingTool(null);
                }
              } else if (data.type === 'tool_call') {
                // Show which tool is being executed
                setExecutingTool(formatToolName(data.tool));
                // Also show in streaming content if no content yet
                if (!fullContent) {
                  setStreamingContent(`Using ${formatToolName(data.tool)}...`);
                }
              } else if (data.type === 'tool_result') {
                // Tool finished executing - show thinking message
                if (!fullContent) {
                  setStreamingContent('Analyzing results...');
                  setExecutingTool('Thinking...');
                }
              } else if (data.type === 'demo_action' && isDemo) {
                // Handle demo mode actions - apply changes to localStorage
                applyDemoAction(data.action);
              } else if (data.type === 'metadata') {
                // Handle model usage metadata
                if (data.modelUsage) {
                  console.log('[Chat] Model usage:', data.modelUsage);
                  setModelUsage(data.modelUsage);
                }
              } else if (data.type === 'done') {
                console.log('[Chat] Received DONE event. FullContent:', fullContent?.slice(0, 100), 'Length:', fullContent?.length);
                console.log('[Chat] StreamingContent:', streamingContent?.slice(0, 100), 'Length:', streamingContent?.length);

                // CRITICAL: Always add the message, even if it seems empty
                const finalContent = fullContent || streamingContent || 'I completed the analysis but encountered an issue displaying the response. Please try refreshing.';

                // Save assistant message to database
                await saveChatMessage('assistant', finalContent, activeProfile?.id);

                // Force UI update with the final message
                const assistantMsg = {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant' as const,
                  content: finalContent,
                };

                // Add message immediately
                setMessages(prev => {
                  console.log('[Chat] DONE event - Adding final message. Previous count:', prev.length);
                  console.log('[Chat] Message content preview:', finalContent.slice(0, 100));
                  return [...prev, assistantMsg];
                });

                // Clear all states to force re-render
                setStreamingContent('');
                setExecutingTool(null);
                setIsLoading(false);

                // Force a re-render
                forceUpdate(n => n + 1);

                // Clear streaming states and timeout
                setStreamingContent('');
                setExecutingTool(null);
                clearTimeout(safetyTimeout);
              } else if (data.type === 'error') {
                setMessages(prev => [
                  ...prev,
                  {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: data.content || 'Sorry, something went wrong. Please try again.',
                  },
                ]);
                setStreamingContent('');
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }

      // CRITICAL: After stream ends, check if we have content but no 'done' event
      console.log('[Chat] Stream ended. Checking for unreported content...');
      if (fullContent) {
        console.log('[Chat] Found unreported content, adding to messages');
        const finalMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: fullContent,
        };

        await saveChatMessage('assistant', fullContent, activeProfile?.id);

        // Force React to update by using functional update with new array
        setMessages(prevMessages => {
          const newMessages = [...prevMessages, finalMsg];
          console.log('[Chat] Messages before:', prevMessages.length, 'after:', newMessages.length);
          return newMessages;
        });

        // Clear all loading states to force re-render
        setStreamingContent('');
        setIsLoading(false);
        setExecutingTool(null);

        // Force a re-render
        forceUpdate(n => n + 1);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: "Hmm, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingStartTime(null);
      setLoadingMessage('');
      setStreamingContent('');
      setExecutingTool(null);
      // Clear any pending timeouts
      if (typeof safetyTimeout !== 'undefined') {
        clearTimeout(safetyTimeout);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (message: string) => {
    handleSubmit(message);
  };

  // Dispatch event to notify pages that demo data changed
  const notifyDemoDataChanged = (actionType: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('demo-data-changed', {
        detail: { action: actionType, timestamp: Date.now() }
      }));
    }
  };

  // Apply demo actions to localStorage
  const applyDemoAction = (action: { demoAction: string; data: unknown; message?: string }) => {
    if (!isDemo) return;

    const { demoAction, data } = action;

    switch (demoAction) {
      case 'add_race': {
        const raceData = data as DemoRace;
        addDemoRace({
          name: raceData.name,
          date: raceData.date,
          distanceMeters: raceData.distanceMeters,
          distanceLabel: raceData.distanceLabel,
          priority: raceData.priority,
          targetTimeSeconds: raceData.targetTimeSeconds,
          trainingPlanGenerated: raceData.trainingPlanGenerated,
        });
        break;
      }

      case 'add_workout': {
        const workoutData = data as {
          date: string;
          distanceMiles: number;
          durationMinutes: number;
          avgPaceSeconds: number;
          workoutType: string;
          notes?: string;
        };
        addDemoWorkout(workoutData);
        break;
      }

      case 'reschedule_workout': {
        const { workoutId, newDate, reason } = data as { workoutId: number; newDate: string; reason: string };
        const workouts = getDemoPlannedWorkouts();
        const updated = workouts.map(w =>
          w.id === workoutId
            ? { ...w, date: newDate, rationale: `${w.rationale || ''} [Rescheduled: ${reason}]` }
            : w
        );
        saveDemoPlannedWorkouts(updated);
        break;
      }

      case 'skip_workout': {
        const { workoutId } = data as { workoutId: number; reason: string };
        const workouts = getDemoPlannedWorkouts();
        const updated = workouts.map(w =>
          w.id === workoutId
            ? { ...w, status: 'skipped' as const }
            : w
        );
        saveDemoPlannedWorkouts(updated);
        break;
      }

      case 'convert_to_easy': {
        const { workoutId, newDistance, newPace } = data as { workoutId: number; newDistance: number; newPace: number; reason: string };
        const workouts = getDemoPlannedWorkouts();
        const updated = workouts.map(w =>
          w.id === workoutId
            ? {
                ...w,
                workoutType: 'easy',
                name: 'Easy Run',
                targetDistanceMiles: newDistance,
                targetPaceSecondsPerMile: newPace,
                isKeyWorkout: false,
                description: 'Easy recovery run',
              }
            : w
        );
        saveDemoPlannedWorkouts(updated);
        break;
      }

      case 'adjust_distance': {
        const { workoutId, newDistance } = data as { workoutId: number; newDistance: number; reason: string };
        const workouts = getDemoPlannedWorkouts();
        const updated = workouts.map(w =>
          w.id === workoutId
            ? { ...w, targetDistanceMiles: newDistance }
            : w
        );
        saveDemoPlannedWorkouts(updated);
        break;
      }

      case 'swap_workouts': {
        const { workout1Id, workout2Id } = data as { workout1Id: number; workout2Id: number; reason: string };
        const workouts = getDemoPlannedWorkouts();
        const w1 = workouts.find(w => w.id === workout1Id);
        const w2 = workouts.find(w => w.id === workout2Id);
        if (w1 && w2) {
          const date1 = w1.date;
          const date2 = w2.date;
          const updated = workouts.map(w => {
            if (w.id === workout1Id) return { ...w, date: date2 };
            if (w.id === workout2Id) return { ...w, date: date1 };
            return w;
          });
          saveDemoPlannedWorkouts(updated);
        }
        break;
      }

      case 'make_down_week': {
        const { affectedWorkoutIds, reductionPercent } = data as {
          weekStartDate: string;
          reductionPercent: number;
          reason: string;
          affectedWorkoutIds: number[];
        };
        const workouts = getDemoPlannedWorkouts();
        const updated = workouts.map(w => {
          if (affectedWorkoutIds.includes(w.id)) {
            // Convert quality workouts to easy, reduce distance
            const newDistance = Math.round(w.targetDistanceMiles * (1 - reductionPercent / 100) * 10) / 10;
            if (['tempo', 'interval', 'threshold'].includes(w.workoutType)) {
              return {
                ...w,
                workoutType: 'easy',
                name: 'Easy Run',
                targetDistanceMiles: newDistance,
                isKeyWorkout: false,
                description: 'Down week easy run',
              };
            }
            return { ...w, targetDistanceMiles: newDistance };
          }
          return w;
        });
        saveDemoPlannedWorkouts(updated);
        break;
      }

      case 'insert_rest_day': {
        const { date, pushSubsequent, removedWorkoutId } = data as {
          date: string;
          pushSubsequent: boolean;
          reason: string;
          removedWorkoutId?: number;
        };
        let workouts = getDemoPlannedWorkouts();

        if (removedWorkoutId) {
          if (pushSubsequent) {
            // Push the removed workout and all subsequent workouts forward by 1 day
            workouts = workouts.map(w => {
              if (w.date >= date) {
                const newDate = parseLocalDate(w.date);
                newDate.setDate(newDate.getDate() + 1);
                return { ...w, date: newDate.toISOString().split('T')[0] };
              }
              return w;
            });
          } else {
            // Just skip the workout
            workouts = workouts.map(w =>
              w.id === removedWorkoutId ? { ...w, status: 'skipped' as const } : w
            );
          }
        }
        saveDemoPlannedWorkouts(workouts);
        break;
      }

      case 'update_race': {
        const { raceId, updates } = data as { raceId: number; updates: Partial<DemoRace> };
        const races = getDemoRaces();
        const updated = races.map(r =>
          r.id === raceId ? { ...r, ...updates } : r
        );
        localStorage.setItem('dreamy_demo_races', JSON.stringify(updated));
        break;
      }

      case 'update_planned_workout': {
        const { workoutId, updates } = data as { workoutId: number; updates: Partial<DemoPlannedWorkout> };
        const workouts = getDemoPlannedWorkouts();
        const updated = workouts.map(w =>
          w.id === workoutId ? { ...w, ...updates } : w
        );
        saveDemoPlannedWorkouts(updated);
        break;
      }

      case 'delete_race': {
        const { raceId } = data as { raceId: number };
        const races = getDemoRaces();
        const updated = races.filter(r => r.id !== raceId);
        localStorage.setItem('dreamy_demo_races', JSON.stringify(updated));
        break;
      }

      case 'update_user_profile': {
        const { updates } = data as { updates: Partial<DemoSettings> };
        const currentSettings = getDemoSettings() || {};
        saveDemoSettings({ ...currentSettings, ...updates });
        break;
      }

      case 'log_assessment': {
        // Assessments are stored with workouts in demo mode
        const assessmentData = data as {
          workoutId: number;
          verdict: 'great' | 'good' | 'fine' | 'rough' | 'awful';
          rpe: number;
          legsFeel?: number;
          breathingFeel?: 'easy' | 'controlled' | 'hard' | 'cooked';
          sleepQuality?: number;
          sleepHours?: number;
          stress?: number;
          soreness?: number;
          hydration?: number;
          note?: string;
        };

        // Save assessment to the workout
        const assessment: DemoAssessment = {
          verdict: assessmentData.verdict,
          rpe: assessmentData.rpe,
          legsFeel: assessmentData.legsFeel,
          breathingFeel: assessmentData.breathingFeel,
          sleepQuality: assessmentData.sleepQuality,
          sleepHours: assessmentData.sleepHours,
          stress: assessmentData.stress,
          soreness: assessmentData.soreness,
          hydration: assessmentData.hydration,
          note: assessmentData.note,
        };
        updateDemoWorkoutAssessment(assessmentData.workoutId, assessment);
        break;
      }

      case 'add_race_result': {
        // Race results update VDOT and pace zones
        const resultData = data as {
          date: string;
          distance: string;
          finishTimeSeconds: number;
          raceName?: string;
          effortLevel?: 'all_out' | 'hard' | 'moderate' | 'easy';
          conditions?: string;
          notes?: string;
        };

        // Calculate new VDOT from race result
        const distanceInfo = RACE_DISTANCES[resultData.distance];
        if (distanceInfo && resultData.finishTimeSeconds > 0) {
          const newVdot = calculateVDOT(distanceInfo.meters, resultData.finishTimeSeconds);
          const paceZones = calculatePaceZones(newVdot);

          // Update demo settings with new VDOT and pace zones
          const currentSettings = getDemoSettings() || {};
          saveDemoSettings({
            ...currentSettings,
            vdot: newVdot,
            easyPaceSeconds: paceZones.easy,
            tempoPaceSeconds: paceZones.tempo,
            thresholdPaceSeconds: paceZones.threshold,
            intervalPaceSeconds: paceZones.interval,
            marathonPaceSeconds: paceZones.marathon,
            halfMarathonPaceSeconds: paceZones.halfMarathon,
          });

          // Save the race result
          addDemoRaceResult({
            date: resultData.date,
            distanceLabel: resultData.distance,
            distanceMeters: distanceInfo.meters,
            finishTimeSeconds: resultData.finishTimeSeconds,
            raceName: resultData.raceName,
            effortLevel: resultData.effortLevel,
            conditions: resultData.conditions,
            notes: resultData.notes,
            vdotAtTime: newVdot,
          });
        }
        break;
      }

      case 'generate_training_plan': {
        const { raceId } = data as { raceId: number };
        generateDemoTrainingPlan(raceId);
        break;
      }

      case 'log_injury': {
        const injuryData = data as {
          bodyPart: string;
          severity: 'minor' | 'moderate' | 'severe';
          side?: 'left' | 'right' | 'both';
          restrictions: string[];
          description?: string;
        };
        addDemoInjury({
          bodyPart: injuryData.bodyPart,
          severity: injuryData.severity,
          side: injuryData.side,
          restrictions: injuryData.restrictions,
        });
        break;
      }

      case 'clear_injury': {
        const { injuryId } = data as { injuryId: number };
        clearDemoInjury(injuryId);
        break;
      }

      default:
        // Unknown action - no-op
    }

    // Notify pages that demo data has changed so they can refresh
    notifyDemoDataChanged(demoAction);
  };

  return (
    <div className={cn('flex flex-col bg-stone-50', compact ? 'h-full' : 'h-[calc(100vh-200px)]')}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                !coachColor.startsWith('#') && coachColor === 'blue' && 'bg-gradient-to-br from-teal-400 to-teal-600',
                !coachColor.startsWith('#') && coachColor === 'green' && 'bg-gradient-to-br from-green-400 to-green-600',
                !coachColor.startsWith('#') && coachColor === 'purple' && 'bg-gradient-to-br from-purple-400 to-purple-600',
                !coachColor.startsWith('#') && coachColor === 'orange' && 'bg-gradient-to-br from-rose-400 to-rose-500',
                !coachColor.startsWith('#') && coachColor === 'red' && 'bg-gradient-to-br from-red-400 to-red-600',
                !coachColor.startsWith('#') && coachColor === 'teal' && 'bg-gradient-to-br from-teal-400 to-teal-600',
              )}
              style={coachColor.startsWith('#') ? { backgroundColor: coachColor } : undefined}
            >
              <span className="text-2xl">🏃</span>
            </div>
            <h3 className="font-display text-lg font-semibold text-stone-900 mb-2">Hey! I&apos;m {coachName}.</h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto">
              I&apos;m your running coach. Ask me anything—log runs, adjust your plan, check the weather, or just chat about training.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessage key={`${message.id}-${index}`} role={message.role} content={message.content} coachColor={coachColor} />
        ))}

        {(isLoading || streamingContent) && (
          <div className="space-y-2">
            {streamingContent ? (
              <ChatMessage role="assistant" content={streamingContent} coachColor={coachColor} />
            ) : (
              <ChatMessage
                role="assistant"
                content={executingTool || 'Thinking...'}
                isLoading
                coachColor={coachColor}
              />
            )}
            {loadingMessage && (
              <div className="text-sm text-gray-500 pl-12 animate-pulse">
                {loadingMessage}
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(action.message)}
                disabled={isLoading}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm rounded-full transition-colors disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model Usage Info */}
      {modelUsage && (
        <div className="px-4 py-2 bg-stone-100 text-xs text-stone-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Model routing active</span>
            {modelUsage.toolsUsed.length > 0 && (
              <span className="opacity-75">
                Tools: {modelUsage.toolsUsed.join(', ')}
              </span>
            )}
            <span className="opacity-75">
              Est. cost: ${modelUsage.estimatedCost.toFixed(4)}
            </span>
          </div>
          <span className="text-teal-600">
            💡 Tip: Add /model:haiku for simple queries to save costs
          </span>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-stone-200 p-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-stone-100 rounded-full px-4 py-2 flex items-center">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your coach..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm focus:outline-none max-h-32 leading-6"
              style={{ minHeight: '24px' }}
            />
          </div>
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
              input.trim() && !isLoading
                ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                : 'bg-stone-200 text-stone-400'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
