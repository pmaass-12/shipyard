/**
 * GET /api/whats-new — Build 009
 *
 * Returns release notes for the deployed app.
 * No auth required — public content.
 * Returns { enabled: false, releases: [] } when feature is disabled.
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const url        = new URL(req.url);
  const project_id = url.searchParams.get('project_id');

  if (!project_id) return new Response('Bad Request', { status: 400 });

  // ── Check feature is enabled ──────────────────────────────────────────
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('whats_new_enabled')
    .eq('id', project_id)
    .single();

  if (projectError || !project || !project.whats_new_enabled) {
    return Response.json({ enabled: false, releases: [] });
  }

  // ── Fetch releases with nested items ──────────────────────────────────
  const { data: releases, error: releasesError } = await supabaseAdmin
    .from('release_notes')
    .select(`
      id, release_date, push_snapshot_at, generated_at,
      items: release_note_items (
        id, item_type, content, sort_order
      )
    `)
    .eq('project_id', project_id)
    .order('release_date', { ascending: false });

  if (releasesError) return new Response(releasesError.message, { status: 500 });

  // Sort items by sort_order within each release
  const sorted = (releases ?? []).map((r: {
    id: string;
    release_date: string;
    push_snapshot_at: string;
    generated_at: string;
    items: Array<{ id: string; item_type: string; content: string; sort_order: number }>;
  }) => ({
    ...r,
    items: (r.items ?? []).slice().sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  }));

  return Response.json({ enabled: true, releases: sorted });
};

export const config = { path: '/api/whats-new' };
