'use client';

import { LandingNav } from '@/components/landing/LandingNav';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingProblem } from '@/components/landing/LandingProblem';
import { MeetDreamy } from '@/components/landing/MeetDreamy';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingCredibility } from '@/components/landing/LandingCredibility';
import { LandingCTA } from '@/components/landing/LandingCTA';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { GrainOverlay } from '@/components/landing/GrainOverlay';

export default function LandingPage() {
  return (
    <div
      id="landing-scroll"
      className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden bg-[#0A0A0F]"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <GrainOverlay />
      <LandingNav />

      <main>
        <LandingHero />
        <LandingProblem />
        <MeetDreamy />
        <LandingFeatures />
        <LandingCredibility />
        <LandingCTA />
      </main>

      <LandingFooter />

      {/* CTA pulse animation */}
      <style>{`
        .landing-cta-pulse {
          animation: landing-pulse 3s ease-in-out infinite;
        }
        @keyframes landing-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124, 92, 191, 0.2); }
          50% { box-shadow: 0 0 20px 6px rgba(124, 92, 191, 0.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-cta-pulse { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
