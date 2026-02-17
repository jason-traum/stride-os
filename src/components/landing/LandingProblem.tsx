'use client';

import { ScrollReveal } from './ScrollReveal';

const problems = [
  {
    claim: '"Pick a plan"',
    reality:
      'You tell the app your goal. It hands you a 12-week template that 50,000 other people are also running right now.',
  },
  {
    claim: '"Personalized"',
    reality:
      "The plan adjusts your paces based on a time trial. Then it never changes again — no matter how your body actually responds week to week.",
  },
  {
    claim: '"Flexible scheduling"',
    reality:
      "You pick your training days upfront. Then life happens — a late meeting, a sick kid, a terrible night of sleep. The plan doesn't care. Tuesday is intervals whether you're ready or not.",
  },
  {
    claim: '"AI-powered"',
    reality:
      "The app has a chatbot that answers FAQ. The training plan? Still written by a human coach who's never seen your data.",
  },
];

export function LandingProblem() {
  return (
    <section className="py-28 sm:py-36 px-6 sm:px-8" aria-label="The Problem">
      <div className="max-w-[1100px] mx-auto">
        <ScrollReveal className="text-center mb-14 sm:mb-20">
          <p
            className="text-[#8A8694] text-xs font-bold tracking-[0.15em] uppercase mb-4"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            The Problem
          </p>
          <h2
            className="text-[#F0EDE6] font-extrabold leading-[0.95] tracking-[-0.02em] max-w-2xl mx-auto"
            style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(1.75rem, 3.5vw, 3rem)',
            }}
          >
            Your running app has your data.<br />
            It still doesn&apos;t know you.
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-10 sm:gap-y-14">
          {problems.map((p, i) => (
            <ScrollReveal key={i} delay={i * 0.12}>
              <div className="border-t border-[#2A2933] pt-5">
                <h3
                  className="text-[#F0EDE6] text-lg font-bold mb-2"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  {p.claim}
                </h3>
                <p
                  className="text-[#8A8694] text-[0.95rem] leading-relaxed"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  {p.reality}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
