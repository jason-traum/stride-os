'use client';

import { useRef, useMemo, type RefObject } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

/* ── Phone mockup placeholder ── */
function PhoneMockup({ variant }: { variant: 'dashboard' | 'coach' }) {
  return (
    <div className="relative w-[280px] sm:w-[320px] h-[560px] sm:h-[640px] bg-[#1A1A2E] rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden p-3">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 pt-2 pb-3">
        <span className="text-white/40 text-[10px] font-medium">9:41</span>
        <div className="flex gap-1">
          <div className="w-3.5 h-2 bg-white/30 rounded-sm" />
          <div className="w-1.5 h-2 bg-white/30 rounded-sm" />
        </div>
      </div>
      {/* Content area */}
      <div className="rounded-2xl bg-[#12122A] h-full overflow-hidden p-4 space-y-4">
        {variant === 'dashboard' ? (
          <>
            {/* Header */}
            <div className="space-y-1">
              <div className="w-24 h-3 bg-white/10 rounded" />
              <div className="w-40 h-5 bg-white/15 rounded" />
            </div>
            {/* Workout card */}
            <div className="bg-[#7C5CBF]/20 border border-[#7C5CBF]/30 rounded-xl p-3 space-y-2">
              <div className="w-28 h-3 bg-[#7C5CBF]/40 rounded" />
              <div className="w-full h-4 bg-[#7C5CBF]/25 rounded" />
              <div className="flex gap-3 mt-1">
                <div className="w-12 h-8 bg-[#7C5CBF]/30 rounded-lg" />
                <div className="w-12 h-8 bg-[#7C5CBF]/30 rounded-lg" />
                <div className="w-12 h-8 bg-[#7C5CBF]/30 rounded-lg" />
              </div>
            </div>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 rounded-lg p-2 space-y-1">
                <div className="w-8 h-2 bg-white/10 rounded" />
                <div className="w-12 h-4 bg-white/15 rounded" />
              </div>
              <div className="bg-white/5 rounded-lg p-2 space-y-1">
                <div className="w-8 h-2 bg-white/10 rounded" />
                <div className="w-12 h-4 bg-white/15 rounded" />
              </div>
              <div className="bg-white/5 rounded-lg p-2 space-y-1">
                <div className="w-8 h-2 bg-white/10 rounded" />
                <div className="w-12 h-4 bg-white/15 rounded" />
              </div>
            </div>
            {/* Chart area */}
            <div className="bg-white/5 rounded-xl p-3 h-28 flex items-end gap-1">
              {[40, 65, 50, 80, 60, 75, 90, 55, 70, 85].map((h, i) => (
                <div key={i} className="flex-1 bg-[#7C5CBF]/40 rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <div className="w-8 h-8 bg-[#7C5CBF]/30 rounded-full" />
              <div className="w-20 h-3 bg-white/15 rounded" />
            </div>
            {/* Chat messages */}
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-[#7C5CBF]/30 rounded-2xl rounded-br-sm px-3 py-2 max-w-[75%] space-y-1">
                  <div className="w-32 h-2.5 bg-white/20 rounded" />
                  <div className="w-20 h-2.5 bg-white/15 rounded" />
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white/8 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[80%] space-y-1">
                  <div className="w-36 h-2.5 bg-white/15 rounded" />
                  <div className="w-44 h-2.5 bg-white/12 rounded" />
                  <div className="w-28 h-2.5 bg-white/10 rounded" />
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-[#7C5CBF]/30 rounded-2xl rounded-br-sm px-3 py-2 max-w-[65%] space-y-1">
                  <div className="w-24 h-2.5 bg-white/20 rounded" />
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white/8 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%] space-y-1">
                  <div className="w-40 h-2.5 bg-white/15 rounded" />
                  <div className="w-48 h-2.5 bg-white/12 rounded" />
                  <div className="w-36 h-2.5 bg-white/10 rounded" />
                  <div className="w-20 h-2.5 bg-white/10 rounded" />
                </div>
              </div>
            </div>
            {/* Input area */}
            <div className="absolute bottom-6 left-7 right-7">
              <div className="bg-white/8 rounded-full px-4 py-2.5 flex items-center justify-between">
                <div className="w-28 h-2.5 bg-white/10 rounded" />
                <div className="w-6 h-6 bg-[#7C5CBF]/40 rounded-full" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
import { StarField } from './StarField';
import { CloudLayer } from './CloudLayer';
import './welcome2.css';

export default function WelcomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const prefersReducedMotion = useReducedMotion();

  const bgColor = useTransform(
    scrollYProgress,
    [0, 0.06, 0.14, 0.22, 0.32, 0.42, 0.50, 0.58, 0.68, 0.80, 1.0],
    [
      '#0B0E2C',
      '#0E1132',
      '#161040',
      '#2d1b69',
      '#4B2D8E',
      '#7B3FA0',
      '#B85A48',
      '#D49040',
      '#EDD098',
      '#FEFCF9',
      '#FEFCF9',
    ]
  );

  const navColor = useTransform(
    scrollYProgress,
    [0, 0.55, 0.68],
    ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.55)', 'rgba(50,40,60,0.55)']
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
          <motion.span
            className="text-sm font-medium tracking-[0.2em] uppercase cursor-default"
            style={{ color: navColor, fontFamily: 'var(--font-syne)' }}
          >
            dreamy
          </motion.span>
          <motion.div style={{ color: navColor }}>
            <Link
              href="/login"
              className="text-sm hover:opacity-100 transition-opacity"
              style={{ color: 'inherit' }}
            >
              Log In
            </Link>
          </motion.div>
        </nav>

        {/* ═══ BEAT 1 — EVERY PLAN IS THE SAME PLAN ═══ */}
        <section className="relative" style={{ height: '220vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-4 sm:px-6">
            <StarField scrollProgress={scrollYProgress} />
            <CloudLayer scrollProgress={scrollYProgress} />

            <div className="relative z-10 text-center max-w-5xl">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3 }}
                className="w2-text-glow text-white text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[6.5rem] font-extrabold leading-[0.92] tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Every plan is<br />the same plan.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.9 }}
                className="w2-text-glow text-white/50 text-lg sm:text-2xl md:text-3xl mt-6 md:mt-10 leading-relaxed font-medium max-w-2xl mx-auto"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Same templates. Same paces. Same advice.<br />
                Built for everyone. Built for no one.
              </motion.p>
            </div>

            <div className="absolute bottom-8 flex flex-col items-center gap-2 w2-scroll-hint">
              <span className="text-white/30 text-[10px] tracking-[0.3em] uppercase">Scroll</span>
              <div className="w-px h-8 bg-gradient-to-b from-white/25 to-transparent" />
            </div>
          </div>
        </section>

        {/* ═══ BEAT 2 — YOU DIDN'T START RUNNING TO FOLLOW ═══ */}
        <section className="relative" style={{ height: '170vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-4 sm:px-6">
            <div className="relative z-10 text-center max-w-5xl">
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.8 }}
                className="w2-text-glow text-white text-[2.5rem] sm:text-6xl md:text-7xl lg:text-[6rem] font-extrabold leading-[0.92] tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                But you didn&apos;t start<br />
                running to follow.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 1, delay: 0.4 }}
                className="w2-text-glow text-white/40 text-xl sm:text-2xl md:text-3xl mt-6 md:mt-10 font-medium"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                You run to feel something real.
              </motion.p>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 3 — TO FEEL ALIVE ═══ */}
        <section className="relative" style={{ height: '240vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden">
            {!prefersReducedMotion && <SpeedLines />}

            <div className="relative z-10 text-center max-w-5xl">
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-10%' }}
                transition={{ duration: 0.7 }}
                className="w2-text-glow text-white text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[6.5rem] font-extrabold leading-[0.88] tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                The breath that settles.<br />
                The pace that locks in.<br />
                <span className="text-white/60">The world that falls away.</span>
              </motion.h2>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 4 — YOUR COACH SHOULD KNOW YOU ═══ */}
        <section className="relative" style={{ height: '200vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-4 sm:px-6">
            <div className="relative z-10 text-center max-w-4xl space-y-5 md:space-y-8">
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.8 }}
                className="text-gray-900 text-[2.25rem] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[0.95] tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Your coach should<br />
                know you better<br />
                than your shoes do.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-gray-600 text-xl sm:text-2xl md:text-3xl leading-relaxed font-medium max-w-2xl mx-auto"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Your legs. Your lungs. Your life.<br />
                Dreamy learns how <em>you</em> run.
              </motion.p>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 5 — THE PRODUCT (Screenshots + Features) ═══ */}
        <section className="relative" style={{ height: '300vh' }}>
          <div className="w2-sticky h-screen flex items-center justify-center px-4 sm:px-6">
            <div className="max-w-6xl w-full">
              {/* Row 1: Adaptive coaching + screenshot */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ ...vp, margin: '-10%' }}
                  transition={{ duration: 0.7 }}
                  className="space-y-4"
                >
                  <h3
                    className="text-gray-900 text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight"
                    style={{ fontFamily: 'var(--font-syne)' }}
                  >
                    Coaching that<br />rewrites itself.
                  </h3>
                  <p
                    className="text-gray-600 text-lg sm:text-xl md:text-2xl leading-relaxed font-medium max-w-lg"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Every run teaches Dreamy something new about you.
                    Bad sleep? Sore legs? It adjusts tomorrow before you wake up.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ ...vp, margin: '-10%' }}
                  transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex justify-center"
                >
                  <PhoneMockup variant="dashboard" />
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 5b — SECOND SCREENSHOT ═══ */}
        <section className="relative" style={{ height: '250vh' }}>
          <div className="w2-sticky h-screen flex items-center justify-center px-4 sm:px-6">
            <div className="max-w-6xl w-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ ...vp, margin: '-10%' }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="flex justify-center order-2 lg:order-1"
                >
                  <PhoneMockup variant="coach" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ ...vp, margin: '-10%' }}
                  transition={{ duration: 0.7 }}
                  className="space-y-4 order-1 lg:order-2"
                >
                  <h3
                    className="text-gray-900 text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight"
                    style={{ fontFamily: 'var(--font-syne)' }}
                  >
                    A coach that<br />actually listens.
                  </h3>
                  <p
                    className="text-gray-600 text-lg sm:text-xl md:text-2xl leading-relaxed font-medium max-w-lg"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Tell it how you feel. Ask it anything.
                    Dreamy studies your splits, your patterns, and your
                    feedback — and rebuilds your plan every single day.
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 6 — YOUR DREAM. YOUR COACH. ═══ */}
        <section className="relative" style={{ height: '160vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-4 sm:px-6">
            {/* The sheep reveal — this is the only sheep on the entire page */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ ...vp, margin: '-10%' }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              className="mb-4 md:mb-8"
            >
              <Image
                src="/sheep/champion.png"
                alt="Dreamy the sheep — your AI running coach"
                width={280}
                height={280}
                className="object-contain"
              />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ ...vp, margin: '-10%' }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-gray-900 text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[6.5rem] font-extrabold text-center leading-[0.88] tracking-tight"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Your dream.<br />
              Your coach.
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ ...vp, margin: '-5%' }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-10 md:mt-14"
            >
              <Link
                href="/onboarding"
                className="w2-cta-pulse inline-flex items-center gap-3 bg-[#7C5CBF] hover:bg-[#6B4DAE] text-white font-extrabold text-xl sm:text-2xl px-12 py-5 rounded-xl transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CBF]"
              >
                Meet Your Coach
                <span className="text-2xl">→</span>
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={vp}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="text-gray-500 text-base sm:text-lg font-medium mt-6"
            >
              Free to start. No credit card.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={vp}
              transition={{ duration: 0.8, delay: 1 }}
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mt-8 text-gray-400 text-sm font-medium"
            >
              <span>Syncs with Strava</span>
              <span className="hidden sm:inline w-1 h-1 bg-gray-300 rounded-full" />
              <span>Garmin &amp; Apple Watch</span>
              <span className="hidden sm:inline w-1 h-1 bg-gray-300 rounded-full" />
              <span>AI-powered, human-centered</span>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
}

function SpeedLines() {
  const lines = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        top: `${10 + Math.random() * 80}%`,
        width: `${120 + Math.random() * 260}px`,
        duration: `${1.8 + Math.random() * 2.5}s`,
        delay: `${Math.random() * 3.5}s`,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {lines.map((line) => (
        <div
          key={line.id}
          className="w2-speed-line"
          style={
            {
              top: line.top,
              width: line.width,
              '--duration': line.duration,
              '--delay': line.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
