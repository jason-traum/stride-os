// health-tools - Coach tool implementations
// Auto-generated from coach-tools.ts split

// Coach tools for Claude function calling

import { db, workouts, assessments, shoes, userSettings, clothingItems, races, raceResults, plannedWorkouts, trainingBlocks, sorenessEntries, canonicalRoutes, coachActions } from '@/lib/db';
import { eq, desc, gte, asc, and, lte, lt } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { fetchCurrentWeather, type WeatherCondition } from '../weather';
import { calculateConditionsSeverity, calculatePaceAdjustment, parsePaceToSeconds } from '../conditions';
import { calculateVibesTemp, getOutfitRecommendation, matchWardrobeItems, getCategoryLabel } from '../outfit';
import { calculatePace, formatPace as formatPaceFromTraining } from '../utils';
import { format, addDays, startOfWeek } from 'date-fns';
import { calculateVDOT, calculatePaceZones } from '../training/vdot-calculator';
import { RACE_DISTANCES } from '../training/types';
import { detectAlerts } from '../alerts';
import { enhancedPrescribeWorkout } from '../enhanced-prescribe-workout';
import type { WorkoutType, Verdict, NewAssessment, ClothingCategory, TemperaturePreference, OutfitRating, ExtremityRating, RacePriority, Workout, Assessment, Shoe, ClothingItem, PlannedWorkout, Race, CanonicalRoute, WorkoutSegment, UserSettings } from '../schema';
import { performVibeCheck, adaptWorkout, vibeCheckDefinition, adaptWorkoutDefinition } from '../vibe-check-tool';
import { MasterPlanGenerator } from '../master-plan';
import { DetailedWindowGenerator } from '../detailed-window-generator';
import { CoachingMemory } from '../coaching-memory';

// New feature imports
import {
  classifyRun,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  computeQualityRatio,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  computeTRIMP,
} from '../training/run-classifier';
import {
  computeExecutionScore,
  parseExecutionDetails,
} from '../training/execution-scorer';
import {
  checkDataQuality,
  parseDataQualityFlags,
  getDataQualitySummary,
  type DataQualityFlags,
} from '../training/data-quality';
import {
  getRouteProgressSummary,
} from '../training/route-matcher';
import { generateExplanationContext } from '../training/workout-processor';
import {
  standardPlans,
  getStandardPlan,
  getPlansByAuthor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSuitablePlans,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type StandardPlanTemplate,
} from '../training/standard-plans';
import { buildPerformanceModel } from '../training/performance-model';
import { getCoachingKnowledge, getRelatedTopics, getTopicWithRelated, type KnowledgeTopic } from '../coach-knowledge';
import { isPublicAccessMode } from '../access-mode';

// Analytics imports for coach context (roadmap 3.15)
import { getFatigueResistanceData } from '@/actions/fatigue-resistance';
import { getSplitTendencyData } from '@/actions/split-tendency';
import { getRunningEconomyData } from '@/actions/running-economy';

// Threshold detection & recovery model imports
import { getThresholdEstimate } from '@/actions/threshold';
import { getRecoveryAnalysis } from '@/actions/recovery';


// Shared utilities from split modules
import { getSettingsForProfile, recordCoachAction, formatPace, parseTimeToSeconds, formatTimeFromSeconds, formatSecondsToTime, getDateDaysAgo, getWeekStart, groupByWorkoutType, buildProfileUpdates, updateUserVDOTFromResult, createPendingCoachAction } from './shared';
import type { WorkoutWithRelations, DemoContext, DemoAction } from './types';


export interface Injury {
  body_part: string;
  side?: string;
  severity: string;
  description?: string;
  restrictions: string[];
  logged_date: string;
}

