// Rich descriptions for profile option sets
// Used by DescriptiveChipSelector and DescriptiveMultiChipSelector components

export interface OptionDescription {
  value: string;
  label: string;
  shortDesc: string;
  longDesc?: string;
}

// ==================== Training Philosophy ====================

export const trainingPhilosophyDescriptions: OptionDescription[] = [
  {
    value: 'pfitzinger',
    label: 'Pfitzinger',
    shortDesc: 'Structured plans with mid-long runs and scheduled recovery',
    longDesc: 'Pete Pfitzinger\'s approach uses structured plans with 2 quality sessions per week, mid-long runs during the week, and scheduled recovery/down weeks. Great for runners who like clear structure and predictable progression.',
  },
  {
    value: 'hansons',
    label: 'Hansons',
    shortDesc: 'Higher volume, shorter long runs, cumulative fatigue',
    longDesc: 'The Hansons method caps long runs at ~16 miles but uses higher weekly volume. The idea is that cumulative fatigue from consistent running simulates late-race conditions better than one massive long run.',
  },
  {
    value: 'daniels',
    label: 'Daniels',
    shortDesc: 'Science-driven VDOT paces, 4-week mesocycles',
    longDesc: 'Jack Daniels\' approach assigns specific paces (Easy, Marathon, Threshold, Interval, Repetition) based on your VDOT fitness score. Training progresses through structured 4-week mesocycles with clear purpose for every workout.',
  },
  {
    value: 'lydiard',
    label: 'Lydiard',
    shortDesc: 'Build a massive aerobic base, then layer in speed',
    longDesc: 'Arthur Lydiard\'s classic periodization: spend weeks building a huge aerobic base with high-volume easy running, then progressively introduce hills, tempo, and speed work. The base phase is the foundation for everything.',
  },
  {
    value: 'polarized',
    label: 'Polarized',
    shortDesc: '80% very easy, 20% very hard, avoid the middle',
    longDesc: 'Polarized training means ~80% of your running is truly easy (conversational pace) and ~20% is hard (threshold or faster). You deliberately avoid the moderate "grey zone" that\'s too hard to recover from but too easy to stimulate top-end fitness.',
  },
  {
    value: 'balanced',
    label: 'Balanced / Mixed',
    shortDesc: 'Blend the best ideas from multiple approaches',
    longDesc: 'Take what works from multiple philosophies and blend them based on your needs. No strict adherence to one system — the coach picks the best tools for your situation.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Let the coach decide based on your profile',
  },
];

// ==================== Plan Aggressiveness ====================

export const planAggressivenessDescriptions: OptionDescription[] = [
  {
    value: 'conservative',
    label: 'Conservative',
    shortDesc: 'Slower buildup, more recovery, lower injury risk',
    longDesc: 'Weekly mileage increases by ~5-8%. Extra recovery weeks. Best if you\'re injury-prone, returning from a break, or prefer a cautious approach.',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    shortDesc: 'Standard progression following the 10% rule',
    longDesc: 'Follows the classic 10% weekly increase rule with regular down weeks. A well-tested middle ground for most runners.',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    shortDesc: 'Faster buildup for experienced runners',
    longDesc: 'Pushes mileage and intensity up faster. Only recommended if you have a strong training base, good injury history, and can handle higher volume.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Coach picks based on your background and goals',
  },
];

// ==================== Long Run Style ====================

export const longRunMaxStyleDescriptions: OptionDescription[] = [
  {
    value: 'traditional',
    label: 'Traditional',
    shortDesc: 'Standard long runs up to 20-22 miles',
    longDesc: 'Classic long run approach with peak long runs of 20-22 miles for marathon training. Steady effort throughout, building time on feet.',
  },
  {
    value: 'hansons_style',
    label: 'Hansons Style',
    shortDesc: 'Capped at ~16 miles, rely on cumulative fatigue',
    longDesc: 'Long runs top out around 16 miles. The theory is that running 16 miles on already-tired legs (from high weekly volume) simulates miles 10-26 of a marathon better than a fresh 22-miler.',
  },
  {
    value: 'progressive',
    label: 'Progressive',
    shortDesc: 'Start easy, finish at marathon pace or faster',
    longDesc: 'Long runs that start easy and build to goal marathon pace (or faster) in the final miles. Teaches your body to run fast on tired legs and builds mental confidence.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Coach decides the best long run approach for you',
  },
];

// ==================== Fatigue Management ====================

