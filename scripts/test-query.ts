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
const DEMO_PROFILE_ID = 2;

async function main() {
  try {
    const result = await sql`SELECT id FROM workouts WHERE profile_id = ${DEMO_PROFILE_ID}`;
    console.log('Query worked! Found', result.length, 'workouts for demo profile');
  } catch (e) {
    console.error('Query failed:', e);
  }
}

main();
