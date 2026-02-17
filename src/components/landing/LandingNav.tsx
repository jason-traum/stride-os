'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const container = document.getElementById('landing-scroll');
    if (!container) return;
    const onScroll = () => setScrolled(container.scrollTop > 40);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[10001] transition-all duration-300 ${
        scrolled ? 'bg-[#0A0A0F]/80 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1100px] mx-auto flex items-center justify-between px-6 sm:px-8 h-14">
        <span
          className="text-[#F0EDE6] text-base font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          dreamy
        </span>

        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="hidden sm:inline text-[#8A8694] text-sm hover:text-[#F0EDE6] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/onboarding"
            className="bg-[#7C5CBF] hover:bg-[#6B4DAE] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CBF]"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
