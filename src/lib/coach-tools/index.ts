// Coach tools barrel file - re-exports all public symbols
// Also contains the executeCoachTool dispatcher
// Auto-generated from coach-tools.ts split

// Re-export types
export type { WorkoutWithRelations, DemoContext, DemoAction } from './types';
export { PUBLIC_MODE_READ_ONLY_ERROR } from './types';

// Re-export shared utilities
export {
  createPendingCoachAction,
  buildProfileUpdates,
  formatPace,
  parseTimeToSeconds,
  formatTimeFromSeconds,
  formatSecondsToTime,
  getDateDaysAgo,
  getWeekStart,
  groupByWorkoutType,
  updateUserVDOTFromResult,
  getSettingsForProfile,
  recordCoachAction,
} from './shared';

// Re-export definitions
export { coachToolDefinitions, isMutatingCoachTool } from './definitions';

// Re-export demo tools
export { executeDemoTool } from './demo-tools';

// Re-export from all domain modules
export { getRecentWorkouts, getWorkoutDetail, getShoes, getUserSettings, logWorkout, updateWorkoutTool, logAssessment, getTrainingSummary, searchWorkouts } from './workout-tools';
export { getCurrentWeather, calculateAdjustedPace, getOutfitRecommendationTool, getWardrobe, addClothingItem, logOutfitFeedback } from './outfit-tools';
export { getTodaysWorkout, getWeeklyPlan, getPaceZones, modifyTodaysWorkout, getPlanAdherence } from './plan-tools';
export { getUserProfile, updateUserProfile } from './profile-tools';
export { getRaces, addRace, addRaceResult, updateRace, deleteRace, predictRaceTime } from './race-tools';
export { getTrainingPhilosophy, suggestPlanAdjustment } from './philosophy-tools';
export { getReadinessScore, analyzeWorkoutPatterns, getTrainingLoad, getProactiveAlerts } from './fitness-tools';
export { getTodaysPlannedWorkout, getPlannedWorkoutByDate, updatePlannedWorkout, suggestWorkoutModification, swapWorkouts, rescheduleWorkout, skipWorkout, getWeekWorkouts, makeDownWeek, insertRestDay, adjustWorkoutDistance, convertToEasy } from './schedule-tools';
export { getFitnessTrend, analyzeRecoveryPattern, compareWorkouts, getFatigueIndicators, estimateWorkoutQuality } from './analysis-tools';
export { logInjury, getInjuryRecommendations, clearInjury, getInjuryStatus, getRestrictionGuidance, setTravelStatus, getAltitudeAdjustment, getAltitudePaceAdjustment } from './health-tools';
export { getContextSummary, getPhaseDescription, getPreRunBriefing, getWeeklyReview, generateWeeklyCoachingNote, suggestNextWorkout, analyzeCompletedWorkout, explainWorkoutDifficulty, getUpcomingWeekPreview, generateWeekPreviewNote } from './briefing-tools';
export { generateTrainingPlan, getStandardPlansHandler, rewriteWorkoutForTime, explainWorkout, explainRecommendation, convertToTreadmill, generateRaceChecklist, activateBusyWeek, setTravelMode, generateReturnPlan, setCoachMode } from './generation-tools';
export { getRouteProgress, getWorkoutClassification, getExecutionScoreTool, getDataQualityReport, logSoreness, getWeeklyRecap, generateShareText, identifyAchievements } from './classification-tools';
export { getPrepForTomorrow, overrideWorkoutStructure, getPerformanceModel, handleGetCoachingKnowledge, prescribeWorkout, getRaceDayPlan, rememberContext, recallContext } from './advanced-tools';

// ---- Imports for executeCoachTool dispatcher ----
import { isPublicAccessMode } from '../access-mode';
import { isMutatingCoachTool } from './definitions';
import { PUBLIC_MODE_READ_ONLY_ERROR } from './types';
import type { DemoContext } from './types';
import { executeDemoTool } from './demo-tools';
import { getSettingsForProfile } from './shared';

