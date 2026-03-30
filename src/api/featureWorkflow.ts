/**
 * Feature Workflow API — Build 033
 *
 * 6-step pipeline: Design → Schema → Code → Preview → QA → Live.
 * Chat is Design-step only. Single approval gate: Design approval
 * unlocks the remaining steps. Output stored as TEXT per step.
 */

import { supabase } from '@/lib/supabase';
import type {
  Feature,
  FeatureStep,
  FeatureChatMessage,
  FeatureStepName,
  HumanTask,
} from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/** Load feature row + all 6 steps in parallel */
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

/** Steps keyed by step_name for convenient tab lookup */
export function indexStepsByName(steps: FeatureStep[]): Record<FeatureStepName, FeatureStep | undefined> {
  return steps.reduce((acc, step) => {
    acc[step.step_name] = step;
    return acc;
  }, {} as Record<FeatureStepName, FeatureStep | undefined>);
}

/** Pending human tasks for a step — shown in amber banner */
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

/** Chat thread — Design step only (step_number=1), but accepts any step for flexibility */
export async function getChatThread(
  featureId:  string,
  stepNumber: 1 | 2 | 3 | 4 | 5 | 6 = 1
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

/**
 * Approve the Design step — single gate that unlocks the full pipeline.
 * DB trigger handles: approved_at, advancing pipeline_step on the feature,
 * unlocking step 2 (schema), and dismissing any pending design tasks.
 */
export async function approveDesign(stepId: string, approvedBy: string): Promise<void> {
  const { error } = await supabase
    .from('feature_steps')
    .update({
      status:      'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', stepId);
  if (error) throw error;
}

/**
 * Save the text output for a step (spec, SQL, generated code, QA notes, etc.)
 * Can be called at any time during in_progress; does NOT change step status.
 */
export async function updateStepOutput(stepId: string, output: string): Promise<void> {
  const { error } = await supabase
    .from('feature_steps')
    .update({ output })
    .eq('id', stepId);
  if (error) throw error;
}

/**
 * Mark a step in_progress (e.g. when user starts editing output).
 * Only transitions from not_started → in_progress; locked steps are immutable.
 */
export async function startStep(stepId: string): Promise<void> {
  const { error } = await supabase
    .from('feature_steps')
    .update({ status: 'in_progress' })
    .eq('id', stepId)
    .eq('status', 'not_started');   // guard: only move forward from not_started
  if (error) throw error;
}

/**
 * Approve any non-design step (Schema, Code, Preview, QA, Live).
 * These don't unlock the next step automatically — pipeline is manual after Design.
 */
export async function approveStep(stepId: string, approvedBy: string): Promise<void> {
  const { error } = await supabase
    .from('feature_steps')
    .update({
      status:      'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', stepId);
  if (error) throw error;
}

/**
 * Send a user message and stream Claude's response.
 * Only valid for Design step (step_number=1) — chat is Design-only per Build 033.
 */
export async function sendChatMessage(
  featureId:    string,
  stepNumber:   1 | 2 | 3 | 4 | 5 | 6,
  content:      string,
  sessionToken: string,
  onChunk:      (chunk: string) => void,
  onDone:       (fullResponse: string) => void
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

// ── Build 043: Cancel feature + system memory write ─────────────────────────────────

/**
 * Cancel a feature — sets lifecycle to 'cancelled' and writes a system
 * memory fact so Morgan can answer "why did we cancel X?" in future sessions.
 *
 * The memory INSERT uses the service-role via Edge Function to bypass RLS
 * (client cannot write source='system' facts directly).
 */
export async function cancelFeature(
  featureId:         string,
  projectId:         string,
  featureName:       string,
  cancellationReason?: string
): Promise<void> {
  const { error: updateErr } = await supabase
    .from('features')
    .update({ lifecycle: 'cancelled' })
    .eq('id', featureId);

  if (updateErr) throw updateErr;

  // Write system memory fact via Edge Function (service role — source='system')
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const reason = cancellationReason?.trim() || 'No reason recorded.';
    fetch('/functions/v1/write-system-memory-fact', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        project_id: projectId,
        title:      `Feature “${featureName}” cancelled`,
        body:       `Feature “${featureName}” was cancelled. Reason: ${reason}`,
        category:   'cancellation',
        feature_id: featureId,
      }),
    }).catch(() => { /* non-critical — memory write failure should not block UI */ });
  }
}

// ── Step render state helper ───────────────────────────────────────────────

/** Maps DB status to the UI render mode for a step tab */
export function getStepRenderState(
  step: FeatureStep
): 'approved' | 'active' | 'locked' | 'not_started' {
  if (step.status === 'approved')    return 'approved';
  if (step.status === 'in_progress') return 'active';
  if (step.status === 'locked')      return 'locked';
  return 'not_started';
}

/** True when the Design step is approved (gates the rest of the pipeline) */
export function isDesignApproved(steps: FeatureStep[]): boolean {
  return steps.find(s => s.step_name === 'design')?.status === 'approved';
}

/** True when all 6 steps are approved (feature is fully live) */
export function isPipelineComplete(steps: FeatureStep[]): boolean {
  return steps.length === 6 && steps.every(s => s.status === 'approved');
}
