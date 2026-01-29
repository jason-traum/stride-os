import { pgTable, text, integer, serial, real, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Re-export all enums from the main schema
export * from './schema-enums';

// Import enums
import {
  workoutTypes, workoutSources, verdicts, wasIntendedOptions, breathingFeels,
  perceivedHeats, caffeineOptions, feltTempOptions, surfaceOptions, shoeCategories,
  daysOfWeek, clothingCategories, temperaturePreferences, outfitRatings,
  extremityRatings, runnerPersonas, genders, timeSincePeakFitnessOptions,
  planAggressivenessOptions, stressLevelOptions, surfacePreferenceOptions,
  workoutVarietyOptions, groupVsSoloOptions, trainByOptions, trainingPhases,
  racePriorities, plannedWorkoutStatuses, workoutTemplateCategories,
  weatherConditions, chatRoles, speedworkExperienceOptions, sleepQualityOptions,
  preferredRunTimeOptions
} from './schema-enums';

// Clothing item table for wardrobe
export const clothingItems = pgTable('clothing_items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category', { enum: clothingCategories }).notNull(),
  warmthRating: integer('warmth_rating').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Shoe table
export const shoes = pgTable('shoes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  category: text('category', { enum: shoeCategories }).notNull(),
  intendedUse: text('intended_use').notNull().default('[]'),
  totalMiles: real('total_miles').notNull().default(0),
  isRetired: boolean('is_retired').notNull().default(false),
  purchaseDate: text('purchase_date'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Workout table
export const workouts = pgTable('workouts', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  distanceMiles: real('distance_miles'),
  durationMinutes: integer('duration_minutes'),
  avgPaceSeconds: integer('avg_pace_seconds'),
  avgHr: integer('avg_hr'),
  maxHr: integer('max_hr'),
  elevationGainFt: integer('elevation_gain_ft'),
  routeName: text('route_name'),
  shoeId: integer('shoe_id').references(() => shoes.id),
  workoutType: text('workout_type', { enum: workoutTypes }).notNull().default('easy'),
  source: text('source', { enum: workoutSources }).notNull().default('manual'),
  notes: text('notes'),
  weatherTempF: integer('weather_temp_f'),
  weatherFeelsLikeF: integer('weather_feels_like_f'),
  weatherHumidityPct: integer('weather_humidity_pct'),
  weatherWindMph: integer('weather_wind_mph'),
  weatherConditions: text('weather_conditions', { enum: weatherConditions }),
  weatherSeverityScore: integer('weather_severity_score'),
  plannedWorkoutId: integer('planned_workout_id'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Assessment table
export const assessments = pgTable('assessments', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().unique().references(() => workouts.id, { onDelete: 'cascade' }),
  verdict: text('verdict', { enum: verdicts }).notNull(),
  wasIntendedWorkout: text('was_intended_workout', { enum: wasIntendedOptions }).notNull().default('yes'),
  issues: text('issues').notNull().default('[]'),
  rpe: integer('rpe').notNull(),
  legsFeel: integer('legs_feel'),
  legsTags: text('legs_tags').notNull().default('[]'),
  breathingFeel: text('breathing_feel', { enum: breathingFeels }),
  perceivedHeat: text('perceived_heat', { enum: perceivedHeats }),
  sleepQuality: integer('sleep_quality'),
  sleepHours: real('sleep_hours'),
  stress: integer('stress'),
  soreness: integer('soreness'),
  mood: integer('mood'),
  lifeTags: text('life_tags').notNull().default('[]'),
  hydration: integer('hydration'),
  hydrationTags: text('hydration_tags').notNull().default('[]'),
  fueling: integer('fueling'),
  underfueled: boolean('underfueled').notNull().default(false),
  caffeine: text('caffeine', { enum: caffeineOptions }),
  alcohol24h: integer('alcohol_24h'),
  illness: integer('illness'),
  stomach: integer('stomach'),
  forgotElectrolytes: boolean('forgot_electrolytes').notNull().default(false),
  windHillsDifficulty: integer('wind_hills_difficulty'),
  feltTemp: text('felt_temp', { enum: feltTempOptions }),
  surface: text('surface', { enum: surfaceOptions }),
  note: text('note'),
  timeOfRun: text('time_of_run'),
  wasWorkday: boolean('was_workday'),
  hoursWorkedBefore: integer('hours_worked_before'),
  workStress: integer('work_stress'),
  mentalEnergyPreRun: text('mental_energy_pre_run'),
  outfitRating: text('outfit_rating', { enum: outfitRatings }),
  handsRating: text('hands_rating', { enum: extremityRatings }),
  faceRating: text('face_rating', { enum: extremityRatings }),
  removedLayers: text('removed_layers'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// UserSettings table
export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  preferredLongRunDay: text('preferred_long_run_day', { enum: daysOfWeek }),
  preferredWorkoutDays: text('preferred_workout_days').notNull().default('[]'),
  weeklyVolumeTargetMiles: integer('weekly_volume_target_miles'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  cityName: text('city_name'),
  heatAcclimatizationScore: integer('heat_acclimatization_score').default(50),
  defaultTargetPaceSeconds: integer('default_target_pace_seconds'),
  coachContext: text('coach_context'),
  temperaturePreference: text('temperature_preference', { enum: temperaturePreferences }).default('neutral'),
  temperaturePreferenceScale: integer('temperature_preference_scale').default(5),
  age: integer('age'),
  gender: text('gender', { enum: genders }),
  heightInches: integer('height_inches'),
  weightLbs: real('weight_lbs'),
  restingHr: integer('resting_hr'),
  yearsRunning: real('years_running'),
  athleticBackground: text('athletic_background'),
  highestWeeklyMileageEver: integer('highest_weekly_mileage_ever'),
  weeksAtHighestMileage: integer('weeks_at_highest_mileage'),
  timeSincePeakFitness: text('time_since_peak_fitness', { enum: timeSincePeakFitnessOptions }),
  currentWeeklyMileage: integer('current_weekly_mileage'),
  currentLongRunMax: integer('current_long_run_max'),
  runsPerWeekCurrent: integer('runs_per_week_current'),
  runsPerWeekTarget: integer('runs_per_week_target'),
  peakWeeklyMileageTarget: integer('peak_weekly_mileage_target'),
  planAggressiveness: text('plan_aggressiveness', { enum: planAggressivenessOptions }),
  qualitySessionsPerWeek: integer('quality_sessions_per_week'),
  openToDoubles: boolean('open_to_doubles').default(false),
  preferredQualityDays: text('preferred_quality_days'),
  requiredRestDays: text('required_rest_days'),
  vdot: real('vdot'),
  easyPaceSeconds: integer('easy_pace_seconds'),
  tempoPaceSeconds: integer('tempo_pace_seconds'),
  thresholdPaceSeconds: integer('threshold_pace_seconds'),
  intervalPaceSeconds: integer('interval_pace_seconds'),
  marathonPaceSeconds: integer('marathon_pace_seconds'),
  halfMarathonPaceSeconds: integer('half_marathon_pace_seconds'),
  injuryHistory: text('injury_history'),
  currentInjuries: text('current_injuries'),
  needsExtraRest: boolean('needs_extra_rest').default(false),
  timeConstraintsNotes: text('time_constraints_notes'),
  typicalSleepHours: real('typical_sleep_hours'),
  stressLevel: text('stress_level', { enum: stressLevelOptions }),
  surfacePreference: text('surface_preference', { enum: surfacePreferenceOptions }),
  workoutVarietyPreference: text('workout_variety_preference', { enum: workoutVarietyOptions }),
  groupVsSolo: text('group_vs_solo', { enum: groupVsSoloOptions }),
  trainBy: text('train_by', { enum: trainByOptions }),
  runnerPersona: text('runner_persona', { enum: runnerPersonas }),
  runnerPersonaNotes: text('runner_persona_notes'),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  onboardingStep: integer('onboarding_step').default(0),
  defaultRunTimeHour: integer('default_run_time_hour').default(7),
  defaultRunTimeMinute: integer('default_run_time_minute').default(0),
  defaultWorkoutDurationMinutes: integer('default_workout_duration_minutes').default(45),

  // ==================== Extended Athlete Profile Fields ====================

  // Workout Type Comfort Levels (1-5 scale: 1=uncomfortable, 5=love it)
  comfortVO2max: integer('comfort_vo2max'),
  comfortTempo: integer('comfort_tempo'),
  comfortHills: integer('comfort_hills'),
  comfortLongRuns: integer('comfort_long_runs'),
  comfortTrackWork: integer('comfort_track_work'),

  // Training History Details
  longestRunEver: integer('longest_run_ever'),
  lastMarathonDate: text('last_marathon_date'),
  lastHalfMarathonDate: text('last_half_marathon_date'),
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
  commonInjuries: text('common_injuries'),

  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Chat messages table
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  role: text('role', { enum: chatRoles }).notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Workout Templates
export const workoutTemplates = pgTable('workout_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category', { enum: workoutTemplateCategories }).notNull(),
  phaseAppropriate: text('phase_appropriate').notNull().default('[]'),
  description: text('description').notNull(),
  structure: text('structure').notNull(),
  targetEffortMin: integer('target_effort_min'),
  targetEffortMax: integer('target_effort_max'),
  typicalDistanceMilesMin: real('typical_distance_miles_min'),
  typicalDistanceMilesMax: real('typical_distance_miles_max'),
  typicalDurationMinutesMin: integer('typical_duration_minutes_min'),
  typicalDurationMinutesMax: integer('typical_duration_minutes_max'),
  purpose: text('purpose'),
  progressionNotes: text('progression_notes'),
  isKeyWorkout: boolean('is_key_workout').default(false),
  intensityLevel: text('intensity_level').default('moderate'),
  isCustom: boolean('is_custom').default(false),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Race Results
export const raceResults = pgTable('race_results', {
  id: serial('id').primaryKey(),
  raceName: text('race_name'),
  date: text('date').notNull(),
  distanceMeters: integer('distance_meters').notNull(),
  distanceLabel: text('distance_label').notNull(),
  finishTimeSeconds: integer('finish_time_seconds').notNull(),
  calculatedVdot: real('calculated_vdot'),
  effortLevel: text('effort_level'),
  conditions: text('conditions'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Races
export const races = pgTable('races', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  date: text('date').notNull(),
  distanceMeters: integer('distance_meters').notNull(),
  distanceLabel: text('distance_label').notNull(),
  priority: text('priority', { enum: racePriorities }).notNull().default('B'),
  targetTimeSeconds: integer('target_time_seconds'),
  targetPaceSecondsPerMile: integer('target_pace_seconds_per_mile'),
  location: text('location'),
  notes: text('notes'),
  trainingPlanGenerated: boolean('training_plan_generated').default(false),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Training Blocks
export const trainingBlocks = pgTable('training_blocks', {
  id: serial('id').primaryKey(),
  raceId: integer('race_id').references(() => races.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phase: text('phase', { enum: trainingPhases }).notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  weekNumber: integer('week_number').notNull(),
  targetMileage: integer('target_mileage'),
  focus: text('focus'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Planned Workouts
export const plannedWorkouts = pgTable('planned_workouts', {
  id: serial('id').primaryKey(),
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
  structure: text('structure'),
  rationale: text('rationale'),
  alternatives: text('alternatives'),
  isKeyWorkout: boolean('is_key_workout').default(false),
  status: text('status', { enum: plannedWorkoutStatuses }).default('scheduled'),
  completedWorkoutId: integer('completed_workout_id').references(() => workouts.id),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Workout Segments
export const workoutSegments = pgTable('workout_segments', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  segmentNumber: integer('segment_number').notNull(),
  segmentType: text('segment_type').notNull(),
  distanceMiles: real('distance_miles'),
  durationSeconds: integer('duration_seconds'),
  paceSecondsPerMile: integer('pace_seconds_per_mile'),
  avgHr: integer('avg_hr'),
  maxHr: integer('max_hr'),
  elevationGainFt: integer('elevation_gain_ft'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Relations (same as SQLite schema)
export const workoutsRelations = relations(workouts, ({ one }) => ({
  shoe: one(shoes, { fields: [workouts.shoeId], references: [shoes.id] }),
  assessment: one(assessments, { fields: [workouts.id], references: [assessments.workoutId] }),
  plannedWorkout: one(plannedWorkouts, { fields: [workouts.plannedWorkoutId], references: [plannedWorkouts.id] }),
}));

export const shoesRelations = relations(shoes, ({ many }) => ({
  workouts: many(workouts),
}));

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  workout: one(workouts, { fields: [assessments.workoutId], references: [workouts.id] }),
}));

export const racesRelations = relations(races, ({ many }) => ({
  trainingBlocks: many(trainingBlocks),
  plannedWorkouts: many(plannedWorkouts),
}));

export const trainingBlocksRelations = relations(trainingBlocks, ({ one, many }) => ({
  race: one(races, { fields: [trainingBlocks.raceId], references: [races.id] }),
  plannedWorkouts: many(plannedWorkouts),
}));

export const plannedWorkoutsRelations = relations(plannedWorkouts, ({ one }) => ({
  race: one(races, { fields: [plannedWorkouts.raceId], references: [races.id] }),
  trainingBlock: one(trainingBlocks, { fields: [plannedWorkouts.trainingBlockId], references: [trainingBlocks.id] }),
  template: one(workoutTemplates, { fields: [plannedWorkouts.templateId], references: [workoutTemplates.id] }),
  completedWorkout: one(workouts, { fields: [plannedWorkouts.completedWorkoutId], references: [workouts.id] }),
}));

export const workoutTemplatesRelations = relations(workoutTemplates, ({ many }) => ({
  plannedWorkouts: many(plannedWorkouts),
}));

export const workoutSegmentsRelations = relations(workoutSegments, ({ one }) => ({
  workout: one(workouts, { fields: [workoutSegments.workoutId], references: [workouts.id] }),
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
export type WorkoutSegment = typeof workoutSegments.$inferSelect;
export type NewWorkoutSegment = typeof workoutSegments.$inferInsert;
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
