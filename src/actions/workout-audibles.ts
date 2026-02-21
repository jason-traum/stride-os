// Pure decision-tree logic for Smart Workout Audibles
// Imported server-side by page.tsx — NOT a 'use server' file

export interface AudibleWorkoutInput {
  id: number;
  name: string;
  workoutType: string;
  targetDistanceMiles: number | null;
  targetDurationMinutes: number | null;
  targetPaceSecondsPerMile: number | null;
  description: string;
  rationale: string | null;
  isKeyWorkout: boolean | null;
}

export interface AudibleModification {
  name?: string;
  workoutType?: string;
  targetDistanceMiles?: number | null;
  targetDurationMinutes?: number | null;
  targetPaceSecondsPerMile?: number | null;
  description?: string;
  rationale?: string;
}

export interface AudibleOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
  category: 'tired' | 'time' | 'heavy' | 'weather' | 'great';
  modification: AudibleModification;
  preview: {
    name: string;
    workoutType: string;
    targetDistanceMiles: number | null;
    targetPaceSecondsPerMile: number | null;
  };
}

export interface AudibleContext {
  readinessScore: number;
  tsb: number | undefined;
  weatherCondition: string | null;
  weatherTemp: number | null;
  weatherWindSpeed: number | null;
  weatherHumidity: number | null;
}

const QUALITY_TYPES = ['tempo', 'threshold', 'interval', 'repetition', 'marathon'];
const EASY_TYPES = ['easy', 'recovery', 'steady'];

function isQualityOrLong(type: string) {
  return QUALITY_TYPES.includes(type) || type === 'long';
}

