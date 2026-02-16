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
import { StarField } from './StarField';
import { CloudLayer } from './CloudLayer';
import './welcome2.css';

export default function WelcomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const prefersReducedMotion = useReducedMotion();

  const bgColor = useTransform(
    scrollYProgress,
    [0, 0.08, 0.18, 0.28, 0.38, 0.48, 0.55, 0.62, 0.72, 0.82, 1.0],
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
    [0, 0.6, 0.72],
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
        <section className="relative" style={{ height: '200vh' }}>
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
                className="w2-text-glow text-white/60 text-lg sm:text-2xl md:text-3xl mt-6 md:mt-10 leading-relaxed font-medium max-w-2xl mx-auto"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Same templates. Same paces. Same advice.<br />
                Built for everyone. Built for no one.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, delay: 1.5 }}
              className="relative z-10 mt-10 md:mt-16"
            >
              <div className="absolute -inset-16 w2-sheep-glow rounded-full" />
              <motion.div
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        scale: [1, 1.015, 1],
                        transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                      }
                }
              >
                <Image
                  src="/sheep/sleeping.png"
                  alt="Dreamy the sheep sleeping peacefully"
                  width={240}
                  height={240}
                  className="object-contain relative z-10"
                  priority
                />
              </motion.div>
            </motion.div>

            <div className="absolute bottom-8 flex flex-col items-center gap-2 w2-scroll-hint">
              <span className="text-white/30 text-[10px] tracking-[0.3em] uppercase">Scroll</span>
              <div className="w-px h-8 bg-gradient-to-b from-white/25 to-transparent" />
            </div>
          </div>
        </section>

        {/* ═══ BEAT 2 — YOU DIDN'T START RUNNING TO FOLLOW ═══ */}
        <section className="relative" style={{ height: '160vh' }}>
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
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ ...vp, margin: '-15%' }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 md:mt-14"
            >
              <motion.div
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        y: [0, -6, 0],
                        transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                      }
                }
              >
                <Image
                  src="/sheep/idle.png"
                  alt="Dreamy the sheep standing alert"
                  width={220}
                  height={220}
                  className="object-contain"
                  priority
                />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══ BEAT 3 — TO FEEL ALIVE ═══ */}
        <section className="relative" style={{ height: '240vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden">
            {!prefersReducedMotion && <SpeedLines />}

            <motion.div
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ ...vp, margin: '-10%' }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
              className="relative z-10 mb-6 md:mb-10"
            >
              <motion.div
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        x: [0, 4, 0, -4, 0],
                        y: [0, -5, 0, -5, 0],
                        transition: { duration: 0.55, repeat: Infinity, ease: 'easeInOut' },
                      }
                }
              >
                <Image
                  src="/sheep/running.png"
                  alt="Dreamy the sheep running"
                  width={280}
                  height={280}
                  className="object-contain"
                />
              </motion.div>
            </motion.div>

            <div className="relative z-10 text-center max-w-5xl">
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-10%' }}
                transition={{ duration: 0.7 }}
                className="w2-text-glow text-white text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[6.5rem] font-extrabold leading-[0.88] tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                You started running<br />
                to feel alive.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ ...vp, margin: '-10%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="w2-text-glow text-white/50 text-xl sm:text-2xl md:text-3xl mt-6 font-medium"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                And you never looked back.
              </motion.p>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 4 — WHY DOES YOUR COACH TREAT YOU LIKE EVERYONE ELSE ═══ */}
        <section className="relative" style={{ height: '180vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-4 sm:px-6">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ ...vp, margin: '-20%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="mb-6 md:mb-10"
            >
              <Image
                src="/sheep/encouraging.png"
                alt="Dreamy the sheep giving an encouraging thumbs up"
                width={220}
                height={220}
                className="object-contain"
              />
            </motion.div>

            <div className="relative z-10 text-center max-w-4xl space-y-5 md:space-y-8">
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.8 }}
                className="text-gray-900 text-[2.25rem] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[0.95] tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                So why does your<br />
                coach treat you<br />
                like everyone else?
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ ...vp, margin: '-15%' }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-gray-600 text-xl sm:text-2xl md:text-3xl leading-relaxed font-medium"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Your legs. Your lungs. Your life.<br />
                No two runners are the same.
              </motion.p>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 5 — THE COACH ═══ */}
        <section className="relative" style={{ height: '220vh' }}>
          <div className="w2-sticky h-screen flex items-center justify-center px-4 sm:px-6">
            <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ ...vp, margin: '-10%' }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="flex justify-center lg:justify-end"
              >
                <Image
                  src="/sheep/coach.png"
                  alt="Dreamy the sheep with a coaching tablet"
                  width={260}
                  height={260}
                  className="object-contain"
                />
              </motion.div>

              <div className="space-y-8">
                {[
                  {
                    head: 'I study every split.',
                    body: 'Cadence. Heart rate drift. Elevation response. Recovery trends. Every run tells a story — Dreamy reads all of them.',
                  },
                  {
                    head: 'I listen when you talk.',
                    body: 'Heavy legs. Bad sleep. Stress at work. Tell Dreamy how you feel and it rewrites tomorrow\u2019s workout around you.',
                  },
                  {
                    head: 'I learn how YOU run.',
                    body: 'No templates. Dreamy builds your training from your data, your feedback, and your goals \u2014 and rebuilds it every day.',
                  },
                ].map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ ...vp, margin: '-40px' }}
                    transition={{ duration: 0.6, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="border-l-3 border-[#7C5CBF] pl-6 py-2"
                  >
                    <h3
                      className="text-gray-900 text-2xl sm:text-3xl font-extrabold mb-2"
                      style={{ fontFamily: 'var(--font-syne)' }}
                    >
                      {card.head}
                    </h3>
                    <p
                      className="text-gray-600 text-lg sm:text-xl leading-relaxed font-medium"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      {card.body}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ BEAT 6 — YOUR DREAM. YOUR COACH. ═══ */}
        <section className="relative" style={{ height: '150vh' }}>
          <div className="w2-sticky h-screen flex flex-col items-center justify-center px-4 sm:px-6">
            <motion.div
              initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
              whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
              viewport={{ ...vp, margin: '-10%' }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="mb-4 md:mb-8"
            >
              <Image
                src="/sheep/champion.png"
                alt="Dreamy the sheep celebrating with a trophy"
                width={300}
                height={300}
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
