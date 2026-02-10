// Script to create api_usage_logs table in Postgres
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

// Load DATABASE_URL from .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=(.+)/);
if (!match) throw new Error('DATABASE_URL not found in .env.local');
const DATABASE_URL = match[1];

const sql = neon(DATABASE_URL);

async function createTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS api_usage_logs (
        id SERIAL PRIMARY KEY,
        service TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT DEFAULT 'GET',
        status_code INTEGER,
        response_time_ms INTEGER,
        tokens_used INTEGER,
        input_tokens INTEGER,
        output_tokens INTEGER,
        error_message TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
      )
    `;
    console.log('✅ api_usage_logs table created successfully');
  } catch (error) {
    console.error('Failed to create table:', error);
    process.exit(1);
  }
}

createTable();
