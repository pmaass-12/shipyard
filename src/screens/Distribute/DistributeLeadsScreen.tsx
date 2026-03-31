/**
 * DistributeLeadsScreen — Build 047
 * Route: /projects/:id/distribute/leads
 *
 * Leads table with: search, filters, bulk actions, status pills,
 * confidence badges, CSV import modal, CSV export dropdown.
 * All CSV operations are client-side (no Edge Function).
 */

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LEAD_STATUS_STYLES } from '@/types/db';
import type { Lead, LeadStatus, LeadConfidence } from '@/types/db';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg: '#f5f5f7', surface: '#ffffff', border: '#e5e5ea',
  text: '#1c1c1e', muted: '#6e6e73', faint: '#aeaeb2',
  accent: '#4338ca', accentLight: '#eef2ff',
  amber: '#f59e0b', amberLight: '#fffbeb',
  green: '#22c55e',
};

const CONFIDENCE_COLORS: Record<LeadConfidence, string> = {
  high:   T.green,
  medium: T.amber,
  low:    '#ef4444',
};

// ── CSV helpers ────────────────────────────────────────────────────────────

function leadsToCSV(rows: Lead[]): string {
  const header = ['Company', 'Industry', 'Location', 'Website', 'Contact', 'Email', 'Phone', 'Status', 'Confidence', 'Source', 'Notes'];
  const lines = rows.map(r => [
    r.company_name, r.industry ?? '', r.location ?? '', r.website_url ?? '',
    r.contact_name ?? '', r.contact_email ?? '', r.contact_phone ?? '',
    r.status, r.confidence, r.source, r.research_notes ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...lines].join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── CSV Import Modal ───────────────────────────────────────────────────────

const TARGET_FIELDS = ['company_name','contact_name','contact_email','contact_phone','website_url','location','industry','research_notes'];
const FIELD_LABELS: Record<string, string> = {
  company_name: 'Company', contact_name: 'Contact name', contact_email: 'Email',
  contact_phone: 'Phone', website_url: 'Website URL', location: 'Location',
  industry: 'Industry', research_notes: 'Notes',
};

// Common column name patterns for auto-detection
const AUTO_DETECT: Record<string, string[]> = {
  company_name:  ['company','company name','organization','account'],
  contact_name:  ['first name','last name','contact','name','full name'],
  contact_email: ['email','email address','work email'],
  contact_phone: ['phone','phone number','mobile'],
  website_url:   ['website','url','domain','company url'],
  location:      ['city','location','state','country'],
  industry:      ['industry','vertical','sector'],
  research_notes:['notes','description','about'],
};

function guessMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const [field, patterns] of Object.entries(AUTO_DETECT)) {
    for (const h of headers) {
      if (patterns.some(p => h.toLowerCase().trim().includes(p))) {
        mapping[h] = field;
        break;
      }
    }
  }
  return mapping;
}

interface ImportModalProps {
  onClose: () => void;
  projectId: string;
  onImported: () => void;
}

