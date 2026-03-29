/**
 * SEO / AEO Settings API — Build 010
 *
 * Matches the contract in contracts/010-seo-aeo-READY.md.
 * One row per project in the `seo_settings` table.
 */

import { supabase } from '@/lib/supabase';
import type { SeoSettings, SeoSettingsPatch } from '@/types/db';

// ── Query: load SEO settings for a project ────────────────────────────────

/**
 * Returns null when the row doesn't exist yet (alpha phase / never generated).
 * The locked-state UI reads projects.phase from ProjectSummary, not this table.
 */
export async function getSeoSettings(
  projectId: string
): Promise<SeoSettings | null> {
  const { data, error } = await supabase
    .from('seo_settings')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data as SeoSettings | null;
}

// ── Mutation: save a single field (inline card edit) ─────────────────────

/**
 * PATCH one or more fields on the seo_settings row.
 * The DB trigger (trg_seo_reset_published) automatically resets
 * is_published = false whenever any content field changes.
 */
export async function updateSeoField(
  projectId: string,
  patch: SeoSettingsPatch
): Promise<SeoSettings> {
  const { data, error } = await supabase
    .from('seo_settings')
    .update(patch)
    .eq('project_id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data as SeoSettings;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Serialize keywords array → comma-separated string for textarea editing.
 * Empty array and null both produce an empty string.
 */
export function keywordsToText(keywords: string[] | null): string {
  return (keywords ?? []).join(', ');
}

/**
 * Parse comma-separated textarea value → trimmed, non-empty string array.
 */
export function textToKeywords(text: string): string[] {
  return text.split(',').map(k => k.trim()).filter(Boolean);
}
