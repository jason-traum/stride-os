import { ArrowLeft, MessageCircle, Dumbbell, BarChart3, Brain, Heart, Zap } from 'lucide-react';
import Link from 'next/link';
import { ChaseAvatar } from '@/components/ChaseAvatar';

export default function CoachGuidePage() {
  return (
    <div className="max-w-2xl mx-auto pb-8">
      <Link
        href="/coach"
        className="inline-flex items-center gap-1 text-sm text-textTertiary hover:text-textSecondary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Chase
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <ChaseAvatar size="md" />
        <div>
          <h1 className="text-2xl font-display font-bold text-textPrimary">Getting the most out of Chase</h1>
          <p className="text-sm text-textSecondary">Your AI running coach, powered by Claude</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* What I know */}
        <section className="bg-bgSecondary rounded-xl border border-borderPrimary p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-dream-500" />
            <h2 className="font-semibold text-primary">What I know</h2>
          </div>
          <p className="text-sm text-textSecondary mb-3">
            I&apos;ve studied 20+ coaching philosophies — from the intervals of Daniels to the base-building of Lydiard,
            the progressive overload of Pfitzinger, the cumulative fatigue of Hansons, Canova&apos;s specific endurance, and more.
            I understand periodization, pacing theory, recovery science, and how to adapt training to your life.
          </p>
          <p className="text-sm text-textSecondary">
            My workout library includes 40+ templates across 12 workout types — easy runs, long runs, tempos, progressions,
            fartleks, intervals, threshold work, marathon pace, hill repeats, and more. I&apos;m here to work for you and
            create the training you like best to help you reach your goals.
          </p>
        </section>

        {/* What you can ask */}
        <section className="bg-bgSecondary rounded-xl border border-borderPrimary p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-dream-500" />
            <h2 className="font-semibold text-primary">Things you can ask me</h2>
          </div>
          <div className="grid gap-2">
            {[
              { icon: Dumbbell, text: '"What should I run today?"', desc: 'I\'ll pick a workout based on your recent training and readiness' },
              { icon: BarChart3, text: '"How\'s my training going?"', desc: 'I\'ll analyze your fitness trends, mileage, and progression' },
              { icon: Heart, text: '"I\'m feeling tired today"', desc: 'I adjust recommendations based on how you feel' },
              { icon: Zap, text: '"Give me a tempo workout"', desc: 'Request specific workout types and I\'ll calibrate to your paces' },
              { icon: MessageCircle, text: '"Log my run — 5 miles, felt good"', desc: 'Quick-log a workout and I\'ll give you an assessment' },
              { icon: Brain, text: '"Help me plan for a half marathon"', desc: 'I\'ll build race-specific training advice and pacing strategy' },
            ].map(({ icon: Icon, text, desc }, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-bgTertiary rounded-lg">
                <Icon className="w-4 h-4 text-dream-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">{text}</p>
                  <p className="text-xs text-textTertiary mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section className="bg-bgSecondary rounded-xl border border-borderPrimary p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-dream-500" />
            <h2 className="font-semibold text-primary">Tips for better coaching</h2>
          </div>
          <ul className="space-y-2 text-sm text-textSecondary">
            <li className="flex items-start gap-2">
              <span className="text-dream-500 font-bold mt-0.5">1.</span>
              <span><strong className="text-primary">Log your runs consistently.</strong> The more data I have, the better my recommendations get.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-dream-500 font-bold mt-0.5">2.</span>
              <span><strong className="text-primary">Share how you feel.</strong> Tell me about soreness, sleep, stress — I factor it all in.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-dream-500 font-bold mt-0.5">3.</span>
              <span><strong className="text-primary">Be specific with goals.</strong> &ldquo;I want to run a sub-1:45 half&rdquo; gives me more to work with than &ldquo;I want to get faster.&rdquo;</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-dream-500 font-bold mt-0.5">4.</span>
              <span><strong className="text-primary">Ask follow-up questions.</strong> If a workout seems too hard or easy, say so — I adapt.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-dream-500 font-bold mt-0.5">5.</span>
              <span><strong className="text-primary">Use the daily check-in.</strong> I can assess your readiness and adjust the plan accordingly.</span>
            </li>
          </ul>
        </section>

        <div className="text-center pt-2">
          <Link
            href="/coach"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-dream-500 hover:bg-dream-600 text-white rounded-xl font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Start chatting with Chase
          </Link>
        </div>
      </div>
    </div>
  );
}
