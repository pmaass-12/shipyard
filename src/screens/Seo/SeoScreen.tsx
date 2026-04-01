/**
 * SeoScreen — Build 010
 *
 * Route: /projects/:id/seo
 *
 * Displays SEO / AEO settings for a project in a read-only card layout.
 * Each field card has Edit + Regenerate buttons for inline editing.
 *
 * Locked state (alpha phase): gate card + blurred preview cards.
 * Active state (beta/live): full interactive cards with Claude-drafted content.
 *
 * Design spec: specs/010-seo-aeo-READY.md
 * Contract:    contracts/010-seo-aeo-READY.md
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  getSeoSettings,
  updateSeoField,
  keywordsToText,
  textToKeywords,
} from '@/api/seo';
import { getProjectSummary } from '@/api/projects';
import { useToast } from '@/context/ToastContext';
import type { SeoSettings, SeoSettingsPatch, ProjectSummary, RobotsDirective } from '@/types/db';
import { seoIsDirty } from '@/types/db';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

// ── Design tokens ─────────────────────────────────────────────────────────

const T = {
  bg:       'var(--color-bg, #f5f5f7)',
  surface:  'var(--color-surface, #ffffff)',
  surface2: 'var(--color-surface-2, #f9f9fb)',
  border:   'var(--color-border, #e5e5ea)',
  text:     'var(--color-text, #1c1c1e)',
  text2:    'var(--color-text-muted, #636366)',
  text3:    'var(--color-text-subtle, #aeaeb2)',
  accent:   '#5b5bd6',
  green:    '#30d158',
  mono:     '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
};

// ── AEO tooltip copy ──────────────────────────────────────────────────────

const AEO_TOOLTIPS: Record<string, string> = {
  llms_txt:       'A plain-text file at /llms.txt that instructs AI crawlers what your app does, similar to robots.txt but for LLMs.',
  json_ld:        'Structured data in JSON-LD format, injected into <script type="application/ld+json"> — helps search engines and AI understand your app\'s type and features.',
  ai_description: 'A 2-3 sentence plain-language description written for AI assistants that may summarise your app in chat interfaces.',
};

// ── Tiny components ───────────────────────────────────────────────────────

function AeoTooltip({ field }: { field: string }) {
  const [visible, setVisible] = useState(false);
  const tip = AEO_TOOLTIPS[field];
  if (!tip) return null;
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{
          width: 16, height: 16, borderRadius: '50%',
          background: T.border, border: 'none',
          fontSize: 10, color: T.text2, cursor: 'default',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >?</button>
      {visible && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, width: 240, padding: '8px 10px',
          background: '#1c1c1e', color: '#e8e8ea', borderRadius: 8,
          fontSize: 11, lineHeight: 1.5, zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
          pointerEvents: 'none',
        }}>
          {tip}
        </div>
      )}
    </span>
  );
}

function DraftedBadge() {
  return (
    <span style={{
      background: 'rgba(91,91,214,.1)', color: T.accent,
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      padding: '2px 9px', display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      ✦ Claude-drafted
    </span>
  );
}

function PublishBadge({ dirty }: { dirty: boolean }) {
  return (
    <span style={{
      background: dirty ? 'rgba(255,159,10,.1)' : 'rgba(48,209,88,.1)',
      color:       dirty ? '#ff9f0a' : T.green,
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      padding: '2px 9px',
    }}>
      {dirty ? 'Unpublished changes' : 'Published'}
    </span>
  );
}

// ── Field card ────────────────────────────────────────────────────────────

interface FieldCardProps {
  label:     string;
  fieldKey:  keyof SeoSettingsPatch | string;
  value:     string;
  mono?:     boolean;
  aeoField?: boolean;
  onSave:    (key: string, value: string) => Promise<void>;
  onRegen:   (key: string) => Promise<void>;
  hint?:     string;
}

function FieldCard({
  label, fieldKey, value, mono, aeoField, onSave, onRegen, hint,
}: FieldCardProps) {
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [regen,    setRegen]    = useState(false);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(fieldKey, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRegen() {
    setRegen(true);
    try { await onRegen(fieldKey); }
    finally { setRegen(false); }
  }

  return (
    <div style={{
      background: T.surface, borderRadius: 12, padding: '16px 20px',
      marginBottom: 14, border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</span>
          {aeoField && <AeoTooltip field={fieldKey} />}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleRegen}
            disabled={regen}
            title="Regenerate with Claude"
            style={{
              padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${T.border}`, background: T.surface2,
              color: T.text2, fontSize: 12, cursor: regen ? 'not-allowed' : 'pointer',
              opacity: regen ? 0.5 : 1,
            }}
          >
            {regen ? '…' : '↺'}
          </button>
          {!editing && (
            <button
              onClick={startEdit}
              style={{
                padding: '4px 12px', borderRadius: 6,
                border: `1px solid ${T.border}`, background: T.surface2,
                color: T.text2, fontSize: 12, cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.surface2, border: `1px solid ${T.border}`,
              borderRadius: 8, color: T.text,
              fontSize: mono ? 12 : 14,
              fontFamily: mono ? T.mono : 'inherit',
              padding: '10px 12px', outline: 'none',
              resize: 'vertical', minHeight: mono ? 140 : 72,
            }}
          />
          {hint && <p style={{ fontSize: 11, color: T.text3, margin: '4px 0 8px' }}>{hint}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: '6px 14px', borderRadius: 7,
                border: `1px solid ${T.border}`, background: T.surface2,
                color: T.text2, fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 14px', borderRadius: 7,
                border: 'none', background: T.accent,
                color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          fontSize: mono ? 12 : 14,
          fontFamily: mono ? T.mono : 'inherit',
          color: value ? T.text : T.text3,
          lineHeight: 1.6,
          whiteSpace: mono ? 'pre-wrap' : 'normal',
          background: mono ? T.surface2 : 'transparent',
          borderRadius: mono ? 8 : 0,
          padding: mono ? '10px 12px' : 0,
          wordBreak: 'break-word',
        }}>
          {value || <em>Not set</em>}
        </div>
      )}
    </div>
  );
}

// ── Keywords card ─────────────────────────────────────────────────────────

function KeywordsCard({
  keywords, onSave, onRegen,
}: {
  keywords: string[] | null;
  onSave:   (key: string, value: string) => Promise<void>;
  onRegen:  (key: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [regen,   setRegen]   = useState(false);

  function startEdit() {
    setDraft(keywordsToText(keywords));
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave('keywords', draft);
      setEditing(false);
    } finally { setSaving(false); }
  }

  async function handleRegen() {
    setRegen(true);
    try { await onRegen('keywords'); }
    finally { setRegen(false); }
  }

  const pills = keywords ?? [];

  return (
    <div style={{
      background: T.surface, borderRadius: 12, padding: '16px 20px',
      marginBottom: 14, border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Keywords</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleRegen} disabled={regen} title="Regenerate"
            style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface2, color: T.text2, fontSize: 12, cursor: regen ? 'not-allowed' : 'pointer', opacity: regen ? 0.5 : 1 }}
          >{regen ? '…' : '↺'}</button>
          {!editing && <button onClick={startEdit} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface2, color: T.text2, fontSize: 12, cursor: 'pointer' }}>Edit</button>}
        </div>
      </div>
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="react, saas, dashboard, analytics, …"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.surface2, border: `1px solid ${T.border}`,
              borderRadius: 8, color: T.text, fontSize: 13,
              padding: '9px 12px', outline: 'none', resize: 'none', minHeight: 60,
            }}
          />
          <p style={{ fontSize: 11, color: T.text3, margin: '4px 0 8px' }}>
            Comma-separated values
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface2, color: T.text2, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: T.accent, color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : pills.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pills.map(k => (
            <span key={k} style={{
              background: 'rgba(91,91,214,.1)', color: T.accent,
              borderRadius: 20, fontSize: 12, padding: '3px 10px', fontWeight: 500,
            }}>{k}</span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: T.text3 }}><em>Not set</em></div>
      )}
    </div>
  );
}

// ── Robots + Sitemap card (combined 2-col) ────────────────────────────────

function RobotsCard({
  directive, sitemapEnabled, onRobotsChange, onSitemapChange,
}: {
  directive:       RobotsDirective;
  sitemapEnabled:  boolean;
  onRobotsChange:  (v: RobotsDirective) => Promise<void>;
  onSitemapChange: (v: boolean) => Promise<void>;
}) {
  const [savingRobots,  setSavingRobots]  = useState(false);
  const [savingSitemap, setSavingSitemap] = useState(false);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14,
    }}>
      {/* Robots */}
      <div style={{ background: T.surface, borderRadius: 12, padding: '16px 20px', border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>Robots directive</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['index', 'noindex'] as RobotsDirective[]).map(v => (
            <button
              key={v}
              onClick={async () => {
                if (v === directive || savingRobots) return;
                setSavingRobots(true);
                try { await onRobotsChange(v); }
                finally { setSavingRobots(false); }
              }}
              style={{
                padding: '6px 16px', borderRadius: 20,
                border: `1px solid ${v === directive ? T.accent : T.border}`,
                background: v === directive ? 'rgba(91,91,214,.1)' : T.surface2,
                color: v === directive ? T.accent : T.text2,
                fontSize: 13, fontWeight: v === directive ? 600 : 400,
                cursor: v === directive ? 'default' : 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {/* Sitemap */}
      <div style={{ background: T.surface, borderRadius: 12, padding: '16px 20px', border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>Sitemap</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: T.text2 }}>Auto-generate sitemap.xml</span>
          <button
            onClick={async () => {
              if (savingSitemap) return;
              setSavingSitemap(true);
              try { await onSitemapChange(!sitemapEnabled); }
              finally { setSavingSitemap(false); }
            }}
            style={{
              width: 44, height: 26, borderRadius: 13, border: 'none',
              background: sitemapEnabled ? T.green : '#d1d1d6',
              cursor: 'pointer', position: 'relative', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: sitemapEnabled ? 21 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Locked state ──────────────────────────────────────────────────────────

function LockedState({ projectName }: { projectName: string }) {
  const PREVIEW_FIELDS = [
    { label: 'Meta Title', hint: 'SEO-optimized page title · 60 chars max' },
    { label: 'Meta Description', hint: '150–160 chars · shown in search results' },
    { label: 'OG Title + Image', hint: 'Social sharing preview' },
    { label: 'Keywords', hint: 'Target search terms as pill tags' },
    { label: 'llms.txt (AEO)', hint: 'Plain-text AI crawler instructions' },
    { label: 'JSON-LD (AEO)', hint: 'Structured data for Schema.org' },
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
      {/* Gate card */}
      <div style={{
        background: T.surface, borderRadius: 16, padding: '32px',
        border: `1px solid ${T.border}`, textAlign: 'center', marginBottom: 32,
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: T.text }}>
          SEO / AEO Settings
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: T.text2, lineHeight: 1.6 }}>
          Claude will draft all SEO and AEO metadata automatically when you advance{' '}
          <strong>{projectName}</strong> to Beta phase.
        </p>
        {/* Phase progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          {(['Alpha', 'Beta', 'Live'] as const).map((ph, i) => (
            <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: i === 0 ? T.accent : T.surface2,
                color: i === 0 ? '#fff' : T.text3,
              }}>{ph}</span>
              {i < 2 && <span style={{ color: T.text3 }}>→</span>}
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: T.text3 }}>
          Advance to Beta in Project Settings → Platform Features to unlock
        </p>
      </div>

      {/* Blurred preview */}
      <div style={{ position: 'relative' }}>
        <div style={{ filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' }}>
          {PREVIEW_FIELDS.map(f => (
            <div key={f.label} style={{
              background: T.surface, borderRadius: 12, padding: '16px 20px',
              marginBottom: 14, border: `1px solid ${T.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{f.label}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ padding: '4px 10px', borderRadius: 6, background: T.surface2, fontSize: 12, color: T.text3 }}>↺</span>
                  <span style={{ padding: '4px 12px', borderRadius: 6, background: T.surface2, fontSize: 12, color: T.text3 }}>Edit</span>
                </div>
              </div>
              <div style={{ height: 16, background: T.border, borderRadius: 4, width: '65%' }} />
              <div style={{ fontSize: 11, color: T.text3, marginTop: 6 }}>{f.hint}</div>
            </div>
          ))}
        </div>
        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(245,245,247,.6)',
          borderRadius: 12, pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function SeoScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const { showToast }      = useToast();

  const [project,  setProject]  = useState<ProjectSummary | null>(null);
  const [seo,      setSeo]      = useState<SeoSettings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [regenAll, setRegenAll] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [proj, seoRow] = await Promise.all([
        getProjectSummary(projectId),
        getSeoSettings(projectId),
      ]);
      setProject(proj);
      setSeo(seoRow);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load SEO settings'), 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleSaveField(key: string, rawValue: string) {
    if (!projectId || !seo) return;
    let patch: SeoSettingsPatch;
    if (key === 'keywords') {
      patch = { keywords: textToKeywords(rawValue) };
    } else if (key === 'json_ld') {
      try {
        patch = { json_ld: JSON.parse(rawValue) as Record<string, unknown> };
      } catch {
        showToast('Invalid JSON — please check the format', 'error');
        return;
      }
    } else {
      patch = { [key]: rawValue } as SeoSettingsPatch;
    }
    try {
      const updated = await updateSeoField(projectId, patch);
      setSeo(updated);
      showToast('Saved');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Save failed — try again'), 'error');
    }
  }

  async function handleRegenField(field: string) {
    if (!projectId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/generate-seo', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ project_id: projectId, field }),
    });
    if (!res.ok) {
      showToast('Regeneration failed — try again', 'error');
      return;
    }
    const updated: SeoSettings = await res.json() as SeoSettings;
    setSeo(updated);
    showToast('Field regenerated');
  }

  async function handleRegenAll() {
    if (!projectId) return;
    setRegenAll(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/generate-seo', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const updated: SeoSettings = await res.json() as SeoSettings;
      setSeo(updated);
      showToast('All SEO / AEO fields regenerated');
    } catch {
      showToast('Regeneration failed — try again', 'error');
    } finally {
      setRegenAll(false);
    }
  }

  async function handleRobotsChange(v: RobotsDirective) {
    if (!projectId) return;
    try {
      const updated = await updateSeoField(projectId, { robots_directive: v });
      setSeo(updated);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Save failed'), 'error');
    }
  }

  async function handleSitemapChange(v: boolean) {
    if (!projectId) return;
    try {
      const updated = await updateSeoField(projectId, { sitemap_enabled: v });
      setSeo(updated);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Save failed'), 'error');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: T.text2 }}>Loading…</div>
      </div>
    );
  }

  const isAlpha = project?.phase === 'alpha';
  const dirty = seo ? seoIsDirty(seo) : false;

  if (isAlpha) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <LockedState projectName={project?.name ?? 'this project'} />
      </div>
    );
  }

  // Active state
  const jsonLdValue = seo?.json_ld ? JSON.stringify(seo.json_ld, null, 2) : '';

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22 }}>🔍</span>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text }}>SEO / AEO</h1>
              {seo?.generated_at && <DraftedBadge />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: T.text2 }}>{project?.name}</span>
              {seo && <PublishBadge dirty={dirty} />}
            </div>
          </div>
          {seo && (
            <button
              onClick={handleRegenAll}
              disabled={regenAll}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.surface,
                color: T.accent, fontSize: 13, fontWeight: 600,
                cursor: regenAll ? 'not-allowed' : 'pointer',
                opacity: regenAll ? 0.5 : 1,
              }}
            >
              {regenAll ? 'Generating…' : '✦ Regenerate all'}
            </button>
          )}
        </div>

        {/* No SEO row yet */}
        {!seo && (
          <div style={{
            background: T.surface, borderRadius: 16, padding: '36px',
            border: `1px solid ${T.border}`, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
            <p style={{ margin: '0 0 16px', fontSize: 15, color: T.text2 }}>
              No SEO settings drafted yet. Generate a first draft with Claude.
            </p>
            <button
              onClick={handleRegenAll}
              disabled={regenAll}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: T.accent, color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: regenAll ? 'not-allowed' : 'pointer',
                opacity: regenAll ? 0.6 : 1,
              }}
            >
              {regenAll ? 'Generating…' : '✦ Generate with Claude'}
            </button>
          </div>
        )}

        {seo && <>
          {/* ── SEO Section ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 14 }}>🌐</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>SEO</span>
          </div>

          <FieldCard
            label="Meta Title"
            fieldKey="meta_title"
            value={seo.meta_title ?? ''}
            onSave={handleSaveField}
            onRegen={handleRegenField}
            hint="60 chars max · shown in browser tab + search results"
          />
          <FieldCard
            label="Meta Description"
            fieldKey="meta_description"
            value={seo.meta_description ?? ''}
            onSave={handleSaveField}
            onRegen={handleRegenField}
            hint="150–160 chars · shown below the title in search results"
          />

          {/* OG Title + OG Image in 2-col grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div style={{ background: T.surface, borderRadius: 12, padding: '16px 20px', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>OG Title</div>
              <div style={{ fontSize: 13, color: seo.og_title ? T.text : T.text3 }}>
                {seo.og_title ?? <em>Not set</em>}
              </div>
            </div>
            <div style={{ background: T.surface, borderRadius: 12, padding: '16px 20px', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>OG Image URL</div>
              <div style={{ fontSize: 12, color: seo.og_image_url ? T.accent : T.text3, wordBreak: 'break-all' }}>
                {seo.og_image_url ?? <em style={{ color: T.text3 }}>Not set — add a URL to enable link previews</em>}
              </div>
            </div>
          </div>

          <FieldCard
            label="OG Description"
            fieldKey="og_description"
            value={seo.og_description ?? ''}
            onSave={handleSaveField}
            onRegen={handleRegenField}
            hint="100 chars max · shown in social link previews"
          />

          <KeywordsCard
            keywords={seo.keywords}
            onSave={handleSaveField}
            onRegen={handleRegenField}
          />

          <RobotsCard
            directive={seo.robots_directive}
            sitemapEnabled={seo.sitemap_enabled}
            onRobotsChange={handleRobotsChange}
            onSitemapChange={handleSitemapChange}
          />

          {/* ── AEO Section ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '28px 0 14px' }}>
            <span style={{ fontSize: 14 }}>🤖</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>AEO</span>
            <span style={{
              background: 'rgba(91,91,214,.1)', color: T.accent,
              borderRadius: 20, fontSize: 10, fontWeight: 700,
              padding: '2px 8px', letterSpacing: '0.5px',
            }}>NEW</span>
          </div>

          <FieldCard
            label="llms.txt"
            fieldKey="llms_txt"
            value={seo.llms_txt ?? ''}
            mono
            aeoField
            onSave={handleSaveField}
            onRegen={handleRegenField}
            hint="Served at /llms.txt — instructs AI crawlers about your app"
          />
          <FieldCard
            label="JSON-LD Structured Data"
            fieldKey="json_ld"
            value={jsonLdValue}
            mono
            aeoField
            onSave={handleSaveField}
            onRegen={handleRegenField}
            hint="Injected as <script type=application/ld+json> — valid JSON only"
          />
          <FieldCard
            label="AI-Optimized Description"
            fieldKey="ai_description"
            value={seo.ai_description ?? ''}
            aeoField
            onSave={handleSaveField}
            onRegen={handleRegenField}
            hint="2-3 sentences for AI assistants that summarise your app"
          />

          {/* Generated/updated timestamps */}
          <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
            {seo.generated_at && (
              <span style={{ fontSize: 11, color: T.text3 }}>
                Generated {new Date(seo.generated_at).toLocaleString()}
              </span>
            )}
            <span style={{ fontSize: 11, color: T.text3 }}>
              Updated {new Date(seo.updated_at).toLocaleString()}
            </span>
          </div>
        </>}
      </div>
    </div>
  );
}
