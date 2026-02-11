/**
 * Plan Builder System
 *
 * Generates rough workout templates 2+ weeks out, then refines them
 * based on runner state, fatigue, and performance as the date approaches.
 */

import { addDays, startOfWeek, format } from 'date-fns';

export interface WorkoutTemplate {
  date: string;
  dayOfWeek: string;
  workoutType: 'easy' | 'tempo' | 'interval' | 'long_run' | 'recovery' | 'rest' | 'race';
  primaryFocus: string;
  estimatedMinutes: number;
  flexibility: 'fixed' | 'moderate' | 'high'; // How much can this be adapted
  priority: number; // 1-5, higher = more important to keep
  notes?: string;
}

export interface WeekTemplate {
  weekNumber: number;
  theme: string;
  totalMileage: number;
  keyWorkouts: number;
  workouts: WorkoutTemplate[];
}

export interface TrainingBlock {
  startDate: string;
  endDate: string;
  phase: 'base' | 'build' | 'peak' | 'taper' | 'recovery';
  weeks: WeekTemplate[];
}

export class PlanBuilder {
  /**
   * Generate a 2-week training block based on phase and goals
   */
  generateTwoWeekBlock(
    startDate: Date,
    phase: string,
    targetRace: { date: string; distance: string },
    currentWeeklyMileage: number,
    preferences?: {
      longRunDay?: string;
      hardWorkoutDays?: string[];
      restDay?: string;
    }
  ): TrainingBlock {
    const weekOne = this.generateWeekTemplate(
      1,
      startDate,
      phase,
      currentWeeklyMileage,
      preferences
    );

    const weekTwo = this.generateWeekTemplate(
      2,
      addDays(startDate, 7),
      phase,
      currentWeeklyMileage * 1.05, // 5% progression
      preferences
    );

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(addDays(startDate, 13), 'yyyy-MM-dd'),
      phase: phase as TrainingBlock['phase'],
      weeks: [weekOne, weekTwo]
    };
  }

  /**
   * Generate a single week template
   */
  private generateWeekTemplate(
    weekNumber: number,
    startDate: Date,
    phase: string,
    weeklyMileage: number,
    preferences?: any
  ): WeekTemplate {
    const workouts: WorkoutTemplate[] = [];
    const weekStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday start

    // Default workout distribution based on phase
    const templates = this.getPhaseTemplates(phase);

    // Distribute workouts across the week
    for (let day = 0; day < 7; day++) {
      const date = addDays(weekStart, day);
      const dayName = format(date, 'EEEE');

      // Check preferences for this day
      const workout = this.assignWorkoutForDay(
        dayName,
        templates,
        phase,
        weeklyMileage,
        preferences
      );

      workouts.push({
        date: format(date, 'yyyy-MM-dd'),
        dayOfWeek: dayName,
        ...workout
      });
    }

    return {
      weekNumber,
      theme: this.getWeekTheme(phase, weekNumber),
      totalMileage: weeklyMileage,
      keyWorkouts: workouts.filter(w => ['tempo', 'interval', 'long_run'].includes(w.workoutType)).length,
      workouts
    };
  }

  /**
   * Get workout templates based on training phase
   */
  private getPhaseTemplates(phase: string) {
    const templates = {
      base: {
        workoutDistribution: {
          Monday: { type: 'easy', minutes: 45, priority: 3 },
          Tuesday: { type: 'easy', minutes: 60, priority: 3 },
          Wednesday: { type: 'tempo', minutes: 50, priority: 5 },
          Thursday: { type: 'recovery', minutes: 30, priority: 2 },
          Friday: { type: 'easy', minutes: 45, priority: 3 },
          Saturday: { type: 'long_run', minutes: 90, priority: 5 },
          Sunday: { type: 'rest', minutes: 0, priority: 4 }
        }
      },
      build: {
        workoutDistribution: {
          Monday: { type: 'recovery', minutes: 30, priority: 2 },
          Tuesday: { type: 'interval', minutes: 60, priority: 5 },
          Wednesday: { type: 'easy', minutes: 50, priority: 3 },
          Thursday: { type: 'tempo', minutes: 60, priority: 4 },
          Friday: { type: 'recovery', minutes: 30, priority: 2 },
          Saturday: { type: 'long_run', minutes: 110, priority: 5 },
          Sunday: { type: 'easy', minutes: 45, priority: 3 }
        }
      },
      peak: {
        workoutDistribution: {
          Monday: { type: 'recovery', minutes: 30, priority: 2 },
          Tuesday: { type: 'interval', minutes: 70, priority: 5 },
          Wednesday: { type: 'easy', minutes: 45, priority: 2 },
          Thursday: { type: 'tempo', minutes: 65, priority: 5 },
          Friday: { type: 'rest', minutes: 0, priority: 3 },
          Saturday: { type: 'easy', minutes: 40, priority: 2 },
          Sunday: { type: 'long_run', minutes: 120, priority: 5 }
        }
      },
      taper: {
        workoutDistribution: {
          Monday: { type: 'recovery', minutes: 25, priority: 2 },
          Tuesday: { type: 'interval', minutes: 45, priority: 4 },
          Wednesday: { type: 'easy', minutes: 35, priority: 2 },
          Thursday: { type: 'easy', minutes: 30, priority: 2 },
          Friday: { type: 'rest', minutes: 0, priority: 4 },
          Saturday: { type: 'easy', minutes: 20, priority: 2 },
          Sunday: { type: 'race', minutes: 120, priority: 5 }
        }
      }
    };

    return templates[phase as keyof typeof templates] || templates.base;
  }

  /**
   * Assign workout for a specific day based on preferences
   */
  private assignWorkoutForDay(
    dayName: string,
    templates: any,
    phase: string,
    weeklyMileage: number,
    preferences?: any
  ) {
    const defaultWorkout = templates.workoutDistribution[dayName];

    // Override with preferences if provided
    if (preferences?.longRunDay === dayName) {
      return {
        workoutType: 'long_run' as const,
        primaryFocus: 'Endurance building',
        estimatedMinutes: Math.round(weeklyMileage * 0.25 * 8), // 25% of weekly mileage
        flexibility: 'moderate' as const,
        priority: 5
      };
    }

    if (preferences?.restDay === dayName) {
      return {
        workoutType: 'rest' as const,
        primaryFocus: 'Recovery',
        estimatedMinutes: 0,
        flexibility: 'fixed' as const,
        priority: 4
      };
    }

    // Return default with proper typing
    return {
      workoutType: defaultWorkout.type as WorkoutTemplate['workoutType'],
      primaryFocus: this.getFocusForWorkoutType(defaultWorkout.type),
      estimatedMinutes: defaultWorkout.minutes,
      flexibility: this.getFlexibilityForPhase(phase, defaultWorkout.type),
      priority: defaultWorkout.priority
    };
  }

  private getFocusForWorkoutType(type: string): string {
    const focusMap: Record<string, string> = {
      easy: 'Aerobic development',
      tempo: 'Lactate threshold',
      interval: 'VO2 max / Speed',
      long_run: 'Endurance building',
      recovery: 'Active recovery',
      rest: 'Full recovery',
      race: 'Race performance'
    };
    return focusMap[type] || 'General fitness';
  }

  private getFlexibilityForPhase(phase: string, workoutType: string): WorkoutTemplate['flexibility'] {
    if (workoutType === 'race') return 'fixed';
    if (phase === 'taper') return 'moderate';
    if (['tempo', 'interval'].includes(workoutType)) return 'moderate';
    return 'high';
  }

  private getWeekTheme(phase: string, weekNumber: number): string {
    const themes = {
      base: ['Building foundation', 'Increasing volume'],
      build: ['Quality focus', 'Pushing limits'],
      peak: ['Race-specific work', 'Sharpening'],
      taper: ['Freshening up', 'Race ready']
    };

    const phaseThemes = themes[phase as keyof typeof themes] || themes.base;
    return phaseThemes[(weekNumber - 1) % phaseThemes.length];
  }
}

/**
 * Refine a workout based on current runner state
 */
export function refineWorkout(
  template: WorkoutTemplate,
  runnerState: any,
  daysOut: number
): WorkoutTemplate {
  // The closer to the workout date, the more specific we get
  if (daysOut > 7) {
    // Still rough, just return template
    return template;
  }

  if (daysOut > 3) {
    // Start to refine based on recent performance
    return {
      ...template,
      notes: 'Check fatigue levels 2 days before'
    };
  }

  // Within 3 days - make specific adjustments
  if (runnerState.fatigueLevelTrend === 'accumulating') {
    return {
      ...template,
      estimatedMinutes: Math.round(template.estimatedMinutes * 0.8),
      notes: 'Reduced volume due to fatigue accumulation'
    };
  }

  return template;
}