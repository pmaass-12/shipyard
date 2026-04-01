/**
 * TeamChatThread — Build 049 (revised spec 2026-03-30)
 *
 * Threaded layout: messages are grouped by pipeline_stage. Within each
 * group the initiating message is the "parent"; all subsequent messages
 * are indented as nested replies with a connector line — exactly like
 * Slack thread replies.
 *
 * Stage divider pills appear between thread groups.
 *
 * Color tokens per persona (name + role shown in their color):
 *   Reeve (PM)        — indigo  #4338CA
 *   Morgan (Designer) — slate   #475569
 *   Sage (Data)       — green   #16A34A
 *   Finn (Engineer)   — teal    #0D9488
 *   Quinn (QA)        — violet  #7C3AED
 *
 * QA pass message (quinn → reeve): green left-border
 * QA fail message (quinn → finn):  red left-border
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/Avatar';
import type { TeamMessage, TeamPersona, PipelineStage } from '@/types/db';

// ── Design tokens ──────────────────────────────────────────────────────────────

const PERSONA_COLOR: Record<TeamPersona, string> = {
  reeve:  '#4338CA',
  morgan: '#475569',
  wren:   '#B45309',
  sage:   '#16A34A',
  finn:   '#0D9488',
  quinn:  '#7C3AED',
};

const PERSONA_ROLE: Record<TeamPersona, string> = {
  reeve:  'PM',
  morgan: 'Designer',
  wren:   'Designer',
  sage:   'Data',
  finn:   'Engineer',
  quinn:  'QA',
};

const STAGE_LABEL: Record<PipelineStage, string> = {
  design:  'Design',
  schema:  'Schema',
  code:    'Code',
  preview: 'Preview',
  qa:      'QA',
  release: 'Release',
};

const STAGE_ORDER: PipelineStage[] = ['design', 'schema', 'code', 'preview', 'qa', 'release'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** QA messages get a colored left-border based on pass/fail direction. */
function getQaBorderColor(msg: TeamMessage): string | undefined {
  if (msg.pipeline_stage !== 'qa') return undefined;
  // quinn → reeve = pass (green), quinn → finn = fail (red)
  if (msg.from_persona === 'quinn' && msg.to_persona === 'reeve') return '#22C55E';
  if (msg.from_persona === 'quinn' && msg.to_persona === 'finn')  return '#EF4444';
  return undefined;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message:   TeamMessage;
  isReply:   boolean;  // true → indented as a reply
}

function MessageBubble({ message, isReply }: MessageBubbleProps) {
  const color       = PERSONA_COLOR[message.from_persona];
  const role        = PERSONA_ROLE[message.from_persona];
  const qaBorder    = getQaBorderColor(message);
  const name        = message.from_persona.charAt(0).toUpperCase() + message.from_persona.slice(1);

  return (
    <div
      style={{
        display:      'flex',
        gap:          10,
        paddingLeft:  isReply ? 40 : 0,
        marginBottom: isReply ? 0 : 4,
      }}
    >
      {/* Connector line placeholder (width matches avatar) */}
      {isReply && (
        <div style={{ position: 'relative', flexShrink: 0, width: 28 }}>
          {/* Vertical + horizontal connector line */}
          <div style={{
            position:    'absolute',
            top:         -12,
            left:        14,
            width:       1,
            height:      'calc(100% + 16px)',
            background:  '#E2E8F0',
          }} />
          <div style={{
            position:   'absolute',
            top:        14,
            left:       14,
            width:      18,
            height:     1,
            background: '#E2E8F0',
          }} />
        </div>
      )}

      {/* Avatar */}
      {!isReply && (
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          <Avatar member={message.from_persona} size="sm" />
        </div>
      )}
      {isReply && (
        <div style={{ flexShrink: 0, paddingTop: 2, marginLeft: -28 }}>
          <Avatar member={message.from_persona} size="sm" />
        </div>
      )}

      {/* Content */}
      <div
        style={{
          flex:        1,
          minWidth:    0,
          borderLeft:  qaBorder ? `3px solid ${qaBorder}` : undefined,
          paddingLeft: qaBorder ? 8 : 0,
          background:  qaBorder
            ? (qaBorder === '#22C55E' ? '#F0FDF4' : '#FEF2F2')
            : undefined,
          borderRadius: qaBorder ? 4 : 0,
          padding:      qaBorder ? '6px 8px' : undefined,
        }}
      >
        {/* Sender header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color }}>
            {name}
          </span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>({role})</span>
          <span style={{ fontSize: 11, color: '#CBD5E1' }}>·</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            {formatRelativeTime(message.created_at)}
          </span>
        </div>

        {/* Message text */}
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: '#334155' }}>
          {message.content}
        </p>
      </div>
    </div>
  );
}

