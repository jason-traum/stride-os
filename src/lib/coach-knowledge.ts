// Deep coaching knowledge base - retrieved on demand to keep base prompt lean
// This enables legendary coaching depth without bloating every API call

export type KnowledgeTopic =
  | 'training_philosophies'
  | 'periodization'
  | 'workout_types'
  | 'pacing_zones'
  | 'race_specific'
  | 'nutrition_fueling'
  | 'recovery_adaptation'
  | 'injury_management'
  | 'mental_performance'
  | 'special_populations'
  | 'weather_conditions'
  | 'tapering'
  | 'plan_adjustment'
  // New advanced topics
  | 'race_prediction_reasoning'
  | 'advanced_pattern_analysis'
  | 'strength_training'
  | 'cross_training'
  | 'sleep_optimization'
  | 'race_execution'
  | 'running_form'
  | 'shoe_guidance'
  | 'heart_rate_training'
  | 'women_running'
  | 'ultra_trail'
  | 'doubles_training'
  | 'goal_setting'
  | 'workout_library';

export const COACHING_KNOWLEDGE: Record<KnowledgeTopic, string> = {
  training_philosophies: `## Training Philosophies (Elite-Level Knowledge)

**Arthur Lydiard (New Zealand):**
- Father of aerobic base training. Built champions through 100-mile weeks of easy running.
- "Miles make champions" — aerobic development takes months, not weeks.
- Hill circuits for strength without excessive impact.
- Long runs of 2+ hours even for 800m runners.
- Modern application: Build your engine first, then tune it.

**Jack Daniels (USA):**
- VDOT system: Equivalent performances across distances.
- Every workout has a physiological purpose—train the right system.
- E pace (easy): Aerobic development, recovery
- M pace (marathon): Glycogen depletion resistance, fat oxidation
- T pace (threshold): Lactate clearance, sustainable speed
- I pace (interval): VO2max stimulus, oxygen uptake
- R pace (repetition): Speed, economy, neuromuscular
- Don't run faster than the purpose requires—more stress isn't always better.

**Pete Pfitzinger (USA/NZ):**
- Nonlinear periodization with built-in recovery weeks.
- "18/55" and "18/70" are gold standards for marathoners.
- Two quality sessions + long run = minimum effective dose.
- Medium-long runs (MLRs) of 11-15 miles are the secret weapon.
- Lactate threshold work twice per week in peak phase.

**Keith & Kevin Hanson (USA):**
- Cumulative fatigue philosophy.
- Long runs capped at 16 miles—you don't need 22-milers if weekly volume is 55-60 miles.
- "The last 10 miles of your marathon should feel like the last 10 miles of your training week."
- SOS days (Something of Substance): quality work on pre-fatigued legs.

**Renato Canova (Italy):**
- Coached world champions (Moses Mosop, Abel Kirui).
- Specificity principle: As race approaches, extend the distance at goal pace.
- Progressive long runs finishing at marathon pace.
- The body remembers what it practices—practice your race pace, a lot.

**The Norwegian Model:**
- Lactate-guided threshold work: Stay at exactly 3-4 mmol.
- Double threshold days: Two sessions at LT to maximize time at threshold.
- Controlled intensity = same stimulus, less fatigue.
- Allows very high training loads (200km+ weeks for elite).

**The 80/20 Principle:**
- 80% easy (below LT1, conversational), 20% hard.
- Easy running builds the aerobic system without depleting it.
- The body can handle ~20% intensity without accumulating chronic fatigue.
- Common mistake: Running easy days at "moderate" pace (the "grey zone").
- Fix: Easy runs should feel almost too slow.`,

  periodization: `## Periodization Science

**Macrocycle (Season):**
- Base → Build → Peak → Taper → Race → Recovery
- Marathon: 16-20 weeks minimum, 24+ weeks optimal
- Half marathon: 12-16 weeks
- 5K/10K: 8-12 weeks (assumes existing aerobic base)

**Mesocycle (Training Block):**
- Typically 3-4 weeks
- Progressive overload followed by recovery week
- Example: Week 1 (70%), Week 2 (85%), Week 3 (100%), Week 4 (60% recovery)

**Microcycle (Training Week):**
- Standard pattern: Hard-Easy-Hard-Easy-Rest-Long-Easy
- Elite modification: Hard-Easy-Medium-Easy-Hard-Easy-Long
- Recovery week pattern: All easy except one maintenance quality session
- Never two hard days back-to-back for most runners

**Phase Characteristics:**

*Base Phase:*
- Focus: Aerobic development, injury prevention, consistency
- Volume: Building gradually (10% per week max)
- Intensity: Mostly easy + strides, introducing tempo late
- Key workouts: Long runs, easy volume

*Build Phase:*
- Focus: Race-specific fitness, lactate threshold
- Volume: Near peak, stabilizing
- Intensity: Two quality sessions per week
- Key workouts: Tempo, threshold intervals, marathon pace work

*Peak Phase:*
- Focus: Sharpening, race simulation
- Volume: Maintaining or slight reduction
- Intensity: Race-pace work, tune-up races
- Key workouts: Race-specific sessions, confidence builders

*Taper Phase:*
- Focus: Recovery while maintaining fitness
- Volume: Decreasing 20-40% per week
- Intensity: Short, sharp efforts to stay tuned
- Key: Trust the training, resist the urge to cram`,

  workout_types: `## Workout Types Deep Dive

**Easy Runs:**
- Purpose: Aerobic development, recovery, cumulative volume
- Pace: Conversational, 1-2 min slower than marathon pace
- RPE: 3-5
- The foundation of all training. Most flexible—shorten, move, or skip as needed.

**Long Runs:**
- Purpose: Aerobic endurance, fat oxidation, mental toughness
- Distance: 16-22 miles for marathon, 12-16 for half
- Pace: Easy to steady, can include progression finish
- The backbone of distance training. Missing one isn't fatal, but protect these.

**Medium-Long Runs (MLRs):**
- Purpose: High aerobic volume without crushing fatigue
- Distance: 11-15 miles, typically mid-week
- Why they work: Long enough to deplete glycogen, short enough to recover in 48 hours
- Pfitzinger's secret weapon for building from 50 to 70 mile weeks.

**Tempo Runs:**
- Purpose: Lactate threshold development
- Pace: "Comfortably hard" — sustainable for 60 min in a race
- Duration: 20-40 minutes continuous, or cruise intervals
- RPE: 6-8
- Crucial for race performance. Worth protecting in the schedule.

**Threshold Intervals:**
- Purpose: Same as tempo, with recovery allowing more total time at threshold
- Structure: 3-4 x 8-10 min at threshold with 2-3 min jog recovery
- Allows accumulating 30-40 min at threshold vs 20-25 continuous.

**VO2max Intervals:**
- Purpose: Maximum oxygen uptake, running economy
- Structure: 800m-1600m repeats at 5K pace or faster
- Recovery: Equal time or slightly less
- RPE: 7-9
- Can substitute fartlek or tempo if needed.

**Speed Work / Repetitions:**
- Purpose: Neuromuscular efficiency, leg speed, running economy
- Structure: 200-400m at mile pace or faster
- Full recovery between reps
- Used to sharpen, not build base fitness.

**Strides:**
- Purpose: Neuromuscular activation, form practice
- Structure: 4-6 x 20-30 seconds, building to fast (not sprint)
- Full recovery (walk back)
- Low stress, high value. Add to easy runs 2-3x per week.

**Progressive/Cut-Down Long Runs:**
- Purpose: Race simulation, running fast on tired legs
- Structure: Start easy, progressively faster, finish at marathon pace
- Example: 18 miles: 8 easy → 5 steady → 5 at marathon pace
- Builds confidence and teaches pacing.`,

  pacing_zones: `## Pacing & Zone Science

**Zone Definitions (Physiological):**

*Zone 1 - Recovery (50-60% HRmax, <LT1):*
- Blood lactate: <1.5 mmol
- Fuel: Almost entirely fat
- Feel: Effortless, could do all day
- Use: Active recovery, easy shakeouts

*Zone 2 - Easy/Aerobic (60-70% HRmax, LT1):*
- Blood lactate: 1.5-2.5 mmol
- Fuel: Primarily fat, some glycogen
- Feel: Conversational, comfortable
- Use: Most training volume, aerobic development
- This is where you should spend 80% of your time.

*Zone 3 - Steady/Marathon (70-80% HRmax, LT1-LT2):*
- Blood lactate: 2.5-4.0 mmol
- Feel: Comfortably hard, can speak sentences
- Use: Marathon pace work, steady state

*Zone 4 - Threshold/Tempo (80-88% HRmax, LT2):*
- Blood lactate: 3.5-5.0 mmol
- Feel: Uncomfortable but sustainable for 30-60 min
- Use: Tempo runs, cruise intervals

*Zone 5a - VO2max (88-95% HRmax):*
- Blood lactate: 5-8+ mmol
- Feel: Hard, can only speak words
- Use: 3-5 minute intervals, VO2max development

*Zone 5b - Anaerobic/Speed (95-100% HRmax):*
- Blood lactate: 8+ mmol
- Feel: Maximal, cannot speak
- Use: Short repeats (200-400m), kick development

**Pace-Effort Calibration:**

Pace is NOT effort. Adjust for conditions:

*Heat:*
- 60-70°F: Target pace
- 70-80°F: Add 10-20 sec/mile
- 80-85°F: Add 20-40 sec/mile
- 85-90°F: Add 40-60 sec/mile
- 90°F+: Run by feel, ignore pace entirely

*Altitude:*
- 4000ft: 3-5% slower
- 6000ft: 6-8% slower
- 8000ft: 10-12% slower
- 10000ft: 15%+ slower

*Terrain:*
- Rolling hills: 10-20 sec/mile slower overall
- Hilly trails: 30+ sec/mile slower
- Technical trail: Ignore pace, run by feel

*Wind:*
- 10+ mph headwind: 10-15 sec/mile slower
- 15+ mph headwind: 15-25 sec/mile slower

**THE GOLDEN RULE:** Run the EFFORT, not the pace. Your body's feedback overrules the watch.`,

  race_specific: `## Race-Specific Training

**Marathon (26.2 miles):**

*Primary demands:*
- Aerobic endurance (running for 3-5+ hours)
- Glycogen management (body stores ~2000 cal, marathon burns ~2600+)
- Fat oxidation (supplementing glycogen)
- Mental fortitude (miles 18-24 are psychological)

*Key workouts:*
- Long runs: 16-22 miles, building volume and time on feet
- Marathon pace runs: 8-14 miles at goal pace
- Progressive long runs: Start easy, finish at MP
- MLRs: High aerobic volume without extreme fatigue
- Tempo work: Lactate clearance for sustained pace

*Common mistakes:*
- Not enough easy running (the aerobic base IS the marathon)
- Long runs too fast (depletes glycogen, doesn't build fat oxidation)
- Not practicing fueling (rehearse race nutrition)
- Going out too fast (first 10K should feel TOO easy)

**Half Marathon (13.1 miles):**

*Primary demands:*
- Lactate threshold (race is essentially a 1+ hour tempo)
- Aerobic power (higher intensity than marathon)

*Key workouts:*
- Tempo runs: 20-40 min at HMP or slightly faster
- Cruise intervals: 3-4 x 8-10 min at threshold
- Long runs: 12-16 miles with HMP segments

*Race execution:*
- First 5K: Settle in, slightly conservative
- Middle 10K: Controlled discomfort, hold pace
- Final 5K: Dig deep, trust the training

**10K:**

*Primary demands:*
- VO2max (race is 30-50 min at ~90-95% VO2max)
- Lactate tolerance

*Key workouts:*
- VO2max intervals: 1000m-1600m at 5K-10K pace
- Long reps: 5-6 x 1 mile at 10K pace
- Race-specific: 3-4 x 2K at goal pace

**5K:**

*Primary demands:*
- VO2max (race is essentially VO2max effort)
- Speed and anaerobic capacity

*Key workouts:*
- Short intervals: 400m-800m at 5K pace or faster
- Longer intervals: 1000m-1600m at 5K pace
- Speed work: 200m at mile pace`,

  nutrition_fueling: `## Nutrition & Fueling

**Pre-Run Fueling:**

*Fasted running:*
- Best for: Easy runs under 60-75 minutes
- Benefit: Enhances fat oxidation adaptation
- Not for: Quality sessions, long runs

*Pre-workout eating:*
- 2-4 hours before: Full meal (carbs + moderate protein + low fat)
- 1-2 hours before: Light snack (easily digestible carbs)
- 30-60 min before: Simple carbs if needed (banana, gel)
- Avoid: High fiber, high fat, unfamiliar foods

**During-Run Fueling:**

*When to fuel:*
- Easy runs <75 min: Water only
- Runs 60-90 min: Optional—experiment for practice
- Runs 90+ min: Essential—start at 45-60 min mark

*Carb intake:*
- 30-60g/hour for 1-2.5 hour efforts
- Up to 90g/hour for 2.5+ hours (requires gut training)
- Mix glucose + fructose for better absorption (2:1 ratio)

*Race fueling:*
- Practice EVERYTHING in training
- Don't try anything new on race day
- Gel every 4-5 miles after first 4-6 miles
- Alternate water and sports drink at aid stations

**Post-Run Recovery:**

*The 30-minute window:*
- Not as critical as once thought, but still helpful
- 0.5-1g carbs per kg bodyweight + 20-30g protein

*Daily nutrition:*
- Carbs: 5-7g/kg for moderate training, 7-10g/kg for high volume
- Protein: 1.4-1.8g/kg for muscle repair
- Fat: 20-35% of calories
- Don't diet during peak training—fuel the work

**Carb Loading (Pre-Race):**

*Modern 3-day approach:*
- 3 days before: 8-10g carbs/kg bodyweight
- 2 days before: 8-10g carbs/kg
- Day before: 8-10g carbs/kg, low fiber
- Race morning: 2-4g carbs/kg, 2-3 hours before`,

  recovery_adaptation: `## Recovery & Adaptation Science

**The Supercompensation Principle:**
Training creates stress → body recovers → body adapts to handle more stress.
Adaptation only happens with adequate recovery. More training without recovery = overtraining, not fitness.

**Recovery Windows by Session Type:**
- Easy sessions: 24-48 hours
- Tempo/threshold: 48-72 hours
- VO2max intervals: 72+ hours (CNS fatigue)
- Long runs: 72-96 hours for full recovery

**When to Back Off (Not Push Through):**
- Heavy legs 2+ days in a row
- RPE elevated for the same pace
- Sleep < 6 hours
- High life stress (8+/10)
- Multiple "rough" verdicts in a week
- Resting HR elevated 5+ bpm

**When Cumulative Fatigue Works FOR You:**
- Hansons-style training uses controlled fatigue to simulate race conditions
- Tempo on tired legs teaches pacing discipline
- But overall volume must be sustainable

**Missed Training Science:**
- 1-2 days missed: No fitness impact. Continue the plan.
- 3-7 days missed: Resume where you left off. VO2max unchanged.
- 2+ weeks missed: ~5-7% VO2max loss. Absorb 50-75% of missed work over coming weeks.
- Key insight: Extra recovery often helps more than cramming missed workouts.

**Signs of Good Adaptation:**
- Same pace feels easier over weeks
- Heart rate lower at same effort
- Recovery between runs feels quicker
- "Great" runs becoming more frequent
- Easy pace without checking watch

**Down Weeks / Recovery Weeks:**
- Schedule every 3-4 weeks during base/build
- Cut total volume by 30-40%
- Keep one quality session at reduced intensity
- Long run at 60-70% of normal distance
- The point is REDUCED total stress, not redistributed`,

  injury_management: `## Injury Management

**Take all pain seriously.** When any pain is mentioned:

1. **Log it** using log_injury. This tracks the issue and applies restrictions.
2. **Ask smart questions**: Where exactly? When did it start? What makes it worse?
3. **Err on the side of caution.** Rest > running through pain.
4. **Suggest professional help** for persistent/severe issues.

**Injury Restrictions:**
- no_speed_work: No intervals or fast running
- no_hills: Avoid inclines (stresses Achilles, calves)
- no_long_runs: Cap at 8-10 miles
- easy_only: No quality sessions
- reduced_mileage: Cut volume 30-50%
- no_running: Cross-train only

**Common Running Injuries:**

*Shin Splints (Medial Tibial Stress Syndrome):*
- Cause: Too much too soon, poor footwear, hard surfaces
- Treatment: Reduce volume, ice, strengthen calves/tibialis
- Return: Gradual, pain-free running

*IT Band Syndrome:*
- Cause: Weak hips, overpronation, sudden mileage increase
- Treatment: Foam rolling, hip strengthening, reduce downhill
- Return: Address root cause, gradual return

*Plantar Fasciitis:*
- Cause: Tight calves, unsupportive footwear, high arches/flat feet
- Treatment: Stretching, rolling, night splint, supportive shoes
- Return: Morning pain as indicator

*Runner's Knee (Patellofemoral):*
- Cause: Weak quads/glutes, poor tracking
- Treatment: Strengthen VMO and glutes, reduce hills
- Return: Pain-free stairs first

*Achilles Tendinopathy:*
- Cause: Overuse, tight calves, sudden intensity increase
- Treatment: Eccentric heel drops, avoid hills, reduce speed work
- Return: Very gradual, this takes time

**Return-to-Running Protocol:**
- Clear the injury first (pain-free 5-7 days)
- Test with walk-jog, progress to easy running
- Avoid hills/speed until baseline established
- Address underlying cause (strength, flexibility, form)`,

  mental_performance: `## Mental Performance

**Building Mental Toughness:**

*Association vs. Dissociation:*
- Association: Focus inward (breathing, form, pace, sensations)
- Dissociation: Focus outward (music, scenery, daydreaming)
- Elite runners tend toward association during hard efforts
- Train the skill: Practice staying present during discomfort

*Mantras:*
- Short, personal, positive
- Examples: "Smooth and strong", "I trained for this", "One mile at a time"
- Most effective when rehearsed in training, not invented during race

*Chunking:*
- Breaking the race into smaller, manageable segments
- "Just get to the next mile marker"
- Marathon: 6 x 4.4 miles, or 4 x 6.5 miles, or "two half marathons"

**Race Day Mental Prep:**

*Visualization:*
- See yourself executing the race plan
- Include the hard parts (mile 20, the hill, fighting fatigue)
- Visualize overcoming challenges, not avoiding them

*Pre-race routine:*
- Same warmup as training (familiarity = calm)
- Arrive early, avoid rushing
- Trust the preparation

*During the race:*
- First third: Hold back, should feel easy
- Middle third: Find rhythm, lock in
- Final third: Race with what you have left

**Handling Adversity:**

*When things go wrong mid-race:*
- Reassess, don't panic
- Adjust pace to new reality
- Bad patches often pass—give it a mile
- A tough finish beats a DNF (usually)
- Live to race another day when truly necessary

**The Taper Crazies:**
- Feeling sluggish, antsy, doubting fitness is NORMAL
- You can't gain significant fitness in last 2 weeks
- But you can lose race readiness by training too hard
- Trust: The hay is in the barn`,

  special_populations: `## Special Populations

**Masters Runners (40+):**

*Key differences:*
- Recovery takes longer (72-96 hrs between hard efforts)
- VO2max declines ~1% per year after 30 (but trainable!)
- Muscle mass loss accelerates
- Connective tissue less resilient

*Training modifications:*
- More recovery days between quality sessions
- Strength training 2x/week is non-negotiable
- Longer warmups before fast running
- May need 4-week cycles instead of 3-week
- Can still PR into 50s and beyond with smart training

**Comeback Runners (After Break/Injury):**

*The Rule of 10%:* Increase weekly mileage by no more than 10%/week
*Exception:* Returning to previous level can progress faster to ~75% of previous volume, then slow down

*Return-to-running protocol:*
- Week 1-2: Easy running only, 30-50% of previous volume
- Week 3-4: Easy + strides
- Week 5-6: Reintroduce one quality session (shortened)
- Week 7+: Gradual return to normal structure

**Newer Runners (<2 years):**

*Building the base:*
- Aerobic development is priority #1
- Run-walk intervals are legitimate training
- Consistency > intensity (3x30min > 1x90min)
- Progress slowly to prevent injury

*When to add intensity:*
- After 6+ months of consistent easy running
- When running 30+ miles/week comfortably
- Strides first
- One quality session per week maximum initially

**High Mileage Runners (70+ mpw):**

- Recovery becomes even more critical
- Easy runs must be truly easy
- Doubles can be more effective than single long runs
- Monitor fatigue closely
- Nutrition and sleep are non-negotiable`,

  weather_conditions: `## Weather & Conditions

**Hot Weather Running:**

*Heat acclimatization:*
- Takes 10-14 days of heat exposure
- Run during hottest part of day (safely) to adapt
- Reduce pace, not effort
- Hydrate before, during, and after

*Pace adjustments:*
- 70-80°F: Add 10-20 sec/mile
- 80-85°F: Add 20-40 sec/mile
- 85-90°F: Add 40-60 sec/mile
- 90°F+: Run by feel, ignore pace

*Race day in heat:*
- Start slower than planned
- Increase fluid intake
- Ice/cold sponges when available
- Adjust goal time 2-5% slower

**Cold Weather Running:**

*Benefits:* Easier to regulate temp, often PR weather (35-50°F ideal)

*Tips:*
- Dress for 15-20°F warmer than actual temp
- Layers > single heavy layer
- Cover extremities (hands, ears, nose)
- Wind chill matters more than temp

**Altitude:**

*Pace adjustments:*
- 4000ft: 3-5% slower
- 6000ft: 6-8% slower
- 8000ft: 10-12% slower
- 10000ft: 15%+ slower

*Acclimatization:*
- First few runs feel worst
- Improves over 2-3 weeks
- Emphasize RPE over pace
- "Don't chase pace at altitude. The effort is what matters."

**Wind:**
- 10+ mph headwind: 10-15 sec/mile slower
- 15+ mph headwind: 15-25 sec/mile slower
- Tailwind helps less than headwind hurts
- Consider out-and-back routes

**Rain:**
- Usually fine to run in
- Adjust for slippery surfaces
- Avoid cotton (holds water)
- Watch for lightning`,

  tapering: `## Tapering Science

**Why Tapering Works:**
- Fitness is maintained for 2-3 weeks of reduced training
- Fatigue dissipates faster than fitness when training reduces
- The result: Peak performance as fatigue clears while fitness remains
- You can't gain significant fitness in the last 2 weeks, but you can lose race readiness by training too hard

**Marathon Taper (3 weeks):**

*Week -3 (Race week minus 3):*
- 80% of peak volume
- Maintain one quality session (shortened)
- Long run: 12-14 miles

*Week -2:*
- 60% volume
- Light quality work (strides, tempo miles)
- Long run: 8-10 miles

*Week -1:*
- 40% volume
- Very easy + strides
- Carb loading begins
- Longest run: 4-5 miles, 3-4 days out

*Race day:* Trust the hay is in the barn

**Half Marathon Taper (2 weeks):**

*Week -2:*
- 70% volume
- One abbreviated quality session
- Long run: 8-10 miles

*Week -1:*
- 50% volume
- Easy + strides only
- Longest run: 4-5 miles

**5K/10K Taper (7-10 days):**
- Reduce volume progressively
- Maintain intensity (short intervals, strides) to stay sharp
- Volume reduction is key, not intensity elimination

**The Taper Crazies:**
- Feeling sluggish, antsy, doubting fitness is NORMAL
- This is psychological, not physical
- Resist the urge to "test" fitness with a hard workout
- Trust the training you've done
- Extra sleep and good nutrition are your job now`,

  race_prediction_reasoning: `## Race Prediction: Multi-Factor Reasoning Framework

**VDOT is a starting point, not the answer.** Real predictions require synthesizing multiple signals.

### The Prediction Framework

**Layer 1: Baseline Fitness (VDOT-equivalent)**
- Recent race results (most reliable, weight by recency)
- Time trial performances
- Best workout efforts (tempo, interval sessions)
- Use get_performance_model for this baseline

**Layer 2: Training Quality Signals (adjust baseline ±2-5%)**

*Positive signals (faster prediction):*
- Hitting or exceeding workout paces consistently
- Long runs finishing strong (negative splits)
- Easy runs feeling genuinely easy at appropriate pace
- RPE trending down for same paces (fitness gains)
- High plan adherence (>85%)
- Consistent weekly volume over 8+ weeks

*Negative signals (slower prediction):*
- Struggling to hit workout paces
- Long runs falling apart in final miles
- Easy runs feeling hard (RPE 6+ for easy)
- RPE trending up for same paces (fatigue accumulation)
- Missed key workouts
- Inconsistent training (boom/bust pattern)

**Layer 3: Fatigue & Readiness (adjust ±1-3%)**

*Check via get_fatigue_indicators:*
- Recent sleep quality patterns
- Stress levels (work/life)
- Legs feel ratings
- Verdict patterns (multiple "rough" = concern)
- Acute:Chronic training load ratio

*Red flags:*
- A:C ratio > 1.3 (injury risk, performance dip)
- 3+ days of poor sleep in race week
- Elevated resting HR
- Persistent heavy legs

**Layer 4: Race-Day Conditions (adjust ±2-8%)**

*Weather adjustments:*
- Heat: +2-3% per 10°F above 55°F
- Humidity >70%: additional +1-2%
- Wind >10mph: +1-2% (course dependent)
- Cold (<35°F): usually neutral or slight benefit

*Course adjustments:*
- Elevation gain: +1% per 100ft/mile of climbing
- Net downhill: can be faster BUT eccentric damage
- Technical terrain: significant slowdown

**Layer 5: Taper Quality**

*Good taper signs:*
- Feeling antsy/restless (taper crazies = good sign)
- Legs feeling springy on easy runs
- Strides feeling smooth and fast
- Sleep improving

*Bad taper signs:*
- Feeling flat and sluggish
- Legs still heavy
- Signs of illness
- Poor sleep from anxiety

**Layer 6: Intangibles (qualitative assessment)**

*Experience factors:*
- First time at distance? Add 2-3% buffer
- Proven race executor? Trust the fitness
- History of going out too fast? Build in cushion
- Strong mental game? Can push through rough patches

*Motivation & stakes:*
- A-race with full focus? Can extract more
- B-race or tune-up? Expect 1-2% off peak
- External pressure? Can help or hurt

### Synthesis Process

1. **Start with baseline** from performance model
2. **Apply training quality adjustment** (biggest factor after baseline)
3. **Factor in fatigue/readiness** (especially final 2 weeks)
4. **Adjust for conditions** (race day specifics)
5. **Consider taper quality** (final fine-tuning)
6. **Weigh intangibles** (experience, mental game)

### Presenting Predictions

**Never give a single number.** Always provide:
- Target range (optimistic to conservative)
- Key assumptions
- What would need to go right for fast end
- What could push toward slower end
- Confidence level (low/medium/high)

**Example reasoning:**
"Based on your 1:42 half PR from October and your recent training, VDOT suggests 3:35-3:40 marathon potential. But let's look deeper:

Your tempo runs have been 5-10 sec/mile faster than prescribed - that's a positive signal (+1-2 min). Your long runs have been solid with strong finishes - another plus. However, your easy runs are creeping up in pace and RPE has been elevated this week - some fatigue there (-1 min buffer).

Race day is forecasted 62°F, overcast - nearly perfect conditions. Course has 400ft of gain - modest, maybe +1-2 min impact.

My prediction: **3:32-3:38** with 3:35 as the target.
- 3:32 if everything clicks, you nail nutrition, and execute pacing perfectly
- 3:38 if you hit some rough patches but manage them well
- Confidence: Medium-High (solid training, but first marathon so some uncertainty)"

### Common Prediction Mistakes

1. **Ignoring recent training quality** - VDOT from a race 6 months ago may not reflect current fitness
2. **Not accounting for fatigue** - Even with great fitness, accumulated fatigue blunts performance
3. **Underestimating conditions** - Heat especially is brutally underrated
4. **Overweighting one great workout** - One session isn't a trend
5. **Ignoring the athlete's history** - Past race execution patterns matter`,

  advanced_pattern_analysis: `## Advanced Pattern Analysis: Reading Between the Lines

**Your job is to see what the athlete can't.** Use data to surface insights.

### Pace-Effort Efficiency Tracking

**The core metric: Pace per unit of RPE**

Calculate for each run: Pace (sec/mi) ÷ RPE
- Lower number = more efficient
- Track this over time by workout type

*What to look for:*
- Efficiency improving over weeks = fitness gains
- Efficiency declining = fatigue accumulation or overtraining
- Sudden drop = illness, stress, or need for recovery

**Easy run efficiency is the canary in the coal mine:**
- If easy runs require higher RPE for same pace, something is off
- This often precedes injury or illness by 5-10 days
- Take it seriously

### Workout Execution Scoring

**For each quality session, assess:**

1. **Pace accuracy**: Did they hit target paces?
   - Within 5 sec/mi = excellent
   - 5-15 sec/mi off = acceptable
   - >15 sec/mi off = investigate why

2. **Consistency**: Even splits or erratic?
   - Negative splits on tempo = excellent control
   - Positive splits (slowing) = concerning if pattern
   - Wildly variable = pacing skill issue

3. **Recovery quality**: How did they feel after?
   - Tired but satisfied = appropriate stimulus
   - Destroyed = too hard
   - Too easy = undertrained

4. **RPE alignment**: Does RPE match the workout type?
   - Tempo at RPE 4 = too easy, not getting stimulus
   - Tempo at RPE 9 = too hard, not sustainable
   - Easy run at RPE 7 = running too fast

### Fatigue Pattern Recognition

**Weekly fatigue patterns:**
- Monday runs always rough → weekend recovery issue
- Friday runs always great → well-recovered for weekend
- Wednesday slump → mid-week fatigue accumulation

**Multi-week patterns:**
- Week 3 of every block = rough → need more recovery weeks
- Post-long-run days always bad → need more recovery time
- Quality sessions declining → cumulative overload

**Seasonal patterns:**
- Summer heat affecting all runs
- Winter motivation dips
- Spring improvement curves

### Training Load Analysis

**Acute:Chronic Workload Ratio (ACWR)**

- Acute = last 7 days
- Chronic = last 28 days (rolling average)
- Ratio = Acute ÷ Chronic

*Interpretation:*
- 0.8-1.3 = Sweet spot (safe, productive)
- 1.3-1.5 = Caution zone (elevated injury risk)
- >1.5 = Danger zone (high injury risk)
- <0.8 = Detraining (losing fitness)

**Load composition matters:**
- All easy miles vs. quality miles have different impact
- Weight quality sessions higher in load calculation
- Consider RPE-weighted load: Distance × RPE

### Long Run Quality Assessment

**The long run tells you a lot:**

*Positive indicators:*
- Even or negative splits
- RPE stable or decreasing
- Strong final 3-5 miles
- Recovery within 48-72 hours

*Warning signs:*
- Significant fade (>30 sec/mi slowdown)
- RPE spiking in final third
- Needing 4+ days to recover
- Dreading long runs

**Progressive long run benchmarks:**
- Can they run last 3-5 miles at marathon pace?
- How much does pace drop from start to finish?
- What's the RPE differential (start vs. end)?

### Connecting Patterns to Predictions

**Training patterns that predict race success:**
- Consistent weekly volume (low variance week-to-week)
- Progressive improvement in workout paces
- Long runs executed well
- Easy runs staying easy
- Quick recovery between sessions

**Training patterns that predict race struggles:**
- Boom/bust training (big weeks followed by crashes)
- Workout paces declining or stagnant
- Long runs falling apart
- Easy runs too fast
- Prolonged recovery between sessions

### How to Surface Insights

**Don't just report data. Interpret it:**

Bad: "Your average easy pace was 8:45 this week."
Good: "Your easy pace dropped from 9:00 to 8:45 over the last month while RPE stayed at 4-5. That's real aerobic development - your engine is getting stronger."

Bad: "Your tempo was 7:15 pace."
Good: "You ran that tempo at 7:15 - that's 10 sec/mile faster than your prescribed 7:25, and it felt like RPE 7. Your threshold is improving. We might need to update your training paces."

Bad: "You ran 45 miles this week."
Good: "Third week at 45 miles, and your RPE is trending down. Your body is adapting to this volume - we can think about building in a few weeks."`,

  strength_training: `## Strength Training for Runners

**Why it matters:**
- Reduces injury risk by 50%+ (research-backed)
- Improves running economy 2-8%
- Essential for masters runners (combats muscle loss)
- Builds power for hills and finishing kick

### The Runner's Strength Framework

**Frequency:** 2x per week (minimum 1x for maintenance)
**Timing:** Ideally after easy runs or on separate days, not before key workouts
**Duration:** 20-40 minutes is sufficient

### Key Movement Patterns

**1. Single-Leg Strength (most running-specific)**
- Bulgarian split squats
- Single-leg deadlifts
- Step-ups
- Single-leg squats (pistols if able)

*Why single-leg:* Running is a series of single-leg hops. Train the pattern.

**2. Hip Strength (injury prevention)**
- Clamshells
- Side-lying leg raises
- Monster walks (band)
- Hip thrusts / glute bridges

*Why hips:* Weak hips = IT band issues, knee problems, poor form

**3. Core Stability (not crunches)**
- Planks (front, side)
- Dead bugs
- Bird dogs
- Pallof press

*Why stability:* Running requires rotational stability, not flexion strength

**4. Posterior Chain (power and injury prevention)**
- Romanian deadlifts
- Good mornings
- Hip hinges
- Hamstring curls

*Why posterior:* Hamstrings and glutes drive your stride

### Sample Weekly Structure

**Session A (Strength focus):**
- Bulgarian split squats: 3x8 each leg
- Romanian deadlifts: 3x10
- Hip thrusts: 3x12
- Plank: 3x30-45 sec

**Session B (Power/stability focus):**
- Step-ups with drive: 3x8 each leg
- Single-leg deadlifts: 3x8 each leg
- Clamshells: 2x15 each side
- Dead bugs: 3x10 each side

### Periodization with Running

**Base phase:** Higher volume strength (3 sets, moderate weight)
**Build phase:** Moderate volume, increasing intensity
**Peak/race phase:** Maintenance only (1x/week, lighter)
**Taper:** Very light or none

### Common Mistakes

1. **Going too heavy:** This isn't powerlifting. Moderate weight, good form.
2. **Skipping single-leg work:** Bilateral exercises don't transfer as well.
3. **Neglecting hips:** The most common weakness in runners.
4. **Doing legs before key workouts:** Save it for easy days.
5. **Stopping during taper:** Light maintenance is fine and helpful.`,

  cross_training: `## Cross-Training for Runners

**When to cross-train:**
- Injury prevention (reduce impact load)
- Active recovery
- When injured (maintain fitness)
- Weather/conditions make running impractical
- Adding volume without more running stress

### Modalities Ranked by Running Specificity

**1. Pool Running (Aqua Jogging)** - Most specific
- Nearly identical muscle activation to running
- Zero impact
- Can do workouts (tempo, intervals) in pool
- 1:1 time replacement for running
- Downsides: Boring, requires pool access

**2. Elliptical** - High specificity
- Similar motion to running
- Low impact
- Can maintain intensity
- Good for injured runners
- ~85% carryover to running fitness

**3. Cycling** - Moderate specificity
- Great aerobic maintenance
- Very low impact
- Good for recovery days
- Less running-specific muscle activation
- ~70% carryover, need more time (1.5-2x)

**4. Swimming** - Lower specificity but valuable
- Full body, great recovery
- Zero impact
- Different muscle groups
- Good mental break
- ~50% carryover for running

**5. Rowing** - Moderate
- Good full-body conditioning
- Can be intense
- Different movement pattern
- ~60% carryover

### Cross-Training Guidelines

**For supplemental training (not replacing runs):**
- 1-2 sessions per week
- Easy to moderate intensity
- 30-45 minutes
- Focus on recovery, not building fitness

**For injury replacement:**
- Match the duration of the run you're replacing
- Match the intensity (easy, tempo, intervals)
- Pool running or elliptical preferred
- Maintain consistency

**For high mileage athletes:**
- Consider replacing one easy run with cross-training
- Reduces total impact load
- Allows higher overall training volume

### Sample Cross-Training Workouts

**Easy day replacement (45 min):**
- Bike: 45 min at conversational effort
- Pool: 40 min easy aqua jogging
- Elliptical: 40 min at RPE 4-5

**Tempo replacement (pool or elliptical):**
- 10 min easy warmup
- 20 min at tempo effort (RPE 7)
- 10 min easy cooldown

**Interval replacement (pool):**
- 10 min warmup
- 6x3 min hard / 2 min easy
- 10 min cooldown

### When NOT to Cross-Train

- If you're healthy and can run, run
- Cross-training doesn't fully replace running-specific adaptations
- Don't add cross-training on top of full running if you're already fatigued`,

  sleep_optimization: `## Sleep: The #1 Recovery Tool

**Sleep is when adaptation happens.** You don't get fitter during workouts - you get fitter during sleep.

### Why Sleep Matters for Runners

**During sleep:**
- Human growth hormone (HGH) peaks
- Muscle repair and protein synthesis occur
- Glycogen stores replenish
- Neural pathways consolidate motor learning
- Inflammation decreases

**Sleep deprivation effects:**
- Impaired glycogen restoration
- Elevated cortisol (stress hormone)
- Decreased reaction time and coordination
- Reduced pain tolerance
- Impaired immune function
- Increased injury risk

### How Much Sleep?

**General guidelines:**
- Most adults: 7-9 hours
- During heavy training: 8-10 hours
- After hard workouts: Extra 30-60 min helps

**Elite examples:**
- Many elites sleep 9-10 hours
- Naps are common (1-2 hours post-workout)
- Sleep is prioritized like training

### Sleep Quality Markers

**Good sleep indicators:**
- Fall asleep within 15-20 minutes
- Few or no wake-ups
- Feel rested upon waking
- Consistent wake time
- Dream recall (indicates REM)

**Poor sleep indicators:**
- Taking >30 min to fall asleep
- Multiple wake-ups
- Waking tired despite enough hours
- Irregular schedule
- No dream recall

### Sleep Optimization Strategies

**Environment:**
- Cool room (65-68°F ideal)
- Dark (blackout curtains or mask)
- Quiet (white noise if needed)
- Comfortable mattress and pillow

**Timing:**
- Consistent bed and wake times (±30 min)
- Avoid late hard workouts (<3 hours before bed)
- Limit caffeine after 2pm
- Reduce alcohol (disrupts REM)

**Pre-sleep routine:**
- Wind down 30-60 min before bed
- Reduce screen time (blue light blocks melatonin)
- Avoid large meals close to bed
- Light stretching or reading

**Post-workout considerations:**
- Hard evening workouts can disrupt sleep
- Allow 3+ hours between intense training and bed
- Cool shower can help transition
- Light carbs aid recovery and sleep

### Sleep and Training Adjustments

**If sleep-deprived:**
- Skip or reduce quality session
- Easy runs only
- Prioritize sleep over workout

**Before key workouts:**
- Aim for 7+ hours night before
- Two nights before matters too

**Before races:**
- Two nights before is most important
- Race-night sleep is often poor (normal)
- Taper helps compensate

### Napping for Runners

**When naps help:**
- Sleep debt from previous night
- Before evening workout
- During heavy training blocks

**Nap guidelines:**
- 20-30 min (avoid deep sleep)
- Or 90 min (full sleep cycle)
- Before 3pm to avoid night sleep issues

**Warning:** If you NEED naps daily, you're likely not sleeping enough at night.`,

  race_execution: `## Race Execution: Strategy and Tactics

**Training gets you to the start line. Execution gets you to the finish.**

### Pre-Race Preparation

**Race Week:**
- Trust the taper (no fitness tests)
- Lay out gear/nutrition days ahead
- Review course profile and aid stations
- Visualize race execution
- Stay off feet, reduce stress

**Night Before:**
- Familiar meal, not too large
- Lay out everything
- Set multiple alarms
- Accept you may not sleep well (it's okay)

**Race Morning:**
- Wake 3+ hours before start
- Eat familiar breakfast (2-3 hours before)
- Arrive early, find porta-potties
- Warmup: 10-15 min easy jog + strides (shorter races)
- Marathon: Light warmup only, save legs

### Pacing Strategy by Distance

**5K:**
- Start controlled (first 400m especially)
- Settle into rhythm by 1 mile
- Miles 2-2.5: Hold on, hurt is expected
- Final 400m: Everything you've got

**10K:**
- First mile: Slightly conservative
- Miles 2-4: Find rhythm, even effort
- Mile 5: Assess, prepare to push
- Mile 6: Gradually increase to finish

**Half Marathon:**
- First 2 miles: Easy, settling in
- Miles 3-10: Steady, metronomic
- Miles 11-12: If feeling good, begin push
- Mile 13+: Race to the finish

**Marathon:**
- Miles 1-6: Should feel TOO easy (this is critical)
- Miles 7-13: Comfortable, controlled
- Miles 14-20: This is where the race begins
- Miles 21-26: Survive, execute, dig deep

### The Cardinal Sin: Starting Too Fast

**Why it happens:**
- Fresh legs + adrenaline = feels easy
- Other runners going out fast
- Underestimating the distance

**Why it destroys races:**
- Early fast pace depletes glycogen faster
- Creates oxygen debt you can't repay
- Mental damage when you blow up

**How to prevent:**
- Know your goal splits
- Run first mile 5-10 sec SLOWER than goal
- Ignore other runners
- Trust the plan

### Managing Aid Stations

**Water/sports drink:**
- Grab from first or second table (less crowded)
- Pinch cup to drink while moving
- Walk briefly if needed (better than spilling)
- Alternate water and sports drink

**Nutrition (marathon):**
- Take gels at planned intervals
- Practice in training
- Take with water, not sports drink
- Don't experiment race day

### When Things Go Wrong

**Bad patch (temporary):**
- Give it a mile before reacting
- Check: Am I bonking or just hurting?
- Take a gel if in doubt
- Shorten focus: next aid station, next mile marker

**Actual bonk:**
- Take in calories immediately
- Slow down and let them absorb
- Reassess after 1-2 miles
- Adjust goal, finish the race

**GI distress:**
- Slow down, stop at porta-potty if needed
- Consider if it's worth pushing through
- Stop taking gels, use water only

**Injury during race:**
- Assess: Can I continue without permanent damage?
- Sometimes it's okay to push through discomfort
- Sometimes stopping is the right call
- Live to race another day

### Mental Tactics During the Race

**Chunking:**
- Break race into segments
- Focus only on current segment
- "Just get to the next mile marker"

**Mantras:**
- Have 2-3 prepared phrases
- Use when it gets hard
- "Smooth and strong", "I trained for this"

**Staying present:**
- Focus on form, breathing, effort
- Don't think about how far is left
- "Run the mile you're in"

**Using the crowd:**
- Feed off energy at aid stations
- Find spectators to run toward
- In quiet sections, go internal`,

  running_form: `## Running Form and Mechanics

**Good form = efficiency = faster with less effort**

### The Core Principles

**1. Run tall**
- Slight forward lean from ANKLES (not waist)
- Head balanced over shoulders
- Hips under shoulders
- Imagine a string pulling you from the crown of your head

**2. Relaxed upper body**
- Shoulders down, not hunched
- Arms bent at ~90 degrees
- Hands relaxed (imagine holding chips without crushing)
- Arms drive forward-back, not across body

**3. Efficient stride**
- Feet land under hips (not reaching forward)
- Quick ground contact
- Cadence typically 170-180+ steps/min
- Avoid overstriding (foot landing ahead of center of mass)

**4. Hip extension**
- Power comes from pushing off, not pulling forward
- Full hip extension behind you
- Strong glutes driving the stride

### Cadence

**What it is:** Steps per minute

**Why it matters:**
- Higher cadence usually means less overstriding
- Reduces impact forces
- More efficient energy return

**General guidelines:**
- Most recreational runners: 160-170
- Efficient runners: 170-180+
- Elite: Often 180-190+

**How to improve:**
- Increase gradually (5% at a time)
- Strides help train turnover
- Use a metronome app
- Don't force it - let it come naturally

### Footstrike

**The myth:** Forefoot striking is "correct"
**The reality:** It depends on the individual

**Types:**
- Heel strike: Most common, not inherently bad
- Midfoot: Generally efficient
- Forefoot: Common at faster paces

**What actually matters:**
- WHERE you land (under hips, not ahead)
- Not HOW your foot contacts ground

**Don't force a change.** Unless you have chronic injury related to footstrike, leave it alone.

### Common Form Faults

**1. Overstriding**
- Foot lands in front of body
- Creates braking force
- Fix: Increase cadence, focus on "pulling" foot back

**2. Hip drop (Trendelenburg)**
- Hips sag on one side during stance
- Often caused by weak glutes/hips
- Fix: Single-leg strength work, hip strengthening

**3. Excessive trunk rotation**
- Upper body twisting too much
- Wastes energy
- Fix: Core stability work, arm position

**4. Arm crossover**
- Arms swinging across centerline
- Creates rotation
- Fix: Think "elbow drive" back, hands at hip level

**5. Tension**
- Clenched fists, raised shoulders
- Wastes energy
- Fix: Periodic form checks, "relax" cue

### When to Work on Form

**Best times:**
- Strides (short bursts with focus)
- Fresh, at the start of easy runs
- Dedicated drill sessions

**Worst times:**
- When fatigued (form will break down anyway)
- During quality workouts (focus on workout, not form)
- Making wholesale changes before a race

### Drills for Form

**Basic drills (5-10 min, 2-3x/week):**

*A-skips:* High knees with skip
*B-skips:* A-skips with leg extension
*Butt kicks:* Focus on hamstring activation
*Carioca:* Lateral movement, hip mobility
*High knees:* Quick, light ground contact

**When to do drills:**
- After warmup, before strides
- Before quality sessions
- As part of strength/mobility routine`,

  shoe_guidance: `## Running Shoes: Selection and Rotation

### Building a Shoe Rotation

**Why rotate:**
- Different shoes stress different muscles/tissues
- Reduces repetitive strain
- Shoes recover between runs
- Extends lifespan of each shoe

**Ideal rotation (3-4 shoes):**
1. **Daily trainer** - Workhorse for most runs
2. **Easy day/recovery** - Extra cushion, comfort
3. **Workout shoe** - Lighter, more responsive
4. **Race shoe** - Super shoes for race day and key workouts

### Shoe Categories

**Daily Trainers:**
- Balanced cushion and response
- Durable
- 300-500 mile lifespan
- For: Most training runs
- Examples: Nike Pegasus, Brooks Ghost, Saucony Ride

**Max Cushion:**
- Extra soft, protective
- Often higher stack
- For: Easy days, recovery, high mileage
- Examples: Hoka Bondi, Brooks Glycerin, New Balance Fresh Foam

**Lightweight/Tempo:**
- Less cushion, more response
- Faster feel
- For: Workouts, tempo runs
- Examples: Nike Tempo, Saucony Kinvara, Adidas Boston

**Racing Flats (traditional):**
- Minimal cushion
- Very light
- For: 5K-10K races
- Being replaced by super shoes

**Super Shoes (carbon plate):**
- Carbon fiber plate + responsive foam
- Proven 2-4% efficiency gain
- For: Races, key workouts
- Higher price, 150-200 mile race lifespan
- Examples: Nike Vaporfly, Adidas Adios Pro, Saucony Endorphin Pro

### When to Retire Shoes

**Mileage guidelines:**
- Daily trainers: 300-500 miles
- Super shoes: 150-200 miles (for racing)
- Recovery shoes: 400-500 miles

**Signs it's time:**
- Midsole feels dead/flat
- Visible creasing in midsole
- Unusual aches after runs
- Outsole worn through to midsole
- Shoe feels "off"

**Track mileage:** Log which shoes for each run.

### Fitting Considerations

**Size:**
- Thumb width between toe and end
- Feet swell during runs
- Size up if between sizes
- Try shoes in afternoon (feet larger)

**Width:**
- Standard, wide, extra-wide available
- Common issue: Toe box too narrow
- Shouldn't feel pinching

**Stack height:**
- Personal preference
- Higher = more cushion, less ground feel
- Lower = more ground feel, less protection

**Drop (heel-toe offset):**
- Higher drop (8-12mm): More traditional feel
- Lower drop (0-6mm): More minimalist
- Don't change dramatically without transition

### Race Day Shoes

**Super shoes for racing:**
- Practice in them first
- At least 2-3 long runs
- One or two workouts
- Know how they fit at race pace

**Don't debut shoes race day.** Ever.

### Shoe Fitting for Injury Prevention

**If you're injury-prone:**
- Get gait analysis at specialty store
- Consider stability if you overpronate
- Don't chase trends - find what works

**If you have specific issues:**
- Plantar fasciitis: More cushion, arch support
- Achilles: Check drop, avoid zero-drop transition
- Knee pain: Consider cushion, check shoe wear pattern`,

  heart_rate_training: `## Heart Rate Training

**When HR helps and when it lies**

### The Value of Heart Rate

**What HR tells you:**
- Internal effort level
- Cardiac drift (fatigue indicator)
- Recovery status
- Environmental impact (heat, altitude)

**What pace tells you:**
- External output
- Speed over ground
- What you're actually running

**The insight:** HR + Pace together = Efficiency trend

### Heart Rate Zones

**Zone 1 (50-60% HRmax):** Recovery
- Very easy, walking pace
- Active recovery only

**Zone 2 (60-70% HRmax):** Aerobic/Easy
- Conversational
- Most training should be here
- "Easy" runs

**Zone 3 (70-80% HRmax):** Steady/Marathon
- "Comfortably hard"
- Marathon pace territory
- Limited time here in training

**Zone 4 (80-90% HRmax):** Threshold
- Tempo pace
- Lactate threshold work
- Sustainable for 30-60 min

**Zone 5 (90-100% HRmax):** VO2max/Anaerobic
- Hard intervals
- 5K pace and faster
- Not sustainable long

### Calculating Zones

**HRmax estimation:**
- 220 - age (very rough)
- Better: 208 - (0.7 × age)
- Best: Field test (hard effort, observed max)

**Heart Rate Reserve (Karvonen) method:**
- HRR = HRmax - HRrest
- Target HR = (% intensity × HRR) + HRrest
- More individualized than straight %HRmax

### When to Use Heart Rate

**Good uses:**
- Easy runs (stay in Zone 2)
- Hot/humid conditions (pace lies, HR tells truth)
- Altitude (pace slows, HR guides effort)
- Recovery monitoring (elevated morning HR = fatigue)
- Tracking cardiac drift on long runs

**Poor uses:**
- Intervals (HR lags behind effort)
- Short reps (HR never catches up)
- Racing (just run hard, ignore HR)
- Cold weather (HR suppressed)

### Cardiac Drift

**What it is:** HR rises over time at constant pace

**Why it happens:**
- Dehydration
- Glycogen depletion
- Core temperature rise
- Cardiovascular fatigue

**What it tells you:**
- Normal: 5-10% drift over 60-90 min
- Excessive: >15% drift signals fatigue/heat
- Useful for long run monitoring

**Decoupling (Pace:HR ratio):**
- Calculate pace/HR at start and end of run
- >5% decoupling = significant fatigue
- Track over time as fitness marker

### HR Variability (HRV)

**What it is:** Variation between heartbeats

**Why it matters:**
- Higher HRV = better recovered, more adaptable
- Lower HRV = stressed, fatigued

**How to use:**
- Measure first thing in morning
- Track trends (not single days)
- Below baseline = consider easy day
- Consistently low = back off training

### Common HR Training Mistakes

1. **Ignoring HR on easy days** - Running too fast
2. **Obsessing over HR during hard workouts** - Just run the effort
3. **Not accounting for conditions** - Heat/altitude affect HR
4. **Training to HR in all conditions** - Sometimes pace should guide
5. **Over-trusting zone calculators** - Test your actual zones`,

  women_running: `## Women's Running: Specific Considerations

### The Menstrual Cycle and Training

**Cycle Phases (typical 28 days):**

**1. Menstruation (Days 1-5)**
- Hormone levels low
- Energy may be lower
- Some women feel fine, others struggle
- Iron loss consideration

**2. Follicular Phase (Days 1-14)**
- Estrogen rising
- Often feel strongest
- Good time for hard workouts
- Body can handle more stress

**3. Ovulation (Around Day 14)**
- Estrogen peaks
- Many women feel best here
- Great for key workouts/races
- Slight injury risk increase (ligament laxity)

**4. Luteal Phase (Days 15-28)**
- Progesterone rises
- Core temp elevated
- May feel sluggish
- Higher perceived effort for same pace
- Good time for easy/steady work

**Key takeaways:**
- Track your cycle alongside training
- Notice YOUR patterns (everyone is different)
- Adjust expectations, not necessarily workouts
- Don't fight your body

### Training Adjustments by Phase

**During menstruation:**
- Listen to your body
- Easy runs fine, quality sessions if feeling good
- Extra iron-rich foods
- Some women PR during periods (everyone differs)

**Follicular phase:**
- Great time for hard efforts
- Body handles stress well
- Build volume, hit key workouts
- Strength training most effective

**Luteal phase:**
- May need longer warmups
- RPE often higher for same effort
- Consider more recovery
- Hydration more important
- Heat tolerance may be lower

### Iron and the Female Runner

**Why iron matters:**
- Essential for oxygen transport
- Runners lose iron through sweat, foot strike, GI
- Menstruation adds iron loss
- Female runners at high risk for deficiency

**Symptoms of low iron:**
- Unexplained fatigue
- Performance plateau
- High HR for effort
- Slow recovery
- Feeling "heavy"

**Prevention:**
- Iron-rich foods (red meat, spinach, legumes)
- Vitamin C with iron foods (aids absorption)
- Avoid coffee/tea with meals (blocks absorption)
- Consider testing ferritin levels annually

**Note:** Don't supplement iron without testing - excess is harmful.

### Bone Health

**The Female Athlete Triad:**
1. Low energy availability (underfueling)
2. Menstrual dysfunction
3. Low bone mineral density

**Red flags:**
- Missing periods or irregular cycles
- Stress fractures
- Chronic fatigue
- Feeling cold all the time

**Prevention:**
- Adequate fueling (don't undereat)
- Calcium and Vitamin D
- Strength training (bone loading)
- If periods stop, see a doctor

### Pregnancy and Running

**General guidelines (with doctor approval):**

**First trimester:**
- Continue as comfortable
- Fatigue is common
- Stay hydrated
- Avoid overheating

**Second trimester:**
- May feel better than first
- Adjust for growing belly
- Watch balance/coordination
- Supportive gear as needed

**Third trimester:**
- Discomfort increases
- Walking or cross-training may replace running
- Listen to body

**Post-partum:**
- Wait for clearance (typically 6 weeks)
- Return very gradually
- Core/pelvic floor work first
- Give yourself grace - body has changed

### Perimenopause and Menopause

**Changes to expect:**
- Hormonal fluctuations
- Sleep disruption
- Muscle mass harder to maintain
- Recovery may take longer
- Bone density concerns

**Training adjustments:**
- Strength training MORE important (2-3x/week)
- Protein needs increase (1.6-2.0 g/kg)
- Recovery becomes critical
- Intensity can still be high
- Many women thrive in masters racing

**Key message:** You can absolutely continue running hard. The body changes, training adapts.`,

  ultra_trail: `## Ultra and Trail Running

### What Changes Beyond the Marathon

**The ultra mindset:**
- Completion first, time second
- Manage the lows, they will pass
- Eat and drink constantly
- Walk the uphills (it's not cheating)
- This is a different sport than road running

### Training for Ultras

**Volume is king:**
- Build weekly mileage higher than marathon training
- Long runs of 4-6+ hours
- Back-to-back long runs (Saturday + Sunday)
- Time on feet matters more than pace

**Specificity:**
- Train on similar terrain
- Practice race nutrition
- Train in expected conditions
- Hiking/power hiking practice

**Sample week (50-miler build):**
- Monday: Rest or cross-train
- Tuesday: Easy 6-8 miles
- Wednesday: Steady 8-10 miles
- Thursday: Easy 6-8 miles
- Friday: Easy 4-6 miles
- Saturday: Long run 3-5 hours
- Sunday: Easy-moderate 10-15 miles

### Trail Running Specifics

**Technical terrain:**
- Eyes 10-15 feet ahead
- Quick, light steps
- Arms out for balance
- Ankle strength is crucial
- Accept slower pace

**Uphills:**
- Power hike when efficient (>15% grade usually)
- Hands on thighs if steep
- Keep effort consistent, not pace
- This is where races are won (efficiency)

**Downhills:**
- Lean slightly forward (into the hill)
- Quick cadence, soft landing
- Let gravity do work
- This is where races are lost (quad damage)

### Ultra Nutrition

**Calorie needs:**
- 200-300 calories per hour minimum
- Plan for more on longer ultras
- Mix of foods (not just gels)
- Practice EVERYTHING in training

**What works:**
- Real food: PB&J, potatoes, fruit
- Gels and chews
- Salty foods (pretzels, chips)
- Whatever sounds appealing mid-race

**Common issues:**
- GI distress (slow down, cool down, eat less)
- Nausea (sip ginger ale, eat salty)
- Taste fatigue (switch food types)

### Managing the Low Points

**They will come.** Every ultra has rough patches.

**Strategies:**
- Make it to the next aid station
- Eat something, drink something
- Walk for a bit
- Change something (music, layers, food)
- "The body is wrong" - push through if not injured

**When to actually stop:**
- Sharp pain that worsens with each step
- Signs of heat illness or hypothermia
- Confusion, disorientation
- "I don't want to" is not a reason

### Trail and Ultra Gear

**Essentials:**
- Hydration vest or pack
- Handheld water bottle
- Headlamp (any race > 8 hours)
- Layers for weather changes
- Nutrition storage
- Trekking poles (for some races)

**Trail shoes:**
- More aggressive tread
- Toe protection (rock plate)
- May size up (feet swell more)

### 100-Mile Specific

**Beyond the 50-miler:**
- Night running practice
- Crew and pacer logistics
- Sleep deprivation management
- Contingency planning
- 24-36 hours of forward motion`,

  doubles_training: `## Doubles: Running Twice a Day

### When Doubles Make Sense

**Good candidates:**
- Runners at 50+ miles/week
- Looking to add volume safely
- Have schedule flexibility
- Recover well from training

**Not ideal for:**
- New runners (<1 year)
- Injury-prone athletes
- Those with recovery limitations
- Runners under 40 miles/week

### The Benefits of Doubles

**More volume, less per-run stress:**
- Two 6-mile runs < one 12-mile run (for recovery)
- Allows higher weekly mileage
- Reduces injury risk at high volumes

**Enhanced recovery:**
- Second easy run can promote blood flow
- Loosens legs after hard morning session
- "Shakeout" effect

**Metabolic benefits:**
- Trains body to run on low glycogen (AM run before breakfast)
- Multiple metabolic spikes per day

### Types of Doubles

**Primary + Recovery:**
- Main workout in AM (or PM)
- Short, easy "shakeout" in other time
- Example: AM tempo + PM 4 miles easy

**Split volume:**
- Two moderate runs instead of one long
- Example: 6 AM + 6 PM instead of 12-miler
- Useful when time-constrained

**Quality + Quality (advanced):**
- Norwegian double threshold
- AM threshold + PM threshold
- Only for elite/highly trained

### How to Structure Doubles

**Starting doubles:**
- Add 20-30 min easy runs 2-3x/week
- Keep second run VERY easy
- Build gradually

**Sample double day:**
- AM: 8 miles easy before work
- PM: 4 miles very easy (recovery pace)
- Total: 12 miles with less stress than single 12

**Sample week with doubles (70 miles):**
- Monday: AM 6 + PM 4
- Tuesday: AM 10 (with tempo)
- Wednesday: AM 6 + PM 4
- Thursday: AM 8 easy
- Friday: AM 4 + PM 4
- Saturday: 16-mile long run
- Sunday: 8 easy

### Guidelines for Effective Doubles

**Spacing:**
- 6+ hours between runs ideal
- Minimum 4 hours for adaptation
- Classic: AM before work, PM after work

**Intensity:**
- At most ONE run per day is quality
- Second run is always easy/recovery
- Exception: Elite athletes with double threshold

**Nutrition:**
- Fuel between runs
- Post-run nutrition after AM critical
- Don't run PM fasted after AM run

**Recovery:**
- If you're struggling with doubles, you're not ready
- Sleep needs increase
- Easier to overtrain with doubles

### Common Mistakes

1. **Second run too hard** - It's for recovery, not training
2. **Adding too much too fast** - Build double days gradually
3. **Neglecting nutrition** - Two runs = two recovery windows
4. **Doing doubles before ready** - Build single-run volume first
5. **Every day doubles** - Start with 2-3 per week max`,

  goal_setting: `## Goal Setting: Beyond VDOT Tables

### The Art and Science of Goal Setting

**Goals serve multiple purposes:**
- Provide direction for training
- Create motivation and focus
- Enable appropriate pacing
- Measure progress

**But goals must be grounded in reality** - not fantasy.

### Sources of Goal Predictions

**1. Recent Race Results (most reliable)**
- Same distance: Most direct predictor
- Different distance: Use equivalency (not just VDOT)
- Account for conditions, course, effort level
- Weight by recency (3-6 months most relevant)

**2. Time Trial Data**
- Controlled effort at race intensity
- 3K, 5K, 10K TT useful for longer races
- Should be all-out effort for validity

**3. Workout Indicators**
- Tempo run paces and effort level
- Long run finishing paces
- Interval session quality
- Best used to confirm, not set goals

**4. Training Progression**
- How much have you improved since last race?
- Volume and consistency patterns
- Workout trajectory

**5. Intangibles**
- Race experience
- Mental strength
- First time at distance discount
- Course and conditions

### Setting Realistic Goals

**The A/B/C Framework:**

**A Goal (Dream):**
- Everything goes perfectly
- Optimal conditions
- Perfect execution
- 5-10% chance of hitting it

**B Goal (Target):**
- What you're genuinely training for
- Accounts for some race-day variables
- 50% chance if you execute well

**C Goal (Baseline):**
- Minimum acceptable performance
- Accounts for bad day / tough conditions
- 90% chance of hitting it

**Example for 1:45 half marathoner:**
- A Goal: 1:39 (PR by 6 min, everything perfect)
- B Goal: 1:42 (PR by 3 min, solid race)
- C Goal: 1:45 (match PR, get the job done)

### Goal Adjustment Factors

**Training since last race:**
- Significant volume increase: +2-4%
- More quality work: +1-3%
- Inconsistent training: -2-4%
- Time off/injury: Case-by-case

**Conditions:**
- Perfect conditions: Use standard prediction
- Hot race: -2-5%
- Hilly course: -2-5%
- Altitude: -3-8%

**Race experience:**
- First time at distance: -3-5%
- Known strong racer: Use performance data
- History of going out too fast: Build in buffer

**Taper and readiness:**
- Perfect taper: Confidence in goal
- Compromised taper: Back off goal
- Coming in tired: Realistic adjustment

### Marathon-Specific Goal Setting

**Why the marathon is different:**
- Can't directly predict from shorter races
- Fueling becomes variable
- Mental game matters more
- More ways for things to go wrong

**Conservative approach:**
- First marathon: Add 10-15 min to prediction
- Focus on finishing, learn the distance
- You can always race aggressively next time

**Equivalency adjustments:**
- Half marathon × 2 + 10-20 min (conservative)
- VDOT prediction - 3-5 min (first-timer buffer)
- Training quality adjustments apply

### When to Adjust Goals

**Upgrade goals when:**
- Workouts consistently exceeding expectations
- Breakthrough race or time trial
- Feeling exceptional in training

**Downgrade goals when:**
- Struggling in key workouts
- Fatigue indicators present
- Training disruptions occurred
- Conditions are adverse

**Goal setting isn't a one-time event.** Revisit as you get closer to race day.

### Presenting Goals to Athletes

**Be honest but not limiting:**
- Share the range (A/B/C)
- Explain the assumptions
- Identify what would enable fast end
- Identify what could push to slow end
- Let them own the final decision

**The goal should excite, not terrify.** If they're anxious about hitting it, it might be too aggressive.`,

  workout_library: `## Workout Library: Specific Sessions and Prescriptions

### Easy Run Variations

**Standard Easy:**
- Pace: 1:00-1:30 slower than marathon pace
- RPE: 3-5
- Duration: 30-60 min
- Purpose: Aerobic development, recovery

**Recovery Run:**
- Pace: Very slow, shuffle is fine
- RPE: 2-3
- Duration: 20-40 min
- Purpose: Active recovery, blood flow

**Easy + Strides:**
- Easy run with 4-6 × 20-30 sec strides
- Strides at fast (not sprint) pace
- Full recovery between strides
- Purpose: Neuromuscular maintenance

### Long Run Variations

**Standard Long:**
- Pace: Easy throughout
- Duration: 90-150 min (depends on race)
- Purpose: Time on feet, aerobic base

**Progressive Long:**
- Start easy, get faster each third
- Example: 16 miles: 6 easy → 5 steady → 5 marathon pace
- Purpose: Race simulation, finishing strong

**Long with Fast Finish:**
- Easy for most of run
- Final 3-5 miles at marathon or tempo pace
- Purpose: Running fast on tired legs

**Long with Segments:**
- Insert tempo or marathon pace miles mid-run
- Example: 18 miles with miles 8-12 at marathon pace
- Purpose: Specificity without starting fast

### Tempo Workouts

**Continuous Tempo:**
- 20-40 min at threshold pace (comfortably hard)
- RPE: 6-7
- Example: 2 mile WU, 30 min tempo, 2 mile CD
- Purpose: Lactate threshold development

**Cruise Intervals:**
- Break tempo into segments with short rest
- Example: 4 × 8 min at tempo with 2 min jog
- Purpose: More time at threshold, recoverable

**Tempo Progression:**
- Start at marathon pace, progress to threshold
- Example: 3 miles MP → 2 miles tempo → 1 mile faster
- Purpose: Pacing practice, strength endurance

### Threshold Workouts

**Classic 2 × 2 miles:**
- 2 × 2 miles at threshold with 3 min recovery
- Purpose: Solid threshold stimulus

**Threshold Ladder:**
- 1 mile - 2 mile - 1 mile at threshold
- 2-3 min recovery between
- Purpose: Mental and physical variation

**Norwegian Double Threshold (advanced):**
- AM: 25-30 min at threshold
- PM: 20-25 min at threshold
- Purpose: Maximize time at LT, elite protocol

### VO2max Workouts

**Classic 5 × 1000m:**
- 5 × 1000m at 5K pace or slightly faster
- 3 min jog recovery
- Purpose: VO2max development

**3-4 × 1 mile:**
- 3-4 × 1 mile at 5K-10K pace
- 3-4 min jog recovery
- Purpose: Extended VO2max, mental toughness

**1200m repeats:**
- 4-5 × 1200m at 5K pace
- 2-3 min recovery
- Purpose: Sweet spot between 1000s and miles

**Ladder workout:**
- 1200-1000-800-600-400 at increasing intensity
- Recovery = half the rep time
- Purpose: Different gears, mental engagement

### Speed Workouts

**200m repeats:**
- 8-12 × 200m at mile pace or faster
- 200m jog recovery
- Purpose: Leg speed, neuromuscular

**400m repeats:**
- 8-10 × 400m at 1-mile to 3K pace
- 400m jog recovery
- Purpose: Speed endurance

**150s (fly-ins):**
- 50m build + 50m fast + 50m float
- 8-10 reps
- Purpose: Acceleration, form at speed

### Fartlek Workouts

**Classic Fartlek:**
- Unstructured fast/slow based on feel
- 30-45 min total
- Purpose: Effort variation, mental freedom

**Mona Fartlek:**
- 2 × (90 sec on, 90 sec off, 60 on, 60 off, 30 on, 30 off)
- 5 min recovery between sets
- Purpose: Rhythm changes

**Kenyan Fartlek:**
- 1 min hard, 1 min easy × 20
- Purpose: Volume at intensity

### Hill Workouts

**Short Hill Sprints:**
- 8-10 × 10-15 sec steep hill, fast
- Walk down recovery
- Purpose: Power, strength

**Hill Repeats:**
- 6-8 × 60-90 sec at 5K effort on moderate grade
- Jog down recovery
- Purpose: Strength endurance

**Long Hill Tempo:**
- 15-20 min tempo on gradual climb
- Purpose: Strength + threshold

### Race-Specific Workouts

**Marathon Pace Runs:**
- 8-14 miles at goal marathon pace
- Often mid-week
- Purpose: Pace feel, glycogen depletion practice

**Half Marathon Pace Intervals:**
- 3-4 × 2 miles at HMP with 3 min rest
- Purpose: Goal pace familiarity

**Race Simulation:**
- Mimic race distances/paces in training
- Example: 3 × 2 mile at 10K pace (6 miles of quality)
- Purpose: Confidence builder`,

  plan_adjustment: `## Plan Adjustment Strategies

**Tools Available:**
- get_week_workouts: See the week's plan with workout IDs
- swap_workouts: Exchange dates of two workouts
- reschedule_workout: Move a workout to a different date
- skip_workout: Skip a single workout
- adjust_workout_distance: Make a workout shorter/longer
- convert_to_easy: Turn a quality session into an easy run
- make_down_week: Convert entire week to recovery
- insert_rest_day: Add a rest day

**Workout Priority Hierarchy (cut in this order):**
1. Easy runs - Most flexible
2. Second quality session - One quality + long run is minimum dose
3. Long run distance - Shorten before skip
4. Primary quality session - Try to preserve or substitute
5. Long run itself - Move, shorten, but try not to skip

**Common Scenarios:**

*"This week is crazy at work"*
→ make_down_week (convert to recovery week)

*"I need tomorrow off"*
→ insert_rest_day or skip_workout

*"Move my tempo to Thursday"*
→ reschedule_workout

*"Make tomorrow's run shorter"*
→ adjust_workout_distance

*"Can't do intervals, feeling tired"*
→ convert_to_easy (preserve run, remove intensity)

**Substitution Options:**
- Can't do track intervals? → Fartlek on road
- Can't do long tempo? → Cruise intervals
- Can't do full long run? → Shorter + easy double later
- Can't run at all? → Cross-training (bike, pool, elliptical)
- Only have 30 min? → Easy + strides

**Recovery Rules When Rearranging:**
- 48 hours between hard efforts is ideal
- Easy day before key workout helps freshness
- Easy day after hard workout aids recovery
- If stacking hard days, put more important one first

**Serious Life Events:**
- Lead with empathy, not logistics
- Training can wait. Wellbeing matters more.
- Offer to pause the plan or make week flexible
- Don't push. Support, then let them lead.`
};

