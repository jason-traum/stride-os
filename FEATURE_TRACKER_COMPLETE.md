# Dreamy (Stride OS) Complete Feature Tracker
Generated from comprehensive audit on 2026-02-12

## 🚨 CRITICAL BUGS (Fix First!)

### UI/UX Bugs
1. **Modal Scrolling Issue** [15 min fix]
   - Status: ❌ NOT STARTED
   - Priority: CRITICAL
   - Details: Page scrolls behind modals - "Messed up modals is the tell of vibe coding"
   - Fix: Add z-index, overflow:hidden to body when modal open

2. **Duplicate Run Logging**
   - Status: ✅ DONE
   - Details: Logic exists in coach-tools.ts:2256

3. **Chat Text Formatting**
   - Status: ✅ DONE
   - Details: ChatMessage component properly formats conversations

### AI Coach Bugs
4. **prescribeWorkout Returns Generic**
   - Status: 🟡 PARTIAL
   - Priority: CRITICAL
   - Location: coach-tools.ts:11140
   - Details: Uses template fallback instead of pace zones, CTL/ATL/TSB analysis

5. **getRaceDayPlan Returns Generic**
   - Status: 🟡 PARTIAL
   - Priority: CRITICAL
   - Location: coach-tools.ts:11512
   - Details: No race-specific pacing, weather, splits, fueling

6. **Context Persistence Bug**
   - Status: 🟡 PARTIAL
   - Priority: CRITICAL
   - Details: Uses in-memory Map() that resets. Needs coach_context table

7. **Silent Profile ID Failures**
   - Status: ❌ NOT STARTED
   - Priority: HIGH
   - Details: Functions using getActiveProfileId() need null checks

8. **Greeting Bug**
   - Status: ✅ DONE
   - Details: Fixed - now uses user's name

## 🎯 FEATURE IMPLEMENTATION STATUS

### Onboarding & Personalization
- ✅ 10-step onboarding wizard
- ✅ Multi-profile support
- ❌ **Progressive context collection (% complete)**
- ❌ **Manual entry sliders (distance/duration)**
- ❌ **User persona selection**

### Training Plans & Workouts
- ✅ Plan generation (50+ templates)
- ✅ Plan modifications (swap, reschedule, etc)
- ✅ Standard plans (Pfitz, Hansons, etc)
- ✅ Workout segments/laps display
- ❌ **Manual lap entry**
- ❌ **Custom training plan builder**
- ❌ **Periodization view**

### Analytics & Visualizations
- ✅ Activity heatmap (with multi-mode)
- ✅ Weekly mileage chart
- ✅ CTL/ATL/TSB tracking & charts
- ✅ Training distribution
- ✅ HR zone breakdown
- 🟡 **Pace curve / Critical Speed**
- ❌ **42-day vs all-time comparison**
- ❌ **Wellness trends (HRV/sleep/weight charts)**

### Integrations
#### Strava
- 🟡 **OAuth flow (broken, manual key workaround)**
- ✅ Manual API key entry
- ✅ Activity sync
- ✅ Lap sync

#### Intervals.icu
- ✅ Basic Auth connection
- ✅ Activity import
- 🟡 **Wellness data import**

#### Other Integrations
- ❌ **Apple Health/Garmin Connect**
- ❌ **Whoop**
- ❌ **Spotify/Apple Music**

### AI Coach & Chatbot
- ✅ 75+ coaching tools
- ✅ 5+ personas
- ✅ Context-aware coaching
- ✅ Pre-run briefing
- ✅ Weekly review
- ✅ Explain workout difficulty
- ✅ Race checklist
- 🟡 **Dynamic sentiment adaptation**
- 🟡 **Race day plan (generic)**

### Data & Metrics
- ✅ Comprehensive workout tracking
- ✅ Assessment data
- 🟡 **Soreness body map (no pattern detection)**
- ❌ **Soreness → shoe correlation**
- ❌ **Soreness → coach warnings**
- ❌ **Running power**
- ❌ **Sleep tracking**
- ❌ **HRV monitoring**

### Pattern Detection & Proactive Intelligence
- ❌ **Wednesday struggle after Tuesday detection**
- ❌ **Efficiency improvement tracking over time**
- ❌ **Elevated HR trend warnings (3+ days)**
- ❌ **Weather preference learning**
- ❌ **Route performance patterns**
- ❌ **Time-of-day performance analysis**
- ❌ **Shoe performance degradation detection**
- ❌ **Injury risk pattern recognition**
- ❌ **Personal best prediction windows**
- ❌ **Fatigue accumulation patterns**
- ❌ **Life stress → performance correlation**
- ❌ **Longitudinal pace analysis**
- ❌ **Seasonal performance patterns**
- ❌ **Workout success predictors**

