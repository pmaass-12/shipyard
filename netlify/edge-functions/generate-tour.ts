/**
 * POST /api/generate-tour — Build 008
 *
 * AI generation of onboarding tour steps from the project's screens + features.
 * Called automatically by push-to-production (alongside generate-whats-new)
 * and manually via the "Regenerate" button in the Admin Console.
 *
 * Auth: standard Supabase JWT (project owner) or internal call from
 * push-to-production with the same JWT forwarded.
 *
 * On success: writes to tour_steps via replace_tour_steps RPC,
 * updates projects.tour_last_generated_at.
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // ── Auth ──────────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  let body: { project_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const { project_id } = body;
  if (!project_id) return new Response('Missing project_id', { status: 400 });

  // ── Verify ownership ──────────────────────────────────────────────────
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, user_id')
    .eq('id', project_id)
    .single();

  if (!project || project.user_id !== user.id) {
    return new Response('Not found', { status: 404 });
  }

  // ── Fetch screens + features ──────────────────────────────────────────
  const { data: screens, error: screensError } = await supabaseAdmin
    .from('screens')
    .select('id, name, description')
    .eq('project_id', project_id);

  if (screensError) return new Response(screensError.message, { status: 500 });

  if (!screens || screens.length === 0) {
    return Response.json({ step_count: 0 }, { status: 200 });
  }

  // Fetch features for each screen
  const screenIds = screens.map((s: { id: string }) => s.id);
  const { data: features } = await supabaseAdmin
    .from('features')
    .select('screen_id, name, description')
    .in('screen_id', screenIds);

  // Group features by screen
  const featuresByScreen = new Map<string, Array<{ name: string; description: string | null }>>();
  for (const f of features ?? []) {
    const existing = featuresByScreen.get(f.screen_id) ?? [];
    existing.push({ name: f.name, description: f.description });
    featuresByScreen.set(f.screen_id, existing);
  }

  const context = screens.map((s: { id: string; name: string; description: string | null }) => {
    const fList = (featuresByScreen.get(s.id) ?? [])
      .map((f: { name: string; description: string | null }) => `  - ${f.name}`)
      .join('\n');
    return `Screen: ${s.name}\nFeatures:\n${fList || '  (none)'}`;
  }).join('\n\n');

  // ── Call Claude API ────────────────────────────────────────────────────
  let newSteps: Array<{
    step_order: number;
    title: string;
    description: string;
    target_selector: string | null;
  }>;

  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role:    'user',
        content: `Generate a concise onboarding tour for a web app with the following screens and features.\n\n${context}\n\nReturn a JSON array of tour steps, each with: step_order (integer, start at 0, increment by 10), title (short), description (1-2 sentences), target_selector (CSS selector using data-tour attribute, or null for intro/outro).\n\nAlways include an intro step (step_order: 0, target_selector: null) and an outro step (last, target_selector: null). Maximum 8 steps total. Return ONLY the JSON array, no markdown.`,
      }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '[]';
    // Strip potential markdown code fences
    const cleanText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    newSteps = JSON.parse(cleanText);
  } catch (err) {
    console.error('Tour generation failed:', err);
    return Response.json({ error: 'Tour generation failed' }, { status: 500 });
  }

  if (!Array.isArray(newSteps) || newSteps.length === 0) {
    return Response.json({ step_count: 0 }, { status: 200 });
  }

  // ── Atomic replace via RPC ────────────────────────────────────────────
  const { error: rpcError } = await supabaseAdmin.rpc('replace_tour_steps', {
    p_project_id: project_id,
    p_steps:      JSON.stringify(newSteps),
  });

  if (rpcError) return new Response(rpcError.message, { status: 500 });

  // ── Update tour_last_generated_at ─────────────────────────────────────
  await supabaseAdmin
    .from('projects')
    .update({ tour_last_generated_at: new Date().toISOString() })
    .eq('id', project_id);

  return Response.json({ step_count: newSteps.length }, { status: 200 });
};

export const config = { path: '/api/generate-tour' };
