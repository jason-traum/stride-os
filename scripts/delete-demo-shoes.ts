import { neon } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`DELETE FROM shoes WHERE profile_id = 2`;
  console.log('Deleted demo shoes to reset');
}

main();
