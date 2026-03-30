/**
 * MemoryDrawer — Build 043
 *
 * Full-height right drawer rendered over the PmChatPanel.
 * Shows all project_memory_facts, categorised into tabs.
 * Builder can add, edit, and delete facts. System facts (source='system')
 * are read-only and shown only in the System tab.
 *
 * data-testid inventory:
 *   memory-drawer               — root div
 *   memory-tab-{category}       — each tab button (all, decision, pattern, …, system)
 *   memory-search               — search input
 *   memory-fact-{id}            — individual fact card
 *   memory-fact-edit-{id}       — edit icon button
 *   memory-fact-delete-{id}     — delete icon button
 *   memory-add-btn              — + Add fact button
 *   memory-save-modal           — save/edit modal overlay
 *   memory-save-title           — title input in modal
 *   memory-save-category        — category dropdown in modal
 *   memory-save-confirm         — Save button in modal
 *   memory-save-cancel          — Cancel button in modal
 *   memory-compaction-status    — compaction section at bottom
 *   memory-compaction-run-btn   — "Run compaction now" button (Pass 2 — disabled placeholder)
 */

import { useEffect, useState, useCallback } from 'react';
import type { ProjectMemoryFact, MemoryFactCategory, NewMemoryFactInput, UpdateMemoryFactInput } from '@/types/db';
import {
  getMemoryFacts,
  getSystemMemoryFacts,
  createMemoryFact,
  updateMemoryFact,
  deleteMemoryFact,
  subscribeToMemoryFacts,
} from '@/api/projectMemory';

// ── Constants ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',          label: 'All' },
  { key: 'decision',     label: 'Decisions' },
  { key: 'pattern',      label: 'Patterns' },
  { key: 'preference',   label: 'Preferences' },
  { key: 'constraint',   label: 'Constraints' },
  { key: 'cancellation', label: 'Cancellations' },
  { key: 'system',       label: 'System' },
] as const;

type TabKey = typeof TABS[number]['key'];

const CATEGORY_COLORS: Record<MemoryFactCategory, { bg: string; text: string }> = {
  decision:     { bg: '#EFF6FF', text: '#1D4ED8' },
  pattern:      { bg: '#F0FDF4', text: '#15803D' },
  preference:   { bg: '#FFF7ED', text: '#C2410C' },
  constraint:   { bg: '#FEF2F2', text: '#B91C1C' },
  cancellation: { bg: '#F5F3FF', text: '#6D28D9' },
  note:         { bg: '#F8FAFC', text: '#475569' },
};

