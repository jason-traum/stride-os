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

  // Diagnostic mode: return full prediction engine output
  if (body.diagnostic) {
    const { getComprehensiveRacePredictions } = await import('@/actions/race-predictor');
    const { getFitnessTrendData } = await import('@/actions/fitness');
    const { getSettings } = await import('@/actions/settings');
    const { getActiveProfileId } = await import('@/lib/profile-server');
    const pid = body.profileId ?? await getActiveProfileId();
    const [prediction, fitness, settings] = await Promise.all([
      getComprehensiveRacePredictions(pid),
      getFitnessTrendData(90, pid),
      getSettings(pid),
    ]);
    return NextResponse.json({
      storedVdot: settings?.vdot,
      engineVdot: prediction?.vdot,
      vdotRange: prediction?.vdotRange,
      confidence: prediction?.confidence,
      agreementScore: prediction?.agreementScore,
      agreementDetails: prediction?.agreementDetails,
      formAdjustmentPct: prediction?.formAdjustmentPct,
      formDescription: prediction?.formDescription,
      signals: prediction?.signals,
      predictions: prediction?.predictions,
      fitnessState: { ctl: fitness.currentCtl, atl: fitness.currentAtl, tsb: fitness.currentTsb },
      dataQuality: prediction?.dataQuality,
    });
  }

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

  // Batch reclassify mode
  if (body.reclassifyOnly) {
    const { processWorkout } = await import('@/lib/training/workout-processor');
    const offset = body.offset ?? 0;
    const limit = body.limit ?? 100;

    const batch = await db.select({ id: workouts.id })
      .from(workouts)
      .orderBy(desc(workouts.date))
      .limit(limit)
      .offset(offset);

    let reclassified = 0;
    let errors = 0;
    for (const w of batch) {
      try {
        await processWorkout(w.id, {
          skipExecution: true,
          skipRouteMatching: true,
          skipDataQuality: true,
        });
        reclassified++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({ reclassified, errors, offset, limit, batchSize: batch.length });
  }

  const result = await fullReprocess(body.profileId ?? undefined, {
    skipSignals: body.skipSignals ?? false,
    skipReclassify: body.skipReclassify ?? false,
  });
  return NextResponse.json(result);
}
