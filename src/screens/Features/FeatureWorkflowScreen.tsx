/**
 * Feature Workflow Screen — Build 033
 *
 * 6-tab pipeline: Design → Schema → Code → Preview → QA → Live
 *
 * Layout:
 *   Top   — PipelineStrip (step bubbles + connector lines)
 *   Below — Tab bar (6 labels)
 *   Body  — Design tab: split chat|output; all other tabs: full-width output
 *
 * Approval gate: only Design can be approved here; that approval unlocks
 * steps 2-6 (DB trigger sets them from 'locked' → 'not_started').
 *
 * Route: /projects/:projectId/features/:featureId
 */

import {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, Lock, Send,
  AlertTriangle, Loader2, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  getFeatureWithSteps,
  getPendingTasksForStep,
  getChatThread,
  approveDesign,
  approveStep,
  updateStepOutput,
  startStep,
  getStepRenderState,
  indexStepsByName,
  isDesignApproved,
  isPipelineComplete,
} from '@/api/featureWorkflow';
import { generateMorganDesignResponse } from '@/api/namedTeam';
import { Avatar } from '@/components/Avatar';
import { TeamChatThread } from '@/components/TeamChatThread';
import type {
  Feature,
  FeatureStep,
  FeatureChatMessage,
  HumanTask,
  FeatureStepName,
} from '@/types/db';
import { STEP_LABELS, STEP_NAMES } from '@/types/db';
import PipelineStrip from '@/components/PipelineStrip';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StepStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-500',
    in_progress: 'bg-blue-50  text-blue-600',
    approved:    'bg-emerald-50 text-emerald-700',
    locked:      'bg-gray-50  text-gray-300',
  };
  const labels: Record<string, string> = {
    not_started: 'Not started',
    in_progress: 'In progress',
    approved:    '✓ Approved',
    locked:      'Locked',
  };
  return (
    <span
      data-testid="step-status-badge"
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function HumanTaskBanner({ tasks }: { tasks: HumanTask[] }) {
  if (!tasks.length) return null;
  return (
    <div
      data-testid="human-task-banner"
      className="flex items-start gap-3 px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg"
    >
      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800">
          {tasks.length} pending {tasks.length === 1 ? 'task' : 'tasks'} required
        </p>
        <ul className="mt-1 space-y-0.5">
          {tasks.slice(0, 3).map(t => (
            <li key={t.id} className="text-xs text-amber-700 truncate">• {t.title}</li>
          ))}
          {tasks.length > 3 && (
            <li className="text-xs text-amber-500">+ {tasks.length - 3} more</li>
          )}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat sidebar (Design step only)
// ─────────────────────────────────────────────────────────────────────────────

interface ChatSidebarProps {
  featureId:    string;
  messages:     FeatureChatMessage[];
  isStreaming:  boolean;
  streamBuffer: string;
  inputValue:   string;
  onInputChange:(v: string) => void;
  onSend:       () => void;
  isLocked:     boolean;
}

function ChatSidebar({
  messages, isStreaming, streamBuffer,
  inputValue, onInputChange, onSend, isLocked,
}: ChatSidebarProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLocked && inputValue.trim() && !isStreaming) onSend();
    }
  };

  return (
    <div
      data-testid="design-chat-sidebar"
      className="flex flex-col h-full border-r border-gray-100 bg-gray-50/50"
    >
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar member="morgan" size="sm" />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1E293B' }}>Morgan</p>
            <p style={{ margin: 0, fontSize: 10, color: '#94A3B8' }}>Product Manager · Design</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <p className="text-sm text-gray-400 text-center mt-8">
            Chat with Morgan to design this feature.
          </p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            data-testid={`chat-message-${msg.role}`}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={[
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm',
              ].join(' ')}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {isStreaming && streamBuffer && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm bg-white border border-gray-200 text-gray-800 shadow-sm">
              <p className="whitespace-pre-wrap leading-relaxed">{streamBuffer}</p>
              <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 rounded-sm" />
            </div>
          </div>
        )}
        {isStreaming && !streamBuffer && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 bg-white border border-gray-200 shadow-sm">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2">
          <textarea
            data-testid="chat-input"
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isLocked ? 'Design is approved — chat closed.' : 'Message Morgan…'}
            disabled={isLocked || isStreaming}
            rows={2}
            className={[
              'flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent',
              'disabled:bg-gray-50 disabled:text-gray-400',
            ].join(' ')}
          />
          <button
            data-testid="chat-send-button"
            onClick={onSend}
            disabled={isLocked || isStreaming || !inputValue.trim()}
            className={[
              'flex-shrink-0 p-2.5 rounded-xl transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'bg-indigo-600 text-white hover:bg-indigo-700',
            ].join(' ')}
          >
            {isStreaming
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step output editor (shared across all tabs)
// ─────────────────────────────────────────────────────────────────────────────

interface OutputPanelProps {
  step:              FeatureStep;
  tasks:             HumanTask[];
  outputDraft:       string;
  onOutputChange:    (v: string) => void;
  onSaveOutput:      () => void;
  onApprove:         () => void;
  isApproving:       boolean;
  isSaving:          boolean;
  designApproved:    boolean;
  showApproveHint?:  boolean;   // Build 044 — one-time hint above Approve button
}

function OutputPanel({
  step, tasks, outputDraft, onOutputChange,
  onSaveOutput, onApprove, isApproving, isSaving, designApproved, showApproveHint,
}: OutputPanelProps) {
  const renderState = getStepRenderState(step);
  const isLocked    = renderState === 'locked';
  const isApproved  = renderState === 'approved';
  const isDesign    = step.step_name === 'design';

  const placeholder: Record<FeatureStepName, string> = {
    design:  'Write the feature spec — describe what this feature does, UX flow, edge cases…',
    schema:  'Paste the SQL migration here — CREATE TABLE, ALTER TABLE, RLS policies…',
    code:    'Generated code output will appear here — components, hooks, API calls…',
    preview: 'Record the preview URL and any notes about what was tested in staging…',
    qa:      'QA sign-off notes — test cases run, pass/fail results, known issues…',
    live:    'Release notes — what shipped, who approved, rollback procedure if needed…',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {STEP_LABELS[step.step_number]}
          </h2>
          <StepStatusBadge status={step.status} />
        </div>

        <div className="flex items-center gap-2">
          {/* Save button — only when editable and has changes */}
          {!isLocked && !isApproved && (
            <button
              data-testid="save-output-button"
              onClick={onSaveOutput}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save draft'}
            </button>
          )}

          {/* One-time approve hint — Build 044 */}
          {!isApproved && !isLocked && isDesign && showApproveHint && (
            <div
              data-testid="approve-hint"
              style={{
                fontSize:        11,
                color:           '#6366F1',
                backgroundColor: '#EEF2FF',
                border:          '1px solid #C7D2FE',
                borderRadius:    6,
                padding:         '4px 10px',
                maxWidth:        240,
                lineHeight:      1.4,
              }}
            >
              This is the one decision you need to make — everything else runs automatically.
            </div>
          )}

          {/* Approve button */}
          {!isApproved && !isLocked && (
            <button
              data-testid={isDesign ? 'approve-design-button' : `approve-step-${step.step_number}-button`}
              onClick={onApprove}
              disabled={isApproving || (!isDesign && !designApproved)}
              className={[
                'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isDesign
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700',
              ].join(' ')}
            >
              {isApproving
                ? <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Approving…</span>
                : isDesign
                ? 'Approve Design ✓'
                : `Approve ${STEP_LABELS[step.step_number]}`}
            </button>
          )}

          {isApproved && (
            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
              <CheckCircle className="w-4 h-4" />
              Approved
              {step.approved_at && (
                <span className="text-gray-400 font-normal ml-1">
                  {new Date(step.approved_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {isLocked && (
            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
              <Lock className="w-3.5 h-3.5" />
              {isDesign ? 'Locked' : 'Awaiting design approval'}
            </div>
          )}
        </div>
      </div>

      {/* Pending tasks */}
      <div className="px-6 pt-4">
        <HumanTaskBanner tasks={tasks} />
      </div>

      {/* Output textarea */}
      <div className="flex-1 px-6 pb-6 flex flex-col">
        <textarea
          data-testid={`step-output-${step.step_name}`}
          value={outputDraft}
          onChange={e => {
            if (!isLocked && !isApproved) onOutputChange(e.target.value);
          }}
          readOnly={isLocked || isApproved}
          placeholder={placeholder[step.step_name]}
          className={[
            'flex-1 w-full h-full resize-none rounded-xl border p-4 text-sm font-mono leading-relaxed',
            'focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent',
            isLocked
              ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
              : isApproved
              ? 'bg-emerald-50/40 border-emerald-100 text-gray-700 cursor-default'
              : 'bg-white border-gray-200 text-gray-800',
          ].join(' ')}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function FeatureWorkflowScreen() {
  const { projectId, featureId } = useParams<{ projectId: string; featureId: string }>();
  const navigate                  = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [feature,      setFeature]      = useState<Feature | null>(null);
  const [steps,        setSteps]        = useState<FeatureStep[]>([]);
  const [tasks,        setTasks]        = useState<HumanTask[]>([]);
  const [chatMessages, setChatMessages] = useState<FeatureChatMessage[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── Tab navigation ────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isTeamTab, setIsTeamTab]   = useState(false);

  // ── Output drafts per step (step_number → draft string) ──────────────────
  const [outputDrafts, setOutputDrafts] = useState<Record<number, string>>({});
  const [isSaving,     setIsSaving]     = useState(false);
  const [isApproving,  setIsApproving]  = useState(false);

  // ── Chat state ────────────────────────────────────────────────────────────
  const [chatInput,    setChatInput]    = useState('');
  const [isStreaming,  setIsStreaming]  = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');

  // ── Build 044: Wren toast, pipeline popover, approve hint ─────────────────
  const [showPipelinePopover, setShowPipelinePopover] = useState(false);
  const [showWrenToast,       setShowWrenToast]       = useState(false);
  const pipelineHintShownKey = 'shipyard_pipeline_hint_shown';
  // One-time approve hint — shown for first feature where design hasn't been approved yet
  const approveHintKey       = 'shipyard_pipeline_hint_shown'; // same localStorage key
  const showApproveHint      = activeStep === 1 &&
    !localStorage.getItem(approveHintKey) &&
    steps.find(s => s.step_number === 1)?.status !== 'approved';

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!featureId) return;
    try {
      const { feature: f, steps: s } = await getFeatureWithSteps(featureId);
      setFeature(f);
      setSteps(s);

      // Initialize output drafts from DB
      const drafts: Record<number, string> = {};
      s.forEach(step => { drafts[step.step_number] = step.output ?? ''; });
      setOutputDrafts(drafts);

      // Load design chat (step 1)
      const msgs = await getChatThread(featureId, 1);
      setChatMessages(msgs);

      // Load tasks for active step
      const activeStepRow = s.find(step => step.step_number === activeStep);
      if (activeStepRow) {
        const t = await getPendingTasksForStep(activeStepRow.id);
        setTasks(t);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature');
    } finally {
      setLoading(false);
    }
  }, [featureId, activeStep]);

  useEffect(() => { load(); }, [load]);

  // ── Build 044: Wren toast when design step output appears ─────────────────
  useEffect(() => {
    if (!featureId) return;
    const channel = supabase
      .channel(`design-ready:${featureId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'feature_steps',
          filter: `feature_id=eq.${featureId}`,
        },
        (payload) => {
          const updated = payload.new as { step_number: number; output?: string | null };
          // Step 1 (design) just got output — show Wren "Design is ready" toast
          if (updated.step_number === 1 && updated.output) {
            setShowWrenToast(true);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [featureId]);

  // ── Re-load tasks when active step changes ────────────────────────────────
  useEffect(() => {
    const stepRow = steps.find(s => s.step_number === activeStep);
    if (!stepRow) return;
    getPendingTasksForStep(stepRow.id)
      .then(setTasks)
      .catch(console.error);
  }, [activeStep, steps]);

  // ── Step lookup helpers ───────────────────────────────────────────────────
  const stepMap       = indexStepsByName(steps);
  const activeStepRow = steps.find(s => s.step_number === activeStep);
  const designApproved = isDesignApproved(steps);
  const pipelineDone   = isPipelineComplete(steps);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveOutput = async () => {
    if (!activeStepRow) return;
    setIsSaving(true);
    try {
      await updateStepOutput(activeStepRow.id, outputDrafts[activeStep] ?? '');
      // Ensure step is in_progress if it was not_started
      if (activeStepRow.status === 'not_started') {
        await startStep(activeStepRow.id);
        await load();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!activeStepRow) return;
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    setIsApproving(true);
    try {
      if (activeStep === 1) {
        await approveDesign(activeStepRow.id, userId);
        // Build 044: show one-time pipeline popover after first approve
        if (!localStorage.getItem(pipelineHintShownKey)) {
          setShowPipelinePopover(true);
          localStorage.setItem(pipelineHintShownKey, 'true');
        }
      } else {
        await approveStep(activeStepRow.id, userId);
      }
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSendChat = async () => {
    if (!featureId || !chatInput.trim() || isStreaming) return;

    const msg = chatInput.trim();
    setChatInput('');
    setIsStreaming(true);
    setStreamBuffer('');

    // Optimistic user message
    const optimisticUser: FeatureChatMessage = {
      id:            `opt-user-${Date.now()}`,
      feature_id:    featureId,
      step_number:   1,
      role:          'user',
      content:       msg,
      model:         null,
      input_tokens:  null,
      output_tokens: null,
      created_at:    new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, optimisticUser]);

    try {
      // Call Morgan's design endpoint (Build 046)
      await generateMorganDesignResponse(featureId, msg);
      // Reload thread to get both user and assistant messages from DB
      const msgs = await getChatThread(featureId, 1);
      setChatMessages(msgs);
    } catch (err) {
      console.error('Morgan design chat error:', err);
      // Remove optimistic message on error
      setChatMessages(prev => prev.filter(m => m.id !== optimisticUser.id));
    } finally {
      setIsStreaming(false);
      setStreamBuffer('');
    }
  };

  const handleSelectStep = (stepNumber: number) => {
    setIsTeamTab(false);
    setActiveStep(stepNumber);
  };

  // ── Build 044: Wren toast auto-dismiss after 8 seconds ──────────────────
  useEffect(() => {
    if (!showWrenToast) return;
    const timer = setTimeout(() => setShowWrenToast(false), 8000);
    return () => clearTimeout(timer);
  }, [showWrenToast]);

  // ── Build 044: close pipeline popover on outside click ───────────────────
  useEffect(() => {
    if (!showPipelinePopover) return;
    const close = () => setShowPipelinePopover(false);
    // Small delay to avoid closing immediately on the same approve click
    const timer = setTimeout(() => document.addEventListener('click', close, { once: true }), 200);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [showPipelinePopover]);

  // ── Render guards ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error || !feature) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-sm text-red-600">{error ?? 'Feature not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-indigo-600 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const isDesignTab       = activeStep === 1;
  const designStep        = stepMap['design'];
  const designChatLocked  = designStep?.status === 'approved';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      data-testid="feature-workflow-screen"
      className="flex flex-col h-screen bg-white overflow-hidden"
    >
      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-white z-10">
        <Link
          to={`/projects/${projectId}`}
          data-testid="back-to-project-link"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Project
        </Link>
        <ChevronRight className="w-4 h-4 text-gray-300" />
        <span className="text-sm text-gray-900 font-medium truncate max-w-xs">
          {feature.name}
        </span>

        {/* Pipeline complete badge */}
        {pipelineDone && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle className="w-3.5 h-3.5" />
            Pipeline complete
          </span>
        )}
      </header>

      {/* ── Pipeline strip ── */}
      <div style={{ position: 'relative' }}>
        <PipelineStrip
          steps={steps}
          activeStep={activeStep}
          onSelectStep={handleSelectStep}
        />

        {/* Build 044: one-time pipeline popover after first Approve */}
        {showPipelinePopover && (
          <div
            data-testid="pipeline-popover"
            style={{
              position:        'absolute',
              top:             '110%',
              left:            '50%',
              transform:       'translateX(-50%)',
              zIndex:          50,
              backgroundColor: '#fff',
              border:          '1px solid #C7D2FE',
              borderRadius:    10,
              padding:         '12px 16px',
              maxWidth:        320,
              boxShadow:       '0 8px 24px rgba(0,0,0,0.12)',
              fontSize:        13,
              color:           '#334155',
              lineHeight:      1.5,
            }}
            onClick={() => setShowPipelinePopover(false)}
          >
            <button
              onClick={() => setShowPipelinePopover(false)}
              style={{
                position: 'absolute', top: 6, right: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 16, color: '#94A3B8', lineHeight: 1,
              }}
            >×</button>
            <strong style={{ display: 'block', marginBottom: 4, color: '#4338CA' }}>Pipeline started</strong>
            This moves the feature to Schema — Sage will set up the database. The pipeline runs automatically from here.
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <nav
        data-testid="step-tab-bar"
        className="flex border-b border-gray-100 px-6 bg-white"
      >
        {[1, 2, 3, 4, 5, 6].map(num => {
          const stepRow   = steps.find(s => s.step_number === num);
          const isLocked  = !stepRow || stepRow.status === 'locked';
          const isActive  = !isTeamTab && activeStep === num;

          return (
            <button
              key={num}
              data-testid={`tab-${STEP_NAMES[num]}`}
              onClick={() => { if (!isLocked) { setIsTeamTab(false); setActiveStep(num); } }}
              disabled={isLocked}
              className={[
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                'disabled:text-gray-300 disabled:cursor-not-allowed',
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : isLocked
                  ? 'border-transparent text-gray-300'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200',
              ].join(' ')}
            >
              {STEP_LABELS[num]}
            </button>
          );
        })}

        {/* Team tab — Build 049 */}
        <button
          data-testid="tab-team"
          onClick={() => setIsTeamTab(true)}
          className={[
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            isTeamTab
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200',
          ].join(' ')}
        >
          Team Chat
        </button>
      </nav>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Team tab — Build 049 */}
        {isTeamTab ? (
          <TeamChatThread featureId={featureId!} projectId={projectId!} />
        ) : activeStepRow ? (
          <>
            {/* Design tab: chat sidebar | output editor */}
            {isDesignTab ? (
              <>
                <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden">
                  <ChatSidebar
                    featureId={featureId!}
                    messages={chatMessages}
                    isStreaming={isStreaming}
                    streamBuffer={streamBuffer}
                    inputValue={chatInput}
                    onInputChange={setChatInput}
                    onSend={handleSendChat}
                    isLocked={designChatLocked}
                  />
                </div>
                <div className="flex-1 flex flex-col overflow-hidden">
                  <OutputPanel
                    step={activeStepRow}
                    tasks={tasks}
                    outputDraft={outputDrafts[activeStep] ?? ''}
                    onOutputChange={v => setOutputDrafts(prev => ({ ...prev, [activeStep]: v }))}
                    onSaveOutput={handleSaveOutput}
                    onApprove={handleApprove}
                    isApproving={isApproving}
                    isSaving={isSaving}
                    designApproved={designApproved}
                    showApproveHint={!!showApproveHint}
                  />
                </div>
              </>
            ) : (
              /* All other tabs: full-width output editor */
              <div className="flex-1 flex flex-col overflow-hidden">
                <OutputPanel
                  step={activeStepRow}
                  tasks={tasks}
                  outputDraft={outputDrafts[activeStep] ?? ''}
                  onOutputChange={v => setOutputDrafts(prev => ({ ...prev, [activeStep]: v }))}
                  onSaveOutput={handleSaveOutput}
                  onApprove={handleApprove}
                  isApproving={isApproving}
                  isSaving={isSaving}
                  designApproved={designApproved}
                  showApproveHint={false}
                />
              </div>
            )}
          </>
        ) : (
          /* Step not yet initialized in DB */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Lock className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                {designApproved
                  ? 'This step will be initialized shortly.'
                  : 'Approve the Design step to unlock this stage.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Build 044: Wren "Design is ready" toast ── */}
      {showWrenToast && (
        <div
          data-testid="wren-design-ready-toast"
          style={{
            position:        'fixed',
            bottom:          20,
            right:           20,
            zIndex:          100,
            backgroundColor: '#fff',
            border:          '1px solid #FDE68A',
            borderLeft:      '3px solid #F59E0B',
            borderRadius:    10,
            padding:         '10px 14px',
            boxShadow:       '0 8px 24px rgba(0,0,0,0.12)',
            display:         'flex',
            alignItems:      'center',
            gap:             10,
            maxWidth:        '90vw',
            minWidth:        260,
          }}
        >
          <Avatar member="wren" size="sm" />
          <span style={{ fontSize: 13, color: '#92400E', fontWeight: 500, flex: 1 }}>
            Design is ready — take a look!
          </span>
          <button
            data-testid="wren-toast-view-btn"
            onClick={() => { setActiveStep(1); setShowWrenToast(false); }}
            style={{
              padding:         '4px 10px',
              borderRadius:    6,
              border:          'none',
              backgroundColor: '#F59E0B',
              color:           '#fff',
              fontSize:        12,
              fontWeight:      700,
              cursor:          'pointer',
              flexShrink:      0,
            }}
          >
            View →
          </button>
          <button
            onClick={() => setShowWrenToast(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 16, color: '#94A3B8', padding: 0, lineHeight: 1,
            }}
          >×</button>
        </div>
      )}
    </div>
  );
}
