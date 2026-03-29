/**
 * Feature Workflow Screen — Build 016
 *
 * Two-panel layout:
 *   Left  — 5-step vertical accordion (Design → Schema → Code → Deploy → QA)
 *   Right — Persistent Claude chat sidebar, one thread per step tab
 *
 * Route: /projects/:id/features/:featureId
 */

import {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSession } from '@supabase/auth-helpers-react';
import {
  getFeatureWithSteps,
  getPendingTasksForStep,
  getStepIterations,
  getChatThread,
  approveStep,
  requestChanges,
  updateStepContent,
  sendChatMessage,
  getStepRenderState,
  isDesignContent,
  isSchemaContent,
  isCodeContent,
  isDeployContent,
  isQaContent,
} from '@/api/featureWorkflow';
import type {
  Feature,
  FeatureStep,
  FeatureIteration,
  FeatureChatMessage,
  HumanTask,
  STEP_LABELS,
} from '@/types/db';
import { STEP_LABELS as LABELS } from '@/types/db';

// ─────────────────────────────────────────────────────────────────────────────
// Colours
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:           '#636366',
  active:            '#0a84ff',
  approved:          '#30d158',
  changes_requested: '#ff9f0a',
};

const PRIORITY_COLORS: Record<string, string> = {
  p0: '#ff3b30',
  p1: '#ff9f0a',
  p2: '#0a84ff',
  p3: '#636366',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const label: Record<string, string> = {
    pending:           'Pending',
    active:            'Active',
    approved:          '✓ Approved',
    changes_requested: 'Changes Requested',
  };
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      backgroundColor: STATUS_COLORS[status] + '22',
      color:           STATUS_COLORS[status],
      border:          `1px solid ${STATUS_COLORS[status]}44`,
    }}>
      {label[status] ?? status}
    </span>
  );
}

