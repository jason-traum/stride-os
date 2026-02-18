import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { db, profiles, userSettings } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

const CUSTOMER_USERS_TABLE = 'app_users';

let ensuredCustomerUsersTable = false;

type CustomerUserRow = {
  id: number;
  username: string;
  password_hash: string;
  profile_id: number;
};

function getResultRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(username);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

function getRandomColor(): string {
  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function ensureCustomerUsersTable(): Promise<void> {
  if (ensuredCustomerUsersTable) return;

  const hasPostgres = !!process.env.DATABASE_URL;
  if (hasPostgres) {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS ${CUSTOMER_USERS_TABLE} (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        profile_id INTEGER NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `));
  } else {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS ${CUSTOMER_USERS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        profile_id INTEGER NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `));
  }

  ensuredCustomerUsersTable = true;
}

async function findCustomerByUsername(username: string): Promise<CustomerUserRow | null> {
  const normalized = normalizeUsername(username);
  const result = await db.execute(
    sql`SELECT id, username, password_hash, profile_id FROM app_users WHERE lower(username) = ${normalized} LIMIT 1`
  );
  const rows = getResultRows(result);
  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    id: Number(row.id),
    username: String(row.username),
    password_hash: String(row.password_hash),
    profile_id: Number(row.profile_id),
  };
}

export async function authenticateCustomerAccount(input: {
  username: string;
  password: string;
}): Promise<{ success: boolean; profileId?: number; username?: string; error?: string }> {
  await ensureCustomerUsersTable();

  const normalizedUsername = normalizeUsername(input.username);
  if (!isValidUsername(normalizedUsername)) {
    return { success: false, error: 'Invalid username or password' };
  }

  const existing = await findCustomerByUsername(normalizedUsername);
  if (!existing) {
    return { success: false, error: 'Invalid username or password' };
  }

  if (!verifyPassword(input.password, existing.password_hash)) {
    return { success: false, error: 'Invalid username or password' };
  }

  return {
    success: true,
    username: existing.username,
    profileId: existing.profile_id,
  };
}

export async function createCustomerAccount(input: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<{ success: boolean; profileId?: number; username?: string; error?: string }> {
  await ensureCustomerUsersTable();

  const normalizedUsername = normalizeUsername(input.username);
  const password = String(input.password || '');
  const displayName = String(input.displayName || '').trim();

  if (!isValidUsername(normalizedUsername)) {
    return { success: false, error: 'Username must be 3-32 chars (a-z, 0-9, ., _, -).' };
  }
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }

  const duplicate = await findCustomerByUsername(normalizedUsername);
  if (duplicate) {
    return { success: false, error: 'That username is already taken.' };
  }

  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const profileName = displayName || normalizedUsername;

  let createdProfileId: number | null = null;
  try {
    const insertedProfiles = await db
      .insert(profiles)
      .values({
        name: profileName,
        type: 'personal',
        avatarColor: getRandomColor(),
        isProtected: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const profile = insertedProfiles[0];
    if (!profile) {
      return { success: false, error: 'Failed to create profile.' };
    }
    createdProfileId = profile.id;

    await db.insert(userSettings).values({
      profileId: profile.id,
      name: profileName,
      latitude: 40.7336,
      longitude: -74.0027,
      cityName: 'West Village, New York',
      heatAcclimatizationScore: 50,
      createdAt: now,
      updatedAt: now,
    });

    await db.execute(
      sql`INSERT INTO app_users (username, password_hash, profile_id, created_at, updated_at)
          VALUES (${normalizedUsername}, ${passwordHash}, ${profile.id}, ${now}, ${now})`
    );

    return {
      success: true,
      username: normalizedUsername,
      profileId: profile.id,
    };
  } catch (error) {
    if (createdProfileId) {
      await db.delete(userSettings).where(eq(userSettings.profileId, createdProfileId));
      await db.delete(profiles).where(eq(profiles.id, createdProfileId));
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('unique')) {
      return { success: false, error: 'That username is already taken.' };
    }
    return { success: false, error: 'Failed to create account.' };
  }
}
