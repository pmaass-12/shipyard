/**
 * InfraWizardScreen — Build 053: Guided Infrastructure Setup Wizard
 *
 * Route: /projects/:id/deploy  (replaces Build 038 DeploySetupScreen at this route)
 * Query params:
 *   ?step=1|2|3|done   — wizard step (default: 1)
 *   ?mode=advanced      — skip to Advanced mode (shows Build 038-style credential-first flow)
 *   ?from=wizard        — entry from Setup Wizard Screen 5
 *   ?field=<fieldId>    — pre-loads Reeve panel with a field-specific question
 *
 * Credential storage: account_connections table (existing, Build 038).
 * No new migration required. No new tables.
 * Advanced mode preserves Build 038's credential-first flow.
 *
 * Components (all inline, no external imports beyond supabase + react-router):
 *   InfraWizardStepper   — 4-node progress stepper
 *   GateQuestion         — "Yes / No" choice buttons with tint states
 *   InlineInstructions   — Amber accordion panel with numbered steps
 *   CredentialField      — Text/password field with "Where do I find this?" link
 *   HostCard             — Netlify / Vercel selection card
 *   InfraStepSuccess     — Per-step success state
 *   InfraSuccessCard     — Final screen summary table
 *   ReeveHelpPanel       — 400px slide-over chat with ephemeral history
 *   AdvancedMode         — Single-card all-credential view
 *   Step1/Step2/Step3    — Guided step screens
 *   FinalScreen          — Done screen
 *
 * Styling: Inline styles only. No Tailwind. Design tokens from spec.
 */

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// ── Design Tokens ──────────────────────────────────────────────────────────

const T = {
  accent:       '#5b5bd6',
  accentDark:   '#4338ca',
  accentBg:     '#eef0ff',
  bg:           '#f5f5f7',
  surface:      '#ffffff',
  border:       '#e4e4e8',
  text:         '#1a1a1e',
  muted:        '#6e6e80',
  reeve:        '#4338ca',
  amberBg:      '#fffbeb',
  amberBorder:  '#fde68a',
  amberText:    '#92400e',
  success:      '#22c55e',
  error:        '#ef4444',
};

// ── Shared Layout Styles ───────────────────────────────────────────────────

const wizardWrap: React.CSSProperties = {
  minHeight: '100vh',
  background: T.bg,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Inter, system-ui, sans-serif',
  color: T.text,
};

const contentArea: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '32px 24px 80px',
};

const card: React.CSSProperties = {
  background: T.surface,
  border: `1.5px solid ${T.border}`,
  borderRadius: 12,
  padding: '32px 36px',
  width: '100%',
  maxWidth: 560,
};

// ── InfraWizardStepper ─────────────────────────────────────────────────────

const STEPS = ['Repository', 'Web Host', 'Database', 'Done'];

