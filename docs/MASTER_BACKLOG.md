# Dreamy Master Backlog

> Converted from `dreamy_master_backlog.xlsx` on 2026-02-18
> 136 items across 6 phases | ~540 estimated hours total

---

## Phase Summary

| Phase | Name | Items | Est Hours | Focus | Key Outcome |
|-------|------|-------|-----------|-------|-------------|
| 1 | Fix What's Broken + Foundation | 22 | ~25h | Bug fixes, code quality, schema, security | Everything that exists works correctly |
| 2 | Core Experience Completion | 23 | ~65h | Race lifecycle, post-run intelligence, adaptive plans, Strava | Main user loops work end-to-end |
| 3 | Strava Data, Social, Shoes & Deep Analytics | 37 | ~150h | GAP, best efforts, shoe intelligence, social, deep metrics | Insights no other app provides |
| 4 | Intelligence & Differentiation | 15 | ~85h | Pattern recognition, predictive insights, coach memory | Things only Dreamy can do |
| 5 | Growth & Sharing | 12 | ~65h | Shareable cards, public profiles, push, integrations, API | Features that help the app grow |
| NEW | Research-Driven Additions | ~28 | ~150h | Transparent metrics, threshold detection, personalized recovery, unified load | Critical gaps from competitive audit |

---

## Phase 1: Fix What's Broken + Foundation (~25h)

### P0 — Critical Bugs
| ID | Feature / Task | Complexity | Est Hours | Description | Notes |
|----|---------------|-----------|-----------|-------------|-------|
| D-001 | Fix PaceTrendChart formatting bug | S | 0.1 | Pace displays '8:352' instead of '8:05' — wrong variable in padStart() | File: PaceTrendChart.tsx line 27 |
| D-002 | Consolidate formatPace() — one function everywhere | S | 0.5 | 4+ duplicate implementations with inconsistent behavior | Delete duplicates, import from utils.ts |
| D-003 | Consolidate VDOT calculation — one method everywhere | S | 1 | 3 different VDOT implementations produce different results | Use exponential method from vdot-calculator.ts |
| D-004 | Fix schema mismatches (SQLite vs Postgres) | S | 1 | Strava IDs can exceed 32-bit, elevation loses precision, coachContext missing in prod | Data loss risk |
| D-005 | Fix elevation profile — show actual ups and downs | S | 2 | Shows only cumulative gain, not terrain profile | Table stakes |
| D-006 | Fix EnhancedSplits — pace format + header naming | S | 0.5 | Pace shows '8:3.2762', header says 'Mile Splits' but data is watch laps | Depends: D-002 |

### P1 — Important Bugs & Code Quality
| ID | Feature / Task | Complexity | Est Hours | Description | Notes |
|----|---------------|-----------|-----------|-------------|-------|
| D-007 | Fix runs-by-day chart invisible color | S | 0.25 | White on white background | Chart is unusable |
| D-008 | Fix goal calculator | S | 1.5 | Totally broken per user feedback | Needs investigation |
| D-009 | Unified color system for all charts | M | 3 | 4 different color approaches across charts | Migrate to workout-colors.ts or CSS variables |
| D-010 | Standardize time range selectors on all charts | S | 2 | Some have 1M/3M/6M/1Y, some fixed, some show all | Inconsistent controls |
| D-011 | Chart design system — shared wrapper component | M | 4 | Reusable chart component with loading/empty states, responsive sizing | Speed up future chart dev |
| D-012 | VDOT display consistency — clarify Training vs Estimated | M | 3 | 3 different VDOT storage locations, 3 confidence calculations | Depends: D-003 |

