/**
 * SetupWizardScreen — Build 032: Setup Wizard Full Redesign
 *
 * Routes: /wizard/new or /projects/:id/wizard
 *
 * A 5-screen guided onboarding flow:
 *   Screen 1 — "What are you building?" (name, description, color)
 *   Screen 2 — "Who is this for?" (audience: personal, b2c, b2b)
 *   Screen 3 — "How will you make money?" (monetization — skipped for personal)
 *   Screen 4 — "Drop in what you've made" (optional file uploads)
 *   Screen 5 — "Done" (completion screen with pulse animation)
 *
 * Key logic:
 *   - Personal audience silently skips Screen 3 (Screen 2 → Screen 4)
 *   - Progress dots: 4 for personal, 5 for b2c/b2b
 *   - Each screen saves incrementally to Supabase on "Next"
 *   - On Screen 5 CTA: call triggerWizardDefaults then navigate to /projects/:id
 *
 * Styling:
 *   - Inline styles only (no Tailwind)
 *   - Mobile responsive (max-width: 540px content)
 *   - Light theme (matches mockup design tokens)
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import {
  saveAudienceType,
  triggerWizardDefaults,
} from '@/api/wizard';
import {
  getWizardScreenCount,
  getNextWizardScreen,
  getWizardDotCount,
} from '@/types/db';
import type { AudienceType, MonetizationType } from '@/types/db';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

// ── Draft persistence (Build 064) ─────────────────────────────────────────

interface SetupWizardDraft {
  s1?: { name: string; description: string; color: string };
  s2?: { audienceType: AudienceType };
  s3?: { monetizationType: MonetizationType };
}

function getSetupDraftKey(projectId: string) {
  return `shipyard_setup_wizard_draft_${projectId}`;
}

function readSetupDraft(projectId: string): SetupWizardDraft {
  try {
    const raw = localStorage.getItem(getSetupDraftKey(projectId));
    return raw ? (JSON.parse(raw) as SetupWizardDraft) : {};
  } catch {
    return {};
  }
}

function writeSetupDraft(projectId: string, patch: Partial<SetupWizardDraft>): void {
  try {
    const current = readSetupDraft(projectId);
    localStorage.setItem(getSetupDraftKey(projectId), JSON.stringify({ ...current, ...patch }));
  } catch {
    // Storage quota exceeded — ignore silently
  }
}

function clearSetupDraft(projectId: string): void {
  try {
    localStorage.removeItem(getSetupDraftKey(projectId));
  } catch {}
}

// ── Design Tokens ─────────────────────────────────────────────────────────

const T = {
  accent:       '#5b5bd6',
  accentHover:  '#4f4fbf',
  bg:           '#f5f5f7',
  surface:      '#ffffff',
  border:       '#e5e5ea',
  text:         '#1c1c1e',
  muted:        '#6e6e73',
  faint:        '#aeaeb2',
  success:      '#34c759',
  warning:      '#ff9f0a',
  red:          '#ff3b30',
};

const COLOR_SWATCHES = [
  '#5b5bd6', '#3b82f6', '#06b6d4', '#10b981',
  '#34d399', '#f59e0b', '#f97316', '#ef4444',
  '#ec4899', '#64748b',
];

// ── Screen 1: Product Identity ────────────────────────────────────────────

interface Screen1Data {
  name: string;
  description: string;
  color: string;
}

function Screen1({ projectId, onNext: _onNext }: { projectId: string; onNext: () => void }) {
  const [data, setData] = useState<Screen1Data>(() => {
    const draft = readSetupDraft(projectId);
    return draft.s1 ?? { name: '', description: '', color: COLOR_SWATCHES[0] };
  });

  useEffect(() => {
    writeSetupDraft(projectId, { s1: data });
  }, [data, projectId]);

  return (
    <div data-testid="wizard-screen-1" style={screenStyle}>
      <div style={contentStyle}>
        <h1 style={headlineStyle}>What are you building?</h1>
        <p style={subheadStyle}>
          Give your product a name and a one-sentence description. You can always change these.
        </p>

        {/* Product Name */}
        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            data-testid="wizard-product-name"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value.slice(0, 50) })}
            placeholder="Product name"
            style={{
              ...inputStyle,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              padding: '16px 18px',
            }}
          />
          <div style={{ textAlign: 'right', fontSize: 11, color: T.faint, marginTop: 5 }}>
            {data.name.length} / 50
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>What does it do in one sentence?</label>
          <textarea
            data-testid="wizard-product-description"
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value.slice(0, 200) })}
            placeholder="A tool that helps freelancers track invoices and get paid on time."
            style={{
              ...inputStyle,
              fontSize: 15,
              height: 90,
              resize: 'none',
            } as React.CSSProperties}
          />
          <div style={{ textAlign: 'right', fontSize: 11, color: T.faint, marginTop: 5 }}>
            {data.description.length} / 200
          </div>
        </div>

        {/* Color Picker */}
        <div style={{ marginBottom: 0 }}>
          <label style={labelStyle}>Pick a color</label>
          <label style={sublabelStyle}>This will theme your project in Shipyard.</label>
          <div data-testid="wizard-color-picker" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                onClick={() => setData({ ...data, color })}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: color,
                  border: data.color === color ? `2.5px solid ${T.text}` : '2.5px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  transform: data.color === color ? 'scale(1.1)' : 'scale(1)',
                  position: 'relative',
                  padding: 0,
                }}
              >
                {data.color === color && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 3,
                      borderRadius: '50%',
                      border: '2px solid white',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Screen 2: Audience Selection ──────────────────────────────────────────

interface AudienceCard {
  id: AudienceType;
  icon: string;
  title: string;
  description: string;
}

const AUDIENCE_CARDS: AudienceCard[] = [
  {
    id: 'personal',
    icon: '🧑‍💻',
    title: 'Just me / My team',
    description: 'A personal project or internal tool — not for public distribution',
  },
  {
    id: 'b2c',
    icon: '👥',
    title: 'Consumers',
    description: 'A product for individual users — you\'ll grow it publicly',
  },
  {
    id: 'b2b',
    icon: '🏢',
    title: 'Businesses',
    description: 'A product sold to companies — you\'ll grow it via sales and demos',
  },
];

function Screen2({
  projectId,
  onNext,
}: {
  projectId: string;
  onNext: (audienceType: AudienceType) => void;
}) {
  const [selected, setSelected] = useState<AudienceType>(() => {
    const draft = readSetupDraft(projectId);
    return draft.s2?.audienceType ?? 'b2c';
  });
  const [error, setError] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    writeSetupDraft(projectId, { s2: { audienceType: selected } });
  }, [selected, projectId]);

  async function handleNext() {
    setError('');
    try {
      await saveAudienceType(projectId, selected);
      showToast('Audience type saved');
      onNext(selected);
    } catch (err) {
      setError(extractErrorMessage(err, 'Save failed'));
    }
  }

  return (
    <div data-testid="wizard-screen-2" style={screenStyle}>
      <div style={contentStyle}>
        <h1 style={headlineStyle}>Who is this for?</h1>
        <p style={subheadStyle}>
          This helps Shipyard tailor features, analytics, and growth tools to your product.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {AUDIENCE_CARDS.map((card) => (
            <button
              key={card.id}
              data-testid={`wizard-audience-${card.id}`}
              onClick={() => setSelected(card.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNext();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '18px 20px',
                background: T.surface,
                border: `2px solid ${selected === card.id ? T.accent : T.border}`,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: selected === card.id ? `${T.accent}0a` : T.surface,
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 28, flexShrink: 0, width: 44, textAlign: 'center' }}>
                {card.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 3 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.4 }}>
                  {card.description}
                </div>
              </div>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: `2px solid ${selected === card.id ? T.accent : T.border}`,
                  background: selected === card.id ? T.accent : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 11,
                  flexShrink: 0,
                  fontWeight: 700,
                }}
              >
                {selected === card.id && '✓'}
              </div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: T.faint, margin: 0 }}>
          You can change this any time in settings.
        </p>

        {error && <p style={{ color: T.red, fontSize: 12, margin: '12px 0 0' }}>{error}</p>}
      </div>
    </div>
  );
}

