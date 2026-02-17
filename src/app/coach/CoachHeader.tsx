'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ChaseAvatar } from '@/components/ChaseAvatar';

interface CoachMemory {
  id: number;
  contextType: string;
  contextKey: string;
  contextValue: string;
  importance: string;
  createdAt: string;
}

interface CoachHeaderProps {
  coachColor: string;
  isHexColor: boolean;
  colorClasses: Record<string, string>;
  isOnboarding: boolean;
  coachName: string;
  userName?: string | null;
  memories?: CoachMemory[];
  onPromptSelect?: (prompt: string) => void;
}

const CHASE_INTRO_SEEN_KEY = 'chase-intro-seen';

const PROMPT_SUGGESTIONS = [
  "What should I run today?",
  "How's my training going?",
  "I'm feeling tired today",
  "Give me a tempo workout",
  "Help me plan for a half marathon",
];

const TIPS = [
  { num: 1, title: 'Log your runs consistently.', desc: "The more data I have, the better my recommendations get." },
  { num: 2, title: 'Share how you feel.', desc: "Tell me about soreness, sleep, stress — I factor it all in." },
  { num: 3, title: 'Be specific with goals.', desc: '"I want to run a sub-1:45 half" gives me more to work with than "I want to get faster."' },
  { num: 4, title: 'Ask follow-up questions.', desc: "If a workout seems too hard or easy, say so — I adapt." },
  { num: 5, title: 'Use the daily check-in.', desc: "I can assess your readiness and adjust the plan accordingly." },
];

