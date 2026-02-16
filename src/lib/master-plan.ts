/**
 * Master Plan System - Layer 1 of the coaching architecture
 *
 * Stores high-level training plans with weekly targets (not daily workouts)
 * Only regenerates when major changes occur (goal race, injury, fitness shift)
 */

import { getCoachingKnowledge } from './coach-knowledge';
import { addWeeks, differenceInWeeks, format, startOfWeek } from 'date-fns';

export interface TrainingPhase {
  name: 'base' | 'build' | 'peak' | 'taper' | 'recovery';
  startDate: string;
  endDate: string;
  weeklyMileageTarget: number;
  focus: string;
  description?: string;
}

export interface WeeklyTarget {
  weekNumber: number;
  weekStartDate: string;
  totalMiles: number;
  longRunMiles: number;
  qualitySessions: 1 | 2;
  cutbackWeek: boolean;
  notes?: string;
}

export interface MasterPlan {
  id: number;
  profileId: number;
  goalRaceId: number;
  name: string;
  startDate: string;
  endDate: string;
  phases: TrainingPhase[];
  weeklyTargets: WeeklyTarget[];
  createdAt: string;
  updatedAt: string;
}

export class MasterPlanGenerator {
  /**
   * Create a master plan based on goal race and current fitness
   */
  async createMasterPlan(params: {
    profileId: number;
    goalRaceId: number;
    goalRaceDate: string;
    goalRaceDistance: string;
    currentVDOT: number;
    currentWeeklyMileage: number;
    peakMileageTarget?: number;
    preferences?: {
      aggressiveness: 'conservative' | 'moderate' | 'aggressive';
      injuryHistory?: string[];
      preferredDays?: string[];
      restDays?: string[];
    };
  }): Promise<MasterPlan> {
    // Get periodization knowledge
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _periodizationKnowledge = getCoachingKnowledge('periodization');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _trainingPhilosophies = getCoachingKnowledge('training_philosophies');

    // Calculate plan duration
    const raceDate = new Date(params.goalRaceDate);
    const planStartDate = startOfWeek(new Date(), { weekStartsOn: 1 });
    const totalWeeks = differenceInWeeks(raceDate, planStartDate);

    if (totalWeeks < 8) {
      throw new Error('Not enough time to create a proper training plan. Need at least 8 weeks.');
    }

    // Determine phase distribution based on race distance and available weeks
    const phases = this.calculatePhases(
      planStartDate,
      raceDate,
      params.goalRaceDistance,
      totalWeeks,
      params.preferences?.aggressiveness || 'moderate'
    );

    // Calculate weekly mileage progression
    const weeklyTargets = this.calculateWeeklyTargets(
      phases,
      params.currentWeeklyMileage,
      params.peakMileageTarget || params.currentWeeklyMileage * 1.3,
      params.goalRaceDistance,
      totalWeeks
    );

    // Create the master plan object
    const masterPlan: Omit<MasterPlan, 'id' | 'createdAt' | 'updatedAt'> = {
      profileId: params.profileId,
      goalRaceId: params.goalRaceId,
      name: `${params.goalRaceDistance} Training Plan - ${format(raceDate, 'MMM d, yyyy')}`,
      startDate: format(planStartDate, 'yyyy-MM-dd'),
      endDate: format(raceDate, 'yyyy-MM-dd'),
      phases,
      weeklyTargets
    };

    // In a real implementation, save to database
    console.log('Master plan created:', masterPlan);

    return {
      ...masterPlan,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Calculate training phases based on race distance and available time
   */
  private calculatePhases(
    startDate: Date,
    raceDate: Date,
    raceDistance: string,
    totalWeeks: number,
    aggressiveness: string
  ): TrainingPhase[] {
    const phases: TrainingPhase[] = [];
    let currentDate = startDate;

    // Phase distribution based on race distance
    const phaseDistribution = this.getPhaseDistribution(raceDistance, totalWeeks, aggressiveness);

    for (const [phaseName, config] of Object.entries(phaseDistribution)) {
      if (config.weeks > 0) {
        const phaseEndDate = addWeeks(currentDate, config.weeks);

        phases.push({
          name: phaseName as TrainingPhase['name'],
          startDate: format(currentDate, 'yyyy-MM-dd'),
          endDate: format(phaseEndDate, 'yyyy-MM-dd'),
          weeklyMileageTarget: 0, // Will be calculated in weekly targets
          focus: config.focus,
          description: config.description
        });

        currentDate = phaseEndDate;
      }
    }

    return phases;
  }

  /**
   * Get phase distribution based on race distance
   */
  private getPhaseDistribution(
    raceDistance: string,
    totalWeeks: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    aggressiveness: string
  ) {
    // Use coaching knowledge to determine optimal phase distribution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const distributions: Record<string, any> = {
      '5k': {
        base: {
          weeks: Math.floor(totalWeeks * 0.3),
          focus: 'Aerobic development',
          description: 'Building aerobic base with easy miles and strides'
        },
        build: {
          weeks: Math.floor(totalWeeks * 0.4),
          focus: 'Speed and VO2max',
          description: 'Introducing track workouts and tempo runs'
        },
        peak: {
          weeks: Math.floor(totalWeeks * 0.2),
          focus: 'Race pace specificity',
          description: 'Sharpening with race pace work'
        },
        taper: {
          weeks: Math.ceil(totalWeeks * 0.1),
          focus: 'Freshening',
          description: 'Reducing volume while maintaining intensity'
        }
      },
      'half_marathon': {
        base: {
          weeks: Math.floor(totalWeeks * 0.35),
          focus: 'Aerobic foundation',
          description: 'Building weekly mileage and long run endurance'
        },
        build: {
          weeks: Math.floor(totalWeeks * 0.35),
          focus: 'Lactate threshold',
          description: 'Tempo runs and sustained efforts'
        },
        peak: {
          weeks: Math.floor(totalWeeks * 0.2),
          focus: 'Race simulation',
          description: 'Race pace long runs and dress rehearsals'
        },
        taper: {
          weeks: 2,
          focus: 'Peak performance',
          description: 'Maintaining fitness while ensuring freshness'
        }
      },
      'marathon': {
        base: {
          weeks: Math.floor(totalWeeks * 0.4),
          focus: 'Aerobic capacity',
          description: 'High volume easy running and medium-long runs'
        },
        build: {
          weeks: Math.floor(totalWeeks * 0.35),
          focus: 'Marathon pace & threshold',
          description: 'Long runs with MP segments, tempo work'
        },
        peak: {
          weeks: Math.floor(totalWeeks * 0.15),
          focus: 'Race readiness',
          description: 'Longest runs, race pace confidence'
        },
        taper: {
          weeks: 3,
          focus: 'Supercompensation',
          description: 'Gradual reduction to peak on race day'
        }
      }
    };

    return distributions[raceDistance] || distributions['half_marathon'];
  }

  /**
   * Calculate weekly mileage targets with progression and cutback weeks
   */
  private calculateWeeklyTargets(
    phases: TrainingPhase[],
    currentMileage: number,
    peakMileage: number,
    raceDistance: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    totalWeeks: number
  ): WeeklyTarget[] {
    const targets: WeeklyTarget[] = [];
    let weekNumber = 1;
    let currentWeekMileage = currentMileage;

    for (const phase of phases) {
      const phaseWeeks = differenceInWeeks(new Date(phase.endDate), new Date(phase.startDate));

      for (let weekInPhase = 0; weekInPhase < phaseWeeks; weekInPhase++) {
        const weekStartDate = addWeeks(new Date(phase.startDate), weekInPhase);

        // Calculate mileage based on phase and progression
        const targetMileage = this.calculateWeekMileage(
          phase.name,
          weekInPhase,
          phaseWeeks,
          currentWeekMileage,
          peakMileage,
          raceDistance
        );

        // Determine if it's a cutback week (every 3-4 weeks)
        const isCutbackWeek = weekNumber % 4 === 0;
        const adjustedMileage = isCutbackWeek ? Math.round(targetMileage * 0.7) : targetMileage;

        // Calculate long run distance (20-30% of weekly mileage)
        const longRunMiles = Math.round(adjustedMileage * (phase.name === 'marathon' ? 0.3 : 0.25));

        // Determine quality sessions based on phase
        const qualitySessions = this.getQualitySessions(phase.name, raceDistance);

        targets.push({
          weekNumber,
          weekStartDate: format(weekStartDate, 'yyyy-MM-dd'),
          totalMiles: adjustedMileage,
          longRunMiles,
          qualitySessions,
          cutbackWeek: isCutbackWeek,
          notes: this.getWeekNotes(phase.name, weekInPhase, phaseWeeks, isCutbackWeek)
        });

        currentWeekMileage = adjustedMileage;
        weekNumber++;
      }
    }

    return targets;
  }

  /**
   * Calculate mileage for a specific week
   */
  private calculateWeekMileage(
    phase: string,
    weekInPhase: number,
    totalPhaseWeeks: number,
    currentMileage: number,
    peakMileage: number,
    raceDistance: string
  ): number {
    const phaseProgress = weekInPhase / totalPhaseWeeks;

    switch (phase) {
      case 'base':
        // Gradual build from current to 80% of peak
        const baseTarget = peakMileage * 0.8;
        return Math.round(currentMileage + (baseTarget - currentMileage) * phaseProgress);

      case 'build':
        // Build from 80% to peak
        const buildStart = peakMileage * 0.8;
        return Math.round(buildStart + (peakMileage - buildStart) * phaseProgress);

      case 'peak':
        // Maintain peak with slight undulation
        return Math.round(peakMileage * (0.95 + Math.sin(phaseProgress * Math.PI) * 0.05));

      case 'taper':
        // Progressive reduction
        const taperFactors: Record<string, number[]> = {
          '5k': [0.8, 0.6, 0.4],
          'half_marathon': [0.7, 0.5],
          'marathon': [0.7, 0.5, 0.3]
        };
        const factors = taperFactors[raceDistance] || taperFactors['half_marathon'];
        const factorIndex = Math.min(weekInPhase, factors.length - 1);
        return Math.round(peakMileage * factors[factorIndex]);

      default:
        return currentMileage;
    }
  }

  /**
   * Determine quality sessions based on phase
   */
  private getQualitySessions(phase: string, raceDistance: string): 1 | 2 {
    if (phase === 'base') return 1;
    if (phase === 'taper') return 1;
    if (raceDistance === '5k' && phase === 'peak') return 2;
    return 2;
  }

  /**
   * Get notes for specific weeks
   */
  private getWeekNotes(
    phase: string,
    weekInPhase: number,
    totalPhaseWeeks: number,
    isCutbackWeek: boolean
  ): string {
    if (isCutbackWeek) return 'Recovery week - reduced volume';

    if (phase === 'base' && weekInPhase === 0) {
      return 'First week of base building - run by feel';
    }

    if (phase === 'peak' && weekInPhase === totalPhaseWeeks - 1) {
      return 'Last hard week before taper';
    }

    if (phase === 'taper' && weekInPhase === 0) {
      return 'Taper begins - maintain intensity, reduce volume';
    }

    return '';
  }
}

/**
 * Check if master plan needs regeneration
 */
export async function shouldRegenerateMasterPlan(
  masterPlan: MasterPlan,
  currentState: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentWorkouts: any[];
    currentFitness: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    injuries: any[];
    missedWeeks: number;
  }
): Promise<{ needsUpdate: boolean; reason: string; suggestedChanges: string[] }> {
  const suggestedChanges: string[] = [];
  let needsUpdate = false;
  let reason = '';

  // Check missed weeks
  if (currentState.missedWeeks > 2) {
    needsUpdate = true;
    reason = 'Significant training interruption';
    suggestedChanges.push('Adjust timeline to account for missed training');
    suggestedChanges.push('Consider reducing peak mileage target');
  }

  // Check injury status
  if (currentState.injuries.length > 0) {
    needsUpdate = true;
    reason = 'Active injury requires plan modification';
    suggestedChanges.push('Add recovery phase');
    suggestedChanges.push('Modify workout types to avoid aggravation');
  }

  // Check fitness trajectory
  const fitnessChange = (currentState.currentFitness - masterPlan.phases[0].weeklyMileageTarget) / masterPlan.phases[0].weeklyMileageTarget;
  if (Math.abs(fitnessChange) > 0.3) {
    needsUpdate = true;
    reason = fitnessChange > 0 ? 'Fitness improving faster than expected' : 'Fitness not progressing as planned';
    suggestedChanges.push(fitnessChange > 0 ? 'Increase targets' : 'Reduce targets');
  }

  return { needsUpdate, reason, suggestedChanges };
}