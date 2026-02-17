import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userSettings, shoes, workouts, assessments, races, raceResults, clothingItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// Helper functions
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals: number = 1): number {
  const val = Math.random() * (max - min) + min;
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function calculateTrainingLoad(durationMinutes: number, intensity: number): number {
  return Math.round(durationMinutes * intensity * intensity * 100 / 60);
}

export async function POST(request: NextRequest) {
  // Simple auth - require secret key
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  // Use environment variable or fallback for demo
  const secretKey = process.env.SEED_SECRET_KEY || 'demo-seed-2024';

  if (key !== secretKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Clear existing data
    await db.delete(assessments);
    await db.delete(workouts);
    await db.delete(races);
    await db.delete(raceResults);
    await db.delete(shoes);
    await db.delete(clothingItems);

    // Seed user settings
    const existingSettings = await db.select().from(userSettings).limit(1);

    if (existingSettings.length > 0) {
      await db.update(userSettings).set({
        name: 'Demo Runner',
        runnerPersona: 'self_coached',
        latitude: 40.7128,
        longitude: -74.0060,
        cityName: 'New York, NY',
        currentWeeklyMileage: 35,
        currentLongRunMax: 14,
        runsPerWeekCurrent: 5,
        runsPerWeekTarget: 5,
        peakWeeklyMileageTarget: 50,
        weeklyVolumeTargetMiles: 40,
        preferredLongRunDay: 'sunday',
        preferredQualityDays: JSON.stringify(['tuesday', 'thursday']),
        requiredRestDays: JSON.stringify(['friday']),
        planAggressiveness: 'moderate',
        qualitySessionsPerWeek: 2,
        openToDoubles: false,
        vdot: 48,
        defaultTargetPaceSeconds: 480,
        easyPaceSeconds: 540,
        tempoPaceSeconds: 420,
        thresholdPaceSeconds: 400,
        intervalPaceSeconds: 360,
        marathonPaceSeconds: 450,
        halfMarathonPaceSeconds: 420,
        marathonPrSeconds: 12600,
        halfMarathonPrSeconds: 5700,
        tenKPrSeconds: 2580,
        fiveKPrSeconds: 1200,
        yearsRunning: 5,
        age: 34,
        gender: 'male',
        heightInches: 70,
        weightLbs: 165,
        restingHr: 52,
        heatAcclimatizationScore: 70,
        temperaturePreference: 'neutral',
        temperaturePreferenceScale: 5,
        heatSensitivity: 3,
        coldSensitivity: 2,
        typicalSleepHours: 7.5,
        sleepQuality: 'good',
        stressLevel: 'moderate',
        trainBy: 'pace',
        surfacePreference: 'road',
        groupVsSolo: 'solo',
        preferredRunTime: 'morning',
        weekdayAvailabilityMinutes: 60,
        weekendAvailabilityMinutes: 150,
        comfortVo2max: 3,
        comfortTempo: 4,
        comfortHills: 3,
        comfortLongRuns: 5,
        comfortTrackWork: 3,
        speedworkExperience: 'intermediate',
        coachName: 'Coach Dreamy',
        coachColor: 'blue',
        coachPersona: 'encouraging',
        onboardingCompleted: true,
        onboardingStep: 10,
      }).where(eq(userSettings.id, existingSettings[0].id));
    } else {
      await db.insert(userSettings).values({
        name: 'Demo Runner',
        runnerPersona: 'self_coached',
        latitude: 40.7128,
        longitude: -74.0060,
        cityName: 'New York, NY',
        currentWeeklyMileage: 35,
        currentLongRunMax: 14,
        runsPerWeekCurrent: 5,
        runsPerWeekTarget: 5,
        peakWeeklyMileageTarget: 50,
        weeklyVolumeTargetMiles: 40,
        preferredLongRunDay: 'sunday',
        preferredQualityDays: JSON.stringify(['tuesday', 'thursday']),
        requiredRestDays: JSON.stringify(['friday']),
        planAggressiveness: 'moderate',
        qualitySessionsPerWeek: 2,
        openToDoubles: false,
        vdot: 48,
        defaultTargetPaceSeconds: 480,
        easyPaceSeconds: 540,
        tempoPaceSeconds: 420,
        thresholdPaceSeconds: 400,
        intervalPaceSeconds: 360,
        marathonPaceSeconds: 450,
        halfMarathonPaceSeconds: 420,
        marathonPrSeconds: 12600,
        halfMarathonPrSeconds: 5700,
        tenKPrSeconds: 2580,
        fiveKPrSeconds: 1200,
        yearsRunning: 5,
        age: 34,
        gender: 'male',
        heightInches: 70,
        weightLbs: 165,
        restingHr: 52,
        heatAcclimatizationScore: 70,
        temperaturePreference: 'neutral',
        temperaturePreferenceScale: 5,
        heatSensitivity: 3,
        coldSensitivity: 2,
        typicalSleepHours: 7.5,
        sleepQuality: 'good',
        stressLevel: 'moderate',
        trainBy: 'pace',
        surfacePreference: 'road',
        groupVsSolo: 'solo',
        preferredRunTime: 'morning',
        weekdayAvailabilityMinutes: 60,
        weekendAvailabilityMinutes: 150,
        comfortVo2max: 3,
        comfortTempo: 4,
        comfortHills: 3,
        comfortLongRuns: 5,
        comfortTrackWork: 3,
        speedworkExperience: 'intermediate',
        coachName: 'Coach Dreamy',
        coachColor: 'blue',
        coachPersona: 'encouraging',
        onboardingCompleted: true,
        onboardingStep: 10,
      });
    }

    // Seed shoes
    const shoeData = [
      { name: 'Nike Pegasus 40', brand: 'Nike', model: 'Pegasus 40', category: 'daily_trainer', totalMiles: 312.5 },
      { name: 'Saucony Endorphin Speed 3', brand: 'Saucony', model: 'Endorphin Speed 3', category: 'tempo', totalMiles: 156.2 },
      { name: 'Nike Vaporfly Next% 2', brand: 'Nike', model: 'Vaporfly Next% 2', category: 'race', totalMiles: 67.3 },
      { name: 'Brooks Ghost 15', brand: 'Brooks', model: 'Ghost 15', category: 'recovery', totalMiles: 425.8 },
    ];

    const insertedShoes = await db.insert(shoes).values(shoeData.map(s => ({
      ...s,
      isRetired: false,
    }))).returning();

    const shoeMap: Record<string, number> = {};
    insertedShoes.forEach((s, i) => {
      shoeMap[shoeData[i].category] = s.id;
    });

    // Seed 90+ days of workouts
    const workoutData: Array<{
      daysAgo: number;
      type: string;
      distance: number;
      intensity: number;
      shoeCategory: string;
      hr: number;
    }> = [];

    for (let week = 0; week < 13; week++) {
      const weekStart = week * 7;
      const isDownWeek = week % 4 === 3;
      const weekMultiplier = isDownWeek ? 0.7 : 1 + (week * 0.02);

      // Monday - Easy
      workoutData.push({
        daysAgo: 90 - weekStart,
        type: 'easy',
        distance: randFloat(4.5, 6, 1) * weekMultiplier,
        intensity: 0.55,
        shoeCategory: 'daily_trainer',
        hr: rand(135, 145),
      });

      // Tuesday - Quality
      const tuesdayType = week % 2 === 0 ? 'tempo' : 'interval';
      workoutData.push({
        daysAgo: 90 - weekStart - 1,
        type: tuesdayType,
        distance: randFloat(5.5, 7, 1) * (isDownWeek ? 0.75 : 1),
        intensity: tuesdayType === 'tempo' ? 0.85 : 0.92,
        shoeCategory: 'tempo',
        hr: tuesdayType === 'tempo' ? rand(160, 170) : rand(168, 178),
      });

      // Wednesday - Easy
      workoutData.push({
        daysAgo: 90 - weekStart - 2,
        type: 'easy',
        distance: randFloat(4, 5.5, 1) * weekMultiplier,
        intensity: 0.55,
        shoeCategory: 'daily_trainer',
        hr: rand(132, 142),
      });

      // Thursday - Quality
      const thursdayType = week % 2 === 0 ? 'interval' : 'tempo';
      workoutData.push({
        daysAgo: 90 - weekStart - 3,
        type: thursdayType,
        distance: randFloat(5, 6.5, 1) * (isDownWeek ? 0.75 : 1),
        intensity: thursdayType === 'tempo' ? 0.85 : 0.90,
        shoeCategory: 'tempo',
        hr: rand(162, 172),
      });

      // Friday - Recovery (sometimes)
      if (Math.random() > 0.6) {
        workoutData.push({
          daysAgo: 90 - weekStart - 4,
          type: 'recovery',
          distance: randFloat(2.5, 3.5, 1),
          intensity: 0.45,
          shoeCategory: 'recovery',
          hr: rand(120, 130),
        });
      }

      // Saturday - Easy/Steady
      workoutData.push({
        daysAgo: 90 - weekStart - 5,
        type: Math.random() > 0.5 ? 'easy' : 'steady',
        distance: randFloat(5, 7, 1) * weekMultiplier,
        intensity: 0.60,
        shoeCategory: 'daily_trainer',
        hr: rand(140, 150),
      });

      // Sunday - Long run
      const longRunDistance = isDownWeek
        ? randFloat(8, 10, 1)
        : Math.min(randFloat(12, 16, 1) * (1 + week * 0.03), 18);
      workoutData.push({
        daysAgo: 90 - weekStart - 6,
        type: 'long',
        distance: longRunDistance,
        intensity: 0.65,
        shoeCategory: 'daily_trainer',
        hr: rand(145, 158),
      });
    }

    // Add a 10K race 45 days ago
    workoutData.push({
      daysAgo: 45,
      type: 'race',
      distance: 6.21,
      intensity: 1.0,
      shoeCategory: 'race',
      hr: rand(175, 182),
    });

    // Add a 5K race 30 days ago
    workoutData.push({
      daysAgo: 30,
      type: 'race',
      distance: 3.11,
      intensity: 1.0,
      shoeCategory: 'race',
      hr: rand(178, 185),
    });

    const verdicts = ['great', 'good', 'good', 'good', 'fine', 'fine', 'rough'] as const;
    const breathingFeels = ['easy', 'easy', 'controlled', 'controlled', 'hard'] as const;
    const timeOfRuns = ['early_morning', 'morning', 'morning', 'morning', 'evening'] as const;

    // Sort by date
    workoutData.sort((a, b) => b.daysAgo - a.daysAgo);

    let workoutCount = 0;
    for (const w of workoutData) {
      if (w.daysAgo < 0) continue;

      const paceBase = w.type === 'easy' ? 540 : w.type === 'recovery' ? 600 :
                       w.type === 'long' ? 530 : w.type === 'tempo' ? 420 :
                       w.type === 'interval' ? 380 : w.type === 'race' ? 390 : 500;
      const pace = paceBase + rand(-15, 15);
      const duration = Math.round((w.distance * pace) / 60);
      const trainingLoad = calculateTrainingLoad(duration, w.intensity);
      const seasonTemp = w.daysAgo > 60 ? rand(35, 50) : w.daysAgo > 30 ? rand(45, 65) : rand(55, 75);

      const [insertedWorkout] = await db.insert(workouts).values({
        date: daysAgo(w.daysAgo),
        distanceMiles: w.distance,
        durationMinutes: duration,
        avgPaceSeconds: pace,
        workoutType: w.type,
        shoeId: shoeMap[w.shoeCategory] || null,
        source: 'demo',
        avgHeartRate: w.hr,
        elevationGainFeet: rand(50, 300),
        trainingLoad,
        weatherTempF: seasonTemp,
        weatherHumidityPct: rand(40, 80),
        weatherWindMph: rand(0, 15),
      }).returning();

      const rpeBase = Math.round(w.intensity * 10);
      const rpe = Math.min(10, Math.max(1, rpeBase + rand(-1, 1)));

      await db.insert(assessments).values({
        workoutId: insertedWorkout.id,
        verdict: verdicts[rand(0, verdicts.length - 1)],
        rpe,
        legsFeel: rand(5, 8),
        sleepQuality: rand(5, 9),
        stress: rand(2, 6),
        soreness: rand(2, 5),
        mood: rand(6, 9),
        breathingFeel: breathingFeels[Math.min(Math.floor(w.intensity * 5), breathingFeels.length - 1)],
        wasIntendedWorkout: 'yes',
        timeOfRun: timeOfRuns[rand(0, timeOfRuns.length - 1)],
      });

      workoutCount++;
    }

    // Seed races
    await db.insert(races).values([
      {
        name: 'Brooklyn Half Marathon',
        date: daysFromNow(70),
        distanceMeters: 21097,
        distanceLabel: 'Half Marathon',
        priority: 'A',
        targetTimeSeconds: 5400,
        targetPaceSecondsPerMile: 412,
        location: 'Brooklyn, NY',
        notes: 'Goal: Sub-1:30',
      },
      {
        name: 'Central Park 10K',
        date: daysFromNow(28),
        distanceMeters: 10000,
        distanceLabel: '10K',
        priority: 'B',
        targetTimeSeconds: 2520,
        targetPaceSecondsPerMile: 406,
        location: 'New York, NY',
      },
      {
        name: 'NYRR 5K',
        date: daysFromNow(14),
        distanceMeters: 5000,
        distanceLabel: '5K',
        priority: 'C',
        targetTimeSeconds: 1170,
        location: 'Central Park, NY',
      },
    ]);

    // Seed race results
    await db.insert(raceResults).values([
      {
        raceName: 'NYC Runs 10K',
        date: daysAgo(45),
        distanceMeters: 10000,
        distanceLabel: '10K',
        finishTimeSeconds: 2580,
        calculatedVdot: 48.2,
        effortLevel: 'all_out',
        conditions: JSON.stringify({ temp: 55, conditions: 'clear' }),
        notes: 'PR! Felt great.',
      },
      {
        raceName: 'Turkey Trot 5K',
        date: daysAgo(90),
        distanceMeters: 5000,
        distanceLabel: '5K',
        finishTimeSeconds: 1200,
        calculatedVdot: 48.0,
        effortLevel: 'all_out',
        conditions: JSON.stringify({ temp: 42, conditions: 'cloudy' }),
      },
      {
        raceName: 'Philadelphia Half',
        date: daysAgo(180),
        distanceMeters: 21097,
        distanceLabel: 'Half Marathon',
        finishTimeSeconds: 5700,
        calculatedVdot: 47.5,
        effortLevel: 'all_out',
        conditions: JSON.stringify({ temp: 48, conditions: 'rain' }),
        notes: 'Tough conditions but happy with result',
      },
      {
        raceName: 'NYC Marathon',
        date: daysAgo(365),
        distanceMeters: 42195,
        distanceLabel: 'Marathon',
        finishTimeSeconds: 12600,
        calculatedVdot: 46.8,
        effortLevel: 'all_out',
        conditions: JSON.stringify({ temp: 52, conditions: 'clear' }),
        notes: 'First marathon! Bonked at mile 22 but finished strong.',
      },
    ]);

    // Seed wardrobe
    await db.insert(clothingItems).values([
      { name: 'Nike Dri-FIT Tee', category: 'top_short_sleeve', warmthRating: 1, isActive: true },
      { name: 'Tracksmith Van Cortlandt Singlet', category: 'top_short_sleeve', warmthRating: 1, isActive: true },
      { name: 'Lululemon Swiftly LS', category: 'top_long_sleeve_thin', warmthRating: 2, isActive: true },
      { name: 'Tracksmith Brighton Base Layer', category: 'top_long_sleeve_standard', warmthRating: 3, isActive: true },
      { name: 'Nike Element Half-Zip', category: 'outer_quarter_zip', warmthRating: 3, isActive: true },
      { name: 'Patagonia Houdini', category: 'outer_shell', warmthRating: 2, isActive: true },
      { name: 'Nike 5" Flex Stride', category: 'bottom_shorts', warmthRating: 1, isActive: true },
      { name: 'Nike Phenom Tights', category: 'bottom_leggings', warmthRating: 4, isActive: true },
      { name: 'Smartwool PhD Socks', category: 'socks_thin', warmthRating: 1, isActive: true },
      { name: 'Nike Fleece Beanie', category: 'beanie', warmthRating: 4, isActive: true },
      { name: 'Nike Lightweight Gloves', category: 'gloves_thin', warmthRating: 2, isActive: true },
    ]);

    return NextResponse.json({
      success: true,
      message: 'Demo data seeded successfully',
      stats: {
        workouts: workoutCount,
        shoes: shoeData.length,
        races: 3,
        raceResults: 4,
        clothingItems: 11,
      },
    });

  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Also support GET for easy browser testing
export async function GET(request: NextRequest) {
  return POST(request);
}