### P2 — Code Quality & Security
| ID | Feature / Task | Complexity | Est Hours | Description | Notes |
|----|---------------|-----------|-----------|-------------|-------|
| D-013 | Remove/gate 11 test/debug pages from production | S | 1 | Test pages accessible in production | Unprofessional |
| D-014 | Consolidate 10 Strava pages → 3 | S | 2 | 10 Strava-related pages confuse routing | Code maintainability |
| D-015 | Delete dead code (5 files, 0 imports) | S | 0.5 | StravaManualConnect, strava-manual, strava-debug, /welcome, /race-predictor | |
| D-016 | Fix hardcoded profileId: 1 in coach-tools.ts | S | 0.5 | CTL/ATL/TSB hardcoded to 0 | Multi-user readiness |
| D-017 | Remove demo seed fallback secret | S | 0.1 | Falls back to 'demo-seed-2024' if env var missing | Security risk |
| D-018 | Fix silent profile ID failures | S | 1 | Functions fail silently when profile ID is null | Debuggability |
| D-019 | Implement BestEfforts.tsx stub functions (4 functions) | M | 4 | getBestEfforts, getBestMileSplits, getPaceCurve, getWorkoutRanking all unimplemented | Foundation for VDOT/PR tracking |
| D-020 | Implement import page activity processing | M | 3 | Upload page exists but doesn't actually process or save | Data portability |
| D-021 | Create missing database tables (3 tables) | S | 2 | conversationSummaries, responseCache, workoutTemplates | Unblocks Phase 2+4 |
| D-022 | Encrypt stored API tokens | M | 3 | Strava & Intervals.icu tokens stored as plaintext | Security & privacy |

---

## Phase 2: Core Experience Completion (~65h)

### Race Lifecycle
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score | Dependencies |
|----|---------------|----------|-----------|-----------|------------|--------------|
| D-023 | Link planned races to race results | P0 | M | 4 | 5 | |
| D-024 | Race history timeline — visual hero view | P0 | M | 4 | 6 | |
| D-025 | PR tracking by standard distance | P1 | M | 3 | 5 | Strava best_efforts |
| D-026 | Race calendar view with countdown + training phases | P1 | M | 4 | 5 | |
| D-027 | Training plan ↔ race wiring — generate plan from race page | P1 | L | 6 | 7 | D-023 |
| D-028 | Bulk edit / retroactive race linking | P2 | M | 3 | 3 | D-023 |

### Post-Run Intelligence (KILLER FEATURE TERRITORY)
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score | Dependencies |
|----|---------------|----------|-----------|-----------|------------|--------------|
| D-029 | Post-run check-in flow — standard questions after sync | P0 | L | 8 | **10** | |
| D-030 | 'Why did today feel hard?' auto-analysis engine | P0 | L | 6 | **9** | |
| D-031 | Explain workout difficulty — coach tool | P1 | M | 3 | 8 | |

### Adaptive Planning
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score | Dependencies |
|----|---------------|----------|-----------|-----------|------------|--------------|
| D-032 | Adaptive plan — weekly re-evaluation + diff view | P1 | L | 8 | **9** | D-027 |
| D-033 | Coach action approval workflow — show diff, confirm/reject | P1 | M | 4 | 7 | |

### Strava Integration (Phase 2)
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score | Dependencies |
|----|---------------|----------|-----------|-----------|------------|--------------|
| D-039 | Implement Strava webhook for real-time sync | P0 | M | 4 | 5 | Strava webhook API |
| D-035 | Import cadence data from Strava | P2 | S | 2 | 4 | |
| D-036 | Import gear_id from Strava activities | P2 | S | 2 | 5 | |
| D-037 | Import best_efforts from Strava | P2 | M | 3 | 6 | |
| D-038 | Import activity zones from Strava | P2 | S | 2 | 3 | |
| D-040 | Import Strava athlete stats (YTD/all-time) | P2 | S | 2 | 3 | |
| D-041 | Import Strava athlete zones (HR + power) | P2 | S | 1 | 2 | |
| D-042 | Complete lap sync for remaining 392 workouts | P2 | S | 1 | 1 | Rate limit reset |
| D-043 | Test and fix production OAuth callback | P2 | S | 1 | 3 | |

