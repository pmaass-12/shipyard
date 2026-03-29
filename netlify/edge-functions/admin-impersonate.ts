/**
 * POST /api/admin/impersonate — Build 003
 *
 * Creates a single-use, 15-minute impersonation token for the target user.
 * Returns the token (caller opens a new tab with ?__shipyard_impersonate=<token>).
 */

import { supabaseAdmin }   from './_lib/supabaseAdmin.ts';
import { requireAdminRole } from './admin-users.ts';

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let caller: { user: { id: string }; role: string };
  try {
    caller = await requireAdminRole(req);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const { target_user_id } = await req.json();
  if (!target_user_id) return new Response('Missing target_user_id', { status: 400 });

  const token     = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from('admin_impersonation_tokens')
    .insert({
      token,
      admin_id:   caller.user.id,
      target_id:  target_user_id,
      expires_at: expiresAt,
    });

  if (error) return new Response(error.message, { status: 500 });

  // Audit log
  await supabaseAdmin.from('admin_audit_log').insert({
    admin_user_id:  caller.user.id,
    action:         'impersonation_started',
    target_user_id,
    performed_at:   new Date().toISOString(),
  });

  return Response.json({ token }, { status: 201 });
};

export const config = { path: '/api/admin/impersonate' };
