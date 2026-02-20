-- Migration: Add comprehensive Strava data capture fields to workouts
-- These columns store additional data from the Strava API for richer analytics

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_description TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_kudos_count INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_comment_count INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_achievement_count INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_photo_count INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_athlete_count INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_max_speed REAL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_average_cadence REAL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_suffer_score INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_perceived_exertion REAL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_gear_id TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_device_name TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS start_latitude REAL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS start_longitude REAL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS end_latitude REAL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS end_longitude REAL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_is_trainer BOOLEAN;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_is_commute BOOLEAN;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_kudos_last_checked TEXT;
