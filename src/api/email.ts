/**
 * Transactional Email API — Build 019
 *
 * Email template management via Resend integration.
 * API key saved through Edge Function; never returned to client.
 * Three template types: welcome, waitlist_confirmation, waitlist_approval.
 *
 * Contract: contracts/019-transactional-email-READY.md
 */

import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export type EmailTemplateType = 'welcome' | 'waitlist_confirmation' | 'waitlist_approval';
export type EmailTemplateStatus = 'active' | 'disabled';

export interface EmailTemplate {
  id: string;
  project_id: string;
  template_type: EmailTemplateType;
  subject: string;
  greeting: string | null;
  body: string;
  cta_text: string | null;
  cta_url: string | null;
  status: EmailTemplateStatus;
  generated_at: string | null;
  updated_at: string;
}

export interface EmailSenderConfig {
  resend_from_name: string | null;
  resend_from_email: string | null;
}

export type EmailConnectionStatus = 'connected' | 'disconnected';

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch sender config (from name + from email).
 * resend_api_key is never returned to client.
 */
export async function getEmailSenderConfig(
  projectId: string
): Promise<EmailSenderConfig> {
  const { data, error } = await supabase
    .from('projects')
    .select('resend_from_name, resend_from_email')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw error;
  return {
    resend_from_name: data?.resend_from_name ?? null,
    resend_from_email: data?.resend_from_email ?? null,
  };
}

/**
 * Fetch all email templates for a project.
 */
export async function getEmailTemplates(
  projectId: string
): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('project_id', projectId)
    .order('template_type');

  if (error) throw error;
  return (data ?? []) as EmailTemplate[];
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Update sender config (from name + from email).
 */
export async function saveEmailSenderConfig(
  projectId: string,
  config: EmailSenderConfig
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      resend_from_name: config.resend_from_name,
      resend_from_email: config.resend_from_email,
    })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Save Resend API key via Edge Function (save-resend-key).
 * The key is hashed and stored securely server-side, never returned to client.
 */
export async function saveResendApiKey(
  projectId: string,
  apiKey: string
): Promise<void> {
  const { error } = await supabase.functions.invoke('save-resend-key', {
    body: { project_id: projectId, api_key: apiKey },
  });

  if (error) throw error;
}

/**
 * Update a single email template.
 */
export async function updateEmailTemplate(
  templateId: string,
  patch: Partial<Omit<EmailTemplate, 'id' | 'project_id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update(patch)
    .eq('id', templateId);

  if (error) throw error;
}

/**
 * Toggle template status (active <-> disabled).
 */
export async function toggleTemplateStatus(
  templateId: string,
  status: EmailTemplateStatus
): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update({ status })
    .eq('id', templateId);

  if (error) throw error;
}

/**
 * Generate or regenerate all templates via Edge Function (generate-email-templates).
 * Uses AI to create welcome, waitlist_confirmation, and waitlist_approval templates.
 */
export async function generateEmailTemplates(projectId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('generate-email-templates', {
    body: { project_id: projectId },
  });

  if (error) throw error;
}
