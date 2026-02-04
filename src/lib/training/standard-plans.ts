/**
 * Standard Training Plan Templates
 *
 * Pre-built templates based on popular training programs:
 * - Pfitzinger (Advanced Marathoning)
 * - Hansons Marathon Method
 * - Hal Higdon (Novice/Intermediate)
 * - Jack Daniels (Daniels' Running Formula)
 *
 * These templates define the structure and philosophy of each program,
 * which the plan generator uses to create personalized plans.
 */

export interface StandardPlanTemplate {
  id: string;
  name: string;
  author: string;
  description: string;
  philosophy: string;
  raceDistance: 'marathon' | 'half_marathon' | '10K' | '5K';
  weeks: number;
  peakWeekMiles: number;
  runsPerWeek: number;
  qualitySessionsPerWeek: number;
  longRunPercentOfWeekly: number;
  maxLongRunMiles: number;
  keyWorkouts: string[];
  weeklyPattern: WeekPattern[];
  taperWeeks: number;
  suitableFor: string;
  requiredWeeklyMileage: number; // Minimum current mileage to start
}

export interface WeekPattern {
  phase: 'base' | 'build' | 'peak' | 'taper' | 'recovery';
  weekNumber: number;
  targetMilesPercent: number; // Percentage of peak week
  longRunMiles: number | 'max' | 'reduced';
  qualitySessions: number;
  keyWorkoutType?: string;
  notes?: string;
}

// Pfitzinger 18/55 Marathon Plan
export const pfitz18_55: StandardPlanTemplate = {
  id: 'pfitz-18-55',
  name: 'Pfitzinger 18/55',
  author: 'Pete Pfitzinger',
  description: '18-week marathon plan peaking at 55 miles per week. From Advanced Marathoning.',
  philosophy: 'Build aerobic base through moderate-high volume, with 2 quality sessions per week. Long runs are the cornerstone, with marathon-pace work and lactate threshold runs as key workouts.',
  raceDistance: 'marathon',
  weeks: 18,
  peakWeekMiles: 55,
  runsPerWeek: 5,
  qualitySessionsPerWeek: 2,
  longRunPercentOfWeekly: 35,
  maxLongRunMiles: 22,
  keyWorkouts: [
    'Long run (16-22 miles)',
    'Marathon pace long run (8-14 miles at MP)',
    'Lactate threshold runs (4-7 miles at LT pace)',
    'VO2max intervals (5x1000m or 4x1200m)',
  ],
  weeklyPattern: [
    // Base Phase (Weeks 1-5)
    { phase: 'base', weekNumber: 1, targetMilesPercent: 75, longRunMiles: 13, qualitySessions: 1 },
    { phase: 'base', weekNumber: 2, targetMilesPercent: 80, longRunMiles: 14, qualitySessions: 2 },
    { phase: 'base', weekNumber: 3, targetMilesPercent: 85, longRunMiles: 16, qualitySessions: 2 },
    { phase: 'base', weekNumber: 4, targetMilesPercent: 70, longRunMiles: 12, qualitySessions: 1, notes: 'Recovery week' },
    { phase: 'base', weekNumber: 5, targetMilesPercent: 90, longRunMiles: 18, qualitySessions: 2 },
    // Build Phase (Weeks 6-12)
    { phase: 'build', weekNumber: 6, targetMilesPercent: 95, longRunMiles: 17, qualitySessions: 2, keyWorkoutType: 'MP long' },
    { phase: 'build', weekNumber: 7, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 2 },
    { phase: 'build', weekNumber: 8, targetMilesPercent: 75, longRunMiles: 14, qualitySessions: 1, notes: 'Recovery week' },
    { phase: 'build', weekNumber: 9, targetMilesPercent: 100, longRunMiles: 18, qualitySessions: 2, keyWorkoutType: 'LT run' },
    { phase: 'build', weekNumber: 10, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 2, keyWorkoutType: 'MP long' },
    { phase: 'build', weekNumber: 11, targetMilesPercent: 100, longRunMiles: 16, qualitySessions: 2, keyWorkoutType: 'VO2max' },
    { phase: 'build', weekNumber: 12, targetMilesPercent: 75, longRunMiles: 12, qualitySessions: 1, notes: 'Recovery week' },
    // Peak Phase (Weeks 13-15)
    { phase: 'peak', weekNumber: 13, targetMilesPercent: 100, longRunMiles: 22, qualitySessions: 2, keyWorkoutType: 'MP long' },
    { phase: 'peak', weekNumber: 14, targetMilesPercent: 100, longRunMiles: 18, qualitySessions: 2, keyWorkoutType: 'LT run' },
    { phase: 'peak', weekNumber: 15, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 2, keyWorkoutType: 'VO2max' },
    // Taper Phase (Weeks 16-18)
    { phase: 'taper', weekNumber: 16, targetMilesPercent: 80, longRunMiles: 14, qualitySessions: 2 },
    { phase: 'taper', weekNumber: 17, targetMilesPercent: 60, longRunMiles: 10, qualitySessions: 1 },
    { phase: 'taper', weekNumber: 18, targetMilesPercent: 40, longRunMiles: 'reduced', qualitySessions: 0, notes: 'Race week' },
  ],
  taperWeeks: 3,
  suitableFor: 'Experienced runners who can handle 40+ miles/week and want to run a strong marathon',
  requiredWeeklyMileage: 35,
};

