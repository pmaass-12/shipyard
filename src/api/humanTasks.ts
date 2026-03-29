/**
 * humanTasks.ts — Build 022
 *
 * All Supabase calls for the Human Tasks domain.
 * Implements the contract defined in contracts/022-human-tasks-READY.md.
 *
 * Key rules:
 *  - Bell badge = P0 + P1 only (use human_tasks_summary.bell_badge_count)
 *  - P3 tasks hidden by default; shown only in "All" filter
 *  - resolved_at is trigger-managed — do not set it in update() calls
 *  - Task creation is always server-side (service role); no client INSERT policy
 */

import { supabase } from '@/lib/supabase';
import type {
  HumanTask,
  HumanTaskGlobalRow,
  HumanTasksSummary,
} from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch all pending tasks across all projects, ordered P0 → P1 → P2 → P3.
 * When projectId is provided, filters to that project only.
 * P3 tasks are included — caller may filter with groupTasksByPriority().
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
 * Fetch resolved tasks (done + dismissed) for the resolved section.
 * Capped at 50 — no pagination in v1.
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
 * Total P0 + P1 pending task count across ALL projects.
 * Called on app boot and after any mark-done mutation.
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
 * Per-project task summary — used by Project Hub callout.
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

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Mark a task done. resolved_at is set automatically by DB trigger.
 * Use optimistic UI — animate card out immediately, roll back on error.
 */
export async function markTaskDone(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('human_tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

/**
 * Dismiss a task — non-blocking acknowledgement.
 * Builder has seen it; it's not strictly "done" but won't block.
 */
export async function dismissTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('human_tasks')
    .update({ status: 'dismissed', completed_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

// ── Realtime subscription ──────────────────────────────────────────────────

/**
 * Subscribe to human_tasks changes (INSERTs that are pending).
 * Call onUpdate to refresh the bell badge and task list.
 * Returns an unsubscribe function.
 */
export function subscribeToHumanTaskChanges(
  onUpdate: () => void
): () => void {
  const channel = supabase
    .channel('human-tasks-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'human_tasks' },
      onUpdate
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── UI helpers ─────────────────────────────────────────────────────────────

export interface GroupedTasks {
  p0:   HumanTaskGlobalRow[];
  p1:   HumanTaskGlobalRow[];
  p2:   HumanTaskGlobalRow[];
  p3:   HumanTaskGlobalRow[];
  done: HumanTaskGlobalRow[];
}

/**
 * Group the flat task list from human_tasks_global into priority sections.
 */
export function groupTasksByPriority(
  tasks: HumanTaskGlobalRow[]
): GroupedTasks {
  return {
    p0:   tasks.filter((t) => t.status === 'pending' && t.priority === 'p0'),
    p1:   tasks.filter((t) => t.status === 'pending' && t.priority === 'p1'),
    p2:   tasks.filter((t) => t.status === 'pending' && t.priority === 'p2'),
    p3:   tasks.filter((t) => t.status === 'pending' && t.priority === 'p3'),
    done: tasks.filter((t) => t.status !== 'pending'),
  };
}

export const PRIORITY_SECTION_CONFIG = {
  p0: { label: '🔴 P0 — Blocking',  borderColor: '#ef4444', badgeBg: '#fef2f2', badgeText: '#b91c1c' },
  p1: { label: '🟡 P1 — Important', borderColor: '#f59e0b', badgeBg: '#fffbeb', badgeText: '#92400e' },
  p2: { label: '🔵 P2 — Normal',    borderColor: '#3b82f6', badgeBg: '#eff6ff', badgeText: '#1d4ed8' },
  p3: { label: '⚪ P3 — FYI',       borderColor: '#9ca3af', badgeBg: '#f9fafb', badgeText: '#6b7280' },
} as const;
