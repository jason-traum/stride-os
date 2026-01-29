// Database adapter that supports both SQLite (local) and Postgres (production)
// Use DATABASE_URL environment variable to switch to Postgres
//
// IMPORTANT: Schema must match database type!
// - Postgres (production): uses schema.pg.ts with pgTable
// - SQLite (local dev): uses schema.ts with sqliteTable

const hasPostgres = !!process.env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

function createDb() {
  if (hasPostgres) {
    // Use Neon serverless Postgres for production with Postgres schema
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require('@neondatabase/serverless');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/neon-http');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const schemaPg = require('./schema.pg');

    const sql = neon(process.env.DATABASE_URL!);
    return drizzle(sql, { schema: schemaPg });
  } else {
    // Use SQLite for local development with SQLite schema
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const schema = require('./schema');

    // Ensure the data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const sqlite = new Database(path.join(dataDir, 'stride.db'));
    return drizzle(sqlite, { schema });
  }
}

// Singleton pattern for the database connection
if (!db) {
  db = createDb();
}

export { db };

// Re-export schema based on database type for type consistency
// Consumers should import types from the appropriate schema file directly
export * from './schema';
