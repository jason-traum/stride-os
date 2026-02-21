-- Race-to-Result Linking: Add raceId FK on race_results and status on races
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS race_id INTEGER REFERENCES races(id);
ALTER TABLE races ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'upcoming';
