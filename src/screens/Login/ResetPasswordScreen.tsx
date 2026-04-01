/**
 * ResetPasswordScreen — handles the Supabase password reset callback.
 *
 * Flow:
 *   1. User clicks the reset link in their email.
 *   2. Supabase redirects to /reset-password with access_token + refresh_token
 *      in the URL hash. Supabase JS client automatically detects this and
 *      establishes a session — no manual token parsing needed.
 *   3. User enters a new password and submits.
 *   4. On success, redirect to /login.
 *
 * Route: /reset-password (public — outside AuthGuard)
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Lock, Eye, EyeOff } from 'lucide-react';
import { updatePassword } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

export default function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      // Brief pause so the user sees the confirmation, then redirect
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(extractErrorMessage(err, 'Something went wrong.'));
    } finally {
      setLoading(false);
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
          background:  'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow:   '0 4px 24px rgba(0,0,0,0.06)',
        }}>

        <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
          Set a new password
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Choose a strong password for your account.
        </p>

        {success ? (
          <p data-testid="reset-success"
            className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Password updated! Redirecting you to sign in…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* New password */}
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-subtle)' }} />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="New password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                data-testid="reset-password-input"
                className="w-full h-10 pl-9 pr-9 rounded-lg border text-sm outline-none transition-colors"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                onBlur={e => (e.target.style.borderColor  = 'var(--color-border)')}
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-subtle)' }}
                tabIndex={-1}
                aria-label={showPass ? 'Hide password' : 'Show password'}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Confirm password */}
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-subtle)' }} />
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                data-testid="reset-confirm-input"
                className="w-full h-10 pl-9 pr-9 rounded-lg border text-sm outline-none transition-colors"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                onBlur={e => (e.target.style.borderColor  = 'var(--color-border)')}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-subtle)' }}
                tabIndex={-1}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="reset-submit"
              className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: 'var(--color-accent)' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--color-accent-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent)'; }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
        Shipyard is for builders, by builders.
      </p>
    </div>
  );
}
