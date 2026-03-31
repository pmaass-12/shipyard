/**
 * DistributeResearchScreen — Build 047
 * Route: /projects/:id/distribute/research
 * Shows the Research Brief with approve/edit controls.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { BusinessResearch } from '@/types/db';

const T = {
  bg: '#f5f5f7', surface: '#ffffff', border: '#e5e5ea',
  text: '#1c1c1e', muted: '#6e6e73', faint: '#aeaeb2',
  accent: '#4338ca', accentLight: '#eef2ff',
  green: '#22c55e', greenLight: '#f0fdf4',
  sidebar: { bg: '#1c1c1e', text: '#e8e8ea', muted: '#8e8e93', active: '#5b5bd6' },
};

export default function DistributeResearchScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate          = useNavigate();
  const [research, setResearch]   = useState<BusinessResearch | null>(null);
  const [loading, setLoading]     = useState(true);
  const [approving, setApproving] = useState(false);
  const [editing, setEditing]     = useState(false);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('business_research')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()
      .then(({ data }) => { setResearch(data ?? null); setLoading(false); });
  }, [projectId]);

  async function handleApprove() {
    if (!research) return;
    setApproving(true);
    await supabase
      .from('business_research')
      .update({ approved_at: new Date().toISOString() })
      .eq('id', research.id);
    const { data: { session } } = await supabase.auth.getSession();
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-website`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ project_id: projectId }),
    }).catch(() => {});
    setResearch(r => r ? { ...r, approved_at: new Date().toISOString() } : r);
    setApproving(false);
    navigate(`/projects/${projectId}/distribute`);
  }

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  if (loading) {
    return <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
      <span style={{ color: T.muted, fontSize: 14 }}>Loading research…</span>
    </div>;
  }

  if (!research) {
    return <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>Research in progress</div>
        <div style={{ fontSize: 13, color: T.muted }}>Reeve is building your Research Brief. Check back in a few minutes.</div>
      </div>
    </div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: font, color: T.text }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 32px 80px' }}>
        {/* Header */}
        <button onClick={() => navigate(`/projects/${projectId}/distribute`)} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 13, cursor: 'pointer', padding: '0 0 24px', fontFamily: font }}>
          ← Project Hub
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.03em' }}>Research Brief</h1>
            <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
              {research.approved_at ? `Approved on ${new Date(research.approved_at).toLocaleDateString()}` : 'Review and approve to start the Website build.'}
            </p>
          </div>
          {!research.approved_at && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(e => !e)} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, fontSize: 13, cursor: 'pointer', fontFamily: font }}>
                Edit
              </button>
              <button onClick={handleApprove} disabled={approving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
                {approving ? 'Approving…' : 'Approve Brief — Start Website Build →'}
              </button>
            </div>
          )}
          {research.approved_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: T.greenLight, border: `1px solid #dcfce7` }}>
              <span style={{ color: T.green }}>✓</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Approved</span>
            </div>
          )}
        </div>

        {/* Market positioning */}
        {research.positioning_recommendation && (
          <section style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Market Positioning</h3>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 20px', fontSize: 14, color: T.text, lineHeight: 1.65 }}>
              {research.positioning_recommendation}
            </div>
          </section>
        )}

        {/* Competitors */}
        {Array.isArray(research.competitors) && research.competitors.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Competitive Landscape</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {research.competitors.map((c, i) => (
                <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.name}</span>
                    {c.url && <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.accent }}>{c.url}</a>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                    <div>
                      <div style={{ color: T.green, fontWeight: 600, marginBottom: 4 }}>Strengths</div>
                      {(c.strengths ?? []).map((s, j) => <div key={j} style={{ color: T.muted, marginBottom: 2 }}>+ {s}</div>)}
                    </div>
                    <div>
                      <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>Weaknesses</div>
                      {(c.weaknesses ?? []).map((w, j) => <div key={j} style={{ color: T.muted, marginBottom: 2 }}>− {w}</div>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Key messages */}
        {Array.isArray(research.key_messages) && research.key_messages.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Key Messages</h3>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 20px' }}>
              {research.key_messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 14, color: T.text, marginBottom: i < research.key_messages.length - 1 ? 10 : 0, lineHeight: 1.5 }}>
                  <span style={{ color: T.accent, flexShrink: 0 }}>→</span>
                  {msg}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Target customer */}
        {research.target_customer_profile && (
          <section style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Target Customer Profile</h3>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 20px', fontSize: 14, color: T.text, lineHeight: 1.65 }}>
              {research.target_customer_profile}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
