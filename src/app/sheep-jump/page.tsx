'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const GRAVITY = 0.8;
const JUMP_FORCE = -14;
const GROUND = 160;
const SHEEP_W = 60;
const SHEEP_H = 60;
const START_SPEED = 5;
const SPEED_GAIN = 0.002;
const MIN_GAP = 70;
const MAX_GAP = 140;

type ObstacleKind = 'fence' | 'rock' | 'banana' | 'bush' | 'bird' | 'bee';

interface Obstacle {
  x: number;
  kind: ObstacleKind;
  scored: boolean;
  /** For bees — vertical oscillation offset */
  wobble: number;
  /** Size multiplier (1 = base size) */
  scale: number;
}

const OB_DEFS: Record<ObstacleKind, { w: number; h: number; airborne: boolean; scaleRange: [number, number] }> = {
  fence:  { w: 24, h: 44, airborne: false, scaleRange: [1, 1] },
  rock:   { w: 28, h: 24, airborne: false, scaleRange: [0.7, 1.5] },
  banana: { w: 16, h: 18, airborne: false, scaleRange: [0.8, 1.1] },
  bush:   { w: 36, h: 30, airborne: false, scaleRange: [0.7, 1.6] },
  bird:   { w: 30, h: 24, airborne: true,  scaleRange: [1, 1] },
  bee:    { w: 22, h: 22, airborne: true,  scaleRange: [1, 1] },
};

function obSize(kind: ObstacleKind, scale: number) {
  const def = OB_DEFS[kind];
  return { w: Math.round(def.w * scale), h: Math.round(def.h * scale) };
}

/** Pick a random obstacle, weighting airborne ones lower at low scores */
function randomKind(score: number): ObstacleKind {
  const ground: ObstacleKind[] = ['fence', 'rock', 'banana', 'bush'];
  const air: ObstacleKind[] = ['bird', 'bee'];
  const airChance = score < 5 ? 0 : Math.min(0.35, (score - 5) * 0.02);
  if (Math.random() < airChance) return air[Math.floor(Math.random() * air.length)];
  return ground[Math.floor(Math.random() * ground.length)];
}

function randomScale(kind: ObstacleKind): number {
  const [min, max] = OB_DEFS[kind].scaleRange;
  return min + Math.random() * (max - min);
}

/* ── Obstacle renderers ── */

function FenceSprite() {
  return (
    <div className="relative w-full h-full">
      <div className="absolute left-1 top-0 bottom-0 w-1 bg-[#8B7355] rounded-sm" />
      <div className="absolute right-1 top-0 bottom-0 w-1 bg-[#8B7355] rounded-sm" />
      <div className="absolute left-0 right-0 top-[20%] h-1 bg-[#A08060] rounded-sm" />
      <div className="absolute left-0 right-0 top-[55%] h-1 bg-[#A08060] rounded-sm" />
      <div className="absolute left-0 right-0 top-[85%] h-1 bg-[#A08060] rounded-sm" />
    </div>
  );
}

function RockSprite() {
  return (
    <svg viewBox="0 0 30 26" className="w-full h-full">
      <path d="M4 24 Q2 18 6 12 Q10 6 15 4 Q20 6 24 12 Q28 18 26 24 Z" fill="#5A5A6A" />
      <path d="M8 22 Q6 16 10 12 Q14 8 15 6 Q16 8 18 12" fill="#6B6B7A" fillOpacity="0.5" />
    </svg>
  );
}

function BananaSprite() {
  return (
    <svg viewBox="0 0 20 22" className="w-full h-full">
      <path d="M10 2 Q4 6 3 12 Q2 18 6 20 Q8 18 9 14 Q10 10 14 6 Q16 4 10 2Z" fill="#F5D742" />
      <path d="M10 2 Q12 4 11 8 Q10 12 8 16" stroke="#D4B832" strokeWidth="0.8" fill="none" />
      <circle cx="9" cy="20" r="1" fill="#8B7340" />
    </svg>
  );
}