export const fatigueManagementDescriptions: OptionDescription[] = [
  {
    value: 'back_off',
    label: 'Back Off',
    shortDesc: 'Reduce volume at the first sign of fatigue',
    longDesc: 'Prioritize recovery over hitting target numbers. If you\'re feeling off, the plan drops volume to prevent overtraining.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    shortDesc: 'Moderate adjustments, push when it makes sense',
    longDesc: 'Some workouts can be toughed out, others should be cut short. The coach reads the situation and adjusts accordingly.',
  },
  {
    value: 'push_through',
    label: 'Push Through',
    shortDesc: 'Stay the course unless something is clearly wrong',
    longDesc: 'Maintain planned volume and intensity even when tired. Only back off for injury risk or illness. Best for experienced runners who know their limits.',
  },
  {
    value: 'modify',
    label: 'Modify',
    shortDesc: 'Swap workout types rather than cutting volume',
    longDesc: 'Instead of skipping workouts, swap them. Tired legs? Replace intervals with tempo. Sore? Do an easy run instead of long run. Keeps volume up while reducing injury risk.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Coach manages fatigue based on your data',
  },
];

// ==================== Down Week Frequency ====================

export const downWeekFrequencyDescriptions: OptionDescription[] = [
  {
    value: 'every_3_weeks',
    label: 'Every 3 Weeks',
    shortDesc: '2 hard weeks, 1 recovery week',
    longDesc: 'More frequent recovery. Good for runners over 40, injury-prone athletes, or those new to higher volume.',
  },
  {
    value: 'every_4_weeks',
    label: 'Every 4 Weeks',
    shortDesc: '3 hard weeks, 1 recovery week — the classic cycle',
    longDesc: 'The standard approach used by most training plans. Three weeks of progressive loading followed by a recovery week at ~70% volume.',
  },
  {
    value: 'as_needed',
    label: 'As Needed',
    shortDesc: 'Coach decides based on how you\'re responding',
    longDesc: 'No fixed schedule. The coach monitors your fatigue, performance, and recovery signals to insert down weeks when your body needs them.',
  },
  {
    value: 'rarely',
    label: 'Rarely',
    shortDesc: 'Minimal planned recovery, consistent volume',
    longDesc: 'For experienced high-mileage runners who maintain steady volume without formal down weeks. Not recommended unless you have years of consistent training.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Coach picks the right recovery rhythm for you',
  },
];

// ==================== Train By ====================

export const trainByDescriptions: OptionDescription[] = [
  {
    value: 'pace',
    label: 'Pace',
    shortDesc: 'Hit specific pace targets for each workout',
    longDesc: 'Workouts prescribed with exact pace ranges (e.g., 8:00-8:20/mi). Requires a GPS watch and works best when you know your current fitness level.',
  },
  {
    value: 'heart_rate',
    label: 'Heart Rate',
    shortDesc: 'Train in heart rate zones for effort control',
    longDesc: 'Workouts prescribed by HR zone (e.g., Zone 2 for easy runs). Automatically adjusts for heat, hills, and fatigue. Requires an HR monitor.',
  },
  {
    value: 'feel',
    label: 'Feel / RPE',
    shortDesc: 'Train by perceived effort without watching numbers',
    longDesc: 'Workouts described by effort level (easy, moderate, hard). Best for runners who want to run without staring at a watch, or who train on varied terrain.',
  },
  {
    value: 'mixed',
    label: 'Mixed',
    shortDesc: 'Combine pace, HR, and feel depending on the workout',
    longDesc: 'Use pace for speed work, HR for easy runs, and feel for recovery. The coach picks the most useful metric for each workout type.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Coach recommends based on your gear and experience',
  },
];

// ==================== Workout Variety ====================

export const workoutVarietyDescriptions: OptionDescription[] = [
  {
    value: 'same',
    label: 'Keep It Simple',
    shortDesc: 'Repeat the same proven workouts',
    longDesc: 'Stick to a small rotation of core workouts (tempo, intervals, long run). Less variety but easier to track progress on specific sessions.',
  },
  {
    value: 'moderate',
    label: 'Some Variety',
    shortDesc: 'Mix it up occasionally while keeping favorites',
    longDesc: 'Core workout rotation with occasional new sessions mixed in. Good balance of trackable progress and keeping things fresh.',
  },
  {
    value: 'lots',
    label: 'Lots of Variety',
    shortDesc: 'Different workouts to keep training interesting',
    longDesc: 'Fartleks, progression runs, cut-downs, cruise intervals, hills, tempo variations — a wide rotation to keep training engaging.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Coach decides how much to mix things up',
  },
];

// ==================== Speedwork Experience ====================

export const speedworkExperienceDescriptions: OptionDescription[] = [
  {
    value: 'none',
    label: 'None',
    shortDesc: 'Never done structured speed work',
  },
  {
    value: 'beginner',
    label: 'Beginner',
    shortDesc: 'Done some strides, fartleks, or basic intervals',
    longDesc: 'You\'ve dabbled with faster running — maybe some strides after easy runs, casual fartleks, or a few track sessions. Still learning what different paces feel like.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    shortDesc: 'Regular tempo runs, intervals, and threshold work',
    longDesc: 'Comfortable with structured workouts like 4x1 mile at threshold, tempo runs, and track intervals. You know your paces and can execute prescribed workouts.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    shortDesc: 'Complex sessions, race-specific workouts, VO2max',
    longDesc: 'Can handle multi-pace sessions (e.g., 2mi tempo + 4x800 + 2mi tempo), cruise intervals, VO2max repeats, and race-specific workouts. Deep understanding of effort zones.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Coach assesses your level from your training data',
  },
];

