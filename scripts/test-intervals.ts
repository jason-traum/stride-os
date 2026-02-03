// Test script for Intervals.icu API
// Run with: npx tsx scripts/test-intervals.ts

import Database from 'better-sqlite3';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const db = new Database(path.join(dataDir, 'stride.db'));

const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';

async function testIntervalsConnection() {
  // Get credentials from database
  const settings = db.prepare('SELECT intervals_athlete_id, intervals_api_key FROM user_settings LIMIT 1').get() as {
    intervals_athlete_id: string | null;
    intervals_api_key: string | null;
  } | undefined;

  if (!settings) {
    console.log('❌ No user settings found');
    return;
  }

  const { intervals_athlete_id: athleteId, intervals_api_key: apiKey } = settings;

  if (!athleteId || !apiKey) {
    console.log('❌ Intervals.icu not connected');
    return;
  }

  console.log('✓ Credentials found');
  console.log('  Athlete ID:', athleteId);

  const authHeader = `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`;

  // Test activities endpoint
  console.log('\nFetching activities...');
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const oldest = ninetyDaysAgo.toISOString().split('T')[0];
  const newest = new Date().toISOString().split('T')[0];

  const activitiesResponse = await fetch(
    `${INTERVALS_API_BASE}/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`,
    { headers: { 'Authorization': authHeader } }
  );

  const activities = await activitiesResponse.json();
  console.log(`Received ${activities.length} activities\n`);

  if (activities.length > 0) {
    // Show first activity's structure
    console.log('=== First Activity Structure ===');
    const first = activities[0];
    console.log(JSON.stringify(first, null, 2));

    console.log('\n=== All Activity Keys ===');
    const keys = Object.keys(first);
    console.log(keys.join(', '));

    // Look for type-like fields
    console.log('\n=== Type-related fields ===');
    for (const key of keys) {
      if (key.toLowerCase().includes('type') || key.toLowerCase().includes('sport')) {
        console.log(`  ${key}: ${first[key]}`);
      }
    }
  }
}

testIntervalsConnection();