function BushSprite() {
  return (
    <svg viewBox="0 0 38 32" className="w-full h-full">
      <ellipse cx="12" cy="20" rx="10" ry="10" fill="#2D5A2D" />
      <ellipse cx="26" cy="20" rx="10" ry="10" fill="#2D5A2D" />
      <ellipse cx="19" cy="14" rx="11" ry="10" fill="#3A7A3A" />
      <ellipse cx="10" cy="16" rx="6" ry="5" fill="#4A8A4A" fillOpacity="0.6" />
      <ellipse cx="25" cy="16" rx="5" ry="4" fill="#4A8A4A" fillOpacity="0.4" />
    </svg>
  );
}

function BirdSprite({ frame }: { frame: number }) {
  const wingUp = frame % 20 < 10;
  return (
    <svg viewBox="0 0 30 24" className="w-full h-full">
      {/* Body */}
      <ellipse cx="15" cy="14" rx="8" ry="5" fill="#4A6FA5" />
      {/* Head */}
      <circle cx="24" cy="11" r="4" fill="#5580B0" />
      {/* Beak */}
      <polygon points="28,11 31,10 28,12" fill="#E8A030" />
      {/* Eye */}
      <circle cx="25.5" cy="10" r="1" fill="white" />
      <circle cx="25.8" cy="10" r="0.5" fill="#1A1A2E" />
      {/* Wing */}
      {wingUp ? (
        <path d="M10 12 Q8 4 14 6 Q16 8 15 12" fill="#3A5F8A" />
      ) : (
        <path d="M10 14 Q8 18 14 17 Q16 15 15 14" fill="#3A5F8A" />
      )}
      {/* Tail */}
      <path d="M7 13 Q3 10 2 14 Q4 14 7 15" fill="#3A5F8A" />
    </svg>
  );
}

function BeeSprite({ frame }: { frame: number }) {
  const wingUp = frame % 8 < 4;
  return (
    <svg viewBox="0 0 22 22" className="w-full h-full">
      {/* Body */}
      <ellipse cx="11" cy="12" rx="6" ry="5" fill="#F5D742" />
      {/* Stripes */}
      <rect x="7" y="10" width="8" height="2" rx="1" fill="#2A2A2A" />
      <rect x="8" y="14" width="6" height="1.5" rx="0.75" fill="#2A2A2A" />
      {/* Head */}
      <circle cx="17" cy="11" r="3" fill="#2A2A2A" />
      {/* Eye */}
      <circle cx="18.5" cy="10.5" r="1" fill="white" />
      {/* Wings */}
      {wingUp ? (
        <>
          <ellipse cx="10" cy="6" rx="4" ry="2.5" fill="white" fillOpacity="0.5" />
          <ellipse cx="13" cy="7" rx="3" ry="2" fill="white" fillOpacity="0.4" />
        </>
      ) : (
        <>
          <ellipse cx="10" cy="8" rx="4" ry="2" fill="white" fillOpacity="0.5" />
          <ellipse cx="13" cy="8.5" rx="3" ry="1.5" fill="white" fillOpacity="0.4" />
        </>
      )}
      {/* Stinger */}
      <path d="M5 12 L3 12.5 L5 13" fill="#2A2A2A" />
    </svg>
  );
}

function ObstacleSprite({ kind, frame }: { kind: ObstacleKind; frame: number }) {
  switch (kind) {
    case 'fence':  return <FenceSprite />;
    case 'rock':   return <RockSprite />;
    case 'banana': return <BananaSprite />;
    case 'bush':   return <BushSprite />;
    case 'bird':   return <BirdSprite frame={frame} />;
    case 'bee':    return <BeeSprite frame={frame} />;
  }
}

/* ── Game ── */

