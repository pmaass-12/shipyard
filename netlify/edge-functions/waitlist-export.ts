/**
 * GET /api/waitlist-export — Build 011
 *
 * Owner-only. Streams a CSV of all waitlist signups for a project.
 * Includes all statuses (pending, approved, rejected).
 *
 * Query: ?project_id=<uuid>
 * Headers: Authorization: Bearer <owner_jwt>
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  // Auth
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  const projectId = new URL(req.url).searchParams.get('project_id');
  if (!projectId) return new Response('Missing project_id', { status: 400 });

  // Verify ownership
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return new Response('Not found', { status: 404 });
  }

  const { data } = await supabaseAdmin
    .from('waitlist_signups')
    .select('name, email, source, status, submitted_at, approved_at')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false });

  const headers = ['Name', 'Email', 'How they heard', 'Status', 'Signup date', 'Approved date'];
  const rows = (data ?? []).map(r => [
    r.name,
    r.email,
    r.source ?? '',
    r.status,
    r.submitted_at.split('T')[0],
    r.approved_at?.split('T')[0] ?? '',
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const today = new Date().toISOString().split('T')[0];

  return new Response(csv, {
    headers: {
      'Content-Type':         'text/csv',
      'Content-Disposition':  `attachment; filename="waitlist-${projectId}-${today}.csv"`,
    },
  });
};

export const config = { path: '/api/waitlist-export' };
