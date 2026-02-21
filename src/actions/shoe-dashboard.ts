'use server';

import { db, shoes, workouts } from '@/lib/db';
import { eq, and, isNotNull } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

// Workout type groups for the mileage breakdown
const TYPE_GROUPS = {
  easy: ['recovery', 'easy', 'steady'],
  tempo: ['marathon', 'tempo', 'threshold'],
  long: ['long'],
  race: ['race'],
  other: ['interval', 'repetition', 'cross_train', 'other'],
} as const;

type TypeGroup = keyof typeof TYPE_GROUPS;

export type RetirementAlert = 'none' | 'warn' | 'alert' | 'critical';

export interface ShoeTypeBreakdown {
  easy: number;
  tempo: number;
  long: number;
  race: number;
  other: number;
}

export interface ShoeDashboardItem {
  id: number;
  name: string;
  brand: string;
  model: string;
  category: string;
  totalMiles: number;
  workoutCount: number;
  isRetired: boolean;
  stravaGearId: string | null;
  lastUsedDate: string | null;
  typeBreakdown: ShoeTypeBreakdown;
  retirementAlert: RetirementAlert;
}

export interface ShoeDashboardData {
  shoes: ShoeDashboardItem[];
  totalActiveShoes: number;
  totalRetiredShoes: number;
}

function getRetirementAlert(miles: number, isRetired: boolean): RetirementAlert {
  if (isRetired) return 'none';
  if (miles >= 500) return 'critical';
  if (miles >= 400) return 'alert';
  if (miles >= 300) return 'warn';
  return 'none';
}

function classifyWorkoutType(workoutType: string): TypeGroup {
  for (const [group, types] of Object.entries(TYPE_GROUPS)) {
    if ((types as readonly string[]).includes(workoutType)) {
      return group as TypeGroup;
    }
  }
  return 'other';
}

async function _getShoeDashboard(profileId: number): Promise<ShoeDashboardData> {
  // Get all shoes for this profile
  const allShoes = await db
    .select({
      id: shoes.id,
      name: shoes.name,
      brand: shoes.brand,
      model: shoes.model,
      category: shoes.category,
      totalMiles: shoes.totalMiles,
      isRetired: shoes.isRetired,
      stravaGearId: shoes.stravaGearId,
    })
    .from(shoes)
    .where(eq(shoes.profileId, profileId));

  if (allShoes.length === 0) {
    return { shoes: [], totalActiveShoes: 0, totalRetiredShoes: 0 };
  }

  const result: ShoeDashboardItem[] = [];

  for (const shoe of allShoes) {
    // Get workout stats: count, last used, and per-workout type mileage
    const shoeWorkouts = await db
      .select({
        workoutType: workouts.workoutType,
        distanceMiles: workouts.distanceMiles,
        date: workouts.date,
      })
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          eq(workouts.shoeId, shoe.id),
          isNotNull(workouts.distanceMiles),
        )
      );

    const typeBreakdown: ShoeTypeBreakdown = {
      easy: 0,
      tempo: 0,
      long: 0,
      race: 0,
      other: 0,
    };

    let lastUsedDate: string | null = null;

    for (const w of shoeWorkouts) {
      const group = classifyWorkoutType(w.workoutType);
      typeBreakdown[group] += w.distanceMiles ?? 0;

      if (!lastUsedDate || (w.date && w.date > lastUsedDate)) {
        lastUsedDate = w.date;
      }
    }

    // Round breakdown values
    for (const key of Object.keys(typeBreakdown) as TypeGroup[]) {
      typeBreakdown[key] = Math.round(typeBreakdown[key] * 10) / 10;
    }

    // Use the larger of Strava's total or our computed total
    // (Strava total may include runs before they synced with us)
    const computedMiles = Object.values(typeBreakdown).reduce((a, b) => a + b, 0);
    const totalMiles = Math.max(shoe.totalMiles, computedMiles);

    result.push({
      id: shoe.id,
      name: shoe.name,
      brand: shoe.brand,
      model: shoe.model,
      category: shoe.category,
      totalMiles: Math.round(totalMiles * 10) / 10,
      workoutCount: shoeWorkouts.length,
      isRetired: shoe.isRetired,
      stravaGearId: shoe.stravaGearId ?? null,
      lastUsedDate,
      typeBreakdown,
      retirementAlert: getRetirementAlert(totalMiles, shoe.isRetired),
    });
  }

  // Sort: active shoes first by most recent use, then retired
  result.sort((a, b) => {
    if (a.isRetired !== b.isRetired) return a.isRetired ? 1 : -1;
    // Among active: sort by most recently used
    if (!a.isRetired && !b.isRetired) {
      if (a.lastUsedDate && b.lastUsedDate) return b.lastUsedDate.localeCompare(a.lastUsedDate);
      if (a.lastUsedDate) return -1;
      if (b.lastUsedDate) return 1;
    }
    // Fallback: by total miles descending
    return b.totalMiles - a.totalMiles;
  });

  return {
    shoes: result,
    totalActiveShoes: result.filter(s => !s.isRetired).length,
    totalRetiredShoes: result.filter(s => s.isRetired).length,
  };
}

export const getShoeDashboard = createProfileAction(_getShoeDashboard, 'getShoeDashboard');