export default function SheepJumpPage() {
  const frameRef = useRef(0);
  const sheepY = useRef(0);
  const velocityY = useRef(0);
  const obstacles = useRef<Obstacle[]>([]);
  const speed = useRef(START_SPEED);
  const score = useRef(0);
  const nextSpawn = useRef(80);
  const frameCount = useRef(0);
  const gameArea = useRef<HTMLDivElement>(null);

  const [displayScore, setDisplayScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [canRestart, setCanRestart] = useState(false);
  const [sheepTop, setSheepTop] = useState(GROUND);
  const [obPositions, setObPositions] = useState<Obstacle[]>([]);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('dreamy-sheep-jump-hs');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const reset = useCallback(() => {
    sheepY.current = 0;
    velocityY.current = 0;
    obstacles.current = [];
    speed.current = START_SPEED;
    score.current = 0;
    nextSpawn.current = 80;
    frameCount.current = 0;
    setSheepTop(GROUND);
    setObPositions([]);
    setDisplayScore(0);
  }, []);

  const jump = useCallback(() => {
    if (sheepY.current === 0) {
      velocityY.current = JUMP_FORCE;
    }
  }, []);

  const startGame = useCallback(() => {
    reset();
    setGameState('playing');
  }, [reset]);

  // 2-second cooldown after game over
  useEffect(() => {
    if (gameState !== 'over') return;
    setCanRestart(false);
    const timer = setTimeout(() => setCanRestart(true), 2000);
    return () => clearTimeout(timer);
  }, [gameState]);

  const handleTap = useCallback(() => {
    if (gameState === 'idle') {
      startGame();
      setTimeout(() => jump(), 50);
    } else if (gameState === 'over' && canRestart) {
      startGame();
      setTimeout(() => jump(), 50);
    } else if (gameState === 'playing') {
      jump();
    }
  }, [gameState, canRestart, startGame, jump]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTap]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const loop = () => {
      frameCount.current++;

      // Physics
      velocityY.current += GRAVITY;
      sheepY.current += velocityY.current;
      if (sheepY.current >= 0) {
        sheepY.current = 0;
        velocityY.current = 0;
      }

      // Speed up
      speed.current += SPEED_GAIN;

      // Spawn obstacles
      nextSpawn.current--;
      if (nextSpawn.current <= 0) {
        const kind = randomKind(score.current);
        obstacles.current.push({ x: 420, kind, scored: false, wobble: 0, scale: randomScale(kind) });
        nextSpawn.current = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
      }

      // Move obstacles
      const groundLevel = GROUND + SHEEP_H;
      obstacles.current = obstacles.current
        .map((ob) => {
          const newX = ob.x - speed.current;
          // Bees wobble vertically
          const wobble = ob.kind === 'bee'
            ? Math.sin(frameCount.current * 0.15 + ob.x * 0.05) * 8
            : 0;
          return { ...ob, x: newX, wobble };
        })
        .filter((ob) => ob.x > -obSize(ob.kind, ob.scale).w);

      // Score
      for (const ob of obstacles.current) {
        if (!ob.scored && ob.x + obSize(ob.kind, ob.scale).w < 50) {
          ob.scored = true;
          score.current++;
        }
      }

      // Collision
      const sheepLeft = 50 + 10;
      const sheepRight = 50 + SHEEP_W - 14;
      const sheepTopVal = GROUND + sheepY.current;
      const sheepBottom = sheepTopVal + SHEEP_H - 4;

      for (const ob of obstacles.current) {
        const def = OB_DEFS[ob.kind];
        const sz = obSize(ob.kind, ob.scale);
        const obLeft = ob.x + 4;
        const obRight = ob.x + sz.w - 4;
        let obTop: number;

        if (def.airborne) {
          const baseAirY = groundLevel - SHEEP_H - 10;
          obTop = baseAirY + ob.wobble;
        } else {
          obTop = groundLevel - sz.h;
        }
        const obBottom = obTop + sz.h;

        if (
          sheepRight > obLeft &&
          sheepLeft < obRight &&
          sheepBottom > obTop &&
          sheepTopVal < obBottom
        ) {
          setGameState('over');
          if (score.current > highScore) {
            setHighScore(score.current);
            localStorage.setItem('dreamy-sheep-jump-hs', String(score.current));
          }
          return;
        }
      }

      setSheepTop(GROUND + sheepY.current);
      setObPositions([...obstacles.current]);
      setDisplayScore(score.current);
      setFrame(frameCount.current);

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [gameState, highScore]);

  const groundLevel = GROUND + SHEEP_H;

  return (
    <div className="min-h-screen bg-[#0A0C1E] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Score */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="text-white/30 text-sm font-medium" style={{ fontFamily: 'var(--font-syne)' }}>
            {highScore > 0 && <span>Best: {highScore}</span>}
          </div>
          <div className="text-white text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-syne)' }}>
            {displayScore}
          </div>
        </div>

        {/* Game area */}
        <div
          ref={gameArea}
          className="relative w-full h-[280px] bg-[#0E1028] rounded-2xl border border-white/5 overflow-hidden cursor-pointer select-none"
          onClick={handleTap}
          onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
        >
          {/* Ground line */}
          <div
            className="absolute left-0 right-0 h-px bg-white/10"
            style={{ top: groundLevel }}
          />

          {/* Ground texture */}
          <div className="absolute left-0 right-0 bottom-0" style={{ top: groundLevel + 1 }}>
            <div className="flex flex-wrap gap-6 px-4 pt-2 opacity-[0.04]">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="w-1 h-1 bg-white rounded-full" />
              ))}
            </div>
          </div>

          {/* Sheep */}
          <div
            className="absolute transition-none"
            style={{ left: 50, top: sheepTop, width: SHEEP_W, height: SHEEP_H }}
          >
            <Image
              src={gameState === 'over' ? '/sheep/sad.png' : '/sheep/running.png'}
              alt="Dreamy"
              width={SHEEP_W}
              height={SHEEP_H}
              className="object-contain -scale-x-100"
              priority
            />
          </div>

          {/* Obstacles */}
          {obPositions.map((ob, i) => {
            const def = OB_DEFS[ob.kind];
            const sz = obSize(ob.kind, ob.scale);
            let top: number;
            if (def.airborne) {
              const baseAirY = groundLevel - SHEEP_H - 10;
              top = baseAirY + ob.wobble;
            } else {
              top = groundLevel - sz.h;
            }

            return (
              <div
                key={i}
                className="absolute"
                style={{ left: ob.x, top, width: sz.w, height: sz.h }}
              >
                <ObstacleSprite kind={ob.kind} frame={frame} />
              </div>
            );
          })}

          {/* Idle / Game Over overlay */}
          {gameState !== 'playing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
              {gameState === 'over' ? (
                <>
                  <Image
                    src="/sheep/sad.png"
                    alt="Dreamy"
                    width={80}
                    height={80}
                    className="object-contain mb-3"
                  />
                  <p className="text-white text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-syne)' }}>
                    {displayScore}
                  </p>
                  <p className="text-white/40 text-sm mb-4">
                    {displayScore >= 50 ? 'Legendary.' : displayScore >= 25 ? 'Not bad at all.' : displayScore >= 10 ? 'Getting there.' : 'Try again.'}
                  </p>
                </>
              ) : (
                <>
                  <Image
                    src="/sheep/forward.png"
                    alt="Dreamy"
                    width={80}
                    height={80}
                    className="object-contain mb-3"
                  />
                  <p className="text-white/70 text-lg font-bold mb-1" style={{ fontFamily: 'var(--font-syne)' }}>
                    Sheep Jump
                  </p>
                </>
              )}
              <p className="text-white/30 text-xs">
                {gameState === 'over' && !canRestart ? 'Wait...' : 'Tap or press Space'}
              </p>
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link href="/today" className="text-white/20 text-xs hover:text-white/40 transition-colors">
            back to training
          </Link>
        </div>
      </div>
    </div>
  );
}
