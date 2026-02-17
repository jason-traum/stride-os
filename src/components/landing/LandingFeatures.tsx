'use client';

import { ScrollReveal } from './ScrollReveal';
import { SheepImage } from './SheepImage';

const features = [
  {
    headline: 'I study every split.',
    body: "Other apps show you a pace chart after your run. Dreamy analyzes cadence patterns, heart rate drift, elevation response, and recovery trends — then connects them across weeks and months to understand how your fitness is actually evolving.",
    mood: 'coach',
    entrance: 'fade' as const,
  },
  {
    headline: 'I work around your life.',
    body: "Swapped your long run for a quick 5K because you ran out of time? Dreamy doesn't punish you — it adjusts. Missed Monday entirely? The week restructures. Did a spontaneous trail run instead of intervals? It factors that in. Your schedule changes every week. Your coach should too.",
    mood: 'confused',
    entrance: 'fade' as const,
  },
  {
    headline: 'I listen when you talk.',
    body: "Tell Dreamy your legs felt heavy, you're stressed from work, or you only slept four hours. It doesn't just log a note — it rewrites tomorrow's workout around it. A real coach asks how you're feeling. So does Dreamy. And it actually does something with the answer.",
    mood: 'idle',
    entrance: 'fade' as const,
  },
  {
    headline: 'I get better the longer we train.',
    body: "No templates. No 'choose your plan.' Dreamy builds your training from your data, your feedback, and your goals — then rebuilds it every day. It learns what paces you thrive at, how you respond to hard weeks, when you need recovery. Your coach after three months is a completely different coach than on day one.",
    mood: 'encouraging',
    entrance: 'bounce' as const,
  },
];

export function LandingFeatures() {
  return (
    <section id="the-coach" className="py-28 sm:py-36 px-6 sm:px-8" aria-label="The Coach">
      <div className="max-w-[1100px] mx-auto">
        <ScrollReveal className="text-center mb-20 sm:mb-28">
          <p
            className="text-[#8A8694] text-xs font-bold tracking-[0.15em] uppercase mb-4"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            The Coach
          </p>
        </ScrollReveal>

        <div className="space-y-24 sm:space-y-32">
          {features.map((f, i) => {
            const textLeft = i % 2 === 0;
            return (
              <div
                key={i}
                className={`grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-20 items-center ${
                  !textLeft ? 'lg:[grid-template-columns:auto_1fr]' : ''
                }`}
              >
                {/* Text */}
                <ScrollReveal className={!textLeft ? 'lg:order-2' : ''}>
                  <h3
                    className="text-[#F0EDE6] font-extrabold leading-[0.95] tracking-[-0.02em] mb-4"
                    style={{
                      fontFamily: 'var(--font-syne)',
                      fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                    }}
                  >
                    {f.headline}
                  </h3>
                  <p
                    className="text-[#8A8694] text-[0.95rem] sm:text-base leading-[1.7] max-w-lg"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    {f.body}
                  </p>
                </ScrollReveal>

                {/* Sheep */}
                <div className={`flex ${textLeft ? 'justify-center lg:justify-end' : 'justify-center lg:justify-start'} ${!textLeft ? 'lg:order-1' : ''}`}>
                  <div className="relative w-[100px] sm:w-[150px] lg:w-[200px]">
                    <div className="absolute inset-0 -m-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,92,191,0.06)_0%,transparent_70%)]" />
                    <SheepImage
                      mood={f.mood}
                      size={200}
                      entrance={f.entrance}
                      delay={0.15}
                      flip={!textLeft}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
