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
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'planned_workouts'
    ORDER BY ordinal_position
  `;
  console.log('Planned_workouts columns:', cols.map((c: any) => c.column_name).join(', '));
}

main();
