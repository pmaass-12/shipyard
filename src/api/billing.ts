/**
 * Billing / Monetization API — Build 020
 *
 * Stripe integration for subscription and one-time billing.
 * stripe_webhook_secret is server-side only, never returned to client.
 * stripe_publishable_key is safe to return (starts with pk_test_ or pk_live_).
 * Plans support newline-separated features list.
 *
 * Contract: contracts/020-billing-monetization-READY.md
 */

import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export type BillingModel = 'subscription' | 'one_time';
export type StripeMode = 'test' | 'live' | 'unknown';

export interface BillingConfig {
  billing_enabled: boolean;
  billing_model: BillingModel | null;
  stripe_publishable_key: string | null;
}

export interface BillingPlan {
  id: string;
  project_id: string;
  plan_name: string;
  stripe_price_id: string | null;
  monthly_price_cents: number | null;
  features: string | null;  // newline-separated TEXT
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Utilities ──────────────────────────────────────────────────────────────

/**
 * Detect Stripe mode from publishable key.
 */
export function detectStripeMode(key: string | null | undefined): StripeMode {
  if (!key) return 'unknown';
  if (key.startsWith('pk_test_')) return 'test';
  if (key.startsWith('pk_live_')) return 'live';
  return 'unknown';
}

/**
 * Split features string (newline-separated) into array.
 */
export function parseFeatures(featuresText: string | null): string[] {
  if (!featuresText) return [];
  return featuresText
    .split('\n')
    .map(f => f.trim())
    .filter(f => f.length > 0);
}

/**
 * Join features array into newline-separated string.
 */
export function stringifyFeatures(features: string[]): string {
  return features.filter(f => f.trim().length > 0).join('\n');
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch billing configuration for a project.
 * stripe_webhook_secret is NOT selected (server-side only).
 */
export async function getBillingConfig(projectId: string): Promise<BillingConfig> {
  const { data, error } = await supabase
    .from('projects')
    .select('billing_enabled, billing_model, stripe_publishable_key')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw error;
  return {
    billing_enabled: data?.billing_enabled ?? false,
    billing_model: data?.billing_model ?? null,
    stripe_publishable_key: data?.stripe_publishable_key ?? null,
  };
}

/**
 * Fetch all billing plans for a project, ordered by sort_order.
 */
export async function getBillingPlans(projectId: string): Promise<BillingPlan[]> {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as BillingPlan[];
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Enable billing and set the model (subscription or one_time).
 */
export async function enableBilling(projectId: string, model: BillingModel): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      billing_enabled: true,
      billing_model: model,
    })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Update billing configuration (partial update).
 */
export async function saveBillingConfig(
  projectId: string,
  patch: Partial<BillingConfig>
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Save Stripe publishable key (safe to store, starts with pk_test_ or pk_live_).
 */
export async function saveStripePublishableKey(
  projectId: string,
  key: string
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ stripe_publishable_key: key.trim() || null })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Save Stripe webhook secret (server-side only, never return to client).
 * In production, this should be saved via a server-side Edge Function.
 * For now, direct update is acceptable but treat as sensitive.
 */
export async function saveStripeWebhookSecret(
  projectId: string,
  secret: string
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ stripe_webhook_secret: secret.trim() || null })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Create a new billing plan.
 */
export async function createBillingPlan(
  plan: Omit<BillingPlan, 'id' | 'created_at' | 'updated_at'>
): Promise<BillingPlan> {
  const { data, error } = await supabase
    .from('billing_plans')
    .insert([plan])
    .select()
    .single();

  if (error) throw error;
  return data as BillingPlan;
}

/**
 * Update a billing plan (partial).
 */
export async function updateBillingPlan(
  planId: string,
  patch: Partial<Omit<BillingPlan, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('billing_plans')
    .update(patch)
    .eq('id', planId);

  if (error) throw error;
}

/**
 * Delete a billing plan.
 */
export async function deleteBillingPlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from('billing_plans')
    .delete()
    .eq('id', planId);

  if (error) throw error;
}
