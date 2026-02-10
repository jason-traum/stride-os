# Stride OS Fixes Changelog

## Session: 2026-02-09

### Completed Fixes

#### 1. API Usage Logs Table (Task #6)
- **File**: `scripts/create-api-usage-logs.ts`
- **Change**: Created script to add missing `api_usage_logs` table to Postgres database
- **Test**: Run `npx tsx scripts/create-api-usage-logs.ts` to verify table creation

#### 2. Zone 4 Color Fix (Task #8)
- **File**: `src/lib/strava.ts` (lines 619-625)
- **Change**: Updated HR_ZONES to use colors from centralized workout-colors.ts
  - zone1: `bg-gray-300` → `bg-teal-400` (was too light/white)
  - zone3: `bg-green-500` → `bg-fuchsia-400`
  - zone4: `bg-yellow-500` → `bg-fuchsia-500` (was looking white)
  - zone5: `bg-red-500` → `bg-purple-600`
- **Test**: View any workout detail page with HR zones

#### 3. Strava Sync Profile Fix (Task #9)
- **File**: `src/actions/strava.ts`
- **Change**: Updated all Strava functions to use active profile from cookies:
  - `getStravaStatus()` - now uses active profile
  - `connectStrava()` - now uses active profile
  - `disconnectStrava()` - now uses active profile
  - `getValidAccessToken()` - now uses active profile
  - `syncStravaActivities()` - now uses active profile
  - `syncStravaLaps()` - now filters by active profile
  - `setStravaAutoSync()` - now uses active profile
- **Test**: Trigger Strava sync from Settings page, then check History for new workouts

#### 4. Single Unified Training Plan (Task #13)
- **File**: `src/app/plan/page.tsx`
- **Change**:
  - "Generate Plan" button now only shows for A races
  - B/C races show message: "B/C races are incorporated into your A race plan"
  - Added "View A race plan" link when viewing B/C races
- **Test**: Go to /plan and select different races to see the different UX

#### 5. Weekly Mileage Target Not Updating (Task #14)
- **File**: `src/actions/training-plan.ts`
- **Change**: Added two new functions:
  - `updateWeekTargetMileage(blockId, targetMileage)` - update individual week
  - `recalculatePlanMileage(raceId)` - recalculate all weeks based on current settings
- **Test**: Call `recalculatePlanMileage` after updating settings to propagate new targets

#### 6. Training Plan Rollover (Task #10)
- **Files**: `src/app/plan/page.tsx`, `src/components/plan/WeekView.tsx`
- **Change**:
  - Added `isPastWeek` prop to WeekView component
  - Plan page now calculates which weeks are past based on end date
  - Past weeks shown with reduced opacity (75%) and muted styling
  - All weeks remain visible including past ones (no hiding/rollover)
- **Test**: Go to /plan and verify past weeks appear with muted styling

#### 7. Effort Classification System (Task #7)
- **Files**: `src/lib/training/effort-classifier.ts`, `src/components/EnhancedSplits.tsx`, `src/lib/workout-colors.ts`
- **Change**: Implemented 7-stage effort classification pipeline:
  - Stage 1: Zone resolution from VDOT, manual paces, or run data
  - Stage 2: Run mode inference (easy_run, workout, race)
  - Stage 3: Raw per-split classification
  - Stage 4: Rolling window smoothing
  - Stage 5: Anomaly detection (GPS glitches, short splits)
  - Stage 6: Contextual hysteresis
  - Stage 7: Confidence scoring
- **Test**: View any workout with splits to see effort labels, check for anomaly detection on GPS glitches

#### 8. Smart Workout Execution Assessment (Task #11)
- **File**: `src/lib/training/execution-scorer.ts`
- **Change**:
  - Added `TrainingStimulusComparison` interface for comparing work volumes
  - Added `computeTrainingStimulusComparison()` function to compare planned vs actual work
  - Updated `computeCompletionRateWithStimulus()` to give credit for equivalent training stimulus
  - Now handles "4x1000 vs 3x1200" scenarios: if total work volume (~4km) and pace match, workout is scored as successful
  - Enhanced feedback to note "Training stimulus achieved despite different structure"
- **Test**: Complete an interval workout with slightly different structure but similar total work volume and verify good execution score

#### 9. Clearer Pace Guidance (Task #12)
- **Files**: `src/components/plan/WorkoutCard.tsx`, `src/components/plan/WeekView.tsx`, `src/app/plan/page.tsx`
- **Change**:
  - Added `UserPaceSettings` interface to WorkoutCard
  - WorkoutCard now displays actual paces alongside zone labels (e.g., "tempo pace (6:45/mi)")
  - Pace values derived from user settings (easyPace, tempoPace, etc.)
  - Settings passed down from plan page through WeekView to WorkoutCard
- **Test**: Go to /plan, expand a workout with structure, verify paces show actual values

#### 10. Persistent Coach Bubble (Task #15)
- **File**: `src/components/FloatingChat.tsx`
- **Change**:
  - Added "Continue conversation" button that appears when there's existing chat history
  - Shows preview of last assistant message for context
  - Added conversation indicator dot on floating button when chat history exists
  - Quick actions now show "Or start fresh" when continuing existing conversation
  - Chat history already persisted in database; now UI emphasizes continuation
- **Test**: Have a conversation with coach, navigate to another page, click the coach bubble and verify "Continue conversation" option appears with last message preview
