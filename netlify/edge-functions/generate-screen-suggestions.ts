/**
 * POST /api/generate-screen-suggestions — Build 055 (Amendment 1)
 *
 * First-run Screens page helper. Takes the builder's description of their app
 * and returns a suggested screen architecture for review before any screens
 * are created.
 *
 * Returns suggestions only — does NOT insert. The builder reviews, edits, and
 * confirms in ScreensScreen; confirmed screens are POSTed to /api/screens
 * individually and in order.
 *
 * Body:    { project_id: string; description: string }
 * Success: { screens: Array<{ name: string; purpose: string; screen_type: string }> }
 *
 * screen_type values: dashboard | form | list | detail | auth | onboarding | settings
 *
 * Error codes:
 *   400 — malformed JSON
 *   401 — missing/invalid JWT
 *   403 — project not found or not owned by caller
 *   422 — description is empty
 *   500 — AI call failed or no API key configured
 *
 * Uses project_settings.ai_model via getAIClient (Build 063).
 * Reeve character anchor applied (Build 060).
 */

import { supabaseAdmin }   from './_lib/supabaseAdmin.ts';
import { getAIClient }     from './_lib/getAIClient.ts';
import { characterAnchor } from './_lib/characterAnchor.ts';

const VALID_SCREEN_TYPES = [
  'dashboard', 'form', 'list', 'detail', 'auth', 'onboarding', 'settings',
] as const;

type ScreenSuggestionType = typeof VALID_SCREEN_TYPES[number];

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // ── Auth ────────────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // ── Parse body ──────────────────────────────────────────────────────────
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

  // ── Verify ownership ────────────────────────────────────────────────────
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, name, description, user_id')
    .eq('id', project_id)
    .single();

  if (projectError || !project || project.user_id !== user.id) {
    return new Response('Not found', { status: 403 });
  }

  // ── Build prompt ────────────────────────────────────────────────────────
  const systemPrompt = characterAnchor('reeve', project.name);

  const userPrompt = `You are helping a builder plan the screen architecture for their app.

App name: ${project.name}
App description: ${project.description ?? '(not provided)'}
Builder's description: ${description}

Valid screen types and when to use them:
- dashboard  → data overview, stats, charts, activity feeds
- form       → input-heavy screens (create, edit, settings forms)
- list       → browsable collections (tables, card grids, search results)
- detail     → single-item view (profile, item details, thread)
- auth       → login, signup, password reset, onboarding verification
- onboarding → guided first-run steps, welcome screens, setup wizards
- settings   → configuration, preferences, account management

Generate a screen list for this app. Aim for 4–8 screens — don't pad with unnecessary screens if the app is simple.

Return ONLY a JSON object with this exact shape (no markdown, no explanation):
{
  "screens": [
    { "name": "Dashboard", "purpose": "Overview of recent activity and key metrics", "screen_type": "dashboard" },
    { "name": "Login", "purpose": "Email and password authentication", "screen_type": "auth" }
  ]
}

Rules:
- name: concise, 1–3 words, title case
- purpose: one sentence, plain language — what a user does here
- screen_type: must be one of the valid types above
- Include an auth screen only if the app requires accounts`;

  // ── Call AI ─────────────────────────────────────────────────────────────
  let generated: { screens: Array<{ name: string; purpose: string; screen_type: string }> };
  try {
    const { callModel } = await getAIClient(project_id);
    const rawText = await callModel(userPrompt, 1000, systemPrompt);
    const cleanText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    generated = JSON.parse(cleanText);
  } catch (err) {
    console.error('Screen suggestion generation error:', err);
    return new Response('Generation failed', { status: 500 });
  }

  // ── Sanitise ────────────────────────────────────────────────────────────
  const validTypes = new Set<string>(VALID_SCREEN_TYPES);
  const screens = (generated.screens ?? [])
    .map((s) => ({
      name:        String(s.name    ?? '').trim(),
      purpose:     String(s.purpose ?? '').trim(),
      screen_type: (validTypes.has(s.screen_type) ? s.screen_type : 'list') as ScreenSuggestionType,
    }))
    .filter((s) => s.name && s.purpose);

  return Response.json({ screens }, { status: 200 });
};

export const config = { path: '/api/generate-screen-suggestions' };
