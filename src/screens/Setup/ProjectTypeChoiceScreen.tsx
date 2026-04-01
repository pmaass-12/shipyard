/**
 * ProjectTypeChoiceScreen — Build 047
 *
 * Route: /projects/:id/setup/wizard (shown before existing Build wizard)
 *
 * "What are you building?" — three path choices:
 *   app     → existing SetupWizardScreen (Build wizard)
 *   website → DistributeWizardScreen
 *   both    → DistributeWizardScreen (Distribute first, can add Build later)
 *
 * On selection: saves project_type to projects table, navigates to the
 * appropriate wizard.
 *
 * Inline styles only.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Anchor } from 'lucide-react';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

// ── Design tokens ──────────────────────────────────────────────────────────

const T = {
  bg:          '#f5f5f7',
  surface:     '#ffffff',
  border:      '#e5e5ea',
  text:        '#1c1c1e',
  muted:       '#6e6e73',
  faint:       '#aeaeb2',
  accent:      '#4338ca',
  accentLight: '#eef2ff',
  amber:       '#d97706',
  amberLight:  '#fffbeb',
};

const PATHS = [
  {
    type:     'app',
    icon:     '⚡',
    title:    'Build a web app',
    desc:     'Design, generate, and ship a React + Supabase web application. Reeve manages the full Build pipeline: Design → Schema → Code → Preview → QA → Live.',
    badge:    null,
    accent:   T.accent,
    accentBg: T.accentLight,
  },
  {
    type:     'website',
    icon:     '🌐',
    title:    'Launch a business website + find customers',
    desc:     'Wren builds a professional website for your business, Reeve researches your market, and Shipyard runs your outreach campaigns. No database or React needed.',
    badge:    'Distribute',
    accent:   T.accent,
    accentBg: T.accentLight,
  },
  {
    type:     'both',
    icon:     '🚀',
    title:    'Both — website to grow, app to deliver',
    desc:     'Start with the Distribute path to get your business running and finding customers, then add a full web app as you scale. One project, both pipelines.',
    badge:    'Distribute + Build',
    accent:   T.amber,
    accentBg: T.amberLight,
  },
] as const;

type PathType = typeof PATHS[number]['type'];

export default function ProjectTypeChoiceScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate           = useNavigate();
  const [selected, setSelected] = useState<PathType | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function handleContinue() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('projects')
        .update({ project_type: selected })
        .eq('id', projectId!);
      if (err) throw err;

      if (selected === 'app') {
        // Existing Build wizard — skip this screen, go directly
        navigate(`/projects/${projectId}/setup/build-wizard`);
      } else {
        // Distribute wizard
        navigate(`/projects/${projectId}/distribute/wizard`);
      }
    } catch (err) {
      // Supabase PostgrestError is a plain object, not an Error instance — extract .message from both
      const msg =
        extractErrorMessage(err, 'Failed to save. Try again.');
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: T.text,
      padding: '48px 24px 100px', // 100px bottom = clears fixed footer
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 52 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Anchor size={17} color="#fff" />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: T.text }}>Shipyard</span>
      </div>

      {/* Headline */}
      <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 520 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.03em', color: T.text }}>
          What are you building?
        </h1>
        <p style={{ fontSize: 15, color: T.muted, margin: 0, lineHeight: 1.6 }}>
          Shipyard has two paths. Choose the one that matches what you're working on — you can always switch later.
        </p>
      </div>

      {/* Path cards */}
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {PATHS.map(path => {
          const isSel = selected === path.type;
          return (
            <button
              key={path.type}
              type="button"
              onClick={() => setSelected(path.type)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                padding: '20px', borderRadius: 16, textAlign: 'left',
                background: isSel ? path.accentBg : T.surface,
                border: `2px solid ${isSel ? path.accent : T.border}`,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.12s',
                boxShadow: isSel ? `0 0 0 1px ${path.accent}30` : 'none',
              }}
            >
              {/* Radio + icon */}
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: `2px solid ${isSel ? path.accent : T.border}`,
                  background: isSel ? path.accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>{path.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
                    {path.title}
                  </span>
                  {path.badge && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: path.accent, color: '#fff',
                      letterSpacing: '0.04em', flexShrink: 0,
                    }}>
                      {path.badge}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                  {path.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p style={{ marginTop: 4, fontSize: 12, color: T.faint, textAlign: 'center', maxWidth: 380 }}>
        Not sure? Start with "Build a web app" — it's the original Shipyard path.
      </p>

      {/* Fixed bottom bar — always visible regardless of viewport height */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(245,245,247,0.92)',
        backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${T.border}`,
        padding: '12px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        zIndex: 100,
      }}>
        {error && (
          <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>
        )}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected || saving}
          style={{
            padding: '13px 36px', borderRadius: 12,
            background: selected && !saving ? T.accent : T.border,
            color: selected && !saving ? '#fff' : T.faint,
            border: 'none', fontSize: 14, fontWeight: 600,
            cursor: selected && !saving ? 'pointer' : 'default',
            fontFamily: 'inherit', transition: 'all 0.12s',
            width: '100%', maxWidth: 520,
          }}
        >
          {saving ? 'Setting up…' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
