# VDOT, Pacing & Fitness Model — Architecture Document

> **Last updated:** 2026-02-20
> Master reference for how Dreamy estimates fitness, classifies workouts, predicts race times, and assigns training zones.

---

## Table of Contents

1. [Core VDOT System](#1-core-vdot-system)
2. [Zone Boundary Architecture](#2-zone-boundary-architecture)
3. [6-Signal Race Prediction Engine](#3-6-signal-race-prediction-engine)
4. [Effort Classification Pipeline](#4-effort-classification-pipeline)
5. [Fitness-Fatigue Model (CTL/ATL/TSB)](#5-fitness-fatigue-model-ctlatltsb)
6. [Interval vs Continuous Stress](#6-interval-vs-continuous-stress)
7. [Proposed: Interval Stress Model](#7-proposed-interval-stress-model)
8. [Proposed: Goal Pace vs Fitness Pace](#8-proposed-goal-pace-vs-fitness-pace)
9. [Mile Split Interpolation](#9-mile-split-interpolation)
10. [Key File Map](#10-key-file-map)
11. [Research Sources](#11-research-sources)

---

## 1. Core VDOT System

**File:** `src/lib/training/vdot-calculator.ts`

VDOT is a "pseudo-VO2max" from Jack Daniels' Running Formula. It combines actual VO2max with running economy into a single number that maps to training paces and race predictions.

### How VDOT is calculated from a race result

```
velocity = distance_meters / (time_seconds / 60)

%VO2max = 0.8 + 0.1894393 * e^(-0.012778 * t) + 0.2989558 * e^(-0.1932605 * t)
VO2     = -4.60 + 0.182258 * v + 0.000104 * v²

VDOT = VO2 / %VO2max
```

The `%VO2max` formula is key — it accounts for the fact that you can sustain a higher fraction of VO2max for shorter races. A 5K runner uses ~97% of VO2max; a marathoner uses ~78-82%.

### How race time is predicted from VDOT

`predictRaceTime(vdot, distanceMeters)` iterates to find the time that produces the given VDOT at the given distance. This accounts for the duration-dependent `%VO2max` curve — the same reason a 50-VDOT runner's marathon is not simply 4× their 10K time.

### Weather & elevation adjustments

- **Heat:** Uses heat index from temp (°F) + humidity. Adds seconds/mile penalty above 55°F heat index.
- **Elevation:** ~12 sec/mi per 100 ft/mi of gain.
- `calculateAdjustedVDOT()` subtracts these penalties to estimate flat/ideal-conditions VDOT. Capped at 15% correction.

---

## 2. Zone Boundary Architecture

**File:** `src/lib/training/vdot-calculator.ts` — `calculatePaceZones()`

Each zone field represents the **fast edge** of that zone (lower seconds/mile = faster). A split at 7:20/mi is classified by finding the zone whose fast-edge boundary it falls below.

### Current zone derivation (post-fix)

| Zone | Source | Formula | ~VDOT 49 |
|------|--------|---------|----------|
| **Recovery** | 55% VO2max | `velocityFromVDOT(vdot, 0.55)` | ~11:00+ |
| **Easy** | 62% VO2max | `velocityFromVDOT(vdot, 0.62)` | 9:13+ |
| **Steady** | Marathon race pace + 15s | `marathonRacePace + 15` | 7:39–9:12 |
| **Marathon** | Race pace − 5s | `predictRaceTime(marathon) / 26.219 - 5` | 7:19–7:38 |
| **Tempo** | Midpoint of marathon & threshold | `(marathonPace + thresholdPace) / 2` | 7:06–7:18 |
| **Threshold** | 88% VO2max − 5s | `velocityFromVDOT(vdot, 0.88) - 5` | 6:52–7:05 |
| **VO2max** | 95% VO2max | `velocityFromVDOT(vdot, 0.95)` | ~6:20 |
| **Interval** | 97% VO2max | `velocityFromVDOT(vdot, 0.97)` | 6:26–6:51 |
| **Repetition** | 105% VO2max | `velocityFromVDOT(vdot, 1.05)` | faster |

### Why marathon/HM use `predictRaceTime()` instead of fixed %VO2max

The old approach used a fixed 78% VO2max for marathon pace. This underestimated Daniels' actual marathon pace because the `%VO2max` formula already accounts for the duration-dependent curve. At VDOT 49:
- Old (78% VO2max): ~7:39/mi
- New (`predictRaceTime`): ~7:24/mi

The `predictRaceTime()` approach matches Daniels' published race pace tables exactly because it uses the same iterative solver that accounts for how %VO2max drops with race duration.

### Zone boundary design decisions

- **Marathon zone is tight (~20s)**. Centered on actual race pace, ±10-15s. This prevents marathon-pace splits from being misclassified as steady or tempo.
- **Tempo fills the gap** between marathon and threshold. Gets extra width (5s from each neighbor).
- **Easy starts at 62% VO2max** (not 65%) so that comfortable easy-pace runs aren't misclassified as steady.
- **Threshold shifted 5s faster** than raw 88% VO2max to give tempo more room.

### How zones propagate through the system

```
calculatePaceZones(vdot) → PaceZones object
    ↓
effort-classifier.ts: resolveZones() — builds zone boundaries
    ↓
classifySplitEffortsWithZones() — classifies each split/lap
    ↓
deriveWorkoutType() — determines overall workout category
    ↓
workout-processor.ts — stores classified type in DB
    ↓
race-prediction-engine.ts — uses workout type for signal weighting
```

No downstream consumers need to change when zone formulas are updated — they all consume the same `PaceZones` interface.

---

## 3. 6-Signal Race Prediction Engine

**File:** `src/lib/training/race-prediction-engine.ts`

The engine blends 6 independent signals into a single VDOT estimate with confidence intervals. Each signal has a weight and a half-life (recency decay).

### Signal overview

| # | Signal | Weight | Half-Life | Source | Notes |
|---|--------|--------|-----------|--------|-------|
| 1 | Race VDOT | 1.0 | 180d | Race results | Gold standard; uses elapsed time |
| 2 | Best Effort VDOT | 0.65 | 120d | Top workout efforts | Top 15 by VDOT; 3% derate vs races; **5K+ distance only** |
| 3 | Effective VO2max (HR) | 0.5 | 60d | Easy/steady runs w/ HR | Daniels formula + Swain-Londeree; **steady-state only** |
| 4 | Efficiency Factor Trend | 0.35 | 90d | Easy/steady runs | **Modifier** (adjustment, not absolute VDOT) |
| 5 | Critical Speed | 0.6 | N/A | Multi-distance efforts | Linear regression on effort data |
| 6 | Training Pace Inference | 0.25 | 60d | Pace-only workouts | Fallback when no HR data available |

### Signal blending

Two-pass weighted average with outlier dampening:
1. Calculate raw weighted average of all signals
2. If any signal deviates >4 VDOT points from the blend, scale down its weight
3. Recalculate
4. Apply Efficiency Factor Trend as a modifier (±adjustment), not averaged in

### Fatigue correction (TSB-based)

When TSB < 0 (fatigued), HR-based VO2max estimates are corrected upward:
```typescript
if (tsb < 0) {
  fatigueCorrection = Math.min(3, Math.abs(tsb) * 0.1);
  effectiveVo2max += fatigueCorrection;
}
```
This prevents a tired runner's elevated HR from dragging down their fitness estimate.

### Form adjustment for race predictions

Final predictions include a form adjustment (TSB-based, -3% to +3%):
- TSB > +15: peaked form, predictions use full VDOT
- TSB < -20: fatigued form, predictions include slowdown

---

## 4. Effort Classification Pipeline

**File:** `src/lib/training/effort-classifier.ts`

7-stage deterministic pipeline that classifies each split/lap into effort zones.

### Stages

1. **Resolve Zones** — Builds zone boundaries from VDOT, manual overrides, or workout's own data. Applies weather/elevation adjustment.
2. **Infer Run Mode** — Detects workout type from pace variance:
   - High variability (CV > 0.08) + >20% tempo+ splits → `workout`
   - Low variability + >70% fast → `race`
   - Otherwise → `easy_run`
3. **Raw Classification** — Maps each split's pace to a zone boundary.
4. **Consolidate Short Splits** — Merges <15s splits with neighbors.
5. **Smooth Transitions** — Reduces 1-split zone jumps.
6. **Contextual Hysteresis** — In `workout` mode: slow splits between hard splits → `recovery`. In `race` mode: sustained splits near marathon boundary → `marathon`.
7. **Final Pass** — Cleanup and edge cases.

### Structure detection (interval identification)

**File:** `src/lib/training/run-classifier.ts`

```
If 3+ work segments AND 2+ recovery segments → 'intervals'
```

This is where a structured interval workout (e.g., 6×1mi with jog rests) gets explicitly identified, separate from a varied-pace continuous run.

### Zone distribution → Workout type

After classifying all splits, the system sums minutes per zone and derives the workout category:
- Dominant zone >50% → that type
- Hard zones >20% → dominant hard zone (interval/tempo)
- Distance ≥9mi or duration ≥75min → "long"
- Otherwise → "easy"

---

## 5. Fitness-Fatigue Model (CTL/ATL/TSB)

**File:** `src/lib/training/fitness-calculations.ts`

Based on the Banister impulse-response model.

### Core formulas

```
CTL(t) = CTL(t-1) + (1 - e^(-1/42)) × (load - CTL(t-1))   // 42-day EMA
ATL(t) = ATL(t-1) + (1 - e^(-1/7))  × (load - ATL(t-1))    // 7-day EMA
TSB = CTL - ATL
```

### Training load calculation

```
load = durationMinutes × intensityFactor × paceFactor × durationBonus
```

**Intensity factors by workout type:**

| Type | Factor |
|------|--------|
| Recovery | 0.50 |
| Easy | 0.60 |
| Long | 0.65 |
| Steady | 0.75 |
| Tempo | 0.85 |
| Interval | 1.00 |
| Race | 1.10 |

**Pace factor:** `(600 / avgPaceSeconds)^0.5` — faster pace = higher load, tempered by square root.

**Duration bonus:** +0.5% per minute over 60min — rewards endurance.

### TRIMP calculation

**File:** `src/lib/training/run-classifier.ts`

With HR data:
```
TRIMP = duration × %HRR × 1.92 × e^(1.92 × %HRR)
```

Without HR (pace-based fallback):
```
TRIMP = duration × intensityFactor(adjustedPace)
```

### TSB interpretation

| TSB | Status | Meaning |
|-----|--------|---------|
| > +20 | Well Rested | Fresh but possibly losing fitness |
| +5 to +20 | Race Ready | Optimal performance window |
| -10 to +5 | Training | Normal training adaptation |
| -25 to -10 | Fatigued | Building fitness, need recovery |
| < -25 | Overreached | Injury risk, schedule recovery |

---

## 6. Interval vs Continuous Stress

### Where the system currently distinguishes them

| Component | Interval Handling | Continuous Handling |
|-----------|-------------------|---------------------|
| Best Effort (Signal 2) | Segments <5K filtered out; 3% derate | Longer segments preferred |
| Effective VO2max (Signal 3) | **Excluded** — avg HR misleading during intervals | Included (steady-state types only) |
| Quality Ratio | Only hard segments count as "quality" | All time at/above tempo counts |
| TRIMP | Lower due to averaged HR across recovery | Full load from sustained HR |
| Effort Classification | Detected via structure (3+ work, 2+ recovery) | Single continuous zone |
| Intensity Factor | 1.0 (full) | 0.6–0.85 (depends on type) |
| Efficiency Factor | Computed but less reliable | More reliable (steady HR) |

### The gap: TRIMP undervalues interval workouts

Current TRIMP uses **average HR** across the entire workout (including recovery). This naturally penalizes intervals — a 6×1mi workout at marathon pace with 2min jog rests will have lower avg HR than running 6 continuous miles at the same pace, even though the physiological stress is meaningful.

### What the research says

**EPOC (excess post-exercise oxygen consumption) data:**
- Intervals produce **23-60% higher EPOC** than continuous exercise at matched energy expenditure
- However, EPOC is only 6-15% of total exercise cost — the absolute difference is smaller than the ratio suggests
- The more intense/shorter the intervals, the larger the EPOC gap

**Standard training load models all struggle with intervals:**
- **TRIMPavg:** Fails completely — doesn't distinguish work from rest
- **TRIMPexp:** Better (exponential weighting upweights high-HR bouts) but still underweights
- **TSS/rTSS:** Uses average pace across entire activity including rest → underestimates interval load
- **Intervals.icu:** Known issue — users report interval workouts underscored

**TRIMPc (cumulative TRIMP):** Best available fix. Calculates TRIMP for each work and rest segment separately, then sums. Produces values ~9% higher than standard TRIMP for interval workouts.

**Daniels' cruise interval principle:** Threshold-pace intervals with ≤1min rest per mile of work produce the **same lactate steady-state** as a continuous tempo run. The benefit is more total volume at threshold, not easier effective effort. Implication: at threshold with short rest, the discount is approximately zero.

---

## 7. Proposed: Interval Stress Model

### Rest-to-work discount factor

When evaluating a structured interval workout, apply a discount factor to convert to equivalent continuous stress:

```
effective_stress = work_stress × discount_factor(rest_duration, work_duration, intensity)
```

**Discount factor ranges from 0.70 to 1.00:**

| Rest:Work Ratio | Active Recovery | Standing Rest |
|-----------------|-----------------|---------------|
| 0 (continuous) | 1.00 | N/A |
| 1:6 (30s/3min) | 0.95–0.98 | 0.90–0.95 |
| 1:3 (1min/3min) | 0.90–0.95 | 0.85–0.90 |
| 1:2 (2min/4min) | 0.85–0.90 | 0.80–0.85 |
| 1:1 (3min/3min) | 0.80–0.85 | 0.70–0.80 |

**Example:** 6×1mi at marathon pace (7:20/mi) with 2min jog rest:
- Work duration: ~7:20 per rep, rest duration: 2:00
- Rest:work ratio: ~1:3.7
- Active recovery discount: ~0.88–0.92
- The workout is worth about 90% of running 6 continuous miles at MP

### Per-segment TRIMP (TRIMPc approach)

Instead of averaging HR across the entire activity:
1. Split workout into work and rest segments
2. Calculate TRIMP separately for each segment using per-segment HR
3. Sum all segment TRIMPs
4. Apply discount factor for the rest periods

### Fatigue-adjusted performance interpretation

A workout performed while fatigued (low TSB) represents higher underlying fitness:

```
adjusted_vdot = observed_vdot × (1 + tsb_deficit × 0.002)
```

| TSB | Multiplier | Example: 7:20/mi observed |
|-----|-----------|---------------------------|
| +20 (fresh) | 1.00 | = 7:20 fitness equivalent |
| 0 (training) | 1.04 | ≈ 7:02 fitness equivalent |
| -20 (tired) | 1.08 | ≈ 6:47 fitness equivalent |
| -30 (peak week) | 1.10 | ≈ 6:40 fitness equivalent |

Running 6×1mi at 7:20 during a peak training week (TSB -25) is significantly more impressive than doing the same workout fully rested.

### Additional fatigue indicators beyond TSB

- **Aerobic decoupling trend:** Recent long runs showing >5% decoupling indicate endurance-specific fatigue
- **CTL ramp rate:** If >5 pts/week, residual fatigue exceeds what TSB alone captures
- **Weekly volume context:** Same TSB at 70 mi/week vs 50 mi/week means different fatigue profiles
- **Days since last quality session:** Hard workout 2 days ago ≠ same load spread across 4 easy days

### Where to implement

**Option A:** Modify `computeTRIMP()` in `run-classifier.ts` to use per-segment calculation when segment data is available.

**Option B:** Add a new "Interval-Adjusted Stress" signal to `race-prediction-engine.ts` that provides an additional VDOT signal from interval workouts (currently they only contribute via Signal 2 best-effort with the 5K+ distance filter).

**Option C (recommended):** Both. Fix TRIMP to be segment-aware (improves CTL/ATL accuracy) AND add an interval-derived VDOT signal (improves race prediction).

---

## 8. Proposed: Goal Pace vs Fitness Pace

### The distinction

- **Current fitness pace:** What the athlete can run RIGHT NOW based on current VDOT (from the 6-signal engine)
- **Goal pace:** What the athlete hopes to run on race day, set by the user

At the start of a training cycle, these may diverge by 10-20 sec/mi. Over 12-18 weeks of training, fitness pace should converge toward goal pace.

### Why this matters for workout classification

When a user runs intervals at their **goal marathon pace** (which is faster than current fitness MP), the system should recognize this as a **stretch workout** — harder than it would be at current fitness pace.

```
relative_intensity = (1 / workout_pace) / (1 / current_fitness_pace)
```

| Scenario | Interpretation |
|----------|---------------|
| Goal MP < Current MP (ambitious) | Stretch workout; RPE 7-8/10 expected |
| Goal MP = Current MP | Confirmation workout; RPE 6-7/10 expected |
| Goal MP > Current MP (conservative) | Easy quality session; consider upgrading goal |

### Canova's percentage framework

Renato Canova prescribes workouts as percentages of marathon pace:
- 97-100% of MP: Marathon-specific endurance
- 100-103%: Intensive marathon-specific (intervals)
- 103-105%: Very intensive (intervals with recovery at 98-101% MP)

His "recovery" between hard intervals is often still at 98-101% of marathon pace — the entire workout functions as a continuous marathon stimulus.

### Implementation approach

1. Store user's goal race + goal time alongside current VDOT-derived predictions
2. Score every workout against current fitness pace (not goal pace) for the fitness model
3. Track the gap between current and goal as a "fitness gap" metric
4. Display convergence trend: is the gap closing, static, or widening?

---

## 9. Mile Split Interpolation

**File:** `src/lib/mile-split-interpolation.ts`

Two methods for generating per-mile splits when the source data isn't already in mile laps.

### From lap data: `buildInterpolatedMileSplitsFromLaps()`

Takes sub-mile laps (e.g., Strava auto-laps at 1km or watch auto-laps) and interpolates to mile boundaries. Assumes uniform pace within each lap.

- Only works when median lap distance ≤1.25mi (rejects coarse data like a single 8-mile lap)
- Proportionally distributes HR, elevation, and time across mile boundaries
- Produces `interpolated_mile_lap` (full miles) and `interpolated_partial_lap` (final partial)

### From GPS streams: `buildInterpolatedMileSplitsFromStream()`

Takes raw distance/time/heartrate/altitude arrays and interpolates at mile boundaries.

**Moving time fix (2026-02-20):** The `buildMonotonicPoints()` function now computes **moving time** instead of raw elapsed time. It detects stops (speed < 30:00/mi or distance not increasing) and excludes stopped time from the elapsed calculation. This prevents rest periods during interval workouts from inflating per-mile pace values.

```
Stop detection threshold: 1/1800 miles/sec (= 30:00/mi pace)
If speed < threshold for a segment → that segment's time is excluded
```

---

## 10. Key File Map

| File | Purpose |
|------|---------|
| `src/lib/training/vdot-calculator.ts` | VDOT ↔ pace conversion, zone calculation, race prediction |
| `src/lib/training/race-prediction-engine.ts` | 6-signal VDOT estimation, race predictions, form adjustment |
| `src/lib/training/effort-classifier.ts` | 7-stage per-split effort classification |
| `src/lib/training/run-classifier.ts` | Workout category, structure detection, TRIMP, quality ratio |
| `src/lib/training/workout-processor.ts` | 6-stage per-workout processing pipeline |
| `src/lib/training/fitness-calculations.ts` | CTL/ATL/TSB, ramp rate, training load |
| `src/lib/training/performance-model.ts` | Weighted VDOT from races/efforts (legacy, feeds into engine) |
| `src/lib/mile-split-interpolation.ts` | Per-mile split generation from laps or GPS streams |
| `src/actions/fitness-signals.ts` | Per-workout signal computation (VO2max, EF, decoupling) |
| `src/actions/race-predictor.ts` | Server actions: getVDOTPaces(), getComprehensiveRacePredictions() |
| `src/actions/zone-boundaries.ts` | Server action: getCurrentZoneBoundaries() |
| `src/components/ZoneBoundariesCard.tsx` | Classifier zones UI (peaked + current form columns) |

---

## 11. Research Sources

### EPOC & Interval Stress
- [PMC: Interval vs Continuous EPOC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6651650/) — 23-60% higher EPOC for intervals
- [Nature: Acute Interval Running EPOC (2024)](https://www.nature.com/articles/s41598-024-59893-9)
- [PubMed: Systematic Review of EPOC Magnitude](https://pubmed.ncbi.nlm.nih.gov/32656951/)
- [PubMed: Submaximal vs Supramaximal Running EPOC](https://pubmed.ncbi.nlm.nih.gov/9049750/)

### Training Load Models
- [Fellrnr: TRIMP and TSS](https://fellrnr.com/wiki/TRIMP)
- [ResearchGate: Modified TRIMP (TRIMPc)](https://www.researchgate.net/publication/256695889)
- [TrainingPeaks: NP/IF/TSS](https://www.trainingpeaks.com/learn/articles/normalized-power-intensity-factor-training-stress/)
- [TrainingPeaks: rTSS Explained](https://www.trainingpeaks.com/learn/articles/running-training-stress-score-rtss-explained/)
- [Intervals.icu Forum: Training Load for Intervals](https://forum.intervals.icu/t/training-load-calculation-for-interval-workout/44638)

### Fitness-Fatigue Model
- [Fellrnr: Modeling Human Performance](https://fellrnr.com/wiki/Modeling_Human_Performance)
- [TrainingPeaks: Science of PMC](https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/)
- [TrainingPeaks: Coach Guide to ATL/CTL/TSB](https://www.trainingpeaks.com/coach-blog/a-coachs-guide-to-atl-ctl-tsb/)
- [PMC: Limitations of Banister Model](https://pmc.ncbi.nlm.nih.gov/articles/PMC1974899/)

### Daniels / VDOT
- [Daniels Cruise Intervals](http://www.k-b-c.com/daniels.htm)
- [VDOT Calculator](https://vdoto2.com/calculator)
- [Fellrnr: Jack Daniels](https://fellrnr.com/wiki/Jack_Daniels)

### Pacing & Goal Setting
- [Running Writings: Canova Marathon Book](https://runningwritings.com/2023/06/canova-marathon-book.html)
- [Running Writings: Percentage-Based Training](https://runningwritings.com/2023/12/percentage-based-training.html)
- [COROS: How to Determine Goal Pace](https://coros.com/stories/coros-coaches/c/How-to-Determine-Your-Goal-Pace-and-Incorporate-into-Training)
- [Laura Norris: Marathon Pace Chart](https://lauranorrisrunning.com/marathon-pace-chart/)

### Recovery & Lactate
- [PubMed: Lactate Clearance During Active Recovery](https://pubmed.ncbi.nlm.nih.gov/20544484/)
- [TrainingPeaks: Aerobic Decoupling](https://www.trainingpeaks.com/blog/aerobic-endurance-and-decoupling/)
