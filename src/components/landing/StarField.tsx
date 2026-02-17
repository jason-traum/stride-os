'use client';

/**
 * Animated starfield background for the landing page.
 * Renders twinkling dots scattered across the viewport with organic placement.
 */

// Pre-generated star positions — intentionally irregular spacing for natural feel
const stars = [
  { x: 2, y: 1, size: 1.2, delay: 0, dur: 3.2 },
  { x: 14, y: 4, size: 1, delay: 1.4, dur: 4.1 },
  { x: 23, y: 1.5, size: 1.5, delay: 0.8, dur: 3.8 },
  { x: 41, y: 6, size: 1, delay: 2.1, dur: 4.5 },
  { x: 49, y: 3, size: 1.3, delay: 0.3, dur: 3.4 },
  { x: 61, y: 8, size: 1, delay: 1.9, dur: 4.2 },
  { x: 79, y: 2, size: 1.5, delay: 0.6, dur: 3.6 },
  { x: 87, y: 9, size: 1, delay: 2.5, dur: 4.8 },
  { x: 97, y: 4, size: 1.2, delay: 1.1, dur: 3.3 },
  { x: 6, y: 11, size: 1, delay: 0.4, dur: 4.3 },
  { x: 19, y: 17, size: 1.5, delay: 2.3, dur: 3.7 },
  { x: 35, y: 13, size: 1, delay: 1.6, dur: 4.0 },
  { x: 53, y: 10, size: 1.2, delay: 0.9, dur: 3.5 },
  { x: 66, y: 16, size: 1, delay: 2.8, dur: 4.6 },
  { x: 74, y: 11, size: 1.5, delay: 0.2, dur: 3.1 },
  { x: 91, y: 18, size: 1, delay: 1.7, dur: 4.4 },
  { x: 4, y: 24, size: 1.2, delay: 0.5, dur: 3.9 },
  { x: 17, y: 21, size: 1, delay: 2.0, dur: 4.7 },
  { x: 29, y: 28, size: 1.5, delay: 0.7, dur: 3.3 },
  { x: 44, y: 23, size: 1, delay: 1.3, dur: 4.1 },
  { x: 56, y: 29, size: 1.2, delay: 2.6, dur: 3.6 },
  { x: 71, y: 22, size: 1, delay: 0.1, dur: 4.3 },
  { x: 83, y: 27, size: 1.5, delay: 1.8, dur: 3.8 },
  { x: 95, y: 31, size: 1, delay: 0.4, dur: 4.5 },
  { x: 8, y: 33, size: 1.2, delay: 2.2, dur: 3.2 },
  { x: 21, y: 37, size: 1, delay: 1.0, dur: 4.0 },
  { x: 38, y: 34, size: 1.5, delay: 2.4, dur: 3.5 },
  { x: 47, y: 39, size: 1, delay: 0.6, dur: 4.2 },
  { x: 62, y: 36, size: 1.2, delay: 1.5, dur: 3.7 },
  { x: 76, y: 41, size: 1, delay: 2.9, dur: 4.8 },
  { x: 89, y: 33, size: 1.5, delay: 0.3, dur: 3.4 },
  { x: 3, y: 44, size: 1, delay: 1.2, dur: 4.6 },
  { x: 16, y: 49, size: 1.2, delay: 2.7, dur: 3.1 },
  { x: 31, y: 43, size: 1, delay: 0.8, dur: 4.4 },
  { x: 42, y: 51, size: 1.5, delay: 2.1, dur: 3.6 },
  { x: 59, y: 46, size: 1, delay: 0.2, dur: 4.1 },
  { x: 68, y: 52, size: 1.2, delay: 1.7, dur: 3.9 },
  { x: 82, y: 44, size: 1, delay: 2.5, dur: 4.3 },
  { x: 93, y: 48, size: 1.5, delay: 0.9, dur: 3.2 },
  { x: 11, y: 56, size: 1, delay: 1.4, dur: 4.7 },
  { x: 26, y: 53, size: 1.2, delay: 2.3, dur: 3.5 },
  { x: 37, y: 59, size: 1.5, delay: 0.5, dur: 4.0 },
  { x: 51, y: 54, size: 1, delay: 1.9, dur: 3.8 },
  { x: 64, y: 61, size: 1, delay: 2.8, dur: 4.5 },
  { x: 78, y: 57, size: 1.2, delay: 0.1, dur: 3.3 },
  { x: 88, y: 62, size: 1.5, delay: 1.6, dur: 4.2 },
  { x: 5, y: 66, size: 1, delay: 2.0, dur: 3.7 },
  { x: 22, y: 69, size: 1.2, delay: 0.7, dur: 4.6 },
  { x: 34, y: 64, size: 1, delay: 1.3, dur: 3.4 },
  { x: 48, y: 71, size: 1.5, delay: 2.6, dur: 4.1 },
  { x: 57, y: 67, size: 1, delay: 0.4, dur: 3.9 },
  { x: 73, y: 73, size: 1.2, delay: 1.8, dur: 4.4 },
  { x: 85, y: 68, size: 1, delay: 2.2, dur: 3.6 },
  { x: 96, y: 72, size: 1.5, delay: 0.6, dur: 4.8 },
  { x: 9, y: 78, size: 1, delay: 1.1, dur: 3.5 },
  { x: 28, y: 81, size: 1.2, delay: 2.4, dur: 4.0 },
  { x: 39, y: 76, size: 1.5, delay: 0.8, dur: 3.2 },
  { x: 55, y: 83, size: 1, delay: 1.5, dur: 4.7 },
  { x: 67, y: 79, size: 1, delay: 2.9, dur: 3.8 },
  { x: 81, y: 84, size: 1.2, delay: 0.3, dur: 4.3 },
  { x: 14, y: 88, size: 1, delay: 1.9, dur: 3.7 },
  { x: 33, y: 91, size: 1.5, delay: 2.7, dur: 4.5 },
  { x: 46, y: 86, size: 1, delay: 0.5, dur: 3.1 },
  { x: 61, y: 93, size: 1.2, delay: 1.2, dur: 4.2 },
  { x: 77, y: 89, size: 1, delay: 2.1, dur: 3.9 },
  { x: 92, y: 95, size: 1.5, delay: 0.9, dur: 4.6 },
  { x: 7, y: 97, size: 1, delay: 1.7, dur: 3.4 },
  { x: 52, y: 96, size: 1.2, delay: 2.3, dur: 4.1 },
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
