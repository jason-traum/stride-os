-- Migration: Add raw workout stream storage table
-- Version: 015
-- Description: Persist distance/time/HR/pace streams for deep segment analysis

CREATE TABLE IF NOT EXISTS workout_streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL UNIQUE,
  profile_id INTEGER,
  source TEXT NOT NULL DEFAULT 'strava',
  sample_count INTEGER NOT NULL DEFAULT 0,
  distance_miles TEXT NOT NULL,
  time_seconds TEXT NOT NULL,
  heartrate TEXT,
  pace_seconds_per_mile TEXT,
  altitude_feet TEXT,
  max_hr INTEGER,
  has_gps_gaps BOOLEAN NOT NULL DEFAULT 0,
  gps_gap_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_workout_streams_workout ON workout_streams(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_streams_profile ON workout_streams(profile_id);