function HumanTaskBanner({ tasks, onDismiss }: { tasks: HumanTask[]; onDismiss: (id: string) => void }) {
  if (!tasks.length) return null;
  return (
    <div style={{
      background: '#ff9f0a1a', border: '1px solid #ff9f0a44',
      borderRadius: 8, padding: '10px 14px', marginBottom: 16,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#ff9f0a', marginBottom: 6 }}>
        Action required
      </p>
      {tasks.map((t) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text)', flex: 1 }}>{t.title}</span>
          <button
            onClick={() => onDismiss(t.id)}
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4, border: 'none',
              background: '#ff9f0a', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Mark done
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step panels (content rendering per step type)
// ─────────────────────────────────────────────────────────────────────────────

function DesignPanel({
  step,
  onEdit,
}: {
  step: FeatureStep;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const content = isDesignContent(step.content) ? step.content : null;
  const text    = content?.spec_text ?? '';

  function startEdit() {
    setDraft(text);
    setEditing(true);
  }

  function save() {
    onEdit(draft);
    setEditing(false);
  }

  return (
    <div>
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            style={{
              width: '100%', resize: 'vertical', borderRadius: 6,
              border: '1px solid var(--color-border)',
              padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
              background: 'var(--color-bg)', color: 'var(--color-text)',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={save} style={btnStyle('primary')}>Save</button>
            <button onClick={() => setEditing(false)} style={btnStyle('ghost')}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          {text ? (
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13,
              lineHeight: 1.7, color: 'var(--color-text)', margin: 0,
              fontFamily: 'inherit',
            }}>
              {text}
            </pre>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No spec written yet. Click Edit to add requirements.
            </p>
          )}
          {step.status !== 'approved' && (
            <button onClick={startEdit} style={{ ...btnStyle('ghost'), marginTop: 12 }}>
              Edit spec
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SchemaPanel({
  step,
  onEdit,
}: {
  step: FeatureStep;
  onEdit: (sql: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const content = isSchemaContent(step.content) ? step.content : null;
  const sql     = content?.sql ?? '';

  function startEdit() {
    setDraft(sql);
    setEditing(true);
  }

  function save() {
    onEdit(draft);
    setEditing(false);
  }

  return (
    <div>
      {content?.migration_run && (
        <div style={{
          fontSize: 11, color: '#30d158', fontWeight: 600,
          marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ✓ Migration applied
        </div>
      )}
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            style={{
              width: '100%', resize: 'vertical', borderRadius: 6,
              border: '1px solid var(--color-border)',
              padding: '10px 12px', fontSize: 12, lineHeight: 1.5,
              background: '#1c1c1e', color: '#e5e5ea',
              fontFamily: '"SF Mono", "Fira Code", monospace',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={save} style={btnStyle('primary')}>Save</button>
            <button onClick={() => setEditing(false)} style={btnStyle('ghost')}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          {sql ? (
            <pre style={{
              background: '#1c1c1e', color: '#e5e5ea',
              borderRadius: 8, padding: '14px 16px',
              fontSize: 12, lineHeight: 1.5, overflow: 'auto',
              fontFamily: '"SF Mono", "Fira Code", monospace',
              margin: 0,
            }}>
              {sql}
            </pre>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No schema yet. This is generated automatically when Design is approved.
            </p>
          )}
          {step.status !== 'approved' && (
            <button onClick={startEdit} style={{ ...btnStyle('ghost'), marginTop: 12 }}>
              Edit SQL
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CodePanel({ step }: { step: FeatureStep }) {
  const [selectedFile, setSelectedFile] = useState(0);
  const content = isCodeContent(step.content) ? step.content : null;
  const files   = content?.files ?? [];

  if (!files.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
        Code will be generated automatically when Schema is approved.
      </p>
    );
  }

  const active = files[selectedFile];

  return (
    <div>
      {/* File tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 0, flexWrap: 'wrap' }}>
        {files.map((f, i) => (
          <button
            key={f.name}
            onClick={() => setSelectedFile(i)}
            style={{
              padding: '4px 12px', borderRadius: '6px 6px 0 0', fontSize: 11,
              border: '1px solid var(--color-border)',
              borderBottom: i === selectedFile ? '1px solid #1c1c1e' : '1px solid var(--color-border)',
              background:   i === selectedFile ? '#1c1c1e' : 'var(--color-surface)',
              color:        i === selectedFile ? '#e5e5ea' : 'var(--color-text-muted)',
              cursor: 'pointer', fontFamily: '"SF Mono", "Fira Code", monospace',
            }}
          >
            {f.name}
            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>{f.line_count}L</span>
          </button>
        ))}
      </div>
      <pre style={{
        background: '#1c1c1e', color: '#e5e5ea',
        borderRadius: '0 8px 8px 8px', padding: '14px 16px',
        fontSize: 12, lineHeight: 1.5, overflow: 'auto', maxHeight: 480,
        fontFamily: '"SF Mono", "Fira Code", monospace',
        margin: 0,
      }}>
        {active?.content ?? ''}
      </pre>
    </div>
  );
}

function DeployPanel({
  step,
  onEdit,
}: {
  step: FeatureStep;
  onEdit: (patch: { github_pr_url: string | null; netlify_deploy_url: string | null }) => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [prUrl,   setPrUrl]     = useState('');
  const [deployUrl, setDeployUrl] = useState('');
  const content = isDeployContent(step.content) ? step.content : null;

  function startEdit() {
    setPrUrl(content?.github_pr_url ?? '');
    setDeployUrl(content?.netlify_deploy_url ?? '');
    setEditing(true);
  }

  function save() {
    onEdit({
      github_pr_url:       prUrl.trim() || null,
      netlify_deploy_url:  deployUrl.trim() || null,
    });
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {editing ? (
        <>
          <label style={labelStyle}>
            GitHub PR URL
            <input
              type="url"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/org/repo/pull/123"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Netlify Deploy URL
            <input
              type="url"
              value={deployUrl}
              onChange={(e) => setDeployUrl(e.target.value)}
              placeholder="https://deploy-preview-123--app.netlify.app"
              style={inputStyle}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} style={btnStyle('primary')}>Save</button>
            <button onClick={() => setEditing(false)} style={btnStyle('ghost')}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <DeployLink label="GitHub PR" url={content?.github_pr_url} />
          <DeployLink label="Netlify Deploy" url={content?.netlify_deploy_url} />
          {step.status !== 'approved' && (
            <button onClick={startEdit} style={btnStyle('ghost')}>Edit links</button>
          )}
        </>
      )}
    </div>
  );
}

function DeployLink({ label, url }: { label: string; url: string | null | undefined }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, color: '#0a84ff', wordBreak: 'break-all' }}
        >
          {url}
        </a>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          Not set
        </p>
      )}
    </div>
  );
}

function QaPanel({
  step,
  onEdit,
}: {
  step: FeatureStep;
  onEdit: (patch: { test_notes: string | null }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const content = isQaContent(step.content) ? step.content : null;
  const notes   = content?.test_notes ?? '';

  function startEdit() {
    setDraft(notes);
    setEditing(true);
  }

  function save() {
    onEdit({ test_notes: draft.trim() || null });
    setEditing(false);
  }

  return (
    <div>
      {content?.sign_off_by && (
        <p style={{ fontSize: 12, color: '#30d158', marginBottom: 8, fontWeight: 600 }}>
          ✓ Signed off by {content.sign_off_by}
        </p>
      )}
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            placeholder="Document test cases, edge cases checked, bugs found…"
            style={{
              width: '100%', resize: 'vertical', borderRadius: 6,
              border: '1px solid var(--color-border)',
              padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
              background: 'var(--color-bg)', color: 'var(--color-text)',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={save} style={btnStyle('primary')}>Save</button>
            <button onClick={() => setEditing(false)} style={btnStyle('ghost')}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          {notes ? (
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13,
              lineHeight: 1.7, color: 'var(--color-text)', margin: 0,
              fontFamily: 'inherit',
            }}>
              {notes}
            </pre>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No test notes yet.
            </p>
          )}
          {step.status !== 'approved' && (
            <button onClick={startEdit} style={{ ...btnStyle('ghost'), marginTop: 12 }}>
              Edit notes
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Iteration history
// ─────────────────────────────────────────────────────────────────────────────
function IterationHistory({ iterations }: { iterations: FeatureIteration[] }) {
  const [open, setOpen] = useState(false);
  if (!iterations.length) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          fontSize: 12, color: 'var(--color-text-muted)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        {open ? '▾' : '▸'} {iterations.length} revision{iterations.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {iterations.map((iter) => (
            <div
              key={iter.id}
              style={{
                padding: '8px 12px', borderRadius: 6,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 8 }}>
                #{iter.iteration_number}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text)' }}>
                {iter.change_note}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step accordion item
// ─────────────────────────────────────────────────────────────────────────────
function StepAccordion({
  step,
  feature,
  isOpen,
  onToggle,
  onApprove,
  onRequestChanges,
  onEditContent,
  activeStepTab,
  onStepTabChange,
}: {
  step:             FeatureStep;
  feature:          Feature;
  isOpen:           boolean;
  onToggle:         () => void;
  onApprove:        (stepId: string) => void;
  onRequestChanges: (stepId: string, note: string) => void;
  onEditContent:    (stepId: string, patch: Record<string, unknown>) => void;
  activeStepTab:    number;
  onStepTabChange:  (n: number) => void;
}) {
  const [tasks,        setTasks]      = useState<HumanTask[]>([]);
  const [iterations,   setIterations] = useState<FeatureIteration[]>([]);
  const [changeNote,   setChangeNote] = useState('');
  const [showReject,   setShowReject] = useState(false);
  const [acting,       setActing]     = useState(false);

  const renderState = getStepRenderState(step);

  useEffect(() => {
    if (!isOpen) return;
    getPendingTasksForStep(step.id).then(setTasks).catch(console.error);
    getStepIterations(step.id).then(setIterations).catch(console.error);
  }, [isOpen, step.id, step.status]);

  async function handleApprove() {
    setActing(true);
    try {
      onApprove(step.id);
    } finally {
      setActing(false);
    }
  }

  async function handleRequestChanges() {
    if (!changeNote.trim()) return;
    setActing(true);
    try {
      onRequestChanges(step.id, changeNote.trim());
      setChangeNote('');
      setShowReject(false);
    } finally {
      setActing(false);
    }
  }

  function handleDismissTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    // optimistic — actual DB update happens server-side when resolveHumanTask is called
    import('@/api/projectHub').then(({ resolveHumanTask }) => resolveHumanTask(taskId)).catch(console.error);
  }

  const stepLabel = LABELS[step.step_number] ?? `Step ${step.step_number}`;

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      overflow: 'hidden',
      opacity: renderState === 'locked' ? 0.5 : 1,
    }}>
      {/* Header */}
      <button
        onClick={renderState !== 'locked' ? onToggle : undefined}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px', background: isOpen ? 'var(--color-surface)' : 'transparent',
          border: 'none', cursor: renderState === 'locked' ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Circle indicator */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: renderState === 'approved'
            ? '#30d158'
            : renderState === 'active'
              ? '#0a84ff'
              : 'var(--color-border)',
          color: renderState === 'locked' ? 'var(--color-text-muted)' : '#fff',
          fontSize: 13, fontWeight: 700,
        }}>
          {renderState === 'approved' ? '✓' : step.step_number}
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
            {stepLabel}
          </p>
        </div>

        <StatusChip status={step.status} />

        <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginLeft: 4 }}>
          {isOpen ? '▴' : '▾'}
        </span>
      </button>

      {/* Body */}
      {isOpen && renderState !== 'locked' && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Sync this step's tab with the chat sidebar */}
          {activeStepTab !== step.step_number && (
            <div style={{ marginBottom: 10 }}>
              <button
                onClick={() => onStepTabChange(step.step_number)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6,
                  background: '#0a84ff1a', color: '#0a84ff',
                  border: '1px solid #0a84ff44', cursor: 'pointer',
                }}
              >
                Switch chat to {stepLabel}
              </button>
            </div>
          )}

          {/* Human task banner */}
          <HumanTaskBanner tasks={tasks} onDismiss={handleDismissTask} />

          {/* Step content */}
          <div style={{ marginBottom: 16 }}>
            {step.step_number === 1 && (
              <DesignPanel
                step={step}
                onEdit={(text) => onEditContent(step.id, { spec_text: text })}
              />
            )}
            {step.step_number === 2 && (
              <SchemaPanel
                step={step}
                onEdit={(sql) => onEditContent(step.id, { sql })}
              />
            )}
            {step.step_number === 3 && <CodePanel step={step} />}
            {step.step_number === 4 && (
              <DeployPanel
                step={step}
                onEdit={(patch) => onEditContent(step.id, patch)}
              />
            )}
            {step.step_number === 5 && (
              <QaPanel
                step={step}
                onEdit={(patch) => onEditContent(step.id, patch)}
              />
            )}
          </div>

          {/* Iteration history */}
          <IterationHistory iterations={iterations} />

          {/* Approve / Request changes */}
          {renderState === 'active' && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {showReject ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    rows={3}
                    placeholder="Describe what needs to change…"
                    style={{
                      borderRadius: 6, border: '1px solid var(--color-border)',
                      padding: '8px 10px', fontSize: 13, resize: 'vertical',
                      background: 'var(--color-bg)', color: 'var(--color-text)',
                      fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleRequestChanges}
                      disabled={acting || !changeNote.trim()}
                      style={btnStyle('warning')}
                    >
                      Request changes
                    </button>
                    <button onClick={() => setShowReject(false)} style={btnStyle('ghost')}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleApprove} disabled={acting} style={btnStyle('success')}>
                    ✓ Approve
                  </button>
                  <button onClick={() => setShowReject(true)} style={btnStyle('ghost')}>
                    Request changes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat sidebar
// ─────────────────────────────────────────────────────────────────────────────
function ChatSidebar({
  feature,
  activeTab,
  onTabChange,
  sessionToken,
}: {
  feature:      Feature;
  activeTab:    number;
  onTabChange:  (n: number) => void;
  sessionToken: string;
}) {
  const [threads,    setThreads]    = useState<Record<number, FeatureChatMessage[]>>({});
  const [input,      setInput]      = useState('');
  const [streaming,  setStreaming]  = useState(false);
  const [streamBuf,  setStreamBuf]  = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load thread when tab changes
  useEffect(() => {
    if (threads[activeTab]) return; // already loaded
    getChatThread(feature.id, activeTab as 1 | 2 | 3 | 4 | 5)
      .then((msgs) => setThreads((prev) => ({ ...prev, [activeTab]: msgs })))
      .catch(console.error);
  }, [activeTab, feature.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threads, streamBuf]);

  const messages = threads[activeTab] ?? [];

  async function handleSend() {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput('');

    // Optimistic user message
    const userMsg: FeatureChatMessage = {
      id:          crypto.randomUUID(),
      feature_id:  feature.id,
      step_number: activeTab as 1 | 2 | 3 | 4 | 5,
      role:        'user',
      content:     text,
      created_at:  new Date().toISOString(),
    };
    setThreads((prev) => ({ ...prev, [activeTab]: [...(prev[activeTab] ?? []), userMsg] }));

    setStreaming(true);
    setStreamBuf('');

    try {
      await sendChatMessage(
        feature.id,
        activeTab as 1 | 2 | 3 | 4 | 5,
        text,
        sessionToken,
        (chunk) => setStreamBuf((b) => b + chunk),
        (full) => {
          const assistantMsg: FeatureChatMessage = {
            id:          crypto.randomUUID(),
            feature_id:  feature.id,
            step_number: activeTab as 1 | 2 | 3 | 4 | 5,
            role:        'assistant',
            content:     full,
            created_at:  new Date().toISOString(),
          };
          setThreads((prev) => ({
            ...prev,
            [activeTab]: [...(prev[activeTab] ?? []), assistantMsg],
          }));
          setStreamBuf('');
          setStreaming(false);
        }
      );
    } catch (err) {
      console.error('Chat error:', err);
      setStreamBuf('');
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)',
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--color-border)',
        padding: '0 4px', flexShrink: 0,
      }}>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            onClick={() => onTabChange(n)}
            style={{
              flex: 1, padding: '10px 4px', border: 'none',
              borderBottom: activeTab === n ? '2px solid #0a84ff' : '2px solid transparent',
              background: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              color: activeTab === n ? '#0a84ff' : 'var(--color-text-muted)',
            }}
          >
            {LABELS[n]}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && !streaming && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 24 }}>
            Ask Claude anything about the {LABELS[activeTab]} step.
          </p>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {streaming && streamBuf && (
          <ChatBubble
            message={{
              id:          'stream',
              feature_id:  feature.id,
              step_number: activeTab as 1 | 2 | 3 | 4 | 5,
              role:        'assistant',
              content:     streamBuf + '▊',
              created_at:  new Date().toISOString(),
            }}
          />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        borderTop: '1px solid var(--color-border)', padding: '10px 12px',
        display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          rows={2}
          placeholder="Ask Claude… (Enter to send, Shift+Enter for newline)"
          style={{
            flex: 1, resize: 'none', borderRadius: 8,
            border: '1px solid var(--color-border)',
            padding: '8px 10px', fontSize: 13, lineHeight: 1.4,
            background: 'var(--color-bg)', color: 'var(--color-text)',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          style={{
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: !input.trim() || streaming ? 'var(--color-border)' : '#0a84ff',
            color: '#fff', fontWeight: 600, fontSize: 13, cursor: !input.trim() || streaming ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          {streaming ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: FeatureChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '85%',
        padding: '8px 12px',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isUser ? '#0a84ff' : 'var(--color-bg)',
        color:      isUser ? '#fff' : 'var(--color-text)',
        border:     isUser ? 'none' : '1px solid var(--color-border)',
        fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {message.content}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared style helpers
// ─────────────────────────────────────────────────────────────────────────────
function btnStyle(variant: 'primary' | 'ghost' | 'success' | 'warning'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', border: 'none',
  };
  switch (variant) {
    case 'primary':
      return { ...base, background: '#0a84ff', color: '#fff' };
    case 'success':
      return { ...base, background: '#30d158', color: '#fff' };
    case 'warning':
      return { ...base, background: '#ff9f0a', color: '#fff' };
    case 'ghost':
    default:
      return {
        ...base, background: 'transparent', color: 'var(--color-text-muted)',
        border: '1px solid var(--color-border)',
      };
  }
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
};

const inputStyle: React.CSSProperties = {
  borderRadius: 6, border: '1px solid var(--color-border)',
  padding: '8px 10px', fontSize: 13,
  background: 'var(--color-bg)', color: 'var(--color-text)',
  fontFamily: 'inherit',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function FeatureWorkflowScreen() {
  const { id: projectId, featureId } = useParams<{ id: string; featureId: string }>();
  const navigate = useNavigate();
  const session  = useSession();

  const [feature,     setFeature]     = useState<Feature | null>(null);
  const [steps,       setSteps]       = useState<FeatureStep[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [openStep,    setOpenStep]    = useState<number | null>(null);
  const [chatTab,     setChatTab]     = useState<number>(1);
  const [toastMsg,    setToastMsg]    = useState('');

  const sessionToken = session?.access_token ?? '';

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!featureId) return;
    try {
      const { feature: f, steps: s } = await getFeatureWithSteps(featureId);
      setFeature(f);
      setSteps(s);
      // Auto-open active step
      const activeStep = s.find((st) => st.status === 'active' || st.status === 'changes_requested');
      if (activeStep) {
        setOpenStep(activeStep.step_number);
        setChatTab(activeStep.step_number);
      } else {
        // All approved or first step
        const firstApproved = s.find((st) => st.status === 'approved');
        setOpenStep(firstApproved ? firstApproved.step_number : 1);
        setChatTab(1);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load feature');
    } finally {
      setLoading(false);
    }
  }, [featureId]);

  useEffect(() => { load(); }, [load]);

  // ── Toast helper ─────────────────────────────────────────────────────────
  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  }

  // ── Step actions ─────────────────────────────────────────────────────────
  async function handleApprove(stepId: string) {
    try {
      await approveStep(stepId, session?.user?.id ?? '');
      toast('Step approved');
      await load();
    } catch (err) {
      console.error(err);
      toast('Failed to approve step');
    }
  }

  async function handleRequestChanges(stepId: string, note: string) {
    try {
      await requestChanges(stepId, note);
      toast('Changes requested');
      await load();
    } catch (err) {
      console.error(err);
      toast('Failed to request changes');
    }
  }

  async function handleEditContent(stepId: string, patch: Record<string, unknown>) {
    try {
      await updateStepContent(stepId, patch);
      await load();
    } catch (err) {
      console.error(err);
      toast('Failed to save');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  if (error || !feature) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: '#ff3b30', fontSize: 14 }}>{error || 'Feature not found'}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg)' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 24px', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)', flexShrink: 0,
      }}>
        <Link
          to={`/projects/${projectId}/screens`}
          style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none' }}
        >
          ← Screens
        </Link>
        <span style={{ color: 'var(--color-border)' }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
          {feature.name}
        </span>

        {/* Priority chip */}
        <span style={{
          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: PRIORITY_COLORS[feature.priority] + '22',
          color:      PRIORITY_COLORS[feature.priority],
          border:     `1px solid ${PRIORITY_COLORS[feature.priority]}44`,
        }}>
          {feature.priority?.toUpperCase()}
        </span>

        <div style={{ flex: 1 }} />

        {/* Overall progress dots */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {steps.map((s) => (
            <div
              key={s.id}
              title={LABELS[s.step_number]}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: s.status === 'approved'
                  ? '#30d158'
                  : s.status === 'active'
                    ? '#0a84ff'
                    : s.status === 'changes_requested'
                      ? '#ff9f0a'
                      : 'var(--color-border)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Two-panel body ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: workflow accordion */}
        <div style={{
          width: '55%', minWidth: 400, overflowY: 'auto',
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Feature meta */}
          <div style={{ marginBottom: 8 }}>
            {feature.description && (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.55, margin: '0 0 6px' }}>
                {feature.description}
              </p>
            )}
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
              Complexity: <strong>{feature.complexity}</strong>
            </p>
          </div>

          {steps.map((step) => (
            <StepAccordion
              key={step.id}
              step={step}
              feature={feature}
              isOpen={openStep === step.step_number}
              onToggle={() => setOpenStep((p) => p === step.step_number ? null : step.step_number)}
              onApprove={handleApprove}
              onRequestChanges={handleRequestChanges}
              onEditContent={handleEditContent}
              activeStepTab={chatTab}
              onStepTabChange={(n) => setChatTab(n)}
            />
          ))}
        </div>

        {/* Right: chat sidebar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {sessionToken ? (
            <ChatSidebar
              feature={feature}
              activeTab={chatTab}
              onTabChange={(n) => setChatTab(n)}
              sessionToken={sessionToken}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Sign in to use chat</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c1e', color: '#fff', padding: '10px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)', zIndex: 999,
        }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