async function logInjury(input: Record<string, unknown>) {
  const bodyPart = input.body_part as string;
  const side = input.side as string | undefined;
  const severity = input.severity as string;
  const description = input.description as string | undefined;
  const restrictions = (input.restrictions as string[]) || [];

  const s = await getSettingsForProfile();

  if (!s) {
    return { success: false, error: 'User settings not found' };
  }

  // Parse existing injuries or start fresh
  let currentInjuries: Injury[] = [];
  try {
    if (s.currentInjuries) {
      currentInjuries = JSON.parse(s.currentInjuries);
    }
  } catch {
    currentInjuries = [];
  }

  // Add or update injury
  const existingIndex = currentInjuries.findIndex(
    (i: Injury) => i.body_part === bodyPart && (!side || i.side === side)
  );

  const newInjury: Injury = {
    body_part: bodyPart,
    side,
    severity,
    description,
    restrictions,
    logged_date: new Date().toISOString().split('T')[0],
  };

  if (existingIndex >= 0) {
    currentInjuries[existingIndex] = newInjury;
  } else {
    currentInjuries.push(newInjury);
  }

  await db.update(userSettings)
    .set({
      currentInjuries: JSON.stringify(currentInjuries),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userSettings.id, s.id));

  // Build restriction summary
  const allRestrictions = Array.from(new Set(currentInjuries.flatMap((i: Injury) => i.restrictions)));

  return {
    success: true,
    message: `Logged ${severity} ${bodyPart}${side ? ` (${side})` : ''} injury`,
    injury: newInjury,
    total_active_injuries: currentInjuries.length,
    active_restrictions: allRestrictions,
    recommendations: getInjuryRecommendations(severity, bodyPart, restrictions),
  };
}

function getInjuryRecommendations(severity: string, bodyPart: string, restrictions: string[]): string[] {
  const recs: string[] = [];

  if (severity === 'severe') {
    recs.push('Consider seeing a sports medicine doctor or physical therapist.');
    recs.push('Rest is priority. Running through severe pain often extends recovery time significantly.');
  } else if (severity === 'moderate') {
    recs.push('Monitor closely. If it gets worse or doesn\'t improve in a week, see a professional.');
    recs.push('Cross-training (pool running, cycling) can maintain fitness while reducing impact.');
  } else {
    recs.push('Keep an eye on it. Many niggles resolve with a few easy days.');
  }

  if (bodyPart === 'achilles' || bodyPart === 'plantar_fascia') {
    recs.push('Avoid hills and speed work until resolved. Both put extra stress on these areas.');
  }

  if (bodyPart === 'shin') {
    recs.push('Shin pain can progress to stress fractures. If pain persists or worsens, get imaging.');
  }

  if (bodyPart === 'it_band' || bodyPart === 'knee') {
    recs.push('Foam rolling and hip strengthening exercises often help these issues.');
  }

  return recs;
}

async function clearInjury(input: Record<string, unknown>) {
  const bodyPart = input.body_part as string;
  const notes = input.notes as string | undefined;

  const s = await getSettingsForProfile();

  if (!s) {
    return { success: false, error: 'User settings not found' };
  }

  let currentInjuries: Injury[] = [];
  try {
    if (s.currentInjuries) {
      currentInjuries = JSON.parse(s.currentInjuries);
    }
  } catch {
    currentInjuries = [];
  }

  const clearedInjury = currentInjuries.find(
    (i: Injury) => i.body_part.toLowerCase().includes(bodyPart.toLowerCase())
  );

  if (!clearedInjury) {
    return {
      success: true,
      message: `No active injury found for "${bodyPart}". Current injuries: ${currentInjuries.map((i: Injury) => i.body_part).join(', ') || 'none'}`,
    };
  }

  // Remove from active injuries
  currentInjuries = currentInjuries.filter(
    (i: Injury) => !i.body_part.toLowerCase().includes(bodyPart.toLowerCase())
  );

  // Add to history
  let injuryHistory = s.injuryHistory || '';
  const historyEntry = `${clearedInjury.body_part} (${clearedInjury.logged_date} - ${new Date().toISOString().split('T')[0]})${notes ? ': ' + notes : ''}`;
  injuryHistory = injuryHistory ? `${injuryHistory}\n${historyEntry}` : historyEntry;

  await db.update(userSettings)
    .set({
      currentInjuries: JSON.stringify(currentInjuries),
      injuryHistory,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userSettings.id, s.id));

  const remainingRestrictions = Array.from(new Set(currentInjuries.flatMap((i: Injury) => i.restrictions)));

  return {
    success: true,
    message: `Cleared ${clearedInjury.body_part} injury. Great that you're feeling better!`,
    cleared_injury: clearedInjury,
    remaining_injuries: currentInjuries.length,
    remaining_restrictions: remainingRestrictions,
    note: currentInjuries.length === 0
      ? 'No active injuries. Return to normal training, but ease back in.'
      : `Still tracking: ${currentInjuries.map((i: Injury) => i.body_part).join(', ')}`,
  };
}

