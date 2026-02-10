// Intelligent Workout Selector
// Chooses appropriate workouts based on athlete context and training phase

import { WorkoutTemplate, COMPREHENSIVE_WORKOUT_LIBRARY } from './comprehensive-library';
import { ADVANCED_WORKOUT_VARIATIONS } from './advanced-variations';

interface AthleteContext {
  currentWeek: number;
  totalWeeks: number;
  phase: 'base' | 'build' | 'peak' | 'taper' | 'recovery';
  weeklyMileage: number;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  targetRace: 'marathon' | 'half' | '10k' | '5k';
  recentWorkouts: Array<{
    type: string;
    daysAgo: number;
    difficulty: number; // 1-10
    recovery: boolean;
  }>;
  injuryRisk: 'low' | 'moderate' | 'high';
  preferredWorkoutTypes?: string[];
  environmentalFactors?: {
    temperature?: number;
    humidity?: number;
    altitude?: number;
    surface?: 'track' | 'road' | 'trail';
  };
  upcomingRaces?: Array<{
    daysUntil: number;
    priority: 'A' | 'B' | 'C';
  }>;
}

export class IntelligentWorkoutSelector {
  private allWorkouts: WorkoutTemplate[];

  constructor() {
    // Combine all workouts from both libraries
    this.allWorkouts = [
      ...Object.values(COMPREHENSIVE_WORKOUT_LIBRARY).flat(),
      ...Object.values(ADVANCED_WORKOUT_VARIATIONS).flat()
    ];
  }

  // Main method to get workout recommendation
  selectWorkout(context: AthleteContext, workoutType: 'long' | 'tempo' | 'speed' | 'recovery' | 'any'): {
    primary: WorkoutTemplate;
    alternatives: WorkoutTemplate[];
    reasoning: string[];
    modifications?: string[];
  } {
    // Filter workouts by type and athlete level
    let candidates = this.filterByTypeAndLevel(workoutType, context.fitnessLevel);

    // Apply phase-specific filtering
    candidates = this.filterByTrainingPhase(candidates, context.phase, context.currentWeek, context.totalWeeks);

    // Consider recent training load
    candidates = this.filterByRecentTraining(candidates, context.recentWorkouts);

    // Adjust for injury risk
    candidates = this.adjustForInjuryRisk(candidates, context.injuryRisk);

    // Consider environmental factors
    if (context.environmentalFactors) {
      candidates = this.adjustForEnvironment(candidates, context.environmentalFactors);
    }

    // Score and rank candidates
    const scoredWorkouts = this.scoreWorkouts(candidates, context);

    // Get top workout and alternatives
    const primary = scoredWorkouts[0];
    const alternatives = scoredWorkouts.slice(1, 4);

    // Generate reasoning
    const reasoning = this.generateReasoning(primary, context);

    // Generate modifications if needed
    const modifications = this.generateModifications(primary, context);

    return {
      primary,
      alternatives,
      reasoning,
      modifications
    };
  }

  // Get a full week of workouts
  buildWeeklyPlan(context: AthleteContext): {
    [day: string]: {
      workout: WorkoutTemplate | 'rest';
      duration: number;
      notes: string;
    };
  } {
    const week: any = {};
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Determine key workout days based on phase and preferences
    const keyWorkoutDays = this.determineKeyWorkoutDays(context);

    daysOfWeek.forEach((day, index) => {
      if (keyWorkoutDays.restDays.includes(index)) {
        week[day] = {
          workout: 'rest',
          duration: 0,
          notes: 'Complete rest or optional cross-training'
        };
      } else if (keyWorkoutDays.longRunDay === index) {
        const longRun = this.selectWorkout(context, 'long');
        week[day] = {
          workout: longRun.primary,
          duration: this.estimateDuration(longRun.primary, context),
          notes: longRun.modifications ? longRun.modifications.join('; ') : ''
        };
      } else if (keyWorkoutDays.qualityDays.includes(index)) {
        const workoutType = this.getQualityWorkoutType(context, keyWorkoutDays.qualityDays.indexOf(index));
        const quality = this.selectWorkout(context, workoutType as any);
        week[day] = {
          workout: quality.primary,
          duration: this.estimateDuration(quality.primary, context),
          notes: quality.modifications ? quality.modifications.join('; ') : ''
        };
      } else {
        // Easy/recovery day
        const easy = this.selectWorkout(context, 'recovery');
        week[day] = {
          workout: easy.primary,
          duration: this.estimateDuration(easy.primary, context),
          notes: 'Keep truly easy'
        };
      }
    });

    return week;
  }