function isEasyType(type: string) {
  return EASY_TYPES.includes(type);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ===== Decision Trees =====

function getTiredAudibles(workout: AudibleWorkoutInput, context: AudibleContext): AudibleOption[] {
  const options: AudibleOption[] = [];
  const lowReadiness = context.readinessScore < 40;
  const negativeTsb = context.tsb !== undefined && context.tsb < -10;
  const readinessNote = lowReadiness ? ` Your readiness is ${context.readinessScore}/100.` : '';
  const tsbNote = negativeTsb ? ` Training load is high (TSB ${context.tsb}).` : '';

  if (isQualityOrLong(workout.workoutType)) {
    const easierDist = workout.targetDistanceMiles ? round1(workout.targetDistanceMiles * 0.7) : null;
    options.push({
      id: 'tired-easy',
      label: 'Easy Run Instead',
      emoji: '😴',
      description: `Swap this quality session for an easy run.${readinessNote}${tsbNote}`,
      category: 'tired',
      modification: {
        name: 'Easy Run (audible)',
        workoutType: 'easy',
        targetDistanceMiles: easierDist,
        targetPaceSecondsPerMile: null,
        description: `Easy run — swapped from ${workout.name}. Listen to your body.`,
        rationale: `Audible: feeling tired, swapped quality session for easy effort.`,
      },
      preview: {
        name: 'Easy Run (audible)',
        workoutType: 'easy',
        targetDistanceMiles: easierDist,
        targetPaceSecondsPerMile: null,
      },
    });
  } else if (isEasyType(workout.workoutType)) {
    const shorterDist = workout.targetDistanceMiles ? round1(workout.targetDistanceMiles * 0.6) : null;
    options.push({
      id: 'tired-shorter',
      label: 'Shorter Easy',
      emoji: '😴',
      description: `Cut it short — 60% of planned distance.${readinessNote}${tsbNote}`,
      category: 'tired',
      modification: {
        name: `${workout.name} (shortened)`,
        workoutType: workout.workoutType,
        targetDistanceMiles: shorterDist,
        targetDurationMinutes: workout.targetDurationMinutes ? Math.round(workout.targetDurationMinutes * 0.6) : null,
        description: `Shortened easy run. Rest when you need it.`,
        rationale: `Audible: feeling tired, shortened to 60%.`,
      },
      preview: {
        name: `${workout.name} (shortened)`,
        workoutType: workout.workoutType,
        targetDistanceMiles: shorterDist,
        targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile,
      },
    });
  }

  // Rest day option for all non-rest workouts
  options.push({
    id: 'tired-rest',
    label: 'Take a Rest Day',
    emoji: '🛌',
    description: `Skip today entirely and recover.${readinessNote}${tsbNote}`,
    category: 'tired',
    modification: {
      name: 'Rest Day (audible)',
      workoutType: 'recovery',
      targetDistanceMiles: null,
      targetDurationMinutes: null,
      targetPaceSecondsPerMile: null,
      description: 'Rest day — taking a break to recover.',
      rationale: 'Audible: swapped to rest day.',
    },
    preview: {
      name: 'Rest Day (audible)',
      workoutType: 'recovery',
      targetDistanceMiles: null,
      targetPaceSecondsPerMile: null,
    },
  });

  return options;
}

function getShortOnTimeAudibles(workout: AudibleWorkoutInput): AudibleOption[] {
  if (!workout.targetDistanceMiles && !workout.targetDurationMinutes) return [];

  const options: AudibleOption[] = [];
  const dist = workout.targetDistanceMiles;
  const dur = workout.targetDurationMinutes;

  options.push({
    id: 'time-trimmed',
    label: 'Trimmed Version',
    emoji: '⏱️',
    description: '75% of the planned workout — still a solid session.',
    category: 'time',
    modification: {
      name: `${workout.name} (trimmed)`,
      targetDistanceMiles: dist ? round1(dist * 0.75) : null,
      targetDurationMinutes: dur ? Math.round(dur * 0.75) : null,
      description: `Trimmed version of ${workout.name}.`,
      rationale: 'Audible: short on time, trimmed to 75%.',
    },
    preview: {
      name: `${workout.name} (trimmed)`,
      workoutType: workout.workoutType,
      targetDistanceMiles: dist ? round1(dist * 0.75) : null,
      targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile,
    },
  });

  options.push({
    id: 'time-quick',
    label: 'Quick Hit',
    emoji: '⚡',
    description: '50% — get it done and move on.',
    category: 'time',
    modification: {
      name: `${workout.name} (quick)`,
      targetDistanceMiles: dist ? round1(dist * 0.5) : null,
      targetDurationMinutes: dur ? Math.round(dur * 0.5) : null,
      description: `Quick version of ${workout.name}.`,
      rationale: 'Audible: short on time, cut to 50%.',
    },
    preview: {
      name: `${workout.name} (quick)`,
      workoutType: workout.workoutType,
      targetDistanceMiles: dist ? round1(dist * 0.5) : null,
      targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile,
    },
  });

  return options;
}

function getHeavyLegsAudibles(workout: AudibleWorkoutInput): AudibleOption[] {
  if (isEasyType(workout.workoutType)) return [];

  const shakeDist = workout.targetDistanceMiles ? round1(workout.targetDistanceMiles * 0.6) : null;

  return [{
    id: 'heavy-shakeout',
    label: 'Recovery Shake-Out',
    emoji: '🦵',
    description: 'Easy recovery pace, 60% distance. Loosen up without digging deeper.',
    category: 'heavy',
    modification: {
      name: 'Recovery Shake-Out (audible)',
      workoutType: 'recovery',
      targetDistanceMiles: shakeDist,
      targetPaceSecondsPerMile: null,
      description: 'Easy shake-out run at recovery pace.',
      rationale: 'Audible: heavy legs, swapped to recovery shake-out.',
    },
    preview: {
      name: 'Recovery Shake-Out (audible)',
      workoutType: 'recovery',
      targetDistanceMiles: shakeDist,
      targetPaceSecondsPerMile: null,
    },
  }];
}

function getWeatherAudibles(workout: AudibleWorkoutInput, context: AudibleContext): AudibleOption[] {
  const { weatherCondition, weatherTemp, weatherWindSpeed, weatherHumidity } = context;
  if (!weatherCondition) return [];

  const badCondition = ['rain', 'snow', 'thunderstorm'].includes(weatherCondition);
  const tooHot = weatherTemp !== null && weatherTemp > 90;
  const tooWindy = weatherWindSpeed !== null && weatherWindSpeed > 25;
  const tooHumid = weatherHumidity !== null && weatherTemp !== null && weatherHumidity > 85 && weatherTemp > 75;

  if (!badCondition && !tooHot && !tooWindy && !tooHumid) return [];

  const options: AudibleOption[] = [];

  options.push({
    id: 'weather-indoor',
    label: 'Move Indoors',
    emoji: '🏠',
    description: `Same workout on a treadmill.`,
    category: 'weather',
    modification: {
      name: `${workout.name} (treadmill)`,
      description: `${workout.description} — moved indoors due to weather.`,
      rationale: 'Audible: moved indoors due to weather.',
    },
    preview: {
      name: `${workout.name} (treadmill)`,
      workoutType: workout.workoutType,
      targetDistanceMiles: workout.targetDistanceMiles,
      targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile,
    },
  });

  if (!workout.isKeyWorkout) {
    const estDuration = workout.targetDistanceMiles
      ? Math.round(workout.targetDistanceMiles * 10) // ~10 min/mile estimate for cross-train equivalent
      : workout.targetDurationMinutes;

    options.push({
      id: 'weather-cross',
      label: 'Cross-Train',
      emoji: '🚴',
      description: 'Swap for a bike, swim, or other cross-training.',
      category: 'weather',
      modification: {
        name: 'Cross-Training (audible)',
        workoutType: 'cross_train',
        targetDistanceMiles: null,
        targetDurationMinutes: estDuration,
        targetPaceSecondsPerMile: null,
        description: 'Cross-training session — bike, swim, or elliptical.',
        rationale: 'Audible: weather swap to cross-training.',
      },
      preview: {
        name: 'Cross-Training (audible)',
        workoutType: 'cross_train',
        targetDistanceMiles: null,
        targetPaceSecondsPerMile: null,
      },
    });
  }

  return options;
}

function getFeelingGreatAudibles(workout: AudibleWorkoutInput, context: AudibleContext): AudibleOption[] {
  if (!isEasyType(workout.workoutType)) return [];
  if (context.readinessScore <= 60) return [];
  if (context.tsb !== undefined && context.tsb < -15) return [];

  const options: AudibleOption[] = [];

  options.push({
    id: 'great-strides',
    label: 'Add Strides',
    emoji: '🚀',
    description: 'Tack on 6×20s strides at the end for a neuromuscular boost.',
    category: 'great',
    modification: {
      name: `${workout.name} + Strides`,
      description: `${workout.description}\n\nFinish with 6×20s strides (fast, relaxed, full recovery).`,
      rationale: 'Audible: feeling great, added strides.',
    },
    preview: {
      name: `${workout.name} + Strides`,
      workoutType: workout.workoutType,
      targetDistanceMiles: workout.targetDistanceMiles,
      targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile,
    },
  });

  if (workout.targetDistanceMiles) {
    const longerDist = round1(workout.targetDistanceMiles * 1.15);
    options.push({
      id: 'great-longer',
      label: 'Go a Bit Longer',
      emoji: '🔥',
      description: `+15% distance (${longerDist} mi). Bank some extra aerobic work.`,
      category: 'great',
      modification: {
        name: `${workout.name} (extended)`,
        targetDistanceMiles: longerDist,
        description: `Extended easy run — feeling great, adding 15% distance.`,
        rationale: 'Audible: feeling great, extended distance by 15%.',
      },
      preview: {
        name: `${workout.name} (extended)`,
        workoutType: workout.workoutType,
        targetDistanceMiles: longerDist,
        targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile,
      },
    });
  }

  return options;
}

// ===== Main Entry Point =====

export function getAudibleOptions(workout: AudibleWorkoutInput, context: AudibleContext): AudibleOption[] {
  // Skip rest/recovery-only workouts
  if (workout.workoutType === 'recovery' && workout.name.toLowerCase().includes('rest')) {
    return [];
  }

  return [
    ...getTiredAudibles(workout, context),
    ...getShortOnTimeAudibles(workout),
    ...getHeavyLegsAudibles(workout),
    ...getWeatherAudibles(workout, context),
    ...getFeelingGreatAudibles(workout, context),
  ];
}
