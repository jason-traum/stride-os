-- Add workout preference columns to user_settings table
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS workout_complexity_preference TEXT DEFAULT 'auto' CHECK (workout_complexity_preference IN ('simple', 'detailed', 'advanced', 'auto'));
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS prefer_simple_workouts BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS preferred_workout_types TEXT[]; -- Array of preferred workout types
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coaching_philosophy TEXT CHECK (coaching_philosophy IN ('lydiard', 'pfitzinger', 'daniels', 'hansons', 'mcmillan', 'fitzgerald', 'mixed'));
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS workout_completion_rate DECIMAL(3,2); -- 0.00 to 1.00

-- Create workout preferences history for temporary adjustments
CREATE TABLE IF NOT EXISTS workout_preferences_history (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  temporary_preference TEXT CHECK (temporary_preference IN ('simple', 'detailed', 'advanced')),
  reason TEXT, -- Why the user wanted this adjustment
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_workout_preferences_profile_date ON workout_preferences_history(profile_id, session_date);