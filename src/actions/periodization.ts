'use server';

import { db } from '@/lib/db';
import { trainingBlocks, plannedWorkouts, workouts, races } from '@/lib/schema';
import type { TrainingBlock, PlannedWorkout, Workout } from '@/lib/schema';
import { eq, asc, and, gte, lte, desc } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';
import { toLocalDateString, parseLocalDate } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────

export interface PeriodizationPhase {
  phase: string;
  startDate: string;
  endDate: string;
  weekCount: number;
  targetMileageMin: number;
  targetMileageMax: number;
  focus: string;
}

export interface MacroCycleData {
  phases: PeriodizationPhase[];
  raceName: string;
  raceDate: string;
  raceDistanceLabel: string;
  planStartDate: string;
  planEndDate: string;
  currentDate: string;
  totalWeeks: number;
}

export interface MesoWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  phase: string;
  targetMileage: number;
  actualMileage: number;
  isDownWeek: boolean;
  isCurrentWeek: boolean;
  qualitySessions: Array<{
    type: string; // T, I, LR, R
    name: string;
  }>;
}

export interface MesoCycleData {
  weeks: MesoWeek[];
  currentWeekIndex: number;
}

export interface MicroDay {
  date: string;
  dayLabel: string; // Mon, Tue, etc.
  plannedWorkoutType: string | null;
  plannedWorkoutName: string | null;
  isKeyWorkout: boolean;
  isCompleted: boolean;
  isToday: boolean;
  isFuture: boolean;
  actualMiles: number | null;
}

export interface MicroCycleData {
  days: MicroDay[];
  weekStart: string;
  weekEnd: string;
  phase: string;
  weekNumber: number;
}

export interface PeriodizationData {
  macro: MacroCycleData | null;
  meso: MesoCycleData | null;
  micro: MicroCycleData | null;
  hasTrainingPlan: boolean;
}

// ── Server Action ──────────────────────────────────────────────────────

