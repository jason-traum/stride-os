-- Add cross-training activity type and intensity columns to workouts
ALTER TABLE workouts ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'run';
ALTER TABLE workouts ADD COLUMN cross_train_intensity TEXT;
