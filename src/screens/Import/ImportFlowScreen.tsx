/**
 * ImportFlowScreen — Build 041
 *
 * Four-stage import flow: Sources → Discovery → Review → Done
 *
 * Route: /projects/:id/import
 * Also used as a modal from Project Hub empty state.
 *
 * Stage 1 — Sources: URL, optional GitHub URL, optional SQL file, docs
 * Stage 2 — Discovery: polling progress UI (3-second intervals)
 * Stage 3 — Review: screens thumbnail grid + feature checklist + table checklist
 * Stage 4 — Done: architecture summary generating, redirect prompt
 *
 * data-testid inventory:
 *   import-flow-screen                  — outer container
 *   import-stage-indicator              — step dots
 *   import-source-url-input             — main URL input
 *   import-github-url-input             — GitHub URL input
 *   import-begin-btn                    — start crawl
 *   import-progress-screens             — screen crawl progress
 *   import-progress-features            — feature inference progress
 *   import-progress-schema              — schema progress
 *   import-review-screens               — screen thumbnail grid
 *   import-review-features              — feature checklist section
 *   import-review-tables                — table checklist section
 *   import-feature-item-{id}            — feature checkbox row
 *   import-table-item-{id}              — table checkbox row
 *   import-select-all-features          — select all features
 *   import-select-all-tables            — select all tables
 *   import-confirm-btn                  — "Import selected" button
 *   import-done-view                    — stage 4 container
 *   import-go-to-project-btn            — navigate to Project Hub
 */

import {
  useState,
  useEffect,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createImportJob,
  getImportItems,
  updateImportItemStatus,
  renameImportItem,
  finaliseImport,
  pollImportJob,
  CONFIDENCE_COLORS,
  CONFIDENCE_LABELS,
} from '@/api/importJob';
import type {
  ImportJob,
  ImportItem,
  ImportFeatureData,
  ImportTableData,
  ImportScreenData,
} from '@/types/db';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

// ── Types ──────────────────────────────────────────────────────────────────

type FlowStage = 1 | 2 | 3 | 4;

// ── Stage Indicator ────────────────────────────────────────────────────────

