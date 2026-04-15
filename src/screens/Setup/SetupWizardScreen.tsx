/**
 * SetupWizardScreen — Build 065: Brief-First Onboarding
 *
 * Routes: /wizard/new or /projects/:id/wizard
 *
 * Replaces the old 5-screen wizard (Build 032) with a 2-screen flow:
 *   Screen 1 — Brief: "Tell me what you're building"
 *     Reeve avatar, 4-row textarea, optional file upload, "Let's go →"
 *     On submit: save description → fire-and-forget extract-features-from-brief
 *     + generate-wizard-defaults → show loading state → go to Screen 2
 *
 *   Screen 2 — Design Kickoff: "Let's set the visual direction."
 *     Vibe chips (max 2), inspiration URLs (up to 3), screen checklist (2-col)
 *     "Set up my project →" → /projects/:id/triage
 *     "Skip for now" → /projects/:id (Project Hub)
 *     Back button → Screen 1
 *
 * What was retired:
 *   - Product name field (Screen 1) — captured at project creation
 *   - Audience type chip selector (Screen 2)
 *   - Monetization type picker (Screen 3)
 *   - Document category upload screen (Screen 4)
 *   - Completion screen with pulse animation (Screen 5)
 *   - "Set up infrastructure" as a wizard CTA (moved to hub)
 *
 * Styling:
 *   - Inline styles only (no Tailwind)
 *   - Mobile responsive (max-width: 540px content)
 *   - Light theme (design token object T)
 *
 * Draft persistence (Build 064 pattern):
 *   - Key: shipyard_setup_wizard_draft_${projectId}
 *   - Stores: s1 (brief text) and s2 (vibes, urls)
 *   - Cleared on successful completion
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate }       from 'react-router-dom';
import { useToast }                     from '@/context/ToastContext';
import {
  saveBrief,
  triggerExtractFeatures,
  triggerWizardDefaults,
  saveDesignKickoff,
} from '@/api/wizard';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

// ── Draft persistence (Build 064 pattern) ────────────────────────────────────

interface SetupWizardDraft {
  s1?: { brief: string };
  s2?: { vibes: string[]; inspirationUrls: string[] };
}

function getSetupDraftKey(projectId: string) {
  return `shipyard_setup_wizard_draft_${projectId}`;
}

function readSetupDraft(projectId: string): SetupWizardDraft {
  try {
    const raw = localStorage.getItem(getSetupDraftKey(projectId));
    return raw ? (JSON.parse(raw) as SetupWizardDraft) : {};
  } catch {
    return {};
  }
}

function writeSetupDraft(projectId: string, patch: Partial<SetupWizardDraft>): void {
  try {
    const current = readSetupDraft(projectId);
    localStorage.setItem(getSetupDraftKey(projectId), JSON.stringify({ ...current, ...patch }));
  } catch {
    // Storage quota exceeded — ignore silently
  }
}

function clearSetupDraft(projectId: string): void {
  try {
    localStorage.removeItem(getSetupDraftKey(projectId));
  } catch {}
}

// ── Design Tokens ─────────────────────────────────────────────────────────────

const T = {
  accent:      '#5b5bd6',
  accentHover: '#4f4fbf',
  bg:          '#f5f5f7',
  surface:     '#ffffff',
  border:      '#e5e5ea',
  text:        '#1c1c1e',
  muted:       '#6e6e73',
  faint:       '#aeaeb2',
  success:     '#34c759',
  red:         '#ff3b30',
};

// ── Shared layout styles ──────────────────────────────────────────────────────

const screenStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  paddingBottom: 32,
};

const contentStyle: React.CSSProperties = {
  maxWidth: 540,
  margin: '0 auto',
  padding: '0 24px',
};

const headlineStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  color: T.text,
  margin: '0 0 8px',
};

const subheadStyle: React.CSSProperties = {
  fontSize: 15,
  color: T.muted,
  lineHeight: 1.5,
  margin: '0 0 28px',
};

// ── Vibe chips data ───────────────────────────────────────────────────────────

const VIBE_CHIPS = [
  { slug: 'minimal',      label: 'Minimal & clean' },
  { slug: 'bold',         label: 'Bold & expressive' },
  { slug: 'professional', label: 'Professional & serious' },
  { slug: 'warm',         label: 'Warm & friendly' },
  { slug: 'playful',      label: 'Playful & fun' },
  { slug: 'elegant',      label: 'Elegant & premium' },
] as const;

// ── Screen checklist data (V1: hardcoded; will use generate-screen-suggestions in V2) ──

const SCREEN_OPTIONS = [
  'Dashboard',
  'Sign In',
  'Settings',
  'User Profile',
  'Onboarding',
  'Admin Panel',
];

// ── Reeve avatar ──────────────────────────────────────────────────────────────

function ReeveAvatar({ size = 56, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {pulse && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: -16,
              borderRadius: '50%',
              background: `${T.accent}18`,
              animation: 'pulse-ring 2s ease-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              background: `${T.accent}14`,
              animation: 'pulse-ring 2s ease-out 0.4s infinite',
            }}
          />
        </>
      )}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: `linear-gradient(135deg, ${T.accent} 0%, #7c7ce0 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.45,
          boxShadow: `0 4px 20px ${T.accent}33`,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        ✦
      </div>
    </div>
  );
}

// ── Screen 1: Brief ───────────────────────────────────────────────────────────

function ScreenBrief({
  projectId,
  onNext,
}: {
  projectId: string;
  onNext: (brief: string) => Promise<void>;
}) {
  const [brief, setBrief] = useState<string>(() => {
    const draft = readSetupDraft(projectId);
    return draft.s1?.brief ?? '';
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const fileInputRef          = useRef<HTMLInputElement>(null);
  const textareaRef           = useRef<HTMLTextAreaElement>(null);

  // Persist draft on brief change
  useEffect(() => {
    writeSetupDraft(projectId, { s1: { brief } });
  }, [brief, projectId]);

  async function handleSubmit() {
    const trimmed = brief.trim();
    if (!trimmed) {
      setError('Tell us a bit about your product first.');
      textareaRef.current?.focus();
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onNext(trimmed);
    } catch (err) {
      setError(extractErrorMessage(err, 'Save failed — please try again.'));
      setSaving(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setUploadedFile(file);
    // For .txt and .md files, read the content and append to brief
    if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (text) {
          setBrief(prev => prev ? `${prev}\n\n${text}` : text);
        }
      };
      reader.readAsText(file);
    }
  }

  return (
    <div data-testid="wizard-screen-brief" style={screenStyle}>
      <div style={contentStyle}>
        {/* Reeve intro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <ReeveAvatar size={52} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.accent, marginBottom: 2 }}>
              Reeve
            </div>
            <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.4 }}>
              I'll read your brief and get the team started.
            </div>
          </div>
        </div>

        <h1 style={headlineStyle}>Tell me what you're building.</h1>
        <p style={subheadStyle}>
          Describe your product — or upload a brief below.
        </p>

        {/* Brief textarea */}
        <textarea
          ref={textareaRef}
          data-testid="wizard-brief-textarea"
          value={brief}
          onChange={e => setBrief(e.target.value)}
          placeholder="What does it do, who's it for, what problem does it fix?"
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px 16px',
            fontSize: 14,
            lineHeight: 1.6,
            color: T.text,
            background: T.surface,
            border: `1.5px solid ${T.border}`,
            borderRadius: 10,
            resize: 'vertical',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.15s',
            marginBottom: 12,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = T.accent; }}
          onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
        />

        {/* File upload row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 28,
          }}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              border: `1.5px solid ${T.border}`,
              color: T.muted,
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = T.accent;
              e.currentTarget.style.color = T.accent;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.color = T.muted;
            }}
          >
            📎 Upload brief
          </button>
          <span style={{ fontSize: 11, color: T.faint }}>
            {uploadedFile
              ? uploadedFile.name
              : 'PDF, DOCX, or TXT · optional'}
          </span>
          {uploadedFile && (
            <button
              onClick={() => {
                setUploadedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: T.faint,
                fontSize: 14,
                padding: '2px 4px',
                lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.docx,.doc,.txt,.text"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {error && (
          <p style={{ color: T.red, fontSize: 13, margin: '0 0 16px' }}>{error}</p>
        )}

        {/* CTA */}
        <button
          data-testid="wizard-brief-submit"
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: '100%',
            height: 48,
            fontSize: 16,
            fontWeight: 600,
            background: saving ? T.faint : T.accent,
            color: 'white',
            border: 'none',
            borderRadius: 10,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving…' : 'Let\'s go →'}
        </button>
      </div>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────

