/**
 * Deploy Setup API — Build 038
 *
 * Handles OAuth connections (GitHub/Netlify), deploy configuration,
 * and Supabase connection validation.
 */

import { supabase } from '@/lib/supabase';
import type { AccountConnection, DeployConfig } from '@/types/db';

/**
 * Fetch all OAuth account connections for the current user.
 * Intentionally excludes access_token for security.
 */
export async function getAccountConnections(): Promise<AccountConnection[]> {
  const { data, error } = await supabase
    .from('account_connections')
    .select('id, user_id, provider, account_name, account_avatar_url, connected_at')
    .order('provider', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch the deploy configuration for a project.
 * Returns partial config from project_settings table.
 */
export async function getDeployConfig(projectId: string): Promise<Partial<DeployConfig>> {
  const { data, error } = await supabase
    .from('project_settings')
    .select(
      'supabase_url, supabase_anon_key, netlify_site_id, ' +
      'netlify_site_url, netlify_build_command, netlify_publish_dir, netlify_node_version, ' +
      'deploy_status, last_deploy_at, last_deploy_error'
    )
    .eq('project_id', projectId)
    .single();

  if (error) throw error;
  return data as Partial<DeployConfig>;
}

/**
 * Save Supabase configuration to project_settings.
 */
export async function saveSupabaseConfig(
  projectId: string,
  config: { supabase_url: string; supabase_anon_key: string }
): Promise<void> {
  const { error } = await supabase
    .from('project_settings')
    .update({
      supabase_url: config.supabase_url,
      supabase_anon_key: config.supabase_anon_key,
    })
    .eq('project_id', projectId);

  if (error) throw error;
}

/**
 * Save Netlify configuration to project_settings.
 */
export async function saveNetlifyConfig(
  projectId: string,
  config: {
    netlify_site_id: string;
    netlify_site_url: string;
    netlify_build_command: string;
    netlify_publish_dir: string;
    netlify_node_version: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('project_settings')
    .update({
      netlify_site_id: config.netlify_site_id,
      netlify_site_url: config.netlify_site_url,
      netlify_build_command: config.netlify_build_command,
      netlify_publish_dir: config.netlify_publish_dir,
      netlify_node_version: config.netlify_node_version,
    })
    .eq('project_id', projectId);

  if (error) throw error;
}

/**
 * Validate Supabase connection by calling Edge Function.
 * Returns { valid: true } on success, or { valid: false, error } on failure.
 */
export async function validateSupabaseConnection(
  supabaseUrl: string,
  anonKey: string,
  sessionToken: string
): Promise<{ valid: boolean; error?: string }> {
  const response = await fetch('/functions/v1/validate-supabase-connection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      supabase_url: supabaseUrl,
      supabase_anon_key: anonKey,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return { valid: false, error: error.message || 'Validation failed' };
  }

  return response.json();
}

/**
 * Disconnect an OAuth provider (GitHub or Netlify).
 * Removes the account_connections row for the user.
 */
export async function disconnectProvider(provider: 'github' | 'netlify'): Promise<void> {
  const { error } = await supabase
    .from('account_connections')
    .delete()
    .eq('provider', provider);

  if (error) throw error;
}
