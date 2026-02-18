'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 5;
const MIN_SPEED = 50;

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

function getRandomPosition(snake: Position[]): Position {
  let position: Position;
  do {
    position = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(seg => seg.x === position.x && seg.y === position.y));
  return position;
}

export default function SnakeGame() {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);

  const directionRef = useRef(direction);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Load high score from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('snake_high_score');
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake_high_score', score.toString());
    }
  }, [score, highScore]);

  // Update direction ref when direction changes
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  const resetGame = useCallback(() => {
    setSnake([{ x: 10, y: 10 }]);
    setFood({ x: 15, y: 15 });
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setGameOver(false);
    setScore(0);
    setIsPlaying(false);
    setSpeed(INITIAL_SPEED);
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
  }, []);

  const startGame = useCallback(() => {
    if (gameOver) {
      resetGame();
    }
    setIsPlaying(true);
  }, [gameOver, resetGame]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || gameOver) return;

    const moveSnake = () => {
      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        const currentDirection = directionRef.current;

        switch (currentDirection) {
          case 'UP':
            head.y -= 1;
            break;
          case 'DOWN':
            head.y += 1;
            break;
          case 'LEFT':
            head.x -= 1;
            break;
          case 'RIGHT':
            head.x += 1;
            break;
        }

        // Check wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameOver(true);
          setIsPlaying(false);
          return prevSnake;
        }

        // Check self collision
        if (prevSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
          setGameOver(true);
          setIsPlaying(false);
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Check food collision
        if (head.x === food.x && head.y === food.y) {
          setScore(prev => prev + 10);
          setFood(getRandomPosition(newSnake));
          // Speed up
          setSpeed(prev => Math.max(MIN_SPEED, prev - SPEED_INCREMENT));
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    };

    gameLoopRef.current = setInterval(moveSnake, speed);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [isPlaying, gameOver, food, speed]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying && !gameOver && (e.key === ' ' || e.key === 'Enter')) {
        startGame();
        return;
      }

      if (gameOver && (e.key === ' ' || e.key === 'Enter')) {
        resetGame();
        return;
      }

      const currentDir = directionRef.current;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (currentDir !== 'DOWN') {
            setDirection('UP');
          }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (currentDir !== 'UP') {
            setDirection('DOWN');
          }
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (currentDir !== 'RIGHT') {
            setDirection('LEFT');
          }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (currentDir !== 'LEFT') {
            setDirection('RIGHT');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, gameOver, startGame, resetGame]);

  // Touch controls for mobile
  const handleDirectionButton = (newDirection: Direction) => {
    const currentDir = directionRef.current;
    if (
      (newDirection === 'UP' && currentDir !== 'DOWN') ||
      (newDirection === 'DOWN' && currentDir !== 'UP') ||
      (newDirection === 'LEFT' && currentDir !== 'RIGHT') ||
      (newDirection === 'RIGHT' && currentDir !== 'LEFT')
    ) {
      setDirection(newDirection);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-display font-bold text-stone-900 mb-2">Snake</h1>
        <p className="text-stone-500 text-sm">Use arrow keys or WASD to move</p>
      </div>

      {/* Score display */}
      <div className="flex items-center gap-8 mb-4">
        <div className="text-center">
          <p className="text-sm text-stone-500">Score</p>
          <p className="text-2xl font-bold text-amber-600">{score}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-stone-500 flex items-center gap-1">
            <Trophy className="w-4 h-4" /> High Score
          </p>
          <p className="text-2xl font-bold text-green-600">{highScore}</p>
        </div>
      </div>

      {/* Game board */}
      <div
        className="relative bg-stone-900 rounded-lg border-4 border-stone-700 shadow-xl"
        style={{
          width: GRID_SIZE * CELL_SIZE + 8,
          height: GRID_SIZE * CELL_SIZE + 8,
        }}
      >
        {/* Grid background */}
        <div
          className="absolute inset-1 grid opacity-20"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
            <div key={i} className="border border-stone-700" />
          ))}
        </div>

        {/* Snake */}
        {snake.map((segment, index) => (
          <div
            key={index}
            className={`absolute rounded-sm transition-all duration-75 ${
              index === 0
                ? 'bg-green-400 shadow-lg shadow-green-500/50'
                : 'bg-green-500'
            }`}
            style={{
              left: segment.x * CELL_SIZE + 4,
              top: segment.y * CELL_SIZE + 4,
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
            }}
          />
        ))}

        {/* Food */}
        <div
          className="absolute bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"
          style={{
            left: food.x * CELL_SIZE + 4,
            top: food.y * CELL_SIZE + 4,
            width: CELL_SIZE - 2,
            height: CELL_SIZE - 2,
          }}
        />

        {/* Game over overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg">
            <p className="text-2xl font-bold text-white mb-2">Game Over!</p>
            <p className="text-amber-400 mb-4">Score: {score}</p>
            {score >= highScore && score > 0 && (
              <p className="text-green-400 text-sm mb-4">New High Score!</p>
            )}
            <button
              onClick={resetGame}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          </div>
        )}

        {/* Start overlay */}
        {!isPlaying && !gameOver && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-lg">
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
            >
              <Play className="w-5 h-5" />
              Start Game
            </button>
            <p className="text-stone-400 text-sm mt-3">or press Space/Enter</p>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="mt-6 md:hidden">
        <div className="grid grid-cols-3 gap-2 w-36 mx-auto">
          <div />
          <button
            onTouchStart={() => handleDirectionButton('UP')}
            className="p-3 bg-stone-200 rounded-lg active:bg-stone-300"
          >
            <ArrowUp className="w-6 h-6 mx-auto" />
          </button>
          <div />
          <button
            onTouchStart={() => handleDirectionButton('LEFT')}
            className="p-3 bg-stone-200 rounded-lg active:bg-stone-300"
          >
            <ArrowLeft className="w-6 h-6 mx-auto" />
          </button>
          <div />
          <button
            onTouchStart={() => handleDirectionButton('RIGHT')}
            className="p-3 bg-stone-200 rounded-lg active:bg-stone-300"
          >
            <ArrowRight className="w-6 h-6 mx-auto" />
          </button>
          <div />
          <button
            onTouchStart={() => handleDirectionButton('DOWN')}
            className="p-3 bg-stone-200 rounded-lg active:bg-stone-300"
          >
            <ArrowDown className="w-6 h-6 mx-auto" />
          </button>
          <div />
        </div>
      </div>

      {/* Back link */}
      <Link
        href="/"
        className="mt-8 text-stone-500 hover:text-stone-700 text-sm"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
