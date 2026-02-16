'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Playfair_Display, Syne } from 'next/font/google';
import Link from 'next/link';
import './welcome.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  weight: ['700', '800'],
});

export default function WelcomePage() {
  const particlesRef = useRef<HTMLDivElement>(null);
  const statsObservedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate twinkling particles
  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;

    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'wl-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.setProperty('--duration', (3 + Math.random() * 6) + 's');
      p.style.setProperty('--delay', (Math.random() * 5) + 's');
      p.style.setProperty('--max-opacity', (0.15 + Math.random() * 0.45).toFixed(2));
      const size = (1 + Math.random() * 2.5) + 'px';
      p.style.width = size;
      p.style.height = size;
      container.appendChild(p);
    }

    return () => {
      container.innerHTML = '';
    };
  }, []);

  // Intersection observer for scroll reveal animations
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('wl-visible');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px', root }
    );

    root.querySelectorAll('.wl-reveal').forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Stats counter animation on scroll
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    function animateCounter(el: HTMLElement, target: number, suffix = '', duration = 2000) {
      const start = performance.now();
      const update = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = current.toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    }

    const statsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !statsObservedRef.current) {
            statsObservedRef.current = true;
            const s1 = document.getElementById('wl-stat1');
            const s2 = document.getElementById('wl-stat2');
            const s3 = document.getElementById('wl-stat3');
            const s4 = document.getElementById('wl-stat4');
            if (s1) animateCounter(s1, 12480);
            if (s2) animateCounter(s2, 3200);
            if (s3) animateCounter(s3, 847);
            if (s4) animateCounter(s4, 94, '%');
            statsObserver.disconnect();
          }
        });
      },
      { threshold: 0.3, root }
    );

    const statsEl = root.querySelector('.wl-stats');
    if (statsEl) statsObserver.observe(statsEl);

    return () => statsObserver.disconnect();
  }, []);

  // Smooth scroll handler for hash links inside the fixed container
  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    []
  );

  return (
    <div
      className={`welcome-page ${playfair.variable} ${syne.variable}`}
      ref={containerRef}
    >
      {/* NAV */}
      <nav className="wl-nav">
        <div className="wl-nav-logo">dreamy</div>
        <ul className="wl-nav-links">
          <li>
            <a
              href="#wl-features"
              onClick={(e) => handleAnchorClick(e, 'wl-features')}
            >
              Features
            </a>
          </li>
          <li>
            <a
              href="#wl-about"
              onClick={(e) => handleAnchorClick(e, 'wl-about')}
            >
              About
            </a>
          </li>
          <li>
            <Link href="/" className="wl-nav-cta">
              Get Started
            </Link>
          </li>
        </ul>
      </nav>

      {/* HERO */}
      <section className="wl-hero">
        <div className="wl-particles" ref={particlesRef} />
        <div className="wl-runner-path">
          <div className="wl-runner-line" />
        </div>

        <div className="wl-hero-content">
          <div className="wl-hero-badge">
            <span className="wl-badge-dot" />
            AI-Powered Running Coach
          </div>
          <h1 className="wl-hero-title">
            <span className="wl-line-1">Run like you&apos;re</span>
            <span className="wl-line-2">chasing a dream.</span>
          </h1>
          <p className="wl-hero-sub">
            Your runs deserve more than a stopwatch. Dreamy is an{' '}
            <em>intelligent coach</em> that learns how you move, adapts to how
            you feel, and helps you become the runner you haven&apos;t met yet.
          </p>
          <div className="wl-hero-actions">
            <Link href="/" className="wl-btn-primary">
              <span>Start Your Journey</span>
              <span>→</span>
            </Link>
            <a
              href="#wl-features"
              className="wl-btn-secondary"
              onClick={(e) => handleAnchorClick(e, 'wl-features')}
            >
              <span>▶</span>
              <span>See How It Works</span>
            </a>
          </div>
        </div>

        <div className="wl-scroll-hint">
          <span>Explore</span>
          <div className="wl-scroll-line" />
        </div>
      </section>

      {/* FEATURES */}
      <section className="wl-features" id="wl-features">
        <div className="wl-reveal">
          <p className="wl-section-label">What Makes Dreamy Different</p>
          <h2 className="wl-section-title">
            Coaching that
            <br />
            evolves with you.
          </h2>
          <p className="wl-section-desc">
            Not another training plan pulled from a spreadsheet. Dreamy adapts
            in real time to your body, your goals, and the world around you.
          </p>
        </div>

        <div className="wl-feature-grid">
          <div className="wl-feature-card wl-reveal">
            <div className="wl-feature-icon wl-purple">🧠</div>
            <h3>Adaptive AI Coach</h3>
            <p>
              Your coach learns your patterns, adjusts for fatigue, and knows
              when to push you and when to pull back. Every workout is calibrated
              to where you are today.
            </p>
          </div>
          <div className="wl-feature-card wl-reveal">
            <div className="wl-feature-icon wl-warm">🌤️</div>
            <h3>Weather-Aware Pacing</h3>
            <p>
              Heat, humidity, wind, altitude — Dreamy adjusts your target pace
              in real time so your effort stays honest no matter what the sky
              throws at you.
            </p>
          </div>
          <div className="wl-feature-card wl-reveal">
            <div className="wl-feature-icon wl-sunrise">📊</div>
            <h3>Deep Workout Analysis</h3>
            <p>
              Splits, heart rate zones, cadence trends, effort distribution. See
              every run through a lens that reveals what the numbers really mean.
            </p>
          </div>
          <div className="wl-feature-card wl-reveal">
            <div className="wl-feature-icon wl-purple">🔗</div>
            <h3>Strava Connected</h3>
            <p>
              Sync effortlessly with Strava. Your training history flows into
              Dreamy, giving your coach the full picture from day one.
            </p>
          </div>
          <div className="wl-feature-card wl-reveal">
            <div className="wl-feature-icon wl-warm">💬</div>
            <h3>Post-Run Check-Ins</h3>
            <p>
              After every run, a quick reflection that feeds your coach. How did
              your legs feel? Your breathing? Small signals that shape smarter
              plans.
            </p>
          </div>
          <div className="wl-feature-card wl-reveal">
            <div className="wl-feature-icon wl-sunrise">🏔️</div>
            <h3>Race-Ready Plans</h3>
            <p>
              Training for a 5K or a marathon? Dreamy builds a periodized plan
              that peaks you at exactly the right moment.
            </p>
          </div>
        </div>
      </section>

      {/* MOTIVATION */}
      <section className="wl-motivation" id="wl-about">
        <div className="wl-reveal">
          <p className="wl-motivation-quote">
            &ldquo;The miracle isn&apos;t that I finished. The miracle is that I
            had the <span className="wl-highlight">courage to start</span>
            .&rdquo;
          </p>
          <p className="wl-motivation-attr">John Bingham</p>
        </div>
      </section>

      {/* STATS */}
      <section className="wl-stats">
        <div className="wl-stats-grid wl-reveal">
          <div className="wl-stat-item">
            <h4 id="wl-stat1">0</h4>
            <p>Miles coached</p>
          </div>
          <div className="wl-stat-item">
            <h4 id="wl-stat2">0</h4>
            <p>Workouts adapted</p>
          </div>
          <div className="wl-stat-item">
            <h4 id="wl-stat3">0</h4>
            <p>PRs unlocked</p>
          </div>
          <div className="wl-stat-item">
            <h4 id="wl-stat4">0%</h4>
            <p>Plan completion</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wl-cta-section">
        <div className="wl-cta-glow" />
        <div className="wl-cta-content wl-reveal">
          <h2 className="wl-cta-title">
            Every dream
            <br />
            starts with a step.
          </h2>
          <p className="wl-cta-sub">
            Join the runners who stopped guessing and started dreaming bigger.
          </p>
          <Link href="/" className="wl-btn-primary wl-btn-large">
            <span>Get Dreamy — It&apos;s Free</span>
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="wl-footer">
        <div className="wl-footer-logo">dreamy</div>
        <p>Built by a runner, for runners. &copy; 2026</p>
      </footer>
    </div>
  );
}
