/**
 * POST /api/feature-chat — Build 016
 *
 * Streams a Claude assistant reply for the persistent chat sidebar.
 * Reads the existing chat thread for (feature_id, step_number) and
 * the current step context, then streams the response as raw UTF-8 text.
 * After streaming completes the assistant message is persisted to
 * feature_chat_messages via service role.
 *
 * Body: { feature_id: string; step_number: 1 | 2 | 3 | 4 | 5 }
 *
 * Error codes:
 *   401 — no auth
 *   403 — not owner
 *   400 — missing / bad fields
 *   500 — Claude or DB error
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const STEP_CONTEXT: Record<number, string> = {
  1: 'You are helping a product builder refine the DESIGN SPEC for a feature. The spec describes what should be built — user stories, acceptance criteria, UX behaviour. Help clarify requirements, suggest edge cases, and improve the spec text.',
  2: 'You are helping a product builder review and refine the DATABASE SCHEMA (migration SQL) for a feature. Help identify missing tables, wrong column types, missing indexes, and RLS considerations.',
  3: 'You are helping a product builder review the GENERATED CODE for a feature. The code has been written by an AI — help identify bugs, improve TypeScript types, spot missing error handling, and suggest refactors.',
  4: 'You are helping a product builder with the DEPLOY step for a feature. Discuss GitHub PR process, Netlify deploy pipeline, environment variables, and deployment checklist items.',
  5: 'You are helping a product builder plan and execute QA for a feature. Suggest test cases, edge cases, regression risks, and sign-off criteria.',
};

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // ── Auth ──────────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { feature_id: string; step_number: number };
  try { body = await req.json(); }
  catch { return new Response('Malformed JSON', { status: 400 }); }

  const { feature_id, step_number } = body;
  if (!feature_id) return new Response('Missing feature_id', { status: 400 });
  if (!step_number || step_number < 1 || step_number > 5) {
    return new Response('step_number must be 1–5', { status: 400 });
  }

  // ── Verify ownership ──────────────────────────────────────────────────
  const { data: feature, error: featureError } = await supabaseAdmin
    .from('features')
    .select('id, name, description, complexity, project_id, screen_id')
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

  // ── Load step content for context ─────────────────────────────────────
  const { data: steps } = await supabaseAdmin
    .from('feature_steps')
    .select('step_number, status, content')
    .eq('feature_id', feature_id)
    .order('step_number');

  const stepSummary = (steps ?? []).map((s: { step_number: number; status: string; content: unknown }) => {
    let contentPreview = '';
    if (s.step_number === 1) {
      const c = s.content as { spec_text?: string } | null;
      contentPreview = c?.spec_text ? `Spec: ${c.spec_text.slice(0, 300)}…` : '';
    } else if (s.step_number === 2) {
      const c = s.content as { sql?: string } | null;
      contentPreview = c?.sql ? `SQL:\n${c.sql.slice(0, 400)}…` : '';
    } else if (s.step_number === 3) {
      const c = s.content as { files?: Array<{ name: string; line_count: number }> } | null;
      if (c?.files?.length) {
        contentPreview = `Files: ${c.files.map((f) => `${f.name} (${f.line_count} lines)`).join(', ')}`;
      }
    }
    return `Step ${s.step_number} [${s.status}]${contentPreview ? '\n' + contentPreview : ''}`;
  }).join('\n\n');

  // ── Load chat thread ───────────────────────────────────────────────────
  const { data: chatRows, error: chatError } = await supabaseAdmin
    .from('feature_chat_messages')
    .select('role, content')
    .eq('feature_id', feature_id)
    .eq('step_number', step_number)
    .order('created_at');

  if (chatError) return new Response('Failed to load chat', { status: 500 });

  const messages = (chatRows ?? []).map((m: { role: string; content: string }) => ({
    role:    m.role as 'user' | 'assistant',
    content: m.content,
  }));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return new Response('No pending user message', { status: 400 });
  }

  // ── Build system prompt ────────────────────────────────────────────────
  const systemPrompt = `${STEP_CONTEXT[step_number] ?? ''}

App: ${project.name}
Tech stack: ${(project.tech_stack ?? []).join(', ')}
Feature: ${feature.name}
Description: ${feature.description ?? 'Not provided'}
Complexity: ${feature.complexity}

Current workflow state:
${stepSummary || '(No steps have content yet)'}

Be concise and practical. Use Markdown for code blocks. Ask clarifying questions when requirements are ambiguous.`;

  // ── Stream Claude response ─────────────────────────────────────────────
  let claudeRes: Response;
  try {
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':          ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2048,
        system:     systemPrompt,
        stream:     true,
        messages,
      }),
    });
  } catch (err) {
    console.error('Claude fetch error:', err);
    return new Response('Claude unavailable', { status: 500 });
  }

  if (!claudeRes.ok || !claudeRes.body) {
    return new Response(`Claude API ${claudeRes.status}`, { status: 500 });
  }

  // ── Pipe SSE → raw text stream, collect full reply ────────────────────
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Process SSE in background; resolve when done
  (async () => {
    const reader  = claudeRes.body!.getReader();
    let fullReply = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // SSE lines: "data: {...}\n\n"
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const evt = JSON.parse(jsonStr) as {
              type:  string;
              delta?: { type: string; text?: string };
            };
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
              const text = evt.delta.text;
              fullReply += text;
              await writer.write(encoder.encode(text));
            }
          } catch {
            // skip malformed event
          }
        }
      }
    } finally {
      await writer.close().catch(() => {});
    }

    // ── Persist assistant message ────────────────────────────────────────
    if (fullReply) {
      await supabaseAdmin.from('feature_chat_messages').insert({
        feature_id,
        step_number,
        role:    'assistant',
        content: fullReply,
      });
    }
  })();

  return new Response(readable, {
    status:  200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

export const config = { path: '/api/feature-chat' };
