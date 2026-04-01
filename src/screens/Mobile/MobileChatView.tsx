/**
 * MobileChatView — Build 048: Mobile Chat-First
 *
 * Route: /mobile
 * The entire mobile Shipyard experience. No sidebar, no tabs, no bottom nav.
 * Structure (top → bottom):
 *   1. Top bar — project selector pull-down
 *   2. Chat thread — scrollable Reeve conversation, full screen
 *   3. Attention bar — amber, pinned, zero-height when nothing is pending
 *   4. Chat input — send messages to Reeve
 *
 * On first load: requests push notification permission + registers SW.
 *
 * data-testid inventory:
 *   mobile-chat-view             — root container
 *   mobile-top-bar               — top bar with project selector
 *   mobile-project-selector-btn  — project selector trigger button
 *   mobile-project-panel         — drop-down project list panel
 *   mobile-project-row-{id}      — individual project row in panel
 *   mobile-chat-thread           — scrollable message area
 *   mobile-message-{id}          — individual message bubble
 *   mobile-attention-bar         — amber bar when items pending
 *   mobile-see-all-btn           — "See all ›" button in attention bar
 *   mobile-bottom-sheet          — pending items sheet
 *   mobile-sheet-item-{i}        — individual row in sheet
 *   mobile-chat-input            — text input
 *   mobile-send-btn              — send button
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  KeyboardEvent,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/Avatar';
import ReeveChatCard from '@/components/ReeveChatCard';
import type { PmChatMessage } from '@/types/db';

// ── Types ──────────────────────────────────────────────────────────────────

interface Project {
  id:           string;
  name:         string;
  pendingCount: number;
  p0Blocked:    boolean;
}

interface PendingItem {
  type:         'design_approval' | 'qa_complete' | 'human_task';
  priority?:    'p0' | 'p1' | 'p2' | 'p3';
  title:        string;
  description?: string;
  messageId?:   string;
  featureId?:   string;
}

// ── Design tokens ──────────────────────────────────────────────────────────

const INDIGO = '#4338ca';
const C = {
  bg:        '#f8f8fa',
  topBar:    '#ffffff',
  border:    '#e5e7eb',
  attnBg:    '#fffbeb',
  attnBorder:'#fde68a',
  attnText:  '#92400e',
  attnLink:  INDIGO,
  reeveBg:   '#ffffff',
  userBg:    INDIGO,
  muted:     '#6b7280',
  inputBg:   '#ffffff',
  sheetBg:   '#ffffff',
};

// ── Push notification registration ────────────────────────────────────────

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const existing = await reg.pushManager.getSubscription();
    if (existing) return; // already registered

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: vapidPublicKey,
    });

    const json = subscription.toJSON();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-push-subscription`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          endpoint:   subscription.endpoint,
          p256dh:     json.keys?.p256dh,
          auth_key:   json.keys?.auth,
          user_agent: navigator.userAgent.substring(0, 200),
        }),
      },
    );
  } catch (e) {
    console.warn('Push registration failed:', e);
  }
}

// ── Project status badge ───────────────────────────────────────────────────

function StatusBadge({ pendingCount, p0Blocked }: { pendingCount: number; p0Blocked: boolean }) {
  if (p0Blocked) {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
        background: '#fee2e2', color: '#991b1b' }}>
        P0 blocked
      </span>
    );
  }
  if (pendingCount > 0) {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
        background: '#fef3c7', color: '#92400e' }}>
        {pendingCount} waiting
      </span>
    );
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
      background: '#dcfce7', color: '#166534' }}>
      All clear
    </span>
  );
}

// ── Project selector pull-down ─────────────────────────────────────────────

function ProjectSelector({
  currentProject,
  projects,
  onSelect,
}: {
  currentProject: Project | null;
  projects:       Project[];
  onSelect:       (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        data-testid="mobile-project-selector-btn"
        onClick={() => setOpen((o) => !o)}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          padding:        '6px 10px',
          borderRadius:   8,
          border:         `1px solid ${C.border}`,
          background:     C.topBar,
          cursor:         'pointer',
          fontSize:       14,
          fontWeight:     600,
          color:          '#111827',
          maxWidth:       220,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentProject?.name ?? 'Select project'}
        </span>
        {currentProject && (
          <StatusBadge
            pendingCount={currentProject.pendingCount}
            p0Blocked={currentProject.p0Blocked}
          />
        )}
        <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>▾</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
          />
          {/* Drop-down panel */}
          <div
            data-testid="mobile-project-panel"
            style={{
              position:     'absolute',
              top:          'calc(100% + 6px)',
              left:         0,
              minWidth:     260,
              background:   C.sheetBg,
              border:       `1px solid ${C.border}`,
              borderRadius: 10,
              boxShadow:    '0 4px 20px rgba(0,0,0,0.12)',
              zIndex:       50,
              overflow:     'hidden',
            }}
          >
            {projects.map((p) => (
              <button
                key={p.id}
                data-testid={`mobile-project-row-${p.id}`}
                onClick={() => { onSelect(p.id); setOpen(false); }}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'space-between',
                  width:           '100%',
                  padding:         '10px 14px',
                  background:      p.id === currentProject?.id ? '#f5f3ff' : 'transparent',
                  border:          'none',
                  borderBottom:    `1px solid ${C.border}`,
                  cursor:          'pointer',
                  textAlign:       'left',
                  gap:             8,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    {p.name}
                  </span>
                  {p.id === currentProject?.id && (
                    <span style={{ fontSize: 11, color: INDIGO, fontWeight: 600 }}>✓ Current</span>
                  )}
                </div>
                <StatusBadge pendingCount={p.pendingCount} p0Blocked={p.p0Blocked} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Attention bar ──────────────────────────────────────────────────────────

function AttentionBar({
  pendingItems,
  onSeeAll,
}: {
  pendingItems: PendingItem[];
  onSeeAll:     () => void;
}) {
  if (pendingItems.length === 0) return null;

  const designCount  = pendingItems.filter((i) => i.type === 'design_approval').length;
  const taskCount    = pendingItems.filter((i) => i.type === 'human_task').length;
  const qaCount      = pendingItems.filter((i) => i.type === 'qa_complete').length;

  const parts: string[] = [];
  if (designCount > 0) parts.push(`${designCount} design${designCount > 1 ? 's' : ''} waiting`);
  if (qaCount      > 0) parts.push(`${qaCount} QA pass${qaCount > 1 ? 'es' : ''} ready`);
  if (taskCount    > 0) {
    const p0 = pendingItems.filter((i) => i.type === 'human_task' && i.priority === 'p0').length;
    const p1 = pendingItems.filter((i) => i.type === 'human_task' && i.priority === 'p1').length;
    if (p0 > 0) parts.unshift(`${p0} human task (P0)`);
    else if (p1 > 0) parts.unshift(`${p1} human task (P1)`);
    else parts.push(`${taskCount} human task${taskCount > 1 ? 's' : ''}`);
  }

  return (
    <div
      data-testid="mobile-attention-bar"
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '0 14px',
        height:          40,
        background:      C.attnBg,
        borderTop:       `1px solid ${C.attnBorder}`,
        flexShrink:      0,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: C.attnText }}>
        ⏳ {parts.join(' · ')}
      </span>
      <button
        data-testid="mobile-see-all-btn"
        onClick={onSeeAll}
        style={{
          background:  'none',
          border:      'none',
          cursor:      'pointer',
          fontSize:    12,
          fontWeight:  700,
          color:       C.attnLink,
          padding:     0,
          flexShrink:  0,
        }}
      >
        See all ›
      </button>
    </div>
  );
}

// ── Bottom sheet ───────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  p0:             '#ef4444',
  p1:             '#f59e0b',
  qa_complete:    '#22c55e',
  design_approval:'#94a3b8',
};