// Import all implementation functions for the switch dispatcher
import { getRecentWorkouts, getWorkoutDetail, getShoes, getUserSettings, logWorkout, updateWorkoutTool, logAssessment, getTrainingSummary, searchWorkouts } from './workout-tools';
import { getCurrentWeather, calculateAdjustedPace, getOutfitRecommendationTool, getWardrobe, addClothingItem, logOutfitFeedback } from './outfit-tools';
import { getTodaysWorkout, getWeeklyPlan, getPaceZones, modifyTodaysWorkout, getPlanAdherence } from './plan-tools';
import { getUserProfile, updateUserProfile } from './profile-tools';
import { getRaces, addRace, addRaceResult, updateRace, deleteRace, predictRaceTime } from './race-tools';
import { getTrainingPhilosophy, suggestPlanAdjustment } from './philosophy-tools';
import { getReadinessScore, analyzeWorkoutPatterns, getTrainingLoad, getProactiveAlerts } from './fitness-tools';
import { getTodaysPlannedWorkout, getPlannedWorkoutByDate, updatePlannedWorkout, suggestWorkoutModification, swapWorkouts, rescheduleWorkout, skipWorkout, getWeekWorkouts, makeDownWeek, insertRestDay, adjustWorkoutDistance, convertToEasy } from './schedule-tools';
import { getFitnessTrend, analyzeRecoveryPattern, compareWorkouts, getFatigueIndicators, estimateWorkoutQuality } from './analysis-tools';
import { logInjury, clearInjury, getInjuryStatus, setTravelStatus, getAltitudePaceAdjustment } from './health-tools';
import { getContextSummary, getPreRunBriefing, getWeeklyReview, suggestNextWorkout, analyzeCompletedWorkout, explainWorkoutDifficulty, getUpcomingWeekPreview } from './briefing-tools';
import { getStandardPlansHandler, rewriteWorkoutForTime, explainWorkout, explainRecommendation, convertToTreadmill, generateRaceChecklist, activateBusyWeek, setTravelMode, generateReturnPlan, setCoachMode } from './generation-tools';
import { getRouteProgress, getWorkoutClassification, getExecutionScoreTool, getDataQualityReport, logSoreness, getWeeklyRecap } from './classification-tools';
import { getPrepForTomorrow, overrideWorkoutStructure, getPerformanceModel, handleGetCoachingKnowledge, prescribeWorkout, getRaceDayPlan, rememberContext, recallContext } from './advanced-tools';

// Additional imports needed by inline cases in executeCoachTool
import { performVibeCheck, adaptWorkout } from '../vibe-check-tool';
import { MasterPlanGenerator } from '../master-plan';
import type { MasterPlan } from '../master-plan';
import { DetailedWindowGenerator } from '../detailed-window-generator';
import { CoachingMemory } from '../coaching-memory';
import { db, workouts, races, userSettings } from '@/lib/db';
import { eq, gte, asc, and } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { format, addDays, startOfWeek } from 'date-fns';
import { calculatePaceZones } from '../training/vdot-calculator';

