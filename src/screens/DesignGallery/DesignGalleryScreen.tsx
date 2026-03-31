/**
 * Design Gallery Screen — Build 037 (React) + Build 061 (Flow Map tab + prototype buttons)
 *
 * Route: /projects/:id/gallery
 *
 * Two tabs:
 *   Designs  — grid of screen mockup cards (screens with mockup_file set)
 *   Flow Map — live prototype viewer (SHIPYARD-PROTOTYPE.html injected with DB data)
 *              + "Open full prototype ↗" link + "Download prototype ↓" button
 *
 * Wren spec for the toolbar buttons: specs/061-prototype-buttons-READY.md
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase }                     from '@/lib/supabase';
import type { Screen }                  from '@/types/db';

// ── Types ─────────────────────────────────────────────────────────────────

interface ScreenConnection {
  id:          string;
  from_screen: string;
  to_screen:   string;
  label:       string;
}

interface MappedScreen {
  id:    string;
  label: string;
  sub:   string;
  icon:  string;
  cat:   string;
  file:  string | null;
  x:     number;
  y:     number;
}

type TabId = 'designs' | 'flowmap';

type DownloadState = 'idle' | 'loading' | 'error';

// ── Auto-layout (matches PrototypeViewerScreen) ────────────────────────────

const CAT_Y: Record<string, number> = {
  public: 80, onboarding: 230, core: 400, feedback: 570,
  analytics: 740, admin: 910, distribute: 1110,
};

function applyAutoLayout(screens: Screen[]): MappedScreen[] {
  const catCols: Record<string, number> = {};
  return screens.map((s) => {
    let x = s.flow_x ?? 0;
    let y = s.flow_y ?? 0;
    if (x === 0 && y === 0) {
      const col = catCols[s.flow_category] ?? 0;
      x = 60 + col * 220;
      y = CAT_Y[s.flow_category] ?? 80;
      catCols[s.flow_category] = col + 1;
    }
    return {
      id:    s.id,
      label: s.name,
      sub:   s.route ?? s.type ?? '',
      icon:  s.flow_icon     ?? '📄',
      cat:   s.flow_category ?? 'core',
      file:  s.mockup_file   ?? null,
      x,
      y,
    };
  });
}

function injectPrototypeData(
  html:        string,
  projectName: string,
  screens:     Screen[],
  connections: ScreenConnection[],
): string {
  const mapped     = applyAutoLayout(screens);
  const mappedConn = connections.map((c) => ({
    from: c.from_screen, to: c.to_screen, label: c.label,
  }));
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${projectName} — Prototype</title>`)
    .replace(/const SCREENS = \[[\s\S]*?\n\];/, `const SCREENS = ${JSON.stringify(mapped, null, 2)};`)
    .replace(/const CONNECTIONS = \[[\s\S]*?\n\];/, `const CONNECTIONS = ${JSON.stringify(mappedConn, null, 2)};`);
}

// ── Category label map ─────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  public:     'Public',
  onboarding: 'Onboarding',
  core:       'Core Builder',
  feedback:   'Feedback & QA',
  analytics:  'Analytics',
  admin:      'Admin',
  distribute: 'Distribute',
};

// ── Spinner keyframe (inline style tag) ────────────────────────────────────

const SPIN_CSS = `@keyframes dg-spin { to { transform: rotate(360deg); } }`;

// ── Screen ─────────────────────────────────────────────────────────────────

export default function DesignGalleryScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate          = useNavigate();

  const [projectName,  setProjectName]  = useState('');
  const [screens,      setScreens]      = useState<Screen[]>([]);
  const [connections,  setConnections]  = useState<ScreenConnection[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const [activeTab,    setActiveTab]    = useState<TabId>('designs');
  const [flowSrcDoc,   setFlowSrcDoc]   = useState<string | null>(null);
  const [flowBuilding, setFlowBuilding] = useState(false);

  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [toastMsg,      setToastMsg]      = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load project data ──────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [projectRes, screensRes, connectionsRes] = await Promise.all([
          supabase.from('projects').select('name').eq('id', projectId).single(),
          supabase
            .from('screens')
            .select('id, name, route, type, flow_x, flow_y, flow_icon, flow_category, mockup_file')
            .eq('project_id', projectId)
            .is('deleted_at', null)
            .order('flow_category')
            .order('name'),
          supabase
            .from('screen_connections')
            .select('id, from_screen, to_screen, label')
            .eq('project_id', projectId),
        ]);

        if (projectRes.error)     throw projectRes.error;
        if (screensRes.error)     throw screensRes.error;
        if (connectionsRes.error) throw connectionsRes.error;
        if (cancelled) return;

        setProjectName(projectRes.data.name);
        setScreens((screensRes.data     as Screen[])            ?? []);
        setConnections((connectionsRes.data as ScreenConnection[]) ?? []);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Build flow map srcDoc when switching to Flow Map tab ──────────────

  useEffect(() => {
    if (activeTab !== 'flowmap' || flowSrcDoc || loading) return;
    let cancelled = false;

    async function buildFlowMap() {
      setFlowBuilding(true);
      try {
        const res = await fetch('/prototype-template.html');
        if (!res.ok) throw new Error('Template unavailable');
        const templateHtml = await res.text();
        if (cancelled) return;
        const injected = injectPrototypeData(templateHtml, projectName, screens, connections);
        setFlowSrcDoc(injected);
      } catch {
        // Show blank iframe rather than blocking the tab
        setFlowSrcDoc('<html><body style="background:#0a0a0b;color:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:14px;">Could not load prototype template.</body></html>');
      } finally {
        if (!cancelled) setFlowBuilding(false);
      }
    }

    buildFlowMap();
    return () => { cancelled = true; };
  }, [activeTab, flowSrcDoc, loading, projectName, screens, connections]);

  // ── Toast helper ────────────────────────────────────────────────────────

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4000);
  }

  // ── Download handler ────────────────────────────────────────────────────

  async function handleDownload() {
    if (downloadState === 'loading' || !projectId) return;
    setDownloadState('loading');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const supabaseUrl = (supabase as { supabaseUrl?: string }).supabaseUrl
        ?? import.meta.env.VITE_SUPABASE_URL ?? '';
      const efUrl = `${supabaseUrl}/functions/v1/prototype-export?project_id=${projectId}`;

      const res = await fetch(efUrl, {
        headers: { authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob     = await res.blob();
      const blobUrl  = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = blobUrl;
      a.download     = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-prototype.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setTimeout(() => setDownloadState('idle'), 1500);
    } catch {
      setDownloadState('error');
      showToast('Export failed — try again');
      setTimeout(() => setDownloadState('idle'), 200);
    }
  }

  // ── Designs tab — group screens by category ────────────────────────────

  const screensWithMockup = screens.filter((s) => s.mockup_file);
  const groupedScreens    = screensWithMockup.reduce<Record<string, Screen[]>>((acc, s) => {
    const cat = s.flow_category ?? 'core';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  // ── Render ──────────────────────────────────────────────────────────────

  const CSS_VARS = `
    :root {
      --text:    #1a1a1a;
      --muted:   #6b7280;
      --border:  #e5e7eb;
      --surface: #fff;
      --accent:  #5b5bd6;
      --bg:      #f9fafb;
    }
  `;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f9fafb)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{CSS_VARS}{SPIN_CSS}</style>

      {/* ── Header ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '0 24px',
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Link
            to={`/projects/${projectId}`}
            style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}
          >
            ← {projectName || 'Project'}
          </Link>
          <span style={{ color: '#d1d5db', fontSize: 13 }}>/</span>
          <span style={{ color: '#1a1a1a', fontSize: 13, fontWeight: 500 }}>Design Gallery</span>
        </div>

        {/* Title + tab bar */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em' }}>
              🖼️ Design Gallery
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              {loading ? 'Loading…' : `${screensWithMockup.length} screens with designs`}
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginTop: 12 }}>
          {(['designs', 'flowmap'] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 18px',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid #5b5bd6' : '2px solid transparent',
                color: activeTab === tab ? '#5b5bd6' : '#6b7280',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'designs' ? 'Designs' : 'Flow Map'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '2px solid #e5e7eb', borderTopColor: '#5b5bd6',
            animation: 'dg-spin 0.8s linear infinite',
          }} />
        </div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
          <div>{error}</div>
        </div>
      ) : activeTab === 'designs' ? (
        // ── Designs tab ──────────────────────────────────────────────────
        <div style={{ padding: '24px 24px 48px' }}>
          {screensWithMockup.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '80px 0',
              color: '#6b7280',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>No mockups yet</div>
              <div style={{ fontSize: 13 }}>
                Designs appear here once Wren completes screen mockups.
              </div>
            </div>
          ) : (
            Object.entries(groupedScreens).map(([cat, catScreens]) => (
              <div key={cat} style={{ marginBottom: 32 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                  color: '#6b7280', textTransform: 'uppercase', marginBottom: 12,
                }}>
                  {CAT_LABELS[cat] ?? cat}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 16,
                }}>
                  {catScreens.map((screen) => (
                    <MockupCard key={screen.id} screen={screen} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // ── Flow Map tab ─────────────────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px',
            background: '#fff', borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginRight: 4 }}>
              Flow Map
            </span>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Zoom/pan hint label */}
            <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 6 }}>
              Scroll to zoom · Drag to pan
            </span>

            {/* Vertical divider */}
            <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 6px' }} />

            {/* "Open full prototype ↗" link */}
            <a
              href={`/projects/${projectId}/prototype`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12, fontWeight: 500,
                color: '#5b5bd6', textDecoration: 'none',
                padding: '5px 8px',
              }}
              onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseOut={(e)  => (e.currentTarget.style.textDecoration = 'none')}
            >
              Open full prototype ↗
            </a>

            {/* "Download prototype ↓" button */}
            <button
              onClick={handleDownload}
              disabled={downloadState === 'loading'}
              data-testid="download-prototype-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 32, padding: '0 12px',
                fontSize: 12, fontWeight: 500,
                color: downloadState === 'loading' ? '#9ca3af' : '#1a1a1a',
                background: 'transparent',
                border: `1px solid ${downloadState === 'loading' ? '#e5e7eb' : '#d1d5db'}`,
                borderRadius: 6, cursor: downloadState === 'loading' ? 'default' : 'pointer',
                opacity: downloadState === 'loading' ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
              onMouseOver={(e) => {
                if (downloadState !== 'loading') {
                  e.currentTarget.style.borderColor = '#5b5bd6';
                  e.currentTarget.style.color       = '#5b5bd6';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.color       = '#1a1a1a';
              }}
            >
              {downloadState === 'loading' && (
                <span style={{
                  display: 'inline-block',
                  width: 12, height: 12, borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: '#9ca3af',
                  animation: 'dg-spin 0.7s linear infinite',
                  flexShrink: 0,
                }} />
              )}
              {downloadState === 'loading' ? 'Downloading…' : 'Download prototype ↓'}
            </button>
          </div>

          {/* Prototype iframe */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0a0a0b' }}>
            {flowBuilding && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                flexDirection: 'column',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#5b5bd6',
                  animation: 'dg-spin 0.8s linear infinite',
                }} />
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Building flow map…</span>
              </div>
            )}
            {!flowBuilding && flowSrcDoc && (
              <iframe
                srcDoc={flowSrcDoc}
                sandbox="allow-scripts"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title={`${projectName} — Flow Map`}
              />
            )}
            {!flowBuilding && !flowSrcDoc && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: 12,
              }}>
                <div style={{ fontSize: 36 }}>🗺️</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No screens to map yet</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          ⚠️ {toastMsg}
        </div>
      )}
    </div>
  );
}

// ── MockupCard ─────────────────────────────────────────────────────────────

function MockupCard({ screen }: { screen: Screen }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-testid={`mockup-card-${screen.id}`}
      onMouseOver={() => setHovered(true)}
      onMouseOut={()  => setHovered(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hovered ? '#5b5bd6' : '#e5e7eb'}`,
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? '0 2px 12px rgba(91,91,214,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onClick={() => {
        if (screen.mockup_file) {
          window.open(`/mockups/${screen.mockup_file}`, '_blank');
        }
      }}
    >
      {/* Thumbnail placeholder */}
      <div style={{
        height: 130, background: '#f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, borderBottom: '1px solid #e5e7eb',
      }}>
        {screen.flow_icon ?? '📄'}
      </div>

      {/* Card footer */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>
          {screen.name}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {screen.route ?? screen.type ?? ''}
        </div>
      </div>
    </div>
  );
}
