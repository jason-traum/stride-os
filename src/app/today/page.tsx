import type { Metadata } from 'next';

// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Today's Dashboard | Dreamy",
  description: 'Your daily running dashboard with workout plans, readiness, and weather.',
};

import Link from 'next/link';
import { getWorkouts } from '@/actions/workouts';
import { getSettings } from '@/actions/settings';
import { getTodaysWorkout, getTrainingSummary, getCurrentWeekPlan } from '@/actions/training-plan';
import { getRunningStreak } from '@/actions/analytics';
import { getActiveAlerts } from '@/actions/alerts';
import { getTodayReadinessWithFactors } from '@/actions/readiness';
import { fetchSmartWeather } from '@/lib/weather';
import { getContextualPrompts, getTimeOfDay, isWeekend, getWeatherCondition, type PromptContext } from '@/lib/chat-prompts';
import {
  formatDistance,
  formatPace,
  formatDuration,
  getVerdictColor,
  getWorkoutTypeLabel,
  getWorkoutTypeColor,
  getTodayString,
} from '@/lib/utils';
import { ChevronRight, Check, Calendar, Target, Zap, Battery, Star, Cloud, Sun, CloudRain, Minus, Flag, Clock } from 'lucide-react';
import { QuickCoachInput } from '@/components/QuickCoachInput';
import { StreakBadge } from '@/components/StreakBadge';
import { AlertsDisplay } from '@/components/AlertsDisplay';
import { DemoWrapper } from '@/components/DemoWrapper';
import { DemoToday } from '@/components/DemoToday';
import { DynamicGreeting } from '@/components/DynamicGreeting';
import { QuickLogButton } from '@/components/QuickLogButton';
import { RunningStreaks } from '@/components/RunningStreaks';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { DreamySheep } from '@/components/DreamySheep';
import { RunWeatherCard } from '@/components/RunWeatherCard';
import { SheepSpeechBubble } from '@/components/SheepSpeechBubble';
import type { SheepMood } from '@/components/DreamySheep';
import { getActiveProfileId } from '@/lib/profile-server';
import { getProactivePrompts } from '@/lib/proactive-coach';
import { ProactiveCoachPrompts } from '@/components/ProactiveCoachPrompts';
import { getUnreflectedWorkouts } from '@/actions/reflections';
import { getSmartTrainingCue, type TrainingCue } from '@/actions/training-cues';
import { getWeeklyInsights } from '@/actions/weekly-insights';
import { getWeeklyRecap } from '@/actions/weekly-recap';
import { PostRunReflectionCard } from '@/components/PostRunReflectionCard';
import { SmartTrainingCue } from '@/components/SmartTrainingCue';
import { WeeklyInsights } from '@/components/WeeklyInsights';
import { WeeklyRecapCard } from '@/components/WeeklyRecapCard';
import { getRecentPRs } from '@/actions/pr-celebrations';
import { PRCelebration } from '@/components/PRCelebration';
import { getAudibleOptions, type AudibleOption, type AudibleWorkoutInput, type AudibleContext } from '@/actions/workout-audibles';
import { WorkoutAudibles } from '@/components/WorkoutAudibles';
import { getRecoveryAnalysis } from '@/actions/recovery';
import type { RecoveryAnalysis } from '@/lib/training/recovery-model';
import { RecoveryCard } from '@/components/RecoveryCard';
import { SmartProfilePrompt } from '@/components/SmartProfilePrompt';
import { getPendingActions } from '@/actions/coach-actions';
import { PendingCoachSuggestions } from '@/components/PlanDiffCard';
import type { Workout, Assessment, Shoe } from '@/lib/schema';

type WorkoutWithRelations = Workout & {
  assessment?: Assessment | null;
  shoe?: Shoe | null;
};

function getRelativeTime(dateStr: string): string {
  const today = getTodayString();
  if (dateStr === today) return 'Today';
  const workoutDate = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const diffMs = now.getTime() - workoutDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'Last week';
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
}

function getWeatherIcon(condition: string) {
  if (condition === 'rain' || condition === 'snow') return CloudRain;
  if (condition === 'cloudy' || condition === 'overcast') return Cloud;
  return Sun;
}

