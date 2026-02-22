# Dreamy Achievement System Expansion Plan

## Research-Backed Design Philosophy

### Tier/Rarity System (Inspired by Gaming Achievement Design)

Based on research into Steam, Xbox, Peloton, and Garmin achievement systems:

| Tier | Name | Color | % of Users Who Earn | Point Value | Design Intent |
|------|------|-------|---------------------|-------------|---------------|
| **Common** | Bronze | Amber/copper | 60-80% | 1 pt | Onboarding, early wins, dopamine hook |
| **Uncommon** | Silver | Cool gray | 25-50% | 2 pts | Intermediate milestones, sustained effort |
| **Rare** | Gold | Yellow/gold | 5-20% | 4 pts | Serious dedication, impressive feats |
| **Epic** | Diamond | Cyan/ice blue | 1-5% | 8 pts | Elite or extreme accomplishments |
| **Legendary** | Obsidian | Deep purple/black | <1% | 16 pts | Once-in-a-lifetime, flex-worthy, "did you really?" |

**Key Principle from Research**: Achievements should focus on *progress communication* ("You ran your fastest 5K ever") not *gamification communication* ("You earned a gold badge"). The former drives intrinsic motivation; the latter causes the [overjustification effect](https://www.psychologyofgames.com/2016/10/the-overjustification-effect-and-game-achievements/).

### What Makes Achievements Shareable (from Strava/Peloton Analysis)
1. **Specificity** - "Sub-25 5K" beats "Fast Runner"
2. **Story** - The name should evoke a narrative or emotion
3. **Rarity signal** - Show what % of Dreamy users have earned it
4. **Visual appeal** - Custom badge art, not just an emoji
5. **Surprise factor** - Hidden achievements that pop up unexpectedly are the most shared

### Data Signals Available for Computation

From the Dreamy schema (`src/lib/schema.ts`), we can compute achievements from:
- **Distance**: `distanceMiles`, cumulative mileage, single-run distances
- **Pace**: `avgPaceSeconds`, negative splits via `workoutSegments`
- **Heart Rate**: `avgHr`, `maxHr`, `avgHeartRate`, zone distributions
- **Elevation**: `elevationGainFt`, `elevationGainFeet`
- **Weather**: `weatherTempF`, `weatherFeelsLikeF`, `weatherConditions` (clear/cloudy/fog/drizzle/rain/snow/thunderstorm), `weatherWindMph`, `weatherHumidityPct`
- **Time of Day**: `startTimeLocal` (HH:MM format)
- **Workout Type**: recovery/easy/steady/marathon/tempo/threshold/interval/repetition/long/race
- **Zone Data**: `zoneDistribution` (JSON: recovery/easy/tempo/etc.), `zoneDominant`
- **Training Load**: `trimp`, `intervalAdjustedTrimp`, `executionScore`
- **VDOT/Fitness**: `vdot` on profile, `vdotHistory` table, `bestSegmentVdot`
- **Cadence**: `stravaAverageCadence`
- **RPE/Feel**: `rpe` (1-10), `legsFeel`, `breathingFeel`, `verdict`
- **Dates**: `date` (ISO), day of week, month, year, holidays
- **Routes**: `routeId`, `routeFingerprint`, lat/lng coordinates
- **Strava Social**: `stravaKudosCount`, `stravaCommentCount`
- **Segments**: `workoutSegments` with per-split pace, HR, zone classification
- **Best Efforts**: `stravaBestEfforts` with PR ranks at standard distances
- **Shoes**: `shoeId`, shoe mileage, shoe rotation
- **Streams**: raw HR/pace/cadence/altitude arrays for deep analysis

---

## CATEGORY 1: MILEAGE MILESTONES (Cumulative Distance)

### Existing (5 achievements)
- First Steps, Centurion (100mi), Road Warrior (500mi), Thousand Miler (1000mi), Legend (2000mi)

### New Achievements

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 1 | `miles_26` | **Forrest Gump** | "I just felt like running." Run your first 26.2 cumulative miles. | cumulative miles >= 26.2 | Bronze | Yes - iconic reference |
| 2 | `miles_50` | **Fifty Nifty** | Run 50 cumulative miles | cumulative >= 50 | Bronze | Moderate |
| 3 | `miles_250` | **Quarter Thousand** | Run 250 cumulative miles | cumulative >= 250 | Silver | Moderate |
| 4 | `miles_750` | **Three Quarters** | Run 750 cumulative miles | cumulative >= 750 | Silver | Moderate |
| 5 | `miles_1500` | **Fifteen Hundred Club** | Run 1,500 cumulative miles | cumulative >= 1500 | Gold | Yes |
| 6 | `miles_3000` | **Coast to Coast** | Run the distance from NYC to LA (2,800 mi, rounded to 3,000) | cumulative >= 3000 | Diamond | Very - great share card |
| 7 | `miles_5000` | **Transcontinental** | Run 5,000 total miles | cumulative >= 5000 | Diamond | Very |
| 8 | `miles_10000` | **Around the World** | Run 10,000 total miles (NYC to Sydney, roughly) | cumulative >= 10000 | Legendary | Absolutely |
| 9 | `miles_moon` | **To the Moon** | Run the distance to the Moon (238,855 mi). Hidden achievement for lulz. | cumulative >= 238855 | Legendary | Meme-worthy |
| 10 | `miles_yearly_1000` | **Thousand Mile Year** | Run 1,000 miles in a single calendar year | 1000mi in Jan 1 - Dec 31 | Gold | Very - year-end flex |
| 11 | `miles_yearly_2000` | **Two Thousand Mile Year** | Run 2,000 miles in a single calendar year | 2000mi in a year | Diamond | Elite flex |
| 12 | `miles_monthly_100` | **Hundo Month** | Run 100 miles in a single calendar month | 100mi in one month | Silver | Yes |
| 13 | `miles_monthly_200` | **Double Hundo Month** | Run 200 miles in a single calendar month | 200mi in one month | Gold | Very |
| 14 | `miles_weekly_40` | **Forty Mile Week** | Hit 40 miles in a single week | weekly sum >= 40 | Silver | Yes |
| 15 | `miles_weekly_50` | **Nifty Fifty Week** | Hit 50 miles in a single week | weekly sum >= 50 | Gold | Yes |
| 16 | `miles_weekly_60` | **Sixty and Sexy** | Hit 60 miles in a single week | weekly sum >= 60 | Gold | Yes - cheeky name |
| 17 | `miles_weekly_70` | **Seventy and Thriving** | Hit 70 miles in a single week | weekly sum >= 70 | Diamond | Very |
| 18 | `miles_weekly_100` | **The Hundred Mile Week** | Hit 100 miles in a single week. You absolute legend. | weekly sum >= 100 | Legendary | Extremely |

---

## CATEGORY 2: STREAK & CONSISTENCY

### Existing (3 achievements)
- Week Warrior (7 days), Iron Will (30 days), Unstoppable (100 days)

### New Achievements

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 19 | `streak_3` | **Hat Trick** | Run 3 days in a row | streak >= 3 | Bronze | Moderate |
| 20 | `streak_14` | **Fortnight Fury** | Run 14 days in a row | streak >= 14 | Silver | Yes |
| 21 | `streak_50` | **Half Century Streak** | Run 50 days in a row | streak >= 50 | Gold | Very |
| 22 | `streak_200` | **Relentless** | Run 200 days in a row | streak >= 200 | Diamond | Very |
| 23 | `streak_365` | **The Ron Hill** | Run every single day for a year. Named for the legend who ran 52 years straight. | streak >= 365 | Legendary | Extremely |
| 24 | `weekly_streak_4` | **Month of Mondays** | Run at least once every week for 4 consecutive weeks | 4 consecutive weeks with >= 1 run | Bronze | Moderate |
| 25 | `weekly_streak_12` | **Quarter Pounder** | Run at least once every week for 12 consecutive weeks | 12 weeks | Silver | Yes |
| 26 | `weekly_streak_26` | **Half Year Hero** | Run at least once every week for 26 consecutive weeks | 26 weeks | Gold | Yes |
| 27 | `weekly_streak_52` | **Full Year, Full Send** | Run at least once every week for 52 consecutive weeks | 52 weeks | Diamond | Very |
| 28 | `perfect_week_3` | **Consistency is Key** | Log runs on 3+ different days in a week, repeated 4 weeks straight | 4 weeks of 3+ run days | Silver | Yes |
| 29 | `perfect_week_5` | **Five Alive** | Log runs on 5+ different days in a week | single week with 5+ run days | Silver | Yes |
| 30 | `perfect_week_7` | **No Rest for the Wicked** | Run all 7 days in a single week | all 7 days have a run | Gold | Very |
| 31 | `monthly_runner_6` | **Half Year Habit** | Run in every month for 6 consecutive months | 6 months each with >= 1 run | Silver | Moderate |
| 32 | `monthly_runner_12` | **Year-Round Runner** | Run in every month for 12 consecutive months | 12 months | Gold | Yes |
| 33 | `comeback_kid` | **Comeback Kid** | Return to running after a 30+ day gap | gap >= 30 days then a run | Bronze | Very - relatable story |
| 34 | `comeback_strong` | **The Return of the King** | Return from a 60+ day gap and run your first 10+ miler within 90 days | gap >= 60 days, then 10mi within 90 days of return | Gold | Very |
| 35 | `back_to_back_long` | **Back to Back** | Run 10+ miles on consecutive days (the ultra training staple) | two consecutive days with 10+ miles each | Gold | Yes - training flex |
| 36 | `doubles_5` | **Seeing Double** | Run twice in one day, 5 times | 5 days with 2+ runs | Silver | Yes |

---

## CATEGORY 3: SINGLE-RUN DISTANCE

### Existing (4 achievements)
- Double Digits (10K), Half Way There (half), Marathoner, Ultra Beast

### New Achievements

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 37 | `first_5k` | **Fiver** | Complete your first 5K (3.1+ miles) | single run >= 3.1 mi | Bronze | Yes |
| 38 | `first_5mi` | **High Five** | Complete your first 5-miler | single run >= 5.0 mi | Bronze | Yes |
| 39 | `first_15k` | **The Tweener** | Complete your first 15K (9.3+ miles) | single run >= 9.3 mi | Silver | Moderate |
| 40 | `first_20mi` | **The Dress Rehearsal** | Run 20 miles in a single run (the classic marathon long run) | single run >= 20 mi | Gold | Very |
| 41 | `first_50k` | **Fifty Shades of Pain** | Complete a 50K (31+ miles) | single run >= 31 mi | Diamond | Very |
| 42 | `first_50mi` | **Half a Hundred** | Complete a 50-miler | single run >= 50 mi | Diamond | Extremely |
| 43 | `first_100k` | **Centurion (Distance)** | Complete a 100K (62+ miles) | single run >= 62 mi | Legendary | Extremely |
| 44 | `first_100mi` | **The Buckle** | Complete a 100-miler. Belt buckle not included. | single run >= 100 mi | Legendary | Life achievement |
| 45 | `longest_run_pr` | **New Frontier** | Set a new all-time longest run distance | current run > all previous longest | Bronze | Yes - auto-detected |
| 46 | `double_digit_count_10` | **Double Digit Regular** | Complete 10 runs of 10+ miles | count of 10+ mile runs >= 10 | Silver | Yes |
| 47 | `double_digit_count_50` | **Long Run Veteran** | Complete 50 runs of 10+ miles | count >= 50 | Gold | Yes |
| 48 | `twenty_miler_5` | **Marathon Ready** | Complete 5 runs of 20+ miles | count of 20+ mi runs >= 5 | Gold | Yes - training flex |

---

## CATEGORY 4: SPEED & RACE TIMES

### Existing (7 achievements)
- Sub-30/25/20 5K, Sub-2:00 Half, Sub-4:00/3:30 Marathon, BQ Qualifier

### New Achievements

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 49 | `sub60_10k` | **Sub-60 10K** | Finish a 10K in under 60 minutes | 10K finish time < 60:00 | Bronze | Yes |
| 50 | `sub50_10k` | **Sub-50 10K** | Finish a 10K in under 50 minutes | 10K finish time < 50:00 | Silver | Yes |
| 51 | `sub45_10k` | **Sub-45 10K** | Finish a 10K in under 45 minutes | 10K finish time < 45:00 | Gold | Yes |
| 52 | `sub40_10k` | **Sub-40 10K** | Finish a 10K in under 40 minutes | 10K finish time < 40:00 | Diamond | Very |
| 53 | `sub130_half` | **Sub-1:30 Half** | Finish a half marathon in under 1:30 | half finish < 1:30:00 | Gold | Very |
| 54 | `sub115_half` | **Sub-1:15 Half** | Finish a half marathon in under 1:15. You are fast. | half finish < 1:15:00 | Diamond | Extremely |
| 55 | `sub3_marathon` | **Sub-3 Marathon** | Finish a marathon in under 3 hours. Elite recreational. | marathon finish < 3:00:00 | Diamond | Extremely |
| 56 | `sub250_marathon` | **Sub-2:50 Marathon** | Finish a marathon in under 2:50. Legit fast. | marathon finish < 2:50:00 | Legendary | Life achievement |
| 57 | `sub7_pace` | **Seven-Minute Miles** | Complete a run of 5+ miles at sub-7:00/mi average | run >= 5mi, avgPace < 420sec | Silver | Yes |
| 58 | `sub6_pace` | **Six-Minute Miles** | Complete a run of 5+ miles at sub-6:00/mi average | run >= 5mi, avgPace < 360sec | Gold | Very |
| 59 | `sub8_pace_10mi` | **Metronome** | Run 10+ miles at sub-8:00/mi | run >= 10mi, avgPace < 480sec | Silver | Yes |
| 60 | `sub7_pace_13mi` | **Half Marathon Hammer** | Run 13.1+ miles at sub-7:00/mi | run >= 13.1mi, avgPace < 420sec | Gold | Very |
| 61 | `mile_pr` | **Mile Masher** | Set a mile PR (from Strava best efforts) | new PR at 1-mile distance | Bronze | Yes - auto-detected |
| 62 | `5k_pr` | **5K Slayer** | Set a 5K PR | new PR at 5K distance | Silver | Yes |
| 63 | `10k_pr` | **10K Crusher** | Set a 10K PR | new PR at 10K distance | Silver | Yes |
| 64 | `half_pr` | **Half Marathon Hero** | Set a half marathon PR | new PR at half distance | Gold | Very |
| 65 | `marathon_pr` | **Marathon Masterclass** | Set a marathon PR | new PR at marathon distance | Gold | Very |
| 66 | `pr_streak_3` | **Hot Streak** | Set PRs in 3 consecutive races | 3 consecutive race-type workouts each faster than previous | Gold | Very |
| 67 | `sub_8min_mile` | **Breaking Eight** | Run a sub-8:00 mile (from best efforts) | mile best effort < 480sec | Bronze | Yes |
| 68 | `sub_7min_mile` | **Breaking Seven** | Run a sub-7:00 mile | mile best effort < 420sec | Silver | Yes |
| 69 | `sub_6min_mile` | **Breaking Six** | Run a sub-6:00 mile | mile best effort < 360sec | Gold | Very |
| 70 | `sub_5min_mile` | **Breaking Five** | Run a sub-5:00 mile | mile best effort < 300sec | Diamond | Extremely |
| 71 | `sub_430_mile` | **The Bannister** | Run a sub-4:30 mile. Roger would be proud. | mile best effort < 270sec | Legendary | Life achievement |

---

## CATEGORY 5: PACING & EXECUTION

### New Category - Leverages segment data, splits, and execution scores

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 72 | `negative_split_first` | **Bring It Home** | Run a negative split (second half faster than first) on a 5+ mile run | compare first/second half segment paces, run >= 5mi | Bronze | Yes |
| 73 | `negative_split_5` | **The Closer** | Run 5 negative-split runs of 5+ miles | count of negative split runs >= 5 | Silver | Yes |
| 74 | `negative_split_race` | **The 8 Percent** | Run a negative split in a race. Only 8% of marathoners do. | race-type workout with negative split | Gold | Very |
| 75 | `negative_split_marathon` | **Textbook Marathon** | Negative-split a marathon | marathon-distance race with negative split | Diamond | Extremely |
| 76 | `even_split_master` | **Metronomic** | Run a 10+ mile run where every mile split is within 15 seconds of each other | max split variance <= 15sec on 10+ mi run | Gold | Very - shows control |
| 77 | `progression_run_first` | **Building Steam** | Complete your first progression run (each mile faster than the last) | 4+ mile run where each successive mile is faster | Bronze | Yes |
| 78 | `progression_run_10` | **The Accelerator** | Complete 10 progression runs | count >= 10 | Silver | Yes |
| 79 | `execution_score_90` | **Nailed It** | Achieve an execution score of 90+ on a workout | executionScore >= 90 | Silver | Yes |
| 80 | `execution_score_95` | **Surgical Precision** | Achieve an execution score of 95+ | executionScore >= 95 | Gold | Very |
| 81 | `perfect_execution_5` | **Five Star General** | Get 5 workouts with execution scores of 90+ | count of 90+ execution workouts >= 5 | Gold | Yes |
| 82 | `race_day_execution` | **Race Ready** | Execute a race within 2% of goal pace from start to finish | race with avg pace within 2% of target | Gold | Very |
| 83 | `fast_finish_long` | **Finishing Kick** | Run the last 2 miles of a 15+ mile run faster than marathon pace | last 2 segments of 15+ mi run faster than MP | Gold | Yes - marathon-specific |

---

## CATEGORY 6: WEATHER WARRIOR

### New Category - Uses weather data fields

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 84 | `rain_runner_first` | **Singin' in the Rain** | Complete your first run in the rain | weatherConditions === 'rain', count >= 1 | Bronze | Yes - Gene Kelly vibes |
| 85 | `rain_runner_10` | **Made of Sugar? Nah.** | Complete 10 runs in the rain | rain runs >= 10 | Silver | Yes |
| 86 | `rain_runner_25` | **Waterproof** | Complete 25 runs in the rain | rain runs >= 25 | Gold | Yes |
| 87 | `snow_runner_first` | **Let It Snow** | Complete your first run in the snow | weatherConditions === 'snow' | Bronze | Very - holiday vibes |
| 88 | `snow_runner_10` | **Snowplow** | Complete 10 runs in the snow | snow runs >= 10 | Silver | Yes |
| 89 | `thunderstorm_runner` | **Thor** | Complete a run during a thunderstorm. We admire your poor judgment. | weatherConditions === 'thunderstorm' | Gold | Very - bragging rights |
| 90 | `hot_runner_first` | **Heat Check** | Complete a run when it's 85+ degrees | weatherTempF >= 85 | Bronze | Yes |
| 91 | `hot_runner_10` | **Heatstroke Hero** | Complete 10 runs in 85+ degree heat | hot runs >= 10 | Silver | Yes |
| 92 | `scorcher` | **The Scorcher** | Complete a run when it's 95+ degrees | weatherTempF >= 95 | Gold | Very - respect |
| 93 | `cold_runner_first` | **Cold Blooded** | Complete a run when it's below 32 degrees | weatherTempF < 32 | Bronze | Yes |
| 94 | `cold_runner_10` | **Frozen Solid** | Complete 10 runs below 32 degrees | cold runs >= 10 | Silver | Yes |
| 95 | `polar_vortex` | **Polar Vortex** | Complete a run below 10 degrees F | weatherTempF < 10 | Gold | Very |
| 96 | `feels_like_zero` | **Absolute Zero** | Run when "feels like" temp is below 0 degrees F | weatherFeelsLikeF < 0 | Diamond | Extremely |
| 97 | `windy_runner` | **Gone with the Wind** | Complete a run with 20+ mph winds | weatherWindMph >= 20 | Silver | Yes |
| 98 | `gale_force` | **Gale Force** | Complete a run with 30+ mph winds | weatherWindMph >= 30 | Gold | Very |
| 99 | `foggy_runner` | **Into the Mist** | Complete 5 runs in fog | weatherConditions === 'fog', count >= 5 | Silver | Aesthetic |
| 100 | `all_conditions` | **Captain Planet** | Run in every weather condition: clear, cloudy, fog, drizzle, rain, snow, thunderstorm | distinct weatherConditions count >= 7 | Gold | Very - completionist |
| 101 | `four_seasons` | **Vivaldi** | Run in all four seasons in a single year | runs in each quarter of a calendar year | Silver | Yes |
| 102 | `humidity_warrior` | **Swamp Thing** | Complete 5 runs with humidity above 90% | weatherHumidityPct > 90, count >= 5 | Silver | Yes |
| 103 | `perfect_day` | **Perfect Day** | Run on a day with 50-65 degrees, clear skies, and < 10 mph wind | ideal conditions combo | Bronze | Aesthetic |
| 104 | `temp_range_80` | **80-Degree Spread** | Run in conditions spanning an 80+ degree F range across all your runs | max temp - min temp >= 80 | Gold | Very |

---

## CATEGORY 7: TIME OF DAY & CALENDAR

### New Category - Leverages startTimeLocal and date fields

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 105 | `dawn_patrol_first` | **Dawn Patrol** | Run before 5 AM | startTimeLocal before 05:00 | Bronze | Yes |
| 106 | `dawn_patrol_25` | **Before the Sun** | Complete 25 runs before 5 AM | pre-5AM runs >= 25 | Gold | Very |
| 107 | `midnight_runner` | **Midnight Runner** | Start a run between midnight and 3 AM | startTimeLocal 00:00-03:00 | Silver | Very - mystery |
| 108 | `lunch_runner_10` | **Lunch Break Legend** | Complete 10 runs between 11 AM and 1 PM | runs 11:00-13:00 >= 10 | Silver | Relatable |
| 109 | `all_hours` | **Around the Clock** | Run during every 3-hour block of the day (0-3, 3-6, 6-9, 9-12, 12-15, 15-18, 18-21, 21-24) | 8 distinct time blocks | Gold | Very - completionist |
| 110 | `new_years_run` | **New Year, New You** | Run on January 1st | date is January 1 | Bronze | Very - seasonal |
| 111 | `valentines_run` | **Running Lover** | Run on Valentine's Day | date is February 14 | Bronze | Cute |
| 112 | `turkey_trot` | **Turkey Trot** | Run on Thanksgiving Day | date is 4th Thursday of November (US) | Bronze | Very - tradition |
| 113 | `christmas_run` | **Run Run Rudolph** | Run on Christmas Day | date is December 25 | Silver | Very |
| 114 | `halloween_run` | **Ghost Runner** | Run on Halloween | date is October 31 | Bronze | Yes |
| 115 | `birthday_run` | **Birthday Miles** | Run on your birthday (if profile has birth date) | date matches profile birthday | Bronze | Very - personal |
| 116 | `fourth_of_july` | **Firecracker** | Run on July 4th | date is July 4 | Bronze | Yes |
| 117 | `leap_day` | **Leap of Faith** | Run on February 29th | date is Feb 29 (leap year only) | Gold | Very - only every 4 years! |
| 118 | `friday_13th` | **Jason Voorhees** | Run on Friday the 13th | date is a Friday and the 13th | Silver | Fun |
| 119 | `summer_solstice` | **Longest Day** | Run on the summer solstice (June 20-21) | date is Jun 20 or 21 | Silver | Aesthetic |
| 120 | `winter_solstice` | **Darkest Day** | Run on the winter solstice (Dec 20-21) | date is Dec 20 or 21 | Silver | Aesthetic |
| 121 | `pi_day` | **3.14159 Miles** | Run exactly 3.14 miles on Pi Day (March 14). Or at least close. | date is Mar 14, distance 3.1-3.2 mi | Gold | Very nerdy, very shareable |
| 122 | `all_12_months` | **No Off-Season** | Run in all 12 months of a calendar year | 12 distinct months with runs in a year | Silver | Yes |
| 123 | `every_day_of_week` | **MTWTFSS** | Run on every day of the week in a single week | 7 distinct weekdays with runs in one week | Silver | Same as "No Rest" |
| 124 | `weekend_warrior_10` | **Weekend Warrior** | Complete 10 runs on Saturday or Sunday | weekend runs >= 10 | Bronze | Moderate |

---

## CATEGORY 8: ELEVATION & CLIMBING

### New Category - Uses elevationGainFt data

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 125 | `elev_1000_single` | **Hill Finder** | Gain 1,000+ feet of elevation in a single run | single run elevationGainFt >= 1000 | Silver | Yes |
| 126 | `elev_2000_single` | **Mountain Goat** | Gain 2,000+ feet of elevation in a single run | single run elevationGainFt >= 2000 | Gold | Very |
| 127 | `elev_3000_single` | **Cloud Runner** | Gain 3,000+ feet of elevation in a single run | single run elevationGainFt >= 3000 | Diamond | Very |
| 128 | `elev_total_10k` | **Ten Thousand Up** | Accumulate 10,000 feet of total elevation gain | cumulative elevationGainFt >= 10000 | Bronze | Moderate |
| 129 | `elev_total_50k` | **Fifty Thousand Up** | Accumulate 50,000 feet of total elevation gain | cumulative >= 50000 | Silver | Yes |
| 130 | `elev_total_everest` | **Everesting** | Accumulate 29,032 feet of elevation gain (height of Everest) | cumulative >= 29032 | Gold | Very |
| 131 | `elev_total_double_everest` | **Double Everest** | Accumulate 58,064 feet of elevation gain | cumulative >= 58064 | Diamond | Very |
| 132 | `flat_runner` | **Pancake Flat** | Run 10+ miles with less than 50 feet of elevation gain | run >= 10mi, elev < 50ft | Bronze | Funny |
| 133 | `elev_total_100k` | **Sky High** | Accumulate 100,000 feet of total elevation gain | cumulative >= 100000 | Gold | Yes |
| 134 | `elev_total_500k` | **Stratosphere** | Accumulate 500,000 feet of total elevation gain | cumulative >= 500000 | Diamond | Very |
| 135 | `hilly_5` | **Hill Repeats Hater** | Run 5 runs with 100+ feet per mile of elevation gain | 5 runs where elev/miles >= 100 | Silver | Relatable |

---

## CATEGORY 9: HEART RATE & EFFORT

### New Category - Uses HR, zone, TRIMP, and RPE data

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 136 | `zone2_master_first` | **Easy Does It** | Complete an easy run where 80%+ of time is in Zone 1-2 | zoneDominant in recovery/easy, zone 1-2 >= 80% | Bronze | Educational |
| 137 | `zone2_master_50` | **Aerobic Engine** | Complete 50 runs with 80%+ time in Zone 1-2 | count of 80%+ Z1-2 runs >= 50 | Gold | Yes - training philosophy |
| 138 | `zone2_master_100` | **Maffetone Disciple** | Complete 100 runs with 80%+ time in Zone 1-2 | count >= 100 | Diamond | Very |
| 139 | `max_hr_reached` | **Red Line** | Hit your maximum heart rate during a run | maxHr >= profile maxHr | Silver | Yes |
| 140 | `low_hr_fast_pace` | **Efficient Machine** | Run sub-8:00/mi pace with average HR under 140 | avgPace < 480sec, avgHr < 140 | Gold | Very - fitness indicator |
| 141 | `cardiac_drift_low` | **Steady Heart** | Complete a 60+ minute easy run with less than 5% cardiac drift | aerobicDecouplingPct < 5 on 60+ min run | Gold | Yes - data-nerd flex |
| 142 | `high_trimp_workout` | **Maximum Effort** | Complete a workout with TRIMP score above 200 | trimp >= 200 | Silver | Yes |
| 143 | `trimp_total_10k` | **Ten Thousand TRIMP** | Accumulate 10,000 total TRIMP points | cumulative trimp >= 10000 | Gold | Data flex |
| 144 | `easy_rpe_match` | **Honest Easy Day** | Rate an easy run as RPE 3 or less and have average HR confirm it was actually easy | workoutType === 'easy', rpe <= 3, avgHr in easy zone | Bronze | Moderate |
| 145 | `hard_day_easy_day` | **Polarized Pro** | Alternate hard/easy days for 2 straight weeks | 14 days following hard/easy pattern | Gold | Yes - training philosophy |
| 146 | `hr_recovery_fast` | **Quick Recovery** | Have your HR drop 30+ bpm in the first minute after a hard effort (from streams) | HR stream shows 30+ bpm drop in 60sec post-effort | Gold | Fitness indicator |

---

## CATEGORY 10: TRAINING VARIETY & WORKOUT TYPES

### Existing (6 achievements)
- Tempo Tantrum, Speed Demon, Quality Over Quantity, The Long Haul, Race Day, Serial Racer

### New Achievements

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 147 | `first_threshold` | **Threshold Theory** | Complete your first threshold workout | workoutType === 'threshold', count >= 1 | Bronze | Moderate |
| 148 | `first_long_run` | **Going Long** | Complete your first long run (10+ miles) | single run >= 10mi | Bronze | Yes |
| 149 | `first_recovery` | **Active Recovery** | Log your first recovery run. Smart training is smart resting. | workoutType === 'recovery' | Bronze | Moderate |
| 150 | `workout_type_all` | **Renaissance Runner** | Complete every workout type: recovery, easy, steady, marathon, tempo, threshold, interval, repetition, long, race | 10 distinct workout types logged | Gold | Very |
| 151 | `intervals_25` | **Interval Addict** | Complete 25 interval sessions | interval + repetition workouts >= 25 | Silver | Yes |
| 152 | `intervals_100` | **Track Rat** | Complete 100 interval sessions | count >= 100 | Diamond | Very |
| 153 | `tempos_25` | **Tempo King/Queen** | Complete 25 tempo runs | tempo count >= 25 | Silver | Yes |
| 154 | `long_runs_25` | **Long Run Lover** | Complete 25 long runs (10+ miles) | count >= 25 | Silver | Yes |
| 155 | `long_runs_50` | **Endurance Engine** | Complete 50 long runs | count >= 50 | Gold | Yes |
| 156 | `race_count_5` | **Serial Starter** | Complete 5 races | race count >= 5 | Silver | Yes |
| 157 | `race_count_25` | **Race Junkie** | Complete 25 races | race count >= 25 | Gold | Yes |
| 158 | `race_count_50` | **Born to Race** | Complete 50 races | race count >= 50 | Diamond | Very |
| 159 | `recovery_ratio_good` | **Smart Trainer** | Maintain a 70%+ ratio of easy/recovery runs to hard runs over 4 weeks | easy ratio >= 70% over 28 days | Silver | Yes - shows maturity |
| 160 | `quality_ratio_high` | **Quality Concentrated** | Complete a workout with qualityRatio above 0.6 | qualityRatio >= 0.6 | Silver | Yes |
| 161 | `cross_train_10` | **Cross Pollinator** | Log 10 cross-training activities | cross_train count >= 10 | Silver | Moderate |

---

## CATEGORY 11: VDOT & FITNESS PROGRESSION

### New Category - Uses VDOT history and fitness signals

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 162 | `vdot_first` | **Know Your Number** | Get your first VDOT score calculated | vdot exists on profile | Bronze | Yes |
| 163 | `vdot_improvement_2` | **Two Points Up** | Improve your VDOT by 2+ points from your first recorded value | vdot delta >= 2 | Silver | Yes |
| 164 | `vdot_improvement_5` | **Five Alive** | Improve your VDOT by 5+ points | vdot delta >= 5 | Gold | Very |
| 165 | `vdot_improvement_10` | **Transformation** | Improve your VDOT by 10+ points. You've become a different runner. | vdot delta >= 10 | Diamond | Extremely |
| 166 | `vdot_40` | **VDOT 40** | Reach a VDOT of 40 | current vdot >= 40 | Bronze | Yes |
| 167 | `vdot_45` | **VDOT 45** | Reach a VDOT of 45. Solid recreational runner. | current vdot >= 45 | Silver | Yes |
| 168 | `vdot_50` | **VDOT 50** | Reach a VDOT of 50. Serious competitor. | current vdot >= 50 | Silver | Yes |
| 169 | `vdot_55` | **VDOT 55** | Reach a VDOT of 55. You're fast. | current vdot >= 55 | Gold | Very |
| 170 | `vdot_60` | **VDOT 60** | Reach a VDOT of 60. Sub-elite territory. | current vdot >= 60 | Diamond | Extremely |
| 171 | `vdot_65` | **VDOT 65** | Reach a VDOT of 65. Are you a professional? | current vdot >= 65 | Legendary | Life achievement |
| 172 | `fitness_peak` | **Peak Performance** | Reach your all-time highest VDOT | current vdot === max(vdotHistory) | Silver | Yes - auto-detected |
| 173 | `aerobic_decoupling_low` | **Well-Oiled Machine** | Achieve aerobic decoupling under 3% on a 60+ minute run | aerobicDecouplingPct < 3 | Gold | Data-nerd flex |
| 174 | `efficiency_improving` | **Getting Faster at Easy** | Run the same pace at a lower HR than 3 months ago | compare similar-pace runs 3 months apart | Gold | Very |

---

## CATEGORY 12: POP CULTURE & RUNNING HUMOR

### New Category - Hidden/surprise achievements with references

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 175 | `run_forrest_run` | **Run, Forrest, Run!** | Run across multiple states (or 50+ cumulative miles in a week). "I just felt like running." | weekly miles >= 50 OR multi-state GPS data | Silver | Extremely |
| 176 | `chariots_of_fire` | **Chariots of Fire** | Set a PR at any distance. You can practically hear the theme song. | any distance PR achieved | Bronze | Yes |
| 177 | `rocky_steps` | **Rocky Steps** | Gain 500+ feet of elevation in a single run under 5 miles | run < 5mi, elev >= 500ft | Silver | Very |
| 178 | `eye_of_the_tiger` | **Eye of the Tiger** | Complete 5 interval workouts in a single month | intervals in 1 month >= 5 | Silver | Yes |
| 179 | `born_to_run` | **Born to Run** | Run barefoot or in minimal shoes. Just kidding -- log your 100th run. | run count >= 100 | Silver | Yes |
| 180 | `dont_stop_me_now` | **Don't Stop Me Now** | Negative split every mile in a 10+ mile run | every successive mile faster on 10+ mi run | Diamond | Very |
| 181 | `the_loneliness` | **The Loneliness of the Long Distance Runner** | Complete a solo run of 20+ miles | 20+ mi run (no group detected) | Gold | Literary flex |
| 182 | `brittany_runs` | **Brittany Runs a Marathon** | Complete your first marathon. Your Brittany era has arrived. | first marathon completed | Gold | Very |
| 183 | `run_the_world` | **Run the World** | Run in 5+ different locations (by distinct lat/lng clusters) | 5+ distinct route start locations | Silver | Yes |
| 184 | `need_for_speed` | **Need for Speed** | Set 3 PRs in a single month | 3 PRs in one month | Gold | Very |
| 185 | `the_flash` | **The Flash** | Run a mile in under 6 minutes | best effort mile < 360sec | Gold | Very |
| 186 | `the_matrix` | **Dodging the Matrix** | Run a speed workout at 5 AM. You took the red pill. | interval/tempo/threshold before 5AM | Gold | Funny |
| 187 | `run_dmc` | **Run-D.M.C.** | Run on 3 consecutive days that start with the letters of the week (e.g., Mon-Tue-Wed) | hidden - 3 consecutive weekday runs | Bronze | Fun easter egg |
| 188 | `one_more_thing` | **"One More Thing..."** | Log a second run in a day when you already hit your weekly goal | bonus run after weekly target met | Bronze | Relatable |
| 189 | `pheidippides` | **Pheidippides** | Run 26.2 miles. Like the OG marathon runner (who died, but we don't talk about that). | first marathon | Gold | Historical flex |
| 190 | `the_prefontaine` | **The Prefontaine** | Give 100% effort in a race (RPE 10) | race with rpe === 10 | Silver | Yes |
| 191 | `road_not_taken` | **The Road Not Taken** | Run a new route you've never done before after 50+ logged runs | new routeId after 50+ runs | Bronze | Moderate |
| 192 | `what_doesnt_kill_you` | **What Doesn't Kill You** | Rate a run "awful" but still finish 10+ miles | verdict === 'awful', distance >= 10 | Gold | Very relatable |
| 193 | `cant_stop_wont_stop` | **Can't Stop Won't Stop** | Run 7 days in a row with at least 5 miles each day | 7 days, each >= 5mi | Gold | Yes |
| 194 | `talk_test` | **The Talk Test** | Complete 10 easy runs with average HR in Zone 1-2 | 10 easy runs all in aerobic zone | Silver | Yes |

---

## CATEGORY 13: NICHE RUNNER CULTURE

### For the BQ-chaser, 40-65 mpw serious recreational audience

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 195 | `bq_minus_5` | **BQ-5** | Beat the BQ standard by 5+ minutes. You actually got in. | marathon time <= BQ - 5min | Diamond | Life achievement |
| 196 | `the_taper` | **Taper Tantrum** | Reduce mileage by 30%+ from peak week (detected automatically during taper) | weekly mileage drop >= 30% from 3-week max | Bronze | Very relatable |
| 197 | `the_wall` | **The Wall** | Slow down by 60+ sec/mi in the last 6 miles of a marathon | last 6 miles avg pace vs first 20 miles | Bronze | Painfully relatable |
| 198 | `bonk_survivor` | **Bonk Survivor** | Log a run with the "bonked" issue. Happens to the best of us. | issues includes 'bonked' | Bronze | Very relatable |
| 199 | `gi_distress` | **GI Distress Express** | Log a run with GI issues. The dark side of distance running. | issues includes 'gi' | Bronze | Painfully funny |
| 200 | `side_stitch_club` | **Stitch & Bitch** | Log 3 runs with side stitches | issues includes 'side_stitch', count >= 3 | Bronze | Relatable |
| 201 | `easy_day_really_easy` | **Actually Easy** | Run an easy day at a truly easy pace (1:30+ slower than threshold) | easy run pace >= threshold pace + 90sec | Silver | Training-nerd flex |
| 202 | `daniels_disciple` | **Daniels' Disciple** | Run 50 workouts classified as training types Jack Daniels would approve of | tempo + threshold + interval + repetition >= 50 | Gold | Coach-philosophy flex |
| 203 | `pfitz_acolyte` | **Pfitz Acolyte** | Complete a 18/55 or higher marathon training block (18+ weeks, 55+ peak mpw) | 18+ weeks of consistent training, peak >= 55 mpw | Gold | Very - BQ-chaser badge |
| 204 | `hansons_beginner` | **Hansons Hero** | Run 6 days per week for 4 consecutive weeks (Hansons-style) | 4 weeks of 6+ run days | Gold | Yes |
| 205 | `strides_habit` | **Strides Specialist** | Complete 20 runs with strides/repetition segments | repetition count >= 20 | Silver | Yes |
| 206 | `the_cutback` | **The Cutback Week** | Successfully reduce volume 20-30% for a recovery week after 3 building weeks | pattern: 3 increasing weeks then 1 lower week | Silver | Training awareness |
| 207 | `negative_split_long` | **Patient Long Runner** | Negative split a 16+ mile long run | long run 16+ mi with negative split | Gold | Very - marathon readiness |
| 208 | `mp_workout` | **Marathon Pace Master** | Complete a marathon-pace workout of 10+ miles at marathon goal pace +/- 10sec | steady/marathon type, 10+ mi, pace near MP | Gold | Very |
| 209 | `race_pr_after_bad_block` | **Plot Armor** | Set a PR in a race after a week that included an "awful" or "rough" training run | PR in race after recent bad workout | Gold | Great story |
| 210 | `the_shakeout` | **The Shakeout** | Run 2-3 miles easy the day before a race | short easy run day before a race-type workout | Bronze | Runner culture |

---

## CATEGORY 14: SHOE & GEAR

### Uses shoe data and rotation patterns

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 211 | `first_shoe` | **Sole Mate** | Log your first run with a shoe assigned | shoeId exists on a run | Bronze | Cute |
| 212 | `shoe_rotation_3` | **Rotation Nation** | Use 3 different shoes in a single week | 3+ distinct shoeIds in one week | Silver | Yes |
| 213 | `shoe_500` | **500 Mile Shoes** | Put 500 miles on a single pair of shoes | shoe totalMiles >= 500 | Silver | Yes |
| 214 | `shoe_1000` | **Thousand Mile Soles** | Put 1,000 miles on a single pair of shoes. Buy new shoes. Seriously. | shoe totalMiles >= 1000 | Gold | Funny |
| 215 | `race_shoes` | **Race Day Flats** | Use a race-category shoe for a race | race shoe used on race day | Bronze | Yes |
| 216 | `shoe_graveyard_3` | **Shoe Graveyard** | Retire 3 pairs of shoes | retired shoes >= 3 | Silver | Relatable |
| 217 | `shoe_graveyard_10` | **Imelda Marcos** | Retire 10 pairs of shoes | retired shoes >= 10 | Gold | Funny |

---

## CATEGORY 15: SOCIAL & STRAVA

### Uses Strava social data

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 218 | `kudos_10` | **First Fan** | Get 10 kudos on a single run | stravaKudosCount >= 10 | Bronze | Yes |
| 219 | `kudos_50` | **Local Celebrity** | Get 50 kudos on a single run | stravaKudosCount >= 50 | Silver | Yes |
| 220 | `kudos_100` | **Viral Runner** | Get 100 kudos on a single run | stravaKudosCount >= 100 | Gold | Very |
| 221 | `comments_5` | **Conversation Starter** | Get 5 comments on a single run | stravaCommentCount >= 5 | Silver | Yes |
| 222 | `suffer_score_high` | **Suffer Fest** | Get a Strava Suffer Score of 200+ | stravaSufferScore >= 200 | Gold | Yes |

---

## CATEGORY 16: CADENCE & FORM

### Uses cadence data

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 223 | `cadence_180` | **180 Club** | Average 180+ steps per minute on a run of 3+ miles | stravaAverageCadence >= 180, distance >= 3mi | Silver | Yes |
| 224 | `cadence_consistent` | **Steady Turnover** | Run 10 runs with cadence between 175-185 spm | count of 175-185 cadence runs >= 10 | Silver | Yes |
| 225 | `cadence_190` | **Quick Feet** | Average 190+ spm on a run | stravaAverageCadence >= 190 | Gold | Yes |

---

## CATEGORY 17: ROUTE & LOCATION

### Uses route data and GPS coordinates

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 226 | `home_route_10` | **Creature of Habit** | Run the same route 10 times | same routeId count >= 10 | Bronze | Relatable |
| 227 | `home_route_50` | **I Own This Road** | Run the same route 50 times | same routeId count >= 50 | Silver | Very |
| 228 | `home_route_100` | **Route Royalty** | Run the same route 100 times | same routeId count >= 100 | Gold | Very |
| 229 | `route_variety_10` | **Explorer** | Run 10 different routes | distinct routeIds >= 10 | Bronze | Yes |
| 230 | `route_variety_25` | **Cartographer** | Run 25 different routes | distinct routeIds >= 25 | Silver | Yes |
| 231 | `route_variety_50` | **Wanderlust** | Run 50 different routes | distinct routeIds >= 50 | Gold | Yes |

---

## CATEGORY 18: DURATION & TIME ON FEET

### Uses durationMinutes and elapsedTimeMinutes

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 232 | `time_60_first` | **The Full Hour** | Complete your first run of 60+ minutes | durationMinutes >= 60 | Bronze | Yes |
| 233 | `time_90` | **Ninety Minutes** | Complete a run of 90+ minutes | durationMinutes >= 90 | Silver | Yes |
| 234 | `time_120` | **Two Hour Run** | Complete a run of 120+ minutes | durationMinutes >= 120 | Silver | Yes |
| 235 | `time_180` | **Three Hour Run** | Complete a run of 180+ minutes | durationMinutes >= 180 | Gold | Yes |
| 236 | `time_total_100h` | **100 Hours of Running** | Accumulate 100 hours of total running time | cumulative durationMinutes >= 6000 | Silver | Yes |
| 237 | `time_total_500h` | **500 Hours of Running** | Accumulate 500 hours of total running time | cumulative durationMinutes >= 30000 | Gold | Yes |
| 238 | `time_total_1000h` | **Thousand Hour Club** | Accumulate 1,000 hours of total running | cumulative durationMinutes >= 60000 | Diamond | Very |

---

## CATEGORY 19: HIDDEN / SECRET ACHIEVEMENTS

### Surprise achievements that aren't shown until earned

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 239 | `the_404` | **404: Rest Day Not Found** | Run 30 days without a single rest day | streak >= 30 (same as Iron Will but hidden variant) | Gold | Funny |
| 240 | `the_1_59` | **1:59:40** | Run any distance at a pace equivalent to Kipchoge's sub-2-hour marathon (4:33/mi) for at least 1 mile | 1-mile segment at <= 273 sec/mi | Diamond | Elite flex |
| 241 | `the_nice` | **Nice.** | Run exactly 6.9 miles. | distance between 6.85 and 6.95 | Bronze | Extremely (meme) |
| 242 | `the_42` | **The Answer** | Run 4.2 miles, or 42 minutes, or on April 2nd. The answer to life, the universe, and everything. | dist ~4.2 OR dur ~42 OR date Apr 2 | Bronze | Nerdy |
| 243 | `the_420` | **Blaze It** | Run at exactly 4:20 PM or run 4.20 miles. Hidden achievement. | startTime === 16:20 OR dist ~4.20 | Bronze | Very (meme) |
| 244 | `palindrome_pace` | **Palindrome Pace** | Run at a palindrome pace like 7:07, 8:08, 9:09, etc. | avgPaceSeconds translates to palindrome | Bronze | Nerdy |
| 245 | `the_doubter` | **Hold My Beer** | Rate a run as RPE 9-10 "awful" and then PR the next race | awful RPE followed by race PR | Gold | Great story |
| 246 | `the_round_number` | **OCD Satisfaction** | Finish a run at exactly a round number (5.00, 10.00, etc. within 0.02mi) | distance within 0.02 of a whole number | Bronze | Very relatable |
| 247 | `the_extra_point` | **The Extra 0.1** | Run 26.3+ miles (running past the marathon finish line because GPS). Every. Single. Time. | marathon-distance run > 26.3 | Bronze | Painfully relatable |

---

## CATEGORY 20: MULTI-DIMENSIONAL & COMBO ACHIEVEMENTS

### Achievements that require multiple conditions simultaneously

| # | ID | Name | Description | Computation | Tier | Shareable |
|---|-----|------|-------------|-------------|------|-----------|
| 248 | `rain_pr` | **Dancing in the Rain** | Set a PR in the rain | PR + weatherConditions === 'rain' | Gold | Very |
| 249 | `cold_fast` | **Cold and Fast** | Run sub-7:00/mi when it's below 32 degrees F | avgPace < 420, weatherTempF < 32 | Gold | Very |
| 250 | `hot_long` | **Heat Endurance** | Run 10+ miles when it's above 80 degrees F | distance >= 10, weatherTempF >= 80 | Gold | Yes |
| 251 | `dawn_marathon` | **Sunrise Marathoner** | Start a marathon before 6 AM | marathon distance + startTimeLocal < 06:00 | Gold | Yes |
| 252 | `rainy_long_run` | **Dedicated AF** | Run 15+ miles in the rain | distance >= 15, weatherConditions === 'rain' | Gold | Very - serious dedication |
| 253 | `early_intervals` | **5 AM Speed Session** | Complete an interval workout before 6 AM | interval type + startTimeLocal < 06:00 | Gold | Respect |
| 254 | `new_route_pr` | **First Time's the Charm** | Set a PR on a route you've never run before | PR on new routeId | Silver | Yes |
| 255 | `awful_to_great` | **Rubber Band Runner** | Go from an "awful" run to a "great" run within 3 days | verdict progression in 3 days | Silver | Relatable story |
| 256 | `triple_crown` | **Triple Crown** | Complete a long run, tempo, and intervals all in one week | 3 workout types in single week | Silver | Training flex |
| 257 | `grand_slam` | **Grand Slam** | PR at 5K, 10K, half marathon, and full marathon | PR at all 4 major distances | Legendary | Life achievement |
| 258 | `climb_and_speed` | **Hill Sprinter** | Run a sub-7:00/mi average on a run with 1000+ ft elevation gain | avgPace < 420, elev >= 1000 | Gold | Very |
| 259 | `all_weather_all_seasons` | **Through It All** | Complete runs in rain, snow, and 90+ degree heat in a single year | rain + snow + hot (90+) all in same year | Gold | Very |
| 260 | `marathon_month` | **Marathon Month** | Run the equivalent of a marathon (26.2 miles) in a single week for an entire month | 4 consecutive weeks each >= 26.2 mi | Silver | Yes |

---

## Implementation Notes

### New Categories to Add to `AchievementCategory` Type

```typescript
export type AchievementCategory =
  | 'mileage'           // existing
  | 'streak'            // existing
  | 'distance'          // existing
  | 'speed'             // existing
  | 'consistency'        // existing
  | 'training'          // existing
  | 'pacing'            // NEW - negative splits, execution, progression runs
  | 'weather'           // NEW - weather warrior achievements
  | 'calendar'          // NEW - holidays, time of day, seasonal
  | 'elevation'         // NEW - climbing and elevation
  | 'heart_rate'        // NEW - HR zones, TRIMP, effort
  | 'vdot'              // NEW - fitness progression
  | 'pop_culture'       // NEW - fun references, hidden achievements
  | 'runner_culture'    // NEW - niche running community stuff
  | 'shoes'             // NEW - shoe rotation, mileage
  | 'social'            // NEW - Strava kudos, comments
  | 'cadence'           // NEW - form metrics
  | 'route'             // NEW - route variety, loyalty
  | 'duration'          // NEW - time on feet
  | 'combo'             // NEW - multi-dimensional achievements
  | 'secret';           // NEW - hidden achievements
```

### New Tier to Add

```typescript
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary';
```

### AchievementData Interface Extensions Needed

```typescript
export interface AchievementData {
  workouts: Workout[];
  currentStreak: number;
  longestStreak: number;
  // NEW fields needed:
  profile?: Profile;                    // For VDOT, birthday, age-graded BQ
  vdotHistory?: VdotHistory[];          // For fitness progression
  shoes?: Shoe[];                       // For shoe achievements
  segments?: WorkoutSegment[];          // For pacing/split analysis
  bestEfforts?: StravaBestEffort[];     // For PR detection
  fitnessSignals?: WorkoutFitnessSignal[]; // For aerobic decoupling, EF
  weeklyMileage?: { week: string; miles: number }[]; // Pre-computed
  monthlyMileage?: { month: string; miles: number }[]; // Pre-computed
}
```

### Phased Rollout Recommendation

**Phase 1 (Quick Wins - 50 achievements)**: Mileage gaps, weekly/monthly milestones, weather basics, time of day, basic pacing, shoe basics. These use existing data fields with simple computations.

**Phase 2 (Data-Rich - 80 achievements)**: HR zone mastery, VDOT progression, execution scores, negative splits, elevation climbing, cadence. These need segment data and fitness signals.

**Phase 3 (Culture & Fun - 60 achievements)**: Pop culture references, hidden achievements, combo achievements, holiday running, runner culture niche stuff. These are the "delight" layer.

**Phase 4 (Social & Routes - 30 achievements)**: Route loyalty/variety, Strava social, location-based, multi-state running. These need route matching and geo clustering.

---

## Research Sources

- [Strava Community Guide to Badges](https://communityhub.strava.com/welcome-tour-88/community-guide-to-badges-3285)
- [Strava Trophy Case](https://support.strava.com/hc/en-us/articles/216918557-The-Strava-Trophy-Case)
- [Garmin Connect Badges Guide](https://www.wareable.com/garmin/garmin-badges-guide-list-6404)
- [Garmin Badge Database](https://garminbadges.com/)
- [The 25 Garmin Connect Badges You Never Knew You Needed](https://www.garmin.com/en-US/blog/fitness/the-25-garmin-connect-badges-you-never-knew-you-needed/)
- [Nike Run Club Gamification Case Study](https://trophy.so/blog/nike-run-club-gamification-case-study)
- [Complete List of Peloton Badges](https://www.pelobuddy.com/list-peloton-badges/)
- [Peloton Milestones and Badges](https://www.onepeloton.com/blog/milestones)
- [Psychology of Achievements, Trophies, and Badges](https://www.psychologyofgames.com/2016/07/why-do-achievements-trophies-and-badges-work/)
- [The Overjustification Effect and Game Achievements](https://www.psychologyofgames.com/2016/10/the-overjustification-effect-and-game-achievements/)
- [Achievement Systems Explained (Academic Paper)](https://www.researchgate.net/publication/273455882_Achievement_Systems_Explained)
- [Designing Achievements for Optimal User Engagement](https://trophy.so/blog/designing-achievements-for-optimal-user-engagement)
- [Psychology of Achievement Hunting](https://nerdbot.com/2025/06/27/the-psychology-of-achievement-hunting-why-gamers-chase-the-hardest-trophies/)
- [Running Achievements (Smadges) App](https://apps.apple.com/us/app/running-achievements-smadges/id1478043600)
- [Everesting Achievement Badges](https://everesting.com/achievement-badges/)
- [BadgeHero.io - Garmin Badge Tracker](https://www.badgehero.io/)
- [Negative Split Pacing Research](https://pmc.ncbi.nlm.nih.gov/articles/PMC12307312/)
- [Kipchoge Sub-2-Hour Marathon](https://www.ineos159challenge.com/news/history-is-made-as-eliud-kipchoge-becomes-first-human-to-break-the-two-hour-marathon-barrier/)
- [Turkey Trot History](https://thehustle.co/thanksgiving-turkey-trot)
- [BQ Qualifying Standards](https://www.baa.org/races/boston-marathon/qualify/)
