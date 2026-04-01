/**
 * Bugs API — Build 025
 *
 * Global bugs view with severity + status filtering.
 * Bugs = defects in deployed app (distinct from changes = revision requests).
 */

import { supabase } from '@/lib/supabase';
import type { BugWithContext, BugSeverity, BugStatus, Bug } from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch all bugs for a project with optional status/severity filters.
 * Ordered by severity (P0 first), then by created_at (newest first).
 */
export async function getProjectBugs(
  projectId: string,
  filters?: { status?: BugStatus; severity?: BugSeverity }
): Promise<BugWithContext[]> {
  let q = supabase
    .from('bugs_with_context')
    .select('*')
    .eq('project_id', projectId)
    .order('severity')
    .order('created_at', { ascending: false });

  if (filters?.status) q = q.eq('status', filters.status);
  if (filters?.severity) q = q.eq('severity', filters.severity);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BugWithContext[];
}

/**
 * Count open P0 bugs for a project.
 * Used for P0 banner + nav badge.
 */
export async function getP0OpenCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('bugs_with_context')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('severity', 'p0')
    .eq('status', 'open');

  if (error) throw error;
  return count ?? 0;
}

/**
 * Fetch a single bug by ID.
 */
export async function getBug(bugId: string): Promise<BugWithContext> {
  const { data, error } = await supabase
    .from('bugs_with_context')
    .select('*')
    .eq('id', bugId)
    .single();

  if (error) throw error;
  return data as BugWithContext;
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new bug.
 */
export async function createBug(
  bug: Omit<Bug, 'id' | 'created_at' | 'updated_at'>
): Promise<Bug> {
  const { data, error } = await supabase
    .from('bugs')
    .insert({
      ...bug,
      status: 'open',
      source: bug.source ?? 'manual',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Bug;
}

/**
 * Update a bug's severity, status, or feature_id.
 */
export async function triageBug(
  bugId: string,
  patch: Partial<Pick<Bug, 'severity' | 'status' | 'feature_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('bugs')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bugId);

  if (error) throw error;
}

/**
 * Delete a bug (hard delete).
 */
export async function deleteBug(bugId: string): Promise<void> {
  const { error } = await supabase
    .from('bugs')
    .delete()
    .eq('id', bugId);

  if (error) throw error;
}
