'use client';

import { useState } from 'react';

export default function GatePage() {
  const publishModeEnabled = (() => {
    const explicitMode = (process.env.NEXT_PUBLIC_APP_VIEW_MODE || '').trim().toLowerCase();
    if (explicitMode === 'publish') return true;
    const legacyMode = (process.env.NEXT_PUBLIC_APP_ACCESS_MODE || '').trim().toLowerCase();
    return legacyMode === 'publish';
  })();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotDetails, setForgotDetails] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotMailto, setForgotMailto] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: mode === 'signup' ? 'signup' : 'login',
          username,
          password,
          displayName,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as { error?: string }));
        setError(payload.error || 'Wrong password');
        setLoading(false);
        return;
      }

      await res.json() as { ok?: boolean; role?: 'admin' | 'user' | 'viewer' | 'coach' | 'customer' };
      const target = '/today';

      // Hard redirect avoids occasional first-login cookie race with client-side routing.
      window.location.replace(target);
    } catch {
      setError('Unable to sign in right now. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await fetch('/api/gate/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: forgotUsername || username,
          email: forgotEmail,
          details: forgotDetails,
        }),
      });

      const payload = await res.json().catch(() => ({} as { error?: string; message?: string; mailto?: string }));
      if (!res.ok) {
        setForgotError(payload.error || 'Could not submit request.');
        setForgotLoading(false);
        return;
      }

      setForgotSuccess(payload.message || 'Request sent.');
      setForgotMailto(payload.mailto || null);
      setForgotLoading(false);

      if (payload.mailto) {
        window.location.assign(payload.mailto);
      }
    } catch {
      setForgotError('Could not submit request right now. Please try again.');
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl brand-text tracking-tight">dreamy</h1>
          <p className="text-textTertiary text-sm mt-1">
            {mode === 'signup' ? 'Create your account' : 'Enter username and password'}
          </p>
          {publishModeEnabled ? (
            <p className="text-textTertiary text-xs mt-2">Publish view: customers can create accounts and get full app access to their own data.</p>
          ) : (
            <p className="text-textTertiary text-xs mt-2">Roles: admin/user (full edit), viewer/coach (full browse, write-protected)</p>
          )}
        </div>

        {publishModeEnabled && (
          <div className="mb-4 rounded-xl border border-borderPrimary bg-bgSecondary p-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`rounded-lg py-2 text-sm font-medium ${mode === 'login' ? 'bg-surface-2 text-primary' : 'text-textSecondary'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`rounded-lg py-2 text-sm font-medium ${mode === 'signup' ? 'bg-surface-2 text-primary' : 'text-textSecondary'}`}
            >
              Create Account
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {publishModeEnabled && mode === 'signup' && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setError(null); }}
              placeholder="Display name (optional)"
              className="w-full px-4 py-3 rounded-xl bg-surface-1 border border-default text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-2 focus:ring-dream-500 focus:border-transparent"
            />
          )}
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(null); }}
            placeholder="Username"
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-surface-1 border border-default text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-2 focus:ring-dream-500 focus:border-transparent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl bg-surface-1 border border-default text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-2 focus:ring-dream-500 focus:border-transparent"
          />

          <div className="text-right">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword((prev) => !prev);
                setForgotUsername((prev) => prev || username);
                setForgotError(null);
                setForgotSuccess(null);
              }}
              className="text-xs text-dream-500 hover:text-dream-400"
            >
              Forgot password?
            </button>
          </div>

          {showForgotPassword && (
            <div className="rounded-xl border border-default bg-surface-2 p-3 space-y-2">
              <p className="text-xs text-textTertiary">
                This sends Jason a password reset request email.
              </p>
              <input
                type="text"
                value={forgotUsername}
                onChange={(e) => {
                  setForgotUsername(e.target.value);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                placeholder="Username"
                className="w-full px-3 py-2 rounded-lg bg-surface-1 border border-default text-sm text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-2 focus:ring-dream-500 focus:border-transparent"
              />
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => {
                  setForgotEmail(e.target.value);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                placeholder="Your email (optional)"
                className="w-full px-3 py-2 rounded-lg bg-surface-1 border border-default text-sm text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-2 focus:ring-dream-500 focus:border-transparent"
              />
              <textarea
                value={forgotDetails}
                onChange={(e) => {
                  setForgotDetails(e.target.value);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                placeholder="Optional details"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-surface-1 border border-default text-sm text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-2 focus:ring-dream-500 focus:border-transparent"
              />
              {forgotError && (
                <p className="text-xs text-red-500">{forgotError}</p>
              )}
              {forgotSuccess && (
                <p className="text-xs text-emerald-400">{forgotSuccess}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotLoading}
                  className="px-3 py-1.5 rounded-lg bg-dream-600 text-white text-xs font-medium hover:bg-dream-700 disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending...' : 'Send reset request'}
                </button>
                {forgotMailto && (
                  <a
                    href={forgotMailto}
                    className="px-3 py-1.5 rounded-lg border border-default text-xs text-textSecondary hover:text-primary"
                  >
                    Open email app
                  </a>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !username}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-dream-600 to-dream-900 text-white font-semibold hover:from-dream-700 hover:to-dream-950 disabled:opacity-50 transition-all"
          >
            {loading ? 'Checking...' : mode === 'signup' ? 'Create Account' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
