/**
 * Human Tasks API — Build 022
 *
 * Global view of all manual actions the builder must take.
 * Contract: contracts/022-human-tasks-READY.md
 */

import { supabase } from '@/lib/supabase';
import type {
  HumanTask,
  HumanTaskGlobalRow,
  HumanTasksSummary,
  HumanTaskPriority,
} from '@/types/db';

// ── Priority section UI config ─────────────────────────────────────────────

export const PRIORITY_SECTION_CONFIG: Record<
  HumanTaskPriority,
  {
    label:      string;
    borderColor: string;
    badgeBg:    string;
    badgeText:  string;
    show:       boolean;
  }
> = {
  p0: {
    label:       '🔴 P0 — Blocking',
    borderColor: '#ef4444',
    badgeBg:     '#fef2f2',
    badgeText:   '#b91c1c',
    show:         true,
  },
  p1: {
    label:       '🟡 P1 — Important',
    borderColor: '#f59e0b',
    badgeBg:     '#fffbeb',
    badgeText:   '#92400e',
    show:         true,
  },
  p2: {
    label:       '🔵 P2 — Normal',
    borderColor: '#3b82f6',
    badgeBg:     '#eff6ff',
    badgeText:   '#1e40af',
    show:         true,
  },
  p3: {
    label:       '⚪ P3 — FYI',
    borderColor: '#9ca3af',
    badgeBg:     '#f9fafb',
    badgeText:   '#6b7280',
    show:         false,   // hidden by default; visible only in "All" filter
  },
};

// ── Group type ─────────────────────────────────────────────────────────────

export interface GroupedTasks {
  p0:   HumanTaskGlobalRow[];
  p1:   HumanTaskGlobalRow[];
  p2:   HumanTaskGlobalRow[];
  p3:   HumanTaskGlobalRow[];
  done: HumanTaskGlobalRow[];
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * All pending tasks across all projects (or scoped to one project).
 * Results are ordered P0→P1→P2→P3 by the view.
 */
export async function getGlobalPendingTasks(
  projectId?: string
): Promise<HumanTaskGlobalRow[]> {
  let q = supabase
    .from('human_tasks_global')
    .select('*')
    .eq('status', 'pending');

  if (projectId) q = q.eq('project_id', projectId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HumanTaskGlobalRow[];
}

/**
 * Resolved tasks (done + dismissed), newest first, capped at 50.
 * Lazy-loaded only when the collapsed section is opened.
 */
export async function getResolvedTasks(
  projectId?: string
): Promise<HumanTaskGlobalRow[]> {
  let q = supabase
    .from('human_tasks_global')
    .select('*')
    .in('status', ['done', 'dismissed'])
    .order('resolved_at', { ascending: false })
    .limit(50);

  if (projectId) q = q.eq('project_id', projectId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HumanTaskGlobalRow[];
}

/**
 * Bell badge count: P0 + P1 pending tasks across ALL projects.
 * Use `human_tasks_summary.bell_badge_count` which is pre-computed.
 */
export async function getBellBadgeCount(): Promise<number> {
  const { data, error } = await supabase
    .from('human_tasks_summary')
    .select('bell_badge_count');

  if (error) throw error;
  return (data ?? []).reduce(
    (sum, row) => sum + Number(row.bell_badge_count),
    0
  );
}

/**
 * Per-project summary row — used on Project Hub callout card.
 */
export async function getProjectTaskSummary(
  projectId: string
): Promise<HumanTasksSummary | null> {
  const { data, error } = await supabase
    .from('human_tasks_summary')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data as HumanTasksSummary | null;
}

/**
 * Pending tasks for a specific feature — used in Feature Workflow callout.
 */
export async function getFeaturePendingTasks(
  featureId: string
): Promise<HumanTask[]> {
  const { data, error } = await supabase
    .from('human_tasks')
    .select('*')
    .eq('feature_id', featureId)
    .eq('status', 'pending')
    .order('priority')
    .order('created_at');

  if (error) throw error;
  return (data ?? []) as HumanTask[];
}

/**
 * Pending tasks for a specific pipeline step — used in step amber banners.
 */
export async function getStepPendingTasks(
  featureStepId: string
): Promise<HumanTask[]> {
  const { data, error } = await supabase
    .from('human_tasks')
    .select('*')
    .eq('feature_step_id', featureStepId)
    .eq('status', 'pending')
    .order('priority')
    .order('created_at');

  if (error) throw error;
  return (data ?? []) as HumanTask[];
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Mark task done. resolved_at is stamped by DB trigger — do not set it here.
 * completed_at is set for legacy Build 014 compatibility.
 */
export async function markTaskDone(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('human_tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

/**
 * Dismiss task (seen but not actioned — does not count as "done").
 */
export async function dismissTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('human_tasks')
    .update({ status: 'dismissed', completed_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

// ── Realtime ───────────────────────────────────────────────────────────────

/**
 * Subscribe to pending human_tasks changes. Returns an unsubscribe function.
 * Call on mount; call the returned fn on unmount.
 */
export function subscribeToHumanTaskChanges(
  onUpdate: () => void
): () => void {
  const channel = supabase
    .channel('human-tasks-changes')
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'human_tasks',
      },
      onUpdate
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── Client-side grouping ───────────────────────────────────────────────────

/**
 * Group flat task list into priority buckets for section rendering.
 * P3 is included in the `p3` bucket; caller decides whether to show it.
 */
export function groupTasksByPriority(
  tasks: HumanTaskGlobalRow[]
): GroupedTasks {
  return {
    p0:   tasks.filter(t => t.status === 'pending' && t.priority === 'p0'),
    p1:   tasks.filter(t => t.status === 'pending' && t.priority === 'p1'),
    p2:   tasks.filter(t => t.status === 'pending' && t.priority === 'p2'),
    p3:   tasks.filter(t => t.status === 'pending' && t.priority === 'p3'),
    done: tasks.filter(t => t.status !== 'pending'),
  };
}
