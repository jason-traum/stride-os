-- Master Plans Schema
-- This creates the database tables needed for the master plan system

-- Master plans table - stores high-level training plans
CREATE TABLE IF NOT EXISTS master_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  goal_race_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  phases TEXT NOT NULL, -- JSON array of phase objects
  weekly_targets TEXT NOT NULL, -- JSON array of weekly target objects
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES runner_profiles(id),
  FOREIGN KEY (goal_race_id) REFERENCES races(id)
);

-- Index for quick lookups
CREATE INDEX idx_master_plans_profile ON master_plans(profile_id);
CREATE INDEX idx_master_plans_goal_race ON master_plans(goal_race_id);

-- Sample data structure for phases column:
-- [
--   {
--     "name": "base",
--     "startDate": "2024-01-01",
--     "endDate": "2024-02-15",
--     "weeklyMileageTarget": 30,
--     "focus": "Aerobic development",
--     "description": "Building aerobic base with easy miles"
--   }
-- ]

-- Sample data structure for weekly_targets column:
-- [
--   {
--     "weekNumber": 1,
--     "weekStartDate": "2024-01-01",
--     "totalMiles": 25,
--     "longRunMiles": 8,
--     "qualitySessions": 1,
--     "cutbackWeek": false,
--     "notes": "First week - ease into training"
--   }
-- ]

-- Preference patterns table for tracking what actually works
CREATE TABLE IF NOT EXISTS preference_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  pattern_type TEXT NOT NULL, -- workout_completion, performance_peak, motivation_driver, struggle_point
  pattern_data TEXT NOT NULL, -- JSON object with pattern details
  confidence REAL NOT NULL DEFAULT 0.5, -- 0-1 confidence score
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES runner_profiles(id)
);

-- Index for pattern lookups
CREATE INDEX idx_preference_patterns_profile ON preference_patterns(profile_id);
CREATE INDEX idx_preference_patterns_type ON preference_patterns(profile_id, pattern_type);