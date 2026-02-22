-- Migration: 0017_schema_sync.sql
-- Sync Postgres schema to match SQLite source of truth
-- Generated: 2026-02-22
-- DO NOT run against production without review

-- ============================================================
-- 1. workouts.training_load: real -> integer
-- ============================================================
ALTER TABLE workouts ALTER COLUMN training_load TYPE integer USING training_load::integer;

-- ============================================================
-- 2. workout_segments.elevation_gain_ft: integer -> real (double precision)
-- ============================================================
ALTER TABLE workout_segments ALTER COLUMN elevation_gain_ft TYPE double precision;

-- ============================================================
-- 3. canonical_routes.total_elevation_gain: integer -> real (double precision)
-- ============================================================
ALTER TABLE canonical_routes ALTER COLUMN total_elevation_gain TYPE double precision;

-- ============================================================
-- 4. coaching_insights: Restructure to match SQLite schema
--    Remove PG-only columns, add SQLite-only columns
-- ============================================================

-- Add missing columns from SQLite schema
ALTER TABLE coaching_insights ADD COLUMN IF NOT EXISTS first_observed text NOT NULL DEFAULT '2026-01-01T00:00:00.000Z';
ALTER TABLE coaching_insights ADD COLUMN IF NOT EXISTS last_confirmed text NOT NULL DEFAULT '2026-01-01T00:00:00.000Z';
ALTER TABLE coaching_insights ADD COLUMN IF NOT EXISTS updated_at text NOT NULL DEFAULT '2026-01-01T00:00:00.000Z';

-- Update defaults to match SQLite
ALTER TABLE coaching_insights ALTER COLUMN confidence SET DEFAULT 0.8;
ALTER TABLE coaching_insights ALTER COLUMN source SET DEFAULT 'inferred';

-- Drop PG-only columns that don't exist in SQLite
ALTER TABLE coaching_insights DROP COLUMN IF EXISTS subcategory;
ALTER TABLE coaching_insights DROP COLUMN IF EXISTS extracted_from;
ALTER TABLE coaching_insights DROP COLUMN IF EXISTS last_validated;
ALTER TABLE coaching_insights DROP COLUMN IF EXISTS expires_at;

-- ============================================================
-- 5. response_cache: Restructure to match SQLite schema
--    SQLite has: queryHash, originalQuery, response, toolCalls
--    PG had: queryHash, query, response, context, model, tokensUsed, responseTimeMs, profileId
-- ============================================================

-- Add missing columns
ALTER TABLE response_cache ADD COLUMN IF NOT EXISTS original_query text;
ALTER TABLE response_cache ADD COLUMN IF NOT EXISTS tool_calls text;

-- Migrate data from old column to new column (if query column exists)
UPDATE response_cache SET original_query = query WHERE original_query IS NULL AND query IS NOT NULL;

-- Drop PG-only columns
ALTER TABLE response_cache DROP COLUMN IF EXISTS query;
ALTER TABLE response_cache DROP COLUMN IF EXISTS context;
ALTER TABLE response_cache DROP COLUMN IF EXISTS model;
ALTER TABLE response_cache DROP COLUMN IF EXISTS tokens_used;
ALTER TABLE response_cache DROP COLUMN IF EXISTS response_time_ms;
ALTER TABLE response_cache DROP COLUMN IF EXISTS profile_id;

-- Make original_query NOT NULL after migration
ALTER TABLE response_cache ALTER COLUMN original_query SET NOT NULL;

-- ============================================================
-- 6. api_usage_logs.created_at: Add default value
-- ============================================================
ALTER TABLE api_usage_logs ALTER COLUMN created_at SET DEFAULT '2026-01-01T00:00:00.000Z';

-- ============================================================
-- 7. Drop insight_connections table (PG-only, not in SQLite source of truth)
-- ============================================================
DROP TABLE IF EXISTS insight_connections;
