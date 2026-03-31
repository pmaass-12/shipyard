/**
 * DistributeWizardScreen — Build 047: Distribute Path
 *
 * Route: /projects/:id/distribute/wizard
 *
 * Two-panel wizard — left nav panel (persistent) + right content panel.
 * Gathers everything Reeve needs before starting the Research stage.
 *
 * Screen 1 — Business   (name, description, problem, customer type)
 * Screen 2 — Market     (competitors, geography, price range)
 * Screen 3 — Website    (pages, tone, brand, domain)
 * Screen 4 — Growth     (channels, outreach config)
 * Screen 5 — Confirmation ("Research is starting")
 *
 * On completion: saves wizard answers to project_settings JSONB,
 * fires `run-research` Edge Function, navigates to /projects/:id/distribute
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// ── Design tokens ──────────────────────────────────────────────────────────

const T = {
  // Left panel
  leftBg:       'linear-gradient(160deg, #312e81 0%, #4338ca 60%, #5b5bd6 100%)',
  leftText:     '#ffffff',
  leftMuted:    'rgba(255,255,255,0.6)',
  leftLine:     'rgba(255,255,255,0.2)',
  // Right panel
  bg:           '#f5f5f7',
  surface:      '#ffffff',
  border:       '#e5e5ea',
  text:         '#1c1c1e',
  muted:        '#6e6e73',
  faint:        '#aeaeb2',
  accent:       '#4338ca',
  accentHover:  '#3730a3',
  red:          '#ef4444',
  green:        '#22c55e',
};

// ── Helpers ────────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Business',  note: 'Tell us about what you do' },
  { num: 2, label: 'Market',    note: 'Who are you competing against?' },
  { num: 3, label: 'Website',   note: 'Your online presence' },
  { num: 4, label: 'Growth',    note: 'How will you find customers?' },
];

function PillSelect({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: { value: string; label: string }[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const isSelected = (v: string) =>
    multi ? (value as string[]).includes(v) : value === v;

  function toggle(v: string) {
    if (multi) {
      const arr = value as string[];
      onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
    } else {
      onChange(v);
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            border: `1.5px solid ${isSelected(opt.value) ? T.accent : T.border}`,
            background: isSelected(opt.value) ? `${T.accent}14` : T.surface,
            color: isSelected(opt.value) ? T.accent : T.muted,
            fontSize: 13,
            fontWeight: isSelected(opt.value) ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.12s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 7 }}>
      {children}
      {optional && <span style={{ fontSize: 11, fontWeight: 400, color: T.faint }}>optional</span>}
    </label>
  );
}

const inputBase: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: T.surface,
  border: `1.5px solid ${T.border}`,
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 14,
  color: T.text,
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.12s',
};

// ── Screen 1 — Business ────────────────────────────────────────────────────

interface S1Data {
  businessName: string;
  whatYouDo: string;
  problemSolved: string;
  customerType: string;
  customerDetail: string;
}

function Screen1({ data, onChange }: { data: S1Data; onChange: (d: S1Data) => void }) {
  const set = (k: keyof S1Data) => (v: string) => onChange({ ...data, [k]: v });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <FieldLabel>Business name</FieldLabel>
        <input
          style={inputBase}
          value={data.businessName}
          onChange={e => set('businessName')(e.target.value)}
          placeholder="e.g. Arctic Clean Co."
          onFocus={e => (e.target.style.borderColor = T.accent)}
          onBlur={e => (e.target.style.borderColor = T.border)}
        />
      </div>

      <div>
        <FieldLabel>What do you do?</FieldLabel>
        <textarea
          style={{ ...inputBase, resize: 'vertical', minHeight: 72 }}
          value={data.whatYouDo}
          onChange={e => set('whatYouDo')(e.target.value)}
          placeholder="2–3 sentences. What service or product do you provide?"
          onFocus={e => (e.target.style.borderColor = T.accent)}
          onBlur={e => (e.target.style.borderColor = T.border)}
        />
      </div>

      <div>
        <FieldLabel>What problem do you solve?</FieldLabel>
        <textarea
          style={{ ...inputBase, resize: 'vertical', minHeight: 54 }}
          value={data.problemSolved}
          onChange={e => set('problemSolved')(e.target.value)}
          placeholder="One sentence. What pain do your customers have that you fix?"
          onFocus={e => (e.target.style.borderColor = T.accent)}
          onBlur={e => (e.target.style.borderColor = T.border)}
        />
      </div>

      <div>
        <FieldLabel>Who is your customer?</FieldLabel>
        <PillSelect
          options={[
            { value: 'b2b',   label: 'B2B — selling to businesses' },
            { value: 'b2c',   label: 'B2C — selling to consumers' },
            { value: 'both',  label: 'Both' },
          ]}
          value={data.customerType}
          onChange={v => set('customerType')(v as string)}
        />
        {data.customerType && (
          <input
            style={{ ...inputBase, marginTop: 10 }}
            value={data.customerDetail}
            onChange={e => set('customerDetail')(e.target.value)}
            placeholder={data.customerType === 'b2b'
              ? "e.g. Restaurant owners in the Pacific Northwest"
              : "e.g. Homeowners with grease stains"}
            onFocus={e => (e.target.style.borderColor = T.accent)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          />
        )}
      </div>
    </div>
  );
}

// ── Screen 2 — Market ──────────────────────────────────────────────────────

interface S2Data {
  competitor1: string;
  competitor2: string;
  competitor3: string;
  geography: string;
  priceRange: string;
}

function Screen2({ data, onChange }: { data: S2Data; onChange: (d: S2Data) => void }) {
  const set = (k: keyof S2Data) => (v: string) => onChange({ ...data, [k]: v });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <FieldLabel optional>Top competitors</FieldLabel>
        <p style={{ fontSize: 13, color: T.muted, margin: '0 0 10px' }}>
          Leave blank if you're not sure — Reeve will research your market.
        </p>
        {(['competitor1', 'competitor2', 'competitor3'] as const).map((key, i) => (
          <input
            key={key}
            style={{ ...inputBase, marginBottom: i < 2 ? 8 : 0 }}
            value={data[key]}
            onChange={e => set(key)(e.target.value)}
            placeholder={`Competitor ${i + 1} — name or URL`}
            onFocus={e => (e.target.style.borderColor = T.accent)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          />
        ))}
      </div>

      <div>
        <FieldLabel>Geography you serve</FieldLabel>
        <PillSelect
          options={[
            { value: 'local',         label: 'Local (city / metro)' },
            { value: 'regional',      label: 'Regional (state / province)' },
            { value: 'national',      label: 'National' },
            { value: 'international', label: 'International' },
          ]}
          value={data.geography}
          onChange={v => set('geography')(v as string)}
        />
      </div>

      <div>
        <FieldLabel>Price point</FieldLabel>
        <PillSelect
          options={[
            { value: 'under_500',    label: 'Under $500' },
            { value: '500_2000',     label: '$500–$2,000' },
            { value: '2000_10000',   label: '$2,000–$10,000' },
            { value: 'over_10000',   label: '$10,000+' },
          ]}
          value={data.priceRange}
          onChange={v => set('priceRange')(v as string)}
        />
      </div>
    </div>
  );
}

// ── Screen 3 — Website ─────────────────────────────────────────────────────

const DEFAULT_PAGES = ['Home', 'Services', 'About', 'Contact'];

interface S3Data {
  pages: string[];
  tone: string;
  hasBrand: boolean;
  hasDomain: boolean;
  domain: string;
}

function Screen3({ data, onChange }: { data: S3Data; onChange: (d: S3Data) => void }) {
  const [customPage, setCustomPage] = useState('');

  function togglePage(page: string) {
    const pages = data.pages.includes(page)
      ? data.pages.filter(p => p !== page)
      : [...data.pages, page];
    onChange({ ...data, pages });
  }

  function addCustomPage() {
    const trimmed = customPage.trim();
    if (trimmed && !data.pages.includes(trimmed)) {
      onChange({ ...data, pages: [...data.pages, trimmed] });
    }
    setCustomPage('');
  }

  const allPages = [...new Set([...DEFAULT_PAGES, ...data.pages])];

  const TONES = [
    { value: 'professional', label: 'Professional', desc: 'Clean, authoritative, trust-focused' },
    { value: 'friendly',     label: 'Friendly',     desc: 'Warm, approachable, conversational' },
    { value: 'technical',    label: 'Technical',    desc: 'Precise, detail-oriented, expert' },
    { value: 'bold',         label: 'Bold',         desc: 'Direct, confident, high-impact' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <FieldLabel>Pages</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {allPages.map(page => {
            const checked = data.pages.includes(page);
            return (
              <button
                key={page}
                type="button"
                onClick={() => togglePage(page)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 8,
                  border: `1.5px solid ${checked ? T.accent : T.border}`,
                  background: checked ? `${T.accent}14` : T.surface,
                  color: checked ? T.accent : T.muted,
                  fontSize: 13, fontWeight: checked ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 11 }}>{checked ? '✓' : '+'}</span>
                {page}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...inputBase, flex: 1 }}
            value={customPage}
            onChange={e => setCustomPage(e.target.value)}
            placeholder="Add a page…"
            onKeyDown={e => e.key === 'Enter' && addCustomPage()}
            onFocus={e => (e.target.style.borderColor = T.accent)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          />
          <button
            type="button"
            onClick={addCustomPage}
            style={{
              padding: '0 16px', borderRadius: 10,
              background: T.accent, color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <FieldLabel>Tone</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {TONES.map(t => {
            const selected = data.tone === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onChange({ ...data, tone: t.value })}
                style={{
                  padding: '14px', borderRadius: 12, textAlign: 'left',
                  border: `1.5px solid ${selected ? T.accent : T.border}`,
                  background: selected ? `${T.accent}0d` : T.surface,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: selected ? T.accent : T.text, marginBottom: 3 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>{t.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>Do you have a logo or brand colors?</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ value: false, label: 'No — Reeve will generate one' }, { value: true, label: 'Yes' }].map(opt => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange({ ...data, hasBrand: opt.value })}
              style={{
                padding: '8px 18px', borderRadius: 20,
                border: `1.5px solid ${data.hasBrand === opt.value ? T.accent : T.border}`,
                background: data.hasBrand === opt.value ? `${T.accent}14` : T.surface,
                color: data.hasBrand === opt.value ? T.accent : T.muted,
                fontSize: 13, fontWeight: data.hasBrand === opt.value ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Do you have a domain?</FieldLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: data.hasDomain ? 10 : 0 }}>
          {[{ value: false, label: "No — Reeve will suggest options" }, { value: true, label: 'Yes' }].map(opt => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange({ ...data, hasDomain: opt.value })}
              style={{
                padding: '8px 18px', borderRadius: 20,
                border: `1.5px solid ${data.hasDomain === opt.value ? T.accent : T.border}`,
                background: data.hasDomain === opt.value ? `${T.accent}14` : T.surface,
                color: data.hasDomain === opt.value ? T.accent : T.muted,
                fontSize: 13, fontWeight: data.hasDomain === opt.value ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {data.hasDomain && (
          <input
            style={inputBase}
            value={data.domain}
            onChange={e => onChange({ ...data, domain: e.target.value })}
            placeholder="yoursite.com"
            onFocus={e => (e.target.style.borderColor = T.accent)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          />
        )}
      </div>
    </div>
  );
}

// ── Screen 4 — Growth Strategy ─────────────────────────────────────────────

interface S4Data {
  channels: string[];
  outreachTarget: string;
  outreachGoal: string;
  outreachVolume: string;
}

function Screen4({ data, onChange }: { data: S4Data; onChange: (d: S4Data) => void }) {
  const isSelected = (ch: string) => data.channels.includes(ch);

  function toggleChannel(ch: string) {
    const channels = isSelected(ch)
      ? data.channels.filter(c => c !== ch)
      : [...data.channels, ch];
    onChange({ ...data, channels });
  }

  const V_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    automated: { label: 'V1 — automated',  bg: '#dcfce7', color: '#166534' },
    brief:     { label: 'V1 — brief only', bg: '#fef9c3', color: '#854d0e' },
    future:    { label: 'V2 — coming soon',bg: '#f0f0f5', color: '#999'    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>
        Select the growth channels you want Shipyard to activate. You can add more later.
      </p>

      {/* Direct Outreach — V1 automated */}
      {(() => {
        const selected = isSelected('outreach');
        const badge = V_BADGE.automated;
        return (
          <div style={{ border: `1.5px solid ${selected ? T.accent : T.border}`, borderRadius: 14, overflow: 'hidden', background: T.surface }}>
            <button
              type="button"
              onClick={() => toggleChannel('outreach')}
              style={{
                width: '100%', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: 14,
                background: selected ? `${T.accent}08` : T.surface,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${selected ? T.accent : T.border}`,
                background: selected ? T.accent : 'transparent', flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>Direct Outreach</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  Reeve researches prospects and sends a personalized 3-touch email sequence on your behalf.
                </div>
              </div>
            </button>
            {selected && (
              <div style={{ padding: '0 16px 18px 50px', borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <FieldLabel>Who are you trying to reach?</FieldLabel>
                  <input
                    style={inputBase}
                    value={data.outreachTarget}
                    onChange={e => onChange({ ...data, outreachTarget: e.target.value })}
                    placeholder="e.g. Operations managers at restaurant chains in Seattle"
                    onFocus={e => (e.target.style.borderColor = T.accent)}
                    onBlur={e => (e.target.style.borderColor = T.border)}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <FieldLabel>Goal for first outreach</FieldLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { value: 'book_call',     label: 'Book a call' },
                      { value: 'get_reply',     label: 'Get a reply' },
                      { value: 'visit_website', label: 'Visit the site' },
                    ].map(opt => {
                      const sel = data.outreachGoal === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onChange({ ...data, outreachGoal: opt.value })}
                          style={{
                            padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                            border: `1.5px solid ${sel ? T.accent : T.border}`,
                            background: sel ? `${T.accent}14` : T.surface,
                            color: sel ? T.accent : T.muted,
                            fontSize: 12, fontWeight: sel ? 600 : 400,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel>Initial prospect target</FieldLabel>
                  <PillSelect
                    options={[
                      { value: '10', label: '10 leads' },
                      { value: '25', label: '25 leads' },
                      { value: '50', label: '50 leads' },
                    ]}
                    value={data.outreachVolume}
                    onChange={v => onChange({ ...data, outreachVolume: v as string })}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Paid Advertising — V1 brief only */}
      {(() => {
        const selected = isSelected('paid_ads');
        const badge = V_BADGE.brief;
        return (
          <div style={{ border: `1.5px solid ${selected ? T.accent : T.border}`, borderRadius: 14, background: T.surface }}>
            <button
              type="button"
              onClick={() => toggleChannel('paid_ads')}
              style={{
                width: '100%', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: 14,
                background: selected ? `${T.accent}08` : T.surface,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', borderRadius: 14,
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${selected ? T.accent : T.border}`,
                background: selected ? T.accent : 'transparent', flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>Paid Advertising</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  Reeve produces an audience brief + ad copy for your top 2 platforms. You run the campaigns.
                </div>
              </div>
            </button>
          </div>
        );
      })()}

      {/* Partners & Affiliates — V1 brief only */}
      {(() => {
        const selected = isSelected('partners');
        const badge = V_BADGE.brief;
        return (
          <div style={{ border: `1.5px solid ${selected ? T.accent : T.border}`, borderRadius: 14, background: T.surface }}>
            <button
              type="button"
              onClick={() => toggleChannel('partners')}
              style={{
                width: '100%', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: 14,
                background: selected ? `${T.accent}08` : T.surface,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', borderRadius: 14,
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${selected ? T.accent : T.border}`,
                background: selected ? T.accent : 'transparent', flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>Partners & Affiliates</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  Reeve maps potential partnership channels and produces an outreach brief.
                </div>
              </div>
            </button>
          </div>
        );
      })()}

      {/* Organic / Content — V2 disabled */}
      {(() => {
        const badge = V_BADGE.future;
        return (
          <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 14, background: T.surface, opacity: 0.5, pointerEvents: 'none' }}>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${T.border}`, flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>Organic / Content</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  Blog posts, SEO strategy, and social content — coming in V2.
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Screen 5 — Confirmation ────────────────────────────────────────────────

function Screen5({ businessName, onGo }: { businessName: string; onGo: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🔬</div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: '0 0 10px', letterSpacing: '-0.03em' }}>
        Research is starting.
      </h2>
      <p style={{ fontSize: 14, color: T.muted, margin: '0 0 28px', maxWidth: 380, lineHeight: 1.6 }}>
        Reeve is analyzing the market for {businessName || 'your business'} and building your Research Brief.
        This usually takes 2–3 minutes.
      </p>

      {/* What happens next */}
      <div style={{ width: '100%', maxWidth: 440, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, textAlign: 'left', marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          What happens next
        </div>
        {[
          { icon: '🔍', label: 'Research',      desc: 'Reeve analyzes competitors and positions your business', color: '#eef2ff' },
          { icon: '✅', label: 'Your review',   desc: 'You approve the Research Brief before anything is built', color: '#eef2ff' },
          { icon: '🎨', label: 'Website build', desc: 'Wren builds your site with real copy from the research', color: '#fffbeb' },
          { icon: '🎯', label: 'Lead finding',  desc: 'Reeve builds your prospect list for outreach', color: '#eef2ff' },
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 3 ? 14 : 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              {step.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>{step.label}</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.4 }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onGo}
        style={{
          padding: '13px 32px', borderRadius: 12,
          background: T.accent, color: '#fff',
          border: 'none', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          letterSpacing: '-0.01em',
        }}
      >
        Go to Project Hub →
      </button>
    </div>
  );
}

// ── Left panel ─────────────────────────────────────────────────────────────

function LeftPanel({ current, maxReached }: { current: number; maxReached: number }) {
  return (
    <div style={{
      width: 260,
      flexShrink: 0,
      background: T.leftBg,
      display: 'flex',
      flexDirection: 'column',
      padding: '48px 32px 32px',
      position: 'relative',
    }}>
      {/* Logo */}
      <div style={{ fontSize: 16, fontWeight: 700, color: T.leftText, letterSpacing: '-0.02em', marginBottom: 48 }}>
        Shipyard{' '}
        <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '2px 7px', borderRadius: 10, letterSpacing: '0.04em' }}>
          DISTRIBUTE
        </span>
      </div>

      {/* Step navigation */}
      <div style={{ flex: 1 }}>
        {STEPS.map((step, i) => {
          const isDone    = step.num < current;
          const isActive  = step.num === current;
          const isPending = step.num > current;
          const isReached = step.num <= maxReached;

          return (
            <div key={step.num}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Dot + connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: `2px solid ${isDone || isActive ? T.leftText : 'rgba(255,255,255,0.3)'}`,
                    background: isDone ? T.leftText : isActive ? 'transparent' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                    {isDone ? (
                      <span style={{ color: T.accent, fontSize: 13, fontWeight: 700 }}>✓</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? T.leftText : 'rgba(255,255,255,0.4)' }}>
                        {step.num}
                      </span>
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{
                      width: 1, height: 40, marginTop: 4,
                      background: isDone ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                    }} />
                  )}
                </div>

                {/* Text */}
                <div style={{ paddingTop: 4, opacity: isPending && !isReached ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: T.leftText, lineHeight: 1.2 }}>
                    {step.label}
                  </div>
                  {isActive && (
                    <div style={{ fontSize: 11, color: T.leftMuted, marginTop: 2, lineHeight: 1.4 }}>
                      {step.note}
                    </div>
                  )}
                </div>
              </div>
              {i < STEPS.length - 1 && <div style={{ height: 16 }} />}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: T.leftMuted, lineHeight: 1.5, borderTop: `1px solid ${T.leftLine}`, paddingTop: 20, marginTop: 20 }}>
        Your answers stay in your project. Reeve uses them to build everything.
      </div>
    </div>
  );
}

// ── Main wizard ─────────────────────────────────────────────────────────────

export default function DistributeWizardScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate          = useNavigate();

  const [screen, setScreen] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [s1, setS1] = useState<S1Data>({ businessName: '', whatYouDo: '', problemSolved: '', customerType: '', customerDetail: '' });
  const [s2, setS2] = useState<S2Data>({ competitor1: '', competitor2: '', competitor3: '', geography: '', priceRange: '' });
  const [s3, setS3] = useState<S3Data>({ pages: [...DEFAULT_PAGES], tone: '', hasBrand: false, hasDomain: false, domain: '' });
  const [s4, setS4] = useState<S4Data>({ channels: ['outreach'], outreachTarget: '', outreachGoal: 'book_call', outreachVolume: '25' });

  function isScreen1Valid() { return !!s1.businessName.trim() && !!s1.whatYouDo.trim() && !!s1.customerType; }
  function isScreen2Valid() { return !!s2.geography && !!s2.priceRange; }
  function isScreen3Valid() { return s3.pages.length > 0 && !!s3.tone; }
  function isScreen4Valid() { return s4.channels.length > 0; }

  const canContinue = screen === 1 ? isScreen1Valid()
    : screen === 2 ? isScreen2Valid()
    : screen === 3 ? isScreen3Valid()
    : screen === 4 ? isScreen4Valid()
    : true;

  async function handleNext() {
    if (screen < 4) {
      const next = screen + 1;
      setScreen(next);
      setMaxReached(m => Math.max(m, next));
      setError('');
      window.scrollTo(0, 0);
    } else {
      // Screen 4 → Save + fire research + show confirmation
      setSaving(true);
      setError('');
      try {
        // 1. Save project_type = 'website'
        await supabase
          .from('projects')
          .update({ project_type: 'website' })
          .eq('id', projectId!);

        // 2. Save wizard answers to project_settings
        const wizardAnswers = {
          businessName: s1.businessName,
          whatYouDo: s1.whatYouDo,
          problemSolved: s1.problemSolved,
          customerType: s1.customerType,
          customerDetail: s1.customerDetail,
          competitors: [s2.competitor1, s2.competitor2, s2.competitor3].filter(Boolean),
          geography: s2.geography,
          priceRange: s2.priceRange,
          pages: s3.pages,
          tone: s3.tone,
          hasBrand: s3.hasBrand,
          hasDomain: s3.hasDomain,
          domain: s3.domain,
          channels: s4.channels,
          outreachTarget: s4.outreachTarget,
          outreachGoal: s4.outreachGoal,
          outreachVolume: s4.outreachVolume,
        };

        const { error: settingsError } = await supabase
          .from('project_settings')
          .upsert({ project_id: projectId!, distribute_wizard_answers: wizardAnswers }, { onConflict: 'project_id' });
        if (settingsError) throw settingsError;

        // 3. Fire run-research Edge Function (fire-and-forget)
        const { data: { session } } = await supabase.auth.getSession();
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-research`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ project_id: projectId }),
        }).catch(() => { /* non-blocking */ });

        setScreen(5);
        window.scrollTo(0, 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed. Try again.');
      } finally {
        setSaving(false);
      }
    }
  }

  function handleBack() {
    if (screen > 1) {
      setScreen(s => s - 1);
      window.scrollTo(0, 0);
    }
  }

  const SCREEN_TITLES: Record<number, { title: string; sub: string }> = {
    1: { title: 'Tell us about your business.',    sub: 'Reeve uses this to position your website and find the right prospects.' },
    2: { title: 'Your market.',                    sub: 'Where do you compete and who are you up against?' },
    3: { title: 'Your website.',                   sub: 'We\'ll build this from scratch — real pages, real copy, ready to deploy.' },
    4: { title: 'How will you find customers?',    sub: 'Pick the channels you want Shipyard to activate for you.' },
  };

  const meta = SCREEN_TITLES[screen] ?? { title: '', sub: '' };

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
    }}>
      {/* Left panel — hidden on confirmation screen */}
      {screen < 5 && <LeftPanel current={screen} maxReached={maxReached} />}

      {/* Right panel */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {screen < 5 ? (
          <>
            {/* Content area */}
            <div style={{ flex: 1, padding: '48px 48px 120px' }}>
              <div style={{ maxWidth: 520 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: '0 0 6px', letterSpacing: '-0.03em' }}>
                  {meta.title}
                </h1>
                <p style={{ fontSize: 14, color: T.muted, margin: '0 0 32px', lineHeight: 1.5 }}>
                  {meta.sub}
                </p>

                {screen === 1 && <Screen1 data={s1} onChange={setS1} />}
                {screen === 2 && <Screen2 data={s2} onChange={setS2} />}
                {screen === 3 && <Screen3 data={s3} onChange={setS3} />}
                {screen === 4 && <Screen4 data={s4} onChange={setS4} />}

                {error && (
                  <p style={{ marginTop: 16, fontSize: 13, color: T.red }}>{error}</p>
                )}
              </div>
            </div>

            {/* Bottom nav bar */}
            <div style={{
              position: 'fixed', bottom: 0, right: 0,
              width: `calc(100% - 260px)`,
              height: 72,
              background: 'rgba(245,245,247,0.92)',
              backdropFilter: 'blur(12px)',
              borderTop: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 48px',
              zIndex: 100,
            }}>
              <button
                type="button"
                onClick={handleBack}
                style={{
                  background: 'none', border: 'none', fontSize: 14,
                  color: screen > 1 ? T.muted : 'transparent',
                  cursor: screen > 1 ? 'pointer' : 'default',
                  pointerEvents: screen > 1 ? 'auto' : 'none',
                  fontFamily: 'inherit', padding: '8px 0',
                }}
              >
                ← Back
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: T.faint }}>
                  Step {screen} of 4
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canContinue || saving}
                  style={{
                    padding: '11px 28px', borderRadius: 10,
                    background: canContinue && !saving ? T.accent : T.border,
                    color: canContinue && !saving ? '#fff' : T.faint,
                    border: 'none', fontSize: 14, fontWeight: 600,
                    cursor: canContinue && !saving ? 'pointer' : 'default',
                    fontFamily: 'inherit', transition: 'all 0.12s',
                  }}
                >
                  {saving ? 'Starting…' : screen === 4 ? 'Start Research →' : 'Continue →'}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Confirmation screen — full-width, centered */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
            <div style={{ maxWidth: 480, width: '100%' }}>
              <Screen5
                businessName={s1.businessName}
                onGo={() => navigate(`/projects/${projectId}/distribute`, { replace: true })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
