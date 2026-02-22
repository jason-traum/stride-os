-- Migration: Add message_hash column to conversation_summaries
-- Version: 020
-- Description: Enables conversation compression dedup by storing a hash of compressed messages

ALTER TABLE conversation_summaries ADD COLUMN IF NOT EXISTS message_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_summaries_hash ON conversation_summaries(profile_id, message_hash);
