'use server';

import { db, shoes, workouts } from '@/lib/db';
import { eq, and, isNotNull } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

// Same workout type grouping used by shoe-dashboard
const TYPE_GROUPS = {
  easy: ['recovery', 'easy', 'steady'],
  tempo: ['marathon', 'tempo', 'threshold'],
  interval: ['interval', 'repetition'],
  long: ['long'],
  race: ['race'],
} as const;

type TypeGroup = keyof typeof TYPE_GROUPS;
const ALL_TYPE_GROUPS: TypeGroup[] = ['easy', 'tempo', 'interval', 'long', 'race'];

const TYPE_GROUP_LABELS: Record<TypeGroup, string> = {
  easy: 'Easy',
  tempo: 'Tempo',
  interval: 'Interval',
  long: 'Long Run',
  race: 'Race',
};

const ROLE_LABELS: Record<TypeGroup, string> = {
  easy: 'Daily Trainer',
  tempo: 'Tempo Shoe',
  interval: 'Speed Work',
  long: 'Long Run',
  race: 'Race Day',
};

// Explicit types for query results (db is untyped due to dynamic adapter)
interface ShoeRecord {
  id: number;
  name: string;
  brand: string;
  model: string;
  isRetired: boolean;
}

interface WorkoutRecord {
  shoeId: number | null;
  workoutType: string;
  date: string;
}

function classifyWorkoutType(workoutType: string): TypeGroup | null {
  for (const [group, types] of Object.entries(TYPE_GROUPS)) {
    if ((types as readonly string[]).includes(workoutType)) {
      return group as TypeGroup;
    }
  }
  return null; // cross_train, other => skip
}

export interface ShoeRotationCell {
  count: number;
  percentage: number; // percentage of this type that uses this shoe
}

export interface ShoeRotationRow {
  shoeId: number;
  shoeName: string;
  brand: string;
  model: string;
  isRetired: boolean;
  cells: Record<TypeGroup, ShoeRotationCell>;
  totalWorkouts: number;
  primaryRole: TypeGroup | null;
  roleBadge: string;
}

export interface TypePreference {
  type: TypeGroup;
  label: string;
  preferredShoeId: number | null;
  preferredShoeName: string | null;
  totalWorkouts: number;
}

export interface ShoeRotationInsight {
  text: string;
}

export interface ShoeRotationData {
  rows: ShoeRotationRow[];
  typePreferences: TypePreference[];
  insights: ShoeRotationInsight[];
  rotationScore: number; // 0-100, how well they distribute across shoes
  avgShoesPerWeek: number;
  totalWorkoutsAnalyzed: number;
}

