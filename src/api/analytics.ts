/**
 * Analytics API — Build 017
 *
 * Manages analytics configuration (PostHog integration).
 * Stores posthog_project_id and analytics_enabled state.
 * posthog_api_key is stored server-side only via Edge Function.
 *
 * Contract: contracts/017-analytics-READY.md
 */

import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnalyticsConfig {
  posthog_project_id: string | null;
  analytics_enabled: boolean;
}

export type AnalyticsConnectionStatus = 'connected' | 'disconnected' | 'error';

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch analytics configuration for a project.
 * Returns posthog_project_id and analytics_enabled state.
 * posthog_api_key is NEVER returned to client.
 */
export async function getAnalyticsConfig(
  projectId: string
): Promise<AnalyticsConfig> {
  const { data, error } = await supabase
    .from('projects')
    .select('posthog_project_id, analytics_enabled')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return {
    posthog_project_id: data.posthog_project_id || null,
    analytics_enabled: data.analytics_enabled ?? true,
  };
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Save analytics project ID (client-safe field).
 * Does not handle API key — use saveAnalyticsApiKey for that.
 */
export async function saveAnalyticsConfig(
  projectId: string,
  config: { posthog_project_id: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ posthog_project_id: config.posthog_project_id })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Toggle analytics enabled/disabled state.
 */
export async function toggleAnalyticsEnabled(
  projectId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ analytics_enabled: enabled })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Save PostHog API key via Supabase Edge Function (server-side only).
 * The function saves the key to the projects table without returning it.
 */
export async function saveAnalyticsApiKey(
  projectId: string,
  apiKey: string
): Promise<void> {
  const { error } = await supabase.functions.invoke('save-posthog-key', {
    body: {
      project_id: projectId,
      api_key: apiKey,
    },
  });

  if (error) throw error;
}