function ImportModal({ onClose, projectId, onImported }: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows]       = useState<string[][]>([]);
  const [mapping, setMapping]       = useState<Record<string, string>>({});
  const [autoDetected, setAutoDetected] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const text   = e.target?.result as string;
      const lines  = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
      const rows    = lines.slice(1).map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
      setCsvHeaders(headers);
      setCsvRows(rows);
      const guessed = guessMapping(headers);
      setMapping(guessed);
      setAutoDetected(Object.keys(guessed).length >= 4);
      setStep('map');
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    const toInsert = csvRows.slice(0, 500).map(row => {
      const lead: Record<string, string> = { project_id: projectId, status: 'prospect', confidence: 'medium', source: 'csv_import' };
      for (const [header, field] of Object.entries(mapping)) {
        if (field && field !== '—') {
          const idx = csvHeaders.indexOf(header);
          if (idx >= 0) lead[field] = row[idx] ?? '';
        }
      }
      return lead;
    }).filter(l => l.company_name);
    await supabase.from('leads').insert(toInsert);
    setImporting(false);
    onImported();
    onClose();
  }

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: font }}>
      <div style={{ background: T.surface, borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>Import CSV</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: T.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Progress */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['upload','map','preview'] as const).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <div style={{ width: 20, height: 1, background: T.border }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: step === s ? T.accent : csvRows.length > 0 && i < ['upload','map','preview'].indexOf(step) ? T.green : '#e4e4e8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                }}>
                  {csvRows.length > 0 && i < ['upload','map','preview'].indexOf(step) ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, color: step === s ? T.accent : T.muted, fontWeight: step === s ? 600 : 400, textTransform: 'capitalize' }}>{s}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${T.border}`, borderRadius: 12, padding: '40px 24px',
                  textAlign: 'center', cursor: 'pointer', background: T.bg,
                }}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Drop a CSV file or click to browse</div>
                <div style={{ fontSize: 12, color: T.muted }}>Supports Apollo, Hunter.io, LinkedIn Sales Navigator, or any CSV</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* Step 2: Map columns */}
          {step === 'map' && (
            <div>
              {autoDetected && (
                <div style={{ background: T.accentLight, border: `1px solid ${T.accent}30`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: T.accent }}>
                  ✓ Format auto-detected — {Object.values(mapping).filter(v => v && v !== '—').length} of {csvHeaders.length} columns mapped
                </div>
              )}
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: T.bg }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: T.muted, fontWeight: 600 }}>CSV column</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: T.muted, fontWeight: 600 }}>Maps to</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: T.muted, fontWeight: 600 }}>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvHeaders.map((h, i) => (
                      <tr key={h} style={{ borderTop: `1px solid ${T.border}` }}>
                        <td style={{ padding: '9px 14px', color: T.text, fontWeight: 500 }}>{h}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <select
                            value={mapping[h] ?? '—'}
                            onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, color: T.text, fontFamily: font }}
                          >
                            <option value="—">— Skip this column —</option>
                            {TARGET_FIELDS.map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '9px 14px', color: T.muted }}>{csvRows[0]?.[i] ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: T.muted }}>
                <span>{csvRows.length} rows will be imported as prospects with confidence = Medium</span>
                <button
                  onClick={() => setStep('preview')}
                  style={{ padding: '9px 20px', borderRadius: 8, background: T.accent, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
                >
                  Preview {csvRows.length} leads →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div>
              <p style={{ fontSize: 13, color: T.muted, marginTop: 0, marginBottom: 16 }}>
                Preview of first 5 leads. {csvRows.length} total rows will be imported.
              </p>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: T.bg }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: T.muted, fontWeight: 600 }}>Company</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: T.muted, fontWeight: 600 }}>Contact</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: T.muted, fontWeight: 600 }}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, ri) => {
                      const get = (field: string) => {
                        const h = Object.entries(mapping).find(([, f]) => f === field)?.[0];
                        if (!h) return '';
                        return row[csvHeaders.indexOf(h)] ?? '';
                      };
                      return (
                        <tr key={ri} style={{ borderTop: `1px solid ${T.border}` }}>
                          <td style={{ padding: '9px 14px', color: T.text, fontWeight: 500 }}>{get('company_name') || '—'}</td>
                          <td style={{ padding: '9px 14px', color: T.muted }}>{get('contact_name') || '—'}</td>
                          <td style={{ padding: '9px 14px', color: T.muted }}>{get('contact_email') || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setStep('map')} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, fontSize: 13, cursor: 'pointer', fontFamily: font }}>
                  ← Back
                </button>
                <button onClick={handleImport} disabled={importing} style={{ padding: '9px 20px', borderRadius: 8, background: T.accent, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
                  {importing ? 'Importing…' : `Import ${csvRows.length} leads`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function DistributeLeadsScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  async function loadLeads() {
    if (!projectId) return;
    setLoading(true);
    let q = supabase.from('leads').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setLeads(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadLeads(); }, [projectId, statusFilter]);

  const filtered = leads.filter(l =>
    !search || l.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (l.contact_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function bulkApprove() {
    await supabase.from('leads').update({ status: 'approved' }).in('id', [...selected]);
    setSelected(new Set());
    loadLeads();
  }

  async function bulkDismiss() {
    await supabase.from('leads').update({ status: 'dismissed' }).in('id', [...selected]);
    setSelected(new Set());
    loadLeads();
  }

  function handleExport(variant: 'all' | 'filtered' | 'ready') {
    const rows = variant === 'all'      ? leads
               : variant === 'filtered' ? filtered
               : leads.filter(l => l.status === 'approved' && l.contact_email);
    downloadCSV(leadsToCSV(rows), `leads-${variant}.csv`);
    setShowExport(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: font, color: T.text }}>
      {showImport && <ImportModal projectId={projectId!} onClose={() => setShowImport(false)} onImported={loadLeads} />}

      <div style={{ padding: '32px 40px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>Leads</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Export dropdown */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowExport(e => !e)} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, fontSize: 13, cursor: 'pointer', fontFamily: font, display: 'flex', alignItems: 'center', gap: 5 }}>
                Export CSV ▾
              </button>
              {showExport && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 180, zIndex: 100 }}>
                  {[
                    { key: 'all',      label: 'All leads' },
                    { key: 'filtered', label: 'Filtered view' },
                    { key: 'ready',    label: 'Outreach-ready' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => handleExport(opt.key as 'all' | 'filtered' | 'ready')}
                      style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: T.text, cursor: 'pointer', fontFamily: font }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setShowImport(true)} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, cursor: 'pointer', fontFamily: font, fontWeight: 500 }}>
              Import CSV
            </button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
              + Add lead
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search leads…"
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, fontFamily: font, outline: 'none', width: 220 }}
          />
          <select
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, fontFamily: font }}
          >
            <option value="">All statuses</option>
            {(['prospect','approved','dismissed','contacted','replied','bounced','converted'] as LeadStatus[]).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div style={{ background: T.amberLight, border: `1px solid ${T.amberLight}`, borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{selected.size} lead{selected.size > 1 ? 's' : ''} selected</span>
            <button onClick={bulkApprove} style={{ padding: '5px 12px', borderRadius: 6, background: '#dcfce7', color: '#166534', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
              ✓ Approve {selected.size}
            </button>
            <button onClick={bulkDismiss} style={{ padding: '5px 12px', borderRadius: 6, background: T.surface, color: T.muted, border: `1px solid ${T.border}`, fontSize: 12, cursor: 'pointer', fontFamily: font }}>
              Dismiss {selected.size}
            </button>
            <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', fontSize: 12, color: T.muted, cursor: 'pointer', marginLeft: 'auto', fontFamily: font }}>
              Clear selection
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: T.muted, fontSize: 14 }}>Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>No leads yet</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18 }}>Import a CSV to get started, or wait for Reeve to research your prospects.</div>
            <button onClick={() => setShowImport(true)} style={{ padding: '9px 20px', borderRadius: 8, background: T.accent, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
              Import CSV
            </button>
          </div>
        ) : (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>
                    <input type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={e => setSelected(e.target.checked ? new Set(filtered.map(l => l.id)) : new Set())}
                    />
                  </th>
                  {['Company', 'Contact', 'Email', 'Status', 'Confidence', 'Source'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: T.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const isSel = selected.has(lead.id);
                  const style = LEAD_STATUS_STYLES[lead.status];
                  const confColor = CONFIDENCE_COLORS[lead.confidence];
                  return (
                    <tr key={lead.id} style={{ borderBottom: `1px solid ${T.border}`, background: isSel ? '#eef2ff' : 'transparent' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <input type="checkbox" checked={isSel} onChange={e => {
                          const s = new Set(selected);
                          e.target.checked ? s.add(lead.id) : s.delete(lead.id);
                          setSelected(s);
                        }} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: T.text }}>{lead.company_name}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>{[lead.industry, lead.location].filter(Boolean).join(' · ')}</div>
                        {lead.website_url && <a href={lead.website_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.accent }}>{lead.website_url}</a>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ color: T.text }}>{lead.contact_name ?? '—'}</div>
                        {lead.job_title && <div style={{ fontSize: 11, color: T.muted }}>{(lead as unknown as { job_title?: string }).job_title}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', color: T.muted, fontSize: 12 }}>{lead.contact_email ?? '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: style.bg, color: style.color }}>
                          {lead.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: confColor }} />
                          <span style={{ fontSize: 12, color: T.text }}>{lead.confidence.charAt(0).toUpperCase() + lead.confidence.slice(1)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: T.bg, color: T.muted }}>
                          {lead.source === 'csv_import' ? 'CSV' : lead.source === 'manual' ? 'Manual' : 'Web'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