function getTypeDotColor(type: string): string {
  // Performance Spectrum v3: steel → sky → teal → blue → indigo → violet → red → crimson
  const colors: Record<string, string> = {
    recovery: 'bg-slate-400',
    easy: 'bg-sky-400',
    long: 'bg-teal-500',
    steady: 'bg-sky-500',
    marathon: 'bg-blue-500',
    tempo: 'bg-indigo-500',
    threshold: 'bg-violet-500',
    interval: 'bg-red-500',
    repetition: 'bg-rose-600',
    race: 'bg-amber-500',
    rest: 'bg-transparent',
    cross_train: 'bg-violet-400',
    other: 'bg-stone-400',
  };
  return colors[type] || 'bg-stone-400';
}

async function ServerToday() {
  const profileId = await getActiveProfileId();

  // Fetch readiness once, then share the result with getSmartTrainingCue
  // to avoid a duplicate readiness computation (saves ~1 full DB round-trip)
  const readinessPromise = getTodayReadinessWithFactors();

  // Use Promise.allSettled so one failing call doesn't crash the entire page
  const results = await Promise.allSettled([
    getWorkouts(10, profileId),
    getSettings(profileId),
    getTodaysWorkout(),
    getTrainingSummary(),
    getRunningStreak(),
    getActiveAlerts(),
    readinessPromise,
    getCurrentWeekPlan(),
    getProactivePrompts(),
    getUnreflectedWorkouts(1),
    // Pass the shared readiness promise result to avoid re-fetching inside getSmartTrainingCue
    readinessPromise.then(r => r.success ? getSmartTrainingCue(r.data).then(cr => cr.success ? cr.data : null) : null).catch(() => null),
    getWeeklyInsights(),
    getWeeklyRecap(),
    getRecentPRs(),
    getRecoveryAnalysis(),
    getPendingActions(),
  ]);

  const safeGet = <T,>(result: PromiseSettledResult<T>, fallback: T): T => {
    if (result.status === 'fulfilled') return result.value;
    console.error('[Today] Data fetch failed:', result.reason);
    return fallback;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultWeekPlan = {
    weekStart: todayStr,
    weekEnd: todayStr,
    workouts: [] as Awaited<ReturnType<typeof getCurrentWeekPlan>>['workouts'],
    todaysWorkout: undefined,
    currentBlock: undefined,
    totalMiles: 0,
    completedMiles: 0,
  };
  const defaultReadiness = {
    result: { score: null as number | null, confidence: 0, category: 'unknown' as const, color: 'text-textTertiary', label: 'Unknown', limitingFactor: null, recommendation: 'Log a workout to see your readiness.', breakdown: { sleep: 0, training: 0, physical: 0, life: 0 } },
    factors: { tsb: undefined as number | undefined },
  };

  const recentWorkouts = safeGet(results[0], [] as Awaited<ReturnType<typeof getWorkouts>>);
  const settings = safeGet(results[1], null as Awaited<ReturnType<typeof getSettings>>);
  const plannedWorkout = safeGet(results[2], null as Awaited<ReturnType<typeof getTodaysWorkout>>);
  const trainingSummary = safeGet(results[3], null as Awaited<ReturnType<typeof getTrainingSummary>>);
  const streak = safeGet(results[4], { currentStreak: 0, longestStreak: 0 });
  const alerts = safeGet(results[5], [] as Awaited<ReturnType<typeof getActiveAlerts>>);
  const readinessActionResult = safeGet(results[6], { success: false, error: 'not loaded' } as Awaited<ReturnType<typeof getTodayReadinessWithFactors>>);
  const readinessData = readinessActionResult.success ? readinessActionResult.data : defaultReadiness;
  const weekPlan = safeGet(results[7], defaultWeekPlan as Awaited<ReturnType<typeof getCurrentWeekPlan>>);
  const proactivePrompts = safeGet(results[8], [] as Awaited<ReturnType<typeof getProactivePrompts>>);
  const unreflectedResult = safeGet(results[9], { success: false, error: 'not loaded' } as Awaited<ReturnType<typeof getUnreflectedWorkouts>>);
  const unreflectedWorkouts = unreflectedResult.success ? unreflectedResult.data : [];
  const trainingCue = safeGet(results[10], null as TrainingCue | null);
  const weeklyInsightsResult = safeGet(results[11], { success: false, error: 'not loaded' } as Awaited<ReturnType<typeof getWeeklyInsights>>);
  const weeklyRecapResult = safeGet(results[12], { success: false, error: 'not loaded' } as Awaited<ReturnType<typeof getWeeklyRecap>>);
  const recentPRsResult = safeGet(results[13], { success: false, data: { celebrations: [] } } as Awaited<ReturnType<typeof getRecentPRs>>);
  const recoveryResult = safeGet(results[14], { success: false, error: 'not loaded' } as Awaited<ReturnType<typeof getRecoveryAnalysis>>);
  const pendingActionsResult = safeGet(results[15], { success: false, error: 'not loaded' } as Awaited<ReturnType<typeof getPendingActions>>);

  const weeklyInsights = weeklyInsightsResult.success ? weeklyInsightsResult.data : [];
  const weeklyRecap = weeklyRecapResult.success ? weeklyRecapResult.data : null;
  const recentPRs = recentPRsResult.success ? recentPRsResult.data.celebrations : [];
  const recoveryAnalysis: RecoveryAnalysis | null = recoveryResult.success ? recoveryResult.data : null;
  const pendingCoachActions = pendingActionsResult.success ? pendingActionsResult.data : [];

  // Fetch smart weather if location is set (includes forecast data internally)
  const smartWeather = settings?.latitude && settings?.longitude
    ? await fetchSmartWeather(settings.latitude, settings.longitude)
    : null;
  const weather = smartWeather?.runWindow.weather || null;
  const forecast = smartWeather?.forecast ?? null;

  const today = new Date();
  const todayString = getTodayString();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const todaysWorkouts = (recentWorkouts as WorkoutWithRelations[]).filter((w) => w.date === todayString);
  const hasRunToday = todaysWorkouts.length > 0;

  // Last run = most recent workout
  const lastRun = (recentWorkouts as WorkoutWithRelations[])[0] || null;

  // Next workout logic: today's planned if not done, otherwise next scheduled from week plan
  let nextWorkoutData: {
    name: string;
    workoutType: string;
    targetDistanceMiles: number | null;
    targetPaceSecondsPerMile: number | null;
    rationale: string | null;
    isKeyWorkout: boolean | null;
    phase: string | null;
  } | null = null;
  let nextWorkoutLabel = "Today\u2019s Workout";

  if (plannedWorkout && !hasRunToday && plannedWorkout.workoutType !== 'rest') {
    nextWorkoutData = {
      name: plannedWorkout.name,
      workoutType: plannedWorkout.workoutType,
      targetDistanceMiles: plannedWorkout.targetDistanceMiles,
      targetPaceSecondsPerMile: plannedWorkout.targetPaceSecondsPerMile,
      rationale: plannedWorkout.rationale,
      isKeyWorkout: plannedWorkout.isKeyWorkout,
      phase: plannedWorkout.phase ?? trainingSummary?.currentPhase ?? null,
    };
  } else {
    const futureWorkout = weekPlan.workouts.find(
      (w) => w.date > todayString && w.status === 'scheduled' && w.workoutType !== 'rest'
    );
    if (futureWorkout) {
      const nextDate = new Date(futureWorkout.date + 'T12:00:00');
      const dayName = nextDate.toLocaleDateString('en-US', { weekday: 'long' });
      nextWorkoutLabel = `${dayName}\u2019s Workout`;
      nextWorkoutData = {
        name: futureWorkout.name,
        workoutType: futureWorkout.workoutType,
        targetDistanceMiles: futureWorkout.targetDistanceMiles,
        targetPaceSecondsPerMile: futureWorkout.targetPaceSecondsPerMile,
        rationale: futureWorkout.rationale,
        isKeyWorkout: futureWorkout.isKeyWorkout,
        phase: trainingSummary?.currentPhase ?? null,
      };
    }
  }

  // Smart Workout Audibles
  let audibleOptions: AudibleOption[] = [];
  const isTodaysPlannedWorkout = plannedWorkout && !hasRunToday && plannedWorkout.workoutType !== 'rest';
  if (isTodaysPlannedWorkout) {
    const audibleInput: AudibleWorkoutInput = {
      id: plannedWorkout.id,
      name: plannedWorkout.name,
      workoutType: plannedWorkout.workoutType,
      targetDistanceMiles: plannedWorkout.targetDistanceMiles,
      targetDurationMinutes: plannedWorkout.targetDurationMinutes,
      targetPaceSecondsPerMile: plannedWorkout.targetPaceSecondsPerMile,
      description: plannedWorkout.description,
      rationale: plannedWorkout.rationale,
      isKeyWorkout: plannedWorkout.isKeyWorkout,
    };
    const audibleContext: AudibleContext = {
      readinessScore: readinessData.result.score ?? 70, // Default to moderate for audible logic when unknown
      tsb: readinessData.factors.tsb,
      weatherCondition: weather?.condition ?? null,
      weatherTemp: weather?.temperature ?? null,
      weatherWindSpeed: weather?.windSpeed ?? null,
      weatherHumidity: weather?.humidity ?? null,
    };
    audibleOptions = getAudibleOptions(audibleInput, audibleContext);
  }

  // Contextual chat prompts
  const promptContext: PromptContext = {
    hasRunToday,
    timeOfDay: getTimeOfDay(),
    isWeekend: isWeekend(),
    weatherCondition: weather ? getWeatherCondition(weather.temperature, weather.condition === 'rain') : null,
    plannedWorkoutType: plannedWorkout?.workoutType || null,
    isRestDay: !plannedWorkout || plannedWorkout.workoutType === 'rest',
  };
  const contextualSuggestions = getContextualPrompts(promptContext).map(p => ({
    label: p.label,
    prompt: p.prompt,
  }));

  // Week ahead: generate Mon-Sun with workout info
  const weekDays: Array<{
    date: string;
    dayLabel: string;
    workout: (typeof weekPlan.workouts)[0] | null;
    isToday: boolean;
  }> = [];

  // Determine sheep mood based on context
  let sheepMood: SheepMood = 'idle';
  let sheepMessage: string | undefined;
  const isRestDay = !plannedWorkout || plannedWorkout.workoutType === 'rest';
  const readinessScore = readinessData.result.score;
  const hour = new Date().getHours();
  const weatherCondition = weather?.condition;

  if (hasRunToday) {
    if (streak.currentStreak >= 7) {
      sheepMood = 'champion';
      sheepMessage = `${streak.currentStreak}-day streak! You're on fire.`;
    } else {
      sheepMood = 'champion';
      sheepMessage = "Got it done today. Nice work.";
    }
  } else if (isRestDay) {
    if (hour >= 22 || hour < 6) {
      sheepMood = 'sleeping';
      sheepMessage = "Rest day. Get some sleep.";
    } else {
      sheepMood = 'sleeping';
      sheepMessage = "Rest day. Your legs will thank you tomorrow.";
    }
  } else if (readinessScore !== null && readinessScore <= 40) {
    sheepMood = 'sad';
    sheepMessage = "Readiness is low. Listen to your body today.";
  } else if (weatherCondition === 'rain' || weatherCondition === 'snow') {
    sheepMood = 'confused';
    sheepMessage = weatherCondition === 'rain'
      ? "Wet out there. Embrace it or hit the treadmill."
      : "Snow day. Tread carefully out there.";
  } else if (nextWorkoutData?.workoutType === 'interval' || nextWorkoutData?.workoutType === 'tempo' || nextWorkoutData?.workoutType === 'threshold') {
    sheepMood = 'stopwatch';
    sheepMessage = "Hard one today. Trust the process.";
  } else if (nextWorkoutData?.workoutType === 'long') {
    sheepMood = 'running';
    sheepMessage = "Long run day. Stay patient early.";
  } else if (nextWorkoutData?.workoutType === 'easy' || nextWorkoutData?.workoutType === 'recovery') {
    sheepMood = 'encouraging';
    sheepMessage = "Easy effort today. Keep it honest.";
  } else if (nextWorkoutData) {
    if (hour < 10) {
      sheepMood = 'stretching';
      sheepMessage = "Morning miles hit different. Let's go.";
    } else if (hour >= 17) {
      sheepMood = 'encouraging';
      sheepMessage = "Evening run? Great way to close the day.";
    } else {
      sheepMood = 'encouraging';
      sheepMessage = "Your workout's ready when you are.";
    }
  }

  const mondayDate = new Date(weekPlan.weekStart + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().split('T')[0];
    const workout = weekPlan.workouts.find(w => w.date === dStr) || null;
    weekDays.push({
      date: dStr,
      dayLabel: getDayLabel(dStr),
      workout,
      isToday: dStr === todayString,
    });
  }

  return (
    <AnimatedList className="space-y-6">
      {/* 1. Header */}
      <AnimatedListItem>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            <DynamicGreeting name={settings?.name} />
          </h1>
          <p className="text-textSecondary mt-1">{dateStr}</p>
        </div>
        <div className="flex items-center gap-3">
          {streak.currentStreak > 0 && (
            <StreakBadge
              currentStreak={streak.currentStreak}
              longestStreak={streak.longestStreak}
            />
          )}
          <QuickLogButton />
        </div>
      </div>
      </AnimatedListItem>

      {/* Dreamy Coach */}
      <AnimatedListItem>
      <div className="flex items-center justify-center gap-3">
        {sheepMessage && <SheepSpeechBubble message={sheepMessage} side="left" />}
        <Link href="/sheep-jump" className="flex-shrink-0">
          <DreamySheep mood={sheepMood} size="sm" />
        </Link>
      </div>
      </AnimatedListItem>

      {/* 1.5 Smart Profile Prompt — contextual nudge for missing profile data */}
      {settings && (
        <AnimatedListItem>
          <SmartProfilePrompt
            settings={settings}
            hasGoalRace={!!trainingSummary?.nextRace}
            hasRaceResults={!!settings.vdot}
          />
        </AnimatedListItem>
      )}

      {/* 2. Milestone/celebration alerts only (other alerts temporarily disabled for optimization) */}
      {alerts.filter(a => a.severity === 'celebration').length > 0 && (
        <AnimatedListItem><AlertsDisplay alerts={alerts.filter(a => a.severity === 'celebration')} /></AnimatedListItem>
      )}
      {proactivePrompts.filter(p => p.type === 'milestone').length > 0 && (
        <AnimatedListItem><ProactiveCoachPrompts prompts={proactivePrompts.filter(p => p.type === 'milestone')} variant="inline" /></AnimatedListItem>
      )}

      {/* 2.5 PR Celebrations */}
      {recentPRs.length > 0 && (
        <AnimatedListItem>
          <PRCelebration celebrations={recentPRs} profileId={profileId!} />
        </AnimatedListItem>
      )}

      {/* 2.75 Pending Coach Suggestions */}
      {pendingCoachActions.length > 0 && (
        <AnimatedListItem>
          <PendingCoachSuggestions actions={pendingCoachActions} />
        </AnimatedListItem>
      )}

      {/* 3. Last Run Card */}
      {lastRun && (
        <AnimatedListItem>
        <Link
          href={`/workout/${lastRun.id}`}
          className="block bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden hover:border-sky-400/40 transition-colors border-l-4 border-l-sky-500/40"
        >
          <div className="flex">
            <div className="flex-1 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getWorkoutTypeColor(lastRun.workoutType)}`}>
                    {getWorkoutTypeLabel(lastRun.workoutType)}
                  </span>
                  <span className="text-xs text-textTertiary">{getRelativeTime(lastRun.date)}</span>
                </div>
                {lastRun.assessment && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getVerdictColor(lastRun.assessment.verdict)}`}>
                    {lastRun.assessment.verdict}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-5 text-sm">
                <div>
                  <span className="text-lg font-bold text-textPrimary">{formatDistance(lastRun.distanceMiles)}</span>
                  <span className="text-textTertiary ml-1">mi</span>
                </div>
                <div>
                  <span className="text-lg font-bold text-textPrimary">{formatPace(lastRun.avgPaceSeconds)}</span>
                  <span className="text-textTertiary ml-1">/mi</span>
                </div>
                <div>
                  <span className="text-lg font-bold text-textPrimary">{formatDuration(lastRun.durationMinutes)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center pr-3">
              <ChevronRight className="w-5 h-5 text-textTertiary" />
            </div>
          </div>
        </Link>
        </AnimatedListItem>
      )}

      {/* 3.5 Post-Run Reflection */}
      {unreflectedWorkouts.length > 0 && (
        <AnimatedListItem>
          <PostRunReflectionCard workout={unreflectedWorkouts[0]} />
        </AnimatedListItem>
      )}

      {/* 4. Next Workout Card */}
      {nextWorkoutData && (
        <AnimatedListItem>
        <div className="bg-bgSecondary rounded-xl border-2 border-borderPrimary shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-dream-600 to-dream-900 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">{nextWorkoutLabel}</span>
                {nextWorkoutData.isKeyWorkout && (
                  <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Key
                  </span>
                )}
              </div>
              {nextWorkoutData.phase && (
                <span className="text-xs text-white/70 capitalize">{nextWorkoutData.phase} phase</span>
              )}
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-textPrimary text-lg line-clamp-1">{nextWorkoutData.name}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getWorkoutTypeColor(nextWorkoutData.workoutType)}`}>
                {getWorkoutTypeLabel(nextWorkoutData.workoutType)}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 mt-2">
              {nextWorkoutData.targetDistanceMiles && (
                <div className="flex items-center text-sm text-textSecondary">
                  <Target className="w-4 h-4 mr-1 text-textTertiary" />
                  {nextWorkoutData.targetDistanceMiles} miles
                </div>
              )}
              {nextWorkoutData.targetPaceSecondsPerMile && (
                <div className="flex items-center text-sm text-textSecondary">
                  <Zap className="w-4 h-4 mr-1 text-textTertiary" />
                  {formatPace(nextWorkoutData.targetPaceSecondsPerMile)}/mi
                </div>
              )}
            </div>

            {nextWorkoutData.rationale && (
              <p className="text-sm text-textSecondary mt-2 line-clamp-2">{nextWorkoutData.rationale}</p>
            )}

            <div className="mt-4">
              <Link
                href="/log"
                className="btn-primary block text-center py-3 rounded-xl min-h-[44px]"
              >
                Log This Workout
              </Link>
            </div>
          </div>
        </div>
        </AnimatedListItem>
      )}

      {/* 4.25 Smart Workout Audibles */}
      {isTodaysPlannedWorkout && audibleOptions.length > 0 && plannedWorkout && (
        <AnimatedListItem>
          <WorkoutAudibles workoutId={plannedWorkout.id} options={audibleOptions} />
        </AnimatedListItem>
      )}

      {/* 4.5 Smart Training Cue */}
      {trainingCue && (
        <AnimatedListItem>
          <SmartTrainingCue cue={trainingCue} />
        </AnimatedListItem>
      )}

      {/* 5. Week Ahead Strip */}
      {weekPlan.workouts.length > 0 ? (
        <AnimatedListItem>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm border-l-4 border-l-rose-500/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-textPrimary">
              Week Ahead
              {trainingSummary?.currentPhase && (
                <span className="text-textTertiary font-normal capitalize"> &middot; {trainingSummary.currentPhase}</span>
              )}
            </h3>
            <span className="text-xs text-textSecondary">
              {weekPlan.completedMiles.toFixed(1)}/{weekPlan.totalMiles.toFixed(1)} mi
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const isCompleted = day.workout?.status === 'completed';
              const isRest = !day.workout || day.workout.workoutType === 'rest';
              const isPast = day.date < todayString && !isCompleted;

              return (
                <div
                  key={day.date}
                  className={`flex flex-col items-center py-2 px-1 rounded-lg ${
                    day.isToday ? 'ring-2 ring-accentTeal bg-accentTeal/10' : ''
                  }`}
                >
                  <span className={`text-xs font-medium mb-1.5 ${
                    day.isToday ? 'text-accentTeal' : 'text-textTertiary'
                  }`}>
                    {day.dayLabel}
                  </span>

                  {isRest ? (
                    <Minus className="w-3 h-3 text-textTertiary/40" />
                  ) : (
                    <div className="relative">
                      <div className={`w-3 h-3 rounded-full ${getTypeDotColor(day.workout!.workoutType)}`} />
                      {isCompleted && (
                        <Check className="w-3 h-3 text-green-500 absolute -top-1 -right-1" />
                      )}
                      {day.workout!.isKeyWorkout && !isCompleted && (
                        <Star className="w-2.5 h-2.5 text-amber-400 absolute -top-1 -right-1.5 fill-amber-400" />
                      )}
                    </div>
                  )}

                  {!isRest && day.workout?.targetDistanceMiles && (
                    <span className={`text-[10px] mt-1 ${
                      isCompleted ? 'text-green-400' :
                      isPast ? 'text-textTertiary line-through' : 'text-textSecondary'
                    }`}>
                      {day.workout.targetDistanceMiles}mi
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {trainingSummary?.nextRace && (
            <div className="mt-3 pt-3 border-t border-borderSecondary flex items-center gap-2 text-xs text-textSecondary">
              <Flag className="w-3.5 h-3.5 text-accentBlue" />
              <span className="font-medium text-textPrimary">{trainingSummary.nextRace.name}</span>
              <span>&middot; {trainingSummary.nextRace.distance} &middot; {trainingSummary.nextRace.daysUntil} days</span>
            </div>
          )}
        </div>
        </AnimatedListItem>
      ) : !trainingSummary?.nextRace && (
        <AnimatedListItem>
        <div className="bg-gradient-to-r from-dream-600 to-dream-900 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Get Your Training Plan</h2>
              <p className="text-white/80 text-sm mt-1">
                Set a goal race and we&apos;ll build an adaptive plan tailored to you.
              </p>
              <Link
                href="/races"
                className="inline-flex items-center gap-2 bg-surface-1 text-dream-400 px-4 py-2.5 rounded-lg font-semibold mt-3 hover:bg-surface-2 transition-colors text-sm shadow-sm min-h-[44px]"
              >
                <Flag className="w-4 h-4" />
                Set Your Goal Race
              </Link>
            </div>
          </div>
        </div>
        </AnimatedListItem>
      )}

      {/* 5.5 Weekly Insights */}
      {weeklyInsights.length > 0 && (
        <AnimatedListItem>
          <WeeklyInsights insights={weeklyInsights} />
        </AnimatedListItem>
      )}

      {/* 5.6 Weekly Recap Card */}
      {weeklyRecap && profileId && (
        <AnimatedListItem>
          <WeeklyRecapCard recap={weeklyRecap} profileId={profileId} />
        </AnimatedListItem>
      )}

      {/* 6. Quick Coach */}
      <AnimatedListItem>
      <QuickCoachInput suggestions={contextualSuggestions} />
      </AnimatedListItem>

      {/* 7. Readiness + Weather Row */}
      <AnimatedListItem>
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/readiness"
          className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:border-teal-400/40 transition-colors border-l-4 border-l-teal-500/40"
        >
          <div className="flex items-center gap-2 mb-2">
            <Battery className={`w-4 h-4 ${readinessData.result.color}`} />
            <span className="text-xs font-medium text-textTertiary uppercase tracking-wide">Readiness</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold ${readinessData.result.color}`}>
              {readinessData.result.score !== null ? readinessData.result.score : '--'}
            </span>
            <span className="text-sm text-textSecondary">{readinessData.result.label}</span>
          </div>
          {readinessData.result.isStale && readinessData.result.daysSinceAssessment !== undefined && (
            <div className="flex items-center gap-1 mt-1 text-xs text-amber-400">
              <Clock className="w-3 h-3" />
              {readinessData.result.daysSinceAssessment}d ago
            </div>
          )}
          <div className="flex items-center gap-1 mt-2 text-xs text-accentTeal">
            Details <ChevronRight className="w-3 h-3" />
          </div>
        </Link>

        {weather && forecast && smartWeather ? (
          <RunWeatherCard
            forecast={forecast}
            currentTemp={Math.round(weather.temperature)}
            currentFeelsLike={Math.round(weather.feelsLike)}
            currentCondition={weather.condition}
            currentHumidity={weather.humidity}
            currentWindSpeed={weather.windSpeed}
            timezone={smartWeather.timezone}
          />
        ) : (
          <Link
            href="/settings"
            className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:border-sky-400/40 transition-colors border-l-4 border-l-sky-500/40"
          >
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4 text-textTertiary" />
              <span className="text-xs font-medium text-textTertiary uppercase tracking-wide">Weather</span>
            </div>
            <p className="text-sm text-textSecondary">Set location in settings</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-accentTeal">
              Settings <ChevronRight className="w-3 h-3" />
            </div>
          </Link>
        )}
      </div>
      </AnimatedListItem>

      {/* 7.5 Recovery Analysis */}
      {recoveryAnalysis && recoveryAnalysis.confidence > 0 && (
        <AnimatedListItem>
          <RecoveryCard recovery={recoveryAnalysis} />
        </AnimatedListItem>
      )}

      {/* 8. Running Streaks & Consistency */}
      <AnimatedListItem>
        <RunningStreaks />
      </AnimatedListItem>
    </AnimatedList>
  );
}

export default function TodayPage() {
  return (
    <DemoWrapper
      demoComponent={<DemoToday />}
      serverComponent={<ServerToday />}
    />
  );
}
