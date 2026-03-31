/**
 * AdSense Monetization API — Build 028
 *
 * Manages Google AdSense configuration for projects.
 * Status lifecycle: not_configured → pending_review → active
 * "preview" status is UI-only (derived client-side).
 * Uses UPSERT pattern on save (onConflict: 'project_id').
 */

import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────

export type AdSenseStatus = 'not_configured' | 'pending_review' | 'active';

export interface AdSenseConfig {
  id: string;
  project_id: string;
  publisher_id: string | null;
  leaderboard_ad_unit_id: string | null;
  rectangle_ad_unit_id: string | null;
  footer_ad_unit_id: string | null;
  status: AdSenseStatus;
  created_at: string;
  updated_at: string;
}

export type AdPlacementSlot = 'leaderboard' | 'rectangle' | 'footer';

// ── API functions ─────────────────────────────────────────────────────────

/**
 * Fetch AdSense config for a project.
 * Returns null if no config exists yet.
 */
export async function getAdSenseConfig(projectId: string): Promise<AdSenseConfig | null> {
  const { data, error } = await supabase
    .from('adsense_configs')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data as AdSenseConfig | null;
}

/**
 * Save or update AdSense config (UPSERT on project_id).
 * Accepts partial updates; returns the complete config row.
 */
export async function saveAdSenseConfig(
  projectId: string,
  patch: Partial<Omit<AdSenseConfig, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
): Promise<AdSenseConfig> {
  const { data, error } = await supabase
    .from('adsense_configs')
    .upsert(
      {
        project_id: projectId,
        ...patch,
      },
      { onConflict: 'project_id' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as AdSenseConfig;
}

/**
 * Mark config as pending_review after builder submits form.
 */
export async function submitForAdSenseReview(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('adsense_configs')
    .update({ status: 'pending_review' })
    .eq('project_id', projectId);

  if (error) throw error;
}

/**
 * Mark config as active after Google approval.
 */
export async function activateAdSense(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('adsense_configs')
    .update({ status: 'active' })
    .eq('project_id', projectId);

  if (error) throw error;
}
