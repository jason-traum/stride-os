// Outfit recommendation engine using Vibes Temp (VT) formula

import type { WorkoutType, ClothingCategory, TemperaturePreference, ClothingItem } from './schema';
import type { WeatherData } from './weather';

export interface VTCalculation {
  feelsLikeTemp: number;
  effortAdjustment: number;
  distanceAdjustment: number;
  personalAdjustment: number;
  vibesTemp: number;
  breakdown: string;
}

export interface OutfitRecommendation {
  vt: VTCalculation;
  top: {
    recommendation: string;
    categories: ClothingCategory[];
    note?: string;
  };
  bottom: {
    recommendation: string;
    categories: ClothingCategory[];
    note?: string;
  };
  gloves: {
    recommendation: string;
    categories: ClothingCategory[];
    note?: string;
  };
  headwear: {
    recommendation: string;
    categories: ClothingCategory[];
    note?: string;
  };
  addOns: {
    shell: boolean;
    buff: boolean;
    notes: string[];
  };
  summary: string;
  warmUpNotes: string[];
}

// Effort adjustment based on workout type
const EFFORT_ADJUSTMENTS: Record<WorkoutType, number> = {
  easy: -5,
  recovery: -5,
  steady: 0,
  long: 0,
  tempo: 5,
  interval: 7,
  race: 7,
  cross_train: -5,
  other: 0,
};

// Personal adjustment based on temperature preference
const PERSONAL_ADJUSTMENTS: Record<TemperaturePreference, number> = {
  runs_cold: -5,
  neutral: 0,
  runs_hot: 5,
};

/**
 * Calculate Vibes Temp (VT) - the "feels like" temperature for running
 */
export function calculateVibesTemp(
  feelsLikeTemp: number,
  workoutType: WorkoutType,
  distanceMiles: number,
  temperaturePreference: TemperaturePreference = 'neutral'
): VTCalculation {
  const effortAdjustment = EFFORT_ADJUSTMENTS[workoutType] || 0;

  // Distance adjustment
  let distanceAdjustment = 0;
  if (distanceMiles <= 5) {
    distanceAdjustment = -6; // Short runs - you don't warm up as much
  } else if (distanceMiles >= 11) {
    distanceAdjustment = 3; // Long runs - you generate more heat
  }
  // 6-10 miles = 0 adjustment

  const personalAdjustment = PERSONAL_ADJUSTMENTS[temperaturePreference] || 0;

  const vibesTemp = feelsLikeTemp + effortAdjustment + distanceAdjustment + personalAdjustment;

  const breakdown = [
    `Feels like ${feelsLikeTemp}°F`,
    effortAdjustment !== 0 ? `${effortAdjustment > 0 ? '+' : ''}${effortAdjustment}° for ${workoutType} effort` : null,
    distanceAdjustment !== 0 ? `${distanceAdjustment > 0 ? '+' : ''}${distanceAdjustment}° for ${distanceMiles <= 5 ? 'short' : 'long'} distance` : null,
    personalAdjustment !== 0 ? `${personalAdjustment > 0 ? '+' : ''}${personalAdjustment}° personal preference` : null,
  ].filter(Boolean).join(', ');

  return {
    feelsLikeTemp,
    effortAdjustment,
    distanceAdjustment,
    personalAdjustment,
    vibesTemp: Math.round(vibesTemp),
    breakdown,
  };
}

/**
 * Get outfit recommendation based on Vibes Temp
 */
