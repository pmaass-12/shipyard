/**
 * POST /api/generate-feature-code — Build 016
 *
 * Generates code files for Step 3 (Code step).
 * Called automatically when Step 2 is approved, or re-called on "Request changes".
 *
 * Body: { feature_id: string; change_note?: string }
 *
 * Error codes:
 *   401 — no auth
 *   403 — not owner
 *   422 — Step 2 not yet approved
 *   500 — Claude or DB error
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // ── Auth ──────────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { feature_id: string; change_note?: string };
  try { body = await req.json(); }
  catch { return new Response('Malformed JSON', { status: 400 }); }

  const { feature_id, change_note } = body;
  if (!feature_id) return new Response('Missing feature_id', { status: 400 });

  // ── Verify ownership ──────────────────────────────────────────────────
  const { data: feature, error: featureError } = await supabaseAdmin
    .from('features')
    .select('id, name, description, complexity, screen_id, project_id')
    .eq('id', feature_id)
    .single();

  if (featureError || !feature) return new Response('Feature not found', { status: 404 });

  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, user_id, name, tech_stack')
    .eq('id', feature.project_id)
    .single();

  if (projectError || !project || project.user_id !== user.id) {
    return new Response('Not found', { status: 403 });
  }

  // ── Read feature steps ────────────────────────────────────────────────
  const { data: steps, error: stepsError } = await supabaseAdmin
    .from('feature_steps')
    .select('id, step_number, status, content')
    .eq('feature_id', feature_id)
    .order('step_number');

  if (stepsError || !steps) return new Response('Steps not found', { status: 500 });

  const step1 = steps.find((s: { step_number: number }) => s.step_number === 1);
  const step2 = steps.find((s: { step_number: number }) => s.step_number === 2);
  const step3 = steps.find((s: { step_number: number }) => s.step_number === 3);

  if (!step2 || step2.status !== 'approved') {
    return Response.json({ error: 'Step 2 (Schema) must be approved before code generation' }, { status: 422 });
  }

  const specText = (step1?.content as { spec_text?: string })?.spec_text ?? '';
  const sql      = (step2?.content  as { sql?: string })?.sql ?? '';

  // ── Get screen context ────────────────────────────────────────────────
  let screenName = '';
  if (feature.screen_id) {
    const { data: screen } = await supabaseAdmin
      .from('screens')
      .select('name')
      .eq('id', feature.screen_id)
      .single();
    screenName = screen?.name ?? '';
  }

  // ── Build Claude prompt ───────────────────────────────────────────────
  const prompt = `You are generating production-quality React/TypeScript code for a feature in a web application.

App: ${project.name}
Tech stack: ${(project.tech_stack ?? []).join(', ')}
Screen: ${screenName || 'Not specified'}
Feature: ${feature.name}
Description: ${feature.description ?? 'Not provided'}
Complexity: ${feature.complexity}

Step 1 — Design spec:
${specText || '(No spec provided)'}

Step 2 — Database schema (migration SQL):
${sql || '(No schema provided)'}

${change_note ? `Change request from builder:\n${change_note}\n` : ''}

Generate implementation files for this feature. Return ONLY a JSON object (no markdown fences):
{
  "files": [
    {
      "name": "FeatureName.tsx",
      "content": "// full file content here",
      "line_count": 120
    }
  ]
}

Requirements:
- Use React functional components with TypeScript
- Use Tailwind CSS for styling via inline style objects (no class names)
- Use the Supabase client for all DB calls
- Generate 2–4 files: the main screen component, a custom hook, and an API module
- Make the code production-quality: proper error handling, loading states, TypeScript types
- Filename should match the feature name (PascalCase for components, camelCase for hooks/utils)`;

  let generated: { files: Array<{ name: string; content: string; line_count: number }> };
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
        max_tokens: 8000,
        messages:   [{ role: 'user', content: prompt }],
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
    return new Response('Code generation failed', { status: 500 });
  }

  // ── Write generated code to Step 3 ───────────────────────────────────
  if (!step3) return new Response('Step 3 not found', { status: 500 });

  const { error: updateStepError } = await supabaseAdmin
    .from('feature_steps')
    .update({
      content: { files: generated.files },
      status:  'active',
    })
    .eq('id', step3.id);

  if (updateStepError) return new Response(updateStepError.message, { status: 500 });

  // ── Create human task: push code to repo ─────────────────────────────
  await supabaseAdmin
    .from('human_tasks')
    .insert({
      project_id:      feature.project_id,
      feature_id:      feature_id,
      feature_step_id: step3.id,
      title:           'Push this code to your repo before approving this step',
      task_type:       'push_code',
      priority:        'p0',
      status:          'pending',
    });

  return Response.json({ step_id: step3.id }, { status: 200 });
};

export const config = { path: '/api/generate-feature-code' };
