-- Add per-second cadence stream to workout_streams
ALTER TABLE workout_streams ADD COLUMN cadence TEXT;
