// Advanced and Creative Workout Variations
// Unique templates from various sources and innovative approaches

import { WorkoutTemplate } from './comprehensive-library';

export const ADVANCED_WORKOUT_VARIATIONS: Record<string, WorkoutTemplate[]> = {
  // ===== HYBRID/COMBINATION WORKOUTS =====
  hybrid_workouts: [
    {
      id: 'oregon_30_40',
      name: 'Oregon 30-40s',
      category: 'hybrid',
      description: 'Alternating short speed with threshold',
      structure: 'Alternate 30s hard/30s easy for 20min, then 40s hard/20s easy for 10min',
      targetPace: '3K pace for hard, easy jog for recovery',
      purpose: ['Speed endurance', 'Lactate tolerance'],
      physiologicalTarget: 'VO2max + lactate dynamics',
      difficulty: 'advanced',
      coachingNote: 'Developed at University of Oregon'
    },
    {
      id: 'michigan_workout',
      name: 'Michigan Workout',
      category: 'hybrid',
      description: 'Combines tempo with speed in one session',
      structure: '1600m + 1200m + 800m + 400m with decreasing rest',
      targetPace: 'Start at tempo, finish at 5K pace',
      purpose: ['Multi-pace training', 'Race preparation'],
      physiologicalTarget: 'Full spectrum aerobic power',
      example: 'Rest: 3min, 2min, 90s between reps',
      difficulty: 'advanced'
    },
    {
      id: 'aussie_quarters',
      name: 'Australian Quarters',
      category: 'hybrid',
      description: 'Continuous 400m reps with pace variation',
      structure: '16-20 x 400m alternating ON/OFF',
      targetPace: 'ON: 5K pace, OFF: Marathon pace',
      purpose: ['Lactate clearance', 'Pace control'],
      physiologicalTarget: 'Lactate threshold with speed',
      example: 'No stopping - continuous for 16-20 laps',
      difficulty: 'advanced'
    },
    {
      id: 'kenyan_progression_fartlek',
      name: 'Kenyan Progression Fartlek',
      category: 'hybrid',
      description: 'Fartlek with systematically increasing speed',
      structure: '1min-2min-3min-4min-3min-2min-1min pyramid',
      targetPace: 'Start at HM pace, peak at 3K pace',
      purpose: ['Progressive fatigue', 'Mental toughness'],
      physiologicalTarget: 'Progressive lactate accumulation',
      example: '2min recovery between all intervals',
      difficulty: 'advanced'
    }
  ],

  // ===== LACTATE DYNAMICS WORKOUTS =====
  lactate_dynamics: [
    {
      id: 'lactate_stacker',
      name: 'Lactate Stacker',
      category: 'lactate',
      description: 'Progressive lactate accumulation workout',
      structure: '1000m-800m-600m-400m-200m with minimal rest',
      targetPace: 'All at 5K pace',
      purpose: ['Lactate tolerance', 'Mental toughness'],
      physiologicalTarget: 'Maximum lactate accumulation',
      recoveryTime: '30-45 seconds only',
      difficulty: 'advanced',
      coachingNote: 'Expect significant lactate buildup'
    },
    {
      id: 'lactate_waves',
      name: 'Lactate Wave Intervals',
      category: 'lactate',
      description: 'Alternating lactate production and clearance',
      structure: '6 x (3min hard + 3min moderate)',
      targetPace: 'Hard: 5K pace, Moderate: Marathon pace',
      purpose: ['Lactate shuttling', 'Metabolic flexibility'],
      physiologicalTarget: 'Lactate production and clearance',
      difficulty: 'advanced',
      coachingNote: 'No stopping between segments'
    },
    {
      id: 'float_recovery_1000s',
      name: 'Float Recovery 1000s',
      category: 'lactate',
      description: 'VO2max intervals with active recovery',
      structure: '5-6 x 1000m with 400m float recovery',
      targetPace: '1000m at 5K pace, 400m at threshold pace',
      purpose: ['VO2max with lactate clearance'],
      physiologicalTarget: 'Aerobic power with lactate dynamics',
      difficulty: 'elite',
      coachingNote: 'Recovery is NOT easy - it\'s at threshold!'
    }
  ],

  // ===== TIME-BASED WORKOUTS =====
  time_based: [
    {
      id: 'minute_intervals',
      name: 'Descending Time Intervals',
      category: 'time_based',
      description: 'Decreasing duration with increasing pace',
      structure: '5min-4min-3min-2min-1min',
      targetPace: 'HM-10K-5K-3K-Mile pace progression',
      purpose: ['Multi-pace exposure', 'Mental engagement'],
      physiologicalTarget: 'Progressive energy system recruitment',
      recoveryTime: 'Half the interval duration',
      difficulty: 'advanced'
    },
    {
      id: 'time_ladder',
      name: 'Time Ladder Workout',
      category: 'time_based',
      description: 'Up and down time-based ladder',
      structure: '1-2-3-4-3-2-1 minutes',
      targetPace: '5K pace throughout',
      purpose: ['VO2max development', 'Mental toughness'],
      physiologicalTarget: 'VO2max with varied duration',
      recoveryTime: 'Equal to interval duration',
      difficulty: 'intermediate'
    },
    {
      id: 'marathon_minutes',
      name: 'Marathon Pace Minutes',
      category: 'time_based',
      description: 'Accumulating time at marathon pace',
      structure: '6-8 x 5 minutes at MP',
      targetPace: 'Goal marathon pace',
      purpose: ['Marathon rhythm', 'Aerobic threshold'],
      physiologicalTarget: 'Marathon specific endurance',
      recoveryTime: '60-90 seconds easy jog',
      difficulty: 'intermediate',
      coachingNote: 'Focus on relaxation and efficiency'
    }
  ],

  // ===== BIOMECHANICAL/FORM FOCUSED =====
  form_focused: [
    {
      id: 'tempo_strides',
      name: 'Tempo with Embedded Strides',
      category: 'form',
      description: 'Tempo run with form-focused surges',
      structure: '30min tempo with 30s stride every 5min',
      targetPace: 'Tempo at threshold, strides at mile pace',
      purpose: ['Form under fatigue', 'Neuromuscular recruitment'],
      physiologicalTarget: 'Threshold + neuromuscular',
      difficulty: 'advanced',
      coachingNote: 'Focus on maintaining form during strides'
    },
    {
      id: 'downhill_reps',
      name: 'Controlled Downhill Repeats',
      category: 'form',
      description: 'Fast but controlled downhill running',
      structure: '6-8 x 200m on 2-3% decline',
      targetPace: 'Faster than 5K pace but controlled',
      purpose: ['Leg turnover', 'Eccentric strength'],
      physiologicalTarget: 'Neuromuscular + eccentric loading',
      difficulty: 'advanced',
      coachingNote: 'Requires appropriate hill - not too steep'
    },
    {
      id: 'cadence_builders',
      name: 'Cadence Building Intervals',
      category: 'form',
      description: 'Focus on increasing step rate',
      structure: '10 x 1min focusing on cadence',
      targetPace: '10K pace with 5% higher cadence',
      purpose: ['Improve running economy', 'Reduce overstriding'],
      physiologicalTarget: 'Neuromuscular efficiency',
      recoveryTime: '1 minute easy with normal cadence',
      difficulty: 'intermediate',
      coachingNote: 'Use metronome or watch for cadence'
    }
  ],

  // ===== MENTAL TOUGHNESS BUILDERS =====
  mental_builders: [
    {
      id: 'negative_split_20',
      name: 'Negative Split 20-Miler',
      category: 'mental',
      description: 'Classic marathon confidence builder',
      structure: '20 miles: first 10 easy, second 10 at MP',
      targetPace: 'Easy pace → Marathon pace',
      purpose: ['Mental confidence', 'Pacing discipline'],
      physiologicalTarget: 'Marathon specific endurance',
      difficulty: 'advanced',
      coachingNote: 'Requires extreme discipline in first half'
    },
    {
      id: 'mile_repeat_marathon',
      name: 'Mile Repeat Marathon',
      category: 'mental',
      description: '26 x 1 mile at varying paces',
      structure: 'Alternate MP and MP+30s for 26 miles',
      targetPace: 'Marathon pace / Easy pace',
      purpose: ['Mental segmentation', 'Marathon rehearsal'],
      physiologicalTarget: 'Marathon endurance',
      difficulty: 'elite',
      coachingNote: 'Mental practice for breaking up the marathon'
    },
    {
      id: 'last_set_best_set',
      name: 'Last Set Best Set',
      category: 'mental',
      description: 'Save fastest effort for final rep',
      structure: 'Any interval workout - fastest on last rep',
      targetPace: 'Progressive effort throughout',
      purpose: ['Mental toughness', 'Closing speed'],
      physiologicalTarget: 'Varies based on workout',
      difficulty: 'intermediate',
      coachingNote: 'Teaches racing mentality'
    }
  ],

  // ===== RACE SIMULATION =====
  race_simulation: [
    {
      id: 'broken_tempo_race_sim',
      name: 'Broken Tempo Race Simulation',
      category: 'race_sim',
      description: 'Simulate race with planned "breaks"',
      structure: '3 x 5K at goal HM pace with 2min rest',
      targetPace: 'Goal half marathon pace',
      purpose: ['Race pace practice', 'Mental segments'],
      physiologicalTarget: 'Half marathon specific',
      difficulty: 'advanced',
      coachingNote: 'Mimics water station breaks'
    },
    {
      id: 'marathon_race_rehearsal',
      name: 'Marathon Race Day Rehearsal',
      category: 'race_sim',
      description: 'Full race simulation including nutrition',
      structure: '2.5-3 hours at marathon effort with race nutrition',
      targetPace: '10-15 sec/mi slower than goal MP',
      purpose: ['Full dress rehearsal', 'Nutrition practice'],
      physiologicalTarget: 'Marathon systems + fueling',
      difficulty: 'advanced',
      coachingNote: '3-4 weeks before race, full race morning routine'
    },
    {
      id: 'surge_and_settle',
      name: 'Surge and Settle Race Practice',
      category: 'race_sim',
      description: 'Practice surging and returning to pace',
      structure: '10mi with 30s surges every mile',
      targetPace: 'HM pace with surges to 10K pace',
      purpose: ['Race tactics', 'Pace control after surging'],
      physiologicalTarget: 'Lactate dynamics',
      difficulty: 'advanced',
      coachingNote: 'Teaches responding to race moves'
    }
  ],

  // ===== UNIQUE/CREATIVE WORKOUTS =====
  creative: [
    {
      id: 'palindrome_workout',
      name: 'Palindrome Intervals',
      category: 'creative',
      description: 'Same forward and backward',
      structure: '400-800-1200-1600-1200-800-400',
      targetPace: 'All at 10K pace',
      purpose: ['Mental engagement', 'Sustained quality'],
      physiologicalTarget: 'Lactate threshold + VO2max',
      recoveryTime: '60-90 seconds between all',
      difficulty: 'advanced'
    },
    {
      id: 'odds_and_evens',
      name: 'Odds and Evens Fartlek',
      category: 'creative',
      description: 'Odd minutes hard, even minutes easy',
      structure: '30-40 minutes alternating by minute',
      targetPace: 'Hard minutes at 5K-10K pace',
      purpose: ['Time awareness', 'Rhythm development'],
      physiologicalTarget: 'Mixed aerobic/anaerobic',
      difficulty: 'intermediate'
    },
    {
      id: 'heartrate_capped_tempo',
      name: 'Heart Rate Capped Tempo',
      category: 'creative',
      description: 'Tempo limited by HR not pace',
      structure: '30-40min at 85-88% max HR',
      targetPace: 'Whatever pace maintains target HR',
      purpose: ['Internal load management', 'Body awareness'],
      physiologicalTarget: 'Aerobic threshold',
      difficulty: 'intermediate',
      coachingNote: 'Pace will vary with fatigue/conditions'
    },
    {
      id: 'breakfast_club_special',
      name: 'Breakfast Club Special',
      category: 'creative',
      description: 'Long warmup into quality work',
      structure: '10mi easy + 6 x 1mi at 10K pace',
      targetPace: 'Easy pace then 10K pace',
      purpose: ['Running fast when tired', 'Mental toughness'],
      physiologicalTarget: 'Glycogen depletion training',
      difficulty: 'elite',
      coachingNote: 'Mimics late race fatigue'
    }
  ]
};