async function getInjuryStatus() {
  const s = await getSettingsForProfile();

  if (!s) {
    return { active_injuries: [] as Injury[], restrictions: [] as string[], has_restrictions: false, injury_history: null as string | null };
  }

  let currentInjuries: Injury[] = [];
  try {
    if (s.currentInjuries) {
      currentInjuries = JSON.parse(s.currentInjuries);
    }
  } catch {
    currentInjuries = [];
  }

  const allRestrictions = Array.from(new Set(currentInjuries.flatMap((i: Injury) => i.restrictions)));

  return {
    active_injuries: currentInjuries.map((i: Injury) => ({
      body_part: i.body_part,
      side: i.side,
      severity: i.severity,
      logged_date: i.logged_date,
      restrictions: i.restrictions,
    })),
    restrictions: allRestrictions,
    has_restrictions: allRestrictions.length > 0,
    injury_history: s.injuryHistory || null,
    recommendations: allRestrictions.length > 0
      ? getRestrictionGuidance(allRestrictions)
      : ['No active restrictions. Train as planned.'],
  };
}

function getRestrictionGuidance(restrictions: string[]): string[] {
  const guidance: string[] = [];

  if (restrictions.includes('no_running')) {
    guidance.push('No running currently. Cross-train only (pool, bike, elliptical).');
  }
  if (restrictions.includes('easy_only')) {
    guidance.push('Easy runs only. No quality sessions until cleared.');
  }
  if (restrictions.includes('no_speed_work')) {
    guidance.push('No speed work or intervals. Tempo runs may be okay if they don\'t aggravate.');
  }
  if (restrictions.includes('no_hills')) {
    guidance.push('Avoid hills. Extra stress on lower legs and Achilles.');
  }
  if (restrictions.includes('no_long_runs')) {
    guidance.push('Cap runs at 8-10 miles. Long runs can aggravate some injuries.');
  }
  if (restrictions.includes('reduced_mileage')) {
    guidance.push('Reduce weekly volume by 30-50% until symptoms improve.');
  }

  return guidance;
}

