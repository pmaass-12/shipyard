/**
 * Admin user action endpoints — Build 003 (fixed: BUG-P1-003d, BUG-P2-003g, BUG-P3-003h)
 *
 * PATCH /api/admin/users/:userId/role       — change role
 * PATCH /api/admin/users/:userId/suspend    — suspend user
 * PATCH /api/admin/users/:userId/unsuspend  — restore user
 * POST  /api/admin/users/:userId/reset-password
 * POST  /api/admin/users/:userId/export     — GDPR export → signed URL
 * DELETE /api/admin/users/:userId           — RTBF delete
 *
 * Security: returns 404 (not 403) on auth failures to obscure the admin route.
 */

import { supabaseAdmin }    from './_lib/supabaseAdmin.ts';
import { requireAdminRole } from './admin-users.ts';

export default async (req: Request) => {
  // Guard: admin console must be enabled
  if (!Deno.env.get('SHIPYARD_ADMIN')) {
    return new Response('Not found', { status: 404 });
  }

  let caller: { user: { id: string }; role: string };
  try {
    caller = await requireAdminRole(req);
  } catch {
    return new Response('Not found', { status: 404 }); // 404 not 403
  }

  const url      = new URL(req.url);
  const parts    = url.pathname.split('/').filter(Boolean);
  // parts: ['api', 'admin', 'users', userId, action?]
  const userId   = parts[3];
  const action   = parts[4];

  if (!userId) return new Response('Not found', { status: 404 });

  // ── Change Role ──────────────────────────────────────────────────────────
  if (req.method === 'PATCH' && action === 'role') {
    const { role } = await req.json();
    if (!['owner', 'admin', 'member', 'viewer'].includes(role)) {
      return new Response('Invalid role', { status: 400 });
    }

    // Guard: cannot demote the last owner → 422 (contract spec)
    if (role !== 'owner') {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner');
      const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).single();
      if (target?.role === 'owner' && (count ?? 0) <= 1) {
        return new Response('Cannot remove the last owner', { status: 422 }); // 422, not 409
      }
    }

    await supabaseAdmin.from('profiles').update({ role }).eq('id', userId);
    await audit(caller.user.id, 'role_changed', userId, `Role changed to ${role}`);
    return new Response(null, { status: 204 });
  }

  // ── Suspend ──────────────────────────────────────────────────────────────
  if (req.method === 'PATCH' && action === 'suspend') {
    await supabaseAdmin.from('profiles').update({ status: 'suspended', suspended_at: new Date().toISOString() }).eq('id', userId);
    await supabaseAdmin.auth.admin.signOut(userId).catch(() => {});
    await audit(caller.user.id, 'account_suspended', userId);
    return new Response(null, { status: 204 });
  }

  // ── Unsuspend ────────────────────────────────────────────────────────────
  if (req.method === 'PATCH' && action === 'unsuspend') {
    await supabaseAdmin.from('profiles').update({ status: 'active', suspended_at: null }).eq('id', userId);
    await audit(caller.user.id, 'account_restored', userId);
    return new Response(null, { status: 204 });
  }

  // ── Reset Password ───────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'reset-password') {
    const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', userId).single();
    if (!profile?.email) return new Response('User not found', { status: 404 });
    await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email: profile.email });
    await audit(caller.user.id, 'password_reset_sent', userId);
    return new Response(null, { status: 204 });
  }

  // ── Export User Data (GDPR) — BUG-P2-003g fix ───────────────────────────
  // Collect user data → upload JSON to shipyard-exports → return signed URL (5-min TTL).
  if (req.method === 'POST' && action === 'export') {
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
    const { data: features }  = await supabaseAdmin.from('features').select('*').eq('screen_id', `(SELECT id FROM screens WHERE project_id IN (SELECT id FROM projects WHERE user_id = '${userId}'))`);
    const { data: bugs }      = await supabaseAdmin.from('bugs').select('*').eq('screen_id', `(SELECT id FROM screens WHERE project_id IN (SELECT id FROM projects WHERE user_id = '${userId}'))`);
    const { data: auditLog }  = await supabaseAdmin.from('admin_audit_log').select('*').eq('target_user_id', userId);

    const exportData = {
      exported_at: new Date().toISOString(),
      profile,
      features:    features ?? [],
      bugs:        bugs     ?? [],
      audit_log:   auditLog ?? [],
    };

    const filename  = `exports/${userId}/${crypto.randomUUID()}.json`;
    const jsonBytes = new TextEncoder().encode(JSON.stringify(exportData, null, 2));

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('shipyard-exports')
      .upload(filename, jsonBytes, { contentType: 'application/json', upsert: false });

    if (uploadError) return new Response(`Export upload failed: ${uploadError.message}`, { status: 500 });

    // Signed URL with 5-minute TTL (300 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('shipyard-exports')
      .createSignedUrl(uploadData.path, 300);

    if (signedUrlError) return new Response(`Signed URL failed: ${signedUrlError.message}`, { status: 500 });

    await audit(caller.user.id, 'data_exported', userId);
    return Response.json({ download_url: signedUrlData.signedUrl }, { status: 200 });
  }

  // ── RTBF Delete ──────────────────────────────────────────────────────────
  if (req.method === 'DELETE' && !action) {
    // 1. Anonymise profile
    const anonEmail = `deleted-${crypto.randomUUID()}@shipyard.invalid`;
    await supabaseAdmin.from('profiles').update({
      name:       'Deleted User',
      email:      anonEmail,
      status:    'suspended',
      deleted_at: new Date().toISOString(),
    }).eq('id', userId);

    // 2. Soft-delete content rows
    const now = new Date().toISOString();
    for (const table of ['projects', 'features', 'bugs', 'change_requests'] as const) {
      await supabaseAdmin.from(table).update({ deleted_at: now }).eq('user_id', userId);
    }

    // 3. Remove auth account
    await supabaseAdmin.auth.admin.deleteUser(userId);

    // 4. Audit log — target_user_email nulled per RTBF spec
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_user_id:     caller.user.id,
      action:            'account_deleted_rtbf',
      target_user_id:    userId,
      target_user_email: null,
      target_user_name:  null,
      performed_at:      new Date().toISOString(),
    });

    return new Response(null, { status: 204 });
  }

  return new Response('Not found', { status: 404 });
};

async function audit(adminId: string, action: string, targetUserId: string, details?: string) {
  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('email, name')
    .eq('id', targetUserId)
    .single();

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_user_id:     adminId,
    action,
    target_user_id:    targetUserId,
    target_user_email: target?.email  ?? null,
    target_user_name:  target?.name   ?? null,
    details:           details        ?? null,
    performed_at:      new Date().toISOString(),
  });
}

export const config = { path: '/api/admin/users/:userId*' };
