/**
 * UsageScreen — Build 023
 *
 * Route: /projects/:id/usage
 *
 * Token usage and cost tracking dashboard:
 *   - Total monthly cost display
 *   - Budget management (set/clear monthly limit)
 *   - Per-model cost breakdown (donut-style visualization)
 *   - Per-feature usage table with costs
 *   - Budget status banners (warning at 80%, over at 100%)
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getProjectTokenUsage,
  getTokenUsageByModel,
  setMonthlyBudget,
  calculateCostUsd,
  totalCostUsd,
  deriveBudgetStatus,
  type TokenUsageRow,
  type TokenUsageByModel,
} from '@/api/usage';
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

export default function UsageScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [tokenUsage, setTokenUsage] = useState<TokenUsageRow[]>([]);
  const [modelUsage, setModelUsage] = useState<TokenUsageByModel[]>([]);
  const [monthlyBudgetUsd, setMonthlyBudgetUsd] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load usage data on mount
  useEffect(() => {
    async function init() {
      if (!projectId) return;
      try {
        const [usage, models] = await Promise.all([
          getProjectTokenUsage(projectId),
          getTokenUsageByModel(projectId),
        ]);
        setTokenUsage(usage);
        setModelUsage(models);
      } catch (err) {
        console.error('Failed to load token usage:', err);
        showToast('Failed to load token usage', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId, showToast]);

  const totalCost = totalCostUsd(modelUsage);
  const totalCostCents = Math.round(totalCost * 100);
  const budgetStatus = deriveBudgetStatus(totalCostCents, monthlyBudgetUsd !== null ? Math.round(monthlyBudgetUsd * 100) : null);

  const handleSetBudget = async () => {
    if (!projectId || !budgetInput) return;
    const budgetUsd = parseFloat(budgetInput);
    if (isNaN(budgetUsd) || budgetUsd <= 0) {
      showToast('Please enter a valid budget', 'error');
      return;
    }
    setSaving(true);
    try {
      await setMonthlyBudget(projectId, budgetUsd);
      setMonthlyBudgetUsd(budgetUsd);
      setBudgetInput('');
      showToast('Budget updated', 'success');
    } catch (err) {
      console.error('Failed to set budget:', err);
      showToast('Failed to set budget', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearBudget = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      await setMonthlyBudget(projectId, null);
      setMonthlyBudgetUsd(null);
      setBudgetInput('');
      showToast('Budget cleared', 'success');
    } catch (err) {
      console.error('Failed to clear budget:', err);
      showToast('Failed to clear budget', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', color: T.text }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
          Token Usage
        </div>
        <div style={{ color: T.text2 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px' }}>
      {/* Header with total cost */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: T.text, marginBottom: '8px' }}>
          Token Usage
        </div>
        <div style={{ fontSize: '32px', fontWeight: '700', color: T.text }} data-testid="total-cost-display">
          ${totalCost.toFixed(2)}
          <span style={{ fontSize: '16px', color: T.text2, marginLeft: '8px' }}>this month</span>
        </div>
      </div>

      {/* Budget Status Banner */}
      {budgetStatus !== 'ok' && monthlyBudgetUsd !== null && (
        <div
          style={{
            backgroundColor: budgetStatus === 'over' ? `${T.red}20` : `${T.orange}20`,
            border: `1px solid ${budgetStatus === 'over' ? T.red : T.orange}`,
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '24px',
            fontSize: '14px',
            color: budgetStatus === 'over' ? T.red : T.orange,
            fontWeight: '500',
          }}
          data-testid="budget-status-banner"
        >
          {budgetStatus === 'over' ? 'Over budget' : 'Approaching budget limit'} (
          {((totalCostCents / (Math.round(monthlyBudgetUsd * 100) || 1)) * 100).toFixed(0)}%)
        </div>
      )}

      {/* Budget Management */}
      <div
        style={{
          backgroundColor: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: '600', color: T.text, marginBottom: '12px' }}>
          Monthly Budget
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', color: T.text2, marginBottom: '6px' }}>
              Max spend per month
            </label>
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder={monthlyBudgetUsd ? `$${monthlyBudgetUsd.toFixed(2)}` : '$0.00'}
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
              data-testid="budget-input"
              step="0.01"
              min="0"
            />
          </div>
          <button
            onClick={handleSetBudget}
            disabled={saving || !budgetInput}
            style={{
              padding: '10px 16px',
              backgroundColor: T.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: saving || !budgetInput ? 'not-allowed' : 'pointer',
              opacity: saving || !budgetInput ? 0.6 : 1,
            }}
            data-testid="set-budget-btn"
          >
            Set
          </button>
          {monthlyBudgetUsd !== null && (
            <button
              onClick={handleClearBudget}
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
              data-testid="clear-budget-btn"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Model Breakdown */}
      {modelUsage.length > 0 && (
        <div
          style={{
            backgroundColor: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px',
          }}
          data-testid="model-breakdown-section"
        >
          <div style={{ fontSize: '14px', fontWeight: '600', color: T.text, marginBottom: '16px' }}>
            Cost by Model
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {modelUsage.map((row) => {
              const cost = calculateCostUsd(row.model, row.total_input_tokens, row.total_output_tokens);
              const percent = totalCost > 0 ? (cost / totalCost) * 100 : 0;
              return (
                <div key={row.model} data-testid={`model-row-${row.model}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: T.text, fontWeight: '500' }}>
                      {row.model.replace('claude-', '').replace('-20251001', '')}
                    </span>
                    <span style={{ fontSize: '13px', color: T.text, fontWeight: '600' }}>
                      ${cost.toFixed(2)} ({percent.toFixed(0)}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: T.surface2,
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: T.accent,
                        width: `${percent}%`,
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feature Usage Table */}
      {tokenUsage.length > 0 ? (
        <div
          style={{
            backgroundColor: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: '8px',
            overflow: 'hidden',
          }}
          data-testid="feature-usage-table"
        >
          <div style={{ padding: '16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: T.text }}>
              Feature Usage
            </div>
          </div>

          <div>
            {tokenUsage.map((row, idx) => {
              const cost = calculateCostUsd(
                row.models_used.split(',')[0], // Use first model as proxy for display
                row.total_input_tokens,
                row.total_output_tokens
              );
              return (
                <div
                  key={row.feature_id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: idx < tokenUsage.length - 1 ? `1px solid ${T.border}` : 'none',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: '16px',
                    alignItems: 'center',
                    fontSize: '13px',
                  }}
                  data-testid={`feature-usage-row-${idx}`}
                >
                  <div>
                    <div style={{ color: T.text, fontWeight: '500' }} data-testid={`feature-name-${idx}`}>
                      {row.feature_name}
                    </div>
                  </div>
                  <div style={{ color: T.text2 }}>
                    {row.total_input_tokens.toLocaleString()} / {row.total_output_tokens.toLocaleString()}
                  </div>
                  <div style={{ color: T.text2 }}>{row.models_used}</div>
                  <div style={{ textAlign: 'right', color: T.text, fontWeight: '500' }} data-testid={`feature-cost-${idx}`}>
                    ${cost.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
            color: T.text2,
          }}
          data-testid="usage-empty-state"
        >
          No token usage yet
        </div>
      )}
    </div>
  );
}
