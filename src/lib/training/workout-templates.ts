/**
 * Workout Templates
 *
 * A comprehensive library of running workout templates based on proven coaching methodologies.
 * These templates are used by the plan generator and can be referenced by the AI coach.
 */

import { WorkoutTemplateDefinition, TrainingPhase } from './types';

// ==================== Long Run Templates ====================

export const longRunTemplates: WorkoutTemplateDefinition[] = [
  {
    id: 'easy_long_run',
    name: 'Easy Long Run',
    category: 'long',
    phaseAppropriate: ['base', 'build', 'peak'],
    description: 'Steady-state long run at conversational pace. Focus on time on feet and aerobic development.',
    structure: {
      segments: [
        { type: 'steady', pace: 'easy_long', notes: '60-70% effort, 1-2 min slower than MP' }
      ]
    },
    targetEffortMin: 60,
    targetEffortMax: 70,
    typicalDistanceMilesMin: 12,
    typicalDistanceMilesMax: 22,
    purpose: 'Build endurance, improve fat utilization, develop mental toughness. Primary aerobic development workout.',
    progressionNotes: 'Increase distance by 1-2 miles every 1-2 weeks. Start at 10-12 miles, build to 18-22 for marathon.',
    isKeyWorkout: true,
    intensityLevel: 'moderate',
    paceZone: 'easy'
  },
  {
    id: 'progression_long_run',
    name: 'Progression Long Run',
    category: 'long',
    phaseAppropriate: ['build', 'peak'],
    description: 'Start easy, gradually increase pace throughout, finishing at or near marathon pace.',
    structure: {
      segments: [
        { type: 'steady', percentage: 60, pace: 'easy_long', notes: 'First 60% at easy pace' },
        { type: 'steady', percentage: 25, pace: 'general_aerobic', notes: 'Pick up to steady effort' },
        { type: 'steady', percentage: 15, pace: 'marathon', notes: 'Final miles at MP or faster' }
      ]
    },
    targetEffortMin: 60,
    targetEffortMax: 80,
    typicalDistanceMilesMin: 14,
    typicalDistanceMilesMax: 20,
    purpose: 'Teaches pacing discipline, simulates negative split racing, builds confidence in goal pace when fatigued.',
    progressionNotes: 'Increase the goal-pace segment as fitness improves. Start with final 2-3 miles at MP, progress to final 4-6 miles.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'marathon'
  },
  {
    id: 'marathon_pace_long_run',
    name: 'Marathon Pace Long Run',
    category: 'long',
    phaseAppropriate: ['build', 'peak'],
    description: 'Long run with extended segments at marathon pace. Key race-specific workout.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 3, pace: 'easy' },
        { type: 'work', distanceMiles: 8, pace: 'marathon', notes: 'Continuous MP segment' },
        { type: 'cooldown', distanceMiles: 2, pace: 'easy' }
      ],
      totalDistanceMiles: 13
    },
    targetEffortMin: 70,
    targetEffortMax: 80,
    typicalDistanceMilesMin: 13,
    typicalDistanceMilesMax: 18,
    purpose: 'Race-specific endurance. Teaches body to sustain MP and practice race-day fueling.',
    progressionNotes: 'Increase MP segment from 6 miles to 10-14 miles. Never exceed 60% of race distance at MP in training.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'marathon'
  },
  {
    id: 'alternating_pace_long_run',
    name: 'Alternating Pace Long Run',
    category: 'long',
    phaseAppropriate: ['peak'],
    description: 'Alternate between marathon pace and easy pace every 1-2 miles. Very challenging workout.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'intervals', repeats: 5, workDistanceMiles: 1.5, pace: 'marathon', restMinutes: 3, restType: 'jog' },
        { type: 'cooldown', distanceMiles: 2, pace: 'easy' }
      ]
    },
    targetEffortMin: 65,
    targetEffortMax: 80,
    typicalDistanceMilesMin: 14,
    typicalDistanceMilesMax: 18,
    purpose: 'Builds pace control and mental resilience. Simulates surging and recovering during a race.',
    isKeyWorkout: true,
    intensityLevel: 'very_hard',
    paceZone: 'marathon'
  },
  {
    id: 'marathon_simulation',
    name: 'Marathon Simulation',
    category: 'long',
    phaseAppropriate: ['peak'],
    description: 'Extended run with majority at marathon pace. Dress rehearsal for race day.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'work', distanceMiles: 12, pace: 'marathon', notes: 'Practice exact race-day fueling' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ],
      totalDistanceMiles: 15
    },
    targetEffortMin: 70,
    targetEffortMax: 80,
    typicalDistanceMilesMin: 15,
    typicalDistanceMilesMax: 18,
    purpose: 'Final confidence builder. Practice fueling, pacing, gear, and mental strategy. Do 3-4 weeks before race.',
    isKeyWorkout: true,
    intensityLevel: 'very_hard',
    paceZone: 'marathon'
  }
];

