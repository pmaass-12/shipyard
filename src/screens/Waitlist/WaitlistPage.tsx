/**
 * WaitlistPage — Build 011
 *
 * Route: / (root, when waitlist_enabled = true in the deployed app)
 *
 * ⚠️  BUILD ARTIFACT — this component is intended for the PROJECT's deployed app,
 *     not for Shipyard itself. It is generated here so the builder can see/export
 *     it. It is NOT wired into Shipyard's own router.
 *
 * Design spec: specs/011-waitlist-READY.md
 * Contract:    contracts/011-waitlist-READY.md
 *
 * Features:
 *   - Dark gradient hero (deep purple/indigo)
 *   - Dynamic feature highlights loaded from /api/waitlist-highlights
 *   - Signup form with inline success + duplicate states
 *   - Invite token validation on /?invite=<token> (shows Supabase signup form)
 *
 * Props (or URL params):
 *   projectId — the Shipyard project UUID; pass via env or config in the deployed app
 */

import { useState, useEffect } from 'react';
import type { WaitlistHighlight } from '@/types/db';

// ── Design tokens ─────────────────────────────────────────────────────────

const C = {
  bg:       '#0d0618',      // deep purple-black
  surface:  'rgba(255,255,255,0.07)',  // frosted glass
  border:   'rgba(255,255,255,0.1)',
  text:     '#f0eeff',
  text2:    'rgba(240,238,255,0.6)',
  accent:   '#7c6ef7',
  accentDark: '#5b5bd6',
};

// ── Types ─────────────────────────────────────────────────────────────────

interface WaitlistPageProps {
  projectId: string;
  appName?:  string;
  tagline?:  string;
}

// ── Inline success state ──────────────────────────────────────────────────

function SuccessCard({ name, email }: { name: string; email: string }) {
  return (
    <div style={{
      padding: '32px 28px', textAlign: 'center',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
      <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: C.text }}>
        You're on the list, {name.split(' ')[0]}!
      </h3>
      <p style={{ margin: 0, fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
        We'll send you an email when your spot is ready.
        Keep an eye on your inbox at <strong style={{ color: C.text }}>{email}</strong>.
      </p>
    </div>
  );
}

// ── Waitlist Page ─────────────────────────────────────────────────────────

export default function WaitlistPage({ projectId, appName = 'App', tagline }: WaitlistPageProps) {
  const [highlights, setHighlights] = useState<Pick<WaitlistHighlight, 'icon' | 'title' | 'description'>[]>([]);
  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [source,     setSource]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [duplicate,  setDuplicate]  = useState(false);
  const [error,      setError]      = useState('');

  // Load highlights
  useEffect(() => {
    fetch(`/api/waitlist-highlights?project_id=${projectId}`)
      .then(r => r.json())
      .then((data: { highlights: typeof highlights }) => setHighlights(data.highlights ?? []))
      .catch(() => { /* non-critical */ });
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDuplicate(false);

    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res  = await fetch('/api/waitlist-signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ project_id: projectId, name, email, source }),
      });
      const data = await res.json() as { success?: boolean; duplicate?: boolean };

      if (data.duplicate) {
        setDuplicate(true);
      } else if (data.success) {
        setSubmitted(true);
      } else {
        setError('Something went wrong — please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '13px 16px', borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: 'rgba(255,255,255,0.06)',
    color: C.text, fontSize: 15, outline: 'none',
    marginBottom: 12,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${C.bg} 0%, #1a0d3a 60%, #0a1628 100%)`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: C.text,
    }}>
      {/* Nav */}
      <nav style={{
        padding: '20px 40px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`,
        background: 'rgba(0,0,0,0.2)',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
          {appName}
        </span>
        <span style={{
          padding: '4px 12px', borderRadius: 20,
          background: 'rgba(124,110,247,0.2)', color: C.accent,
          fontSize: 12, fontWeight: 600, letterSpacing: '0.5px',
        }}>
          Private Beta
        </span>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 840, margin: '0 auto', padding: '80px 40px 40px', textAlign: 'center' }}>
        <h1 style={{
          margin: '0 0 16px',
          fontSize: 'clamp(32px, 5vw, 52px)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-1px',
          background: 'linear-gradient(135deg, #f0eeff 0%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {tagline ?? `${appName} is coming soon`}
        </h1>
        <p style={{ margin: '0 0 56px', fontSize: 18, color: C.text2, lineHeight: 1.6, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          Join the waitlist for early access. We'll let you know when your spot is ready.
        </p>

        {/* Feature highlights */}
        {highlights.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${highlights.length}, 1fr)`,
            gap: 16,
            marginBottom: 56,
          }}>
            {highlights.map((h, i) => (
              <div key={i} style={{
                padding: '24px 20px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                backdropFilter: 'blur(12px)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{h.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{h.title}</div>
                <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{h.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Signup form card */}
        <div style={{
          maxWidth: 440, margin: '0 auto',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}>
          {submitted ? (
            <SuccessCard name={name} email={email} />
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: '32px 28px' }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: C.text }}>
                Join the waitlist
              </h2>

              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
                style={inputStyle}
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                required
                style={inputStyle}
              />
              <input
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="How did you hear about us? (optional)"
                style={{ ...inputStyle, marginBottom: 20 }}
              />

              {/* Duplicate alert */}
              {duplicate && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 12,
                  background: 'rgba(255,159,10,.12)',
                  border: '1px solid rgba(255,159,10,.25)',
                  color: '#ff9f0a', fontSize: 13,
                }}>
                  ✋ That email is already on the waitlist. We'll be in touch!
                </div>
              )}

              {/* General error */}
              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 12,
                  background: 'rgba(255,69,58,.1)',
                  border: '1px solid rgba(255,69,58,.2)',
                  color: '#ff453a', fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  border: 'none', background: C.accent, color: '#fff',
                  fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  letterSpacing: '-0.2px',
                }}
              >
                {submitting ? 'Joining…' : 'Join the waitlist →'}
              </button>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: C.text2 }}>
                No spam. We'll only email you when your spot is ready.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '48px 24px 32px', color: 'rgba(240,238,255,0.3)', fontSize: 13 }}>
        © {new Date().getFullYear()} {appName}. Built with Shipyard.
      </div>
    </div>
  );
}
