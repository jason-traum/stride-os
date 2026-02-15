'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Trophy, Share2 } from 'lucide-react';
import { useModalBodyLock } from '@/hooks/useModalBodyLock';
import { VALID_WORDS } from '@/lib/wordle-words';

interface WordleGameProps {
  onClose: () => void;
}

type LetterState = 'correct' | 'present' | 'absent' | 'empty' | 'tbd';

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

// Running-themed word list (5-letter words)
const WORD_LIST = [
  'TEMPO', 'SPLIT', 'TRACK', 'SWIFT', 'RELAY',
  'MEDAL', 'MILES', 'SWEAT', 'HEART', 'TRAIL',
  'SURGE', 'BOOST', 'TIMER', 'SHOES', 'RACER',
  'POWER', 'CLIMB', 'SPEED', 'ELITE', 'FIELD',
  'GRIND', 'CHASE', 'TRAIN', 'CRUSH', 'ULTRA',
  'FLEET', 'BOUND', 'KNEES', 'LUNGS', 'STEAM',
  'LUNGE', 'QUICK', 'PULSE', 'BREAK', 'BLAZE',
  'NORTH', 'SOUTH', 'RANGE', 'ROUTE', 'ASCOT',
  'COUCH', 'FRESH', 'LIGHT', 'PACED', 'RIGID',
  'STIFF', 'SOLES', 'GOING', 'HEATS', 'FINAL',
  'BATON', 'CURVE', 'HURTS', 'BLAST', 'GLIDE',
  'FORGE', 'QUEST', 'PRIDE', 'TOUGH', 'DAILY',
  'WATTS', 'GAINS', 'TRIAL', 'BEACH', 'HILLS',
  'LACES', 'GRASS', 'WATER', 'FUELS', 'FOCUS',
  'HAPPY', 'ROADS', 'BRICK', 'STONE', 'SUNNY',
  'DRIFT', 'WINGS', 'LEVEL', 'CROSS', 'EARTH',
  'BENCH', 'NIGHT', 'CHEER', 'BRAVE', 'STEEL',
  'VIGOR', 'MARCH', 'ALIVE', 'BURNS', 'CYCLE',
  'CREST', 'FORCE', 'GRACE', 'JUMPS', 'KICKS',
  'LEAPS', 'MIGHT', 'NERVE', 'PEAKS', 'PLANK',
  'GEARS', 'CROWD', 'DRIVE', 'DRAIN', 'THIGH',
  'ANKLE', 'CHEST', 'BACKS', 'TRUNK', 'CALVE',
  'BLOOD', 'SWEAR', 'BEAST', 'CRISP', 'STORM',
  'WORLD', 'STAIR', 'FLOAT', 'RISEN', 'SIREN',
  'FLAIR', 'LUCKY', 'SPARK', 'SHINE', 'MAGIC',
  'GLORY', 'CROWN', 'REACH', 'DREAM', 'CHAMP',
  'VALOR', 'UNITY', 'GRITS', 'MOXIE', 'PLUCK',
  'SPUNK', 'BRISK', 'AGILE', 'LITHE', 'TONED',
  'HARDY', 'SOLID', 'STOUT', 'DENSE', 'TIGHT',
  'SHINS', 'HAMMY', 'QUADS', 'GLUTE', 'BICEP',
  'SWOLE', 'SQUAT', 'PRESS', 'CURLS', 'BOARD',
  'BANDS', 'LOFTY', 'LINER', 'VISOR', 'SHIRT',
  'SHORT', 'SOCKS', 'WATCH', 'TOWEL', 'FLASK',
  'SNACK', 'DATES', 'HONEY', 'SALTS', 'FIBER',
  'OATHS', 'MOTTO', 'CREED', 'ETHIC', 'LOYAL',
  'FAITH', 'TRUST', 'HONOR', 'TRUTH', 'PEACE',
  'BLISS', 'CHARM', 'MIRTH', 'JOLLY', 'FEAST',
];

function isValidGuess(word: string): boolean {
  return VALID_WORDS.has(word);
}

// Get today's word deterministically based on date
function getDailyWord(): string {
  const now = new Date();
  const start = new Date(2025, 0, 1); // Jan 1, 2025 epoch
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return WORD_LIST[diff % WORD_LIST.length];
}

