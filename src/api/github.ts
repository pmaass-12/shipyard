/**
 * GitHub Integration API — Build 021
 *
 * Manages GitHub repo configuration and deploy history tracking.
 * Integrates with OAuth for GitHub connection.
 *
 * IMPORTANT: github_access_token is account-level (Build 038 account_connections table)
 * Projects table still has per-project repo config columns.
 */

import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────

export type NetlifyDeployStatus = 'pending' | 'deploying' | 'deployed' | 'failed';

export interface GithubConfig {
  github_username: string | null;
  github_repo: string | null;
  github_default_branch: string;
  github_connected_at: string | null;
}

export interface DeployHistoryRow {
  id: string;
  project_id: string;
  feature_id: string | null;
  commit_sha: string;
  commit_message: string;
  branch: string | null;
  pushed_at: string;
  netlify_deploy_id: string | null;
  netlify_deploy_status: NetlifyDeployStatus | null;
}

// ── Utility functions ─────────────────────────────────────────────────────

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function deriveGithubRepoUrl(config: GithubConfig): string | null {
  if (!config.github_username || !config.github_repo) return null;
  return `https://github.com/${config.github_username}/${config.github_repo}`;
}

export function deriveCommitUrl(config: GithubConfig, sha: string): string | null {
  const repoUrl = deriveGithubRepoUrl(config);
  if (!repoUrl) return null;
  return `${repoUrl}/commit/${sha}`;
}

// ── API functions ─────────────────────────────────────────────────────────

/**
 * Fetch GitHub config for a project.
 * Returns connected status, username, repo, branch, and connection date.
 */
export async function getGithubConfig(projectId: string): Promise<GithubConfig> {
  const { data, error } = await supabase
    .from('projects')
    .select('github_username, github_repo, github_default_branch, github_connected_at')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return {
    github_username: data.github_username,
    github_repo: data.github_repo,
    github_default_branch: data.github_default_branch || 'main',
    github_connected_at: data.github_connected_at,
  } as GithubConfig;
}

/**
 * Save per-project GitHub repo config (repo name + default branch).
 * Does NOT set github_connected_at — that's set by the OAuth callback server-side.
 */
export async function saveGithubRepoConfig(
  projectId: string,
  config: Pick<GithubConfig, 'github_repo' | 'github_default_branch'>
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      github_repo: config.github_repo,
      github_default_branch: config.github_default_branch,
    })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Disconnect GitHub from a project.
 * Clears username, repo, branch, and connection date.
 */
export async function disconnectGithub(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      github_username: null,
      github_repo: null,
      github_default_branch: 'main',
      github_connected_at: null,
    })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Fetch deploy history for a project, ordered by most recent first.
 * Limits to a specified number of rows (default 50).
 */
export async function getDeployHistory(
  projectId: string,
  limit: number = 50
): Promise<DeployHistoryRow[]> {
  const { data, error } = await supabase
    .from('deploy_history')
    .select('*')
    .eq('project_id', projectId)
    .order('pushed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as DeployHistoryRow[];
}
