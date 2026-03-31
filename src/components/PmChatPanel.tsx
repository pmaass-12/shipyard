/**
 * PmChatPanel — Build 043 (extends Build 040)
 *
 * "Project Brain" — slide-in right panel for chatting with Morgan.
 * Build 043 additions over Build 040:
 *   - Panel title renamed to "Project Brain"
 *   - 🧠 N facts chip in header — click opens MemoryDrawer
 *   - "💾" save-to-memory icon on hover for Morgan responses
 *   - Save modal: pre-filled title, category dropdown, Cancel + Save
 *   - General question chips in empty chat state (4 prompts)
 *   - Morgan proactive save affordance when response carries save_suggestion
 *   - MemoryDrawer slide-in over panel
 *
 * data-testid inventory:
 *   pm-chat-panel               — outer panel div
 *   pm-chat-close-btn           — × close button
 *   pm-chat-new-thread-btn      — "New chat" button in header
 *   memory-chip                 — 🧠 N facts chip in header
 *   pm-chat-thread-list         — thread list container
 *   pm-chat-thread-{threadId}   — individual thread row
 *   pm-chat-back-btn            — ← back to thread list
 *   pm-chat-messages            — message scroll container
 *   pm-chat-message-{id}        — individual message bubble
 *   chat-save-to-memory-{msgId} — 💾 icon on Morgan response
 *   morgan-proactive-save       — "Save this to memory?" affordance
 *   pm-chat-thinking            — "Morgan is thinking…" indicator
 *   pm-chat-input               — textarea
 *   pm-chat-send-btn            — send button
 *   pm-chat-prompt-{i}          — suggested prompt chip
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  KeyboardEvent,
} from 'react';
import { TEAM, PM_CHAT_SUGGESTED_PROMPTS } from '@/lib/team';
import type {
  PmChatMessage,
  PmChatThread,
  MemoryFactCategory,
  MorganSaveSuggestion,
} from '@/types/db';
import {
  getPmChatThread,
  getPmChatThreadList,
  insertUserPmMessage,
  generateReeveChatResponse,
  subscribeToPmChatThread,
} from '@/api/namedTeam';
import {
  getMemoryFactCount,
  createMemoryFact,
  subscribeToMemoryFacts,
} from '@/api/projectMemory';
import { Avatar } from '@/components/Avatar';
import ReeveChatCard from '@/components/ReeveChatCard';
import MemoryDrawer from '@/components/MemoryDrawer';

// ── Helpers ────────────────────────────────────────────────────────────────

function newThreadId(): string {
  return crypto.randomUUID();
}

function formatAge(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ── Save to Memory Modal ───────────────────────────────────────────────────

const CATEGORY_OPTIONS: MemoryFactCategory[] = [
  'decision', 'pattern', 'preference', 'constraint', 'cancellation', 'note',
];

interface SaveMemoryModalProps {
  prefill: { title: string; body: string; category: MemoryFactCategory };
  onSave:  (title: string, body: string, category: MemoryFactCategory) => Promise<void>;
  onClose: () => void;
}

function SaveMemoryModal({ prefill, onSave, onClose }: SaveMemoryModalProps) {
  const [title,    setTitle]    = useState(prefill.title);
  const [body,     setBody]     = useState(prefill.body);
  const [category, setCategory] = useState<MemoryFactCategory>(prefill.category);
  const [saving,   setSaving]   = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(title.trim(), body.trim(), category);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="memory-save-modal"
      style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex:          200,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: '#fff',
        borderRadius:    12,
        width:           400,
        maxWidth:        '90vw',
        padding:         22,
        boxShadow:       '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1E293B' }}>
          What should Reeve remember?
        </p>

        <input
          data-testid="memory-save-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1',
            borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none',
            boxSizing: 'border-box', marginBottom: 10,
          }}
        />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={2}
          placeholder="Add context or details…"
          style={{
            width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1',
            borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none',
            resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
            marginBottom: 10,
          }}
        />
        <select
          data-testid="memory-save-category"
          value={category}
          onChange={e => setCategory(e.target.value as MemoryFactCategory)}
          style={{
            width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1',
            borderRadius: 6, fontSize: 13, color: '#1E293B', outline: 'none',
            backgroundColor: '#fff', marginBottom: 16, boxSizing: 'border-box',
          }}
        >
          {CATEGORY_OPTIONS.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            data-testid="memory-save-cancel"
            onClick={onClose}
            style={{
              padding: '7px 14px', border: '1px solid #CBD5E1', borderRadius: 7,
              backgroundColor: '#fff', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="memory-save-confirm"
            onClick={handleSave}
            disabled={!title.trim() || saving}
            style={{
              padding: '7px 14px', border: 'none', borderRadius: 7,
              backgroundColor: title.trim() && !saving ? '#4F46E5' : '#E2E8F0',
              color: title.trim() && !saving ? '#fff' : '#94A3B8',
              fontSize: 13, fontWeight: 600,
              cursor: title.trim() && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg:        PmChatMessage;
  onSave:     (msg: PmChatMessage) => void;
}

function MessageBubble({ msg, onSave }: MessageBubbleProps) {
  const isUser  = msg.role === 'user';
  const [hov,   setHov] = useState(false);

  return (
    <div
      data-testid={`pm-chat-message-${msg.id}`}
      style={{
        display:       'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems:    'flex-start',
        gap:           8,
        marginBottom:  12,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {!isUser && (
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          <Avatar member="reeve" size="xs" />
        </div>
      )}

      <div style={{ position: 'relative', maxWidth: '78%' }}>
        <div
          style={{
            padding:         '8px 12px',
            borderRadius:    isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
            backgroundColor: isUser ? '#4F46E5' : '#F1F5F9',
            color:           isUser ? '#fff' : '#1E293B',
            fontSize:        13,
            lineHeight:      1.55,
            whiteSpace:      'pre-wrap',
            wordBreak:       'break-word',
          }}
        >
          {msg.content}
        </div>

        {/* Save-to-memory icon — Morgan messages only, on hover */}
        {!isUser && hov && !msg.id.startsWith('opt-') && (
          <button
            data-testid={`chat-save-to-memory-${msg.id}`}
            onClick={() => onSave(msg)}
            title="Save to memory"
            style={{
              position:        'absolute',
              bottom:          -8,
              right:           -8,
              width:           22,
              height:          22,
              borderRadius:    '50%',
              backgroundColor: '#fff',
              border:          '1px solid #CBD5E1',
              cursor:          'pointer',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        11,
              boxShadow:       '0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            💾
          </button>
        )}
      </div>

      {isUser && <div style={{ width: 20, flexShrink: 0 }} />}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div
      data-testid="pm-chat-thinking"
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}
    >
      <Avatar member="reeve" size="xs" />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '8px 12px', borderRadius: '4px 14px 14px 14px',
        backgroundColor: '#F1F5F9',
      }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: '#94A3B8', display: 'inline-block',
              animation: `pmDot 1.2s ${i * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Thread List ────────────────────────────────────────────────────────────

interface ThreadListProps {
  threads:     PmChatThread[];
  loading:     boolean;
  onSelect:    (threadId: string) => void;
  onNewThread: () => void;
}

function ThreadList({ threads, loading, onSelect, onNewThread }: ThreadListProps) {
  return (
    <div
      data-testid="pm-chat-thread-list"
      style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
    >
      {loading && (
        <div style={{ padding: '16px', color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
          Loading conversations…
        </div>
      )}

      {!loading && threads.length === 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>
            No conversations yet. Start a chat with Reeve.
          </div>
          <button
            onClick={onNewThread}
            style={{
              padding: '8px 16px', backgroundColor: '#4F46E5', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Start a conversation
          </button>
        </div>
      )}

      {threads.map(thread => (
        <button
          key={thread.thread_id}
          data-testid={`pm-chat-thread-${thread.thread_id}`}
          onClick={() => onSelect(thread.thread_id)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '10px 16px', borderBottom: '1px solid #F1F5F9',
            backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
              {thread.message_count} messages
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              {formatAge(thread.last_message_at)}
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#334155', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {thread.last_message_preview}
          </p>
        </button>
      ))}
    </div>
  );
}

// ── Chat View ──────────────────────────────────────────────────────────────

interface ChatViewProps {
  projectId:     string;
  threadId:      string;
  onBack:        () => void;
  onSaveMessage: (msg: PmChatMessage) => void;
}

function ChatView({ projectId, threadId, onBack, onSaveMessage }: ChatViewProps) {
  const [messages,        setMessages]        = useState<PmChatMessage[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [thinking,        setThinking]        = useState(false);
  const [inputText,       setInputText]       = useState('');
  const [sending,         setSending]         = useState(false);
  const [proactiveSave,   setProactiveSave]   = useState<MorganSaveSuggestion | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPmChatThread(projectId, threadId)
      .then(msgs => { if (!cancelled) { setMessages(msgs); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, threadId]);

  useEffect(() => {
    const unsub = subscribeToPmChatThread(projectId, threadId, (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setThinking(false);
    });
    return unsub;
  }, [projectId, threadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInputText('');
    setProactiveSave(null);

    const optimistic: PmChatMessage = {
      id:             `opt-${Date.now()}`,
      project_id:     projectId,
      thread_id:      threadId,
      role:           'user',
      content:        trimmed,
      compacted:      false,
      compacted_into: null,
      created_at:     new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setThinking(true);

    try {
      await insertUserPmMessage(projectId, threadId, trimmed);
      const result = await generateReeveChatResponse(projectId, threadId, trimmed);
      // Check for proactive save suggestion in response metadata
      if (result.save_suggestion) {
        setProactiveSave(result.save_suggestion);
      }
      // realtime subscription handles incoming assistant message
    } catch (err) {
      console.error('Reeve chat send error:', err);
      setThinking(false);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }, [projectId, threadId, sending]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const isNewThread = !loading && messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
      }}>
        <button
          data-testid="pm-chat-back-btn"
          onClick={onBack}
          title="Back to conversations"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '2px 6px', borderRadius: 6, fontSize: 16, color: '#64748B', lineHeight: 1,
          }}
        >
          ←
        </button>
        <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' }}>
          {threadId.slice(0, 8)}…
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        data-testid="pm-chat-messages"
        style={{ flex: 1, overflowY: 'auto', padding: '16px' }}
      >
        {loading && (
          <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', paddingTop: 32 }}>
            Loading…
          </div>
        )}

        {isNewThread && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 8, marginBottom: 20, paddingTop: 16,
            }}>
              <Avatar member="reeve" size="md" />
              <p style={{ fontSize: 13, color: '#64748B', margin: 0, textAlign: 'center' }}>
                Ask me anything about this project.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PM_CHAT_SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  data-testid={`pm-chat-prompt-${i}`}
                  onClick={() => sendMessage(prompt)}
                  style={{
                    padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
                    backgroundColor: '#FAFAFA', color: '#334155', fontSize: 13,
                    textAlign: 'left', cursor: 'pointer', transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg =>
          // Build 048 — render action card for non-text card types
          msg.card_type && msg.card_type !== 'text' ? (
            <ReeveChatCard key={msg.id} message={msg} projectId={projectId} />
          ) : (
            <MessageBubble key={msg.id} msg={msg} onSave={onSaveMessage} />
          )
        )}

        {thinking && <ThinkingIndicator />}

        {/* Proactive save affordance */}
        {proactiveSave && (
          <div
            data-testid="morgan-proactive-save"
            style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'space-between',
              gap:             8,
              padding:         '8px 12px',
              borderRadius:    8,
              border:          '1px solid #E0E7FF',
              backgroundColor: '#EEF2FF',
              marginBottom:    8,
            }}
          >
            <span style={{ fontSize: 12, color: '#4338CA' }}>
              💾 Save this to memory?
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => {
                  onSaveMessage({
                    id: 'proactive',
                    project_id: projectId,
                    thread_id: threadId,
                    role: 'assistant',
                    content: proactiveSave.body,
                    compacted: false,
                    compacted_into: null,
                    created_at: new Date().toISOString(),
                  });
                  setProactiveSave(null);
                }}
                style={{
                  padding: '3px 10px', border: 'none', borderRadius: 6,
                  backgroundColor: '#4F46E5', color: '#fff',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setProactiveSave(null)}
                style={{
                  padding: '3px 10px', border: '1px solid #C7D2FE', borderRadius: 6,
                  backgroundColor: 'transparent', color: '#4338CA',
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid #E2E8F0',
        flexShrink: 0, backgroundColor: '#fff',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          border: '1px solid #CBD5E1', borderRadius: 10,
          padding: '6px 8px', backgroundColor: '#F8FAFC',
        }}>
          <textarea
            ref={inputRef}
            data-testid="pm-chat-input"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Reeve anything… (Enter to send)"
            rows={2}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 13, color: '#1E293B',
              lineHeight: 1.5, resize: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            data-testid="pm-chat-send-btn"
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || sending}
            title="Send (Enter)"
            style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: inputText.trim() && !sending ? '#4F46E5' : '#E2E8F0',
              border: 'none',
              cursor: inputText.trim() && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background-color 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 7L1 13V9L9 7L1 5V1Z" fill={inputText.trim() && !sending ? '#fff' : '#94A3B8'} />
            </svg>
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0 2px' }}>
          Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────

interface PmChatPanelProps {
  projectId: string;
  onClose:   () => void;
}

export default function PmChatPanel({ projectId, onClose }: PmChatPanelProps) {
  const [threads,          setThreads]          = useState<PmChatThread[]>([]);
  const [loadingThreads,   setLoadingThreads]   = useState(true);
  const [activeThreadId,   setActiveThreadId]   = useState<string | null>(null);
  const [factCount,        setFactCount]        = useState(0);
  const [showMemoryDrawer, setShowMemoryDrawer] = useState(false);
  // save modal state — triggered by 💾 icon on Morgan messages
  const [saveModal, setSaveModal] = useState<{
    open:    boolean;
    prefill: { title: string; body: string; category: MemoryFactCategory } | null;
  }>({ open: false, prefill: null });
  // proactive save from Morgan suggestion — forwarded to MemoryDrawer when drawer is open
  const [pendingDrawerSave, setPendingDrawerSave] = useState<{
    title: string; body: string; category: MemoryFactCategory;
  } | null>(null);

  const reeve = TEAM.reeve;

  // Load thread list
  useEffect(() => {
    let cancelled = false;
    setLoadingThreads(true);
    getPmChatThreadList(projectId)
      .then(ts => {
        if (!cancelled) {
          setThreads(ts);
          setLoadingThreads(false);
          if (ts.length > 0 && activeThreadId === null) {
            setActiveThreadId(ts[0].thread_id);
          }
        }
      })
      .catch(() => { if (!cancelled) setLoadingThreads(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Load fact count for 🧠 chip
  useEffect(() => {
    getMemoryFactCount(projectId).then(setFactCount).catch(() => {});
  }, [projectId]);

  // Subscribe to new memory facts to keep count live
  useEffect(() => {
    const unsub = subscribeToMemoryFacts(projectId, (fact) => {
      if (fact.source !== 'system') {
        setFactCount(prev => prev + 1);
      }
    });
    return unsub;
  }, [projectId]);

  // Escape key
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showMemoryDrawer) { setShowMemoryDrawer(false); return; }
        if (saveModal.open)   { setSaveModal({ open: false, prefill: null }); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showMemoryDrawer, saveModal.open]);

  const startNewThread = () => setActiveThreadId(newThreadId());

  /**
   * Triggered by 💾 icon on a Morgan message.
   * Pre-fills the save modal with a sensible title (first sentence of response).
   */
  const handleSaveMessage = useCallback((msg: PmChatMessage) => {
    const firstSentence = msg.content.split(/[.!?]/)[0]?.trim() ?? msg.content.slice(0, 80);
    setSaveModal({
      open:    true,
      prefill: {
        title:    firstSentence.length > 80 ? firstSentence.slice(0, 77) + '…' : firstSentence,
        body:     msg.content.slice(0, 500),
        category: 'decision',
      },
    });
  }, []);

  const handleModalSave = useCallback(async (
    title: string,
    body:  string,
    category: MemoryFactCategory
  ) => {
    await createMemoryFact(projectId, { title, body, category, source: 'user' });
    setFactCount(prev => prev + 1);
  }, [projectId]);

  return (
    <>
      <style>{`
        @keyframes pmDot {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%       { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:        'fixed',
          inset:           0,
          backgroundColor: 'rgba(0,0,0,0.2)',
          zIndex:          49,
        }}
      />

      {/* Panel */}
      <div
        data-testid="pm-chat-panel"
        style={{
          position:        'fixed',
          top:             0,
          right:           0,
          bottom:          0,
          width:           380,
          backgroundColor: '#fff',
          boxShadow:       '-4px 0 24px rgba(0,0,0,0.10)',
          zIndex:          50,
          display:         'flex',
          flexDirection:   'column',
          borderLeft:      `3px solid ${reeve.color}`,
          overflow:        'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          padding:         '14px 16px',
          borderBottom:    '1px solid #E2E8F0',
          backgroundColor: '#FAFAFA',
          flexShrink:      0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar member="reeve" size="sm" />
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1E293B' }}>Reeve</p>
              <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Reeve · Project Manager · AI</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* 🧠 facts chip */}
            <button
              data-testid="memory-chip"
              onClick={() => setShowMemoryDrawer(true)}
              title="View project memory"
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             4,
                padding:         '4px 8px',
                border:          '1px solid #E2E8F0',
                borderRadius:    12,
                backgroundColor: '#F8FAFC',
                fontSize:        12,
                fontWeight:      600,
                color:           '#475569',
                cursor:          'pointer',
                transition:      'background-color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            >
              🧠 {factCount > 0 ? `${factCount} facts` : 'Memory'}
            </button>

            <button
              data-testid="pm-chat-new-thread-btn"
              onClick={startNewThread}
              title="New conversation"
              style={{
                padding: '4px 10px', border: '1px solid #CBD5E1', borderRadius: 6,
                backgroundColor: '#fff', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer',
              }}
            >
              + New
            </button>

            <button
              data-testid="pm-chat-close-btn"
              onClick={onClose}
              title="Close (Esc)"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '1px solid #E2E8F0', backgroundColor: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#64748B',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeThreadId ? (
            <ChatView
              projectId={projectId}
              threadId={activeThreadId}
              onBack={() => setActiveThreadId(null)}
              onSaveMessage={handleSaveMessage}
            />
          ) : (
            <ThreadList
              threads={threads}
              loading={loadingThreads}
              onSelect={setActiveThreadId}
              onNewThread={startNewThread}
            />
          )}
        </div>
      </div>

      {/* Memory Drawer */}
      {showMemoryDrawer && (
        <MemoryDrawer
          projectId={projectId}
          onClose={() => setShowMemoryDrawer(false)}
          initialSave={pendingDrawerSave}
          onSaveConsumed={() => setPendingDrawerSave(null)}
        />
      )}

      {/* Save to Memory modal (from 💾 icon) */}
      {saveModal.open && saveModal.prefill && (
        <SaveMemoryModal
          prefill={saveModal.prefill}
          onSave={handleModalSave}
          onClose={() => setSaveModal({ open: false, prefill: null })}
        />
      )}
    </>
  );
}
