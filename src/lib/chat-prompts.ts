// Contextual Chat Prompt Suggestions
// Generates relevant prompts based on user context

export interface ChatPromptSuggestion {
  label: string;      // Short label for button (e.g., "Log run")
  prompt: string;     // Full prompt to send to coach
  icon?: string;      // Optional emoji
  priority: number;   // Higher = show first
}

export interface PromptContext {
  hasRunToday: boolean;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  isWeekend: boolean;
  weatherCondition?: 'hot' | 'cold' | 'rainy' | 'nice' | null;
  plannedWorkoutType?: string | null;
  isRestDay?: boolean;
}

// Base prompts that are always relevant
const BASE_PROMPTS: ChatPromptSuggestion[] = [
  {
    label: 'Log a run',
    prompt: 'I want to log a run',
    icon: '',
    priority: 50,
  },
  {
    label: "Today's workout",
    prompt: "What's my workout for today?",
    icon: '',
    priority: 40,
  },
  {
    label: 'Week summary',
    prompt: 'How did my training go this week?',
    icon: '',
    priority: 20,
  },
];

// Time-based prompts
const TIME_PROMPTS: Record<PromptContext['timeOfDay'], ChatPromptSuggestion[]> = {
  morning: [
    {
      label: 'Morning plan',
      prompt: "What's my plan for today's run?",
      icon: '',
      priority: 60,
    },
    {
      label: 'Check conditions',
      prompt: 'How should I adjust for current conditions?',
      icon: '',
      priority: 45,
    },
  ],
  afternoon: [
    {
      label: 'Afternoon run tips',
      prompt: 'Any tips for an afternoon run today?',
      icon: '',
      priority: 35,
    },
  ],
  evening: [
    {
      label: "Tomorrow's plan",
      prompt: "What's on the schedule for tomorrow?",
      icon: '',
      priority: 55,
    },
    {
      label: 'Recovery check',
      prompt: 'How should I recover tonight for my next run?',
      icon: '',
      priority: 30,
    },
  ],
};

// Post-run prompts (when user has already run today)
const POST_RUN_PROMPTS: ChatPromptSuggestion[] = [
  {
    label: "How'd I do?",
    prompt: 'How did my run go today? Any feedback?',
    icon: '',
    priority: 70,
  },
  {
    label: 'Rate my effort',
    prompt: 'Can you analyze my effort and pacing from today?',
    icon: '',
    priority: 65,
  },
  {
    label: "What's tomorrow?",
    prompt: "What's planned for tomorrow?",
    icon: '',
    priority: 55,
  },
  {
    label: 'Recovery tips',
    prompt: 'What should I do to recover well from today?',
    icon: '',
    priority: 45,
  },
];

// Pre-run prompts (when user hasn't run yet)
const PRE_RUN_PROMPTS: ChatPromptSuggestion[] = [
  {
    label: 'Log a run',
    prompt: 'I want to log a run',
    icon: '',
    priority: 75,
  },
  {
    label: "Today's workout",
    prompt: "What's my workout for today?",
    icon: '',
    priority: 70,
  },
  {
    label: 'What to wear',
    prompt: 'What should I wear for my run today?',
    icon: '',
    priority: 50,
  },
];

// Rest day prompts
const REST_DAY_PROMPTS: ChatPromptSuggestion[] = [
  {
    label: 'Am I recovering?',
    prompt: 'Am I recovering well? How does my training load look?',
    icon: '',
    priority: 70,
  },
  {
    label: 'Stretch routine',
    prompt: 'Can you suggest a stretching routine for my rest day?',
    icon: '',
    priority: 60,
  },
  {
    label: 'Cross-train ideas',
    prompt: 'What cross-training should I do on rest days?',
    icon: '',
    priority: 55,
  },
  {
    label: "Tomorrow's workout",
    prompt: "What's planned for tomorrow after this rest day?",
    icon: '',
    priority: 50,
  },
];

// Weather-specific prompts
const WEATHER_PROMPTS: Record<NonNullable<PromptContext['weatherCondition']>, ChatPromptSuggestion[]> = {
  hot: [
    {
      label: 'Heat tips',
      prompt: "It's hot today. How should I adjust my run?",
      icon: '',
      priority: 80,
    },
    {
      label: 'Hydration plan',
      prompt: 'What should my hydration strategy be for running in the heat?',
      icon: '',
      priority: 75,
    },
  ],
  cold: [
    {
      label: 'Cold weather tips',
      prompt: "It's cold out. How should I prepare for my run?",
      icon: '',
      priority: 80,
    },
    {
      label: 'Warm-up routine',
      prompt: 'What warm-up should I do before running in the cold?',
      icon: '',
      priority: 70,
    },
  ],
  rainy: [
    {
      label: 'Rain run tips',
      prompt: "It's rainy. Should I still run? Any tips?",
      icon: '',
      priority: 80,
    },
    {
      label: 'Indoor alternative',
      prompt: 'What can I do indoors instead of my outdoor run?',
      icon: '',
      priority: 65,
    },
  ],
  nice: [
    {
      label: 'Perfect day run',
      prompt: "Weather looks great! How can I make the most of it?",
      icon: '',
      priority: 45,
    },
  ],
};

