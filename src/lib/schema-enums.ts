// Shared enums for both SQLite and Postgres schemas

// Profile types
export const profileTypes = ['personal', 'demo'] as const;
export type ProfileType = typeof profileTypes[number];

// API Services for usage tracking
export const apiServices = ['strava', 'anthropic', 'intervals', 'open_meteo'] as const;
export type ApiService = typeof apiServices[number];

export const workoutTypes = ['easy', 'steady', 'tempo', 'interval', 'long', 'race', 'recovery', 'cross_train', 'other'] as const;
export const workoutSources = ['manual', 'garmin', 'apple_health', 'demo'] as const;
export const verdicts = ['great', 'good', 'fine', 'rough', 'awful'] as const;
export const wasIntendedOptions = ['yes', 'no', 'partially'] as const;
export const breathingFeels = ['easy', 'controlled', 'hard', 'cooked'] as const;
export const perceivedHeats = ['cool', 'normal', 'hot', 'oppressive'] as const;
export const caffeineOptions = ['none', 'low', 'moderate', 'high'] as const;
export const feltTempOptions = ['cool', 'expected', 'hot'] as const;
export const surfaceOptions = ['dry', 'wet', 'snowy', 'icy'] as const;
export const shoeCategories = ['daily_trainer', 'tempo', 'race', 'trail', 'recovery'] as const;
export const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export const issueOptions = ['bonked', 'cramps', 'gi', 'side_stitch', 'pain', 'mental_drag', 'other'] as const;
export const timeOfRunOptions = ['early_morning', 'morning', 'lunch', 'afternoon', 'evening', 'night'] as const;
export const mentalEnergyOptions = ['fresh', 'okay', 'drained', 'fried'] as const;
export const legsTagOptions = ['poppy', 'normal', 'heavy', 'dead', 'tight_calves', 'tight_hamstrings'] as const;
export const lifeTagOptions = ['travel', 'work_stress', 'poor_sleep_streak'] as const;
export const hydrationTagOptions = ['forgot_bottle', 'dry_air', 'dehydrated'] as const;
export const shoeIntendedUseOptions = ['easy', 'tempo', 'long', 'intervals', 'race'] as const;

export const clothingCategories = [
  'top_short_sleeve', 'top_long_sleeve_thin', 'top_long_sleeve_standard', 'top_long_sleeve_warm',
  'outer_quarter_zip', 'outer_shell', 'outer_hoodie',
  'bottom_shorts', 'bottom_half_tights', 'bottom_leggings',
  'gloves_thin', 'gloves_medium', 'gloves_winter',
  'beanie', 'buff', 'socks_thin', 'socks_warm', 'other'
] as const;

export const temperaturePreferences = ['runs_cold', 'neutral', 'runs_hot'] as const;
export const outfitRatings = ['too_cold', 'slightly_cold', 'perfect', 'slightly_warm', 'too_warm'] as const;
export const extremityRatings = ['fine', 'cold', 'painful'] as const;

export const runnerPersonas = ['newer_runner', 'busy_runner', 'self_coached', 'coach_guided', 'type_a_planner', 'data_optimizer', 'other'] as const;
export type RunnerPersona = typeof runnerPersonas[number];

export const coachPersonas = ['encouraging', 'analytical', 'tough_love', 'zen', 'hype'] as const;
export type CoachPersona = typeof coachPersonas[number];

// AI Provider options
export const aiProviders = ['claude', 'openai'] as const;
export type AIProvider = typeof aiProviders[number];

export const claudeModels = ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'] as const;
export type ClaudeModel = typeof claudeModels[number];

export const openaiModels = ['gpt-5.2', 'gpt-5.2-chat-latest', 'gpt-5.2-pro', 'gpt-4o', 'gpt-4o-mini'] as const;
export type OpenAIModel = typeof openaiModels[number];

export const genders = ['male', 'female', 'other'] as const;
export const timeSincePeakFitnessOptions = ['current', '3_months', '6_months', '1_year', '2_plus_years'] as const;
export const planAggressivenessOptions = ['conservative', 'moderate', 'aggressive'] as const;
export const stressLevelOptions = ['low', 'moderate', 'high', 'very_high'] as const;
export const surfacePreferenceOptions = ['road', 'trail', 'track', 'mixed'] as const;
export const workoutVarietyOptions = ['simple', 'moderate', 'varied'] as const;
export const groupVsSoloOptions = ['solo', 'group', 'either'] as const;
export const trainByOptions = ['pace', 'heart_rate', 'feel', 'mixed'] as const;
export const trainingPhases = ['base', 'build', 'peak', 'taper', 'recovery'] as const;
export const racePriorities = ['A', 'B', 'C'] as const;
export const plannedWorkoutStatuses = ['scheduled', 'completed', 'skipped', 'modified'] as const;
export const workoutTemplateCategories = ['easy', 'long', 'medium_long', 'tempo', 'threshold', 'vo2max', 'fartlek', 'hills', 'recovery', 'race_specific'] as const;