### Social & Sharing
- ✅ Basic share cards
- ❌ **PR celebration cards**
- ❌ **Streak badges in shares**
- ❌ **IG story format (1080x1920)**
- ❌ **Activity feed**
- ❌ **Comments/kudos**
- ❌ **Running clubs**
- ❌ **Challenges**
- ❌ **Leaderboards**

### Other Features
- ✅ PWA with offline support
- ✅ Demo mode
- ✅ Shoe tracking
- ✅ Weather integration
- ✅ Pace calculator
- ✅ Race management
- ❌ **Push notifications**
- ❌ **Email summaries**
- ❌ **Cross-training support**
- ❌ **Nutrition tracking**
- ❌ **Race fueling calculator**
- ❌ **Recovery routines**
- ❌ **Live tracking**
- ❌ **Audio coaching**
- ❌ **Full data export (GPX/TCX/CSV)**
- ❌ **Training reports (PDF)**

## 🔧 TECHNICAL DEBT
1. **Database Migrations**
   - API key columns (anthropicApiKey, openaiApiKey)
   - coach_context table
   - wellness_data table

2. **Environment Documentation**
   - Update .env.example with all variables
   - Document STRAVA_CLIENT_SECRET requirement

## 🚀 QUICK WINS (Under 4 hours)
1. Fix modal z-index (15 min)
2. Add day of week to forecast (30 min)
3. Combine weather/outfit/pace sections (1 hour)
4. De-emphasize pace adjuster in mild weather (1 hour)
5. Replace temperature preference with 9-point slider (2 hours)
6. Add "Vibes Temp" explanation/context (1 hour)
7. Implement push notification foundation (3 hours)
8. Add default run times (AM/PM) (2 hours)

## 📊 IMPLEMENTATION METRICS
- Core Features: 78/124 complete (63%)
- Partially Complete: 18 features (15%)
- Not Started: 28 features (22%)
- Critical Bugs: 3 remaining
- Quick Wins Available: 8

## 🎯 RECOMMENDED SPRINT PLAN

### Sprint 1: Critical Fixes (1-2 days)
1. Fix modal scrolling
2. Fix prescribeWorkout logic
3. Fix context persistence
4. Fix getRaceDayPlan

### Sprint 2: Core UX (3-4 days)
1. Complete Strava OAuth
2. Add progressive onboarding
3. Implement manual entry sliders
4. Add push notifications

### Sprint 3: Unique Features (1 week)
1. Complete soreness pattern detection
2. Add sleep/wellness integration
3. Dynamic coach sentiment
4. Share card enhancements

### Sprint 4: Analytics & Social (1 week)
1. Advanced analytics missing pieces
2. Social feed foundation
3. Data export functionality
4. Email summaries

### Sprint 5: True Intelligence Layer (2 weeks)
1. Pattern detection engine
2. Longitudinal performance analysis
3. Proactive insight generation
4. Personal trend identification
5. Multi-factor correlation analysis

## 🧠 COMPOUND INTELLIGENCE FEATURES (The Real Differentiators)

These are what would make Dreamy truly more than a ChatGPT wrapper:

### Historical Pattern Recognition
- ❌ **"You always struggle on Day 3 of high mileage weeks"**
- ❌ **"Your tempo pace improves 2% when you sleep 8+ hours"**
- ❌ **"You PR when CTL is 50-55 and TSB is +5 to +8"**
- ❌ **"Hot weather affects you 20% more than average runners"**

### Predictive Insights
- ❌ **"Based on your last 6 weeks, you'll PR if you race in the next 10 days"**
- ❌ **"Your current trajectory suggests 1:25 HM is achievable by April"**
- ❌ **"Warning: Similar patterns preceded your last injury"**
- ❌ **"Your efficiency gains suggest moving to 5x/week training"**

### Contextual Memory
- ❌ **References YOUR specific history in responses**
- ❌ **Compares current workout to YOUR similar past efforts**
- ❌ **Knows YOUR typical responses to training stimuli**
- ❌ **Learns YOUR individual recovery patterns**

### Automatic Insights Dashboard
- ❌ **Weekly insight generation (3-5 personalized insights)**
- ❌ **Trend alerts when patterns change**
- ❌ **Comparison to your cohort (similar age/pace runners)**
- ❌ **"What's different this month" analysis**

Last Updated: 2026-02-12