// Pfitzinger 12/55 Marathon Plan (shorter buildup)
export const pfitz12_55: StandardPlanTemplate = {
  id: 'pfitz-12-55',
  name: 'Pfitzinger 12/55',
  author: 'Pete Pfitzinger',
  description: '12-week marathon plan peaking at 55 miles. Assumes strong base fitness.',
  philosophy: 'Condensed version of 18/55 for runners with existing aerobic base. Aggressive buildup requires 40+ mile weeks as prerequisite.',
  raceDistance: 'marathon',
  weeks: 12,
  peakWeekMiles: 55,
  runsPerWeek: 5,
  qualitySessionsPerWeek: 2,
  longRunPercentOfWeekly: 35,
  maxLongRunMiles: 20,
  keyWorkouts: [
    'Long run (16-20 miles)',
    'Marathon pace segments',
    'Lactate threshold runs',
    'VO2max intervals',
  ],
  weeklyPattern: [
    { phase: 'build', weekNumber: 1, targetMilesPercent: 85, longRunMiles: 16, qualitySessions: 2 },
    { phase: 'build', weekNumber: 2, targetMilesPercent: 90, longRunMiles: 18, qualitySessions: 2, keyWorkoutType: 'LT run' },
    { phase: 'build', weekNumber: 3, targetMilesPercent: 95, longRunMiles: 17, qualitySessions: 2, keyWorkoutType: 'MP long' },
    { phase: 'build', weekNumber: 4, targetMilesPercent: 75, longRunMiles: 12, qualitySessions: 1, notes: 'Recovery week' },
    { phase: 'peak', weekNumber: 5, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 2, keyWorkoutType: 'VO2max' },
    { phase: 'peak', weekNumber: 6, targetMilesPercent: 100, longRunMiles: 18, qualitySessions: 2, keyWorkoutType: 'MP long' },
    { phase: 'peak', weekNumber: 7, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 2, keyWorkoutType: 'LT run' },
    { phase: 'peak', weekNumber: 8, targetMilesPercent: 75, longRunMiles: 12, qualitySessions: 1, notes: 'Recovery week' },
    { phase: 'peak', weekNumber: 9, targetMilesPercent: 100, longRunMiles: 18, qualitySessions: 2, keyWorkoutType: 'VO2max' },
    { phase: 'taper', weekNumber: 10, targetMilesPercent: 80, longRunMiles: 14, qualitySessions: 2 },
    { phase: 'taper', weekNumber: 11, targetMilesPercent: 60, longRunMiles: 10, qualitySessions: 1 },
    { phase: 'taper', weekNumber: 12, targetMilesPercent: 40, longRunMiles: 'reduced', qualitySessions: 0, notes: 'Race week' },
  ],
  taperWeeks: 3,
  suitableFor: 'Experienced runners with established 45+ mile/week base looking for shorter plan',
  requiredWeeklyMileage: 40,
};