export const weatherConditions = ['clear', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunderstorm'] as const;
export const chatRoles = ['user', 'assistant'] as const;

// Extended profile enums
export const speedworkExperienceOptions = ['none', 'beginner', 'intermediate', 'advanced'] as const;
export const sleepQualityOptions = ['poor', 'fair', 'good', 'excellent'] as const;
export const preferredRunTimeOptions = ['early_morning', 'morning', 'midday', 'evening', 'flexible'] as const;
export const commonInjuryOptions = ['shin_splints', 'it_band', 'plantar_fasciitis', 'achilles', 'knee', 'hip', 'none'] as const;

// Run classification categories (for auto-categorization)
export const runCategories = ['easy', 'recovery', 'long_run', 'tempo', 'threshold', 'progression', 'fartlek', 'intervals', 'hill_repeats', 'race', 'shakeout', 'cross_training'] as const;
export type RunCategory = typeof runCategories[number];

// Coach action types (for audit log)
export const coachActionTypes = ['plan_modification', 'workout_adjustment', 'schedule_change', 'mode_activation', 'recommendation'] as const;
export type CoachActionType = typeof coachActionTypes[number];

// Coach modes
export const coachModes = ['advisor', 'autopilot'] as const;
export type CoachMode = typeof coachModes[number];

// GPS/Data quality levels
export const dataQualityLevels = ['good', 'noisy', 'missing'] as const;
export type DataQualityLevel = typeof dataQualityLevels[number];

// HR quality levels
export const hrQualityLevels = ['good', 'dropouts', 'erratic', 'missing'] as const;
export type HRQualityLevel = typeof hrQualityLevels[number];

// Pace reliability levels
export const paceReliabilityLevels = ['good', 'treadmill', 'gps_drift'] as const;
export type PaceReliabilityLevel = typeof paceReliabilityLevels[number];

// Body regions for soreness map
export const bodyRegions = ['left_calf', 'right_calf', 'left_shin', 'right_shin', 'left_quad', 'right_quad', 'left_hamstring', 'right_hamstring', 'left_knee', 'right_knee', 'left_hip', 'right_hip', 'left_ankle', 'right_ankle', 'left_foot', 'right_foot', 'lower_back', 'upper_back', 'left_glute', 'right_glute', 'left_it_band', 'right_it_band'] as const;
export type BodyRegion = typeof bodyRegions[number];

// Soreness severity levels (0-3)
export const sorenessSeverityLevels = [0, 1, 2, 3] as const;
export type SorenessSeverity = typeof sorenessSeverityLevels[number];

// Type exports
export type WorkoutType = typeof workoutTypes[number];
export type WorkoutSource = typeof workoutSources[number];
export type Verdict = typeof verdicts[number];
export type ShoeCategory = typeof shoeCategories[number];
export type ChatRole = typeof chatRoles[number];
export type ClothingCategory = typeof clothingCategories[number];
export type TemperaturePreference = typeof temperaturePreferences[number];
export type OutfitRating = typeof outfitRatings[number];
export type ExtremityRating = typeof extremityRatings[number];
export type Gender = typeof genders[number];
export type TimeSincePeakFitness = typeof timeSincePeakFitnessOptions[number];
export type PlanAggressiveness = typeof planAggressivenessOptions[number];
export type StressLevel = typeof stressLevelOptions[number];
export type SurfacePreference = typeof surfacePreferenceOptions[number];
export type WorkoutVariety = typeof workoutVarietyOptions[number];
export type GroupVsSolo = typeof groupVsSoloOptions[number];
export type TrainBy = typeof trainByOptions[number];
export type TrainingPhase = typeof trainingPhases[number];
export type RacePriority = typeof racePriorities[number];
export type PlannedWorkoutStatus = typeof plannedWorkoutStatuses[number];
export type WorkoutTemplateCategory = typeof workoutTemplateCategories[number];

// Extended profile types
export type SpeedworkExperience = typeof speedworkExperienceOptions[number];
export type SleepQuality = typeof sleepQualityOptions[number];
export type PreferredRunTime = typeof preferredRunTimeOptions[number];
export type CommonInjury = typeof commonInjuryOptions[number];
