/**
 * Screens Screen — Build 015
 *
 * Three view states:
 *   1. Empty state — Claude generation CTA
 *   2. Screens list — 3-column card grid with add screen slide-in
 *   3. Screen detail — breadcrumb with Features/Bugs/CRs tabs
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  listScreens,
  searchScreens,
  getScreen,
  getScreenFeatures,
  getScreenBugs,
  getScreenChangeRequests,
  createScreen,
  updateScreen,
  deleteScreen,
  addGeneratedScreens,
  getProgressDots,
} from '@/api/screens';
import type { ScreenSummary, ScreenType } from '@/types/db';
import { SCREEN_TYPE_COLORS } from '@/types/db';
import { supabase } from '@/lib/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ScreenType }) {
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      backgroundColor: SCREEN_TYPE_COLORS[type] + '22',
      color: SCREEN_TYPE_COLORS[type], textTransform: 'capitalize',
    }}>
      {type}
    </span>
  );
}

function CountChip({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)',
      border: '1px solid var(--color-border)',
    }}>
      {count} {label}
    </span>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ projectId, onScreensAdded }: {
  projectId:      string;
  onScreensAdded: () => void;
}) {
  const [description, setDescription]     = useState('');
  const [generating,  setGenerating]      = useState(false);
  const [suggestions, setSuggestions]     = useState<Array<{ name: string; route: string; type: ScreenType; checked: boolean }>>([]);
  const [adding,      setAdding]          = useState(false);
  const [showManual,  setShowManual]      = useState(false);
  const [error, setError]                 = useState('');

  async function handleGenerate() {
    if (!description.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/generate-screens', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ project_id: projectId, description }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { screens } = await res.json() as { screens: Array<{ name: string; route: string; type: ScreenType }> };
      setSuggestions(screens.map((s) => ({ ...s, checked: true })));
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddSelected() {
    const selected = suggestions.filter((s) => s.checked);
    if (!selected.length) return;
    setAdding(true);
    try {
      await addGeneratedScreens(projectId, selected.map(({ name, route, type }) => ({ name, route, type })));
      onScreensAdded();
    } catch (err) {
      setError(String(err));
    } finally {
      setAdding(false);
    }
  }

  if (suggestions.length > 0) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
          Review suggested screens
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--color-text-muted)' }}>
          Uncheck any you don't want, edit names inline, then add.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              border: '1px solid var(--color-border)', borderRadius: 8,
              backgroundColor: 'var(--color-surface)',
            }}>
              <input
                type="checkbox"
                data-testid={`suggestion-checkbox-${i}`}
                checked={s.checked}
                onChange={() => setSuggestions((prev) => prev.map((p, j) => j === i ? { ...p, checked: !p.checked } : p))}
              />
              <input
                value={s.name}
                onChange={(e) => setSuggestions((prev) => prev.map((p, j) => j === i ? { ...p, name: e.target.value } : p))}
                style={{
                  flex: 1, border: 'none', background: 'transparent', fontSize: 14,
                  color: 'var(--color-text)', fontWeight: 600, outline: 'none',
                }}
              />
              <code style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.route}</code>
              <TypeBadge type={s.type} />
            </div>
          ))}
        </div>

        {error && <p style={{ color: '#ff3b30', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            data-testid="add-selected-btn"
            onClick={handleAddSelected}
            disabled={adding || !suggestions.some((s) => s.checked)}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              backgroundColor: 'var(--color-accent)', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              opacity: adding ? 0.6 : 1,
            }}
          >
            {adding ? 'Adding…' : `Add ${suggestions.filter((s) => s.checked).length} selected screens`}
          </button>
          <button
            onClick={() => setSuggestions([])}
            style={{
              padding: '10px 16px', borderRadius: 8,
              border: '1px solid var(--color-border)', backgroundColor: 'transparent',
              color: 'var(--color-text)', cursor: 'pointer', fontSize: 14,
            }}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🖥</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
        Start by describing your app's screens
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-muted)' }}>
        Claude will suggest a screen architecture you can review and edit before adding.
      </p>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe your app and its main screens — e.g. 'A task management app with dashboard, task list, settings, and a project view'"
        rows={4}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 8, fontSize: 14,
          border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)', resize: 'vertical', boxSizing: 'border-box',
          marginBottom: 12,
        }}
      />

      {error && <p style={{ color: '#ff3b30', fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <button
        data-testid="generate-screens-btn"
        onClick={handleGenerate}
        disabled={generating || !description.trim()}
        style={{
          width: '100%', padding: '12px', borderRadius: 8, border: 'none',
          backgroundColor: 'var(--color-accent)', color: '#fff',
          fontWeight: 700, fontSize: 15, cursor: 'pointer',
          opacity: (generating || !description.trim()) ? 0.6 : 1,
          marginBottom: 12,
        }}
      >
        {generating ? 'Generating…' : 'Generate screens →'}
      </button>

      <button
        onClick={() => setShowManual(true)}
        style={{
          background: 'none', border: 'none', color: 'var(--color-accent)',
          cursor: 'pointer', fontSize: 14, textDecoration: 'underline',
        }}
      >
        Or add manually
      </button>

      {showManual && (
        <AddScreenPanel
          projectId={projectId}
          onAdded={onScreensAdded}
          onClose={() => setShowManual(false)}
        />
      )}
    </div>
  );
}

// ── Add screen slide-in panel ──────────────────────────────────────────────

function AddScreenPanel({ projectId, onAdded, onClose }: {
  projectId: string;
  onAdded:   () => void;
  onClose:   () => void;
}) {
  const [name,        setName]        = useState('');
  const [type,        setType]        = useState<ScreenType>('page');
  const [route,       setRoute]       = useState('');
  const [showRoute,   setShowRoute]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createScreen(projectId, { name: name.trim(), type, route: route || undefined });
      onAdded();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('23505')) {
        setError(`Route ${route} is already used by another screen.`);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div style={{
        width: 360, height: '100%', backgroundColor: 'var(--color-surface)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', padding: 24, gap: 16,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
            Add screen
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
            Screen name *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dashboard"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 14,
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
            Screen type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ScreenType)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 14,
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', cursor: 'pointer',
            }}
          >
            {(['page', 'modal', 'auth', 'dashboard'] as ScreenType[]).map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowRoute((p) => !p)}
          style={{
            background: 'none', border: 'none', color: 'var(--color-accent)',
            cursor: 'pointer', fontSize: 13, textAlign: 'left', padding: 0,
            textDecoration: 'underline',
          }}
        >
          {showRoute ? '▾ Hide advanced' : '▸ Advanced (route)'}
        </button>

        {showRoute && (
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
              Route
            </label>
            <input
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="/dashboard"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 14,
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)', boxSizing: 'border-box', fontFamily: 'monospace',
              }}
            />
          </div>
        )}

        {error && <p style={{ color: '#ff3b30', fontSize: 13, margin: 0 }}>{error}</p>}

        <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              backgroundColor: 'var(--color-accent)', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              opacity: (saving || !name.trim()) ? 0.6 : 1,
            }}
          >
            {saving ? 'Adding…' : 'Add screen'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px', borderRadius: 8,
              border: '1px solid var(--color-border)', backgroundColor: 'transparent',
              color: 'var(--color-text)', cursor: 'pointer', fontSize: 14,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Screen card ────────────────────────────────────────────────────────────

function ScreenCard({ screen, projectId }: { screen: ScreenSummary; projectId: string }) {
  return (
    <Link
      to={`/projects/${projectId}/screens/${screen.id}`}
      data-testid={`screen-card-${screen.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 10,
        backgroundColor: 'var(--color-surface)', padding: 16,
        transition: 'box-shadow 0.15s, transform 0.15s', cursor: 'pointer',
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            {screen.name}
          </h3>
          <TypeBadge type={screen.type} />
        </div>
        {screen.route && (
          <code style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 10 }}>
            {screen.route}
          </code>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <CountChip count={screen.feature_count}    label="features" />
          <CountChip count={screen.open_bug_count}   label="bugs" />
          <CountChip count={screen.pending_cr_count} label="requests" />
        </div>
      </div>
    </Link>
  );
}

// ── Screen detail ──────────────────────────────────────────────────────────

function ScreenDetail({ screenId, projectId }: { screenId: string; projectId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') ?? 'features') as 'features' | 'bugs' | 'change-requests';

  const [screen,   setScreen]   = useState<ScreenSummary | null>(null);
  const [features, setFeatures] = useState<unknown[]>([]);
  const [bugs,     setBugs]     = useState<unknown[]>([]);
  const [crs,      setCrs]      = useState<unknown[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    getScreen(screenId).then(setScreen).catch(console.error);

    if (tab === 'features') {
      getScreenFeatures(screenId).then(setFeatures).catch(console.error).finally(() => setLoading(false));
    } else if (tab === 'bugs') {
      getScreenBugs(screenId).then(setBugs).catch(console.error).finally(() => setLoading(false));
    } else {
      getScreenChangeRequests(screenId).then(setCrs).catch(console.error).finally(() => setLoading(false));
    }
  }, [screenId, tab]);

  function setTab(t: 'features' | 'bugs' | 'change-requests') {
    setSearchParams({ tab: t });
    setLoading(true);
  }

  if (!screen) return <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Loading…</div>;

  const tabs = [
    { key: 'features',        label: `Features (${screen.feature_count})` },
    { key: 'bugs',            label: `Bugs (${screen.open_bug_count})` },
    { key: 'change-requests', label: `Changes (${screen.pending_cr_count})` },
  ] as const;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        <Link to={`/projects/${projectId}/screens`} style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
          Screens
        </Link>
        {' → '}
        <span>{screen.name}</span>
      </div>

      {/* Header */}
      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 10,
        backgroundColor: 'var(--color-surface)', padding: '16px 20px',
        marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--color-text)' }}>
              {screen.name}
            </h2>
            <TypeBadge type={screen.type} />
          </div>
          {screen.route && (
            <code style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{screen.route}</code>
          )}
        </div>
        <button style={{
          padding: '7px 14px', borderRadius: 6, border: '1px solid var(--color-border)',
          backgroundColor: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13,
        }}>
          ✏️ Edit
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: tab === key ? 700 : 400,
              color: tab === key ? 'var(--color-text)' : 'var(--color-text-muted)',
              borderBottom: tab === key ? '2px solid var(--color-accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading…</p>}

      {!loading && tab === 'features' && (
        features.length === 0
          ? <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No features yet. Add a feature to get started.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(features as Array<{
                id: string; name: string; maturity: string;
                workflow_step: number; complexity: string; priority: string;
              }>).map((f) => {
                const dots = getProgressDots(f.workflow_step);
                return (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    border: '1px solid var(--color-border)', borderRadius: 8,
                    backgroundColor: 'var(--color-surface)',
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                        {f.name}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                        {f.complexity} · {f.maturity} · {f.priority.toUpperCase()}
                      </p>
                    </div>
                    {/* Progress dots */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {dots.map((d) => (
                        <div
                          key={d.step}
                          title={d.label}
                          style={{
                            width: 10, height: 10, borderRadius: '50%',
                            backgroundColor: d.complete ? 'var(--color-accent)' : 'var(--color-border)',
                          }}
                        />
                      ))}
                    </div>
                    <Link
                      to={`/projects/${projectId}/features/${f.id}`}
                      style={{ fontSize: 12, color: 'var(--color-accent)', textDecoration: 'none' }}
                    >
                      Open →
                    </Link>
                  </div>
                );
              })}
            </div>
          )
      )}

      {!loading && tab === 'bugs' && (
        bugs.length === 0
          ? <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No bugs reported for this screen.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(bugs as Array<{ id: string; title: string; severity: string; status: string }>).map((b) => (
                <div key={b.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', border: '1px solid var(--color-border)',
                  borderRadius: 8, backgroundColor: 'var(--color-surface)',
                }}>
                  <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{b.title}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      backgroundColor: b.severity === 'p0' ? '#ff3b3022' : 'var(--color-bg)',
                      color: b.severity === 'p0' ? '#ff3b30' : 'var(--color-text-muted)',
                    }}>
                      {b.severity.toUpperCase()}
                    </span>
                    <span style={{
                      padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)',
                      textTransform: 'capitalize',
                    }}>
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      {!loading && tab === 'change-requests' && (
        crs.length === 0
          ? <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No change requests for this screen.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(crs as Array<{ id: string; title?: string; description?: string; status: string; submitter_email?: string }>).map((c) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', border: '1px solid var(--color-border)',
                  borderRadius: 8, backgroundColor: 'var(--color-surface)',
                }}>
                  <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                    {c.title ?? c.description ?? 'No description'}
                  </span>
                  <span style={{
                    padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    backgroundColor: c.status === 'pending' ? '#fff3cd' : 'var(--color-bg)',
                    color: c.status === 'pending' ? '#92400e' : 'var(--color-text-muted)',
                    textTransform: 'capitalize',
                  }}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function ScreensScreen() {
  const { id: projectId, screenId } = useParams<{ id: string; screenId?: string }>();

  const [screens,     setScreens]    = useState<ScreenSummary[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [isEmpty,     setIsEmpty]    = useState(false);
  const [showAdd,     setShowAdd]    = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter,  setTypeFilter]  = useState<ScreenType | ''>('');

  const loadScreens = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      if (searchQuery || typeFilter) {
        const data = await searchScreens(projectId, {
          query: searchQuery || undefined,
          type:  typeFilter || undefined,
        });
        setScreens(data);
        setIsEmpty(data.length === 0 && !searchQuery && !typeFilter);
      } else {
        const data = await listScreens(projectId);
        setScreens(data);
        setIsEmpty(data.length === 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, searchQuery, typeFilter]);

  useEffect(() => { loadScreens(); }, [loadScreens]);

  // Screen detail view
  if (screenId) {
    return <ScreenDetail screenId={screenId} projectId={projectId!} />;
  }

  // Empty state
  if (!loading && isEmpty) {
    return (
      <EmptyState
        projectId={projectId!}
        onScreensAdded={loadScreens}
      />
    );
  }

  // Screens list
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--color-text)' }}>
            Screens
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            {screens.length} screen{screens.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            padding: '9px 18px', borderRadius: 8, border: 'none',
            backgroundColor: 'var(--color-accent)', color: '#fff',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          + Add screen
        </button>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          data-testid="screen-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search screens…"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 14,
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
        />
        <select
          data-testid="type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ScreenType | '')}
          style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 14,
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)', cursor: 'pointer',
          }}
        >
          <option value="">All types</option>
          {(['page', 'modal', 'auth', 'dashboard'] as ScreenType[]).map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading screens…</p>
      ) : screens.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No screens match your search.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}>
          {screens.map((screen) => (
            <ScreenCard key={screen.id} screen={screen} projectId={projectId!} />
          ))}
        </div>
      )}

      {/* Add screen panel */}
      {showAdd && (
        <AddScreenPanel
          projectId={projectId!}
          onAdded={loadScreens}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