// ── Stage divider ──────────────────────────────────────────────────────────────

function StageDivider({ stage }: { stage: PipelineStage }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 16px' }}>
      <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
      <span style={{
        fontSize:     11,
        fontWeight:   600,
        color:        '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        padding:       '2px 8px',
        background:    '#F8FAFC',
        border:        '1px solid #E2E8F0',
        borderRadius:  12,
      }}>
        {STAGE_LABEL[stage] ?? stage}
      </span>
      <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
    </div>
  );
}

// ── Thread group ───────────────────────────────────────────────────────────────
// A thread is one pipeline stage. The first message is the parent; all
// subsequent messages in that stage are nested replies.

interface ThreadGroupProps {
  messages: TeamMessage[];
  stage:    PipelineStage | null;
}

function ThreadGroup({ messages, stage }: ThreadGroupProps) {
  if (messages.length === 0) return null;
  const [parent, ...replies] = messages;

  return (
    <div>
      {stage && <StageDivider stage={stage} />}
      <div style={{ marginBottom: 4 }}>
        <MessageBubble message={parent} isReply={false} />
      </div>
      {replies.map((msg) => (
        <div key={msg.id} style={{ marginTop: 8 }}>
          <MessageBubble message={msg} isReply={true} />
        </div>
      ))}
    </div>
  );
}

// ── Grouping logic ─────────────────────────────────────────────────────────────
// Group messages by pipeline_stage, preserve stage order, then creation order within group.
// Messages without a stage go into a 'null' group shown first.

interface StageGroup {
  stage:    PipelineStage | null;
  messages: TeamMessage[];
}

function groupByStage(messages: TeamMessage[]): StageGroup[] {
  const map = new Map<string, TeamMessage[]>();
  const keyOf = (m: TeamMessage) => m.pipeline_stage ?? '__no_stage__';

  for (const msg of messages) {
    const key = keyOf(msg);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(msg);
  }

  const groups: StageGroup[] = [];

  // No-stage first
  if (map.has('__no_stage__')) {
    groups.push({ stage: null, messages: map.get('__no_stage__')! });
  }

  // Then by STAGE_ORDER
  for (const stage of STAGE_ORDER) {
    if (map.has(stage)) {
      groups.push({ stage, messages: map.get(stage)! });
    }
  }

  return groups;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface TeamChatThreadProps {
  featureId:  string;
  projectId:  string;
}

export function TeamChatThread({ featureId }: TeamChatThreadProps) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const bottomRef               = useRef<HTMLDivElement>(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('feature_id', featureId)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        if (!error && data) setMessages(data as TeamMessage[]);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [featureId]);

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`team_messages:feature:${featureId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'team_messages',
          filter: `feature_id=eq.${featureId}`,
        },
        (payload: { new: unknown }) => {
          setMessages((prev) => [...prev, payload.new as TeamMessage]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [featureId]);

  // ── Scroll to bottom on new messages ────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
        Loading team thread…
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div style={{ padding: '64px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 14, lineHeight: 1.6 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>👥</div>
        <p style={{ margin: 0, fontWeight: 500, color: '#64748B' }}>
          The team will appear here once the pipeline starts.
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 13 }}>
          Approve the design to kick things off.
        </p>
      </div>
    );
  }

  const groups = groupByStage(messages);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 0' }}>
      {groups.map((group, idx) => (
        <ThreadGroup
          key={group.stage ?? `__no_stage_${idx}`}
          stage={group.stage}
          messages={group.messages}
        />
      ))}
      <div ref={bottomRef} style={{ height: 28 }} />
    </div>
  );
}
