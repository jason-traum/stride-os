# Stride OS - Complete Capabilities Document

A comprehensive running training application with AI coaching, built with Next.js 14, React 18, and Anthropic Claude API.

---

## 1. USER-FACING PAGES (15 Total)

### Dashboard & Daily
- **Home (`/`)** - Main dashboard with today's workout, weekly summary, weather conditions
- **Today (`/today`)** - Today's scheduled workout with pre-run briefing, conditions analysis
- **Log (`/log`)** - Manual workout logging form with distance, duration, pace, type selection

### Training & Planning
- **Plan (`/plan`)** - Full training plan view with calendar, phases, weekly breakdowns
- **Races (`/races`)** - Race management: upcoming races, past results, goal setting
- **Pace Calculator (`/pace-calculator`)** - VDOT-based pace zone calculator, race time predictor

### History & Analytics
- **History (`/history`)** - Complete workout history with filtering, sorting, search
- **Analytics (`/analytics`)** - Training statistics, weekly mileage charts, workout distribution
- **Workout Detail (`/workout/[id]`)** - Individual workout view with assessment data

### AI & Assistance
- **Coach (`/coach`)** - AI chat interface for personalized coaching conversations

### Equipment & Wardrobe
- **Shoes (`/shoes`)** - Shoe rotation tracking with mileage, retirement status
- **Wardrobe (`/wardrobe`)** - Clothing inventory for weather-based outfit recommendations

### User Management
- **Settings (`/settings`)** - User preferences, pace zones, training preferences
- **Onboarding (`/onboarding`)** - Initial setup wizard for new users
- **Guide (`/guide`)** - App documentation and feature explanations

---

## 2. AI COACH TOOLS (64 Total)

### Workout Management (12 tools)
| Tool | Description |
|------|-------------|
| `get_recent_workouts` | Retrieve recent workouts with assessments, filter by type |
| `get_workout_detail` | Full details of a specific workout including assessment |
| `log_workout` | Create new workout (auto-calculates missing distance/duration/pace) |
| `log_assessment` | Add/update workout assessment (verdict, RPE, legs, breathing, etc.) |
| `get_training_summary` | Period-based training statistics |
| `search_workouts` | Search by text (notes/routes) or date range |
| `get_todays_workout` | Get today's scheduled workout |
| `get_week_workouts` | Get all workouts for a specific week |
| `compare_workouts` | Compare two workouts side-by-side |
| `analyze_completed_workout` | AI analysis of a completed workout |
| `analyze_workout_patterns` | Identify patterns in training data |
| `estimate_workout_quality` | Predict workout quality based on current factors |

### Plan Management (14 tools)
| Tool | Description |
|------|-------------|
| `get_weekly_plan` | Get the week's training plan |
| `get_todays_planned_workout` | Get today's planned workout details |
| `update_planned_workout` | Modify a planned workout |
| `modify_todays_workout` | Quick modifications to today's scheduled workout |
| `suggest_workout_modification` | AI-suggested modifications based on context |
| `swap_workouts` | Swap two workouts in the plan |
| `reschedule_workout` | Move a workout to a different date |
| `skip_workout` | Mark a workout as skipped with reason |
| `make_down_week` | Reduce volume for a recovery week |
| `insert_rest_day` | Insert an additional rest day |
| `adjust_workout_distance` | Modify distance for a planned workout |
| `convert_to_easy` | Convert a quality workout to easy run |
| `suggest_plan_adjustment` | AI suggestion for plan modifications |
| `generate_training_plan` | Create full periodized training plan for a goal race |

### User Profile & Settings (3 tools)
| Tool | Description |
|------|-------------|
| `get_user_settings` | Get all user settings and preferences |
| `get_user_profile` | Get user profile summary |
| `update_user_profile` | Update user preferences and settings |

### Pace & Performance (6 tools)
| Tool | Description |
|------|-------------|
| `get_pace_zones` | Get calculated pace zones based on VDOT |
| `calculate_adjusted_pace` | Adjust pace for current weather conditions |
| `predict_race_time` | Predict finish time for a race distance |
| `get_altitude_pace_adjustment` | Calculate pace adjustment for altitude |
| `get_training_philosophy` | Get explanation of training methodology |
| `get_training_load` | Calculate acute/chronic training load (ATL/CTL) |

### Weather & Conditions (2 tools)
| Tool | Description |
|------|-------------|
| `get_current_weather` | Current weather with running severity score |
| `get_outfit_recommendation` | Clothing recommendation based on conditions |

### Equipment Management (7 tools)
| Tool | Description |
|------|-------------|
| `get_shoes` | List shoes with mileage, include/exclude retired |
| `get_wardrobe` | Get clothing inventory |
| `add_clothing_item` | Add new clothing item |
| `log_outfit_feedback` | Rate an outfit combination |
| `log_injury` | Record an injury with severity and affected area |
| `clear_injury` | Mark an injury as resolved |
| `get_injury_status` | Check current injury status |

