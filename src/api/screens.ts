/**
 * Screens API — Build 015
 *
 * Screens list, screen detail, Claude generation, add/edit/soft-delete.
 */

import { supabase } from '@/lib/supabase';
import type { Screen, ScreenSummary, ScreenType, ScreenFeatureRow } from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/** List all active screens for a project, sorted by sort_order then name */
export async function listScreens(projectId: string): Promise<ScreenSummary[]> {
  const { data, error } = await supabase
    .from('screen_summary')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScreenSummary[];
}

/** Search/filter screens */
export async function searchScreens(
  projectId: string,
  opts: { query?: string; type?: ScreenType }
): Promise<ScreenSummary[]> {
  let q = supabase
    .from('screen_summary')
    .select('*')
    .eq('project_id', projectId);

  if (opts.type)  q = q.eq('type', opts.type);
  if (opts.query) q = q.ilike('name', `%${opts.query}%`);

  q = q
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ScreenSummary[];
}

/** True when the project has at least one active screen */
export async function hasScreens(projectId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('screens')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .is('deleted_at', null);

  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Full screen summary for screen detail view */
export async function getScreen(screenId: string): Promise<ScreenSummary> {
  const { data, error } = await supabase
    .from('screen_summary')
    .select('*')
    .eq('id', screenId)
    .single();
  if (error) throw error;
  return data as ScreenSummary;
}

/** Features for screen detail Features tab */
export async function getScreenFeatures(screenId: string): Promise<ScreenFeatureRow[]> {
  const { data, error } = await supabase
    .from('features')
    .select('id, name, phase, status, pipeline_step, complexity, priority, created_at')
    .eq('screen_id', screenId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ScreenFeatureRow[];
}

/** Bugs for screen detail Bugs tab */
export async function getScreenBugs(screenId: string) {
  const { data, error } = await supabase
    .from('bugs')
    .select('id, title, severity, status, created_at')
    .eq('screen_id', screenId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Change requests for screen detail CRs tab */
export async function getScreenChangeRequests(screenId: string) {
  const { data, error } = await supabase
    .from('change_requests')
    .select('id, title, description, screenshot_url, status, submitted_at, submitter_email')
    .eq('screen_id', screenId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** Create a single screen (manual add panel) */
export async function createScreen(
  projectId: string,
  input: { name: string; type: ScreenType; route?: string }
): Promise<Screen> {
  const { data, error } = await supabase
    .from('screens')
    .insert({
      project_id: projectId,
      name:       input.name,
      type:       input.type,
      route:      input.route ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Screen;
}

/** Edit screen name, type, route, description */
export async function updateScreen(
  screenId: string,
  patch:    Partial<Pick<Screen, 'name' | 'type' | 'route' | 'description'>>
): Promise<Screen> {
  const { data, error } = await supabase
    .from('screens')
    .update(patch)
    .eq('id', screenId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Screen;
}

/** Soft-delete (never hard DELETE from client) */
export async function deleteScreen(screenId: string): Promise<void> {
  const { error } = await supabase
    .from('screens')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', screenId);
  if (error) throw error;
}

/** Batch insert confirmed screens from Claude generation */
export async function addGeneratedScreens(
  projectId: string,
  screens: Array<{ name: string; route: string; type: ScreenType }>
): Promise<Screen[]> {
  const { data, error } = await supabase
    .from('screens')
    .insert(screens.map((s) => ({ project_id: projectId, ...s })))
    .select('*');
  if (error) throw error;
  return (data ?? []) as Screen[];
}

// ── Progress dots helper ───────────────────────────────────────────────────

export function getProgressDots(workflowStep: number): {
  step:     number;
  label:    string;
  complete: boolean;
}[] {
  const labels = ['Design', 'Schema', 'Code', 'Deploy', 'QA'];
  return labels.map((label, idx) => ({
    step:     idx + 1,
    label,
    complete: idx + 1 < workflowStep,
  }));
}
