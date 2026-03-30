/**
 * Projects API — src/api/projects.ts
 *
 * All Supabase calls for the Projects domain.
 * Implements the contract defined in contracts/projects-list-api.md.
 *
 * Engineer extensions (not in contract v1):
 *   - `color` and `tech_stack` fields passed on create/update
 *   - Client-side validation of `repo_url` format
 *
 * Do NOT import this file in components directly — use hooks/useProjects.ts.
 */

import { supabase } from '@/lib/supabase';
import type {
  Project,
  ProjectSummary,
  NewProjectInput,
  UpdateProjectInput,
  ProjectStatus,
  ProjectPhase,
} from '@/types/db';

// ── Types ─────────────────────────────────────────────────────────────────

export type FilterPill = 'all' | ProjectStatus;

// ── Query 1: List all projects (summary view) ─────────────────────────────

export async function listProjects(): Promise<ProjectSummary[]> {
  const { data, error } = await supabase
    .from('project_summary')
    .select('*')
    .order('last_activity_at', { ascending: false });

  if (error) throw error;
  return data as ProjectSummary[];
}

// ── Client-side filter + count helpers ────────────────────────────────────

export function filterProjects(
  projects: ProjectSummary[],
  pill: FilterPill
): ProjectSummary[] {
  if (pill === 'all') return projects;
  return projects.filter(p => p.status === pill);
}

export function pillCounts(projects: ProjectSummary[]) {
  return {
    all:     projects.length,
    active:  projects.filter(p => p.status === 'active').length,
    paused:  projects.filter(p => p.status === 'paused').length,
    stalled: projects.filter(p => p.status === 'stalled').length,
    shipped: projects.filter(p => p.status === 'shipped').length,
  };
}

// ── Query 2: Create a project ─────────────────────────────────────────────

export async function createProject(input: NewProjectInput): Promise<Project> {
  // Client-side validation
  const name = input.name.trim();
  if (!name) throw new Error('Project name is required.');
  if (name.length > 60) throw new Error('Name must be 60 characters or fewer.');
  if (input.description && input.description.length > 200)
    throw new Error('Description must be 200 characters or fewer.');
  if (input.repo_url && input.repo_url.length > 0) {
    try { new URL(input.repo_url); } catch {
      throw new Error('GitHub repo URL must be a valid URL.');
    }
  }

  // Resolve auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Not authenticated.');

  // Build insert payload — only include columns that exist in the contract.
  // Engineer extensions (color, tech_stack) are attempted but may be absent
  // from the DB if the migration hasn't been run. See impl-projects-list.md.
  const payload: Record<string, unknown> = {
    user_id:     user.id,
    name,
    emoji:       input.emoji       ?? '🚀',
    description: input.description ?? null,
    repo_url:    input.repo_url    ?? null,
    budget_usd:  input.budget_usd  ?? null,
  };

  // Only append engineer-extended columns if values were provided
  if (input.color)      payload['color']      = input.color;
  if (input.tech_stack) payload['tech_stack'] = input.tech_stack;

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

// ── Query 3: Update a project ─────────────────────────────────────────────

export async function updateProject(
  id: string,
  patch: UpdateProjectInput
): Promise<Project> {
  const updates: Record<string, unknown> = {};
  if (patch.name        !== undefined) updates['name']        = patch.name!.trim();
  if (patch.emoji       !== undefined) updates['emoji']       = patch.emoji;
  if (patch.color       !== undefined) updates['color']       = patch.color;
  if (patch.description !== undefined) updates['description'] = patch.description;
  if (patch.status      !== undefined) updates['status']      = patch.status;
  if (patch.phase       !== undefined) updates['phase']       = patch.phase;   // Build 006-fix
  if (patch.repo_url    !== undefined) updates['repo_url']    = patch.repo_url;
  if (patch.budget_usd  !== undefined) updates['budget_usd']  = patch.budget_usd;
  if (patch.tech_stack  !== undefined) updates['tech_stack']  = patch.tech_stack;
  // updated_at is set by DB trigger — never write it from the client

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

// ── Status transition helpers ─────────────────────────────────────────────

export const pauseProject  = (id: string) => updateProject(id, { status: 'paused'  });
export const resumeProject = (id: string) => updateProject(id, { status: 'active'  });
export const shipProject   = (id: string) => updateProject(id, { status: 'shipped' });

// ── Build 006: Project phase ──────────────────────────────────────────────

/**
 * Launch the product: advances phase to 'live', stamps launched_at,
 * triggers configured launch actions (non-blocking Edge Function).
 * Build 006-fix: replaces "Push to Production" label everywhere.
 */
export async function pushToProduction(
  input: { project_id: string }
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      phase:                   'live' as ProjectPhase,
      pushed_to_production_at: new Date().toISOString(),
    })
    .eq('id', input.project_id)
    .select()
    .single();

  if (error) throw error;

  // Kick off any post-launch Edge Functions non-blocking.
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.access_token) return;

    // on-launch hook (Build 006)
    fetch('/api/on-launch', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ project_id: input.project_id }),
    }).catch(() => { /* non-critical */ });

    // Build 043: write system memory fact for the deploy event
    const launchDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    fetch('/functions/v1/write-system-memory-fact', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        project_id: input.project_id,
        title:      'Project launched to Live',
        body:       `Project was pushed to production (Live) on ${launchDate}.`,
        category:   'decision',
      }),
    }).catch(() => { /* non-critical */ });
  });

  return data as Project;
}

