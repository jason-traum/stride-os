-- Add macro plan columns to training_blocks for rolling window architecture
ALTER TABLE training_blocks ADD COLUMN long_run_target REAL;
ALTER TABLE training_blocks ADD COLUMN quality_sessions_target INTEGER;
ALTER TABLE training_blocks ADD COLUMN is_down_week INTEGER DEFAULT 0;
