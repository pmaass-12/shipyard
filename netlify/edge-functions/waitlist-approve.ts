/**
 * POST /api/waitlist-approve — Build 011
 *
 * Owner-only. Approves a waitlist signup:
 *   1. Verifies JWT ownership of the project
 *   2. Generates a single-use invite token (UUID)
 *   3. Updates the signup to status='approved' + invite_token
 *   4. Sends an approval email with a CTA link (non-fatal if email fails)
 *
 * Body: { project_id: string; signup_id: string }
 *
 * Returns: { approved: true, invite_sent: boolean }
 *   invite_sent may be false if email dispatch failed — admin can retry later.
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

// ── Simple HTML email ─────────────────────────────────────────────────────

function approvalEmailHtml(
  name: string,
  appName: string,
  inviteUrl: string,
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">
        <tr><td style="padding:40px 48px 32px">
          <h1 style="margin:0 0 8px;font-size:24px;color:#1c1c1e">You're in 🎉</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#636366;line-height:1.6">
            Hi ${name}, your spot on the <strong>${appName}</strong> early access waitlist has been approved.
          </p>
          <a href="${inviteUrl}"
             style="display:inline-block;padding:14px 32px;background:#5b5bd6;color:#fff;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none">
            Create your account →
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#aeaeb2;line-height:1.5">
            This invite link is single-use and will expire after you create your account.<br>
            If you didn't sign up for ${appName}, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Email dispatch via Supabase Admin ─────────────────────────────────────

async function sendApprovalEmail(
  to: string,
  name: string,
  appName: string,
  inviteUrl: string,
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Supabase does not have a generic "send email" REST endpoint.
  // In production, use Resend / SendGrid / Postmark via a direct API call.
  // This implementation calls a hypothetical /functions/v1/send-email function
  // or falls back to logging for local development.
  const emailApiUrl = Deno.env.get('EMAIL_API_URL');

  if (emailApiUrl) {
    const res = await fetch(emailApiUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        to,
        subject: `You're in — ${appName} early access is waiting for you`,
        html:    approvalEmailHtml(name, appName, inviteUrl),
      }),
    });
    if (!res.ok) throw new Error(`Email API returned ${res.status}`);
  } else {
    // Fallback: log for local development / preview deploys
    console.log('[waitlist-approve] Approval email (no EMAIL_API_URL configured):');
    console.log(`  To: ${to}`);
    console.log(`  App: ${appName}`);
    console.log(`  Invite URL: ${inviteUrl}`);

    // Attempt Supabase auth admin.inviteUserByEmail as a best-effort alternative
    // This creates a Supabase Auth invitation email if the user doesn't exist yet.
    try {
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(to, {
        data: { invite_url: inviteUrl, app_name: appName },
        redirectTo: inviteUrl,
      });
      if (error) console.warn('[waitlist-approve] inviteUserByEmail failed:', error.message);
    } catch (e) {
      console.warn('[waitlist-approve] inviteUserByEmail threw:', e);
    }
    // Don't throw — this path is a fallback, not a hard requirement.
    return;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  let body: { project_id?: string; signup_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const { project_id, signup_id } = body;
  if (!project_id || !signup_id) {
    return new Response('Missing project_id or signup_id', { status: 400 });
  }

  // Verify ownership
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, name, user_id')
    .eq('id', project_id)
    .single();

  if (!project || project.user_id !== user.id) {
    return new Response('Not found', { status: 404 });
  }

  const inviteToken = crypto.randomUUID();
  const now         = new Date().toISOString();

  const { data: signup, error: updateError } = await supabaseAdmin
    .from('waitlist_signups')
    .update({
      status:       'approved',
      approved_at:  now,
      approved_by:  user.id,
      invite_token: inviteToken,
    })
    .eq('id', signup_id)
    .eq('project_id', project_id)
    .select()
    .single();

  if (updateError || !signup) {
    return new Response('Signup not found', { status: 404 });
  }

  // Send approval email (non-fatal)
  const appUrl    = Deno.env.get('DEPLOYED_APP_URL') ?? 'https://app.example.com';
  const inviteUrl = `${appUrl}/?invite=${inviteToken}`;
  let emailSent   = false;

  try {
    await sendApprovalEmail(signup.email, signup.name, project.name, inviteUrl);
    await supabaseAdmin
      .from('waitlist_signups')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', signup_id);
    emailSent = true;
  } catch (emailErr) {
    // Non-fatal: signup is still approved; admin can resend later.
    console.error('[waitlist-approve] Email dispatch failed:', emailErr);
  }

  return Response.json({ approved: true, invite_sent: emailSent }, { status: 200 });
};

export const config = { path: '/api/waitlist-approve' };
