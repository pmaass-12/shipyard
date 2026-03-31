/**
 * AdSenseScreen — Build 028
 *
 * Route: /projects/:id/adsense
 *
 * Google AdSense monetization setup and management:
 *   - 4 states: not-configured, pending-review, active, preview (UI-only)
 *   - Setup form with Publisher ID and 3 ad unit inputs
 *   - 3 placement cards: Leaderboard (728×90), Rectangle (336×280), Footer (320×50/728×90)
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getAdSenseConfig,
  saveAdSenseConfig,
  submitForAdSenseReview,
  activateAdSense,
  type AdSenseConfig,
} from '@/api/adsense';
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

export default function AdSenseScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [config, setConfig] = useState<AdSenseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activating, setActivating] = useState(false);

  const [formData, setFormData] = useState({
    publisher_id: '',
    leaderboard_ad_unit_id: '',
    rectangle_ad_unit_id: '',
    footer_ad_unit_id: '',
  });

  // Load config on mount
  useEffect(() => {
    async function init() {
      if (!projectId) return;
      try {
        const data = await getAdSenseConfig(projectId);
        if (data) {
          setConfig(data);
          setFormData({
            publisher_id: data.publisher_id || '',
            leaderboard_ad_unit_id: data.leaderboard_ad_unit_id || '',
            rectangle_ad_unit_id: data.rectangle_ad_unit_id || '',
            footer_ad_unit_id: data.footer_ad_unit_id || '',
          });
        } else {
          setConfig({
            id: '',
            project_id: projectId,
            publisher_id: null,
            leaderboard_ad_unit_id: null,
            rectangle_ad_unit_id: null,
            footer_ad_unit_id: null,
            status: 'not_configured',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to load AdSense config:', err);
        showToast('Failed to load AdSense settings', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId, showToast]);

  const handleSaveConfig = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const updated = await saveAdSenseConfig(projectId, {
        publisher_id: formData.publisher_id || null,
        leaderboard_ad_unit_id: formData.leaderboard_ad_unit_id || null,
        rectangle_ad_unit_id: formData.rectangle_ad_unit_id || null,
        footer_ad_unit_id: formData.footer_ad_unit_id || null,
        status: 'not_configured',
      });
      setConfig(updated);
      showToast('AdSense config saved', 'success');
    } catch (err) {
      console.error('Failed to save AdSense config:', err);
      showToast('Failed to save AdSense config', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!projectId) return;
    setSubmitting(true);
    try {
      await submitForAdSenseReview(projectId);
      if (config) {
        setConfig({ ...config, status: 'pending_review' });
      }
      showToast('Submitted for Google AdSense review', 'success');
    } catch (err) {
      console.error('Failed to submit for review:', err);
      showToast('Failed to submit for review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async () => {
    if (!projectId) return;
    setActivating(true);
    try {
      await activateAdSense(projectId);
      if (config) {
        setConfig({ ...config, status: 'active' });
      }
      showToast('AdSense activated', 'success');
    } catch (err) {
      console.error('Failed to activate AdSense:', err);
      showToast('Failed to activate AdSense', 'error');
    } finally {
      setActivating(false);
    }
  };

  if (loading || !config) {
    return (
      <div style={{ padding: '24px', color: T.text }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
          AdSense Monetization
        </div>
        <div style={{ color: T.text2 }}>Loading...</div>
      </div>
    );
  }

  const isNotConfigured = config.status === 'not_configured';
  const isPendingReview = config.status === 'pending_review';
  const isActive = config.status === 'active';
  const isPreview = !config.publisher_id && isNotConfigured;

  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: T.text }}>
          AdSense Monetization
        </div>
        <div
          style={{
            display: 'inline-block',
            padding: '0 8px',
            paddingTop: '4px', paddingBottom: '4px',
            backgroundColor:
              isActive ? T.green : isPendingReview ? T.orange : T.surface3,
            color: isActive ? '#000' : isPendingReview ? '#000' : T.text2,
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
          }}
          data-testid="adsense-status-badge"
        >
          {isActive ? 'Active' : isPendingReview ? 'Pending Review' : 'Not Configured'}
        </div>
      </div>

      {/* Not Configured State */}
      {isNotConfigured && (
        <div data-testid="adsense-not-configured">
          <div
            style={{
              backgroundColor: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: '600', color: T.text, marginBottom: '20px' }}>
              Setup AdSense
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: T.text, fontWeight: '500' }}>
                Publisher ID
              </label>
              <input
                type="text"
                value={formData.publisher_id}
                onChange={(e) => setFormData({ ...formData, publisher_id: e.target.value })}
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
                data-testid="publisher-id-input"
                placeholder="ca-pub-xxxxxxxxxxxxxxxx"
              />
              <div style={{ fontSize: '12px', color: T.text2, marginTop: '6px' }}>
                Found in your Google AdSense account
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: T.text, fontWeight: '500' }}>
                Leaderboard Ad Unit ID (728×90)
              </label>
              <input
                type="text"
                value={formData.leaderboard_ad_unit_id}
                onChange={(e) => setFormData({ ...formData, leaderboard_ad_unit_id: e.target.value })}
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
                data-testid="leaderboard-ad-unit-input"
                placeholder="e.g., 1234567890"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: T.text, fontWeight: '500' }}>
                Rectangle Ad Unit ID (336×280)
              </label>
              <input
                type="text"
                value={formData.rectangle_ad_unit_id}
                onChange={(e) => setFormData({ ...formData, rectangle_ad_unit_id: e.target.value })}
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
                data-testid="rectangle-ad-unit-input"
                placeholder="e.g., 1234567890"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: T.text, fontWeight: '500' }}>
                Footer Ad Unit ID (320×50 / 728×90)
              </label>
              <input
                type="text"
                value={formData.footer_ad_unit_id}
                onChange={(e) => setFormData({ ...formData, footer_ad_unit_id: e.target.value })}
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
                data-testid="footer-ad-unit-input"
                placeholder="e.g., 1234567890"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                style={{
                  padding: '10px 16px',
                  backgroundColor: T.surface2,
                  color: T.text,
                  border: `1px solid ${T.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
                data-testid="save-adsense-config-btn"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
              {(formData.publisher_id || formData.leaderboard_ad_unit_id ||
                formData.rectangle_ad_unit_id || formData.footer_ad_unit_id) && (
                <button
                  onClick={handleSubmitForReview}
                  disabled={submitting || !formData.publisher_id}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: T.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: submitting || !formData.publisher_id ? 'not-allowed' : 'pointer',
                    opacity: submitting || !formData.publisher_id ? 0.6 : 1,
                  }}
                  data-testid="submit-for-review-btn"
                >
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              )}
            </div>
          </div>

          {/* Preview Cards */}
          {isPreview && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: T.text, marginBottom: '16px' }}>
                Ad Placement Preview
              </div>
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Leaderboard */}
                <div
                  style={{
                    backgroundColor: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                    minHeight: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  data-testid="placement-card-leaderboard"
                >
                  <div style={{ color: T.text2 }}>728×90 Leaderboard Ad</div>
                </div>

                {/* Rectangle */}
                <div
                  style={{
                    backgroundColor: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                    minHeight: '300px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  data-testid="placement-card-rectangle"
                >
                  <div style={{ color: T.text2 }}>336×280 Rectangle Ad</div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    backgroundColor: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                    minHeight: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  data-testid="placement-card-footer"
                >
                  <div style={{ color: T.text2 }}>320×50 / 728×90 Footer Ad</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Review State */}
      {isPendingReview && (
        <div data-testid="adsense-pending-review">
          <div
            style={{
              backgroundColor: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: '600', color: T.text, marginBottom: '12px' }}>
              Submitted for Review
            </div>
            <div style={{ color: T.text2, marginBottom: '20px' }}>
              Your AdSense configuration is under review by Google. This typically takes 24-48 hours.
            </div>
            <button
              onClick={handleActivate}
              disabled={activating}
              style={{
                padding: '10px 16px',
                backgroundColor: T.green,
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: activating ? 'not-allowed' : 'pointer',
                opacity: activating ? 0.6 : 1,
              }}
              data-testid="mark-active-btn"
            >
              {activating ? 'Activating...' : 'Mark as Active'}
            </button>
          </div>
        </div>
      )}

      {/* Active State */}
      {isActive && (
        <div data-testid="adsense-active">
          <div
            style={{
              backgroundColor: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '600', color: T.text, marginBottom: '12px' }}>
              Publisher ID
            </div>
            <div style={{ color: T.text2, marginBottom: '20px' }}>
              {config.publisher_id}
            </div>

            {config.leaderboard_ad_unit_id && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: T.text2 }}>Leaderboard Unit ID</div>
                <div style={{ color: T.text }}>{config.leaderboard_ad_unit_id}</div>
              </div>
            )}
            {config.rectangle_ad_unit_id && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: T.text2 }}>Rectangle Unit ID</div>
                <div style={{ color: T.text }}>{config.rectangle_ad_unit_id}</div>
              </div>
            )}
            {config.footer_ad_unit_id && (
              <div>
                <div style={{ fontSize: '12px', color: T.text2 }}>Footer Unit ID</div>
                <div style={{ color: T.text }}>{config.footer_ad_unit_id}</div>
              </div>
            )}
          </div>

          {/* Active Placement Cards */}
          <div style={{ fontSize: '14px', fontWeight: '600', color: T.text, marginBottom: '16px' }}>
            Ad Placements
          </div>
          <div style={{ display: 'grid', gap: '16px' }}>
            {config.leaderboard_ad_unit_id && (
              <div
                style={{
                  backgroundColor: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center',
                  minHeight: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: T.text2,
                }}
                data-testid="placement-card-leaderboard"
              >
                Leaderboard (728×90)
              </div>
            )}
            {config.rectangle_ad_unit_id && (
              <div
                style={{
                  backgroundColor: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center',
                  minHeight: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: T.text2,
                }}
                data-testid="placement-card-rectangle"
              >
                Rectangle (336×280)
              </div>
            )}
            {config.footer_ad_unit_id && (
              <div
                style={{
                  backgroundColor: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center',
                  minHeight: '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: T.text2,
                }}
                data-testid="placement-card-footer"
              >
                Footer (320×50 / 728×90)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
