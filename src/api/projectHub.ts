/**
 * Project Hub API — Build 014
 *
 * Stats view, human tasks, setup checklist helpers, phase advancement.
 */

import { supabase } from '@/lib/supabase';
import type { ProjectHubStats, HumanTask, HumanTaskStatus, Project } from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/** One-row stats view for the hub — counts + nav badges + setup step */
export async function getProjectHubStats(projectId: string): Promise<ProjectHubStats> {
  const { data, error } = await supabase
    .from('project_hub_stats')
    .select('*')
    .eq('project_id', projectId)
    .single();
  if (error) throw error;
  return data as ProjectHubStats;
}

/** Full project row for the header card */
export async function getProject(projectId: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (error) throw error;
  return data as Project;
}

/** Pending human tasks for the amber callout banner */
export async function getPendingHumanTasks(projectId: string): Promise<HumanTask[]> {
  const { data, error } = await supabase
    .from('human_tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('priority')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as HumanTask[];
}

// ── Mutations ──────────────────────────────────────────────────────────────

type ProjectPhase = 'alpha' | 'beta' | 'live';

const PHASE_ORDER: ProjectPhase[] = ['alpha', 'beta', 'live'];

export function nextPhase(current: ProjectPhase): ProjectPhase | null {
  const idx = PHASE_ORDER.indexOf(current);
  return idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}

/** Advance project phase (phase badge inline dropdown) */
export async function advanceProjectPhase(
  projectId: string,
  newPhase:  ProjectPhase
): Promise<void> {
  const patch: Partial<Project> = { phase: newPhase };
  if (newPhase === 'live') {
    (patch as Record<string, unknown>).pushed_to_production_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', projectId);
  if (error) throw error;
}

/** Persist the builder's current setup step across reloads */
export async function updateSetupStep(
  projectId: string,
  step:      1 | 2 | 3 | 4 | 5 | 6
): Promise<void> {
  const { error } = await supabase
    .from('project_settings')
    .update({ setup_step: step })
    .eq('project_id', projectId);
  if (error) throw error;
}

/** Mark a human task done or dismissed */
export async function resolveHumanTask(
  taskId:     string,
  resolution: 'done' | 'dismissed'
): Promise<void> {
  const { error } = await supabase
    .from('human_tasks')
    .update({
      status:       resolution,
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);
  if (error) throw error;
}

// ── Setup checklist helpers ────────────────────────────────────────────────

export interface SetupChecklistStep {
  number:      1 | 2 | 3 | 4 | 5 | 6;
  title:       string;
  description: string;
  isComplete:  (project: Project, screenCount?: number) => boolean;
  ctaLabel:    string;
  ctaHref:     (projectId: string) => string;
  status?:     'done' | 'active' | 'pending';
}

export const SETUP_STEPS: SetupChecklistStep[] = [
  {
    number:      1,
    title:       'Name your project',
    description: 'Give your project a name and describe what it does.',
    isComplete:  (p) => Boolean(p.name && p.description),
    ctaLabel:    'Edit project →',
    ctaHref:     (id) => `/projects/${id}/setup`,
  },
  {
    number:      2,
    title:       'Connect Supabase',
    description: 'Add your Supabase project URL and anon key.',
    isComplete:  (p) => Boolean((p as unknown as Record<string, unknown>).supabase_url),
    ctaLabel:    'Connect Supabase →',
    ctaHref:     (id) => `/projects/${id}/setup#supabase`,
  },
  {
    number:      3,
    title:       'Connect GitHub',
    description: 'Link your GitHub repo so Shipyard can read and push code.',
    isComplete:  (p) => Boolean(p.repo_url),
    ctaLabel:    'Connect GitHub →',
    ctaHref:     (id) => `/projects/${id}/setup#github`,
  },
  {
    number:      4,
    title:       'Add Claude API key',
    description: 'Required for AI-assisted code generation and chat.',
    isComplete:  (p) => Boolean((p as unknown as Record<string, unknown>).claude_key),
    ctaLabel:    'Add key →',
    ctaHref:     (id) => `/projects/${id}/setup#claude`,
  },
  {
    number:      5,
    title:       'Connect Netlify',
    description: 'Link your Netlify site for deploy tracking.',
    isComplete:  (p) => Boolean((p as unknown as Record<string, unknown>).netlify_site_id),
    ctaLabel:    'Connect Netlify →',
    ctaHref:     (id) => `/projects/${id}/setup#netlify`,
  },
  {
    number:      6,
    title:       'Add your first screen',
    description: "Start mapping your app's screens to unlock the full workflow.",
    isComplete:  (_p, screenCount) => (screenCount ?? 0) > 0,
    ctaLabel:    'Go to Screens →',
    ctaHref:     (id) => `/projects/${id}/screens`,
  },
];

export function getSetupChecklistState(
  project:     Project,
  screenCount: number
): Array<SetupChecklistStep & { status: 'done' | 'active' | 'pending' }> {
  const firstIncomplete = SETUP_STEPS.findIndex((s) => !s.isComplete(project, screenCount));
  return SETUP_STEPS.map((step, idx) => ({
    ...step,
    status:
      idx < firstIncomplete || firstIncomplete === -1
        ? 'done'
        : idx === firstIncomplete
        ? 'active'
        : 'pending',
  }));
}

export function isSetupComplete(project: Project, screenCount: number): boolean {
  return SETUP_STEPS.every((s) => s.isComplete(project, screenCount));
}
