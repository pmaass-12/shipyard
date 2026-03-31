/**
 * Prototype Viewer Screen — Build 061
 *
 * Full-screen interactive prototype at /projects/:id/prototype
 * Fetches live screens + connections from Supabase, injects into
 * SHIPYARD-PROTOTYPE.html template, renders as sandboxed iframe.
 *
 * No surrounding Shipyard chrome — the prototype fills the viewport.
 * A minimal top bar provides the back link and project name.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase }              from '@/lib/supabase';
import type { Screen }           from '@/types/db';

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

interface MappedConnection {
  from:  string;
  to:    string;
  label: string;
}

// ── Auto-layout ───────────────────────────────────────────────────────────

// Matches CAT_Y order used in SHIPYARD-PROTOTYPE.html
const CAT_Y: Record<string, number> = {
  public:     80,
  onboarding: 230,
  core:       400,
  feedback:   570,
  analytics:  740,
  admin:      910,
  distribute: 1110,
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
      icon:  s.flow_icon  ?? '📄',
      cat:   s.flow_category ?? 'core',
      file:  s.mockup_file ?? null,
      x,
      y,
    };
  });
}

// ── Template injection ─────────────────────────────────────────────────────

function injectPrototypeData(
  html:        string,
  projectName: string,
  screens:     Screen[],
  connections: ScreenConnection[],
): string {
  const mappedScreens: MappedScreen[]        = applyAutoLayout(screens);
  const mappedConnections: MappedConnection[] = connections.map((c) => ({
    from:  c.from_screen,
    to:    c.to_screen,
    label: c.label,
  }));

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${projectName} — Prototype</title>`)
    .replace(
      /const SCREENS = \[[\s\S]*?\n\];/,
      `const SCREENS = ${JSON.stringify(mappedScreens, null, 2)};`,
    )
    .replace(
      /const CONNECTIONS = \[[\s\S]*?\n\];/,
      `const CONNECTIONS = ${JSON.stringify(mappedConnections, null, 2)};`,
    );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function PrototypeViewerScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate          = useNavigate();

  const [projectName, setProjectName] = useState('');
  const [srcDoc,      setSrcDoc]      = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 1. Project name
        const { data: project, error: pErr } = await supabase
          .from('projects')
          .select('name')
          .eq('id', projectId)
          .single();
        if (pErr || !project) throw new Error('Project not found');

        // 2. Screens + connections (parallel)
        const [screensRes, connectionsRes, templateRes] = await Promise.all([
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
          fetch('/prototype-template.html'),
        ]);

        if (screensRes.error)     throw screensRes.error;
        if (connectionsRes.error) throw connectionsRes.error;
        if (!templateRes.ok)      throw new Error('Prototype template unavailable');

        const templateHtml = await templateRes.text();
        if (cancelled) return;

        const injected = injectPrototypeData(
          templateHtml,
          project.name,
          (screensRes.data   as Screen[])            ?? [],
          (connectionsRes.data as ScreenConnection[]) ?? [],
        );

        setProjectName(project.name);
        setSrcDoc(injected);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load prototype');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0b' }}>
      {/* Minimal top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        height: 44, flexShrink: 0,
        padding: '0 16px',
        background: '#111113',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <button
          onClick={() => navigate(`/projects/${projectId}/gallery`)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: '4px 0',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          aria-label="Back to Design Gallery"
        >
          ← Design Gallery
        </button>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>/</span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>
          {projectName || 'Prototype'} — Flow Map
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
          🗺️ Live prototype
        </span>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: '#5b5bd6',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading prototype…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12,
          }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 500 }}>
              Could not load prototype
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{error}</div>
            <button
              onClick={() => navigate(`/projects/${projectId}/gallery`)}
              style={{
                marginTop: 8, padding: '8px 20px',
                background: '#5b5bd6', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              Back to Design Gallery
            </button>
          </div>
        )}

        {!loading && !error && srcDoc && (
          <iframe
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            title={`${projectName} — Prototype`}
          />
        )}

        {!loading && !error && !srcDoc && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12,
          }}>
            <div style={{ fontSize: 40 }}>🗺️</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>
              No screens added yet
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              Add screens in the Screens Builder to see the flow map.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