export function getOutfitRecommendation(
  vt: VTCalculation,
  weather: WeatherData,
  workoutType: WorkoutType
): OutfitRecommendation {
  const temp = vt.vibesTemp;
  const windSpeed = weather.windSpeed;
  const condition = weather.condition;
  const isPrecip = condition === 'rain' || condition === 'drizzle' || condition === 'snow';
  const isSnowing = condition === 'snow';

  // TOP recommendation
  let top: OutfitRecommendation['top'];
  if (temp >= 40) {
    top = {
      recommendation: 'Short sleeve',
      categories: ['top_short_sleeve'],
    };
  } else if (temp >= 32) {
    top = {
      recommendation: 'Short sleeve or thin long sleeve',
      categories: ['top_short_sleeve', 'top_long_sleeve_thin'],
      note: 'Either works - go with preference',
    };
  } else if (temp >= 22) {
    top = {
      recommendation: 'Thin long sleeve',
      categories: ['top_long_sleeve_thin'],
    };
  } else if (temp >= 12) {
    top = {
      recommendation: 'Standard long sleeve',
      categories: ['top_long_sleeve_standard'],
    };
  } else if (temp >= 5) {
    top = {
      recommendation: 'Warm long sleeve OR standard + quarter zip',
      categories: ['top_long_sleeve_warm', 'top_long_sleeve_standard', 'outer_quarter_zip'],
      note: 'Layer up - you can always unzip',
    };
  } else {
    top = {
      recommendation: 'Warm long sleeve + shell',
      categories: ['top_long_sleeve_warm', 'outer_shell'],
      note: 'Full coverage needed',
    };
  }

  // BOTTOM recommendation
  let bottom: OutfitRecommendation['bottom'];
  if (temp >= 30) {
    bottom = {
      recommendation: 'Shorts or half tights',
      categories: ['bottom_shorts', 'bottom_half_tights'],
    };
  } else if (temp >= 15) {
    bottom = {
      recommendation: 'Leggings',
      categories: ['bottom_leggings'],
    };
  } else {
    bottom = {
      recommendation: 'Leggings',
      categories: ['bottom_leggings'],
      note: 'Consider warm socks too',
    };
  }

  // GLOVES recommendation
  let gloves: OutfitRecommendation['gloves'];
  if (temp >= 35) {
    gloves = {
      recommendation: 'None needed',
      categories: [],
    };
  } else if (temp >= 25) {
    gloves = {
      recommendation: 'Thin gloves',
      categories: ['gloves_thin'],
      note: "You'll probably take these off mid-run",
    };
  } else if (temp >= 18) {
    gloves = {
      recommendation: 'Medium gloves',
      categories: ['gloves_medium'],
    };
  } else {
    gloves = {
      recommendation: 'Winter gloves',
      categories: ['gloves_winter'],
      note: 'Protect those fingers!',
    };
  }

  // HEADWEAR recommendation
  let headwear: OutfitRecommendation['headwear'];
  if (temp >= 30) {
    headwear = {
      recommendation: 'Optional',
      categories: ['beanie'],
      note: 'Not needed unless you prefer it',
    };
  } else if (temp >= 18) {
    headwear = {
      recommendation: 'Beanie recommended',
      categories: ['beanie'],
      note: "You'll probably remove it by mile 2",
    };
  } else {
    headwear = {
      recommendation: 'Beanie definitely',
      categories: ['beanie'],
    };
  }

  // ADD-ONS
  const addOns: OutfitRecommendation['addOns'] = {
    shell: isPrecip || (windSpeed >= 12 && temp <= 20),
    buff: isSnowing || windSpeed >= 10 || temp <= 25,
    notes: [],
  };

  if (addOns.shell && !isPrecip) {
    addOns.notes.push('Shell for wind protection');
  }
  if (addOns.shell && isPrecip) {
    addOns.notes.push('Shell for precipitation');
  }
  if (addOns.buff && isSnowing) {
    addOns.notes.push('Buff to keep snow out of your face');
  } else if (addOns.buff && windSpeed >= 10) {
    addOns.notes.push('Buff for wind protection');
  } else if (addOns.buff) {
    addOns.notes.push('Buff recommended for cold');
  }

  // Warm-up notes
  const warmUpNotes: string[] = [];
  if (temp >= 18 && temp < 35 && gloves.categories.length > 0) {
    warmUpNotes.push("You'll likely want to remove gloves by mile 2");
  }
  if (temp >= 18 && temp < 30) {
    warmUpNotes.push('Expect to feel cold for the first 5-10 minutes');
  }
  if (workoutType === 'interval' || workoutType === 'tempo') {
    warmUpNotes.push('Dress lighter than you think - hard efforts generate lots of heat');
  }

  // Generate summary
  const summaryParts: string[] = [];
  summaryParts.push(top.recommendation.toLowerCase());
  summaryParts.push(bottom.recommendation.toLowerCase());
  if (gloves.categories.length > 0 && temp < 35) {
    summaryParts.push(gloves.recommendation.toLowerCase());
  }
  if (headwear.categories.length > 0 && temp < 30) {
    summaryParts.push(headwear.recommendation.toLowerCase());
  }
  if (addOns.buff) {
    summaryParts.push('buff');
  }
  if (addOns.shell && !top.categories.includes('outer_shell')) {
    summaryParts.push('shell');
  }

  const summary = `For VT ${temp}°F: ${summaryParts.join(', ')}`;

  return {
    vt,
    top,
    bottom,
    gloves,
    headwear,
    addOns,
    summary,
    warmUpNotes,
  };
}

/**
 * Match recommendation to user's wardrobe items
 */
export function matchWardrobeItems(
  recommendation: OutfitRecommendation,
  wardrobe: ClothingItem[]
): {
  top: ClothingItem[];
  bottom: ClothingItem[];
  gloves: ClothingItem[];
  headwear: ClothingItem[];
  addOns: ClothingItem[];
} {
  const activeItems = wardrobe.filter(item => item.isActive);

  const findItems = (categories: ClothingCategory[]) =>
    activeItems.filter(item => categories.includes(item.category as ClothingCategory));

  return {
    top: findItems(recommendation.top.categories),
    bottom: findItems(recommendation.bottom.categories),
    gloves: findItems(recommendation.gloves.categories),
    headwear: findItems(recommendation.headwear.categories),
    addOns: [
      ...(recommendation.addOns.shell ? findItems(['outer_shell']) : []),
      ...(recommendation.addOns.buff ? findItems(['buff']) : []),
    ],
  };
}

/**
 * Get clothing category display name
 */
export function getCategoryLabel(category: ClothingCategory): string {
  const labels: Record<ClothingCategory, string> = {
    top_short_sleeve: 'Short Sleeve Top',
    top_long_sleeve_thin: 'Thin Long Sleeve',
    top_long_sleeve_standard: 'Long Sleeve',
    top_long_sleeve_warm: 'Warm Long Sleeve',
    outer_quarter_zip: 'Quarter Zip',
    outer_shell: 'Shell/Jacket',
    outer_hoodie: 'Hoodie',
    bottom_shorts: 'Shorts',
    bottom_half_tights: 'Half Tights',
    bottom_leggings: 'Leggings',
    gloves_thin: 'Thin Gloves',
    gloves_medium: 'Medium Gloves',
    gloves_winter: 'Winter Gloves',
    beanie: 'Beanie',
    buff: 'Buff/Neck Gaiter',
    socks_thin: 'Thin Socks',
    socks_warm: 'Warm Socks',
    other: 'Other',
  };
  return labels[category] || category;
}

/**
 * Get category group for display
 */
export function getCategoryGroup(category: ClothingCategory): string {
  if (category.startsWith('top_')) return 'Tops';
  if (category.startsWith('outer_')) return 'Outerwear';
  if (category.startsWith('bottom_')) return 'Bottoms';
  if (category.startsWith('gloves_')) return 'Gloves';
  if (category.startsWith('socks_')) return 'Socks';
  if (category === 'beanie' || category === 'buff') return 'Headwear';
  return 'Other';
}
