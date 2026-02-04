/**
 * Check existing races in the database
 *
 * Run with: npx tsx src/scripts/check-races.ts
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

  const races = await sql`
    SELECT id, name, date, priority, distance_label, target_time_seconds, location, profile_id
    FROM races
    ORDER BY date ASC
  `;

  console.log('All races in database:');
  console.log('='.repeat(70));
  races.forEach(race => {
    const time = race.target_time_seconds
      ? `${Math.floor(race.target_time_seconds / 3600)}:${String(Math.floor((race.target_time_seconds % 3600) / 60)).padStart(2, '0')}:${String(race.target_time_seconds % 60).padStart(2, '0')}`
      : 'No target';
    console.log(`[${race.priority}] ID:${race.id} - ${race.name}`);
    console.log(`    Date: ${race.date} | Distance: ${race.distance_label} | Target: ${time}`);
    console.log(`    Location: ${race.location || 'Not set'} | Profile: ${race.profile_id || 'None'}`);
    console.log();
  });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
