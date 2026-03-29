/**
 * Change Requests API — Build 012
 *
 * Global project view + per-screen panel, annotation pins, accept/reject flow.
 * project_id is now the RLS anchor (not screen_id).
 */

import { supabase } from '@/lib/supabase';
import type {
  ChangeRequest,
  ChangeRequestSummary,
  CrAnnotation,
  ChangeRequestStatus,
  PendingCrCountByScreen,
} from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/** List CRs for a project (global view) — no JSONB blobs in list */
export async function listChangeRequests(
  projectId: string,
  opts?: { status?: ChangeRequestStatus; screenId?: string }
): Promise<ChangeRequestSummary[]> {
  let q = supabase
    .from('change_requests')
    .select(`
      id, project_id, screen_id, feature_id,
      title, description, screenshot_url, route,
      status, submitted_at, reviewed_at, submitter_email
    `)
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false });

  if (opts?.status)   q = q.eq('status', opts.status);
  if (opts?.screenId) q = q.eq('screen_id', opts.screenId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ChangeRequestSummary[];
}

/** Full CR for expanded detail panel — includes structured annotations */
export async function getChangeRequest(crId: string): Promise<{
  cr: ChangeRequest;
  annotations: CrAnnotation[];
}> {
  const [crRes, annRes] = await Promise.all([
    supabase
      .from('change_requests')
      .select('*')
      .eq('id', crId)
      .single(),
    supabase
      .from('cr_annotations')
      .select('*')
      .eq('cr_id', crId)
      .order('pin_number'),
  ]);

  if (crRes.error) throw crRes.error;

  // Use structured cr_annotations if present; fall back to JSONB for legacy rows
  const annotations: CrAnnotation[] =
    annRes.data && annRes.data.length > 0
      ? (annRes.data as CrAnnotation[])
      : [];

  return { cr: crRes.data as ChangeRequest, annotations };
}

/** Count pending CRs per screen — used by Screens list card chips */
export async function getPendingCrCountsByScreen(
  screenIds: string[]
): Promise<Record<string, number>> {
  if (screenIds.length === 0) return {};

  const { data, error } = await supabase
    .from('pending_cr_count_by_screen')
    .select('screen_id, pending_count')
    .in('screen_id', screenIds);

  if (error) throw error;

  return Object.fromEntries(
    (data ?? []).map((row: PendingCrCountByScreen) => [row.screen_id, Number(row.pending_count)])
  );
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** Accept CR — create a new feature from it */
export async function acceptCrWithNewFeature(
  cr:          ChangeRequestSummary,
  featureName: string
): Promise<string> {
  // 1. Create the feature
  const { data: feature, error: fErr } = await supabase
    .from('features')
    .insert({
      project_id: cr.project_id,
      screen_id:  cr.screen_id,
      name:       featureName,
      source:     'change_request',
    })
    .select('id')
    .single();
  if (fErr) throw fErr;

  // 2. Update CR: accepted, link feature, stamp reviewed_at
  const { error: crErr } = await supabase
    .from('change_requests')
    .update({
      status:      'accepted',
      feature_id:  feature.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', cr.id);
  if (crErr) throw crErr;

  return feature.id;
}

/** Accept CR — link to an existing feature */
export async function acceptCrLinkFeature(
  crId:      string,
  featureId: string
): Promise<void> {
  const { error } = await supabase
    .from('change_requests')
    .update({
      status:      'accepted',
      feature_id:  featureId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', crId);
  if (error) throw error;
}

/** Reject CR with optional reason */
export async function rejectChangeRequest(
  crId:    string,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('change_requests')
    .update({
      status:           'rejected',
      rejection_reason: reason ?? null,
      reviewed_at:      new Date().toISOString(),
    })
    .eq('id', crId);
  if (error) throw error;
}

/** Search features for "link to existing" modal dropdown */
export async function searchFeaturesForScreen(
  projectId: string,
  screenId:  string | null,
  query:     string
): Promise<{ id: string; name: string }[]> {
  let q = supabase
    .from('features')
    .select('id, name')
    .eq('project_id', projectId)
    .ilike('name', `%${query}%`)
    .limit(20);

  if (screenId) q = q.eq('screen_id', screenId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

/** Generate test link for empty state QR code */
export function getFeedbackTestLink(deployUrl: string): string {
  return `${deployUrl}/?feedback=true`;
}
