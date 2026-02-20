import { NextResponse } from 'next/server';
import { fullReprocess } from '@/actions/vdot-sync';
import { computeWorkoutFitnessSignals } from '@/actions/fitness-signals';
import { db, workouts } from '@/lib/db';
import { desc } from 'drizzle-orm';

export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  // Batch mode: just recompute fitness signals for a chunk of workouts
  if (body.signalsOnly) {
    const offset = body.offset ?? 0;
    const limit = body.limit ?? 100;

    const batch = await db.select({ id: workouts.id, profileId: workouts.profileId })
      .from(workouts)
      .orderBy(desc(workouts.date))
      .limit(limit)
      .offset(offset);

    let recomputed = 0;
    let errors = 0;
    for (const w of batch) {
      try {
        await computeWorkoutFitnessSignals(w.id, w.profileId);
        recomputed++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({ recomputed, errors, offset, limit, batchSize: batch.length });
  }

  const result = await fullReprocess(body.profileId ?? undefined, {
    skipSignals: body.skipSignals ?? false,
    skipReclassify: body.skipReclassify ?? false,
  });
  return NextResponse.json(result);
}
