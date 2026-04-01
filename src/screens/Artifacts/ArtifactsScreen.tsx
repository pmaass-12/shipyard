/**
 * Artifacts Screen — Build 026
 *
 * Project artifacts with version history and download support.
 * Grouped by type with collapsible history.
 * Route: /projects/:id/artifacts
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCurrentArtifacts,
  getArtifactHistory,
  getArtifactDownloadUrl,
  deleteArtifact,
  uploadArtifact,
} from '@/api/artifacts';
import type { Artifact, ArtifactType } from '@/types/db';
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

type ArtifactTypeWithAll = ArtifactType | 'all';

const ARTIFACT_TYPES: ArtifactType[] = [
  'architecture',
  'spec',
  'migration',
  'contract',
  'generated_code',
  'upload',
];

const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  architecture: 'Architecture',
  spec: 'Specs',
  migration: 'Migrations',
  contract: 'Contracts',
  generated_code: 'Code',
  upload: 'Uploads',
};

const ARTIFACT_ICONS: Record<ArtifactType, string> = {
  architecture: '🏗',
  spec: '📋',
  migration: '🔄',
  contract: '📑',
  generated_code: '⚙️',
  upload: '📁',
};

// ── Version History Expandable ─────────────────────────────────────────────

function VersionHistory({
  artifact,
  projectId,
}: {
  artifact: Artifact;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (expanded) return;
    setLoading(true);
    try {
      const historyData = await getArtifactHistory(
        projectId,
        artifact.artifact_type,
        artifact.feature_id
      );
      setHistory(historyData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, artifact.artifact_type, artifact.feature_id, expanded]);

  const handleToggle = () => {
    setExpanded(!expanded);
    if (!expanded) loadHistory();
  };

  return (
    <div>
      <button
        data-testid={`artifact-history-toggle-${artifact.id}`}
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 0',
          border: 'none',
          background: 'none',
          color: T.accent,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <span style={{ transform: expanded ? 'rotate(90deg)' : '', display: 'inline-block' }}>
          ▶
        </span>
        {expanded ? 'Hide' : 'Show'} version history
      </button>

      {expanded && (
        <div style={{ marginTop: 8, paddingLeft: 16, borderLeft: `1px solid ${T.border}` }}>
          {loading && <div style={{ color: T.text2, fontSize: 12 }}>Loading...</div>}
          {!loading && history.length === 0 && (
            <div style={{ color: T.text2, fontSize: 12 }}>No previous versions</div>
          )}
          {!loading &&
            history.map((v, idx) => {
              const date = new Date(v.created_at);
              const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: '2-digit',
              });
              return (
                <div
                  key={v.id}
                  style={{
                    fontSize: 12,
                    padding: '6px 0',
                    color: T.text2,
                    borderBottom: idx < history.length - 1 ? `1px solid ${T.border}` : 'none',
                  }}
                >
                  v{v.version} — {dateStr}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ── Artifact Card ──────────────────────────────────────────────────────────

function ArtifactCard({
  artifact,
  index,
  projectId,
  onDelete,
}: {
  artifact: Artifact;
  index: number;
  projectId: string;
  onDelete: (artifactId: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await getArtifactDownloadUrl(artifact.storage_path);
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
      alert('Failed to download artifact');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this artifact?')) return;
    try {
      await deleteArtifact(artifact.id);
      onDelete(artifact.id);
    } catch (err) {
      console.error(err);
      alert('Failed to delete artifact');
    }
  };

  const createdDate = new Date(artifact.created_at);
  const dateStr = createdDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const fileSizeStr = artifact.file_size_bytes
    ? artifact.file_size_bytes > 1024 * 1024
      ? `${(artifact.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(artifact.file_size_bytes / 1024).toFixed(1)} KB`
    : '—';

  return (
    <div
      data-testid={`artifact-card-${index}`}
      style={{
        backgroundColor: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            fontSize: 24,
            flexShrink: 0,
          }}
        >
          {ARTIFACT_ICONS[artifact.artifact_type]}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            data-testid={`artifact-filename-${index}`}
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: T.text,
              marginBottom: 4,
              wordBreak: 'break-word',
            }}
          >
            {artifact.filename}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span
              data-testid={`artifact-version-badge-${index}`}
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 4,
                backgroundColor: T.surface2,
                color: T.text2,
              }}
            >
              v{artifact.version}
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
              {fileSizeStr}
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

            {artifact.feature_id && (
              <span
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 4,
                  backgroundColor: T.surface2,
                  color: T.text2,
                }}
              >
                Feature-scoped
              </span>
            )}
          </div>

          <VersionHistory artifact={artifact} projectId={projectId} />
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            data-testid={`artifact-download-btn-${index}`}
            onClick={handleDownload}
            disabled={downloading}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: 'transparent',
              color: T.accent,
              cursor: downloading ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
              opacity: downloading ? 0.6 : 1,
            }}
          >
            Download
          </button>

          <button
            onClick={handleDelete}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: 'transparent',
              color: T.red,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Dialog ──────────────────────────────────────────────────────────

function UploadDialog({
  projectId,
  onClose,
  onUploadComplete,
}: {
  projectId: string;
  onClose: () => void;
  onUploadComplete: (artifact: Artifact) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a filename');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const artifact = await uploadArtifact(projectId, 'upload', null, file, name.trim());
      onUploadComplete(artifact);
      onClose();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, 'Upload failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: T.surface,
          borderRadius: 12,
          padding: 20,
          maxWidth: 400,
          width: '90%',
          border: `1px solid ${T.border}`,
        }}
      >
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: 16,
            fontWeight: 600,
            color: T.text,
          }}
        >
          Upload Document
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
              File
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{
                padding: '10px',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                backgroundColor: T.surface2,
                color: T.text,
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
              Filename
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., architecture.pdf"
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                backgroundColor: T.surface2,
                color: T.text,
                fontSize: 13,
              }}
            />
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

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
              {loading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function ArtifactsScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  if (!projectId) return <div>Project not found</div>;

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ArtifactTypeWithAll>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const loadArtifacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCurrentArtifacts(
        projectId,
        filterType === 'all' ? undefined : filterType
      );
      setArtifacts(data);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, 'Failed to load artifacts'));
    } finally {
      setLoading(false);
    }
  }, [projectId, filterType]);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  const handleUploadComplete = (newArtifact: Artifact) => {
    setArtifacts((prev) => [newArtifact, ...prev]);
  };

  const handleDelete = (artifactId: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== artifactId));
  };

  return (
    <div
      data-testid="artifacts-screen"
      style={{
        backgroundColor: T.bg,
        minHeight: '100vh',
        color: T.text,
        padding: '20px',
      }}
    >
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
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          Artifacts
        </h2>
        <button
          data-testid="upload-artifact-btn"
          onClick={() => setShowUploadDialog(true)}
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
          + Upload
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          data-testid="filter-all"
          onClick={() => setFilterType('all')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${filterType === 'all' ? T.accent : T.border}`,
            backgroundColor:
              filterType === 'all' ? 'rgba(10, 132, 255, 0.15)' : 'transparent',
            color: filterType === 'all' ? T.accent : T.text,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          All
        </button>

        {ARTIFACT_TYPES.map((type) => (
          <button
            key={type}
            data-testid={`filter-${type}`}
            onClick={() => setFilterType(type)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${filterType === type ? T.accent : T.border}`,
              backgroundColor:
                filterType === type ? 'rgba(10, 132, 255, 0.15)' : 'transparent',
              color: filterType === type ? T.accent : T.text,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {ARTIFACT_LABELS[type]}
          </button>
        ))}
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
          Loading artifacts...
        </div>
      )}

      {/* Empty state */}
      {!loading && artifacts.length === 0 && (
        <div
          data-testid="artifacts-empty-state"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: T.text2,
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            No artifacts found
          </p>
          <p style={{ fontSize: 13 }}>
            {filterType !== 'all' ? 'Try a different filter' : 'Upload your first artifact'}
          </p>
        </div>
      )}

      {/* Artifacts list */}
      {!loading && artifacts.length > 0 && (
        <div data-testid="artifacts-list">
          {artifacts.map((artifact, index) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              index={index}
              projectId={projectId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Upload dialog */}
      {showUploadDialog && (
        <UploadDialog
          projectId={projectId}
          onClose={() => setShowUploadDialog(false)}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}
