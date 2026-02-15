/**
 * Detailed Window Generator - Layer 2 of the coaching architecture
 *
 * Generates specific daily workouts for next 2-3 weeks based on:
 * - Master plan weekly targets
 * - User profile and preferences
 * - Recent training history
 * - Coaching knowledge base
 */

import { getCoachingKnowledge } from './coach-knowledge';
import { MasterPlan, WeeklyTarget } from './master-plan';
import { addDays, format } from 'date-fns';

export interface DetailedWorkout {
  date: string;
  dayOfWeek: string;
  workoutType: string;
  name: string;
  description: string;
  structure: string;
  warmup: string;
  mainSet: string;
  cooldown: string;
  targetPaces: Record<string, string>;
  estimatedMinutes: number;
  totalMiles: number;
  purpose: string;
  coachNotes: string;
  alternatives?: string[];
  weatherConsiderations?: string;
}

export interface UserProfile {
  vdot: number;
  paces: {
    easy: string;
    marathon: string;
    threshold: string;
    interval: string;
    repetition: string;
  };
  preferredDays?: string[];
  restDays?: string[];
  longRunDay?: string;
  currentMileage: number;
  injuryHistory?: string[];
  comfortLevels?: {
    hills: 'avoid' | 'moderate' | 'love';
    heat: 'struggle' | 'manage' | 'thrive';
    track: 'intimidated' | 'comfortable' | 'love';
  };
}

export interface RecentHistory {
  workouts: Array<{
    date: string;
    type: string;
    distance: number;
    avgPace: string;
    verdict?: string;
    rpe?: number;
  }>;
  assessments: Array<{
    date: string;
    sleep: number;
    stress: number;
    soreness: number;
    motivation: number;
  }>;
  ctl: number; // Chronic Training Load
  atl: number; // Acute Training Load
  tsb: number; // Training Stress Balance
}

export class DetailedWindowGenerator {
  /**
   * Generate detailed workouts for the next 2-3 weeks
   */
  async generateDetailedWindow(params: {
    masterPlan: MasterPlan;
    userProfile: UserProfile;
    recentHistory: RecentHistory;
    windowWeeks?: 2 | 3;
    currentDate?: Date;
  }): Promise<DetailedWorkout[]> {
    const windowWeeks = params.windowWeeks || 3;
    const startDate = params.currentDate || new Date();
    const workouts: DetailedWorkout[] = [];

    // Get relevant coaching knowledge
    const workoutLibrary = JSON.parse(getCoachingKnowledge('workout_library'));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _workoutPrescriptions = getCoachingKnowledge('workout_prescriptions');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _periodizationKnowledge = getCoachingKnowledge('periodization');

    // Get the weekly targets for the window
    const relevantWeeks = this.getRelevantWeeklyTargets(
      params.masterPlan,
      startDate,
      windowWeeks
    );

    // For each week in the window
    for (const weekTarget of relevantWeeks) {
      const weekWorkouts = this.generateWeekWorkouts(
        weekTarget,
        params.userProfile,
        params.recentHistory,
        workoutLibrary,
        params.masterPlan
      );
      workouts.push(...weekWorkouts);
    }

    // Apply final adjustments based on recent performance
    return this.applyPerformanceAdjustments(workouts, params.recentHistory);
  }

  /**
   * Get the weekly targets that fall within our window
   */
  private getRelevantWeeklyTargets(
    masterPlan: MasterPlan,
    startDate: Date,
    windowWeeks: number
  ): WeeklyTarget[] {
    const endDate = addDays(startDate, windowWeeks * 7);

    return masterPlan.weeklyTargets.filter(week => {
      const weekStart = new Date(week.weekStartDate);
      return weekStart >= startDate && weekStart < endDate;
    });
  }

  /**
   * Generate specific workouts for a week based on targets
   */
  private generateWeekWorkouts(
    weekTarget: WeeklyTarget,
    profile: UserProfile,
    history: RecentHistory,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workoutLibrary: any,
    masterPlan: MasterPlan
  ): DetailedWorkout[] {
    const workouts: DetailedWorkout[] = [];
    const weekStart = new Date(weekTarget.weekStartDate);

    // Get the current phase
    const currentPhase = this.getCurrentPhase(masterPlan, weekStart);

    // Plan the week structure
    const weekStructure = this.planWeekStructure(
      weekTarget,
      profile,
      currentPhase.name
    );

    // Generate each day's workout
    for (let day = 0; day < 7; day++) {
      const workoutDate = addDays(weekStart, day);
      const dayName = format(workoutDate, 'EEEE');
      const plannedType = weekStructure[_dayName];

      if (plannedType === 'rest') {
        workouts.push(this.createRestDay(workoutDate, dayName));
      } else {
        const workout = this.createDetailedWorkout(
          workoutDate,
          dayName,
          plannedType,
          profile,
          workoutLibrary,
          weekTarget,
          currentPhase.name,
          history
        );
        workouts.push(workout);
      }
    }

    return workouts;
  }

