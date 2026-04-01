/**
 * HealthReportCard — Build 042
 *
 * Morgan's project health report card — same visual treatment as DailyBriefingCard.
 * - Empty state: Morgan avatar + "Get Health Report" button
 * - Loaded state: collapsible card with markdown report, age label, [Refresh] button
 * - Slate-600 left border (Morgan's color identity)
 * - Past reports accessible via "View past reports" link (inline expand)
 *
 * data-testid inventory:
 *   health-report-card            — outer card
 *   get-health-report-btn         — generate first/new report
 *   refresh-health-report-btn     — regenerate report
 *   toggle-health-report-btn      — expand/collapse
 *   health-report-content         — report markdown area
 *   health-report-history-toggle  — "View past reports" link
 */

import { useEffect, useState, useCallback } from 'react';
import TeamAvatar from '@/components/TeamAvatar';
import {
  getLatestHealthReport,
  getHealthReportHistory,
  generateHealthReport,
} from '@/api/projectHealth';
import type { ProjectHealthReport } from '@/types/db';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

const MORGAN_COLOR = '#475569'; // slate-600

function formatAge(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Props ──────────────────────────────────────────────────────────────────

interface HealthReportCardProps {
  projectId: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function HealthReportCard({ projectId }: HealthReportCardProps) {
  const [report,       setReport]       = useState<ProjectHealthReport | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [generating,   setGenerating]   = useState(false);
  const [collapsed,    setCollapsed]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [showHistory,  setShowHistory]  = useState(false);
  const [history,      setHistory]      = useState<Omit<ProjectHealthReport, 'content'>[]>([]);
  const [loadingHist,  setLoadingHist]  = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getLatestHealthReport(projectId);
      setReport(r);
    } catch (err) {
      console.error('Health report load error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const r = await generateHealthReport(projectId);
      setReport(r);
      setCollapsed(false);
    } catch (err) {
      setError(extractErrorMessage(err, 'Generation failed'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleShowHistory() {
    if (!showHistory) {
      setLoadingHist(true);
      try {
        const h = await getHealthReportHistory(projectId);
        setHistory(h);
      } catch {
        // silently fail
      } finally {
        setLoadingHist(false);
      }
    }
    setShowHistory(v => !v);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        data-testid="health-report-card"
        style={{
          borderLeft:      `3px solid ${MORGAN_COLOR}`,
          borderRadius:    10,
          border:          '1px solid var(--color-border)',
          padding:         '16px 20px',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#E2E8F0' }} />
          <div style={{ width: 180, height: 14, borderRadius: 4, backgroundColor: '#E2E8F0' }} />
        </div>
      </div>
    );
  }

  // ── Empty state (no report yet) ──────────────────────────────────────────
  if (!report) {
    return (
      <div
        data-testid="health-report-card"
        style={{
          borderLeft:      `3px solid ${MORGAN_COLOR}`,
          borderRadius:    10,
          border:          '1px solid var(--color-border)',
          padding:         '20px',
          backgroundColor: 'var(--color-surface)',
          display:         'flex',
          alignItems:      'center',
          gap:             14,
        }}
      >
        <TeamAvatar member="morgan" size="md" />
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
            Project Health Report
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            I'll review your project health scores and give you a prioritized action list.
          </p>
          {error && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>{error}</p>
          )}
        </div>
        <button
          data-testid="get-health-report-btn"
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding:         '8px 16px',
            backgroundColor: generating ? '#E2E8F0' : MORGAN_COLOR,
            color:           generating ? '#94A3B8' : '#fff',
            border:          'none',
            borderRadius:    8,
            fontSize:        13,
            fontWeight:      600,
            cursor:          generating ? 'wait' : 'pointer',
            flexShrink:      0,
          }}
        >
          {generating ? 'Generating…' : 'Get Health Report'}
        </button>
      </div>
    );
  }

  // ── Loaded state ─────────────────────────────────────────────────────────
  return (
    <div
      data-testid="health-report-card"
      style={{
        borderLeft:      `3px solid ${MORGAN_COLOR}`,
        borderRadius:    10,
        border:          '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        overflow:        'hidden',
      }}
    >
      {/* Collapsible header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '14px 20px',
        cursor:         'pointer',
        borderBottom:   collapsed ? 'none' : '1px solid var(--color-border)',
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}
          onClick={() => setCollapsed(v => !v)}
        >
          <TeamAvatar member="morgan" size="sm" />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
              Project Health Report
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)' }}>
              {formatAge(report.generated_at)}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {error && (
            <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
          )}
          <button
            data-testid="refresh-health-report-btn"
            onClick={e => { e.stopPropagation(); handleGenerate(); }}
            disabled={generating}
            title="Refresh health report"
            style={{
              background:   'none',
              border:       '1px solid var(--color-border)',
              borderRadius: 6,
              padding:      '3px 8px',
              cursor:       generating ? 'wait' : 'pointer',
              fontSize:     12,
              color:        'var(--color-text-muted)',
            }}
          >
            {generating ? '…' : '↻ Refresh'}
          </button>

          <button
            data-testid="toggle-health-report-btn"
            onClick={() => setCollapsed(v => !v)}
            style={{
              background:   'none',
              border:       'none',
              cursor:       'pointer',
              fontSize:     16,
              color:        'var(--color-text-muted)',
              padding:      '2px 4px',
              lineHeight:   1,
            }}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        </div>
      </div>

      {/* Report content */}
      {!collapsed && (
        <div>
          <div
            data-testid="health-report-content"
            style={{
              padding:    '16px 20px',
              fontSize:   13,
              lineHeight: 1.65,
              color:      'var(--color-text)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
            }}
          >
            {report.content}
          </div>

          {/* Past reports footer */}
          <div style={{
            padding:      '10px 20px',
            borderTop:    '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
          }}>
            <button
              data-testid="health-report-history-toggle"
              onClick={handleShowHistory}
              style={{
                background:   'none',
                border:       'none',
                fontSize:     12,
                color:        'var(--color-accent)',
                cursor:       'pointer',
                fontWeight:   600,
                padding:      0,
              }}
            >
              {showHistory ? 'Hide past reports ▴' : 'View past reports ▾'}
            </button>

            {showHistory && (
              <div style={{ marginTop: 8 }}>
                {loadingHist && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                    Loading…
                  </p>
                )}
                {!loadingHist && history.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                    No past reports.
                  </p>
                )}
                {history.map(h => (
                  <div key={h.id} style={{
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'space-between',
                    padding:      '5px 0',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize:     12,
                    color:        'var(--color-text-muted)',
                  }}>
                    <span>{formatDate(h.generated_at)}</span>
                    <span style={{ fontSize: 11 }}>report #{h.id.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
