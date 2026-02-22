'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, Zap, Droplets, Clock, ChevronDown, ChevronUp, Coffee, Info } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type RaceDistance = '5k' | '10k' | 'half' | 'marathon' | 'ultra' | 'custom';
type WeatherCondition = 'cool' | 'moderate' | 'warm' | 'hot';
type FuelingExperience = 'beginner' | 'intermediate' | 'advanced';
type WeightUnit = 'lbs' | 'kg';

interface FuelingInputs {
  raceDistance: RaceDistance;
  customDistanceMiles: number;
  targetHours: number;
  targetMinutes: number;
  targetSeconds: number;
  bodyWeight: number;
  weightUnit: WeightUnit;
  weather: WeatherCondition;
  experience: FuelingExperience;
}

interface TimelineItem {
  timeMinutes: number;
  mile: number;
  action: string;
  detail: string;
  type: 'carb' | 'fluid' | 'caffeine' | 'electrolyte';
}

interface FuelingPlan {
  totalTimeMinutes: number;
  distanceMiles: number;
  pacePerMile: string;
  estimatedCalorieBurn: number;
  carbsPerHour: number;
  totalCarbsGrams: number;
  fluidPerHourMl: number;
  totalFluidMl: number;
  sodiumPerHourMg: number;
  totalSodiumMg: number;
  caffeineMg: number;
  caffeineTimingMinutes: number;
  timeline: TimelineItem[];
  preRacePlan: string[];
  nightBeforePlan: string[];
  productSuggestions: ProductSuggestion[];
  practiceSchedule: string[];
}

