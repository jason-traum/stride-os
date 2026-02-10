// Demonstration: How the workout prescription adapts to different runners

export const WORKOUT_PRESCRIPTION_EXAMPLES = {
  // Example 1: Beginner Runner (Sarah, 35, VDOT 35, 15 mpw)
  beginner: {
    input: {
      workout_type: 'tempo',
      weekly_mileage: 15,
      preference: 'simple'
    },
    output: {
      workout_name: 'Basic Tempo Run',
      structure: '10min warmup + 20min at comfortably hard pace + 10min cooldown',
      target_paces: 'Comfortably hard - you can speak in short sentences',
      total_distance: '4-5 miles total',
      coach_notes: 'I\'ve selected a straightforward Basic Tempo Run for you. This workout is designed to be effective without being complicated. If you can chat easily, speed up. If you can\'t speak at all, slow down.'
    }
  },

  // Example 2: Intermediate Runner (Mike, 42, VDOT 48, 35 mpw)
  intermediate: {
    input: {
      workout_type: 'tempo',
      weekly_mileage: 35,
      preference: 'auto'
    },
    output: {
      workout_name: 'Tempo Intervals (Cruise Intervals)',
      structure: '4 x 8min at threshold with 90s jog recovery',
      target_paces: 'Threshold pace: 7:15/mi (based on VDOT 48)',
      total_distance: '7-8 miles including warmup/cooldown',
      coach_notes: 'Based on your intermediate fitness level and build training phase, I\'ve prescribed Tempo Intervals. Breaking the tempo into intervals allows you to accumulate more time at threshold pace while making it mentally easier.',
      alternatives: [
        { name: 'Progressive Tempo', reason: 'Teaches pacing discipline' },
        { name: 'Classic Tempo Run', reason: 'Simpler continuous option' }
      ]
    }
  },

  // Example 3: Advanced Runner (Jessica, 28, VDOT 58, 55 mpw, Boston Qualifier)
  advanced: {
    input: {
      workout_type: 'tempo',
      weekly_mileage: 55,
      preference: 'advanced',
      phase: 'peak'
    },
    output: {
      workout_name: 'Norwegian Double Threshold',
      structure: 'AM: 5x6min at marathon pace with 1min rest, PM: 8x3min at 10K pace with 1min rest',
      target_paces: 'AM: 6:45/mi (MP), PM: 6:05/mi (10K pace)',
      total_distance: 'AM: 8 miles, PM: 6 miles',
      coach_notes: 'You\'re in peak phase with 55 miles per week - perfect timing for a Norwegian Double Threshold day. This advanced workout maximizes time at threshold through two sessions.',
      modifications: ['Can do as single session if needed: combine AM + PM with 3hr rest', 'Monitor fatigue closely - skip PM if legs are heavy'],
      template_source: 'norwegian_double'
    }
  },

  // Example 4: Elite Runner (David, 24, VDOT 70, 85 mpw, Sub-2:20 marathoner)
  elite: {
    input: {
      workout_type: 'long_run',
      weekly_mileage: 85,
      phase: 'peak',
      target_distance: 'marathon'
    },
    output: {
      workout_name: 'Canova Special Block Long Run',
      structure: '32km: 6km easy + 20km at 95-100% marathon pace + 6km easy',
      target_paces: 'Easy: 6:30/mi, Marathon pace: 5:20/mi',
      total_distance: '20 miles (32km)',
      purpose: ['Marathon specific endurance', 'Glycogen depletion adaptation', 'Mental toughness'],
      coach_notes: 'This is a key workout 3-4 weeks out from your marathon. The extended time at race pace with depleted glycogen mimics the final 10K of the marathon. This is what Kipchoge uses.',
      physiological_focus: 'Marathon-specific metabolic efficiency',
      recovery_time: '72+ hours before next quality session'
    }
  },

  // Example 5: Casual Runner who just wants to stay fit (Tom, 50, runs 3x/week)
  casual: {
    input: {
      workout_type: 'any',
      preference: 'simple',
      weekly_mileage: 12
    },
    output: {
      workout_name: 'Coffee Run',
      structure: 'Easy run to/from your favorite coffee shop',
      target_paces: 'Social pace - whatever feels good',
      total_distance: '3-4 miles',
      coach_notes: 'I\'ve selected a Coffee Run for you - a perfect way to combine exercise with your daily routine. Running doesn\'t always have to be "training" - sometimes it\'s just about moving and enjoying yourself!',
      alternatives: [
        { name: 'Podcast Run', reason: 'Makes time fly while building fitness' },
        { name: 'Exploration Run', reason: 'Discover new routes in your area' }
      ]
    }
  },

  // Example 6: Returning from injury (Amy, 30, coming back from IT band)
  injury_return: {
    input: {
      workout_type: 'tempo',
      injury_risk: 'high',
      preference: 'simple'
    },
    output: {
      workout_name: 'Feel-Good Tempo',
      structure: '15-20 minutes at smooth and controlled effort',
      target_paces: 'Fast but relaxed - could hold for an hour',
      total_distance: '4-5 miles total',
      modifications: [
        'Add 10min extra warmup with dynamic stretches',
        'Stop immediately if any IT band discomfort',
        'Consider doing on soft surface or treadmill',
        'Can break into 2x10min if needed'
      ],
      coach_notes: 'Coming back from injury, we\'re using a Feel-Good Tempo - fast enough to feel like quality work but controlled enough to be safe. This should leave you feeling confident, not exhausted.'
    }
  },

  // Example 7: Time-crunched parent (Lisa, 38, can only run early morning)
  time_crunched: {
    input: {
      workout_type: 'speed',
      available_time: 45,
      preference: 'auto'
    },
    output: {
      workout_name: 'Time-Efficient VO2max',
      structure: '5min warmup + 6x2min hard/1min easy + 5min cooldown',
      target_paces: 'Hard intervals at 5K effort',
      total_distance: '4-5 miles in 45 minutes',
      coach_notes: 'With only 45 minutes, this efficient workout packs a punch. The 2-minute intervals are perfect for building speed without requiring a long session. You\'ll be done before the kids wake up!',
      time_saving_tips: [
        'Warm up on the way to your workout spot',
        'Use effort-based pacing to skip GPS fiddling',
        'Cool down can be walking back home'
      ]
    }
  }
};

// Show how the system adapts workouts
export const ADAPTATION_EXAMPLES = {
  // Same workout request, different contexts
  tempo_variations: {
    beginner: 'Basic Tempo: 20min continuous',
    intermediate: 'Tempo Intervals: 3x10min',
    advanced: 'Progressive Tempo: HM→10K pace',
    elite: 'Norwegian Double Threshold: AM/PM sessions'
  },

  // Environmental adaptations
  hot_weather_mods: {
    original: '6x1000m at 5K pace',
    adapted: '6x1000m at 5K pace + 10s/mi, extra 30s recovery, hydration required'
  },

  // Phase-specific selections
  phase_appropriate: {
    base: 'Focus on easy long runs and basic tempo',
    build: 'Add VO2max intervals and race-pace work',
    peak: 'Race-specific workouts and simulations',
    taper: 'Maintain intensity, reduce volume 40%'
  }
};