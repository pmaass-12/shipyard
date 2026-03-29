/**
 * FeedbackWidget — Build 002
 *
 * A floating action button injected into preview builds only.
 * Controlled by SHIPYARD_ENV === 'preview' baked at deploy time.
 *
 * Five-step triage flow:
 *   1. idle    → FAB visible, sheet closed
 *   2. triage  → sheet open, user picks Bug / Change / Feature
 *   3. capture → screenshot + annotations step
 *   4. detail  → description + severity (bugs) / description (change/feature)
 *   5. submitting / success / error
 *
 * Auth: X-Shipyard-Preview-Token header (not Supabase auth).
 * Screenshot: html2canvas (loaded lazily). Masks [type="password"] and [data-shipyard-mask].
 */

import React, { useState, useRef, useEffect } from 'react';
import type { Annotation, ConsoleError, BugSeverity } from '../types/db';

// ── Constants ─────────────────────────────────────────────────────────────

const PREVIEW_TOKEN   = (import.meta.env.VITE_SHIPYARD_PREVIEW_TOKEN as string) ?? '';
const SCREEN_ID       = (import.meta.env.VITE_SHIPYARD_SCREEN_ID as string)     ?? '';
const IS_PREVIEW      = import.meta.env.VITE_SHIPYARD_ENV === 'preview';

const API_BASE        = ''; // relative — edge functions live at /api/feedback/*

type TriageType = 'bug' | 'change' | 'feature';
type WidgetStep = 'idle' | 'triage' | 'capture' | 'detail' | 'submitting' | 'success' | 'error';

// Dark theme tokens matching widget spec
const T = {
  bg:        '#1a1a1c',
  surface:   '#222224',
  surface3:  '#2c2c2e',
  border:    '#3a3a3c',
  text:      '#e8e8ea',
  text2:     '#8e8e93',
  accent:    '#0a84ff',
  green:     '#30d158',
  red:       '#ff453a',
  orange:    '#ff9f0a',
};

// ── Severity labels ───────────────────────────────────────────────────────

const SEVERITY_OPTIONS: { value: BugSeverity; label: string; hint: string }[] = [
  { value: 'p0', label: 'P0 — Critical', hint: 'App is broken / data loss' },
  { value: 'p1', label: 'P1 — High',     hint: 'Major feature blocked'     },
  { value: 'p2', label: 'P2 — Medium',   hint: 'Degraded experience'       },
  { value: 'p3', label: 'P3 — Low',      hint: 'Cosmetic / minor'          },
];

// ── Icon SVGs (inline, no extra dep) ─────────────────────────────────────

function BugIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>; }
function ChangeIcon()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function FeatureIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function CloseIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function CameraIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>; }
function PinIcon()     { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function TrashIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>; }
function ConsoleIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>; }

// ── Console error ring buffer ─────────────────────────────────────────────
// Patched at module init time (outside the component). Captures up to 50
// entries. Masks [type="password"] node values to avoid leaking secrets.

const RING_BUFFER_SIZE = 50;
const _consoleRing: ConsoleError[] = [];

function _patchConsole(level: ConsoleError['level'], original: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    original.apply(console, args);
    const message = args.map(a => {
      try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
      catch { return '[unserializable]'; }
    }).join(' ');
    const entry: ConsoleError = {
      level,
      message:   message.slice(0, 500),
      source:    '',
      timestamp: new Date().toISOString(),
    };
    if (_consoleRing.length >= RING_BUFFER_SIZE) _consoleRing.shift();
    _consoleRing.push(entry);
  };
}

// Wire patches once at module load time (only in preview builds)
if (import.meta.env.VITE_SHIPYARD_ENV === 'preview' && typeof window !== 'undefined') {
  console.error = _patchConsole('error', console.error.bind(console));
  console.warn  = _patchConsole('warn',  console.warn.bind(console));
  // Don't patch console.log — too noisy; keep ring to errors + warnings only
}

// Also capture uncaught errors
if (import.meta.env.VITE_SHIPYARD_ENV === 'preview' && typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (_consoleRing.length >= RING_BUFFER_SIZE) _consoleRing.shift();
    _consoleRing.push({
      level:     'error',
      message:   e.message,
      source:    `${e.filename}:${e.lineno}`,
      timestamp: new Date().toISOString(),
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (_consoleRing.length >= RING_BUFFER_SIZE) _consoleRing.shift();
    _consoleRing.push({
      level:     'error',
      message:   String(e.reason),
      source:    '',
      timestamp: new Date().toISOString(),
    });
  });
}

