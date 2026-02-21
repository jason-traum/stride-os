# Analytics IA Audit + Proposed Page Map

Date: 2026-02-21  
Priority: **EXTREMELY HIGH (P0)**

## Why this is now urgent
- The current analytics experience is information-dense but overloaded.
- Users must scroll a long single page and context-switch between very different mental models (load, performance, races, history, long-term progression).
- This reduces clarity and slows time-to-insight.

## Current-State Audit (what exists now)
File reviewed: `src/app/analytics/page.tsx`

- ~481 lines in one route-level page.
- 7 major sections:
1. Overview
2. Training Load & Fitness
3. Performance Analysis
4. Race Planning
5. Activity History
6. Stats & Progress
7. Long-term Progress
- 25+ visual cards/charts on one page.
- Several sections combine summary + deep analysis simultaneously, which increases cognitive load.

## What top products do (pattern check)
- Strava separates high-level progress from deeper exploration (Training Log + Progress + drill-in by date range/filter).  
  Source: [Training Log](https://support.strava.com/hc/en-us/articles/206535704-Training-Log), [Progress Summary Chart](https://support.strava.com/hc/en-us/articles/28437860016141-Progress-Summary-Chart)
- TrainingPeaks gives a compact Athlete Home snapshot, then dedicated chart drill-down with explicit time windows (7/30/90/180).  
  Source: [Athlete Home Performance Insights](https://help.trainingpeaks.com/hc/en-us/articles/41077784209165-Athlete-Home-Performance-Insights), [PMC](https://help.trainingpeaks.com/hc/en-us/articles/204071874-Performance-Management-Chart-PMC)
- Garmin uses separate report areas for metrics like VO2 Max / Training Status rather than one mega-page.  
  Source: [Garmin Reports](https://support.garmin.com/en-US/?faq=99CGXYuO9u7lywZQWn7B46&searchType=noProduct), [Training Status](https://support.garmin.com/en-MY/?faq=VxKazDQ2mkAmDoQbJriEBA)
- Intervals.icu emphasizes dashboard summary + dedicated analytics screens.  
  Source: [Intervals.icu](https://www.intervals.icu/)

## Proposed Information Architecture (Map v1)
Primary goal: keep a fast overview, move deep analysis into focused pages.

### 1) `/analytics` (Overview Hub)
Show only decision-driving summaries (6-8 modules max):
- Key KPIs: workouts, miles, time, avg pace
- Current VDOT + short trend sparkline
- Weekly volume + target status
- Recovery status + load status
- Top 3 “insights this week”
- CTA cards: `View Performance`, `View Race Readiness`, `View History`

### 2) `/analytics/training` (Load & Readiness)
- Weekly mileage/time/TRIMP
- CTL/ATL/TSB charts and load recommendation
- Training distribution + zone/load mix
- Recovery/readiness context

### 3) `/analytics/performance` (Execution & Efficiency)
- Best efforts + pace trend
- Split tendency + fatigue resistance
- Running economy + time-of-day effects
- Device/quality confidence flags

### 4) `/analytics/racing` (Race Readiness & Prediction)
- Race prediction cards
- Signal confidence table/bands
- Goal race calculator + equivalent-condition adjustments
- Race detection/quality confidence (once available)

### 5) `/analytics/history` (Calendar + Logs)
- Heatmap
- Monthly calendar
- Weekly/monthly rollups
- Search/filter/sport tags

### 6) `/analytics/progress` (Long-Term Trends)
- Milestones and PR timeline
- Yearly comparison
- Cumulative miles and pace progression
- Milestone tracker

## Navigation pattern
- Keep left nav item as `Analytics`.
- Inside analytics, add top sub-nav tabs:
1. Overview
2. Training
3. Performance
4. Racing
5. History
6. Progress
- Preserve deep links for each tab/page.

## Interaction rules (to reduce clutter)
- Default each page to 3-5 primary panels; move secondary panels behind “Show more”.
- Standardize time controls: `1M / 3M / 6M / 1Y / All` where applicable.
- Keep hover tooltips for exact values instead of extra static rows when possible.
- Add quick “pin to overview” action so user can customize what appears on `/analytics`.

## Rollout Plan (phased)
### Phase A (1-2 days): IA shell + routing
- Add analytics sub-routes and shared page shell.
- Keep current cards/components; only redistribute.

### Phase B (2-4 days): content migration
- Move cards to the new route groups above.
- Reduce overview to essentials.

### Phase C (1-2 days): polish + measurement
- Add usage tracking (which tab/cards users open).
- Tune defaults based on interaction data.

## Comparison framework for reviewing this map vs Claude’s map
Score each proposal 1-5 on:
1. Time-to-insight (can user answer “how am I doing?” in <10s?)
2. Cognitive load (too much on one screen?)
3. Drill-down quality (easy path from summary to details?)
4. Mobile usability (scroll depth, readability)
5. Reuse of existing components (low rewrite risk)
6. Future extensibility (new cards/pages without clutter)

## Recommended decision
- Adopt this split-IA approach now as a P0 UX/IA initiative before adding net-new analytics modules.
