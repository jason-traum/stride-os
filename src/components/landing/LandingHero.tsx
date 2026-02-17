'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { SheepImage } from './SheepImage';

export function LandingHero() {
  return (
    <section className="pt-28 sm:pt-36 pb-20 sm:pb-32 px-6 sm:px-8" aria-label="Hero">
      <div className="max-w-[1100px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-center">
          {/* Text */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-[#7C5CBF] text-xs font-bold tracking-[0.15em] uppercase mb-5"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Your AI Running Coach
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-[#F0EDE6] font-extrabold leading-[0.92] tracking-[-0.03em]"
              style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
              }}
            >
              Your training plan<br />
              should know you<br />
              ran on{' '}
              <span className="text-[#7C5CBF]">4 hours of sleep.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-[#8A8694] text-base sm:text-lg leading-relaxed mt-6 max-w-xl"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Dreamy studies every run, listens to your feedback, and rebuilds
              your training every single day. Swap a workout, skip a day, run
              something different — it adapts. Not a template. Not a plan you
              picked from a menu. A coach that actually knows you.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="flex flex-col sm:flex-row gap-3 mt-8"
            >
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center bg-[#7C5CBF] hover:bg-[#6B4DAE] text-white font-semibold text-base px-7 py-3.5 rounded-lg transition-all hover:translate-y-[-1px] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CBF]"
              >
                Start Training — Free
              </Link>
              <a
                href="#the-coach"
                className="inline-flex items-center justify-center border border-[#2A2933] text-[#F0EDE6] font-medium text-base px-7 py-3.5 rounded-lg transition-all hover:border-[#4A4958] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CBF]"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('the-coach')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                See how it works
              </a>
            </motion.div>
          </div>

          {/* Sheep */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Subtle radial glow behind sheep */}
              <div className="absolute inset-0 -m-16 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,92,191,0.08)_0%,transparent_70%)]" />
              <SheepImage mood="encouraging" size={320} priority entrance="fade" delay={0.3} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