function captureConsoleErrors(): ConsoleError[] {
  return [..._consoleRing];
}

// ── Annotation overlay ────────────────────────────────────────────────────

interface AnnotationOverlayProps {
  imageUrl:    string;
  annotations: Annotation[];
  onChange:    (pins: Annotation[]) => void;
}

function AnnotationOverlay({ imageUrl, annotations, onChange }: AnnotationOverlayProps) {
  const imgRef = useRef<HTMLDivElement>(null);
  const [labelingPin, setLabelingPin] = useState<number | null>(null);
  const [labelDraft, setLabelDraft]   = useState('');

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x    = (e.clientX - rect.left)  / rect.width;
    const y    = (e.clientY - rect.top)   / rect.height;
    const newPin: Annotation = { id: annotations.length + 1, x, y, label: '' };
    onChange([...annotations, newPin]);
    setLabelingPin(newPin.id);
    setLabelDraft('');
  }

  function saveLabel(id: number) {
    onChange(annotations.map(p => p.id === id ? { ...p, label: labelDraft } : p));
    setLabelingPin(null);
    setLabelDraft('');
  }

  function removePin(id: number) {
    const updated = annotations
      .filter(p => p.id !== id)
      .map((p, i) => ({ ...p, id: i + 1 }));
    onChange(updated);
  }

  return (
    <div style={{ position: 'relative', userSelect: 'none' }} ref={imgRef}>
      <img
        src={imageUrl}
        alt="Screenshot"
        style={{ width: '100%', display: 'block', borderRadius: 8 }}
        draggable={false}
      />
      {/* Click target overlay */}
      <div
        onClick={handleClick}
        style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
      />
      {/* Pins */}
      {annotations.map(pin => (
        <React.Fragment key={pin.id}>
          <div
            style={{
              position:        'absolute',
              left:            `${pin.x * 100}%`,
              top:             `${pin.y * 100}%`,
              transform:       'translate(-50%, -50%)',
              width:           24,
              height:          24,
              borderRadius:    '50%',
              background:      T.accent,
              color:           '#fff',
              fontSize:        11,
              fontWeight:      700,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              cursor:          'pointer',
              zIndex:          10,
              border:          '2px solid #fff',
              boxShadow:       '0 1px 4px rgba(0,0,0,0.5)',
            }}
            title={pin.label || `Pin ${pin.id}`}
          >
            {pin.id}
          </div>
          {/* Label tooltip */}
          {pin.label && (
            <div style={{
              position:    'absolute',
              left:        `${pin.x * 100}%`,
              top:         `calc(${pin.y * 100}% + 14px)`,
              transform:   'translateX(-50%)',
              background:  'rgba(0,0,0,0.85)',
              color:       '#fff',
              fontSize:    11,
              padding:     '2px 6px',
              borderRadius: 4,
              whiteSpace:  'nowrap',
              pointerEvents: 'none',
              zIndex:      9,
            }}>
              {pin.label}
            </div>
          )}
        </React.Fragment>
      ))}
      {/* Label input for new pin */}
      {labelingPin !== null && (() => {
        const pin = annotations.find(p => p.id === labelingPin);
        if (!pin) return null;
        return (
          <div style={{
            position:    'absolute',
            left:        `${pin.x * 100}%`,
            top:         `calc(${pin.y * 100}% + 14px)`,
            transform:   'translateX(-50%)',
            zIndex:      20,
          }}>
            <input
              autoFocus
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveLabel(labelingPin);
                if (e.key === 'Escape') { setLabelingPin(null); removePin(labelingPin); }
              }}
              placeholder="Describe this pin…"
              style={{
                background:   T.surface,
                border:       `1px solid ${T.border}`,
                borderRadius:  6,
                color:         T.text,
                fontSize:      12,
                padding:       '4px 8px',
                outline:       'none',
                width:         160,
              }}
            />
          </div>
        );
      })()}
      {/* Pin list below image */}
      {annotations.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {annotations.map(pin => (
            <div key={pin.id} style={{
              display:        'flex',
              alignItems:     'center',
              gap:             6,
              padding:         '4px 0',
              borderBottom:   `1px solid ${T.border}`,
            }}>
              <span style={{
                width:   20, height: 20, borderRadius: '50%',
                background: T.accent, color: '#fff',
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{pin.id}</span>
              <span style={{ flex: 1, fontSize: 12, color: T.text2 }}>
                {pin.label || <em style={{ color: T.text2 }}>no label</em>}
              </span>
              <button
                onClick={() => removePin(pin.id)}
                style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', padding: 2 }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Console panel ─────────────────────────────────────────────────────────

function ConsolePanel({ errors }: { errors: ConsoleError[] }) {
  if (errors.length === 0) {
    return (
      <p style={{ color: T.text2, fontSize: 12, margin: 0 }}>
        No console errors captured for this session.
      </p>
    );
  }
  const levelColor = { error: T.red, warn: T.orange, log: T.text2 };
  return (
    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
      {errors.map((e, i) => (
        <div key={i} style={{
          borderBottom: `1px solid ${T.border}`,
          padding:       '4px 0',
          fontSize:       11,
          color:          levelColor[e.level],
          fontFamily:    'monospace',
        }}>
          <span style={{ opacity: 0.6, marginRight: 6 }}>[{e.level.toUpperCase()}]</span>
          {e.message}
          <span style={{ opacity: 0.4, marginLeft: 6, fontSize: 10 }}>{e.source}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────

export default function FeedbackWidget() {
  if (!IS_PREVIEW) return null;

  const [step, setStep]               = useState<WidgetStep>('idle');
  const [triageType, setTriageType]   = useState<TriageType | null>(null);
  const [screenshot, setScreenshot]   = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [description, setDescription] = useState('');
  const [severity, setSeverity]       = useState<BugSeverity>('p2');
  const [consoleErrors]               = useState<ConsoleError[]>(captureConsoleErrors);
  const [showConsole, setShowConsole] = useState(false); // set to true when bug + errors exist
  const [errorMsg, setErrorMsg]       = useState('');
  const sheetRef                      = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (step === 'idle') return;
    function handleOutside(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        reset();
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [step]);

  // Escape key closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') reset();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  function reset() {
    setStep('idle');
    setTriageType(null);
    setScreenshot(null);
    setAnnotations([]);
    setDescription('');
    setSeverity('p2');
    setShowConsole(false);
    setErrorMsg('');
  }

  function openWidget() {
    setStep('triage');
  }

  function selectType(t: TriageType) {
    setTriageType(t);
    // Auto-expand console panel for bugs when errors have been captured
    setShowConsole(t === 'bug' && consoleErrors.length > 0);
    setStep('capture');
  }

  async function takeScreenshot() {
    try {
      // Lazy-load html2canvas to avoid bloating the main bundle
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(document.body, {
        useCORS:     true,
        logging:     false,
        ignoreElements: (el: Element) => {
          // Mask sensitive fields and the widget itself
          return el.id === 'shipyard-widget' ||
            (el as HTMLInputElement).type === 'password' ||
            el.hasAttribute('data-shipyard-mask');
        },
      });
      setScreenshot(canvas.toDataURL('image/png'));
    } catch {
      // If html2canvas fails (e.g. CSP), continue without a screenshot
      setScreenshot('');
    }
  }

  async function handleSubmit() {
    if (!description.trim()) return;
    setStep('submitting');

    const base = {
      screen_id:      SCREEN_ID,
      route:          window.location.pathname,
      description:    description.trim(),
      screenshot_url: screenshot ?? '',
      annotations,
      captured_at:    new Date().toISOString(),
    };

    let endpoint: string;
    let body: object;

    if (triageType === 'bug') {
      endpoint = `${API_BASE}/api/feedback/bug`;
      body = { ...base, type: 'bug', severity, console_errors: consoleErrors, user_agent: navigator.userAgent };
    } else if (triageType === 'change') {
      endpoint = `${API_BASE}/api/feedback/change`;
      body = { ...base, type: 'change', feature_id: null, console_errors: consoleErrors };
    } else {
      endpoint = `${API_BASE}/api/feedback/feature`;
      body = { ...base, type: 'feature' };
    }

    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: {
          'Content-Type':              'application/json',
          'X-Shipyard-Preview-Token':  PREVIEW_TOKEN,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      setStep('success');
      setTimeout(reset, 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const sheetStyle: React.CSSProperties = {
    position:     'fixed',
    bottom:        80,
    right:         24,
    width:         360,
    maxWidth:      'calc(100vw - 48px)',
    maxHeight:     'calc(100vh - 120px)',
    background:    T.bg,
    borderRadius:  16,
    border:        `1px solid ${T.border}`,
    boxShadow:     '0 24px 64px rgba(0,0,0,0.6)',
    display:       'flex',
    flexDirection: 'column',
    overflow:      'hidden',
    zIndex:        2147483646,
    color:         T.text,
    fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  const sheetHeader = (title: string, showBack = false, onBack?: () => void) => (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '14px 16px 12px',
      borderBottom:   `1px solid ${T.border}`,
      flexShrink:      0,
    }}>
      {showBack ? (
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 13, padding: 0 }}>
          ← Back
        </button>
      ) : <span />}
      <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      <button onClick={reset} style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', display: 'flex' }}>
        <CloseIcon />
      </button>
    </div>
  );

  const bodyStyle: React.CSSProperties = {
    padding:    16,
    overflowY:  'auto',
    flex:        1,
  };

  const btnPrimary: React.CSSProperties = {
    width:        '100%',
    padding:      '10px 0',
    background:    T.accent,
    color:         '#fff',
    border:        'none',
    borderRadius:   10,
    fontSize:       14,
    fontWeight:     600,
    cursor:         'pointer',
    marginTop:      12,
  };

  const btnDisabled: React.CSSProperties = {
    ...btnPrimary,
    background: T.surface3,
    color:      T.text2,
    cursor:     'not-allowed',
  };

  const triageCardStyle = (selected: boolean): React.CSSProperties => ({
    display:        'flex',
    alignItems:     'center',
    gap:             12,
    padding:         '12px 14px',
    background:      selected ? T.surface : T.surface,
    border:          `1.5px solid ${selected ? T.accent : T.border}`,
    borderRadius:    12,
    cursor:          'pointer',
    marginBottom:    10,
  });

  return (
    <div id="shipyard-widget" style={{ zIndex: 2147483647, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* FAB */}
      {step === 'idle' && (
        <button
          onClick={openWidget}
          title="Send feedback"
          data-testid="shipyard-fab"
          style={{
            position:        'fixed',
            bottom:           24,
            right:            24,
            width:            52,
            height:           52,
            borderRadius:    '50%',
            background:       T.accent,
            color:            '#fff',
            border:           'none',
            cursor:           'pointer',
            display:          'flex',
            alignItems:       'center',
            justifyContent:   'center',
            boxShadow:        '0 4px 16px rgba(10,132,255,0.4)',
            zIndex:           2147483647,
          }}
        >
          {/* Feedback / chat bubble icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}

      {/* Bottom sheet */}
      {step !== 'idle' && (
        <div ref={sheetRef} style={sheetStyle}>

          {/* ── TRIAGE ── */}
          {step === 'triage' && (
            <>
              {sheetHeader('Send feedback')}
              <div style={bodyStyle}>
                <p style={{ color: T.text2, fontSize: 13, marginBottom: 16, marginTop: 0 }}>
                  What kind of feedback is this?
                </p>
                <div onClick={() => selectType('bug')} data-testid="triage-bug" style={triageCardStyle(false)}>
                  <span style={{ color: T.red }}><BugIcon /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Report a bug</div>
                    <div style={{ fontSize: 12, color: T.text2 }}>Something isn't working correctly</div>
                  </div>
                </div>
                <div onClick={() => selectType('change')} data-testid="triage-change" style={triageCardStyle(false)}>
                  <span style={{ color: T.orange }}><ChangeIcon /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Request a change</div>
                    <div style={{ fontSize: 12, color: T.text2 }}>Adjust existing behaviour or design</div>
                  </div>
                </div>
                <div onClick={() => selectType('feature')} data-testid="triage-feature" style={triageCardStyle(false)}>
                  <span style={{ color: T.green }}><FeatureIcon /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Suggest a feature</div>
                    <div style={{ fontSize: 12, color: T.text2 }}>Something that doesn't exist yet</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── CAPTURE ── */}
          {step === 'capture' && (
            <>
              {sheetHeader(
                triageType === 'bug' ? 'Capture screenshot' :
                triageType === 'change' ? 'Add context' : 'Show what you mean',
                true, () => setStep('triage')
              )}
              <div style={bodyStyle}>
                {!screenshot ? (
                  <div>
                    <p style={{ color: T.text2, fontSize: 13, marginTop: 0, marginBottom: 16 }}>
                      Capture the current screen to add annotations. Password fields are automatically masked.
                    </p>
                    <button
                      onClick={takeScreenshot}
                      style={{
                        ...btnPrimary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 0,
                      }}
                    >
                      <CameraIcon /> Take screenshot
                    </button>
                    <button
                      onClick={() => setStep('detail')}
                      style={{ ...btnPrimary, background: T.surface3, color: T.text2, marginTop: 8 }}
                    >
                      Skip screenshot
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: T.text2, fontSize: 12, marginTop: 0, marginBottom: 10 }}>
                      <PinIcon /> Click anywhere on the screenshot to add annotation pins.
                    </p>
                    <AnnotationOverlay
                      imageUrl={screenshot}
                      annotations={annotations}
                      onChange={setAnnotations}
                    />
                    <button onClick={() => { setScreenshot(null); setAnnotations([]); }}
                      style={{ ...btnPrimary, background: T.surface3, color: T.text2, marginTop: 8, fontSize: 12 }}>
                      Retake screenshot
                    </button>
                    <button onClick={() => setStep('detail')} style={{ ...btnPrimary, marginTop: 8 }}>
                      Continue →
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── DETAIL ── */}
          {step === 'detail' && (
            <>
              {sheetHeader(
                triageType === 'bug' ? 'Describe the bug' :
                triageType === 'change' ? 'Describe the change' : 'Describe the feature',
                true, () => setStep('capture')
              )}
              <div style={bodyStyle}>
                <textarea
                  autoFocus
                  data-testid="feedback-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={
                    triageType === 'bug'    ? 'What happened? What did you expect?' :
                    triageType === 'change' ? 'What should be different?' :
                    'What should this feature do?'
                  }
                  rows={4}
                  style={{
                    width:        '100%',
                    boxSizing:    'border-box',
                    background:    T.surface,
                    border:       `1px solid ${T.border}`,
                    borderRadius:  10,
                    color:         T.text,
                    fontSize:      14,
                    padding:       '10px 12px',
                    resize:        'vertical',
                    outline:       'none',
                    fontFamily:   'inherit',
                    lineHeight:    1.5,
                  }}
                />

                {/* Severity picker — bugs only */}
                {triageType === 'bug' && (
                  <div style={{ marginTop: 14 }}>
                    <label style={{ fontSize: 12, color: T.text2, display: 'block', marginBottom: 8 }}>Severity</label>
                    {SEVERITY_OPTIONS.map(opt => (
                      <label key={opt.value} style={{
                        display:     'flex',
                        alignItems:  'center',
                        gap:          8,
                        padding:      '6px 0',
                        cursor:       'pointer',
                        fontSize:     13,
                      }}>
                        <input
                          type="radio"
                          name="severity"
                          value={opt.value}
                          checked={severity === opt.value}
                          onChange={() => setSeverity(opt.value)}
                          style={{ accentColor: T.accent }}
                        />
                        <span style={{ fontWeight: severity === opt.value ? 600 : 400 }}>{opt.label}</span>
                        <span style={{ color: T.text2, fontSize: 11 }}>— {opt.hint}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Console errors accordion */}
                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={() => setShowConsole(v => !v)}
                    style={{
                      background: 'none', border: 'none', color: T.text2,
                      fontSize: 12, cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <ConsoleIcon />
                    {showConsole ? 'Hide' : 'Show'} console errors ({consoleErrors.length})
                  </button>
                  {showConsole && (
                    <div style={{ marginTop: 8, background: T.surface, borderRadius: 8, padding: 10 }}>
                      <ConsolePanel errors={consoleErrors} />
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!description.trim()}
                  data-testid="feedback-submit"
                  style={description.trim() ? btnPrimary : btnDisabled}
                >
                  {triageType === 'bug'    ? 'Submit bug report' :
                   triageType === 'change' ? 'Submit change request' :
                   'Submit feature idea'}
                </button>
              </div>
            </>
          )}

          {/* ── SUBMITTING ── */}
          {step === 'submitting' && (
            <div style={{ ...bodyStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: `3px solid ${T.border}`,
                borderTopColor: T.accent,
                animation: 'spin 0.8s linear infinite',
                marginBottom: 12,
              }} />
              <span style={{ color: T.text2, fontSize: 14 }}>Submitting…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <div data-testid="feedback-success" style={{ ...bodyStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: T.green }}>Feedback sent!</div>
              <div style={{ fontSize: 13, color: T.text2, marginTop: 6, textAlign: 'center' }}>
                Thanks — the team will review it shortly.
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div data-testid="feedback-error" style={{ ...bodyStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⚠</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: T.red }}>Submit failed</div>
              <div style={{ fontSize: 12, color: T.text2, marginTop: 6, textAlign: 'center' }}>{errorMsg}</div>
              <button onClick={() => setStep('detail')} style={{ ...btnPrimary, marginTop: 16, width: 'auto', padding: '8px 20px' }}>
                Try again
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
