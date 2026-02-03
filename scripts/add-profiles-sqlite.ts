/**
 * Migration script to add profile_id columns to ALL data tables in SQLite
 * This enables full data isolation per profile.
 *
 * Run with: npx tsx scripts/add-profiles-sqlite.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'stride.db');
const db = new Database(dbPath);

// Tables that need profile_id column
const TABLES_NEEDING_PROFILE_ID = [
  'user_settings',
  'workouts',
  'shoes',
  'chat_messages',
  'races',
  'race_results',
  'clothing_items',
  'coach_settings',
  'coach_actions',
  'canonical_routes',
];

function tableExists(tableName: string): boolean {
  const result = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name=?
  `).get(tableName);
  return !!result;
}

function columnExists(tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  return columns.some(col => col.name === columnName);
}

function addProfileIdColumn(tableName: string): void {
  if (!tableExists(tableName)) {
    console.log(`  ${tableName}: table does not exist, skipping`);
    return;
  }

  if (columnExists(tableName, 'profile_id')) {
    console.log(`  ${tableName}: profile_id already exists`);
    return;
  }

  console.log(`  ${tableName}: adding profile_id column...`);
  db.prepare(`ALTER TABLE ${tableName} ADD COLUMN profile_id INTEGER REFERENCES profiles(id)`).run();
  console.log(`  ${tableName}: done`);
}

function assignExistingDataToProfile(tableName: string, profileId: number): void {
  if (!tableExists(tableName)) {
    console.log(`  ${tableName}: table does not exist, skipping`);
    return;
  }

  if (!columnExists(tableName, 'profile_id')) {
    console.log(`  ${tableName}: no profile_id column, skipping`);
    return;
  }

  const result = db.prepare(`UPDATE ${tableName} SET profile_id = ? WHERE profile_id IS NULL`).run(profileId);
  console.log(`  ${tableName}: assigned ${result.changes} rows to profile ${profileId}`);
}

function migrate() {
  console.log('Starting SQLite profiles migration...\n');

  // Step 1: Create profiles table if it doesn't exist
  console.log('Step 1: Creating profiles table...');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'personal',
      avatar_color TEXT DEFAULT '#3b82f6',
      is_protected INTEGER DEFAULT 0,
      settings_snapshot TEXT,
      data_snapshot TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  console.log('Profiles table ready\n');

  // Step 2: Add profile_id column to all data tables
  console.log('Step 2: Adding profile_id column to all data tables...');
  for (const tableName of TABLES_NEEDING_PROFILE_ID) {
    addProfileIdColumn(tableName);
  }
  console.log('');

  // Step 3: Create default profiles
  console.log('Step 3: Creating default profiles...');
  const now = new Date().toISOString();

  // Jason profile
  let jasonProfileId: number;
  const existingJason = db.prepare(`
    SELECT id FROM profiles WHERE name = 'Jason' AND type = 'personal' LIMIT 1
  `).get() as { id: number } | undefined;

  if (!existingJason) {
    const result = db.prepare(`
      INSERT INTO profiles (name, type, avatar_color, is_protected, created_at, updated_at)
      VALUES ('Jason', 'personal', '#3b82f6', 0, ?, ?)
    `).run(now, now);
    jasonProfileId = result.lastInsertRowid as number;
    console.log(`  Created Jason profile (ID: ${jasonProfileId})`);
  } else {
    jasonProfileId = existingJason.id;
    console.log(`  Jason profile exists (ID: ${jasonProfileId})`);
  }

  // Demo Runner profile
  let demoProfileId: number;
  const existingDemo = db.prepare(`
    SELECT id FROM profiles WHERE name = 'Demo Runner' AND type = 'demo' LIMIT 1
  `).get() as { id: number } | undefined;

  if (!existingDemo) {
    const result = db.prepare(`
      INSERT INTO profiles (name, type, avatar_color, is_protected, created_at, updated_at)
      VALUES ('Demo Runner', 'demo', '#f59e0b', 1, ?, ?)
    `).run(now, now);
    demoProfileId = result.lastInsertRowid as number;
    console.log(`  Created Demo Runner profile (ID: ${demoProfileId})`);
  } else {
    demoProfileId = existingDemo.id;
    console.log(`  Demo Runner profile exists (ID: ${demoProfileId})`);
  }
  console.log('');

  // Step 4: Assign all existing data to Jason's profile
  console.log("Step 4: Assigning existing data to Jason's profile...");
  for (const tableName of TABLES_NEEDING_PROFILE_ID) {
    assignExistingDataToProfile(tableName, jasonProfileId);
  }
  console.log('');

  console.log('Migration complete!');
  console.log('');
  console.log('Summary:');
  console.log('  - Profiles table: ready');
  console.log(`  - profile_id added to: ${TABLES_NEEDING_PROFILE_ID.join(', ')}`);
  console.log(`  - Jason profile ID: ${jasonProfileId}`);
  console.log(`  - Demo Runner profile ID: ${demoProfileId}`);
  console.log("  - All existing data assigned to Jason's profile");

  db.close();
}

migrate();
