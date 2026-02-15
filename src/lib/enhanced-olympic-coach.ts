
// Enhanced with your ChatGPT coach methodology
export class EnhancedOlympicCoach {
  // Your coaching philosophies as expertise modules
  private readonly COACHING_PHILOSOPHIES = {
    lydiard: {
      name: 'Arthur Lydiard',
      focus: 'Massive aerobic base through high mileage',
      strengths: ['Endurance development', 'Hill training', 'Base building'],
      limitations: ['High injury risk', 'Time consuming'],
      bestFor: ['Marathon', 'Experienced runners']
    },
    pfitzinger: {
      name: 'Pete Pfitzinger',
      focus: 'Structured progression with periodization',
      strengths: ['Lactate threshold', 'VO2 max', 'Systematic approach'],
      limitations: ['High mileage demands', 'Less flexible'],
      bestFor: ['Competitive runners', 'PR seekers']
    },
    daniels: {
      name: 'Jack Daniels',
      focus: 'VDOT-based precision training',
      strengths: ['Personalized pacing', 'Data-driven', 'Clear zones'],
      limitations: ['Requires accurate fitness assessment', 'Can be rigid'],
      bestFor: ['All levels', 'Data-oriented runners']
    },
    hansons: {
      name: 'Hansons Marathon Method',
      focus: 'Cumulative fatigue with shorter long runs',
      strengths: ['Race simulation', 'Consistent quality', 'Time efficient'],
      limitations: ['Mentally challenging', 'May lack confidence from shorter long runs'],
      bestFor: ['Marathon', 'Time-constrained runners']
    },
    mcmillan: {
      name: 'Greg McMillan',
      focus: 'Personalized zones and individual adaptation',
      strengths: ['Flexibility', 'Individual differences', 'Energy system focus'],
      limitations: ['Requires self-awareness', 'Complex for beginners'],
      bestFor: ['All levels', 'Self-coached runners']
    },
    fitzgerald: {
      name: 'Matt Fitzgerald 80/20',
      focus: 'Polarized training distribution',
      strengths: ['Injury prevention', 'Sustainable', 'Clear guidelines'],
      limitations: ['May be too rigid for some', 'Defining "easy" can be difficult'],
      bestFor: ['All levels', 'Injury-prone runners']
    }
  };

  // Your comprehensive workout library
  private readonly WORKOUT_TEMPLATES = {
    long_runs: {
      easy_long: {
        description: 'Entire run at comfortable pace for pure endurance',
        pace: 'Easy (60-70% effort)',
        purpose: 'Build endurance, improve fat utilization',
        progression: 'Increase distance by 1-2 miles every 2 weeks'
      },
      progression_long: {
        description: 'Start easy, pick up pace throughout, finish at marathon pace',
        pace: 'Easy → Marathon pace',
        purpose: 'Simulate race fatigue, mental toughness',
        progression: 'Increase fast finish portion'
      },
      marathon_pace_long: {
        description: 'Insert MP segments within longer run',
        pace: 'Easy with MP segments',
        purpose: 'Race-specific endurance',
        example: '20 miles: 5 easy + 10 MP + 5 easy',
        progression: 'Increase MP portion'
      },
      alternating_pace_long: {
        description: 'Alternate between MP and easy every 1-2 miles',
        pace: 'Alternating MP/Easy',
        purpose: 'Pace control, mental focus',
        caution: 'Very challenging - for advanced runners'
      }
    },
    tempo_workouts: {
      steady_tempo: {
        description: 'Continuous run at comfortably hard effort',
        pace: '78-88% effort (between 10K-HM pace)',
        duration: '20-40 minutes',
        purpose: 'Improve lactate threshold'
      },
      tempo_intervals: {
        description: 'Broken tempo with short recoveries',
        example: '3 x 2 miles at tempo with 90s jog',
        purpose: 'Accumulate more time at threshold',
        recovery: '60-90 seconds easy jog'
      },
      progressive_tempo: {
        description: 'Start moderate, finish near threshold',
        pace: 'HM pace → 10K pace',
        purpose: 'Teach pacing, build strength'
      }
    },
    vo2max_workouts: {
      short_intervals: {
        description: '200-400m repeats at 5K pace or faster',
        recovery: 'Equal time or distance jog',
        purpose: 'Improve speed and VO2max',
        example: '12 x 400m @ 5K pace'
      },
      long_intervals: {
        description: '800-1600m repeats at 5K-10K pace',
        recovery: '50-90% interval duration',
        purpose: 'VO2max and speed endurance',
        example: '5 x 1000m @ 5K pace'
      },
      ladder_workout: {
        description: 'Varying distances up and down',
        example: '400-800-1200-800-400 @ 5K pace',
        purpose: 'Mental engagement, varied stimulus'
      }
    }
  };