### Race Management (5 tools)
| Tool | Description |
|------|-------------|
| `get_races` | Get upcoming and past races |
| `add_race` | Add a goal race |
| `add_race_result` | Log a race result (auto-calculates VDOT) |
| `update_race` | Modify race details |
| `delete_race` | Remove a race |

### Analytics & Insights (10 tools)
| Tool | Description |
|------|-------------|
| `get_fitness_trend` | Track fitness progression over time |
| `get_fatigue_indicators` | Detect signs of overtraining |
| `get_plan_adherence` | Calculate plan completion percentage |
| `get_readiness_score` | Today's readiness to train (0-100) |
| `get_proactive_alerts` | Important alerts (injuries, fatigue, milestones) |
| `analyze_recovery_pattern` | Analyze recovery between workouts |
| `get_pre_run_briefing` | Complete pre-run summary with all relevant info |
| `get_weekly_review` | End-of-week training review |
| `get_upcoming_week_preview` | Preview of next week's training |
| `suggest_next_workout` | AI-suggested next workout |

### Context & Travel (3 tools)
| Tool | Description |
|------|-------------|
| `get_context_summary` | Full context summary for AI coaching |
| `set_travel_status` | Set travel/vacation mode |
| `get_altitude_pace_adjustment` | Altitude-based pace adjustments |

---

## 3. DATA TRACKING CAPABILITIES

### Workout Data
- Date, time, distance (miles)
- Duration (minutes)
- Average pace (calculated or entered)
- Workout type: easy, steady, tempo, interval, long, race, recovery, cross_train, other
- Route name
- Notes/comments
- Shoe used
- Weather conditions at time of workout

### Assessment Data (Post-Run)
- **Verdict**: great, good, fine, rough, awful
- **RPE**: Rate of perceived exertion (1-10)
- **Legs feel**: (0-10)
- **Breathing**: easy, controlled, hard, cooked
- **Sleep quality**: (0-10)
- **Sleep hours**: numeric
- **Stress level**: (0-10)
- **Soreness**: (0-10)
- **Hydration**: (0-10)
- **Notes**: free-form text

### User Profile Data
- Name, age, gender
- Years running
- Current weekly mileage
- Current long run max
- Runs per week (current & target)
- Peak weekly mileage target
- VDOT score (calculated or entered)
- All pace zones (easy, tempo, threshold, interval, marathon, half-marathon)
- Preferred long run day
- Preferred quality workout days
- Plan aggressiveness: conservative, moderate, aggressive
- Quality sessions per week
- Temperature preference: runs_hot, neutral, runs_cold
- Train by: pace, feel, mixed
- Stress level: low, moderate, high
- Typical sleep hours
- Location (for weather)
- Acclimatization score

### Shoe Data
- Brand, model, name
- Purchase date
- Total miles
- Target miles (for retirement)
- Retired status
- Notes

### Clothing/Wardrobe Data
- Category: base_layer, mid_layer, outer_layer, shorts, tights, socks, hat, gloves, accessories
- Name, brand
- Temperature range (min/max)
- Weather suitability: rain, wind, sun
- Owned status

### Race Data
- Name, date, location
- Distance (with label and meters)
- Priority: A (goal), B (important), C (tune-up)
- Target time
- Training plan generated flag
- Course profile, notes

### Race Results Data
- Finish time
- Effort level: all_out, hard, moderate, easy
- Conditions
- VDOT at time
- Notes

### Planned Workout Data
- Date, name
- Workout type
- Target distance, duration, pace
- Description and rationale
- Is key workout flag
- Status: scheduled, completed, skipped
- Phase and week number

### Training Block Data
- Start date, end date
- Phase: base, build, peak, taper, recovery
- Focus description
- Target weekly mileage

---

## 4. CALCULATION & INTELLIGENCE FEATURES

### VDOT System (Jack Daniels Method)
- Calculate VDOT from race results
- Derive all training paces from VDOT:
  - Easy pace (65-79% VO2max)
  - Marathon pace (80-85% VO2max)
  - Threshold/Tempo pace (86-88% VO2max)
  - Interval pace (95-100% VO2max)
  - Repetition pace (105-120% VO2max)
- Predict race times for any distance
- Update VDOT automatically when race results are logged

### Weather-Based Adjustments
- Real-time weather fetching
- Running severity score calculation
- Pace adjustments based on:
  - Temperature (heat index)
  - Humidity
  - Wind speed
  - Precipitation
- "Vibes temp" calculation (feels-like for running)
- Acclimatization factor

### Training Load Analysis
- Acute Training Load (ATL) - recent fatigue
- Chronic Training Load (CTL) - fitness level
- Training Stress Balance (TSB)
- Fatigue indicators
- Recovery pattern analysis

### Outfit Recommendation Engine
- Temperature-based layering
- Weather condition matching
- User temperature preference adjustment
- Category-based suggestions
- Wardrobe matching

### Training Plan Generation
- Periodized plans with phases: base, build, peak, taper, recovery
- Workout type distribution
- Weekly mileage progression
- Key workout placement
- Long run scheduling
- Quality session balancing

