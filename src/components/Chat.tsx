'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { QUICK_ACTIONS } from '@/lib/coach-prompt';
import { saveChatMessage, clearChatHistory } from '@/actions/chat';
import { Send, Loader2 } from 'lucide-react';
import { cn, parseLocalDate } from '@/lib/utils';
import { useDemoMode } from './DemoModeProvider';
import { useProfile } from '@/lib/profile-context';
import { getDemoSettings, getDemoWorkouts, getDemoShoes, addDemoWorkout, saveDemoSettings, updateDemoWorkoutAssessment, type DemoSettings, type DemoAssessment } from '@/lib/demo-mode';
import { getDemoRaces, getDemoPlannedWorkouts, addDemoRace, saveDemoPlannedWorkouts, generateDemoTrainingPlan, addDemoRaceResult, addDemoInjury, clearDemoInjury, type DemoRace, type DemoPlannedWorkout } from '@/lib/demo-actions';
import { calculateVDOT, calculatePaceZones } from '@/lib/training/vdot-calculator';
import { RACE_DISTANCES } from '@/lib/training/types';
import { debugLog } from '@/lib/debug-logger';
import { SnakeGame } from './SnakeGame';
import { WordleGame } from './WordleGame';
import { getSettings } from '@/actions/settings';

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
  pendingPromptType?: 'user' | 'assistant';
  onPendingPromptSent?: () => void;
  coachName?: string;
  coachColor?: string;
}

