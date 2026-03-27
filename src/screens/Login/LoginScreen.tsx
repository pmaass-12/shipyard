/**
 * LoginScreen — email/password auth with Google OAuth stub.
 *
 * No design spec for auth — built as infrastructure.
 * Google OAuth button is wired but requires a Google provider configured
 * in your Supabase project's Auth settings before it will work.
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Mail, Lock, Chrome, Eye, EyeOff } from 'lucide-react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/lib/auth';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const navigate = useNavigate();
  const [mode, setMode]           = useState<Mode>('signin');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        navigate('/projects', { replace: true });
      } else {
        const { user } = await signUpWithEmail(email, password);
        if (user && !user.confirmed_at) {
          setSuccess('Check your email to confirm your account, then sign in.');
          setMode('signin');
        } else {
          navigate('/projects', { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
      // Redirect handled by Supabase OAuth flow
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--color-bg)' }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--color-accent)', color: '#fff' }}>
          <Anchor size={18} />
        </div>
        <span className="text-xl font-bold tracking-tight"
          style={{ color: 'var(--color-text)' }}>
          Shipyard
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border p-8"
        style={{
          background:   'var(--color-surface)',
          borderColor:  'var(--color-border)',
          boxShadow:    '0 4px 24px rgba(0,0,0,0.06)',
        }}>

        <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'signin'
            ? 'Sign in to continue to Shipyard.'
            : 'Start building and shipping faster.'}
        </p>

        {/* Google OAuth (stub — requires Supabase Google provider config) */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2.5 h-10 rounded-lg border text-sm font-medium transition-colors mb-4"
          style={{
            borderColor: 'var(--color-border)',
            color:       'var(--color-text)',
            background:  'var(--color-surface)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
        >
          <Chrome size={16} />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Email */}
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-subtle)' }} />
            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg border text-sm outline-none transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                background:  'var(--color-bg)',
                color:       'var(--color-text)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
              onBlur={e => (e.target.style.borderColor  = 'var(--color-border)')}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-subtle)' }} />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-10 pl-9 pr-9 rounded-lg border text-sm outline-none transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                background:  'var(--color-bg)',
                color:       'var(--color-text)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
              onBlur={e => (e.target.style.borderColor  = 'var(--color-border)')}
            />
            <button type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-subtle)' }}
              tabIndex={-1}
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Success */}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: loading ? 'var(--color-accent)' : 'var(--color-accent)' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--color-accent-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent)'; }}
          >
            {loading
              ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
              : (mode === 'signin' ? 'Sign in'     : 'Create account')}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-sm text-center mt-4" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="font-medium transition-colors"
            style={{ color: 'var(--color-accent)' }}
            onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null); }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>

      <p className="mt-6 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
        Shipyard is for builders, by builders.
      </p>
    </div>
  );
}
