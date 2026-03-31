/**
 * Project Hub Screen — Build 014
 *
 * Main landing page for a project: /projects/:id
 * Sections: header card, human tasks amber callout, setup checklist,
 *           8-card nav grid, quick stats row, push-to-production button.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getProjectHubStats,
  getProject,
  getPendingHumanTasks,
  getSetupChecklistState,
  isSetupComplete,
} from '@/api/projectHub';
import { updateProject, pushToProduction } from '@/api/projects';
import type { Project, ProjectHubStats, HumanTask, ProjectColor, ProjectPhase } from '@/types/db';
import DailyBriefingCard from '@/components/DailyBriefingCard';
import PmChatPanel from '@/components/PmChatPanel';
import ReeveGreetingCard from '@/components/ReeveGreetingCard';
import { Avatar } from '@/components/Avatar';
import ProjectHealthBadge from '@/components/ProjectHealthBadge';
import RegressionCard from '@/components/RegressionCard';
import HealthReportCard from '@/components/HealthReportCard';
import { isFirstRunMode, completeFirstRun } from '@/api/firstRun';
import FeatureCreationSheet from '@/components/FeatureCreationSheet'; // Build 054

// ── Phase badge ────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<ProjectPhase, string> = {
  alpha: '#bf5af2',
  beta:  '#ff9f0a',
  live:  '#30d158',
};

function PhaseBadge({
  phase,
  projectId,
  onUpdated,
}: {
  phase:      ProjectPhase;
  projectId:  string;
  onUpdated:  () => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [acting, setActing] = useState(false);

  const ALL_PHASES: ProjectPhase[] = ['alpha', 'beta', 'live'];

  async function handleSelect(selected: ProjectPhase) {
    if (selected === phase || acting) return;
    setActing(true);
    try {
      await updateProject(projectId, { phase: selected });
      setOpen(false);
      onUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setActing(false);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        data-testid="phase-badge-toggle"
        onClick={() => setOpen((p) => !p)}
        style={{
          padding: '4px 12px', borderRadius: 20, border: 'none',
          backgroundColor: PHASE_COLORS[phase], color: '#fff',
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
          textTransform: 'capitalize',
        }}
      >
        {phase} ▾
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 20,
          backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          padding: 6, minWidth: 140,
        }}>
          {ALL_PHASES.map((p) => (
            <button
              key={p}
              data-testid={`phase-option-${p}`}
              onClick={() => handleSelect(p)}
              disabled={acting}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px', border: 'none',
                backgroundColor: p === phase ? PHASE_COLORS[p] + '18' : 'transparent',
                borderRadius: 6, cursor: acting ? 'wait' : 'pointer',
                textTransform: 'capitalize', fontSize: 13, fontWeight: p === phase ? 700 : 500,
                color: p === phase ? PHASE_COLORS[p] : 'var(--color-text)',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: PHASE_COLORS[p], flexShrink: 0,
              }} />
              {p}{p === phase && ' ✓'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Launch modal ────────────────────────────────────────────────────────────

function LaunchModal({
  project,
  onClose,
  onLaunched,
}: {
  project:    Project;
  onClose:    () => void;
  onLaunched: () => void;
}) {
  const [launching, setLaunching] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Count alpha/beta features for the informational note
  // (We don't have that count here easily — show the note generically)
  // ProjectHubStats doesn't break down by phase, so we surface the note
  // without a specific count. A future iteration can pull the count.

  async function handleLaunch() {
    setLaunching(true);
    setError(null);
    try {
      await pushToProduction({ project_id: project.id });
      onLaunched();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div
      data-testid="launch-modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        data-testid="launch-modal"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 16, padding: '32px 28px',
          maxWidth: 440, width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 16 }}>🚀</div>

        <h2 style={{
          margin: '0 0 10px', fontSize: 22, fontWeight: 800,
          color: 'var(--color-text)', textAlign: 'center',
        }}>
          Launch {project.name}
        </h2>

        <p style={{
          margin: '0 0 20px', fontSize: 14, color: 'var(--color-text-muted)',
          textAlign: 'center', lineHeight: 1.5,
        }}>
          This opens your product to the public and triggers your configured launch actions.
        </p>

        {/* Informational note — low visual weight, no warning color */}
        <p style={{
          margin: '0 0 24px', fontSize: 13, color: 'var(--color-text-muted)',
          backgroundColor: 'var(--color-bg)', borderRadius: 8, padding: '10px 14px',
          lineHeight: 1.5,
        }}>
          ℹ Some features may still be in Alpha or Beta — just so you know before you open the doors.
        </p>

        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            data-testid="launch-cancel"
            onClick={onClose}
            disabled={launching}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="launch-confirm"
            onClick={handleLaunch}
            disabled={launching}
            style={{
              flex: 2, padding: '11px 20px', borderRadius: 10, fontSize: 15, fontWeight: 800,
              border: 'none', backgroundColor: '#30d158', color: '#fff',
              cursor: launching ? 'wait' : 'pointer', opacity: launching ? 0.7 : 1,
            }}
          >
            {launching ? 'Launching…' : 'Launch →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Nav card ───────────────────────────────────────────────────────────────

interface NavCardDef {
  id:          string;
  testId:      string;
  emoji:       string;
  title:       string;
  description: string;
  href:        (id: string) => string;
  badgeCount?: (stats: ProjectHubStats) => number | null;
  isLocked?:   (project: Project) => boolean;
  lockReason?: string;
}

// Build 055: canonical ordering — core loop first, shipping second, settings collapsed
const NAV_CARDS: NavCardDef[] = [
  // ── Row 1: core building loop ──
  {
    id: 'screens', testId: 'nav-screens', emoji: '🖥', title: 'Screens', description: "Map your app's screens and sitemap.",
    href: (id) => `/projects/${id}/screens`,
    badgeCount: (s) => s.screen_count || null,
  },
  {
    id: 'features', testId: 'nav-features', emoji: '⚡', title: 'Features', description: 'Plan, build, and ship features.',
    href: (id) => `/projects/${id}/features`,
    badgeCount: (s) => s.feature_count || null,
  },
  {
    id: 'change-requests', testId: 'nav-change-requests', emoji: '📋', title: 'Changes', description: 'Review user feedback and requests.',
    href: (id) => `/projects/${id}/change-requests`,
    badgeCount: (s) => s.pending_cr_count || null,
  },
  {
    id: 'bugs', testId: 'nav-bugs', emoji: '🐛', title: 'Bugs', description: 'Track and resolve open issues.',
    href: (id) => `/projects/${id}/bugs`,
    badgeCount: (s) => s.open_bug_count || null,
  },
  // ── Row 2: shipping ──
  {
    id: 'deployments', testId: 'nav-deployments', emoji: '🚀', title: 'Deploy', description: 'Infrastructure and production deploys.',
    href: (id) => `/projects/${id}/deploy`,
    badgeCount: (s) => s.deployment_count || null,
  },
  {
    id: 'analytics', testId: 'nav-analytics', emoji: '📊', title: 'Analytics', description: 'Usage, retention, and funnel metrics.',
    href: (id) => `/projects/${id}/analytics`,
  },
  {
    id: 'artifacts', testId: 'nav-artifacts', emoji: '📦', title: 'Artifacts', description: 'Architecture docs and generated files.',
    href: (id) => `/projects/${id}/artifacts`,
  },
  {
    id: 'documents', testId: 'nav-documents', emoji: '📄', title: 'Documents', description: 'Supporting docs and references.',
    href: (id) => `/projects/${id}/documents`,
  },
  // Build 061: Design Gallery + Prototype Viewer
  {
    id: 'gallery', testId: 'nav-gallery', emoji: '🖼️', title: 'Design Gallery', description: 'Screen mockups and interactive flow map.',
    href: (id) => `/projects/${id}/gallery`,
  },
];

// Build 055: Settings & integrations — collapsed by default
const SETTINGS_CARDS: NavCardDef[] = [
  {
    id: 'seo-aeo', testId: 'nav-seo', emoji: '🔍', title: 'SEO / AEO', description: 'Optimize for search and AI discovery.',
    href: (id) => `/projects/${id}/seo`,
  },
  {
    id: 'billing', testId: 'nav-billing', emoji: '💳', title: 'Billing', description: 'Manage your subscription and payments.',
    href: (id) => `/projects/${id}/billing`,
  },
  {
    id: 'domain', testId: 'nav-domain', emoji: '🌐', title: 'Domain', description: 'Custom domain and DNS settings.',
    href: (id) => `/projects/${id}/domain`,
  },
  {
    id: 'email', testId: 'nav-email', emoji: '✉️', title: 'Email', description: 'Transactional and marketing email.',
    href: (id) => `/projects/${id}/email`,
  },
  {
    id: 'adsense', testId: 'nav-adsense', emoji: '📣', title: 'AdSense', description: 'Google AdSense ad placements.',
    href: (id) => `/projects/${id}/adsense`,
  },
  {
    id: 'promo', testId: 'nav-promo', emoji: '🎯', title: 'Promo', description: 'Promo site and landing page.',
    href: (id) => `/projects/${id}/promo`,
  },
  {
    id: 'usage', testId: 'nav-usage', emoji: '🔢', title: 'Usage', description: 'API and token consumption.',
    href: (id) => `/projects/${id}/usage`,
  },
  {
    id: 'github', testId: 'nav-github', emoji: '🐙', title: 'GitHub', description: 'Repository and branch settings.',
    href: (id) => `/projects/${id}/github`,
  },
  {
    id: 'admin-console', testId: 'nav-admin', emoji: '⚙️', title: 'Admin Console', description: 'User management and platform settings.',
    href: (id) => `/admin?project=${id}`,
    isLocked: (p) => p.phase === 'alpha',
    lockReason: 'Unlocks in Beta',
  },
  {
    id: 'data-schema', testId: 'nav-data-schema', emoji: '🗄', title: 'Data Schema', description: 'View and manage your database tables.',
    href: (id) => `/projects/${id}/schema`,
  },
];

// ── Stage banner ────────────────────────────────────────────────────────────

type Stage = 'setup' | 'designing' | 'building' | 'deploying' | 'live';

// Build 055 — stage detection (Finn)
// Priority order: live → deploying → building → designing → setup
// Spec: https://github.com/shipyard/specs/055-project-hub-guided-READY.md
function detectStage(project: Project, stats: ProjectHubStats): Stage {
  // live: project has been pushed to production at least once
  if (project.pushed_to_production_at) return 'live';

  // deploying: project is on beta phase (infra connected, ready to push)
  // Full spec condition is "all features shipped + infra not connected" — approximated
  // here until project_hub_stats carries per-step feature counts (Sage follow-up)
  if (project.phase === 'beta') return 'deploying';

  // building: any features exist and the project has been deployed at least once (alpha)
  // Full spec: ≥1 feature at pipeline_step 3–5 (code/preview/QA)
  if (stats.feature_count > 0 && stats.deployment_count > 0) return 'building';

  // designing: screens have been defined and features exist
  // Full spec: screens defined + ≥1 feature at pipeline_step 1–2 (design/schema)
  if (stats.screen_count > 0 && stats.feature_count > 0) return 'designing';

  // setup: no screens yet
  return 'setup';
}

const STAGE_META: Record<Stage, { emoji: string; label: string; tip: string; color: string }> = {
  setup:     { emoji: '🛠',  label: 'Setup',     tip: 'Add your first screens and features to get started.',             color: '#6e6e80' },
  designing: { emoji: '✏️', label: 'Designing',  tip: "You're mapping out features. Head to Screens to keep going.",     color: '#5b5bd6' },
  building:  { emoji: '⚙️', label: 'Building',   tip: 'Features are in progress. Check Bugs and Changes regularly.',     color: '#ff9f0a' },
  deploying: { emoji: '🚀', label: 'Deploying',  tip: 'Almost live! Connect your infra and prepare for launch.',         color: '#0a84ff' },
  live:      { emoji: '🟢', label: 'Live',        tip: "You're live! Keep shipping features and monitoring health.",      color: '#30d158' },
};

function StageBanner({ project, stats }: { project: Project; stats: ProjectHubStats }) {
  const stage = detectStage(project, stats);
  const meta  = STAGE_META[stage];
  return (
    <div
      data-testid="stage-banner"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', borderRadius: 10, marginBottom: 16,
        border: `1px solid ${meta.color}33`,
        backgroundColor: `${meta.color}11`,
      }}
    >
      <span style={{ fontSize: 18 }}>{meta.emoji}</span>
      <div>
        <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label}</span>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 8 }}>{meta.tip}</span>
      </div>
    </div>
  );
}

