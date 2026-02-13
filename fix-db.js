const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = 'postgresql://neondb_owner:npg_1PsxL7kbojhc@ep-silent-darkness-ahgkrjm2-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixDatabase() {
  const sql = neon(DATABASE_URL);

  try {
    console.log('Creating coach_interactions table...');

    await sql`
      CREATE TABLE IF NOT EXISTS coach_interactions (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER REFERENCES profiles(id),
        user_message TEXT NOT NULL,
        coach_response TEXT NOT NULL,
        context TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    console.log('✅ Table created successfully!');

    // Check if it exists
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'coach_interactions'
    `;

    console.log('Table exists:', tables.length > 0);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixDatabase();