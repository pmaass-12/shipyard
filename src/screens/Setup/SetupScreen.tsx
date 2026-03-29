/**
 * SetupScreen — Builds 004 + 005
 *
 * Route: /projects/:id/setup
 *
 * A checklist-style wizard with collapsible sections:
 *   s1 — Auth Setup         (Build 005)
 *   s2 — Claude API Key     (includes Model Selector, Build 004)
 *   s3 — Screens / Sitemap  (stub)
 *   s4 — Deploy             (stub)
 *
 * Model Selector (Build 004):
 *   Three-card radio in the Claude API step.
 *   Persists `default_model` on the projects table.
 *   Per-run override is handled separately in FeatureDetail (future build).
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase }               from '@/lib/supabase';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut,
}                                 from '@/lib/auth';
import { updateProject }          from '@/api/projects';
import { useToast }               from '@/context/ToastContext';

// ── Design tokens ─────────────────────────────────────────────────────────

const T = {
  bg:      '#0f0f10',
  surface: '#1a1a1c',
  surf2:   '#222224',
  surf3:   '#2c2c2e',
  border:  '#2c2c2e',
  bord2:   '#3a3a3c',
  text:    '#e8e8ea',
  text2:   '#8e8e93',
  text3:   '#636366',
  accent:  '#0a84ff',
  green:   '#30d158',
  red:     '#ff453a',
};

// ── Model definitions ─────────────────────────────────────────────────────

const MODELS = [
  {
    key:         'claude-haiku-4-5-20251001',
    label:       'Haiku 4.5',
    tagline:     'Fastest & most affordable',
    costHint:    '~$0.01 / feature',
    recommended: false,
  },
  {
    key:         'claude-sonnet-4-6',
    label:       'Sonnet 4.6',
    tagline:     'Best balance of speed & quality',
    costHint:    '~$0.08 / feature',
    recommended: true,
  },
  {
    key:         'claude-opus-4-6',
    label:       'Opus 4.6',
    tagline:     'Highest quality, more thorough',
    costHint:    '~$0.40 / feature',
    recommended: false,
  },
] as const;

type ModelKey = typeof MODELS[number]['key'];

// ── Step IDs ──────────────────────────────────────────────────────────────

type StepId = 's1-auth' | 's2-claude' | 's3-screens' | 's4-deploy';

interface StepState {
  id:        StepId;
  label:     string;
  completed: boolean;
}

// ── Auth section (Build 005) ──────────────────────────────────────────────

type AuthView = 'choices' | 'email' | 'confirming' | 'done';

function AuthStep({ onDone }: { onDone: () => void }) {
  const [view,      setView]      = useState<AuthView>('choices');
  const [mode,      setMode]      = useState<'signin' | 'signup'>('signup');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [user,      setUser]      = useState<{ email: string } | null>(null);
  const { showToast }             = useToast();

  // Subscribe to auth state — handles both initial session and OAuth callback return.
  // BUG-P2-005b fix: use onAuthStateChange instead of one-time getUser() so that
  // the Google OAuth redirect lands back here and correctly transitions to 'done'.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email ?? '' });
        setView('done');
      } else {
        setView(v => v === 'done' ? 'choices' : v);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password);
        setView('confirming');
      } else {
        await signInWithEmail(email, password);
        const { data } = await supabase.auth.getUser();
        setUser({ email: data.user?.email ?? '' });
        setView('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      // BUG-P2-005a fix: pass current URL so OAuth redirects back to the setup wizard,
      // not to /projects (which abandons the wizard state).
      await signInWithGoogle(window.location.href);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google sign-in failed', 'error');
    }
  }

  if (view === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: T.green, fontSize: 20 }}>✓</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Signed in</div>
            <div style={{ fontSize: 12, color: T.text2 }}>{user?.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { onDone(); }} style={pill(T.accent, '#fff')}>Continue →</button>
          <button onClick={async () => {
            // BUG-P2-005c fix: await signOut so errors are caught and state
            // is only reset after the server-side session is actually cleared.
            try { await signOut(); } catch { /* toast optional */ }
            setView('choices');
            setUser(null);
          }} style={pill(T.surf3, T.text2)}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (view === 'confirming') {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Check your email</div>
        <div style={{ fontSize: 13, color: T.text2, marginBottom: 16 }}>
          We sent a confirmation link to <strong>{email}</strong>.<br />
          Click it to finish setting up your account.
        </div>
        <button onClick={() => setView('choices')} style={pill(T.surf3, T.text2)}>← Back</button>
      </div>
    );
  }

  if (view === 'email') {
    return (
      <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button type="button" onClick={() => setMode('signup')} style={pill(mode === 'signup' ? T.accent : T.surf3, mode === 'signup' ? '#fff' : T.text2)}>
            Create account
          </button>
          <button type="button" onClick={() => setMode('signin')} style={pill(mode === 'signin' ? T.accent : T.surf3, mode === 'signin' ? '#fff' : T.text2)}>
            Sign in
          </button>
        </div>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email address" required autoFocus
          style={inputStyle}
        />
        <div style={{ position: 'relative' }}>
          <input
            type={showPwd ? 'text' : 'password'}
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required minLength={8}
            style={{ ...inputStyle, paddingRight: 40 }}
          />
          <button
            type="button"
            onClick={() => setShowPwd(v => !v)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 12 }}
          >
            {showPwd ? 'Hide' : 'Show'}
          </button>
        </div>
        {error && <p style={{ color: T.red, fontSize: 12, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={() => setView('choices')} style={pill(T.surf3, T.text2)}>← Back</button>
          <button type="submit" disabled={loading} style={pill(T.accent, '#fff')}>
            {loading ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </form>
    );
  }

  // choices
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button onClick={() => setView('email')} style={{
        ...pill(T.surf2, T.text), padding: '10px 14px',
        border: `1px solid ${T.bord2}`, borderRadius: 10,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
      data-testid="auth-email-btn"
      >
        <span>✉</span> Continue with Email
      </button>
      <button onClick={handleGoogle} data-testid="auth-google-btn" style={{
        ...pill(T.surf2, T.text), padding: '10px 14px',
        border: `1px solid ${T.bord2}`, borderRadius: 10,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span>G</span> Continue with Google
      </button>
    </div>
  );
}

// ── Model Selector (Build 004) ────────────────────────────────────────────

function ModelSelector({
  selected,
  onChange,
}: {
  selected: ModelKey;
  onChange:  (key: ModelKey) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {MODELS.map(m => {
        const isSelected = selected === m.key;
        return (
          <button
            key={m.key}
            data-testid={`model-card-${m.key}`}
            onClick={() => onChange(m.key)}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:           14,
              padding:       '12px 14px',
              background:    isSelected ? 'rgba(10,132,255,0.08)' : T.surf2,
              border:        `1.5px solid ${isSelected ? T.accent : T.bord2}`,
              borderRadius:   12,
              cursor:         'pointer',
              textAlign:      'left',
              width:          '100%',
            }}
          >
            {/* Radio dot */}
            <div style={{
              width:        18, height: 18, borderRadius: '50%',
              border:       `2px solid ${isSelected ? T.accent : T.text3}`,
              background:    isSelected ? T.accent : 'transparent',
              flexShrink:    0,
              display:       'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isSelected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{m.label}</span>
                {m.recommended && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px',
                    background: 'rgba(10,132,255,0.15)', color: T.accent,
                    borderRadius: 10, letterSpacing: '0.5px',
                  }}>
                    RECOMMENDED
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{m.tagline}</div>
            </div>
            <span style={{ fontSize: 11, color: T.text3, flexShrink: 0 }}>{m.costHint}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Claude API Step ───────────────────────────────────────────────────────

function ClaudeApiStep({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone:    () => void;
}) {
  const [apiKey,   setApiKey]   = useState('');
  const [showKey,  setShowKey]  = useState(false);
  const [model,    setModel]    = useState<ModelKey>('claude-sonnet-4-6');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const { showToast }           = useToast();

  async function handleSave() {
    if (!apiKey.startsWith('sk-ant-')) {
      setError('API key must start with sk-ant-');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // 1. Save API key via edge function (RLS-protected, never stored in localStorage)
      const { data: { session } } = await supabase.auth.getSession();
      const keyRes = await fetch(`/api/projects/${projectId}/api-key`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ api_key: apiKey }),
      });
      if (!keyRes.ok) {
        const msg = await keyRes.text();
        throw new Error(`Key save failed: ${msg}`);
      }

      // 2. Persist the chosen default model on the project
      await updateProject(projectId, { default_model: model });

      showToast(`Claude API key saved · Model: ${MODELS.find(m => m.key === model)?.label}`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Claude API Key</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-api03-…"
            data-shipyard-mask
            style={{ ...inputStyle, paddingRight: 44, fontFamily: 'monospace', fontSize: 13 }}
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 12 }}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: T.text3, margin: '4px 0 0' }}>
          Get your key from console.anthropic.com. It's stored in your Netlify environment, never in the database.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Default model</label>
        <ModelSelector selected={model} onChange={setModel} />
        <p style={{ fontSize: 11, color: T.text3, margin: '6px 0 0' }}>
          Used for all code generation in this project. You can override per-feature in the Feature Detail view.
        </p>
      </div>

      {error && <p style={{ color: T.red, fontSize: 12, margin: 0 }}>{error}</p>}

      <button
        data-testid="save-claude-step"
        onClick={handleSave}
        disabled={saving || !apiKey}
        style={pill(!apiKey ? T.surf3 : T.accent, !apiKey ? T.text3 : '#fff')}
      >
        {saving ? 'Saving…' : 'Save & continue →'}
      </button>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────

function pill(bg: string, color: string): React.CSSProperties {
  return {
    padding: '8px 16px', background: bg, color, border: 'none',
    borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#222224', border: '1px solid #3a3a3c',
  borderRadius: 10, color: '#e8e8ea', fontSize: 14,
  padding: '9px 12px', outline: 'none', fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#8e8e93', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px',
};

// ── SetupScreen ───────────────────────────────────────────────────────────

export default function SetupScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate           = useNavigate();
  const [openStep, setOpenStep] = useState<StepId>('s1-auth');

  const [steps, setSteps] = useState<StepState[]>([
    { id: 's1-auth',    label: '1 — Authentication',   completed: false },
    { id: 's2-claude',  label: '2 — Claude API & Model', completed: false },
    { id: 's3-screens', label: '3 — Screens & Sitemap', completed: false },
    { id: 's4-deploy',  label: '4 — Deploy',            completed: false },
  ]);

  function completeStep(id: StepId) {
    setSteps(ss => ss.map(s => s.id === id ? { ...s, completed: true } : s));
    // Advance to next step
    const ids: StepId[] = ['s1-auth', 's2-claude', 's3-screens', 's4-deploy'];
    const idx           = ids.indexOf(id);
    if (idx < ids.length - 1) setOpenStep(ids[idx + 1]);
    else navigate(`/projects/${projectId}/screens`);
  }

  const allDone = steps.every(s => s.completed);

  return (
    <div style={{
      minHeight:   '100vh',
      background:   T.bg,
      color:        T.text,
      fontFamily:  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display:     'flex',
      flexDirection: 'column',
      alignItems:  'center',
      padding:     '32px 16px 64px',
    }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: 32 }}>
        <button
          onClick={() => navigate('/projects')}
          style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 20 }}
        >
          ← Projects
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Project Setup</h1>
        <p style={{ margin: '6px 0 0', color: T.text2, fontSize: 14 }}>
          Complete these steps to start generating code with Shipyard.
        </p>
      </div>

      {/* Steps */}
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map(step => {
          const isOpen = openStep === step.id;
          return (
            <div key={step.id} style={{
              background:   T.surface,
              border:       `1px solid ${isOpen ? T.accent : T.border}`,
              borderRadius:  14,
              overflow:      'hidden',
            }}>
              {/* Step header */}
              <button
                onClick={() => setOpenStep(isOpen ? ('' as StepId) : step.id)}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'space-between',
                  width:           '100%',
                  padding:         '14px 16px',
                  background:      'none',
                  border:          'none',
                  cursor:          'pointer',
                  color:            T.text,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width:        22, height: 22, borderRadius: '50%',
                    background:    step.completed ? T.green : isOpen ? T.accent : T.surf3,
                    display:       'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink:    0, fontSize: 12, fontWeight: 700, color: '#fff',
                  }}>
                    {step.completed ? '✓' : ''}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{step.label}</span>
                  {step.completed && <span style={{ fontSize: 12, color: T.green }}>Done</span>}
                </div>
                <span style={{ color: T.text3, fontSize: 18 }}>{isOpen ? '−' : '+'}</span>
              </button>

              {/* Step body */}
              {isOpen && (
                <div style={{ padding: '0 16px 18px', borderTop: `1px solid ${T.border}` }}>
                  <div style={{ paddingTop: 16 }}>
                    {step.id === 's1-auth' && (
                      <AuthStep onDone={() => completeStep('s1-auth')} />
                    )}
                    {step.id === 's2-claude' && projectId && (
                      <ClaudeApiStep projectId={projectId} onDone={() => completeStep('s2-claude')} />
                    )}
                    {step.id === 's3-screens' && (
                      <div>
                        <p style={{ color: T.text2, fontSize: 13, margin: '0 0 12px' }}>
                          Define the screens and user flows for your project. You can add screens now or skip and add them later.
                        </p>
                        <button onClick={() => completeStep('s3-screens')} style={pill(T.accent, '#fff')}>
                          Set up screens →
                        </button>
                      </div>
                    )}
                    {step.id === 's4-deploy' && (
                      <div>
                        <p style={{ color: T.text2, fontSize: 13, margin: '0 0 12px' }}>
                          Connect your Netlify account to enable one-click deploys directly from Shipyard.
                        </p>
                        <button onClick={() => completeStep('s4-deploy')} style={pill(T.accent, '#fff')}>
                          Connect Netlify →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All done CTA */}
      {allDone && (
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <button onClick={() => navigate(`/projects/${projectId}/screens`)} style={{ ...pill(T.green, '#fff'), padding: '12px 28px', fontSize: 15 }}>
            Go to project →
          </button>
        </div>
      )}
    </div>
  );
}
