/**
 * Feature Workflow API — Build 016
 *
 * 5-step linear feature workflow: Design → Schema → Code → Deploy → QA.
 * Persistent Claude chat sidebar per step.
 */

import { supabase } from '@/lib/supabase';
import type {
  Feature,
  FeatureStep,
  FeatureIteration,
  FeatureChatMessage,
  HumanTask,
  FeatureStepStatus,
} from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/** Load feature row + all 5 steps in parallel */
export async function getFeatureWithSteps(featureId: string): Promise<{
  feature: Feature;
  steps:   FeatureStep[];
}> {
  const [featureRes, stepsRes] = await Promise.all([
    supabase.from('features').select('*').eq('id', featureId).single(),
    supabase
      .from('feature_steps')
      .select('*')
      .eq('feature_id', featureId)
      .order('step_number'),
  ]);

  if (featureRes.error) throw featureRes.error;
  if (stepsRes.error)   throw stepsRes.error;

  return { feature: featureRes.data as Feature, steps: stepsRes.data as FeatureStep[] };
}

/** Pending human tasks for the active step amber banner */
export async function getPendingTasksForStep(featureStepId: string): Promise<HumanTask[]> {
  const { data, error } = await supabase
    .from('human_tasks')
    .select('*')
    .eq('feature_step_id', featureStepId)
    .eq('status', 'pending')
    .order('priority')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as HumanTask[];
}

/** Iteration history for a step (collapsed by default in UI) */
export async function getStepIterations(featureStepId: string): Promise<FeatureIteration[]> {
  const { data, error } = await supabase
    .from('feature_iterations')
    .select('*')
    .eq('feature_step_id', featureStepId)
    .order('iteration_number');
  if (error) throw error;
  return (data ?? []) as FeatureIteration[];
}

/** Chat thread for one step tab */
export async function getChatThread(
  featureId:  string,
  stepNumber: 1 | 2 | 3 | 4 | 5
): Promise<FeatureChatMessage[]> {
  const { data, error } = await supabase
    .from('feature_chat_messages')
    .select('*')
    .eq('feature_id', featureId)
    .eq('step_number', stepNumber)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as FeatureChatMessage[];
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** Approve a step — DB trigger handles: approve_at, activating next step, workflow_step sync, task dismissal */
export async function approveStep(stepId: string, approvedBy: string): Promise<void> {
  const { error } = await supabase
    .from('feature_steps')
    .update({
      status:      'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(), // also set by trigger for optimistic UI
    })
    .eq('id', stepId);
  if (error) throw error;
}

/** Request changes — marks step as changes_requested + inserts iteration row */
export async function requestChanges(
  stepId:     string,
  changeNote: string
): Promise<FeatureIteration> {
  // a) Update step status
  const { error: stepErr } = await supabase
    .from('feature_steps')
    .update({ status: 'changes_requested' })
    .eq('id', stepId);
  if (stepErr) throw stepErr;

  // b) Get next iteration number
  const { count } = await supabase
    .from('feature_iterations')
    .select('id', { count: 'exact', head: true })
    .eq('feature_step_id', stepId);

  const nextNumber = (count ?? 0) + 1;

  // c) Insert iteration
  const { data, error: iterErr } = await supabase
    .from('feature_iterations')
    .insert({
      feature_step_id:  stepId,
      iteration_number: nextNumber,
      change_note:      changeNote,
    })
    .select('*')
    .single();
  if (iterErr) throw iterErr;

  return data as FeatureIteration;
}

/** Edit step content directly (e.g. fixing the spec or SQL inline) */
export async function updateStepContent(
  stepId:  string,
  content: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('feature_steps')
    .update({ content })
    .eq('id', stepId);
  if (error) throw error;
}

/** Insert a user chat message then stream Claude's response */
export async function sendChatMessage(
  featureId:  string,
  stepNumber: 1 | 2 | 3 | 4 | 5,
  content:    string,
  sessionToken: string,
  onChunk:    (chunk: string) => void,
  onDone:     (fullResponse: string) => void
): Promise<void> {
  // Insert user message
  const { error: insertErr } = await supabase
    .from('feature_chat_messages')
    .insert({ feature_id: featureId, step_number: stepNumber, role: 'user', content });
  if (insertErr) throw insertErr;

  // Stream assistant response from Edge Function
  const response = await fetch('/api/feature-chat', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ feature_id: featureId, step_number: stepNumber }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let full      = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk  = decoder.decode(value);
    full        += chunk;
    onChunk(chunk);
  }

  onDone(full);
}

// ── Step render state helper ───────────────────────────────────────────────

export function getStepRenderState(step: FeatureStep): 'approved' | 'active' | 'locked' {
  if (step.status === 'approved') return 'approved';
  if (step.status === 'active' || step.status === 'changes_requested') return 'active';
  return 'locked';
}

// ── Type guards for step content ───────────────────────────────────────────

export function isDesignContent(content: unknown): content is { spec_text: string } {
  return typeof content === 'object' && content !== null && 'spec_text' in content;
}

export function isSchemaContent(content: unknown): content is { sql: string; migration_run: boolean } {
  return typeof content === 'object' && content !== null && 'sql' in content;
}

export function isCodeContent(content: unknown): content is { files: Array<{ name: string; content: string; line_count: number }> } {
  return typeof content === 'object' && content !== null && 'files' in content;
}

export function isDeployContent(content: unknown): content is { github_pr_url: string | null; netlify_deploy_url: string | null } {
  return typeof content === 'object' && content !== null && 'github_pr_url' in content;
}

export function isQaContent(content: unknown): content is { test_notes: string | null; sign_off_by: string | null } {
  return typeof content === 'object' && content !== null && 'test_notes' in content;
}
