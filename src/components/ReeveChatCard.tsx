/**
 * ReeveChatCard — Build 048
 *
 * Renders an inline action card inside PmChatPanel when
 * `pm_chat_messages.card_type !== 'text'`.
 *
 * One component, one layout. Responsive from 375px upward — no viewport
 * checks, no mobile-only branches. Inline actions are the default for every
 * card type except qa_blocked (deep link, builder needs to read the notes first).
 *
 * Card variants:
 *   design_approval  — inline Approve Design ✓
 *   human_task       — inline Mark done + optional Settings →
 *   qa_complete      — inline Ship to production
 *   qa_blocked       — deep link to report (Finn is already on the fix)
 *   feature_shipped  — informational, live URL
 *   daily_briefing   — informational, recommended action
 *
 * data-testid inventory:
 *   reeve-chat-card                       — outer card wrapper
 *   reeve-card-design-approval            — design_approval variant
 *   reeve-card-human-task                 — human_task variant
 *   reeve-card-qa-complete                — qa_complete variant
 *   reeve-card-qa-blocked                 — qa_blocked variant
 *   reeve-card-feature-shipped            — feature_shipped variant
 *   reeve-card-daily-briefing             — daily_briefing variant
 *   reeve-card-approve-design-btn         — approve design action
 *   reeve-card-mark-done-btn              — mark human task done
 *   reeve-card-ship-btn                   — ship to production
 *   reeve-card-view-report-link           — view qa_blocked report
 *   reeve-card-view-mockup-link           — view design mockup
 *   reeve-card-settings-link              — settings deep link on human_task
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { supabase } from '@/lib/supabase';
import { approveDesign } from '@/api/featureWorkflow';
import { pushToProduction } from '@/api/projects';
import type {
  PmChatMessage,
  DesignApprovalPayload,
  HumanTaskPayload,
  QaCompletePayload,
  QaBlockedPayload,
  FeatureShippedPayload,
  DailyBriefingCardPayload,
} from '@/types/db';

// ── Design tokens ──────────────────────────────────────────────────────────

const T = {
  radius:       10,
  border:       '1px solid',
  cardPad:      '12px 14px',
  labelSize:    11,
  bodySize:     13,
  actionSize:   12,
  // colours per variant
  design:  { border: '#C7D2FE', bg: '#EEF2FF', accent: '#4338CA', label: '#4338CA' },
  task:    { border: '#FED7AA', bg: '#FFF7ED', accent: '#EA580C', label: '#92400E' },
  qa_ok:   { border: '#BBF7D0', bg: '#F0FDF4', accent: '#16A34A', label: '#15803D' },
  qa_bad:  { border: '#FDE68A', bg: '#FFFBEB', accent: '#D97706', label: '#92400E' },
  shipped: { border: '#BBF7D0', bg: '#F0FDF4', accent: '#16A34A', label: '#15803D' },
  briefing:{ border: '#E0E7FF', bg: '#F5F3FF', accent: '#6D28D9', label: '#4338CA' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  P0: { bg: '#FEE2E2', text: '#DC2626' },
  P1: { bg: '#FED7AA', text: '#EA580C' },
  P2: { bg: '#FEF9C3', text: '#CA8A04' },
  P3: { bg: '#F1F5F9', text: '#64748B' },
};

// ── Shared action button ───────────────────────────────────────────────────

function ActionBtn({
  testId, onClick, disabled, loading, children, accent, outline,
}: {
  testId:   string;
  onClick:  () => void;
  disabled: boolean;
  loading:  boolean;
  children: React.ReactNode;
  accent:   string;
  outline?: boolean;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:         '5px 12px',
        borderRadius:    7,
        border:          outline ? `1px solid ${accent}` : 'none',
        backgroundColor: outline ? 'transparent' : accent,
        color:           outline ? accent : '#fff',
        fontSize:        T.actionSize,
        fontWeight:      700,
        cursor:          disabled ? 'not-allowed' : 'pointer',
        opacity:         disabled ? 0.5 : 1,
        transition:      'opacity 0.15s',
        flexShrink:      0,
      }}
    >
      {loading ? '…' : children}
    </button>
  );
}

// ── Done badge ─────────────────────────────────────────────────────────────

function DoneBadge({ color }: { color: string }) {
  return (
    <span style={{
      fontSize:        T.actionSize,
      fontWeight:      700,
      color,
      display:         'flex',
      alignItems:      'center',
      gap:             4,
    }}>
      ✓ Done
    </span>
  );
}

// ── design_approval card ───────────────────────────────────────────────────

function DesignApprovalCard({ payload, projectId }: {
  payload:   DesignApprovalPayload;
  projectId: string;
}) {
  const c = T.design;
  const [done,    setDone]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;
      await approveDesign(payload.step_id, userId);
      setDone(true);
    } catch (err) {
      console.error('Approve design error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="reeve-card-design-approval"
      style={{
        border: `${T.border} ${c.border}`, borderRadius: T.radius,
        backgroundColor: c.bg, padding: T.cardPad,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Avatar member="morgan" size="xs" />
        <span style={{ fontSize: T.labelSize, fontWeight: 700, color: c.label, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Design ready · {payload.feature_name}
        </span>
      </div>

      {/* Morgan summary */}
      <p style={{ margin: '0 0 10px', fontSize: T.bodySize, color: '#334155', lineHeight: 1.55 }}>
        {payload.morgan_summary}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {done ? (
          <DoneBadge color={c.accent} />
        ) : (
          <ActionBtn
            testId="reeve-card-approve-design-btn"
            onClick={handleApprove}
            disabled={done || loading}
            loading={loading}
            accent={c.accent}
          >
            Approve Design ✓
          </ActionBtn>
        )}
        {payload.mockup_url && (
          <a
            data-testid="reeve-card-view-mockup-link"
            href={payload.mockup_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: T.actionSize, color: c.accent, fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            View mockup →
          </a>
        )}
      </div>
    </div>
  );
}

