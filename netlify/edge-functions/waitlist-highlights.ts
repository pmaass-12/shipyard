/**
 * GET /api/waitlist-highlights — Build 011
 *
 * Public endpoint — no auth. Loads highlight cards for the public waitlist page.
 * Returns { highlights: [] } if waitlist is disabled.
 *
 * Query: ?project_id=<uuid>
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const project_id = new URL(req.url).searchParams.get('project_id');
  if (!project_id) return Response.json({ highlights: [] });

  // Verify waitlist is enabled
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('waitlist_enabled')
    .eq('id', project_id)
    .single();

  if (!project?.waitlist_enabled) {
    return Response.json({ highlights: [] });
  }

  const { data, error } = await supabaseAdmin
    .from('waitlist_highlights')
    .select('sort_order, icon, title, description')
    .eq('project_id', project_id)
    .order('sort_order', { ascending: true });

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ highlights: data ?? [] });
};

export const config = { path: '/api/waitlist-highlights' };
