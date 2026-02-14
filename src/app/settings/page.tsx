'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getSettings,
  updateCoachSettings,
  updateAISettings,
} from '@/actions/settings';
import { useProfile } from '@/lib/profile-context';
import { coachPersonas, aiProviders, claudeModels, openaiModels, type CoachPersona, type AIProvider, type ClaudeModel, type OpenAIModel } from '@/lib/schema';
import { getAllPersonas } from '@/lib/coach-personas';
import { getModelDisplayName, getModelDescription } from '@/lib/ai';
import { cn } from '@/lib/utils';
import { Database, Trash2, Download, Smartphone, Calendar, User, RefreshCw, Sparkles, Link as LinkIcon, Brain, ChevronRight } from 'lucide-react';
import { loadSampleData, clearDemoData } from '@/actions/demo-data';
import { resetAllTrainingPlans } from '@/actions/training-plan';
import { usePWA } from '@/components/PWAProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { IntervalsConnect } from '@/components/IntervalsConnect';
import Link from 'next/link';

export default function SettingsPage() {
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

  // Coach personalization state
  const [coachName, setCoachName] = useState('Coach');
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

  useEffect(() => {
    const profileId = activeProfile?.id;
    getSettings(profileId).then((settings) => {
      if (settings) {
        // Load coach personalization
        setCoachName(settings.coachName || 'Coach');
        setCoachColor(settings.coachColor || 'blue');
        setCoachPersona((settings.coachPersona as CoachPersona) || 'encouraging');
        // Load AI provider settings
        setAiProvider((settings.aiProvider as AIProvider) || 'claude');
        setClaudeModel((settings.claudeModel as ClaudeModel) || 'claude-sonnet-4-20250514');
        setOpenaiModel((settings.openaiModel as OpenAIModel) || 'gpt-5.2');
      }
    });
  }, [activeProfile?.id]);

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-primary mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Profile Banner */}
        <Link href="/profile" className="block">
          <div className="bg-accentTeal/10 rounded-xl border border-accentTeal/30 p-4 shadow-sm hover:bg-accentTeal/15 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-accentTeal" />
                <div>
                  <p className="font-semibold text-primary">Runner Profile</p>
                  <p className="text-sm text-textSecondary">Edit your training preferences, goals, PRs, and more</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-accentTeal" />
            </div>
          </div>
        </Link>

        {/* Coach Personalization */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-primary">Your Coach</h2>
            </div>
            {coachSaved && (
              <span className="text-xs text-green-600 font-medium">Saved!</span>
            )}
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Personalize your AI running coach&apos;s name and color theme.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Coach Name
              </label>
              <input
                type="text"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                placeholder="Coach"
                className="w-full max-w-xs px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-textTertiary mt-1">
                e.g., Coach, Luna, Marcus, or any name you prefer
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Accent Color
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="color"
                    value={coachColor.startsWith('#') ? coachColor : '#3b82f6'}
                    onChange={(e) => {
                      setCoachColor(e.target.value);
                    }}
                    className="w-16 h-16 rounded-xl cursor-pointer border-2 border-default hover:border-strong transition-colors"
                    style={{ padding: '2px' }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-textSecondary">Click to pick any color</p>
                  <p className="text-xs text-tertiary mt-1">Current: {coachColor}</p>
                </div>
              </div>
              {/* Quick presets */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { value: '#3b82f6', label: 'Blue' },
                  { value: '#22c55e', label: 'Green' },
                  { value: '#a855f7', label: 'Purple' },
                  { value: '#f97316', label: 'Orange' },
                  { value: '#ef4444', label: 'Red' },
                  { value: '#14b8a6', label: 'Teal' },
                  { value: '#ec4899', label: 'Pink' },
                  { value: '#eab308', label: 'Gold' },
                ].map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setCoachColor(color.value)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all border-2',
                      coachColor === color.value
                        ? 'border-strong ring-2 ring-offset-1 ring-stone-400 scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* Coach Persona / Communication Style */}
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
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-default hover:border-strong'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                      coachPersona === persona.name
                        ? 'border-purple-500 bg-purple-500'
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

            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  await updateCoachSettings(coachName, coachColor, coachPersona);
                  setCoachSaved(true);
                  setTimeout(() => setCoachSaved(false), 2000);
                });
              }}
              disabled={isPending}
              className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all text-sm font-semibold shadow-sm hover:shadow-md"
            >
              Save Coach Settings
            </button>
          </div>
        </div>

        {/* AI Provider Settings */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-primary">AI Provider</h2>
          </div>
          <p className="text-sm text-textSecondary mb-4">
            Choose which AI powers your coach. Different models have different strengths.
          </p>

          <div className="space-y-4">
            {/* Provider Selection */}
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
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-default hover:border-strong text-textSecondary'
                    )}
                  >
                    {provider === 'claude' ? 'Claude (Anthropic)' : 'OpenAI'}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selection */}
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
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-default hover:border-strong'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                        claudeModel === model
                          ? 'border-indigo-500 bg-indigo-500'
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
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-default hover:border-strong'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                        openaiModel === model
                          ? 'border-indigo-500 bg-indigo-500'
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
              <button
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    await updateAISettings(aiProvider, claudeModel, openaiModel);
                    setAiSaved(true);
                    setTimeout(() => setAiSaved(false), 2000);
                  });
                }}
                disabled={isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                Save AI Settings
              </button>
              {aiSaved && (
                <span className="text-sm text-green-600 font-medium">Saved!</span>
              )}
            </div>
          </div>
        </div>

        {/* External Integrations */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-rose-600" />
            <h2 className="font-semibold text-primary">External Integrations</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Connect external services to automatically sync your workouts.
          </p>

          {/* Strava Integration Card */}
          <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FC4C02] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zm-8.293-6.56l-2.536 5.024L2.026 11.384H.001L4.558 20.1l2.535-5.015 2.534 5.015 4.558-8.716h-2.026l-2.533 5.024-2.532-5.024z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-primary">Strava</h3>
                  <p className="text-sm text-textSecondary">Sync activities from Strava</p>
                </div>
              </div>
              <a
                href="/strava-sync"
                className="px-4 py-2 bg-[#FC4C02] text-white rounded-lg hover:bg-[#E34402] transition-colors font-medium flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Manage Sync
              </a>
            </div>
          </div>

          <div className="mt-4">
            <IntervalsConnect />
          </div>
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
            <button
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
            </button>
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
            className="flex items-center gap-2 px-4 py-2 border border-rose-300 text-rose-700 bg-rose-50 rounded-xl text-sm font-medium hover:bg-rose-50 transition-colors disabled:opacity-50"
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
            <Smartphone className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-primary">App</h2>
          </div>

          {isInstalled ? (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-800">
                Dreamy is installed on your device
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
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
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
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
    </div>
  );
}
