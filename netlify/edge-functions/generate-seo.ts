/**
 * POST /api/generate-seo — Build 010
 *
 * Generates (or regenerates) SEO/AEO content for a project using Claude.
 *
 * Called:
 *   - Automatically (non-blocking) when project phase advances to Beta
 *   - From "Regenerate all" button (full generation)
 *   - From per-field ↺ button (single-field mode via `field` param)
 *
 * Body: { project_id: string; field?: keyof SeoSettings }
 *
 * Error codes:
 *   401 — no auth / invalid JWT
 *   404 — project not found or not owned by caller
 *   422 — project is in alpha phase (SEO requires beta or live)
 *   500 — Claude API or Supabase error
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// ── Context builder ───────────────────────────────────────────────────────

interface Screen {
  name: string;
  description: string | null;
  features: Array<{ name: string; description: string | null }>;
}

function buildSeoContext(
  project: { name: string; description: string | null; phase: string },
  screens: Screen[]
): string {
  const screensSummary = screens
    .map(s => {
      const featureList = s.features?.length
        ? s.features.map(f => `    - ${f.name}${f.description ? ': ' + f.description : ''}`).join('\n')
        : '    (no features yet)';
      return `  Screen: ${s.name}${s.description ? ' — ' + s.description : ''}\n${featureList}`;
    })
    .join('\n\n');

  return [
    `App name: ${project.name}`,
    project.description ? `Description: ${project.description}` : '',
    `Phase: ${project.phase}`,
    `\nScreens and features:\n${screensSummary || '  (no screens yet)'}`,
  ].filter(Boolean).join('\n');
}

// ── Claude call: generate all fields ──────────────────────────────────────

async function generateAllFields(context: string): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':             ANTHROPIC_API_KEY,
      'anthropic-version':    '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role:    'user',
        content: `Generate SEO and AEO metadata for this web app:

${context}

Return a JSON object with ONLY these exact keys (no markdown, no explanation, just JSON):
{
  "meta_title":       "60 chars max, keyword-rich, brand name at end",
  "meta_description": "150-160 chars, compelling CTA, includes primary keyword",
  "og_title":         "social-optimized, may differ from meta_title, 60 chars max",
  "og_description":   "shorter/punchier than meta_description, 100 chars max",
  "keywords":         ["array", "of", "5-10", "keywords"],
  "ai_description":   "2-3 sentence plain-language description for AI crawlers",
  "llms_txt":         "plain text /llms.txt content: what the app does, key features, contact",
  "json_ld":          { "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "...", "description": "...", "applicationCategory": "..." }
}`,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  const raw = data.content[0].text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  return JSON.parse(raw) as Record<string, unknown>;
}

// ── Claude call: generate a single field ─────────────────────────────────

async function generateSingleField(
  field: string,
  context: string
): Promise<Record<string, unknown>> {
  const FIELD_PROMPTS: Record<string, string> = {
    meta_title:       'Generate a meta_title: 60 chars max, keyword-rich, brand name at end.',
    meta_description: 'Generate a meta_description: 150-160 chars, compelling CTA, includes primary keyword.',
    og_title:         'Generate an og_title: social-optimized, may differ from meta_title, 60 chars max.',
    og_description:   'Generate an og_description: shorter/punchier than meta_description, 100 chars max.',
    keywords:         'Generate a keywords array: 5-10 relevant keywords as a JSON array of strings.',
    ai_description:   'Generate an ai_description: 2-3 sentences in plain language for AI crawlers.',
    llms_txt:         'Generate llms_txt: plain text /llms.txt content explaining what the app does, key features, and contact.',
    json_ld:          'Generate json_ld: a valid JSON-LD SoftwareApplication object for Schema.org.',
  };

  const instruction = FIELD_PROMPTS[field] ?? `Regenerate the ${field} field.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':             ANTHROPIC_API_KEY,
      'anthropic-version':    '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role:    'user',
        content: `For this web app:\n\n${context}\n\n${instruction}\n\nReturn ONLY a JSON object with the single key "${field}" and its value. No markdown, no explanation.`,
      }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const data = await response.json() as { content: Array<{ text: string }> };
  const raw = data.content[0].text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  return JSON.parse(raw) as Record<string, unknown>;
}

// ── Handler ───────────────────────────────────────────────────────────────

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Auth
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // Parse body
  let body: { project_id: string; field?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const { project_id, field } = body;
  if (!project_id) return new Response('Missing project_id', { status: 400 });

  // Fetch project
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('name, description, phase, user_id')
    .eq('id', project_id)
    .single();

  if (projectError || !project || project.user_id !== user.id) {
    return new Response('Not found', { status: 404 });
  }

  // Phase gate: beta or live only
  if (project.phase === 'alpha') {
    return Response.json(
      { error: 'SEO generation requires Beta phase or later' },
      { status: 422 }
    );
  }

  // Fetch screens + features for context
  const { data: screens } = await supabaseAdmin
    .from('screens')
    .select('name, description, features(name, description)')
    .eq('project_id', project_id);

  const context = buildSeoContext(project, (screens ?? []) as Screen[]);

  // Generate
  let generatedFields: Record<string, unknown>;
  try {
    if (field) {
      generatedFields = await generateSingleField(field, context);
    } else {
      generatedFields = await generateAllFields(context);
    }
  } catch (err) {
    console.error('Claude generation error:', err);
    return new Response('Generation failed', { status: 500 });
  }

  // Build 013: write to project_settings (canonical) using prefixed column names
  // Map generated field names → project_settings column names
  const columnMap: Record<string, string> = {
    meta_title:       'seo_meta_title',
    meta_description: 'seo_meta_description',
    og_title:         'seo_og_title',
    og_description:   'seo_og_description',
    og_image_url:     'seo_og_image_url',
    keywords:         'seo_keywords',
    ai_description:   'aeo_ai_description',
    llms_txt:         'aeo_llms_txt',
    json_ld:          'aeo_json_ld',
  };

  const settingsPatch: Record<string, unknown> = { seo_generated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(generatedFields)) {
    const col = columnMap[key] ?? key;
    settingsPatch[col] = value;
  }

  const { data, error: upsertError } = await supabaseAdmin
    .from('project_settings')
    .update(settingsPatch)
    .eq('project_id', project_id)
    .select()
    .single();

  if (upsertError) {
    console.error('Supabase update error:', upsertError);
    return new Response(upsertError.message, { status: 500 });
  }

  return Response.json(data, { status: 200 });
};

export const config = { path: '/api/generate-seo' };
