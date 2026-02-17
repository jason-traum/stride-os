ALTER TABLE race_results ADD COLUMN workout_id INTEGER REFERENCES workouts(id);
