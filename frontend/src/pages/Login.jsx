import React, { useState } from 'react';
import { Shield, Loader } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white dark:bg-[#0b0f16] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-slate-900 dark:text-white font-bold text-lg">AEGIS</div>
            <div className="text-slate-500 text-xs">Sign in to protect your data</div>
          </div>
        </div>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              mode === 'login'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-transparent text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              mode === 'register'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-transparent text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            Create account
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-lg p-3">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              maxLength={128}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              placeholder="At least 8 characters"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Note: max 128 characters.
            </p>
          </div>

          <button
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-60"
            type="submit"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
            {mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
          Your analyses, history, and crisis chat are now tied to your account. Tokens are stored locally in your browser.
        </p>
      </div>
    </div>
  );
}
