import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dreamy-admin-2026';

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret');
  return token === ADMIN_SECRET;
}

// GET /api/admin/profiles?secret=... — list all profiles
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profiles = db.all(sql`SELECT id, name, is_protected, avatar_color FROM profiles`);
  return NextResponse.json({ profiles });
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

  // Don't allow deleting profile 1 (primary)
  if (profileId === 1) {
    return NextResponse.json({ error: 'Cannot delete primary profile' }, { status: 400 });
  }

  try {
    db.run(sql`PRAGMA foreign_keys = OFF`);

    // Get all tables that have a profile_id column and clean them
    const tables = db.all(sql`SELECT name FROM sqlite_master WHERE type='table'`) as { name: string }[];
    for (const t of tables) {
      try {
        const cols = db.all(sql.raw(`PRAGMA table_info(${t.name})`)) as { name: string }[];
        if (cols.some(c => c.name === 'profile_id')) {
          db.run(sql.raw(`DELETE FROM ${t.name} WHERE profile_id = ${profileId}`));
        }
      } catch {
        // Skip tables that don't exist or have issues
      }
    }

    db.run(sql`DELETE FROM profiles WHERE id = ${profileId}`);
    db.run(sql`PRAGMA foreign_keys = ON`);

    return NextResponse.json({ success: true, message: `Profile ${profileId} deleted` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
