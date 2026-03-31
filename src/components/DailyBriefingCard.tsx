/**
 * DailyBriefingCard — Build 040
 *
 * Morgan's daily project briefing card. Lives at the top of Project Hub.
 * - Null state: Morgan avatar + "I'm ready to brief you" + [Get briefing] button
 * - Loaded state: briefing text + [Refresh] + collapsible
 * - Generating state: shimmer + realtime subscription fires on completion
 *
 * data-testid: daily-briefing-card
 */

import { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import {
  getProjectBriefing,
  generateDailyBriefing,
  subscribeToBriefing,
} from '@/api/namedTeam';
import type { ProjectBriefing } from '@/types/db';

interface DailyBriefingCardProps {
  projectId: string;
}

export default function DailyBriefingCard({ projectId }: DailyBriefingCardProps) {
  const [briefing,     setBriefing]     = useState<ProjectBriefing | null | undefined>(undefined);
  const [generating,   setGenerating]   = useState(false);
  const [collapsed,    setCollapsed]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Load on mount
  useEffect(() => {
    getProjectBriefing(projectId)
      .then(b => {
        setBriefing(b);
        // Auto-collapse if generated > 1 hour ago (already-read heuristic)
        if (b && new Date(b.generated_at) < new Date(Date.now() - 3600 * 1000)) {
          setCollapsed(true);
        }
      })
      .catch(err => {
        console.error(err);
        setBriefing(null);
      });
  }, [projectId]);

  // Realtime: receive briefing update while generating
  useEffect(() => {
    if (!generating) return;
    const unsub = subscribeToBriefing(projectId, updated => {
      setBriefing(updated);
      setGenerating(false);
      setCollapsed(false);
    });
    return unsub;
  }, [generating, projectId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateDailyBriefing(projectId);
      setBriefing(result);
      setCollapsed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // Still loading initial state
  if (briefing === undefined) return null;

  const cardStyle: React.CSSProperties = {
    borderLeft:      '3px solid #4338CA',
    borderRadius:    10,
    border:          '1px solid var(--color-border)',
    borderLeftColor: '#4338CA',
    backgroundColor: 'var(--color-surface)',
    marginBottom:    20,
    overflow:        'hidden',
  };

  // ── Empty state ────────────────────────────────────────────────────────
  if (!briefing) {
    return (
      <div data-testid="daily-briefing-card" style={cardStyle}>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar member="reeve" size="md" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
              Reeve
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
              I'm ready to brief you on this project — whenever you're ready.
            </p>
          </div>
          <button
            data-testid="get-briefing-btn"
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding:         '7px 16px',
              borderRadius:    8,
              border:          'none',
              backgroundColor: '#4338CA',
              color:           '#fff',
              fontSize:        13,
              fontWeight:      600,
              cursor:          generating ? 'wait' : 'pointer',
              opacity:         generating ? 0.7 : 1,
              flexShrink:      0,
            }}
          >
            {generating ? 'Generating…' : 'Get briefing'}
          </button>
        </div>
        {error && (
          <p style={{ margin: 0, padding: '0 20px 14px', fontSize: 12, color: '#ef4444' }}>{error}</p>
        )}
      </div>
    );
  }

  // ── Loaded state ───────────────────────────────────────────────────────
  const generatedAgo = Math.round(
    (Date.now() - new Date(briefing.generated_at).getTime()) / 60000
  );
  const ageLabel = generatedAgo < 1
    ? 'just now'
    : generatedAgo < 60
    ? `${generatedAgo}m ago`
    : `${Math.round(generatedAgo / 60)}h ago`;

  return (
    <div data-testid="daily-briefing-card" style={cardStyle}>
      {/* Header row */}
      <div style={{
        padding:        '14px 20px',
        display:        'flex',
        alignItems:     'center',
        gap:            12,
        borderBottom:   collapsed ? 'none' : '1px solid var(--color-border)',
      }}>
        <Avatar member="reeve" size="sm" />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            Reeve's Briefing
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
            {ageLabel}
          </span>
        </div>
        <button
          data-testid="refresh-briefing-btn"
          onClick={handleGenerate}
          disabled={generating}
          title="Refresh briefing"
          style={{
            background: 'none',
            border:     'none',
            cursor:     generating ? 'wait' : 'pointer',
            color:      'var(--color-text-muted)',
            padding:    4,
            display:    'flex',
            alignItems: 'center',
          }}
        >
          <RefreshCw
            size={14}
            style={{ animation: generating ? 'spin 1s linear infinite' : 'none' }}
          />
        </button>
        <button
          data-testid="toggle-briefing-btn"
          onClick={() => setCollapsed(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', padding: 4,
            display: 'flex', alignItems: 'center',
          }}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{ padding: '14px 20px' }}>
          {generating ? (
            // Shimmer while re-generating
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[100, 80, 60].map(w => (
                <div key={w} style={{
                  height: 14, width: `${w}%`, borderRadius: 4,
                  backgroundColor: 'var(--color-border)',
                  animation: 'pulse 1.5s infinite',
                }} />
              ))}
            </div>
          ) : (
            <p
              data-testid="briefing-content"
              style={{
                margin: 0, fontSize: 14, color: 'var(--color-text)',
                lineHeight: 1.65, whiteSpace: 'pre-wrap',
              }}
            >
              {briefing.content}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