  // Private helper methods
  private filterByTypeAndLevel(type: string, level: string): WorkoutTemplate[] {
    return this.allWorkouts.filter(w => {
      const typeMatch = type === 'any' || w.category.includes(type) ||
                       (type === 'tempo' && w.category.includes('threshold')) ||
                       (type === 'speed' && (w.category.includes('vo2max') || w.category.includes('interval')));

      const levelMatch = this.isAppropriateLevel(w.difficulty, level);

      return typeMatch && levelMatch;
    });
  }

  private isAppropriateLevel(workoutDifficulty: string, athleteLevel: string): boolean {
    const levels = ['beginner', 'intermediate', 'advanced', 'elite'];
    const workoutIndex = levels.indexOf(workoutDifficulty);
    const athleteIndex = levels.indexOf(athleteLevel);

    // Allow workouts at or below athlete's level, plus one level up
    return workoutIndex <= athleteIndex + 1;
  }

  private filterByTrainingPhase(
    workouts: WorkoutTemplate[],
    phase: string,
    currentWeek: number,
    totalWeeks: number
  ): WorkoutTemplate[] {
    const percentComplete = currentWeek / totalWeeks;

    return workouts.filter(w => {
      switch (phase) {
        case 'base':
          // Prefer easier, longer workouts
          return !w.name.includes('VO2max') && !w.name.includes('Critical');

        case 'build':
          // All workouts appropriate
          return true;

        case 'peak':
          // Prefer race-specific and higher intensity
          return w.category.includes('race_specific') ||
                 w.category.includes('vo2max') ||
                 w.name.includes('Marathon Pace') ||
                 percentComplete > 0.7;

        case 'taper':
          // Reduce volume, maintain some intensity
          return !w.name.includes('Long') || w.name.includes('Easy');

        default:
          return true;
      }
    });
  }

  private filterByRecentTraining(workouts: WorkoutTemplate[], recent: any[]): WorkoutTemplate[] {
    // Avoid similar hard workouts too close together
    const recentHardWorkouts = recent.filter(w => w.difficulty > 7 && w.daysAgo < 3);

    if (recentHardWorkouts.length > 0) {
      // Filter out very hard workouts
      return workouts.filter(w => w.difficulty !== 'elite');
    }

    return workouts;
  }

  private adjustForInjuryRisk(workouts: WorkoutTemplate[], risk: string): WorkoutTemplate[] {
    if (risk === 'high') {
      // Avoid high-impact, high-intensity workouts
      return workouts.filter(w =>
        !w.name.includes('Hill') &&
        !w.name.includes('Sprint') &&
        w.difficulty !== 'elite'
      );
    } else if (risk === 'moderate') {
      // Limit very hard workouts
      return workouts.filter(w => w.difficulty !== 'elite');
    }

    return workouts;
  }

  private adjustForEnvironment(workouts: WorkoutTemplate[], env: any): WorkoutTemplate[] {
    if (env.temperature && env.temperature > 75) {
      // Avoid very long or very hard workouts in heat
      return workouts.filter(w =>
        !w.name.includes('Extended') &&
        !w.name.includes('Marathon Simulator')
      );
    }

    if (env.surface === 'trail') {
      // Prefer time-based workouts on trails
      return workouts.filter(w => w.category.includes('time') || w.category.includes('fartlek'));
    }

    return workouts;
  }

