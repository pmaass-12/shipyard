/**
 * POST /api/projects/:projectId/api-key — Build 004 (fix: BUG-P1-004b)
 *
 * Stores the user's Anthropic API key securely.
 * The key is stored in the `projects.anthropic_api_key` column, protected
 * by Supabase RLS (only the project owner can read/write it).
 *
 * V1 note: stored as plaintext in Postgres with RLS + HTTPS protection.
 * TODO for v2: encrypt at rest using pgcrypto or an external vault.
 *
 * Auth: standard Supabase JWT (not preview token).
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  const url       = new URL(req.url);
  const parts     = url.pathname.split('/').filter(Boolean);
  // parts: ['api', 'projects', projectId, 'api-key']
  const projectId = parts[2];
  if (!projectId) return new Response('Missing projectId', { status: 400 });

  let body: { api_key: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  if (!body.api_key?.startsWith('sk-ant-')) {
    return new Response('Invalid API key format', { status: 400 });
  }

  // Verify caller owns the project
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return new Response('Project not found or access denied', { status: 404 });
  }

  // Store the key (protected by RLS)
  const { error: updateError } = await supabaseAdmin
    .from('projects')
    .update({ anthropic_api_key: body.api_key })
    .eq('id', projectId);

  if (updateError) return new Response(updateError.message, { status: 500 });

  return new Response(null, { status: 204 });
};

export const config = { path: '/api/projects/:projectId/api-key' };
