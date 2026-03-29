/**
 * Features API — src/api/features.ts
 *
 * All Supabase calls for the Features domain.
 * Build 006 adds: maturity column, maturity filter, phase-aware feature creation.
 */

import { supabase } from '@/lib/supabase';
import type {
  Feature,
  FeatureMaturity,
  FeatureComplexity,
  ProjectPhase,
} from '@/types/db';

// ── Map project phase → default feature maturity ──────────────────────────

const PHASE_TO_MATURITY: Record<ProjectPhase, FeatureMaturity> = {
  alpha: 'alpha',
  beta:  'beta',
  live:  'production',
};

// ── Query: List features with optional maturity filter ────────────────────

export async function listFeatures(
  screenId: string,
  maturityFilter?: FeatureMaturity | 'all'
): Promise<Feature[]> {
  let query = supabase
    .from('features')
    .select('*')
    .eq('screen_id', screenId)
    .order('created_at', { ascending: true });

  if (maturityFilter && maturityFilter !== 'all') {
    query = query.eq('maturity', maturityFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Feature[];
}

// ── Mutation: Create feature (maturity derived from project phase) ─────────

export async function createFeature(input: {
  screen_id:    string;
  name:         string;
  description?: string | null;
  complexity:   FeatureComplexity;
  project_id:   string;  // used to resolve current phase
}): Promise<Feature> {
  // Resolve the project's current phase to set the default maturity.
  // 'live' → 'production', 'alpha' → 'alpha', 'beta' → 'beta'
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('phase')
    .eq('id', input.project_id)
    .single();

  if (projectError || !project) throw new Error('Project not found');

  const maturity = PHASE_TO_MATURITY[project.phase as ProjectPhase] ?? 'alpha';

  const { data, error } = await supabase
    .from('features')
    .insert({
      screen_id:   input.screen_id,
      name:        input.name,
      description: input.description ?? null,
      complexity:  input.complexity,
      status:      'design',
      maturity,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Feature;
}

// ── Mutation: Update feature maturity (manual badge change) ───────────────

/**
 * Optimistically update the feature maturity badge.
 * Caller is responsible for reverting on error.
 */
export async function updateFeatureMaturity(
  featureId: string,
  maturity: FeatureMaturity
): Promise<Feature> {
  const { data, error } = await supabase
    .from('features')
    .update({ maturity })
    .eq('id', featureId)
    .select()
    .single();

  if (error) throw error;
  return data as Feature;
}
