-- Create vdot_history table
CREATE TABLE IF NOT EXISTS vdot_history (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id),
  date TEXT NOT NULL,
  vdot REAL NOT NULL,
  source TEXT NOT NULL,
  source_id INTEGER,
  confidence TEXT DEFAULT 'medium',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT NOW()::TEXT
);

-- Create soreness_entries table
CREATE TABLE IF NOT EXISTS soreness_entries (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  body_region TEXT NOT NULL,
  severity INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT NOW()::TEXT
);

-- Create coach_settings table
CREATE TABLE IF NOT EXISTS coach_settings (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id),
  mode TEXT NOT NULL DEFAULT 'advisor',
  auto_approve_minor_changes BOOLEAN DEFAULT FALSE,
  travel_mode_active BOOLEAN DEFAULT FALSE,
  travel_mode_start TEXT,
  travel_mode_end TEXT,
  travel_destination TEXT,
  travel_has_treadmill BOOLEAN,
  travel_has_gym BOOLEAN,
  busy_week_active BOOLEAN DEFAULT FALSE,
  busy_week_reason TEXT,
  busy_week_start_date TEXT,
  busy_week_end_date TEXT,
  last_weekly_recap_date TEXT,
  created_at TEXT NOT NULL DEFAULT NOW()::TEXT,
  updated_at TEXT NOT NULL DEFAULT NOW()::TEXT
);
