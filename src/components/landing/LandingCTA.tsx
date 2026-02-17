'use client';

import Link from 'next/link';
import { ScrollReveal } from './ScrollReveal';
import { SheepImage } from './SheepImage';

export function LandingCTA() {
  return (
    <section className="py-20 sm:py-36 px-5 sm:px-8" aria-label="Get Started">
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="flex justify-center mb-8">
          <div className="w-[130px] sm:w-[200px] lg:w-[280px]">
            <SheepImage mood="champion" size={280} entrance="bounce" />
          </div>
        </div>

        <ScrollReveal delay={0.2}>
          <h2
            className="text-[#F0EDE6] font-extrabold leading-[0.92] tracking-[-0.02em]"
            style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            }}
          >
            Stop chasing someone<br />
            else&apos;s pace.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={0.35}>
          <p
            className="text-[#8A8694] text-base sm:text-lg mt-5 max-w-md mx-auto"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            Your dream. Your coach. Built around the way you actually run.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.5}>
          <div className="mt-10">
            <Link
              href="/onboarding"
              className="landing-cta-pulse inline-flex items-center justify-center bg-[#7C5CBF] hover:bg-[#6B4DAE] text-white font-bold text-lg px-10 py-4 rounded-xl transition-all hover:translate-y-[-2px] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CBF]"
            >
              Start Training — Free
            </Link>
          </div>
          <p className="text-[#5A5768] text-sm mt-4" style={{ fontFamily: 'var(--font-manrope)' }}>
            Free to start. No credit card.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