// ==================== Workout Complexity ====================

export const workoutComplexityDescriptions: OptionDescription[] = [
  {
    value: 'basic',
    label: 'Basic',
    shortDesc: 'Simple workouts: easy runs, tempo, long run',
    longDesc: 'Straightforward workout descriptions. "Run 5 miles easy" or "3 miles at tempo pace." No complex interval structures. Great for runners who want clear, simple instructions.',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    shortDesc: 'Standard intervals, tempo variations, progression runs',
    longDesc: 'Workouts like "4x1mi at threshold with 90s jog" or "10mi long run with last 3 at marathon pace." Standard structured training.',
  },
  {
    value: 'detailed',
    label: 'Detailed',
    shortDesc: 'Multi-pace sessions, ladders, specific race prep',
    longDesc: 'Complex sessions like "1mi WU, 2mi tempo, 4x800 at 5K pace w/400 jog, 2mi tempo, 1mi CD" or altitude/heat-adjusted pacing. For experienced runners who thrive on specificity.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Coach matches complexity to your experience level',
  },
];

// ==================== Coaching Detail Level ====================

export const coachingDetailLevelDescriptions: OptionDescription[] = [
  {
    value: 'minimal',
    label: 'Just the Workout',
    shortDesc: 'Tell me what to do, skip the explanation',
    longDesc: 'Brief workout descriptions with paces/distances. No long explanations of why — just the plan. Best for experienced runners who want efficiency.',
  },
  {
    value: 'moderate',
    label: 'Some Context',
    shortDesc: 'Workout plus a quick note on the purpose',
    longDesc: 'Workout description with a sentence or two about why this session matters in your training. Good balance of information and brevity.',
  },
  {
    value: 'detailed',
    label: 'Full Explanation',
    shortDesc: 'Detailed reasoning, tips, and what to watch for',
    longDesc: 'Complete workout with purpose, execution tips, what to pay attention to, and how it fits into your weekly/monthly plan. Great for learning and understanding your training.',
  },
  {
    value: 'not_sure',
    label: 'Not Sure',
    shortDesc: 'Coach adjusts detail level to the situation',
  },
];

// ==================== Runner Persona ====================

export const runnerPersonaDescriptions: OptionDescription[] = [
  {
    value: 'newer_runner',
    label: 'Newer Runner',
    shortDesc: 'Building a running habit, less than 2 years in',
  },
  {
    value: 'busy_runner',
    label: 'Busy Runner',
    shortDesc: 'Limited time, need efficient training that fits life',
  },
  {
    value: 'self_coached',
    label: 'Self-Coached',
    shortDesc: 'Design my own training, want a sounding board',
  },
  {
    value: 'coach_guided',
    label: 'Coach-Guided',
    shortDesc: 'Prefer to follow a structured plan from the coach',
  },
  {
    value: 'type_a_planner',
    label: 'Type-A Planner',
    shortDesc: 'Love spreadsheets, data, and hitting every target',
  },
  {
    value: 'data_optimizer',
    label: 'Data Optimizer',
    shortDesc: 'Obsessed with metrics, VDOT, training load, etc.',
  },
  {
    value: 'other',
    label: 'Other',
    shortDesc: 'None of these fit — describe yourself in notes',
  },
];

// ==================== Surface Preference ====================

export const surfacePreferenceDescriptions: OptionDescription[] = [
  {
    value: 'road',
    label: 'Road',
    shortDesc: 'Pavement, sidewalks, paved paths',
  },
  {
    value: 'trail',
    label: 'Trail',
    shortDesc: 'Dirt paths, single track, technical terrain',
  },
  {
    value: 'track',
    label: 'Track',
    shortDesc: 'Rubberized track for speed work and intervals',
  },
  {
    value: 'mixed',
    label: 'Mixed',
    shortDesc: 'Variety of surfaces depending on the workout',
  },
];

// ==================== Group vs Solo ====================

export const groupVsSoloDescriptions: OptionDescription[] = [
  {
    value: 'solo',
    label: 'Solo',
    shortDesc: 'Prefer running alone, set my own pace',
  },
  {
    value: 'group',
    label: 'Group',
    shortDesc: 'Love running with others, group runs, clubs',
  },
  {
    value: 'either',
    label: 'Either',
    shortDesc: 'Happy running solo or with a group',
  },
];
