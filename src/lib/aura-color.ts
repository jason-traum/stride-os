// Aura Color Generator
// Maps onboarding survey answers to a unique two-color gradient per user.

import type { UserSettings } from './schema';

export interface AuraColors {
  start: string; // hex color
  end: string;   // hex color
}

// Runner persona → base hue (vibrant, guide-page-inspired palette)
const PERSONA_HUES: Record<string, number> = {
  newer_runner: 199,    // sky blue - fresh start
  busy_runner: 25,      // orange - energy
  self_coached: 168,    // teal - independence
  coach_guided: 271,    // purple - guidance
  type_a_planner: 293,  // fuchsia - precision
  data_optimizer: 234,  // indigo - analytical
  other: 330,           // pink
};

// Training philosophy → accent hue offset
const PHILOSOPHY_OFFSETS: Record<string, number> = {
  pfitzinger: 40,
  hansons: 60,
  daniels: 80,
  lydiard: 100,
  polarized: 120,
  balanced: 50,
  not_sure: 45,
};

// Surface preference → accent hue offset (fallback if no philosophy)
const SURFACE_OFFSETS: Record<string, number> = {
  road: 50,
  trail: 70,
  track: 90,
  mixed: 60,
};

// Preferred run time → lightness mapping
const TIME_LIGHTNESS: Record<string, number> = {
  early_morning: 62,  // lighter - dawn vibes
  morning: 58,
  midday: 52,
  evening: 42,        // deeper - twilight vibes
  flexible: 52,
};

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));

  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  const toHex = (v: number) => {
    const hex = Math.round((v + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a personal aura gradient from onboarding settings.
 * Returns two hex colors that form a gradient unique to the user.
 */
export function generateAura(settings: Partial<UserSettings>): AuraColors {
  // 1. Base hue from runner persona
  const baseHue = PERSONA_HUES[settings.runnerPersona ?? ''] ?? PERSONA_HUES.other;

  // 2. Saturation from comfort levels (higher comfort → more saturated)
  const comfortValues = [
    settings.comfortVO2max,
    settings.comfortTempo,
    settings.comfortHills,
    settings.comfortLongRuns,
    settings.comfortTrackWork,
  ].filter((v): v is number => v != null);

  let saturation: number;
  if (comfortValues.length > 0) {
    const avgComfort = comfortValues.reduce((a, b) => a + b, 0) / comfortValues.length;
    // Scale 1-5 comfort → 55-85% saturation
    saturation = 55 + ((avgComfort - 1) / 4) * 30;
  } else {
    saturation = 70; // default mid-saturation
  }

  // 3. Lightness from preferred run time
  const lightness = TIME_LIGHTNESS[settings.preferredRunTime ?? ''] ?? TIME_LIGHTNESS.flexible;

  // 4. Accent hue for gradient end
  let accentOffset: number;
  if (settings.trainingPhilosophy && PHILOSOPHY_OFFSETS[settings.trainingPhilosophy]) {
    accentOffset = PHILOSOPHY_OFFSETS[settings.trainingPhilosophy];
  } else if (settings.surfacePreference && SURFACE_OFFSETS[settings.surfacePreference]) {
    accentOffset = SURFACE_OFFSETS[settings.surfacePreference];
  } else {
    accentOffset = 55; // default offset
  }

  const accentHue = baseHue + accentOffset;

  // Generate the two gradient colors
  const start = hslToHex(baseHue, saturation, lightness);
  const end = hslToHex(accentHue, saturation - 5, lightness - 4);

  return { start, end };
}

/**
 * Build a CSS gradient string from aura colors.
 */
export function auraGradient(colors: AuraColors, direction = '135deg'): string {
  return `linear-gradient(${direction}, ${colors.start}, ${colors.end})`;
}