  // Your pacing zones with nuanced understanding
  private readonly PACING_ZONES = [
    { name: 'Recovery', effort: '30-50%', purpose: 'Active recovery', feel: 'Very easy jog' },
    { name: 'Easy', effort: '50-60%', purpose: 'Aerobic development', feel: 'Conversational' },
    { name: 'General Aerobic', effort: '60-70%', purpose: 'Base building', feel: 'Comfortable' },
    { name: 'Marathon Pace', effort: '70-80%', purpose: 'Race specific', feel: 'Controlled effort' },
    { name: 'Half Marathon', effort: '78-85%', purpose: 'Sustained speed', feel: 'Comfortably hard' },
    { name: 'Tempo/Threshold', effort: '82-88%', purpose: 'Lactate threshold', feel: 'Hard but controlled' },
    { name: '10K Pace', effort: '85-88%', purpose: 'Speed endurance', feel: 'Hard' },
    { name: '5K Pace', effort: '88-92%', purpose: 'VO2max', feel: 'Very hard' },
    { name: 'VO2max', effort: '90-95%', purpose: 'Max aerobic power', feel: 'Near max' },
    { name: '1 Mile', effort: '94-98%', purpose: 'Speed/power', feel: 'Almost all out' },
    { name: 'Sprint', effort: '100%', purpose: 'Neuromuscular', feel: 'All out' }
  ];

  // Feedback loop system from your prompt
  async collectWorkoutFeedback(workoutId: number, feedback: {
    feel: 'Easy' | 'Moderate' | 'Hard' | 'Very Hard';
    completedDistance: boolean;
    completedPace: boolean;
    soreness: 1 | 2 | 3 | 4 | 5;
    energyLevel: 'High' | 'Moderate' | 'Low';
    satisfaction: 'Very Satisfied' | 'Satisfied' | 'Neutral' | 'Dissatisfied' | 'Very Dissatisfied';
    externalFactors?: string;
  }) {
    // Store feedback and adjust future workouts
    const adjustment = this.calculateAdjustment(feedback);
    return {
      adjustment,
      recommendation: this.getRecommendation(feedback, adjustment)
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateAdjustment(feedback: any) {
    let adjustmentFactor = 0;

    // High fatigue/soreness = reduce intensity
    if (feedback.soreness >= 4) adjustmentFactor -= 0.15;
    if (feedback.energyLevel === 'Low') adjustmentFactor -= 0.10;
    if (feedback.feel === 'Very Hard' && feedback.satisfaction !== 'Very Satisfied') adjustmentFactor -= 0.10;

    // Feeling too easy = increase challenge
    if (feedback.feel === 'Easy' && feedback.satisfaction === 'Neutral') adjustmentFactor += 0.10;
    if (feedback.soreness === 1 && feedback.energyLevel === 'High') adjustmentFactor += 0.05;

    return adjustmentFactor;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getRecommendation(feedback: any, adjustment: number) {
    if (adjustment < -0.15) {
      return 'Consider an extra rest day or easy run. Your body needs recovery.';
    } else if (adjustment < 0) {
      return 'Reduce intensity or mileage slightly in the next workout.';
    } else if (adjustment > 0.10) {
      return 'You can handle more! Consider adding pace or distance to your next quality session.';
    }
    return 'Stay the course - your training is on track!';
  }

  // Plan aggressiveness from your prompt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  getTrainingPlan(aggressiveness: 'Conservative' | 'Moderate' | 'Aggressive', _context: any) {
    const plans = {
      Conservative: {
        qualitySessions: 1,
        easyHardRatio: '90/10',
        mileageIncrease: '5% weekly',
        downWeeks: 'Every 3 weeks',
        injuryRisk: 'Low'
      },
      Moderate: {
        qualitySessions: 2,
        easyHardRatio: '80/20',
        mileageIncrease: '7-10% weekly',
        downWeeks: 'Every 4 weeks',
        injuryRisk: 'Moderate'
      },
      Aggressive: {
        qualitySessions: 3,
        easyHardRatio: '70/30',
        mileageIncrease: '10-15% weekly',
        downWeeks: 'Every 4-5 weeks',
        injuryRisk: 'Higher - requires experience'
      }
    };

    return plans[aggressiveness];
  }

  // Mid-block race handling from your prompt
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleMidBlockRace(raceType: 'Primary' | 'Secondary' | 'Tertiary', _raceDistance: string) {
    const strategies = {
      Primary: {
        taper: '2-3 weeks full taper',
        postRace: 'Easy week, reassess goals',
        trainingAdjustment: 'Major - new training block'
      },
      Secondary: {
        taper: '3-5 days mini-taper',
        postRace: '2-3 easy days',
        trainingAdjustment: 'Minor - resume normal training'
      },
      Tertiary: {
        taper: 'No taper - treat as workout',
        postRace: '1 easy day',
        trainingAdjustment: 'None - continue as planned'
      }
    };

    return strategies[raceType];
  }
}