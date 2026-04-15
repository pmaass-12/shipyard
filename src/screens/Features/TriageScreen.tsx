/**
 * TriageScreen — Build 066
 *
 * Route: /projects/:id/triage
 * Route (reprioritize): /projects/:id/triage?mode=reprioritize
 *
 * One-time feature triage screen: builder assigns each feature to MVP / Alpha / Beta.
 * Tier changes write to DB immediately. No Save button (unless ?mode=reprioritize).
 * Drag handles reorder within a tier (client-side only, V1).
 *
 * Amendment 1 changes from original PRD:
 *  - "Beta" replaces "Backlog" everywhere
 *  - Single grouped list replaces 3-column Kanban
 *  - Every change persists instantly
 *
 * Styling: inline styles only. No Tailwind.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { TriageStatus } from '@/types/db';

// ── Types ─────────────────────────────────────────────────────────────────

interface TriageFeature {
  id:            string;
  name:          string;
  description:   string | null;
  triage_status: TriageStatus;
}

// ── Design tokens ─────────────────────────────────────────────────────────

const T = {
  accent:  'var(--color-accent, #5b5bd6)',
  text:    'var(--color-text, #1a1a1e)',
  muted:   'var(--color-text-muted, #6e6e80)',
  border:  'var(--color-border, #e4e4e8)',
  surface: 'var(--color-surface, #ffffff)',
  bg:      'var(--color-bg, #f5f5f7)',
};

const TIER_META: Record<TriageStatus, { label: string; bg: string; color: string; sectionBg: string }> = {
  mvp:     { label: 'MVP',   bg: '#dcfce7', color: '#16a34a', sectionBg: '#f0fdf4' },
  alpha:   { label: 'Alpha', bg: '#dbeafe', color: '#1d4ed8', sectionBg: '#eff6ff' },
  beta:    { label: 'Beta',  bg: '#f3f4f6', color: '#6b7280', sectionBg: '#fafafa' },
  removed: { label: 'Removed', bg: '#fee2e2', color: '#dc2626', sectionBg: '#fff5f5' },
};

const TIERS: TriageStatus[] = ['mvp', 'alpha', 'beta'];

// ── Helpers ───────────────────────────────────────────────────────────────

/** Pick a Reeve suggestion from the MVP list (most foundational feature). */
function reeveSuggestion(mvpFeatures: TriageFeature[]): string | null {
  if (mvpFeatures.length === 0) return null;
  const authKeywords = ['auth', 'login', 'sign in', 'signup', 'register', 'user', 'account'];
  const found = mvpFeatures.find(f =>
    authKeywords.some(kw => f.name.toLowerCase().includes(kw))
  );
  const pick = found ?? mvpFeatures[0];
  return `Start with ${pick.name} — everything else will likely depend on it.`;
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function TriageScreen() {
  const { id: projectId }           = useParams<{ id: string }>();
  const navigate                    = useNavigate();
  const [searchParams]              = useSearchParams();
  const isReprioritize              = searchParams.get('mode') === 'reprioritize';

  const [features, setFeatures]     = useState<TriageFeature[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Inline editing
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValue, setEditValue]   = useState('');

  // Add feature
  const [showAddInput, setShowAddInput] = useState(false);
  const [addValue, setAddValue]     = useState('');
  const addInputRef                 = useRef<HTMLInputElement>(null);

  // Drag state (client-side only)
  const draggingId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  // "Start building" nudge
  const [showNudge, setShowNudge]   = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('features')
        .select('id, name, description, triage_status')
        .eq('project_id', projectId)
        .neq('triage_status', 'removed')
        .order('triage_status')
        .order('created_at');
      if (err) { setError(err.message); setLoading(false); return; }
      setFeatures((data ?? []) as TriageFeature[]);
      setLoading(false);
    })();
  }, [projectId]);

  // ── Focus add input when shown ─────────────────────────────────────────

  useEffect(() => {
    if (showAddInput) addInputRef.current?.focus();
  }, [showAddInput]);

  // ── Tier change — instant DB write ────────────────────────────────────

  const changeTier = useCallback(async (featureId: string, newTier: TriageStatus) => {
    // Optimistic update
    setFeatures(prev => prev.map(f =>
      f.id === featureId ? { ...f, triage_status: newTier } : f
    ));
    const { error: err } = await supabase
      .from('features')
      .update({ triage_status: newTier })
      .eq('id', featureId);
    if (err) {
      console.error('Triage tier update failed:', err.message);
      // Rollback on error — reload from DB
      const { data } = await supabase
        .from('features')
        .select('id, name, description, triage_status')
        .eq('project_id', projectId!)
        .neq('triage_status', 'removed')
        .order('triage_status')
        .order('created_at');
      if (data) setFeatures(data as TriageFeature[]);
    }
  }, [projectId]);

  // ── Soft-delete ────────────────────────────────────────────────────────

  const removeFeature = useCallback(async (featureId: string) => {
    setFeatures(prev => prev.filter(f => f.id !== featureId));
    await supabase
      .from('features')
      .update({ triage_status: 'removed' })
      .eq('id', featureId);
  }, []);

  // ── Inline name edit ───────────────────────────────────────────────────

  const startEdit = (feature: TriageFeature) => {
    setEditingId(feature.id);
    setEditValue(feature.name);
  };

  const commitEdit = async (featureId: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) { setEditingId(null); return; }
    setFeatures(prev => prev.map(f =>
      f.id === featureId ? { ...f, name: trimmed } : f
    ));
    setEditingId(null);
    await supabase
      .from('features')
      .update({ name: trimmed })
      .eq('id', featureId);
  };

  // ── Add feature ────────────────────────────────────────────────────────

  const commitAdd = async () => {
    const trimmed = addValue.trim();
    if (!trimmed || !projectId) { setShowAddInput(false); setAddValue(''); return; }
    const { data, error: err } = await supabase
      .from('features')
      .insert({
        project_id:    projectId,
        name:          trimmed,
        triage_status: 'mvp' as TriageStatus,
        status:        'backlog',
      })
      .select('id, name, description, triage_status')
      .single();
    if (!err && data) {
      setFeatures(prev => [data as TriageFeature, ...prev]);
    }
    setAddValue('');
    setShowAddInput(false);
  };

  // ── Drag-and-drop (client-side reorder within tier) ───────────────────

  const handleDragStart = (featureId: string) => {
    draggingId.current = featureId;
      };

  const handleDragOver = (e: React.DragEvent, featureId: string) => {
    e.preventDefault();
    dragOverId.current = featureId;
  };

  const handleDrop = (e: React.DragEvent, targetTier: TriageStatus) => {
    e.preventDefault();
    const srcId    = draggingId.current;
    const targetId = dragOverId.current;
    if (!srcId) { draggingId.current = null; dragOverId.current = null; return; }

    const src = features.find(f => f.id === srcId);
    if (!src) { draggingId.current = null; dragOverId.current = null; return; }

    // If dropped on a different tier's section, change tier
    if (src.triage_status !== targetTier) {
      changeTier(srcId, targetTier);
      draggingId.current = null; dragOverId.current = null;
      return;
    }

    // Same tier — reorder
    if (!targetId || srcId === targetId) {
      draggingId.current = null; dragOverId.current = null;
      return;
    }

    setFeatures(prev => {
      const tierItems = prev.filter(f => f.triage_status === targetTier);
      const others    = prev.filter(f => f.triage_status !== targetTier);
      const srcIdx    = tierItems.findIndex(f => f.id === srcId);
      const tgtIdx    = tierItems.findIndex(f => f.id === targetId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      const reordered = [...tierItems];
      const [moved]   = reordered.splice(srcIdx, 1);
      reordered.splice(tgtIdx, 0, moved);
      // Reconstruct in tier order: mvp → alpha → beta
      const result: TriageFeature[] = [];
      for (const tier of TIERS) {
        if (tier === targetTier) result.push(...reordered);
        else result.push(...others.filter(f => f.triage_status === tier));
      }
      return result;
    });

    draggingId.current = null; dragOverId.current = null;
  };

  const handleDragEnd = () => {
    draggingId.current = null; dragOverId.current = null;
  };

  // ── "Start building" CTA ──────────────────────────────────────────────

  const handleStartBuilding = async () => {
    if (isReprioritize) {
      navigate(`/projects/${projectId}/features`);
      return;
    }
    const mvpFeatures = features.filter(f => f.triage_status === 'mvp');
    if (mvpFeatures.length === 0) { setShowNudge(true); return; }
    setShowNudge(false);
    const firstMvp = mvpFeatures[0];
    navigate(`/projects/${projectId}/features/${firstMvp.id}/chat`);
  };

  // ── Derived ────────────────────────────────────────────────────────────

  const featuresByTier = (tier: TriageStatus) =>
    features.filter(f => f.triage_status === tier);

  const mvpFeatures = featuresByTier('mvp');
  const suggestion  = !isReprioritize ? reeveSuggestion(mvpFeatures) : null;

  // ── Loading / error states ─────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: T.bg }}>
        <div style={{ color: T.muted, fontSize: 14 }}>Loading features…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: T.bg }}>
        <div style={{ color: '#dc2626', fontSize: 14 }}>Failed to load features: {error}</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.bg, fontFamily: 'inherit' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: T.surface,
        borderBottom:    `1px solid ${T.border}`,
        padding:         '0 24px',
        height:          52,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
      }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: T.text }}>
          {isReprioritize ? 'Reprioritize features' : 'Feature Triage'}
        </span>
        {!isReprioritize && (
          <span style={{ fontSize: 12, color: T.muted }}>Step 2 of 2</span>
        )}
      </div>

      {/* ── Page body ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Heading */}
        {!isReprioritize && (
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: '0 0 6px' }}>
              Here's what I found in your brief.
            </h1>
            <p style={{ fontSize: 14, color: T.muted, margin: 0 }}>
              Set each feature's phase — or edit anything that isn't right.
            </p>
          </div>
        )}

        {/* + Add feature button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button
            onClick={() => setShowAddInput(true)}
            style={{
              padding:         '6px 12px',
              fontSize:        13,
              fontWeight:      500,
              color:           T.accent,
              background:      'transparent',
              border:          `1.5px solid ${T.accent}`,
              borderRadius:    6,
              cursor:          'pointer',
            }}
          >
            + Add feature
          </button>
        </div>

        {/* Inline add input (appears at top of MVP group) */}
        {showAddInput && (
          <div style={{
            backgroundColor: T.surface,
            border:          `1.5px solid ${T.accent}`,
            borderRadius:    8,
            padding:         '10px 12px',
            marginBottom:    12,
            display:         'flex',
            gap:             8,
          }}>
            <input
              ref={addInputRef}
              value={addValue}
              onChange={e => setAddValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitAdd();
                if (e.key === 'Escape') { setShowAddInput(false); setAddValue(''); }
              }}
              placeholder="Feature name…"
              style={{
                flex:        1,
                border:      'none',
                outline:     'none',
                fontSize:    14,
                color:       T.text,
                background:  'transparent',
              }}
            />
            <button
              onClick={commitAdd}
              style={{
                padding:      '4px 10px',
                fontSize:     13,
                fontWeight:   500,
                color:        '#fff',
                background:   T.accent,
                border:       'none',
                borderRadius: 5,
                cursor:       'pointer',
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddInput(false); setAddValue(''); }}
              style={{
                padding:      '4px 8px',
                fontSize:     13,
                color:        T.muted,
                background:   'transparent',
                border:       'none',
                cursor:       'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Tier sections ─────────────────────────────────────────────── */}
        {TIERS.map(tier => {
          const meta  = TIER_META[tier];
          const items = featuresByTier(tier);

          return (
            <div
              key={tier}
              data-tier={tier}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, tier)}
              style={{ marginBottom: 20 }}
            >
              {/* Section header */}
              <div style={{
                display:        'flex',
                alignItems:     'center',
                gap:            8,
                padding:        '8px 0 6px',
                borderBottom:   `2px solid ${meta.color}22`,
                marginBottom:   8,
              }}>
                <span style={{
                  fontSize:     11,
                  fontWeight:   700,
                  letterSpacing:'0.06em',
                  textTransform:'uppercase',
                  color:        meta.color,
                }}>
                  {meta.label}
                </span>
                <span style={{
                  fontSize:     11,
                  color:        T.muted,
                  fontWeight:   400,
                }}>
                  {items.length === 0
                    ? '— no features'
                    : `${items.length} feature${items.length === 1 ? '' : 's'}`}
                </span>
              </div>

              {/* Feature rows */}
              {items.length === 0 && (
                <div style={{
                  padding:      '12px 14px',
                  borderRadius: 7,
                  border:       `1.5px dashed ${T.border}`,
                  color:        T.muted,
                  fontSize:     13,
                  textAlign:    'center',
                }}>
                  Drop features here
                </div>
              )}

              {items.map(feature => (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  currentTier={tier}
                  editingId={editingId}
                  editValue={editValue}
                  onDragStart={() => handleDragStart(feature.id)}
                  onDragOver={e => handleDragOver(e, feature.id)}
                  onDragEnd={handleDragEnd}
                  onStartEdit={() => startEdit(feature)}
                  onEditChange={setEditValue}
                  onCommitEdit={() => commitEdit(feature.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onTierChange={newTier => changeTier(feature.id, newTier)}
                  onRemove={() => removeFeature(feature.id)}
                />
              ))}
            </div>
          );
        })}

        {/* ── Reeve suggestion ──────────────────────────────────────────── */}
        {suggestion && (
          <div style={{
            display:         'flex',
            alignItems:      'flex-start',
            gap:             10,
            padding:         '12px 14px',
            borderRadius:    8,
            backgroundColor: '#faf5ff',
            border:          '1.5px solid #e9d5ff',
            marginBottom:    24,
            marginTop:       8,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>✦</span>
            <p style={{ margin: 0, fontSize: 13, color: '#6d28d9', lineHeight: 1.5 }}>
              <strong>Reeve's suggestion:</strong> {suggestion}
            </p>
          </div>
        )}

        {/* Empty MVP nudge */}
        {showNudge && (
          <div style={{
            padding:         '10px 14px',
            borderRadius:    7,
            backgroundColor: '#fff7ed',
            border:          '1.5px solid #fed7aa',
            color:           '#c2410c',
            fontSize:        13,
            marginBottom:    16,
          }}>
            Move at least one feature to MVP to get started.
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleStartBuilding}
            style={{
              padding:      '10px 20px',
              fontSize:     14,
              fontWeight:   600,
              color:        '#fff',
              background:   T.accent,
              border:       'none',
              borderRadius: 8,
              cursor:       'pointer',
              letterSpacing:'0.01em',
            }}
          >
            {isReprioritize ? 'Save' : 'Start building →'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── FeatureRow sub-component ───────────────────────────────────────────────

interface FeatureRowProps {
  feature:       TriageFeature;
  currentTier:   TriageStatus;
  editingId:     string | null;
  editValue:     string;
  onDragStart:   () => void;
  onDragOver:    (e: React.DragEvent) => void;
  onDragEnd:     () => void;
  onStartEdit:   () => void;
  onEditChange:  (v: string) => void;
  onCommitEdit:  () => void;
  onCancelEdit:  () => void;
  onTierChange:  (tier: TriageStatus) => void;
  onRemove:      () => void;
}

function FeatureRow({
  feature,
  currentTier,
  editingId,
  editValue,
  onDragStart,
  onDragOver,
  onDragEnd,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onCancelEdit,
  onTierChange,
  onRemove,
}: FeatureRowProps) {
  const isEditing = editingId === feature.id;

  const tierPills: TriageStatus[] = ['mvp', 'alpha', 'beta'];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        padding:         '9px 12px',
        marginBottom:    6,
        borderRadius:    8,
        backgroundColor: 'var(--color-surface, #ffffff)',
        border:          '1.5px solid var(--color-border, #e4e4e8)',
        userSelect:      'none',
      }}
    >
      {/* Drag handle */}
      <span
        title="Drag to reorder"
        style={{
          cursor:   'grab',
          color:    'var(--color-text-muted, #6e6e80)',
          fontSize: 16,
          flexShrink: 0,
          lineHeight: 1,
          opacity: 0.5,
        }}
      >
        ⠿
      </span>

      {/* Feature name (inline edit) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') onCommitEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            style={{
              width:        '100%',
              fontSize:     14,
              fontWeight:   500,
              color:        'var(--color-text, #1a1a1e)',
              border:       'none',
              outline:      '2px solid var(--color-accent, #5b5bd6)',
              borderRadius: 4,
              padding:      '1px 4px',
              background:   'transparent',
            }}
          />
        ) : (
          <span
            onClick={onStartEdit}
            title="Click to edit"
            style={{
              fontSize:    14,
              fontWeight:  500,
              color:       'var(--color-text, #1a1a1e)',
              cursor:      'text',
              display:     'block',
              overflow:    'hidden',
              textOverflow:'ellipsis',
              whiteSpace:  'nowrap',
            }}
          >
            {feature.name}
          </span>
        )}
      </div>

      {/* Tier pills */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {tierPills.map(tier => {
          const meta    = TIER_META[tier];
          const active  = currentTier === tier;
          return (
            <button
              key={tier}
              onClick={() => !active && onTierChange(tier)}
              style={{
                padding:      '3px 8px',
                fontSize:     11,
                fontWeight:   active ? 700 : 400,
                color:        active ? meta.color : 'var(--color-text-muted, #6e6e80)',
                background:   active ? meta.bg    : 'transparent',
                border:       active
                  ? `1.5px solid ${meta.color}55`
                  : '1.5px solid transparent',
                borderRadius: 5,
                cursor:       active ? 'default' : 'pointer',
                transition:   'all 0.12s',
                whiteSpace:   'nowrap',
              }}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        title="Remove feature"
        style={{
          flexShrink:  0,
          width:       22,
          height:      22,
          display:     'flex',
          alignItems:  'center',
          justifyContent: 'center',
          fontSize:    14,
          color:       'var(--color-text-muted, #6e6e80)',
          background:  'transparent',
          border:      'none',
          cursor:      'pointer',
          borderRadius:4,
          lineHeight:  1,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#dc2626'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted, #6e6e80)'; }}
      >
        ✕
      </button>
    </div>
  );
}
