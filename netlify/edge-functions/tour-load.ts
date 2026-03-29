/**
 * GET /api/tour — Build 008
 *
 * Returns tour steps for the deployed app.
 * No auth required — tour content is public.
 * Returns { enabled: false, steps: [] } when tour is disabled.
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const url        = new URL(req.url);
  const project_id = url.searchParams.get('project_id');

  if (!project_id) return new Response('Bad Request', { status: 400 });

  // ── Check tour is enabled ─────────────────────────────────────────────
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('onboarding_tour_enabled')
    .eq('id', project_id)
    .single();

  if (projectError || !project) {
    return Response.json({ enabled: false, steps: [] });
  }

  if (!project.onboarding_tour_enabled) {
    return Response.json({ enabled: false, steps: [] });
  }

  // ── Fetch steps in order ──────────────────────────────────────────────
  const { data: steps, error: stepsError } = await supabaseAdmin
    .from('tour_steps')
    .select('id, step_order, title, description, target_selector')
    .eq('project_id', project_id)
    .order('step_order', { ascending: true });

  if (stepsError) return new Response(stepsError.message, { status: 500 });

  return Response.json({ enabled: true, steps: steps ?? [] });
};

export const config = { path: '/api/tour' };
