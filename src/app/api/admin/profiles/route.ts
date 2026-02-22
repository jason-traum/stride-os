import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

const isPostgres = !!process.env.DATABASE_URL;

function checkAuth(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return false;
  }
  const token = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret');
  return token === adminSecret;
}

// GET /api/admin/profiles?secret=... — list all profiles
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use raw SQL that works for both SQLite and Postgres
    const result = await db.execute(sql`SELECT id, name, is_protected, avatar_color FROM profiles`);

    // Drizzle returns different shapes for SQLite vs Postgres
    const profiles = isPostgres ? result.rows : result;
    return NextResponse.json({ profiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/admin/profiles?secret=...&id=2 — delete a profile and all related data
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const profileId = parseInt(id, 10);

  if (!Number.isFinite(profileId) || profileId <= 0) {
    return NextResponse.json({ error: 'Invalid id parameter' }, { status: 400 });
  }

  // Don't allow deleting profile 1 (primary)
  if (profileId === 1) {
    return NextResponse.json({ error: 'Cannot delete primary profile' }, { status: 400 });
  }

  // Known tables with profile_id column (hardcoded allowlist to prevent injection)
  const tablesWithProfileId = [
    'workouts', 'assessments', 'user_settings', 'races', 'race_results',
    'planned_workouts', 'training_blocks', 'shoes', 'clothing_items',
    'soreness_entries', 'chat_messages', 'canonical_routes',
  ] as const;

  try {
    for (const table of tablesWithProfileId) {
      try {
        // Table name is from a hardcoded allowlist above; profileId is validated as a finite integer.
        await db.execute(sql.raw(`DELETE FROM ${table} WHERE profile_id = ${profileId}`));
      } catch {
        // Skip tables that don't exist
      }
    }

    await db.execute(sql`DELETE FROM profiles WHERE id = ${profileId}`);

    return NextResponse.json({ success: true, message: `Profile ${profileId} deleted` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