### Other Phase 2
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score | Dependencies |
|----|---------------|----------|-----------|-----------|------------|--------------|
| D-034 | Progressive context collection — profile completion % | P1 | S | 3 | 6 | IN_PROGRESS |
| D-044 | Manual run entry UX — sliders + smart defaults | P2 | M | 3 | 3 | |
| D-045 | Restore cheaper model usage tips popup | P2 | S | 1 | 2 | |

---

## Phase 3: Strava Data, Social, Shoes & Deep Analytics (~150h)

### Grade/GAP & Performance
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score |
|----|---------------|----------|-----------|-----------|------------|
| D-046 | Import grade_smooth streams + calculate GAP | P0 | L | 6 | 7 |
| D-047 | Import Strava best_efforts for high-confidence VDOT | P0 | M | 4 | 8 |
| D-053 | Running economy tracking — pace at given HR over time | P0 | M | 4 | 8 |
| D-049 | GAP-based training load (TRIMP adjusted for grade) | P1 | M | 4 | 8 |
| D-054 | Fatigue resistance metric — last 25% vs first 75% | P1 | M | 3 | 7 |
| D-055 | Negative split tendency tracker | P1 | S | 2 | 5 |
| D-063 | Pace curve / Critical Speed model | P1 | M | 4 | 7 |

### Shoe Intelligence (FLAGSHIP DIFFERENTIATOR)
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score |
|----|---------------|----------|-----------|-----------|------------|
| D-072 | Strava gear sync — import gear_id + GET /gear/{id} | P0 | M | 4 | 4 |
| D-073 | Shoe mileage dashboard with retirement alerts | P0 | M | 4 | 5 |
| D-074 | Shoe efficiency model — controlled comparison | P0 | L | 8 | **10** |
| D-075 | Shoe rotation analysis + patterns | P1 | M | 3 | 6 |
| D-076 | Shoe recommendation engine — suggest shoe for tomorrow | P1 | M | 4 | 8 |
| D-077 | Shoe break-in curve — performance vs mileage | P2 | M | 3 | 7 |
| D-078 | Injury correlation by shoe | P2 | M | 3 | 7 |
| D-079 | Surface type inference from GPS+elevation+pace | P2 | M | 4 | 6 |

### Social Intelligence
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score |
|----|---------------|----------|-----------|-----------|------------|
| D-066 | Kudos tracking & sync from Strava | P1 | L | 6 | 7 |
| D-067 | Kudos leaderboard + engagement trend analysis | P1 | M | 4 | 7 |
| D-070 | Social engagement dashboard | P1 | L | 6 | 8 |
| D-068 | 'Ghost kudos' detector — friends who went quiet | P2 | M | 3 | 6 |
| D-069 | Comments tracking from Strava | P2 | M | 4 | 4 |
| D-071 | Club activity feed analysis | P2 | M | 4 | 5 |

### Other Phase 3
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score |
|----|---------------|----------|-----------|-----------|------------|
| D-048 | Import segment efforts — PR tracking on segments | P1 | L | 6 | 5 |
| D-050 | Import temp streams + personal heat curves | P1 | M | 4 | 7 |
| D-051 | Weather-adjusted training load (heat stress index) | P1 | M | 4 | **9** |
| D-052 | Import cadence streams — stride length + form | P1 | M | 4 | 6 |
| D-056 | Time of day analysis — circadian performance | P1 | M | 3 | 5 |
| D-057 | Training partner effect analysis | P2 | S | 2 | 6 |
| D-058 | Route familiarity effect | P2 | M | 4 | 6 |
| D-059 | GPS route visualization with pace/HR overlay | P1 | L | 8 | 4 |
| D-060 | Segment discovery — popular segments nearby | P2 | L | 6 | 4 |
| D-061 | Workout comparison tool | P1 | L | 6 | 7 |
| D-062 | Device/watch tracking per activity | P2 | S | 1 | 3 |
| D-064 | Enhanced HR zone breakdown per activity | P1 | M | 3 | 5 |
| D-065 | Training distribution analysis — shift recommendations | P1 | S | 2 | 7 |
| D-080 | Import full activity detail | P2 | M | 3 | 3 |
| D-081 | Import latlng streams (full GPS) | P2 | M | 3 | 4 |
| D-082 | Import moving streams (boolean per-second) | P2 | S | 1 | 3 |