// ── human_task card ────────────────────────────────────────────────────────

function HumanTaskCard({ payload }: { payload: HumanTaskPayload }) {
  const c     = T.task;
  const pc    = PRIORITY_COLORS[payload.priority] ?? PRIORITY_COLORS.P3;
  const nav   = useNavigate();
  const [done,    setDone]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleMarkDone = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('human_tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', payload.task_id);
      if (error) throw error;
      setDone(true);
    } catch (err) {
      console.error('Mark task done error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="reeve-card-human-task"
      style={{
        border: `${T.border} ${c.border}`, borderRadius: T.radius,
        backgroundColor: c.bg, padding: T.cardPad,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: T.labelSize, fontWeight: 700,
          backgroundColor: pc.bg, color: pc.text,
          padding: '2px 6px', borderRadius: 4,
        }}>
          {payload.priority}
        </span>
        <span style={{ fontSize: T.labelSize, fontWeight: 700, color: c.label, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Action required
        </span>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: T.bodySize, color: '#334155', lineHeight: 1.55 }}>
        {payload.description}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {done ? (
          <DoneBadge color={c.accent} />
        ) : (
          <ActionBtn
            testId="reeve-card-mark-done-btn"
            onClick={handleMarkDone}
            disabled={done || loading}
            loading={loading}
            accent={c.accent}
          >
            Mark done
          </ActionBtn>
        )}
        {payload.settings_deep_link && (
          <button
            data-testid="reeve-card-settings-link"
            onClick={() => nav(payload.settings_deep_link!)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: T.actionSize, color: c.accent, fontWeight: 600,
              padding: 0,
            }}
          >
            Settings →
          </button>
        )}
      </div>
    </div>
  );
}

// ── qa_complete card ───────────────────────────────────────────────────────