// Get storage key for today
function getTodayKey(): string {
  const now = new Date();
  return `dreamy-wordle-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

interface SavedState {
  guesses: string[];
  completed: boolean;
  won: boolean;
}

function loadState(): SavedState | null {
  try {
    const saved = localStorage.getItem(getTodayKey());
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return null;
}

function saveState(state: SavedState) {
  try {
    localStorage.setItem(getTodayKey(), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function loadStats(): { played: number; won: number; streak: number; maxStreak: number; distribution: number[] } {
  try {
    const saved = localStorage.getItem('dreamy-wordle-stats');
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return { played: 0, won: 0, streak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0, 0] };
}

function saveStats(stats: { played: number; won: number; streak: number; maxStreak: number; distribution: number[] }) {
  try {
    localStorage.setItem('dreamy-wordle-stats', JSON.stringify(stats));
  } catch {
    // ignore
  }
}

function evaluateGuess(guess: string, answer: string): LetterState[] {
  const result: LetterState[] = Array(WORD_LENGTH).fill('absent');
  const answerChars = answer.split('');
  const guessChars = guess.split('');

  // First pass: mark correct positions
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = 'correct';
      answerChars[i] = '#'; // mark as used
      guessChars[i] = '*';  // mark as matched
    }
  }

  // Second pass: mark present (wrong position)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessChars[i] === '*') continue; // already correct
    const idx = answerChars.indexOf(guessChars[i]);
    if (idx !== -1) {
      result[i] = 'present';
      answerChars[idx] = '#'; // mark as used
    }
  }

  return result;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

export function WordleGame({ onClose }: WordleGameProps) {
  useModalBodyLock(true);

  const answer = getDailyWord();
  const saved = loadState();

  const [guesses, setGuesses] = useState<string[]>(saved?.guesses || []);
  const [currentGuess, setCurrentGuess] = useState('');
  const [completed, setCompleted] = useState(saved?.completed || false);
  const [won, setWon] = useState(saved?.won || false);
  const [shake, setShake] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [showCopied, setShowCopied] = useState(false);

  const stats = loadStats();

  const handleGuess = useCallback(() => {
    if (currentGuess.length !== WORD_LENGTH) return;
    if (completed) return;

    if (!isValidGuess(currentGuess)) {
      setShake(true);
      setToastMessage('Not in word list');
      setTimeout(() => { setShake(false); setToastMessage(''); }, 1500);
      return;
    }

    const newGuesses = [...guesses, currentGuess];
    const isWin = currentGuess === answer;
    const isLoss = newGuesses.length >= MAX_GUESSES && !isWin;
    const isDone = isWin || isLoss;

    setRevealRow(guesses.length);
    setTimeout(() => setRevealRow(null), 500);

    setGuesses(newGuesses);
    setCurrentGuess('');

    if (isDone) {
      setCompleted(true);
      setWon(isWin);

      // Update stats
      const newStats = { ...loadStats() };
      newStats.played += 1;
      if (isWin) {
        newStats.won += 1;
        newStats.streak += 1;
        newStats.maxStreak = Math.max(newStats.maxStreak, newStats.streak);
        newStats.distribution[newGuesses.length - 1] += 1;
      } else {
        newStats.streak = 0;
      }
      saveStats(newStats);
    }

    saveState({ guesses: newGuesses, completed: isDone, won: isWin });
  }, [currentGuess, guesses, answer, completed]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (completed) return;
      if (e.key === 'Enter') {
        handleGuess();
        return;
      }
      if (e.key === 'Backspace') {
        setCurrentGuess(prev => prev.slice(0, -1));
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess(prev => prev + e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [completed, currentGuess, handleGuess, onClose]);

  // Build keyboard letter states
  const keyStates: Record<string, LetterState> = {};
  guesses.forEach(guess => {
    const result = evaluateGuess(guess, answer);
    guess.split('').forEach((letter, i) => {
      const current = keyStates[letter];
      const next = result[i];
      // Priority: correct > present > absent
      if (next === 'correct') {
        keyStates[letter] = 'correct';
      } else if (next === 'present' && current !== 'correct') {
        keyStates[letter] = 'present';
      } else if (!current) {
        keyStates[letter] = 'absent';
      }
    });
  });

  const handleKeyPress = (key: string) => {
    if (completed) return;
    if (key === 'ENTER') {
      handleGuess();
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(prev => prev + key);
    }
  };

  const handleShare = () => {
    const emojiGrid = guesses.map(guess => {
      const result = evaluateGuess(guess, answer);
      return result.map(s => s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛').join('');
    }).join('\n');

    const text = `Dreamy Wordle ${guesses.length}/${MAX_GUESSES}\n\n${emojiGrid}`;
    navigator.clipboard.writeText(text).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  };

  const stateToColor = (state: LetterState): string => {
    switch (state) {
      case 'correct': return 'bg-emerald-500 border-emerald-500 text-white';
      case 'present': return 'bg-amber-500 border-amber-500 text-white';
      case 'absent': return 'bg-zinc-700 border-zinc-700 text-white';
      case 'tbd': return 'bg-transparent border-borderPrimary text-textPrimary';
      default: return 'bg-transparent border-borderPrimary/40 text-textPrimary';
    }
  };

  const keyToColor = (state: LetterState | undefined): string => {
    switch (state) {
      case 'correct': return 'bg-emerald-500 text-white';
      case 'present': return 'bg-amber-500 text-white';
      case 'absent': return 'bg-zinc-700 text-zinc-400';
      default: return 'bg-bgTertiary text-textPrimary hover:bg-borderPrimary';
    }
  };

  // Build grid rows
  const rows: { letter: string; state: LetterState }[][] = [];
  for (let i = 0; i < MAX_GUESSES; i++) {
    if (i < guesses.length) {
      // Completed guess
      const result = evaluateGuess(guesses[i], answer);
      rows.push(guesses[i].split('').map((letter, j) => ({ letter, state: result[j] })));
    } else if (i === guesses.length && !completed) {
      // Current guess row
      const cells: { letter: string; state: LetterState }[] = [];
      for (let j = 0; j < WORD_LENGTH; j++) {
        cells.push({
          letter: currentGuess[j] || '',
          state: currentGuess[j] ? 'tbd' : 'empty',
        });
      }
      rows.push(cells);
    } else {
      // Empty row
      rows.push(Array(WORD_LENGTH).fill({ letter: '', state: 'empty' as LetterState }));
    }
  }

  const winPct = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bgSecondary rounded-2xl border border-borderPrimary shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-borderPrimary">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-semibold text-textPrimary">Wordle</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-textTertiary">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              {stats.streak}
            </div>
            <button onClick={onClose} className="text-textTertiary hover:text-textPrimary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-bgTertiary text-sm">
          <span className="text-textSecondary">
            Played: <span className="font-bold text-accentTeal">{stats.played}</span>
          </span>
          <span className="text-textSecondary">
            Win: <span className="font-bold text-accentTeal">{winPct}%</span>
          </span>
          <span className="text-textSecondary">
            Streak: <span className="font-bold text-accentTeal">{stats.streak}</span>
          </span>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="flex justify-center pt-2">
            <div className="bg-textPrimary text-bgPrimary text-sm font-semibold px-4 py-2 rounded-lg">
              {toastMessage}
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="p-4 flex flex-col items-center gap-1.5">
          {rows.map((row, i) => (
            <div
              key={i}
              className={`flex gap-1.5 ${shake && i === guesses.length ? 'animate-shake' : ''} ${revealRow === i ? 'animate-bounce-subtle' : ''}`}
            >
              {row.map((cell, j) => (
                <div
                  key={j}
                  className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center border-2 rounded-lg font-bold text-xl sm:text-2xl uppercase transition-colors duration-300 ${stateToColor(cell.state)}`}
                >
                  {cell.letter}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Completion message */}
        {completed && (
          <div className="px-4 pb-2 text-center">
            {won ? (
              <p className="text-emerald-400 font-semibold">
                {guesses.length === 1 ? 'Incredible!' : guesses.length <= 3 ? 'Great job!' : guesses.length <= 5 ? 'Nice work!' : 'Phew!'}
              </p>
            ) : (
              <p className="text-textSecondary text-sm">
                The word was <span className="font-bold text-accentTeal">{answer}</span>
              </p>
            )}
            <button
              onClick={handleShare}
              className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 bg-accentTeal text-white rounded-full text-sm font-medium hover:bg-accentTeal-hover transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              {showCopied ? 'Copied!' : 'Share'}
            </button>
          </div>
        )}

        {/* Keyboard */}
        <div className="p-3 pt-1 flex flex-col items-center gap-1.5">
          {KEYBOARD_ROWS.map((row, i) => (
            <div key={i} className="flex gap-1">
              {row.map(key => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className={`${key.length > 1 ? 'px-2.5 text-xs' : 'w-8 sm:w-9 text-sm'} h-10 rounded-md font-semibold transition-colors ${keyToColor(keyStates[key])}`}
                >
                  {key === 'BACK' ? '⌫' : key}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 pb-3 text-center text-xs text-textTertiary">
          New word daily · Esc to close
        </div>
      </div>
    </div>
  );
}
