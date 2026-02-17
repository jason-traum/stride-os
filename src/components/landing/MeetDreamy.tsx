'use client';

import { ScrollReveal } from './ScrollReveal';
import { SheepImage } from './SheepImage';

export function MeetDreamy() {
  return (
    <section className="py-[100px] sm:py-[120px] px-6 sm:px-8" aria-label="Meet Dreamy">
      {/* Top divider */}
      <div className="max-w-[1100px] mx-auto mb-16 sm:mb-20">
        <div className="h-px w-full bg-white/[0.06]" />
      </div>

      <div className="max-w-[1100px] mx-auto text-center">
        {/* Running sheep */}
        <div className="flex justify-center mb-10">
          <div className="w-[120px] sm:w-[180px] lg:w-[220px]">
            <SheepImage
              mood="running"
              size={220}
              entrance="fade"
              priority
            />
          </div>
        </div>

        {/* Typographic crescendo */}
        <div className="space-y-4 sm:space-y-5">
          {/* Line 1 — quiet */}
          <ScrollReveal delay={0.1}>
            <p
              className="text-[#5A5768] text-sm sm:text-base"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Every other app treats you like part of the flock.
            </p>
          </ScrollReveal>

          {/* Line 2 — builds */}
          <ScrollReveal delay={0.25}>
            <p
              className="text-[#F0EDE6] font-bold text-lg sm:text-xl"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Same plan. Same pace. Same advice. Follow the sheep in front of you.
            </p>
          </ScrollReveal>

          {/* Line 3 — peak */}
          <ScrollReveal delay={0.4}>
            <p
              className="font-extrabold leading-[0.95] tracking-[-0.02em]"
              style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 'clamp(1.75rem, 4vw, 3rem)',
              }}
            >
              <span className="text-[#F0EDE6]">Meet </span>
              <span className="text-[#7C5CBF]">Dreamy</span>
              <span className="text-[#F0EDE6]"> — the one that broke away.</span>
            </p>
          </ScrollReveal>

          {/* Line 4 — resolves */}
          <ScrollReveal delay={0.55}>
            <p
              className="text-[#5A5768] text-sm sm:text-base mt-2"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Built for runners chasing their own dream, not someone else&apos;s template.
            </p>
          </ScrollReveal>
        </div>
      </div>

      {/* Bottom divider */}
      <div className="max-w-[1100px] mx-auto mt-16 sm:mt-20">
        <div className="h-px w-full bg-white/[0.06]" />
      </div>
    </section>
  );
}
