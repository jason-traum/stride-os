-- Coach interactions table for chat history (used by proactive-coach, coach-history)
CREATE TABLE IF NOT EXISTS coach_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES profiles(id),
  user_message TEXT NOT NULL,
  coach_response TEXT NOT NULL,
  context TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
