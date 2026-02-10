// Comprehensive Workout Template Library
// Combining ChatGPT coach templates with elite training methods from:
// - Renato Canova (Kipchoge's coach lineage)
// - Norwegian Method (Ingebrigtsen)
// - Brad Hudson
// - Joe Vigil
// - Alberto Salazar
// - Modern research-based approaches

export interface WorkoutTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  structure: string;
  targetPace: string;
  purpose: string[];
  physiologicalTarget: string;
  example?: string;
  variations?: string[];
  coachingNote?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  recoveryTime?: string;
}

export const COMPREHENSIVE_WORKOUT_LIBRARY: Record<string, WorkoutTemplate[]> = {
  // ===== LONG RUNS =====
  long_runs: [
    {
      id: 'easy_long',
      name: 'Easy Long Run',
      category: 'long_run',
      description: 'Traditional aerobic long run at conversational pace',
      structure: 'Continuous run at easy pace',
      targetPace: 'Easy (60-70% effort, MP + 60-90s)',
      purpose: ['Build aerobic base', 'Improve fat oxidation', 'Capillary development', 'Mental toughness'],
      physiologicalTarget: 'Aerobic capacity, mitochondrial density',
      difficulty: 'beginner',
      coachingNote: 'Focus on time on feet rather than pace'
    },
    {
      id: 'progression_long',
      name: 'Progression Long Run',
      category: 'long_run',
      description: 'Start easy and gradually increase pace throughout',
      structure: 'First 50% easy, next 30% moderate, final 20% at MP or faster',
      targetPace: 'Easy → Marathon pace → Threshold',
      purpose: ['Teach pacing discipline', 'Simulate race fatigue', 'Mental toughness'],
      physiologicalTarget: 'Aerobic capacity + lactate clearance',
      example: '18 miles: 10 easy, 5 moderate, 3 at MP',
      difficulty: 'intermediate'
    },
    {
      id: 'fast_finish_long',
      name: 'Fast Finish Long Run',
      category: 'long_run',
      description: 'Easy run with extended fast finish',
      structure: '70-80% easy, 20-30% at marathon pace or faster',
      targetPace: 'Easy → Marathon pace',
      purpose: ['Race simulation', 'Running fast on tired legs'],
      physiologicalTarget: 'Glycogen depletion training, fatigue resistance',
      example: '20 miles with last 6 at MP',
      difficulty: 'intermediate'
    },
    {
      id: 'alternating_long',
      name: 'Alternating Pace Long Run',
      category: 'long_run',
      description: 'Alternate between MP and easy pace every mile or two',
      structure: 'Alternate MP/Easy segments throughout',
      targetPace: 'Marathon pace / Easy pace',
      purpose: ['Pace control', 'Mental focus', 'Race rhythm'],
      physiologicalTarget: 'Lactate dynamics, pace awareness',
      example: '16 miles: alternating 2mi MP / 1mi easy',
      variations: ['1mi/1mi alternating', '3mi/1mi alternating'],
      difficulty: 'advanced',
      coachingNote: 'Very demanding - use sparingly'
    },
    {
      id: 'wave_tempo_long',
      name: 'Wave Tempo Long Run',
      category: 'long_run',
      description: 'Multiple tempo surges within a long run',
      structure: '3-4 tempo waves of 10-20 minutes with easy recovery',
      targetPace: 'Easy with HM-Tempo pace surges',
      purpose: ['Lactate clearance', 'Tempo endurance'],
      physiologicalTarget: 'Lactate threshold improvement within endurance context',
      example: '18 miles: 4mi easy + 3x(15min tempo/5min easy) + 2mi easy',
      difficulty: 'advanced'
    },
    {
      id: 'canova_special_long',
      name: 'Canova Special Block Long Run',
      category: 'long_run',
      description: 'Extended marathon-specific work within long run (Canova method)',
      structure: '30-32km total with 20-25km at 95-100% MP',
      targetPace: '90-95% of marathon pace',
      purpose: ['Marathon specific endurance', 'Glycogen depletion adaptation'],
      physiologicalTarget: 'Marathon-specific metabolic efficiency',
      example: '32km: 6km easy + 20km at MP + 6km easy',
      difficulty: 'elite',
      coachingNote: 'Use every 3-4 weeks in specific phase'
    },
    {
      id: 'kipchoge_long',
      name: 'Kipchoge-Style Long Run',
      category: 'long_run',
      description: 'High volume at fundamental endurance pace',
      structure: '30-40km at steady aerobic pace',
      targetPace: '15 km/h (6:26/mi) - Kipchoge\'s base pace',
      purpose: ['Aerobic development', 'Running economy'],
      physiologicalTarget: 'Mitochondrial biogenesis, capillarization',
      difficulty: 'elite',
      coachingNote: 'Focus on relaxation and efficiency'
    }
  ],

  // ===== TEMPO/THRESHOLD WORKOUTS =====
  tempo_threshold: [
    {
      id: 'classic_tempo',
      name: 'Classic Tempo Run',
      category: 'tempo',
      description: 'Continuous run at lactate threshold pace',
      structure: '20-40 minutes continuous at threshold pace',
      targetPace: 'Threshold pace (83-88% effort)',
      purpose: ['Improve lactate threshold', 'Mental toughness'],
      physiologicalTarget: 'Lactate threshold (LT2)',
      example: '2mi WU + 30min tempo + 2mi CD',
      difficulty: 'intermediate'
    },
    {
      id: 'tempo_intervals',
      name: 'Tempo Intervals (Cruise Intervals)',
      category: 'tempo',
      description: 'Broken tempo with short recoveries',
      structure: '3-6 x 5-10 minutes at threshold with 60-90s recovery',
      targetPace: 'Threshold pace',
      purpose: ['Accumulate more time at threshold', 'Easier mentally than continuous'],
      physiologicalTarget: 'Lactate threshold',
      example: '4 x 8min at T pace with 90s jog',
      variations: ['3 x 10min', '5 x 6min', '2 x 15min'],
      difficulty: 'intermediate'
    },
    {
      id: 'progressive_tempo',
      name: 'Progressive Tempo',
      category: 'tempo',
      description: 'Gradually increasing pace throughout',
      structure: 'Start at HM pace, progress to 10K pace',
      targetPace: 'HM pace → 10K pace',
      purpose: ['Pacing awareness', 'Mental toughness'],
      physiologicalTarget: 'Lactate threshold + VO2max bridge',
      example: '30min: 10min HM pace, 10min between HM-10K, 10min 10K pace',
      difficulty: 'advanced'
    },
    {
      id: 'norwegian_singles',
      name: 'Norwegian Singles Threshold',
      category: 'tempo',
      description: 'Single daily threshold session at controlled lactate',
      structure: '25-45 minutes at lactate 2.0-3.0 mmol/L',
      targetPace: 'Marathon pace to threshold (lactate controlled)',
      purpose: ['Precise threshold development', 'Aerobic power'],
      physiologicalTarget: 'Lactate steady state',
      example: '40min at 2.5 mmol/L lactate',
      difficulty: 'advanced',
      coachingNote: 'Requires lactate meter or very good pace awareness'
    },
    {
      id: 'norwegian_double',
      name: 'Norwegian Double Threshold',
      category: 'tempo',
      description: 'Two threshold sessions in one day',
      structure: 'AM: 6-10min intervals, PM: 3-5min intervals',
      targetPace: 'AM: MP-HMP (2.0-2.5 lactate), PM: 10K pace (3.0-4.0 lactate)',
      purpose: ['High threshold volume', 'Lactate dynamics'],
      physiologicalTarget: 'Maximized time at lactate threshold',
      example: 'AM: 5x6min/1min rest, PM: 8x3min/1min rest',
      difficulty: 'elite',
      recoveryTime: '48-72 hours'
    },
    {
      id: 'ingebrigtsen_threshold',
      name: 'Ingebrigtsen-Style Threshold',
      category: 'tempo',
      description: 'Slightly backed off threshold with minimal rest',
      structure: '4-5 x 2000m at 91-93% 10K pace with 1-2min walk',
      targetPace: 'Slightly slower than classic threshold',
      purpose: ['High volume threshold work', 'Lactate tolerance'],
      physiologicalTarget: 'Sub-threshold aerobic power',
      example: '5 x 2000m at HM+10s pace with 90s walk',
      difficulty: 'advanced'
    },
    {
      id: 'cutdown_tempo',
      name: 'Cutdown Tempo',
      category: 'tempo',
      description: 'Decreasing time/distance intervals at tempo pace',
      structure: 'Descending ladder at threshold pace',
      targetPace: 'Threshold pace throughout',
      purpose: ['Mental engagement', 'Maintain pace when tired'],
      physiologicalTarget: 'Lactate threshold',
      example: '12min-10min-8min-6min at T pace with 2min jog',
      difficulty: 'intermediate'
    },
    {
      id: 'canova_mod_fartlek',
      name: 'Canova Modified Fartlek',
      category: 'tempo',
      description: 'Continuous run alternating marathon and threshold paces',
      structure: 'Alternate MP and T pace without stopping',
      targetPace: 'Marathon pace / Threshold pace',
      purpose: ['Lactate dynamics', 'Pace variation'],
      physiologicalTarget: 'Lactate production and clearance',
      example: '60min: 5min MP/2min T pace throughout',
      difficulty: 'advanced'
    },
    {
      id: 'hudson_progression',
      name: 'Brad Hudson Progression',
      category: 'tempo',
      description: 'Multi-threshold progression run',
      structure: 'Progress through aerobic threshold → anaerobic threshold → 10K pace',
      targetPace: 'MP-20s → Threshold → 10K pace',
      purpose: ['Touch multiple systems', 'Race simulation'],
      physiologicalTarget: 'Full aerobic spectrum',
      example: '12mi: 4mi aerobic threshold, 4mi threshold, 4mi 10K pace',
      difficulty: 'elite'
    },
    {
      id: 'vigil_extended_tempo',
      name: 'Joe Vigil Extended Tempo',
      category: 'tempo',
      description: 'Very long tempo run at slightly slower pace',
      structure: 'Work up to 12 miles at tempo pace',
      targetPace: 'Threshold pace or slightly slower',
      purpose: ['Tempo endurance', 'Mental toughness'],
      physiologicalTarget: 'Lactate threshold endurance',
      example: '10-12 miles at threshold-10s/mi',
      difficulty: 'elite',
      coachingNote: 'Build up gradually over many weeks'
    }
  ],

  // ===== VO2MAX/SPEED WORKOUTS =====
  vo2max_speed: [
    {
      id: 'classic_vo2max',
      name: 'Classic VO2max Intervals',
      category: 'vo2max',
      description: 'Traditional 3-5 minute intervals at 5K pace',
      structure: '5-6 x 1000m or 4-5 x 1200m at 5K pace',
      targetPace: '5K race pace (90-95% max HR)',
      purpose: ['Increase VO2max', 'Improve oxygen uptake'],
      physiologicalTarget: 'Maximum oxygen uptake',
      example: '6 x 1000m at 5K pace with 2:30 recovery',
      recoveryTime: '50-90% of interval duration',
      difficulty: 'intermediate'
    },
    {
      id: 'short_intervals',
      name: 'Short Speed Intervals',
      category: 'speed',
      description: 'Fast repeats for speed and power',
      structure: '8-12 x 400m at 3K-5K pace',
      targetPace: 'Faster than 5K pace',
      purpose: ['Speed development', 'Running economy'],
      physiologicalTarget: 'Neuromuscular power, VO2max',
      example: '12 x 400m at 3K pace with 90s recovery',
      variations: ['200m reps', '300m reps', '600m reps'],
      difficulty: 'intermediate'
    },
    {
      id: 'ladder_workout',
      name: 'Ladder Workout',
      category: 'vo2max',
      description: 'Ascending and descending distances',
      structure: '400-800-1200-1600-1200-800-400',
      targetPace: 'Start at mile pace, progress to 10K pace for longer reps',
      purpose: ['Mental engagement', 'Pace variation'],
      physiologicalTarget: 'Multiple energy systems',
      example: '400-800-1200-800-400 at 5K pace with equal rest',
      difficulty: 'advanced'
    },
    {
      id: 'kenyan_diagonals',
      name: 'Kenyan Diagonals',
      category: 'speed',
      description: 'Fast diagonal runs across a field with jog recovery',
      structure: '15-20 x diagonal sprints (100-150m) with jog back',
      targetPace: '800m-1500m race pace',
      purpose: ['Speed endurance', 'Form improvement'],
      physiologicalTarget: 'Neuromuscular recruitment',
      difficulty: 'intermediate',
      coachingNote: 'Popular in Kenyan training camps'
    },
    {
      id: 'canova_speed_support',
      name: 'Canova Speed Support',
      category: 'vo2max',
      description: 'Fast intervals to support marathon specific work',
      structure: '8-12km of intervals at 108-115% MP (5K-10K pace)',
      targetPace: '5K-10K pace',
      purpose: ['Support marathon pace', 'Lactate power'],
      physiologicalTarget: 'VO2max and lactate buffering',
      example: '10 x 1000m at 10K+5s with 90s recovery',
      difficulty: 'advanced'
    },
    {
      id: 'critical_velocity_reps',
      name: 'Critical Velocity Repeats',
      category: 'vo2max',
      description: 'Work at the boundary between aerobic/anaerobic',
      structure: '4-6 x 3-4min at CV pace (between 10K-HM pace)',
      targetPace: 'Between 10K and HM pace',
      purpose: ['Improve lactate buffering', 'Race pace efficiency'],
      physiologicalTarget: 'Critical velocity/power',
      example: '5 x 1200m at 15K pace with 2min recovery',
      difficulty: 'advanced'
    },
    {
      id: 'norwegian_vo2max',
      name: 'Norwegian VO2max Session',
      category: 'vo2max',
      description: 'Controlled VO2max work with lactate monitoring',
      structure: '5-8 x 1000m at 4.0-6.0 mmol/L lactate',
      targetPace: 'Approximately 3K-5K pace',
      purpose: ['Precise VO2max stimulus', 'Avoid overtraining'],
      physiologicalTarget: 'VO2max with controlled intensity',
      difficulty: 'advanced',
      coachingNote: 'Adjust pace based on lactate or HR response'
    },
    {
      id: 'kipchoge_track_fartlek',
      name: 'Kipchoge-Style Track Fartlek',
      category: 'fartlek',
      description: 'Structured fartlek on track with varied paces',
      structure: 'Continuous 40-60min alternating paces every 1-2 laps',
      targetPace: 'Vary between MP and 5K pace',
      purpose: ['Pace variation', 'Mental engagement'],
      physiologicalTarget: 'Multiple energy systems',
      example: '1hr: alternate 1 lap hard (5K pace)/1 lap float (MP)',
      difficulty: 'advanced'
    }
  ],

  // ===== MARATHON/RACE SPECIFIC =====
  race_specific: [
    {
      id: 'marathon_pace_progression',
      name: 'Marathon Pace Progression',
      category: 'race_specific',
      description: 'Extended runs at goal marathon pace',
      structure: 'Build from 8 to 14-16 miles at MP over training cycle',
      targetPace: 'Goal marathon pace',
      purpose: ['Race pace familiarity', 'Fuel practice'],
      physiologicalTarget: 'Marathon specific endurance',
      example: 'Week 1: 8mi @ MP, Week 4: 12mi @ MP, Week 8: 16mi @ MP',
      difficulty: 'intermediate'
    },
    {
      id: 'simulator_run',
      name: 'Marathon Simulator',
      category: 'race_specific',
      description: 'Race simulation with majority at goal pace',
      structure: 'Up to 26km (60% of marathon) with 20km at MP',
      targetPace: 'Easy + Marathon pace',
      purpose: ['Race rehearsal', 'Confidence building'],
      physiologicalTarget: 'Marathon specific systems',
      example: '26km: 3km easy + 20km MP + 3km easy',
      difficulty: 'advanced',
      coachingNote: 'Peak workout 3-4 weeks before race'
    },
    {
      id: 'canova_specific_block',
      name: 'Canova Marathon Specific Block',
      category: 'race_specific',
      description: 'High volume marathon pace work',
      structure: '30-35km with 25-30km at 95-102% MP',
      targetPace: 'Marathon pace ± 5 sec/km',
      purpose: ['Marathon rhythm', 'Glycogen utilization'],
      physiologicalTarget: 'Marathon specific adaptations',
      example: '35km: 5km warm-up + 25km at MP + 5km cool-down',
      difficulty: 'elite',
      recoveryTime: '72+ hours'
    },
    {
      id: '2x_hm_pace',
      name: 'Half Marathon Pace Repeats',
      category: 'race_specific',
      description: 'Multiple segments at half marathon pace',
      structure: '2-3 x 4-5 miles at HMP with 3-4min recovery',
      targetPace: 'Half marathon pace',
      purpose: ['HM specific endurance', 'Lactate tolerance'],
      physiologicalTarget: 'Half marathon systems',
      example: '2 x 5 miles at HMP with 4min jog',
      difficulty: 'advanced'
    }
  ],

  // ===== HILL/STRENGTH WORKOUTS =====
  hills_strength: [
    {
      id: 'classic_hill_repeats',
      name: 'Classic Hill Repeats',
      category: 'hills',
      description: 'Short uphill sprints for power',
      structure: '6-12 x 60-90 seconds uphill hard',
      targetPace: '5K-3K effort',
      purpose: ['Leg strength', 'Running power', 'Form improvement'],
      physiologicalTarget: 'Neuromuscular power',
      example: '10 x 90s uphill with jog down recovery',
      difficulty: 'intermediate'
    },
    {
      id: 'kenyan_hills',
      name: 'Kenyan Hill Circuits',
      category: 'hills',
      description: 'Continuous hill circuits without stopping',
      structure: '30-45min continuous over hilly loop',
      targetPace: 'Moderate effort up, easy down',
      purpose: ['Strength endurance', 'Mental toughness'],
      physiologicalTarget: 'Muscular endurance',
      example: '40min over 2-3km hilly loop',
      difficulty: 'advanced'
    },
    {
      id: 'lydiard_hills',
      name: 'Lydiard Hill Springs',
      category: 'hills',
      description: 'Hill bounding and springing exercises',
      structure: 'Hill springs, bounds, and running uphill',
      targetPace: 'Focus on form, not speed',
      purpose: ['Leg strength', 'Running mechanics'],
      physiologicalTarget: 'Neuromuscular development',
      example: '20min hill circuit with various drills',
      difficulty: 'intermediate'
    }
  ],

  // ===== FARTLEK VARIATIONS =====
  fartlek: [
    {
      id: 'classic_fartlek',
      name: 'Classic Swedish Fartlek',
      category: 'fartlek',
      description: 'Unstructured speed play by feel',
      structure: '30-60min with random surges',
      targetPace: 'Varied - by feel',
      purpose: ['Mental break from structure', 'Intuitive pacing'],
      physiologicalTarget: 'Mixed energy systems',
      example: 'Surge at landmarks, recover as needed',
      difficulty: 'beginner'
    },
    {
      id: 'mona_fartlek',
      name: 'Mona Fartlek',
      category: 'fartlek',
      description: 'Structured fartlek with specific intervals',
      structure: '2x90s, 4x60s, 4x30s, 4x15s with equal recovery',
      targetPace: '5K, 3K, mile, 800m paces respectively',
      purpose: ['Speed development', 'Lactate tolerance'],
      physiologicalTarget: 'Multiple energy systems',
      difficulty: 'advanced'
    },
    {
      id: 'deek_workout',
      name: 'Deek\'s Quarters',
      category: 'fartlek',
      description: 'Australian fartlek variation',
      structure: '8x400m with 200m float recovery (not jog)',
      targetPace: '3K pace for fast, marathon pace for float',
      purpose: ['Speed endurance', 'Lactate clearance'],
      physiologicalTarget: 'VO2max with lactate dynamics',
      difficulty: 'advanced'
    }
  ],

  // ===== RECOVERY/EASY RUNS =====
  recovery: [
    {
      id: 'recovery_run',
      name: 'Recovery Run',
      category: 'recovery',
      description: 'Very easy run for active recovery',
      structure: '20-45min at recovery pace',
      targetPace: '2-3 min/mi slower than MP',
      purpose: ['Promote blood flow', 'Active recovery'],
      physiologicalTarget: 'Recovery enhancement',
      difficulty: 'beginner',
      coachingNote: 'Should feel refreshed after, not tired'
    },
    {
      id: 'recovery_plus_strides',
      name: 'Recovery + Strides',
      category: 'recovery',
      description: 'Easy run with neuromuscular strides',
      structure: 'Easy run + 4-6 x 100m strides',
      targetPace: 'Easy pace, strides at mile pace',
      purpose: ['Recovery', 'Maintain neuromuscular fitness'],
      physiologicalTarget: 'Recovery + neural activation',
      example: '30min easy + 6x100m strides',
      difficulty: 'beginner'
    },
    {
      id: 'double_recovery',
      name: 'Double Recovery Day',
      category: 'recovery',
      description: 'Two short easy runs (doubles)',
      structure: 'AM: 20-30min easy, PM: 20-30min easy',
      targetPace: 'Very easy pace',
      purpose: ['Increase volume safely', 'Enhanced recovery'],
      physiologicalTarget: 'Aerobic maintenance',
      difficulty: 'intermediate',
      coachingNote: 'Common in high-mileage programs'
    }
  ]
};

