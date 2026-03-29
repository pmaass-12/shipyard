/**
 * POST /api/feedback/change — Build 002
 *
 * Validates preview token → uploads screenshot → inserts into `change_requests`.
 */

import { validatePreviewToken, supabaseAdmin } from './_lib/supabaseAdmin.ts';
import { uploadScreenshot }                    from './_lib/screenshot.ts';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Shipyard-Preview-Token',
  };

  const token = req.headers.get('X-Shipyard-Preview-Token');
  let project: { id: string; name: string };

  try {
    project = await validatePreviewToken(token);
  } catch {
    return new Response('Unauthorized', { status: 401, headers: cors });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400, headers: cors });
  }

  for (const field of ['screen_id', 'route', 'description']) {
    if (!body[field]) {
      return new Response(`Missing required field: ${field}`, { status: 400, headers: cors });
    }
  }

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
    console.error('Screenshot upload error:', err);
  }

  const { data, error } = await supabaseAdmin
    .from('change_requests')
    .insert({
      screen_id:      body.screen_id,
      feature_id:     body.feature_id ?? null,
      description:    body.description,
      screenshot_url: screenshotUrl,
      annotations:    body.annotations ?? [],
      console_errors: body.console_errors ?? [],
      route:          body.route,
      status:         'pending',
    })
    .select()
    .single();

  if (error) {
    return new Response(error.message, { status: 500, headers: cors });
  }

  return Response.json({ id: data.id }, { status: 201, headers: cors });
};

export const config = { path: '/api/feedback/change' };