async function setTravelStatus(input: Record<string, unknown>) {
  const isTraveling = input.is_traveling as boolean;
  const location = input.location as string | undefined;
  const altitudeFeet = input.altitude_feet as number | undefined;
  const startDate = input.start_date as string | undefined;
  const endDate = input.end_date as string | undefined;
  const facilities = input.facilities as string | undefined;

  const s = await getSettingsForProfile();

  if (!s) {
    return { success: false, error: 'User settings not found' };
  }

  // Store travel info in coach_context or a travel-specific field
  let coachContext = s.coachContext || '';

  // Remove old travel notes
  coachContext = coachContext.replace(/\[TRAVEL:.*?\]/g, '').trim();

  if (isTraveling && location) {
    const travelNote = `[TRAVEL: ${location}${altitudeFeet ? ` at ${altitudeFeet}ft` : ''}${startDate ? ` from ${startDate}` : ''}${endDate ? ` to ${endDate}` : ''}${facilities ? ` - ${facilities}` : ''}]`;
    coachContext = `${travelNote} ${coachContext}`.trim();
  }

  await db.update(userSettings)
    .set({
      coachContext,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userSettings.id, s.id));

  if (!isTraveling) {
    return {
      success: true,
      message: 'Travel status cleared. Back to normal training.',
    };
  }

  // Calculate altitude impact if provided
  let altitudeNote = null;
  if (altitudeFeet && altitudeFeet > 3000) {
    const paceAdjustment = getAltitudeAdjustment(altitudeFeet);
    altitudeNote = {
      altitude_feet: altitudeFeet,
      pace_adjustment_percent: paceAdjustment.percent,
      guidance: paceAdjustment.guidance,
    };
  }

  return {
    success: true,
    message: `Travel status set: ${location}`,
    location,
    altitude: altitudeNote,
    dates: startDate && endDate ? `${startDate} to ${endDate}` : null,
    facilities,
    training_notes: [
      altitudeFeet && altitudeFeet > 4000
        ? `At ${altitudeFeet}ft, expect runs to feel harder. Adjust pace by ~${getAltitudeAdjustment(altitudeFeet).percent}% and focus on effort, not pace.`
        : null,
      facilities?.includes('treadmill')
        ? 'Treadmill available - good for maintaining workouts. Set 1% incline to simulate outdoor running.'
        : null,
      'Travel fatigue is real. First run or two may feel off. That\'s normal.',
    ].filter(Boolean),
  };
}

function getAltitudeAdjustment(altitudeFeet: number): { percent: number; guidance: string } {
  // Rough rule: ~3% slower per 1000ft above 4000ft for unacclimatized runners
  // Similar to heat adjustment philosophy - focus on effort, not pace
  if (altitudeFeet < 3000) {
    return { percent: 0, guidance: 'Minimal altitude impact.' };
  } else if (altitudeFeet < 5000) {
    return { percent: 3, guidance: 'Slight altitude effect. Run by feel.' };
  } else if (altitudeFeet < 7000) {
    return { percent: 6, guidance: 'Noticeable altitude. Easy runs should feel easy regardless of pace.' };
  } else if (altitudeFeet < 9000) {
    return { percent: 10, guidance: 'Significant altitude. All runs will feel harder. RPE is your guide.' };
  } else {
    return { percent: 15, guidance: 'High altitude. Take it very easy. Consider shorter runs.' };
  }
}

async function getAltitudePaceAdjustment(input: Record<string, unknown>) {
  const altitudeFeet = input.altitude_feet as number;
  const daysAtAltitude = (input.days_at_altitude as number) || 0;

  const baseAdjustment = getAltitudeAdjustment(altitudeFeet);

  // Acclimatization reduces impact over ~2 weeks
  let acclimatizationFactor = 1.0;
  if (daysAtAltitude > 0) {
    acclimatizationFactor = Math.max(0.5, 1 - (daysAtAltitude * 0.04)); // ~4% reduction per day, max 50% reduction
  }

  const adjustedPercent = Math.round(baseAdjustment.percent * acclimatizationFactor);

  return {
    altitude_feet: altitudeFeet,
    days_at_altitude: daysAtAltitude,
    pace_adjustment_percent: adjustedPercent,
    guidance: baseAdjustment.guidance,
    acclimatization_note: daysAtAltitude > 0
      ? `After ${daysAtAltitude} days, your body has partially adapted.`
      : 'No acclimatization yet. First few days will feel hardest.',
    key_principle: 'Like heat, altitude means slower paces at the same effort. This is still good training. Focus on RPE, not the watch.',
  };
}

export {
  logInjury,
  getInjuryRecommendations,
  clearInjury,
  getInjuryStatus,
  getRestrictionGuidance,
  setTravelStatus,
  getAltitudeAdjustment,
  getAltitudePaceAdjustment,
};