function BottomSheet({
  items,
  projectId: _projectId,
  onClose,
  onAction,
}: {
  items:     PendingItem[];
  projectId: string;
  onClose:   () => void;
  onAction:  (item: PendingItem) => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.4)',
          zIndex:     100,
        }}
      />
      {/* Sheet */}
      <div
        data-testid="mobile-bottom-sheet"
        style={{
          position:     'fixed',
          bottom:       0,
          left:         0,
          right:        0,
          background:   C.sheetBg,
          borderRadius: '16px 16px 0 0',
          boxShadow:    '0 -4px 24px rgba(0,0,0,0.15)',
          zIndex:       101,
          maxHeight:    '70vh',
          overflowY:    'auto',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 16px 12px' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
            Waiting on you
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>
            {items.length} item{items.length !== 1 ? 's' : ''} need attention
          </p>
        </div>

        {/* Items */}
        {items.map((item, i) => {
          const dotColor =
            item.type === 'human_task'
              ? PRIORITY_DOT[item.priority ?? 'p3'] ?? '#94a3b8'
              : PRIORITY_DOT[item.type] ?? '#94a3b8';

          return (
            <div
              key={i}
              data-testid={`mobile-sheet-item-${i}`}
              style={{
                display:       'flex',
                alignItems:    'center',
                gap:           12,
                padding:       '12px 16px',
                borderBottom:  `1px solid ${C.border}`,
              }}
            >
              {/* Priority dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: dotColor, flexShrink: 0,
              }} />

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </p>
                {item.description && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.description}
                  </p>
                )}
              </div>

              {/* Action */}
              {item.type === 'design_approval' && (
                <button
                  onClick={() => { onAction(item); onClose(); }}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: INDIGO, color: '#fff', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Approve ›
                </button>
              )}
              {item.type === 'qa_complete' && (
                <button
                  onClick={() => { onAction(item); onClose(); }}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: '#dcfce7', color: '#166534', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Ship ›
                </button>
              )}
              {item.type === 'human_task' && (
                <button
                  onClick={() => { onAction(item); onClose(); }}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
                    background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Settings
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────

function MessageBubble({
  message,
  projectId,
}: {
  message:   PmChatMessage;
  projectId: string;
}) {
  const isUser = message.role === 'user';

  // Non-text card types — render ReeveChatCard
  if (!isUser && message.card_type && message.card_type !== 'text') {
    return (
      <div
        data-testid={`mobile-message-${message.id}`}
        style={{ padding: '4px 12px', maxWidth: 320 }}
      >
        <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 4 }}>
          REEVE · PROJECT MANAGER
        </div>
        <ReeveChatCard message={message} projectId={projectId} />
      </div>
    );
  }

  return (
    <div
      data-testid={`mobile-message-${message.id}`}
      style={{
        display:       'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        padding:       '4px 12px',
      }}
    >
      <div style={{ maxWidth: '78%' }}>
        {!isUser && (
          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: 4 }}>
            REEVE · PROJECT MANAGER
          </div>
        )}
        <div
          style={{
            padding:      '9px 13px',
            borderRadius:  isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            background:    isUser ? C.userBg : C.reeveBg,
            border:        isUser ? 'none' : `1px solid ${C.border}`,
            fontSize:      14,
            lineHeight:    1.55,
            color:         isUser ? '#ffffff' : '#1f2937',
            wordBreak:     'break-word',
          }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export default function MobileChatView() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const initialProjId = params.get('project');

  const [projects,       setProjects]       = useState<Project[]>([]);
  const [currentProjId,  setCurrentProjId]  = useState<string | null>(initialProjId);
  const [messages,       setMessages]       = useState<PmChatMessage[]>([]);
  const [pendingItems,   setPendingItems]   = useState<PendingItem[]>([]);
  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [inputText,      setInputText]      = useState('');
  const [sending,        setSending]        = useState(false);
  const [loading,        setLoading]        = useState(true);

  const threadRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  const currentProject = projects.find((p) => p.id === currentProjId) ?? null;

  // ── Register service worker on mount ──────────────────────────────────────
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // ── Load projects list ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadProjects() {
      const { data: rows } = await supabase
        .from('projects')
        .select('id, name')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (!rows?.length) return;

      // Load pending counts per project from pm_chat_messages
      const projectList: Project[] = await Promise.all(
        rows.map(async (row: { id: string; name: string }) => {
          const { data: pending } = await supabase
            .from('pm_chat_messages')
            .select('card_type, action_payload')
            .eq('project_id', row.id)
            .in('card_type', ['design_approval', 'qa_complete', 'human_task'])
            .is('resolved_at', null);

          const p0Blocked = pending?.some(
            (m: { card_type: string; action_payload: Record<string, unknown> | null }) =>
              m.card_type === 'human_task' &&
              (m.action_payload as { priority?: string })?.priority === 'p0',
          ) ?? false;

          return {
            id:           row.id,
            name:         row.name,
            pendingCount: pending?.length ?? 0,
            p0Blocked,
          };
        }),
      );

      setProjects(projectList);

      if (!currentProjId && projectList.length > 0) {
        setCurrentProjId(projectList[0].id);
      }
    }

    loadProjects();
  }, []);

  // ── Load messages for current project ────────────────────────────────────
  useEffect(() => {
    if (!currentProjId) return;

    setLoading(true);
    setMessages([]);

    supabase
      .from('pm_chat_messages')
      .select('*')
      .eq('project_id', currentProjId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMessages((data as PmChatMessage[]) ?? []);
        setLoading(false);
        setTimeout(() => scrollToBottom(), 50);
      });

    // Realtime subscription
    const channel = supabase
      .channel(`mobile-chat-${currentProjId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'pm_chat_messages',
          filter: `project_id=eq.${currentProjId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as PmChatMessage]);
          setTimeout(() => scrollToBottom(), 50);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentProjId]);

  // ── Derive pending items from messages ────────────────────────────────────
  useEffect(() => {
    const items: PendingItem[] = messages
      .filter((m) =>
        m.card_type === 'design_approval' ||
        m.card_type === 'qa_complete' ||
        (m.card_type === 'human_task' &&
          ['p0', 'p1'].includes((m.action_payload as { priority?: string })?.priority ?? '')),
      )
      .map((m) => {
        const p = m.action_payload as Record<string, unknown> ?? {};
        if (m.card_type === 'design_approval') {
          return {
            type:       'design_approval' as const,
            title:      `Design ready: ${p.feature_name ?? 'Feature'}`,
            messageId:  m.id,
            featureId:  (p.feature_id as string) ?? undefined,
          };
        }
        if (m.card_type === 'qa_complete') {
          return {
            type:        'qa_complete' as const,
            title:       `QA passed: ${p.feature_name ?? 'Feature'}`,
            description: `${p.pass_count ?? 0} tests passing`,
            messageId:   m.id,
            featureId:   (p.feature_id as string) ?? undefined,
          };
        }
        return {
          type:        'human_task' as const,
          priority:    ((p.priority as string) ?? 'p1') as 'p0' | 'p1',
          title:       (p.title as string) ?? 'Action required',
          description: (p.description as string) ?? undefined,
          messageId:   m.id,
        };
      });

    // Sort: p0 tasks → p1 tasks → qa → design
    items.sort((a, b) => {
      const rank = (i: PendingItem) => {
        if (i.type === 'human_task' && i.priority === 'p0') return 0;
        if (i.type === 'human_task' && i.priority === 'p1') return 1;
        if (i.type === 'qa_complete') return 2;
        return 3;
      };
      return rank(a) - rank(b);
    });

    setPendingItems(items);
  }, [messages]);

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !currentProjId || sending) return;

    setSending(true);
    setInputText('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Insert user message
      const { data: userMsg } = await supabase
        .from('pm_chat_messages')
        .insert({
          project_id: currentProjId,
          role:       'user',
          content:    text,
          card_type:  'text',
        })
        .select()
        .single();

      if (userMsg) {
        setMessages((prev) => [...prev, userMsg as PmChatMessage]);
        setTimeout(() => scrollToBottom(), 50);
      }

      // Call Reeve chat response Edge Function
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-reeve-chat-response`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            project_id:  currentProjId,
            user_message: text,
          }),
        },
      );
      // Response will arrive via Realtime subscription
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [inputText, currentProjId, sending, scrollToBottom]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleSheetAction = useCallback((item: PendingItem) => {
    if (!currentProjId) return;
    if (item.featureId) {
      navigate(`/projects/${currentProjId}/features/${item.featureId}`);
    }
  }, [currentProjId, navigate]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="mobile-chat-view"
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100dvh',
        background:    C.bg,
        position:      'relative',
        overflow:      'hidden',
        maxWidth:      430,
        margin:        '0 auto',
      }}
    >
      {/* ── Top bar ── */}
      <div
        data-testid="mobile-top-bar"
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '10px 14px',
          background:     C.topBar,
          borderBottom:   `1px solid ${C.border}`,
          flexShrink:     0,
          minHeight:      52,
        }}
      >
        <ProjectSelector
          currentProject={currentProject}
          projects={projects}
          onSelect={setCurrentProjId}
        />

        {/* Feedback FAB placeholder — top-right */}
        <button
          aria-label="Feedback"
          style={{
            width:        36,
            height:       36,
            borderRadius: '50%',
            background:   INDIGO,
            border:       'none',
            color:        '#fff',
            fontSize:     18,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            flexShrink:   0,
          }}
        >
          ✏️
        </button>
      </div>

      {/* ── Chat thread ── */}
      <div
        ref={threadRef}
        data-testid="mobile-chat-thread"
        style={{
          flex:       1,
          overflowY:  'auto',
          padding:    '12px 0',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: C.muted, fontSize: 13 }}>
            Loading…
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: C.muted, fontSize: 13 }}>
            <Avatar member="reeve" size="md" />
            <p style={{ margin: '12px 0 4px', fontWeight: 600, color: '#374151' }}>
              Hey, I'm Reeve — your project manager.
            </p>
            <p style={{ margin: 0, fontSize: 12 }}>
              I'll message you here when something needs your attention.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            projectId={currentProjId ?? ''}
          />
        ))}
      </div>

      {/* ── Attention bar ── */}
      <AttentionBar
        pendingItems={pendingItems}
        onSeeAll={() => setSheetOpen(true)}
      />

      {/* ── Chat input ── */}
      <div
        style={{
          display:       'flex',
          alignItems:    'flex-end',
          gap:           8,
          padding:       '10px 12px',
          background:    C.topBar,
          borderTop:     `1px solid ${C.border}`,
          flexShrink:    0,
        }}
      >
        <textarea
          ref={inputRef}
          data-testid="mobile-chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentProject ? `Message Reeve…` : 'Select a project first'}
          disabled={!currentProjId || sending}
          rows={1}
          style={{
            flex:        1,
            resize:      'none',
            borderRadius: 20,
            border:      `1px solid ${C.border}`,
            padding:     '9px 14px',
            fontSize:    14,
            lineHeight:  1.5,
            outline:     'none',
            background:  C.inputBg,
            color:       '#111827',
            minHeight:   38,
            maxHeight:   120,
            fontFamily:  'inherit',
          }}
        />
        <button
          data-testid="mobile-send-btn"
          onClick={handleSend}
          disabled={!inputText.trim() || !currentProjId || sending}
          style={{
            width:        38,
            height:       38,
            borderRadius: '50%',
            background:   inputText.trim() && currentProjId ? INDIGO : '#e5e7eb',
            border:       'none',
            color:        inputText.trim() && currentProjId ? '#fff' : '#9ca3af',
            fontSize:     16,
            cursor:       inputText.trim() && currentProjId ? 'pointer' : 'not-allowed',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            flexShrink:   0,
            transition:   'background 0.15s',
          }}
          aria-label="Send"
        >
          ↑
        </button>
      </div>

      {/* ── Bottom sheet ── */}
      {sheetOpen && currentProjId && (
        <BottomSheet
          items={pendingItems}
          projectId={currentProjId}
          onClose={() => setSheetOpen(false)}
          onAction={handleSheetAction}
        />
      )}
    </div>
  );
}