// Get coaching knowledge for a specific topic
export function getCoachingKnowledge(topic: KnowledgeTopic): string {
  return COACHING_KNOWLEDGE[topic] || `Unknown topic: ${topic}`;
}

// Get all available topics
export function getAvailableTopics(): KnowledgeTopic[] {
  return Object.keys(COACHING_KNOWLEDGE) as KnowledgeTopic[];
}

// Search for relevant topics based on keywords
export function findRelevantTopics(query: string): KnowledgeTopic[] {
  const queryLower = query.toLowerCase();
  const topicKeywords: Record<KnowledgeTopic, string[]> = {
    training_philosophies: ['lydiard', 'daniels', 'pfitzinger', 'hanson', 'canova', 'norwegian', '80/20', 'philosophy', 'method'],
    periodization: ['periodization', 'base', 'build', 'peak', 'phase', 'macrocycle', 'mesocycle', 'block'],
    workout_types: ['tempo', 'interval', 'long run', 'easy run', 'threshold', 'vo2max', 'mlr', 'medium-long', 'fartlek', 'strides'],
    pacing_zones: ['zone', 'pace', 'hr', 'heart rate', 'lactate', 'threshold', 'effort'],
    race_specific: ['marathon', 'half marathon', '10k', '5k', 'race', 'racing'],
    nutrition_fueling: ['nutrition', 'fuel', 'eat', 'carb', 'protein', 'hydration', 'gel', 'loading'],
    recovery_adaptation: ['recovery', 'rest', 'adaptation', 'overtraining', 'fatigue', 'tired', 'supercompensation'],
    injury_management: ['injury', 'pain', 'hurt', 'shin', 'knee', 'achilles', 'plantar', 'it band'],
    mental_performance: ['mental', 'psychology', 'nervous', 'anxiety', 'confidence', 'mantra', 'visualization'],
    special_populations: ['masters', 'older', 'beginner', 'new runner', 'comeback', 'returning'],
    weather_conditions: ['hot', 'cold', 'heat', 'altitude', 'wind', 'rain', 'weather', 'humid'],
    tapering: ['taper', 'race week', 'before race', 'peak'],
    plan_adjustment: ['adjust', 'modify', 'change', 'swap', 'skip', 'reschedule', 'busy', 'travel'],
    // New advanced topics
    race_prediction_reasoning: ['predict', 'prediction', 'goal time', 'what time', 'how fast', 'pr', 'personal record', 'target', 'estimate'],
    advanced_pattern_analysis: ['pattern', 'trend', 'analysis', 'insight', 'efficiency', 'drift', 'decoupling'],
    strength_training: ['strength', 'weights', 'gym', 'squat', 'deadlift', 'core', 'glute', 'hip'],
    cross_training: ['cross train', 'bike', 'swim', 'pool', 'elliptical', 'aqua jog', 'cycling'],
    sleep_optimization: ['sleep', 'tired', 'rest', 'nap', 'insomnia', 'recovery'],
    race_execution: ['race day', 'race strategy', 'pacing strategy', 'aid station', 'bonk', 'wall', 'execute'],
    running_form: ['form', 'cadence', 'stride', 'footstrike', 'posture', 'mechanics', 'gait', 'overstride'],
    shoe_guidance: ['shoe', 'shoes', 'footwear', 'super shoe', 'carbon', 'rotation', 'retire'],
    heart_rate_training: ['heart rate', 'hr training', 'hrv', 'cardiac', 'drift'],
    women_running: ['menstrual', 'period', 'cycle', 'pregnancy', 'pregnant', 'menopause', 'female', 'women', 'iron'],
    ultra_trail: ['ultra', 'trail', '50k', '50 mile', '100 mile', 'ultramarathon', 'elevation', 'technical'],
    doubles_training: ['doubles', 'twice a day', 'two a day', 'double', 'am pm'],
    goal_setting: ['goal', 'target time', 'a race', 'b race', 'realistic', 'aggressive'],
    workout_library: ['workout', 'session', 'prescription', 'specific workout', 'what workout', 'example workout']
  };

  const matches: KnowledgeTopic[] = [];
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => queryLower.includes(kw))) {
      matches.push(topic as KnowledgeTopic);
    }
  }
  return matches;
}