function ContactDetailSheet({ onClose, memories, coachName }: { onClose: () => void; memories: CoachMemory[]; coachName: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-bgSecondary rounded-t-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="sticky top-0 flex justify-center pt-3 pb-2 bg-bgSecondary rounded-t-2xl z-10">
          <div className="w-10 h-1 rounded-full bg-borderSecondary" />
        </div>

        <div className="px-6 pb-8">
          {/* Coach photo & name */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full overflow-hidden mb-3">
              <Image src="/sheep/coach.png" alt="Coach Dreamy" width={80} height={80} className="object-contain" />
            </div>
            <h2 className="text-xl font-display font-semibold text-textPrimary">{coachName}</h2>
            <p className="text-sm text-textSecondary">AI Running Coach</p>
          </div>

          {/* Memories section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">Memories</h3>
            {memories.length > 0 ? (
              <div className="space-y-2">
                {memories.slice(0, 20).map((memory) => (
                  <div key={memory.id} className="bg-surface-1 rounded-xl p-3 border border-borderPrimary">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-dream-400 capitalize">{memory.contextType}</span>
                        <p className="text-sm text-textPrimary mt-0.5">{memory.contextValue}</p>
                      </div>
                      <span className="text-xs text-textTertiary whitespace-nowrap flex-shrink-0">
                        {formatMemoryDate(memory.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-textTertiary bg-surface-1 rounded-xl p-4 border border-borderPrimary">
                Coach Dreamy will remember important details about your training as you chat.
              </p>
            )}
          </div>

          {/* About section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">About</h3>
            <div className="space-y-3 text-sm text-textSecondary bg-surface-1 rounded-xl p-4 border border-borderPrimary">
              <p>
                Built on <span className="text-primary font-medium">20+ coaching philosophies</span> — Daniels, Lydiard, Pfitzinger, Hansons, and more — so I can pull from the best of all of them.
              </p>
              <p>
                Tempos, progressions, fartleks, threshold work, cruise intervals, long run variations — more workout types than you&apos;ll ever need.
              </p>
              <p>
                Tell me how a run felt, and I&apos;ll adjust what comes next. The more we talk, the better I get at coaching you.
              </p>
            </div>
          </div>

          <Link
            href="/coach/guide"
            className="block text-center text-sm text-dream-400 font-medium hover:underline"
          >
            View full coaching guide →
          </Link>
        </div>
      </div>
    </div>
  );
}

function HowToUseSheet({ onClose, onPromptSelect }: { onClose: () => void; onPromptSelect: (prompt: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-bgSecondary rounded-t-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="sticky top-0 flex justify-center pt-3 pb-2 bg-bgSecondary rounded-t-2xl z-10">
          <div className="w-10 h-1 rounded-full bg-borderSecondary" />
        </div>

        <div className="px-6 pb-8">
          <h2 className="text-lg font-display font-semibold text-textPrimary mb-1">How to Use Coach Dreamy</h2>
          <p className="text-sm text-textSecondary mb-5">Tap a suggestion to start a conversation.</p>

          {/* Prompt suggestions */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">Try asking</h3>
            <div className="flex flex-wrap gap-2">
              {PROMPT_SUGGESTIONS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    onPromptSelect(prompt);
                    onClose();
                  }}
                  className="px-4 py-2 bg-surface-1 border border-borderPrimary rounded-full text-sm text-textPrimary hover:border-dream-500 hover:text-dream-400 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Feature explanations */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">What I can do</h3>
            <ul className="space-y-2 text-sm text-textSecondary">
              <li className="flex items-start gap-2">
                <span className="text-dream-500 mt-0.5">•</span>
                <span>Prescribe workouts calibrated to your pace zones and fitness</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-dream-500 mt-0.5">•</span>
                <span>Analyze your training trends and spot overtraining risks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-dream-500 mt-0.5">•</span>
                <span>Log runs and assessments from natural language</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-dream-500 mt-0.5">•</span>
                <span>Build and adjust training plans for your race goals</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-dream-500 mt-0.5">•</span>
                <span>Check weather and recommend outfits for your runs</span>
              </li>
            </ul>
          </div>

          {/* Tips */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">Tips for better coaching</h3>
            <ul className="space-y-2 text-sm text-textSecondary">
              {TIPS.map(({ num, title, desc }) => (
                <li key={num} className="flex items-start gap-2">
                  <span className="text-dream-500 font-bold mt-0.5">{num}.</span>
                  <span><strong className="text-primary">{title}</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/coach/guide"
            className="block text-center text-sm text-dream-400 font-medium hover:underline"
          >
            View full coaching guide →
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatMemoryDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CoachHeader({ isOnboarding, coachName, memories = [], onPromptSelect }: CoachHeaderProps) {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showHowToUse, setShowHowToUse] = useState(false);

  // Show welcome popup on first visit
  useEffect(() => {
    if (!isOnboarding && !localStorage.getItem(CHASE_INTRO_SEEN_KEY)) {
      setShowWelcome(true);
    }
  }, [isOnboarding]);

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem(CHASE_INTRO_SEEN_KEY, 'true');
  };

  const handlePromptSelect = (prompt: string) => {
    onPromptSelect?.(prompt);
  };

  return (
    <>
      {/* iMessage-style top bar */}
      <div className="sticky top-0 z-40 bg-surface-0/80 backdrop-blur-xl border-b border-borderSecondary safe-area-inset-top">
        <div className="flex items-center justify-between h-12 px-2">
          {/* Left: Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-0.5 text-dream-400 hover:text-dream-300 transition-colors p-2 -ml-1"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Center: Coach photo + name */}
          <button
            onClick={() => setShowContact(true)}
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden">
              <Image src="/sheep/coach.png" alt="Coach Dreamy" width={32} height={32} className="object-contain" />
            </div>
            <span className="text-[10px] font-semibold text-textPrimary leading-none">{coachName}</span>
          </button>

          {/* Right: Info button */}
          {!isOnboarding && (
            <button
              onClick={() => setShowHowToUse(true)}
              className="p-2 -mr-1 text-dream-400 hover:text-dream-300 transition-colors"
            >
              <Info className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Contact Detail Sheet */}
      {showContact && (
        <ContactDetailSheet
          onClose={() => setShowContact(false)}
          memories={memories}
          coachName={coachName}
        />
      )}

      {/* How to Use Sheet */}
      {showHowToUse && (
        <HowToUseSheet
          onClose={() => setShowHowToUse(false)}
          onPromptSelect={handlePromptSelect}
        />
      )}

      {/* First-time welcome popup */}
      {showWelcome && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={dismissWelcome} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto bg-bgSecondary rounded-2xl border border-borderPrimary shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-300">
            <div className="text-center mb-5">
              <ChaseAvatar size="lg" className="mx-auto mb-3" />
              <h2 className="font-display text-xl font-semibold text-primary">
                Hey! I&apos;m Coach Dreamy.
              </h2>
              <p className="text-sm text-textTertiary mt-1">Your AI running coach</p>
            </div>
            <div className="space-y-3 text-sm text-textSecondary">
              <p>
                I&apos;m built on <span className="text-primary font-medium">20+ coaching philosophies</span> — Daniels, Lydiard, Pfitzinger, Hansons, and more.
              </p>
              <p>
                Tell me how a run felt, and I&apos;ll adjust what comes next. The more we talk, the better I get at coaching you.
              </p>
              <p className="text-primary font-medium">Ready when you are.</p>
            </div>
            <button
              onClick={dismissWelcome}
              className="w-full mt-5 py-2.5 bg-dream-500 hover:bg-dream-600 text-white rounded-xl font-medium transition-colors"
            >
              Let&apos;s go
            </button>
          </div>
        </>
      )}
    </>
  );
}