// ── Active feature card ──────────────────────────────────────────────────────

interface ActiveFeatureDef {
  id:     string;
  name:   string;
  status: string;
}

const STATUS_COLOR: Record<string, string> = {
  design: '#5b5bd6',
  build:  '#ff9f0a',
  review: '#0a84ff',
  done:   '#30d158',
};

function ActiveFeatureCard({
  feature,
  projectId,
}: {
  feature:   ActiveFeatureDef;
  projectId: string;
}) {
  const color = STATUS_COLOR[feature.status] ?? '#6e6e80';
  return (
    <a
      data-testid="active-feature-card"
      href={`/projects/${projectId}/features/${feature.id}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderRadius: 10, marginBottom: 16,
        border: `1px solid ${color}33`, backgroundColor: `${color}0d`,
        textDecoration: 'none',
      }}
    >
      <div>
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Active feature
        </span>
        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
          {feature.name}
        </p>
      </div>
      <span style={{
        fontSize: 11, padding: '3px 8px', borderRadius: 6,
        backgroundColor: color, color: '#fff', fontWeight: 700, textTransform: 'capitalize',
      }}>
        {feature.status}
      </span>
    </a>
  );
}

// ── Nav card ───────────────────────────────────────────────────────────────

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
      data-testid={card.testId}
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
    <div
      data-testid="setup-checklist"
      style={{
        border: '1px solid var(--color-border)', borderRadius: 10,
        backgroundColor: 'var(--color-surface)', marginBottom: 24,
        borderLeft: '3px solid var(--color-accent)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
            Project Setup
          </h3>
          {/* Progress bar */}
          <div
            data-testid="project-progress"
            style={{
              height: 4, borderRadius: 2, backgroundColor: 'var(--color-border)',
              overflow: 'hidden', maxWidth: 240,
            }}
          >
            <div style={{
              height: '100%',
              width: `${Math.round((steps.filter((s) => s.status === 'done').length / steps.length) * 100)}%`,
              backgroundColor: complete ? '#30d158' : 'var(--color-accent)',
              borderRadius: 2, transition: 'width 0.3s',
            }} />
          </div>
        </div>
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
              data-testid={`checklist-step-${step.number}`}
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
                    data-testid={`checklist-action-${step.number}`}
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

  const [project,     setProject]     = useState<Project | null>(null);
  const [stats,       setStats]       = useState<ProjectHubStats | null>(null);
  const [tasks,       setTasks]       = useState<HumanTask[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [isFirstRun,  setIsFirstRun]  = useState(false);
  const [hasClaudeKey, setHasClaudeKey] = useState<boolean | undefined>(undefined); // Build 056

  // ── Inline edit state ────────────────────────────────────────────────────
  const [editingField,    setEditingField]    = useState<string | null>(null);
  const [editName,        setEditName]        = useState('');
  const [editDesc,        setEditDesc]        = useState('');
  const [savingField,     setSavingField]     = useState<string | null>(null);
  const [showColorPicker,   setShowColorPicker]   = useState(false);
  const [showLaunchModal,   setShowLaunchModal]   = useState(false);
  const [showPmChat,        setShowPmChat]        = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Build 055
  const [settingsExpanded, setSettingsExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem('hub-settings-expanded') === 'true'; } catch { return false; }
  });
  const [featureSheetOpen, setFeatureSheetOpen] = useState(false);
  const [activeFeature,    setActiveFeature]    = useState<ActiveFeatureDef | null>(null);

  async function saveProjectField(field: string, value: unknown) {
    if (!projectId) return;
    setSavingField(field);
    try {
      const updated = await updateProject(projectId, { [field]: value } as Parameters<typeof updateProject>[1]);
      setProject(updated);
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setSavingField(null);
      setEditingField(null);
    }
  }

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
      // Detect first-run mode (Build 044)
      setIsFirstRun(isFirstRunMode(p, s.feature_count, s.screen_count));

      // Build 056: check whether Claude API key is configured
      const { data: aiSettings } = await supabase
        .from('project_settings')
        .select('claude_api_key')
        .eq('project_id', projectId)
        .maybeSingle();
      setHasClaudeKey(Boolean(aiSettings?.claude_api_key));

      // Build 055: fetch most recent in-progress feature for ActiveFeatureCard
      const { data: af } = await supabase
        .from('features')
        .select('id, name, status')
        .eq('project_id', projectId)
        .in('status', ['design', 'build', 'review'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveFeature(af as ActiveFeatureDef | null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  // Build 055: persist settings-section collapse state
  useEffect(() => {
    try { localStorage.setItem('hub-settings-expanded', String(settingsExpanded)); } catch { /* ignore */ }
  }, [settingsExpanded]);

  // Build 044: handle first-run completion
  const handleFirstRunComplete = async () => {
    setIsFirstRun(false);
    try {
      await completeFirstRun(projectId!);
    } catch (err) {
      console.warn('completeFirstRun error:', err);
    }
    load(); // Refresh stats so features/screens appear
  };

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
        {/* Name — click to edit inline */}
        {editingField === 'name' ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveProjectField('name', editName.trim() || project.name);
              if (e.key === 'Escape') setEditingField(null);
            }}
            onBlur={() => saveProjectField('name', editName.trim() || project.name)}
            style={{
              fontSize: 30, fontWeight: 800, color: 'var(--color-text)',
              border: 'none', borderBottom: '2px solid var(--color-accent)',
              background: 'transparent', outline: 'none', width: '100%',
              marginBottom: 8, padding: '0 2px',
            }}
          />
        ) : (
          <h1
            onClick={() => { setEditName(project.name); setEditingField('name'); }}
            title="Click to edit name"
            style={{
              margin: '0 0 6px', fontSize: 30, fontWeight: 800, color: 'var(--color-text)',
              cursor: 'text', display: 'inline-block',
            }}
          >
            {project.name}
            <span style={{ fontSize: 16, marginLeft: 8, opacity: 0.4, verticalAlign: 'middle' }}>✏️</span>
          </h1>
        )}

        {/* Description — click to edit inline */}
        {editingField === 'description' ? (
          <input
            autoFocus
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveProjectField('description', editDesc);
              if (e.key === 'Escape') setEditingField(null);
            }}
            onBlur={() => saveProjectField('description', editDesc)}
            placeholder="Add a project description…"
            style={{
              fontSize: 14, color: 'var(--color-text-muted)',
              border: 'none', borderBottom: '1px solid var(--color-border)',
              background: 'transparent', outline: 'none', width: '100%',
              marginBottom: 12, padding: '0 2px',
            }}
          />
        ) : (
          <p
            onClick={() => { setEditDesc(project.description ?? ''); setEditingField('description'); }}
            title="Click to edit description"
            style={{
              margin: '0 0 12px', fontSize: 14, color: 'var(--color-text-muted)',
              cursor: 'text', minHeight: 20,
            }}
          >
            {project.description || <em style={{ opacity: 0.5 }}>Add a description…</em>}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <PhaseBadge phase={project.phase} projectId={project.id} onUpdated={load} />

          {/* Status — inline select */}
          <select
            data-testid="edit-project-btn"
            value={project.status}
            disabled={savingField === 'status'}
            onChange={(e) => saveProjectField('status', e.target.value)}
            style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              backgroundColor: statusColors[project.status] + '22',
              color: statusColors[project.status],
              border: `1px solid ${statusColors[project.status]}44`,
              cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
            }}
          >
            {['active', 'paused', 'stalled', 'shipped'].map((s) => (
              <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>
            ))}
          </select>

          {/* Color swatch popover */}
          {(() => {
            const COLOR_MAP: Record<ProjectColor, string> = {
              blue: '#0a84ff', purple: '#bf5af2', orange: '#ff9f0a',
              green: '#30d158', teal: '#5ac8fa', rose: '#ff375f',
            };
            const currentHex = COLOR_MAP[project.color ?? 'blue'] ?? '#0a84ff';
            return (
              <div ref={colorPickerRef} style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  title="Click to change project color"
                  onClick={() => setShowColorPicker((v) => !v)}
                  style={{
                    display: 'inline-block', width: 20, height: 20, borderRadius: '50%',
                    backgroundColor: currentHex,
                    cursor: 'pointer', border: '2px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 0 0 1px var(--color-border)', flexShrink: 0,
                    padding: 0,
                  }}
                />
                {showColorPicker && (
                  <div style={{
                    position: 'absolute', top: '110%', left: 0, zIndex: 30,
                    backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    padding: 10, display: 'flex', gap: 6,
                  }}>
                    {(Object.entries(COLOR_MAP) as [ProjectColor, string][]).map(([name, hex]) => (
                      <button
                        key={name}
                        title={name}
                        onClick={() => { saveProjectField('color', name); setShowColorPicker(false); }}
                        style={{
                          width: 22, height: 22, borderRadius: '50%',
                          backgroundColor: hex, border: 'none', cursor: 'pointer', padding: 0,
                          boxShadow: project.color === name ? `0 0 0 2px #fff, 0 0 0 4px ${hex}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Tech stack intentionally removed — fixed stack (React/TS/Supabase/Netlify). Build 024-fix. */}

          {/* Project Health badge — Build 042 */}
          <ProjectHealthBadge projectId={project.id} />

          {/* Chat with Reeve — PM Chat trigger */}
          <button
            data-testid="pm-chat-open-btn"
            onClick={() => setShowPmChat(true)}
            title="Chat with Reeve, your project manager"
            style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20,
              border: '1px solid #C7D2FE', backgroundColor: '#EEF2FF',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4338CA',
            }}
          >
            <Avatar member="reeve" size="xs" />
            Chat with Reeve
          </button>
        </div>
      </div>

      {/* ── Human tasks amber callout (suppressed in first-run) ── */}
      {tasks.length > 0 && !isFirstRun && (
        <div
          data-testid="human-tasks-callout"
          style={{
            padding: '14px 16px', borderRadius: 10, marginBottom: 20,
            backgroundColor: '#ff9f0a22', border: '1px solid #ff9f0a',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
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

      {/* ── First-Run Greeting Card — Build 044 ── */}
      {isFirstRun && (
        <ReeveGreetingCard
          projectId={project.id}
          projectName={project.name}
          description={project.description}
          onComplete={handleFirstRunComplete}
          hasClaudeKey={hasClaudeKey}
        />
      )}

      {/* ── Import entry point (Build 041) — shown when no screens and NOT first-run ── */}
      {stats.screen_count === 0 && !isFirstRun && (
        <div style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          padding:         '12px 16px',
          marginBottom:    20,
          border:          '1px dashed var(--color-border)',
          borderRadius:    10,
          backgroundColor: 'var(--color-surface)',
        }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
              Already have a live app?
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              Import your screens, features, and schema automatically.
            </p>
          </div>
          <Link
            data-testid="import-existing-app-link"
            to={`/projects/${projectId}/import`}
            style={{
              padding:         '7px 14px',
              borderRadius:    8,
              border:          '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              fontSize:        13,
              fontWeight:      600,
              color:           'var(--color-text)',
              textDecoration:  'none',
              flexShrink:      0,
              marginLeft:      16,
            }}
          >
            Import existing app
          </Link>
        </div>
      )}

      {/* ── First-run empty state: No features ── */}
      {isFirstRun && stats.feature_count === 0 && (
        <div
          data-testid="first-run-no-features"
          style={{
            padding:         '14px 16px',
            borderRadius:    10,
            marginBottom:    20,
            backgroundColor: '#EEF2FF',
            border:          '1px solid #C7D2FE',
            fontSize:        14,
            color:           '#4338CA',
            fontWeight:      500,
          }}
        >
          <button
            onClick={() => setShowPmChat(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#4338CA', fontSize: 14, fontWeight: 600, padding: 0,
              textDecoration: 'underline',
            }}
          >
            Tell Reeve what you want to build to get started →
          </button>
        </div>
      )}

      {/* ── First-run empty state: No screens ── */}
      {isFirstRun && stats.screen_count === 0 && (
        <div
          data-testid="first-run-no-screens"
          style={{
            padding:         '10px 16px',
            borderRadius:    10,
            marginBottom:    16,
            backgroundColor: 'var(--color-surface)',
            border:          '1px solid var(--color-border)',
            fontSize:        13,
            color:           'var(--color-text-muted)',
          }}
        >
          Reeve will create your first screen automatically when you describe your first feature.
        </div>
      )}

      {/* ── Team row — Build 046 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '12px 16px', marginBottom: 20,
        border: '1px solid var(--color-border)', borderRadius: 10,
        backgroundColor: 'var(--color-surface)',
      }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, marginRight: 4 }}>
          Your team
        </span>
        {/* Reeve — project manager, shown first */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <button
            data-testid="team-member-reeve"
            onClick={() => setShowPmChat(true)}
            title="Chat with Reeve"
            style={{
              background: 'none', border: '2px solid #4338CA', borderRadius: '50%',
              padding: 0, cursor: 'pointer', display: 'flex',
            }}
          >
            <Avatar member="reeve" size="md" />
          </button>
          <span style={{ fontSize: 10, color: '#4338CA', fontWeight: 700, whiteSpace: 'nowrap' }}>
            Your PM
          </span>
        </div>
        {/* Rest of the team */}
        {(['morgan', 'wren', 'sage', 'finn', 'quinn'] as const).map(member => (
          <div key={member} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Avatar member={member} size="md" />
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
              {member}
            </span>
          </div>
        ))}
      </div>

      {/* ── Daily Briefing — Build 040 ── */}
      <div style={{ marginBottom: 20 }}>
        <DailyBriefingCard projectId={project.id} />
      </div>

      {/* ── Setup checklist ── */}
      <SetupChecklist project={project} stats={stats} />

      {/* ── Stage banner — Build 055 ── */}
      <StageBanner project={project} stats={stats} />

      {/* ── Active feature card — Build 055 ── */}
      {activeFeature && (
        <ActiveFeatureCard feature={activeFeature} projectId={project.id} />
      )}

      {/* ── Nav grid header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>Quick actions</span>
        <button
          data-testid="new-feature-btn"
          onClick={() => setFeatureSheetOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            border: '1px solid var(--color-accent)',
            backgroundColor: 'var(--color-accent-light)',
            color: 'var(--color-accent)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New feature
        </button>
      </div>

      {/* ── Nav grid (8 core cards) — Build 055 reorder ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
        gap: 12, marginBottom: 16,
      }}>
        {NAV_CARDS.map((card) => (
          <NavCard key={card.id} card={card} project={project} stats={stats} />
        ))}
      </div>

      {/* ── Settings & integrations (collapsible) — Build 055 ── */}
      <div style={{ marginBottom: 28 }}>
        <button
          data-testid="settings-section-toggle"
          onClick={() => setSettingsExpanded((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 4px', fontSize: 13, fontWeight: 600,
            color: 'var(--color-text-muted)',
          }}
        >
          <span style={{
            fontSize: 10, display: 'inline-block', transition: 'transform 0.2s',
            transform: settingsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>▶</span>
          Settings &amp; integrations
        </button>
        {settingsExpanded && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 12, marginTop: 8,
          }}>
            {SETTINGS_CARDS.map((card) => (
              <NavCard key={card.id} card={card} project={project} stats={stats} />
            ))}
          </div>
        )}
      </div>

      {/* ── Regression Card — Build 042 ── */}
      <RegressionCard projectId={project.id} />

      {/* ── Health Report Card — Build 042 ── */}
      <div style={{ marginBottom: 20 }}>
        <HealthReportCard projectId={project.id} />
      </div>

      {/* ── Quick stats row ── */}
      <div
        data-testid="quick-stats"
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28,
        }}
      >
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

      {/* ── Launch (Beta only) ── */}
      {project.phase === 'beta' && (
        <button
          data-testid="launch-btn"
          onClick={() => setShowLaunchModal(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '16px 24px', borderRadius: 12,
            backgroundColor: '#30d158', color: '#fff',
            fontSize: 18, fontWeight: 800, border: 'none', cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          🚀 Launch →
        </button>
      )}

      {/* ── Launch modal ── */}
      {showLaunchModal && project && (
        <LaunchModal
          project={project}
          onClose={() => setShowLaunchModal(false)}
          onLaunched={load}
        />
      )}

      {/* ── PM Chat panel — Build 040 ── */}
      {showPmChat && (
        <PmChatPanel
          projectId={project.id}
          onClose={() => setShowPmChat(false)}
        />
      )}

      {/* ── Feature Creation Sheet — Build 054/055 ── */}
      <FeatureCreationSheet
        isOpen={featureSheetOpen}
        onClose={() => setFeatureSheetOpen(false)}
        projectId={project.id}
        onCreated={() => load()}
      />
    </div>
  );
}
