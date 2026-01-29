import * as schema from './schema';

// Database adapter that supports both SQLite (local) and Postgres (production)
// Use DATABASE_URL environment variable to switch to Postgres

const hasPostgres = !!process.env.DATABASE_URL;

let db: ReturnType<typeof createDb>;

function createDb() {
  if (hasPostgres) {
    // Use Neon serverless Postgres for production
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require('@neondatabase/serverless');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/neon-http');

    const sql = neon(process.env.DATABASE_URL!);
    return drizzle(sql, { schema });
  } else {
    // Use SQLite for local development
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');

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

// Export schema for convenience
export * from './schema';
