'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const GRAVITY = 0.8;
const JUMP_FORCE = -14;
const GROUND = 160;
const SHEEP_W = 60;
const SHEEP_H = 60;
const FENCE_W = 24;
const FENCE_H = 44;
const START_SPEED = 5;
const SPEED_GAIN = 0.002;
const MIN_GAP = 70;
const MAX_GAP = 140;

type Fence = { x: number; scored: boolean };

export default function SheepJumpPage() {
  const frameRef = useRef(0);
  const sheepY = useRef(0);
  const velocityY = useRef(0);
  const fences = useRef<Fence[]>([]);
  const speed = useRef(START_SPEED);
  const score = useRef(0);
  const nextSpawn = useRef(80);
  const frameCount = useRef(0);
  const isJumping = useRef(false);
  const gameArea = useRef<HTMLDivElement>(null);

  const [displayScore, setDisplayScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [sheepTop, setSheepTop] = useState(GROUND);
  const [fencePositions, setFencePositions] = useState<Fence[]>([]);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('dreamy-sheep-jump-hs');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const reset = useCallback(() => {
    sheepY.current = 0;
    velocityY.current = 0;
    fences.current = [];
    speed.current = START_SPEED;
    score.current = 0;
    nextSpawn.current = 80;
    frameCount.current = 0;
    isJumping.current = false;
    setSheepTop(GROUND);
    setFencePositions([]);
    setDisplayScore(0);
  }, []);

  const jump = useCallback(() => {
    if (sheepY.current === 0) {
      velocityY.current = JUMP_FORCE;
      isJumping.current = true;
    }
  }, []);

  const startGame = useCallback(() => {
    reset();
    setGameState('playing');
  }, [reset]);

  const handleTap = useCallback(() => {
    if (gameState === 'idle' || gameState === 'over') {
      startGame();
      // Small delay so the first tap starts the game, next tap jumps
      setTimeout(() => jump(), 50);
    } else if (gameState === 'playing') {
      jump();
    }
  }, [gameState, startGame, jump]);

  // Keyboard + touch
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
        isJumping.current = false;
      }

      // Speed up
      speed.current += SPEED_GAIN;

      // Spawn fences
      nextSpawn.current--;
      if (nextSpawn.current <= 0) {
        fences.current.push({ x: 400, scored: false });
        nextSpawn.current = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
      }

      // Move fences
      fences.current = fences.current
        .map((f) => ({ ...f, x: f.x - speed.current }))
        .filter((f) => f.x > -FENCE_W);

      // Score
      for (const f of fences.current) {
        if (!f.scored && f.x + FENCE_W < 50) {
          f.scored = true;
          score.current++;
        }
      }

      // Collision (sheep hitbox is slightly forgiving)
      const sheepLeft = 50 + 8;
      const sheepRight = 50 + SHEEP_W - 12;
      const sheepBottom = GROUND + sheepY.current + SHEEP_H;
      const groundLevel = GROUND + SHEEP_H;

      for (const f of fences.current) {
        const fenceLeft = f.x;
        const fenceRight = f.x + FENCE_W;
        const fenceTop = groundLevel - FENCE_H;

        if (
          sheepRight > fenceLeft &&
          sheepLeft < fenceRight &&
          sheepBottom > fenceTop
        ) {
          // Game over
          setGameState('over');
          if (score.current > highScore) {
            setHighScore(score.current);
            localStorage.setItem('dreamy-sheep-jump-hs', String(score.current));
          }
          return;
        }
      }

      // Update display
      setSheepTop(GROUND + sheepY.current);
      setFencePositions([...fences.current]);
      setDisplayScore(score.current);

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [gameState, highScore]);

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
            style={{ top: GROUND + SHEEP_H }}
          />

          {/* Ground texture - subtle dots */}
          <div className="absolute left-0 right-0 bottom-0" style={{ top: GROUND + SHEEP_H + 1 }}>
            <div className="flex flex-wrap gap-6 px-4 pt-2 opacity-[0.04]">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="w-1 h-1 bg-white rounded-full" />
              ))}
            </div>
          </div>

          {/* Sheep */}
          <div
            className="absolute transition-none"
            style={{
              left: 50,
              top: sheepTop,
              width: SHEEP_W,
              height: SHEEP_H,
            }}
          >
            <Image
              src={gameState === 'over' ? '/sheep/sad.png' : '/sheep/running.png'}
              alt="Dreamy"
              width={SHEEP_W}
              height={SHEEP_H}
              className="object-contain"
              priority
            />
          </div>

          {/* Fences */}
          {fencePositions.map((f, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: f.x,
                top: GROUND + SHEEP_H - FENCE_H,
                width: FENCE_W,
                height: FENCE_H,
              }}
            >
              {/* Fence post */}
              <div className="absolute inset-x-0 bottom-0 h-full flex items-end justify-center">
                <div className="relative w-full h-full">
                  {/* Vertical posts */}
                  <div className="absolute left-1 top-0 bottom-0 w-1 bg-[#8B7355] rounded-sm" />
                  <div className="absolute right-1 top-0 bottom-0 w-1 bg-[#8B7355] rounded-sm" />
                  {/* Horizontal rails */}
                  <div className="absolute left-0 right-0 top-[20%] h-1 bg-[#A08060] rounded-sm" />
                  <div className="absolute left-0 right-0 top-[55%] h-1 bg-[#A08060] rounded-sm" />
                  <div className="absolute left-0 right-0 top-[85%] h-1 bg-[#A08060] rounded-sm" />
                </div>
              </div>
            </div>
          ))}

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
                    {displayScore >= 50 ? 'Legendary.' : displayScore >= 25 ? 'Not bad at all.' : displayScore >= 10 ? 'Getting there.' : 'Tap to try again.'}
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
                Tap or press Space
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
