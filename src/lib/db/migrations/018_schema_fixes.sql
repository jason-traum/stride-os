-- Fix schema mismatches between SQLite and Postgres

-- Add coachContext table (existed in SQLite schema, missing from Postgres)
CREATE TABLE IF NOT EXISTS coach_context (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  context_type TEXT NOT NULL,
  context_key TEXT NOT NULL,
  context_value TEXT NOT NULL,
  importance TEXT NOT NULL DEFAULT 'medium',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