  /**
   * Plan the structure of a training week
   */
  private planWeekStructure(
    weekTarget: WeeklyTarget,
    profile: UserProfile,
    phase: string
  ): Record<string, string> {
    const structure: Record<string, string> = {};

    // Start with rest days
    const restDays = profile.restDays || ['Sunday'];
    restDays.forEach(day => {
      structure[day] = 'rest';
    });

    // Place long run
    const longRunDay = profile.longRunDay || 'Saturday';
    structure[longRunDay] = 'long_run';

    // Place quality sessions based on phase and target
    const qualityDays = this.selectQualityDays(
      profile.preferredDays || ['Tuesday', 'Thursday'],
      Object.keys(structure)
    );

    if (weekTarget.qualitySessions >= 1) {
      structure[qualityDays[0]] = this.getQualityType1(_phase);
    }
    if (weekTarget.qualitySessions >= 2 && qualityDays[1]) {
      structure[qualityDays[1]] = this.getQualityType2(phase);
    }

    // Fill remaining days with easy runs
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach(day => {
      if (!structure[day]) {
        structure[day] = 'easy';
      }
    });

    return structure;
  }

  /**
   * Create a detailed workout based on type and context
   */
  private createDetailedWorkout(
    date: Date,
    dayName: string,
    workoutType: string,
    profile: UserProfile,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workoutLibrary: any,
    weekTarget: WeeklyTarget,
    phase: string,
    history: RecentHistory
  ): DetailedWorkout {
    // Get base workout from library
    const libraryWorkouts = workoutLibrary[workoutType] || workoutLibrary['easy'];
    const baseWorkout = this.selectWorkoutFromLibrary(
      libraryWorkouts,
      profile,
      phase,
      history
    );

    // Calculate distances based on weekly target
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { totalMiles, _distribution } = this.calculateDailyMileage(
      workoutType,
      weekTarget,
      dayName
    );

    // Get target paces with adjustments
    const targetPaces = this.calculateTargetPaces(
      workoutType,
      profile.paces,
      history,
      phase
    );

    // Build the detailed workout
    return {
      date: format(date, 'yyyy-MM-dd'),
      dayOfWeek: dayName,
      workoutType,
      name: baseWorkout.name,
      description: this.personalizeDescription(baseWorkout.description, profile, phase),
      structure: baseWorkout.structure,
      warmup: baseWorkout.warmup || '10-15 min easy jog + dynamic stretches',
      mainSet: this.buildMainSet(baseWorkout, totalMiles, targetPaces),
      cooldown: baseWorkout.cooldown || '10 min easy jog + static stretches',
      targetPaces,
      estimatedMinutes: this.estimateWorkoutDuration(totalMiles, workoutType, targetPaces),
      totalMiles,
      purpose: baseWorkout.purpose || this.getWorkoutPurpose(workoutType, phase),
      coachNotes: this.generateCoachNotes(workoutType, history, profile, phase),
      alternatives: this.generateAlternatives(workoutType, totalMiles),
      weatherConsiderations: this.getWeatherConsiderations(workoutType)
    };
  }

  /**
   * Select appropriate workout from library based on context
   */
  private selectWorkoutFromLibrary(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    libraryWorkouts: any[],
    profile: UserProfile,
    phase: string,
    history: RecentHistory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    // Filter workouts appropriate for current fitness
    const appropriateWorkouts = libraryWorkouts.filter(workout => {
      if (workout.level === 'beginner' && profile.vdot > 50) return false;
      if (workout.level === 'advanced' && profile.vdot < 45) return false;
      if (workout.phase && !workout.phase.includes(phase)) return false;
      return true;
    });

    // Avoid recent workout types
    const recentTypes = history.workouts
      .slice(-7)
      .map(w => w.type)
      .filter(t => t !== 'easy');

    const novelWorkouts = appropriateWorkouts.filter(
      w => !recentTypes.includes(w.specificType)
    );

    // Select workout
    const candidates = novelWorkouts.length > 0 ? novelWorkouts : appropriateWorkouts;
    return candidates[Math.floor(Math.random() * candidates.length)] || appropriateWorkouts[0];
  }

