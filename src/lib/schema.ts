import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Enums as const arrays for type safety
export const workoutTypes = ['easy', 'steady', 'tempo', 'interval', 'long', 'race', 'recovery', 'cross_train', 'other'] as const;
export const workoutSources = ['manual', 'garmin', 'apple_health', 'strava', 'intervals', 'demo'] as const;
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

// Clothing/Outfit enums
export const clothingCategories = [
  'top_short_sleeve',
  'top_long_sleeve_thin',
  'top_long_sleeve_standard',
  'top_long_sleeve_warm',
  'outer_quarter_zip',
  'outer_shell',
  'outer_hoodie',
  'bottom_shorts',
  'bottom_half_tights',
  'bottom_leggings',
  'gloves_thin',
  'gloves_medium',
  'gloves_winter',
  'beanie',
  'buff',
  'socks_thin',
  'socks_warm',
  'other'
] as const;

export const temperaturePreferences = ['runs_cold', 'neutral', 'runs_hot'] as const;
export const outfitRatings = ['too_cold', 'slightly_cold', 'perfect', 'slightly_warm', 'too_warm'] as const;
export const extremityRatings = ['fine', 'cold', 'painful'] as const;

// Coach persona styles
export const coachPersonas = ['encouraging', 'analytical', 'tough_love', 'zen', 'hype'] as const;

// Runner persona types
export const runnerPersonas = ['newer_runner', 'busy_runner', 'self_coached', 'coach_guided', 'type_a_planner', 'data_optimizer', 'other'] as const;
export type RunnerPersona = typeof runnerPersonas[number];

// Training Intelligence enums
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

// Extended profile enums
export const speedworkExperienceOptions = ['none', 'beginner', 'intermediate', 'advanced'] as const;
export const sleepQualityOptions = ['poor', 'fair', 'good', 'excellent'] as const;
export const preferredRunTimeOptions = ['early_morning', 'morning', 'midday', 'evening', 'flexible'] as const;
export const commonInjuryOptions = ['shin_splints', 'it_band', 'plantar_fasciitis', 'achilles', 'knee', 'hip', 'none'] as const;