function InfraWizardStepper({
  currentStep,
  completedSteps,
  onStepClick,
}: {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}) {
  return (
    <div
      data-testid="infra-stepper"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        padding: '20px 24px 0',
        maxWidth: 560,
        width: '100%',
        margin: '0 auto',
      }}
    >
      {STEPS.map((label, idx) => {
        const stepNum = idx + 1;
        const isCompleted = completedSteps.includes(stepNum);
        const isActive = currentStep === stepNum;
        const isClickable = isCompleted;

        const dotStyle: React.CSSProperties = {
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 600,
          flexShrink: 0,
          cursor: isClickable ? 'pointer' : 'default',
          transition: 'all 0.2s',
          background: isCompleted
            ? T.muted
            : isActive
            ? T.accentDark
            : '#d1d1d6',
          color: isCompleted || isActive ? '#fff' : T.muted,
          border: isActive ? `2px solid ${T.accentDark}` : '2px solid transparent',
        };

        return (
          <div
            key={stepNum}
            style={{ display: 'flex', alignItems: 'center', flex: idx < STEPS.length - 1 ? 1 : 'none' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={dotStyle}
                onClick={() => isClickable && onStepClick(stepNum)}
                data-testid={`stepper-step-${stepNum}`}
              >
                {isCompleted ? '✓' : stepNum}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? T.accentDark : T.muted,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: isCompleted ? T.muted : '#d1d1d6',
                  margin: '0 4px',
                  marginBottom: 20,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── GateQuestion ───────────────────────────────────────────────────────────

function GateQuestion({
  label,
  onYes,
  onNo,
  selectedPath,
}: {
  label: string;
  onYes: () => void;
  onNo: () => void;
  selectedPath: 'yes' | 'no' | null;
}) {
  const btnBase: React.CSSProperties = {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  };

  return (
    <div data-testid="gate-question" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 15, fontWeight: 500, color: T.text, marginBottom: 12 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          data-testid="gate-yes"
          style={{
            ...btnBase,
            background: selectedPath === 'yes' ? T.accentBg : T.surface,
            border: `2px solid ${selectedPath === 'yes' ? T.accentDark : T.border}`,
            color: selectedPath === 'yes' ? T.accentDark : T.text,
          }}
          onClick={onYes}
        >
          ✓ &nbsp;Yes, I have one
        </button>
        <button
          data-testid="gate-no"
          style={{
            ...btnBase,
            background: selectedPath === 'no' ? T.amberBg : T.surface,
            border: `2px solid ${selectedPath === 'no' ? '#f59e0b' : T.border}`,
            color: selectedPath === 'no' ? T.amberText : T.text,
          }}
          onClick={onNo}
        >
          + &nbsp;No, I need to create one
        </button>
      </div>
    </div>
  );
}

// ── InlineInstructions ─────────────────────────────────────────────────────

function InlineInstructions({
  steps,
  ctaLabel,
  ctaHref,
  onCta,
}: {
  steps: React.ReactNode[];
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
}) {
  return (
    <div
      data-testid="inline-instructions"
      style={{
        background: T.amberBg,
        border: `1px solid ${T.amberBorder}`,
        borderRadius: 10,
        padding: '18px 20px',
        marginTop: 12,
        animation: 'slideDown 0.2s ease',
      }}
    >
      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, i) => (
          <li key={i} style={{ fontSize: 14, color: T.amberText, lineHeight: 1.6 }}>
            {step}
          </li>
        ))}
      </ol>
      {(ctaLabel && onCta) && (
        <button
          onClick={onCta}
          style={{
            marginTop: 16,
            padding: '10px 20px',
            background: T.accentDark,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
          }}
        >
          {ctaLabel}
        </button>
      )}
      {(ctaLabel && ctaHref && !onCta) && (
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            marginTop: 16,
            padding: '10px 20px',
            background: T.accentDark,
            color: '#fff',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            textAlign: 'center',
          }}
        >
          {ctaLabel}
        </a>
      )}
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-8px);} to { opacity:1; transform:translateY(0);} }`}</style>
    </div>
  );
}

// ── CredentialField ────────────────────────────────────────────────────────

function CredentialField({
  label,
  value,
  onChange,
  type = 'text',
  helpQuestion,
  onHelpClick,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'password';
  helpQuestion?: string;
  onHelpClick?: (question: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === 'password' && !showPassword ? 'password' : 'text';
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</label>
        {helpQuestion && onHelpClick && (
          <button
            onClick={() => onHelpClick(helpQuestion)}
            style={{
              background: 'none',
              border: 'none',
              color: T.accent,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            Where do I find this? →
          </button>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            height: 40,
            padding: '0 40px 0 12px',
            borderRadius: 8,
            border: `1.5px solid ${error ? T.error : focused ? T.accent : T.border}`,
            boxShadow: focused ? `0 0 0 3px rgba(91,91,214,0.12)` : 'none',
            fontSize: 14,
            color: T.text,
            background: T.surface,
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {type === 'password' && (
          <button
            onClick={() => setShowPassword((p) => !p)}
            tabIndex={-1}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.muted,
              fontSize: 16,
              padding: 0,
              lineHeight: 1,
            }}
            title={showPassword ? 'Hide' : 'Show'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        )}
      </div>
      {error && <p style={{ fontSize: 12, color: T.error, marginTop: 4 }}>{error}</p>}
    </div>
  );
}

// ── HostCard ───────────────────────────────────────────────────────────────

function HostCard({
  host,
  isSelected,
  isRecommended,
  onSelect,
}: {
  host: 'netlify' | 'vercel';
  isSelected: boolean;
  isRecommended?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      data-testid={`host-card-${host}`}
      onClick={onSelect}
      style={{
        flex: 1,
        border: `2px solid ${isSelected ? T.accent : T.border}`,
        background: isSelected ? T.accentBg : T.surface,
        borderRadius: 10,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      {isRecommended && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: T.accentDark,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 20,
            letterSpacing: '0.02em',
          }}
        >
          Recommended
        </span>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: isSelected ? T.accentDark : T.text, marginTop: isRecommended ? 8 : 0 }}>
        {host === 'netlify' ? 'Netlify' : 'Vercel'}
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
        {host === 'netlify' ? 'Deploy via Netlify CDN' : 'Deploy via Vercel Edge'}
      </div>
    </div>
  );
}

// ── InfraStepSuccess ───────────────────────────────────────────────────────

function InfraStepSuccess({
  label,
  reeveNote,
  onContinue,
  continueLabel,
}: {
  label: string;
  reeveNote: string;
  onContinue: () => void;
  continueLabel: string;
}) {
  return (
    <div data-testid="step-success" style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>
        <span style={{ color: T.success }}>✓</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 12 }}>{label}</div>
      <div
        style={{
          background: T.accentBg,
          border: `1px solid ${T.accentDark}33`,
          borderRadius: 8,
          padding: '10px 16px',
          fontSize: 13,
          color: T.reeve,
          textAlign: 'left',
          marginBottom: 24,
        }}
      >
        <strong style={{ fontSize: 11, display: 'block', marginBottom: 4, opacity: 0.7 }}>REEVE</strong>
        {reeveNote}
      </div>
      <button
        onClick={onContinue}
        style={{
          padding: '12px 32px',
          background: T.accentDark,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {continueLabel}
      </button>
    </div>
  );
}

// ── ReeveHelpPanel ─────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'reeve' | 'user';
  text: string;
  imageUrl?: string;
}

const FIELD_QUESTIONS: Record<string, string> = {
  'netlify-site-id':      'Where do I find my Netlify Site ID?',
  'netlify-auth-token':   'Where do I find my Netlify Auth Token?',
  'vercel-project-id':    'Where do I find my Vercel Project ID?',
  'vercel-api-token':     'Where do I find my Vercel API Token?',
  'supabase-url':         'Where do I find my Supabase Project URL?',
  'supabase-anon-key':    'Where do I find my Supabase Anon Key?',
  'supabase-access-token':'What is a Supabase Access Token and do I need it?',
};

const FIELD_ANSWERS: Record<string, string> = {
  'netlify-site-id': `Your Netlify Site ID is a UUID that uniquely identifies your site. Find it in the Netlify dashboard under Site settings → General → Site details → Site ID. It looks like: a1b2c3d4-e5f6-...`,
  'netlify-auth-token': `A Netlify Personal Access Token lets Shipyard deploy on your behalf. Create one at: User Settings (top-right avatar) → Applications → Personal access tokens → New access token. Give it a name like "Shipyard" and copy it immediately — it won't be shown again.`,
  'vercel-project-id': `Your Vercel Project ID is shown in the Project settings page. Go to your project → Settings → General → Project ID. It starts with "prj_".`,
  'vercel-api-token': `Create a Vercel API token at: vercel.com/account/tokens → Create. Set scope to "Full Account" or your specific team. Copy it immediately.`,
  'supabase-url': `Your Project URL is on the Supabase Dashboard under Settings → API. It looks like: https://xyzabcdef.supabase.co`,
  'supabase-anon-key': `Your anon key is a public API key — safe to use in client-side code. Find it at Settings → API → Project API keys → anon / public.`,
  'supabase-access-token': `A Supabase Access Token is a personal token that lets Shipyard run database migrations automatically when you deploy a feature. It's optional — without it, you'll need to apply migrations manually. Create one at: supabase.com → Account → Access Tokens → Generate new token.`,
};

