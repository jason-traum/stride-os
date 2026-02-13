# Questions Log for Jason

## 2026-02-12 Night Session

### Features Implemented Tonight
1. ✅ Readiness Explanation - Shows breakdown with actual values
2. ✅ Pace Band Generator - Creates printable pace bands
3. ✅ Best Effort Auto-Detection - Finds PRs within runs
4. ✅ Workout Confidence Score - Predicts success likelihood
5. ✅ Quick Log with Sliders - Easy run logging with smart defaults
6. ✅ Pace Decay Analysis - Shows how pace changes throughout runs
7. ✅ Progressive Context Collection - Shows profile completion % and missing fields
8. ✅ Coach History - View and search past AI coach conversations
9. ✅ Race Predictor - Predicts times for all distances based on fitness
10. 📝 Enhanced Pace Pro (noted for future with GPX support)

### Questions & Considerations

#### 1. Data Availability
- **Q:** How should features handle missing data gracefully?
- **A:** Currently showing "No data" with explanations of what's needed
- **Example:** Readiness shows which factors are missing, best efforts explains need for lap data

#### 2. Pace Pro Enhancement
- **Q:** Should we build GPX parsing in-house or use a library?
- **Consideration:** Need elevation data parsing, course mapping, grade-adjusted pacing
- **AI Integration:** Use elevation profile to suggest effort distribution

#### 3. UI/UX Direction
- **Your feedback:** "More sliding, less typing. Easier on the eyes"
- **Q:** Should we implement gesture-based controls for mobile?
- **Ideas:**
  - Swipe to log runs
  - Slider-based input for all metrics
  - Card-based navigation with smooth transitions

#### 4. Feature Organization
- **Q:** How to organize growing feature set?
- **Current approach:** Created /tools page as hub
- **Future:** Category pages (Analysis, Planning, Social, etc.)

#### 5. Missing Integrations
- **Q:** Priority order for integrations?
- **Current:** Strava (partial), Intervals.icu
- **Missing:** Apple Health, Garmin, Whoop, Spotify
- **Note:** Each requires different auth approach

### Technical Debt Noticed
1. Some components don't handle loading states well
2. Error boundaries needed for failed data fetches
3. Offline support would be valuable for core features
4. Coach history assumes coachInteractions table exists (needs migration?)
5. Several features need proper loading skeletons for better UX

### Feature Ideas While Working
1. **Effort Replay:** Visualize your best efforts on a map
2. **Ghost Runner:** Compare current run to previous efforts in real-time
3. **Smart Alerts:** "You're on pace for a 5K PR!" during runs
4. **Weather Pattern Learning:** "You run 10s/mi faster in 55°F weather"

### Next Features Queue
1. Best Effort Auto-Detection (finishing now)
2. Workout Confidence Score
3. Quick Log from Home
4. Manual Entry Sliders
5. Pace Decay Analysis
6. Progressive Context Collection

Will keep pushing through! 💪