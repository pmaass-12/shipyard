/**
 * Project Hub Screen — Build 014
 *
 * Main landing page for a project: /projects/:id
 * Sections: header card, human tasks amber callout, setup checklist,
 *           8-card nav grid, quick stats row, push-to-production button.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getProjectHubStats,
  getProject,
  getPendingHumanTasks,
  advanceProjectPhase,
  resolveHumanTask,
  getSetupChecklistState,
  isSetupComplete,
  nextPhase,
} from '@/api/projectHub';
import type { Project, ProjectHubStats, HumanTask } from '@/types/db';

// ── Phase badge ────────────────────────────────────────────────────────────

function PhaseBadge({
  phase,
  projectId,
  onAdvanced,
}: {
  phase:      'alpha' | 'beta' | 'live';
  projectId:  string;
  onAdvanced: () => void;
}) {
  const [open, setOpen]       = useState(false);
  const [acting, setActing]   = useState(false);
  const [toast, setToast]     = useState('');
  const next = nextPhase(phase);

  const colors: Record<string, string> = {
    alpha: '#bf5af2',
    beta:  '#ff9f0a',
    live:  '#30d158',
  };

  async function handleAdvance() {
    if (!next) return;
    setActing(true);
    try {
      await advanceProjectPhase(projectId, next);
      setToast(`Phase updated to ${next.charAt(0).toUpperCase() + next.slice(1)}`);
      setTimeout(() => setToast(''), 3000);
      setOpen(false);
      onAdvanced();
    } catch (err) {
      console.error(err);
    } finally {
      setActing(false);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => next && setOpen((p) => !p)}
        style={{
          padding: '4px 12px', borderRadius: 20, border: 'none',
          backgroundColor: colors[phase], color: '#fff',
          fontWeight: 700, fontSize: 13, cursor: next ? 'pointer' : 'default',
          textTransform: 'capitalize',
        }}
      >
        {phase} {next && '▾'}
      </button>

      {open && next && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 20,
          backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 12, minWidth: 200,
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Advance to next phase?
          </p>
          <button
            onClick={handleAdvance}
            disabled={acting}
            style={{
              width: '100%', padding: '8px 14px', borderRadius: 6, border: 'none',
              backgroundColor: colors[next], color: '#fff',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              opacity: acting ? 0.6 : 1, textTransform: 'capitalize',
            }}
          >
            {acting ? 'Updating…' : `Move to ${next}`}
          </button>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          backgroundColor: '#1c1c1e', color: '#fff', padding: '10px 18px',
          borderRadius: 8, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

// ── Nav card ───────────────────────────────────────────────────────────────

interface NavCardDef {
  id:          string;
  emoji:       string;
  title:       string;
  description: string;
  href:        (id: string) => string;
  badgeCount?: (stats: ProjectHubStats) => number | null;
  isLocked?:   (project: Project) => boolean;
  lockReason?: string;
}

const NAV_CARDS: NavCardDef[] = [
  {
    id: 'screens', emoji: '🖥', title: 'Screens', description: "Map your app's screens and sitemap.",
    href: (id) => `/projects/${id}/screens`,
    badgeCount: (s) => s.screen_count || null,
  },
  {
    id: 'features', emoji: '⚡', title: 'Features', description: 'Plan, build, and ship features.',
    href: (id) => `/projects/${id}/features`,
    badgeCount: (s) => s.feature_count || null,
  },
  {
    id: 'bugs', emoji: '🐛', title: 'Bugs', description: 'Track and resolve open issues.',
    href: (id) => `/projects/${id}/bugs`,
    badgeCount: (s) => s.open_bug_count || null,
  },
  {
    id: 'change-requests', emoji: '📋', title: 'Change Requests', description: 'Review user feedback and requests.',
    href: (id) => `/projects/${id}/change-requests`,
    badgeCount: (s) => s.pending_cr_count || null,
  },
  {
    id: 'seo-aeo', emoji: '🔍', title: 'SEO / AEO', description: 'Optimize for search and AI discovery.',
    href: (id) => `/projects/${id}/seo`,
  },
  {
    id: 'admin-console', emoji: '⚙️', title: 'Admin Console', description: 'User management and platform settings.',
    href: (id) => `/admin?project=${id}`,
    isLocked: (p) => p.phase === 'alpha',
    lockReason: 'Unlocks in Beta',
  },
  {
    id: 'deployments', emoji: '🚀', title: 'Deployments', description: 'Track builds and production deploys.',
    href: (id) => `/projects/${id}/deployments`,
    badgeCount: (s) => s.deployment_count || null,
  },
  {
    id: 'data-schema', emoji: '🗄', title: 'Data Schema', description: 'View and manage your database tables.',
    href: (id) => `/projects/${id}/schema`,
  },
];

function NavCard({
  card, project, stats,
}: {
  card:    NavCardDef;
  project: Project;
  stats:   ProjectHubStats;
}) {
  const locked = card.isLocked?.(project) ?? false;
  const badge  = card.badgeCount?.(stats) ?? null;

  return (
    <Link
      to={locked ? '#' : card.href(project.id)}
      onClick={(e) => locked && e.preventDefault()}
      style={{
        display: 'flex', flexDirection: 'column', padding: 16,
        border: '1px solid var(--color-border)', borderRadius: 10,
        backgroundColor: locked ? 'var(--color-bg)' : 'var(--color-surface)',
        textDecoration: 'none', position: 'relative', overflow: 'hidden',
        opacity: locked ? 0.6 : 1,
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!locked) {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {locked && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 10, color: 'var(--color-text-muted)',
          backgroundColor: 'var(--color-bg)', padding: '2px 6px',
          borderRadius: 4, fontWeight: 600,
        }}>
          🔒 {card.lockReason}
        </div>
      )}
      <div style={{ fontSize: 28, marginBottom: 8 }}>{card.emoji}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{card.title}</span>
        {badge !== null && (
          <span style={{
            fontSize: 11, padding: '1px 6px', borderRadius: 10,
            backgroundColor: 'var(--color-accent)', color: '#fff', fontWeight: 700,
          }}>
            {badge}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
        {card.description}
      </p>
    </Link>
  );
}

// ── Setup checklist ────────────────────────────────────────────────────────

function SetupChecklist({
  project, stats,
}: {
  project: Project;
  stats:   ProjectHubStats;
}) {
  const [expanded, setExpanded] = useState(true);
  const screenCount             = stats.screen_count;
  const steps                   = getSetupChecklistState(project, screenCount);
  const complete                = isSetupComplete(project, screenCount);

  if (complete && !expanded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', border: '1px solid var(--color-border)',
        borderRadius: 10, backgroundColor: 'var(--color-surface)', marginBottom: 24,
      }}>
        <span style={{ fontSize: 14, color: '#30d158', fontWeight: 600 }}>
          ✓ 6/6 Setup steps complete
        </span>
        <button
          onClick={() => setExpanded(true)}
          style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 13 }}
        >
          Review
        </button>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--color-border)', borderRadius: 10,
      backgroundColor: 'var(--color-surface)', marginBottom: 24,
      borderLeft: '3px solid var(--color-accent)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
      }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
          Project Setup
        </h3>
        {complete && (
          <button
            onClick={() => setExpanded(false)}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 13 }}
          >
            Collapse
          </button>
        )}
      </div>

      {expanded && (
        <div>
          {steps.map((step) => (
            <div
              key={step.number}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                borderBottom: step.number < 6 ? '1px solid var(--color-border)' : 'none',
                opacity: step.status === 'pending' ? 0.5 : 1,
              }}
            >
              {/* Step indicator */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                backgroundColor:
                  step.status === 'done'   ? '#30d158' :
                  step.status === 'active' ? 'var(--color-accent)' : 'var(--color-bg)',
                color:
                  step.status === 'pending' ? 'var(--color-text-muted)' : '#fff',
                border: step.status === 'pending' ? '1px solid var(--color-border)' : 'none',
              }}>
                {step.status === 'done' ? '✓' : step.number}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                    {step.title}
                  </span>
                  {step.status === 'active' && (
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      backgroundColor: '#ff9f0a', color: '#fff', fontWeight: 700,
                    }}>
                      IN PROGRESS
                    </span>
                  )}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {step.description}
                </p>
                {step.status !== 'pending' && step.status !== 'done' && (
                  <Link
                    to={step.ctaHref(project.id)}
                    style={{
                      display: 'inline-block', marginTop: 8, fontSize: 13,
                      color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600,
                    }}
                  >
                    {step.ctaLabel}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function ProjectHubScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate          = useNavigate();

  const [project, setProject]   = useState<Project | null>(null);
  const [stats,   setStats]     = useState<ProjectHubStats | null>(null);
  const [tasks,   setTasks]     = useState<HumanTask[]>([]);
  const [loading, setLoading]   = useState(true);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const [p, s, t] = await Promise.all([
        getProject(projectId),
        getProjectHubStats(projectId),
        getPendingHumanTasks(projectId),
      ]);
      setProject(p);
      setStats(s);
      setTasks(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'var(--color-text-muted)', fontSize: 15 }}>
        Loading project…
      </div>
    );
  }

  if (!project || !stats) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: 'var(--color-text)' }}>Project not found.</p>
        <button onClick={() => navigate('/projects')} style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
          ← Back to projects
        </button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: '#30d158', paused: '#ff9f0a', stalled: '#ff3b30', shipped: '#0a84ff',
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>

      {/* ── Project header card ── */}
      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 12,
        backgroundColor: 'var(--color-surface)', padding: 24, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 30, fontWeight: 800, color: 'var(--color-text)' }}>
              {project.name}
            </h1>
            {project.description && (
              <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-text-muted)' }}>
                {project.description}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <PhaseBadge phase={project.phase} projectId={project.id} onAdvanced={load} />
              <span style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                backgroundColor: statusColors[project.status] + '22',
                color: statusColors[project.status], textTransform: 'capitalize',
              }}>
                {project.status}
              </span>
              {(project.tech_stack ?? []).map((tag) => (
                <span key={tag} style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                  backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <button
            title="Edit project (coming soon)"
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid var(--color-border)', backgroundColor: 'transparent',
              color: 'var(--color-text-muted)', cursor: 'not-allowed', fontSize: 14,
            }}
          >
            ✏️ Edit
          </button>
        </div>
      </div>

      {/* ── Human tasks amber callout ── */}
      {tasks.length > 0 && (
        <div style={{
          padding: '14px 16px', borderRadius: 10, marginBottom: 20,
          backgroundColor: '#ff9f0a22', border: '1px solid #ff9f0a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#ff9f0a' }}>
            ⚠ {tasks.length} task{tasks.length !== 1 ? 's' : ''} need{tasks.length === 1 ? 's' : ''} your attention
          </span>
          <Link
            to={`/projects/${projectId}/tasks`}
            style={{ fontSize: 13, color: '#ff9f0a', fontWeight: 600, textDecoration: 'none' }}
          >
            View all →
          </Link>
        </div>
      )}

      {/* ── Setup checklist ── */}
      <SetupChecklist project={project} stats={stats} />

      {/* ── Nav grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
        gap: 12, marginBottom: 28,
      }}>
        {NAV_CARDS.map((card) => (
          <NavCard key={card.id} card={card} project={project} stats={stats} />
        ))}
      </div>

      {/* ── Quick stats row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28,
      }}>
        {[
          { label: 'Screens',      value: stats.screen_count },
          { label: 'Features',     value: stats.feature_count },
          { label: 'Open Bugs',    value: stats.open_bug_count },
          { label: 'Deployments',  value: stats.deployment_count },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: '14px 16px', borderRadius: 10,
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)' }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Push to Production (Beta only) ── */}
      {project.phase === 'beta' && (
        <Link
          to={`/projects/${projectId}/push`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '16px 24px', borderRadius: 12,
            backgroundColor: '#30d158', color: '#fff',
            fontSize: 18, fontWeight: 800, textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          🚀 Push to Production
        </Link>
      )}
    </div>
  );
}