// Clothing item table for wardrobe
export const clothingItems = sqliteTable('clothing_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category', { enum: clothingCategories }).notNull(),
  warmthRating: integer('warmth_rating').notNull(), // 1-5
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Shoe table
export const shoes = sqliteTable('shoes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  category: text('category', { enum: shoeCategories }).notNull(),
  intendedUse: text('intended_use').notNull().default('[]'), // JSON array
  totalMiles: real('total_miles').notNull().default(0),
  isRetired: integer('is_retired', { mode: 'boolean' }).notNull().default(false),
  purchaseDate: text('purchase_date'), // ISO date string
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Weather condition codes from Open-Meteo
export const weatherConditions = ['clear', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunderstorm'] as const;

// Workout table
export const workouts = sqliteTable('workouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), // ISO date string
  distanceMiles: real('distance_miles'),
  durationMinutes: integer('duration_minutes'),
  avgPaceSeconds: integer('avg_pace_seconds'), // pace per mile in seconds
  avgHr: integer('avg_hr'),
  maxHr: integer('max_hr'),
  elevationGainFt: integer('elevation_gain_ft'),
  routeName: text('route_name'),
  shoeId: integer('shoe_id').references(() => shoes.id),
  workoutType: text('workout_type', { enum: workoutTypes }).notNull().default('easy'),
  source: text('source', { enum: workoutSources }).notNull().default('manual'),
  notes: text('notes'),
  // Weather data captured at run time
  weatherTempF: integer('weather_temp_f'),
  weatherFeelsLikeF: integer('weather_feels_like_f'),
  weatherHumidityPct: integer('weather_humidity_pct'),
  weatherWindMph: integer('weather_wind_mph'),
  weatherConditions: text('weather_conditions', { enum: weatherConditions }),
  weatherSeverityScore: integer('weather_severity_score'),
  // Link to planned workout (if this was a scheduled workout)
  plannedWorkoutId: integer('planned_workout_id'),
  // External integrations
  stravaActivityId: integer('strava_activity_id'),
  intervalsActivityId: text('intervals_activity_id'), // Intervals.icu activity ID (string)
  avgHeartRate: integer('avg_heart_rate'),
  elevationGainFeet: integer('elevation_gain_feet'),
  trainingLoad: integer('training_load'), // From Intervals.icu or calculated
  // New fields for dreamy features
  autoCategory: text('auto_category'), // System-detected run category
  category: text('category'), // User-confirmed category (if different from auto)
  autoSummary: text('auto_summary'), // AI-generated one-line description
  aiExplanation: text('ai_explanation'), // "Why this felt hard" explanation
  qualityRatio: real('quality_ratio'), // Fraction of time at/above tempo effort
  trimp: real('trimp'), // Training impulse score
  executionScore: integer('execution_score'), // 0-100 execution score
  executionDetails: text('execution_details'), // JSON component breakdown
  dataQualityFlags: text('data_quality_flags'), // JSON data integrity flags
  routeFingerprint: text('route_fingerprint'), // JSON for route matching
  routeId: integer('route_id'), // FK to canonical route (added after table definition)
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Assessment table (linked 1:1 with Workout)
export const assessments = sqliteTable('assessments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workoutId: integer('workout_id').notNull().unique().references(() => workouts.id, { onDelete: 'cascade' }),
  verdict: text('verdict', { enum: verdicts }).notNull(),
  wasIntendedWorkout: text('was_intended_workout', { enum: wasIntendedOptions }).notNull().default('yes'),
  issues: text('issues').notNull().default('[]'), // JSON array
  rpe: integer('rpe').notNull(), // 1-10
  legsFeel: integer('legs_feel'), // 0-10
  legsTags: text('legs_tags').notNull().default('[]'), // JSON array
  breathingFeel: text('breathing_feel', { enum: breathingFeels }),
  perceivedHeat: text('perceived_heat', { enum: perceivedHeats }),
  sleepQuality: integer('sleep_quality'), // 0-10
  sleepHours: real('sleep_hours'),
  stress: integer('stress'), // 0-10
  soreness: integer('soreness'), // 0-10
  mood: integer('mood'), // 0-10
  lifeTags: text('life_tags').notNull().default('[]'), // JSON array
  hydration: integer('hydration'), // 0-10
  hydrationTags: text('hydration_tags').notNull().default('[]'), // JSON array
  fueling: integer('fueling'), // 0-10
  underfueled: integer('underfueled', { mode: 'boolean' }).notNull().default(false),
  caffeine: text('caffeine', { enum: caffeineOptions }),
  alcohol24h: integer('alcohol_24h'), // 0-10
  illness: integer('illness'), // 0-10
  stomach: integer('stomach'), // 0-10
  forgotElectrolytes: integer('forgot_electrolytes', { mode: 'boolean' }).notNull().default(false),
  windHillsDifficulty: integer('wind_hills_difficulty'), // 0-10
  feltTemp: text('felt_temp', { enum: feltTempOptions }),
  surface: text('surface', { enum: surfaceOptions }),
  note: text('note'),
  // Schedule context fields
  timeOfRun: text('time_of_run', { enum: timeOfRunOptions }),
  wasWorkday: integer('was_workday', { mode: 'boolean' }),
  hoursWorkedBefore: integer('hours_worked_before'),
  workStress: integer('work_stress'), // 0-10
  mentalEnergyPreRun: text('mental_energy_pre_run', { enum: mentalEnergyOptions }),
  // Outfit feedback fields
  outfitRating: text('outfit_rating', { enum: outfitRatings }),
  handsRating: text('hands_rating', { enum: extremityRatings }),
  faceRating: text('face_rating', { enum: extremityRatings }),
  removedLayers: text('removed_layers'), // What they took off mid-run
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// UserSettings table
export const userSettings = sqliteTable('user_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  preferredLongRunDay: text('preferred_long_run_day', { enum: daysOfWeek }),
  preferredWorkoutDays: text('preferred_workout_days').notNull().default('[]'), // JSON array
  weeklyVolumeTargetMiles: integer('weekly_volume_target_miles'),
  // Location for weather
  latitude: real('latitude'),
  longitude: real('longitude'),
  cityName: text('city_name'),
  // Heat acclimatization
  heatAcclimatizationScore: integer('heat_acclimatization_score').default(50),
  // Default target pace for pace calculator (seconds per mile)
  defaultTargetPaceSeconds: integer('default_target_pace_seconds'),
  // Coach context notes (e.g., "User prefers morning runs, training for spring marathon")
  coachContext: text('coach_context'),
  // Coach personalization
  coachName: text('coach_name').default('Coach'),
  coachColor: text('coach_color').default('blue'), // blue, green, purple, orange, red, teal
  coachPersona: text('coach_persona', { enum: coachPersonas }).default('encouraging'),
  // Temperature preference for outfit recommendations (legacy enum)
  temperaturePreference: text('temperature_preference', { enum: temperaturePreferences }).default('neutral'),
  // Temperature preference scale 1-9 (1=runs very cold, 5=neutral, 9=runs very hot)
  temperaturePreferenceScale: integer('temperature_preference_scale').default(5),

  // ==================== Training Intelligence Fields ====================

  // Bio
  age: integer('age'),
  gender: text('gender', { enum: genders }),
  heightInches: integer('height_inches'),
  weightLbs: real('weight_lbs'),
  restingHr: integer('resting_hr'),

  // Training Background
  yearsRunning: real('years_running'),
  athleticBackground: text('athletic_background'), // Free text description
  highestWeeklyMileageEver: integer('highest_weekly_mileage_ever'),
  weeksAtHighestMileage: integer('weeks_at_highest_mileage'),
  timeSincePeakFitness: text('time_since_peak_fitness', { enum: timeSincePeakFitnessOptions }),

  // Current Training State
  currentWeeklyMileage: integer('current_weekly_mileage'),
  currentLongRunMax: integer('current_long_run_max'),
  runsPerWeekCurrent: integer('runs_per_week_current'),
  runsPerWeekTarget: integer('runs_per_week_target'),
  peakWeeklyMileageTarget: integer('peak_weekly_mileage_target'),

  // Training Preferences
  planAggressiveness: text('plan_aggressiveness', { enum: planAggressivenessOptions }),
  qualitySessionsPerWeek: integer('quality_sessions_per_week'),
  openToDoubles: integer('open_to_doubles', { mode: 'boolean' }).default(false),
  preferredQualityDays: text('preferred_quality_days'), // JSON array of days
  requiredRestDays: text('required_rest_days'), // JSON array of days

  // Pacing (calculated from VDOT or entered manually)
  vdot: real('vdot'),
  easyPaceSeconds: integer('easy_pace_seconds'),
  tempoPaceSeconds: integer('tempo_pace_seconds'),
  thresholdPaceSeconds: integer('threshold_pace_seconds'),
  intervalPaceSeconds: integer('interval_pace_seconds'),
  marathonPaceSeconds: integer('marathon_pace_seconds'),
  halfMarathonPaceSeconds: integer('half_marathon_pace_seconds'),

  // Personal Factors
  injuryHistory: text('injury_history'), // Free text
  currentInjuries: text('current_injuries'), // Free text
  needsExtraRest: integer('needs_extra_rest', { mode: 'boolean' }).default(false),
  timeConstraintsNotes: text('time_constraints_notes'),
  typicalSleepHours: real('typical_sleep_hours'),
  stressLevel: text('stress_level', { enum: stressLevelOptions }),

  // Training Style
  surfacePreference: text('surface_preference', { enum: surfacePreferenceOptions }),
  workoutVarietyPreference: text('workout_variety_preference', { enum: workoutVarietyOptions }),
  groupVsSolo: text('group_vs_solo', { enum: groupVsSoloOptions }),
  trainBy: text('train_by', { enum: trainByOptions }),

  // Runner Persona
  runnerPersona: text('runner_persona', { enum: runnerPersonas }),
  runnerPersonaNotes: text('runner_persona_notes'), // For "other" explanation

  // Onboarding
  onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).default(false),
  onboardingStep: integer('onboarding_step').default(0),

  // Default run preferences
  defaultRunTimeHour: integer('default_run_time_hour').default(7), // 0-23
  defaultRunTimeMinute: integer('default_run_time_minute').default(0), // 0-59
  defaultWorkoutDurationMinutes: integer('default_workout_duration_minutes').default(45),

  // ==================== Extended Athlete Profile Fields ====================

  // Workout Type Comfort Levels (1-5 scale: 1=uncomfortable, 5=love it)
  comfortVO2max: integer('comfort_vo2max'),
  comfortTempo: integer('comfort_tempo'),
  comfortHills: integer('comfort_hills'),
  comfortLongRuns: integer('comfort_long_runs'),
  comfortTrackWork: integer('comfort_track_work'),

  // Training History Details
  longestRunEver: integer('longest_run_ever'), // miles
  lastMarathonDate: text('last_marathon_date'), // ISO date
  lastHalfMarathonDate: text('last_half_marathon_date'), // ISO date
  speedworkExperience: text('speedwork_experience', { enum: speedworkExperienceOptions }),

  // Enhanced Lifestyle
  sleepQuality: text('sleep_quality', { enum: sleepQualityOptions }),
  preferredRunTime: text('preferred_run_time', { enum: preferredRunTimeOptions }),
  weekdayAvailabilityMinutes: integer('weekday_availability_minutes'),
  weekendAvailabilityMinutes: integer('weekend_availability_minutes'),

  // Weather Sensitivity (1-5 scale)
  heatSensitivity: integer('heat_sensitivity'),
  coldSensitivity: integer('cold_sensitivity'),

  // Race History PRs (in seconds)
  marathonPR: integer('marathon_pr_seconds'),
  halfMarathonPR: integer('half_marathon_pr_seconds'),
  tenKPR: integer('ten_k_pr_seconds'),
  fiveKPR: integer('five_k_pr_seconds'),

  // Common injuries (JSON array)
  commonInjuries: text('common_injuries'), // JSON array of injury types

  // ==================== External Integrations ====================

  // Strava Integration
  stravaAthleteId: integer('strava_athlete_id'),
  stravaAccessToken: text('strava_access_token'),
  stravaRefreshToken: text('strava_refresh_token'),
  stravaTokenExpiresAt: integer('strava_token_expires_at'), // Unix timestamp
  stravaLastSyncAt: text('strava_last_sync_at'), // ISO date
  stravaAutoSync: integer('strava_auto_sync', { mode: 'boolean' }).default(true),

  // Intervals.icu Integration
  intervalsAthleteId: text('intervals_athlete_id'), // Intervals.icu athlete ID (string like "i12345")
  intervalsApiKey: text('intervals_api_key'), // API key from Intervals.icu settings
  intervalsLastSyncAt: text('intervals_last_sync_at'), // ISO date
  intervalsAutoSync: integer('intervals_auto_sync', { mode: 'boolean' }).default(true),

  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Chat message roles
export const chatRoles = ['user', 'assistant'] as const;

// Chat messages table for conversation history
export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role: text('role', { enum: chatRoles }).notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// ==================== Training Intelligence Tables ====================

// Workout Templates - Library of workout types
export const workoutTemplates = sqliteTable('workout_templates', {
  id: text('id').primaryKey(), // e.g., 'easy_long_run', 'yasso_800s'
  name: text('name').notNull(),
  category: text('category', { enum: workoutTemplateCategories }).notNull(),
  phaseAppropriate: text('phase_appropriate').notNull().default('[]'), // JSON array of phases
  description: text('description').notNull(),
  structure: text('structure').notNull(), // JSON workout structure
  targetEffortMin: integer('target_effort_min'), // 0-100
  targetEffortMax: integer('target_effort_max'),
  typicalDistanceMilesMin: real('typical_distance_miles_min'),
  typicalDistanceMilesMax: real('typical_distance_miles_max'),
  typicalDurationMinutesMin: integer('typical_duration_minutes_min'),
  typicalDurationMinutesMax: integer('typical_duration_minutes_max'),
  purpose: text('purpose'),
  progressionNotes: text('progression_notes'),
  isKeyWorkout: integer('is_key_workout', { mode: 'boolean' }).default(false),
  intensityLevel: text('intensity_level').default('moderate'), // easy, moderate, hard, very_hard
  isCustom: integer('is_custom', { mode: 'boolean' }).default(false), // User-created templates
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Race Results - Historical races for VDOT calculation
export const raceResults = sqliteTable('race_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  raceName: text('race_name'),
  date: text('date').notNull(),
  distanceMeters: integer('distance_meters').notNull(),
  distanceLabel: text('distance_label').notNull(), // '5K', 'marathon', etc.
  finishTimeSeconds: integer('finish_time_seconds').notNull(),
  calculatedVdot: real('calculated_vdot'),
  effortLevel: text('effort_level', { enum: ['all_out', 'hard', 'moderate', 'easy'] }),
  conditions: text('conditions'), // JSON: weather, course notes
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Races - Upcoming goal races
export const races = sqliteTable('races', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  date: text('date').notNull(),
  distanceMeters: integer('distance_meters').notNull(),
  distanceLabel: text('distance_label').notNull(),
  priority: text('priority', { enum: racePriorities }).notNull().default('B'),
  targetTimeSeconds: integer('target_time_seconds'),
  targetPaceSecondsPerMile: integer('target_pace_seconds_per_mile'),
  location: text('location'),
  notes: text('notes'),
  trainingPlanGenerated: integer('training_plan_generated', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Training Blocks - Phases within a training plan
export const trainingBlocks = sqliteTable('training_blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  raceId: integer('race_id').references(() => races.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phase: text('phase', { enum: trainingPhases }).notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  weekNumber: integer('week_number').notNull(),
  targetMileage: integer('target_mileage'),
  focus: text('focus'), // e.g., "aerobic base", "VO2max development"
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Planned Workouts - Future scheduled workouts
export const plannedWorkouts = sqliteTable('planned_workouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  raceId: integer('race_id').references(() => races.id, { onDelete: 'cascade' }),
  trainingBlockId: integer('training_block_id').references(() => trainingBlocks.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  templateId: text('template_id').references(() => workoutTemplates.id),
  workoutType: text('workout_type', { enum: workoutTypes }).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  targetDistanceMiles: real('target_distance_miles'),
  targetDurationMinutes: integer('target_duration_minutes'),
  targetPaceSecondsPerMile: integer('target_pace_seconds_per_mile'),
  structure: text('structure'), // JSON for intervals, segments
  rationale: text('rationale'), // Why this workout on this day
  alternatives: text('alternatives'), // JSON array of alternative template IDs
  isKeyWorkout: integer('is_key_workout', { mode: 'boolean' }).default(false),
  status: text('status', { enum: plannedWorkoutStatuses }).default('scheduled'),
  completedWorkoutId: integer('completed_workout_id').references(() => workouts.id),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Relations
export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  shoe: one(shoes, {
    fields: [workouts.shoeId],
    references: [shoes.id],
  }),
  assessment: one(assessments, {
    fields: [workouts.id],
    references: [assessments.workoutId],
  }),
  plannedWorkout: one(plannedWorkouts, {
    fields: [workouts.plannedWorkoutId],
    references: [plannedWorkouts.id],
  }),
  segments: many(workoutSegments),
}));

export const shoesRelations = relations(shoes, ({ many }) => ({
  workouts: many(workouts),
}));

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  workout: one(workouts, {
    fields: [assessments.workoutId],
    references: [workouts.id],
  }),
}));

// Training Intelligence Relations
export const racesRelations = relations(races, ({ many }) => ({
  trainingBlocks: many(trainingBlocks),
  plannedWorkouts: many(plannedWorkouts),
}));

export const trainingBlocksRelations = relations(trainingBlocks, ({ one, many }) => ({
  race: one(races, {
    fields: [trainingBlocks.raceId],
    references: [races.id],
  }),
  plannedWorkouts: many(plannedWorkouts),
}));

export const plannedWorkoutsRelations = relations(plannedWorkouts, ({ one }) => ({
  race: one(races, {
    fields: [plannedWorkouts.raceId],
    references: [races.id],
  }),
  trainingBlock: one(trainingBlocks, {
    fields: [plannedWorkouts.trainingBlockId],
    references: [trainingBlocks.id],
  }),
  template: one(workoutTemplates, {
    fields: [plannedWorkouts.templateId],
    references: [workoutTemplates.id],
  }),
  completedWorkout: one(workouts, {
    fields: [plannedWorkouts.completedWorkoutId],
    references: [workouts.id],
  }),
}));

export const workoutTemplatesRelations = relations(workoutTemplates, ({ many }) => ({
  plannedWorkouts: many(plannedWorkouts),
}));

// Workout Segments - Track splits/intervals within a workout
export const workoutSegments = sqliteTable('workout_segments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workoutId: integer('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  segmentNumber: integer('segment_number').notNull(), // Order within workout
  segmentType: text('segment_type', { enum: ['warmup', 'work', 'recovery', 'cooldown', 'steady'] }).notNull(),
  distanceMiles: real('distance_miles'),
  durationSeconds: integer('duration_seconds'),
  paceSecondsPerMile: integer('pace_seconds_per_mile'),
  avgHr: integer('avg_hr'),
  maxHr: integer('max_hr'),
  elevationGainFt: integer('elevation_gain_ft'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

export const workoutSegmentsRelations = relations(workoutSegments, ({ one }) => ({
  workout: one(workouts, {
    fields: [workoutSegments.workoutId],
    references: [workouts.id],
  }),
}));

// ==================== New Feature Tables ====================

// Canonical Routes - Detected running routes for progress tracking
export const canonicalRoutes = sqliteTable('canonical_routes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  fingerprint: text('fingerprint').notNull(), // JSON: startLatLng, endLatLng, distance, elevationGain, boundingBox
  runCount: integer('run_count').notNull().default(1),
  bestTimeSeconds: integer('best_time_seconds'),
  bestPaceSeconds: integer('best_pace_seconds'),
  averageTimeSeconds: integer('average_time_seconds'),
  averagePaceSeconds: integer('average_pace_seconds'),
  totalElevationGain: integer('total_elevation_gain'),
  distanceMiles: real('distance_miles'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Coach Actions - Audit log for coach recommendations and changes
export const coachActions = sqliteTable('coach_actions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull().default(new Date().toISOString()),
  actionType: text('action_type').notNull(), // plan_modification, workout_adjustment, schedule_change, mode_activation, recommendation
  description: text('description').notNull(),
  dataSnapshot: text('data_snapshot'), // JSON snapshot of relevant data at time of action
  approved: integer('approved', { mode: 'boolean' }), // null = pending, true = approved, false = rejected
  appliedAt: text('applied_at'), // When the action was actually applied
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Soreness Entries - Body region soreness tracking
export const sorenessEntries = sqliteTable('soreness_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assessmentId: integer('assessment_id').references(() => assessments.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  bodyRegion: text('body_region').notNull(), // left_calf, right_knee, etc.
  severity: integer('severity').notNull(), // 0=none, 1=mild, 2=moderate, 3=severe
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Coach Settings - User preferences for coach behavior
export const coachSettings = sqliteTable('coach_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mode: text('mode').notNull().default('advisor'), // advisor or autopilot
  autoApproveMinorChanges: integer('auto_approve_minor_changes', { mode: 'boolean' }).default(false),
  travelModeActive: integer('travel_mode_active', { mode: 'boolean' }).default(false),
  travelModeStart: text('travel_mode_start'),
  travelModeEnd: text('travel_mode_end'),
  travelDestination: text('travel_destination'),
  travelHasTreadmill: integer('travel_has_treadmill', { mode: 'boolean' }),
  travelHasGym: integer('travel_has_gym', { mode: 'boolean' }),
  busyWeekActive: integer('busy_week_active', { mode: 'boolean' }).default(false),
  busyWeekReason: text('busy_week_reason'),
  busyWeekStartDate: text('busy_week_start_date'),
  busyWeekEndDate: text('busy_week_end_date'),
  lastWeeklyRecapDate: text('last_weekly_recap_date'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Relations for new tables
export const canonicalRoutesRelations = relations(canonicalRoutes, ({ many }) => ({
  workouts: many(workouts),
}));

export const sorenessEntriesRelations = relations(sorenessEntries, ({ one }) => ({
  assessment: one(assessments, {
    fields: [sorenessEntries.assessmentId],
    references: [assessments.id],
  }),
}));

// Types
export type Shoe = typeof shoes.$inferSelect;
export type NewShoe = typeof shoes.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ClothingItem = typeof clothingItems.$inferSelect;
export type NewClothingItem = typeof clothingItems.$inferInsert;

export type WorkoutType = typeof workoutTypes[number];
export type WorkoutSource = typeof workoutSources[number];
export type Verdict = typeof verdicts[number];
export type ShoeCategory = typeof shoeCategories[number];
export type ChatRole = typeof chatRoles[number];
export type ClothingCategory = typeof clothingCategories[number];
export type TemperaturePreference = typeof temperaturePreferences[number];
export type OutfitRating = typeof outfitRatings[number];
export type ExtremityRating = typeof extremityRatings[number];
export type CoachPersona = typeof coachPersonas[number];

// Workout Segment Types
export type WorkoutSegment = typeof workoutSegments.$inferSelect;
export type NewWorkoutSegment = typeof workoutSegments.$inferInsert;

// Training Intelligence Types
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;
export type RaceResult = typeof raceResults.$inferSelect;
export type NewRaceResult = typeof raceResults.$inferInsert;
export type Race = typeof races.$inferSelect;
export type NewRace = typeof races.$inferInsert;
export type TrainingBlock = typeof trainingBlocks.$inferSelect;
export type NewTrainingBlock = typeof trainingBlocks.$inferInsert;
export type PlannedWorkout = typeof plannedWorkouts.$inferSelect;
export type NewPlannedWorkout = typeof plannedWorkouts.$inferInsert;

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

// New feature types
export type CanonicalRoute = typeof canonicalRoutes.$inferSelect;
export type NewCanonicalRoute = typeof canonicalRoutes.$inferInsert;
export type CoachAction = typeof coachActions.$inferSelect;
export type NewCoachAction = typeof coachActions.$inferInsert;
export type SorenessEntry = typeof sorenessEntries.$inferSelect;
export type NewSorenessEntry = typeof sorenessEntries.$inferInsert;
export type CoachSettingsType = typeof coachSettings.$inferSelect;
export type NewCoachSettings = typeof coachSettings.$inferInsert;