  private scoreWorkouts(workouts: WorkoutTemplate[], context: AthleteContext): WorkoutTemplate[] {
    return workouts.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Score based on phase appropriateness
      scoreA += this.getPhaseScore(a, context.phase);
      scoreB += this.getPhaseScore(b, context.phase);

      // Score based on recent training variety
      scoreA += this.getVarietyScore(a, context.recentWorkouts);
      scoreB += this.getVarietyScore(b, context.recentWorkouts);

      // Score based on race specificity
      scoreA += this.getRaceSpecificityScore(a, context.targetRace);
      scoreB += this.getRaceSpecificityScore(b, context.targetRace);

      return scoreB - scoreA;
    });
  }

  private getPhaseScore(workout: WorkoutTemplate, phase: string): number {
    // Scoring logic based on phase
    switch (phase) {
      case 'base':
        if (workout.category.includes('long') || workout.category.includes('easy')) return 10;
        if (workout.category.includes('tempo')) return 5;
        return 0;

      case 'build':
        if (workout.category.includes('tempo') || workout.category.includes('threshold')) return 10;
        if (workout.category.includes('vo2max')) return 7;
        return 5;

      case 'peak':
        if (workout.category.includes('race_specific')) return 10;
        if (workout.category.includes('vo2max')) return 8;
        return 5;

      default:
        return 5;
    }
  }

  private getVarietyScore(workout: WorkoutTemplate, recent: any[]): number {
    // Higher score for workouts different from recent ones
    const recentCategories = recent.map(w => w.type);
    if (!recentCategories.includes(workout.category)) {
      return 5;
    }
    return 0;
  }

  private getRaceSpecificityScore(workout: WorkoutTemplate, targetRace: string): number {
    if (targetRace === 'marathon' && workout.name.includes('Marathon')) return 10;
    if (targetRace === 'half' && workout.name.includes('Half')) return 10;
    if (targetRace === '10k' && workout.targetPace.includes('10K')) return 8;
    if (targetRace === '5k' && workout.targetPace.includes('5K')) return 8;
    return 0;
  }

  private generateReasoning(workout: WorkoutTemplate, context: AthleteContext): string[] {
    const reasons = [];

    // Phase-based reasoning
    reasons.push(`Appropriate for ${context.phase} phase (week ${context.currentWeek}/${context.totalWeeks})`);

    // Fitness level reasoning
    if (workout.difficulty === context.fitnessLevel) {
      reasons.push(`Matches your ${context.fitnessLevel} fitness level`);
    }

    // Purpose reasoning
    if (workout.purpose.length > 0) {
      reasons.push(`Targets: ${workout.purpose.slice(0, 2).join(', ')}`);
    }

    // Recent training reasoning
    if (context.recentWorkouts.filter(w => w.recovery).length > 2) {
      reasons.push('Good timing after recent recovery focus');
    }

    return reasons;
  }

  private generateModifications(workout: WorkoutTemplate, context: AthleteContext): string[] {
    const mods = [];

    // Adjust for weekly mileage
    if (context.weeklyMileage < 30 && workout.structure.includes('20')) {
      mods.push('Reduce total distance by 20-30%');
    }

    // Adjust for injury risk
    if (context.injuryRisk !== 'low') {
      mods.push('Add extra warmup and cooldown');
      mods.push('Be willing to cut workout short if needed');
    }

    // Environmental adjustments
    if (context.environmentalFactors?.temperature && context.environmentalFactors.temperature > 70) {
      mods.push('Adjust paces 5-10 seconds slower per mile');
      mods.push('Take hydration');
    }

    return mods;
  }

  private determineKeyWorkoutDays(context: AthleteContext) {
    // Logic to determine which days should be key workouts
    // This is simplified - real implementation would be more complex
    return {
      longRunDay: 6, // Saturday
      qualityDays: [2, 4], // Tuesday, Thursday
      restDays: context.fitnessLevel === 'beginner' ? [0, 5] : [0] // Monday, maybe Friday
    };
  }

  private getQualityWorkoutType(context: AthleteContext, index: number): string {
    // Determine what type of quality workout based on phase and index
    if (context.phase === 'base') {
      return index === 0 ? 'tempo' : 'fartlek';
    } else if (context.phase === 'build') {
      return index === 0 ? 'tempo' : 'speed';
    } else if (context.phase === 'peak') {
      return index === 0 ? 'race_specific' : 'speed';
    }
    return 'tempo';
  }

  private estimateDuration(workout: WorkoutTemplate, context: AthleteContext): number {
    // Estimate workout duration in minutes
    if (workout.category.includes('long')) {
      return 90 + (context.fitnessLevel === 'elite' ? 60 : 0);
    } else if (workout.category.includes('tempo')) {
      return 60;
    } else if (workout.category.includes('speed')) {
      return 75;
    } else if (workout.category.includes('recovery')) {
      return 40;
    }
    return 60;
  }
}