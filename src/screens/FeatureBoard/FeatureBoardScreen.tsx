/**
 * FeatureBoardScreen — Build 058 + 059
 *
 * Route: /projects/:id/features
 * Shows all features grouped into 7 pipeline columns.
 * Ready to Deploy column has multi-select + sticky action bar → Deploy Confirm modal.
 *
 * Build 059: DeployConfirmModal + DeployToast inline.
 *
 * Styling: inline styles only. No Tailwind.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link }              from 'react-router-dom';
import { supabase }                                  from '@/lib/supabase';
import { Avatar }                                    from '@/components/Avatar';
import FeatureCreationSheet                          from '@/components/FeatureCreationSheet';

// ── Types ─────────────────────────────────────────────────────────────────

type DeployTarget = 'alpha' | 'beta' | 'production';

interface BoardFeature {
  id:              string;
  name:            string;
  pipeline_step:   number;   // 1=design 2=schema 3=code 4=preview 5=qa 6=live(done)
  pipeline_status: string | null;
  deployed_at:     string | null;
  deployed_to:     DeployTarget | null;
  step_entered_at: string | null;
  screen:          { name: string } | null;
  triage_status:   string | null;  // Build 066: 'mvp' | 'alpha' | 'beta' | 'removed'
}

// Map pipeline_step number → assignee persona (for avatar)
// 1=Morgan(design) 2=Sage(schema) 3=Finn(code) 4=Wren(preview) 5=Quinn(qa)
const STEP_PERSONA: Record<number, string> = {
  1: 'morgan',
  2: 'sage',
  3: 'finn',
  4: 'wren',
  5: 'quinn',
};

// ── Column definitions ────────────────────────────────────────────────────
// pipeline_step numbers: 1=design, 2=schema, 3=code, 4=preview, 5=qa, 6=done/ready
// "Ready to Deploy" = step 6 (QA passed, awaiting user deploy) + deployed_at IS NULL
// "Deployed"        = deployed_at IS NOT NULL (set by /deploy Edge Function)

type ColumnId = 'design' | 'schema' | 'code' | 'preview' | 'qa' | 'ready' | 'deployed';

interface ColumnDef {
  id:      ColumnId;
  label:   string;
  variant: 'default' | 'ready' | 'deployed';
  filter:  (f: BoardFeature) => boolean;
}

const COLUMNS: ColumnDef[] = [
  { id: 'design',   label: 'Designing',        variant: 'default',   filter: f => f.pipeline_step === 1 && f.deployed_at === null },
  { id: 'schema',   label: 'Schema',            variant: 'default',   filter: f => f.pipeline_step === 2 && f.deployed_at === null },
  { id: 'code',     label: 'Coding',            variant: 'default',   filter: f => f.pipeline_step === 3 && f.deployed_at === null },
  { id: 'preview',  label: 'Preview',           variant: 'default',   filter: f => f.pipeline_step === 4 && f.deployed_at === null },
  { id: 'qa',       label: 'QA',                variant: 'default',   filter: f => f.pipeline_step === 5 && f.deployed_at === null },
  { id: 'ready',    label: 'Ready to Deploy',   variant: 'ready',     filter: f => f.pipeline_step >= 6  && f.deployed_at === null },
  { id: 'deployed', label: 'Deployed',          variant: 'deployed',  filter: f => f.deployed_at !== null },
];

// ── Design tokens ─────────────────────────────────────────────────────────

const T = {
  accent:    'var(--color-accent, #5b5bd6)',
  text:      'var(--color-text, #1a1a1e)',
  muted:     'var(--color-text-muted, #6e6e80)',
  border:    'var(--color-border, #e4e4e8)',
  surface:   'var(--color-surface, #ffffff)',
  bg:        'var(--color-bg, #f5f5f7)',
  teal:      '#0d9488',
  tealLight: '#f0fdfa',
  tealBorder:'#99f6e4',
  amber:     '#f59e0b',
  green:     '#22c55e',
  deployBg:  '#1a1a1e',
};

// ── Age badge helper ──────────────────────────────────────────────────────

function formatAge(isoDate: string | null): string {
  if (!isoDate) return '';
  const elapsed = Date.now() - new Date(isoDate).getTime();
  const days    = Math.floor(elapsed / (1000 * 60 * 60 * 24));
  if (days === 0)          return 'Today';
  if (days < 7)            return `${days}d`;
  if (days < 14)           return '1w';
  return `${Math.floor(days / 7)}w`;
}

function isStale(isoDate: string | null): boolean {
  if (!isoDate) return false;
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
  return days > 7;
}

// ── Feature card ──────────────────────────────────────────────────────────

function FeatureCard({
  feature,
  projectId,
  variant,
  isSelected,
  onSelect,
}: {
  feature:    BoardFeature;
  projectId:  string;
  variant:    'default' | 'ready' | 'deployed';
  isSelected?: boolean;
  onSelect?:  (id: string, checked: boolean) => void;
}) {
  const navigate = useNavigate();
  const stale    = variant !== 'deployed' && isStale(feature.step_entered_at);
  const persona  = STEP_PERSONA[feature.pipeline_step] as string | undefined;
  const ageLabel = formatAge(feature.step_entered_at);

  const deployBadgeColor: Record<string, string> = {
    alpha:      '#4338ca',
    beta:       '#0284c7',
    production: '#16a34a',
  };
  const deployBadgeBg: Record<string, string> = {
    alpha:      '#eef0ff',
    beta:       '#e0f2fe',
    production: '#f0fdf4',
  };

  const cardStyle: React.CSSProperties = {
    position:        'relative',
    padding:         '10px 12px',
    borderRadius:    8,
    backgroundColor: variant === 'ready'    ? T.tealLight :
                     variant === 'deployed' ? '#f9f9fb' : T.surface,
    border:          variant === 'ready' && isSelected
                       ? `1.5px solid ${T.teal}`
                     : variant === 'ready'
                       ? `1.5px solid ${T.tealBorder}`
                     : `1.5px solid ${T.border}`,
    boxShadow:       variant === 'ready' && isSelected
                       ? `0 0 0 2px rgba(13,148,136,.15)` : 'none',
    cursor:          variant === 'deployed' ? 'default' : 'pointer',
    transition:      'border-color 0.15s, box-shadow 0.15s',
    userSelect:      'none',
  };

  return (
    <div
      style={cardStyle}
      data-testid={`feature-card-${feature.id}`}
      onClick={() => variant !== 'deployed' && navigate(`/projects/${projectId}/features/${feature.id}`)}
      onMouseEnter={(e) => {
        if (variant === 'deployed') return;
        (e.currentTarget as HTMLElement).style.borderColor = variant === 'ready' ? T.teal : T.accent;
        (e.currentTarget as HTMLElement).style.boxShadow = variant === 'ready' && isSelected
          ? `0 0 0 2px rgba(13,148,136,.15)` : `0 1px 6px rgba(91,91,214,.10)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor =
          variant === 'ready' && isSelected ? T.teal :
          variant === 'ready' ? T.tealBorder : T.border;
        (e.currentTarget as HTMLElement).style.boxShadow =
          variant === 'ready' && isSelected ? `0 0 0 2px rgba(13,148,136,.15)` : 'none';
      }}
    >
      {/* Stale amber dot */}
      {stale && (
        <div
          title={`In this step for ${Math.floor((Date.now() - new Date(feature.step_entered_at!).getTime()) / (1000 * 60 * 60 * 24))} days`}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: T.amber,
          }}
        />
      )}

      {/* Ready to Deploy checkbox */}
      {variant === 'ready' && onSelect && (
        <input
          type="checkbox"
          checked={isSelected ?? false}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelect(feature.id, e.target.checked)}
          style={{ position: 'absolute', top: 10, left: 10, width: 16, height: 16, cursor: 'pointer', accentColor: T.accent }}
        />
      )}

      {/* Name + triage badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: variant === 'ready' ? 24 : 0 }}>
        <p style={{
          margin:      0,
          fontSize:    13,
          fontWeight:  500,
          color:       variant === 'deployed' ? T.muted : T.text,
          overflow:    'hidden',
          whiteSpace:  'nowrap',
          textOverflow:'ellipsis',
          minWidth:    0,
          flex:        1,
        }}>
          {feature.name}
        </p>
        {/* Build 066: triage badge — muted, not dominant */}
        {feature.triage_status && feature.triage_status !== 'removed' && (() => {
          const TRIAGE_BADGE: Record<string, { bg: string; color: string }> = {
            mvp:   { bg: '#dcfce7', color: '#16a34a' },
            alpha: { bg: '#dbeafe', color: '#1d4ed8' },
            beta:  { bg: '#f3f4f6', color: '#6b7280' },
          };
          const bm = TRIAGE_BADGE[feature.triage_status];
          if (!bm) return null;
          return (
            <span style={{
              padding:      '1px 5px',
              fontSize:     9,
              fontWeight:   700,
              letterSpacing:'0.04em',
              textTransform:'uppercase',
              color:        bm.color,
              backgroundColor: bm.bg,
              borderRadius: 3,
              flexShrink:   0,
            }}>
              {feature.triage_status}
            </span>
          );
        })()}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.muted }}>
        <span>{feature.screen?.name ?? 'Unassigned'}</span>

        {/* Assignee avatar (not on deployed cards) */}
        {persona && variant !== 'deployed' && (
          <>
            <span>·</span>
            <Avatar member={persona as any} size="xs" />
          </>
        )}

        {/* Age badge */}
        {ageLabel && (
          <>
            <span style={{ marginLeft: 'auto' }}>{ageLabel}</span>
          </>
        )}

        {/* Deployed badge */}
        {variant === 'deployed' && feature.deployed_to && (
          <span style={{
            marginLeft: 'auto',
            padding:    '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
            backgroundColor: deployBadgeBg[feature.deployed_to] ?? T.bg,
            color: deployBadgeColor[feature.deployed_to] ?? T.muted,
          }}>
            ✓ {feature.deployed_to.charAt(0).toUpperCase() + feature.deployed_to.slice(1)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Deploy Confirm Modal — Build 059 ──────────────────────────────────────

function DeployConfirmModal({
  selectedFeatures,
  target,
  projectPhase,
  projectId,
  onTargetChange,
  onSuccess,
  onCancel,
}: {
  selectedFeatures: BoardFeature[];
  target:           DeployTarget;
  projectPhase:     string;
  projectId:        string;
  onTargetChange:   (t: DeployTarget) => void;
  onSuccess:        (target: DeployTarget, count: number) => void;
  onCancel:         () => void;
}) {
  const [deploying, setDeploying] = useState(false);
  const [error,     setError]     = useState('');

  const showPromoWarning = target === 'production' && projectPhase !== 'production';

  async function handleDeploy() {
    setDeploying(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            project_id:  projectId,
            feature_ids: selectedFeatures.map(f => f.id),
            target,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Deploy failed. Please try again.');
        return;
      }

      onSuccess(target, selectedFeatures.length);
    } catch {
      setError('Deploy request timed out. Check your connection and try again.');
    } finally {
      setDeploying(false);
    }
  }

  const targetColor: Record<DeployTarget, string> = {
    alpha:      '#4338ca',
    beta:       '#0284c7',
    production: '#16a34a',
  };
  const targetLabel: Record<DeployTarget, string> = {
    alpha: 'Alpha', beta: 'Beta', production: 'Production',
  };

  const DISPLAYED_FEATURES = selectedFeatures.slice(0, 5);
  const extraCount = selectedFeatures.length - 5;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        data-testid="deploy-confirm-modal"
        style={{
          position:     'fixed',
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%,-50%) scale(1)',
          zIndex:       201,
          width:        440,
          maxWidth:     'calc(100vw - 32px)',
          backgroundColor: T.surface,
          borderRadius: 14,
          padding:      28,
          boxShadow:    '0 8px 40px rgba(0,0,0,0.18)',
          animation:    'deployModalIn 0.2s ease',
        }}
      >
        {/* Title */}
        <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: T.text }}>
          Deploy to {targetLabel[target]}
        </h2>

        {/* Feature list */}
        <div style={{ marginBottom: 16 }}>
          {DISPLAYED_FEATURES.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: T.green, fontSize: 16, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            </div>
          ))}
          {extraCount > 0 && (
            <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>+ {extraCount} more</div>
          )}
        </div>

        {/* Target selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: T.muted }}>Deploying to:</label>
          <select
            value={target}
            disabled={deploying}
            onChange={(e) => onTargetChange(e.target.value as DeployTarget)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              border: `1px solid ${T.border}`, backgroundColor: T.surface,
              color: targetColor[target], cursor: 'pointer', width: 120,
            }}
          >
            <option value="alpha"      style={{ color: '#4338ca' }}>Alpha</option>
            <option value="beta"       style={{ color: '#0284c7' }}>Beta</option>
            <option value="production" style={{ color: '#16a34a' }}>Production</option>
          </select>
        </div>

        {/* Production promotion warning */}
        {showPromoWarning && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
            padding: '10px 12px', borderRadius: 8,
            backgroundColor: '#fffbeb', border: '1px solid #fde68a',
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
            <span style={{ fontSize: 13, color: '#92400e' }}>
              Heads up — this will promote your project to Production.
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: 8, marginBottom: 16,
            backgroundColor: '#fff8f8', border: '1px solid #fca5a5',
            fontSize: 13, color: '#b91c1c',
          }}>
            ⚠ {error.includes('deploy hook') ? (
              <>No deploy hook set up. <Link to={`/admin?project=${projectId}`} style={{ color: '#4338ca' }}>Go to GitHub Integration →</Link> to connect your repo first.</>
            ) : error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            data-testid="deploy-cancel"
            onClick={onCancel}
            disabled={deploying}
            style={{
              height: 44, padding: '0 20px', borderRadius: 10,
              border: `1.5px solid ${T.border}`, backgroundColor: 'transparent',
              color: T.text, fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="deploy-confirm"
            onClick={handleDeploy}
            disabled={deploying}
            style={{
              height: 44, padding: '0 24px', borderRadius: 10,
              border: 'none', backgroundColor: T.teal, color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: deploying ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {deploying ? (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Deploying…
              </>
            ) : (error ? 'Try again' : 'Deploy now')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes deployModalIn { from { transform: translate(-50%,-50%) scale(.95); opacity: 0; } to { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

// ── Deploy Toast — Build 059 ──────────────────────────────────────────────

function DeployToast({ target, featureCount, onDismiss }: {
  target:       DeployTarget;
  featureCount: number;
  onDismiss:    () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const label: Record<DeployTarget, string> = { alpha: 'Alpha', beta: 'Beta', production: 'Production' };

  return (
    <div
      data-testid="deploy-toast"
      style={{
        position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 300, minWidth: 320,
        backgroundColor: T.deployBg, color: '#fff',
        borderRadius: 10, padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        animation: 'toastIn 0.2s ease',
        overflow: 'hidden',
      }}
    >
      <span style={{ color: T.green, fontSize: 18, flexShrink: 0 }}>✓</span>
      <div style={{ fontSize: 14 }}>
        <span style={{ fontWeight: 600 }}>Deployed to {label[target]}</span>
        <span style={{ color: 'rgba(255,255,255,.65)' }}> — {featureCount} feature{featureCount !== 1 ? 's' : ''} live.</span>
      </div>
      {/* Progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,.15)' }}>
        <div style={{ height: '100%', backgroundColor: T.green, animation: 'toastProgress 4s linear forwards' }} />
      </div>
      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </div>
  );
}

// ── Board column ──────────────────────────────────────────────────────────

function BoardColumn({
  def,
  features,
  projectId,
  projectPhase: _projectPhase,
  selectedIds,
  onSelect,
  totalFeatures,
}: {
  def:           ColumnDef;
  features:      BoardFeature[];
  projectId:     string;
  projectPhase:  string;
  selectedIds:   Set<string>;
  onSelect:      (id: string, checked: boolean) => void;
  totalFeatures: number;
}) {
  const [featureSheetOpen, setFeatureSheetOpen] = useState(false);
  const isReady    = def.variant === 'ready';
  const isDeployed = def.variant === 'deployed';
  const allChecked = features.length > 0 && features.every(f => selectedIds.has(f.id));
  const someChecked = features.some(f => selectedIds.has(f.id));
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Indeterminate state
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someChecked && !allChecked;
    }
  }, [someChecked, allChecked]);

  function handleSelectAll(checked: boolean) {
    features.forEach(f => onSelect(f.id, checked));
  }

  const colBg = isReady ? T.tealLight : isDeployed ? '#f5f5f7' : T.bg;
  const headerColor = isReady ? T.teal : isDeployed ? T.muted : T.text;
  const headerBorderBottom = isReady ? `2px solid ${T.teal}` : isDeployed ? `2px solid transparent` : `2px solid ${T.border}`;

  return (
    <div style={{ width: 200, flexShrink: 0, borderRadius: 8, backgroundColor: colBg, display: 'flex', flexDirection: 'column' }}>
      {/* Column header */}
      <div style={{
        padding: '10px 8px', display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: headerBorderBottom,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: headerColor }}>{def.label}</span>
        <span style={{ fontSize: 11, color: T.muted }}>· {features.length}</span>
        {isReady && (
          <input
            ref={checkboxRef}
            type="checkbox"
            aria-label="Select all"
            checked={allChecked}
            onChange={(e) => handleSelectAll(e.target.checked)}
            style={{ marginLeft: 'auto', width: 14, height: 14, cursor: 'pointer', accentColor: T.accent }}
          />
        )}
      </div>

      {/* Column body */}
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {features.length === 0 ? (
          /* Empty state */
          isReady ? (
            <p style={{ fontSize: 12, color: T.muted, textAlign: 'center', padding: '20px 12px', margin: 0 }}>
              No features ready — features will appear here after QA signs off.
            </p>
          ) : def.id === 'design' && totalFeatures === 0 ? (
            /* Empty board: show add prompt in Designing column only */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '24px 12px', border: `1.5px dashed ${T.border}`, borderRadius: 8, flex: 1,
            }}>
              <button
                onClick={() => setFeatureSheetOpen(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: T.accent, fontWeight: 600, marginBottom: 6, padding: 0,
                }}
              >
                + Add a feature
              </button>
              <p style={{ fontSize: 12, color: T.muted, margin: 0, textAlign: 'center' }}>
                Start with a name and a screen.
              </p>
            </div>
          ) : null /* other empty columns: just show nothing */
        ) : (
          features.map(f => (
            <FeatureCard
              key={f.id}
              feature={f}
              projectId={projectId}
              variant={def.variant}
              isSelected={selectedIds.has(f.id)}
              onSelect={isReady ? onSelect : undefined}
            />
          ))
        )}
      </div>

      {/* Feature creation sheet — only used from the "Add a feature" empty state */}
      <FeatureCreationSheet
        isOpen={featureSheetOpen}
        onClose={() => setFeatureSheetOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}

// ── Mobile list view ─────────────────────────────────────────────────────

function MobileListView({ features, projectId, projectPhase: _projectPhase }: {
  features:     BoardFeature[];
  projectId:    string;
  projectPhase: string;
}) {
  const navigate = useNavigate();
  const groups = COLUMNS.map(col => ({
    col,
    items: features.filter(col.filter),
  })).filter(g => g.items.length > 0 || g.col.id === 'design');

  return (
    <div style={{ padding: '0 0 80px' }}>
      {groups.map(({ col, items }) => (
        <div key={col.id} style={{ marginBottom: 20 }}>
          <div style={{
            padding: '8px 0', borderBottom: `2px solid ${col.variant === 'ready' ? T.teal : T.border}`,
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: col.variant === 'ready' ? T.teal : T.text }}>
              {col.label}
            </span>
            <span style={{ fontSize: 12, color: T.muted, marginLeft: 6 }}>({items.length})</span>
          </div>
          {items.length === 0 && col.id === 'ready' && (
            <p style={{ fontSize: 13, color: T.muted, fontStyle: 'italic' }}>No features ready.</p>
          )}
          {col.id === 'ready' && items.length > 0 && (
            <p style={{ fontSize: 11, color: T.muted, fontStyle: 'italic', marginBottom: 8 }}>
              Select features to deploy from the desktop view.
            </p>
          )}
          {items.map(f => (
            <div
              key={f.id}
              onClick={() => navigate(`/projects/${projectId}/features/${f.id}`)}
              style={{
                padding: '10px 12px', marginBottom: 8, borderRadius: 8,
                backgroundColor: T.surface, border: `1.5px solid ${T.border}`, cursor: 'pointer',
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500, color: T.text }}>{f.name}</p>
              <span style={{ fontSize: 11, color: T.muted }}>
                {f.screen?.name ?? 'Unassigned'} · {formatAge(f.step_entered_at)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function FeatureBoardScreen() {
  const { id: projectId }  = useParams<{ id: string }>();
  const [features,       setFeatures]       = useState<BoardFeature[]>([]);
  const [projectName,    setProjectName]     = useState('Project');
  const [projectPhase,   setProjectPhase]    = useState<string>('alpha');
  const [loading,        setLoading]         = useState(true);
  const [selectedIds,    setSelectedIds]     = useState<Set<string>>(new Set());
  const [deployTarget,   setDeployTarget]    = useState<DeployTarget>('alpha');
  const [showDeploy,     setShowDeploy]      = useState(false);
  const [toast,          setToast]           = useState<{ target: DeployTarget; count: number } | null>(null);
  const [newFeatureOpen, setNewFeatureOpen]  = useState(false);
  const [isMobile,       setIsMobile]        = useState(window.innerWidth < 768);
  // Build 066: triage filter — default 'mvp' so builder focuses on MVP first
  const [triageFilter, setTriageFilter]      = useState<'all' | 'mvp' | 'alpha' | 'beta'>('mvp');

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const [featureRes, projectRes] = await Promise.all([
        supabase
          .from('features')
          .select('id, name, pipeline_step, pipeline_status, deployed_at, deployed_to, step_entered_at, triage_status, screen:screens(name)')
          .eq('project_id', projectId)
          .order('step_entered_at', { ascending: true }),
        supabase
          .from('projects')
          .select('name, phase')
          .eq('id', projectId)
          .single(),
      ]);

      setFeatures((featureRes.data ?? []) as unknown as BoardFeature[]);
      if (projectRes.data) {
        setProjectName(projectRes.data.name);
        setProjectPhase(projectRes.data.phase ?? 'alpha');
        setDeployTarget((projectRes.data.phase as DeployTarget) ?? 'alpha');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  function handleDeploySuccess(target: DeployTarget, count: number) {
    setShowDeploy(false);
    setSelectedIds(new Set());
    setToast({ target, count });
    // Optimistic update: mark selected features as deployed
    setFeatures(prev => prev.map(f =>
      selectedIds.has(f.id)
        ? { ...f, deployed_at: new Date().toISOString(), deployed_to: target }
        : f
    ));
    load(); // also re-fetch for accuracy
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: T.muted, fontSize: 15 }}>Loading features…</div>
    );
  }

  // Build 066: apply triage filter; always hide 'removed' features
  const filteredFeatures = features.filter(f => {
    if (f.triage_status === 'removed') return false;
    if (triageFilter === 'all') return true;
    return f.triage_status === triageFilter;
  });

  const totalFeatures = filteredFeatures.length;
  const selectedList  = filteredFeatures.filter(f => selectedIds.has(f.id));

  return (
    <div style={{ maxWidth: '100%', padding: '24px 20px', paddingBottom: selectedIds.size > 0 ? 80 : 32 }}>

      {/* Breadcrumb */}
      <nav style={{ fontSize: 13, color: T.muted, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link to={`/projects/${projectId}`} style={{ color: T.muted, textDecoration: 'none' }}>
          {projectName}
        </Link>
        <span>›</span>
        <span style={{ color: T.text, fontWeight: 500 }}>Features</span>
      </nav>

      {/* Board header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text }}>Features</h1>
          <span style={{ fontSize: 13, color: T.muted }}>{totalFeatures} feature{totalFeatures !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            to={`/projects/${projectId}/triage?mode=reprioritize`}
            style={{ fontSize: 13, color: T.muted, textDecoration: 'none', fontWeight: 500 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.accent; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.muted; }}
          >
            Reprioritize →
          </Link>
          <button
            data-testid="feature-board-new-btn"
            onClick={() => setNewFeatureOpen(true)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: `1.5px solid ${T.accent}`, backgroundColor: 'transparent',
              color: T.accent, cursor: 'pointer',
            }}
          >
            + New feature
          </button>
        </div>
      </div>

      {/* Build 066: Triage filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['all', 'mvp', 'alpha', 'beta'] as const).map(pill => {
          const PILL_COLORS: Record<string, { bg: string; color: string }> = {
            all:   { bg: '#f3f4f6', color: '#6b7280' },
            mvp:   { bg: '#dcfce7', color: '#16a34a' },
            alpha: { bg: '#dbeafe', color: '#1d4ed8' },
            beta:  { bg: '#f3f4f6', color: '#6b7280' },
          };
          const meta    = PILL_COLORS[pill];
          const active  = triageFilter === pill;
          const label   = pill.charAt(0).toUpperCase() + pill.slice(1);
          return (
            <button
              key={pill}
              onClick={() => setTriageFilter(pill)}
              style={{
                padding:      '4px 12px',
                fontSize:     12,
                fontWeight:   active ? 700 : 500,
                color:        active ? meta.color : T.muted,
                background:   active ? meta.bg    : 'transparent',
                border:       active ? `1.5px solid ${meta.color}44` : `1.5px solid ${T.border}`,
                borderRadius: 20,
                cursor:       'pointer',
                transition:   'all 0.12s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Board — desktop horizontal scroll or mobile list */}
      {isMobile ? (
        <MobileListView features={filteredFeatures} projectId={projectId!} projectPhase={projectPhase} />
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', alignItems: 'flex-start' }}>
            {COLUMNS.map(col => (
              <BoardColumn
                key={col.id}
                def={col}
                features={filteredFeatures.filter(col.filter)}
                projectId={projectId!}
                projectPhase={projectPhase}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                totalFeatures={totalFeatures}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sticky action bar — appears when cards are selected */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          height: 56, backgroundColor: T.deployBg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px',
          animation: 'barIn 0.2s ease',
        }}>
          <span style={{ fontSize: 13 }}>☑ {selectedIds.size} feature{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              data-testid="sticky-deploy-btn"
              onClick={() => setShowDeploy(true)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: 'none', backgroundColor: T.teal, color: '#fff', cursor: 'pointer',
              }}
            >
              Deploy {selectedIds.size} feature{selectedIds.size !== 1 ? 's' : ''} →
            </button>
            <select
              data-testid="deploy-target-select"
              value={deployTarget}
              onChange={(e) => setDeployTarget(e.target.value as DeployTarget)}
              style={{
                padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#fff',
                backgroundColor: '#2a2a2e', border: '1px solid #3a3a3e',
                borderRadius: 6, cursor: 'pointer',
              }}
            >
              <option value="alpha">Alpha</option>
              <option value="beta">Beta</option>
              <option value="production">Production</option>
            </select>
          </div>
        </div>
      )}

      {/* Deploy Confirm Modal — Build 059 */}
      {showDeploy && (
        <DeployConfirmModal
          selectedFeatures={selectedList}
          target={deployTarget}
          projectPhase={projectPhase}
          projectId={projectId!}
          onTargetChange={setDeployTarget}
          onSuccess={handleDeploySuccess}
          onCancel={() => setShowDeploy(false)}
        />
      )}

      {/* Deploy Toast — Build 059 */}
      {toast && (
        <DeployToast
          target={toast.target}
          featureCount={toast.count}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* New Feature Sheet */}
      <FeatureCreationSheet
        isOpen={newFeatureOpen}
        onClose={() => setNewFeatureOpen(false)}
        projectId={projectId!}
        onCreated={() => { load(); }}
      />

      <style>{`
        @keyframes barIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