  /**
   * Calculate target paces with adjustments
   */
  private calculateTargetPaces(
    workoutType: string,
    basePaces: UserProfile['_paces'],
    history: RecentHistory,
    phase: string
  ): Record<string, string> {
    const paces = { ...basePaces };

    // Adjust based on TSB (Training Stress Balance)
    if (history.tsb < -20) {
      // Very fatigued - slow all paces by 5-10 sec/mile
      Object.keys(paces).forEach(key => {
        paces[key as keyof typeof paces] = this.adjustPace(paces[key as keyof typeof paces], 10);
      });
    } else if (history.tsb < -10) {
      // Moderately fatigued - slow by 5 sec/mile
      Object.keys(paces).forEach(key => {
        paces[key as keyof typeof paces] = this.adjustPace(paces[key as keyof typeof paces], 5);
      });
    }

    // Phase-specific adjustments
    if (phase === 'base') {
      // Keep paces conservative in base
      paces.threshold = this.adjustPace(paces.threshold, 5);
      paces.interval = this.adjustPace(paces.interval, 5);
    } else if (phase === 'taper') {
      // Can hit full paces in taper
      // No adjustment needed
    }

    return paces;
  }

  /**
   * Helper functions
   */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getCurrentPhase(masterPlan: MasterPlan, date: Date): any {
    const dateStr = format(date, 'yyyy-MM-dd');
    return masterPlan.phases.find(phase =>
      dateStr >= phase.startDate && dateStr <= phase.endDate
    ) || masterPlan.phases[0];
  }

  private selectQualityDays(preferredDays: string[], occupiedDays: string[]): string[] {
    const available = preferredDays.filter(day => !occupiedDays.includes(day));
    if (available.length >= 2) return available.slice(0, 2);

    // Fall back to Tuesday/Thursday if preferences don't work
    const fallbacks = ['Tuesday', 'Thursday', 'Wednesday'].filter(
      day => !occupiedDays.includes(day)
    );
    return [...available, ...fallbacks].slice(0, 2);
  }

  private getQualityType1(phase: string): string {
    const phaseWorkouts: Record<string, string> = {
      base: 'tempo',
      build: 'tempo',
      peak: 'race_pace',
      taper: 'race_pace'
    };
    return phaseWorkouts[phase] || 'tempo';
  }

  private getQualityType2(phase: string): string {
    const phaseWorkouts: Record<string, string> = {
      base: 'fartlek',
      build: 'interval',
      peak: 'interval',
      taper: 'strides'
    };
    return phaseWorkouts[phase] || 'interval';
  }

  private createRestDay(date: Date, dayName: string): DetailedWorkout {
    return {
      date: format(date, 'yyyy-MM-dd'),
      dayOfWeek: dayName,
      workoutType: 'rest',
      name: 'Rest Day',
      description: 'Complete rest or light cross-training',
      structure: 'No running',
      warmup: '',
      mainSet: '',
      cooldown: '',
      targetPaces: {},
      estimatedMinutes: 0,
      totalMiles: 0,
      purpose: 'Recovery and adaptation',
      coachNotes: 'Listen to your body. Light yoga or walking is fine if you feel good.',
      alternatives: ['30 min easy bike', '20 min swim', 'Yoga session']
    };
  }

  private calculateDailyMileage(
    workoutType: string,
    weekTarget: WeeklyTarget,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dayName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): { totalMiles: number; distribution: any } {
    const distributions: Record<string, number> = {
      long_run: weekTarget.longRunMiles,
      tempo: Math.round(weekTarget.totalMiles * 0.15),
      interval: Math.round(weekTarget.totalMiles * 0.12),
      race_pace: Math.round(weekTarget.totalMiles * 0.12),
      fartlek: Math.round(weekTarget.totalMiles * 0.10),
      easy: Math.round(weekTarget.totalMiles * 0.08),
      recovery: Math.round(weekTarget.totalMiles * 0.06)
    };

    return {
      totalMiles: distributions[workoutType] || distributions.easy,
      distribution: distributions
    };
  }

  private adjustPace(paceStr: string, secondsPerMile: number): string {
    const [mins, secs] = paceStr.split(':').map(Number);
    const totalSeconds = mins * 60 + secs + secondsPerMile;
    const newMins = Math.floor(totalSeconds / 60);
    const newSecs = totalSeconds % 60;
    return `${newMins}:${newSecs.toString().padStart(2, '0')}`;
  }