// Hansons Marathon Method (Beginner)
export const hansonsBeinner: StandardPlanTemplate = {
  id: 'hansons-beginner',
  name: 'Hansons Beginner',
  author: 'Keith & Kevin Hanson',
  description: '18-week marathon plan with unique philosophy of cumulative fatigue and shorter long runs.',
  philosophy: 'Cumulative fatigue approach - run on tired legs to simulate late-race conditions. Caps long runs at 16 miles but emphasizes consistent mid-week volume. "Something of Substance" (SOS) workouts are key.',
  raceDistance: 'marathon',
  weeks: 18,
  peakWeekMiles: 47,
  runsPerWeek: 6,
  qualitySessionsPerWeek: 3,
  longRunPercentOfWeekly: 30,
  maxLongRunMiles: 16,
  keyWorkouts: [
    'Speed work (12x400m or 6x800m)',
    'Strength runs (6-10 miles at MP+15s)',
    'Tempo runs (5-10 miles at tempo pace)',
    'Long run (14-16 miles)',
  ],
  weeklyPattern: [
    // Base weeks (1-5)
    { phase: 'base', weekNumber: 1, targetMilesPercent: 60, longRunMiles: 10, qualitySessions: 2 },
    { phase: 'base', weekNumber: 2, targetMilesPercent: 65, longRunMiles: 10, qualitySessions: 2 },
    { phase: 'base', weekNumber: 3, targetMilesPercent: 70, longRunMiles: 12, qualitySessions: 2 },
    { phase: 'base', weekNumber: 4, targetMilesPercent: 75, longRunMiles: 12, qualitySessions: 2 },
    { phase: 'base', weekNumber: 5, targetMilesPercent: 80, longRunMiles: 14, qualitySessions: 3 },
    // Build weeks (6-12)
    { phase: 'build', weekNumber: 6, targetMilesPercent: 85, longRunMiles: 14, qualitySessions: 3, keyWorkoutType: 'tempo' },
    { phase: 'build', weekNumber: 7, targetMilesPercent: 90, longRunMiles: 15, qualitySessions: 3, keyWorkoutType: 'strength' },
    { phase: 'build', weekNumber: 8, targetMilesPercent: 90, longRunMiles: 15, qualitySessions: 3, keyWorkoutType: 'speed' },
    { phase: 'build', weekNumber: 9, targetMilesPercent: 95, longRunMiles: 16, qualitySessions: 3, keyWorkoutType: 'tempo' },
    { phase: 'build', weekNumber: 10, targetMilesPercent: 95, longRunMiles: 16, qualitySessions: 3, keyWorkoutType: 'strength' },
    { phase: 'build', weekNumber: 11, targetMilesPercent: 100, longRunMiles: 16, qualitySessions: 3, keyWorkoutType: 'speed' },
    { phase: 'build', weekNumber: 12, targetMilesPercent: 100, longRunMiles: 16, qualitySessions: 3, keyWorkoutType: 'tempo' },
    // Peak weeks (13-15)
    { phase: 'peak', weekNumber: 13, targetMilesPercent: 100, longRunMiles: 16, qualitySessions: 3, keyWorkoutType: 'strength' },
    { phase: 'peak', weekNumber: 14, targetMilesPercent: 100, longRunMiles: 16, qualitySessions: 3, keyWorkoutType: 'tempo' },
    { phase: 'peak', weekNumber: 15, targetMilesPercent: 95, longRunMiles: 16, qualitySessions: 3, keyWorkoutType: 'strength' },
    // Taper (16-18)
    { phase: 'taper', weekNumber: 16, targetMilesPercent: 80, longRunMiles: 10, qualitySessions: 2 },
    { phase: 'taper', weekNumber: 17, targetMilesPercent: 60, longRunMiles: 8, qualitySessions: 1 },
    { phase: 'taper', weekNumber: 18, targetMilesPercent: 40, longRunMiles: 'reduced', qualitySessions: 0, notes: 'Race week' },
  ],
  taperWeeks: 3,
  suitableFor: 'Runners who prefer more frequent running and can handle 6 days/week',
  requiredWeeklyMileage: 25,
};