function StageIndicator({ current }: { current: FlowStage }) {
  const stages = [
    { n: 1, label: 'Sources' },
    { n: 2, label: 'Discovery' },
    { n: 3, label: 'Review' },
    { n: 4, label: 'Done' },
  ];

  return (
    <div
      data-testid="import-stage-indicator"
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            0,
        marginBottom:   32,
      }}
    >
      {stages.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width:           28,
              height:          28,
              borderRadius:    '50%',
              backgroundColor: s.n < current  ? '#30d158'
                              : s.n === current ? '#4F46E5'
                              : '#E2E8F0',
              color:           s.n <= current ? '#fff' : '#94A3B8',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        12,
              fontWeight:      700,
            }}>
              {s.n < current ? '✓' : s.n}
            </div>
            <span style={{
              fontSize:   11,
              color:      s.n === current ? '#4F46E5' : '#94A3B8',
              fontWeight: s.n === current ? 700 : 400,
            }}>
              {s.label}
            </span>
          </div>

          {i < stages.length - 1 && (
            <div style={{
              width:           40,
              height:          2,
              backgroundColor: s.n < current ? '#30d158' : '#E2E8F0',
              marginBottom:    16,
              flexShrink:      0,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stage 1: Sources ───────────────────────────────────────────────────────

function Stage1Sources({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: (job: ImportJob) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [starting,  setStarting]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleBegin() {
    const url = sourceUrl.trim();
    if (!url) { setError("Please enter your app's URL"); return; }
    if (!/^https?:\/\//i.test(url)) { setError('URL must start with http:// or https://'); return; }
    setStarting(true);
    setError(null);
    try {
      const job = await createImportJob({
        projectId,
        sourceUrl: url,
        githubUrl: githubUrl.trim() || undefined,
      });
      onCreated(job);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to start import'));
      setStarting(false);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--color-text)' }}>
        Import your existing app
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        Shipyard will crawl your app, discover screens, infer features, and set you up for
        Changes, Bugs, PM Chat, and the Design Gallery — all ready to go.
      </p>

      <label style={{ display: 'block', marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>
          Live URL <span style={{ color: '#ef4444' }}>*</span>
        </span>
        <input
          data-testid="import-source-url-input"
          type="url"
          value={sourceUrl}
          onChange={e => setSourceUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBegin()}
          placeholder="https://mytaskapp.com"
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>
          GitHub repository URL{' '}
          <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional — improves feature inference)</span>
        </span>
        <input
          data-testid="import-github-url-input"
          type="url"
          value={githubUrl}
          onChange={e => setGithubUrl(e.target.value)}
          placeholder="https://github.com/you/mytaskapp"
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </label>

      <p style={{
        margin: '16px 0 24px', fontSize: 13, color: 'var(--color-text-muted)',
        backgroundColor: 'var(--color-bg)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.5,
      }}>
        ℹ Pages behind login won't be automatically discovered. You can add them manually after import.
        Estimated time: ~2 minutes for a 20-screen app.
      </p>

      {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <button
        data-testid="import-begin-btn"
        onClick={handleBegin}
        disabled={starting}
        style={{
          width: '100%', padding: '13px 20px', borderRadius: 10, border: 'none',
          backgroundColor: starting ? '#E2E8F0' : '#4F46E5',
          color: starting ? '#94A3B8' : '#fff',
          fontSize: 15, fontWeight: 700, cursor: starting ? 'wait' : 'pointer',
        }}
      >
        {starting ? 'Starting…' : 'Begin import →'}
      </button>
    </div>
  );
}

// ── Stage 2: Discovery ─────────────────────────────────────────────────────

function Stage2Discovery({
  job: initialJob,
  onReady,
  onFailed,
}: {
  job:      ImportJob;
  onReady:  (job: ImportJob) => void;
  onFailed: (msg: string) => void;
}) {
  const [job, setJob] = useState<ImportJob>(initialJob);

  useEffect(() => {
    const stopPoll = pollImportJob(
      initialJob.id,
      updatedJob => {
        setJob(updatedJob);
        if (updatedJob.status === 'review' || updatedJob.status === 'complete') {
          onReady(updatedJob);
        } else if (updatedJob.status === 'failed') {
          onFailed(updatedJob.error_message ?? 'Import failed');
        }
      },
      err => onFailed(err.message)
    );
    return stopPoll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJob.id]);

  const isDone      = job.status === 'review' || job.status === 'complete';
  const isAnalyzing = job.status === 'analyzing';
  const isCrawling  = job.status === 'pending' || job.status === 'crawling';

  function Row({ icon, label, detail, testId }: { icon: string; label: string; detail?: string; testId: string }) {
    return (
      <div
        data-testid={testId}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 0', borderBottom: '1px solid var(--color-border)', fontSize: 14,
        }}
      >
        <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, color: 'var(--color-text)' }}>{label}</span>
        {detail && <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{detail}</span>}
      </div>
    );
  }

  let hostname = job.source_url;
  try { hostname = new URL(job.source_url).hostname; } catch {}

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--color-text)' }}>
        Importing {hostname}
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-muted)' }}>
        This takes about 90 seconds.
      </p>

      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 10,
        backgroundColor: 'var(--color-surface)', padding: '0 20px', marginBottom: 24,
      }}>
        <Row
          testId="import-progress-screens"
          icon={isDone ? '✅' : isCrawling ? '⏳' : '✅'}
          label="Crawling pages…"
          detail={job.screens_found > 0 ? `${job.screens_found} found` : undefined}
        />
        <Row
          testId="import-progress-features"
          icon={isDone ? '✅' : isAnalyzing ? '⏳' : '○'}
          label="Inferring features…"
        />
        <Row
          testId="import-progress-schema"
          icon={isDone ? '✅' : isAnalyzing ? '⏳' : '○'}
          label="Analyzing schema…"
        />
      </div>

      {job.status === 'failed' && (
        <p style={{ color: '#ef4444', fontSize: 13 }}>
          {job.error_message ?? 'Import failed. Please try again.'}
        </p>
      )}
    </div>
  );
}

// ── Stage 3: Review ────────────────────────────────────────────────────────

