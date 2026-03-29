/**
 * POST /api/feedback/bug — Build 002
 *
 * Validates preview token → uploads screenshot → inserts into `bugs`.
 * Auth: X-Shipyard-Preview-Token header (NOT Supabase auth).
 */

import { validatePreviewToken, supabaseAdmin } from './_lib/supabaseAdmin.ts';
import { uploadScreenshot }                    from './_lib/screenshot.ts';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // CORS for preview environments
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Shipyard-Preview-Token',
  };

  const token = req.headers.get('X-Shipyard-Preview-Token');
  let project: { id: string; name: string };

  try {
    project = await validatePreviewToken(token);
  } catch (err) {
    return new Response('Unauthorized', { status: 401, headers: cors });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400, headers: cors });
  }

  const required = ['screen_id', 'route', 'severity', 'description'];
  for (const field of required) {
    if (!body[field]) {
      return new Response(`Missing required field: ${field}`, { status: 400, headers: cors });
    }
  }

  // Validate screen belongs to this project
  const { data: screen } = await supabaseAdmin
    .from('screens')
    .select('id')
    .eq('id', body.screen_id as string)
    .eq('project_id', project.id)
    .single();

  if (!screen) {
    return new Response('screen_id not found in this project', { status: 404, headers: cors });
  }

  let screenshotUrl = '';
  try {
    screenshotUrl = await uploadScreenshot(
      body.screenshot_url as string ?? '',
      project.id,
      body.screen_id as string,
    );
  } catch (err) {
    // Non-fatal — continue without screenshot
    console.error('Screenshot upload error:', err);
  }

  const { data, error } = await supabaseAdmin
    .from('bugs')
    .insert({
      screen_id:      body.screen_id,
      title:          `[Widget] ${body.route}`,  // auto-title; owner can rename
      description:    body.description,
      severity:       (body.severity as string).toLowerCase(),
      status:         'open',
      screenshot_url: screenshotUrl,
      annotations:    body.annotations ?? [],
      console_errors: body.console_errors ?? [],
      route:          body.route,
      user_agent:     body.user_agent ?? null,
      captured_at:    body.captured_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return new Response(error.message, { status: 500, headers: cors });
  }

  return Response.json({ id: data.id }, { status: 201, headers: cors });
};

export const config = { path: '/api/feedback/bug' };
