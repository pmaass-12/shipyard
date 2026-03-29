/**
 * Project Settings API — Build 013
 *
 * Single source of truth for all per-project Platform Feature configuration.
 * One row per project, auto-inserted when a project is created.
 *
 * IMPORTANT: test_mode_pin_hash is EXCLUDED from all client queries.
 * It is only read/written by Netlify Edge Functions via service role.
 */

import { supabase } from '@/lib/supabase';
import type { ProjectSettings, ProjectSettingsPatch } from '@/types/db';

// Named select string — excludes the PIN hash from all client queries
const SETTINGS_CLIENT_COLUMNS = `
  id, project_id,
  test_mode_enabled, test_mode_pin_set_at,
  tour_enabled, tour_generated_at, tour_last_edited_at,
  whats_new_enabled,
  seo_meta_title, seo_meta_description, seo_og_title, seo_og_description,
  seo_og_image_url, seo_keywords, seo_robots_index, seo_sitemap_enabled,
  aeo_llms_txt, aeo_json_ld, aeo_ai_description,
  seo_generated_at, seo_published_at,
  waitlist_enabled, waitlist_highlights, waitlist_form_enabled,
  setup_step,
  created_at, updated_at
`.trim();

/**
 * Fetch the project_settings row for a project.
 * Guaranteed to exist for every project — safe to call with .single().
 * The PIN hash is never included in the returned object.
 */
export async function getProjectSettings(
  projectId: string
): Promise<Omit<ProjectSettings, 'test_mode_pin_hash'>> {
  const { data, error } = await supabase
    .from('project_settings')
    .select(SETTINGS_CLIENT_COLUMNS)
    .eq('project_id', projectId)
    .single();

  if (error) throw error;
  return data as Omit<ProjectSettings, 'test_mode_pin_hash'>;
}

/**
 * Partially update project settings (PATCH semantics).
 * Any subset of patchable fields. Returns the updated row.
 * PIN-related and server-managed fields are excluded from the patch type.
 */
export async function updateProjectSettings(
  projectId: string,
  patch:      ProjectSettingsPatch
): Promise<Omit<ProjectSettings, 'test_mode_pin_hash'>> {
  const { data, error } = await supabase
    .from('project_settings')
    .update(patch)
    .eq('project_id', projectId)
    .select(SETTINGS_CLIENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as Omit<ProjectSettings, 'test_mode_pin_hash'>;
}
