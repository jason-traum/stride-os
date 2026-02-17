'use client';

import { ScrollReveal } from './ScrollReveal';

export function LandingCredibility() {
  return (
    <section className="py-10 sm:py-16 px-5 sm:px-8" aria-label="Credibility">
      <ScrollReveal>
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[#5A5768] text-sm font-medium" style={{ fontFamily: 'var(--font-manrope)' }}>
            <span>Syncs with Strava</span>
            <span className="hidden sm:block w-1 h-1 rounded-full bg-[#2A2933]" />
            <span>Garmin &amp; Apple Watch</span>
            <span className="hidden sm:block w-1 h-1 rounded-full bg-[#2A2933]" />
            <span>Free to start</span>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
