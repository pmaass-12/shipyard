/**
 * POST /api/generate-screens — Build 015
 *
 * Accepts a natural language description and returns suggested screens.
 * Returns suggestions only — does NOT auto-insert. Builder reviews and selects.
 *
 * Body: { project_id: string; description: string }
 *
 * Response: { screens: Array<{ name: string; route: string; type: 'page'|'modal'|'auth'|'dashboard' }> }
 *
 * Error codes:
 *   401 — missing/invalid token
 *   403 — project not owned by caller
 *   422 — description empty
 *   500 — Claude API error
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const SCREEN_TYPES = ['page', 'modal', 'auth', 'dashboard'] as const;

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // ── Auth ──────────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { project_id: string; description: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const { project_id, description } = body;

  if (!description?.trim()) {
    return Response.json({ error: 'description is required' }, { status: 422 });
  }

  // ── Verify ownership ──────────────────────────────────────────────────
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, name, description, user_id')
    .eq('id', project_id)
    .single();

  if (projectError || !project || project.user_id !== user.id) {
    return new Response('Not found', { status: 403 });
  }

  // ── Call Claude ───────────────────────────────────────────────────────
  const prompt = `You are helping a developer plan the screen architecture for a web app.

App name: ${project.name}
App description: ${project.description ?? 'Not provided'}
Builder's description of screens: ${description}

Valid screen types: ${SCREEN_TYPES.join(', ')}
- "page" = standard full-page content screens
- "modal" = overlay dialogs and drawers
- "auth" = login, signup, forgot password screens
- "dashboard" = data-heavy analytics/overview screens

Generate a list of screens for this app. Return ONLY a JSON object with this exact shape (no markdown, no explanation):
{
  "screens": [
    { "name": "Dashboard", "route": "/dashboard", "type": "dashboard" },
    { "name": "Login", "route": "/login", "type": "auth" }
  ]
}

Rules:
- 4–10 screens is ideal
- Routes start with /
- Names should be concise (1–3 words)
- Choose the most appropriate type for each screen`;

  let generated: { screens: Array<{ name: string; route: string; type: string }> };
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':          ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Claude API ${response.status}`);

    const data = await response.json() as { content: Array<{ text: string }> };
    const raw  = data.content[0].text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '');

    generated = JSON.parse(raw) as typeof generated;
  } catch (err) {
    console.error('Claude generation error:', err);
    return new Response('Generation failed', { status: 500 });
  }

  // Validate and sanitize the type field
  const validTypes = new Set(SCREEN_TYPES as readonly string[]);
  const screens = (generated.screens ?? []).map((s) => ({
    name:  String(s.name ?? '').trim(),
    route: String(s.route ?? '').trim(),
    type:  validTypes.has(s.type) ? s.type : 'page',
  })).filter((s) => s.name);

  return Response.json({ screens }, { status: 200 });
};

export const config = { path: '/api/generate-screens' };
