/**
 * AnalyticsScreen — Build 017
 *
 * Route: /projects/:id/analytics
 *
 * 5-tab analytics dashboard:
 *   - Overview
 *   - Revenue
 *   - Acquisition
 *   - Engagement
 *   - Retention
 *
 * When disconnected: ghost charts with "Connect PostHog" overlay.
 * When connected: live data from PostHog API (via Edge Function in production).
 *
 * Admin Console: PostHog Project ID input + API Key password field + save button.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getAnalyticsConfig,
  saveAnalyticsConfig,
  saveAnalyticsApiKey,
  toggleAnalyticsEnabled,
} from '@/api/analytics';
import { useToast } from '@/context/ToastContext';
import type { AnalyticsConfig } from '@/api/analytics';

// ── Design tokens ─────────────────────────────────────────────────────────

const T = {
  bg:        '#0f0f10',
  surface:   '#1a1a1c',
  surf2:     '#222224',
  surf3:     '#2c2c2e',
  border:    '#2c2c2e',
  bord2:     '#3a3a3c',
  text:      '#e8e8ea',
  text2:     '#8e8e93',
  text3:     '#636366',
  accent:    '#0a84ff',
  green:     '#30d158',
  red:       '#ff453a',
  warning:   '#ff9f0a',
};

type TabId = 'overview' | 'revenue' | 'acquisition' | 'engagement' | 'retention';

interface TabConfig {
  id: TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'retention', label: 'Retention' },
];

export default function AnalyticsScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [config, setConfig] = useState<AnalyticsConfig>({
    posthog_project_id: null,
    analytics_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentTab, setCurrentTab] = useState<TabId>('overview');

  // Connection setup form state
  const [projectIdInput, setProjectIdInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Load analytics config on mount
  useEffect(() => {
    async function init() {
      try {
        const cfg = await getAnalyticsConfig(projectId!);
        setConfig(cfg);
        setProjectIdInput(cfg.posthog_project_id || '');
      } catch (err) {
        console.error('Failed to load analytics config:', err);
        showToast('Failed to load analytics configuration', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId, showToast]);

  const isConnected = Boolean(config.posthog_project_id);

  async function handleSaveProjectId() {
    if (!projectIdInput.trim()) {
      showToast('Project ID is required', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveAnalyticsConfig(projectId!, { posthog_project_id: projectIdInput });
      setConfig(prev => ({ ...prev, posthog_project_id: projectIdInput }));
      showToast('Project ID saved', 'success');
    } catch (err) {
      console.error('Failed to save project ID:', err);
      showToast('Failed to save project ID', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim()) {
      showToast('API key is required', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveAnalyticsApiKey(projectId!, apiKeyInput);
      setApiKeyInput('');
      showToast('API key saved securely', 'success');
    } catch (err) {
      console.error('Failed to save API key:', err);
      showToast('Failed to save API key', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled() {
    try {
      const newState = !config.analytics_enabled;
      await toggleAnalyticsEnabled(projectId!, newState);
      setConfig(prev => ({ ...prev, analytics_enabled: newState }));
      showToast(
        newState ? 'Analytics enabled' : 'Analytics disabled',
        'success'
      );
    } catch (err) {
      console.error('Failed to toggle analytics:', err);
      showToast('Failed to update analytics state', 'error');
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: T.text2 }}>
        Loading analytics...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: T.bg, minHeight: '100vh', padding: '2rem' }}>
      {/* Header */}
      <div
        style={{
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ color: T.text, fontSize: '1.75rem', margin: 0 }}>
          Analytics
        </h1>
        <div
          data-testid="connection-status-badge"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: isConnected ? '#10b981' : T.surf3,
            color: isConnected ? '#d1fae5' : T.text2,
          }}
        >
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Tab navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          borderBottom: `1px solid ${T.border}`,
          paddingBottom: '1rem',
        }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setCurrentTab(tab.id)}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'transparent',
              border: 'none',
              color: currentTab === tab.id ? T.accent : T.text2,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: currentTab === tab.id ? '600' : '400',
              borderBottom: currentTab === tab.id ? `2px solid ${T.accent}` : 'none',
              marginBottom: '-1rem',
              transition: 'color 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — Ghost chart or live data */}
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: '0.5rem',
          padding: '2rem',
          marginBottom: '2rem',
          minHeight: '400px',
          position: 'relative',
        }}
      >
        {!isConnected ? (
          <GhostChartOverlay />
        ) : (
          <LiveChartPlaceholder tabId={currentTab} />
        )}
      </div>

      {/* Settings / Admin Console */}
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: '0.5rem',
          padding: '2rem',
          border: `1px solid ${T.border}`,
        }}
      >
        <h2 style={{ color: T.text, fontSize: '1.125rem', marginTop: 0 }}>
          PostHog Configuration
        </h2>

        {/* Analytics enabled toggle */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              data-testid="analytics-enabled-toggle"
              checked={config.analytics_enabled}
              onChange={handleToggleEnabled}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: T.text, fontSize: '0.875rem' }}>
              Analytics enabled
            </span>
          </label>
        </div>

        {/* Project ID input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="posthog-project-id"
            style={{ display: 'block', color: T.text2, fontSize: '0.75rem', marginBottom: '0.5rem' }}
          >
            PostHog Project ID
          </label>
          <input
            id="posthog-project-id"
            data-testid="posthog-project-id-input"
            type="text"
            placeholder="e.g., 12345"
            value={projectIdInput}
            onChange={e => setProjectIdInput(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: T.surf2,
              border: `1px solid ${T.border}`,
              borderRadius: '0.375rem',
              color: T.text,
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ margin: '0.5rem 0 0 0', color: T.text3, fontSize: '0.75rem' }}>
            Find this in your PostHog project settings
          </p>
        </div>

        {/* API Key input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="posthog-api-key"
            style={{ display: 'block', color: T.text2, fontSize: '0.75rem', marginBottom: '0.5rem' }}
          >
            PostHog API Key
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="posthog-api-key"
              data-testid="posthog-api-key-input"
              type={showApiKey ? 'text' : 'password'}
              placeholder="phc_xxxxxxxxxxxxxxxxxxxx"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                paddingRight: '2.5rem',
                backgroundColor: T.surf2,
                border: `1px solid ${T.border}`,
                borderRadius: '0.375rem',
                color: T.text,
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'transparent',
                border: 'none',
                color: T.text2,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p style={{ margin: '0.5rem 0 0 0', color: T.text3, fontSize: '0.75rem' }}>
            Stored securely server-side only
          </p>
        </div>

        {/* Save buttons */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
          }}
        >
          <button
            data-testid="save-analytics-btn"
            onClick={handleSaveProjectId}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: T.accent,
              border: 'none',
              borderRadius: '0.375rem',
              color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={handleSaveApiKey}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: T.surf2,
              border: `1px solid ${T.border}`,
              borderRadius: '0.375rem',
              color: T.text,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ghost Chart Overlay ────────────────────────────────────────────────────

