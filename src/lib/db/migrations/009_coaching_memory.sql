-- Migration: Add coaching memory tables
-- Version: 009
-- Description: Tables for storing coaching insights and conversation summaries

-- Coaching insights table
CREATE TABLE IF NOT EXISTS coaching_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('preference', 'injury', 'goal', 'constraint', 'pattern', 'feedback')),
  subcategory TEXT,
  insight TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5 CHECK(confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL CHECK(source IN ('explicit', 'inferred')),
  extracted_from TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_validated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  FOREIGN KEY (profile_id) REFERENCES runner_profiles(id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_insights_profile ON coaching_insights(profile_id);
CREATE INDEX IF NOT EXISTS idx_insights_category ON coaching_insights(profile_id, category);
CREATE INDEX IF NOT EXISTS idx_insights_active ON coaching_insights(profile_id, is_active);
CREATE INDEX IF NOT EXISTS idx_insights_expires ON coaching_insights(expires_at) WHERE expires_at IS NOT NULL;

-- Conversation summaries table
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  conversation_date TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  summary TEXT NOT NULL,
  key_decisions TEXT,
  key_preferences TEXT,
  key_feedback TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES runner_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_summaries_profile ON conversation_summaries(profile_id);
CREATE INDEX IF NOT EXISTS idx_summaries_date ON conversation_summaries(profile_id, conversation_date);

-- Knowledge graph connections
CREATE TABLE IF NOT EXISTS insight_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_insight_id INTEGER NOT NULL,
  to_insight_id INTEGER NOT NULL,
  connection_type TEXT NOT NULL CHECK(connection_type IN ('contradicts', 'supports', 'related_to', 'supersedes')),
  strength REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_insight_id) REFERENCES coaching_insights(id),
  FOREIGN KEY (to_insight_id) REFERENCES coaching_insights(id),
  UNIQUE(from_insight_id, to_insight_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_from ON insight_connections(from_insight_id);
CREATE INDEX IF NOT EXISTS idx_connections_to ON insight_connections(to_insight_id);