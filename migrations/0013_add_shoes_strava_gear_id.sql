-- Add strava_gear_id column to shoes table
-- Links shoes to Strava gear for automatic sync and workout linking
ALTER TABLE shoes ADD COLUMN IF NOT EXISTS strava_gear_id TEXT;
