/**
 * DomainScreen — Build 018
 *
 * Route: /projects/:id/domain
 *
 * Custom domain management UI:
 *   - not_configured: domain input + Save button + explanation
 *   - dns_pending: DNS instructions card + "Check again" button
 *   - connected: green "Connected" badge, domain display, "Remove" button
 *
 * Depends on Build 038 (Netlify OAuth) for netlify_subdomain in future;
 * UI works standalone with placeholder subdomain.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getDomainConfig,
  saveCustomDomain,
  removeCustomDomain,
  checkDomainStatus,
  deriveDnsInstructions,
  type CustomDomainConfig,
} from '@/api/customDomain';
import { useToast } from '@/context/ToastContext';

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

export default function DomainScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [config, setConfig] = useState<CustomDomainConfig>({
    custom_domain: null,
    domain_status: 'not_configured',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  // Form state for not_configured state
  const [domainInput, setDomainInput] = useState('');

  // Placeholder Netlify subdomain (from Build 038 in future)
  // TODO: fetch from projects.netlify_subdomain when Build 038 is integrated
  const netlifySubdomain = 'myapp-xyz';

  // Load domain config on mount
  useEffect(() => {
    async function init() {
      try {
        const cfg = await getDomainConfig(projectId!);
        setConfig(cfg);
        setDomainInput(cfg.custom_domain || '');
      } catch (err) {
        console.error('Failed to load domain config:', err);
        showToast('Failed to load domain configuration', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId, showToast]);

  async function handleSaveDomain() {
    if (!domainInput.trim()) {
      showToast('Domain is required', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveCustomDomain(projectId!, domainInput);
      setConfig(prev => ({
        ...prev,
        custom_domain: domainInput,
        domain_status: 'dns_pending',
      }));
      showToast('Domain saved. Please add the DNS record below.', 'success');
    } catch (err) {
      console.error('Failed to save domain:', err);
      showToast('Failed to save domain', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckDomain() {
    setChecking(true);
    try {
      await checkDomainStatus(projectId!);
      // Refresh config to get updated status
      const cfg = await getDomainConfig(projectId!);
      setConfig(cfg);
      if (cfg.domain_status === 'connected') {
        showToast('Domain is now connected!', 'success');
      } else {
        showToast('DNS record not detected yet. Please verify your DNS settings.', 'info');
      }
    } catch (err) {
      console.error('Failed to check domain:', err);
      showToast('Failed to verify domain', 'error');
    } finally {
      setChecking(false);
    }
  }

  async function handleRemoveDomain() {
    if (!confirm('Remove custom domain? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    try {
      await removeCustomDomain(projectId!);
      setConfig({
        custom_domain: null,
        domain_status: 'not_configured',
      });
      setDomainInput('');
      showToast('Domain removed', 'success');
    } catch (err) {
      console.error('Failed to remove domain:', err);
      showToast('Failed to remove domain', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: T.text2 }}>
        Loading domain configuration...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: T.bg, minHeight: '100vh', padding: '2rem' }}>
      {/* Header */}
      <h1 style={{ color: T.text, fontSize: '1.75rem', margin: '0 0 2rem 0' }}>
        Custom Domain
      </h1>

      <div style={{ maxWidth: '600px' }}>
        {config.domain_status === 'not_configured' && (
          <NotConfiguredState
            domainInput={domainInput}
            setDomainInput={setDomainInput}
            onSave={handleSaveDomain}
            saving={saving}
          />
        )}

        {config.domain_status === 'dns_pending' && (
          <DnsPendingState
            domain={config.custom_domain || ''}
            netlifySubdomain={netlifySubdomain}
            onCheckAgain={handleCheckDomain}
            checking={checking}
          />
        )}

        {config.domain_status === 'connected' && (
          <ConnectedState
            domain={config.custom_domain || ''}
            onRemove={handleRemoveDomain}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

// ── not_configured State ───────────────────────────────────────────────────

function NotConfiguredState({
  domainInput,
  setDomainInput,
  onSave,
  saving,
}: {
  domainInput: string;
  setDomainInput: (val: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div
      data-testid="domain-screen"
      style={{
        backgroundColor: T.surface,
        borderRadius: '0.5rem',
        padding: '2rem',
        border: `1px solid ${T.border}`,
      }}
    >
      <p style={{ color: T.text2, fontSize: '0.875rem', marginTop: 0 }}>
        Connect a custom domain to your project. You can use an apex domain (example.com)
        or a subdomain (blog.example.com).
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <label
          htmlFor="domain-input"
          style={{ display: 'block', color: T.text2, fontSize: '0.75rem', marginBottom: '0.5rem' }}
        >
          Domain
        </label>
        <input
          id="domain-input"
          data-testid="domain-input"
          type="text"
          placeholder="example.com"
          value={domainInput}
          onChange={e => setDomainInput(e.target.value)}
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
      </div>

      <button
        data-testid="save-domain-btn"
        onClick={onSave}
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
        {saving ? 'Saving...' : 'Save Domain'}
      </button>
    </div>
  );
}

// ── dns_pending State ──────────────────────────────────────────────────────

function DnsPendingState({
  domain,
  netlifySubdomain,
  onCheckAgain,
  checking,
}: {
  domain: string;
  netlifySubdomain: string;
  onCheckAgain: () => void;
  checking: boolean;
}) {
  const instructions = deriveDnsInstructions(domain, netlifySubdomain);

  return (
    <div
      data-testid="domain-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}
    >
      {/* Instructions card */}
      <div
        data-testid="dns-instructions-card"
        style={{
          backgroundColor: T.surface,
          borderRadius: '0.5rem',
          padding: '2rem',
          border: `1px solid ${T.border}`,
        }}
      >
        <h2 style={{ color: T.text, fontSize: '1.125rem', marginTop: 0 }}>
          DNS Configuration Required
        </h2>

        <p style={{ color: T.text2, fontSize: '0.875rem' }}>
          Add the following DNS record to complete the setup:
        </p>

        {/* DNS records table */}
        <div
          style={{
            backgroundColor: T.surf2,
            borderRadius: '0.375rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ color: T.text3, fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                Record Type
              </div>
              <div
                data-testid="dns-record-type"
                style={{ color: T.text, fontWeight: '600' }}
              >
                {instructions.record_type}
              </div>
            </div>

            <div>
              <div style={{ color: T.text3, fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                Host / Name
              </div>
              <div data-testid="dns-host" style={{ color: T.text, fontWeight: '600' }}>
                {instructions.host}
              </div>
            </div>

            <div
              style={{ gridColumn: '1 / -1' }}
            >
              <div style={{ color: T.text3, fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                Value / Target
              </div>
              <div
                data-testid="dns-value"
                style={{
                  color: T.text,
                  fontWeight: '600',
                  wordBreak: 'break-all',
                }}
              >
                {instructions.value}
              </div>
            </div>
          </div>
        </div>

        <p style={{ color: T.text3, fontSize: '0.75rem', margin: 0 }}>
          {instructions.type === 'apex'
            ? 'Add an A record pointing to the IP address above.'
            : 'Add a CNAME record pointing to the domain above.'}
        </p>
      </div>

      {/* Status and check button */}
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: '0.5rem',
          padding: '1.5rem',
          border: `1px solid ${T.warning}`,
          borderLeft: `4px solid ${T.warning}`,
        }}
      >
        <p style={{ color: T.text2, fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
          DNS changes can take up to 24 hours to propagate. Once you've added the record above,
          click "Check again" to verify.
        </p>

        <button
          data-testid="check-again-btn"
          onClick={onCheckAgain}
          disabled={checking}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: T.accent,
            border: 'none',
            borderRadius: '0.375rem',
            color: '#fff',
            cursor: checking ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            opacity: checking ? 0.6 : 1,
          }}
        >
          {checking ? 'Checking...' : 'Check again'}
        </button>
      </div>
    </div>
  );
}

// ── connected State ────────────────────────────────────────────────────────

function ConnectedState({
  domain,
  onRemove,
  saving,
}: {
  domain: string;
  onRemove: () => void;
  saving: boolean;
}) {
  return (
    <div
      data-testid="domain-screen"
      style={{
        backgroundColor: T.surface,
        borderRadius: '0.5rem',
        padding: '2rem',
        border: `1px solid ${T.green}`,
        borderLeft: `4px solid ${T.green}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div
          data-testid="connected-badge"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#10b981',
            borderRadius: '0.375rem',
            color: '#d1fae5',
            fontSize: '0.75rem',
            fontWeight: '600',
          }}
        >
          Connected
        </div>
        <h2 style={{ color: T.text, fontSize: '1.25rem', margin: 0 }}>
          {domain}
        </h2>
      </div>

      <div
        data-testid="domain-status-badge"
        style={{
          backgroundColor: '#10b98133',
          borderRadius: '0.375rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#d1fae5',
          fontSize: '0.875rem',
        }}
      >
        Your custom domain is now active and connected.
      </div>

      <button
        data-testid="remove-domain-btn"
        onClick={onRemove}
        disabled={saving}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: T.red,
          border: 'none',
          borderRadius: '0.375rem',
          color: '#fff',
          cursor: saving ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Removing...' : 'Remove Domain'}
      </button>
    </div>
  );
}
