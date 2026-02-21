-- Post-Run Reflections: lightweight post-run check-in (alternative to full Assessment)
CREATE TABLE IF NOT EXISTS post_run_reflections (
  id SERIAL PRIMARY KEY,
  workout_id INTEGER NOT NULL UNIQUE REFERENCES workouts(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES profiles(id),
  rpe INTEGER NOT NULL,
  shoe_comfort TEXT,
  pain_report TEXT,
  pain_location TEXT,
  energy_level TEXT,
  contextual_answer TEXT,
  quick_note TEXT,
  created_at TEXT NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_run_reflections_workout_id ON post_run_reflections(workout_id);
CREATE INDEX idx_post_run_reflections_profile_id ON post_run_reflections(profile_id);