// Hal Higdon Intermediate 1
export const higdonIntermediate1: StandardPlanTemplate = {
  id: 'higdon-intermediate-1',
  name: 'Hal Higdon Intermediate 1',
  author: 'Hal Higdon',
  description: '18-week beginner-friendly marathon plan with gradual progression.',
  philosophy: 'Gentle, approachable approach with one quality session per week. Focus on getting to the start line healthy. Cross-training encouraged.',
  raceDistance: 'marathon',
  weeks: 18,
  peakWeekMiles: 40,
  runsPerWeek: 4,
  qualitySessionsPerWeek: 1,
  longRunPercentOfWeekly: 40,
  maxLongRunMiles: 20,
  keyWorkouts: [
    'Long run (10-20 miles)',
    'Mid-week medium-long run',
    'Pace runs',
  ],
  weeklyPattern: [
    // Weeks 1-6: Base building
    { phase: 'base', weekNumber: 1, targetMilesPercent: 50, longRunMiles: 10, qualitySessions: 0 },
    { phase: 'base', weekNumber: 2, targetMilesPercent: 55, longRunMiles: 11, qualitySessions: 0 },
    { phase: 'base', weekNumber: 3, targetMilesPercent: 60, longRunMiles: 8, qualitySessions: 1, notes: 'Recovery week' },
    { phase: 'base', weekNumber: 4, targetMilesPercent: 65, longRunMiles: 13, qualitySessions: 1 },
    { phase: 'base', weekNumber: 5, targetMilesPercent: 70, longRunMiles: 14, qualitySessions: 1 },
    { phase: 'base', weekNumber: 6, targetMilesPercent: 60, longRunMiles: 10, qualitySessions: 0, notes: 'Recovery week' },
    // Weeks 7-12: Build
    { phase: 'build', weekNumber: 7, targetMilesPercent: 80, longRunMiles: 16, qualitySessions: 1 },
    { phase: 'build', weekNumber: 8, targetMilesPercent: 85, longRunMiles: 17, qualitySessions: 1 },
    { phase: 'build', weekNumber: 9, targetMilesPercent: 70, longRunMiles: 12, qualitySessions: 0, notes: 'Recovery week' },
    { phase: 'build', weekNumber: 10, targetMilesPercent: 90, longRunMiles: 18, qualitySessions: 1 },
    { phase: 'build', weekNumber: 11, targetMilesPercent: 95, longRunMiles: 19, qualitySessions: 1 },
    { phase: 'build', weekNumber: 12, targetMilesPercent: 75, longRunMiles: 12, qualitySessions: 0, notes: 'Recovery week' },
    // Weeks 13-15: Peak
    { phase: 'peak', weekNumber: 13, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 1 },
    { phase: 'peak', weekNumber: 14, targetMilesPercent: 90, longRunMiles: 12, qualitySessions: 1 },
    { phase: 'peak', weekNumber: 15, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 1 },
    // Weeks 16-18: Taper
    { phase: 'taper', weekNumber: 16, targetMilesPercent: 75, longRunMiles: 12, qualitySessions: 0 },
    { phase: 'taper', weekNumber: 17, targetMilesPercent: 55, longRunMiles: 8, qualitySessions: 0 },
    { phase: 'taper', weekNumber: 18, targetMilesPercent: 35, longRunMiles: 'reduced', qualitySessions: 0, notes: 'Race week' },
  ],
  taperWeeks: 3,
  suitableFor: 'Newer marathon runners or those prioritizing finishing over time',
  requiredWeeklyMileage: 20,
};