export function Chat({
  initialMessages = [],
  compact = false,
  onboardingMode = false,
  pendingPrompt = null,
  pendingPromptType = 'user',
  onPendingPromptSent,
  coachName = 'Chase',
  coachColor = 'blue'
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [showSnakeGame, setShowSnakeGame] = useState(false);
  const [showWordleGame, setShowWordleGame] = useState(false);
  const [userGender, setUserGender] = useState<'male' | 'female' | 'other'>('other');
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [modelUsage, setModelUsage] = useState<{
    iterations: number;
    toolsUsed: string[];
    estimatedCost: number;
    modelsUsed: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef<HTMLDivElement>(null);
  const { isDemo } = useDemoMode();
  const { activeProfile } = useProfile();

  // Fetch user gender for snake game
  useEffect(() => {
    if (!isDemo) {
      getSettings().then(s => {
        if (s?.gender === 'male' || s?.gender === 'female') setUserGender(s.gender);
      });
    }
  }, [isDemo]);

  // Add forceUpdate function that was missing
  const [, forceUpdate] = useState(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Force visibility of new messages and debug state
  useEffect(() => {
    console.log('[Chat] Messages state changed:', {
      count: messages.length,
      isLoading,
      hasStreamingContent: !!streamingContent,
      streamingContentLength: streamingContent?.length,
    });
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      console.log('[Chat] Last message:', {
        role: lastMsg.role,
        contentPreview: lastMsg.content?.slice(0, 100) + (lastMsg.content?.length > 100 ? '...' : ''),
        contentLength: lastMsg.content?.length
      });
    }
  }, [messages, isLoading, streamingContent]);

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

  // Handle pending prompt from quick actions or post-run sync
  useEffect(() => {
    if (pendingPrompt && !pendingPromptHandled.current && !isLoading) {
      pendingPromptHandled.current = true;

      if (pendingPromptType === 'assistant') {
        // Add as assistant message for post-run questions
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: pendingPrompt,
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Save to database
        saveChatMessage('assistant', pendingPrompt, activeProfile?.id);
      } else {
        // Normal user prompt
        handleSubmit(pendingPrompt);
      }

      onPendingPromptSent?.();
    }
  }, [pendingPrompt, pendingPromptType, isLoading, activeProfile]);

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

    // Easter eggs
    const lowerText = text.toLowerCase().trim();
    const snakeTriggers = new Set(['snake', 'sss', 'ssss', 'sssss', 'ssssss', 'sssssss', 'ssssssss', 'sssssssss', 'ssssssssss', 'sssssssssss', 'ssssssssssss', 'sssssssssssss', 'ssssssssssssss', 'sssssssssssssss', 'ssssssssssssssss', 'sssssssssssssssss', 'ssssssssssssssssss', 'sssssssssssssssssss', 'ssssssssssssssssssss']);
    if (snakeTriggers.has(lowerText)) {
      setInput('');
      setShowSnakeGame(true);
      return;
    }
    if (lowerText === 'wordle') {
      setInput('');
      setShowWordleGame(true);
      return;
    }

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

      // Use a mutable ref to track fullContent to avoid closure issues
      const fullContentRef: { current: string } = { current: '' };

      // Show immediate feedback
      setExecutingTool('Connecting to coach...');
      console.log('[Chat] Starting to read response stream...');

      // Track if we've received any data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _receivedAnyData = false;

      // Safety timeout - if no 'done' event after 90 seconds, force completion
      const safetyTimeout = setTimeout(() => {
        console.error('[Chat] Safety timeout triggered - no done event received');
        const currentContent = fullContentRef.current;
        console.log('[Chat] Safety timeout - fullContent length:', currentContent?.length);

        // Check if we have content that hasn't been added yet
        if (currentContent && currentContent.trim().length > 0) {
          const finalMsg = {
            id: `assistant-${Date.now()}`,
            role: 'assistant' as const,
            content: currentContent,
          };

          // Save to database
          saveChatMessage('assistant', currentContent, activeProfile?.id).catch(err => {
            console.error('[Chat] Failed to save message in safety timeout:', err);
          });

          // Force add the message
          setMessages(prevMessages => {
            // Check if this content is already in messages
            const alreadyExists = prevMessages.some(msg =>
              msg.role === 'assistant' && msg.content === currentContent
            );

            if (!alreadyExists) {
              console.log('[Chat] Safety timeout adding message');
              return [...prevMessages, finalMsg];
            }
            return prevMessages;
          });
        }

        // Clear all loading states
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
              const jsonStr = line.slice(6).trim(); // Trim whitespace
              if (!jsonStr || jsonStr === '[DONE]') {
                console.log('[Chat] Skipping empty or [DONE] data');
                continue;
              }

              console.log('[Chat] Parsing SSE data:', jsonStr.slice(0, 100));
              const data = JSON.parse(jsonStr);
              receivedAnyData = true;

              if (data.type === 'text') {
                fullContent += data.content;
                fullContentRef.current = fullContent;
                debugLog.stream('text', {
                  chunk: data.content.slice(0, 50),
                  totalLength: fullContent.length
                });

                // Update state - force re-render
                setStreamingContent(prevContent => {
                  debugLog.stream('setState', {
                    prevLength: prevContent.length,
                    newLength: fullContent.length
                  });
                  return fullContent;
                });

                // Also update DOM directly for immediate display
                if (streamingContentRef.current) {
                  streamingContentRef.current.textContent = fullContent;
                }

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
                // Get the final content from ref or variable
                const finalContent = fullContentRef.current || fullContent;
                console.log('[Chat] Received DONE event. Content length:', finalContent?.length);

                // Clear the safety timeout immediately
                clearTimeout(safetyTimeout);

                // Always process if we have content
                if (finalContent && finalContent.trim().length > 0) {
                  console.log('[Chat] Processing done event with content');

                  // Create the final message
                  const assistantMsg = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant' as const,
                    content: finalContent,
                  };

                  // Save to database (don't await to avoid blocking)
                  saveChatMessage('assistant', finalContent, activeProfile?.id).catch(err => {
                    console.error('[Chat] Failed to save message:', err);
                  });

                  // Add message to state immediately
                  setMessages(prevMessages => {
                    console.log('[Chat] Adding final message. Previous count:', prevMessages.length);
                    return [...prevMessages, assistantMsg];
                  });
                }

                // Clear all loading states
                console.log('[Chat] Clearing loading states');
                setStreamingContent('');
                setExecutingTool(null);
                setIsLoading(false);

                // Clear DOM ref too
                if (streamingContentRef.current) {
                  streamingContentRef.current.textContent = '';
                }
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
      const finalContent = fullContentRef.current || fullContent;
      console.log('[Chat] FullContent length:', finalContent?.length, 'isLoading:', isLoading);

      // Clear the safety timeout since stream ended
      clearTimeout(safetyTimeout);

      // If we still have content and are still in loading state, add the message
      if (finalContent && finalContent.trim().length > 0 && isLoading) {
        console.log('[Chat] Stream ended with unreported content, forcing completion');

        const finalMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: finalContent,
        };

        // Save to database
        try {
          await saveChatMessage('assistant', finalContent, activeProfile?.id);
        } catch (err) {
          console.error('[Chat] Failed to save message after stream end:', err);
        }

        // Add the message
        setMessages(prevMessages => {
          // Double-check content isn't already there
          const lastMessage = prevMessages[prevMessages.length - 1];
          if (lastMessage?.role === 'assistant' && lastMessage.content === finalContent) {
            console.log('[Chat] Content already in messages, skipping');
            return prevMessages;
          }

          console.log('[Chat] Adding unreported message. Previous count:', prevMessages.length);
          return [...prevMessages, finalMsg];
        });
      }

      // Always clear loading states when stream ends
      setIsLoading(false);
      setStreamingContent('');
      setExecutingTool(null);

      // Force a re-render to ensure UI updates
      forceUpdate(prev => prev + 1);
    } catch (error) {
      console.error('[Chat] Error in handleSubmit:', error);

      // Get the final content from ref
      const accumulatedContent = fullContentRef?.current || fullContent || '';

      // If we accumulated any content before the error, show it
      if (accumulatedContent && accumulatedContent.trim().length > 0) {
        console.log('[Chat] Showing accumulated content despite error');
        const errorMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: accumulatedContent + '\n\n[Error: Response interrupted]',
        };
        setMessages(prev => [...prev, errorMsg]);
      } else {
        // No content accumulated, show generic error
        setMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: "Hmm, I couldn't process that. Please try again.",
          },
        ]);
      }
    } finally {
      console.log('[Chat] Finally block - cleaning up states');
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

  const clearChat = async () => {
    // Clear messages from database
    try {
      await clearChatHistory(activeProfile?.id);

      // Clear local state
      setMessages([]);
      setStreamingContent('');
      setExecutingTool(null);
      setIsLoading(false);
      setModelUsage(null);
      if (streamingContentRef.current) {
        streamingContentRef.current.textContent = '';
      }
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };

  return (
    <>
    {showSnakeGame && <SnakeGame onClose={() => setShowSnakeGame(false)} gender={userGender} />}
    {showWordleGame && <WordleGame onClose={() => setShowWordleGame(false)} />}
    <div className={cn('flex flex-col bg-bgTertiary', compact ? 'h-full' : 'h-[calc(100vh-200px)]')}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8 px-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-dream-500 to-dream-700 flex items-center justify-center mx-auto mb-3">
              <span className="text-sm font-bold text-white">GO</span>
            </div>
            <h3 className="font-display text-lg font-semibold text-primary mb-1">Chat with Chase</h3>
            <p className="text-textTertiary text-sm">Your AI running coach — ask anything.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessage key={`${message.id}-${index}`} role={message.role} content={message.content} coachColor={coachColor} auraColorStart={activeProfile?.auraColorStart} auraColorEnd={activeProfile?.auraColorEnd} />
        ))}

        {(isLoading || streamingContent) && (
          <div className="space-y-2">
            {streamingContent ? (
              <div className="flex gap-3 p-3">
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    !coachColor.startsWith('#') && coachColor === 'blue' && 'bg-dream-500',
                    !coachColor.startsWith('#') && coachColor === 'green' && 'bg-green-500',
                    !coachColor.startsWith('#') && coachColor === 'purple' && 'bg-purple-500',
                    !coachColor.startsWith('#') && coachColor === 'orange' && 'bg-rose-500',
                    !coachColor.startsWith('#') && coachColor === 'red' && 'bg-red-500',
                    !coachColor.startsWith('#') && coachColor === 'teal' && 'bg-dream-500',
                  )}
                  style={coachColor.startsWith('#') ? { backgroundColor: coachColor } : undefined}
                >
                  <span className={cn('text-xs font-bold', coachColor.startsWith('#') || coachColor === 'green' ? 'text-black' : 'text-white')}>GO</span>
                </div>
                <div className="flex-1 text-primary whitespace-pre-wrap" ref={streamingContentRef}>
                  {streamingContent}
                </div>
              </div>
            ) : (
              <>
                <ChatMessage
                  role="assistant"
                  content={executingTool || ''}
                  isLoading
                  coachColor={coachColor}
                />
                {/* Enhanced loading indicator */}
                <div className="flex items-center gap-3 pl-12">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-dream-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-dream-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-dream-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-textSecondary font-medium">
                    {executingTool ? formatToolName(executingTool) : 'Chase is thinking...'}
                  </span>
                </div>
              </>
            )}
            {loadingMessage && (
              <div className="text-sm text-tertiary pl-12 animate-pulse">
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
                className="px-3 py-1.5 bg-bgTertiary border border-borderPrimary hover:border-accentTeal hover:text-accentTeal text-textSecondary text-sm rounded-full transition-colors disabled:opacity-50 hover-glow"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model Usage Info & Tips */}
      {(modelUsage || messages.length > 2) && (
        <div className="px-4 py-3 bg-gradient-to-r from-bgTertiary to-bgSecondary border-t border-borderPrimary">
          <div className="flex items-center justify-between">
            {modelUsage ? (
              <div className="flex items-center gap-3 text-xs text-textSecondary">
                <span className="font-medium">Model routing active</span>
                {modelUsage.toolsUsed.length > 0 && (
                  <span className="opacity-75">
                    Tools: {modelUsage.toolsUsed.join(', ')}
                  </span>
                )}
                <span className="opacity-75">
                  Est. cost: ${modelUsage.estimatedCost.toFixed(4)}
                </span>
              </div>
            ) : (
              <div className="text-xs text-textSecondary">
                <span className="font-medium">AI Coach powered by Claude</span>
              </div>
            )}
            <div className="badge-dream text-xs animate-pulse">
              Tip: Add /model:haiku for simple queries to save costs
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-bgSecondary border-t border-borderPrimary p-4">
        {messages.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={clearChat}
              className="text-xs text-textTertiary hover:text-textSecondary transition-colors"
            >
              Clear chat
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-bgTertiary border border-borderPrimary rounded-2xl px-4 py-2 flex items-end focus-within:border-accentTeal focus-within:ring-1 focus-within:ring-accentTeal transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                // Auto-resize like iMessage
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message your coach..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm focus:outline-none max-h-32 leading-6"
              style={{ height: '24px' }}
            />
          </div>
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
              input.trim() && !isLoading
                ? 'bg-dream-500 text-white hover:bg-dream-600 shadow-sm'
                : 'bg-bgTertiary text-tertiary'
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
    </>
  );
}
