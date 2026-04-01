/**
 * BillingScreen — Build 020
 *
 * Route: /projects/:id/billing
 *
 * Stripe integration for subscription and one-time billing.
 * Configure publishable key, webhook secret.
 * Create and manage billing plans with name, price, and features.
 * Test mode amber banner when key starts with pk_test_.
 *
 * Contract: contracts/020-billing-monetization-READY.md
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import {
  getBillingConfig,
  enableBilling,
  saveBillingConfig,
  saveStripePublishableKey,
  saveStripeWebhookSecret,
  getBillingPlans,
  createBillingPlan,
  updateBillingPlan,
  deleteBillingPlan,
  detectStripeMode,
  parseFeatures,
  stringifyFeatures,
  type BillingPlan,
  type BillingModel,
} from '@/api/billing';
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

interface LocalBillingPlan extends BillingPlan {
  isSaving?: boolean;
  isDeleting?: boolean;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function BillingScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const { showToast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Config
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [billingModel, setBillingModel] = useState<BillingModel | null>(null);
  const [publishableKey, setPublishableKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Plans
  const [plans, setPlans] = useState<LocalBillingPlan[]>([]);
  const [addingPlan, setAddingPlan] = useState(false);

  // ── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);
      const [config, plansList] = await Promise.all([
        getBillingConfig(projectId!),
        getBillingPlans(projectId!),
      ]);

      setBillingEnabled(config.billing_enabled);
      setBillingModel(config.billing_model);
      setPublishableKey(config.stripe_publishable_key ?? '');
      setPlans(plansList);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load billing config', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleToggleBilling() {
    if (!projectId) return;
    try {
      setSaving(true);
      if (!billingEnabled) {
        // Enable with default model
        await enableBilling(projectId, 'subscription');
        setBillingEnabled(true);
        setBillingModel('subscription');
        showToast('Billing enabled', 'success');
      } else {
        // Disable
        await saveBillingConfig(projectId, { billing_enabled: false });
        setBillingEnabled(false);
        showToast('Billing disabled', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle billing', 'error');
      // Revert state
      setBillingEnabled(!billingEnabled);
    } finally {
      setSaving(false);
    }
  }

  async function handleSetBillingModel(model: BillingModel) {
    if (!projectId) return;
    try {
      setSaving(true);
      await saveBillingConfig(projectId, { billing_model: model });
      setBillingModel(model);
      showToast(`Billing model set to ${model}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update billing model', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStripeKeys() {
    if (!projectId) return;
    try {
      setSaving(true);
      if (publishableKey.trim()) {
        await saveStripePublishableKey(projectId, publishableKey);
      }
      if (webhookSecret.trim()) {
        await saveStripeWebhookSecret(projectId, webhookSecret);
      }
      showToast('Stripe keys saved', 'success');
      setWebhookSecret('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save Stripe keys', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPlan() {
    if (!projectId) return;
    try {
      setAddingPlan(true);
      const nextOrder = (plans.length > 0 ? Math.max(...plans.map(p => p.sort_order)) : 0) + 1;
      const newPlan = await createBillingPlan({
        project_id: projectId,
        plan_name: 'New Plan',
        stripe_price_id: null,
        monthly_price_cents: null,
        features: null,
        sort_order: nextOrder,
      });
      setPlans([...plans, newPlan]);
      showToast('Plan added', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add plan', 'error');
    } finally {
      setAddingPlan(false);
    }
  }

  async function handleUpdatePlan(
    planId: string,
    patch: Partial<Omit<BillingPlan, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
  ) {
    try {
      setPlans(plns =>
        plns.map(p =>
          p.id === planId ? { ...p, isSaving: true } : p
        )
      );

      await updateBillingPlan(planId, patch);

      setPlans(plns =>
        plns.map(p =>
          p.id === planId ? { ...p, ...patch, isSaving: false } : p
        )
      );

      showToast('Plan saved', 'success');
    } catch (err) {
      setPlans(plns =>
        plns.map(p =>
          p.id === planId ? { ...p, isSaving: false } : p
        )
      );
      showToast(err instanceof Error ? err.message : 'Failed to update plan', 'error');
    }
  }

  async function handleDeletePlan(planId: string) {
    try {
      setPlans(plns =>
        plns.map(p =>
          p.id === planId ? { ...p, isDeleting: true } : p
        )
      );

      await deleteBillingPlan(planId);

      setPlans(plns =>
        plns.filter(p => p.id !== planId)
      );

      showToast('Plan deleted', 'success');
    } catch (err) {
      setPlans(plns =>
        plns.map(p =>
          p.id === planId ? { ...p, isDeleting: false } : p
        )
      );
      showToast(err instanceof Error ? err.message : 'Failed to delete plan', 'error');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div data-testid="billing-screen" style={{ padding: '24px' }}>
        <p style={{ color: T.text2 }}>Loading...</p>
      </div>
    );
  }

  const stripeMode = detectStripeMode(publishableKey);
  const isTestMode = stripeMode === 'test';

  return (
    <div
      data-testid="billing-screen"
      style={{
        padding: '24px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: T.text, margin: 0 }}>
          Billing & Monetization
        </h1>
        <p style={{ fontSize: 14, color: T.text2, margin: '8px 0 0' }}>
          Configure Stripe to enable subscription and one-time payments.
        </p>
      </div>

      {/* Test Mode Banner */}
      {isTestMode && publishableKey && (
        <div
          data-testid="test-mode-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: `rgba(255, 159, 10, 0.15)`,
            border: `1px solid ${T.orange}`,
            borderRadius: 12,
            marginBottom: '24px',
          }}
        >
          <AlertCircle size={18} style={{ color: T.orange, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: '0 0 2px' }}>
              Test Mode Active
            </p>
            <p style={{ fontSize: 12, color: T.text2, margin: 0 }}>
              This project is in test mode. Charges will not be processed.
            </p>
          </div>
        </div>
      )}

      {/* Enable Billing Section */}
      <div
        style={{
          padding: '20px',
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          marginBottom: '32px',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, margin: '0 0 12px' }}>
          Billing Status
        </h3>

        {/* Enable Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '16px' }}>
          <button
            data-testid="billing-enabled-toggle"
            onClick={handleToggleBilling}
            disabled={saving}
            style={{
              position: 'relative',
              width: 48,
              height: 28,
              background: billingEnabled ? T.green : T.surface2,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: 'background 150ms',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: billingEnabled ? 24 : 2,
                width: 24,
                height: 24,
                background: '#fff',
                borderRadius: 12,
                transition: 'left 150ms',
              }}
            />
          </button>
          <span style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>
            {billingEnabled ? 'Billing Enabled' : 'Billing Disabled'}
          </span>
        </div>

        {/* Billing Model Selector */}
        {billingEnabled && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.text2, margin: '0 0 8px', textTransform: 'uppercase' }}>
              Billing Model
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                data-testid="billing-model-subscription"
                onClick={() => handleSetBillingModel('subscription')}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: billingModel === 'subscription' ? T.accent : T.surface2,
                  color: billingModel === 'subscription' ? '#fff' : T.text,
                  border: `1px solid ${billingModel === 'subscription' ? T.accent : T.border}`,
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Subscription
              </button>
              <button
                data-testid="billing-model-one_time"
                onClick={() => handleSetBillingModel('one_time')}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: billingModel === 'one_time' ? T.accent : T.surface2,
                  color: billingModel === 'one_time' ? '#fff' : T.text,
                  border: `1px solid ${billingModel === 'one_time' ? T.accent : T.border}`,
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                One-Time
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stripe Keys Section */}
      <div
        style={{
          padding: '20px',
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          marginBottom: '32px',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, margin: '0 0 16px' }}>
          Stripe Configuration
        </h3>

        {/* Publishable Key */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="stripe-pub-key"
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 6 }}
          >
            Publishable Key
          </label>
          <input
            id="stripe-pub-key"
            data-testid="stripe-publishable-key-input"
            type="text"
            value={publishableKey}
            onChange={e => setPublishableKey(e.target.value)}
            disabled={saving}
            placeholder="pk_test_... or pk_live_..."
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
          <p style={{ fontSize: 12, color: T.text2, margin: '6px 0 0' }}>
            Safe to display — starts with pk_test_ or pk_live_
          </p>
        </div>

        {/* Webhook Secret */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="stripe-webhook-secret"
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 6 }}
          >
            Webhook Secret
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="stripe-webhook-secret"
              data-testid="stripe-webhook-secret-input"
              type={showWebhookSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={e => setWebhookSecret(e.target.value)}
              disabled={saving}
              placeholder="whsec_..."
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
              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
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
              {showWebhookSecret ? 'Hide' : 'Show'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: T.text2, margin: '6px 0 0' }}>
            Server-side only — never shared with client
          </p>
        </div>

        {/* Save Button */}
        <button
          data-testid="save-stripe-keys-btn"
          onClick={handleSaveStripeKeys}
          disabled={saving || (!publishableKey.trim() && !webhookSecret.trim())}
          style={{
            padding: '10px 16px',
            background: T.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving || (!publishableKey.trim() && !webhookSecret.trim()) ? 'not-allowed' : 'pointer',
            opacity: saving || (!publishableKey.trim() && !webhookSecret.trim()) ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          {saving ? 'Saving...' : 'Save Stripe Keys'}
        </button>
      </div>

      {/* Billing Plans Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, margin: 0 }}>
            Billing Plans
          </h3>
          <button
            data-testid="add-plan-btn"
            onClick={handleAddPlan}
            disabled={!billingEnabled || addingPlan}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: T.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: !billingEnabled || addingPlan ? 'not-allowed' : 'pointer',
              opacity: !billingEnabled || addingPlan ? 0.6 : 1,
            }}
          >
            <Plus size={14} />
            {addingPlan ? 'Adding...' : 'Add Plan'}
          </button>
        </div>

        {!billingEnabled && (
          <div
            style={{
              padding: '16px',
              background: `rgba(255, 69, 58, 0.1)`,
              border: `1px solid ${T.red}`,
              borderRadius: 8,
              marginBottom: '16px',
            }}
          >
            <p style={{ fontSize: 13, color: T.text, margin: 0 }}>
              Enable billing above to manage plans.
            </p>
          </div>
        )}

        {/* Plans Grid */}
        <div
          data-testid="billing-plans-list"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {plans.map((plan, idx) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              index={idx}
              isEnabled={billingEnabled}
              onUpdate={handleUpdatePlan}
              onDelete={handleDeletePlan}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PlanCard Component ─────────────────────────────────────────────────────

interface PlanCardProps {
  plan: LocalBillingPlan;
  index: number;
  isEnabled: boolean;
  onUpdate: (id: string, patch: Partial<BillingPlan>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function PlanCard({ plan, index, isEnabled, onUpdate, onDelete }: PlanCardProps) {
  const [features, setFeatures] = useState(parseFeatures(plan.features));

  const testidBase = `plan-card-${index}`;

  return (
    <div
      data-testid={testidBase}
      style={{
        padding: '16px',
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        opacity: isEnabled ? 1 : 0.5,
        transition: 'opacity 150ms',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            data-testid={`plan-name-input-${index}`}
            type="text"
            value={plan.plan_name}
            onChange={e => onUpdate(plan.id, { plan_name: e.target.value })}
            disabled={plan.isSaving || plan.isDeleting || !isEnabled}
            placeholder="Plan name"
            style={{
              width: '100%',
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              color: T.text,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              opacity: plan.isSaving || plan.isDeleting ? 0.6 : 1,
              cursor: plan.isSaving || plan.isDeleting || !isEnabled ? 'default' : 'text',
            }}
          />
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(plan.id)}
          disabled={plan.isSaving || plan.isDeleting || !isEnabled}
          style={{
            padding: '6px',
            background: T.surface2,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            color: T.red,
            cursor: plan.isSaving || plan.isDeleting || !isEnabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: plan.isSaving || plan.isDeleting ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Price */}
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
          Monthly Price (cents)
        </label>
        <input
          data-testid={`plan-price-input-${index}`}
          type="number"
          value={plan.monthly_price_cents ?? ''}
          onChange={e =>
            onUpdate(plan.id, {
              monthly_price_cents: e.target.value ? parseInt(e.target.value, 10) : null,
            })
          }
          disabled={plan.isSaving || plan.isDeleting || !isEnabled}
          placeholder="0"
          style={{
            width: '100%',
            padding: '8px 10px',
            background: T.surface2,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            color: T.text,
            fontSize: 13,
            fontFamily: 'inherit',
            opacity: plan.isSaving || plan.isDeleting ? 0.6 : 1,
            cursor: plan.isSaving || plan.isDeleting || !isEnabled ? 'default' : 'text',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Stripe Price ID */}
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
          Stripe Price ID
        </label>
        <input
          type="text"
          value={plan.stripe_price_id ?? ''}
          onChange={e =>
            onUpdate(plan.id, {
              stripe_price_id: e.target.value || null,
            })
          }
          disabled={plan.isSaving || plan.isDeleting || !isEnabled}
          placeholder="price_..."
          style={{
            width: '100%',
            padding: '8px 10px',
            background: T.surface2,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            color: T.text,
            fontSize: 13,
            fontFamily: 'inherit',
            opacity: plan.isSaving || plan.isDeleting ? 0.6 : 1,
            cursor: plan.isSaving || plan.isDeleting || !isEnabled ? 'default' : 'text',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Features */}
      <div>
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
          Features (one per line)
        </label>
        <textarea
          data-testid={`plan-features-input-${index}`}
          value={features.join('\n')}
          onChange={e => {
            const newFeatures = e.target.value.split('\n').filter(f => f.trim());
            setFeatures(newFeatures);
            onUpdate(plan.id, { features: stringifyFeatures(newFeatures) });
          }}
          disabled={plan.isSaving || plan.isDeleting || !isEnabled}
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '10px',
            background: T.surface2,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            color: T.text,
            fontSize: 13,
            fontFamily: 'inherit',
            opacity: plan.isSaving || plan.isDeleting ? 0.6 : 1,
            resize: 'vertical',
            boxSizing: 'border-box',
            cursor: plan.isSaving || plan.isDeleting || !isEnabled ? 'default' : 'text',
          }}
        />
      </div>
    </div>
  );
}

export default BillingScreen;
