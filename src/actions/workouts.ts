'use server';

import { db, workouts, assessments, shoes } from '@/lib/db';
import { eq, desc, and, gte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { calculatePace } from '@/lib/utils';
import type { NewWorkout, NewAssessment } from '@/lib/schema';
import { processWorkout } from '@/lib/training/workout-processor';

export async function createWorkout(data: {
  date: string;
  distanceMiles?: number;
  durationMinutes?: number;
  workoutType: string;
  routeName?: string;
  shoeId?: number;
  notes?: string;
  // Weather data
  weatherTempF?: number;
  weatherFeelsLikeF?: number;
  weatherHumidityPct?: number;
  weatherWindMph?: number;
  weatherConditions?: string;
  weatherSeverityScore?: number;
  // Profile
  profileId?: number;
}) {
  const now = new Date().toISOString();

  // Idempotency check: prevent duplicates created within 1 minute
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const whereConditions = [
    eq(workouts.date, data.date),
    gte(workouts.createdAt, oneMinuteAgo)
  ];
  if (data.profileId) {
    whereConditions.push(eq(workouts.profileId, data.profileId));
  }
  const existingWorkout = await db.query.workouts.findFirst({
    where: and(...whereConditions),
  });

  // If a workout exists with same date created in last minute, check if it's likely a duplicate
  if (existingWorkout) {
    const sameDistance = data.distanceMiles === undefined ||
      Math.abs((existingWorkout.distanceMiles || 0) - (data.distanceMiles || 0)) < 0.1;
    const sameDuration = data.durationMinutes === undefined ||
      Math.abs((existingWorkout.durationMinutes || 0) - (data.durationMinutes || 0)) < 2;

    if (sameDistance && sameDuration) {
      return existingWorkout;
    }
  }
  const avgPaceSeconds = data.distanceMiles && data.durationMinutes
    ? calculatePace(data.distanceMiles, data.durationMinutes)
    : null;

  const [workout] = await db.insert(workouts).values({
    date: data.date,
    distanceMiles: data.distanceMiles || null,
    durationMinutes: data.durationMinutes || null,
    avgPaceSeconds,
    workoutType: data.workoutType as NewWorkout['workoutType'],
    routeName: data.routeName || null,
    shoeId: data.shoeId || null,
    notes: data.notes || null,
    source: 'manual',
    profileId: data.profileId ?? null,
    // Weather data
    weatherTempF: data.weatherTempF ?? null,
    weatherFeelsLikeF: data.weatherFeelsLikeF ?? null,
    weatherHumidityPct: data.weatherHumidityPct ?? null,
    weatherWindMph: data.weatherWindMph ?? null,
    weatherConditions: data.weatherConditions as NewWorkout['weatherConditions'] ?? null,
    weatherSeverityScore: data.weatherSeverityScore ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  // Update shoe mileage if a shoe was selected
  if (data.shoeId && data.distanceMiles) {
    const [shoe] = await db.select().from(shoes).where(eq(shoes.id, data.shoeId));
    if (shoe) {
      await db.update(shoes)
        .set({ totalMiles: shoe.totalMiles + data.distanceMiles })
        .where(eq(shoes.id, data.shoeId));
    }
  }

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/shoes');
  revalidatePath('/today');

  // Process workout through the intelligence pipeline (async, non-blocking)
  processWorkout(workout.id).catch(err => {
    console.error('Workout processing failed:', err);
  });

  return workout;
}

export async function updateWorkout(id: number, data: {
  date: string;
  distanceMiles?: number;
  durationMinutes?: number;
  workoutType: string;
  routeName?: string;
  shoeId?: number;
  notes?: string;
}) {
  const now = new Date().toISOString();

  // Get old workout to handle shoe mileage changes
  const oldWorkout = await db.query.workouts.findFirst({
    where: eq(workouts.id, id),
  });

  if (!oldWorkout) {
    throw new Error('Workout not found');
  }

  const avgPaceSeconds = data.distanceMiles && data.durationMinutes
    ? calculatePace(data.distanceMiles, data.durationMinutes)
    : null;

  // Handle shoe mileage updates
  const oldShoeId = oldWorkout.shoeId;
  const oldDistance = oldWorkout.distanceMiles || 0;
  const newShoeId = data.shoeId || null;
  const newDistance = data.distanceMiles || 0;

  // Remove mileage from old shoe if it had one
  if (oldShoeId && oldDistance > 0) {
    const [oldShoe] = await db.select().from(shoes).where(eq(shoes.id, oldShoeId));
    if (oldShoe) {
      await db.update(shoes)
        .set({ totalMiles: Math.max(0, oldShoe.totalMiles - oldDistance) })
        .where(eq(shoes.id, oldShoeId));
    }
  }

  // Add mileage to new shoe if selected
  if (newShoeId && newDistance > 0) {
    const [newShoe] = await db.select().from(shoes).where(eq(shoes.id, newShoeId));
    if (newShoe) {
      await db.update(shoes)
        .set({ totalMiles: newShoe.totalMiles + newDistance })
        .where(eq(shoes.id, newShoeId));
    }
  }

  const [workout] = await db.update(workouts)
    .set({
      date: data.date,
      distanceMiles: data.distanceMiles || null,
      durationMinutes: data.durationMinutes || null,
      avgPaceSeconds,
      workoutType: data.workoutType as NewWorkout['workoutType'],
      routeName: data.routeName || null,
      shoeId: newShoeId,
      notes: data.notes || null,
      updatedAt: now,
    })
    .where(eq(workouts.id, id))
    .returning();

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/shoes');
  revalidatePath('/today');
  revalidatePath(`/workout/${id}`);

  // Re-process workout through the intelligence pipeline
  processWorkout(id).catch(err => {
    console.error('Workout processing failed:', err);
  });

  return workout;
}

export type AssessmentData = {
  verdict: string;
  wasIntendedWorkout?: string;
  issues?: string[];
  rpe: number;
  legsFeel?: number;
  legsTags?: string[];
  breathingFeel?: string;
  perceivedHeat?: string;
  sleepQuality?: number;
  sleepHours?: number;
  stress?: number;
  soreness?: number;
  mood?: number;
  lifeTags?: string[];
  hydration?: number;
  hydrationTags?: string[];
  fueling?: number;
  underfueled?: boolean;
  caffeine?: string;
  alcohol24h?: number;
  illness?: number;
  stomach?: number;
  forgotElectrolytes?: boolean;
  windHillsDifficulty?: number;
  feltTemp?: string;
  surface?: string;
  note?: string;
  // New schedule context fields
  timeOfRun?: string;
  wasWorkday?: boolean;
  hoursWorkedBefore?: number;
  workStress?: number;
  mentalEnergyPreRun?: string;
  // Outfit feedback fields
  outfitRating?: string;
  handsRating?: string;
  faceRating?: string;
  removedLayers?: string;
};

export async function createAssessment(workoutId: number, data: AssessmentData) {
  const now = new Date().toISOString();

  const [assessment] = await db.insert(assessments).values({
    workoutId,
    verdict: data.verdict as NewAssessment['verdict'],
    wasIntendedWorkout: (data.wasIntendedWorkout || 'yes') as NewAssessment['wasIntendedWorkout'],
    issues: JSON.stringify(data.issues || []),
    rpe: data.rpe,
    legsFeel: data.legsFeel ?? null,
    legsTags: JSON.stringify(data.legsTags || []),
    breathingFeel: data.breathingFeel as NewAssessment['breathingFeel'] ?? null,
    perceivedHeat: data.perceivedHeat as NewAssessment['perceivedHeat'] ?? null,
    sleepQuality: data.sleepQuality ?? null,
    sleepHours: data.sleepHours ?? null,
    stress: data.stress ?? null,
    soreness: data.soreness ?? null,
    mood: data.mood ?? null,
    lifeTags: JSON.stringify(data.lifeTags || []),
    hydration: data.hydration ?? null,
    hydrationTags: JSON.stringify(data.hydrationTags || []),
    fueling: data.fueling ?? null,
    underfueled: data.underfueled || false,
    caffeine: data.caffeine as NewAssessment['caffeine'] ?? null,
    alcohol24h: data.alcohol24h ?? null,
    illness: data.illness ?? null,
    stomach: data.stomach ?? null,
    forgotElectrolytes: data.forgotElectrolytes || false,
    windHillsDifficulty: data.windHillsDifficulty ?? null,
    feltTemp: data.feltTemp as NewAssessment['feltTemp'] ?? null,
    surface: data.surface as NewAssessment['surface'] ?? null,
    note: data.note || null,
    // New schedule context fields
    timeOfRun: data.timeOfRun as NewAssessment['timeOfRun'] ?? null,
    wasWorkday: data.wasWorkday ?? null,
    hoursWorkedBefore: data.hoursWorkedBefore ?? null,
    workStress: data.workStress ?? null,
    mentalEnergyPreRun: data.mentalEnergyPreRun as NewAssessment['mentalEnergyPreRun'] ?? null,
    // Outfit feedback fields
    outfitRating: data.outfitRating as NewAssessment['outfitRating'] ?? null,
    handsRating: data.handsRating as NewAssessment['handsRating'] ?? null,
    faceRating: data.faceRating as NewAssessment['faceRating'] ?? null,
    removedLayers: data.removedLayers ?? null,
    createdAt: now,
  }).returning();

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/today');
  revalidatePath(`/workout/${workoutId}`);

  return assessment;
}

export async function updateAssessment(assessmentId: number, workoutId: number, data: AssessmentData) {
  const [assessment] = await db.update(assessments)
    .set({
      verdict: data.verdict as NewAssessment['verdict'],
      wasIntendedWorkout: (data.wasIntendedWorkout || 'yes') as NewAssessment['wasIntendedWorkout'],
      issues: JSON.stringify(data.issues || []),
      rpe: data.rpe,
      legsFeel: data.legsFeel ?? null,
      legsTags: JSON.stringify(data.legsTags || []),
      breathingFeel: data.breathingFeel as NewAssessment['breathingFeel'] ?? null,
      perceivedHeat: data.perceivedHeat as NewAssessment['perceivedHeat'] ?? null,
      sleepQuality: data.sleepQuality ?? null,
      sleepHours: data.sleepHours ?? null,
      stress: data.stress ?? null,
      soreness: data.soreness ?? null,
      mood: data.mood ?? null,
      lifeTags: JSON.stringify(data.lifeTags || []),
      hydration: data.hydration ?? null,
      hydrationTags: JSON.stringify(data.hydrationTags || []),
      fueling: data.fueling ?? null,
      underfueled: data.underfueled || false,
      caffeine: data.caffeine as NewAssessment['caffeine'] ?? null,
      alcohol24h: data.alcohol24h ?? null,
      illness: data.illness ?? null,
      stomach: data.stomach ?? null,
      forgotElectrolytes: data.forgotElectrolytes || false,
      windHillsDifficulty: data.windHillsDifficulty ?? null,
      feltTemp: data.feltTemp as NewAssessment['feltTemp'] ?? null,
      surface: data.surface as NewAssessment['surface'] ?? null,
      note: data.note || null,
      // New schedule context fields
      timeOfRun: data.timeOfRun as NewAssessment['timeOfRun'] ?? null,
      wasWorkday: data.wasWorkday ?? null,
      hoursWorkedBefore: data.hoursWorkedBefore ?? null,
      workStress: data.workStress ?? null,
      mentalEnergyPreRun: data.mentalEnergyPreRun as NewAssessment['mentalEnergyPreRun'] ?? null,
      // Outfit feedback fields
      outfitRating: data.outfitRating as NewAssessment['outfitRating'] ?? null,
      handsRating: data.handsRating as NewAssessment['handsRating'] ?? null,
      faceRating: data.faceRating as NewAssessment['faceRating'] ?? null,
      removedLayers: data.removedLayers ?? null,
    })
    .where(eq(assessments.id, assessmentId))
    .returning();

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/today');
  revalidatePath(`/workout/${workoutId}`);

  return assessment;
}

export async function getWorkouts(limit?: number, profileId?: number) {
  const query = db.query.workouts.findMany({
    where: profileId ? eq(workouts.profileId, profileId) : undefined,
    with: {
      shoe: true,
      assessment: true,
      segments: true,
    },
    orderBy: [desc(workouts.date), desc(workouts.createdAt)],
    limit: limit,
  });

  return query;
}

export async function getWorkout(id: number) {
  return db.query.workouts.findFirst({
    where: eq(workouts.id, id),
    with: {
      shoe: true,
      assessment: true,
    },
  });
}

export async function deleteWorkout(id: number) {
  // Get the workout first to update shoe mileage
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, id),
  });

  if (workout?.shoeId && workout.distanceMiles) {
    const [shoe] = await db.select().from(shoes).where(eq(shoes.id, workout.shoeId));
    if (shoe) {
      await db.update(shoes)
        .set({ totalMiles: Math.max(0, shoe.totalMiles - workout.distanceMiles) })
        .where(eq(shoes.id, workout.shoeId));
    }
  }

  await db.delete(workouts).where(eq(workouts.id, id));

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/shoes');
  revalidatePath('/today');
}