async function _getShoeRotation(profileId: number): Promise<ShoeRotationData> {
  // Get all shoes for this profile
  const allShoes: ShoeRecord[] = await db
    .select({
      id: shoes.id,
      name: shoes.name,
      brand: shoes.brand,
      model: shoes.model,
      isRetired: shoes.isRetired,
    })
    .from(shoes)
    .where(eq(shoes.profileId, profileId));

  if (allShoes.length === 0) {
    return {
      rows: [],
      typePreferences: [],
      insights: [],
      rotationScore: 0,
      avgShoesPerWeek: 0,
      totalWorkoutsAnalyzed: 0,
    };
  }

  // Get all workouts with a shoe assigned
  const shoeWorkouts: WorkoutRecord[] = await db
    .select({
      shoeId: workouts.shoeId,
      workoutType: workouts.workoutType,
      date: workouts.date,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.profileId, profileId),
        isNotNull(workouts.shoeId),
      )
    );

  if (shoeWorkouts.length === 0) {
    return {
      rows: [],
      typePreferences: [],
      insights: [],
      rotationScore: 0,
      avgShoesPerWeek: 0,
      totalWorkoutsAnalyzed: 0,
    };
  }

  // Build the matrix: shoe x type group
  const matrix: Record<number, Record<TypeGroup, number>> = {};
  const typeTotals: Record<TypeGroup, number> = {
    easy: 0, tempo: 0, interval: 0, long: 0, race: 0,
  };

  // Track weekly shoe usage for rotation score
  const weeklyShoes: Record<string, Set<number>> = {};

  for (const w of shoeWorkouts) {
    const group = classifyWorkoutType(w.workoutType);
    if (!group || !w.shoeId) continue;

    if (!matrix[w.shoeId]) {
      matrix[w.shoeId] = { easy: 0, tempo: 0, interval: 0, long: 0, race: 0 };
    }
    matrix[w.shoeId][group]++;
    typeTotals[group]++;

    // Track week: use ISO week (YYYY-Www)
    if (w.date) {
      const d = new Date(w.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay()); // Sunday start
      const weekKey = weekStart.toISOString().slice(0, 10);
      if (!weeklyShoes[weekKey]) weeklyShoes[weekKey] = new Set();
      weeklyShoes[weekKey].add(w.shoeId);
    }
  }

  // Build rows (only shoes that have at least one tracked workout)
  const shoeMap = new Map(allShoes.map(s => [s.id, s]));
  const rows: ShoeRotationRow[] = [];

  for (const [shoeIdStr, counts] of Object.entries(matrix)) {
    const shoeId = Number(shoeIdStr);
    const shoe = shoeMap.get(shoeId);
    if (!shoe) continue;

    const totalWorkouts = ALL_TYPE_GROUPS.reduce((sum, g) => sum + counts[g], 0);

    // Find primary role (highest count)
    let primaryRole: TypeGroup | null = null;
    let maxCount = 0;
    for (const g of ALL_TYPE_GROUPS) {
      if (counts[g] > maxCount) {
        maxCount = counts[g];
        primaryRole = g;
      }
    }

    const cells: Record<TypeGroup, ShoeRotationCell> = {} as Record<TypeGroup, ShoeRotationCell>;
    for (const g of ALL_TYPE_GROUPS) {
      cells[g] = {
        count: counts[g],
        percentage: typeTotals[g] > 0 ? Math.round((counts[g] / typeTotals[g]) * 100) : 0,
      };
    }

    rows.push({
      shoeId,
      shoeName: shoe.name,
      brand: shoe.brand,
      model: shoe.model,
      isRetired: shoe.isRetired,
      cells,
      totalWorkouts,
      primaryRole,
      roleBadge: primaryRole ? ROLE_LABELS[primaryRole] : 'Mixed Use',
    });
  }

  // Sort by total workouts descending
  rows.sort((a, b) => b.totalWorkouts - a.totalWorkouts);

  // Type preferences: which shoe is preferred for each type
  const typePreferences: TypePreference[] = ALL_TYPE_GROUPS.map(g => {
    let bestShoeId: number | null = null;
    let bestCount = 0;

    for (const row of rows) {
      if (row.cells[g].count > bestCount) {
        bestCount = row.cells[g].count;
        bestShoeId = row.shoeId;
      }
    }

    const bestShoe = bestShoeId ? shoeMap.get(bestShoeId) : null;

    return {
      type: g,
      label: TYPE_GROUP_LABELS[g],
      preferredShoeId: bestShoeId,
      preferredShoeName: bestShoe?.name ?? null,
      totalWorkouts: typeTotals[g],
    };
  }).filter(tp => tp.totalWorkouts > 0);

  // Generate insights
  const insights: ShoeRotationInsight[] = [];

  // "You use X for Y% of Z runs"
  for (const row of rows) {
    if (row.primaryRole && row.cells[row.primaryRole].percentage >= 50) {
      const pct = row.cells[row.primaryRole].percentage;
      const typeLabel = TYPE_GROUP_LABELS[row.primaryRole].toLowerCase();
      insights.push({
        text: `You use ${row.shoeName} for ${pct}% of ${typeLabel} runs.`,
      });
    }
  }

  // Dedicated race shoe detection
  for (const row of rows) {
    if (row.cells.race.count > 0 && row.cells.race.percentage >= 60) {
      const otherRuns = row.totalWorkouts - row.cells.race.count;
      if (otherRuns <= 2) {
        insights.push({
          text: `${row.shoeName} is your dedicated race shoe${row.cells.race.count > 1 ? ` (${row.cells.race.count} races)` : ''}.`,
        });
      }
    }
  }

  // Workhorse shoe detection
  const totalTracked = shoeWorkouts.filter(w => classifyWorkoutType(w.workoutType) !== null).length;
  for (const row of rows) {
    const pct = totalTracked > 0 ? Math.round((row.totalWorkouts / totalTracked) * 100) : 0;
    if (pct >= 60 && rows.length > 1) {
      insights.push({
        text: `${row.shoeName} carries ${pct}% of your total mileage -- consider rotating more.`,
      });
    }
  }

  // Single-shoe warning
  const activeShoesUsed = rows.filter(r => !r.isRetired);
  if (activeShoesUsed.length === 1 && allShoes.filter(s => !s.isRetired).length > 1) {
    insights.push({
      text: `You have multiple shoes but only use ${activeShoesUsed[0].shoeName}. Rotating shoes can extend their life.`,
    });
  }

  // Compute rotation score (0-100)
  // Based on entropy of shoe usage. Perfect rotation = 100, single shoe = 0.
  let rotationScore = 0;
  if (rows.length > 1 && totalTracked > 0) {
    const proportions = rows.map(r => r.totalWorkouts / totalTracked);
    // Shannon entropy normalized to [0,1]
    const maxEntropy = Math.log(rows.length);
    const entropy = -proportions.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0);
    rotationScore = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
  } else if (rows.length === 1) {
    rotationScore = 0;
  }

  // Average shoes per week
  const weekEntries = Object.values(weeklyShoes);
  const avgShoesPerWeek = weekEntries.length > 0
    ? Math.round((weekEntries.reduce((sum, s) => sum + s.size, 0) / weekEntries.length) * 10) / 10
    : 0;

  return {
    rows,
    typePreferences,
    insights,
    rotationScore,
    avgShoesPerWeek,
    totalWorkoutsAnalyzed: totalTracked,
  };
}

export const getShoeRotation = createProfileAction(_getShoeRotation, 'getShoeRotation');
