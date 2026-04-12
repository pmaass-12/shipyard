/**
 * POST /api/generate-whats-new — Build 009
 *
 * AI generation of release notes from Production-maturity features
 * and resolved bugs since the previous push.
 *
 * Called automatically by push-to-production (alongside generate-tour)
 * and manually via a future "Regenerate" button in Admin Console.
 *
 * Auth: standard Supabase JWT (project owner).
 *
 * On success: creates a release_notes row + release_note_items.
 */

import { supabaseAdmin } from './_lib/supabaseAdmin.ts';
import { getAIClient }  from './_lib/getAIClient.ts';

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // ── Auth ──────────────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  let body: { project_id: string; pushed_at: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const { project_id, pushed_at } = body;
  if (!project_id || !pushed_at) return new Response('Missing project_id or pushed_at', { status: 400 });

  // ── Verify ownership ──────────────────────────────────────────────────
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, user_id')
    .eq('id', project_id)
    .single();

  if (!project || project.user_id !== user.id) {
    return new Response('Not found', { status: 404 });
  }

  // ── Fetch Production-maturity features ────────────────────────────────
  const screensSub = supabaseAdmin
    .from('screens')
    .select('id')
    .eq('project_id', project_id);

  const { data: productionFeatures } = await supabaseAdmin
    .from('features')
    .select('name, description')
    .eq('maturity', 'production')
    .in('screen_id', screensSub as unknown as string[]);

  // ── Fetch resolved bugs since last push ───────────────────────────────
  const { data: lastRelease } = await supabaseAdmin
    .from('release_notes')
    .select('push_snapshot_at')
    .eq('project_id', project_id)
    .order('push_snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sinceDate = lastRelease?.push_snapshot_at ?? '2000-01-01';

  const { data: resolvedBugs } = await supabaseAdmin
    .from('bugs')
    .select('title, description')
    .eq('status', 'fixed')
    .in('severity', ['p0', 'p1', 'p2'])
    .gte('updated_at', sinceDate)
    .in('screen_id', screensSub as unknown as string[]);

  // ── Build prompt ──────────────────────────────────────────────────────
  const featuresText = (productionFeatures ?? [])
    .map((f: { name: string; description: string | null }) =>
      `- ${f.name}${f.description ? ': ' + f.description : ''}`)
    .join('\n');

  const bugsText = (resolvedBugs ?? [])
    .map((b: { title: string; description: string | null }) =>
      `- ${b.title}${b.description ? ': ' + b.description : ''}`)
    .join('\n');

  const prompt = `You are writing release notes for a web app. Write short, user-friendly summaries.

New features in this release:
${featuresText || '(none)'}

Bugs fixed since last release:
${bugsText || '(none)'}

Return a JSON object:
{
  "features": ["one sentence per feature, user-facing language"],
  "bug_fixes": ["one sentence per fix, user-facing language"]
}

Maximum 8 features and 6 bug fixes. Do not include items from "(none)" sections. Return ONLY the JSON object, no markdown.`;

  let parsed: { features: string[]; bug_fixes: string[] };

  try {
    const { callModel } = await getAIClient(project_id);

    const rawText   = await callModel(prompt, 1500);
    const cleanText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(cleanText);
  } catch (err) {
    console.error('What\'s New generation failed:', err);
    return Response.json({ error: 'Release notes generation failed' }, { status: 500 });
  }

  // ── Insert release_notes row ──────────────────────────────────────────
  const { data: releaseNote, error: insertError } = await supabaseAdmin
    .from('release_notes')
    .insert({
      project_id,
      release_date:     pushed_at.split('T')[0],  // date portion only
      push_snapshot_at: pushed_at,
    })
    .select()
    .single();

  if (insertError || !releaseNote) {
    return new Response(insertError?.message ?? 'Failed to insert release note', { status: 500 });
  }

  // ── Insert release_note_items ─────────────────────────────────────────
  const featureItems = (parsed.features ?? []).map((content: string, i: number) => ({
    release_note_id: releaseNote.id,
    item_type:       'feature',
    content,
    sort_order:      i + 1,
  }));

  const bugItems = (parsed.bug_fixes ?? []).map((content: string, i: number) => ({
    release_note_id: releaseNote.id,
    item_type:       'bug_fix',
    content,
    sort_order:      100 + i,
  }));

  const allItems = [...featureItems, ...bugItems];

  if (allItems.length > 0) {
    const { error: itemsError } = await supabaseAdmin
      .from('release_note_items')
      .insert(allItems);

    if (itemsError) console.error('Failed to insert release items:', itemsError.message);
  }

  return Response.json({
    release_note_id: releaseNote.id,
    feature_count:   featureItems.length,
    bug_fix_count:   bugItems.length,
  }, { status: 201 });
};

export const config = { path: '/api/generate-whats-new' };
