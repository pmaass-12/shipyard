/**
 * getAIClient — Build 063
 *
 * Per-project AI client factory for Netlify Edge Functions (Deno runtime).
 *
 * Reads project_settings to determine the configured model and API key, then
 * returns a `callModel` function that abstracts the two call paths:
 *
 *   Anthropic models (model.startsWith('anthropic/'))
 *     → Anthropic SDK, pointed at OpenRouter if an OR key is present,
 *       otherwise direct Anthropic API (backward-compat for projects that
 *       haven't added an OpenRouter key yet).
 *
 *   Non-Anthropic models (OpenAI / Google / Mistral / Meta)
 *     → fetch() to https://openrouter.ai/api/v1/chat/completions using the
 *       OpenAI-compatible request/response format.
 *
 * Throws if the project has no usable API key for the selected model.
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3';
import { supabaseAdmin } from './supabaseAdmin.ts';

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectSettings {
  ai_model:           string | null;
  claude_api_key:     string | null;
  openrouter_api_key: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isAnthropicModel(model: string): boolean {
  return model.startsWith('anthropic/');
}

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL   = 'anthropic/claude-sonnet-4';

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Load project settings and return a ready-to-use `callModel` function.
 *
 * @param projectId  Supabase project UUID
 * @returns { model, callModel }
 *   model      — the resolved OpenRouter model string
 *   callModel  — async fn(prompt, maxTokens, system?) → string (the AI text response)
 *                system is prepended as a system message when provided
 */
export async function getAIClient(projectId: string): Promise<{
  model:     string;
  callModel: (prompt: string, maxTokens: number, system?: string) => Promise<string>;
}> {
  // ── Read project_settings ────────────────────────────────────────────────
  const { data: settings, error } = await supabaseAdmin
    .from('project_settings')
    .select('ai_model, claude_api_key, openrouter_api_key')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw new Error(`Failed to read project_settings: ${error.message}`);

  const ps = (settings ?? {}) as Partial<ProjectSettings>;
  const model      = ps.ai_model            ?? DEFAULT_MODEL;
  const claudeKey  = ps.claude_api_key      ?? null;
  const orKey      = ps.openrouter_api_key  ?? null;

  // ── Path A: Anthropic models ─────────────────────────────────────────────
  if (isAnthropicModel(model)) {
    if (!orKey && !claudeKey) {
      throw new Error(
        'No API key configured. Add an Anthropic key or OpenRouter key in Admin → AI Settings.'
      );
    }

    // Prefer OpenRouter when the key is present (routes through OR billing/limits).
    // Fall back to direct Anthropic API if only a Claude key exists.
    const client = orKey
      ? new Anthropic({ apiKey: orKey,    baseURL: `${OPENROUTER_BASE}` })
      : new Anthropic({ apiKey: claudeKey! });

    const callModel = async (prompt: string, maxTokens: number, system?: string): Promise<string> => {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages:   [{ role: 'user', content: prompt }],
      });
      const block = response.content[0];
      return block.type === 'text' ? block.text : '';
    };

    return { model, callModel };
  }

  // ── Path B: Non-Anthropic models (OpenAI / Google / Mistral / Meta) ──────
  if (!orKey) {
    throw new Error(
      `Model "${model}" requires an OpenRouter API key. Add one in Admin → AI Settings.`
    );
  }

  const callModel = async (prompt: string, maxTokens: number, system?: string): Promise<string> => {
    const messages = system
      ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${orKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenRouter error (${res.status}): ${body}`);
    }

    const json = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return json.choices?.[0]?.message?.content ?? '';
  };

  return { model, callModel };
}