function Stage3Review({
  job,
  onDone,
}: {
  job:    ImportJob;
  onDone: (result: { screens: number; features: number; tables: number }) => void;
}) {
  const [items,     setItems]     = useState<ImportItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [confirming, setConfirm]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [checked,   setChecked]   = useState<Record<string, boolean>>({});
  const [names,     setNames]     = useState<Record<string, string>>({});
  const [editing,   setEditing]   = useState<string | null>(null);

  useEffect(() => {
    getImportItems(job.id).then(its => {
      setItems(its);
      const initChecked: Record<string, boolean> = {};
      const initNames:   Record<string, string>  = {};
      for (const it of its) {
        if (it.type === 'screen') {
          initChecked[it.id] = true;
        } else if (it.type === 'feature') {
          const fd = it.raw_data as ImportFeatureData;
          initChecked[it.id] = fd.confidence === 'high' || fd.confidence === 'medium';
        } else {
          const td = it.raw_data as ImportTableData;
          initChecked[it.id] = !td.is_system_table;
        }
        initNames[it.id] = it.name;
      }
      setChecked(initChecked);
      setNames(initNames);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [job.id]);

  function toggleItem(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAll(type: 'feature' | 'table', value: boolean) {
    setChecked(prev => {
      const next = { ...prev };
      items.filter(it => it.type === type).forEach(it => { next[it.id] = value; });
      return next;
    });
  }

  async function handleConfirm() {
    setConfirm(true);
    setError(null);
    try {
      for (const item of items) {
        if (item.type === 'screen') continue;
        await updateImportItemStatus(item.id, checked[item.id] ? 'approved' : 'dismissed');
        if (names[item.id] !== item.name) await renameImportItem(item.id, names[item.id]);
      }
      const result = await finaliseImport(job.id);
      onDone({ screens: result.screens_created, features: result.features_created, tables: result.tables_created });
    } catch (err) {
      setError(extractErrorMessage(err, 'Import failed'));
      setConfirm(false);
    }
  }

  const screens  = items.filter(it => it.type === 'screen');
  const features = items.filter(it => it.type === 'feature');
  const tables   = items.filter(it => it.type === 'table');
  const selFeatures = features.filter(it => checked[it.id]).length;
  const selTables   = tables.filter(it => checked[it.id]).length;
  const importLabel = `Import ${screens.length} screens · ${selFeatures} feature${selFeatures !== 1 ? 's' : ''} · ${selTables} table${selTables !== 1 ? 's' : ''}`;

  if (loading) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>Loading review…</div>;
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--color-text)' }}>
        Review your import
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--color-text-muted)' }}>
        Approve what you want to bring into Shipyard, then click Import.
      </p>

      {/* Screens */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
          Screens{' '}
          <span style={{ fontSize: 12, fontWeight: 600, backgroundColor: '#4F46E522', color: '#4F46E5', padding: '2px 8px', borderRadius: 10 }}>
            {screens.length} found
          </span>
        </h3>
        <div
          data-testid="import-review-screens"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}
        >
          {screens.map(screen => {
            const sd = screen.raw_data as ImportScreenData;
            return (
              <div key={screen.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--color-surface)' }}>
                <div style={{ height: 80, backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#94A3B8', overflow: 'hidden' }}>
                  {sd.screenshot_path
                    ? <img src={sd.screenshot_path} alt={screen.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '🖥'}
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{screen.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sd.path}</p>
                </div>
              </div>
            );
          })}
          {screens.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', gridColumn: '1/-1' }}>No screens discovered.</p>
          )}
        </div>
      </div>

      {/* Features */}
      {features.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Inferred Features</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button data-testid="import-select-all-features" onClick={() => toggleAll('feature', true)} style={{ fontSize: 12, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Select all</button>
              <span style={{ color: 'var(--color-border)' }}>·</span>
              <button onClick={() => toggleAll('feature', false)} style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Deselect all</button>
            </div>
          </div>
          <div data-testid="import-review-features" style={{ border: '1px solid var(--color-border)', borderRadius: 10, backgroundColor: 'var(--color-surface)', overflow: 'hidden' }}>
            {features.map((feature, i) => {
              const fd = feature.raw_data as ImportFeatureData;
              const isEd = editing === feature.id;
              return (
                <div
                  key={feature.id}
                  data-testid={`import-feature-item-${feature.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < features.length - 1 ? '1px solid var(--color-border)' : 'none', opacity: checked[feature.id] ? 1 : 0.5 }}
                >
                  <input type="checkbox" checked={!!checked[feature.id]} onChange={() => toggleItem(feature.id)} style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEd ? (
                      <input autoFocus value={names[feature.id]} onChange={e => setNames(prev => ({ ...prev, [feature.id]: e.target.value }))} onBlur={() => setEditing(null)} onKeyDown={e => e.key === 'Enter' && setEditing(null)}
                        style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', border: 'none', borderBottom: '2px solid var(--color-accent)', background: 'transparent', outline: 'none', width: '100%' }} />
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{names[feature.id]}</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>{fd.screen_paths.length} screen{fd.screen_paths.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: CONFIDENCE_COLORS[fd.confidence], backgroundColor: `${CONFIDENCE_COLORS[fd.confidence]}18`, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
                    {CONFIDENCE_LABELS[fd.confidence]}
                  </span>
                  <button onClick={() => setEditing(isEd ? null : feature.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-muted)', padding: '0 4px', flexShrink: 0 }}>
                    {isEd ? 'Done' : 'Edit name'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tables */}
      {tables.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Schema Tables</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button data-testid="import-select-all-tables" onClick={() => toggleAll('table', true)} style={{ fontSize: 12, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Select all</button>
              <span style={{ color: 'var(--color-border)' }}>·</span>
              <button onClick={() => toggleAll('table', false)} style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Deselect all</button>
            </div>
          </div>
          <div data-testid="import-review-tables" style={{ border: '1px solid var(--color-border)', borderRadius: 10, backgroundColor: 'var(--color-surface)', overflow: 'hidden' }}>
            {tables.map((table, i) => {
              const td = table.raw_data as ImportTableData;
              return (
                <div
                  key={table.id}
                  data-testid={`import-table-item-${table.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < tables.length - 1 ? '1px solid var(--color-border)' : 'none', opacity: checked[table.id] ? 1 : 0.5 }}
                >
                  <input type="checkbox" checked={!!checked[table.id]} onChange={() => toggleItem(table.id)} style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'monospace' }}>{table.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>({td.columns.length} column{td.columns.length !== 1 ? 's' : ''})</span>
                  {td.is_system_table && (
                    <span style={{ fontSize: 11, color: '#94A3B8', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: 6 }}>system</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <button
        data-testid="import-confirm-btn"
        onClick={handleConfirm}
        disabled={confirming}
        style={{ width: '100%', padding: '13px 20px', borderRadius: 10, border: 'none', backgroundColor: confirming ? '#E2E8F0' : '#4F46E5', color: confirming ? '#94A3B8' : '#fff', fontSize: 15, fontWeight: 700, cursor: confirming ? 'wait' : 'pointer' }}
      >
        {confirming ? 'Importing…' : importLabel}
      </button>
    </div>
  );
}

// ── Stage 4: Done ──────────────────────────────────────────────────────────

function Stage4Done({
  projectId,
  result,
}: {
  projectId: string;
  result:    { screens: number; features: number; tables: number };
}) {
  const navigate = useNavigate();

  return (
    <div data-testid="import-done-view" style={{ textAlign: 'center', paddingTop: 16 }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: 'var(--color-text)' }}>
        Import complete!
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        {result.screens} screen{result.screens !== 1 ? 's' : ''},{' '}
        {result.features} feature{result.features !== 1 ? 's' : ''},{' '}
        {result.tables} table{result.tables !== 1 ? 's' : ''} added to your project.
      </p>

      <div style={{
        border: '1px solid var(--color-border)', borderLeft: '3px solid #475569',
        borderRadius: 10, padding: '14px 16px', marginBottom: 28,
        backgroundColor: 'var(--color-surface)', textAlign: 'left',
      }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>
          <strong>Morgan</strong> is reviewing everything and writing a project architecture
          summary. It'll be ready in your Artifacts Panel in ~30 seconds.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          data-testid="import-go-to-project-btn"
          onClick={() => navigate(`/projects/${projectId}`)}
          style={{ padding: '13px 20px', borderRadius: 10, border: 'none', backgroundColor: '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          Go to Project Hub →
        </button>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
          Your features are tagged "Imported · Needs PRD" — ask Morgan to write PRDs for them.
        </p>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

interface ImportFlowScreenProps {
  /** If provided as a prop (modal mode), use this. Otherwise read from useParams. */
  projectIdProp?: string;
}

export default function ImportFlowScreen({ projectIdProp }: ImportFlowScreenProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const projectId       = projectIdProp ?? paramId ?? '';
  const [stage,    setStage]    = useState<FlowStage>(1);
  const [job,      setJob]      = useState<ImportJob | null>(null);
  const [errMsg,   setErrMsg]   = useState<string | null>(null);
  const [done,     setDone]     = useState<{ screens: number; features: number; tables: number } | null>(null);

  return (
    <div
      data-testid="import-flow-screen"
      style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}
    >
      <StageIndicator current={stage} />

      {errMsg && stage === 1 && (
        <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 8, backgroundColor: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#ef4444' }}>
          {errMsg} — please try again.
        </div>
      )}

      {stage === 1 && (
        <Stage1Sources
          projectId={projectId}
          onCreated={job => { setJob(job); setStage(2); }}
        />
      )}

      {stage === 2 && job && (
        <Stage2Discovery
          job={job}
          onReady={updatedJob => { setJob(updatedJob); setStage(3); }}
          onFailed={msg => { setErrMsg(msg); setStage(1); }}
        />
      )}

      {stage === 3 && job && (
        <Stage3Review
          job={job}
          onDone={result => { setDone(result); setStage(4); }}
        />
      )}

      {stage === 4 && done && (
        <Stage4Done projectId={projectId} result={done} />
      )}
    </div>
  );
}
