'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/lib/profile-context';
import { getSettings } from '@/actions/settings';
import type { UserSettings } from '@/lib/schema';
import { User, Share2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Runner persona display info
const PERSONA_VIBES: Record<string, { title: string; emoji: string; description: string }> = {
  newer_runner: { title: 'Fresh Start', emoji: '', description: 'New energy, unlimited potential. Every run is a discovery.' },
  busy_runner: { title: 'Time Warrior', emoji: '', description: 'Squeezing in miles between everything. Efficient and relentless.' },
  self_coached: { title: 'Lone Wolf', emoji: '', description: 'Trusts the process. Writes your own training story.' },
  coach_guided: { title: 'Student of the Sport', emoji: '', description: 'Open to guidance. Absorbs wisdom and grows faster.' },
  type_a_planner: { title: 'The Architect', emoji: '', description: 'Every mile mapped, every split planned. Precision is the game.' },
  data_optimizer: { title: 'The Analyst', emoji: '', description: 'Numbers tell the story. Turns data into performance.' },
  other: { title: 'Free Spirit', emoji: '', description: 'Defies categories. Runs on instinct and joy.' },
};

const PHILOSOPHY_VIBES: Record<string, string> = {
  pfitzinger: 'Pfitzinger Method',
  hansons: 'Hansons Approach',
  daniels: 'Daniels Running Formula',
  lydiard: 'Lydiard Base Builder',
  polarized: 'Polarized Training',
  balanced: 'Balanced Philosophy',
  not_sure: 'Finding Your Way',
};

const SURFACE_VIBES: Record<string, string> = {
  road: 'Pavement Pounder',
  trail: 'Trail Seeker',
  track: 'Oval Chaser',
  mixed: 'All-Terrain',
};

const TIME_VIBES: Record<string, string> = {
  early_morning: 'Dawn Runner',
  morning: 'Morning Miles',
  midday: 'Midday Mover',
  evening: 'Twilight Runner',
  flexible: 'Anytime Athlete',
};

function getComfortVibe(avg: number): string {
  if (avg >= 4.5) return 'Fearless across every workout type';
  if (avg >= 3.5) return 'Confident and versatile';
  if (avg >= 2.5) return 'Growing into new challenges';
  return 'Building a broader base';
}

function formatPace(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AuraPage() {
  const { activeProfile } = useProfile();
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    if (activeProfile?.id) {
      getSettings(activeProfile.id).then(s => s && setSettings(s));
    }
  }, [activeProfile?.id]);

  if (!activeProfile || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-surface-2" />
          <div className="h-4 w-32 bg-surface-2 rounded" />
        </div>
      </div>
    );
  }

  const hasAura = !!(activeProfile.auraColorStart && activeProfile.auraColorEnd);
  const startColor = activeProfile.auraColorStart || '#3b82f6';
  const endColor = activeProfile.auraColorEnd || '#8b5cf6';
  const persona = PERSONA_VIBES[settings.runnerPersona || ''] || PERSONA_VIBES.other;

  // Comfort average
  const comforts = [settings.comfortVO2max, settings.comfortTempo, settings.comfortHills, settings.comfortLongRuns, settings.comfortTrackWork].filter((v): v is number => v != null);
  const avgComfort = comforts.length > 0 ? comforts.reduce((a, b) => a + b, 0) / comforts.length : null;

  // Training philosophies
  const philosophies: string[] = settings.trainingPhilosophies ? JSON.parse(settings.trainingPhilosophies) : settings.trainingPhilosophy ? [settings.trainingPhilosophy] : [];

  const handleShare = async () => {
    try {
      await navigator.share?.({
        title: `${settings.name}'s Runner Aura`,
        text: `${persona.title} | ${TIME_VIBES[settings.preferredRunTime || ''] || 'Runner'}`,
        url: window.location.href,
      });
    } catch {
      // User cancelled or share not supported
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/profile" className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Profile
        </Link>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-secondary hover:text-primary rounded-lg hover:bg-surface-2 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      {/* Main aura card */}
      <div
        className="relative rounded-3xl overflow-hidden shadow-xl"
        style={{ background: `linear-gradient(145deg, ${startColor}, ${endColor})` }}
      >
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: endColor, transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: startColor, transform: 'translate(-20%, 20%)' }} />

        <div className="relative px-8 pt-10 pb-8">
          {/* Avatar */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
              <User className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Name */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">{settings.name}</h1>
            <p className="text-white/70 text-sm mt-1">{TIME_VIBES[settings.preferredRunTime || ''] || 'Runner'}</p>
          </div>

          {/* Persona badge */}
          <div className="text-center mb-8">
            <div className="inline-block px-5 py-2.5 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
              <p className="text-lg font-bold text-white">{persona.title}</p>
              <p className="text-xs text-white/60 mt-0.5">{persona.description}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {settings.currentWeeklyMileage && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                <p className="text-2xl font-bold text-white">{settings.currentWeeklyMileage}</p>
                <p className="text-xs text-white/50">miles/week</p>
              </div>
            )}
            {settings.runsPerWeekCurrent && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                <p className="text-2xl font-bold text-white">{settings.runsPerWeekCurrent}</p>
                <p className="text-xs text-white/50">runs/week</p>
              </div>
            )}
            {settings.vdot && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                <p className="text-2xl font-bold text-white">{Math.round(settings.vdot * 10) / 10}</p>
                <p className="text-xs text-white/50">VDOT</p>
              </div>
            )}
            {settings.yearsRunning != null && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                <p className="text-2xl font-bold text-white">{settings.yearsRunning}</p>
                <p className="text-xs text-white/50">years running</p>
              </div>
            )}
          </div>

          {/* Pace zones row */}
          {settings.easyPaceSeconds && settings.tempoPaceSeconds && (
            <div className="flex justify-center gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm font-semibold text-white">{formatPace(settings.easyPaceSeconds)}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Easy</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-sm font-semibold text-white">{formatPace(settings.tempoPaceSeconds)}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Tempo</p>
              </div>
              {settings.intervalPaceSeconds && (
                <>
                  <div className="w-px bg-white/20" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">{formatPace(settings.intervalPaceSeconds)}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Interval</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Vibes tags */}
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {settings.surfacePreference && SURFACE_VIBES[settings.surfacePreference] && (
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/80 border border-white/10">
                {SURFACE_VIBES[settings.surfacePreference]}
              </span>
            )}
            {philosophies.length > 0 && philosophies[0] !== 'not_sure' && (
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/80 border border-white/10">
                {PHILOSOPHY_VIBES[philosophies[0]] || philosophies[0]}
              </span>
            )}
            {avgComfort != null && (
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/80 border border-white/10">
                {getComfortVibe(avgComfort)}
              </span>
            )}
            {settings.openToDoubles && (
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/80 border border-white/10">
                Doubles OK
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="text-center pt-4 border-t border-white/10">
            <p className="text-[10px] text-white/30 uppercase tracking-widest">dreamy</p>
          </div>
        </div>
      </div>

      {/* Color swatch */}
      <div className="flex justify-center gap-3 mt-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: startColor }} />
          <span className="text-xs text-tertiary font-mono">{startColor}</span>
        </div>
        <span className="text-tertiary">-</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: endColor }} />
          <span className="text-xs text-tertiary font-mono">{endColor}</span>
        </div>
      </div>
    </div>
  );
}
