CREATE TABLE IF NOT EXISTS strava_best_efforts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  strava_effort_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  distance_meters REAL NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  pr_rank INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
