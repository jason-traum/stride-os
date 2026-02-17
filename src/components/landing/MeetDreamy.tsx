'use client';

import { ScrollReveal } from './ScrollReveal';
import { SheepImage } from './SheepImage';
import { motion } from 'framer-motion';
import Image from 'next/image';

/* ── Fake phone mockups ─────────────────────────────────────── */

function PhoneFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[28px] border border-[#2A2933] bg-[#111118] shadow-2xl overflow-hidden ${className}`}>
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#111118] rounded-b-2xl z-10" />
      {/* Screen */}
      <div className="pt-6 pb-4 px-3">
        {children}
      </div>
    </div>
  );
}

function MockDashboard() {
  return (
    <PhoneFrame className="w-[200px] sm:w-[220px]">
      <div className="space-y-2.5">
        {/* Greeting */}
        <div>
          <p className="text-[9px] text-[#5A5768]" style={{ fontFamily: 'var(--font-manrope)' }}>Good morning</p>
          <p className="text-[11px] font-bold text-[#F0EDE6]" style={{ fontFamily: 'var(--font-syne)' }}>Ready to run?</p>
        </div>
        {/* Today's workout card */}
        <div className="rounded-lg bg-[#1A1922] border border-[#2A2933] p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#7C5CBF]" />
            <span className="text-[8px] font-bold text-[#7C5CBF] uppercase tracking-wider">Today</span>
          </div>
          <p className="text-[10px] font-semibold text-[#F0EDE6]">Tempo Run</p>
          <p className="text-[8px] text-[#5A5768] mt-0.5">6 mi &middot; 7:15/mi target</p>
          <div className="flex gap-1.5 mt-2">
            <div className="flex-1 rounded bg-[#7C5CBF]/10 px-1.5 py-1 text-center">
              <p className="text-[7px] text-[#8A8694]">Warmup</p>
              <p className="text-[9px] font-semibold text-[#F0EDE6]">1 mi</p>
            </div>
            <div className="flex-1 rounded bg-[#7C5CBF]/10 px-1.5 py-1 text-center">
              <p className="text-[7px] text-[#8A8694]">Tempo</p>
              <p className="text-[9px] font-semibold text-[#F0EDE6]">4 mi</p>
            </div>
            <div className="flex-1 rounded bg-[#7C5CBF]/10 px-1.5 py-1 text-center">
              <p className="text-[7px] text-[#8A8694]">Cooldown</p>
              <p className="text-[9px] font-semibold text-[#F0EDE6]">1 mi</p>
            </div>
          </div>
        </div>
        {/* Readiness + Weather row */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg bg-[#1A1922] border border-[#2A2933] p-2">
            <p className="text-[7px] text-[#5A5768] uppercase tracking-wider mb-1">Readiness</p>
            <p className="text-[14px] font-bold text-green-400">82</p>
            <p className="text-[7px] text-[#5A5768]">Good</p>
          </div>
          <div className="rounded-lg bg-[#1A1922] border border-[#2A2933] p-2">
            <p className="text-[7px] text-[#5A5768] uppercase tracking-wider mb-1">Weather</p>
            <p className="text-[14px] font-bold text-[#F0EDE6]">54&deg;</p>
            <p className="text-[7px] text-[#5A5768]">Clear</p>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MockChat() {
  return (
    <PhoneFrame className="w-[200px] sm:w-[220px]">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2 pb-1.5 border-b border-[#2A2933]">
          <div className="w-5 h-5 rounded-full bg-[#7C5CBF]/20 flex items-center justify-center">
            <span className="text-[7px]">🐑</span>
          </div>
          <p className="text-[10px] font-semibold text-[#F0EDE6]">Coach Dreamy</p>
        </div>
        {/* Messages */}
        <div className="space-y-2">
          <div className="bg-[#1A1922] rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[85%]">
            <p className="text-[8px] text-[#F0EDE6] leading-relaxed">
              Your tempo yesterday was solid — negative split on the last 2 miles. Your body&apos;s responding well to the higher mileage.
            </p>
          </div>
          <div className="bg-[#7C5CBF]/15 rounded-xl rounded-tr-sm px-2.5 py-1.5 max-w-[80%] ml-auto">
            <p className="text-[8px] text-[#F0EDE6] leading-relaxed">
              Legs felt heavy though. Should I still do intervals tomorrow?
            </p>
          </div>
          <div className="bg-[#1A1922] rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[85%]">
            <p className="text-[8px] text-[#F0EDE6] leading-relaxed">
              Let&apos;s swap to an easy 5-miler. Your fatigue score is elevated — pushing intervals would risk diminishing returns. We&apos;ll hit them Friday when you&apos;re fresher.
            </p>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ── Main component ─────────────────────────────────────────── */

export function MeetDreamy() {
  return (
    <section className="py-14 sm:py-[120px] px-5 sm:px-8" aria-label="Meet Dreamy">
      {/* Top divider */}
      <div className="max-w-[1100px] mx-auto mb-10 sm:mb-20">
        <div className="h-px w-full bg-white/[0.06]" />
      </div>

      <div className="max-w-[1100px] mx-auto text-center">
        {/* Coach portrait — circle crop centered on face */}
        <motion.div
          className="flex justify-center mb-6 sm:mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] rounded-full overflow-hidden border-2 border-[#2A2933] shadow-lg shadow-[#7C5CBF]/10 relative">
            <Image
              src="/sheep/forward.png"
              alt="Coach Dreamy portrait"
              width={200}
              height={200}
              className="absolute inset-0 w-full h-[140%] object-cover object-[center_15%]"
            />
          </div>
        </motion.div>

        {/* Typographic crescendo */}
        <div className="space-y-3 sm:space-y-5 mb-10 sm:mb-16">
          {/* Line 1 — quiet, serif italic */}
          <ScrollReveal delay={0.1}>
            <p
              className="text-[#6A6578] text-base sm:text-lg italic"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Every other app treats you like part of the flock.
            </p>
          </ScrollReveal>

          {/* Line 2 — builds */}
          <ScrollReveal delay={0.25}>
            <p
              className="text-[#F0EDE6] font-bold text-xl sm:text-2xl leading-snug"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Same plan. Same pace. Same advice.<br className="hidden sm:block" /> Follow the sheep in front of you.
            </p>
          </ScrollReveal>

          {/* Line 3 — peak */}
          <ScrollReveal delay={0.4}>
            <p
              className="font-extrabold leading-[0.95] tracking-[-0.02em] pt-1"
              style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 'clamp(1.85rem, 4.5vw, 3.2rem)',
              }}
            >
              <span className="text-[#F0EDE6]">Meet </span>
              <span className="text-[#7C5CBF]">Dreamy</span>
              <span className="text-[#F0EDE6]"> — the one that broke away.</span>
            </p>
          </ScrollReveal>

          {/* Line 4 — resolves, serif italic */}
          <ScrollReveal delay={0.55}>
            <p
              className="text-[#6A6578] text-base sm:text-lg italic pt-1"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Built for runners chasing their own dream, not someone else&apos;s template.
            </p>
          </ScrollReveal>
        </div>

        {/* Phone mockups */}
        <ScrollReveal delay={0.3}>
          <div className="flex justify-center items-end gap-4 sm:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30, rotate: -3 }}
              whileInView={{ opacity: 1, y: 0, rotate: -3 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden sm:block"
            >
              <MockDashboard />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="relative z-10"
            >
              <MockChat />
            </motion.div>
            {/* On mobile, show just the chat. On sm+, show both */}
            <div className="sm:hidden">
              {/* Single mockup for mobile */}
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Bottom divider */}
      <div className="max-w-[1100px] mx-auto mt-10 sm:mt-20">
        <div className="h-px w-full bg-white/[0.06]" />
      </div>
    </section>
  );
}
