/**
 * POST /api/test-mode/set-pin — Build 007
 *
 * Project owner sets or changes the Test Mode PIN.
 * The PIN is hashed server-side (bcrypt, 12 rounds) — never stored raw.
 *
 * Auth: standard Supabase JWT (project owner only).
 *
 * Error codes:
 *   400 — PIN format invalid
 *   401 — missing/invalid token
 *   404 — project not found or not owned by caller
 *   204 — success
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';
import * as bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // ── Auth ──────────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { project_id: string; pin: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const { project_id, pin } = body;

  // ── Validate PIN format ───────────────────────────────────────────────
  if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    return Response.json({ error: 'PIN must be 4–6 digits' }, { status: 400 });
  }

  // ── Verify ownership ──────────────────────────────────────────────────
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', project_id)
    .single();

  if (projectError || !project || project.user_id !== user.id) {
    return new Response('Not found', { status: 404 });
  }

  // ── Hash PIN with bcrypt (cost factor 12) ────────────────────────────
  const hash = await bcrypt.hash(pin, 12);

  // Build 013: write to project_settings (canonical) instead of projects
  const { error: updateError } = await supabaseAdmin
    .from('project_settings')
    .update({
      test_mode_pin_hash:   hash,
      test_mode_pin_set_at: new Date().toISOString(),
    })
    .eq('project_id', project_id);

  if (updateError) return new Response(updateError.message, { status: 500 });

  return new Response(null, { status: 204 });
};

export const config = { path: '/api/test-mode/set-pin' };
