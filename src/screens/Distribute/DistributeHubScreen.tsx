/**
 * DistributeHubScreen — Build 047
 *
 * Route: /projects/:id/distribute
 *
 * Project Hub for Distribute-path projects (project_type = 'website' | 'both').
 * Shows: 4-stage pipeline strip, CRM summary card, Reeve daily briefing, activity feed.
 *
 * Four states:
 *   1. Research running — spinner + Reeve greeting
 *   2. Research complete, awaiting approval — Research Brief card
 *   3. Website deployed, Leads running — 2-column layout
 *   4. All active — CRM summary + activity feed
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { BusinessResearch } from '@/types/db';

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
  green:       '#22c55e',
  greenLight:  '#f0fdf4',
  greenBorder: '#dcfce7',
  amber:       '#f59e0b',
  amberLight:  '#fffbeb',
  amberBorder: '#fde68a',
  sidebar: {
    bg:     '#1c1c1e',
    text:   '#e8e8ea',
    muted:  '#8e8e93',
    active: '#5b5bd6',
  },
};

// ── Pipeline stage config ──────────────────────────────────────────────────

type StageStatus = 'done' | 'running' | 'pending' | 'locked';

interface PipelineStage {
  key:    string;
  label:  string;
  icon:   string;
  route:  string;
}

const PIPELINE: PipelineStage[] = [
  { key: 'research', label: 'Research',  icon: '🔍', route: 'research' },
  { key: 'website',  label: 'Website',   icon: '🌐', route: 'website'  },
  { key: 'leads',    label: 'Leads',     icon: '🎯', route: 'leads'    },
  { key: 'outreach', label: 'Outreach',  icon: '📬', route: 'outreach' },
];

function stageCardStyle(status: StageStatus): React.CSSProperties {
  if (status === 'done')    return { background: T.greenLight,  border: `1px solid ${T.greenBorder}` };
  if (status === 'running') return { background: T.amberLight,  border: `1px solid ${T.amberBorder}` };
  return { background: T.surface, border: `1px solid ${T.border}` };
}

function stageDotStyle(status: StageStatus): React.CSSProperties {
  const base: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 };
  if (status === 'done')    return { ...base, background: T.green };
  if (status === 'running') return { ...base, background: T.amber, animation: 'pulse 1.5s infinite' };
  return { ...base, background: '#e4e4e8' };
}

// ── Sidebar ────────────────────────────────────────────────────────────────

function Sidebar({ projectId, active }: { projectId: string; active: string }) {
  const items = [
    { key: 'hub',      label: 'Project Hub',  route: `/projects/${projectId}/distribute`          },
    { key: 'research', label: 'Research',     route: `/projects/${projectId}/distribute/research` },
    { key: 'website',  label: 'Website',      route: `/projects/${projectId}/distribute/website`  },
    { key: 'leads',    label: 'Leads',        route: `/projects/${projectId}/distribute/leads`    },
    { key: 'outreach', label: 'Outreach',     route: `/projects/${projectId}/distribute/outreach` },
    { key: 'settings', label: 'Settings',     route: `/projects/${projectId}/setup`              },
  ];

  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: T.sidebar.bg,
      display: 'flex', flexDirection: 'column',
      padding: '24px 0',
      minHeight: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.sidebar.text, letterSpacing: '-0.02em' }}>
          Shipyard
          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: T.accent, color: '#fff', padding: '1px 6px', borderRadius: 8, letterSpacing: '0.06em' }}>
            DISTRIBUTE
          </span>
        </div>
      </div>

      <nav style={{ padding: '12px 12px', flex: 1 }}>
        {items.map(item => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              to={item.route}
              style={{
                display: 'block',
                padding: '9px 10px',
                borderRadius: 8,
                marginBottom: 2,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : T.sidebar.muted,
                background: isActive ? T.sidebar.active : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.12s',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '12px 20px', borderTop: `1px solid rgba(255,255,255,0.08)` }}>
        <Link to="/projects" style={{ fontSize: 12, color: T.sidebar.muted, textDecoration: 'none' }}>
          ← All projects
        </Link>
      </div>
    </div>
  );
}

// ── CRM summary card ───────────────────────────────────────────────────────

interface CrmStats { total: number; contacted: number; replied: number; meetings: number; }

function CrmSummaryCard({ stats, projectId }: { stats: CrmStats; projectId: string }) {
  const STAT_ITEMS = [
    { label: 'Total leads',     value: stats.total },
    { label: 'Contacted',       value: stats.contacted },
    { label: 'Replied',         value: stats.replied },
    { label: 'Meetings booked', value: stats.meetings },
  ];
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>CRM Summary</span>
        <Link to={`/projects/${projectId}/distribute/leads`} style={{ fontSize: 12, color: T.accent, textDecoration: 'none', fontWeight: 500 }}>
          View all leads →
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {STAT_ITEMS.map(stat => (
          <div key={stat.label}>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

interface ProjectRow {
  id: string;
  name: string;
  project_type: string;
}

export default function DistributeHubScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate          = useNavigate();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [research, setResearch] = useState<BusinessResearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  // Simplified stage detection based on research state
  const researchRunning  = !research;
  const researchApproved = !!research?.approved_at;
  const showBrief        = !!research && !researchApproved;

  useEffect(() => {
    if (!projectId) return;
    async function load() {
      setLoading(true);
      const [{ data: proj }, { data: res }] = await Promise.all([
        supabase.from('projects').select('id, name, project_type').eq('id', projectId!).single(),
        supabase.from('business_research').select('*').eq('project_id', projectId!).maybeSingle(),
      ]);
      setProject(proj);
      setResearch(res ?? null);
      setLoading(false);
    }
    load();
  }, [projectId]);

  async function handleApproveResearch() {
    if (!research || !projectId) return;
    setApproving(true);
    await supabase
      .from('business_research')
      .update({ approved_at: new Date().toISOString() })
      .eq('id', research.id);
    // Fire generate-website
    const { data: { session } } = await supabase.auth.getSession();
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-website`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ project_id: projectId }),
    }).catch(() => {});
    setResearch(r => r ? { ...r, approved_at: new Date().toISOString() } : r);
    setApproving(false);
  }

  const stageStatuses: Record<string, StageStatus> = {
    research: researchRunning ? 'running' : 'done',
    website:  !researchApproved ? 'locked' : 'pending',
    leads:    'pending',
    outreach: 'pending',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: T.bg }}>
        <Sidebar projectId={projectId!} active="hub" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: T.muted, fontSize: 14 }}>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: T.text }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <Sidebar projectId={projectId!} active="hub" />

      <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.03em' }}>
            {project?.name ?? 'Project Hub'}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Distribute pipeline</p>
        </div>

        {/* Pipeline strip */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
          {PIPELINE.map((stage, i) => {
            const status = stageStatuses[stage.key] ?? 'pending';
            return (
              <div key={stage.key} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    flex: 1, borderRadius: 12, padding: '14px 16px',
                    cursor: status !== 'locked' ? 'pointer' : 'default',
                    ...stageCardStyle(status),
                  }}
                  onClick={() => status !== 'locked' && navigate(`/projects/${projectId}/distribute/${stage.route}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{stage.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{stage.label}</span>
                    <div style={stageDotStyle(status)} />
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {status === 'done'    && 'Complete'}
                    {status === 'running' && 'In progress'}
                    {status === 'pending' && (stage.key === 'website' && !researchApproved ? 'Unlocks after approval' : 'Not started')}
                    {status === 'locked'  && 'Unlocks after approval'}
                  </div>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div style={{ width: 20, height: 1, background: T.border, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* State 1: Research running */}
        {researchRunning && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.accent}`, borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
              🔍
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Reeve is researching your market</div>
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
                Analyzing competitors, positioning opportunities, and building your Research Brief. This usually takes 2–3 minutes. Your brief will appear here when it's ready.
              </div>
            </div>
            <div style={{
              width: 20, height: 20, border: `2.5px solid ${T.accent}`, borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, marginTop: 6,
            }} />
          </div>
        )}

        {/* State 2: Research brief ready, awaiting approval */}
        {showBrief && research && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Research Brief</h2>
                <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Review and approve to start the Website build.</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Edit
                </button>
                <button
                  onClick={handleApproveResearch}
                  disabled={approving}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {approving ? 'Approving…' : 'Approve Brief — Start Website Build →'}
                </button>
              </div>
            </div>

            {/* Competitors */}
            {Array.isArray(research.competitors) && research.competitors.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Competitive Landscape</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {research.competitors.slice(0, 3).map((c, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: T.bg, borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.name}</span>
                        <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.accent }}>{c.url}</a>
                      </div>
                      <div style={{ fontSize: 12, color: T.muted }}>
                        <span style={{ color: T.green }}>+ </span>{(c.strengths ?? []).join(' · ')}
                        {(c.weaknesses ?? []).length > 0 && <><span style={{ color: '#ef4444' }}> − </span>{(c.weaknesses ?? []).join(' · ')}</>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key messages */}
            {Array.isArray(research.key_messages) && research.key_messages.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Key Messages</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {research.key_messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.text }}>
                      <span style={{ color: T.accent }}>→</span>
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* State 4: CRM summary (when research approved) */}
        {researchApproved && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <CrmSummaryCard stats={{ total: 0, contacted: 0, replied: 0, meetings: 0 }} projectId={projectId!} />
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>Recent Activity</div>
              <div style={{ fontSize: 13, color: T.muted, textAlign: 'center', paddingTop: 20 }}>
                Activity will appear here once outreach begins.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
