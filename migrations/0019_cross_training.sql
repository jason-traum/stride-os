-- Add cross-training activity type and intensity columns to workouts
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS activity_type TEXT NOT NULL DEFAULT 'run';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS cross_train_intensity TEXT;
