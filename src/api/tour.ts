/**
 * Tour API — src/api/tour.ts
 *
 * All Supabase calls for the Onboarding Tour domain (Build 008).
 * Tour steps are read by the deployed app via the Edge Function (no direct
 * Supabase client access). The Admin Console reads + edits via this client.
 */

import { supabase } from '@/lib/supabase';
import type { TourStep } from '@/types/db';

// ── Query: List tour steps for Admin Console ───────────────────────────────

export async function listTourSteps(projectId: string): Promise<TourStep[]> {
  const { data, error } = await supabase
    .from('tour_steps')
    .select('*')
    .eq('project_id', projectId)
    .order('step_order', { ascending: true });

  if (error) throw error;
  return data as TourStep[];
}

// ── Query: Check if the current user has seen the tour ────────────────────

export async function getTourSeenAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('tour_seen_at')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return (data as { tour_seen_at: string | null }).tour_seen_at;
}

// ── Mutation: Mark tour as seen (suppress future auto-launch) ─────────────

export async function markTourSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ tour_seen_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}

// ── Mutation: Edit a tour step (Admin Console + ?tour_preview=true) ───────

export async function updateTourStep(
  stepId: string,
  patch: { title?: string; description?: string }
): Promise<TourStep> {
  const { data, error } = await supabase
    .from('tour_steps')
    .update(patch)
    .eq('id', stepId)
    .select()
    .single();

  if (error) throw error;
  return data as TourStep;
}