const CATEGORY_OPTIONS: MemoryFactCategory[] = [
  'decision', 'pattern', 'preference', 'constraint', 'cancellation', 'note',
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Save Modal ─────────────────────────────────────────────────────────────

interface SaveModalProps {
  initial: { title: string; body: string; category: MemoryFactCategory } | null;
  onSave:  (data: { title: string; body: string; category: MemoryFactCategory }) => Promise<void>;
  onClose: () => void;
}

function SaveModal({ initial, onSave, onClose }: SaveModalProps) {
  const [title,    setTitle]    = useState(initial?.title    ?? '');
  const [body,     setBody]     = useState(initial?.body     ?? '');
  const [category, setCategory] = useState<MemoryFactCategory>(initial?.category ?? 'decision');
  const [saving,   setSaving]   = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), body: body.trim(), category });
      onClose();
    } catch (err) {
      console.error('Failed to save memory fact:', err);
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
        backgroundColor: 'rgba(0,0,0,0.35)',
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
        width:           420,
        maxWidth:        '90vw',
        padding:         24,
        boxShadow:       '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1E293B' }}>
          {initial?.title ? 'Edit memory fact' : 'Save to memory'}
        </h3>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>
          Title
        </label>
        <input
          data-testid="memory-save-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What should Morgan remember?"
          autoFocus
          style={{
            width:        '100%',
            padding:      '8px 10px',
            border:       '1px solid #CBD5E1',
            borderRadius: 6,
            fontSize:     13,
            color:        '#1E293B',
            outline:      'none',
            boxSizing:    'border-box',
            marginBottom: 12,
          }}
        />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>
          Details
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add context, rationale, or specifics…"
          rows={3}
          style={{
            width:        '100%',
            padding:      '8px 10px',
            border:       '1px solid #CBD5E1',
            borderRadius: 6,
            fontSize:     13,
            color:        '#1E293B',
            outline:      'none',
            resize:       'vertical',
            boxSizing:    'border-box',
            fontFamily:   'inherit',
            marginBottom: 12,
          }}
        />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>
          Category
        </label>
        <select
          data-testid="memory-save-category"
          value={category}
          onChange={e => setCategory(e.target.value as MemoryFactCategory)}
          style={{
            width:        '100%',
            padding:      '8px 10px',
            border:       '1px solid #CBD5E1',
            borderRadius: 6,
            fontSize:     13,
            color:        '#1E293B',
            outline:      'none',
            backgroundColor: '#fff',
            marginBottom: 20,
            boxSizing:    'border-box',
          }}
        >
          {CATEGORY_OPTIONS.map(c => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            data-testid="memory-save-cancel"
            onClick={onClose}
            style={{
              padding:         '8px 16px',
              border:          '1px solid #CBD5E1',
              borderRadius:    8,
              backgroundColor: '#fff',
              fontSize:        13,
              fontWeight:      600,
              color:           '#475569',
              cursor:          'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="memory-save-confirm"
            onClick={handleSave}
            disabled={!title.trim() || !body.trim() || saving}
            style={{
              padding:         '8px 16px',
              border:          'none',
              borderRadius:    8,
              backgroundColor: title.trim() && body.trim() && !saving ? '#4F46E5' : '#E2E8F0',
              color:           title.trim() && body.trim() && !saving ? '#fff' : '#94A3B8',
              fontSize:        13,
              fontWeight:      600,
              cursor:          title.trim() && body.trim() && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fact Card ──────────────────────────────────────────────────────────────

interface FactCardProps {
  fact:     ProjectMemoryFact;
  onEdit:   (fact: ProjectMemoryFact) => void;
  onDelete: (id: string) => void;
}

function FactCard({ fact, onEdit, onDelete }: FactCardProps) {
  const [hovered, setHovered] = useState(false);
  const colors = CATEGORY_COLORS[fact.category] ?? CATEGORY_COLORS.note;
  const isSystem = fact.source === 'system';

  return (
    <div
      data-testid={`memory-fact-${fact.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius:    8,
        border:          '1px solid #E2E8F0',
        padding:         '12px 14px',
        backgroundColor: hovered ? '#FAFAFA' : '#fff',
        transition:      'background-color 0.12s',
        position:        'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize:        10,
                fontWeight:      700,
                letterSpacing:   '0.05em',
                textTransform:   'uppercase',
                color:           colors.text,
                backgroundColor: colors.bg,
                padding:         '2px 6px',
                borderRadius:    4,
              }}
            >
              {fact.category}
            </span>
            {isSystem && (
              <span style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic' }}>system</span>
            )}
          </div>
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#1E293B', lineHeight: 1.35 }}>
            {fact.title}
          </p>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {fact.body}
          </p>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{formatDate(fact.updated_at)}</span>
        </div>

        {!isSystem && hovered && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              data-testid={`memory-fact-edit-${fact.id}`}
              onClick={() => onEdit(fact)}
              title="Edit"
              style={{
                width:           26,
                height:          26,
                borderRadius:    6,
                border:          '1px solid #E2E8F0',
                backgroundColor: '#fff',
                cursor:          'pointer',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                fontSize:        12,
                color:           '#64748B',
              }}
            >
              ✏
            </button>
            <button
              data-testid={`memory-fact-delete-${fact.id}`}
              onClick={() => onDelete(fact.id)}
              title="Delete"
              style={{
                width:           26,
                height:          26,
                borderRadius:    6,
                border:          '1px solid #FCA5A5',
                backgroundColor: '#FEF2F2',
                cursor:          'pointer',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                fontSize:        12,
                color:           '#DC2626',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────

interface MemoryDrawerProps {
  projectId: string;
  onClose:   () => void;
  /** Optional prefill for the save modal — e.g. from Morgan's proactive suggestion */
  initialSave?: { title: string; body: string; category: MemoryFactCategory } | null;
  onSaveConsumed?: () => void;
}

export default function MemoryDrawer({
  projectId,
  onClose,
  initialSave,
  onSaveConsumed,
}: MemoryDrawerProps) {
  const [activeTab,   setActiveTab]   = useState<TabKey>('all');
  const [search,      setSearch]      = useState('');
  const [userFacts,   setUserFacts]   = useState<ProjectMemoryFact[]>([]);
  const [systemFacts, setSystemFacts] = useState<ProjectMemoryFact[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modalState,  setModalState]  = useState<{
    open:     boolean;
    editing:  ProjectMemoryFact | null;
    prefill:  { title: string; body: string; category: MemoryFactCategory } | null;
  }>({ open: false, editing: null, prefill: null });
  const [undoQueue,   setUndoQueue]   = useState<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load all facts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getMemoryFacts(projectId),
      getSystemMemoryFacts(projectId),
    ]).then(([user, system]) => {
      if (!cancelled) {
        setUserFacts(user);
        setSystemFacts(system);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  // Subscribe to new facts (e.g. Morgan auto-extracted)
  useEffect(() => {
    const unsub = subscribeToMemoryFacts(projectId, (fact) => {
      if (fact.source === 'system') {
        setSystemFacts(prev => [fact, ...prev]);
      } else {
        setUserFacts(prev => [fact, ...prev.filter(f => f.id !== fact.id)]);
      }
    });
    return unsub;
  }, [projectId]);

  // Open save modal if initialSave is provided (from proactive Morgan suggestion)
  useEffect(() => {
    if (initialSave) {
      setModalState({ open: true, editing: null, prefill: initialSave });
      onSaveConsumed?.();
    }
  }, [initialSave, onSaveConsumed]);

  // Filtered + searched facts for current tab
  const displayedFacts = (() => {
    const base = activeTab === 'system'
      ? systemFacts
      : activeTab === 'all'
        ? userFacts
        : userFacts.filter(f => f.category === activeTab);

    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(f =>
      f.title.toLowerCase().includes(q) || f.body.toLowerCase().includes(q)
    );
  })();

  const handleDelete = useCallback((id: string) => {
    // Optimistic remove
    setUserFacts(prev => prev.filter(f => f.id !== id));

    // 5s undo window
    const timer = setTimeout(async () => {
      try {
        await deleteMemoryFact(id);
      } catch (err) {
        console.error('Failed to delete fact:', err);
        // Reload on failure
        getMemoryFacts(projectId).then(setUserFacts).catch(() => {});
      }
      setUndoQueue(prev => { const next = new Map(prev); next.delete(id); return next; });
    }, 5000);

    setUndoQueue(prev => new Map(prev).set(id, timer));
    // TODO: show undo toast (wire to Toast component in a follow-up)
  }, [projectId]);

  const handleUndoDelete = useCallback((id: string) => {
    const timer = undoQueue.get(id);
    if (timer) {
      clearTimeout(timer);
      setUndoQueue(prev => { const next = new Map(prev); next.delete(id); return next; });
      // Fact was already removed from local state — refetch to restore
      getMemoryFacts(projectId).then(setUserFacts).catch(() => {});
    }
  }, [undoQueue, projectId]);

  const handleSave = useCallback(async (data: { title: string; body: string; category: MemoryFactCategory }) => {
    if (modalState.editing) {
      const updated = await updateMemoryFact(modalState.editing.id, data);
      setUserFacts(prev => prev.map(f => f.id === updated.id ? updated : f));
    } else {
      const created = await createMemoryFact(projectId, data);
      setUserFacts(prev => [created, ...prev]);
    }
  }, [modalState.editing, projectId]);

  return (
    <>
      {/* Overlay behind drawer */}
      <div
        onClick={onClose}
        style={{
          position:        'fixed',
          inset:           0,
          backgroundColor: 'rgba(0,0,0,0.15)',
          zIndex:          98,
        }}
      />

      {/* Drawer */}
      <div
        data-testid="memory-drawer"
        style={{
          position:        'fixed',
          top:             0,
          right:           380,   // sits to the left of PmChatPanel (380px wide)
          bottom:          0,
          width:           360,
          backgroundColor: '#fff',
          boxShadow:       '-4px 0 20px rgba(0,0,0,0.08)',
          zIndex:          99,
          display:         'flex',
          flexDirection:   'column',
          borderLeft:      '1px solid #E2E8F0',
        }}
      >
        {/* Header */}
        <div style={{
          padding:         '14px 16px',
          borderBottom:    '1px solid #E2E8F0',
          backgroundColor: '#FAFAFA',
          flexShrink:      0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🧠</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Project Memory</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                data-testid="memory-add-btn"
                onClick={() => setModalState({ open: true, editing: null, prefill: null })}
                style={{
                  padding:         '4px 10px',
                  border:          '1px solid #CBD5E1',
                  borderRadius:    6,
                  backgroundColor: '#fff',
                  fontSize:        12,
                  fontWeight:      600,
                  color:           '#475569',
                  cursor:          'pointer',
                }}
              >
                + Add fact
              </button>
              <button
                onClick={onClose}
                style={{
                  width:           26,
                  height:          26,
                  border:          '1px solid #E2E8F0',
                  borderRadius:    '50%',
                  backgroundColor: '#fff',
                  cursor:          'pointer',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  fontSize:        13,
                  color:           '#64748B',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Search */}
          <input
            data-testid="memory-search"
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search facts…"
            style={{
              width:        '100%',
              padding:      '7px 10px',
              border:       '1px solid #CBD5E1',
              borderRadius: 6,
              fontSize:     13,
              color:        '#1E293B',
              outline:      'none',
              boxSizing:    'border-box',
              backgroundColor: '#fff',
            }}
          />
        </div>

        {/* Tab bar */}
        <div style={{
          display:         'flex',
          overflowX:       'auto',
          borderBottom:    '1px solid #E2E8F0',
          flexShrink:      0,
          scrollbarWidth:  'none',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              data-testid={`memory-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key as TabKey)}
              style={{
                padding:         '8px 12px',
                border:          'none',
                borderBottom:    activeTab === tab.key ? '2px solid #4F46E5' : '2px solid transparent',
                backgroundColor: 'transparent',
                fontSize:        12,
                fontWeight:      activeTab === tab.key ? 700 : 500,
                color:           activeTab === tab.key ? '#4F46E5' : '#64748B',
                cursor:          'pointer',
                whiteSpace:      'nowrap',
                flexShrink:      0,
              }}
            >
              {tab.label}
              {tab.key === 'all' && userFacts.length > 0 && (
                <span style={{
                  marginLeft:      4,
                  fontSize:        10,
                  backgroundColor: '#EEF2FF',
                  color:           '#4F46E5',
                  borderRadius:    10,
                  padding:         '1px 5px',
                }}>
                  {userFacts.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Fact list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8', fontSize: 13 }}>
              Loading memory…
            </div>
          )}

          {!loading && displayedFacts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              {userFacts.length === 0 && activeTab === 'all' ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>🧠</div>
                  <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#1E293B' }}>
                    Morgan remembers everything.
                  </p>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>
                    As you work with Morgan, key decisions and patterns will be saved here automatically — or you can save any response manually.
                  </p>
                  <button
                    data-testid="memory-add-btn"
                    onClick={() => setModalState({ open: true, editing: null, prefill: null })}
                    style={{
                      padding:         '8px 16px',
                      border:          '1px solid #CBD5E1',
                      borderRadius:    8,
                      backgroundColor: '#fff',
                      fontSize:        13,
                      fontWeight:      600,
                      color:           '#475569',
                      cursor:          'pointer',
                    }}
                  >
                    + Add your first fact
                  </button>
                </>
              ) : (
                <p style={{ fontSize: 13, color: '#94A3B8' }}>
                  {search ? 'No facts match your search.' : `No ${activeTab} facts yet.`}
                </p>
              )}
            </div>
          )}

          {displayedFacts.map(fact => (
            <FactCard
              key={fact.id}
              fact={fact}
              onEdit={f => setModalState({ open: true, editing: f, prefill: null })}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {/* Compaction status (Pass 2 — placeholder) */}
        <div
          data-testid="memory-compaction-status"
          style={{
            borderTop:    '1px solid #E2E8F0',
            padding:      '12px 14px',
            flexShrink:   0,
            backgroundColor: '#F8FAFC',
          }}
        >
          <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Conversation History
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94A3B8' }}>
            Compaction coming soon — older messages will be summarised automatically.
          </p>
          <button
            data-testid="memory-compaction-run-btn"
            disabled
            title="Available in Pass 2"
            style={{
              padding:         '5px 10px',
              border:          '1px solid #E2E8F0',
              borderRadius:    6,
              backgroundColor: '#F1F5F9',
              fontSize:        12,
              color:           '#94A3B8',
              cursor:          'not-allowed',
            }}
          >
            Run compaction now
          </button>
        </div>
      </div>

      {/* Save/edit modal */}
      {modalState.open && (
        <SaveModal
          initial={
            modalState.editing
              ? { title: modalState.editing.title, body: modalState.editing.body, category: modalState.editing.category }
              : modalState.prefill ?? null
          }
          onSave={handleSave}
          onClose={() => setModalState({ open: false, editing: null, prefill: null })}
        />
      )}
    </>
  );
}
