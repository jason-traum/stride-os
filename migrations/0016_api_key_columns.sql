-- Add API key columns to user_settings for user-provided Anthropic and OpenAI keys
-- These columns store encrypted API keys in production

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS openai_api_key TEXT;
