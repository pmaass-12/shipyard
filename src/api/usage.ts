/**
 * Token Usage / Cost Dashboard API — Build 023
 *
 * Tracks and analyzes token usage across all features in a project.
 * Cost calculations are client-side using static model pricing.
 * Budget tracking: UI-only banners (no push notifications).
 */

import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────

export interface TokenUsageRow {
  project_id: string;
  feature_id: string;
  feature_name: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  models_used: string; // comma-separated model names
  last_generated_at: string;
  generation_count: number;
}

export interface TokenUsageByModel {
  project_id: string;
  model: string;
  total_input_tokens: number;
  total_output_tokens: number;
}

export type BudgetStatus = 'ok' | 'warning' | 'over';

// ── Model pricing (USD per 1M tokens) ──────────────────────────────────────

export const MODEL_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
};

// ── Cost calculation helpers ──────────────────────────────────────────────

/**
 * Calculate cost in USD for a single model + token pair.
 */
export function calculateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING_USD_PER_1M[model];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Calculate total cost for all models in a token usage breakdown.
 */
export function totalCostUsd(rows: TokenUsageByModel[]): number {
  return rows.reduce((sum, row) => {
    return sum + calculateCostUsd(row.model, row.total_input_tokens, row.total_output_tokens);
  }, 0);
}

/**
 * Derive budget status based on current cost and monthly budget.
 * Parameters in cents (e.g., 1247 = $12.47).
 */
export function deriveBudgetStatus(currentCostCents: number, budgetCents: number | null): BudgetStatus {
  if (!budgetCents || budgetCents <= 0) return 'ok';
  const percentUsed = (currentCostCents / budgetCents) * 100;
  if (percentUsed >= 100) return 'over';
  if (percentUsed >= 80) return 'warning';
  return 'ok';
}

// ── API functions ─────────────────────────────────────────────────────────

/**
 * Fetch token usage aggregated by feature.
 * Returns one row per feature with total input/output tokens and models used.
 */
export async function getProjectTokenUsage(projectId: string): Promise<TokenUsageRow[]> {
  const { data, error } = await supabase
    .from('project_token_usage')
    .select('*')
    .eq('project_id', projectId);

  if (error) throw error;
  return data as TokenUsageRow[];
}

/**
 * Fetch token usage aggregated by model.
 * Returns one row per model with total input/output tokens.
 */
export async function getTokenUsageByModel(projectId: string): Promise<TokenUsageByModel[]> {
  const { data, error } = await supabase
    .from('project_token_usage_by_model')
    .select('*')
    .eq('project_id', projectId);

  if (error) throw error;
  return data as TokenUsageByModel[];
}

/**
 * Set or update the monthly budget for a project (in USD).
 * Converts to cents for storage.
 * Pass null to remove the budget limit.
 */
export async function setMonthlyBudget(projectId: string, budgetUsd: number | null): Promise<void> {
  const budgetCents = budgetUsd !== null ? Math.round(budgetUsd * 100) : null;
  const { error } = await supabase
    .from('projects')
    .update({ monthly_budget_cents: budgetCents })
    .eq('id', projectId);

  if (error) throw error;
}