// Jack Daniels 2Q Marathon Plan
export const daniels2Q: StandardPlanTemplate = {
  id: 'daniels-2q',
  name: 'Daniels 2Q',
  author: 'Jack Daniels',
  description: '18-week quality-focused marathon plan with two key workouts per week.',
  philosophy: 'VDOT-based training with emphasis on running at specific intensities. Two quality sessions (2Q) per week - typically Tuesday and Saturday. Precise pace zones for maximum adaptation.',
  raceDistance: 'marathon',
  weeks: 18,
  peakWeekMiles: 55,
  runsPerWeek: 5,
  qualitySessionsPerWeek: 2,
  longRunPercentOfWeekly: 30,
  maxLongRunMiles: 20,
  keyWorkouts: [
    'Q1: Long quality run (tempo + intervals combo)',
    'Q2: Track intervals or tempo',
    'Easy runs at E pace',
    'Marathon-pace work at M pace',
  ],
  weeklyPattern: [
    // Phase I (Weeks 1-4): Foundation
    { phase: 'base', weekNumber: 1, targetMilesPercent: 70, longRunMiles: 13, qualitySessions: 1 },
    { phase: 'base', weekNumber: 2, targetMilesPercent: 75, longRunMiles: 14, qualitySessions: 2, keyWorkoutType: 'E + strides' },
    { phase: 'base', weekNumber: 3, targetMilesPercent: 80, longRunMiles: 15, qualitySessions: 2, keyWorkoutType: 'E + strides' },
    { phase: 'base', weekNumber: 4, targetMilesPercent: 85, longRunMiles: 16, qualitySessions: 2, keyWorkoutType: 'R repeats' },
    // Phase II (Weeks 5-8): Early Quality
    { phase: 'build', weekNumber: 5, targetMilesPercent: 90, longRunMiles: 17, qualitySessions: 2, keyWorkoutType: 'I intervals' },
    { phase: 'build', weekNumber: 6, targetMilesPercent: 95, longRunMiles: 18, qualitySessions: 2, keyWorkoutType: 'T tempo' },
    { phase: 'build', weekNumber: 7, targetMilesPercent: 100, longRunMiles: 19, qualitySessions: 2, keyWorkoutType: 'I intervals' },
    { phase: 'build', weekNumber: 8, targetMilesPercent: 75, longRunMiles: 12, qualitySessions: 1, notes: 'Recovery week' },
    // Phase III (Weeks 9-12): Transition
    { phase: 'build', weekNumber: 9, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 2, keyWorkoutType: 'M tempo' },
    { phase: 'build', weekNumber: 10, targetMilesPercent: 100, longRunMiles: 18, qualitySessions: 2, keyWorkoutType: 'T + M' },
    { phase: 'build', weekNumber: 11, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 2, keyWorkoutType: 'M tempo' },
    { phase: 'build', weekNumber: 12, targetMilesPercent: 75, longRunMiles: 12, qualitySessions: 1, notes: 'Recovery week' },
    // Phase IV (Weeks 13-18): Final Quality + Taper
    { phase: 'peak', weekNumber: 13, targetMilesPercent: 100, longRunMiles: 20, qualitySessions: 2, keyWorkoutType: 'M + I' },
    { phase: 'peak', weekNumber: 14, targetMilesPercent: 100, longRunMiles: 18, qualitySessions: 2, keyWorkoutType: 'T tempo' },
    { phase: 'peak', weekNumber: 15, targetMilesPercent: 95, longRunMiles: 16, qualitySessions: 2, keyWorkoutType: 'M tempo' },
    { phase: 'taper', weekNumber: 16, targetMilesPercent: 80, longRunMiles: 14, qualitySessions: 2 },
    { phase: 'taper', weekNumber: 17, targetMilesPercent: 60, longRunMiles: 10, qualitySessions: 1 },
    { phase: 'taper', weekNumber: 18, targetMilesPercent: 40, longRunMiles: 'reduced', qualitySessions: 0, notes: 'Race week' },
  ],
  taperWeeks: 3,
  suitableFor: 'VDOT-savvy runners who want scientifically structured training',
  requiredWeeklyMileage: 35,
};

// Half Marathon Plans

