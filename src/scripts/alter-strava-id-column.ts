/**
 * Alter strava_activity_id column to BIGINT to support large Strava IDs
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex !== -1) {
          let value = trimmed.substring(eqIndex + 1);
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[trimmed.substring(0, eqIndex)] = value;
        }
      }
    });
  }
}

loadEnv();

async function main() {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);

  console.log('Altering strava_activity_id column to BIGINT...');

  await sql`ALTER TABLE workouts ALTER COLUMN strava_activity_id TYPE BIGINT`;

  console.log('Done!');
}

main().catch(console.error);
