/**
 * Import Job API — Build 041
 *
 * Queries and mutations for the Import Existing Website flow.
 * Covers: creating a job, polling for status, fetching items,
 * updating item selections, and finalising the import.
 *
 * Contract: prd/041-import-existing-website-READY.md
 */

import { supabase } from '@/lib/supabase';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import type {
  ImportJob,
  ImportItem,
  ImportItemStatus,
  ImportConfidence,
} from '@/types/db';

// ── Job — Queries ──────────────────────────────────────────────────────────

/** Fetch a single import job by ID */
export async function getImportJob(jobId: string): Promise<ImportJob | null> {
  const { data, error } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw error;
  return data as ImportJob | null;
}

/** Fetch all import jobs for a project (newest first) */
export async function getImportJobsForProject(
  projectId: string
): Promise<ImportJob[]> {
  const { data, error } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ImportJob[];
}

// ── Job — Mutations ────────────────────────────────────────────────────────

/**
 * Create a new import job and kick off the crawl via Edge Function.
 * Returns the new ImportJob row (status = 'pending' initially).
 */
export async function createImportJob(params: {
  projectId:  string;
  sourceUrl:  string;
  githubUrl?: string;
}): Promise<ImportJob> {
  // Insert the job row first so we have an ID
  const { data: job, error: insertError } = await supabase
    .from('import_jobs')
    .insert({
      project_id: params.projectId,
      source_url: params.sourceUrl,
      github_url: params.githubUrl ?? null,
      status:     'pending',
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // Kick off the crawl Edge Function (fire-and-forget)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    fetch('/functions/v1/import-website', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        job_id:     job.id,
        project_id: params.projectId,
        source_url: params.sourceUrl,
        github_url: params.githubUrl,
      }),
    }).catch(err => console.error('Import trigger error:', err));
  }

  return job as ImportJob;
}

// ── Items — Queries ────────────────────────────────────────────────────────

/** All items for an import job */
export async function getImportItems(jobId: string): Promise<ImportItem[]> {
  const { data, error } = await supabase
    .from('import_items')
    .select('*')
    .eq('import_job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ImportItem[];
}

/** Items of a specific type (screen / feature / table) */
export async function getImportItemsByType(
  jobId: string,
  type:  'screen' | 'feature' | 'table'
): Promise<ImportItem[]> {
  const { data, error } = await supabase
    .from('import_items')
    .select('*')
    .eq('import_job_id', jobId)
    .eq('type', type)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ImportItem[];
}

// ── Items — Mutations ──────────────────────────────────────────────────────

/** Update the selection status of a single item */
export async function updateImportItemStatus(
  itemId: string,
  status: ImportItemStatus
): Promise<void> {
  const { error } = await supabase
    .from('import_items')
    .update({ status })
    .eq('id', itemId);

  if (error) throw error;
}

/** Rename a feature item inline */
export async function renameImportItem(
  itemId:  string,
  newName: string
): Promise<void> {
  const { error } = await supabase
    .from('import_items')
    .update({ name: newName.trim() })
    .eq('id', itemId);

  if (error) throw error;
}

/** Bulk approve or dismiss all items of a type */
export async function bulkUpdateImportItemStatus(
  jobId:  string,
  type:   'screen' | 'feature' | 'table',
  status: ImportItemStatus
): Promise<void> {
  const { error } = await supabase
    .from('import_items')
    .update({ status })
    .eq('import_job_id', jobId)
    .eq('type', type);

  if (error) throw error;
}

// ── Finalise Import ────────────────────────────────────────────────────────

/**
 * Finalise the import — creates Screens, Features, and schema entries
 * from all approved items. Calls the `finalise-import` Edge Function.
 * Returns { screens_created, features_created, tables_created }.
 */
export async function finaliseImport(jobId: string): Promise<{
  screens_created:  number;
  features_created: number;
  tables_created:   number;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch('/functions/v1/finalise-import', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Import finalisation failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ── Polling Helper ─────────────────────────────────────────────────────────

/**
 * Poll the import job status until it reaches 'review', 'complete', or 'failed'.
 * Calls onUpdate with each poll result. Returns an unsubscribe fn.
 *
 * Uses 3-second polling as specified in the PRD (no websocket required for import).
 */
export function pollImportJob(
  jobId:    string,
  onUpdate: (job: ImportJob) => void,
  onError:  (err: Error) => void
): () => void {
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const job = await getImportJob(jobId);
      if (job) {
        onUpdate(job);
        if (job.status === 'review' || job.status === 'complete' || job.status === 'failed') {
          stopped = true;
          return;
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error(extractErrorMessage(err)));
      stopped = true;
      return;
    }
    setTimeout(tick, 3000);
  }

  setTimeout(tick, 3000); // start after 3s

  return () => { stopped = true; };
}

// ── Confidence helpers ─────────────────────────────────────────────────────

export const CONFIDENCE_COLORS: Record<ImportConfidence, string> = {
  high:   '#30d158',
  medium: '#ff9f0a',
  low:    '#94A3B8',
};

export const CONFIDENCE_LABELS: Record<ImportConfidence, string> = {
  high:   'HIGH',
  medium: 'MEDIUM',
  low:    'LOW',
};