export const pfitz12_47HM: StandardPlanTemplate = {
  id: 'pfitz-12-47-hm',
  name: 'Pfitzinger 12/47 Half',
  author: 'Pete Pfitzinger',
  description: '12-week half marathon plan peaking at 47 miles per week.',
  philosophy: 'Same Pfitzinger methodology adapted for half marathon. Emphasis on lactate threshold work and longer tempo runs.',
  raceDistance: 'half_marathon',
  weeks: 12,
  peakWeekMiles: 47,
  runsPerWeek: 5,
  qualitySessionsPerWeek: 2,
  longRunPercentOfWeekly: 30,
  maxLongRunMiles: 15,
  keyWorkouts: [
    'Long run (12-15 miles)',
    'Lactate threshold runs (5-8 miles)',
    'VO2max intervals',
    'General aerobic runs',
  ],
  weeklyPattern: [
    { phase: 'build', weekNumber: 1, targetMilesPercent: 80, longRunMiles: 12, qualitySessions: 2, keyWorkoutType: 'LT run' },
    { phase: 'build', weekNumber: 2, targetMilesPercent: 85, longRunMiles: 13, qualitySessions: 2, keyWorkoutType: 'VO2max' },
    { phase: 'build', weekNumber: 3, targetMilesPercent: 90, longRunMiles: 14, qualitySessions: 2, keyWorkoutType: 'LT run' },
    { phase: 'build', weekNumber: 4, targetMilesPercent: 70, longRunMiles: 10, qualitySessions: 1, notes: 'Recovery week' },
    { phase: 'peak', weekNumber: 5, targetMilesPercent: 95, longRunMiles: 15, qualitySessions: 2, keyWorkoutType: 'VO2max' },
    { phase: 'peak', weekNumber: 6, targetMilesPercent: 100, longRunMiles: 14, qualitySessions: 2, keyWorkoutType: 'LT run' },
    { phase: 'peak', weekNumber: 7, targetMilesPercent: 100, longRunMiles: 15, qualitySessions: 2, keyWorkoutType: 'VO2max' },
    { phase: 'peak', weekNumber: 8, targetMilesPercent: 70, longRunMiles: 10, qualitySessions: 1, notes: 'Recovery week' },
    { phase: 'peak', weekNumber: 9, targetMilesPercent: 100, longRunMiles: 14, qualitySessions: 2, keyWorkoutType: 'LT run' },
    { phase: 'taper', weekNumber: 10, targetMilesPercent: 80, longRunMiles: 12, qualitySessions: 2 },
    { phase: 'taper', weekNumber: 11, targetMilesPercent: 60, longRunMiles: 8, qualitySessions: 1 },
    { phase: 'taper', weekNumber: 12, targetMilesPercent: 40, longRunMiles: 'reduced', qualitySessions: 0, notes: 'Race week' },
  ],
  taperWeeks: 3,
  suitableFor: 'Experienced half marathoners wanting to optimize performance',
  requiredWeeklyMileage: 30,
};

// Collection of all standard plans
export const standardPlans: StandardPlanTemplate[] = [
  pfitz18_55,
  pfitz12_55,
  hansonsBeinner,
  higdonIntermediate1,
  daniels2Q,
  pfitz12_47HM,
];

// Get plans suitable for a runner's current fitness
export function getSuitablePlans(
  currentWeeklyMileage: number,
  raceDistance: 'marathon' | 'half_marathon' | '10K' | '5K',
  availableWeeks: number,
): StandardPlanTemplate[] {
  return standardPlans.filter(plan =>
    plan.raceDistance === raceDistance &&
    plan.weeks <= availableWeeks &&
    plan.requiredWeeklyMileage <= currentWeeklyMileage
  );
}

// Get a specific plan by ID
export function getStandardPlan(planId: string): StandardPlanTemplate | undefined {
  return standardPlans.find(p => p.id === planId);
}

// Get plans by author
export function getPlansByAuthor(author: string): StandardPlanTemplate[] {
  return standardPlans.filter(p =>
    p.author.toLowerCase().includes(author.toLowerCase())
  );
}
