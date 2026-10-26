import React, { useState } from 'react';
import { ArrowRight, Zap } from 'lucide-react';

interface LoginPageProps {
  configured: boolean;
  isSubmitting: boolean;
  error: string | null;
  notice: string | null;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (name: string, email: string, password: string) => Promise<{
    error: string | null;
    needsEmailConfirmation: boolean;
  }>;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  configured,
  isSubmitting,
  error,
  notice,
  onSignIn,
  onSignUp,
}) => {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    setLocalNotice(null);

    try {
      if (mode === 'sign-in') {
        setLocalError(await onSignIn(email, password));
      } else {
        const result = await onSignUp(name.trim(), email, password);
        setLocalError(result.error);
        if (!result.error) {
          setLocalNotice(
            result.needsEmailConfirmation
              ? 'Account created. Check your email to confirm your address, then sign in.'
              : 'Account created and signed in.'
          );
          if (result.needsEmailConfirmation) setMode('sign-in');
        }
      }
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !configured || submitting || isSubmitting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-teal-500/30">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-3">ZeroStatic</h1>
        <p className="text-xl text-gray-300 font-light">Smart Charging for a Smarter Future</p>
      </div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white">
            {mode === 'sign-in' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-gray-300 mt-2">Sign in securely to your charging facility.</p>
        </div>

        {!configured && (
          <div role="alert" className="rounded-xl border border-amber-300/50 bg-amber-300/10 p-3 text-sm text-amber-100">
            Supabase is not configured. Add your project URL and publishable key to the local
            <code className="mx-1">.env</code> file, then restart the dev server.
          </div>
        )}

        {(error || localError) && (
          <div role="alert" className="rounded-xl border border-red-300/50 bg-red-300/10 p-3 text-sm text-red-100">
            {localError ?? error}
          </div>
        )}
        {(notice || localNotice) && (
          <div role="status" className="rounded-xl border border-teal-300/50 bg-teal-300/10 p-3 text-sm text-teal-100">
            {localNotice ?? notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'sign-up' && (
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-gray-300 mb-2">Full name</label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={event => setName(event.target.value)}
                required
                maxLength={100}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={8}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {mode === 'sign-up' && <p className="mt-1 text-xs text-gray-400">Use at least 8 characters.</p>}
          </div>
          <button
            type="submit"
            disabled={disabled}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg"
          >
            {submitting || isSubmitting ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            {!submitting && !isSubmitting && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <p className="text-center text-sm text-gray-300">
          {mode === 'sign-in' ? 'New to ZeroStatic?' : 'Already have an account?'}{' '}
          <button
            type="button"
            disabled={!configured || submitting || isSubmitting}
            onClick={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setLocalError(null);
              setLocalNotice(null);
            }}
            className="font-semibold text-teal-300 hover:text-teal-200 disabled:opacity-50"
          >
            {mode === 'sign-in' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>

      <p className="text-center text-gray-500 text-sm mt-8">
        Secure charging management for your electric vehicle
      </p>
    </div>
  );
};
