/**
 * DeploySetupScreen — Build 038
 *
 * Route: /projects/:id/deploy
 *
 * 4-screen deploy wizard:
 *   Screen 1 — GitHub connection (repo + branch selection)
 *   Screen 2 — Netlify site selector + build settings
 *   Screen 3 — Supabase URL + anon key (with inline validation)
 *   Screen 4 — Summary + Deploy button
 *
 * Handles:
 *   - GitHub OAuth: window.location.href to /api/github-oauth
 *   - Netlify OAuth: window.location.href to /api/netlify-oauth
 *   - Query params: ?connected=github or ?connected=netlify (show toast)
 *   - Supabase validation: calls validateSupabaseConnection on blur
 *   - Deploy: POST /functions/v1/trigger-deploy
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  getAccountConnections,
  getDeployConfig,
  saveSupabaseConfig,
  saveNetlifyConfig,
  validateSupabaseConnection,
} from '@/api/deploySetup';
import { useToast } from '@/context/ToastContext';
import type { AccountConnection, DeployConfig } from '@/types/db';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

// ── Design tokens ─────────────────────────────────────────────────────────

const T = {
  bg:        '#f5f5f7',
  surface:   '#fff',
  bg2:       '#f0f0f2',
  border:    'rgba(0,0,0,0.09)',
  text:      '#1c1c1e',
  text2:     '#6e6e73',
  text3:     '#8e8e93',
  accent:    '#5b5bd6',
  accent2:   '#7c7ce0',
  green:     '#30d158',
  warning:   '#ff9f0a',
  danger:    '#ff3b30',
};

type Screen = 1 | 2 | 3 | 4;

interface DeployState {
  githubConnected: boolean;
  githubRepo: string;
  githubBranch: string;
  netlifyConnected: boolean;
  netlifySiteId: string;
  netlifySiteUrl: string;
  netlifyBuildCommand: string;
  netlifyPublishDir: string;
  netlifyNodeVersion: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseValidStatus: 'unchecked' | 'checking' | 'valid' | 'invalid';
  supabaseError?: string;
}

export default function DeploySetupScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [currentScreen, setCurrentScreen] = useState<Screen>(1);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const sessionTokenRef = useRef<string>('');

  const [connections, setConnections] = useState<AccountConnection[]>([]);
  const [config, setConfig] = useState<Partial<DeployConfig>>({});

  const [state, setState] = useState<DeployState>({
    githubConnected: false,
    githubRepo: '',
    githubBranch: 'main',
    netlifyConnected: false,
    netlifySiteId: '',
    netlifySiteUrl: '',
    netlifyBuildCommand: 'npm run build',
    netlifyPublishDir: 'dist',
    netlifyNodeVersion: '18',
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseValidStatus: 'unchecked',
  });

  // Load initial data and handle OAuth callbacks
  useEffect(() => {
    async function init() {
      try {
        // Get session token for validation calls
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          sessionTokenRef.current = data.session.access_token;
        }

        // Fetch account connections
        const accts = await getAccountConnections();
        setConnections(accts);

        const githubConnected = accts.some(a => a.provider === 'github');
        const netlifyConnected = accts.some(a => a.provider === 'netlify');

        // Fetch deploy config
        if (projectId) {
          const cfg = await getDeployConfig(projectId);
          setConfig(cfg);

          setState(prev => ({
            ...prev,
            githubConnected,
            netlifyConnected,
            netlifySiteId: cfg.netlify_site_id || '',
            netlifySiteUrl: cfg.netlify_site_url || '',
            netlifyBuildCommand: cfg.netlify_build_command || 'npm run build',
            netlifyPublishDir: cfg.netlify_publish_dir || 'dist',
            netlifyNodeVersion: cfg.netlify_node_version || '18',
            supabaseUrl: cfg.supabase_url || '',
            supabaseAnonKey: cfg.supabase_anon_key || '',
            supabaseValidStatus:
              cfg.supabase_url && cfg.supabase_anon_key ? 'valid' : 'unchecked',
          }));
        }
      } catch (err) {
        console.error('Failed to load deploy config:', err);
        showToast('Failed to load deploy configuration', 'error');
      } finally {
        setLoading(false);
      }
    }

    init();

    // Check for OAuth callbacks
    const connected = searchParams.get('connected');
    if (connected === 'github') {
      showToast('GitHub connected successfully', 'success');
      // Reload connections
      getAccountConnections().then(setConnections);
    } else if (connected === 'netlify') {
      showToast('Netlify connected successfully', 'success');
      getAccountConnections().then(setConnections);
    }
  }, [projectId, showToast, searchParams]);

  // Handle Supabase validation on blur
  async function validateSupabase() {
    if (!state.supabaseUrl || !state.supabaseAnonKey) {
      setState(prev => ({ ...prev, supabaseValidStatus: 'unchecked' }));
      return;
    }

    setState(prev => ({ ...prev, supabaseValidStatus: 'checking' }));

    try {
      const result = await validateSupabaseConnection(
        state.supabaseUrl,
        state.supabaseAnonKey,
        sessionTokenRef.current
      );

      if (result.valid) {
        setState(prev => ({
          ...prev,
          supabaseValidStatus: 'valid',
          supabaseError: undefined,
        }));

        // Save config
        if (projectId) {
          await saveSupabaseConfig(projectId, {
            supabase_url: state.supabaseUrl,
            supabase_anon_key: state.supabaseAnonKey,
          });
        }
      } else {
        setState(prev => ({
          ...prev,
          supabaseValidStatus: 'invalid',
          supabaseError: result.error,
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        supabaseValidStatus: 'invalid',
        supabaseError: extractErrorMessage(err, 'Validation failed'),
      }));
    }
  }

  async function handleDeploy() {
    if (!projectId) return;

    setDeploying(true);
    try {
      // Save Netlify config first
      await saveNetlifyConfig(projectId, {
        netlify_site_id: state.netlifySiteId,
        netlify_site_url: state.netlifySiteUrl,
        netlify_build_command: state.netlifyBuildCommand,
        netlify_publish_dir: state.netlifyPublishDir,
        netlify_node_version: state.netlifyNodeVersion,
      });

      const response = await fetch('/functions/v1/trigger-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionTokenRef.current}`,
        },
        body: JSON.stringify({ project_id: projectId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Deploy failed');
      }

      showToast('Deploy started successfully', 'success');
      // Navigate to project hub
      navigate(`/projects/${projectId}`);
    } catch (err) {
      showToast(
        extractErrorMessage(err, 'Deploy failed'),
        'error'
      );
    } finally {
      setDeploying(false);
    }
  }

  const canContinue = {
    1: state.githubConnected && state.githubRepo,
    2: state.netlifyConnected && state.netlifySiteId,
    3: state.supabaseValidStatus === 'valid',
    4: true,
  };

  const showNextButton = currentScreen < 4;
  const showBackButton = currentScreen > 1;
  const showDeployButton = currentScreen === 4;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.topnav}>
          <div style={styles.logo}>⚓ Shipyard</div>
          <div style={{ flex: 1 }} />
          <div
            onClick={() => navigate(`/projects/${projectId}`)}
            style={styles.exit}
          >
            ✕ Save and exit
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, color: T.text2 }}>Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Topnav */}
      <div style={styles.topnav}>
        <div style={styles.logo}>⚓ Shipyard</div>
        <div style={{ flex: 1 }} />
        <div
          onClick={() => navigate(`/projects/${projectId}`)}
          style={styles.exit}
        >
          ✕ Save and exit
        </div>
      </div>

      {/* Wizard wrap */}
      <div style={styles.wizWrap}>
        <div style={styles.wizContent}>
          {/* Progress dots */}
          <div style={styles.progDots}>
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                style={{
                  ...styles.progDot,
                  background:
                    i < currentScreen ? T.accent :
                    i === currentScreen ? T.accent :
                    '#e5e5ea',
                  width: i === currentScreen ? 24 : 8,
                  borderRadius: i === currentScreen ? 4 : '50%',
                }}
              />
            ))}
          </div>

          {/* Screen 1: GitHub */}
          {currentScreen === 1 && (
            <div data-testid="deploy-screen-1">
              <div style={styles.eyebrow}>Step 1 of 4</div>
              <h1 style={styles.heading}>Where should we push your code?</h1>
              <p style={styles.sub}>
                Select a GitHub repository for your project. Shipyard will push code here whenever you deploy a feature.
              </p>

              {!state.githubConnected ? (
                <div style={styles.connectBanner}>
                  <div style={styles.bannerIcon}>🐙</div>
                  <div style={styles.bannerText}>
                    GitHub — not connected
                    <span style={styles.bannerSub}>
                      Connect your account to select or create a repository.
                    </span>
                  </div>
                  <button
                    data-testid="github-connect-btn"
                    onClick={() => window.location.href = '/api/github-oauth'}
                    style={styles.bannerBtn}
                  >
                    Connect GitHub →
                  </button>
                </div>
              ) : (
                <div data-testid="github-connected-indicator" style={styles.connectedBadge}>
                  <div style={styles.badgeAvatar}>G</div>
                  Connected as @{connections.find(a => a.provider === 'github')?.account_name || 'github'}
                  <span style={styles.badgeCheckmark}>via GitHub OAuth ✓</span>
                </div>
              )}

              {state.githubConnected && (
                <div style={{ marginTop: 20 }}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Repository</label>
                    <select
                      data-testid="github-repo-selector"
                      value={state.githubRepo}
                      onChange={e => setState(prev => ({ ...prev, githubRepo: e.target.value }))}
                      style={styles.fieldSelect}
                    >
                      <option value="">— Select a repository —</option>
                      <option value="new">── Create new repository ──</option>
                      <option value="taskflow-app">my-repo/taskflow-app (new)</option>
                      <option value="portfolio">my-repo/portfolio-site</option>
                    </select>
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Default branch</label>
                    <select
                      value={state.githubBranch}
                      onChange={e => setState(prev => ({ ...prev, githubBranch: e.target.value }))}
                      style={styles.fieldSelect}
                    >
                      <option value="main">main</option>
                      <option value="master">master</option>
                      <option value="develop">develop</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Screen 2: Netlify */}
          {currentScreen === 2 && (
            <div data-testid="deploy-screen-2">
              <div style={styles.eyebrow}>Step 2 of 4</div>
              <h1 style={styles.heading}>Where should we deploy your app?</h1>
              <p style={styles.sub}>
                Select a Netlify site, or create a new one. Shipyard will configure automatic deploys from your GitHub repository.
              </p>

              {!state.netlifyConnected ? (
                <div style={styles.connectBanner}>
                  <div style={styles.bannerIcon}>🌐</div>
                  <div style={styles.bannerText}>
                    Netlify — not connected
                    <span style={styles.bannerSub}>
                      Connect your account to select or create a site.
                    </span>
                  </div>
                  <button
                    data-testid="netlify-connect-btn"
                    onClick={() => window.location.href = '/api/netlify-oauth'}
                    style={styles.bannerBtn}
                  >
                    Connect Netlify →
                  </button>
                </div>
              ) : (
                <div data-testid="netlify-connected-indicator" style={styles.connectedBadge}>
                  <div style={{ ...styles.badgeAvatar, background: '#00ad9f' }}>N</div>
                  Connected as {connections.find(a => a.provider === 'netlify')?.account_name || 'netlify'}
                  <span style={styles.badgeCheckmark}>via Netlify OAuth ✓</span>
                </div>
              )}

              {state.netlifyConnected && (
                <div style={{ marginTop: 20 }}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Netlify site</label>
                    <select
                      data-testid="netlify-site-selector"
                      value={state.netlifySiteId}
                      onChange={e => setState(prev => ({ ...prev, netlifySiteId: e.target.value }))}
                      style={styles.fieldSelect}
                    >
                      <option value="">— Select a site —</option>
                      <option value="new">── Create new site ──</option>
                      <option value="taskflow-app">taskflow-app.netlify.app (new)</option>
                      <option value="portfolio">portfolio-site.netlify.app</option>
                    </select>
                    {state.netlifySiteId && (
                      <div style={styles.fieldHint}>
                        Your app will be live at: <strong>taskflow-app.netlify.app</strong>
                      </div>
                    )}
                  </div>

                  <div style={styles.buildSettings}>
                    <div style={styles.bsHeader}>
                      <span>Build settings</span>
                      <div style={styles.bsBadge}>Auto-detected: Vite + React</div>
                    </div>
                    <div style={styles.bsRow}>
                      <label style={styles.bsLabel}>Build command</label>
                      <input
                        data-testid="netlify-build-command"
                        type="text"
                        value={state.netlifyBuildCommand}
                        onChange={e => setState(prev => ({ ...prev, netlifyBuildCommand: e.target.value }))}
                        style={styles.bsInput}
                      />
                    </div>
                    <div style={styles.bsRow}>
                      <label style={styles.bsLabel}>Publish directory</label>
                      <input
                        data-testid="netlify-publish-dir"
                        type="text"
                        value={state.netlifyPublishDir}
                        onChange={e => setState(prev => ({ ...prev, netlifyPublishDir: e.target.value }))}
                        style={styles.bsInput}
                      />
                    </div>
                    <div style={styles.bsRow}>
                      <label style={styles.bsLabel}>Node version</label>
                      <input
                        type="text"
                        value={state.netlifyNodeVersion}
                        onChange={e => setState(prev => ({ ...prev, netlifyNodeVersion: e.target.value }))}
                        style={styles.bsInput}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Screen 3: Supabase */}
          {currentScreen === 3 && (
            <div data-testid="deploy-screen-3">
              <div style={styles.eyebrow}>Step 3 of 4</div>
              <h1 style={styles.heading}>Connect your database</h1>
              <p style={styles.sub}>
                Copy two values from your Supabase project dashboard. Shipyard uses these to connect to your database.
              </p>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>
                  Supabase Project URL
                  <div style={styles.fieldHintIcon}>How to find this ⓘ</div>
                </label>
                <input
                  data-testid="supabase-url-input"
                  type="text"
                  placeholder="https://xyzabcdef.supabase.co"
                  value={state.supabaseUrl}
                  onChange={e => setState(prev => ({ ...prev, supabaseUrl: e.target.value }))}
                  onBlur={validateSupabase}
                  style={{
                    ...styles.fieldInput,
                    borderColor:
                      state.supabaseValidStatus === 'valid' ? T.green :
                      state.supabaseValidStatus === 'checking' ? T.warning :
                      state.supabaseValidStatus === 'invalid' ? T.danger :
                      'inherit',
                  }}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>
                  Supabase Anon Key
                  <div style={styles.fieldHintIcon}>How to find this ⓘ</div>
                </label>
                <input
                  data-testid="supabase-anon-key-input"
                  type="text"
                  placeholder="eyJhbGci…"
                  value={state.supabaseAnonKey}
                  onChange={e => setState(prev => ({ ...prev, supabaseAnonKey: e.target.value }))}
                  onBlur={validateSupabase}
                  style={{
                    ...styles.fieldInput,
                    borderColor:
                      state.supabaseValidStatus === 'valid' ? T.green :
                      state.supabaseValidStatus === 'checking' ? T.warning :
                      state.supabaseValidStatus === 'invalid' ? T.danger :
                      'inherit',
                  }}
                />
              </div>

              {state.supabaseValidStatus === 'checking' && (
                <div data-testid="supabase-validation-status" style={styles.validationRow}>
                  <div style={{ ...styles.valDot, background: T.warning }} />
                  <span style={{ color: T.warning }}>Checking connection…</span>
                </div>
              )}

              {state.supabaseValidStatus === 'valid' && (
                <div data-testid="supabase-validation-status" style={styles.successBox}>
                  <div style={{ fontSize: 18 }}>✅</div>
                  <div>
                    <strong>Database connected</strong> — Shipyard hit your Supabase API and got a valid response.
                  </div>
                </div>
              )}

              {state.supabaseValidStatus === 'invalid' && (
                <div style={styles.errorBox}>
                  <div style={{ fontSize: 18 }}>❌</div>
                  <div>
                    <strong>Connection failed</strong> — {state.supabaseError || 'Please check your credentials and try again.'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Screen 4: Ready to Deploy */}
          {currentScreen === 4 && (
            <div data-testid="deploy-screen-4">
              <div style={styles.eyebrow}>Step 4 of 4</div>
              <h1 style={styles.heading}>Everything's connected.</h1>
              <p style={styles.sub}>
                Review your deployment configuration and click Deploy to push your project to Alpha.
              </p>

              <div style={styles.summaryCard}>
                <div style={styles.summaryRow}>
                  <div style={styles.srIcon}>🐙</div>
                  <div style={styles.srService}>GitHub</div>
                  <div style={styles.srValue}>{state.githubRepo}</div>
                  <div style={styles.srCheck}>✅</div>
                </div>
                <div style={styles.summaryRow}>
                  <div style={styles.srIcon}>🌐</div>
                  <div style={styles.srService}>Netlify</div>
                  <div style={styles.srValue}>{state.netlifySiteUrl}</div>
                  <div style={styles.srCheck}>✅</div>
                </div>
                <div style={styles.summaryRow}>
                  <div style={styles.srIcon}>💾</div>
                  <div style={styles.srService}>Supabase</div>
                  <div style={styles.srValue}>{state.supabaseUrl}</div>
                  <div style={styles.srCheck}>✅</div>
                </div>
              </div>

              <div style={styles.whatHappens}>
                <h4 style={styles.whTitle}>What happens when you click Deploy</h4>
                <div style={styles.whatStep}>
                  <div style={styles.wsArrow}>→</div>
                  Your code is pushed to <strong>{state.githubRepo}</strong> on GitHub
                </div>
                <div style={styles.whatStep}>
                  <div style={styles.wsArrow}>→</div>
                  Netlify picks up the push and builds automatically (est. 2–3 min)
                </div>
                <div style={styles.whatStep}>
                  <div style={styles.wsArrow}>→</div>
                  Your app goes live at <strong style={{ color: T.accent }}>{state.netlifySiteUrl}</strong>
                </div>
                <div style={styles.whatStep}>
                  <div style={styles.wsArrow}>→</div>
                  3 Human Tasks are filed for environment variable setup
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deploy status card (if showing) */}
      {currentScreen === 4 && config.deploy_status && (
        <div data-testid="deploy-status-card" style={styles.deployStatusCard}>
          <div style={styles.dscHeader}>
            <div style={{ fontSize: 18 }}>🚀</div>
            <h3 style={styles.dscTitle}>
              {config.deploy_status === 'building' ? 'Deploying to Alpha…' :
               config.deploy_status === 'deployed' ? '✅ Deployed' :
               config.deploy_status === 'failed' ? 'Deploy failed' :
               'Ready to deploy'}
            </h3>
            {config.deploy_status === 'building' && (
              <div style={styles.logLink}>View build log ↗</div>
            )}
          </div>
        </div>
      )}

      {/* Wizard nav */}
      <div style={styles.wizNav}>
        <div style={styles.stepCounter}>
          Step {currentScreen} of 4
        </div>

        {showBackButton && (
          <button
            data-testid="deploy-back-btn"
            onClick={() => setCurrentScreen((c => (c - 1) as Screen))}
            style={styles.btnBack}
          >
            ← Back
          </button>
        )}

        {showNextButton && (
          <button
            data-testid="deploy-next-btn"
            onClick={() => setCurrentScreen(c => (c + 1) as Screen)}
            disabled={!canContinue[currentScreen]}
            style={{
              ...styles.btnContinue,
              opacity: !canContinue[currentScreen] ? 0.5 : 1,
              cursor: !canContinue[currentScreen] ? 'not-allowed' : 'pointer',
            }}
          >
            Continue →
          </button>
        )}

        {showDeployButton && (
          <button
            data-testid="deploy-btn"
            onClick={handleDeploy}
            disabled={deploying || state.supabaseValidStatus !== 'valid'}
            style={{
              ...styles.btnDeploy,
              opacity: deploying || state.supabaseValidStatus !== 'valid' ? 0.5 : 1,
              cursor: deploying || state.supabaseValidStatus !== 'valid' ? 'not-allowed' : 'pointer',
            }}
          >
            {deploying ? '…' : '🚀 Deploy'}
          </button>
        )}

        <button style={styles.btnSaveLater}>Save and deploy later</button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: T.bg,
  },
  topnav: {
    height: 52,
    background: T.surface,
    borderBottom: `1px solid ${T.border}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    gap: 12,
    flexShrink: 0,
  },
  logo: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  exit: {
    fontSize: 12,
    color: T.text2,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  wizWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflowY: 'auto',
    padding: '32px 24px 100px',
  },
  wizContent: {
    width: '100%',
    maxWidth: 560,
  },
  progDots: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 36,
  },
  progDot: {
    height: 8,
    borderRadius: '50%',
    transition: 'all 0.3s',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 600,
    color: T.accent,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: T.text,
    lineHeight: 1.2,
    marginBottom: 8,
    margin: 0,
  },
  sub: {
    fontSize: 14,
    color: T.text2,
    lineHeight: 1.6,
    marginBottom: 28,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: T.text,
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  fieldHintIcon: {
    fontSize: 11,
    color: T.text2,
    marginLeft: 'auto',
    cursor: 'pointer',
  },
  fieldInput: {
    width: '100%',
    padding: '10px 14px',
    border: `1.5px solid ${T.border}`,
    borderRadius: 9,
    fontSize: 14,
    background: T.surface,
    color: T.text,
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  fieldSelect: {
    width: '100%',
    padding: '10px 14px',
    border: `1.5px solid ${T.border}`,
    borderRadius: 9,
    fontSize: 14,
    background: T.surface,
    color: T.text,
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%236e6e73' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: 36,
    boxSizing: 'border-box',
  },
  fieldHint: {
    fontSize: 11,
    color: T.text2,
    marginTop: 6,
  },
  connectBanner: {
    background: `rgba(91,91,214,0.06)`,
    border: `1px solid rgba(91,91,214,0.2)`,
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  bannerIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: T.text,
  },
  bannerSub: {
    color: T.text2,
    fontSize: 12,
    display: 'block',
    marginTop: 2,
  },
  bannerBtn: {
    padding: '7px 14px',
    background: T.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  connectedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-start',
    background: '#f0fdf4',
    border: '1px solid rgba(48,209,88,0.3)',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#166534',
    marginBottom: 20,
    width: 'fit-content',
  },
  badgeAvatar: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: T.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    flexShrink: 0,
  },
  badgeCheckmark: {
    marginLeft: 6,
    fontSize: 11,
    color: '#16a34a',
    fontWeight: 400,
  },
  buildSettings: {
    background: T.bg2,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '14px 16px',
    marginTop: 14,
  },
  bsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  bsBadge: {
    background: 'rgba(91,91,214,0.1)',
    color: T.accent,
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 5,
    marginLeft: 'auto',
  },
  bsRow: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  bsLabel: {
    fontSize: 12,
    color: T.text2,
    fontWeight: 500,
  },
  bsInput: {
    padding: '7px 10px',
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    fontSize: 12,
    fontFamily: 'monospace',
    background: T.surface,
    color: T.text,
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  },
  validationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    fontSize: 12,
  },
  valDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  successBox: {
    background: '#f0fdf4',
    border: '1px solid rgba(48,209,88,0.25)',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    fontSize: 13,
    color: '#166534',
    lineHeight: 1.4,
  },
  errorBox: {
    background: 'rgba(255,59,48,0.06)',
    border: `1px solid rgba(255,59,48,0.2)`,
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    fontSize: 13,
    color: T.danger,
    lineHeight: 1.4,
  },
  summaryCard: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 18px',
    borderBottom: `1px solid ${T.border}`,
  },
  srIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  srService: {
    fontSize: 13,
    fontWeight: 700,
    flex: 1,
  },
  srValue: {
    fontSize: 12,
    color: T.text2,
    fontFamily: 'monospace',
  },
  srCheck: {
    fontSize: 16,
    color: T.green,
  },
  whatHappens: {
    background: T.bg2,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '16px 18px',
    marginBottom: 24,
  },
  whTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: T.text2,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 12,
    margin: 0,
  },
  whatStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    color: T.text,
    marginBottom: 8,
  },
  wsArrow: {
    color: T.accent,
    fontSize: 12,
    marginTop: 2,
    flexShrink: 0,
  },
  deployStatusCard: {
    background: T.surface,
    border: `1.5px solid ${T.border}`,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    marginTop: 16,
  },
  dscHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 18px',
    borderBottom: `1px solid ${T.border}`,
  },
  dscTitle: {
    fontSize: 14,
    fontWeight: 700,
    flex: 1,
    margin: 0,
  },
  logLink: {
    fontSize: 12,
    color: T.accent,
    cursor: 'pointer',
  },
  wizNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    background: T.surface,
    borderTop: `1px solid ${T.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '0 24px',
    zIndex: 100,
  },
  stepCounter: {
    fontSize: 12,
    color: T.text2,
    marginRight: 'auto',
  },
  btnBack: {
    padding: '10px 20px',
    background: T.bg2,
    border: `1px solid ${T.border}`,
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    color: T.text,
  },
  btnContinue: {
    padding: '10px 24px',
    background: T.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  btnDeploy: {
    padding: '10px 24px',
    background: T.green,
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  btnSaveLater: {
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    fontSize: 13,
    color: T.text2,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
};
