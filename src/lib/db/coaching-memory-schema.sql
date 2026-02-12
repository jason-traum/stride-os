-- Coaching Memory Schema
-- Stores extracted insights and knowledge about athletes

-- Coaching insights table
CREATE TABLE IF NOT EXISTS coaching_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('preference', 'injury', 'goal', 'constraint', 'pattern', 'feedback')),
  subcategory TEXT,
  insight TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5 CHECK(confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL CHECK(source IN ('explicit', 'inferred')),
  extracted_from TEXT NOT NULL, -- Reference to chat message or conversation
  metadata TEXT, -- JSON object for additional data
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_validated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT, -- Some insights are temporary
  is_active BOOLEAN NOT NULL DEFAULT 1,
  FOREIGN KEY (profile_id) REFERENCES runner_profiles(id)
);

-- Indexes for efficient querying
CREATE INDEX idx_insights_profile ON coaching_insights(profile_id);
CREATE INDEX idx_insights_category ON coaching_insights(profile_id, category);
CREATE INDEX idx_insights_active ON coaching_insights(profile_id, is_active);
CREATE INDEX idx_insights_expires ON coaching_insights(expires_at) WHERE expires_at IS NOT NULL;

-- Conversation summaries table
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  conversation_date TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  summary TEXT NOT NULL,
  key_decisions TEXT, -- JSON array
  key_preferences TEXT, -- JSON array
  key_feedback TEXT, -- JSON array
  tags TEXT, -- JSON array of tags
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES runner_profiles(id)
);

CREATE INDEX idx_summaries_profile ON conversation_summaries(profile_id);
CREATE INDEX idx_summaries_date ON conversation_summaries(profile_id, conversation_date);

-- Knowledge graph connections (relationships between insights)
CREATE TABLE IF NOT EXISTS insight_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_insight_id INTEGER NOT NULL,
  to_insight_id INTEGER NOT NULL,
  connection_type TEXT NOT NULL, -- 'contradicts', 'supports', 'related_to', 'supersedes'
  strength REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_insight_id) REFERENCES coaching_insights(id),
  FOREIGN KEY (to_insight_id) REFERENCES coaching_insights(id)
);

CREATE INDEX idx_connections_from ON insight_connections(from_insight_id);
CREATE INDEX idx_connections_to ON insight_connections(to_insight_id);

-- Sample queries:

-- Get active insights for a profile
-- SELECT * FROM coaching_insights
-- WHERE profile_id = ? AND is_active = 1
-- AND (expires_at IS NULL OR expires_at > datetime('now'));

-- Get recent conversation summaries
-- SELECT * FROM conversation_summaries
-- WHERE profile_id = ?
-- ORDER BY conversation_date DESC
-- LIMIT 10;

-- Find conflicting insights
-- SELECT ci1.insight, ci2.insight, ic.connection_type
-- FROM insight_connections ic
-- JOIN coaching_insights ci1 ON ic.from_insight_id = ci1.id
-- JOIN coaching_insights ci2 ON ic.to_insight_id = ci2.id
-- WHERE ci1.profile_id = ? AND ic.connection_type = 'contradicts';