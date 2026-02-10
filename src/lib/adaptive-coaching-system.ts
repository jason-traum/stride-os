/**
 * Adaptive Coaching System
 *
 * Instead of just responding to prompts, this system:
 * 1. Maintains rough templates 2+ weeks out
 * 2. Adapts workouts based on runner's current state
 * 3. Uses "vibe checks" to assess readiness
 * 4. Tracks preferences and patterns over time
 */

export interface RunnerState {
  // Physical indicators
  recentWorkoutExecution: 'crushed_it' | 'on_target' | 'struggled' | 'DNF';
  fatigueLevelTrend: 'recovering' | 'fresh' | 'normal' | 'accumulating' | 'overreached';
  injuryRisk: 'low' | 'moderate' | 'high';
  sleepQuality: number; // 1-10 over last 3 days

  // Mental/Life factors
  stressLevel: 'low' | 'normal' | 'high' | 'overwhelming';
  motivationLevel: 'pumped' | 'ready' | 'going_through_motions' | 'dreading';
  timeAvailable: 'plenty' | 'normal' | 'squeezed' | 'crisis';

  // Training context
  weeksUntilRace: number;
  currentPhase: 'base' | 'build' | 'peak' | 'taper' | 'recovery';
  lastHardEffortDaysAgo: number;
  weeklyMileageVsTarget: number; // 0.8 = 80% of target
}

export interface AdaptiveWorkoutDecision {
  baseTemplate: string; // What was originally planned
  adaptation: string; // What we're actually prescribing
  reasoning: string[]; // Why we made this choice
  alternativeOptions: Array<{
    workout: string;
    whenToUse: string;
  }>;
  followUpQuestions?: string[]; // Things to check before finalizing
}

export class AdaptiveCoachingSystem {
  /**
   * The core insight: Don't just pick workouts, READ THE RUNNER
   */
  async determineWorkout(
    plannedWorkout: any,
    runnerState: RunnerState,
    preferences: UserPreferencesLog
  ): Promise<AdaptiveWorkoutDecision> {

    // Start with the planned workout
    let adaptation = plannedWorkout;
    const reasoning: string[] = [];

    // 1. Check if they're too fatigued for quality work
    if (runnerState.fatigueLevelTrend === 'overreached' && plannedWorkout.type === 'hard') {
      adaptation = this.downgradeToRecovery(plannedWorkout);
      reasoning.push("Fatigue levels suggest backing off from hard efforts");
    }

    // 2. Life stress adjustment
    if (runnerState.stressLevel === 'overwhelming' && runnerState.timeAvailable === 'squeezed') {
      adaptation = this.createStressReliefWorkout(plannedWorkout);
      reasoning.push("High life stress + time crunch = need something manageable");
    }

    // 3. Momentum building
    if (runnerState.recentWorkoutExecution === 'crushed_it' &&
        runnerState.motivationLevel === 'pumped') {
      adaptation = this.addProgressiveElement(plannedWorkout);
      reasoning.push("You're on fire - let's channel that momentum");
    }

    // 4. Injury risk management
    if (runnerState.injuryRisk === 'high') {
      adaptation = this.makeInjuryPreventive(plannedWorkout);
      reasoning.push("Seeing injury risk signals - modified for safety");
    }

    return {
      baseTemplate: plannedWorkout.name,
      adaptation: adaptation.name,
      reasoning,
      alternativeOptions: this.generateAlternatives(runnerState),
      followUpQuestions: this.generateVibeCheck(runnerState)
    };
  }

  /**
   * Instead of "what workout do you want?", ask "how are you feeling?"
   */
  generateVibeCheck(state: RunnerState): string[] {
    const questions: string[] = [];

    if (state.lastHardEffortDaysAgo < 2) {
      questions.push("How did your legs feel on that last hard workout?");
    }

    if (state.weeklyMileageVsTarget < 0.8) {
      questions.push("You're under mileage - injury prevention or just life stuff?");
    }

    if (state.motivationLevel === 'dreading') {
      questions.push("What would make running feel good today?");
    }

    return questions;
  }

  private downgradeToRecovery(original: any) {
    return {
      name: "Recovery-Focused " + original.name,
      type: "easy",
      description: "Scaled back for optimal recovery",
      structure: this.getRecoveryVersion(original.type)
    };
  }

  private createStressReliefWorkout(original: any) {
    return {
      name: "Stress Relief Run",
      type: "easy_fartlek",
      description: "Unstructured, play-based movement",
      structure: "20-40min easy with 4-6 gentle surges when you feel like it"
    };
  }

  private addProgressiveElement(original: any) {
    // Add a challenging finish or extra volume
    return {
      ...original,
      name: original.name + " Plus",
      bonusElement: "Add 2x200m strides at the end to test your closing speed"
    };
  }

  private makeInjuryPreventive(original: any) {
    return {
      ...original,
      modifications: [
        "Extra 10min dynamic warmup",
        "Run on softer surface if possible",
        "Stop if any sharp pains"
      ]
    };
  }

  private generateAlternatives(state: RunnerState) {
    const alts = [];

    if (state.timeAvailable === 'squeezed') {
      alts.push({
        workout: "Time-Efficient Tempo: 15min hard",
        whenToUse: "If you only have 30-40 minutes"
      });
    }

    if (state.motivationLevel === 'going_through_motions') {
      alts.push({
        workout: "Social Run: Meet a friend",
        whenToUse: "When you need external motivation"
      });
    }

    return alts;
  }

  private getRecoveryVersion(workoutType: string): string {
    const recoveryVersions: Record<string, string> = {
      tempo: "20min easy + 6x30sec at tempo with 90sec recovery",
      interval: "4x400m at 10K pace with full recovery",
      long_run: "75% of planned distance at conversational pace",
      vo2max: "6x1min at threshold with 2min recovery"
    };

    return recoveryVersions[workoutType] || "45min easy recovery run";
  }
}

/**
 * User Preferences Log - Beyond just settings
 */
export interface UserPreferencesLog {
  // Patterns we've learned
  preferredWorkoutTimes: Array<{ day: string; time: string; success_rate: number }>;
  workoutCompletionByType: Record<string, number>; // tempo: 0.85, long_run: 0.95
  motivationalTriggers: string[]; // "race goals", "strava kudos", "group runs"
  struggleTriggers: string[]; // "early morning", "solo long runs", "track workouts"

  // Responses to different approaches
  respondsWellTo: string[]; // "gentle encouragement", "data-driven feedback", "competition"
  shutsDownWith: string[]; // "harsh criticism", "too much structure"

  // Discovered preferences
  actualVsStatedPreferences: {
    saysTheyWant: string; // "hard workouts"
    actuallyThrivesWith: string; // "moderate efforts with good execution"
  };

  // Life patterns
  typicalStressors: string[]; // "work deadlines", "kid activities", "travel"
  recoveryIndicators: string[]; // "good sleep", "yoga day", "easy social run"
}