/**
 * POST /api/push-to-production — Build 006
 *
 * Atomic "Push to Production" action:
 *   1. Verifies caller owns the project
 *   2. Verifies at least one Production-maturity feature exists
 *   3. Sets status = 'shipped', phase = 'live', pushed_to_production_at = NOW()
 *   4. Fires downstream generation for Tour (008) + What's New (009) in parallel
 *
 * Returns { pushed_at: ISO8601 } on success.
 *
 * Error codes:
 *   401 — no auth token
 *   404 — project not found or not owned by caller
 *   422 — zero Production-maturity features
 *   500 — DB update failed
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // ── Auth ──────────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { project_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const { project_id } = body;
  if (!project_id) return new Response('Missing project_id', { status: 400 });

  // ── Verify ownership ──────────────────────────────────────────────────
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, status, phase, user_id')
    .eq('id', project_id)
    .single();

  if (projectError || !project || project.user_id !== user.id) {
    return new Response('Not found', { status: 404 });
  }

  // ── Guard: already shipped ────────────────────────────────────────────
  if (project.status === 'shipped') {
    return Response.json({ error: 'Project already pushed to production' }, { status: 409 });
  }

  // ── Guard: at least one Production-maturity feature ───────────────────
  const screensSub = supabaseAdmin
    .from('screens')
    .select('id')
    .eq('project_id', project_id);

  const { count, error: countError } = await supabaseAdmin
    .from('features')
    .select('id', { count: 'exact', head: true })
    .eq('maturity', 'production')
    .in('screen_id', screensSub as unknown as string[]);

  if (countError) return new Response(countError.message, { status: 500 });

  if ((count ?? 0) === 0) {
    return Response.json(
      { error: 'No Production-maturity features to push' },
      { status: 422 }
    );
  }

  const pushedAt = new Date().toISOString();

  // ── Atomic project update ─────────────────────────────────────────────
  const { error: updateError } = await supabaseAdmin
    .from('projects')
    .update({
      status:                  'shipped',
      phase:                   'live',
      pushed_to_production_at: pushedAt,
    })
    .eq('id', project_id);

  if (updateError) return new Response(updateError.message, { status: 500 });

  // ── Mark SEO settings as published (Build 013: use project_settings) ──
  // seo_published_at is the canonical publish timestamp.
  // The reset trigger won't fire here — only content field changes clear it.
  await supabaseAdmin
    .from('project_settings')
    .update({ seo_published_at: pushedAt })
    .eq('project_id', project_id);

  // ── Fire downstream generation (non-blocking, allSettled) ────────────
  const baseUrl = Deno.env.get('URL') ?? req.headers.get('origin') ?? '';

  await Promise.allSettled([
    fetch(`${baseUrl}/api/generate-tour`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
      body:    JSON.stringify({ project_id }),
    }),
    fetch(`${baseUrl}/api/generate-whats-new`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
      body:    JSON.stringify({ project_id, pushed_at: pushedAt }),
    }),
  ]);

  return Response.json({ pushed_at: pushedAt }, { status: 200 });
};

export const config = { path: '/api/push-to-production' };
