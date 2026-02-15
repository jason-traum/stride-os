'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trophy, RotateCcw } from 'lucide-react';
import { useModalBodyLock } from '@/hooks/useModalBodyLock';

interface SnakeGameProps {
  onClose: () => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Point = { x: number; y: number };

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 3;

const EMOJIS = ['🏃', '🏃‍♀️', '🏃‍♂️'];
const FOOD_EMOJIS = ['👟', '🥇', '⚡', '💧', '🍌', '🏅', '🎽'];

export function SnakeGame({ onClose }: SnakeGameProps) {
  useModalBodyLock(true);
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 15, y: 10 });
  const [foodEmoji, setFoodEmoji] = useState('👟');
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const directionRef = useRef<Direction>('RIGHT');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('dreamy-snake-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const spawnFood = useCallback((currentSnake: Point[]): Point => {
    let newFood: Point;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (currentSnake.some(seg => seg.x === newFood.x && seg.y === newFood.y));
    setFoodEmoji(FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]);
    return newFood;
  }, []);

  const resetGame = useCallback(() => {
    const initial = [{ x: 10, y: 10 }];
    setSnake(initial);
    setFood(spawnFood(initial));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
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

        // Wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameOver(true);
          return prev;
        }

        // Self collision
        if (prev.some(seg => seg.x === head.x && seg.y === head.y)) {
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
          setFood(spawnFood(newSnake));
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [started, gameOver, isPaused, food, score, highScore, spawnFood]);

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

    // Snake
    snake.forEach((seg, i) => {
      if (i === 0) {
        // Head - runner emoji
        const emoji = EMOJIS[score % EMOJIS.length];
        ctx.font = `${cellSize * 0.85}px serif`;
        ctx.fillText(emoji, seg.x * cellSize + cellSize / 2, seg.y * cellSize + cellSize / 2);
      } else {
        // Body - teal trail
        const alpha = 1 - (i / snake.length) * 0.6;
        ctx.fillStyle = `rgba(45, 212, 191, ${alpha})`;
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
  }, [snake, food, foodEmoji, score]);

  const miles = (score * 0.1).toFixed(1);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bgSecondary rounded-2xl border border-borderPrimary shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-borderPrimary">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐍</span>
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
          <span className="text-textTertiary">{miles} mi collected</span>
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
              <span className="text-4xl mb-4">🏃</span>
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
              <span className="text-4xl mb-2">{score >= highScore ? '🏆' : '💤'}</span>
              <h3 className="text-white font-semibold text-lg">
                {score >= highScore ? 'New High Score!' : 'Rest Day!'}
              </h3>
              <p className="text-white/60 text-sm mt-1 mb-4">
                {miles} miles in {score} pickups
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
              <span className="text-2xl mb-2">⏸️</span>
              <p className="text-white/80 text-sm">Paused — press Space to resume</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 text-center text-xs text-textTertiary">
          WASD or Arrow keys · Space to pause · Esc to close
        </div>
      </div>
    </div>
  );
}