function QaCompleteCard({ payload, projectId }: {
  payload:   QaCompletePayload;
  projectId: string;
}) {
  const c = T.qa_ok;
  const [done,    setDone]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShip = async () => {
    setLoading(true);
    try {
      await pushToProduction({ project_id: projectId });
      setDone(true);
    } catch (err) {
      console.error('Ship to production error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="reeve-card-qa-complete"
      style={{
        border: `${T.border} ${c.border}`, borderRadius: T.radius,
        backgroundColor: c.bg, padding: T.cardPad,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <span style={{ fontSize: T.labelSize, fontWeight: 700, color: c.label, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          QA passed · {payload.feature_name}
        </span>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: T.bodySize, color: '#334155', lineHeight: 1.55 }}>
        {payload.pass_count} test{payload.pass_count !== 1 ? 's' : ''} passed. Ready to ship.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {done ? (
          <DoneBadge color={c.accent} />
        ) : (
          <ActionBtn
            testId="reeve-card-ship-btn"
            onClick={handleShip}
            disabled={done || loading}
            loading={loading}
            accent={c.accent}
          >
            Ship to production
          </ActionBtn>
        )}
        <a
          href={payload.report_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: T.actionSize, color: c.accent, fontWeight: 600, textDecoration: 'none' }}
        >
          View report →
        </a>
      </div>
    </div>
  );
}

// ── qa_blocked card ────────────────────────────────────────────────────────

function QaBlockedCard({ payload }: { payload: QaBlockedPayload }) {
  const c = T.qa_bad;

  return (
    <div
      data-testid="reeve-card-qa-blocked"
      style={{
        border: `${T.border} ${c.border}`, borderRadius: T.radius,
        backgroundColor: c.bg, padding: T.cardPad,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span style={{ fontSize: T.labelSize, fontWeight: 700, color: c.label, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          QA blocked · {payload.feature_name}
        </span>
      </div>

      <p style={{ margin: '0 0 4px', fontSize: T.bodySize, color: '#334155', lineHeight: 1.55 }}>
        {payload.fail_count} test{payload.fail_count !== 1 ? 's' : ''} failed. Finn has been notified to fix it.
      </p>
      <p style={{ margin: '0 0 10px', fontSize: T.bodySize - 1, color: '#78716C', lineHeight: 1.4 }}>
        Read Quinn's notes to understand what broke before Finn's fix lands.
      </p>

      <a
        data-testid="reeve-card-view-report-link"
        href={payload.report_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          gap:             4,
          padding:         '5px 12px',
          borderRadius:    7,
          border:          `1px solid ${c.accent}`,
          backgroundColor: 'transparent',
          color:           c.accent,
          fontSize:        T.actionSize,
          fontWeight:      700,
          textDecoration:  'none',
        }}
      >
        View failure report →
      </a>
    </div>
  );
}

// ── feature_shipped card ───────────────────────────────────────────────────

function FeatureShippedCard({ payload }: { payload: FeatureShippedPayload }) {
  const c = T.shipped;

  return (
    <div
      data-testid="reeve-card-feature-shipped"
      style={{
        border: `${T.border} ${c.border}`, borderRadius: T.radius,
        backgroundColor: c.bg, padding: T.cardPad,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🚀</span>
        <span style={{ fontSize: T.labelSize, fontWeight: 700, color: c.label, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Shipped
        </span>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: T.bodySize, color: '#334155', lineHeight: 1.55 }}>
        <strong>{payload.feature_name}</strong> is live.
      </p>

      <a
        href={payload.live_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: T.actionSize, color: c.accent, fontWeight: 600, textDecoration: 'none' }}
      >
        {payload.live_url} →
      </a>
    </div>
  );
}

// ── daily_briefing card ────────────────────────────────────────────────────

function DailyBriefingCardVariant({ payload }: { payload: DailyBriefingCardPayload }) {
  const c = T.briefing;

  return (
    <div
      data-testid="reeve-card-daily-briefing"
      style={{
        border: `${T.border} ${c.border}`, borderRadius: T.radius,
        backgroundColor: c.bg, padding: T.cardPad,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Avatar member="reeve" size="xs" />
        <span style={{ fontSize: T.labelSize, fontWeight: 700, color: c.label, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Daily briefing
        </span>
      </div>
      {payload.recommended_action && (
        <p style={{ margin: 0, fontSize: T.bodySize, color: '#3730A3', lineHeight: 1.55 }}>
          {payload.recommended_action}
        </p>
      )}
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

interface ReeveChatCardProps {
  message:   PmChatMessage;
  projectId: string;
}

export default function ReeveChatCard({ message, projectId }: ReeveChatCardProps) {
  const { card_type, action_payload } = message;

  return (
    <div
      data-testid="reeve-chat-card"
      style={{ marginBottom: 12 }}
    >
      {card_type === 'design_approval' && action_payload && (
        <DesignApprovalCard
          payload={action_payload as DesignApprovalPayload}
          projectId={projectId}
        />
      )}
      {card_type === 'human_task' && action_payload && (
        <HumanTaskCard payload={action_payload as HumanTaskPayload} />
      )}
      {card_type === 'qa_complete' && action_payload && (
        <QaCompleteCard
          payload={action_payload as QaCompletePayload}
          projectId={projectId}
        />
      )}
      {card_type === 'qa_blocked' && action_payload && (
        <QaBlockedCard payload={action_payload as QaBlockedPayload} />
      )}
      {card_type === 'feature_shipped' && action_payload && (
        <FeatureShippedCard payload={action_payload as FeatureShippedPayload} />
      )}
      {card_type === 'daily_briefing' && (
        <DailyBriefingCardVariant
          payload={(action_payload as DailyBriefingCardPayload) ?? {}}
        />
      )}
    </div>
  );
}
