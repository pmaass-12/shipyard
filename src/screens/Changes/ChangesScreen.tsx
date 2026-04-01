/**
 * Changes Screen — Build 035
 *
 * Builder-filed revision requests against screens/features.
 * Filter by status + priority. Expanded cards show screenshot + annotations.
 * "New Change" panel for filing revisions.
 * Route: /projects/:id/changes
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  listChanges,
  getActiveChangeCount,
  createChange,
  updateChangeStatus,
  dismissChange,
} from '@/api/changes';
import type { Change, ChangeStatus, ChangePriority, ChangeTargetType } from '@/types/db';

// ── Status badge styles ────────────────────────────────────────────────────

function getStatusColors(status: ChangeStatus): {
  bg: string; text: string; label: string; iconBg: string; iconColor: string;
} {
  const map: Record<ChangeStatus, any> = {
    pending: {
      bg: '#f5f3ff', text: '#7c3aed', label: 'Pending',
      iconBg: '#f5f3ff', iconColor: '#7c3aed',
    },
    in_progress: {
      bg: '#eeeefd', text: '#5b5bd6', label: 'In Progress',
      iconBg: '#eeeefd', iconColor: '#5b5bd6',
    },
    done: {
      bg: '#dcfce7', text: '#16a34a', label: 'Done',
      iconBg: '#dcfce7', iconColor: '#16a34a',
    },
    dismissed: {
      bg: '#f3f4f6', text: '#6b7280', label: 'Dismissed',
      iconBg: '#f3f4f6', iconColor: '#9ca3af',
    },
  };
  return map[status];
}

function getPriorityColors(priority: ChangePriority): { bg: string; text: string } {
  const map: Record<ChangePriority, any> = {
    p0: { bg: '#fee2e2', text: '#dc2626' },
    p1: { bg: '#ffedd5', text: '#c2410c' },
    p2: { bg: '#fef3c7', text: '#d97706' },
    p3: { bg: '#f3f4f6', text: '#9ca3af' },
  };
  return map[priority];
}

// ── Change card (collapsed + expandable) ────────────────────────────────────

function ChangeCard({
  change,
  onStatusChange,
  onDismiss,
}: {
  change: Change;
  onStatusChange: (id: string, status: ChangeStatus) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const statusColors = getStatusColors(change.status);
  const priorityColors = getPriorityColors(change.priority);

  async function handleStatusChange(newStatus: ChangeStatus) {
    setStatusLoading(true);
    try {
      await updateChangeStatus(change.id, newStatus);
      onStatusChange(change.id, newStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleDismiss() {
    try {
      await dismissChange(change.id);
      onDismiss(change.id);
    } catch (err) {
      console.error(err);
    }
  }

  // Format date
  const createdDate = new Date(change.created_at);
  const dateStr = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      data-testid={`change-card-${change.id}`}
      style={{
        backgroundColor: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, overflow: 'hidden', marginBottom: 8,
        transition: 'box-shadow 0.15s, border-color 0.15s',
        boxShadow: expanded ? '0 2px 8px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.05)' : 'none',
        borderColor: expanded ? '#8b8be0' : '#e5e7eb',
        opacity: change.status === 'dismissed' ? 0.55 : 1,
      }}
    >
      {/* Collapsed card row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', cursor: 'pointer',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          backgroundColor: statusColors.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          marginTop: 1,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={statusColors.iconColor}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 500, color: change.status === 'done' ? '#6b7280' : '#111827',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', lineHeight: 1.45, marginBottom: 5,
          }}>
            {change.description}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 12, color: '#5b5bd6', fontWeight: 500,
              textDecoration: 'none',
            }}>
              {change.target_type === 'screen' ? 'Screen' : 'Feature'}
            </span>
            <span style={{ fontSize: 12, color: '#e5e7eb' }}>·</span>
            <span
              data-testid={`change-priority-${change.id}`}
              style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                backgroundColor: priorityColors.bg, color: priorityColors.text,
                letterSpacing: '0.02em',
              }}
            >
              {change.priority.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, color: '#e5e7eb' }}>·</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {dateStr}
            </span>
          </div>

          {/* Iteration running callout */}
          {change.status === 'in_progress' && change.pipeline_run_id && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
              color: '#5b5bd6', backgroundColor: '#eeeefd', borderRadius: 7,
              padding: '6px 10px', marginTop: 8,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: '#5b5bd6', flexShrink: 0,
                animation: 'pulse 1.4s ease-in-out infinite',
              }} />
              <style>{`
                @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
              `}</style>
              Iteration running
            </div>
          )}
        </div>

        {/* Status dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <select
            data-testid={`change-status-${change.id}`}
            value={change.status}
            onChange={(e) => handleStatusChange(e.target.value as ChangeStatus)}
            onClick={(e) => e.stopPropagation()}
            disabled={statusLoading}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              backgroundColor: statusColors.bg, color: statusColors.text,
              fontFamily: 'inherit', opacity: statusLoading ? 0.6 : 1,
            }}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #f0f0f2', padding: '16px 16px 16px 60px',
          backgroundColor: '#fafafa',
        }}>
          {/* Full description */}
          <div style={{
            fontSize: 13, color: '#6b7280', lineHeight: 1.65, marginBottom: 14,
          }}>
            {change.description}
          </div>

          {/* Screenshot thumbnail */}
          {change.screenshot_url && (
            <div style={{
              width: 140, height: 90, borderRadius: 6, border: '1px solid #e5e7eb',
              background: 'linear-gradient(135deg, #e8e8ec 0%, #d1d5db 100%)',
              marginBottom: 14, overflow: 'hidden', position: 'relative', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src={change.screenshot_url}
                alt="Screenshot"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Annotations (if any) */}
          {change.annotations && change.annotations.length > 0 && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>
              {change.annotations.length} annotation{change.annotations.length !== 1 ? 's' : ''}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {change.status === 'pending' && (
              <button
                data-testid={`start-iteration-${change.id}`}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  backgroundColor: '#5b5bd6', color: '#fff', border: 'none',
                  cursor: 'pointer', transition: 'background 0.12s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4a4abf')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#5b5bd6')}
              >
                Start Iteration
              </button>
            )}

            {change.status !== 'dismissed' && (
              <button
                onClick={handleDismiss}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  backgroundColor: 'transparent', color: '#9ca3af',
                  border: '1px solid #e5e7eb', cursor: 'pointer',
                  transition: 'all 0.12s', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#6b7280';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#9ca3af';
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onNewChange }: { onNewChange: () => void }) {
  return (
    <div data-testid="changes-empty-state" style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', padding: '60px 40px', gap: 12,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, backgroundColor: '#f5f3ff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
        No changes yet
      </div>
      <div style={{
        fontSize: 13, color: '#9ca3af', lineHeight: 1.6, maxWidth: 340,
      }}>
        File a Change when you want to revise something that's already built — a layout tweak, copy
        update, or interaction change. It's not broken; you just want it different.
      </div>
      <button
        onClick={onNewChange}
        style={{
          marginTop: 8, padding: '7px 14px', borderRadius: 8, fontSize: 13,
          fontWeight: 600, backgroundColor: '#5b5bd6', color: '#fff', border: 'none',
          cursor: 'pointer', transition: 'background 0.12s', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4a4abf')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#5b5bd6')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        File your first Change
      </button>
    </div>
  );
}

// ── New Change slide-in panel ──────────────────────────────────────────────

function NewChangePanel({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (change: Change) => void;
}) {
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<ChangeTargetType>('screen');
  const [targetId, setTargetId] = useState('');
  const [priority, setPriority] = useState<ChangePriority>('p1');
  const [screenshotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!description.trim() || !targetId.trim()) {
      setError('Please fill in description and target');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const change = await createChange({
        project_id: projectId,
        description: description.trim(),
        target_type: targetType,
        target_id: targetId.trim(),
        priority,
        screenshot_url: screenshotUrl,
      });
      onCreated(change);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to create change');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,.25)', zIndex: 50,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        data-testid="new-change-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420, height: '100vh', backgroundColor: '#fff',
          borderLeft: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>
            New Change
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 7, border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af', transition: 'background 0.1s', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>
          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
              Description
            </label>
            <textarea
              data-testid="new-change-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to change?"
              rows={4}
              style={{
                padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                color: '#111827', lineHeight: 1.55, outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#5b5bd6')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Target type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
              Target type
            </label>
            <select
              data-testid="new-change-target-type"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as ChangeTargetType)}
              style={{
                padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', color: '#111827',
                backgroundColor: '#fff', outline: 'none', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#5b5bd6')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              <option value="screen">Screen</option>
              <option value="feature">Feature</option>
            </select>
          </div>

          {/* Target ID (simplified — just a text input for now) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
              Target
            </label>
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder={targetType === 'screen' ? 'Screen name or ID' : 'Feature name or ID'}
              style={{
                padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', color: '#111827',
                backgroundColor: '#fff', outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#5b5bd6')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              Name or ID of the {targetType}
            </div>
          </div>

          {/* Priority selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
              Priority
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {(['p0', 'p1', 'p2', 'p3'] as ChangePriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  style={{
                    padding: '8px 6px', borderRadius: 7,
                    border: priority === p ? '1.5px solid #5b5bd6' : '1.5px solid #e5e7eb',
                    textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.12s', fontSize: 11, fontWeight: 700,
                    backgroundColor: priority === p ? '#eeeefd' : 'transparent',
                    color: priority === p ? '#5b5bd6' : '#111827',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#8b8be0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = priority === p ? '#5b5bd6' : '#e5e7eb';
                  }}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              padding: 10, borderRadius: 6, backgroundColor: '#fee2e2', color: '#dc2626',
              fontSize: 12,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 6,
              border: '1px solid #e5e7eb', backgroundColor: '#fff',
              color: '#6b7280', cursor: 'pointer', fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="new-change-submit"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none',
              backgroundColor: '#5b5bd6', color: '#fff', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Creating...' : 'File Change'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

type FilterStatus = 'all' | ChangeStatus;

export default function ChangesScreen() {
  const { id: projectId } = useParams<{ id: string }>();

  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | ChangePriority>('all');
  const [showNewChangePanel, setShowNewChangePanel] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  const loadChanges = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const opts: { status?: ChangeStatus; priority?: ChangePriority } = {};
      if (activeFilter !== 'all') opts.status = activeFilter;
      if (priorityFilter !== 'all') opts.priority = priorityFilter;
      const data = await listChanges(projectId, opts);
      setChanges(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeFilter, priorityFilter]);

  // Load active count for badge
  useEffect(() => {
    if (!projectId) return;
    getActiveChangeCount(projectId)
      .then(setActiveCount)
      .catch(console.error);
  }, [projectId, changes]);

  // Load changes on mount and filter change
  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  // Real-time subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`changes:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'changes', filter: `project_id=eq.${projectId}` },
        () => {
          loadChanges();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId, loadChanges]);

  function handleStatusChange(id: string, status: ChangeStatus) {
    setChanges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
  }

  function handleDismiss(id: string) {
    setChanges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'dismissed' as ChangeStatus } : c))
    );
  }

  function handleChangeCreated(change: Change) {
    setChanges((prev) => [change, ...prev]);
  }

  // Grouping and counting
  const grouped: Record<ChangeStatus, Change[]> = {
    pending: [],
    in_progress: [],
    done: [],
    dismissed: [],
  };

  changes.forEach((c) => {
    grouped[c.status].push(c);
  });

  const tabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: changes.length },
    { key: 'pending', label: 'Pending', count: grouped.pending.length },
    { key: 'in_progress', label: 'In Progress', count: grouped.in_progress.length },
    { key: 'done', label: 'Done', count: grouped.done.length },
    { key: 'dismissed', label: 'Dismissed', count: grouped.dismissed.length },
  ];

  const filteredChanges = activeFilter === 'all' ? changes : grouped[activeFilter];

  return (
    <div
      data-testid="changes-screen"
      style={{
        display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f5f5f7',
      }}
    >
      {/* Page header */}
      <div style={{
        backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Changes</div>
        {activeCount > 0 && (
          <div style={{
            fontSize: 12, color: '#9ca3af', backgroundColor: '#f3f4f6',
            padding: '2px 9px', borderRadius: 10, fontWeight: 600,
          }}>
            {activeCount} active
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            data-testid="new-change-btn"
            onClick={() => setShowNewChangePanel(true)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', border: 'none', background: '#5b5bd6', color: '#fff',
              transition: 'all 0.12s', display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4a4abf')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#5b5bd6')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Change
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            data-testid={`filter-${tab.key}`}
            onClick={() => setActiveFilter(tab.key)}
            style={{
              padding: '10px 14px', fontSize: 12, fontWeight: 600,
              color: activeFilter === tab.key ? '#5b5bd6' : '#9ca3af',
              cursor: 'pointer', borderBottom: activeFilter === tab.key ? '2px solid #5b5bd6' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.1s', whiteSpace: 'nowrap',
              backgroundColor: 'transparent', border: 'none', fontFamily: 'inherit',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                display: 'inline-block', marginLeft: 5, fontSize: 10, fontWeight: 700,
                backgroundColor: activeFilter === tab.key ? '#eeeefd' : '#f3f4f6',
                color: activeFilter === tab.key ? '#5b5bd6' : '#9ca3af',
                padding: '1px 6px', borderRadius: 8,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}

        {/* Priority filter */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', paddingRight: 0 }}>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            style={{
              padding: '5px 10px', borderRadius: 7, border: '1px solid #e5e7eb',
              backgroundColor: '#fff', fontSize: 12, color: '#6b7280', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <option value="all">Any priority</option>
            <option value="p0">P0</option>
            <option value="p1">P1</option>
            <option value="p2">P2</option>
            <option value="p3">P3</option>
          </select>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: 24, color: '#9ca3af', fontSize: 14 }}>
            Loading changes…
          </div>
        ) : filteredChanges.length === 0 ? (
          <EmptyState onNewChange={() => setShowNewChangePanel(true)} />
        ) : (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Group by status if showing all */}
            {activeFilter === 'all' ? (
              <>
                {Object.entries(grouped).map(([status, statusChanges]) =>
                  statusChanges.length > 0 ? (
                    <div key={status}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em', color: '#9ca3af',
                        padding: '8px 0 4px',
                      }}>
                        <span>
                          {status === 'pending' ? 'Pending' :
                            status === 'in_progress' ? 'In Progress' :
                              status === 'done' ? 'Done' : 'Dismissed'}
                        </span>
                        <div style={{ flex: 1, height: 1, backgroundColor: '#f0f0f2' }} />
                      </div>
                      {statusChanges.map((change) => (
                        <ChangeCard
                          key={change.id}
                          change={change}
                          onStatusChange={handleStatusChange}
                          onDismiss={handleDismiss}
                        />
                      ))}
                    </div>
                  ) : null
                )}
              </>
            ) : (
              filteredChanges.map((change) => (
                <ChangeCard
                  key={change.id}
                  change={change}
                  onStatusChange={handleStatusChange}
                  onDismiss={handleDismiss}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* New Change slide-in panel */}
      {showNewChangePanel && projectId && (
        <NewChangePanel
          projectId={projectId}
          onClose={() => setShowNewChangePanel(false)}
          onCreated={handleChangeCreated}
        />
      )}
    </div>
  );
}