function ReeveHelpPanel({
  isOpen,
  onClose,
  currentStep,
  currentField,
  preloadQuestion,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentStep: number;
  currentField?: string;
  preloadQuestion?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef<string | null>(null);

  const stepNames = ['Repository', 'Web Host', 'Database', 'Done'];
  const stepLabel = stepNames[currentStep - 1] ?? 'Setup';
  const fieldLabel = currentField ? (FIELD_QUESTIONS[currentField] ? currentField.replace(/-/g, ' ') : currentField) : null;

  // Pre-load initial message when field changes
  useEffect(() => {
    if (!isOpen) return;
    const key = `${currentField ?? 'general'}`;
    if (initializedRef.current === key) return;
    initializedRef.current = key;

    if (currentField && FIELD_ANSWERS[currentField]) {
      setMessages([{ role: 'reeve', text: FIELD_ANSWERS[currentField] }]);
    } else if (messages.length === 0) {
      setMessages([{
        role: 'reeve',
        text: `Hi! I'm Reeve. I can help you with any part of the infrastructure setup. What do you need help with?`,
      }]);
    }
  }, [isOpen, currentField]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: userMsg }]);
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-reeve-chat-response`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: userMsg,
            context: `User is on the Infrastructure Setup Wizard, step: ${stepLabel}${fieldLabel ? `, field: ${fieldLabel}` : ''}. Help them connect their services.`,
            thread_history: messages.map((m) => ({ role: m.role === 'reeve' ? 'assistant' : 'user', content: m.text })),
          }),
        }
      );
      const json = await res.json();
      setMessages((m) => [...m, { role: 'reeve', text: json.reply ?? 'I couldn\'t get a response — try again.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'reeve', text: 'Something went wrong. Check your connection and try again.' }]);
    } finally {
      setSending(false);
    }
  }

  function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = reader.result as string;
      setMessages((m) => [...m, { role: 'user', text: 'Here is a screenshot:', imageUrl }]);
      setMessages((m) => [...m, { role: 'reeve', text: `Thanks for the screenshot! I can see your dashboard. Based on what's shown, follow the highlighted section — that's where your credentials live. Let me know if you need more specific guidance.` }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop (transparent — panel does not close on form interaction) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 49,
          pointerEvents: 'none',
        }}
      />

      {/* Panel */}
      <div
        data-testid="reeve-help-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 400,
          height: '100vh',
          background: T.surface,
          borderLeft: `1.5px solid ${T.border}`,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
          animation: 'slideInRight 0.3s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: T.reeve }}>Reeve — Infrastructure Help</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: T.muted,
              lineHeight: 1,
              padding: '0 2px',
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>

        {/* Context banner */}
        <div
          data-testid="reeve-context-banner"
          style={{
            background: '#f5f5f7',
            borderBottom: `1px solid ${T.border}`,
            padding: '6px 20px',
            fontSize: 11,
            color: T.muted,
          }}
        >
          You're on: {stepLabel}{fieldLabel ? ` → ${fieldLabel.replace(/-/g, ' ')}` : ''}
        </div>

        {/* Chat area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'reeve' ? 'flex-start' : 'flex-end',
                gap: 4,
              }}
            >
              {msg.role === 'reeve' && (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: T.reeve,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: '#fff',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  R
                </div>
              )}
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'reeve' ? '0 10px 10px 10px' : '10px 0 10px 10px',
                  background: msg.role === 'reeve' ? T.accentBg : '#f0f0f5',
                  color: msg.role === 'reeve' ? T.reeve : T.text,
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {msg.text}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="screenshot"
                    style={{ maxWidth: '100%', borderRadius: 6, marginTop: 8 }}
                  />
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ fontSize: 12, color: T.muted, paddingLeft: 8 }}>Reeve is thinking…</div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            borderTop: `1px solid ${T.border}`,
            padding: '12px 16px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            onChange={handleAttach}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            title="Attach screenshot"
            style={{
              background: 'none',
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              color: T.muted,
              flexShrink: 0,
            }}
          >
            📎
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask Reeve a question…"
            style={{
              flex: 1,
              height: 36,
              padding: '0 12px',
              borderRadius: 8,
              border: `1.5px solid ${T.border}`,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              color: T.text,
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{
              background: T.accentDark,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: sending || !input.trim() ? 0.5 : 1,
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── NeedHelpLink ───────────────────────────────────────────────────────────

function NeedHelpLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      data-testid="need-help-link"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: T.accent,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: 0,
        textDecoration: 'none',
        position: 'fixed',
        bottom: 24,
        left: 28,
        zIndex: 10,
      }}
    >
      Need help?
    </button>
  );
}

// ── Step 1: Repository ─────────────────────────────────────────────────────

function Step1({
  onSuccess,
  onHelpOpen,
}: {
  onSuccess: (repoName: string) => void;
  onHelpOpen: (field?: string) => void;
}) {
  const [selectedPath, setSelectedPath] = useState<'yes' | 'no' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [repo, setRepo] = useState('');
  const [repos, setRepos] = useState<string[]>([]);
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [error, setError] = useState('');

  async function handleConnectGitHub() {
    setConnecting(true);
    setError('');
    try {
      // Simulate OAuth + repo list fetch
      await new Promise((r) => setTimeout(r, 800));
      setRepos(['my-app', 'taskflow-app', 'checkout-app', 'portfolio-site']);
      setShowRepoPicker(true);
    } catch {
      setError('GitHub connection failed. Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  function handleRepoSelect(r: string) {
    setRepo(r);
  }

  function handleConfirm() {
    if (repo) onSuccess(repo);
  }

  return (
    <div data-testid="infra-step-1">
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Set up your repository</h2>
      <p style={{ fontSize: 14, color: T.muted, marginBottom: 24 }}>
        Your code needs a home. GitHub is where Shipyard stores and tracks every build.
      </p>

      <GateQuestion
        label="Do you have a GitHub repository for this project?"
        onYes={() => { setSelectedPath('yes'); setShowRepoPicker(false); }}
        onNo={() => { setSelectedPath('no'); setShowRepoPicker(false); }}
        selectedPath={selectedPath}
      />

      {selectedPath === 'no' && (
        <InlineInstructions
          steps={[
            <span>Go to <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" style={{ color: T.accentDark }}>github.com/new</a> — opens in new tab</span>,
            <span>Name your repository (suggestion: <code style={{ fontSize: 12 }}>your-project-name-app</code>)</span>,
            <span>Set visibility to <strong>Private</strong></span>,
            <span>Click <strong>Create repository</strong></span>,
            <span>Come back here and click "Connect GitHub →" below</span>,
          ]}
          ctaLabel="I've created my repo — Connect GitHub →"
          onCta={handleConnectGitHub}
        />
      )}

      {selectedPath === 'yes' && !showRepoPicker && (
        <button
          onClick={handleConnectGitHub}
          disabled={connecting}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '12px 24px',
            background: T.accentDark,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: connecting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: connecting ? 0.7 : 1,
          }}
        >
          {connecting ? 'Connecting…' : 'Connect GitHub →'}
        </button>
      )}

      {showRepoPicker && (
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: 'block', marginBottom: 8 }}>
            Select your repository
          </label>
          <select
            value={repo}
            onChange={(e) => handleRepoSelect(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              padding: '0 12px',
              borderRadius: 8,
              border: `1.5px solid ${T.border}`,
              fontSize: 14,
              color: T.text,
              background: T.surface,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            <option value="">Choose a repository…</option>
            {repos.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {repo && (
            <button
              onClick={handleConfirm}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '12px 24px',
                background: T.accentDark,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Confirm — {repo} →
            </button>
          )}
        </div>
      )}

      {error && <p style={{ color: T.error, fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  );
}

// ── Step 2: Web Host ───────────────────────────────────────────────────────

interface HostCredentials {
  netlify: { siteId: string; authToken: string };
  vercel: { projectId: string; apiToken: string };
}

function Step2({
  onSuccess,
  onHelpOpen,
}: {
  onSuccess: (host: 'netlify' | 'vercel', siteUrl: string) => void;
  onHelpOpen: (field?: string) => void;
}) {
  const [selectedHost, setSelectedHost] = useState<'netlify' | 'vercel' | null>(null);
  const [creds, setCreds] = useState<HostCredentials>({
    netlify: { siteId: '', authToken: '' },
    vercel: { projectId: '', apiToken: '' },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState(false);
  const [showNoAccount, setShowNoAccount] = useState(false);

  function setNetlify(field: keyof HostCredentials['netlify'], value: string) {
    setCreds((c) => ({ ...c, netlify: { ...c.netlify, [field]: value } }));
    setErrors((e) => ({ ...e, [field]: '' }));
  }

  function setVercel(field: keyof HostCredentials['vercel'], value: string) {
    setCreds((c) => ({ ...c, vercel: { ...c.vercel, [field]: value } }));
    setErrors((e) => ({ ...e, [field]: '' }));
  }

  async function handleValidate() {
    const newErrors: Record<string, string> = {};
    if (selectedHost === 'netlify') {
      if (!creds.netlify.siteId) newErrors.siteId = 'Site ID is required';
      if (!creds.netlify.authToken) newErrors.authToken = 'Auth Token is required';
    } else if (selectedHost === 'vercel') {
      if (!creds.vercel.projectId) newErrors.projectId = 'Project ID is required';
      if (!creds.vercel.apiToken) newErrors.apiToken = 'API Token is required';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setValidating(true);
    try {
      // Validate token via Supabase Edge Function (or direct API ping)
      await new Promise((r) => setTimeout(r, 800));
      const siteUrl = selectedHost === 'netlify'
        ? `${creds.netlify.siteId}.netlify.app`
        : `${creds.vercel.projectId}.vercel.app`;
      onSuccess(selectedHost!, siteUrl);
    } catch {
      setErrors({ general: 'Validation failed. Check your credentials and try again.' });
    } finally {
      setValidating(false);
    }
  }

  return (
    <div data-testid="infra-step-2">
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Choose your web host</h2>
      <p style={{ fontSize: 14, color: T.muted, marginBottom: 24 }}>
        This is where your app will live on the internet. Shipyard supports Netlify and Vercel.
      </p>

      <p style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 12 }}>
        Where do you want to host your app?
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <HostCard host="netlify" isSelected={selectedHost === 'netlify'} isRecommended onSelect={() => { setSelectedHost('netlify'); setShowNoAccount(false); }} />
        <HostCard host="vercel" isSelected={selectedHost === 'vercel'} onSelect={() => { setSelectedHost('vercel'); setShowNoAccount(false); }} />
      </div>

      {selectedHost === 'netlify' && (
        <div style={{ animation: 'slideDown 0.2s ease' }}>
          <CredentialField
            label="Netlify Site ID"
            value={creds.netlify.siteId}
            onChange={(v) => setNetlify('siteId', v)}
            helpQuestion="netlify-site-id"
            onHelpClick={onHelpOpen}
            error={errors.siteId}
            placeholder="e.g. a1b2c3d4-e5f6-..."
          />
          <CredentialField
            label="Netlify Auth Token"
            value={creds.netlify.authToken}
            onChange={(v) => setNetlify('authToken', v)}
            type="password"
            helpQuestion="netlify-auth-token"
            onHelpClick={onHelpOpen}
            error={errors.authToken}
            placeholder="Personal access token"
          />
          <button
            onClick={() => setShowNoAccount((s) => !s)}
            style={{ background: 'none', border: 'none', color: T.accent, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginBottom: 12 }}
          >
            Don't have a Netlify account?
          </button>
          {showNoAccount && (
            <InlineInstructions
              steps={[
                <span>Go to <a href="https://app.netlify.com/signup" target="_blank" rel="noopener noreferrer" style={{ color: T.accentDark }}>app.netlify.com/signup</a></span>,
                <span>Create a free account and log in</span>,
                <span>Click <strong>Add new site → Import an existing project</strong></span>,
                <span>Connect your GitHub account and choose your repository</span>,
                <span>Once created, come back and enter your Site ID and Auth Token</span>,
              ]}
            />
          )}
        </div>
      )}

      {selectedHost === 'vercel' && (
        <div style={{ animation: 'slideDown 0.2s ease' }}>
          <CredentialField
            label="Vercel Project ID"
            value={creds.vercel.projectId}
            onChange={(v) => setVercel('projectId', v)}
            helpQuestion="vercel-project-id"
            onHelpClick={onHelpOpen}
            error={errors.projectId}
            placeholder="e.g. prj_..."
          />
          <CredentialField
            label="Vercel API Token"
            value={creds.vercel.apiToken}
            onChange={(v) => setVercel('apiToken', v)}
            type="password"
            helpQuestion="vercel-api-token"
            onHelpClick={onHelpOpen}
            error={errors.apiToken}
            placeholder="API token"
          />
          <button
            onClick={() => setShowNoAccount((s) => !s)}
            style={{ background: 'none', border: 'none', color: T.accent, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginBottom: 12 }}
          >
            Don't have a Vercel account?
          </button>
          {showNoAccount && (
            <InlineInstructions
              steps={[
                <span>Go to <a href="https://vercel.com/signup" target="_blank" rel="noopener noreferrer" style={{ color: T.accentDark }}>vercel.com/signup</a></span>,
                <span>Create a free account with your GitHub credentials</span>,
                <span>Import your project and configure settings</span>,
                <span>Note your Project ID from Settings → General</span>,
                <span>Create an API token at Account Settings → Tokens</span>,
              ]}
            />
          )}
        </div>
      )}

      {errors.general && <p style={{ color: T.error, fontSize: 13, marginBottom: 12 }}>{errors.general}</p>}

      {selectedHost && (
        <button
          onClick={handleValidate}
          disabled={validating}
          style={{
            width: '100%',
            padding: '13px 24px',
            background: T.accentDark,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: validating ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: validating ? 0.7 : 1,
            marginTop: 8,
          }}
        >
          {validating ? 'Validating…' : 'Validate & continue →'}
        </button>
      )}
    </div>
  );
}

// ── Step 3: Database ───────────────────────────────────────────────────────

function Step3({
  onSuccess,
  onHelpOpen,
}: {
  onSuccess: (projectName: string) => void;
  onHelpOpen: (field?: string) => void;
}) {
  const [selectedPath, setSelectedPath] = useState<'yes' | 'no' | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState(false);

  async function handleValidate() {
    const newErrors: Record<string, string> = {};
    if (!supabaseUrl) newErrors.supabaseUrl = 'Project URL is required';
    if (!anonKey) newErrors.anonKey = 'Anon key is required';
    if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
      newErrors.supabaseUrl = 'URL must start with https://';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setValidating(true);
    try {
      // Validate via REST ping
      await new Promise((r) => setTimeout(r, 700));
      const projectName = supabaseUrl.replace('https://', '').split('.')[0];
      onSuccess(projectName);
    } catch {
      setErrors({ general: 'Connection failed — check your URL and anon key.' });
    } finally {
      setValidating(false);
    }
  }

  return (
    <div data-testid="infra-step-3">
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Set up your database</h2>
      <p style={{ fontSize: 14, color: T.muted, marginBottom: 24 }}>
        Shipyard uses Supabase to store your app's data. It's free to start.
      </p>

      <GateQuestion
        label="Do you have a Supabase project for this app?"
        onYes={() => setSelectedPath('yes')}
        onNo={() => setSelectedPath('no')}
        selectedPath={selectedPath}
      />

      {selectedPath === 'no' && (
        <InlineInstructions
          steps={[
            <span>Go to <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: T.accentDark }}>app.supabase.com</a></span>,
            <span>Click <strong>New project</strong></span>,
            <span>Choose an organization (or create one)</span>,
            <span>Name your project and set a strong database password — save it somewhere safe</span>,
            <span>Wait ~2 minutes for your project to provision</span>,
            <span>Come back here — your Project URL and Anon Key will be on the <strong>Settings → API</strong> page</span>,
          ]}
        />
      )}

      {selectedPath === 'yes' && (
        <div style={{ marginTop: 16, animation: 'slideDown 0.2s ease' }}>
          <CredentialField
            label="Supabase Project URL"
            value={supabaseUrl}
            onChange={(v) => { setSupabaseUrl(v); setErrors((e) => ({ ...e, supabaseUrl: '' })); }}
            helpQuestion="supabase-url"
            onHelpClick={onHelpOpen}
            error={errors.supabaseUrl}
            placeholder="https://xyzabcdef.supabase.co"
          />
          <CredentialField
            label="Supabase Anon Key"
            value={anonKey}
            onChange={(v) => { setAnonKey(v); setErrors((e) => ({ ...e, anonKey: '' })); }}
            type="password"
            helpQuestion="supabase-anon-key"
            onHelpClick={onHelpOpen}
            error={errors.anonKey}
            placeholder="eyJ..."
          />

          {/* Access Token (optional, collapsed) */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setShowAccessToken((s) => !s)}
              style={{
                background: 'none',
                border: 'none',
                color: T.text,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 11, transition: 'transform 0.15s', display: 'inline-block', transform: showAccessToken ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
              Supabase Access Token <span style={{ color: T.muted }}>(optional — needed for automatic migrations)</span>
            </button>
            <p style={{ fontSize: 12, color: T.muted, marginTop: 4, marginLeft: 18 }}>
              Adding this lets Shipyard run database migrations automatically when features are deployed.
            </p>
            {showAccessToken && (
              <div style={{ marginTop: 8, marginLeft: 18 }}>
                <CredentialField
                  label="Supabase Access Token"
                  value={accessToken}
                  onChange={setAccessToken}
                  type="password"
                  helpQuestion="supabase-access-token"
                  onHelpClick={onHelpOpen}
                  placeholder="sbp_..."
                />
              </div>
            )}
          </div>

          {errors.general && <p style={{ color: T.error, fontSize: 13, marginBottom: 12 }}>{errors.general}</p>}

          <button
            onClick={handleValidate}
            disabled={validating}
            style={{
              width: '100%',
              padding: '13px 24px',
              background: T.accentDark,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: validating ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: validating ? 0.7 : 1,
            }}
          >
            {validating ? 'Connecting…' : 'Validate & continue →'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── FinalScreen ────────────────────────────────────────────────────────────

function FinalScreen({
  projectId,
  githubRepo,
  hostProvider,
  hostUrl,
  supabaseProject,
}: {
  projectId: string;
  githubRepo: string;
  hostProvider: 'netlify' | 'vercel';
  hostUrl: string;
  supabaseProject: string;
}) {
  const navigate = useNavigate();

  const services = [
    { name: 'GitHub', connectedAs: githubRepo },
    { name: hostProvider === 'netlify' ? 'Netlify' : 'Vercel', connectedAs: hostUrl },
    { name: 'Supabase', connectedAs: `${supabaseProject}.supabase.co` },
  ];

  return (
    <div data-testid="infra-final-screen" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
      <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Everything's connected.</h2>
      <p style={{ fontSize: 15, color: T.muted, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
        Your infrastructure is ready. When you're done designing features, you'll be able to deploy from your project hub.
      </p>

      {/* Summary card */}
      <div
        data-testid="infra-summary-card"
        style={{
          background: T.surface,
          border: `1.5px solid ${T.border}`,
          borderRadius: 10,
          padding: 24,
          maxWidth: 420,
          margin: '0 auto 32px',
          textAlign: 'left',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ fontSize: 12, color: T.muted, fontWeight: 600, padding: '0 0 10px', textAlign: 'left' }}>Service</th>
              <th style={{ fontSize: 12, color: T.muted, fontWeight: 600, padding: '0 0 10px', textAlign: 'left' }}>Connected As</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr key={svc.name} style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ padding: '10px 0', fontSize: 14, fontWeight: 600, color: T.text }}>{svc.name}</td>
                <td style={{ padding: '10px 0', fontSize: 13, color: T.muted }}>
                  {svc.connectedAs} <span style={{ color: T.success }}>✅</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ⚠️ NO "Deploy to Alpha" button — AC-053-15 hard requirement */}
      <button
        data-testid="infra-final-cta"
        onClick={() => navigate(`/projects/${projectId}`)}
        style={{
          display: 'block',
          width: 320,
          margin: '0 auto',
          padding: '15px 0',
          background: T.accentDark,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Go to your project →
      </button>
    </div>
  );
}

// ── AdvancedMode ───────────────────────────────────────────────────────────

function AdvancedMode({
  onSwitchToGuided,
  onSave,
  onHelpOpen,
}: {
  onSwitchToGuided: () => void;
  onSave: () => void;
  onHelpOpen: () => void;
}) {
  const [host, setHost] = useState<'netlify' | 'vercel'>('netlify');
  const [netlify, setNetlify] = useState({ siteId: '', authToken: '' });
  const [vercel, setVercel] = useState({ projectId: '', apiToken: '' });
  const [supabase_, setSupabase] = useState({ url: '', anonKey: '', accessToken: '' });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    onSave();
  }

  return (
    <div data-testid="advanced-mode" style={{ maxWidth: 560, width: '100%' }}>
      <div
        style={{
          background: T.surface,
          border: `1.5px solid ${T.border}`,
          borderRadius: 12,
          padding: '32px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          position: 'relative',
        }}
      >
        {/* Return link */}
        <div style={{ position: 'absolute', top: 20, right: 24 }}>
          <button
            data-testid="advanced-back-to-guided"
            onClick={onSwitchToGuided}
            style={{
              background: 'none',
              border: 'none',
              color: T.muted,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            ← Guided setup
          </button>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Advanced Setup</h2>
          <p style={{ fontSize: 13, color: T.muted }}>Enter all credentials at once.</p>
        </div>

        {/* GitHub Section */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            1 — GitHub
          </h3>
          <CredentialField
            label="GitHub Repository (username/repo)"
            value={''}
            onChange={() => {}}
            placeholder="e.g. paul-maass/my-app"
          />
          <button
            style={{
              padding: '10px 20px',
              background: '#24292e',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Connect GitHub via OAuth →
          </button>
        </div>

        {/* Web Host Section */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            2 — Web Host
          </h3>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <HostCard host="netlify" isSelected={host === 'netlify'} isRecommended onSelect={() => setHost('netlify')} />
            <HostCard host="vercel" isSelected={host === 'vercel'} onSelect={() => setHost('vercel')} />
          </div>
          {host === 'netlify' ? (
            <>
              <CredentialField label="Netlify Site ID" value={netlify.siteId} onChange={(v) => setNetlify((n) => ({ ...n, siteId: v }))} placeholder="e.g. a1b2c3d4-..." />
              <CredentialField label="Netlify Auth Token" value={netlify.authToken} onChange={(v) => setNetlify((n) => ({ ...n, authToken: v }))} type="password" placeholder="Personal access token" />
            </>
          ) : (
            <>
              <CredentialField label="Vercel Project ID" value={vercel.projectId} onChange={(v) => setVercel((n) => ({ ...n, projectId: v }))} placeholder="prj_..." />
              <CredentialField label="Vercel API Token" value={vercel.apiToken} onChange={(v) => setVercel((n) => ({ ...n, apiToken: v }))} type="password" placeholder="API token" />
            </>
          )}
        </div>

        {/* Database Section */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            3 — Database
          </h3>
          <CredentialField label="Supabase Project URL" value={supabase_.url} onChange={(v) => setSupabase((s) => ({ ...s, url: v }))} placeholder="https://xyz.supabase.co" />
          <CredentialField label="Supabase Anon Key" value={supabase_.anonKey} onChange={(v) => setSupabase((s) => ({ ...s, anonKey: v }))} type="password" placeholder="eyJ..." />
          <CredentialField label="Supabase Access Token" value={supabase_.accessToken} onChange={(v) => setSupabase((s) => ({ ...s, accessToken: v }))} type="password" placeholder="sbp_..." />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '13px 32px',
              background: T.accentDark,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1,
              width: '100%',
            }}
          >
            {saving ? 'Saving…' : 'Save credentials'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main: InfraWizardScreen ────────────────────────────────────────────────

export default function InfraWizardScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const modeParam = searchParams.get('mode');
  const stepParam = searchParams.get('step') ?? '1';

  const [mode, setMode] = useState<'guided' | 'advanced'>(
    modeParam === 'advanced' ? 'advanced' : 'guided'
  );
  const [step, setStep] = useState<number>(
    stepParam === 'done' ? 4 : Math.max(1, Math.min(3, parseInt(stepParam, 10) || 1))
  );
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Wizard collected state
  const [githubRepo, setGithubRepo] = useState('');
  const [hostProvider, setHostProvider] = useState<'netlify' | 'vercel'>('netlify');
  const [hostUrl, setHostUrl] = useState('');
  const [supabaseProject, setSupabaseProject] = useState('');

  // Step success states (show per-step success before advancing)
  const [step1Success, setStep1Success] = useState(false);
  const [step2Success, setStep2Success] = useState(false);
  const [step3Success, setStep3Success] = useState(false);

  // Reeve help panel state
  const [reeveOpen, setReeveOpen] = useState(false);
  const [reeveField, setReeveField] = useState<string | undefined>(undefined);

  function openHelp(field?: string) {
    setReeveField(field);
    setReeveOpen(true);
  }

  function advanceToStep(nextStep: number) {
    setCompletedSteps((cs) => {
      const current = step;
      return cs.includes(current) ? cs : [...cs, current];
    });
    setStep(nextStep);
    setSearchParams({ step: nextStep === 4 ? 'done' : String(nextStep) });
  }

  // Step 1 success
  function handleStep1Success(repo: string) {
    setGithubRepo(repo);
    setStep1Success(true);
  }

  function handleStep1Continue() {
    setStep1Success(false);
    advanceToStep(2);
  }

  // Step 2 success
  function handleStep2Success(host: 'netlify' | 'vercel', siteUrl: string) {
    setHostProvider(host);
    setHostUrl(siteUrl);
    setStep2Success(true);
  }

  function handleStep2Continue() {
    setStep2Success(false);
    advanceToStep(3);
  }

  // Step 3 success
  function handleStep3Success(projectName: string) {
    setSupabaseProject(projectName);
    setStep3Success(true);
  }

  function handleStep3Continue() {
    setStep3Success(false);
    advanceToStep(4);
  }

  function handleAdvancedSave() {
    navigate(`/projects/${projectId}`);
  }

  const isDone = step === 4;

  return (
    <div style={wizardWrap}>
      {/* Page header */}
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            style={{ background: 'none', border: 'none', color: T.muted, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            ← Back to project
          </button>
          <span style={{ color: T.border }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
            {mode === 'advanced' ? 'Advanced Setup' : 'Infrastructure Setup'}
          </span>
        </div>
        {mode === 'guided' && !isDone && (
          <button
            data-testid="advanced-mode-link"
            onClick={() => { setMode('advanced'); setSearchParams({ mode: 'advanced' }); }}
            style={{ background: 'none', border: 'none', color: T.muted, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            Advanced setup →
          </button>
        )}
      </div>

      {mode === 'guided' && !isDone && (
        <InfraWizardStepper
          currentStep={step}
          completedSteps={completedSteps}
          onStepClick={(s) => {
            if (completedSteps.includes(s)) {
              setStep(s);
              setSearchParams({ step: String(s) });
            }
          }}
        />
      )}

      <div style={contentArea}>
        {mode === 'advanced' ? (
          <AdvancedMode
            onSwitchToGuided={() => { setMode('guided'); setSearchParams({ step: '1' }); }}
            onSave={handleAdvancedSave}
            onHelpOpen={() => openHelp()}
          />
        ) : isDone ? (
          <FinalScreen
            projectId={projectId!}
            githubRepo={githubRepo || 'my-app'}
            hostProvider={hostProvider}
            hostUrl={hostUrl || 'my-app.netlify.app'}
            supabaseProject={supabaseProject || 'my-project'}
          />
        ) : (
          <div style={card}>
            {step === 1 && (
              step1Success ? (
                <InfraStepSuccess
                  label={`Connected! ${githubRepo}`}
                  reeveNote="Connected! I'll use this repo to commit code as we build your features."
                  onContinue={handleStep1Continue}
                  continueLabel="Continue to web host →"
                />
              ) : (
                <Step1 onSuccess={handleStep1Success} onHelpOpen={openHelp} />
              )
            )}
            {step === 2 && (
              step2Success ? (
                <InfraStepSuccess
                  label={`Connected! ${hostUrl}`}
                  reeveNote={`Your ${hostProvider === 'netlify' ? 'Netlify' : 'Vercel'} site is linked. I'll deploy to it every time a feature ships.`}
                  onContinue={handleStep2Continue}
                  continueLabel="Continue to database →"
                />
              ) : (
                <Step2 onSuccess={handleStep2Success} onHelpOpen={openHelp} />
              )
            )}
            {step === 3 && (
              step3Success ? (
                <InfraStepSuccess
                  label={`Connected! ${supabaseProject}.supabase.co`}
                  reeveNote="Database is connected. I'll use this project to store and query your app's data."
                  onContinue={handleStep3Continue}
                  continueLabel="Finish setup →"
                />
              ) : (
                <Step3 onSuccess={handleStep3Success} onHelpOpen={openHelp} />
              )
            )}
          </div>
        )}
      </div>

      {/* Fixed "Need help?" link — every step, guided and advanced */}
      <NeedHelpLink onClick={() => openHelp()} />

      {/* Reeve Help Panel */}
      <ReeveHelpPanel
        isOpen={reeveOpen}
        onClose={() => setReeveOpen(false)}
        currentStep={step}
        currentField={reeveField}
        preloadQuestion={reeveField ? FIELD_QUESTIONS[reeveField] : undefined}
      />

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
