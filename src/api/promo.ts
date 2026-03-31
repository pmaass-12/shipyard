/**
 * Promo API — Build 029
 *
 * Promotional page configuration with AI-generated content support.
 * Public access via anon RLS policy when promo_enabled=TRUE.
 */

import { supabase } from '@/lib/supabase';
import type { PromoPageConfig, PromoStep, PromoFeatureCard } from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch promo configuration for a project.
 */
export async function getPromoConfig(projectId: string): Promise<PromoPageConfig | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(
      'business_name, promo_enabled, promo_tagline, promo_overline, ' +
      'promo_problem_text, promo_steps, promo_features'
    )
    .eq('id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }

  return data as unknown as PromoPageConfig;
}

/**
 * Fetch promo config for public/anon access.
 * Only returns data if promo_enabled=TRUE.
 */
export async function getPublicPromoConfig(projectId: string): Promise<PromoPageConfig | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(
      'business_name, promo_enabled, promo_tagline, promo_overline, ' +
      'promo_problem_text, promo_steps, promo_features'
    )
    .eq('id', projectId)
    .eq('promo_enabled', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }

  return data as unknown as PromoPageConfig;
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Save promo configuration (text fields, steps, features).
 * Auto-save on blur for individual fields.
 */
export async function savePromoConfig(
  projectId: string,
  patch: Partial<PromoPageConfig>
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Toggle promo page public access.
 */
export async function togglePromoPage(projectId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ promo_enabled: enabled })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Call the generate-promo-content Edge Function.
 * Fire-and-forget; returns immediately.
 */
export async function generatePromoContent(projectId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('generate-promo-content', {
    body: { projectId },
  });

  if (error) throw error;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive display name: fallback to project name if business_name is not set.
 */
export function deriveDisplayName(project: {
  name: string;
  business_name: string | null;
}): string {
  return project.business_name || project.name;
}

/**
 * Check if promo page has minimal publishable content.
 * Requires: tagline + problem_text.
 */
export function isPromoPublishable(config: PromoPageConfig): boolean {
  return !!(config.promo_tagline?.trim() && config.promo_problem_text?.trim());
}
