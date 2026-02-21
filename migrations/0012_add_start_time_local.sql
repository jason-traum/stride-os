-- Add start_time_local column to workouts table
-- Stores the local start time (HH:MM) from Strava's start_date_local
-- Used for time-of-day analysis feature
ALTER TABLE workouts ADD COLUMN start_time_local TEXT;