---

## Phase 4: Intelligence & Differentiation (~85h)

| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score |
|----|---------------|----------|-----------|-----------|------------|
| D-083 | Historical pattern recognition engine | P0 | L | 12 | **10** |
| D-084 | Predictive insights — forward-looking predictions | P0 | L | 10 | **10** |
| D-085 | Auto-generated weekly insights (3-5 cards) | P1 | L | 6 | 8 |
| D-086 | Coach memory timeline — what AI has learned | P1 | M | 4 | **9** |
| D-087 | Automatic insights dashboard | P1 | L | 6 | 7 |
| D-088 | Race day countdown & prep (2 weeks before) | P1 | L | 8 | 8 |
| D-089 | Running streak & consistency tracking | P1 | M | 3 | 4 |
| D-090 | Soreness body map — tap body parts, 1-5 scale | P1 | L | 6 | 8 |
| D-091 | Wellness trends dashboard — HRV, RHR, sleep, weight | P1 | L | 6 | 7 |
| D-092 | Sentiment-aware coach — dynamic tone adaptation | P1 | M | 4 | 8 |
| D-093 | Periodization view — Base→Build→Peak→Taper | P2 | L | 6 | 6 |
| D-094 | Cross-training support — bike/swim/strength stress | P2 | L | 6 | **9** |
| D-095 | Running power estimates from pace+grade+bodyweight | P2 | L | 6 | 7 |
| D-096 | Ultra marathon support — 50K to 100M | P2 | L | 8 | 8 |
| D-097 | User preference tracking — persist to DB | P2 | M | 3 | 5 |

---

## Phase 5: Growth & Sharing (~65h)

| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score |
|----|---------------|----------|-----------|-----------|------------|
| D-098 | Shareable race cards — IG Story/Post/Twitter | P1 | L | 8 | 7 |
| D-099 | Weekly recap card — shareable summary | P1 | M | 4 | 5 |
| D-100 | PR celebration cards with confetti + share | P1 | M | 4 | 6 |
| D-101 | Milestone celebrations — lifetime miles, streaks | P2 | M | 4 | 4 |
| D-102 | Public profile / race resume — @username | P2 | L | 6 | 6 |
| D-103 | Route export as GPX/TCX | P2 | M | 3 | 3 |
| D-104 | Weekly email digest (or in-app digest) | P2 | L | 6 | 6 |
| D-105 | Apple Health integration — sleep, HRV, RHR, weight | P3 | L | 8 | 5 |
| D-106 | Garmin Connect integration | P3 | L | 12 | 5 |
| D-107 | Push notifications — reminders, check-ins, PRs | P2 | L | 8 | 4 |
| D-108 | Full data export — CSV/JSON | P2 | M | 3 | 4 |
| D-109 | API for third-party apps | P3 | L | 8 | 6 |

---

## NEW: Research-Driven Additions (~150h)

### High-Impact Differentiators (Diff Score 8-10)
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score |
|----|---------------|----------|-----------|-----------|------------|
| D-137 | **EXTREMELY HIGH PRIORITY:** Analytics IA audit + split-page architecture (overview hub + drilldowns) | P0 | M | 8 | **10** |
| D-110 | Transparent training load dashboard — show the math | P1 | L | 8 | **9** |
| D-111 | Auto-detected threshold from workout data | P1 | L | 8 | **9** |
| D-112 | Personalized recovery model — learns YOUR physiology | P1 | L | 8 | **9** |
| D-113 | Lifestyle-performance correlation engine | P1 | M | 6 | **10** |
| D-119 | AI chat coach with FULL training context awareness | P0 | L | 10 | **10** |
| D-122 | Training plan adapts to biometrics AND life context | P1 | L | 8 | **10** |
| D-124 | Unified strength + endurance load quantification | P1 | L | 8 | **10** |
| D-118 | Race execution analysis + replay | P0 | L | 8 | **9** |