function GhostChartOverlay() {
  return (
    <div
      data-testid="ghost-chart-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '0.5rem',
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* Ghost chart shapes */}
      <div style={{ marginBottom: '2rem' }}>
        <svg
          width="200"
          height="120"
          viewBox="0 0 200 120"
          style={{ opacity: 0.2, marginBottom: '1rem' }}
        >
          <rect x="10" y="60" width="30" height="50" fill="#8e8e93" />
          <rect x="50" y="40" width="30" height="70" fill="#8e8e93" />
          <rect x="90" y="30" width="30" height="80" fill="#8e8e93" />
          <rect x="130" y="50" width="30" height="60" fill="#8e8e93" />
          <rect x="170" y="20" width="20" height="90" fill="#8e8e93" />
        </svg>
      </div>

      {/* CTA */}
      <h3 style={{ color: '#8e8e93', fontSize: '1rem', margin: '0 0 0.5rem 0' }}>
        Connect PostHog to see analytics
      </h3>
      <p style={{ color: '#636366', fontSize: '0.875rem', margin: 0 }}>
        Configure your PostHog project ID and API key below
      </p>
    </div>
  );
}

// ── Live Chart Placeholder ─────────────────────────────────────────────────

function LiveChartPlaceholder({ tabId }: { tabId: TabId }) {
  const labels = {
    overview: 'Dashboard Overview',
    revenue: 'Revenue Metrics',
    acquisition: 'User Acquisition',
    engagement: 'User Engagement',
    retention: 'Retention Cohorts',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '400px',
      }}
    >
      <svg
        width="240"
        height="140"
        viewBox="0 0 240 140"
        style={{ marginBottom: '2rem', opacity: 0.6 }}
      >
        <line x1="20" y1="120" x2="220" y2="120" stroke="#3a3a3c" strokeWidth="2" />
        <line x1="20" y1="20" x2="20" y2="120" stroke="#3a3a3c" strokeWidth="2" />

        <rect x="35" y="80" width="25" height="40" fill="#0a84ff" opacity="0.3" />
        <rect x="70" y="50" width="25" height="70" fill="#0a84ff" opacity="0.5" />
        <rect x="105" y="40" width="25" height="80" fill="#0a84ff" />
        <rect x="140" y="60" width="25" height="60" fill="#0a84ff" opacity="0.5" />
        <rect x="175" y="30" width="25" height="90" fill="#0a84ff" opacity="0.3" />
      </svg>
      <h3 style={{ color: '#e8e8ea', fontSize: '1.125rem', margin: '0 0 0.5rem 0' }}>
        {labels[tabId]}
      </h3>
      <p style={{ color: '#8e8e93', fontSize: '0.875rem', margin: 0 }}>
        Live data from PostHog (Edge Function returns data in production)
      </p>
    </div>
  );
}