// ==================== Tempo & Threshold Templates ====================

export const tempoTemplates: WorkoutTemplateDefinition[] = [
  {
    id: 'steady_tempo',
    name: 'Steady Tempo Run',
    category: 'tempo',
    phaseAppropriate: ['base', 'build', 'peak'],
    description: 'Continuous run at comfortably hard effort. Should be able to speak in short phrases but not hold conversation.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'work', distanceMiles: 4, pace: 'tempo', notes: '78-85% effort, ~HMP to 10K pace' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 78,
    targetEffortMax: 85,
    typicalDistanceMilesMin: 5,
    typicalDistanceMilesMax: 10,
    purpose: 'Improves lactate threshold, running economy, and mental toughness for sustained hard efforts.',
    progressionNotes: 'Start with 20 min tempo, progress to 40-45 min. Increase duration before increasing pace.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'tempo'
  },
  {
    id: 'progressive_tempo',
    name: 'Progressive Tempo',
    category: 'tempo',
    phaseAppropriate: ['build', 'peak'],
    description: 'Tempo that starts moderate and finishes at threshold. Teaches pace discipline and finishing strong.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'work', distanceMiles: 2, pace: 'half_marathon', notes: 'Start at HMP' },
        { type: 'work', distanceMiles: 2, pace: 'tempo', notes: 'Progress to tempo' },
        { type: 'work', distanceMiles: 1, pace: 'threshold', notes: 'Finish near threshold' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 78,
    targetEffortMax: 88,
    typicalDistanceMilesMin: 7,
    typicalDistanceMilesMax: 10,
    purpose: 'Develops ability to close strong. Simulates negative split racing.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'tempo'
  },
  {
    id: 'cruise_intervals',
    name: 'Cruise Intervals',
    category: 'tempo',
    phaseAppropriate: ['base', 'build'],
    description: 'Threshold-pace repeats with short recovery. Accumulates more time at threshold than continuous tempo.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'intervals', repeats: 3, workDistanceMiles: 2, pace: 'threshold', restMinutes: 1, restType: 'jog' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 82,
    targetEffortMax: 88,
    typicalDistanceMilesMin: 8,
    typicalDistanceMilesMax: 11,
    purpose: 'Allows more total volume at threshold pace. Great for building lactate threshold without excessive fatigue.',
    progressionNotes: 'Progress from 3x1.5mi to 4x2mi or 3x3mi. Keep recovery short (60-90 sec).',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'threshold'
  },
  {
    id: 'threshold_intervals',
    name: 'Threshold Intervals',
    category: 'threshold',
    phaseAppropriate: ['build', 'peak'],
    description: 'Hard intervals at threshold pace (roughly 1-hour race pace). Pushes upper limit of sustainable effort.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'intervals', repeats: 4, workDistanceMiles: 1.5, pace: 'threshold', restMinutes: 1.5, restType: 'jog' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 85,
    targetEffortMax: 88,
    typicalDistanceMilesMin: 8,
    typicalDistanceMilesMax: 11,
    purpose: 'Maximizes time at lactate threshold. Key workout for half marathon and marathon preparation.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'threshold'
  }
];

// ==================== VO2max / Speed Templates ====================

export const vo2maxTemplates: WorkoutTemplateDefinition[] = [
  {
    id: 'short_intervals_400m',
    name: '400m Repeats',
    category: 'vo2max',
    phaseAppropriate: ['base', 'build'],
    description: 'Fast 400m repeats at 5K pace or slightly faster. Develops speed and running economy.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy', notes: 'Include strides' },
        { type: 'intervals', repeats: 8, workDistanceMeters: 400, pace: 'interval', restMinutes: 1.5, restType: 'jog' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 90,
    targetEffortMax: 95,
    typicalDistanceMilesMin: 5,
    typicalDistanceMilesMax: 8,
    purpose: 'Develops VO2max, leg speed, and running economy. Good introduction to speed work.',
    progressionNotes: 'Start with 6x400, progress to 10-12x400. Can also progress to 600m or 800m repeats.',
    isKeyWorkout: true,
    intensityLevel: 'very_hard',
    paceZone: 'interval'
  },
  {
    id: 'long_intervals_1000m',
    name: '1000m Repeats',
    category: 'vo2max',
    phaseAppropriate: ['build', 'peak'],
    description: 'Classic VO2max workout. 1000m repeats at 5K pace with equal or slightly less recovery.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy', notes: 'Include strides' },
        { type: 'intervals', repeats: 5, workDistanceMeters: 1000, pace: 'interval', restMinutes: 2.5, restType: 'jog' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 90,
    targetEffortMax: 95,
    typicalDistanceMilesMin: 7,
    typicalDistanceMilesMax: 10,
    purpose: 'Primary VO2max development workout. Improves oxygen uptake and delivery.',
    progressionNotes: 'Progress from 4x800 to 6x1000 or 5x1200. Total hard volume of 3-5K.',
    isKeyWorkout: true,
    intensityLevel: 'very_hard',
    paceZone: 'interval'
  },
  {
    id: 'yasso_800s',
    name: 'Yasso 800s',
    category: 'vo2max',
    phaseAppropriate: ['build', 'peak'],
    description: 'Famous marathon predictor workout. Run 800m repeats in minutes:seconds equal to your marathon goal hours:minutes.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'intervals', repeats: 10, workDistanceMeters: 800, pace: 'interval', notes: 'Equal rest to work time', restType: 'jog' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 88,
    targetEffortMax: 92,
    typicalDistanceMilesMin: 8,
    typicalDistanceMilesMax: 10,
    purpose: 'Marathon fitness benchmark. If targeting 3:30 marathon, run 800s in 3:30 each.',
    progressionNotes: 'Build from 4 repeats to 10 over several weeks. Great confidence builder.',
    isKeyWorkout: true,
    intensityLevel: 'very_hard',
    paceZone: 'interval'
  },
  {
    id: 'ladder_workout',
    name: 'Ladder Workout',
    category: 'vo2max',
    phaseAppropriate: ['build'],
    description: 'Intervals of increasing then decreasing distance. Provides variety and multiple intensities.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'ladder', distancesMeters: [400, 800, 1200, 800, 400], pace: 'interval', notes: 'Jog equal distance between' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 88,
    targetEffortMax: 95,
    typicalDistanceMilesMin: 7,
    typicalDistanceMilesMax: 9,
    purpose: 'Variety in speed work. Shorter reps build speed, longer reps build endurance.',
    isKeyWorkout: true,
    intensityLevel: 'very_hard',
    paceZone: 'interval'
  },
  {
    id: 'mile_repeats',
    name: 'Mile Repeats',
    category: 'vo2max',
    phaseAppropriate: ['build', 'peak'],
    description: 'Long VO2max intervals at 5K-10K pace. Bridges speed and endurance.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'intervals', repeats: 4, workDistanceMiles: 1, pace: 'vo2max', restMinutes: 3, restType: 'jog' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 88,
    targetEffortMax: 92,
    typicalDistanceMilesMin: 8,
    typicalDistanceMilesMax: 10,
    purpose: 'Develops ability to sustain hard effort. Great for 10K and half marathon preparation.',
    isKeyWorkout: true,
    intensityLevel: 'very_hard',
    paceZone: 'vo2max'
  }
];

// ==================== Fartlek & Hill Templates ====================

export const fartlekHillTemplates: WorkoutTemplateDefinition[] = [
  {
    id: 'classic_fartlek',
    name: 'Classic Fartlek',
    category: 'fartlek',
    phaseAppropriate: ['base', 'build'],
    description: 'Unstructured speed play with varied fast and easy segments based on feel.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 1.5, pace: 'easy' },
        { type: 'fartlek', durationMinutes: 20, notes: 'Alternate 1-3 min hard with 1-2 min easy, by feel' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 70,
    targetEffortMax: 90,
    typicalDistanceMilesMin: 5,
    typicalDistanceMilesMax: 8,
    purpose: 'Develops speed and aerobic capacity without the mental stress of structured intervals. Great for base building.',
    isKeyWorkout: false,
    intensityLevel: 'moderate',
    paceZone: 'tempo'
  },
  {
    id: 'structured_fartlek',
    name: 'Structured Fartlek',
    category: 'fartlek',
    phaseAppropriate: ['base', 'build'],
    description: 'Fartlek with defined on/off intervals. More structured than classic fartlek.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 1.5, pace: 'easy' },
        { type: 'intervals', repeats: 6, workDurationMinutes: 3, pace: 'tempo', restMinutes: 2, restType: 'jog' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 75,
    targetEffortMax: 85,
    typicalDistanceMilesMin: 6,
    typicalDistanceMilesMax: 9,
    purpose: 'Structured alternative to track work. Good for runners who dislike the track.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'tempo'
  },
  {
    id: 'short_hill_repeats',
    name: 'Short Hill Repeats',
    category: 'hills',
    phaseAppropriate: ['base', 'build'],
    description: 'Short, steep hill repeats to build power and running economy.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 1.5, pace: 'easy' },
        { type: 'hills', repeats: 8, workDurationSeconds: 60, effortMin: 85, effortMax: 95, notes: 'Jog down for recovery' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 85,
    targetEffortMax: 95,
    typicalDistanceMilesMin: 5,
    typicalDistanceMilesMax: 7,
    purpose: 'Builds leg strength, power, and running economy. Low-impact speed work.',
    progressionNotes: 'Start with 6 repeats, progress to 10-12. Can increase hill length over time.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'vo2max'
  },
  {
    id: 'long_hill_repeats',
    name: 'Long Hill Repeats',
    category: 'hills',
    phaseAppropriate: ['build'],
    description: 'Longer hill repeats (2-4 min) at threshold effort. Builds strength-endurance.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 1.5, pace: 'easy' },
        { type: 'hills', repeats: 5, workDurationMinutes: 3, effortMin: 82, effortMax: 88, notes: 'Threshold effort, jog down' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 82,
    targetEffortMax: 88,
    typicalDistanceMilesMin: 6,
    typicalDistanceMilesMax: 9,
    purpose: 'Combines threshold work with strength building. Excellent for hilly race courses.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'threshold'
  }
];

// ==================== Easy & Recovery Templates ====================

export const easyRecoveryTemplates: WorkoutTemplateDefinition[] = [
  {
    id: 'easy_run',
    name: 'Easy Run',
    category: 'easy',
    phaseAppropriate: ['base', 'build', 'peak', 'taper', 'recovery'],
    description: 'Comfortable, conversational pace. The foundation of any training program.',
    structure: {
      segments: [
        { type: 'steady', pace: 'easy', notes: '50-65% effort, fully conversational' }
      ]
    },
    targetEffortMin: 50,
    targetEffortMax: 65,
    typicalDistanceMilesMin: 3,
    typicalDistanceMilesMax: 8,
    purpose: 'Builds aerobic base, promotes recovery, accumulates mileage safely. Should feel easy!',
    isKeyWorkout: false,
    intensityLevel: 'easy'
  },
  {
    id: 'recovery_run',
    name: 'Recovery Run',
    category: 'recovery',
    phaseAppropriate: ['base', 'build', 'peak', 'taper', 'recovery'],
    description: 'Very easy jog the day after a hard workout or race. Active recovery.',
    structure: {
      segments: [
        { type: 'steady', pace: 'recovery', notes: '30-50% effort, embarrassingly slow is fine' }
      ]
    },
    targetEffortMin: 30,
    targetEffortMax: 50,
    typicalDistanceMilesMin: 2,
    typicalDistanceMilesMax: 5,
    purpose: 'Promotes blood flow for recovery without adding training stress. Keep it very easy.',
    isKeyWorkout: false,
    intensityLevel: 'easy'
  },
  {
    id: 'easy_run_strides',
    name: 'Easy Run with Strides',
    category: 'easy',
    phaseAppropriate: ['base', 'build', 'peak', 'taper'],
    description: 'Easy run followed by 4-6 short accelerations to maintain leg turnover.',
    structure: {
      segments: [
        { type: 'steady', pace: 'easy' },
        { type: 'strides', repeats: 5, workDurationSeconds: 20, effortMin: 85, effortMax: 90, restSeconds: 60 }
      ]
    },
    targetEffortMin: 50,
    targetEffortMax: 70,
    typicalDistanceMilesMin: 4,
    typicalDistanceMilesMax: 7,
    purpose: 'Maintains leg speed and neuromuscular coordination without fatigue. Great for taper weeks.',
    isKeyWorkout: false,
    intensityLevel: 'easy'
  },
  {
    id: 'general_aerobic',
    name: 'General Aerobic Run',
    category: 'easy',
    phaseAppropriate: ['base', 'build', 'peak'],
    description: 'Slightly faster than easy, but still comfortable. Upper end of aerobic zone.',
    structure: {
      segments: [
        { type: 'steady', pace: 'general_aerobic', notes: '60-70% effort, can speak in sentences' }
      ]
    },
    targetEffortMin: 60,
    targetEffortMax: 70,
    typicalDistanceMilesMin: 5,
    typicalDistanceMilesMax: 10,
    purpose: 'Builds mileage at a productive pace without high stress. Good for experienced runners.',
    isKeyWorkout: false,
    intensityLevel: 'easy'
  }
];

// ==================== Medium-Long Templates ====================

export const mediumLongTemplates: WorkoutTemplateDefinition[] = [
  {
    id: 'medium_long_run',
    name: 'Medium-Long Run',
    category: 'medium_long',
    phaseAppropriate: ['base', 'build', 'peak'],
    description: 'Midweek longer run that bridges easy runs and the weekend long run.',
    structure: {
      segments: [
        { type: 'steady', pace: 'easy', notes: '60-70% effort' }
      ]
    },
    targetEffortMin: 60,
    targetEffortMax: 70,
    typicalDistanceMilesMin: 10,
    typicalDistanceMilesMax: 15,
    purpose: 'Increases weekly volume, builds aerobic capacity, provides second endurance stimulus.',
    progressionNotes: 'Only needed when weekly mileage exceeds ~40 miles. Start at 10mi, build to 13-15mi.',
    isKeyWorkout: false,
    intensityLevel: 'moderate'
  },
  {
    id: 'medium_long_pickup',
    name: 'Medium-Long with Pickup',
    category: 'medium_long',
    phaseAppropriate: ['build', 'peak'],
    description: 'Medium-long run finishing with moderate effort miles. Not a full progression run.',
    structure: {
      segments: [
        { type: 'steady', percentage: 70, pace: 'easy' },
        { type: 'steady', percentage: 30, pace: 'general_aerobic', notes: 'Pick up to steady effort, not tempo' }
      ]
    },
    targetEffortMin: 60,
    targetEffortMax: 75,
    typicalDistanceMilesMin: 10,
    typicalDistanceMilesMax: 14,
    purpose: 'Adds gentle stimulus to a volume-building run. Teaches finishing with effort.',
    isKeyWorkout: false,
    intensityLevel: 'moderate'
  }
];

// ==================== Race-Specific Templates ====================

export const raceSpecificTemplates: WorkoutTemplateDefinition[] = [
  {
    id: 'marathon_pace_intervals',
    name: 'Marathon Pace Intervals',
    category: 'race_specific',
    phaseAppropriate: ['build', 'peak'],
    description: 'Repeated miles at marathon pace with short recovery. Accumulates MP volume.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'intervals', repeats: 5, workDistanceMiles: 1, pace: 'marathon', restMinutes: 1, restType: 'jog' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 75,
    targetEffortMax: 80,
    typicalDistanceMilesMin: 8,
    typicalDistanceMilesMax: 12,
    purpose: 'Locks in marathon pace. Builds confidence and muscle memory at goal pace.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'marathon'
  },
  {
    id: 'half_marathon_pace_workout',
    name: 'Half Marathon Pace Workout',
    category: 'race_specific',
    phaseAppropriate: ['build', 'peak'],
    description: 'Extended segments at half marathon pace. Key workout for half marathon preparation.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'intervals', repeats: 3, workDistanceMiles: 2, pace: 'half_marathon', restMinutes: 2, restType: 'jog' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 80,
    targetEffortMax: 85,
    typicalDistanceMilesMin: 9,
    typicalDistanceMilesMax: 12,
    purpose: 'Race-specific endurance for half marathon. Teaches sustained effort at goal pace.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'halfMarathon'
  },
  {
    id: 'goal_pace_tempo',
    name: 'Goal Pace Tempo',
    category: 'race_specific',
    phaseAppropriate: ['peak'],
    description: 'Continuous run at goal race pace. Final confirmation workout before race.',
    structure: {
      segments: [
        { type: 'warmup', distanceMiles: 2, pace: 'easy' },
        { type: 'work', distanceMiles: 4, notes: 'Exact goal race pace' },
        { type: 'cooldown', distanceMiles: 1, pace: 'easy' }
      ]
    },
    targetEffortMin: 75,
    targetEffortMax: 85,
    typicalDistanceMilesMin: 7,
    typicalDistanceMilesMax: 10,
    purpose: 'Final tune-up to confirm goal pace feels right. Do 10-14 days before race.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'marathon'
  },
  {
    id: 'cutdown_long_run',
    name: 'Cutdown Long Run',
    category: 'race_specific',
    phaseAppropriate: ['peak'],
    description: 'Long run where each segment gets progressively faster, ending at marathon pace or faster.',
    structure: {
      segments: [
        { type: 'steady', distanceMiles: 4, pace: 'easy_long' },
        { type: 'steady', distanceMiles: 4, pace: 'general_aerobic' },
        { type: 'steady', distanceMiles: 4, pace: 'marathon' },
        { type: 'steady', distanceMiles: 2, pace: 'half_marathon', notes: 'Optional finishing kick' }
      ]
    },
    targetEffortMin: 60,
    targetEffortMax: 85,
    typicalDistanceMilesMin: 14,
    typicalDistanceMilesMax: 18,
    purpose: 'Simulates race-day negative split. Builds confidence finishing strong on tired legs.',
    isKeyWorkout: true,
    intensityLevel: 'hard',
    paceZone: 'marathon'
  }
];

// ==================== All Templates Combined ====================

export const ALL_WORKOUT_TEMPLATES: WorkoutTemplateDefinition[] = [
  ...longRunTemplates,
  ...tempoTemplates,
  ...vo2maxTemplates,
  ...fartlekHillTemplates,
  ...easyRecoveryTemplates,
  ...mediumLongTemplates,
  ...raceSpecificTemplates,
];

/**
 * Get a template by ID
 */
export function getWorkoutTemplate(id: string): WorkoutTemplateDefinition | undefined {
  return ALL_WORKOUT_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates appropriate for a training phase
 */
export function getTemplatesForPhase(phase: TrainingPhase): WorkoutTemplateDefinition[] {
  return ALL_WORKOUT_TEMPLATES.filter(t =>
    t.phaseAppropriate.includes(phase)
  );
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): WorkoutTemplateDefinition[] {
  return ALL_WORKOUT_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get key (quality) workout templates
 */
export function getKeyWorkoutTemplates(): WorkoutTemplateDefinition[] {
  return ALL_WORKOUT_TEMPLATES.filter(t => t.isKeyWorkout);
}
