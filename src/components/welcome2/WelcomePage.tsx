'use client';

import { useRef, type RefObject } from 'react';
import {
  motion,
  useScroll,
  useTransform,
} from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { StarField } from './StarField';
import './welcome2.css';

export default function WelcomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });

  // Stay dark the entire time — subtle shift from black to deep purple
  const bgColor = useTransform(
    scrollYProgress,
    [0, 0.25, 0.5, 0.75, 1.0],
    ['#06070F', '#0A0C1E', '#0E0D28', '#0D0B22', '#08091A']
  );

  const vp = { root: containerRef as RefObject<Element>, once: true };

  return (
    <>
      <motion.div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundColor: bgColor, zIndex: 59 }}
      />

      <div ref={containerRef} className="w2-container">
        {/* NAV */}
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 sm:px-8">
          <span
            className="text-white/40 text-sm font-medium tracking-[0.2em] uppercase"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            dreamy
          </span>
          <Link
            href="/gate"
            className="text-white/30 text-sm hover:text-white/60 transition-colors"
          >
            Log in
          </Link>
        </nav>

        {/* ═══ BEAT 1 — YOU REMEMBER ═══ */}
        <section style={{ height: '160vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-6">
            <StarField scrollProgress={scrollYProgress} />

            <div className="relative z-10 text-center max-w-4xl">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.3 }}
                className="w2-text-glow text-white text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[0.88] tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                You remember<br />the first time.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1.2 }}
                className="w2-text-glow text-white/30 text-lg sm:text-xl md:text-2xl mt-5 sm:mt-8 font-medium"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Not the splits. Not the shoes.<br />
                Something quieter than that.
              </motion.p>
            </div>

            <div className="absolute bottom-8 flex flex-col items-center gap-2 w2-scroll-hint">
              <span className="text-white/15 text-[10px] tracking-[0.3em] uppercase">Scroll</span>
              <div className="w-px h-8 bg-gradient-to-b from-white/15 to-transparent" />
            </div>
          </div>
        </section>

        {/* ═══ BEAT 2 — NOT YET ═══ */}
        <section style={{ height: '150vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-6">
            <div className="relative z-10 text-center max-w-4xl">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.8 }}
                className="w2-text-glow text-white text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[0.88] tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Your lungs burned.<br />
                Your legs begged.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ ...vp, margin: '-10%' }}
                transition={{ duration: 0.9, delay: 0.5 }}
                className="w2-text-glow text-white/45 text-2xl sm:text-3xl md:text-4xl lg:text-5xl mt-4 sm:mt-8 font-extrabold italic leading-[0.92]"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                And something in you<br />
                whispered &ldquo;not yet.&rdquo;
              </motion.p>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 3 — THE GUT PUNCH ═══ */}
        <section style={{ height: '180vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-6">
            <div className="relative z-10 text-center max-w-3xl space-y-3 sm:space-y-4">
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.7 }}
                className="w2-text-glow text-white/50 text-lg sm:text-xl md:text-2xl font-medium leading-relaxed"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                You ran past the voice that said you couldn&apos;t.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="w2-text-glow text-white/50 text-lg sm:text-xl md:text-2xl font-medium leading-relaxed"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Past the version of you that almost didn&apos;t start.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="w2-text-glow text-white/50 text-lg sm:text-xl md:text-2xl font-medium leading-relaxed"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Past everyone who said it was just a phase.
              </motion.p>

              {/* The gut punch */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-8%' }}
                transition={{ duration: 0.9, delay: 0.9 }}
                className="w2-text-glow text-white text-[1.7rem] sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[0.92] tracking-tight pt-5 sm:pt-10"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                The person who couldn&apos;t<br />
                finish a single mile?<br />
                <span className="block mt-2 sm:mt-4">
                  They&apos;d be so proud<br />
                  of you right now.
                </span>
              </motion.h2>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 4 — CHASING A DREAM ═══ */}
        <section style={{ height: '150vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-6">
            <div className="relative z-10 text-center max-w-4xl">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.8 }}
                className="w2-text-glow text-white text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[0.88] tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Every runner is<br />
                chasing something<br />
                they can&apos;t quite name.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ ...vp, margin: '-10%' }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="w2-text-glow text-white/30 text-lg sm:text-xl md:text-2xl mt-5 sm:mt-8 font-medium leading-relaxed max-w-2xl mx-auto"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Not a PR. Not a medal.<br />
                A feeling. That you are becoming exactly<br />
                who you were always supposed to be.
              </motion.p>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 5 — MEET DREAMY ═══ */}
        <section style={{ height: '150vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-6">
            {/* The sheep — staring right at you */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ ...vp, margin: '-10%' }}
              transition={{ type: 'spring', stiffness: 180, damping: 20 }}
              className="mb-5 sm:mb-8"
            >
              <Image
                src="/sheep/forward.png"
                alt="Dreamy"
                width={160}
                height={160}
                className="w-[140px] h-[140px] sm:w-[180px] sm:h-[180px] md:w-[200px] md:h-[200px] object-contain"
              />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ ...vp, margin: '-10%' }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="w2-text-glow text-white text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-center leading-[0.88] tracking-tight"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Meet Dreamy.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ ...vp, margin: '-5%' }}
              transition={{ duration: 0.8, delay: 0.45 }}
              className="w2-text-glow text-white/35 text-base sm:text-xl md:text-2xl mt-3 sm:mt-5 font-medium text-center max-w-md"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              The one sheep who strayed from the flock.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={vp}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="w2-text-glow text-white/20 text-sm sm:text-base mt-1 sm:mt-2 font-medium text-center max-w-sm"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Because your dream deserves a coach<br />
              who actually dreams with you.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={vp}
              transition={{ duration: 0.6, delay: 0.95 }}
              className="mt-8 sm:mt-12"
            >
              <Link
                href="/onboarding"
                className="w2-cta-pulse inline-flex items-center gap-3 bg-[#7C5CBF] hover:bg-[#6B4DAE] text-white font-extrabold text-lg sm:text-xl px-10 py-4 rounded-xl transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CBF]"
              >
                Start Running
                <span className="text-xl">&#8594;</span>
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={vp}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="text-white/15 text-xs sm:text-sm font-medium mt-5"
            >
              Free to start. No credit card.
            </motion.p>
          </div>
        </section>
      </div>
    </>
  );
}
