'use client';

import { useState } from 'react';

export default function GatePage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError(true);
        setLoading(false);
        return;
      }

      await res.json() as { ok?: boolean; role?: 'admin' | 'user' | 'viewer' | 'coach' };
      const target = '/today';

      // Hard redirect avoids occasional first-login cookie race with client-side routing.
      window.location.replace(target);
    } catch {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl brand-text tracking-tight">dreamy</h1>
          <p className="text-textTertiary text-sm mt-1">Enter username and password</p>
          <p className="text-textTertiary text-xs mt-2">Roles: admin/user (full edit), viewer/coach (full browse, write-protected)</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(false); }}
            placeholder="Username"
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-surface-1 border border-default text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-2 focus:ring-dream-500 focus:border-transparent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl bg-surface-1 border border-default text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-2 focus:ring-dream-500 focus:border-transparent"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">Wrong password</p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !username}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-dream-600 to-dream-900 text-white font-semibold hover:from-dream-700 hover:to-dream-950 disabled:opacity-50 transition-all"
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