// ── Screen 3: Monetization Selection ──────────────────────────────────────

interface MonetizationCard {
  id: MonetizationType;
  icon: string;
  title: string;
  description: string;
}

const MONETIZATION_CARDS: MonetizationCard[] = [
  {
    id: 'free',
    icon: '🆓',
    title: 'Free',
    description: 'No charge — build and share freely with anyone',
  },
  {
    id: 'adsense',
    icon: '📣',
    title: 'Ad-supported',
    description: 'Display ads using Google AdSense on public pages',
  },
  {
    id: 'subscription',
    icon: '🔁',
    title: 'Subscription',
    description: 'Recurring monthly or annual plans via Stripe',
  },
  {
    id: 'one_time',
    icon: '💳',
    title: 'One-time purchase',
    description: 'A single payment for access via Stripe',
  },
  {
    id: 'donation',
    icon: '❤️',
    title: 'Donations',
    description: 'Accept one-time or recurring donations from your users',
  },
];

function Screen3({
  projectId,
  onNext: _onNext,
}: {
  projectId: string;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<MonetizationType>(() => {
    const draft = readSetupDraft(projectId);
    return draft.s3?.monetizationType ?? 'free';
  });

  useEffect(() => {
    writeSetupDraft(projectId, { s3: { monetizationType: selected } });
  }, [selected, projectId]);

  return (
    <div data-testid="wizard-screen-3" style={screenStyle}>
      <div style={contentStyle}>
        <h1 style={headlineStyle}>How will you make money?</h1>
        <p style={subheadStyle}>
          Shipyard sets up the right infrastructure based on your model. You can add more models later.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {MONETIZATION_CARDS.map((card) => (
            <button
              key={card.id}
              data-testid={`wizard-monetization-${card.id}`}
              onClick={() => setSelected(card.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '18px 16px',
                background: T.surface,
                border: `2px solid ${selected === card.id ? T.accent : T.border}`,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: selected === card.id ? `${T.accent}0a` : T.surface,
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 26 }}>{card.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                {card.title}
              </div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.4 }}>
                {card.description}
              </div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: T.faint, margin: 0 }}>
          You can add multiple monetization models later in Admin Console.
        </p>

      </div>
    </div>
  );
}

// ── Screen 4: File Uploads ────────────────────────────────────────────────

function Screen4({ onNext: _onNext }: { onNext: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [files,      setFiles]      = useState<File[]>([]);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files];
    Array.from(incoming).forEach(f => {
      if (!next.find(x => x.name === f.name)) next.push(f);
    });
    setFiles(next);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }

  return (
    <div data-testid="wizard-screen-4" style={screenStyle}>
      <div style={contentStyle}>
        <h1 style={headlineStyle}>Drop in anything you've already made</h1>
        <p style={subheadStyle}>
          Claude uses these every time it generates screens, code, or copy for your product.
          Optional — but the more context, the better the output.
        </p>

        <div
          data-testid="wizard-file-upload"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? T.accent : '#c7c7cc'}`,
            borderRadius: 14,
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: isDragging ? `${T.accent}06` : T.surface,
            marginBottom: 20,
          }}
        >
          <div style={{ width: 48, height: 48, margin: '0 auto 14px', background: '#f0f0f7', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            📎
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>
            Drop your product brief, wireframes, or PR-FAQ
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.5 }}>
            Brand guidelines, user research, feature specs — anything that defines your product
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-block',
              background: 'white',
              border: `1.5px solid ${T.border}`,
              color: T.text,
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 18px',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Browse files
          </button>
          <div style={{ fontSize: 11, color: T.faint, marginTop: 12 }}>
            Accepts PDF, Markdown, Word, PNG, JPG · 10 MB max per file
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.md,.docx,.doc,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={e => addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{(f.size / 1024).toFixed(0)} KB</div>
                  </div>
                </div>
                <button
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: '16px 20px', background: `${T.accent}0f`, borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: T.accent, fontWeight: 600, marginBottom: 6 }}>
            💡 What works great
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: T.muted }}>
            <div>🤖 &nbsp;AI-generated product specs from ChatGPT or Notion AI</div>
            <div>✏️ &nbsp;Hand-drawn or Figma wireframe exports (PNG or PDF)</div>
            <div>📄 &nbsp;PR-FAQs, one-pagers, or pitch decks</div>
            <div>🎨 &nbsp;Brand guidelines with colors and typography</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Screen 5: Completion ──────────────────────────────────────────────────

function Screen5({
  projectId,
  onCompletion: _onCompletion,
}: {
  projectId: string;
  onCompletion: () => void;
}) {
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();
  const navigate = useNavigate();

  async function handleCompletion() {
    setTriggering(true);
    setError('');
    try {
      await triggerWizardDefaults(projectId);   // non-fatal: warns but never throws
      clearSetupDraft(projectId);
      showToast('Project setup complete!');
      navigate(`/projects/${projectId}`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Completion failed'));
      console.error('Wizard completion error:', err);
    } finally {
      setTriggering(false);
    }
  }

  async function handleSetupInfra() {
    setTriggering(true);
    setError('');
    try {
      await triggerWizardDefaults(projectId);   // non-fatal: warns but never throws
      clearSetupDraft(projectId);
      showToast('Project setup complete!');
      navigate(`/projects/${projectId}/setup/infra`); // routing-fix-031: /deploy has no route; infra wizard lives at /setup/infra
    } catch (err) {
      setError(extractErrorMessage(err, 'Completion failed'));
      console.error('Wizard completion error:', err);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div data-testid="wizard-screen-5" style={screenStyle}>
      <div style={contentStyle}>
        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          {/* Pulse ring animation */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 28 }}>
            <div
              style={{
                position: 'absolute',
                inset: -12,
                borderRadius: 36,
                background: `${T.accent}1a`,
                animation: 'pulse-ring 2s ease-out infinite',
              }}
            />
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: `linear-gradient(135deg, ${T.accent} 0%, #7c7ce0 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                boxShadow: `0 8px 32px ${T.accent}4d`,
              }}
            >
              ⚡
            </div>
          </div>

          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', color: T.text, marginBottom: 8 }}>
            Let's start designing.
          </div>
          <div style={{ fontSize: 16, color: T.muted, marginBottom: 32 }}>
            Reeve and the team are ready to go.
          </div>

          {error && <p style={{ color: T.red, fontSize: 12, margin: '0 0 16px' }}>{error}</p>}

          {/* Build 032-upd2: Two-CTA layout — both 320px wide, centred, not in bottom nav */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {/* Primary CTA: Start designing → */}
            <button
              data-testid="wizard-completion-cta"
              onClick={handleCompletion}
              disabled={triggering}
              style={{
                width: 320,
                height: 48,
                fontSize: 16,
                fontWeight: 600,
                background: T.accent,
                color: 'white',
                border: 'none',
                borderRadius: 10,
                cursor: triggering ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: triggering ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              {triggering ? 'Setting up…' : 'Start designing →'}
            </button>

            {/* Secondary CTA: Set up infrastructure (ghost/outlined) */}
            <button
              data-testid="wizard-setup-infra-cta"
              onClick={handleSetupInfra}
              disabled={triggering}
              style={{
                width: 320,
                height: 48,
                fontSize: 15,
                fontWeight: 600,
                background: 'transparent',
                color: T.accent,
                border: `2px solid ${T.accent}`,
                borderRadius: 10,
                cursor: triggering ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
                opacity: triggering ? 0.7 : 1,
              }}
            >
              Set up infrastructure
            </button>
            <div style={{ fontSize: 12, color: T.faint, lineHeight: 1.5, textAlign: 'center', maxWidth: 320 }}>
              Connect GitHub, Netlify, and Supabase — you can do this now or later
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function SetupWizardScreen() {
  const { id: projectId } = useParams<{ id: string }>();

  const [currentScreen, setCurrentScreen] = useState(1);
  const [audienceType, setAudienceType] = useState<AudienceType>('b2c');
  const [loading, setLoading] = useState(true);

  // Load existing wizard config if returning user
  useEffect(() => {
    async function loadWizardState() {
      if (!projectId) return;
      try {
        const { data } = await supabase
          .from('wizard_config')
          .select('audience_type')
          .eq('project_id', projectId)
          .single();

        if (data?.audience_type) {
          setAudienceType(data.audience_type);
        }
      } catch (err) {
        // No existing config — start fresh
      } finally {
        setLoading(false);
      }
    }

    loadWizardState();
  }, [projectId]);

  if (!projectId || loading) {
    return (
      <div style={{ ...screenStyle, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: T.muted }}>Loading...</div>
      </div>
    );
  }

  const screenCount = getWizardScreenCount(audienceType);
  const dotCount = getWizardDotCount(audienceType);

  // Progress dots: show all, mark prev as done, mark current as active
  const dots = Array.from({ length: dotCount }, (_, i) => {
    const screenNum = i + 1;
    if (screenNum < currentScreen) return 'done';
    if (screenNum === currentScreen) return 'active';
    return 'idle';
  });

  function handleNext() {
    const nextScreen = getNextWizardScreen(currentScreen, audienceType);
    if (nextScreen <= screenCount) {
      setCurrentScreen(nextScreen);
      window.scrollTo(0, 0);
    }
  }

  function handleBack() {
    if (currentScreen > 1) {
      let prevScreen = currentScreen - 1;
      // Skip Screen 3 for personal when going back from Screen 4
      if (prevScreen === 3 && audienceType === 'personal') {
        prevScreen = 2;
      }
      setCurrentScreen(prevScreen);
      window.scrollTo(0, 0);
    }
  }

  const showBackBtn = currentScreen > 1;
  const showSkipBtn = currentScreen === 4;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <div style={{ height: 56, background: T.surface, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          Shipyard{' '}
          <span style={{ background: T.accent, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em' }}>
            BETA
          </span>
        </div>
        <span style={{ fontSize: 12, color: T.faint }}>Progress is saved automatically</span>
      </div>

      {/* Progress Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 0 0', background: T.bg }}>
        <div data-testid="wizard-dots" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dots.map((state, i) => (
            <div
              key={i}
              style={{
                width: state === 'active' ? 24 : 8,
                height: 8,
                borderRadius: state === 'active' ? 4 : '50%',
                background: state === 'done' || state === 'active' ? T.accent : '#d1d1d6',
                transition: 'all 0.25s',
              }}
            />
          ))}
        </div>
      </div>
      <p style={{ fontSize: 12, color: T.muted, textAlign: 'center', margin: '10px 0 0', letterSpacing: '0.01em' }}>
        Step {currentScreen} of {screenCount}
      </p>

      {/* Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px 80px', background: T.bg }}>
        {currentScreen === 1 && <Screen1 projectId={projectId} onNext={handleNext} />}
        {currentScreen === 2 && (
          <Screen2
            projectId={projectId}
            onNext={(selected) => {
              setAudienceType(selected);
              handleNext();
            }}
          />
        )}
        {currentScreen === 3 && <Screen3 projectId={projectId} onNext={handleNext} />}
        {currentScreen === 4 && <Screen4 onNext={handleNext} />}
        {currentScreen === 5 && <Screen5 projectId={projectId} onCompletion={handleNext} />}
      </div>

      {/* Bottom Navigation */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 72, background: `rgba(245,245,247,0.92)`, backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100, padding: '0 24px' }}>
        <div style={{ width: '100%', maxWidth: 540, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            data-testid="wizard-back-btn"
            onClick={handleBack}
            disabled={!showBackBtn}
            style={{ background: 'none', border: 'none', fontSize: 14, color: T.muted, cursor: showBackBtn ? 'pointer' : 'default', padding: '10px 0', fontFamily: 'inherit', transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 6, opacity: showBackBtn ? 1 : 0, pointerEvents: showBackBtn ? 'auto' : 'none' }}
          >
            ← Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {showSkipBtn && (
              <button
                data-testid="wizard-skip-upload"
                onClick={handleNext}
                style={{ background: 'none', border: 'none', fontSize: 13, color: T.faint, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0', transition: 'color 0.15s' }}
              >
                Skip for now →
              </button>
            )}
            <button
              data-testid="wizard-next-btn"
              onClick={handleNext}
              style={{
                background: T.accent,
                color: 'white',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                padding: '13px 32px',
                borderRadius: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                display: currentScreen === 5 ? 'none' : 'flex',
                alignItems: 'center',
                gap: 8,
                letterSpacing: '-0.01em',
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared Styles ─────────────────────────────────────────────────────────

const screenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '40px 24px 80px',
  background: T.bg,
};

const contentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 540,
};

const headlineStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: T.text,
  marginBottom: 6,
  lineHeight: 1.2,
  margin: '0 0 6px 0',
};

const subheadStyle: React.CSSProperties = {
  fontSize: 15,
  color: T.muted,
  marginBottom: 32,
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: T.surface,
  border: `1.5px solid ${T.border}`,
  borderRadius: 10,
  padding: '13px 16px',
  fontSize: 14,
  color: T.text,
  outline: 'none',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: T.text,
  marginBottom: 8,
  display: 'block',
};

const sublabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: T.muted,
  marginBottom: 8,
  display: 'block',
};
