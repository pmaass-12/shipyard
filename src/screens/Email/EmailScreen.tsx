/**
 * EmailScreen — Build 019
 *
 * Route: /projects/:id/email
 *
 * Transactional email setup and template management via Resend.
 * Connect by saving API key, from name, and from email.
 * Edit three template types inline: welcome, waitlist_confirmation, waitlist_approval.
 * Regenerate templates via AI.
 *
 * Contract: contracts/019-transactional-email-READY.md
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  getEmailSenderConfig,
  saveEmailSenderConfig,
  saveResendApiKey,
  getEmailTemplates,
  updateEmailTemplate,
  toggleTemplateStatus,
  generateEmailTemplates,
  type EmailTemplate,
  type EmailSenderConfig,
  type EmailTemplateType,
  type EmailConnectionStatus,
} from '@/api/email';
import { useToast } from '@/context/ToastContext';

// ── Design tokens ─────────────────────────────────────────────────────────

const T = {
  bg:       '#0f0f10',
  surface:  '#1a1a1c',
  surface2: '#222224',
  surface3: '#2c2c2e',
  border:   '#2c2c2e',
  text:     '#e8e8ea',
  text2:    '#8e8e93',
  accent:   '#0a84ff',
  green:    '#30d158',
  red:      '#ff453a',
  orange:   '#ff9f0a',
};

// ── Types ──────────────────────────────────────────────────────────────────

interface LocalEmailTemplate extends EmailTemplate {
  isSaving?: boolean;
}

// ── Template Label Config ──────────────────────────────────────────────────

const TEMPLATE_LABELS: Record<EmailTemplateType, string> = {
  welcome: 'Welcome',
  waitlist_confirmation: 'Waitlist Confirmation',
  waitlist_approval: 'Waitlist Approval',
};

// ── Main Component ─────────────────────────────────────────────────────────

export function EmailScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const { showToast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingTemplates, setGeneratingTemplates] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<EmailConnectionStatus>('disconnected');

  // Form state
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<LocalEmailTemplate[]>([]);

  // ── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);
      const [config, tpls] = await Promise.all([
        getEmailSenderConfig(projectId!),
        getEmailTemplates(projectId!),
      ]);

      setFromName(config.resend_from_name ?? '');
      setFromEmail(config.resend_from_email ?? '');

      // Determine connection status: connected if all config fields are filled
      const isConnected =
        !!(config.resend_from_name?.trim()) &&
        !!(config.resend_from_email?.trim());
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');

      setTemplates(tpls);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load email config', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleSaveSenderConfig() {
    if (!projectId) return;
    try {
      setSaving(true);
      await saveEmailSenderConfig(projectId, {
        resend_from_name: fromName.trim() || null,
        resend_from_email: fromEmail.trim() || null,
      });

      // Update connection status
      const isConnected = !!(fromName.trim()) && !!(fromEmail.trim());
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');

      showToast('Sender config saved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save sender config', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveApiKey() {
    if (!projectId || !apiKey.trim()) {
      showToast('Please enter an API key', 'error');
      return;
    }
    try {
      setSaving(true);
      await saveResendApiKey(projectId, apiKey.trim());
      setApiKey('');
      showToast('API key saved securely', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save API key', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateTemplate(
    templateId: string,
    patch: Partial<EmailTemplate>
  ) {
    if (!projectId) return;
    try {
      setTemplates(tpls =>
        tpls.map(t =>
          t.id === templateId ? { ...t, isSaving: true } : t
        )
      );

      await updateEmailTemplate(templateId, patch);

      setTemplates(tpls =>
        tpls.map(t =>
          t.id === templateId ? { ...t, ...patch, isSaving: false } : t
        )
      );

      showToast('Template saved', 'success');
    } catch (err) {
      setTemplates(tpls =>
        tpls.map(t =>
          t.id === templateId ? { ...t, isSaving: false } : t
        )
      );
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error');
    }
  }

  async function handleToggleStatus(
    templateId: string,
    currentStatus: string
  ) {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    await handleUpdateTemplate(templateId, { status: newStatus as any });
  }

  async function handleGenerateTemplates() {
    if (!projectId) return;
    try {
      setGeneratingTemplates(true);
      await generateEmailTemplates(projectId);
      await loadData(); // Reload templates
      showToast('Templates regenerated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate templates', 'error');
    } finally {
      setGeneratingTemplates(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div data-testid="email-screen" style={{ padding: '24px' }}>
        <p style={{ color: T.text2 }}>Loading...</p>
      </div>
    );
  }

  const isConnected = connectionStatus === 'connected';

  return (
    <div
      data-testid="email-screen"
      style={{
        padding: '24px',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: T.text, margin: 0 }}>
          Transactional Email
        </h1>
        <p style={{ fontSize: 14, color: T.text2, margin: '8px 0 0' }}>
          Configure Resend to send transactional emails to your users.
        </p>
      </div>

      {/* Connection Status Badge */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: isConnected ? 'rgba(48,209,152,0.15)' : 'rgba(255,69,58,0.15)',
            border: `1px solid ${isConnected ? 'rgba(48,209,152,0.3)' : 'rgba(255,69,58,0.3)'}`,
          }}
          data-testid="email-connection-status"
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? T.green : T.red,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Connection Section */}
      <div
        data-testid="email-connect-form"
        style={{
          padding: '20px',
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          marginBottom: '32px',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, margin: '0 0 16px' }}>
          Connection Details
        </h3>

        {/* From Name */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="from-name"
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 6 }}
          >
            From Name
          </label>
          <input
            id="from-name"
            data-testid="from-name-input"
            type="text"
            value={fromName}
            onChange={e => setFromName(e.target.value)}
            disabled={saving}
            placeholder="e.g., My Product"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: T.surface2,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.text,
              fontSize: 14,
              fontFamily: 'inherit',
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'text',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* From Email */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="from-email"
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 6 }}
          >
            From Email
          </label>
          <input
            id="from-email"
            data-testid="from-email-input"
            type="email"
            value={fromEmail}
            onChange={e => setFromEmail(e.target.value)}
            disabled={saving}
            placeholder="noreply@example.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: T.surface2,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.text,
              fontSize: 14,
              fontFamily: 'inherit',
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'text',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* API Key */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="api-key"
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 6 }}
          >
            Resend API Key
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="api-key"
              data-testid="api-key-input"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              disabled={saving}
              placeholder="re_..."
              style={{
                flex: 1,
                padding: '10px 12px',
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                color: T.text,
                fontSize: 14,
                fontFamily: 'inherit',
                opacity: saving ? 0.6 : 1,
                cursor: saving ? 'not-allowed' : 'text',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                padding: '10px 12px',
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                color: T.text2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: '20px' }}>
          <button
            data-testid="save-sender-btn"
            onClick={handleSaveSenderConfig}
            disabled={saving}
            style={{
              padding: '10px 16px',
              background: T.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: 'opacity 150ms',
            }}
          >
            {saving ? 'Saving...' : 'Save Sender Config'}
          </button>

          <button
            data-testid="save-api-key-btn"
            onClick={handleSaveApiKey}
            disabled={saving || !apiKey.trim()}
            style={{
              padding: '10px 16px',
              background: T.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving || !apiKey.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !apiKey.trim() ? 0.6 : 1,
              transition: 'opacity 150ms',
            }}
          >
            {saving ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
      </div>

      {/* Templates Section */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, margin: 0 }}>
            Email Templates
          </h3>
          <button
            data-testid="regenerate-templates-btn"
            onClick={handleGenerateTemplates}
            disabled={generatingTemplates || !isConnected}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.text,
              fontSize: 12,
              fontWeight: 600,
              cursor: generatingTemplates || !isConnected ? 'not-allowed' : 'pointer',
              opacity: generatingTemplates || !isConnected ? 0.6 : 1,
              transition: 'opacity 150ms',
            }}
          >
            <RotateCcw size={14} />
            {generatingTemplates ? 'Generating...' : 'Regenerate All'}
          </button>
        </div>

        {!isConnected && (
          <div
            style={{
              padding: '16px',
              background: `rgba(${parseInt(T.red.slice(1, 3), 16)},${parseInt(T.red.slice(3, 5), 16)},${parseInt(T.red.slice(5, 7), 16)},0.1)`,
              border: `1px solid ${T.red}`,
              borderRadius: 8,
              marginBottom: '16px',
            }}
          >
            <p style={{ fontSize: 13, color: T.text, margin: 0 }}>
              Connect your Resend API key to enable template editing.
            </p>
          </div>
        )}

        {/* Template Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isConnected={isConnected}
              onUpdate={handleUpdateTemplate}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── TemplateCard Component ─────────────────────────────────────────────────

interface TemplateCardProps {
  template: LocalEmailTemplate;
  isConnected: boolean;
  onUpdate: (id: string, patch: Partial<EmailTemplate>) => Promise<void>;
  onToggleStatus: (id: string, status: string) => Promise<void>;
}

function TemplateCard({
  template,
  isConnected,
  onUpdate,
  onToggleStatus,
}: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);

  const templateLabel = TEMPLATE_LABELS[template.template_type];
  const testidBase = `template-card-${template.template_type}`;

  return (
    <div
      data-testid={testidBase}
      style={{
        padding: '16px',
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        opacity: isConnected ? 1 : 0.5,
        cursor: isConnected ? 'pointer' : 'default',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>
              {templateLabel}
            </h4>
            {template.status === 'active' && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  background: 'rgba(48,209,152,0.2)',
                  color: T.green,
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 4,
                }}
              >
                Active
              </span>
            )}
          </div>
        </div>

        {/* Status Toggle */}
        <button
          data-testid={`template-status-toggle-${template.template_type}`}
          onClick={() => onToggleStatus(template.id, template.status)}
          disabled={template.isSaving || !isConnected}
          style={{
            padding: '4px 8px',
            background: template.status === 'active' ? T.green : T.surface2,
            color: template.status === 'active' ? '#fff' : T.text2,
            border: 'none',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: template.isSaving || !isConnected ? 'not-allowed' : 'pointer',
            opacity: template.isSaving ? 0.6 : 1,
          }}
        >
          {template.isSaving ? '...' : template.status === 'active' ? 'Disable' : 'Enable'}
        </button>
      </div>

      {/* Expandable Content */}
      {expanded && isConnected && (
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '12px', marginTop: '12px' }}>
          {/* Subject */}
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: T.text2,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Subject
            </label>
            <input
              data-testid={`template-subject-${template.template_type}`}
              type="text"
              value={template.subject}
              onChange={e => onUpdate(template.id, { subject: e.target.value })}
              disabled={template.isSaving}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                color: T.text,
                fontSize: 13,
                fontFamily: 'inherit',
                opacity: template.isSaving ? 0.6 : 1,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Body */}
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: T.text2,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Body
            </label>
            <textarea
              data-testid={`template-body-${template.template_type}`}
              value={template.body}
              onChange={e => onUpdate(template.id, { body: e.target.value })}
              disabled={template.isSaving}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '10px',
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                color: T.text,
                fontSize: 13,
                fontFamily: 'inherit',
                opacity: template.isSaving ? 0.6 : 1,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* CTA Text */}
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: T.text2,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              CTA Text
            </label>
            <input
              data-testid={`template-cta-text-${template.template_type}`}
              type="text"
              value={template.cta_text ?? ''}
              onChange={e => onUpdate(template.id, { cta_text: e.target.value || null })}
              disabled={template.isSaving}
              placeholder="e.g., View Dashboard"
              style={{
                width: '100%',
                padding: '8px 10px',
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                color: T.text,
                fontSize: 13,
                fontFamily: 'inherit',
                opacity: template.isSaving ? 0.6 : 1,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* CTA URL */}
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: T.text2,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              CTA URL
            </label>
            <input
              data-testid={`template-cta-url-${template.template_type}`}
              type="url"
              value={template.cta_url ?? ''}
              onChange={e => onUpdate(template.id, { cta_url: e.target.value || null })}
              disabled={template.isSaving}
              placeholder="https://example.com"
              style={{
                width: '100%',
                padding: '8px 10px',
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                color: T.text,
                fontSize: 13,
                fontFamily: 'inherit',
                opacity: template.isSaving ? 0.6 : 1,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}

      {/* Toggle Expand Button */}
      {isConnected && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%',
            padding: '8px',
            background: 'transparent',
            border: 'none',
            color: T.text2,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            marginTop: expanded ? '12px' : 0,
            transition: 'color 150ms',
          }}
          onMouseEnter={e => {
            (e.currentTarget as any).style.color = T.text;
          }}
          onMouseLeave={e => {
            (e.currentTarget as any).style.color = T.text2;
          }}
        >
          {expanded ? 'Collapse' : 'Edit'}
        </button>
      )}
    </div>
  );
}

export default EmailScreen;
