# coach-tools.ts Splitting Analysis

**Task**: 8.1 - Audit and propose splitting strategy for `src/lib/coach-tools.ts`
**Date**: 2026-02-22
**File size**: 12,963 lines
**Status**: RESEARCH ONLY - no code changes

---

## Table of Contents

1. [File Structure Overview](#file-structure-overview)
2. [Imports & Dependencies](#imports--dependencies)
3. [Domain Categories](#domain-categories)
4. [Function Catalog by Domain](#function-catalog-by-domain)
5. [Main Entry Points & Dispatchers](#main-entry-points--dispatchers)
6. [Consumer Dependencies](#consumer-dependencies)
7. [Cross-Domain Dependencies](#cross-domain-dependencies)
8. [Proposed Splitting Strategy](#proposed-splitting-strategy)
9. [Migration Plan](#migration-plan)
10. [Risk Assessment](#risk-assessment)

---

## File Structure Overview

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1-63 | ~20 external module imports |
| Types | 65-68 | `WorkoutWithRelations` type alias |
| Private helpers | 70-145 | `getSettingsForProfile`, `recordCoachAction`, `createPendingCoachAction` |
| Demo types | 147-226 | `DemoContext`, `DemoAction`, `PUBLIC_MODE_READ_ONLY_ERROR` |
| Mutating tools set | 229-265 | `MUTATING_COACH_TOOL_NAMES` (31 tools), `isMutatingCoachTool` export |
| Tool definitions | 268-2113 | `coachToolDefinitions` array (~68 tool schemas) |
| Main dispatcher | 2116-2641 | `executeCoachTool` (switch statement, ~525 lines) |
| Demo dispatcher | 2644-4008 | `executeDemoTool` (~1,365 lines) |
| Implementation functions | 4010-12,963 | ~8,953 lines of actual tool logic |

---

## Imports & Dependencies

The file imports from ~25 modules:

### Internal library imports
- `@/lib/db` - Database schema (workouts, assessments, shoes, userSettings, clothingItems, races, raceResults, plannedWorkouts, trainingBlocks, sorenessEntries, canonicalRoutes, coachActions, coachContext)
- `@/lib/profile-server` - `getActiveProfileId()`
- `./weather` - `fetchCurrentWeather`, `WeatherCondition`
- `./conditions` - `calculateConditionsSeverity`, `calculatePaceAdjustment`, `parsePaceToSeconds`
- `./outfit` - `calculateVibesTemp`, `getOutfitRecommendation`, `matchWardrobeItems`, `getCategoryLabel`
- `./utils` - `calculatePace`, `formatPace`
- `./training/vdot-calculator` - `calculateVDOT`, `calculatePaceZones`
- `./training/types` - `RACE_DISTANCES`
- `./alerts` - `detectAlerts`
- `./enhanced-prescribe-workout` - `enhancedPrescribeWorkout`
- `./schema` - many type imports (WorkoutType, Verdict, NewAssessment, etc.)
- `./vibe-check-tool` - `performVibeCheck`, `adaptWorkout`, `vibeCheckDefinition`, `adaptWorkoutDefinition`
- `./master-plan` - `MasterPlanGenerator`
- `./detailed-window-generator` - `DetailedWindowGenerator`
- `./coaching-memory` - `CoachingMemory`
- `./training/run-classifier` - `classifyRun`, `computeQualityRatio`, `computeTRIMP`
- `./training/execution-scorer` - `computeExecutionScore`, `parseExecutionDetails`
- `./training/data-quality` - `checkDataQuality`, `parseDataQualityFlags`, `getDataQualitySummary`, `DataQualityFlags`
- `./training/route-matcher` - `getRouteProgressSummary`
- `./training/workout-processor` - `generateExplanationContext`
- `./training/standard-plans` - `standardPlans`, `getStandardPlan`, `getPlansByAuthor`, `getSuitablePlans`
- `./training/performance-model` - `buildPerformanceModel`
- `./coach-knowledge` - `getCoachingKnowledge`, `getRelatedTopics`, `getTopicWithRelated`, `KnowledgeTopic`
- `./access-mode` - `isPublicAccessMode`

### External library imports
- `drizzle-orm` - SQL operators (`eq`, `desc`, `gte`, `asc`, `and`, `lte`, `lt`)
- `date-fns` - `format`, `addDays`, `startOfWeek`

### Server action imports
- `@/actions/fatigue-resistance` - `getFatigueResistanceData`
- `@/actions/split-tendency` - `getSplitTendencyData`
- `@/actions/running-economy` - `getRunningEconomyData`
- `@/actions/threshold` - `getThresholdEstimate`
- `@/actions/recovery` - `getRecoveryAnalysis`

---

## Domain Categories

After full file analysis, every tool/function falls into one of these 12 domains:

| # | Domain | Tool Count | ~Lines | Description |
|---|--------|-----------|--------|-------------|
| 1 | **Workout CRUD** | 7 | ~600 | Log, update, search, get recent workouts |
| 2 | **Workout Analysis** | 8 | ~900 | Classification, execution scoring, data quality, patterns, difficulty |
| 3 | **Plan Management** | 13 | ~1,200 | Planned workouts CRUD, swap, reschedule, skip, down week, rest day |
| 4 | **Race Management** | 7 | ~700 | Race CRUD, results, predictions, race day plan, race checklist |
| 5 | **Training Load & Fitness** | 7 | ~800 | Training load, readiness, fatigue, fitness trend, recovery, performance model |
| 6 | **Workout Prescription** | 6 | ~800 | Prescribe workout, suggest next, modify today, rewrite for time, training philosophy |
| 7 | **Profile & Settings** | 4 | ~300 | Get/update profile, get settings, pace zones |
| 8 | **Outfit & Weather** | 6 | ~400 | Outfit recommendation, wardrobe, clothing, weather, conditions |
| 9 | **Health & Wellness** | 5 | ~400 | Injury tracking, soreness, travel, altitude, assessment |
| 10 | **Briefings & Reviews** | 7 | ~600 | Context summary, pre-run briefing, weekly review, recap, prep for tomorrow, upcoming week |
| 11 | **Coach Memory & Context** | 5 | ~300 | Remember/recall context, coaching knowledge, explain recommendation, coach mode |
| 12 | **Plan Generation** | 5 | ~700 | Generate training plan, standard plans, return plan, busy week, travel mode |

---

## Function Catalog by Domain

### Domain 1: Workout CRUD (~Lines 4010-4729)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `getRecentWorkouts` | 4010-4057 | No | db, workouts, assessments, shoes |
| `getWorkoutDetail` | 4059-4112 | No | db, workouts, assessments, shoes, segments |
| `getShoes` | 4114-4135 | No | db, shoes |
| `logWorkout` | 4220-4455 | **Yes** | db, workouts, assessments, classifyRun, computeExecutionScore, checkDataQuality, getRouteProgressSummary |
| `updateWorkoutTool` | 4457-4542 | **Yes** | db, workouts |
| `searchWorkouts` | 4681-4718 | No | db, workouts |
| `overrideWorkoutStructure` | 11628-11688 | **Yes** | db, workouts |

**Shared helpers**: `formatPace` (4720-4729), `getSettingsForProfile` (70-95)

### Domain 2: Workout Analysis (~Lines 6557-6758, 7649-8316, 10310-10588, 11308-11464)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `analyzeWorkoutPatterns` | 6557-6639 | No | db, workouts |
| `getFitnessTrend` | 7649-7764 | No | db, workouts, assessments |
| `analyzeRecoveryPattern` | 7766-7932 | No | db, workouts, assessments |
| `compareWorkouts` | 7934-8090 | No | db, workouts |
| `estimateWorkoutQuality` | 8200-8316 | No | db, workouts, assessments, calculatePaceZones |
| `explainWorkout` | 10444-10588 | No | db, classifyRun, checkDataQuality, generateExplanationContext |
| `getWorkoutClassification` | 11308-11348 | No | db, classifyRun |
| `getExecutionScoreTool` | 11353-11421 | No | db, computeExecutionScore, parseExecutionDetails |
| `getDataQualityReport` | 11426-11464 | No | db, checkDataQuality, parseDataQualityFlags |

**Cross-refs**: Uses `classifyRun`, `computeExecutionScore`, `checkDataQuality` from training/ modules

### Domain 3: Plan Management (~Lines 6768-7647, 5906-6095)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `getTodaysPlannedWorkout` | 6804-6833 | No | db, plannedWorkouts |
| `getPlannedWorkoutByDate` | 6835-6870 | No | db, plannedWorkouts |
| `updatePlannedWorkout` | 6872-7006 | **Yes** (preview mode) | db, plannedWorkouts, recordCoachAction |
| `suggestWorkoutModification` | 7008-7075 | No | db, plannedWorkouts |
| `swapWorkouts` | 7077-7130 | **Yes** | db, plannedWorkouts |
| `rescheduleWorkout` | 7132-7165 | **Yes** | db, plannedWorkouts |
| `skipWorkout` | 7167-7208 | **Yes** | db, plannedWorkouts |
| `getWeekWorkouts` | 7210-7295 | No | db, plannedWorkouts |
| `makeDownWeek` | 7298-7445 | **Yes** | db, plannedWorkouts |
| `insertRestDay` | 7447-7521 | **Yes** | db, plannedWorkouts |
| `adjustWorkoutDistance` | 7523-7569 | **Yes** | db, plannedWorkouts |
| `convertToEasy` | 7571-7647 | **Yes** | db, plannedWorkouts |
| `modifyTodaysWorkout` | 5906-6095 | **Yes** (preview mode) | db, plannedWorkouts, recordCoachAction |

### Domain 4: Race Management (~Lines 5338-5637, 6480-6555, 10762-10866, 12377-12819)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `getRaces` | 5338-5384 | No | db, races |
| `addRace` | 5386-5448 | **Yes** | db, races, RACE_DISTANCES |
| `addRaceResult` | 5450-5547 | **Yes** | db, raceResults, races, updateUserVDOTFromResult |
| `updateRace` | 5549-5597 | **Yes** | db, races |
| `deleteRace` | 5599-5637 | **Yes** | db, races |
| `predictRaceTime` | 6480-6555 | No | calculateVDOT, calculatePaceZones, conditions |
| `generateRaceChecklist` | 10762-10866 | No | db, races |
| `getRaceDayPlan` | 12377-12819 | No | db, races, raceResults, workouts, userSettings, calculateVDOT, calculatePaceZones, weather, conditions |

**Internal helpers**: `updateUserVDOTFromResult` (6097-6117)

### Domain 5: Training Load & Fitness (~Lines 6302-6478, 6640-6758, 8092-8199, 7649-7932, 11690-11841)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `getReadinessScore` | 6302-6478 | No | db, workouts, assessments, getRecoveryAnalysis |
| `getTrainingLoad` | 6640-6758 | No | db, workouts |
| `getFatigueIndicators` | 8092-8199 | No | db, workouts, assessments |
| `getFitnessTrend` | 7649-7764 | No | db, workouts, assessments |
| `analyzeRecoveryPattern` | 7766-7932 | No | db, workouts, assessments |
| `getProactiveAlerts` | 6768-6802 | No | db, detectAlerts |
| `getPerformanceModel` | 11690-11841 | No | buildPerformanceModel, getFatigueResistanceData, getSplitTendencyData, getRunningEconomyData |

**Shared helpers**: `getWeekStart` (6759-6766), `getDateDaysAgo` (5850-5853), `formatSecondsToTime` (5855-5862)

### Domain 6: Workout Prescription (~Lines 5639-5904, 5906-6095, 9332-9520, 10310-10442, 11886-12374)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `getTrainingPhilosophy` | 5639-5721 | No | db, userSettings |
| `suggestPlanAdjustment` | 5723-5848 | No | db, workouts, plannedWorkouts |
| `suggestNextWorkout` | 9332-9520 | No | db, workouts, plannedWorkouts, assessments |
| `rewriteWorkoutForTime` | 10310-10442 | No | db, plannedWorkouts |
| `prescribeWorkout` | 11886-12374 | No | db, workouts, userSettings, enhancedPrescribeWorkout, getCoachingKnowledge |
| `modifyTodaysWorkout` | 5906-6095 | **Yes** | db, plannedWorkouts *(also in Plan Management)* |

### Domain 7: Profile & Settings (~Lines 4137-4153, 4959-5337)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `getUserSettings` | 4137-4153 | No | db, userSettings |
| `getPaceZones` | 5087-5141 | No | calculatePaceZones |
| `getUserProfile` | 5143-5230 | No | db, userSettings, shoes, races |
| `buildProfileUpdates` | 5232-5270 | N/A (helper) | N/A |
| `updateUserProfile` | 5272-5337 | **Yes** | db, userSettings, buildProfileUpdates |

### Domain 8: Outfit & Weather (~Lines 4155-4218, 4731-4957)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `getCurrentWeather` | 4155-4186 | No | fetchCurrentWeather |
| `calculateAdjustedPace` | 4188-4218 | No | fetchCurrentWeather, calculateConditionsSeverity, calculatePaceAdjustment |
| `getOutfitRecommendationTool` | 4731-4860 | No | fetchCurrentWeather, calculateVibesTemp, getOutfitRecommendation, matchWardrobeItems |
| `getWardrobe` | 4862-4892 | No | db, clothingItems |
| `addClothingItem` | 4894-4938 | **Yes** | db, clothingItems |
| `logOutfitFeedback` | 4940-4957 | **Yes** | db, clothingItems |

### Domain 9: Health & Wellness (~Lines 4544-4597, 8317-8672, 11469-11501)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `logAssessment` | 4544-4597 | **Yes** | db, assessments |
| `logInjury` | 8317-8409 | **Yes** | db, userSettings |
| `clearInjury` | 8411-8444 | **Yes** | db, userSettings |
| `getInjuryStatus` | 8446-8499 | No | db, userSettings, getRestrictionGuidance |
| `getRestrictionGuidance` | 8501-8551 | No (helper) | N/A |
| `setTravelStatus` | 8553-8622 | **Yes** | db, userSettings |
| `getAltitudeAdjustment` | 8624-8638 | No (helper) | N/A |
| `getAltitudePaceAdjustment` | 8640-8672 | No | getAltitudeAdjustment |
| `logSoreness` | 11469-11501 | **Yes** | db, sorenessEntries |

### Domain 10: Briefings & Reviews (~Lines 8674-9330, 9522-10045, 11506-11623)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `getContextSummary` | 8674-8889 | No | db, workouts, assessments, plannedWorkouts, userSettings, getThresholdEstimate, getRecoveryAnalysis |
| `getPreRunBriefing` | 8891-9023 | No | db, plannedWorkouts, workouts, assessments, fetchCurrentWeather, executeCoachTool (outfit) |
| `getWeeklyReview` | 9025-9208 | No | db, workouts, plannedWorkouts, assessments |
| `generateWeeklyCoachingNote` | 9210-9330 | No (helper) | N/A |
| `analyzeCompletedWorkout` | 9522-9575 | No | db, workouts, assessments |
| `explainWorkoutDifficulty` | 9577-9919 | No | db, workouts, assessments |
| `getUpcomingWeekPreview` | 9920-10045 | No | db, plannedWorkouts |
| `getWeeklyRecap` | 11506-11520 | No | getWeeklyReview |
| `generateShareText` | 11522-11535 | No (helper) | N/A |
| `identifyAchievements` | 11537-11554 | No (helper) | N/A |
| `getPrepForTomorrow` | 11559-11623 | No | db, plannedWorkouts |

**Note**: `getPreRunBriefing` calls `executeCoachTool('get_outfit_recommendation', ...)` internally at line 9023 -- this creates a circular reference within the dispatcher.

### Domain 11: Coach Memory & Context (~Lines 10593-10639, 11207-11232, 11843-11884, 12821-12963)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `explainRecommendation` | 10593-10639 | No | static data |
| `setCoachMode` | 11207-11232 | No (stub) | N/A |
| `handleGetCoachingKnowledge` | 11843-11884 | No | getCoachingKnowledge, getRelatedTopics, getTopicWithRelated |
| `rememberContext` | 12821-12881 | **Yes** | db, coachContext (dynamic import) |
| `recallContext` | 12883-12963 | No | db, coachContext (dynamic import) |

### Domain 12: Plan Generation (~Lines 10047-10308, 10868-11203)

| Function | Lines | Mutating | Dependencies |
|----------|-------|----------|-------------|
| `generateTrainingPlan` | 10047-10189 | **Yes** | db, plannedWorkouts, trainingBlocks, MasterPlanGenerator, DetailedWindowGenerator |
| `getStandardPlansHandler` | 10190-10308 | No | standardPlans, getStandardPlan, getPlansByAuthor |
| `activateBusyWeek` | 10868-10961 | **Yes** | db, plannedWorkouts |
| `setTravelMode` | 10963-11069 | **Yes** | db, plannedWorkouts, userSettings |
| `generateReturnPlan` | 11074-11203 | No | getSettingsForProfile |

### Remaining Functions (not in a domain above)

| Function | Lines | Domain | Notes |
|----------|-------|--------|-------|
| `getTrainingSummary` | 4599-4679 | Training Load | Enriched with threshold + recovery data |
| `getTodaysWorkout` | 4959-5020 | Briefings | Gets today's workout + plan info |
| `getWeeklyPlan` | 5022-5085 | Plan Management | Weekly plan view |
| `convertToTreadmill` | 10644-10757 | Workout Prescription | Converts outdoor to treadmill |
| `getRouteProgress` | 11237-11303 | Workout Analysis | Route progress tracking |
| `getPlanAdherence` | 6155-6277 | Training Load | Plan adherence calculation |
| `groupByWorkoutType` | 6279-6300 | Utility (helper) | Groups workouts by type |

### Utility/Shared Functions

| Function | Lines | Used By |
|----------|-------|---------|
| `getSettingsForProfile` | 70-95 | ~25+ functions |
| `recordCoachAction` | 97-121 | mutating operations |
| `createPendingCoachAction` | 123-145 | updatePlannedWorkout, modifyTodaysWorkout |
| `formatPace` | 4720-4729 | multiple domains |
| `getDateDaysAgo` | 5850-5853 | suggestPlanAdjustment |
| `formatSecondsToTime` | 5855-5862 | multiple functions |
| `parseTimeToSeconds` | 6119-6134 | addRaceResult, logWorkout |
| `formatTimeFromSeconds` | 6136-6153 | multiple functions |
| `updateUserVDOTFromResult` | 6097-6117 | addRaceResult |
| `getWeekStart` | 6759-6766 | getTrainingLoad |
| `getRestrictionGuidance` | 8501-8551 | getInjuryStatus |
| `getAltitudeAdjustment` | 8624-8638 | getAltitudePaceAdjustment |
| `generateShareText` | 11522-11535 | getWeeklyRecap |
| `identifyAchievements` | 11537-11554 | getWeeklyRecap |

---

## Main Entry Points & Dispatchers

### Exports

The file exports exactly **4** items:

1. **`coachToolDefinitions`** (Lines 268-2113) - Array of 68+ tool schemas for Claude function calling. Each element has `name`, `description`, `input_schema` (JSON Schema). This is the tool registry.

2. **`executeCoachTool`** (Lines 2116-2641) - Main dispatcher. Giant switch statement (~525 lines) mapping tool names to implementation functions. Called by the chat API routes when Claude invokes a tool.

3. **`isMutatingCoachTool`** (Lines 263-265) - Guard function checking if a tool name is in the `MUTATING_COACH_TOOL_NAMES` set. Used by chat routes to block mutating tools in public/demo mode.

4. **`DemoContext` type** (Line 147) - Type used by chat route for demo mode context.

### The `executeCoachTool` dispatcher pattern

```
switch (toolName) {
  case 'get_recent_workouts': return await getRecentWorkouts(input);
  case 'log_workout': return await logWorkout(input);
  // ... 66 more cases ...
  default: return { error: `Unknown tool: ${toolName}` };
}
```

Key behaviors:
- Checks `isPublicAccessMode()` first and blocks mutating tools
- If in demo context, delegates to `executeDemoTool` instead
- Wraps entire execution in try/catch with detailed error logging
- Some tools have inline `recordCoachAction()` calls within the switch

### The `executeDemoTool` function (Lines 2644-4008)

Parallel dispatcher for demo mode. Returns mock/static data for all tools without database access. ~1,365 lines of hardcoded demo responses.

---

## Consumer Dependencies

### Primary consumers (3 files):

1. **`src/app/api/chat/route.ts`** (main chat API)
   - Imports: `coachToolDefinitions`, `executeCoachTool`, `isMutatingCoachTool`, `DemoContext`
   - Uses `coachToolDefinitions` to provide tools to Claude (line 127, 133, 137)
   - Calls `executeCoachTool` when Claude invokes a tool (line 738)
   - Uses `isMutatingCoachTool` to filter tools in public mode (lines 667, 719)

2. **`src/app/api/chat/optimized/route.ts`** (optimized chat API)
   - Imports: `coachToolDefinitions`, `executeCoachTool`
   - Uses `coachToolDefinitions` as tool list (line 147)
   - Calls `executeCoachTool` for tool execution (line 73)

3. **`src/app/api/chat/olympic/route.ts`** (olympic chat)
   - Imports: `coachToolDefinitions`
   - Filters tool definitions for relevant subset (line 193)

### Internal self-reference

- `getPreRunBriefing` (line 9023) calls `executeCoachTool('get_outfit_recommendation', ...)` -- this is the only internal call to the dispatcher itself.

---

## Cross-Domain Dependencies

### Shared infrastructure used by all domains:
- `getSettingsForProfile()` - Used by ~25+ functions
- `getActiveProfileId()` - Used by ~15+ functions
- `db` + Drizzle operators - Used by all database-accessing functions
- `formatPaceFromTraining()` from `./utils` - Used across many domains
- `calculatePaceZones()` from `./training/vdot-calculator` - Used by ~8 functions

### Cross-domain function calls:
| Caller | Callee | Domains |
|--------|--------|---------|
| `logWorkout` | `classifyRun`, `computeExecutionScore`, `checkDataQuality` | Workout CRUD -> Workout Analysis |
| `getPreRunBriefing` | `executeCoachTool('get_outfit_recommendation')` | Briefings -> Outfit/Weather |
| `getReadinessScore` | `getRecoveryAnalysis` | Training Load -> Health/Wellness |
| `getContextSummary` | `getThresholdEstimate`, `getRecoveryAnalysis` | Briefings -> Training Load |
| `addRaceResult` | `updateUserVDOTFromResult` | Race Mgmt -> Profile |
| `getWeeklyRecap` | `getWeeklyReview` | Briefings -> Briefings (internal) |
| `prescribeWorkout` | `enhancedPrescribeWorkout`, `getCoachingKnowledge` | Prescription -> Coach Knowledge |
| `getPerformanceModel` | `getFatigueResistanceData`, `getSplitTendencyData`, `getRunningEconomyData` | Training Load -> Server Actions |
| `getRaceDayPlan` | `calculateVDOT`, `calculatePaceZones`, `fetchCurrentWeather`, `calculateConditionsSeverity` | Race Mgmt -> Weather, VDOT |
| `getTrainingSummary` | `getThresholdEstimate`, `getRecoveryAnalysis` | Workout CRUD -> Training Load |
| `activateBusyWeek`, `setTravelMode` | `plannedWorkouts` mutations | Plan Generation -> Plan Management |

---

## Proposed Splitting Strategy

### Directory structure

```
src/lib/coach-tools/
  index.ts                    (~150 lines) - Re-exports, registry, dispatcher
  types.ts                    (~100 lines) - Shared types and constants
  shared.ts                   (~200 lines) - Shared utility functions
  definitions/
    index.ts                  (~50 lines)  - Combines all definitions
    workout-definitions.ts    (~200 lines) - Workout CRUD tool schemas
    analysis-definitions.ts   (~250 lines) - Analysis tool schemas
    plan-definitions.ts       (~350 lines) - Plan management tool schemas
    race-definitions.ts       (~200 lines) - Race tool schemas
    fitness-definitions.ts    (~250 lines) - Training load tool schemas
    prescription-definitions.ts (~200 lines) - Prescription tool schemas
    profile-definitions.ts    (~100 lines) - Profile tool schemas
    outfit-definitions.ts     (~150 lines) - Outfit/weather tool schemas
    health-definitions.ts     (~150 lines) - Health/wellness tool schemas
    briefing-definitions.ts   (~200 lines) - Briefing/review tool schemas
    memory-definitions.ts     (~150 lines) - Coach memory tool schemas
    generation-definitions.ts (~150 lines) - Plan generation tool schemas
  implementations/
    workout-tools.ts          (~700 lines) - Workout CRUD implementations
    analysis-tools.ts         (~1000 lines)- Workout analysis implementations
    plan-tools.ts             (~1300 lines)- Plan management implementations
    race-tools.ts             (~800 lines) - Race management implementations
    fitness-tools.ts          (~900 lines) - Training load implementations
    prescription-tools.ts     (~900 lines) - Prescription implementations
    profile-tools.ts          (~350 lines) - Profile implementations
    outfit-tools.ts           (~450 lines) - Outfit/weather implementations
    health-tools.ts           (~500 lines) - Health/wellness implementations
    briefing-tools.ts         (~700 lines) - Briefing/review implementations
    memory-tools.ts           (~350 lines) - Coach memory implementations
    generation-tools.ts       (~800 lines) - Plan generation implementations
  demo-tools.ts               (~1400 lines)- Demo mode dispatcher (could also be split)
```

### File descriptions

#### `index.ts` - Main entry point
- Re-exports `coachToolDefinitions`, `executeCoachTool`, `isMutatingCoachTool`, `DemoContext`
- Assembles `coachToolDefinitions` from all `*-definitions.ts` files
- Contains the `executeCoachTool` dispatcher (delegating to imported implementation functions)
- Contains `MUTATING_COACH_TOOL_NAMES` set and `isMutatingCoachTool`
- Backward-compatible: consumers import from `@/lib/coach-tools` which resolves to `index.ts`

#### `types.ts` - Shared types
- `WorkoutWithRelations`
- `DemoContext`, `DemoAction`
- `PUBLIC_MODE_READ_ONLY_ERROR`
- Common input/output types used across domains

#### `shared.ts` - Shared utilities
- `getSettingsForProfile()`
- `recordCoachAction()`
- `createPendingCoachAction()`
- `formatPace()` (the local version)
- `parseTimeToSeconds()`
- `formatTimeFromSeconds()`
- `getDateDaysAgo()`
- `getWeekStart()`
- `groupByWorkoutType()`

### Import path compatibility

Since consumers currently import from `@/lib/coach-tools`, and TypeScript/Next.js resolves `coach-tools` to `coach-tools/index.ts` when a directory exists, **no consumer changes are needed** as long as `index.ts` re-exports all public symbols.

The old `src/lib/coach-tools.ts` file must be deleted (or renamed) once `src/lib/coach-tools/` directory is created -- they cannot coexist.

---

## Migration Plan

### Phase 1: Create infrastructure (low risk)
1. Create `src/lib/coach-tools/` directory
2. Create `types.ts` with shared types
3. Create `shared.ts` with shared utility functions
4. Create `index.ts` that currently just re-exports from old file (temporary)

### Phase 2: Extract implementations (medium risk, do one domain at a time)
For each domain:
1. Create `implementations/[domain]-tools.ts`
2. Move implementation functions to new file
3. Update imports in the new file
4. Import from new file in `index.ts` dispatcher
5. Run tests to verify
6. Repeat for next domain

**Recommended extraction order** (safest first, based on fewest cross-domain deps):
1. `profile-tools.ts` (4 functions, minimal deps)
2. `outfit-tools.ts` (6 functions, isolated domain)
3. `health-tools.ts` (5 functions, mostly isolated)
4. `memory-tools.ts` (5 functions, mostly isolated)
5. `race-tools.ts` (7 functions, some cross-refs to VDOT)
6. `workout-tools.ts` (7 functions, moderate deps)
7. `plan-tools.ts` (13 functions, moderate deps)
8. `analysis-tools.ts` (8 functions, uses training/ modules)
9. `fitness-tools.ts` (7 functions, uses server actions)
10. `briefing-tools.ts` (7+ functions, most cross-domain calls)
11. `prescription-tools.ts` (6 functions, complex deps)
12. `generation-tools.ts` (5 functions, uses MasterPlanGenerator)

### Phase 3: Extract definitions
1. Create `definitions/[domain]-definitions.ts` for each domain
2. Move tool schema objects to matching files
3. Create `definitions/index.ts` that combines all arrays
4. Update `index.ts` to import combined definitions

### Phase 4: Extract demo tools
1. Create `demo-tools.ts` with `executeDemoTool` function
2. Import in `index.ts`

### Phase 5: Delete old file
1. Remove `src/lib/coach-tools.ts`
2. Verify all imports resolve to `src/lib/coach-tools/index.ts`
3. Run full test suite

---

## Risk Assessment

### High risk areas
- **`getPreRunBriefing` self-reference**: Calls `executeCoachTool` internally (line 9023). After split, this function will need to import from `index.ts`, creating a potential circular dependency. **Mitigation**: Refactor to call `getOutfitRecommendationTool` directly instead of going through the dispatcher.
- **`prescribeWorkout` local variable hoisting**: Uses `trainingMetrics` before the `calculateTrainingMetrics` function is defined (lines 12003 vs 12245). This is a function-scoped hoisting issue. **Mitigation**: Move the helper inside or above the function.
- **Demo mode**: `executeDemoTool` is 1,365 lines and mirrors the dispatcher 1:1. Must be kept in sync. **Mitigation**: Consider generating demo responses from tool definitions or using a test fixture approach.

### Medium risk areas
- **Import resolution**: When `coach-tools.ts` becomes `coach-tools/index.ts`, all existing imports like `from '@/lib/coach-tools'` must resolve correctly. TypeScript handles this, but build tools may need verification.
- **Shared helpers**: `getSettingsForProfile`, `recordCoachAction`, and formatting functions are used across many domains. Must ensure they're properly exported from `shared.ts`.

### Low risk areas
- Most implementation functions are self-contained -- they only depend on the database, external library modules, and shared helpers.
- Tool definitions are pure data (JSON objects) with no runtime dependencies.
- Consumer API is well-defined (4 exports) and will not change.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total lines | 12,963 |
| Tool definitions | ~68 |
| Implementation functions | ~75 |
| Shared helper functions | ~12 |
| Mutating tools | 31 |
| Read-only tools | ~37 |
| External imports | ~25 modules |
| Consumer files | 3 |
| Proposed new files | ~27 (12 definition + 12 implementation + types + shared + index) |
| Target max file size | ~1,300 lines |