/** Fetch the full project_summary view row for a single project. */
export async function getProjectSummary(projectId: string): Promise<ProjectSummary> {
  const { data, error } = await supabase
    .from('project_summary')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data as ProjectSummary;
}

/**
 * Advance project phase from alpha → beta.
 * The live phase is only reachable via push-to-production.
 */
export async function advanceProjectPhase(
  projectId: string,
  targetPhase: 'beta'
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({ phase: targetPhase } as { phase: ProjectPhase })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;

  // Build 010: When advancing to beta, kick off SEO generation non-blocking.
  // Shows "Claude is drafting your SEO…" toast at the call site.
  if (targetPhase === 'beta') {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      fetch('/api/generate-seo', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId }),
      }).catch(() => { /* non-critical — toast handled at call site */ });
    });
  }

  return data as Project;
}

// ── Build 011: Waitlist ───────────────────────────────────────────────────

/** Toggle waitlist on/off. Takes effect immediately (runtime check, no redeploy). */
export async function updateWaitlistEnabled(
  projectId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ waitlist_enabled: enabled })
    .eq('id', projectId);

  if (error) throw error;
}

// ── Build 007: Test Mode ───────────────────────────────────────────────────

/** Check whether Test Mode is enabled for a project (omits PIN hash). */
export async function getTestModeConfig(
  projectId: string
): Promise<{ test_mode_enabled: boolean }> {
  const { data, error } = await supabase
    .from('projects')
    .select('test_mode_enabled')   // pin intentionally excluded
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return { test_mode_enabled: data.test_mode_enabled as boolean };
}

/** Toggle Test Mode on/off. PIN hash is preserved when disabling. */
export async function updateTestModeEnabled(
  projectId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ test_mode_enabled: enabled })
    .eq('id', projectId);

  if (error) throw error;
}

// ── Build 008: Onboarding Tour ────────────────────────────────────────────

/** Toggle onboarding tour on/off. */
export async function updateTourEnabled(
  projectId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ onboarding_tour_enabled: enabled })
    .eq('id', projectId);

  if (error) throw error;
}

// ── Build 009: What's New ─────────────────────────────────────────────────

/** Toggle What's New on/off. Existing entries are preserved when disabled. */
export async function updateWhatsNewEnabled(
  projectId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ whats_new_enabled: enabled })
    .eq('id', projectId);

  if (error) throw error;
}

// ── Query 4: Delete a project ─────────────────────────────────────────────

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ── Context menu options (status-sensitive, per spec) ─────────────────────

export interface MenuItem {
  label: string;
  action: 'edit' | 'pause' | 'resume' | 'ship' | 'divider' | 'delete';
  destructive?: boolean;
  isDivider?: boolean;
}

export function menuOptions(project: ProjectSummary): MenuItem[] {
  const items: MenuItem[] = [{ label: 'Edit', action: 'edit' }];

  if (project.status === 'active')
    items.push({ label: 'Pause', action: 'pause' });

  if (project.status === 'paused' || project.status === 'stalled')
    items.push({ label: 'Resume', action: 'resume' });

  if (project.status !== 'shipped')
    items.push({ label: 'Ship', action: 'ship' });

  items.push({ label: '─', action: 'divider', isDivider: true });
  items.push({ label: 'Delete', action: 'delete', destructive: true });

  return items;
}