function ScreenLoading() {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    { label: 'Brief received',       done: true  },
    { label: 'Extracting features',  done: false },
    { label: 'Suggesting screens',   done: false },
  ];

  useEffect(() => {
    const timers = [
      setTimeout(() => setStepIndex(1), 800),
      setTimeout(() => setStepIndex(2), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      data-testid="wizard-screen-loading"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        minHeight: 360,
      }}
    >
      <ReeveAvatar size={80} pulse />

      <div style={{ marginTop: 32, fontSize: 24, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', marginBottom: 32 }}>
        Reading your brief…
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 320 }}>
        {steps.map((step, i) => {
          const isDone    = i < stepIndex;
          const isActive  = i === stepIndex;
          const isPending = i > stepIndex;

          return (
            <div
              key={step.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: isPending ? 0.35 : 1,
                transition: 'opacity 0.4s',
              }}
            >
              {/* Status indicator */}
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isDone
                    ? T.success
                    : isActive
                    ? T.accent
                    : T.border,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.3s',
                  fontSize: 11,
                  color: 'white',
                  fontWeight: 700,
                }}
              >
                {isDone ? '✓' : isActive ? (
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'white', animation: 'blink 1s ease-in-out infinite' }} />
                ) : null}
              </div>
              <span style={{ fontSize: 14, color: isDone ? T.success : isActive ? T.text : T.muted, fontWeight: isDone || isActive ? 600 : 400, transition: 'all 0.3s' }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.9); opacity: 0.7; }
          70%  { transform: scale(1.2); opacity: 0; }
          100% { transform: scale(1.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Screen 2: Design Kickoff ──────────────────────────────────────────────────

function ScreenDesignKickoff({
  projectId,
  onComplete,
  onSkip,
}: {
  projectId:  string;
  onComplete: (vibes: string[], urls: string[]) => Promise<void>;
  onSkip:     () => void;
}) {
  const draft = readSetupDraft(projectId);

  const [selectedVibes,     setSelectedVibes]     = useState<string[]>(draft.s2?.vibes        ?? []);
  const [inspirationUrls,   setInspirationUrls]   = useState<string[]>(draft.s2?.inspirationUrls ?? ['']);
  const [checkedScreens,    setCheckedScreens]    = useState<Set<string>>(
    () => new Set(SCREEN_OPTIONS.filter(s => s !== 'Admin Panel')),
  );
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  // Persist draft
  useEffect(() => {
    const cleanUrls = inspirationUrls.filter(u => u.trim());
    writeSetupDraft(projectId, { s2: { vibes: selectedVibes, inspirationUrls: cleanUrls } });
  }, [selectedVibes, inspirationUrls, projectId]);

  function toggleVibe(slug: string) {
    setSelectedVibes(prev => {
      if (prev.includes(slug)) return prev.filter(v => v !== slug);
      if (prev.length >= 2)    return prev; // max 2
      return [...prev, slug];
    });
  }

  function toggleScreen(name: string) {
    setCheckedScreens(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function addUrlRow() {
    if (inspirationUrls.length >= 3) return;
    setInspirationUrls(prev => [...prev, '']);
  }

  function removeUrlRow(i: number) {
    setInspirationUrls(prev => prev.filter((_, j) => j !== i));
  }

  function updateUrl(i: number, value: string) {
    setInspirationUrls(prev => prev.map((u, j) => j === i ? value : u));
  }

  async function handleComplete() {
    setSaving(true);
    setError('');
    try {
      const cleanUrls = inspirationUrls.map(u => u.trim()).filter(Boolean);
      await onComplete(selectedVibes, cleanUrls);
    } catch (err) {
      setError(extractErrorMessage(err, 'Save failed — please try again.'));
      setSaving(false);
    }
  }

  const sectionNumberStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: T.accent,
    color: 'white',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <div data-testid="wizard-screen-kickoff" style={screenStyle}>
      <div style={contentStyle}>
        <h1 style={headlineStyle}>Let's set the visual direction.</h1>
        <p style={subheadStyle}>
          Three quick questions. Skip anything that doesn't apply yet.
        </p>

        {/* Section 1 — Vibe */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={sectionNumberStyle}>1</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>
              What's the feel of this product?
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, marginLeft: 34 }}>
            Select up to 2
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 34 }}>
            {VIBE_CHIPS.map(chip => {
              const active = selectedVibes.includes(chip.slug);
              const maxed  = !active && selectedVibes.length >= 2;
              return (
                <button
                  key={chip.slug}
                  data-testid={`wizard-vibe-${chip.slug}`}
                  onClick={() => !maxed && toggleVibe(chip.slug)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    background: active ? T.accent : T.surface,
                    color: active ? 'white' : maxed ? T.faint : T.text,
                    border: `1.5px solid ${active ? T.accent : T.border}`,
                    borderRadius: 20,
                    cursor: maxed ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                    opacity: maxed ? 0.5 : 1,
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2 — Inspiration URLs */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={sectionNumberStyle}>2</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>
              Any sites or apps you love the look of?
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, marginLeft: 34 }}>
            These help us understand your visual direction · up to 3
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 34 }}>
            {inspirationUrls.map((url, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="url"
                  value={url}
                  placeholder="https://linear.app"
                  onChange={e => updateUrl(i, e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    fontSize: 13,
                    color: T.text,
                    background: T.surface,
                    border: `1.5px solid ${T.border}`,
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = T.accent; }}
                  onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                />
                {inspirationUrls.length > 1 && (
                  <button
                    onClick={() => removeUrlRow(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: T.faint,
                      fontSize: 16,
                      padding: '4px 6px',
                      lineHeight: 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {inspirationUrls.length < 3 && (
              <button
                onClick={addUrlRow}
                style={{
                  alignSelf: 'flex-start',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: T.accent,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '4px 0',
                  fontFamily: 'inherit',
                }}
              >
                + Add another
              </button>
            )}
          </div>
        </div>

        {/* Section 3 — Screen checklist */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={sectionNumberStyle}>3</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>
              Screens you'll need
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, marginLeft: 34 }}>
            Uncheck any you don't need — Reeve will suggest more once you start building
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px 16px',
              marginLeft: 34,
            }}
          >
            {SCREEN_OPTIONS.map(name => {
              const checked = checkedScreens.has(name);
              return (
                <button
                  key={name}
                  data-testid={`wizard-screen-chip-${name.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => toggleScreen(name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: checked ? `${T.accent}0c` : T.surface,
                    border: `1.5px solid ${checked ? T.accent : T.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `1.5px solid ${checked ? T.accent : T.faint}`,
                      background: checked ? T.accent : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s',
                    }}
                  >
                    {checked && <span style={{ color: 'white', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: checked ? T.accent : T.text, fontWeight: checked ? 600 : 400, transition: 'color 0.15s' }}>
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p style={{ color: T.red, fontSize: 13, margin: '0 0 16px' }}>{error}</p>
        )}

        {/* CTAs */}
        <button
          data-testid="wizard-kickoff-submit"
          onClick={handleComplete}
          disabled={saving}
          style={{
            width: '100%',
            height: 48,
            fontSize: 16,
            fontWeight: 600,
            background: saving ? T.faint : T.accent,
            color: 'white',
            border: 'none',
            borderRadius: 10,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'inherit',
            marginBottom: 12,
          }}
        >
          {saving ? 'Saving…' : 'Set up my project →'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button
            data-testid="wizard-kickoff-skip"
            onClick={onSkip}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              color: T.muted,
              fontSize: 13,
              fontFamily: 'inherit',
              padding: '4px 8px',
              textDecoration: 'underline',
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────

function TopBar({
  step,
  total,
  onBack,
}: {
  step:    number;
  total:   number;
  onBack?: () => void;
}) {
  return (
    <div
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        flexShrink: 0,
      }}
    >
      {/* Back button or spacer */}
      {onBack ? (
        <button
          data-testid="wizard-back"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: T.muted,
            fontSize: 14,
            fontFamily: 'inherit',
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ← Back
        </button>
      ) : (
        <div style={{ width: 60 }} />
      )}

      {/* Step counter */}
      <div style={{ fontSize: 12, color: T.faint, fontWeight: 500 }}>
        Step {step} of {total}
      </div>

      {/* Shipyard wordmark */}
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, opacity: 0.5, width: 60, textAlign: 'right' }}>
        Shipyard
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type WizardStep = 'brief' | 'loading' | 'kickoff';

export default function SetupWizardScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate          = useNavigate();
  const { showToast }     = useToast();

  const [step, setStep] = useState<WizardStep>('brief');

  if (!projectId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>
        No project ID — go back and try again.
      </div>
    );
  }

  // ── Screen 1 submit handler ─────────────────────────────────────────────────
  async function handleBriefSubmit(brief: string) {
    // Save brief to DB
    await saveBrief(projectId!, brief);

    // Show loading state
    setStep('loading');

    // Fire both EFs in parallel + minimum UX delay
    await Promise.all([
      triggerExtractFeatures(projectId!),
      triggerWizardDefaults(projectId!),
      new Promise<void>(resolve => setTimeout(resolve, 1800)),
    ]);

    // Proceed to Design Kickoff
    setStep('kickoff');
  }

  // ── Screen 2 submit handler ─────────────────────────────────────────────────
  async function handleKickoffComplete(vibes: string[], urls: string[]) {
    await saveDesignKickoff(projectId!, vibes, urls);
    clearSetupDraft(projectId!);
    showToast('Project set up! Let\'s start building.');
    navigate(`/projects/${projectId}/triage`);
  }

  // ── Skip handler ────────────────────────────────────────────────────────────
  function handleSkip() {
    clearSetupDraft(projectId!);
    navigate(`/projects/${projectId}`);
  }

  // ── Back handler ────────────────────────────────────────────────────────────
  function handleBack() {
    setStep('brief');
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: T.bg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Top bar — hidden during loading */}
      {step !== 'loading' && (
        <TopBar
          step={step === 'brief' ? 1 : 2}
          total={2}
          onBack={step === 'kickoff' ? handleBack : undefined}
        />
      )}

      {/* Padding above content */}
      {step !== 'loading' && <div style={{ height: 32 }} />}

      {/* Screens */}
      {step === 'brief' && (
        <ScreenBrief
          projectId={projectId}
          onNext={handleBriefSubmit}
        />
      )}

      {step === 'loading' && <ScreenLoading />}

      {step === 'kickoff' && (
        <ScreenDesignKickoff
          projectId={projectId}
          onComplete={handleKickoffComplete}
          onSkip={handleSkip}
        />
      )}
    </div>
  );
}
