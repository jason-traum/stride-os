-- Add strava_gear_id column to shoes table for Strava gear sync
-- Links shoes to Strava gear for automatic sync and workout linking
ALTER TABLE shoes ADD COLUMN strava_gear_id TEXT;