// The main dispatcher
export async function executeCoachTool(
  toolName: string,
  input: Record<string, unknown>,
  demoContext?: DemoContext,
  options?: { publicModeEnabled?: boolean }
): Promise<unknown> {
  try {
    const publicModeEnabled = options?.publicModeEnabled ?? isPublicAccessMode();
    if (publicModeEnabled && isMutatingCoachTool(toolName)) {
      return {
        error: PUBLIC_MODE_READ_ONLY_ERROR,
        code: 'PUBLIC_MODE_READ_ONLY',
        tool: toolName,
      };
    }

    // In demo mode, route to demo-specific implementations for certain tools
    if (demoContext?.isDemo) {
      const demoResult = executeDemoTool(toolName, input, demoContext);
      if (demoResult !== null) {
        return demoResult;
      }
      // Fall through to regular implementation if demo handler returns null
    }

    let result: unknown;
    switch (toolName) {
    case 'get_recent_workouts':
      result = await getRecentWorkouts(input);
      break;
    case 'get_workout_detail':
      result = await getWorkoutDetail(input);
      break;
    case 'get_shoes':
      result = await getShoes(input);
      break;
    case 'get_user_settings':
      result = await getUserSettings();
      break;
    case 'get_current_weather':
      result = await getCurrentWeather();
      break;
    case 'calculate_adjusted_pace':
      result = calculateAdjustedPace(input);
      break;
    case 'log_workout':
      result = await logWorkout(input);
      break;
    case 'update_workout':
      result = await updateWorkoutTool(input);
      break;
    case 'log_assessment':
      result = await logAssessment(input);
      break;
    case 'get_training_summary':
      result = await getTrainingSummary(input);
      break;
    case 'search_workouts':
      result = await searchWorkouts(input);
      break;
    case 'get_outfit_recommendation':
      result = await getOutfitRecommendationTool(input);
      break;
    case 'get_wardrobe':
      result = await getWardrobe(input);
      break;
    case 'add_clothing_item':
      return addClothingItem(input);
    case 'log_outfit_feedback':
      return logOutfitFeedback(input);
    // Training Plan Tools
    case 'get_todays_workout':
      return getTodaysWorkout();
    case 'get_weekly_plan':
      return getWeeklyPlan();
    case 'get_pace_zones':
      return getPaceZones();
    case 'get_user_profile':
      return getUserProfile();
    case 'update_user_profile':
      return updateUserProfile(input);
    case 'get_races':
      return getRaces(input);
    case 'add_race':
      return addRace(input);
    case 'add_race_result':
      return addRaceResult(input);
    case 'modify_todays_workout':
      return modifyTodaysWorkout(input);
    case 'get_plan_adherence':
      return getPlanAdherence(input);
    case 'get_readiness_score':
      return getReadinessScore();
    case 'predict_race_time':
      return predictRaceTime(input);
    case 'analyze_workout_patterns':
      return analyzeWorkoutPatterns(input);
    case 'get_training_load':
      return getTrainingLoad();
    case 'get_fitness_trend':
      return getFitnessTrend(input);
    case 'analyze_recovery_pattern':
      return analyzeRecoveryPattern(input);
    case 'compare_workouts':
      return compareWorkouts(input);
    case 'get_fatigue_indicators':
      return getFatigueIndicators(input);
    case 'estimate_workout_quality':
      return estimateWorkoutQuality(input);
    case 'get_proactive_alerts':
      return getProactiveAlerts();
    case 'get_todays_planned_workout':
      return getTodaysPlannedWorkout();
    case 'get_planned_workout_by_date':
      result = await getPlannedWorkoutByDate(input);
      break;
    case 'update_planned_workout':
      result = await updatePlannedWorkout(input);
      break;
    case 'suggest_workout_modification':
      result = await suggestWorkoutModification(input);
      break;
    case 'swap_workouts':
      return swapWorkouts(input);
    case 'reschedule_workout':
      return rescheduleWorkout(input);
    case 'skip_workout':
      return skipWorkout(input);
    case 'get_week_workouts':
      return getWeekWorkouts(input);
    case 'make_down_week':
      return makeDownWeek(input);
    case 'insert_rest_day':
      return insertRestDay(input);
    case 'adjust_workout_distance':
      return adjustWorkoutDistance(input);
    case 'convert_to_easy':
      return convertToEasy(input);
    case 'log_injury':
      return logInjury(input);
    case 'clear_injury':
      return clearInjury(input);
    case 'get_injury_status':
      return getInjuryStatus();
    case 'set_travel_status':
      return setTravelStatus(input);
    case 'get_altitude_pace_adjustment':
      return getAltitudePaceAdjustment(input);
    case 'get_context_summary':
      return getContextSummary();
    case 'get_pre_run_briefing':
      return getPreRunBriefing(input);
    case 'get_weekly_review':
      return getWeeklyReview(input);
    case 'suggest_next_workout':
      result = await suggestNextWorkout(input);
      break;
    case 'analyze_completed_workout':
      result = await analyzeCompletedWorkout(input);
      break;
    case 'explain_workout_difficulty':
      result = explainWorkoutDifficulty(input);
      break;
    case 'get_upcoming_week_preview':
      result = await getUpcomingWeekPreview();
      break;
    case 'update_race':
      result = await updateRace(input);
      break;
    case 'delete_race':
      result = await deleteRace(input);
      break;
    case 'get_training_philosophy':
      result = getTrainingPhilosophy(input);
      break;
    case 'suggest_plan_adjustment':
      result = await suggestPlanAdjustment(input);
      break;
    case 'generate_training_plan': {
      // Resolve race ID: explicit race_id > fuzzy race_name match > auto-select sole A-race
      let resolvedRaceId: number | undefined = input.race_id as number | undefined;

      if (!resolvedRaceId && input.race_name) {
        // Fuzzy match by race name
        const raceName = (input.race_name as string).toLowerCase();
        const planGenProfileId = await getActiveProfileId();
        const allUpcomingRaces = await db.query.races.findMany({
          where: planGenProfileId
            ? and(eq(races.profileId, planGenProfileId), gte(races.date, new Date().toISOString().split('T')[0]))
            : gte(races.date, new Date().toISOString().split('T')[0]),
          orderBy: asc(races.date),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const match = allUpcomingRaces.find((r: any) =>
          r.name.toLowerCase().includes(raceName) || raceName.includes(r.name.toLowerCase())
        );
        if (match) {
          resolvedRaceId = match.id;
        } else {
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            error: `Could not find a race matching "${input.race_name}". Available races: ${allUpcomingRaces.map((r: any) => `${r.name} [race_id=${r.id}]`).join(', ')}`,
          };
        }
      }

      if (!resolvedRaceId) {
        // Auto-select: if exactly one A-race exists, use it
        const autoSelectProfileId = await getActiveProfileId();
        const aRaces = await db.query.races.findMany({
          where: autoSelectProfileId
            ? and(eq(races.profileId, autoSelectProfileId), gte(races.date, new Date().toISOString().split('T')[0]), eq(races.priority, 'A'))
            : and(gte(races.date, new Date().toISOString().split('T')[0]), eq(races.priority, 'A')),
        });
        if (aRaces.length === 1) {
          resolvedRaceId = aRaces[0].id;
        } else if (aRaces.length > 1) {
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            error: `Multiple A-races found. Please specify which one: ${aRaces.map((r: any) => `${r.name} [race_id=${r.id}]`).join(', ')}`,
          };
        } else {
          const allUpcoming = await db.query.races.findMany({
            where: autoSelectProfileId
              ? and(eq(races.profileId, autoSelectProfileId), gte(races.date, new Date().toISOString().split('T')[0]))
              : gte(races.date, new Date().toISOString().split('T')[0]),
            orderBy: asc(races.date),
          });
          if (allUpcoming.length === 0) {
            return { error: 'No upcoming races found. Add a race first.' };
          }
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            error: `No A-race found. Available races: ${allUpcoming.map((r: any) => `${r.name} (${r.priority}) [race_id=${r.id}]`).join(', ')}`,
          };
        }
      }

      // If user provided override mileage, update settings first
      if (input.override_current_mileage) {
        const overrideMileage = input.override_current_mileage as number;
        const profileId = await getActiveProfileId();
        await db.update(userSettings)
          .set({
            currentWeeklyMileage: overrideMileage,
            updatedAt: new Date().toISOString()
          })
          .where(eq(userSettings.profileId, profileId!));
        console.warn(`[generateTrainingPlan] Updated current weekly mileage to ${overrideMileage} per user request`);
      }

      const { generateMacroPlanForRace } = await import('@/actions/training-plan');
      const planResult = await generateMacroPlanForRace(resolvedRaceId!);

      // If high variance detected, include a note
      let varianceNote = '';
      if (planResult.fitnessData?.hasHighVariance) {
        varianceNote = `\n\n[Warning] I noticed your weekly mileage varies quite a bit. The plan starts at ${planResult.fitnessData.typicalWeeklyMileage} miles/week based on your median. If you typically run more or less than this, let me know and I can adjust the plan.`;
      }

      // Return brief summary
      return {
        success: true,
        message: `Training plan generated for ${planResult.raceName}!${varianceNote}`,
        summary: planResult.summary,
        totalWeeks: planResult.totalWeeks,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phases: planResult.phases.map((p: any) => ({ phase: p.phase, weeks: p.weeks })),
        fitnessAssessment: planResult.fitnessAssessment,
        coachInstruction: 'Plan has been saved as a macro roadmap with detailed workouts for the first 3 weeks. Future weeks generate automatically as the athlete approaches them. Direct the user to /plan to see the full plan. Give a brief summary but do NOT list every workout.',
      };
    }
    case 'get_standard_plans':
      return getStandardPlansHandler(input);
    // New dreamy features
    case 'rewrite_workout_for_time':
      return rewriteWorkoutForTime(input);
    case 'explain_workout':
      return explainWorkout(input);
    case 'explain_recommendation':
      return explainRecommendation(input);
    case 'convert_to_treadmill':
      return convertToTreadmill(input);
    case 'generate_race_checklist':
      return generateRaceChecklist(input);
    case 'activate_busy_week':
      return activateBusyWeek(input);
    case 'set_travel_mode':
      return setTravelMode(input);
    case 'generate_return_plan':
      return generateReturnPlan(input);
    case 'set_coach_mode':
      return setCoachMode(input);
    case 'get_route_progress':
      return getRouteProgress(input);
    case 'get_workout_classification':
      return getWorkoutClassification(input);
    case 'get_execution_score':
      return getExecutionScoreTool(input);
    case 'get_data_quality_report':
      return getDataQualityReport(input);
    case 'log_soreness':
      return logSoreness(input);
    case 'get_weekly_recap':
      return getWeeklyRecap(input);
    case 'get_prep_for_tomorrow':
      return getPrepForTomorrow();
    case 'override_workout_structure':
      return overrideWorkoutStructure(input);
    case 'get_performance_model':
      return getPerformanceModel();
    case 'get_coaching_knowledge':
      return handleGetCoachingKnowledge(input);
    case 'prescribe_workout':
      result = await prescribeWorkout(input);
      break;
    case 'get_race_day_plan':
      result = await getRaceDayPlan(input);
      break;
    case 'remember_context':
      result = await rememberContext(input);
      break;
    case 'recall_context':
      result = await recallContext(input);
      break;
    case 'vibe_check':
      const vibeProfileId = await getActiveProfileId();
      result = await performVibeCheck({
        check_type: input.check_type as string,
        planned_workout: input.planned_workout,
        profileId: vibeProfileId
      });
      break;
    case 'adapt_workout':
      result = adaptWorkout({
        original_workout: input.original_workout,
        runner_feedback: input.runner_feedback,
        context: input.context
      });
      break;
    case 'create_master_plan':
      const planGenerator = new MasterPlanGenerator();
      const masterPlanProfileId = await getActiveProfileId();
      result = await planGenerator.createMasterPlan({
        profileId: masterPlanProfileId!,
        goalRaceId: input.goal_race_id as number || 1,
        goalRaceDate: input.goal_race_date as string,
        goalRaceDistance: input.goal_race_distance as string,
        currentVDOT: input.current_vdot as number,
        currentWeeklyMileage: input.current_weekly_mileage as number,
        peakMileageTarget: input.peak_mileage_target as number,
        preferences: {
          aggressiveness: (input.aggressiveness as 'conservative' | 'moderate' | 'aggressive') || 'moderate'
        }
      });
      break;
    case 'generate_detailed_window':
      const windowGenerator = new DetailedWindowGenerator();
      // Get user profile and settings (use full settings for VDOT, paces, etc.)
      const windowSettings = await getSettingsForProfile();
      const windowPaceZones = calculatePaceZones(windowSettings?.vdot || 45);
      const formatZonePace = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };
      const userProfile = {
        vdot: windowSettings?.vdot || 45,
        paces: {
          easy: formatZonePace(windowPaceZones.easy),
          marathon: formatZonePace(windowPaceZones.marathon),
          threshold: formatZonePace(windowPaceZones.threshold),
          interval: formatZonePace(windowPaceZones.interval),
          repetition: formatZonePace(windowPaceZones.repetition),
        },
        preferredDays: windowSettings?.preferredQualityDays ? JSON.parse(windowSettings.preferredQualityDays) as string[] : undefined,
        restDays: windowSettings?.requiredRestDays ? JSON.parse(windowSettings.requiredRestDays) as string[] : undefined,
        longRunDay: windowSettings?.preferredLongRunDay ?? undefined,
        currentMileage: windowSettings?.currentWeeklyMileage || 30,
        injuryHistory: windowSettings?.injuryHistory ? [windowSettings.injuryHistory] : undefined,
        comfortLevels: undefined as undefined,
      };
      // Get recent history with actual fitness metrics
      const windowProfileId = await getActiveProfileId();
      let ctl = 0, atl = 0, tsb = 0;
      try {
        const { getFitnessTrendData } = await import('@/actions/fitness');
        const fitnessData = await getFitnessTrendData(30, windowProfileId);
        ctl = fitnessData.currentCtl;
        atl = fitnessData.currentAtl;
        tsb = fitnessData.currentTsb;
      } catch { /* fitness data unavailable, use defaults */ }
      const recentWorkoutsForWindow = await getRecentWorkouts({ count: 14 });
      const recentHistory = {
        workouts: recentWorkoutsForWindow as unknown as Array<{ date: string; type: string; distance: number; avgPace: string; verdict?: string; rpe?: number }>,
        assessments: [] as Array<{ date: string; sleep: number; stress: number; soreness: number; motivation: number }>,
        ctl,
        atl,
        tsb
      };
      // For now, use a mock master plan - in real implementation would fetch from DB
      const mockMasterPlan: import('../master-plan').MasterPlan = {
        id: 1,
        profileId: windowProfileId || 1,
        goalRaceId: 1,
        name: 'Half Marathon Plan',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
        phases: [],
        weeklyTargets: [
          {
            weekNumber: 1,
            weekStartDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            totalMiles: 35,
            longRunMiles: 10,
            qualitySessions: 2 as const,
            cutbackWeek: false
          },
          // Add more weeks as needed
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      result = await windowGenerator.generateDetailedWindow({
        masterPlan: mockMasterPlan,
        userProfile,
        recentHistory,
        windowWeeks: input.window_weeks as 2 | 3 || 3
      });
      break;
    case 'should_regenerate_master_plan':
      // Mock implementation for now
      result = {
        needsUpdate: false,
        reason: '',
        suggestedChanges: []
      };
      break;
    case 'save_memory':
      const memory = new CoachingMemory();
      const profileId = await getActiveProfileId();
      const expiresAt = input.expires_in_days
        ? new Date(Date.now() + (input.expires_in_days as number) * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      await memory.storeInsights([{
        profileId: profileId!,
        category: input.category as 'preference' | 'injury' | 'goal' | 'constraint' | 'pattern' | 'feedback',
        subcategory: null,
        insight: input.insight as string,
        confidence: input.confidence as number,
        source: input.source as 'explicit' | 'inferred',
        extractedFrom: 'coach_conversation',
        metadata: null,
        expiresAt: expiresAt ?? null,
        isActive: true,
      }]);

      result = {
        success: true,
        message: `Saved ${input.category}: "${input.insight}"`,
        confidence: input.confidence,
        expires: expiresAt || 'never'
      };
      break;
    case 'assess_fitness':
      const fitnessProfileId = await getActiveProfileId();
      const { assessCurrentFitness, formatFitnessAssessment } = await import('@/lib/training/fitness-assessment');
      const fitnessData = await assessCurrentFitness(fitnessProfileId!);

      // If variance is high, suggest asking the user
      let suggestion = '';
      if (fitnessData.hasHighVariance) {
        suggestion = `\n\n**Note:** Your weekly mileage has been variable (${fitnessData.weeklyMileageDetails.join(', ')} miles). `;
        suggestion += `I'm using ${fitnessData.typicalWeeklyMileage} miles/week as your baseline. `;
        suggestion += `If this doesn't reflect your typical week, let me know what you consider normal.`;
      }

      result = {
        assessment: formatFitnessAssessment(fitnessData) + suggestion,
        fitnessData: fitnessData,
        hasHighVariance: fitnessData.hasHighVariance,
        weeklyDetails: fitnessData.weeklyMileageDetails
      };
      break;
    case 'recall_memory':
      const recallMemory = new CoachingMemory();
      const recallProfileId = await getActiveProfileId();

      if (input.category === 'all') {
        // Get all categories
        const allInsights = await recallMemory.getRelevantInsights(
          recallProfileId!,
          input.context as string || '',
          20
        );

        result = {
          insights: allInsights.map(i => ({
            category: i.category,
            insight: i.insight,
            confidence: i.confidence,
            source: i.source,
            age_days: Math.floor((Date.now() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
            expires: i.expiresAt
          })),
          total_count: allInsights.length
        };
      } else {
        // Get specific category with context
        const categoryInsights = await recallMemory.getRelevantInsights(
          recallProfileId!,
          input.context as string || input.category as string,
          10
        );

        const filtered = categoryInsights.filter(i => i.category === input.category);

        result = {
          insights: filtered.map(i => ({
            category: i.category,
            insight: i.insight,
            confidence: i.confidence,
            source: i.source,
            age_days: Math.floor((Date.now() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
            expires: i.expiresAt
          })),
          total_count: filtered.length
        };
      }
      break;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
    }

    return result;
  } catch (error) {
    console.error(`=== [executeCoachTool] ERROR === Tool: ${toolName} at ${new Date().toISOString()}`);
    console.error(`[executeCoachTool] Error:`, error);
    console.error(`[executeCoachTool] Stack:`, error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}
