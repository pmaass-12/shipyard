/**
 * Documents Screen — Build 030
 *
 * Supporting project documents with auto-inject toggle and usage tracking.
 * Route: /projects/:id/documents
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  getProjectDocuments,
  toggleAutoInject,
  updateDocumentName,
  deleteDocument,
  uploadDocument,
  getDocumentDownloadUrl,
  AUTO_INJECT_CATEGORIES,
  ON_DEMAND_CATEGORIES,
} from '@/api/documents';
import type { ProjectDocument, DocumentCategory } from '@/types/db';
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

type DocumentCategoryWithAll = DocumentCategory | 'all';

const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  product_brief: 'Product Brief',
  pr_faq: 'PR/FAQ',
  wireframes: 'Wireframes',
  brand_guidelines: 'Brand Guidelines',
  user_research: 'User Research',
  feature_spec: 'Feature Spec',
  reference: 'Reference',
  other: 'Other',
};

const ALL_CATEGORIES: DocumentCategory[] = [
  ...AUTO_INJECT_CATEGORIES,
  ...ON_DEMAND_CATEGORIES,
];

// ── Document Card ─────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  index,
  onToggleAutoInject,
  onDelete,
  onDownload,
}: {
  doc: ProjectDocument;
  index: number;
  onToggleAutoInject: (docId: string, autoInject: boolean) => void;
  onDelete: (docId: string) => void;
  onDownload: (filePath: string) => void;
}) {
  const [toggleLoading, setToggleLoading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(doc.name);

  const createdDate = new Date(doc.created_at);
  const dateStr = createdDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const fileSizeStr = doc.file_size_bytes
    ? doc.file_size_bytes > 1024 * 1024
      ? `${(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(doc.file_size_bytes / 1024).toFixed(1)} KB`
    : '—';

  const handleToggleAutoInject = async () => {
    setToggleLoading(true);
    try {
      await toggleAutoInject(doc.id, !doc.auto_inject);
      onToggleAutoInject(doc.id, !doc.auto_inject);
    } catch (err) {
      console.error(err);
      alert('Failed to update auto-inject');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (newName.trim() === doc.name) {
      setRenaming(false);
      return;
    }
    try {
      await updateDocumentName(doc.id, newName.trim());
      setRenaming(false);
    } catch (err) {
      console.error(err);
      alert('Failed to rename document');
      setNewName(doc.name);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await deleteDocument(doc.id);
      onDelete(doc.id);
    } catch (err) {
      console.error(err);
      alert('Failed to delete document');
    }
  };

  return (
    <div
      data-testid={`doc-card-${index}`}
      style={{
        backgroundColor: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 24, flexShrink: 0 }}>📄</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: `1px solid ${T.accent}`,
                backgroundColor: T.surface2,
                color: T.text,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'inherit',
                marginBottom: 8,
              }}
            />
          ) : (
            <div
              data-testid={`doc-name-${index}`}
              onClick={() => setRenaming(true)}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: T.text,
                marginBottom: 8,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              {doc.name}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span
              data-testid={`doc-category-badge-${index}`}
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 4,
                backgroundColor: T.surface2,
                color: T.text2,
              }}
            >
              {DOCUMENT_CATEGORY_LABELS[doc.category]}
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
          </div>

          {/* Auto-inject toggle */}
          <div style={{ marginBottom: 10 }}>
            <button
              data-testid={`doc-auto-inject-toggle-${index}`}
              onClick={handleToggleAutoInject}
              disabled={toggleLoading}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${doc.auto_inject ? T.green : T.border}`,
                backgroundColor: doc.auto_inject
                  ? 'rgba(48, 209, 88, 0.15)'
                  : 'transparent',
                color: doc.auto_inject ? T.green : T.text2,
                cursor: toggleLoading ? 'not-allowed' : 'pointer',
                fontSize: 11,
                fontWeight: 600,
                opacity: toggleLoading ? 0.6 : 1,
              }}
            >
              {doc.auto_inject ? '✓ Auto-inject' : 'Manual'}
            </button>
          </div>

          {/* Generation count */}
          <div
            data-testid={`doc-generation-count-${index}`}
            style={{
              fontSize: 12,
              color: T.text2,
            }}
          >
            Used {doc.generation_count} time{doc.generation_count !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            data-testid={`doc-download-btn-${index}`}
            onClick={() => onDownload(doc.file_path)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              backgroundColor: 'transparent',
              color: T.accent,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Download
          </button>

          <button
            data-testid={`doc-delete-btn-${index}`}
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
  onUploadComplete: (doc: ProjectDocument) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('product_brief');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  void supabase.auth.getUser(); // auth check — result unused

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const doc = await uploadDocument(
        projectId,
        file,
        name.trim(),
        category,
        userData.user.id
      );
      onUploadComplete(doc);
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
          maxWidth: 420,
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
              Name
            </label>
            <input
              data-testid="upload-form-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Product Requirements"
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
              Category
            </label>
            <select
              data-testid="upload-form-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
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
              <optgroup label="Auto-included in context">
                {AUTO_INJECT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {DOCUMENT_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Reference (manual)">
                {ON_DEMAND_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {DOCUMENT_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </optgroup>
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
              data-testid="upload-form-submit-btn"
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

export default function DocumentsScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  if (!projectId) return <div>Project not found</div>;

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<DocumentCategoryWithAll>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectDocuments(projectId);
      setDocuments(data);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, 'Failed to load documents'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocs =
    filterCategory === 'all'
      ? documents
      : documents.filter((d) => d.category === filterCategory);

  const handleToggleAutoInject = (docId: string, autoInject: boolean) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, auto_inject: autoInject } : d))
    );
  };

  const handleDelete = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleDownload = async (filePath: string) => {
    try {
      const url = await getDocumentDownloadUrl(filePath);
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
      alert('Failed to download document');
    }
  };

  const handleUploadComplete = (newDoc: ProjectDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);
  };

  const docCount = documents.length;

  return (
    <div
      data-testid="documents-screen"
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
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Supporting Documents
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: T.text2 }}>
            {docCount} document{docCount !== 1 ? 's' : ''} total
          </p>
        </div>

        <button
          data-testid="upload-doc-btn"
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

      {/* Filter tabs */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 8 }}>
          Filter by category
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            data-testid="filter-all"
            onClick={() => setFilterCategory('all')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${filterCategory === 'all' ? T.accent : T.border}`,
              backgroundColor:
                filterCategory === 'all'
                  ? 'rgba(10, 132, 255, 0.15)'
                  : 'transparent',
              color: filterCategory === 'all' ? T.accent : T.text,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            All
          </button>

          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              data-testid={`filter-${cat}`}
              onClick={() => setFilterCategory(cat)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${filterCategory === cat ? T.accent : T.border}`,
                backgroundColor:
                  filterCategory === cat
                    ? 'rgba(10, 132, 255, 0.15)'
                    : 'transparent',
                color: filterCategory === cat ? T.accent : T.text,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {DOCUMENT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: T.text2 }}>
          Loading documents...
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredDocs.length === 0 && (
        <div
          data-testid="documents-empty-state"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: T.text2,
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            No documents found
          </p>
          <p style={{ fontSize: 13, marginBottom: 16 }}>
            {filterCategory !== 'all'
              ? 'Try a different category'
              : 'Upload documents to help Claude generate better features'}
          </p>
          <button
            onClick={() => setShowUploadDialog(true)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${T.accent}`,
              backgroundColor: 'rgba(10, 132, 255, 0.1)',
              color: T.accent,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Upload your first document
          </button>
        </div>
      )}

      {/* Documents list */}
      {!loading && filteredDocs.length > 0 && (
        <div data-testid="documents-list">
          {filteredDocs.map((doc, index) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              index={index}
              onToggleAutoInject={handleToggleAutoInject}
              onDelete={handleDelete}
              onDownload={handleDownload}
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
