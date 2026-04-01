/**
 * FeatureCreationSheet — Build 054
 *
 * Bottom sheet / centered modal for creating a new feature.
 * Shared between two entry points:
 *   - Screens Builder: pre-fills screen as a non-editable chip
 *   - Project Hub:     blank screen dropdown, user selects
 *
 * Props:
 *   isOpen          — controls visibility
 *   onClose         — called on dismiss (Escape, backdrop, ✕)
 *   projectId       — required
 *   defaultScreenId — pre-fill screen; makes field read-only
 *   defaultScreenName — label for pre-filled chip
 *   onCreated       — optional callback with new feature id after success
 *
 * On success: transitions to success state → auto-navigates to feature after 1.2s.
 *
 * Styling: inline styles only. No Tailwind.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

// ── Types ──────────────────────────────────────────────────────────────────

interface Screen {
  id: string;
  name: string;
}

interface Props {
  isOpen:            boolean;
  onClose:           () => void;
  projectId:         string;
  defaultScreenId?:  string;
  defaultScreenName?: string;
  onCreated?:        (featureId: string) => void;
}

// ── Design tokens ──────────────────────────────────────────────────────────

const T = {
  accent:    '#5b5bd6',
  accentDk:  '#4338ca',
  accentBg:  '#eef0ff',
  bg:        '#f5f5f7',
  surface:   '#ffffff',
  border:    '#e4e4e8',
  text:      '#1a1a1e',
  muted:     '#6e6e80',
  success:   '#22c55e',
  error:     '#ef4444',
};

// ── FeatureCreationSheet ───────────────────────────────────────────────────

export default function FeatureCreationSheet({
  isOpen,
  onClose,
  projectId,
  defaultScreenId,
  defaultScreenName,
  onCreated,
}: Props) {
  const navigate = useNavigate();

  // Form state
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [screenId,    setScreenId]    = useState(defaultScreenId ?? '');
  const [screens,     setScreens]     = useState<Screen[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [nameError,   setNameError]   = useState('');

  // Success state
  const [successName, setSuccessName] = useState('');
  const [successId,   setSuccessId]   = useState('');

  const nameRef = useRef<HTMLInputElement>(null);

  const MAX_NAME = 80;
  const MAX_DESC = 200;
  const nameRemaining = MAX_NAME - name.length;
  const descRemaining = MAX_DESC - description.length;

  // Load screens for dropdown (skip if defaultScreenId is set)
  useEffect(() => {
    if (!isOpen || defaultScreenId) return;
    (async () => {
      const { data } = await supabase
        .from('screens')
        .select('id, name')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      setScreens((data as Screen[]) ?? []);
    })();
  }, [isOpen, projectId, defaultScreenId]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setScreenId(defaultScreenId ?? '');
      setError('');
      setNameError('');
      setSuccessName('');
      setSuccessId('');
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen, defaultScreenId]);

  // Keyboard: Escape closes, ⌘+Enter submits
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
    },
    [isOpen, name, description, screenId] // eslint-disable-line
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  async function handleSubmit() {
    if (!name.trim()) { setNameError('Feature name is required'); return; }
    setNameError('');
    setError('');
    setSubmitting(true);

    try {
      const { data, error: insertError } = await supabase
        .from('features')
        .insert({
          project_id:  projectId,
          screen_id:   screenId || null,
          name:        name.trim(),
          description: description.trim() || null,
          status:      'design',
          complexity:  2, // medium default
        })
        .select('id, name')
        .single();

      if (insertError) throw insertError;

      const newId   = (data as { id: string; name: string }).id;
      const newName = (data as { id: string; name: string }).name;

      setSuccessName(newName);
      setSuccessId(newId);
      onCreated?.(newId);

      setTimeout(() => {
        navigate(`/projects/${projectId}/features/${newId}`);
        onClose();
      }, 1200);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to create feature. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const isSuccess = !!successId;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Sheet */}
      <div
        data-testid="feature-creation-sheet"
        style={{
          position:     'fixed',
          bottom:       0,
          left:         '50%',
          transform:    'translateX(-50%)',
          width:        '100%',
          maxWidth:     480,
          background:   T.surface,
          borderRadius: '14px 14px 0 0',
          padding:      '12px 20px 32px',
          zIndex:       101,
          boxShadow:    '0 -4px 24px rgba(0,0,0,0.12)',
          animation:    'slideUp 0.3s ease',
        }}
      >
        {/* Handle bar */}
        <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2, margin: '0 auto 16px' }} />

        {isSuccess ? (
          /* ── Success State ── */
          <div data-testid="feature-creation-success" style={{ textAlign: 'center', padding: '24px 0 8px' }}>
            <div style={{ fontSize: 48, color: T.success, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: T.text, marginBottom: 6 }}>Feature created!</div>
            <div style={{ fontSize: 14, color: T.muted, marginBottom: 16 }}>
              Opening "{successName}"…
            </div>
            {!screenId && (
              <div style={{
                fontSize: 12, color: T.muted, background: T.bg,
                border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px',
              }}>
                You can assign this to a screen later from the Screens Builder.
              </div>
            )}
            {/* Progress bar */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: T.accent, animation: 'progressBar 1.2s linear forwards' }} />
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: T.text }}>Create a feature</span>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', fontSize: 20, color: T.muted, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Feature name */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Feature name</label>
                {nameRemaining <= 30 && (
                  <span style={{ fontSize: 11, color: T.muted }}>{nameRemaining} chars remaining</span>
                )}
              </div>
              <input
                ref={nameRef}
                data-testid="feature-name-input"
                value={name}
                onChange={(e) => { setName(e.target.value.slice(0, MAX_NAME)); setNameError(''); }}
                placeholder="e.g. Filter transactions by date"
                style={{
                  width: '100%', height: 44, padding: '0 12px',
                  borderRadius: 8, border: `1.5px solid ${nameError ? T.error : T.border}`,
                  fontSize: 14, color: T.text, outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  boxShadow: nameError ? `0 0 0 3px ${T.error}22` : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = nameError ? T.error : T.accent; e.target.style.boxShadow = `0 0 0 3px rgba(91,91,214,0.12)`; }}
                onBlur={(e)  => { e.target.style.borderColor = nameError ? T.error : T.border; e.target.style.boxShadow = 'none'; }}
              />
              {nameError && <p style={{ fontSize: 12, color: T.error, marginTop: 4 }}>{nameError}</p>}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                  Description <span style={{ fontSize: 12, color: T.muted, fontWeight: 400 }}>· optional</span>
                </label>
                {descRemaining <= 50 && (
                  <span style={{ fontSize: 11, color: T.muted }}>{descRemaining} chars remaining</span>
                )}
              </div>
              <textarea
                data-testid="feature-description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                placeholder="What does this feature do? The more specific, the better."
                rows={2}
                style={{
                  width: '100%', padding: '10px 12px',
                  borderRadius: 8, border: `1.5px solid ${T.border}`,
                  fontSize: 14, color: T.text, outline: 'none', fontFamily: 'inherit',
                  resize: 'vertical', boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = `0 0 0 3px rgba(91,91,214,0.12)`; }}
                onBlur={(e)  => { e.target.style.borderColor = T.border;  e.target.style.boxShadow = 'none'; }}
              />
              <p style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                Reeve uses this to brief the design step. Be as specific as you can.
              </p>
            </div>

            {/* Screen */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: T.text, display: 'block', marginBottom: 6 }}>Screen</label>
              {defaultScreenId ? (
                /* Pre-filled chip — read-only */
                <div
                  data-testid="feature-screen-chip"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 20,
                    background: T.accentBg, border: `1px solid ${T.accentDk}33`,
                    fontSize: 13, color: T.accentDk, fontWeight: 500,
                  }}
                >
                  🖥 {defaultScreenName ?? 'Selected screen'}
                </div>
              ) : (
                <select
                  data-testid="feature-screen-select"
                  value={screenId}
                  onChange={(e) => setScreenId(e.target.value)}
                  style={{
                    width: '100%', height: 44, padding: '0 12px',
                    borderRadius: 8, border: `1.5px solid ${T.border}`,
                    fontSize: 14, color: screenId ? T.text : T.muted,
                    background: T.surface, fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Unassigned</option>
                  {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            {/* Global error */}
            {error && (
              <p style={{ fontSize: 13, color: T.error, marginBottom: 12 }}>{error}</p>
            )}

            {/* Submit */}
            <button
              data-testid="feature-creation-submit"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', height: 48, background: T.accentDk, color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting ? (
                <>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Creating…
                </>
              ) : 'Create feature'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 11, color: T.muted, marginTop: 8 }}>
              ⌘ + Enter to submit
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp  { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes progressBar { from { width: 0; } to { width: 100%; } }
      `}</style>
    </>
  );
}