export const getPeriodizationData = createProfileAction(
  async (profileId: number): Promise<PeriodizationData> => {
    const today = toLocalDateString(new Date());

    // Find upcoming A race with a training plan
    const upcomingRace = await db.query.races.findFirst({
      where: and(
        eq(races.profileId, profileId),
        gte(races.date, today),
        eq(races.trainingPlanGenerated, true),
      ),
      orderBy: [asc(races.date)],
    });

    // If no upcoming race with a plan, try any race with a plan
    const targetRace = upcomingRace || await db.query.races.findFirst({
      where: and(
        eq(races.profileId, profileId),
        eq(races.trainingPlanGenerated, true),
      ),
      orderBy: [desc(races.date)],
    });

    if (!targetRace) {
      return { macro: null, meso: null, micro: null, hasTrainingPlan: false };
    }

    // Get all training blocks for this race
    const blocks: TrainingBlock[] = await db.query.trainingBlocks.findMany({
      where: eq(trainingBlocks.raceId, targetRace.id),
      orderBy: [asc(trainingBlocks.weekNumber)],
    });

    if (blocks.length === 0) {
      return { macro: null, meso: null, micro: null, hasTrainingPlan: false };
    }

    // ── MACRO CYCLE ──────────────────────────────────────────────────

    // Group blocks by phase to build phase summaries
    const phaseMap = new Map<string, TrainingBlock[]>();
    for (const block of blocks) {
      const existing = phaseMap.get(block.phase) || [];
      existing.push(block);
      phaseMap.set(block.phase, existing);
    }

    const phaseOrder = ['base', 'build', 'peak', 'taper', 'recovery'];
    const phases: PeriodizationPhase[] = [];

    for (const phaseName of phaseOrder) {
      const phaseBlocks = phaseMap.get(phaseName);
      if (!phaseBlocks || phaseBlocks.length === 0) continue;

      const mileages = phaseBlocks
        .map(b => b.targetMileage)
        .filter((m): m is number => m !== null && m > 0);

      phases.push({
        phase: phaseName,
        startDate: phaseBlocks[0].startDate,
        endDate: phaseBlocks[phaseBlocks.length - 1].endDate,
        weekCount: phaseBlocks.length,
        targetMileageMin: mileages.length > 0 ? Math.min(...mileages) : 0,
        targetMileageMax: mileages.length > 0 ? Math.max(...mileages) : 0,
        focus: phaseBlocks[0].focus || getFallbackFocus(phaseName),
      });
    }

    const macro: MacroCycleData = {
      phases,
      raceName: targetRace.name,
      raceDate: targetRace.date,
      raceDistanceLabel: targetRace.distanceLabel,
      planStartDate: blocks[0].startDate,
      planEndDate: blocks[blocks.length - 1].endDate,
      currentDate: today,
      totalWeeks: blocks.length,
    };

    // ── MESO CYCLE (current 4-week block) ────────────────────────────

    // Find current block index
    const currentBlockIdx = blocks.findIndex(
      b => b.startDate <= today && b.endDate >= today
    );
    // If not in any block, find closest upcoming block
    const effectiveIdx = currentBlockIdx >= 0
      ? currentBlockIdx
      : blocks.findIndex(b => b.startDate > today);

    // Get a 4-week window centered around current week
    const mesoStart = Math.max(0, effectiveIdx >= 0 ? effectiveIdx - 1 : 0);
    const mesoEnd = Math.min(blocks.length, mesoStart + 4);
    const mesoBlocks = blocks.slice(mesoStart, mesoEnd);

    // Get actual weekly mileage from workout data
    const planStartStr = mesoBlocks.length > 0 ? mesoBlocks[0].startDate : today;
    const planEndStr = mesoBlocks.length > 0 ? mesoBlocks[mesoBlocks.length - 1].endDate : today;

    const actualWorkouts: Workout[] = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, planStartStr),
          lte(workouts.date, planEndStr)
        )
      )
      .orderBy(asc(workouts.date));

    // Get planned workouts for meso block identification
    const mesoBlockIds = mesoBlocks.map(b => b.id);
    const mesoPlannedWorkouts: PlannedWorkout[] = [];
    for (const blockId of mesoBlockIds) {
      const bw = await db.query.plannedWorkouts.findMany({
        where: eq(plannedWorkouts.trainingBlockId, blockId),
        orderBy: [asc(plannedWorkouts.date)],
      });
      mesoPlannedWorkouts.push(...bw);
    }

    const mesoWeeks: MesoWeek[] = mesoBlocks.map((block, idx) => {
      // Sum actual miles for this week
      const weekActual = actualWorkouts
        .filter(w => w.date >= block.startDate && w.date <= block.endDate)
        .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

      // Get quality sessions from planned workouts
      const weekPlanned = mesoPlannedWorkouts.filter(
        pw => pw.date >= block.startDate && pw.date <= block.endDate
      );
      const qualitySessions = weekPlanned
        .filter(pw => pw.isKeyWorkout)
        .map(pw => ({
          type: getWorkoutTypeAbbrev(pw.workoutType, pw.name),
          name: pw.name,
        }));

      const isCurrentWeek = block.startDate <= today && block.endDate >= today;

      return {
        weekNumber: block.weekNumber,
        startDate: block.startDate,
        endDate: block.endDate,
        phase: block.phase,
        targetMileage: block.targetMileage || 0,
        actualMileage: Math.round(weekActual * 10) / 10,
        isDownWeek: block.isDownWeek || false,
        isCurrentWeek,
        qualitySessions,
      };
    });

    const meso: MesoCycleData = {
      weeks: mesoWeeks,
      currentWeekIndex: mesoWeeks.findIndex(w => w.isCurrentWeek),
    };

    // ── MICRO CYCLE (current week) ───────────────────────────────────

    const todayDate = parseLocalDate(today);
    const dayOfWeek = todayDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + mondayOffset);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const microDays: MicroDay[] = [];

    const sundayDate = new Date(monday);
    sundayDate.setDate(monday.getDate() + 6);
    const weekStartStr = toLocalDateString(monday);
    const weekEndStr = toLocalDateString(sundayDate);

    // Get planned workouts for this week
    const weekPlanned: PlannedWorkout[] = await db.query.plannedWorkouts.findMany({
      where: and(
        gte(plannedWorkouts.date, weekStartStr),
        lte(plannedWorkouts.date, weekEndStr)
      ),
      orderBy: [asc(plannedWorkouts.date)],
    });

    // Get actual workouts for this week
    const weekActual: Workout[] = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, weekStartStr),
          lte(workouts.date, weekEndStr)
        )
      )
      .orderBy(asc(workouts.date));

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = toLocalDateString(date);

      const planned = weekPlanned.find(pw => pw.date === dateStr);
      const actual = weekActual.filter(w => w.date === dateStr);
      const totalActualMiles = actual.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
      const isCompleted = planned
        ? planned.status === 'completed' || actual.length > 0
        : actual.length > 0;

      microDays.push({
        date: dateStr,
        dayLabel: dayLabels[i],
        plannedWorkoutType: planned?.workoutType || null,
        plannedWorkoutName: planned?.name || null,
        isKeyWorkout: planned?.isKeyWorkout || false,
        isCompleted,
        isToday: dateStr === today,
        isFuture: dateStr > today,
        actualMiles: totalActualMiles > 0 ? Math.round(totalActualMiles * 10) / 10 : null,
      });
    }

    // Find current block for phase info
    const currentBlock = blocks.find(b => b.startDate <= today && b.endDate >= today);

    const micro: MicroCycleData = {
      days: microDays,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      phase: currentBlock?.phase || 'build',
      weekNumber: currentBlock?.weekNumber || 0,
    };

    return {
      macro,
      meso,
      micro,
      hasTrainingPlan: true,
    };
  },
  'getPeriodizationData'
);

// ── Helpers ────────────────────────────────────────────────────────────

function getFallbackFocus(phase: string): string {
  const focusMap: Record<string, string> = {
    base: 'Aerobic base building',
    build: 'Race-specific fitness',
    peak: 'Sharpening & speed',
    taper: 'Recovery & freshness',
    recovery: 'Active recovery',
  };
  return focusMap[phase] || '';
}

function getWorkoutTypeAbbrev(type: string, name: string): string {
  const lower = type.toLowerCase();
  const nameLower = name.toLowerCase();

  if (lower === 'long' || nameLower.includes('long run')) return 'LR';
  if (lower === 'tempo' || nameLower.includes('tempo')) return 'T';
  if (lower === 'interval' || nameLower.includes('interval') || nameLower.includes('vo2')) return 'I';
  if (lower === 'race') return 'R';
  if (nameLower.includes('threshold')) return 'TH';
  if (nameLower.includes('fartlek')) return 'F';
  if (nameLower.includes('hill')) return 'H';
  if (nameLower.includes('progression')) return 'P';
  return 'Q'; // Generic quality
}
