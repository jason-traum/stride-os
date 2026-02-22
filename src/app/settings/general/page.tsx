'use client';

import { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import {
  getSettings,
  updateCoachSettings,
  updateAISettings,
} from '@/actions/settings';
import { useProfile } from '@/lib/profile-context';
import { aiProviders, claudeModels, openaiModels, type CoachPersona, type AIProvider, type ClaudeModel, type OpenAIModel } from '@/lib/schema';
import { getAllPersonas } from '@/lib/coach-personas';
import { getModelDisplayName, getModelDescription } from '@/lib/ai';
import { cn } from '@/lib/utils';
import { Database, Trash2, Download, Smartphone, Calendar, Sparkles, Link as LinkIcon, Brain, ArrowLeft, LogOut } from 'lucide-react';
import { loadSampleData, clearDemoData } from '@/actions/demo-data';
import { resetAllTrainingPlans } from '@/actions/training-plan';
import { usePWA } from '@/components/PWAProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { IntervalsConnect } from '@/components/IntervalsConnect';
import { AnimatedButton } from '@/components/AnimatedButton';
import { NotificationSettings } from '@/components/NotificationSettings';
import Link from 'next/link';

export default function GeneralSettingsPage() {
  const { activeProfile } = useProfile();
  const [isPending, startTransition] = useTransition();

  // Demo data state
  const [demoDataLoading, setDemoDataLoading] = useState(false);
  const [demoDataMessage, setDemoDataMessage] = useState('');

  // Training plan reset state
  const [planResetLoading, setPlanResetLoading] = useState(false);
  const [planResetMessage, setPlanResetMessage] = useState('');

  // Confirmation modal state
  const [showClearDemoConfirm, setShowClearDemoConfirm] = useState(false);
  const [showResetPlanConfirm, setShowResetPlanConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Coach personalization state
  const [coachName, setCoachName] = useState('Coach Dreamy');
  const [coachColor, setCoachColor] = useState('blue');
  const [coachPersona, setCoachPersona] = useState<CoachPersona>('encouraging');
  const [coachSaved, setCoachSaved] = useState(false);
  const personas = getAllPersonas();

  // AI Provider state
  const [aiProvider, setAiProvider] = useState<AIProvider>('claude');
  const [claudeModel, setClaudeModel] = useState<ClaudeModel>('claude-sonnet-4-20250514');
  const [openaiModel, setOpenaiModel] = useState<OpenAIModel>('gpt-5.2');
  const [aiSaved, setAiSaved] = useState(false);

  // PWA state
  const { isInstallable, isInstalled, installApp } = usePWA();

  // Track saved state for unsaved changes detection
  const savedCoach = useRef({ name: 'Coach Dreamy', color: 'blue', persona: 'encouraging' as CoachPersona });
  const savedAI = useRef({ provider: 'claude' as AIProvider, claude: 'claude-sonnet-4-20250514' as ClaudeModel, openai: 'gpt-5.2' as OpenAIModel });

  const coachDirty = coachName !== savedCoach.current.name || coachColor !== savedCoach.current.color || coachPersona !== savedCoach.current.persona;
  const aiDirty = aiProvider !== savedAI.current.provider || claudeModel !== savedAI.current.claude || openaiModel !== savedAI.current.openai;

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (coachDirty || aiDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [coachDirty, aiDirty]);

  useEffect(() => {
    const profileId = activeProfile?.id;
    getSettings(profileId).then((settings) => {
      if (settings) {
        const cn = settings.coachName || 'Coach Dreamy';
        const cc = settings.coachColor || 'blue';
        const cp = (settings.coachPersona as CoachPersona) || 'encouraging';
        const ap = (settings.aiProvider as AIProvider) || 'claude';
        const cm = (settings.claudeModel as ClaudeModel) || 'claude-sonnet-4-20250514';
        const om = (settings.openaiModel as OpenAIModel) || 'gpt-5.2';
        setCoachName(cn);
        setCoachColor(cc);
        setCoachPersona(cp);
        setAiProvider(ap);
        setClaudeModel(cm);
        setOpenaiModel(om);
        savedCoach.current = { name: cn, color: cc, persona: cp };
        savedAI.current = { provider: ap, claude: cm, openai: om };
      }
    });
  }, [activeProfile?.id]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 -ml-2 rounded-lg hover:bg-bgTertiary transition-colors">
          <ArrowLeft className="w-5 h-5 text-textSecondary" />
        </Link>
        <h1 className="text-2xl font-display font-semibold text-primary">General Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Coach Personalization */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-dream-500" />
              <h2 className="font-semibold text-primary">Coach Dreamy</h2>
            </div>
            {coachSaved ? (
              <span className="text-xs text-green-600 font-medium">Saved!</span>
            ) : coachDirty ? (
              <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>
            ) : null}
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Coach Dreamy is your intelligent running coach — dreaming big is baked right in.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Coaching Style
              </label>
              <p className="text-xs text-textTertiary mb-3">
                How should your coach communicate with you?
              </p>
              <div className="grid gap-2">
                {personas.map((persona) => (
                  <button
                    key={persona.name}
                    type="button"
                    onClick={() => setCoachPersona(persona.name)}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all',
                      coachPersona === persona.name
                        ? 'border-dream-500 bg-dream-500/10'
                        : 'border-default hover:border-strong'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                      coachPersona === persona.name
                        ? 'border-dream-500 bg-dream-500'
                        : 'border-strong'
                    )}>
                      {coachPersona === persona.name && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-surface-1 rounded-full" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-primary">{persona.label}</div>
                      <div className="text-xs text-textTertiary">{persona.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <AnimatedButton
              type="button"
              onClick={() => {
                startTransition(async () => {
                  await updateCoachSettings(coachName, coachColor, coachPersona);
                  savedCoach.current = { name: coachName, color: coachColor, persona: coachPersona };
                  setCoachSaved(true);
                  setTimeout(() => setCoachSaved(false), 2000);
                });
              }}
              disabled={isPending}
              className="px-4 py-2 bg-dream-600 text-white rounded-xl hover:bg-dream-700 transition-all text-sm font-semibold shadow-sm hover:shadow-md"
            >
              Save Coach Settings
            </AnimatedButton>
          </div>
        </div>

        {/* AI Provider Settings */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-dream-500" />
            <h2 className="font-semibold text-primary">AI Provider</h2>
          </div>
          <p className="text-sm text-textSecondary mb-4">
            Choose which AI powers your coach. Different models have different strengths.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Provider</label>
              <div className="flex gap-2">
                {aiProviders.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setAiProvider(provider)}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all',
                      aiProvider === provider
                        ? 'border-dream-500 bg-dream-500/10 text-dream-400'
                        : 'border-default hover:border-strong text-textSecondary'
                    )}
                  >
                    {provider === 'claude' ? 'Claude (Anthropic)' : 'OpenAI'}
                  </button>
                ))}
              </div>
            </div>

            {aiProvider === 'claude' && (
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Claude Model</label>
                <div className="space-y-2">
                  {claudeModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => setClaudeModel(model)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all',
                        claudeModel === model
                          ? 'border-dream-500 bg-dream-500/10'
                          : 'border-default hover:border-strong'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                        claudeModel === model
                          ? 'border-dream-500 bg-dream-500'
                          : 'border-strong'
                      )}>
                        {claudeModel === model && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-surface-1 rounded-full" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-primary">{getModelDisplayName('claude', model)}</div>
                        <div className="text-xs text-textTertiary">{getModelDescription('claude', model)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {aiProvider === 'openai' && (
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">OpenAI Model</label>
                <div className="space-y-2">
                  {openaiModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => setOpenaiModel(model)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all',
                        openaiModel === model
                          ? 'border-dream-500 bg-dream-500/10'
                          : 'border-default hover:border-strong'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                        openaiModel === model
                          ? 'border-dream-500 bg-dream-500'
                          : 'border-strong'
                      )}>
                        {openaiModel === model && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-surface-1 rounded-full" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-primary">{getModelDisplayName('openai', model)}</div>
                        <div className="text-xs text-textTertiary">{getModelDescription('openai', model)}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-textTertiary mt-2">
                  Requires OPENAI_API_KEY environment variable to be set.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <AnimatedButton
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    await updateAISettings(aiProvider, claudeModel, openaiModel);
                    savedAI.current = { provider: aiProvider, claude: claudeModel, openai: openaiModel };
                    setAiSaved(true);
                    setTimeout(() => setAiSaved(false), 2000);
                  });
                }}
                disabled={isPending}
                className="px-4 py-2 bg-dream-600 text-white rounded-xl hover:bg-dream-700 transition-colors text-sm font-medium"
              >
                Save AI Settings
              </AnimatedButton>
              {aiSaved ? (
                <span className="text-sm text-green-600 font-medium">Saved!</span>
              ) : aiDirty ? (
                <span className="text-sm text-amber-500 font-medium">Unsaved changes</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Intervals.icu Integration */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-rose-600" />
            <h2 className="font-semibold text-primary">Intervals.icu</h2>
          </div>
          <IntervalsConnect />
        </div>

        {/* Demo Data */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-textSecondary" />
            <h2 className="font-semibold text-primary">Demo Data</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Load sample workout data to see what the app looks like with activity history.
          </p>
          <div className="flex gap-3">
            <AnimatedButton
              onClick={async () => {
                setDemoDataLoading(true);
                setDemoDataMessage('');
                try {
                  const result = await loadSampleData();
                  setDemoDataMessage(`Loaded ${result.workoutsCreated} sample workouts!`);
                } catch {
                  setDemoDataMessage('Error loading sample data');
                } finally {
                  setDemoDataLoading(false);
                }
              }}
              disabled={demoDataLoading}
              className="btn-primary flex items-center gap-2 text-sm rounded-xl disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {demoDataLoading ? 'Loading...' : 'Load Sample Data'}
            </AnimatedButton>
            <button
              onClick={() => setShowClearDemoConfirm(true)}
              disabled={demoDataLoading}
              className="flex items-center gap-2 px-4 py-2 border border-strong text-secondary rounded-xl text-sm font-medium hover:bg-bgTertiary transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Clear Demo Data
            </button>
          </div>
          {demoDataMessage && (
            <p className="mt-3 text-sm text-green-600">{demoDataMessage}</p>
          )}
        </div>

        {/* Training Plan Reset */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-rose-600" />
            <h2 className="font-semibold text-primary">Training Plan</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Reset your training plan to start fresh. This deletes all planned workouts but keeps your completed workout history intact.
          </p>
          <button
            onClick={() => setShowResetPlanConfirm(true)}
            disabled={planResetLoading}
            className="flex items-center gap-2 px-4 py-2 border border-rose-800 text-rose-300 bg-rose-950 rounded-xl text-sm font-medium hover:bg-rose-900 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {planResetLoading ? 'Resetting...' : 'Reset Training Plans'}
          </button>
          {planResetMessage && (
            <p className="mt-3 text-sm text-green-600">{planResetMessage}</p>
          )}
        </div>

        {/* App */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-dream-500" />
            <h2 className="font-semibold text-primary">App</h2>
          </div>

          {isInstalled ? (
            <div className="p-3 bg-green-950 rounded-lg border border-green-800">
              <p className="text-sm font-medium text-green-200">
                Dreamy is installed on your device
              </p>
              <p className="text-xs text-green-300 mt-1">
                You are using the standalone app experience
              </p>
            </div>
          ) : isInstallable ? (
            <div className="space-y-3">
              <p className="text-sm text-textTertiary">
                Install Dreamy on your device for quick access and a native app experience.
              </p>
              <button
                onClick={installApp}
                className="flex items-center gap-2 px-4 py-2 bg-dream-600 text-white rounded-xl text-sm font-medium hover:bg-dream-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Install Dreamy
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-textTertiary">
                You can install Dreamy as an app on your device:
              </p>
              <ul className="text-sm text-textSecondary space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-medium">iOS:</span>
                  <span>Tap Share, then Add to Home Screen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">Android:</span>
                  <span>Tap menu, then Install app or Add to Home screen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">Desktop:</span>
                  <span>Look for the install icon in the browser address bar</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Push Notifications */}
        <NotificationSettings />

        {/* Sign Out */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LogOut className="w-5 h-5 text-rose-500" />
            <h2 className="font-semibold text-primary">Account</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Sign out of your current session on this device.
          </p>
          <button
            onClick={() => setShowSignOutConfirm(true)}
            disabled={signingOut}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Clear Demo Data Confirmation */}
      <ConfirmModal
        isOpen={showClearDemoConfirm}
        onClose={() => setShowClearDemoConfirm(false)}
        onConfirm={async () => {
          setShowClearDemoConfirm(false);
          setDemoDataLoading(true);
          setDemoDataMessage('');
          try {
            await clearDemoData();
            setDemoDataMessage('Demo data cleared!');
          } catch {
            setDemoDataMessage('Error clearing demo data');
          } finally {
            setDemoDataLoading(false);
          }
        }}
        title="Clear Demo Data?"
        message="This will delete all demo workouts. This action cannot be undone."
        confirmText="Clear Data"
        cancelText="Keep Data"
        variant="danger"
      />

      {/* Reset Training Plans Confirmation */}
      <ConfirmModal
        isOpen={showResetPlanConfirm}
        onClose={() => setShowResetPlanConfirm(false)}
        onConfirm={async () => {
          setShowResetPlanConfirm(false);
          setPlanResetLoading(true);
          setPlanResetMessage('');
          try {
            await resetAllTrainingPlans();
            setPlanResetMessage('Training plans reset successfully. Go to Races to create a new plan.');
          } catch {
            setPlanResetMessage('Error resetting training plans');
          } finally {
            setPlanResetLoading(false);
          }
        }}
        title="Reset Training Plans?"
        message="This will delete all training plans and planned workouts. Your completed workout history will be preserved."
        confirmText="Reset Plans"
        cancelText="Keep Plans"
        variant="warning"
      />

      {/* Sign Out Confirmation */}
      <ConfirmModal
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={async () => {
          setShowSignOutConfirm(false);
          setSigningOut(true);
          try {
            const res = await fetch('/api/gate', { method: 'DELETE' });
            if (res.ok) {
              window.location.href = '/gate';
            }
          } catch {
            setSigningOut(false);
          }
        }}
        title="Sign Out?"
        message="You will need to sign back in to access your data."
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        variant="danger"
      />
    </div>
  );
}
