'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trophy, RotateCcw } from 'lucide-react';
import { useModalBodyLock } from '@/hooks/useModalBodyLock';

interface SnakeGameProps {
  onClose: () => void;
  gender?: 'male' | 'female' | 'other';
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Point = { x: number; y: number };

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 3;

// Food: shoe, medal, lightning, water, honey, medal (gold), apple
const FOOD_EMOJIS = ['\u{1F45F}', '\u{1F947}', '\u{26A1}', '\u{1F4A7}', '\u{1F36F}', '\u{1F3C5}', '\u{1F34E}'];
// Beer unlocks at level 21
const BEER_EMOJI = '\u{1F37A}';
const BEER_LEVEL = 21;
const POOP_EMOJI = '\u{1F4A9}';
const POOP_SPAWN_SCORE = 3; // Poop starts appearing after this score

// Performance Spectrum v3 color ramp — changes every 8 points, starts at easy
// sky → steady → marathon → tempo → threshold → interval → repetition → gold
const PACE_RAMP_COLORS = [
  { r: 94,  g: 168, b: 200 }, // 0-7:   sky (easy)
  { r: 14,  g: 165, b: 233 }, // 8-15:  bright sky (steady)
  { r: 59,  g: 130, b: 246 }, // 16-23: blue (marathon)
  { r: 99,  g: 102, b: 241 }, // 24-31: indigo (tempo)
  { r: 139, g: 92,  b: 246 }, // 32-39: violet (threshold)
  { r: 224, g: 69,  b: 69  }, // 40-47: red (interval)
  { r: 212, g: 42,  b: 92  }, // 48-55: crimson (repetition)
  { r: 245, g: 158, b: 11  }, // 56+:   gold (race)
];

function getSnakeColor(score: number): { r: number; g: number; b: number } {
  const index = Math.min(Math.floor(score / 8), PACE_RAMP_COLORS.length - 1);
  return PACE_RAMP_COLORS[index];
}

function getRunnerEmoji(gender?: string): string {
  if (gender === 'male') return '\u{1F3C3}\u{200D}\u{2642}\u{FE0F}';
  if (gender === 'female') return '\u{1F3C3}\u{200D}\u{2640}\u{FE0F}';
  return '\u{1F3C3}';
}

export function SnakeGame({ onClose, gender }: SnakeGameProps) {
  useModalBodyLock(true);
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 15, y: 10 });
  const [foodEmoji, setFoodEmoji] = useState(FOOD_EMOJIS[0]);
  const [poop, setPoop] = useState<Point | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_direction, setDirection] = useState<Direction>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [gotTheRuns, setGotTheRuns] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const directionRef = useRef<Direction>('RIGHT');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Wall grace: how many ticks the head has been sitting on a wall edge
  const wallGraceRef = useRef(0);

  const runnerEmoji = getRunnerEmoji(gender);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('dreamy-snake-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Prevent scrolling and bounce while game is open (CSS-only approach to avoid blocking taps)
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const origOverflow = body.style.overflow;
    const origOverscroll = html.style.overscrollBehavior;
    const origPosition = body.style.position;
    const origWidth = body.style.width;
    const origTop = body.style.top;
    const scrollY = window.scrollY;

    // Lock body scroll position
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    return () => {
      body.style.position = origPosition;
      body.style.top = origTop;
      body.style.width = origWidth;
      body.style.overflow = origOverflow;
      html.style.overscrollBehavior = origOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const spawnFood = useCallback((currentSnake: Point[], currentPoop?: Point | null, currentScore?: number): Point => {
    let newFood: Point;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (
      currentSnake.some(seg => seg.x === newFood.x && seg.y === newFood.y) ||
      (currentPoop && currentPoop.x === newFood.x && currentPoop.y === newFood.y)
    );
    // Score 21 = guaranteed beer, 22+ = 30% chance beer
    if (currentScore !== undefined && currentScore === BEER_LEVEL) {
      setFoodEmoji(BEER_EMOJI);
    } else if (currentScore !== undefined && currentScore > BEER_LEVEL && Math.random() < 0.3) {
      setFoodEmoji(BEER_EMOJI);
    } else {
      setFoodEmoji(FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]);
    }
    return newFood;
  }, []);

  const spawnPoop = useCallback((currentSnake: Point[], currentFood: Point): Point => {
    let newPoop: Point;
    do {
      newPoop = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (
      currentSnake.some(seg => seg.x === newPoop.x && seg.y === newPoop.y) ||
      (currentFood.x === newPoop.x && currentFood.y === newPoop.y)
    );
    return newPoop;
  }, []);

  const resetGame = useCallback(() => {
    const initial = [{ x: 10, y: 10 }];
    setSnake(initial);
    setPoop(null);
    setGotTheRuns(false);
    setFood(spawnFood(initial, null, 0));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    wallGraceRef.current = 0;
    setGameOver(false);
    setScore(0);
    setStarted(true);
    setIsPaused(false);
  }, [spawnFood]);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (!started && (e.key === ' ' || e.key === 'Enter')) {
        resetGame();
        return;
      }

      if (gameOver && (e.key === ' ' || e.key === 'Enter')) {
        resetGame();
        return;
      }

      if (e.key === 'p' || e.key === ' ') {
        setIsPaused(prev => !prev);
        return;
      }

      const keyMap: Record<string, Direction> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
      };

      const newDir = keyMap[e.key];
      if (!newDir) return;

      e.preventDefault();
      const opposites: Record<Direction, Direction> = {
        UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
      };

      if (opposites[newDir] !== directionRef.current) {
        directionRef.current = newDir;
        setDirection(newDir);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [started, gameOver, onClose, resetGame]);

  // Touch controls
  const touchStart = useRef<Point | null>(null);
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < 30) return; // Too small

      let newDir: Direction;
      if (absDx > absDy) {
        newDir = dx > 0 ? 'RIGHT' : 'LEFT';
      } else {
        newDir = dy > 0 ? 'DOWN' : 'UP';
      }

      const opposites: Record<Direction, Direction> = {
        UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
      };
      if (opposites[newDir] !== directionRef.current) {
        directionRef.current = newDir;
        setDirection(newDir);
        if (!started) resetGame();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [started, resetGame]);

  // Game loop
  useEffect(() => {
    if (!started || gameOver || isPaused) return;

    const speed = Math.max(60, INITIAL_SPEED - score * SPEED_INCREMENT);

    const interval = setInterval(() => {
      setSnake(prev => {
        const head = { ...prev[0] };
        const dir = directionRef.current;

        if (dir === 'UP') head.y -= 1;
        if (dir === 'DOWN') head.y += 1;
        if (dir === 'LEFT') head.x -= 1;
        if (dir === 'RIGHT') head.x += 1;

        // Wall collision with grace period —
        // First time hitting the wall: clamp to edge, give player a chance to turn.
        // If they're STILL heading into the wall next tick, then die.
        const hittingWall = head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;

        if (hittingWall) {
          if (wallGraceRef.current === 0) {
            // First hit — clamp to edge and wait
            wallGraceRef.current = 1;
            // Don't move — stay in place
            return prev;
          } else {
            // Already used grace — game over
            wallGraceRef.current = 0;
            setGameOver(true);
            return prev;
          }
        } else {
          // Not hitting a wall — reset grace
          wallGraceRef.current = 0;
        }

        // Self collision
        if (prev.some(seg => seg.x === head.x && seg.y === head.y)) {
          setGameOver(true);
          return prev;
        }

        // Poop collision - the runs!
        if (poop && head.x === poop.x && head.y === poop.y) {
          setGotTheRuns(true);
          setGameOver(true);
          return prev;
        }

        const newSnake = [head, ...prev];

        // Food collision
        if (head.x === food.x && head.y === food.y) {
          setScore(s => {
            const newScore = s + 1;
            if (newScore > highScore) {
              setHighScore(newScore);
              localStorage.setItem('dreamy-snake-highscore', String(newScore));
            }
            return newScore;
          });
          const newFood = spawnFood(newSnake, poop, score + 1);
          setFood(newFood);
          // Maybe spawn or reposition poop
          if (score + 1 >= POOP_SPAWN_SCORE && Math.random() < 0.6) {
            setPoop(spawnPoop(newSnake, newFood));
          }
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [started, gameOver, isPaused, food, poop, score, highScore, spawnFood, spawnPoop]);

  // Render on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Clear
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim() || '#0f0f15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    // Food
    ctx.font = `${cellSize * 0.8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(foodEmoji, food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2);

    // Poop
    if (poop) {
      ctx.font = `${cellSize * 0.8}px serif`;
      ctx.fillText(POOP_EMOJI, poop.x * cellSize + cellSize / 2, poop.y * cellSize + cellSize / 2);
    }

    // Snake body color based on score (Performance Spectrum ramp)
    const bodyColor = getSnakeColor(score);

    // Snake
    snake.forEach((seg, i) => {
      if (i === 0) {
        // Head - runner emoji
        ctx.font = `${cellSize * 0.85}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(runnerEmoji, seg.x * cellSize + cellSize / 2, seg.y * cellSize + cellSize / 2);
      } else {
        // Body - color from pace ramp, fading alpha along tail
        const alpha = 1 - (i / snake.length) * 0.6;
        ctx.fillStyle = `rgba(${bodyColor.r}, ${bodyColor.g}, ${bodyColor.b}, ${alpha})`;
        const padding = 1;
        ctx.beginPath();
        ctx.roundRect(
          seg.x * cellSize + padding,
          seg.y * cellSize + padding,
          cellSize - padding * 2,
          cellSize - padding * 2,
          4
        );
        ctx.fill();
      }
    });
  }, [snake, food, foodEmoji, poop, score, runnerEmoji]);

  const miles = (score * 0.1).toFixed(1);

  // Current pace zone name for display (every 8, starts at easy)
  const zoneNames = ['Easy', 'Steady', 'Marathon', 'Tempo', 'Threshold', 'Interval', 'Repetition', 'Race Pace'];
  const currentZone = zoneNames[Math.min(Math.floor(score / 8), zoneNames.length - 1)];

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      style={{ touchAction: 'none' }}
    >
      <div className="bg-bgSecondary rounded-2xl border border-borderPrimary shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-borderPrimary">
          <div className="flex items-center gap-2">
            <span className="text-xl">{'\u{1F40D}'}</span>
            <h2 className="font-display font-semibold text-textPrimary">Runner Snake</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-textTertiary">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              {highScore}
            </div>
            <button onClick={onClose} className="text-textTertiary hover:text-textPrimary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Score bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-bgTertiary text-sm">
          <span className="text-textSecondary">
            Score: <span className="font-bold text-accentTeal">{score}</span>
          </span>
          <span className="text-textTertiary">
            {miles} mi {started && score > 0 && <span style={{ color: `rgb(${getSnakeColor(score).r}, ${getSnakeColor(score).g}, ${getSnakeColor(score).b})` }}>{'\u{00B7}'} {currentZone}</span>}
          </span>
        </div>

        {/* Game canvas */}
        <div className="relative p-4">
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="w-full aspect-square rounded-lg border border-borderPrimary"
          />

          {/* Start screen */}
          {!started && (
            <div className="absolute inset-4 flex flex-col items-center justify-center bg-black/60 rounded-lg">
              <span className="text-4xl mb-4">{runnerEmoji}</span>
              <h3 className="text-white font-semibold text-lg mb-2">Runner Snake</h3>
              <p className="text-white/60 text-sm mb-4 text-center px-8">
                Collect shoes and medals to build your streak!
              </p>
              <button
                onClick={resetGame}
                className="px-6 py-2 bg-accentTeal text-white rounded-full font-medium hover:bg-accentTeal-hover transition-colors"
              >
                Start Running
              </button>
              <p className="text-white/40 text-xs mt-3">Arrow keys or swipe to move</p>
            </div>
          )}

          {/* Game over */}
          {gameOver && (
            <div className="absolute inset-4 flex flex-col items-center justify-center bg-black/70 rounded-lg">
              <span className="text-4xl mb-2">
                {gotTheRuns ? POOP_EMOJI : score >= highScore ? '\u{1F3C6}' : '\u{1F4A4}'}
              </span>
              <h3 className="text-white font-semibold text-lg">
                {gotTheRuns
                  ? 'Got the Runs!'
                  : score >= highScore ? 'New High Score!' : 'Rest Day!'}
              </h3>
              <p className="text-white/60 text-sm mt-1 mb-4">
                {gotTheRuns
                  ? 'Should have dodged that...'
                  : `${miles} miles in ${score} pickups`}
              </p>
              <button
                onClick={resetGame}
                className="px-6 py-2 bg-accentTeal text-white rounded-full font-medium hover:bg-accentTeal-hover transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Run Again
              </button>
            </div>
          )}

          {/* Pause overlay */}
          {isPaused && !gameOver && (
            <div className="absolute inset-4 flex flex-col items-center justify-center bg-black/50 rounded-lg">
              <span className="text-2xl mb-2">{'\u{23F8}\u{FE0F}'}</span>
              <p className="text-white/80 text-sm">Paused {'\u{2014}'} press Space to resume</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 text-center text-xs text-textTertiary">
          WASD or Arrow keys {'\u{00B7}'} Space to pause {'\u{00B7}'} Esc to close
        </div>
      </div>
    </div>
  );
}
