/**
 * Project Health & Regression API — Build 042
 *
 * Queries, mutations, and realtime subscriptions for:
 *   - Regression runs (latest, history, trigger, subscribe)
 *   - Project health scores (latest, history, subscribe)
 *   - Health reports (latest, history, generate)
 *
 * Contract: contracts/042-project-health-READY.md
 */

import { supabase } from '@/lib/supabase';
import type {
  RegressionRun,
  RegressionStatus,
  LatestProjectHealthScore,
  ProjectHealthScore,
  ProjectHealthReport,
} from '@/types/db';

// ── Regression Runs — Queries ──────────────────────────────────────────────

/** Latest regression run for a project (card on Project Hub) */
export async function getLatestRegressionRun(
  projectId: string
): Promise<RegressionRun | null> {
  const { data, error } = await supabase
    .from('regression_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as RegressionRun | null;
}

/** Last N completed runs for history/trend display */
export async function getRegressionRunHistory(
  projectId: string,
  limit = 20
): Promise<RegressionRun[]> {
  const { data, error } = await supabase
    .from('regression_runs')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['passed', 'failed', 'error'])
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as RegressionRun[];
}

// ── Regression Runs — Mutations ────────────────────────────────────────────

/**
 * Trigger a manual regression run via the Edge Function.
 * Returns the new run's id and initial status.
 */
export async function triggerRegressionRun(
  projectId: string
): Promise<{ run_id: string; status: RegressionStatus }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch('/functions/v1/run-regression', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ project_id: projectId, triggered_by: 'manual' }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Regression trigger failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ── Regression Runs — Realtime ─────────────────────────────────────────────

/** Watch a running regression run for completion. Returns unsubscribe fn. */
export function subscribeToRegressionRun(
  runId:    string,
  onUpdate: (run: RegressionRun) => void
): () => void {
  const channel = supabase
    .channel(`regression_run:${runId}`)
    .on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'regression_runs',
        filter: `id=eq.${runId}`,
      },
      payload => onUpdate(payload.new as RegressionRun)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── Project Health Scores — Queries ───────────────────────────────────────

/** Latest health score from the latest_project_health_scores VIEW */
export async function getLatestHealthScore(
  projectId: string
): Promise<LatestProjectHealthScore | null> {
  const { data, error } = await supabase
    .from('latest_project_health_scores')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data as LatestProjectHealthScore | null;
}

/** Score history for trend charts */
export async function getHealthScoreHistory(
  projectId: string,
  limit = 30
): Promise<ProjectHealthScore[]> {
  const { data, error } = await supabase
    .from('project_health_scores')
    .select('*')
    .eq('project_id', projectId)
    .order('computed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ProjectHealthScore[];
}

// ── Project Health Scores — Realtime ──────────────────────────────────────

/**
 * Subscribe to new health score INSERTs.
 * On new score, the caller should re-fetch via getLatestHealthScore() —
 * do NOT rely on the payload directly (the VIEW is the source of truth).
 * Returns unsubscribe fn.
 */
export function subscribeToHealthScore(
  projectId: string,
  onNewScore: () => void
): () => void {
  const channel = supabase
    .channel(`health_score:${projectId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'project_health_scores',
        filter: `project_id=eq.${projectId}`,
      },
      () => onNewScore()
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── Health Reports — Queries ───────────────────────────────────────────────

/** Most recent health report for a project */
export async function getLatestHealthReport(
  projectId: string
): Promise<ProjectHealthReport | null> {
  const { data, error } = await supabase
    .from('project_health_reports')
    .select('*')
    .eq('project_id', projectId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectHealthReport | null;
}

/** Historical health reports (list only — omits content for performance) */
export async function getHealthReportHistory(
  projectId: string,
  limit = 10
): Promise<Omit<ProjectHealthReport, 'content'>[]> {
  const { data, error } = await supabase
    .from('project_health_reports')
    .select('id, project_id, score_id, generated_at')
    .eq('project_id', projectId)
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Omit<ProjectHealthReport, 'content'>[];
}

/** Fetch the score that a specific historical report was based on */
export async function getHealthScoreForReport(
  scoreId: string
): Promise<ProjectHealthScore | null> {
  const { data, error } = await supabase
    .from('project_health_scores')
    .select('*')
    .eq('id', scoreId)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectHealthScore | null;
}

// ── Health Reports — Mutations ─────────────────────────────────────────────

/**
 * Trigger health report generation via Edge Function.
 * Returns the new ProjectHealthReport row.
 */
export async function generateHealthReport(
  projectId: string
): Promise<ProjectHealthReport> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch('/functions/v1/generate-health-report', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ project_id: projectId }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Health report generation failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<ProjectHealthReport>;
}
