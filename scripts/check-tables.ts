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
  // Get all tables
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log('Tables:', tables.map((t: any) => t.table_name).join(', '));

  // Check workout_segments columns
  const segCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'workout_segments'
    ORDER BY ordinal_position
  `;
  console.log('\nWorkout_segments columns:', segCols.map((c: any) => c.column_name).join(', '));
}

main().catch(console.error);
