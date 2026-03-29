/**
 * GET /api/admin/users — Build 003
 *
 * Lists all users with their role and status.
 * Requires caller to have owner or admin role (validated via JWT).
 *
 * Security: returns 404 (not 403) on auth failures to obscure the admin route.
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Not found', { status: 404 });

  // Guard: admin console must be enabled in env
  if (!Deno.env.get('SHIPYARD_ADMIN')) {
    return new Response('Not found', { status: 404 });
  }

  try {
    await requireAdminRole(req);
  } catch {
    return new Response('Not found', { status: 404 }); // 404, not 403 — obscure route existence
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, role, status, auth_method, last_sign_in_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return new Response(error.message, { status: 500 });

  return Response.json(data);
};

// ── Helpers ───────────────────────────────────────────────────────────────

export async function requireAdminRole(req: Request) {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) throw new Error('No token');

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !user) throw new Error('Invalid token');

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    throw new Error('Insufficient role');
  }

  return { user, role: profile.role as 'owner' | 'admin' };
}

export const config = { path: '/api/admin/users' };
