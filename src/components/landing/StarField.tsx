'use client';

/**
 * Animated starfield background for the landing page.
 * Renders ~60 small twinkling dots scattered across the viewport.
 */

// Pre-generated star positions to avoid hydration mismatch (no Math.random at render time)
const stars = [
  { x: 3, y: 2, size: 1.5, delay: 0, dur: 3.2 },
  { x: 12, y: 5, size: 1, delay: 1.4, dur: 4.1 },
  { x: 25, y: 3, size: 1.2, delay: 0.8, dur: 3.8 },
  { x: 38, y: 7, size: 1, delay: 2.1, dur: 4.5 },
  { x: 52, y: 2, size: 1.5, delay: 0.3, dur: 3.4 },
  { x: 67, y: 6, size: 1, delay: 1.9, dur: 4.2 },
  { x: 78, y: 4, size: 1.2, delay: 0.6, dur: 3.6 },
  { x: 91, y: 8, size: 1, delay: 2.5, dur: 4.8 },
  { x: 96, y: 1, size: 1.5, delay: 1.1, dur: 3.3 },
  { x: 7, y: 14, size: 1, delay: 0.4, dur: 4.3 },
  { x: 18, y: 18, size: 1.5, delay: 2.3, dur: 3.7 },
  { x: 33, y: 12, size: 1, delay: 1.6, dur: 4.0 },
  { x: 45, y: 16, size: 1.2, delay: 0.9, dur: 3.5 },
  { x: 58, y: 13, size: 1, delay: 2.8, dur: 4.6 },
  { x: 72, y: 19, size: 1.5, delay: 0.2, dur: 3.1 },
  { x: 84, y: 15, size: 1, delay: 1.7, dur: 4.4 },
  { x: 95, y: 17, size: 1.2, delay: 0.5, dur: 3.9 },
  { x: 5, y: 25, size: 1, delay: 2.0, dur: 4.7 },
  { x: 15, y: 28, size: 1.5, delay: 0.7, dur: 3.3 },
  { x: 28, y: 23, size: 1, delay: 1.3, dur: 4.1 },
  { x: 42, y: 27, size: 1.2, delay: 2.6, dur: 3.6 },
  { x: 55, y: 22, size: 1, delay: 0.1, dur: 4.3 },
  { x: 68, y: 29, size: 1.5, delay: 1.8, dur: 3.8 },
  { x: 82, y: 26, size: 1, delay: 0.4, dur: 4.5 },
  { x: 93, y: 24, size: 1.2, delay: 2.2, dur: 3.2 },
  { x: 8, y: 35, size: 1, delay: 1.0, dur: 4.0 },
  { x: 22, y: 38, size: 1.5, delay: 2.4, dur: 3.5 },
  { x: 36, y: 33, size: 1, delay: 0.6, dur: 4.2 },
  { x: 48, y: 37, size: 1.2, delay: 1.5, dur: 3.7 },
  { x: 62, y: 32, size: 1, delay: 2.9, dur: 4.8 },
  { x: 75, y: 39, size: 1.5, delay: 0.3, dur: 3.4 },
  { x: 88, y: 36, size: 1, delay: 1.2, dur: 4.6 },
  { x: 97, y: 34, size: 1.2, delay: 2.7, dur: 3.1 },
  { x: 4, y: 45, size: 1, delay: 0.8, dur: 4.4 },
  { x: 16, y: 48, size: 1.5, delay: 2.1, dur: 3.6 },
  { x: 30, y: 43, size: 1, delay: 0.2, dur: 4.1 },
  { x: 44, y: 47, size: 1.2, delay: 1.7, dur: 3.9 },
  { x: 57, y: 42, size: 1, delay: 2.5, dur: 4.3 },
  { x: 70, y: 49, size: 1.5, delay: 0.9, dur: 3.2 },
  { x: 85, y: 46, size: 1, delay: 1.4, dur: 4.7 },
  { x: 94, y: 44, size: 1.2, delay: 2.3, dur: 3.5 },
  { x: 10, y: 55, size: 1, delay: 0.5, dur: 4.0 },
  { x: 24, y: 58, size: 1.5, delay: 1.9, dur: 3.8 },
  { x: 38, y: 53, size: 1, delay: 2.8, dur: 4.5 },
  { x: 50, y: 57, size: 1.2, delay: 0.1, dur: 3.3 },
  { x: 64, y: 52, size: 1, delay: 1.6, dur: 4.2 },
  { x: 77, y: 59, size: 1.5, delay: 2.0, dur: 3.7 },
  { x: 90, y: 56, size: 1, delay: 0.7, dur: 4.6 },
  { x: 6, y: 65, size: 1.2, delay: 1.3, dur: 3.4 },
  { x: 20, y: 68, size: 1, delay: 2.6, dur: 4.8 },
  { x: 34, y: 63, size: 1.5, delay: 0.4, dur: 3.1 },
  { x: 46, y: 67, size: 1, delay: 1.8, dur: 4.4 },
  { x: 60, y: 62, size: 1.2, delay: 2.2, dur: 3.6 },
  { x: 73, y: 69, size: 1, delay: 0.6, dur: 4.1 },
  { x: 86, y: 66, size: 1.5, delay: 1.1, dur: 3.9 },
  { x: 98, y: 64, size: 1, delay: 2.4, dur: 4.3 },
  { x: 14, y: 75, size: 1.2, delay: 0.8, dur: 3.5 },
  { x: 27, y: 78, size: 1, delay: 1.5, dur: 4.7 },
  { x: 40, y: 73, size: 1.5, delay: 2.9, dur: 3.2 },
  { x: 54, y: 77, size: 1, delay: 0.3, dur: 4.0 },
  { x: 66, y: 72, size: 1.2, delay: 1.9, dur: 3.8 },
  { x: 80, y: 79, size: 1, delay: 2.7, dur: 4.5 },
  { x: 92, y: 76, size: 1.5, delay: 0.5, dur: 3.3 },
  { x: 9, y: 85, size: 1, delay: 1.2, dur: 4.2 },
  { x: 32, y: 83, size: 1.2, delay: 2.0, dur: 3.7 },
  { x: 56, y: 88, size: 1, delay: 0.9, dur: 4.6 },
  { x: 74, y: 82, size: 1.5, delay: 1.6, dur: 3.4 },
  { x: 89, y: 87, size: 1, delay: 2.3, dur: 4.1 },
  { x: 19, y: 93, size: 1.2, delay: 0.2, dur: 3.9 },
  { x: 43, y: 91, size: 1, delay: 1.7, dur: 4.4 },
  { x: 63, y: 95, size: 1.5, delay: 2.8, dur: 3.6 },
  { x: 81, y: 92, size: 1, delay: 0.4, dur: 4.8 },
  { x: 96, y: 96, size: 1.2, delay: 1.3, dur: 3.1 },
];

export function StarField() {
  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none z-[9997]"
        aria-hidden="true"
      >
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white star-twinkle"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.dur}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.6; }
        }
        .star-twinkle {
          animation: star-twinkle 4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .star-twinkle { animation: none !important; opacity: 0.3 !important; }
        }
      `}</style>
    </>
  );
}