interface ProductSuggestion {
  category: string;
  examples: string[];
  carbsPerServing: number;
  notes: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RACE_DISTANCES: Record<RaceDistance, { label: string; miles: number }> = {
  '5k': { label: '5K', miles: 3.107 },
  '10k': { label: '10K', miles: 6.214 },
  half: { label: 'Half Marathon', miles: 13.109 },
  marathon: { label: 'Marathon', miles: 26.219 },
  ultra: { label: '50K Ultra', miles: 31.069 },
  custom: { label: 'Custom', miles: 0 },
};

const WEATHER_OPTIONS: { value: WeatherCondition; label: string; temp: string }[] = [
  { value: 'cool', label: 'Cool', temp: '< 55°F / 13°C' },
  { value: 'moderate', label: 'Moderate', temp: '55-70°F / 13-21°C' },
  { value: 'warm', label: 'Warm', temp: '70-85°F / 21-29°C' },
  { value: 'hot', label: 'Hot', temp: '> 85°F / 29°C' },
];

const EXPERIENCE_OPTIONS: { value: FuelingExperience; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'New to race fueling or have had GI issues' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Practiced fueling on some long runs' },
  { value: 'advanced', label: 'Advanced', desc: 'Dialed-in gut training, tolerate high carb intake' },
];

// ─── Calculation Engine ──────────────────────────────────────────────────────

function getDistanceMiles(inputs: FuelingInputs): number {
  if (inputs.raceDistance === 'custom') return inputs.customDistanceMiles;
  return RACE_DISTANCES[inputs.raceDistance].miles;
}

function getTotalTimeMinutes(inputs: FuelingInputs): number {
  return inputs.targetHours * 60 + inputs.targetMinutes + inputs.targetSeconds / 60;
}

function getWeightKg(inputs: FuelingInputs): number {
  return inputs.weightUnit === 'kg' ? inputs.bodyWeight : inputs.bodyWeight * 0.4536;
}

function getFluidAdjustment(weather: WeatherCondition): number {
  switch (weather) {
    case 'cool': return 0;
    case 'moderate': return 0;
    case 'warm': return 200;
    case 'hot': return 300;
  }
}

function getCarbRange(totalTimeMinutes: number, experience: FuelingExperience): { min: number; max: number; target: number } {
  const hours = totalTimeMinutes / 60;

  if (hours < 1) {
    // Under 1 hour: mouth rinse only, minimal intake
    return { min: 0, max: 15, target: 0 };
  } else if (hours < 1.5) {
    // 1-1.5 hours: small amounts help
    return { min: 15, max: 30, target: experience === 'beginner' ? 15 : 25 };
  } else if (hours < 2.5) {
    // 1.5-2.5 hours: moderate carbs
    const base = { min: 30, max: 60 };
    const target = experience === 'beginner' ? 30 : experience === 'intermediate' ? 45 : 55;
    return { ...base, target };
  } else {
    // 2.5+ hours: high carbs (current research supports 90-120g/hr for trained guts)
    const base = { min: 60, max: 90 };
    const target = experience === 'beginner' ? 60 : experience === 'intermediate' ? 75 : 90;
    return { ...base, target };
  }
}

function formatPace(totalMinutes: number, miles: number): string {
  const paceMinutes = totalMinutes / miles;
  const min = Math.floor(paceMinutes);
  const sec = Math.round((paceMinutes - min) * 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatTime(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hrs === 0) return `${mins}min`;
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
}

function buildTimeline(
  distanceMiles: number,
  totalTimeMinutes: number,
  carbsPerHour: number,
  fluidPerHourMl: number,
  caffeineMg: number,
  experience: FuelingExperience,
): TimelineItem[] {
  const timeline: TimelineItem[] = [];
  const paceMinPerMile = totalTimeMinutes / distanceMiles;

  // Caffeine pre-race
  if (caffeineMg > 0 && totalTimeMinutes > 60) {
    timeline.push({
      timeMinutes: -45,
      mile: 0,
      action: 'Caffeine',
      detail: `${Math.round(caffeineMg)}mg caffeine (coffee or caffeine pill) with breakfast`,
      type: 'caffeine',
    });
  }

  // For short races (under 75 min), minimal fueling needed
  if (totalTimeMinutes < 75) {
    timeline.push({
      timeMinutes: 0,
      mile: 0,
      action: 'Start',
      detail: 'Sip water at aid stations if thirsty. No gels needed for this distance.',
      type: 'fluid',
    });
    if (totalTimeMinutes > 45) {
      timeline.push({
        timeMinutes: Math.round(totalTimeMinutes * 0.5),
        mile: Math.round(distanceMiles * 0.5 * 10) / 10,
        action: 'Water',
        detail: 'A few sips of water or sports drink at the aid station',
        type: 'fluid',
      });
    }
    return timeline;
  }

  // Gel size: typically ~25g carbs per gel
  const carbsPerGel = 25;
  // How often to take a gel (in minutes)
  const gelIntervalMinutes = (carbsPerGel / carbsPerHour) * 60;
  // Fluid every ~15-20 minutes
  const fluidIntervalMinutes = experience === 'beginner' ? 20 : 15;

  // Start line
  timeline.push({
    timeMinutes: 0,
    mile: 0,
    action: 'Start',
    detail: 'First 15-20 minutes: settle into pace. No fueling needed yet.',
    type: 'fluid',
  });

  // First fuel at ~20-30 min (don't wait too long)
  const firstFuelMinute = experience === 'beginner' ? 30 : 20;

  let nextGelMinute = firstFuelMinute;
  let nextFluidMinute = fluidIntervalMinutes;
  let gelCount = 0;

  for (let minute = 5; minute < totalTimeMinutes - 10; minute += 5) {
    const currentMile = Math.round((minute / paceMinPerMile) * 10) / 10;

    if (minute >= nextFluidMinute && Math.abs(minute - nextGelMinute) > 5) {
      timeline.push({
        timeMinutes: minute,
        mile: currentMile,
        action: 'Fluid',
        detail: `${Math.round(fluidPerHourMl / (60 / fluidIntervalMinutes))}ml water or sports drink`,
        type: 'fluid',
      });
      nextFluidMinute = minute + fluidIntervalMinutes;
    }

    if (minute >= nextGelMinute) {
      gelCount++;
      const gelDetail = gelCount === 1
        ? `First gel (${carbsPerGel}g carbs). Take with water, not sports drink.`
        : `Gel #${gelCount} (${carbsPerGel}g carbs). Chase with 4-6oz water.`;
      timeline.push({
        timeMinutes: minute,
        mile: currentMile,
        action: `Gel #${gelCount}`,
        detail: gelDetail,
        type: 'carb',
      });
      nextGelMinute = minute + gelIntervalMinutes;

      // Fluid with the gel
      timeline.push({
        timeMinutes: minute,
        mile: currentMile,
        action: 'Water w/ gel',
        detail: '120-180ml water to aid absorption',
        type: 'fluid',
      });
      nextFluidMinute = minute + fluidIntervalMinutes;
    }

    // Electrolyte reminder every 45-60 min
    if (minute > 0 && minute % 45 === 0 && totalTimeMinutes > 90) {
      timeline.push({
        timeMinutes: minute,
        mile: currentMile,
        action: 'Electrolytes',
        detail: 'Salt cap or electrolyte tab (~200-300mg sodium)',
        type: 'electrolyte',
      });
    }
  }

  // Last few miles: no new gels (won't absorb in time)
  const lastMileCutoff = totalTimeMinutes - (paceMinPerMile * 2);
  if (lastMileCutoff > 0 && totalTimeMinutes > 120) {
    const lastMile = Math.round((lastMileCutoff / paceMinPerMile) * 10) / 10;
    timeline.push({
      timeMinutes: Math.round(lastMileCutoff),
      mile: lastMile,
      action: 'Last fuel',
      detail: 'Final gel or chews. After this point, fueling won\'t absorb in time.',
      type: 'carb',
    });
  }

  // Caffeine boost in second half for long races
  if (totalTimeMinutes > 150 && caffeineMg > 0) {
    const boostTime = Math.round(totalTimeMinutes * 0.6);
    const boostMile = Math.round((boostTime / paceMinPerMile) * 10) / 10;
    timeline.push({
      timeMinutes: boostTime,
      mile: boostMile,
      action: 'Caffeine boost',
      detail: `${Math.round(caffeineMg * 0.3)}mg via caffeinated gel for the final push`,
      type: 'caffeine',
    });
  }

  // Sort by time
  timeline.sort((a, b) => a.timeMinutes - b.timeMinutes);

  return timeline;
}

function calculateFuelingPlan(inputs: FuelingInputs): FuelingPlan | null {
  const distanceMiles = getDistanceMiles(inputs);
  const totalTimeMinutes = getTotalTimeMinutes(inputs);
  const weightKg = getWeightKg(inputs);

  if (distanceMiles <= 0 || totalTimeMinutes <= 0 || weightKg <= 0) return null;

  const totalTimeHours = totalTimeMinutes / 60;
  const pacePerMile = formatPace(totalTimeMinutes, distanceMiles);

  // Calorie burn: ~1 kcal/kg/km is a well-established approximation
  const distanceKm = distanceMiles * 1.60934;
  const estimatedCalorieBurn = Math.round(weightKg * distanceKm);

  // Carb targets
  const carbRange = getCarbRange(totalTimeMinutes, inputs.experience);
  const carbsPerHour = carbRange.target;
  const totalCarbsGrams = Math.round(carbsPerHour * totalTimeHours);

  // Fluid targets: 400-800ml/hr base, adjusted for heat
  const baseFluidMl = inputs.experience === 'beginner' ? 500 : 600;
  const fluidPerHourMl = baseFluidMl + getFluidAdjustment(inputs.weather);
  const totalFluidMl = Math.round(fluidPerHourMl * totalTimeHours);

  // Sodium: ~500-700mg/hr, higher in heat
  const baseSodiumMg = 500;
  const sodiumHeatAdj = inputs.weather === 'warm' ? 100 : inputs.weather === 'hot' ? 200 : 0;
  const sodiumPerHourMg = baseSodiumMg + sodiumHeatAdj;
  const totalSodiumMg = Math.round(sodiumPerHourMg * totalTimeHours);

  // Caffeine: 3-6mg/kg, adjusted by experience
  const caffeineMultiplier = inputs.experience === 'beginner' ? 3 : inputs.experience === 'intermediate' ? 4 : 5;
  const caffeineMg = totalTimeMinutes > 60 ? Math.round(caffeineMultiplier * weightKg) : 0;
  const caffeineTimingMinutes = 45; // 30-60min pre-race

  // Build timeline
  const timeline = buildTimeline(
    distanceMiles,
    totalTimeMinutes,
    carbsPerHour,
    fluidPerHourMl,
    caffeineMg,
    inputs.experience,
  );

  // Pre-race plan
  const nightBeforePlan = [
    'Carb-rich dinner: pasta, rice, or potatoes with lean protein',
    `Target ~3-4g carbs/kg body weight (~${Math.round(weightKg * 3.5)}g carbs)`,
    'Avoid high-fiber, high-fat, or new/unusual foods',
    'Hydrate well but don\'t overdo it — urine should be pale yellow',
    'Set out all race nutrition the night before',
  ];

  const preRacePlan = [
    `Eat breakfast 2-3 hours before: ~${Math.round(weightKg * 1.5)}g carbs (e.g., oatmeal, toast, banana)`,
    'Sip 400-600ml water in the 2 hours before the start',
    caffeineMg > 0 ? `${Math.round(caffeineMg)}mg caffeine 30-60 min before gun time` : '',
    'Avoid fat and fiber in pre-race meal',
    totalTimeMinutes > 120 ? 'Consider a small carb top-up (gel or sports drink) 10-15 min before start' : '',
    'Stop drinking large amounts 30 min before start to avoid mid-race bathroom stops',
  ].filter(Boolean);

  // Product suggestions
  const productSuggestions: ProductSuggestion[] = [];

  if (totalTimeMinutes > 75) {
    productSuggestions.push({
      category: 'Energy Gels',
      examples: ['GU Energy Gel', 'Maurten Gel 100', 'SiS GO Isotonic', 'Huma Chia Gel', 'Spring Energy'],
      carbsPerServing: 25,
      notes: inputs.experience === 'beginner'
        ? 'Start with isotonic gels (SiS, Maurten) — easier on the stomach'
        : 'Choose what you\'ve trained with. Maurten and SiS are popular for sensitive stomachs.',
    });

    productSuggestions.push({
      category: 'Energy Chews',
      examples: ['Clif Bloks', 'GU Chews', 'Skratch Chews', 'Gatorade Endurance Chews'],
      carbsPerServing: 24,
      notes: 'Good alternative if you don\'t like gel texture. Take 2-3 chews per serving.',
    });

    productSuggestions.push({
      category: 'Sports Drink',
      examples: ['Maurten 320', 'Skratch Labs', 'Gatorade Endurance', 'Tailwind', 'LMNT + carb source'],
      carbsPerServing: 30,
      notes: 'Counts toward both carb AND fluid intake. Don\'t mix with gel intake or you risk too much sugar at once.',
    });
  }

  if (totalTimeMinutes > 90) {
    productSuggestions.push({
      category: 'Electrolytes',
      examples: ['SaltStick Caps', 'LMNT', 'Precision Fuel & Hydration', 'Nuun Sport'],
      carbsPerServing: 0,
      notes: `Target ~${sodiumPerHourMg}mg sodium/hr. Many gels contain some sodium already.`,
    });
  }

  // Practice schedule
  const practiceSchedule = [
    'Start practicing fueling on runs longer than 60-75 minutes',
    `Week 1-2: Try ${carbRange.min}g carbs/hr on long runs to assess tolerance`,
    `Week 3-4: Increase to ${carbRange.target}g carbs/hr. Practice taking gels at race pace.`,
    'Practice with the EXACT products available on your race course (check race website)',
    'Simulate race-day breakfast timing on your longest training runs',
    'If you experience GI issues, try isotonic gels or reduce fiber 24hr before long runs',
    totalTimeMinutes > 150
      ? 'For marathon+: do at least 2-3 long runs with full race-day fueling protocol'
      : 'Do at least 1-2 long runs with your full fueling plan before race day',
  ];

  return {
    totalTimeMinutes,
    distanceMiles,
    pacePerMile,
    estimatedCalorieBurn,
    carbsPerHour,
    totalCarbsGrams,
    fluidPerHourMl,
    totalFluidMl,
    sodiumPerHourMg,
    totalSodiumMg,
    caffeineMg,
    caffeineTimingMinutes,
    timeline,
    preRacePlan,
    nightBeforePlan,
    productSuggestions,
    practiceSchedule,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FuelingPage() {
  const [inputs, setInputs] = useState<FuelingInputs>({
    raceDistance: 'marathon',
    customDistanceMiles: 50,
    targetHours: 3,
    targetMinutes: 30,
    targetSeconds: 0,
    bodyWeight: 160,
    weightUnit: 'lbs',
    weather: 'moderate',
    experience: 'intermediate',
  });

  const [showPlan, setShowPlan] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    timeline: true,
    prerace: false,
    products: false,
    practice: false,
  });

  const plan = useMemo(() => {
    if (!showPlan) return null;
    return calculateFuelingPlan(inputs);
  }, [showPlan, inputs]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const update = (partial: Partial<FuelingInputs>) => {
    setInputs(prev => ({ ...prev, ...partial }));
    setShowPlan(false);
  };

  const distanceMiles = getDistanceMiles(inputs);
  const totalTimeMinutes = getTotalTimeMinutes(inputs);

  // Smart default times when switching distances
  const handleDistanceChange = (dist: RaceDistance) => {
    const defaults: Record<RaceDistance, { h: number; m: number }> = {
      '5k': { h: 0, m: 25 },
      '10k': { h: 0, m: 52 },
      half: { h: 1, m: 45 },
      marathon: { h: 3, m: 30 },
      ultra: { h: 5, m: 0 },
      custom: { h: 4, m: 0 },
    };
    const d = defaults[dist];
    setInputs(prev => ({
      ...prev,
      raceDistance: dist,
      targetHours: d.h,
      targetMinutes: d.m,
      targetSeconds: 0,
    }));
    setShowPlan(false);
  };

  const typeIconColor = (type: TimelineItem['type']) => {
    switch (type) {
      case 'carb': return 'text-[#ffab40]';
      case 'fluid': return 'text-[#40c4ff]';
      case 'caffeine': return 'text-[#b388ff]';
      case 'electrolyte': return 'text-[#69f0ae]';
    }
  };

  const typeBgColor = (type: TimelineItem['type']) => {
    switch (type) {
      case 'carb': return 'bg-[#ffab40]/10';
      case 'fluid': return 'bg-[#40c4ff]/10';
      case 'caffeine': return 'bg-[#b388ff]/10';
      case 'electrolyte': return 'bg-[#69f0ae]/10';
    }
  };

  return (
    <div className="min-h-screen bg-bgTertiary">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/tools"
            className="flex items-center gap-2 text-textSecondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tools</span>
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-primary mb-2">Race Fueling Planner</h1>
        <p className="text-textSecondary mb-8">
          Build a personalized fueling strategy for race day. Based on current sports science research
          on carbohydrate oxidation, hydration, and electrolyte replacement.
        </p>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* ─── Inputs Panel ─────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Race Distance */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Race Distance
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(RACE_DISTANCES) as [RaceDistance, { label: string; miles: number }][]).map(
                  ([value, { label }]) => (
                    <button
                      key={value}
                      onClick={() => handleDistanceChange(value)}
                      className={cn(
                        'py-2 px-3 rounded-lg border-2 font-medium transition-all text-sm',
                        inputs.raceDistance === value
                          ? 'border-[#ffab40] bg-[#ffab40]/10 text-[#ffab40]'
                          : 'border-borderPrimary hover:border-[#ffab40]/40 text-textSecondary'
                      )}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
              {inputs.raceDistance === 'custom' && (
                <div className="mt-3">
                  <label className="block text-xs text-textTertiary mb-1">Distance (miles)</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    step="0.1"
                    value={inputs.customDistanceMiles}
                    onChange={(e) => update({ customDistanceMiles: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-3 py-2 bg-bgSecondary border border-borderPrimary rounded-lg focus:ring-2 focus:ring-[#ffab40] focus:border-[#ffab40] text-textPrimary text-center"
                  />
                </div>
              )}
            </div>

            {/* Target Time */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Target Finish Time
              </label>
              <div className="flex gap-2 items-end">
                <div>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={inputs.targetHours}
                    onChange={(e) => update({ targetHours: parseInt(e.target.value) || 0 })}
                    className="w-16 px-3 py-2 bg-bgSecondary border border-borderPrimary rounded-lg focus:ring-2 focus:ring-[#ffab40] focus:border-[#ffab40] text-textPrimary text-center"
                  />
                  <p className="text-xs text-textTertiary text-center mt-1">hrs</p>
                </div>
                <span className="text-2xl text-textTertiary mb-2">:</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={inputs.targetMinutes}
                    onChange={(e) => update({ targetMinutes: parseInt(e.target.value) || 0 })}
                    className="w-16 px-3 py-2 bg-bgSecondary border border-borderPrimary rounded-lg focus:ring-2 focus:ring-[#ffab40] focus:border-[#ffab40] text-textPrimary text-center"
                  />
                  <p className="text-xs text-textTertiary text-center mt-1">min</p>
                </div>
                <span className="text-2xl text-textTertiary mb-2">:</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={inputs.targetSeconds}
                    onChange={(e) => update({ targetSeconds: parseInt(e.target.value) || 0 })}
                    className="w-16 px-3 py-2 bg-bgSecondary border border-borderPrimary rounded-lg focus:ring-2 focus:ring-[#ffab40] focus:border-[#ffab40] text-textPrimary text-center"
                  />
                  <p className="text-xs text-textTertiary text-center mt-1">sec</p>
                </div>
              </div>
              {distanceMiles > 0 && totalTimeMinutes > 0 && (
                <p className="text-xs text-textTertiary mt-2">
                  Pace: {formatPace(totalTimeMinutes, distanceMiles)}/mi
                </p>
              )}
            </div>

            {/* Body Weight */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Body Weight
              </label>
              <div className="flex gap-2 items-end">
                <input
                  type="number"
                  min="50"
                  max="400"
                  value={inputs.bodyWeight}
                  onChange={(e) => update({ bodyWeight: parseFloat(e.target.value) || 0 })}
                  className="w-24 px-3 py-2 bg-bgSecondary border border-borderPrimary rounded-lg focus:ring-2 focus:ring-[#ffab40] focus:border-[#ffab40] text-textPrimary text-center"
                />
                <div className="flex border border-borderPrimary rounded-lg overflow-hidden">
                  {(['lbs', 'kg'] as WeightUnit[]).map(unit => (
                    <button
                      key={unit}
                      onClick={() => {
                        if (unit === inputs.weightUnit) return;
                        const converted = unit === 'kg'
                          ? Math.round(inputs.bodyWeight * 0.4536)
                          : Math.round(inputs.bodyWeight / 0.4536);
                        update({ weightUnit: unit, bodyWeight: converted });
                      }}
                      className={cn(
                        'px-3 py-2 text-sm font-medium transition-colors',
                        inputs.weightUnit === unit
                          ? 'bg-[#ffab40]/20 text-[#ffab40]'
                          : 'bg-bgSecondary text-textTertiary hover:text-textSecondary'
                      )}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Weather */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Expected Weather
              </label>
              <div className="grid grid-cols-2 gap-2">
                {WEATHER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update({ weather: opt.value })}
                    className={cn(
                      'py-2 px-3 rounded-lg border-2 text-left transition-all',
                      inputs.weather === opt.value
                        ? 'border-[#ffab40] bg-[#ffab40]/10'
                        : 'border-borderPrimary hover:border-[#ffab40]/40'
                    )}
                  >
                    <p className={cn(
                      'text-sm font-medium',
                      inputs.weather === opt.value ? 'text-[#ffab40]' : 'text-textSecondary'
                    )}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-textTertiary">{opt.temp}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Experience */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Fueling Experience
              </label>
              <div className="space-y-2">
                {EXPERIENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update({ experience: opt.value })}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border-2 transition-all',
                      inputs.experience === opt.value
                        ? 'border-[#ffab40] bg-[#ffab40]/10'
                        : 'border-borderPrimary hover:border-[#ffab40]/40'
                    )}
                  >
                    <p className={cn(
                      'font-medium text-sm',
                      inputs.experience === opt.value ? 'text-[#ffab40]' : 'text-textSecondary'
                    )}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-textTertiary mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={() => setShowPlan(true)}
              disabled={distanceMiles <= 0 || totalTimeMinutes <= 0 || inputs.bodyWeight <= 0}
              className={cn(
                'w-full py-3 rounded-lg font-semibold text-sm transition-all',
                distanceMiles > 0 && totalTimeMinutes > 0 && inputs.bodyWeight > 0
                  ? 'bg-[#ffab40] text-black hover:bg-[#ffab40]/90'
                  : 'bg-bgSecondary text-textTertiary cursor-not-allowed'
              )}
            >
              Build Fueling Plan
            </button>
          </div>

          {/* ─── Results Panel ────────────────────────────────────────── */}
          <div>
            {plan ? (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5">
                  <h2 className="text-lg font-semibold text-textPrimary mb-4">Race Summary</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-textTertiary">Distance</p>
                      <p className="text-lg font-bold text-textPrimary">{plan.distanceMiles.toFixed(1)} mi</p>
                    </div>
                    <div>
                      <p className="text-xs text-textTertiary">Target Time</p>
                      <p className="text-lg font-bold text-textPrimary">{formatTime(plan.totalTimeMinutes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-textTertiary">Pace</p>
                      <p className="text-lg font-bold text-textPrimary">{plan.pacePerMile}/mi</p>
                    </div>
                    <div>
                      <p className="text-xs text-textTertiary">Est. Calories Burned</p>
                      <p className="text-lg font-bold text-textPrimary">{plan.estimatedCalorieBurn.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Fuel Targets */}
                <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5">
                  <h2 className="text-lg font-semibold text-textPrimary mb-4">Fuel Targets</h2>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#ffab40]/10 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5 text-[#ffab40]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-textPrimary">Carbohydrates</p>
                        <p className="text-xs text-textTertiary">
                          {plan.carbsPerHour}g/hr — {plan.totalCarbsGrams}g total
                          ({Math.ceil(plan.totalCarbsGrams / 25)} gels)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#40c4ff]/10 rounded-lg flex items-center justify-center">
                        <Droplets className="w-5 h-5 text-[#40c4ff]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-textPrimary">Fluids</p>
                        <p className="text-xs text-textTertiary">
                          {plan.fluidPerHourMl}ml/hr — {(plan.totalFluidMl / 1000).toFixed(1)}L total
                          ({Math.round(plan.totalFluidMl / 237)} cups)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#69f0ae]/10 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5 text-[#69f0ae]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-textPrimary">Sodium</p>
                        <p className="text-xs text-textTertiary">
                          {plan.sodiumPerHourMg}mg/hr — {(plan.totalSodiumMg / 1000).toFixed(1)}g total
                        </p>
                      </div>
                    </div>
                    {plan.caffeineMg > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#b388ff]/10 rounded-lg flex items-center justify-center">
                          <Coffee className="w-5 h-5 text-[#b388ff]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-textPrimary">Caffeine</p>
                          <p className="text-xs text-textTertiary">
                            {plan.caffeineMg}mg pre-race ({plan.caffeineTimingMinutes} min before start)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Race Day Timeline */}
                <div className="bg-bgSecondary rounded-xl border border-borderPrimary overflow-hidden">
                  <button
                    onClick={() => toggleSection('timeline')}
                    className="w-full flex items-center justify-between p-5 hover:bg-bgTertiary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#ffab40]" />
                      <h2 className="text-lg font-semibold text-textPrimary">Race Day Timeline</h2>
                    </div>
                    {expandedSections.timeline ? (
                      <ChevronUp className="w-5 h-5 text-textTertiary" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-textTertiary" />
                    )}
                  </button>
                  {expandedSections.timeline && (
                    <div className="px-5 pb-5">
                      <div className="space-y-0">
                        {plan.timeline.map((item, idx) => (
                          <div key={idx} className="flex gap-3 py-2 border-b border-borderPrimary/50 last:border-0">
                            <div className="w-16 flex-shrink-0 text-right">
                              <p className="text-xs font-mono text-textTertiary">
                                {item.timeMinutes < 0
                                  ? `T-${Math.abs(item.timeMinutes)}m`
                                  : item.timeMinutes === 0
                                  ? 'Start'
                                  : formatTime(item.timeMinutes)}
                              </p>
                              {item.mile > 0 && (
                                <p className="text-xs text-textTertiary">mi {item.mile}</p>
                              )}
                            </div>
                            <div className="w-0.5 bg-borderPrimary flex-shrink-0 relative">
                              <div className={cn(
                                'absolute top-1/2 -translate-y-1/2 -left-1 w-2.5 h-2.5 rounded-full',
                                typeBgColor(item.type),
                                'border-2',
                                item.type === 'carb' ? 'border-[#ffab40]' : '',
                                item.type === 'fluid' ? 'border-[#40c4ff]' : '',
                                item.type === 'caffeine' ? 'border-[#b388ff]' : '',
                                item.type === 'electrolyte' ? 'border-[#69f0ae]' : '',
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-medium', typeIconColor(item.type))}>
                                {item.action}
                              </p>
                              <p className="text-xs text-textTertiary">{item.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pre-Race Plan */}
                <div className="bg-bgSecondary rounded-xl border border-borderPrimary overflow-hidden">
                  <button
                    onClick={() => toggleSection('prerace')}
                    className="w-full flex items-center justify-between p-5 hover:bg-bgTertiary/50 transition-colors"
                  >
                    <h2 className="text-lg font-semibold text-textPrimary">Pre-Race Fueling</h2>
                    {expandedSections.prerace ? (
                      <ChevronUp className="w-5 h-5 text-textTertiary" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-textTertiary" />
                    )}
                  </button>
                  {expandedSections.prerace && (
                    <div className="px-5 pb-5 space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-[#ffab40] mb-2">Night Before</h3>
                        <ul className="space-y-1.5">
                          {plan.nightBeforePlan.map((item, idx) => (
                            <li key={idx} className="text-sm text-textSecondary flex gap-2">
                              <span className="text-textTertiary flex-shrink-0">&#8226;</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-[#ffab40] mb-2">Race Morning</h3>
                        <ul className="space-y-1.5">
                          {plan.preRacePlan.map((item, idx) => (
                            <li key={idx} className="text-sm text-textSecondary flex gap-2">
                              <span className="text-textTertiary flex-shrink-0">&#8226;</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Product Suggestions */}
                {plan.productSuggestions.length > 0 && (
                  <div className="bg-bgSecondary rounded-xl border border-borderPrimary overflow-hidden">
                    <button
                      onClick={() => toggleSection('products')}
                      className="w-full flex items-center justify-between p-5 hover:bg-bgTertiary/50 transition-colors"
                    >
                      <h2 className="text-lg font-semibold text-textPrimary">Product Suggestions</h2>
                      {expandedSections.products ? (
                        <ChevronUp className="w-5 h-5 text-textTertiary" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-textTertiary" />
                      )}
                    </button>
                    {expandedSections.products && (
                      <div className="px-5 pb-5 space-y-4">
                        {plan.productSuggestions.map((product, idx) => (
                          <div key={idx} className="border border-borderPrimary/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-textPrimary">{product.category}</h3>
                              {product.carbsPerServing > 0 && (
                                <span className="text-xs bg-[#ffab40]/10 text-[#ffab40] px-2 py-0.5 rounded">
                                  ~{product.carbsPerServing}g carbs/serving
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-textTertiary mb-2">{product.examples.join(' · ')}</p>
                            <p className="text-xs text-textSecondary italic">{product.notes}</p>
                          </div>
                        ))}
                        <div className="p-3 bg-[#ffab40]/5 rounded-lg">
                          <p className="text-xs text-textTertiary">
                            <strong className="text-textSecondary">Important:</strong> Never try new
                            nutrition products on race day. Test everything during training first.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Practice Schedule */}
                <div className="bg-bgSecondary rounded-xl border border-borderPrimary overflow-hidden">
                  <button
                    onClick={() => toggleSection('practice')}
                    className="w-full flex items-center justify-between p-5 hover:bg-bgTertiary/50 transition-colors"
                  >
                    <h2 className="text-lg font-semibold text-textPrimary">Practice Schedule</h2>
                    {expandedSections.practice ? (
                      <ChevronUp className="w-5 h-5 text-textTertiary" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-textTertiary" />
                    )}
                  </button>
                  {expandedSections.practice && (
                    <div className="px-5 pb-5">
                      <ul className="space-y-2">
                        {plan.practiceSchedule.map((item, idx) => (
                          <li key={idx} className="text-sm text-textSecondary flex gap-2">
                            <span className="text-[#ffab40] flex-shrink-0 font-bold">{idx + 1}.</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-8 text-center">
                <Info className="w-12 h-12 text-textTertiary mx-auto mb-3" />
                <p className="text-textTertiary">
                  Configure your race details and click &quot;Build Fueling Plan&quot; to get a personalized
                  race-day nutrition strategy.
                </p>
                <div className="mt-4 text-xs text-textTertiary space-y-1">
                  <p>Based on current sports science research:</p>
                  <p>Jeukendrup (2014), Thomas et al. (2016), Vitale &amp; Getzin (2019)</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Science Notes */}
        <div className="mt-8 bg-bgSecondary rounded-xl border border-borderPrimary p-6">
          <h2 className="text-lg font-semibold text-textPrimary mb-4">The Science Behind Race Fueling</h2>
          <div className="grid sm:grid-cols-2 gap-6 text-sm text-textSecondary">
            <div>
              <p className="font-medium text-secondary mb-1">Why carbs matter</p>
              <p>
                Your body stores ~2,000 kcal of glycogen. A marathon burns ~2,600+. Without fueling, you
                hit &quot;the wall&quot; when glycogen depletes. Exogenous carbs delay this by providing an
                alternative fuel source.
              </p>
            </div>
            <div>
              <p className="font-medium text-secondary mb-1">Dual-transport carbs</p>
              <p>
                Your gut absorbs glucose at ~60g/hr max. Adding fructose (a different transporter)
                increases absorption to ~90g/hr. Look for products with a 2:1 glucose-to-fructose ratio
                for races over 2.5 hours.
              </p>
            </div>
            <div>
              <p className="font-medium text-secondary mb-1">Gut training</p>
              <p>
                Your GI tract adapts to processing carbs during exercise. Start with lower amounts and
                progressively increase during training. Most GI issues on race day come from untested
                fueling strategies.
              </p>
            </div>
            <div>
              <p className="font-medium text-secondary mb-1">Hydration balance</p>
              <p>
                Dehydration of &gt;2% body weight impairs performance. But overhydration (hyponatremia)
                is dangerous too. Drink to thirst, aim for pale yellow urine, and include sodium in
                your fluid strategy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
