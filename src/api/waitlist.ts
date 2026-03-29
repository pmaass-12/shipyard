/**
 * Waitlist API — Build 011
 *
 * Matches the contract in contracts/011-waitlist-READY.md.
 * Admin-side queries: list signups, approve, reject, remove, manage highlights.
 * Public signup goes through the /api/waitlist-signup edge function (no auth).
 */

import { supabase } from '@/lib/supabase';
import type {
  WaitlistSignup,
  WaitlistStatus,
  WaitlistHighlight,
  WaitlistStats,
} from '@/types/db';

// ── Signups ───────────────────────────────────────────────────────────────

/**
 * List signups for a project, newest first.
 * filter = 'all' returns all statuses (including rejected).
 */
export async function listWaitlistSignups(
  projectId: string,
  filter: WaitlistStatus | 'all' = 'all'
): Promise<WaitlistSignup[]> {
  let query = supabase
    .from('waitlist_signups')
    .select('*')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false });

  if (filter !== 'all') query = query.eq('status', filter);

  const { data, error } = await query;
  if (error) throw error;
  return data as WaitlistSignup[];
}

/**
 * Fetch per-project counts for filter tab badges.
 */
export async function getWaitlistStats(
  projectId: string
): Promise<WaitlistStats> {
  const { data, error } = await supabase
    .from('waitlist_stats')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error) throw error;
  return data as WaitlistStats;
}

/**
 * Mark a signup as rejected (spam). Sets status + rejection_reason.
 */
export async function rejectWaitlistSignup(
  signupId:        string,
  rejectionReason: string = 'spam'
): Promise<void> {
  const { error } = await supabase
    .from('waitlist_signups')
    .update({ status: 'rejected', rejection_reason: rejectionReason })
    .eq('id', signupId);

  if (error) throw error;
}

/**
 * Hard-delete a signup. Only safe when no downstream FKs exist.
 * No undo — confirm before calling.
 */
export async function removeWaitlistSignup(signupId: string): Promise<void> {
  const { error } = await supabase
    .from('waitlist_signups')
    .delete()
    .eq('id', signupId);

  if (error) throw error;
}

// ── Highlights ────────────────────────────────────────────────────────────

export async function listWaitlistHighlights(
  projectId: string
): Promise<WaitlistHighlight[]> {
  const { data, error } = await supabase
    .from('waitlist_highlights')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data as WaitlistHighlight[];
}

export async function upsertWaitlistHighlight(
  highlight: Omit<WaitlistHighlight, 'id' | 'updated_at'>
): Promise<WaitlistHighlight> {
  const { data, error } = await supabase
    .from('waitlist_highlights')
    .upsert(highlight, { onConflict: 'project_id,sort_order' })
    .select()
    .single();

  if (error) throw error;
  return data as WaitlistHighlight;
}

export async function deleteWaitlistHighlight(id: string): Promise<void> {
  const { error } = await supabase
    .from('waitlist_highlights')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
