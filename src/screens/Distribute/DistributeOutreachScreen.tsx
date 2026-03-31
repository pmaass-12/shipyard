/**
 * DistributeOutreachScreen — Build 047
 * Route: /projects/:id/distribute/outreach
 *
 * Two-panel layout: sequence list (left 260px) + sequence detail (right).
 * Email step cards with {{variable}} highlighting.
 * Approval queue at the bottom of the detail panel.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { OUTREACH_GOAL_STYLES } from '@/types/db';
import type { OutreachSequence, OutreachStep, OutreachEmail } from '@/types/db';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg: '#f5f5f7', surface: '#ffffff', border: '#e5e5ea',
  text: '#1c1c1e', muted: '#6e6e73', faint: '#aeaeb2',
  accent: '#4338ca', accentLight: '#eef2ff',
  amber: '#f59e0b', amberLight: '#fffbeb', amberBorder: '#fde68a',
  green: '#22c55e',
};

// ── Variable highlighting ──────────────────────────────────────────────────

function HighlightedBody({ text }: { text: string }) {
  const parts = text.split(/({{[^}]+}})/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (/^{{[^}]+}}$/.test(part)) {
          return (
            <span key={i} style={{
              background: '#ede9fe', color: '#5b21b6',
              borderRadius: 4, padding: '1px 5px',
              fontFamily: 'monospace', fontSize: '0.9em',
              fontWeight: 600,
            }}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ── Email Step Card ────────────────────────────────────────────────────────

function EmailStepCard({ step, index }: { step: OutreachStep; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 10, background: T.surface }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          background: open ? T.accentLight : T.surface,
          border: 'none', cursor: 'pointer', fontFamily: font, textAlign: 'left',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: T.accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {step.step_number}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            Email {step.step_number} — Day {step.delay_days}
            {step.purpose_note && <span style={{ marginLeft: 8, fontSize: 11, color: T.muted, fontWeight: 400 }}>{step.purpose_note}</span>}
          </div>
        </div>
        <button style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '3px 10px', fontSize: 11, color: T.muted, cursor: 'pointer', fontFamily: font }}>
          Edit
        </button>
        <span style={{ color: T.muted, fontSize: 14 }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ padding: '16px', borderTop: `1px solid ${T.border}` }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Subject</div>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>
              <HighlightedBody text={step.subject_template} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Body</div>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              <HighlightedBody text={step.body_template} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Approval Queue ─────────────────────────────────────────────────────────

function ApprovalQueue({ emails, onApprove, onApproveAll }: {
  emails: OutreachEmail[];
  onApprove: (id: string) => void;
  onApproveAll: () => void;
}) {
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const count = emails.length;

  return (
    <div style={{ marginTop: 28, borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: count > 0 ? 14 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>📬 Email Approval Queue</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            background: count > 0 ? T.amberLight : T.bg,
            color: count > 0 ? T.amber : T.faint,
            border: `1px solid ${count > 0 ? T.amberBorder : T.border}`,
          }}>
            {count} {count === 1 ? 'ready to review' : 'ready to review'}
          </span>
        </div>
        {count > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: T.muted }}>Reeve won't send until you approve</span>
            <button
              onClick={onApproveAll}
              style={{ padding: '7px 14px', borderRadius: 8, background: T.accent, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
            >
              Approve all {count} →
            </button>
          </div>
        )}
      </div>

      {count === 0 && (
        <div style={{ fontSize: 13, color: T.faint, fontStyle: 'italic' }}>
          No emails pending approval. Approve leads to generate outreach.
        </div>
      )}

      {emails.map(email => (
        <div
          key={email.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            border: `1px solid ${email.limited_data_warning ? T.amberBorder : T.border}`,
            borderRadius: 10, marginBottom: 8,
            background: email.limited_data_warning ? T.amberLight : T.surface,
          }}
        >
          {/* Avatar initials */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: T.accentLight, color: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>
            {email.lead_id.slice(0, 2).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 2 }}>
              {email.subject}
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>
              Step {email.step_id.slice(-2)} · Scheduled: {email.scheduled_for ? new Date(email.scheduled_for).toLocaleDateString() : 'Immediately'}
            </div>
            {email.limited_data_warning && (
              <div style={{ fontSize: 11, color: T.amber, marginTop: 2, fontWeight: 500 }}>
                ⚠ Review — generated from limited data
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onApprove(email.id)} style={{ padding: '5px 12px', borderRadius: 6, background: '#dcfce7', color: '#166534', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
              Approve
            </button>
            <button style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, fontSize: 11, cursor: 'pointer', fontFamily: font }}>
              Edit
            </button>
            <button style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, fontSize: 11, cursor: 'pointer', fontFamily: font }}>
              Skip
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function DistributeOutreachScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [selectedSeq, setSelectedSeq] = useState<OutreachSequence | null>(null);
  const [steps, setSteps]   = useState<OutreachStep[]>([]);
  const [emails, setEmails] = useState<OutreachEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('outreach_sequences')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at')
      .then(({ data }) => {
        const seqs = data ?? [];
        setSequences(seqs);
        if (seqs.length > 0) setSelectedSeq(seqs[0]);
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    if (!selectedSeq) return;
    Promise.all([
      supabase.from('outreach_steps').select('*').eq('sequence_id', selectedSeq.id).order('step_number'),
      supabase.from('outreach_emails').select('*').eq('project_id', projectId!).eq('status', 'draft').limit(20),
    ]).then(([{ data: stepsData }, { data: emailsData }]) => {
      setSteps(stepsData ?? []);
      setEmails(emailsData ?? []);
    });
  }, [selectedSeq]);

  async function handleApprove(emailId: string) {
    await supabase.from('outreach_emails').update({ status: 'scheduled', approved_at: new Date().toISOString() }).eq('id', emailId);
    setEmails(prev => prev.filter(e => e.id !== emailId));
  }

  async function handleApproveAll() {
    await supabase.from('outreach_emails').update({ status: 'scheduled', approved_at: new Date().toISOString() }).in('id', emails.map(e => e.id));
    setEmails([]);
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
      <span style={{ color: T.muted, fontSize: 14 }}>Loading outreach…</span>
    </div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: font, color: T.text }}>
      {/* Left: Sequence list */}
      <div style={{ width: 260, flexShrink: 0, background: T.surface, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', padding: '24px 0' }}>
        <div style={{ padding: '0 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.border}`, marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Sequences</span>
          <button style={{ width: 24, height: 24, borderRadius: 6, background: T.accent, color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
        </div>
        {sequences.length === 0 ? (
          <div style={{ padding: '20px 16px', fontSize: 13, color: T.muted }}>
            No sequences yet. Reeve will generate one after leads are approved.
          </div>
        ) : (
          sequences.map(seq => {
            const goal = OUTREACH_GOAL_STYLES[seq.goal as keyof typeof OUTREACH_GOAL_STYLES];
            const isActive = selectedSeq?.id === seq.id;
            return (
              <button
                key={seq.id}
                onClick={() => setSelectedSeq(seq)}
                style={{
                  padding: '12px 16px', background: isActive ? T.accentLight : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                  borderLeft: isActive ? `3px solid ${T.accent}` : '3px solid transparent',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 5 }}>{seq.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {goal && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: goal.bg, color: goal.color }}>
                      {goal.label}
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8,
                    background: seq.is_active ? '#dcfce7' : T.bg,
                    color: seq.is_active ? '#166534' : T.muted,
                  }}>
                    {seq.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Right: Sequence detail */}
      <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
        {!selectedSeq ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <span style={{ color: T.muted, fontSize: 14 }}>Select a sequence to view</span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{selectedSeq.name}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {OUTREACH_GOAL_STYLES[selectedSeq.goal as keyof typeof OUTREACH_GOAL_STYLES] && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: OUTREACH_GOAL_STYLES[selectedSeq.goal as keyof typeof OUTREACH_GOAL_STYLES].bg,
                      color: OUTREACH_GOAL_STYLES[selectedSeq.goal as keyof typeof OUTREACH_GOAL_STYLES].color,
                    }}>
                      {OUTREACH_GOAL_STYLES[selectedSeq.goal as keyof typeof OUTREACH_GOAL_STYLES].label}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: T.muted }}>{steps.length} email steps</span>
                </div>
              </div>
              <button style={{ padding: '9px 16px', borderRadius: 8, background: T.accent, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font, display: 'flex', alignItems: 'center', gap: 5 }}>
                ⚡ Regenerate with Claude
              </button>
            </div>

            {/* Email step cards */}
            {steps.length === 0 ? (
              <div style={{ padding: '32px 0', color: T.muted, fontSize: 13, fontStyle: 'italic' }}>No steps yet — Reeve will generate them after leads are approved.</div>
            ) : (
              steps.map((step, i) => <EmailStepCard key={step.id} step={step} index={i} />)
            )}

            {/* Approval queue */}
            <ApprovalQueue emails={emails} onApprove={handleApprove} onApproveAll={handleApproveAll} />
          </>
        )}
      </div>
    </div>
  );
}