### Performance & Analytics
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score |
|----|---------------|----------|-----------|-----------|------------|
| D-114 | Aerobic decoupling tracking (Pa:HR drift) | P1 | M | 4 | 7 |
| D-115 | Interval auto-detection + scoring | P1 | M | 4 | 7 |
| D-116 | Heat acclimation protocol tracking | P1 | M | 6 | 7 |
| D-117 | Altitude adjustment for pace/performance | P1 | M | 4 | 5 |
| D-120 | Recovery-adjusted training zones (shift daily) | P1 | M | 4 | 8 |
| D-121 | Real-time form degradation detection | P1 | M | 6 | **9** |
| D-125 | File fidelity validation + source-of-truth | P1 | M | 6 | 8 |
| D-127 | Custom alerts/rules engine | P1 | M | 4 | 8 |
| D-130 | 'Explain the model' UI per metric | P2 | M | 4 | **9** |
| D-135 | Baseline calibration flow — guided assessment run | P1 | M | 4 | 6 |

### Other Research Items
| ID | Feature / Task | Priority | Complexity | Est Hours | Diff Score |
|----|---------------|----------|-----------|-----------|------------|
| D-123 | Race fueling calculator | P2 | M | 4 | 6 |
| D-126 | Coach-athlete platform — manage athletes | P2 | L | 8 | 7 |
| D-128 | Training block summary — end-of-block report | P2 | M | 4 | 7 |
| D-129 | 'Data gap detector' with fallback load logic | P2 | M | 4 | 6 |
| D-131 | Plan compliance score — intent-aware | P2 | S | 3 | 7 |
| D-132 | Menstrual cycle-adjusted training | P2 | L | 6 | 8 |
| D-133 | Morning readiness score — HRV + sleep + feel | P2 | M | 4 | 6 |
| D-134 | Community benchmarks — anonymous comparison | P2 | M | 4 | 7 |
| D-136 | Intervals.icu deep integration — two-way sync | P2 | M | 4 | 5 |

---

## Competitive Landscape Summary

| Category | Tool | What They Do Well | Dreamy's Angle |
|----------|------|-------------------|----------------|
| Social Hub | Strava | Unbeatable social graph, segments, massive API | Don't compete on social — integrate deeply, analyze what Strava can't |
| Hardware | Garmin Connect | Deepest physiological data from wrist | Ingest Garmin data, make it transparent and actionable |
| Coach Platform | TrainingPeaks | Industry standard PMC, massive coach ecosystem | AI does the analytical work coaches do manually |
| Analytics | Intervals.icu | Best free analytics, custom charts, interval detection | Running-first, coaching-first, beautiful mobile UX |
| Analytics | Runalyze | Best running analytics, transparent formulas | Runalyze's depth + AI coaching + beautiful UI |
| AI Coaching | Runna | Fastest growing, clean UX, Strava bundle | Deeper personalization, pattern recognition |
| AI Coaching | TrainAsONE | True adaptive AI, adjusts every workout | Better UX, deeper analytics, conversational coaching |
| AI Coaching | AI Endurance | DFA alpha-1 threshold detection, personalized recovery | Adopt their best science with superior UX + AI |
| Running Power | Stryd | Only reliable running power, shoe analytics | Estimated power from pace+grade+weight (no hardware) |

## Dreamy's 10 Defensible Differentiators
1. AI Coach with Full Data Awareness (Diff 10)
2. Transparent Metrics — Show the Math (Diff 9)
3. Multi-Factor 'Why Did That Happen' Engine (Diff 9)
4. Shoe Efficiency Model (Diff 10)
5. Weather-Adjusted Training Load (Diff 9)
6. Pattern Recognition → Predictive Coaching (Diff 10)
7. Social Intelligence / Kudos Analytics (Diff 7)
8. Unified Strength + Endurance Load (Diff 10)
9. Adaptive Plan with Life Context (Diff 10)
10. Emotional Intelligence in Coaching (Diff 8)
