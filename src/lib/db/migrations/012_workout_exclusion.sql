-- Add workout exclusion columns for filtering bad runs from fitness estimates
ALTER TABLE workouts ADD COLUMN exclude_from_estimates INTEGER DEFAULT 0;
ALTER TABLE workouts ADD COLUMN auto_excluded INTEGER DEFAULT 0;
ALTER TABLE workouts ADD COLUMN exclude_reason TEXT;
