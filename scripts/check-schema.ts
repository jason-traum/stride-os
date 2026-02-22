import { neon } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  }
}

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Check workouts table columns
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'workouts'
    ORDER BY ordinal_position
  `;
  console.log('Workouts columns:', (cols as { column_name: string }[]).map((c) => c.column_name).join(', '));

  // Check profiles table
  const profiles = await sql`SELECT * FROM profiles LIMIT 5`;
  console.log('\nProfiles:', JSON.stringify(profiles, null, 2));

  // Check if demo profile exists
  const demoProfile = await sql`SELECT * FROM profiles WHERE id = 2`;
  console.log('\nDemo profile (id=2):', JSON.stringify(demoProfile, null, 2));
}

main().catch(console.error);