// Helper function to get workouts by difficulty
export function getWorkoutsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced' | 'elite') {
  const workouts: WorkoutTemplate[] = [];

  Object.values(COMPREHENSIVE_WORKOUT_LIBRARY).forEach(category => {
    workouts.push(...category.filter(w => w.difficulty === difficulty));
  });

  return workouts;
}

// Helper function to get workouts by physiological target
export function getWorkoutsByTarget(target: string) {
  const workouts: WorkoutTemplate[] = [];

  Object.values(COMPREHENSIVE_WORKOUT_LIBRARY).forEach(category => {
    workouts.push(...category.filter(w =>
      w.physiologicalTarget.toLowerCase().includes(target.toLowerCase())
    ));
  });

  return workouts;
}

// Helper function to build a balanced week
export function buildBalancedWeek(
  weeklyMileage: number,
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | 'elite',
  targetRace: 'marathon' | 'half' | '10k' | '5k'
) {
  // Logic to create a balanced training week based on parameters
  // This would select appropriate workouts from the library
  // Implementation would consider:
  // - 1 long run
  // - 1-2 quality sessions
  // - Recovery runs
  // - Rest days

  return {
    monday: 'recovery',
    tuesday: 'tempo',
    wednesday: 'easy',
    thursday: 'vo2max',
    friday: 'recovery',
    saturday: 'long_run',
    sunday: 'easy'
  };
}