// Workout-type specific prompts
const WORKOUT_TYPE_PROMPTS: Record<string, ChatPromptSuggestion[]> = {
  long: [
    {
      label: 'Long run strategy',
      prompt: "What's the best strategy for my long run today?",
      icon: '',
      priority: 85,
    },
    {
      label: 'Fueling plan',
      prompt: 'What should I eat/drink before and during my long run?',
      icon: '',
      priority: 80,
    },
    {
      label: 'Pacing guide',
      prompt: 'What pace should I target for my long run?',
      icon: '',
      priority: 75,
    },
  ],
  tempo: [
    {
      label: 'Tempo strategy',
      prompt: 'How should I approach my tempo run today?',
      icon: '',
      priority: 80,
    },
    {
      label: 'Target pace',
      prompt: 'What pace should I hit for my tempo segments?',
      icon: '',
      priority: 75,
    },
  ],
  interval: [
    {
      label: 'Interval tips',
      prompt: 'How should I execute my intervals today?',
      icon: '',
      priority: 80,
    },
    {
      label: 'Recovery between',
      prompt: 'How much recovery should I take between intervals?',
      icon: '',
      priority: 70,
    },
  ],
  threshold: [
    {
      label: 'Threshold guidance',
      prompt: 'How do I run at threshold pace correctly?',
      icon: '',
      priority: 80,
    },
  ],
  easy: [
    {
      label: 'Easy run pace',
      prompt: 'Am I running my easy runs too fast or too slow?',
      icon: '',
      priority: 55,
    },
  ],
  recovery: [
    {
      label: 'Recovery run tips',
      prompt: 'How slow should my recovery run be?',
      icon: '',
      priority: 60,
    },
  ],
};

// Weekend-specific prompts
const WEEKEND_PROMPTS: ChatPromptSuggestion[] = [
  {
    label: 'Trail run options',
    prompt: 'Can you suggest some trail running options for the weekend?',
    icon: '',
    priority: 50,
  },
  {
    label: 'Group run ideas',
    prompt: 'Any ideas for a group run this weekend?',
    icon: '',
    priority: 45,
  },
  {
    label: 'Weekend warrior',
    prompt: "What's the plan for the weekend runs?",
    icon: '',
    priority: 55,
  },
];

/**
 * Get contextual chat prompt suggestions based on user's current situation.
 * Returns 4-5 most relevant prompts sorted by priority (highest first).
 */
export function getContextualPrompts(context: PromptContext): ChatPromptSuggestion[] {
  const prompts: ChatPromptSuggestion[] = [];

  // Add time-of-day prompts
  prompts.push(...TIME_PROMPTS[context.timeOfDay]);

  // Add run-status prompts
  if (context.hasRunToday) {
    prompts.push(...POST_RUN_PROMPTS);
  } else {
    prompts.push(...PRE_RUN_PROMPTS);
  }

  // Add rest day prompts
  if (context.isRestDay) {
    prompts.push(...REST_DAY_PROMPTS);
  }

  // Add weather-specific prompts
  if (context.weatherCondition && WEATHER_PROMPTS[context.weatherCondition]) {
    prompts.push(...WEATHER_PROMPTS[context.weatherCondition]);
  }

  // Add workout-type specific prompts
  if (context.plannedWorkoutType && !context.isRestDay) {
    const workoutPrompts = WORKOUT_TYPE_PROMPTS[context.plannedWorkoutType];
    if (workoutPrompts) {
      prompts.push(...workoutPrompts);
    }
  }

  // Add weekend prompts
  if (context.isWeekend) {
    prompts.push(...WEEKEND_PROMPTS);
  }

  // Deduplicate by label (keep highest priority version)
  const uniquePrompts = new Map<string, ChatPromptSuggestion>();
  for (const prompt of prompts) {
    const existing = uniquePrompts.get(prompt.label);
    if (!existing || prompt.priority > existing.priority) {
      uniquePrompts.set(prompt.label, prompt);
    }
  }

  // Sort by priority (highest first) and return top 5
  return Array.from(uniquePrompts.values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

/**
 * Helper to determine time of day from current hour.
 */
export function getTimeOfDay(hour: number = new Date().getHours()): PromptContext['timeOfDay'] {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 17) {
    return 'afternoon';
  } else {
    return 'evening';
  }
}

/**
 * Helper to check if today is a weekend.
 */
export function isWeekend(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Helper to map temperature to weather condition.
 * @param tempF Temperature in Fahrenheit
 * @param isRaining Whether it's currently raining
 */
export function getWeatherCondition(
  tempF?: number | null,
  isRaining?: boolean
): PromptContext['weatherCondition'] {
  if (isRaining) {
    return 'rainy';
  }
  if (tempF == null) {
    return null;
  }
  if (tempF >= 80) {
    return 'hot';
  }
  if (tempF <= 40) {
    return 'cold';
  }
  return 'nice';
}