---

## 5. INTEGRATIONS & APIs

### Anthropic Claude API
- Model: claude-sonnet-4-20250514
- Streaming responses via Server-Sent Events
- 64 tool definitions for function calling
- Context-aware coaching conversations

### Weather API
- OpenWeatherMap integration
- Current conditions
- Hourly forecasts

### Database
- Drizzle ORM
- SQLite (development)
- PostgreSQL via Neon (production)

---

## 6. SETTINGS & PREFERENCES (50+ Options)

### Training Preferences
- Plan aggressiveness (conservative/moderate/aggressive)
- Quality sessions per week
- Preferred long run day
- Preferred quality days
- Train by pace/feel/mixed
- Peak weekly mileage target
- Weekly volume target

### Physical Preferences
- Temperature preference (runs hot/neutral/runs cold)
- Typical sleep hours
- Current stress level

### Pace Settings
- All pace zones (6 different paces)
- VDOT score

### Location & Weather
- Location for weather
- Acclimatization score
- Travel status

### App Settings
- Onboarding completed flag
- Demo mode flag

---

## 7. ANALYTICS & VISUALIZATIONS

### Charts
- Weekly mileage bar chart (8 weeks)
- Workout type distribution (stacked bar/pie)
- Pace trend over time
- Training load graphs

### Statistics
- Total workouts count
- Total miles
- Total time running
- Average pace
- Workout type breakdown
- Weekly averages
- Monthly summaries
- Year-to-date totals

### Insights
- Plan adherence percentage
- Readiness score (0-100)
- Fitness trend direction
- Fatigue indicators
- Recovery quality

---

## 8. DEMO MODE

### Features
- Activated via `?demo=true` URL parameter
- All data stored in localStorage
- Per-browser isolation
- Optional sample data: `?demo=true&sample=true`

### Sample Runner Profile (Alex)
- 32 years old, 4 years running
- 35 miles/week current, 50 target
- VDOT 45 (9:00 easy, 7:30 tempo)
- Training for marathon ~10 weeks out

### Demo-Specific Implementations
- All 64 tools work in demo mode
- Data persists across sessions
- UI refreshes automatically via custom events
- Full coach functionality

---

## 9. UNIQUE FEATURES

### Pre-Run Briefing
Comprehensive summary including:
- Today's planned workout
- Current weather & adjustments
- Readiness factors
- Outfit recommendation
- Key reminders

### Weekly Review
End-of-week analysis including:
- Completed vs planned workouts
- Total mileage
- Notable achievements
- Areas for improvement
- Next week preview

### Proactive Alerts System
Automatic detection of:
- Injury status
- High fatigue/overtraining risk
- Milestone achievements
- Weather warnings
- Shoe mileage warnings

### Smart Workout Logging
- Provide any 2 of: distance, duration, pace
- Third value auto-calculated
- Conversational workout entry via coach

### Contextual Coaching
AI coach has full access to:
- User profile & preferences
- Recent training history
- Current weather
- Upcoming races
- Training plan
- Assessment patterns
- Injury status

---

## 10. TECHNICAL ARCHITECTURE

### Frontend
- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Lucide React icons
- shadcn/ui components

### Backend
- Next.js Server Actions
- Drizzle ORM
- SQLite/PostgreSQL
- Server-Sent Events for streaming

### State Management
- React useState/useEffect
- localStorage for demo mode
- Custom events for cross-component updates

---

## APPENDIX: Complete Tool List

1. get_recent_workouts
2. get_workout_detail
3. get_shoes
4. get_user_settings
5. get_current_weather
6. calculate_adjusted_pace
7. log_workout
8. log_assessment
9. get_training_summary
10. search_workouts
11. get_outfit_recommendation
12. get_wardrobe
13. add_clothing_item
14. log_outfit_feedback
15. get_todays_workout
16. get_weekly_plan
17. get_pace_zones
18. get_user_profile
19. update_user_profile
20. get_races
21. add_race
22. add_race_result
23. modify_todays_workout
24. get_plan_adherence
25. get_readiness_score
26. predict_race_time
27. analyze_workout_patterns
28. get_training_load
29. get_fitness_trend
30. analyze_recovery_pattern
31. compare_workouts
32. get_fatigue_indicators
33. estimate_workout_quality
34. get_proactive_alerts
35. get_todays_planned_workout
36. update_planned_workout
37. suggest_workout_modification
38. swap_workouts
39. reschedule_workout
40. skip_workout
41. get_week_workouts
42. make_down_week
43. insert_rest_day
44. adjust_workout_distance
45. convert_to_easy
46. log_injury
47. clear_injury
48. get_injury_status
49. set_travel_status
50. get_altitude_pace_adjustment
51. get_context_summary
52. get_pre_run_briefing
53. get_weekly_review
54. suggest_next_workout
55. analyze_completed_workout
56. get_upcoming_week_preview
57. update_race
58. delete_race
59. get_training_philosophy
60. suggest_plan_adjustment
61. generate_training_plan
