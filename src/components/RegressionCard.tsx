/**
 * RegressionCard — Build 042
 *
 * Shows the latest regression run on the Project Hub.
 * - While running: spinner + realtime subscription for live updates
 * - Passed: green summary with test counts and duration
 * - Failed: failed test list with [Run now] and [File as P0 bugs] CTA
 * - No runs yet: empty state with [Run now]
 *
 * data-testid inventory:
 *   regression-card               — outer card
 *   regression-run-now-btn        — trigger manual run
 *   regression-view-results-btn   — expand full results (inline toggle)
 *   regression-file-bugs-btn      — file P0 bugs for failures
 *   regression-status-running     — running state indicator
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getLatestRegressionRun,
  triggerRegressionRun,
  subscribeToRegressionRun,
} from '@/api/projectHealth';
import type { RegressionRun, RegressionTestResult } from '@/types/db';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (!ms) return '';
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const rem  = secs % 60;
  return mins > 0 ? `${mins}m ${rem}s` : `${secs}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month:   'short',
    day:     'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
    hour12:  false,
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function RunningState({ onRefresh: _onRefresh }: { onRefresh: () => void }) {
  return (
    <div
      data-testid="regression-status-running"
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         10,
        padding:     '14px 0',
        color:       '#475569',
        fontSize:    13,
      }}
    >
      <div style={{
        width:       18,
        height:      18,
        border:      '2px solid #E2E8F0',
        borderTop:   '2px solid #4F46E5',
        borderRadius:'50%',
        animation:   'spin 0.8s linear infinite',
        flexShrink:  0,
      }} />
      <span>Running full regression suite…</span>
    </div>
  );
}

interface FailedTestRowProps {
  test: RegressionTestResult;
}

function FailedTestRow({ test }: FailedTestRowProps) {
  return (
    <div style={{
      display:       'flex',
      alignItems:    'flex-start',
      gap:           8,
      padding:       '6px 0',
      borderBottom:  '1px solid #FEF2F2',
    }}>
      <span style={{ fontSize: 13, flexShrink: 0 }}>❌</span>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
          {test.test_name}
        </p>
        {test.error && (
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>
            {test.error.slice(0, 120)}{test.error.length > 120 ? '…' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface RegressionCardProps {
  projectId: string;
}

export default function RegressionCard({ projectId }: RegressionCardProps) {
  const [run,          setRun]          = useState<RegressionRun | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [triggering,   setTriggering]   = useState(false);
  const [showAllTests, setShowAllTests] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getLatestRegressionRun(projectId);
      setRun(r);
    } catch (err) {
      console.error('Regression load error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Subscribe while run is in progress
  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const unsub = subscribeToRegressionRun(run.id, updatedRun => {
      setRun(updatedRun);
    });
    return unsub;
  }, [run?.id, run?.status]);

  async function handleRunNow() {
    setTriggering(true);
    setError(null);
    try {
      const { run_id } = await triggerRegressionRun(projectId);
      // Insert a synthetic running-state run while we wait for realtime
      setRun(prev => ({
        ...(prev ?? {
          id:             run_id,
          project_id:     projectId,
          triggered_by:   'manual',
          feature_id:     null,
          pass_count:     0,
          fail_count:     0,
          duration_ms:    null,
          production_url: null,
          results:        null,
          started_at:     new Date().toISOString(),
          completed_at:   null,
        }),
        id:     run_id,
        status: 'running',
      } as RegressionRun));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to start regression'));
    } finally {
      setTriggering(false);
    }
  }

  const failedTests = run?.results?.tests.filter(t => t.status === 'failed') ?? [];
  const visibleFailed = showAllTests ? failedTests : failedTests.slice(0, 3);

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        data-testid="regression-card"
        style={{
          border:          '1px solid var(--color-border)',
          borderRadius:    12,
          backgroundColor: 'var(--color-surface)',
          padding:         '16px 20px',
          marginBottom:    20,
        }}
      >
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   12,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
              Regression Tests
            </h3>
            {run?.completed_at && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                Last run {formatDate(run.completed_at)}
              </p>
            )}
          </div>

          <button
            data-testid="regression-run-now-btn"
            onClick={handleRunNow}
            disabled={triggering || run?.status === 'running'}
            style={{
              padding:         '6px 14px',
              borderRadius:    8,
              border:          '1px solid #CBD5E1',
              backgroundColor: triggering || run?.status === 'running' ? '#F1F5F9' : '#fff',
              fontSize:        13,
              fontWeight:      600,
              color:           '#475569',
              cursor:          triggering || run?.status === 'running' ? 'not-allowed' : 'pointer',
            }}
          >
            {triggering ? 'Starting…' : 'Run now'}
          </button>
        </div>

        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>{error}</p>
        )}

        {/* Body */}
        {loading && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
            Loading…
          </p>
        )}

        {!loading && !run && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
            No regression runs yet. Click "Run now" to run the full test suite.
          </p>
        )}

        {!loading && run?.status === 'running' && (
          <RunningState onRefresh={load} />
        )}

        {!loading && run && run.status !== 'running' && (
          <>
            {/* Summary row */}
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          16,
              padding:      '12px 0',
              borderTop:    '1px solid var(--color-border)',
              borderBottom: failedTests.length > 0 ? '1px solid var(--color-border)' : 'none',
              marginBottom: failedTests.length > 0 ? 12 : 0,
            }}>
              {run.status === 'error' ? (
                <span style={{ fontSize: 13, color: '#ef4444' }}>
                  ⚠ Run error — check logs
                </span>
              ) : (
                <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#30d158' }}>
                    ✅ {run.pass_count} passed
                  </span>
                  {run.fail_count > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#ff3b30' }}>
                      ❌ {run.fail_count} failed
                    </span>
                  )}
                  {run.duration_ms && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      ⏱ {formatDuration(run.duration_ms)}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Failed tests list */}
            {failedTests.length > 0 && (
              <>
                {visibleFailed.map((t, i) => (
                  <FailedTestRow key={i} test={t} />
                ))}

                {failedTests.length > 3 && (
                  <button
                    data-testid="regression-view-results-btn"
                    onClick={() => setShowAllTests(v => !v)}
                    style={{
                      marginTop:  8,
                      background: 'none',
                      border:     'none',
                      fontSize:   13,
                      fontWeight: 600,
                      color:      'var(--color-accent)',
                      cursor:     'pointer',
                      padding:    0,
                    }}
                  >
                    {showAllTests
                      ? 'Show less'
                      : `View all ${failedTests.length} failures →`}
                  </button>
                )}

                {/* CTA row */}
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button
                    data-testid="regression-file-bugs-btn"
                    style={{
                      padding:         '7px 14px',
                      borderRadius:    8,
                      border:          'none',
                      backgroundColor: '#ff3b30',
                      color:           '#fff',
                      fontSize:        13,
                      fontWeight:      600,
                      cursor:          'pointer',
                    }}
                  >
                    File as P0 bugs
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
