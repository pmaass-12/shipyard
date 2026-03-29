/**
 * POST /api/waitlist-signup — Build 011
 *
 * Public endpoint — no auth required.
 * Inserts a new waitlist signup for the given project.
 *
 * Body: { project_id, name, email, source? }
 *
 * Returns:
 *   201 { success: true }           — new signup created
 *   200 { success: false, duplicate: true } — email already on the list
 *   400 — missing/invalid fields
 *   403 — waitlist not enabled for this project
 *   500 — DB error
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body: { project_id?: string; name?: string; email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const { project_id, name, email, source } = body;

  // Validate required fields
  if (!name?.trim() || !email?.trim() || !project_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email' }, { status: 400 });
  }

  // Verify waitlist is enabled
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('waitlist_enabled')
    .eq('id', project_id)
    .single();

  if (!project?.waitlist_enabled) {
    return Response.json({ error: 'Waitlist not active' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('waitlist_signups')
    .insert({
      project_id,
      name:   name.trim(),
      email:  email.trim().toLowerCase(),
      source: source?.trim() ?? null,
    });

  // Unique constraint violation = duplicate (project_id, email)
  if (error?.code === '23505') {
    return Response.json({ success: false, duplicate: true });
  }

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ success: true }, { status: 201 });
};

export const config = { path: '/api/waitlist-signup' };
