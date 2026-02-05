# Known Recurring Issues

## Timezone Date Parsing Bug (RECURRING)

**Issue:** Using `new Date("YYYY-MM-DD")` parses the date as UTC midnight, causing `getDay()` and other methods to return wrong values in US timezones.

**Example:**
```typescript
// BUG: This returns Friday in EST when date is Saturday
const date = new Date("2025-01-04"); // Saturday in UTC
const day = date.getDay(); // Returns 5 (Friday) in EST timezone
```

**Solution:** Always use `parseLocalDate()` from `@/lib/utils` when converting date strings:
```typescript
import { parseLocalDate } from '@/lib/utils';
const date = parseLocalDate("2025-01-04");
const day = date.getDay(); // Correctly returns 6 (Saturday)
```

### Files FIXED (2025-02-04):
- `src/actions/running-stats.ts` - Day of week distribution
- `src/actions/analytics.ts` - Weekly stats calculations
- `src/actions/recovery.ts` - Recovery calculations
- `src/actions/progress-tracking.ts` - Progress charts
- `src/actions/training-analysis.ts` - Training analysis
- `src/actions/fitness-assessment.ts` - Fitness calculations
- `src/actions/workout-compare.ts` - Workout comparisons
- `src/actions/race-predictor.ts` - Race predictions
- `src/actions/training-plan.ts` - Training plan generation
- `src/lib/alerts.ts` - Proactive alerts
- `src/lib/training/performance-model.ts` - Performance modeling
- `src/lib/training/workout-processor.ts` - Workout processing
- `src/lib/training/plan-generator.ts` - Plan generation
- `src/app/api/chat/route.ts` - Chat API

### Files still needing fix (lower priority - display/demo):
- `src/lib/coach-tools.ts` - Coach tools (many occurrences)
- `src/lib/demo-actions.ts` - Demo mode actions
- `src/components/Chat.tsx` - Chat component
- `src/components/DemoAnalytics.tsx` - Demo analytics
- `src/components/DemoToday.tsx` - Demo today page
- `src/components/RacePredictions.tsx` - Race predictions display
- `src/components/VdotTimeline.tsx` - VDOT timeline
- `src/components/charts/PaceTrendChart.tsx` - Pace trend chart
- `src/components/charts/FitnessTrendChart.tsx` - Fitness trend chart
- `src/scripts/generate-integrated-plan.ts` - Script (one-time use)

**When adding new code:** Always grep for `new Date(.*\.date)` pattern and ensure `parseLocalDate` is used instead.

---

## Analytics Page Issues (TO FIX - 2025-02-04)

### 1. Pace Curve Not Correct
**Location:** `/src/components/BestEfforts.tsx` - `PaceCurveChart`
**Issue:** The pace curve projections don't seem accurate. User has actual race times at 10mi, half marathon, and marathon distances but projections appear wrong.
**Root cause:** Need to investigate `getPaceCurve()` in `/src/actions/best-efforts.ts`

### 2. Fitness Trend Chart Not Fitting
**Location:** `/src/components/charts/FitnessTrendChart.tsx`
**Issue:** Chart doesn't fit properly in its container space on the analytics page.

### 3. All Time Stats / Running Achievements Too Crammed
**Location:** Analytics page - stats cards section
**Issue:** Cards are too crammed together but there's extra whitespace to the right. Layout needs rebalancing.

### 4. Monthly Summary Crammed
**Location:** `/src/components/TrainingDistribution.tsx` - `MonthlyRollupCards`
**Issue:** Monthly cards are too crammed. Suggested fixes:
- Option A: Put on its own thin horizontal line
- Option B: Make it a 3x2 grid of the last 6 months (more square cards)

### 5. Training Paces Completely Wrong - FIXED (2025-02-04)
**Location:** `/src/actions/race-predictor.ts` - `getVDOTPaces()`
**Issue:** Easy pace was showing as 30:22/mi which is absurdly slow
**Root cause:** The old formula was completely broken
**Solution:** Implemented proper Jack Daniels' VDOT calculation:
- Use VO2-velocity relationship: `VO2 = -4.60 + 0.182258*v + 0.000104*v^2`
- Solve quadratic formula to get velocity from target VO2
- Convert velocity (m/min) to pace (sec/mi)
- Use correct %VO2max zones (Easy: 59-74%, Marathon: 79%, Threshold: 86%, etc.)

---

## Color System Updates (COMPLETED - 2025-02-04)
- Changed training load spectrum: icy blue → purple → red
- Changed "hard" workout color from red to fuchsia/magenta
- Reserved red for warnings/errors only
- Made weekly mileage chart colors more transparent (60-70% opacity)
