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
  | 'plan_adjustment';

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
    plan_adjustment: ['adjust', 'modify', 'change', 'swap', 'skip', 'reschedule', 'busy', 'travel']
  };

  const matches: KnowledgeTopic[] = [];
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => queryLower.includes(kw))) {
      matches.push(topic as KnowledgeTopic);
    }
  }
  return matches;
}
