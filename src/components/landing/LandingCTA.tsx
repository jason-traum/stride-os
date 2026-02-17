'use client';

import Link from 'next/link';
import { ScrollReveal } from './ScrollReveal';
import { SheepImage } from './SheepImage';

export function LandingCTA() {
  return (
    <section className="py-28 sm:py-40 px-6 sm:px-8" aria-label="Get Started">
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="flex justify-center mb-8">
          <SheepImage mood="champion" size={280} entrance="bounce" />
        </div>

        <ScrollReveal delay={0.2}>
          <h2
            className="text-[#F0EDE6] font-extrabold leading-[0.92] tracking-[-0.02em]"
            style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            }}
          >
            Your dream pace is closer<br />
            than you think.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={0.35}>
          <p
            className="text-[#8A8694] text-base sm:text-lg mt-5 max-w-md mx-auto"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            Start training with an AI coach that actually learns who you are.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.5}>
          <div className="mt-10">
            <Link
              href="/onboarding"
              className="landing-cta-pulse inline-flex items-center justify-center bg-[#7C5CBF] hover:bg-[#6B4DAE] text-white font-bold text-lg px-10 py-4 rounded-xl transition-all hover:translate-y-[-2px] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CBF]"
            >
              Meet Your Coach
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
