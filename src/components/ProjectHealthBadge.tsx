/**
 * ProjectHealthBadge — Build 042
 *
 * Compact score badge shown on the Project Hub header row.
 * - Green ≥ 90, amber 70–89, red < 70
 * - Tooltip shows "Last computed Xm ago"
 * - Reactively updates via subscribeToHealthScore()
 * - Shows "--/100" neutral state before first score is computed
 *
 * data-testid inventory:
 *   project-health-badge          — outer clickable element
 *   project-health-score          — numeric score text
 *   project-health-issue-count    — issue count pill (only when issues > 0)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getLatestHealthScore,
  subscribeToHealthScore,
} from '@/api/projectHealth';
import {
  deriveHealthScoreColor,
  type LatestProjectHealthScore,
  type HealthScoreColor,
} from '@/types/db';

const COLOR_HEX: Record<HealthScoreColor, string> = {
  green: '#30d158',
  amber: '#ff9f0a',
  red:   '#ff3b30',
};

function formatAge(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

interface ProjectHealthBadgeProps {
  projectId: string;
  onClick?:  () => void;  // open a detail modal / scroll to section
}

export default function ProjectHealthBadge({
  projectId,
  onClick,
}: ProjectHealthBadgeProps) {
  const [score,   setScore]   = useState<LatestProjectHealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await getLatestHealthScore(projectId);
      setScore(s);
    } catch (err) {
      console.error('Health score load error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
    const unsub = subscribeToHealthScore(projectId, load);
    return unsub;
  }, [projectId, load]);

  if (loading) {
    return (
      <div
        data-testid="project-health-badge"
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             6,
          padding:         '5px 12px',
          borderRadius:    20,
          border:          '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
          fontSize:        13,
          fontWeight:      600,
          color:           '#94A3B8',
        }}
      >
        ❤️ --/100
      </div>
    );
  }

  if (!score) {
    return (
      <button
        data-testid="project-health-badge"
        onClick={onClick}
        title="No health score yet. Score is computed automatically after your first regression run."
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             6,
          padding:         '5px 12px',
          borderRadius:    20,
          border:          '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
          fontSize:        13,
          fontWeight:      600,
          color:           '#94A3B8',
          cursor:          onClick ? 'pointer' : 'default',
        }}
      >
        ❤️{' '}
        <span data-testid="project-health-score">--/100</span>
      </button>
    );
  }

  const color    = deriveHealthScoreColor(score.score);
  const hex      = COLOR_HEX[color];
  const issueCount = score.issues.length;

  return (
    <button
      data-testid="project-health-badge"
      onClick={onClick}
      title={`Project Health · Last computed ${formatAge(score.computed_at)}`}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             6,
        padding:         '5px 12px',
        borderRadius:    20,
        border:          `1px solid ${hex}44`,
        backgroundColor: `${hex}15`,
        fontSize:        13,
        fontWeight:      700,
        color:           hex,
        cursor:          onClick ? 'pointer' : 'default',
        transition:      'background-color 0.15s',
      }}
    >
      <span style={{ fontSize: 14 }}>❤️</span>
      <span data-testid="project-health-score">{score.score}/100</span>

      {issueCount > 0 && (
        <span
          data-testid="project-health-issue-count"
          style={{
            fontSize:        11,
            padding:         '1px 6px',
            borderRadius:    10,
            backgroundColor: hex,
            color:           '#fff',
            fontWeight:      700,
          }}
        >
          {issueCount} issue{issueCount !== 1 ? 's' : ''}
        </span>
      )}
    </button>
  );
}
