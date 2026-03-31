/**
 * GithubScreen — Build 021
 *
 * Route: /projects/:id/github
 *
 * Manage GitHub integration:
 *   - OAuth connection status
 *   - Per-project repo config (repo name + default branch)
 *   - Deploy history with Netlify status badges
 *
 * OAuth flow: "Connect GitHub" button redirects to /auth/github?project_id={id}
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getGithubConfig,
  saveGithubRepoConfig,
  disconnectGithub,
  getDeployHistory,
  deriveGithubRepoUrl,
  deriveCommitUrl,
  shortSha,
  type GithubConfig,
  type DeployHistoryRow,
} from '@/api/github';
import { useToast } from '@/context/ToastContext';

// ── Design tokens ─────────────────────────────────────────────────────────

const T = {
  bg: '#0f0f10',
  surface: '#1a1a1c',
  surface2: '#222224',
  surface3: '#2c2c2e',
  border: '#2c2c2e',
  text: '#e8e8ea',
  text2: '#8e8e93',
  accent: '#0a84ff',
  green: '#30d158',
  red: '#ff453a',
  orange: '#ff9f0a',
};

export default function GithubScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [config, setConfig] = useState<GithubConfig | null>(null);
  const [deployHistory, setDeployHistory] = useState<DeployHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ repo: '', branch: '' });
  const [saving, setSaving] = useState(false);

  // Load config and deploy history on mount
  useEffect(() => {
    async function init() {
      if (!projectId) return;
      try {
        const [configData, historyData] = await Promise.all([
          getGithubConfig(projectId),
          getDeployHistory(projectId),
        ]);
        setConfig(configData);
        setDeployHistory(historyData);
        setFormData({
          repo: configData.github_repo || '',
          branch: configData.github_default_branch || 'main',
        });
      } catch (err) {
        console.error('Failed to load GitHub config:', err);
        showToast('Failed to load GitHub settings', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId, showToast]);

  const handleConnect = () => {
    if (!projectId) return;
    window.location.href = `/auth/github?project_id=${projectId}`;
  };

  const handleDisconnect = async () => {
    if (!projectId || !config) return;
    if (!confirm('Disconnect GitHub from this project?')) return;
    try {
      await disconnectGithub(projectId);
      setConfig({
        github_username: null,
        github_repo: null,
        github_default_branch: 'main',
        github_connected_at: null,
      });
      setEditMode(false);
      showToast('GitHub disconnected', 'success');
    } catch (err) {
      console.error('Failed to disconnect GitHub:', err);
      showToast('Failed to disconnect GitHub', 'error');
    }
  };

  const handleSaveConfig = async () => {
    if (!projectId || !formData.repo || !formData.branch) return;
    setSaving(true);
    try {
      await saveGithubRepoConfig(projectId, {
        github_repo: formData.repo,
        github_default_branch: formData.branch,
      });
      if (config) {
        setConfig({ ...config, github_repo: formData.repo, github_default_branch: formData.branch });
      }
      setEditMode(false);
      showToast('GitHub config saved', 'success');
    } catch (err) {
      console.error('Failed to save GitHub config:', err);
      showToast('Failed to save GitHub config', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', color: T.text }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
          GitHub Integration
        </div>
        <div style={{ color: T.text2 }}>Loading...</div>
      </div>
    );
  }

  const repoUrl = config ? deriveGithubRepoUrl(config) : null;
  const isConnected = !!config?.github_connected_at;

  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: T.text }}>
            GitHub Integration
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '0 8px',
              paddingTop: '4px', paddingBottom: '4px',
              backgroundColor: isConnected ? T.green : T.surface3,
              color: isConnected ? '#000' : T.text2,
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
            }}
            data-testid="github-connection-status"
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Connected State */}
      {isConnected && config?.github_connected_at && (
        <div style={{ marginBottom: '32px' }}>
          {/* Connection Info Card */}
          <div
            style={{
              backgroundColor: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: T.text2, marginBottom: '4px' }}>
                GitHub Repository
              </div>
              <div style={{ fontSize: '16px', fontWeight: '500', color: T.text }}>
                <span data-testid="github-username">{config.github_username}</span>
                {config.github_repo && <span data-testid="github-repo-display">/{config.github_repo}</span>}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: T.text2, marginBottom: '4px' }}>
                Default Branch
              </div>
              <div style={{ fontSize: '16px', fontWeight: '500', color: T.text }}>
                {config.github_default_branch}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: T.text2, marginBottom: '4px' }}>
                Connected
              </div>
              <div style={{ fontSize: '14px', color: T.text2 }}>
                {new Date(config.github_connected_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setEditMode(!editMode)}
              style={{
                padding: '10px 16px',
                backgroundColor: T.surface2,
                color: T.text,
                border: `1px solid ${T.border}`,
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              {editMode ? 'Cancel' : 'Edit Repository'}
            </button>
            <button
              onClick={handleDisconnect}
              style={{
                padding: '10px 16px',
                backgroundColor: T.red,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
              data-testid="github-disconnect-btn"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editMode && isConnected && (
        <div
          style={{
            backgroundColor: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '32px',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: T.text, fontWeight: '500' }}>
              Repository Name
            </label>
            <input
              type="text"
              value={formData.repo}
              onChange={(e) => setFormData({ ...formData, repo: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: T.surface2,
                color: T.text,
                border: `1px solid ${T.border}`,
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              data-testid="github-repo-input"
              placeholder="e.g., my-repo"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: T.text, fontWeight: '500' }}>
              Default Branch
            </label>
            <input
              type="text"
              value={formData.branch}
              onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: T.surface2,
                color: T.text,
                border: `1px solid ${T.border}`,
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              data-testid="github-branch-input"
              placeholder="e.g., main"
            />
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            style={{
              padding: '10px 16px',
              backgroundColor: T.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
            data-testid="save-github-config-btn"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      )}

      {/* Disconnected State */}
      {!isConnected && (
        <div
          style={{
            backgroundColor: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: '8px',
            padding: '32px',
            textAlign: 'center',
            marginBottom: '32px',
          }}
        >
          <div style={{ fontSize: '16px', color: T.text, marginBottom: '16px' }}>
            Connect your GitHub repository to enable deploy tracking
          </div>
          <button
            onClick={handleConnect}
            style={{
              padding: '10px 24px',
              backgroundColor: T.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
            data-testid="github-connect-btn"
          >
            Connect GitHub
          </button>
        </div>
      )}

      {/* Deploy History Section */}
      <div>
        <div style={{ fontSize: '16px', fontWeight: '600', color: T.text, marginBottom: '16px' }}>
          Deploy History
        </div>

        {deployHistory.length === 0 ? (
          <div
            style={{
              backgroundColor: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              color: T.text2,
            }}
            data-testid="deploy-history-empty"
          >
            No deploys yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="deploy-history-list">
            {deployHistory.map((row, idx) => {
              const commitUrl = config ? deriveCommitUrl(config, row.commit_sha) : null;
              const statusColor =
                row.netlify_deploy_status === 'deployed'
                  ? T.green
                  : row.netlify_deploy_status === 'failed'
                    ? T.red
                    : row.netlify_deploy_status === 'deploying'
                      ? T.orange
                      : T.text2;

              return (
                <div
                  key={row.id}
                  style={{
                    backgroundColor: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                  }}
                  data-testid={`deploy-row-${idx}`}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                      {commitUrl ? (
                        <a
                          href={commitUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: T.accent, textDecoration: 'none', fontWeight: '500' }}
                          data-testid={`deploy-sha-${idx}`}
                        >
                          {shortSha(row.commit_sha)}
                        </a>
                      ) : (
                        <span style={{ color: T.text2, fontWeight: '500' }} data-testid={`deploy-sha-${idx}`}>
                          {shortSha(row.commit_sha)}
                        </span>
                      )}
                      {row.branch && (
                        <span
                          style={{
                            backgroundColor: T.surface2,
                            padding: '2px 8px',
                            borderRadius: '3px',
                            fontSize: '12px',
                            color: T.text2,
                          }}
                        >
                          {row.branch}
                        </span>
                      )}
                    </div>
                    <div style={{ color: T.text, marginBottom: '4px' }} data-testid={`deploy-message-${idx}`}>
                      {row.commit_message}
                    </div>
                    <div style={{ color: T.text2, fontSize: '12px' }}>
                      {new Date(row.pushed_at).toLocaleDateString()} at{' '}
                      {new Date(row.pushed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {row.netlify_deploy_status && (
                    <div
                      style={{
                        marginLeft: '12px',
                        padding: '0 8px',
                        paddingTop: '4px', paddingBottom: '4px',
                        backgroundColor: statusColor,
                        color: row.netlify_deploy_status === 'deployed' ? '#000' : '#fff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                      }}
                      data-testid={`deploy-netlify-status-${idx}`}
                    >
                      {row.netlify_deploy_status}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
