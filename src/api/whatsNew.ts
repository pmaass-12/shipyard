/**
 * What's New API — src/api/whatsNew.ts
 *
 * All Supabase calls for the What's New release notes domain (Build 009).
 * Generation happens via Edge Functions. Admin Console reads + edits via this client.
 */

import { supabase } from '@/lib/supabase';
import type { ReleaseNoteItem, ReleaseNoteWithItems } from '@/types/db';

// ── Query: List all releases with items (Admin Console) ───────────────────

export async function listReleaseNotes(
  projectId: string
): Promise<ReleaseNoteWithItems[]> {
  const { data, error } = await supabase
    .from('release_notes')
    .select(`
      *,
      items: release_note_items (*)
    `)
    .eq('project_id', projectId)
    .order('release_date', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as ReleaseNoteWithItems[]).map(r => ({
    ...r,
    items: (r.items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
  }));
}

// ── Query: Check for unseen releases (red-dot badge) ──────────────────────

export async function hasUnseenReleases(
  projectId: string,
  userId:    string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('whats_new_last_seen_at')
    .eq('id', userId)
    .single();

  const lastSeen = (profile as { whats_new_last_seen_at: string | null } | null)
    ?.whats_new_last_seen_at;

  let query = supabase
    .from('release_notes')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (lastSeen) {
    query = query.gt('push_snapshot_at', lastSeen);
  }
  // If lastSeen is null, any release counts as unseen.

  const { count, error } = await query;
  if (error) return false; // fail-safe — don't show dot on error
  return (count ?? 0) > 0;
}

// ── Mutation: Mark What's New as seen (clears red dot) ───────────────────

export async function markWhatsNewSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ whats_new_last_seen_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}

// ── Mutation: Edit a release note item (Admin Console inline) ─────────────

export async function updateReleaseNoteItem(
  itemId:  string,
  content: string
): Promise<ReleaseNoteItem> {
  const { data, error } = await supabase
    .from('release_note_items')
    .update({ content })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data as ReleaseNoteItem;
}
