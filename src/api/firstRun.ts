/**
 * First-Run API — Build 044
 *
 * Helpers for detecting and completing first-run mode on a project.
 * A project is in first-run mode when ALL of the following are true:
 *   - created_at > NOW() - INTERVAL '24 hours'
 *   - 0 features exist
 *   - 0 screens exist
 *   - first_run_completed_at IS NULL
 *
 * data-testid inventory: n/a — pure API helpers
 */

import { supabase } from '@/lib/supabase';
import type { Project } from '@/types/db';

// ── First-run detection ────────────────────────────────────────────────────

/**
 * Determine whether a project is currently in first-run mode.
 * Called client-side after project + stats are loaded.
 */
export function isFirstRunMode(
  project: Project,
  featureCount: number,
  screenCount:  number
): boolean {
  if (project.first_run_completed_at) return false;

  const createdAt   = new Date(project.created_at).getTime();
  const twentyFourH = 24 * 60 * 60 * 1000;
  const isNew       = Date.now() - createdAt < twentyFourH;

  return isNew && featureCount === 0 && screenCount === 0;
}

// ── Complete first-run ─────────────────────────────────────────────────────

/**
 * Mark first-run as complete by setting first_run_completed_at = NOW().
 * Called when: user dismisses greeting card, OR first design generation completes.
 */
export async function completeFirstRun(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ first_run_completed_at: new Date().toISOString() })
    .eq('id', projectId);

  if (error) throw error;
}

// ── Auto-create feature from first message ─────────────────────────────────

/**
 * Extract a feature name from a free-text message using a simple heuristic.
 * Takes the first sentence (up to ~60 chars) as the feature name.
 */
export function extractFeatureName(message: string): string {
  const firstSentence = message.split(/[.!?]/)[0]?.trim() ?? message;
  const truncated     = firstSentence.length > 60
    ? firstSentence.slice(0, 57) + '…'
    : firstSentence;
  // Capitalise
  return truncated.charAt(0).toUpperCase() + truncated.slice(1);
}

/**
 * Auto-create a screen (if none exists) and a feature from the first-run message.
 * Returns the created feature ID.
 */
export async function autoCreateFeatureFromMessage(
  projectId:   string,
  message:     string
): Promise<{ featureId: string; screenId: string }> {
  const featureName = extractFeatureName(message);

  // Create the screen first
  const { data: screen, error: screenError } = await supabase
    .from('screens')
    .insert({
      project_id: projectId,
      name:       featureName,
      description: `Auto-created screen for: ${featureName}`,
    })
    .select()
    .single();

  if (screenError || !screen) throw screenError ?? new Error('Failed to create screen');

  // Create the feature under that screen
  const { data: feature, error: featureError } = await supabase
    .from('features')
    .insert({
      project_id:  projectId,
      screen_id:   screen.id,
      name:        featureName,
      description: message.slice(0, 500),
      status:      'in_progress',
      complexity:  'medium',
    })
    .select()
    .single();

  if (featureError || !feature) throw featureError ?? new Error('Failed to create feature');

  return { featureId: feature.id, screenId: screen.id };
}

// ── Kick off design generation ─────────────────────────────────────────────

/**
 * Trigger design generation for a feature via Edge Function.
 * Fire-and-forget; the pipeline runs in the background.
 */
export async function kickOffDesignGeneration(
  featureId: string
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch('/functions/v1/generate-design-step', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ feature_id: featureId }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`Design generation kick-off failed (${res.status}): ${body}`);
    // Non-fatal — pipeline can be triggered manually
  }
}
