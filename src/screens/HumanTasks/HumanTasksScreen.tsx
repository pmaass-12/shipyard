/**
 * HumanTasksScreen — Build 022
 * Route: /tasks
 *
 * Global view of all manual actions the builder must take across all projects.
 * Tasks grouped by priority: P0 (blocking) → P1 (important) → P2 (normal).
 * P3 (FYI) hidden by default; shown only when "All" filter is active.
 * Resolved tasks (done + dismissed) shown in a collapsed section at the bottom.
 *
 * Contract: contracts/022-human-tasks-READY.md
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Bell, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, X } from 'lucide-react';
import {
  getGlobalPendingTasks,
  getResolvedTasks,
  markTaskDone,
  dismissTask,
  subscribeToHumanTaskChanges,
  groupTasksByPriority,
  PRIORITY_SECTION_CONFIG,
  type GroupedTasks,
} from '@/api/humanTasks';
import type { HumanTaskGlobalRow, HumanTaskPriority } from '@/types/db';

// ── Types ──────────────────────────────────────────────────────────────────

type FilterMode = 'default' | 'all';

// ── TaskCard ───────────────────────────────────────────────────────────────

interface TaskCardProps {
  task:        HumanTaskGlobalRow;
  isRemoving:  boolean;
  onDone:      (id: string) => void;
  onDismiss:   (id: string) => void;
}

function TaskCard({ task, isRemoving, onDone, onDismiss }: TaskCardProps) {
  const cfg = PRIORITY_SECTION_CONFIG[task.priority as HumanTaskPriority] ?? PRIORITY_SECTION_CONFIG.p3;
  const isDone = task.status !== 'pending';

  return (
    <div
      data-testid={`task-card-${task.id}`}
      style={{
        display:     'flex',
        alignItems:  'flex-start',
        gap:          12,
        padding:     '14px 16px',
        background:  'var(--color-surface)',
        borderRadius: 12,
        border:      '1px solid var(--color-border)',
        borderLeft:  `3px solid ${isDone ? 'var(--color-border)' : cfg.borderColor}`,
        opacity:      isRemoving ? 0 : 1,
        transform:    isRemoving ? 'translateX(-8px)' : 'none',
        transition:  'opacity 200ms, transform 200ms',
      }}
    >
      {/* Priority badge */}
      <span
        style={{
          flexShrink: 0,
          display:    'inline-flex',
          alignItems: 'center',
          padding:    '2px 7px',
          borderRadius: 6,
          fontSize:   10,
          fontWeight: 700,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          background: isDone ? 'var(--color-surface-hover)' : cfg.badgeBg,
          color:      isDone ? 'var(--color-text-muted)' : cfg.badgeText,
          marginTop:  2,
        }}
      >
        {task.priority.toUpperCase()}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize:   14,
          fontWeight: 600,
          color:      isDone ? 'var(--color-text-muted)' : 'var(--color-text)',
          margin:     0,
          textDecoration: isDone ? 'line-through' : 'none',
        }}>
          {task.title}
        </p>
        {task.description && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
            {task.description}
          </p>
        )}
        {/* Project + feature crumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, color: 'var(--color-text-muted)',
            background: 'var(--color-surface-hover)',
            padding: '2px 7px', borderRadius: 6,
          }}>
            {task.project_emoji ? `${task.project_emoji} ` : ''}{task.project_name}
          </span>
          {task.feature_name && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              › {task.feature_name}
            </span>
          )}
          {task.step_number && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Step {task.step_number}
            </span>
          )}
        </div>
        {/* Context link */}
        {task.context_url && task.context_label && !isDone && (
          <a
            data-testid={`task-context-link-${task.id}`}
            href={task.context_url}
            target={task.context_url.startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            style={{
              display:    'inline-flex',
              alignItems: 'center',
              gap:         4,
              marginTop:   8,
              fontSize:    12,
              fontWeight:  500,
              color:      'var(--color-accent)',
              textDecoration: 'none',
            }}
          >
            {task.context_label}
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* Actions (only on pending tasks) */}
      {!isDone && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 1 }}>
          <button
            data-testid={`task-done-${task.id}`}
            onClick={() => onDone(task.id)}
            title="Mark done"
            style={{
              width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: 'none',
              background: 'var(--color-surface-hover)',
              color: '#22c55e',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
          >
            <CheckCircle2 size={15} />
          </button>
          <button
            data-testid={`task-dismiss-${task.id}`}
            onClick={() => onDismiss(task.id)}
            title="Dismiss"
            style={{
              width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: 'none',
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── PrioritySection ────────────────────────────────────────────────────────

interface PrioritySectionProps {
  priority:    HumanTaskPriority;
  tasks:       HumanTaskGlobalRow[];
  removing:    Set<string>;
  onDone:      (id: string) => void;
  onDismiss:   (id: string) => void;
}

function PrioritySection({ priority, tasks, removing, onDone, onDismiss }: PrioritySectionProps) {
  const cfg = PRIORITY_SECTION_CONFIG[priority];
  if (tasks.length === 0) return null;

  return (
    <section data-testid={`priority-section-${priority}`} style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          {cfg.label}
        </h2>
        <span style={{
          fontSize: 11, fontWeight: 600,
          background: cfg.badgeBg, color: cfg.badgeText,
          padding: '1px 7px', borderRadius: 20,
        }}>
          {tasks.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            isRemoving={removing.has(task.id)}
            onDone={onDone}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </section>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function HumanTasksScreen() {
  const [pending,        setPending]        = useState<HumanTaskGlobalRow[]>([]);
  const [resolved,       setResolved]       = useState<HumanTaskGlobalRow[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [filterMode,     setFilterMode]     = useState<FilterMode>('default');
  const [removingIds,    setRemovingIds]    = useState<Set<string>>(new Set());
  const [showResolved,   setShowResolved]   = useState(false);
  const [resolvedLoaded, setResolvedLoaded] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const tasks = await getGlobalPendingTasks();
      setPending(tasks);
    } catch (e) {
      console.error('Failed to load human tasks:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadResolved = useCallback(async () => {
    if (resolvedLoaded) return;
    try {
      const tasks = await getResolvedTasks();
      setResolved(tasks);
      setResolvedLoaded(true);
    } catch (e) {
      console.error('Failed to load resolved tasks:', e);
    }
  }, [resolvedLoaded]);

  useEffect(() => {
    load();
    // Realtime subscription — refresh list on any change
    unsubscribeRef.current = subscribeToHumanTaskChanges(load);
    return () => { unsubscribeRef.current?.(); };
  }, [load]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDone = async (taskId: string) => {
    // Optimistic: start exit animation immediately
    setRemovingIds(prev => new Set([...prev, taskId]));
    setTimeout(() => {
      setPending(prev => prev.filter(t => t.id !== taskId));
      setRemovingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }, 220);

    try {
      await markTaskDone(taskId);
      setResolvedLoaded(false); // invalidate resolved cache
    } catch (e) {
      // Roll back
      console.error('Failed to mark task done:', e);
      setRemovingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      setPending(prev => [...prev]); // re-render to show the task again
    }
  };

  const handleDismiss = async (taskId: string) => {
    setRemovingIds(prev => new Set([...prev, taskId]));
    setTimeout(() => {
      setPending(prev => prev.filter(t => t.id !== taskId));
      setRemovingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }, 220);

    try {
      await dismissTask(taskId);
      setResolvedLoaded(false);
    } catch (e) {
      console.error('Failed to dismiss task:', e);
      setRemovingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      setPending(prev => [...prev]);
    }
  };

  const handleToggleResolved = () => {
    if (!showResolved && !resolvedLoaded) loadResolved();
    setShowResolved(v => !v);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const grouped: GroupedTasks = groupTasksByPriority(pending);
  const visibleP3 = filterMode === 'all';
  const totalPending = pending.length;
  const totalP0P1 = grouped.p0.length + grouped.p1.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>

      {/* Nav */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
          height: 52,
        }}
      >
        <div style={{
          maxWidth: 900, margin: '0 auto', height: '100%',
          padding: '0 24px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              to="/projects"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                textDecoration: 'none',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--color-accent)', color: '#fff',
              }}>
                <Anchor size={14} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                Shipyard
              </span>
            </Link>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 4 }}>
              / Tasks
            </span>
          </div>

          {/* Bell icon — visual indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {totalP0P1 > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: '#fef2f2', color: '#b91c1c',
                padding: '3px 10px', borderRadius: 20,
                fontSize: 12, fontWeight: 600,
              }}>
                <Bell size={12} />
                {totalP0P1} need attention
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 800,
            color: 'var(--color-text)', letterSpacing: '-0.4px',
            margin: 0,
          }}>
            Your Tasks
          </h1>
          {!loading && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {totalPending === 0
                ? 'All clear — no pending tasks.'
                : `${totalPending} pending task${totalPending !== 1 ? 's' : ''} across all projects`}
            </p>
          )}
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }} data-testid="task-filter-pills">
          {(['default', 'all'] as FilterMode[]).map(mode => (
            <button
              key={mode}
              data-testid={`filter-${mode}`}
              onClick={() => setFilterMode(mode)}
              style={{
                padding: '5px 14px', borderRadius: 20,
                border: '1px solid',
                borderColor: filterMode === mode ? 'var(--color-accent)' : 'var(--color-border)',
                background: filterMode === mode ? 'var(--color-accent-light)' : 'transparent',
                color: filterMode === mode ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {mode === 'default' ? 'P0 – P2' : 'All'}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 80, borderRadius: 12,
                background: 'var(--color-surface)',
                animation: 'pulse 1.5s infinite',
              }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && totalPending === 0 && (
          <div data-testid="tasks-empty" style={{
            textAlign: 'center', padding: '60px 0',
            color: 'var(--color-text-muted)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>
              Nothing to do right now
            </p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Tasks will appear here when Shipyard or the pipeline needs your input.
            </p>
          </div>
        )}

        {/* Task sections */}
        {!loading && (
          <>
            <PrioritySection
              priority="p0"
              tasks={grouped.p0}
              removing={removingIds}
              onDone={handleDone}
              onDismiss={handleDismiss}
            />
            <PrioritySection
              priority="p1"
              tasks={grouped.p1}
              removing={removingIds}
              onDone={handleDone}
              onDismiss={handleDismiss}
            />
            <PrioritySection
              priority="p2"
              tasks={grouped.p2}
              removing={removingIds}
              onDone={handleDone}
              onDismiss={handleDismiss}
            />
            {visibleP3 && (
              <PrioritySection
                priority="p3"
                tasks={grouped.p3}
                removing={removingIds}
                onDone={handleDone}
                onDismiss={handleDismiss}
              />
            )}

            {/* Resolved section (collapsed by default) */}
            <div style={{ marginTop: 32 }}>
              <button
                data-testid="toggle-resolved"
                onClick={handleToggleResolved}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none',
                  fontSize: 13, fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer', padding: '4px 0',
                }}
              >
                {showResolved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Completed &amp; dismissed
                {resolvedLoaded && resolved.length > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    background: 'var(--color-surface-hover)',
                    color: 'var(--color-text-muted)',
                    padding: '1px 7px', borderRadius: 20, marginLeft: 2,
                  }}>
                    {resolved.length}
                  </span>
                )}
              </button>

              {showResolved && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {resolved.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '8px 0' }}>
                      No resolved tasks yet.
                    </p>
                  ) : (
                    resolved.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isRemoving={false}
                        onDone={handleDone}
                        onDismiss={handleDismiss}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
