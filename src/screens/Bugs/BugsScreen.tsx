/**
 * Bugs Screen — Build 025
 *
 * Global bugs view with severity + status filtering.
 * P0 banner when open P0 bugs exist.
 * "New Bug" slide-in form.
 * Route: /projects/:id/bugs
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getProjectBugs,
  getP0OpenCount,
  createBug,
  triageBug,
  deleteBug,
} from '@/api/bugs';
import type { BugWithContext, BugSeverity, BugStatus } from '@/types/db';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

const T = {
  bg: '#0f0f10',
  surface: '#1a1a1c',
  surface2: '#222224',
  surface3: '#2c2c2e',
  border: '#2c2c2e',
  text: '#e8e8ea',
  text2: '#8e8e93',
  accent: '#0a84ff',
  green: '#30d158',
  red: '#ff453a',
  orange: '#ff9f0a',
};

function getSeverityColor(severity: BugSeverity): {
  bg: string; text: string; label: string;
} {
  const map: Record<BugSeverity, any> = {
    p0: { bg: '#fee2e2', text: '#dc2626', label: 'P0' },
    p1: { bg: '#ffedd5', text: '#c2410c', label: 'P1' },
    p2: { bg: '#dbeafe', text: '#0c4a6e', label: 'P2' },
    p3: { bg: '#f3f4f6', text: '#4b5563', label: 'P3' },
  };
  return map[severity];
}

function getStatusLabel(status: BugStatus): string {
  const map: Record<BugStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    wontfix: "Won't Fix",
  };
  return map[status];
}

// ── New Bug Form ───────────────────────────────────────────────────────────

function NewBugForm({
  projectId,
  onBugCreated: _onBugCreated,
  onClose,
}: {
  projectId: string;
  onBugCreated: (bug: BugWithContext) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugSeverity>('p1');
  const [screenId, setScreenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createBug({
        project_id: projectId,
        screen_id: screenId,
        feature_id: null,
        severity,
        status: 'open',
        source: 'manual',
        title: title.trim(),
        description: description.trim() || null,
        screenshot_url: null,
        annotations: null,
      });
      setTitle('');
      setDescription('');
      setSeverity('p1');
      setScreenId(null);
      onClose();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, 'Failed to create bug'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: 380,
        height: '100vh',
        backgroundColor: T.surface,
        borderLeft: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          padding: '20px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: T.text }}>
          New Bug
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: T.text2,
            cursor: 'pointer',
            fontSize: 20,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: 20,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
            Title
          </label>
          <input
            data-testid="new-bug-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the bug"
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              backgroundColor: T.surface2,
              color: T.text,
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details (optional)"
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              backgroundColor: T.surface2,
              color: T.text,
              fontSize: 13,
              fontFamily: 'inherit',
              minHeight: 80,
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
            Severity
          </label>
          <select
            data-testid="new-bug-severity-select"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as BugSeverity)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              backgroundColor: T.surface2,
              color: T.text,
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <option value="p0">P0 - Critical</option>
            <option value="p1">P1 - High</option>
            <option value="p2">P2 - Medium</option>
            <option value="p3">P3 - Low</option>
          </select>
        </div>

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 6,
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              color: T.red,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              backgroundColor: 'transparent',
              color: T.text,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            data-testid="new-bug-submit-btn"
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: T.accent,
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Create Bug'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Bug Card ───────────────────────────────────────────────────────────────

function BugCard({
  bug,
  index,
  onStatusChange,
  onDelete,
}: {
  bug: BugWithContext;
  index: number;
  onStatusChange: (bugId: string, status: BugStatus) => void;
  onDelete: (bugId: string) => void;
}) {
  const [statusLoading, setStatusLoading] = useState(false);
  const severityColor = getSeverityColor(bug.severity);
  const createdDate = new Date(bug.created_at);
  const dateStr = createdDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const handleStatusChange = async (newStatus: BugStatus) => {
    setStatusLoading(true);
    try {
      await triageBug(bug.id, { status: newStatus });
      onStatusChange(bug.id, newStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        'Are you sure you want to delete this bug? This cannot be undone.'
      )
    ) {
      return;
    }
    try {
      await deleteBug(bug.id);
      onDelete(bug.id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      data-testid={`bug-card-${index}`}
      style={{
        backgroundColor: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {/* Severity badge */}
      <div
        data-testid={`bug-severity-${index}`}
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 6,
          backgroundColor: severityColor.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: severityColor.text,
        }}
      >
        {severityColor.label}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          data-testid={`bug-title-${index}`}
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: T.text,
            marginBottom: 8,
            lineHeight: 1.4,
          }}
        >
          {bug.title}
        </div>

        {bug.description && (
          <div
            style={{
              fontSize: 13,
              color: T.text2,
              marginBottom: 10,
              lineHeight: 1.4,
            }}
          >
            {bug.description}
          </div>
        )}

        {/* Context badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {bug.screen_name && (
            <span
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 4,
                backgroundColor: T.surface2,
                color: T.text2,
              }}
            >
              Screen: {bug.screen_name}
            </span>
          )}
          {bug.feature_name && (
            <span
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 4,
                backgroundColor: T.surface2,
                color: T.text2,
              }}
            >
              Feature: {bug.feature_name}
            </span>
          )}
          <span
            data-testid={`bug-source-chip-${index}`}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor:
                bug.source === 'widget'
                  ? 'rgba(48, 209, 88, 0.15)'
                  : 'rgba(200, 200, 200, 0.1)',
              color: bug.source === 'widget' ? T.green : T.text2,
            }}
          >
            {bug.source === 'widget' ? 'Widget' : 'Manual'}
          </span>
          <span
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor: T.surface2,
              color: T.text2,
            }}
          >
            {dateStr}
          </span>
        </div>

        {/* Status dropdown & delete */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            data-testid={`bug-status-dropdown-${index}`}
            value={bug.status}
            onChange={(e) => handleStatusChange(e.target.value as BugStatus)}
            disabled={statusLoading}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: T.surface2,
              color: T.text,
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: statusLoading ? 'not-allowed' : 'pointer',
              opacity: statusLoading ? 0.6 : 1,
            }}
          >
            <option value="open">{getStatusLabel('open')}</option>
            <option value="in_progress">{getStatusLabel('in_progress')}</option>
            <option value="resolved">{getStatusLabel('resolved')}</option>
            <option value="wontfix">{getStatusLabel('wontfix')}</option>
          </select>

          <button
            onClick={handleDelete}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: 'transparent',
              color: T.red,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function BugsScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  if (!projectId) return <div>Project not found</div>;

  const [bugs, setBugs] = useState<BugWithContext[]>([]);
  const [p0Count, setP0Count] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BugStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<BugSeverity | 'all'>('all');
  const [showNewBugForm, setShowNewBugForm] = useState(false);

  const loadBugs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bugsData, p0CountData] = await Promise.all([
        getProjectBugs(projectId, {
          status: statusFilter === 'all' ? undefined : statusFilter,
          severity: severityFilter === 'all' ? undefined : severityFilter,
        }),
        getP0OpenCount(projectId),
      ]);
      setBugs(bugsData);
      setP0Count(p0CountData);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, 'Failed to load bugs'));
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter, severityFilter]);

  useEffect(() => {
    loadBugs();
  }, [loadBugs]);

  const handleBugCreated = async (newBug: BugWithContext) => {
    setBugs((prev) => [newBug, ...prev]);
    if (newBug.severity === 'p0' && newBug.status === 'open') {
      setP0Count((prev) => prev + 1);
    }
  };

  const handleStatusChange = (bugId: string, newStatus: BugStatus) => {
    setBugs((prev) =>
      prev.map((b) =>
        b.id === bugId ? { ...b, status: newStatus } : b
      )
    );
  };

  const handleDelete = (bugId: string) => {
    setBugs((prev) => prev.filter((b) => b.id !== bugId));
  };

  const statusLabels: Record<BugStatus | 'all', string> = {
    all: 'All',
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    wontfix: "Won't Fix",
  };

  return (
    <div
      data-testid="bugs-screen"
      style={{
        backgroundColor: T.bg,
        minHeight: '100vh',
        color: T.text,
        padding: '20px',
      }}
    >
      {/* P0 Banner */}
      {p0Count > 0 && (
        <div
          data-testid="p0-banner"
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.15)',
            border: `1px solid ${T.red}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 14,
            color: T.red,
            fontWeight: 500,
          }}
        >
          ⚠️ {p0Count} open P0 bug{p0Count !== 1 ? 's' : ''} require immediate attention
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Bugs
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: T.text2 }}>
            {bugs.length} bug{bugs.length !== 1 ? 's' : ''} total
          </p>
        </div>

        <button
          data-testid="new-bug-btn"
          onClick={() => setShowNewBugForm(true)}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: T.accent,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          + New Bug
        </button>
      </div>

      {/* P0 Count Badge */}
      {p0Count > 0 && (
        <div
          data-testid="p0-count-badge"
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 6,
            backgroundColor: T.red,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          {p0Count} P0 Open
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 8 }}>
          Status
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {(['all', 'open', 'in_progress', 'resolved', 'wontfix'] as const).map(
            (status) => (
              <button
                key={status}
                data-testid={`filter-${status}`}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${statusFilter === status ? T.accent : T.border}`,
                  backgroundColor:
                    statusFilter === status
                      ? 'rgba(10, 132, 255, 0.15)'
                      : 'transparent',
                  color: statusFilter === status ? T.accent : T.text,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {statusLabels[status]}
              </button>
            )
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 8 }}>
          Severity
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'p0', 'p1', 'p2', 'p3'] as const).map((severity) => (
            <button
              key={severity}
              data-testid={`severity-filter-${severity}`}
              onClick={() => setSeverityFilter(severity)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${severityFilter === severity ? T.accent : T.border}`,
                backgroundColor:
                  severityFilter === severity
                    ? 'rgba(10, 132, 255, 0.15)'
                    : 'transparent',
                color: severityFilter === severity ? T.accent : T.text,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {severity === 'all' ? 'All' : severity.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            color: T.red,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: T.text2 }}>
          Loading bugs...
        </div>
      )}

      {/* Empty state */}
      {!loading && bugs.length === 0 && (
        <div
          data-testid="bugs-empty-state"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: T.text2,
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            No bugs found
          </p>
          <p style={{ fontSize: 13 }}>
            {statusFilter !== 'all' || severityFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create a new bug to track issues in your app'}
          </p>
        </div>
      )}

      {/* Bug list */}
      {!loading && bugs.length > 0 && (
        <div data-testid="bugs-list">
          {bugs.map((bug, index) => (
            <BugCard
              key={bug.id}
              bug={bug}
              index={index}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* New Bug Form Overlay */}
      {showNewBugForm && (
        <>
          <div
            onClick={() => setShowNewBugForm(false)}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              zIndex: 999,
            }}
          />
          <NewBugForm
            data-testid="new-bug-form"
            projectId={projectId}
            onBugCreated={handleBugCreated}
            onClose={() => setShowNewBugForm(false)}
          />
        </>
      )}
    </div>
  );
}
