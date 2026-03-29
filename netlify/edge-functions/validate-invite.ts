/**
 * GET /api/validate-invite — Build 011
 *
 * Public endpoint — no auth. Validates an invite token before
 * showing the Supabase signup form.
 *
 * Query: ?token=<uuid>&project_id=<uuid>
 *
 * Returns:
 *   { valid: true, email: string, name: string }
 *   { valid: false, reason: 'token_not_found' }
 *
 * After the user creates their Supabase account, the caller must clear
 * the invite token by calling /api/waitlist-approve (or the client
 * issues a direct Supabase update — but since no client INSERT policy
 * exists, use a dedicated edge function).
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const url       = new URL(req.url);
  const token     = url.searchParams.get('token');
  const projectId = url.searchParams.get('project_id');

  if (!token || !projectId) {
    return Response.json({ valid: false, reason: 'token_not_found' });
  }

  const { data, error } = await supabaseAdmin
    .from('waitlist_signups')
    .select('id, name, email, status, invite_token')
    .eq('project_id', projectId)
    .eq('invite_token', token)
    .eq('status', 'approved')
    .maybeSingle();

  if (!data || error) {
    return Response.json({ valid: false, reason: 'token_not_found' });
  }

  return Response.json({ valid: true, email: data.email, name: data.name });
};

export const config = { path: '/api/validate-invite' };