  private buildMainSet(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    baseWorkout: any,
    totalMiles: number,
    targetPaces: Record<string, string>
  ): string {
    // This would be more sophisticated in practice
    if (baseWorkout.mainSet) {
      return baseWorkout.mainSet
        .replace(/\{threshold\}/g, targetPaces.threshold)
        .replace(/\{interval\}/g, targetPaces.interval)
        .replace(/\{marathon\}/g, targetPaces.marathon)
        .replace(/\{easy\}/g, targetPaces.easy);
    }

    return `${totalMiles} miles at target pace`;
  }

  private estimateWorkoutDuration(
    miles: number,
    workoutType: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    paces: Record<string, string>
  ): number {
    const pacesPerMile: Record<string, number> = {
      easy: 9,
      tempo: 7.5,
      interval: 7,
      long_run: 9.5,
      recovery: 10,
      race_pace: 8
    };

    const baseDuration = miles * (pacesPerMile[workoutType] || 9);
    const warmupCooldown = workoutType === 'easy' ? 0 : 20;

    return Math.round(baseDuration + warmupCooldown);
  }

  private personalizeDescription(
    description: string,
    profile: UserProfile,
    phase: string
  ): string {
    return description
      .replace(/\{phase\}/g, phase)
      .replace(/\{vdot\}/g, profile.vdot.toString());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getWorkoutPurpose(workoutType: string, phase: string): string {
    const purposes: Record<string, string> = {
      easy: 'Aerobic development and recovery',
      tempo: 'Lactate threshold improvement',
      interval: 'VO2max and speed development',
      long_run: 'Endurance and mental toughness',
      recovery: 'Active recovery and blood flow',
      race_pace: 'Race pace familiarity and confidence'
    };

    return purposes[workoutType] || 'General fitness';
  }

  private generateCoachNotes(
    workoutType: string,
    history: RecentHistory,
    profile: UserProfile,
    phase: string
  ): string {
    const notes: string[] = [];

    // Fatigue-based notes
    if (history.tsb < -15) {
      notes.push("You're carrying fatigue - OK to dial back the pace if needed");
    }

    // Phase-specific notes
    if (phase === 'base' && workoutType === 'tempo') {
      notes.push('Keep the effort controlled - this is about time at threshold, not speed');
    }

    // Workout-specific notes
    if (workoutType === 'interval' && profile.comfortLevels?.track === 'intimidated') {
      notes.push('You can do this workout on the road if the track feels intimidating');
    }

    return notes.join('. ');
  }

  private generateAlternatives(workoutType: string, miles: number): string[] {
    const alternatives: Record<string, string[]> = {
      tempo: [
        `${miles} miles progression run`,
        `${Math.round(miles * 0.8)} miles at tempo + strides`,
        'Fartlek with similar time at threshold'
      ],
      interval: [
        'Tempo run if legs feel heavy',
        'Hill repeats for similar stimulus',
        'Fartlek with hard/easy segments'
      ],
      long_run: [
        `${Math.round(miles * 0.8)} miles if time constrained`,
        'Split into AM/PM if needed',
        'Trail run for softer surface'
      ]
    };

    return alternatives[workoutType] || ['Easy run', 'Cross-training'];
  }

  private getWeatherConsiderations(workoutType: string): string {
    const considerations: Record<string, string> = {
      tempo: 'Add 5-10 sec/mile in heat, 5 sec/mile in strong wind',
      interval: 'Move indoors if conditions are extreme',
      long_run: 'Start earlier in summer, carry hydration',
      easy: 'Perfect for any weather - adjust pace as needed'
    };

    return considerations[workoutType] || '';
  }

  private applyPerformanceAdjustments(
    workouts: DetailedWorkout[],
    history: RecentHistory
  ): DetailedWorkout[] {
    // Look at recent performance trends
    const recentVerdicts = history.workouts.slice(-5).map(w => w.verdict);
    const strugglingCount = recentVerdicts.filter(v => v === 'struggled').length;

    if (strugglingCount >= 2) {
      // Athlete is struggling - make adjustments
      return workouts.map(workout => {
        if (workout.workoutType === 'interval' || workout.workoutType === 'tempo') {
          workout.coachNotes += '. Recent struggles noted - start conservative and build into the workout';
          workout.alternatives?.unshift('Easy run + strides if not feeling it');
        }
        return workout;
      });
    }

    return workouts;
  }
}