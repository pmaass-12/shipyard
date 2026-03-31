/**
 * Changes API — Build 035
 *
 * Builder-filed revision requests against screens/features.
 * Replaces Build 012 Change Requests.
 */

import { supabase } from '@/lib/supabase';
import type { Change, ChangeStatus, ChangePriority, NewChangeInput } from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * List changes for a project with optional filters.
 * Ordered by priority (p0 first), then by created_at (newest first).
 */
export async function listChanges(
  projectId: string,
  opts?: { status?: ChangeStatus; priority?: ChangePriority }
): Promise<Change[]> {
  let q = supabase
    .from('changes')
    .select('*')
    .eq('project_id', projectId)
    .order('priority')
    .order('created_at', { ascending: false });

  if (opts?.status) q = q.eq('status', opts.status);
  if (opts?.priority) q = q.eq('priority', opts.priority);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Change[];
}

/**
 * Count active changes (pending + in_progress) for a project.
 * Used for nav badge.
 */
export async function getActiveChangeCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('changes')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .in('status', ['pending', 'in_progress']);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Fetch a single change by ID.
 */
export async function getChange(changeId: string): Promise<Change> {
  const { data, error } = await supabase
    .from('changes')
    .select('*')
    .eq('id', changeId)
    .single();

  if (error) throw error;
  return data as Change;
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new change.
 */
export async function createChange(input: NewChangeInput): Promise<Change> {
  const { data, error } = await supabase
    .from('changes')
    .insert({
      ...input,
      priority: input.priority ?? 'p1',
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Change;
}

/**
 * Update a change's status.
 */
export async function updateChangeStatus(changeId: string, status: ChangeStatus): Promise<void> {
  const { error } = await supabase
    .from('changes')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', changeId);

  if (error) throw error;
}

/**
 * Update a change's priority.
 */
export async function updateChangePriority(changeId: string, priority: ChangePriority): Promise<void> {
  const { error } = await supabase
    .from('changes')
    .update({
      priority,
      updated_at: new Date().toISOString(),
    })
    .eq('id', changeId);

  if (error) throw error;
}

/**
 * Link a change to a pipeline run (start iteration).
 * Sets status to 'in_progress'.
 */
export async function startChangeIteration(
  changeId: string,
  pipelineRunId: string
): Promise<void> {
  const { error } = await supabase
    .from('changes')
    .update({
      status: 'in_progress',
      pipeline_run_id: pipelineRunId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', changeId);

  if (error) throw error;
}

/**
 * Dismiss a change (set status to 'dismissed').
 */
export async function dismissChange(changeId: string): Promise<void> {
  const { error } = await supabase
    .from('changes')
    .update({
      status: 'dismissed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', changeId);

  if (error) throw error;
}
