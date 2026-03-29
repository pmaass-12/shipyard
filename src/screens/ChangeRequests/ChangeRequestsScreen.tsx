/**
 * Change Requests Screen — Build 012
 *
 * Global project view of all change requests.
 * Filter pills: All / Pending / Accepted / Rejected
 * Screen dropdown filter
 * CR cards with accordion expand, annotation pins, Accept / Reject flows
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  listChangeRequests,
  getChangeRequest,
  acceptCrWithNewFeature,
  acceptCrLinkFeature,
  rejectChangeRequest,
  searchFeaturesForScreen,
  getFeedbackTestLink,
} from '@/api/changeRequests';
import type {
  ChangeRequestSummary,
  ChangeRequest,
  CrAnnotation,
  ChangeRequestStatus,
} from '@/types/db';

// ── Status chip ────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: ChangeRequestStatus }) {
  const map: Record<ChangeRequestStatus, { bg: string; text: string; label: string }> = {
    pending:  { bg: '#fff3cd', text: '#92400e', label: 'Pending' },
    accepted: { bg: '#d1fae5', text: '#065f46', label: 'Accepted' },
    rejected: { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' },
  };
  const s = map[status];
  return (
    <span style={{
      backgroundColor: s.bg, color: s.text,
      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
    }}>
      {s.label}
    </span>
  );
}

// ── Annotation pin overlay ─────────────────────────────────────────────────

function AnnotationPins({ annotations }: { annotations: CrAnnotation[] }) {
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);
  if (!annotations.length) return null;

  return (
    <>
      {annotations.map((pin) => (
        <div
          key={pin.id}
          style={{
            position: 'absolute',
            left:     `${pin.x_pct}%`,
            top:      `${pin.y_pct}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}
          onMouseEnter={() => setHoveredPin(pin.pin_number)}
          onMouseLeave={() => setHoveredPin(null)}
        >
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            backgroundColor: '#0a84ff', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}>
            {pin.pin_number}
          </div>
          {hoveredPin === pin.pin_number && pin.note && (
            <div style={{
              position: 'absolute', bottom: '110%', left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#1a1a1c', color: '#fff',
              padding: '6px 10px', borderRadius: 6, fontSize: 12,
              whiteSpace: 'nowrap', maxWidth: 220, whiteSpace: 'normal',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              {pin.note}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ── Accept modal ───────────────────────────────────────────────────────────

function AcceptModal({
  cr,
  onClose,
  onAccepted,
}: {
  cr:         ChangeRequestSummary;
  onClose:    () => void;
  onAccepted: (featureId: string) => void;
}) {
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [featureName, setFeatureName] = useState(cr.title ?? cr.description?.slice(0, 60) ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'link' || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchFeaturesForScreen(cr.project_id, cr.screen_id, searchQuery)
      .then(setSearchResults)
      .catch(console.error);
  }, [mode, searchQuery, cr.project_id, cr.screen_id]);

  async function handleConfirm() {
    setLoading(true);
    try {
      if (mode === 'create') {
        const id = await acceptCrWithNewFeature(cr, featureName.trim());
        onAccepted(id);
      } else {
        await acceptCrLinkFeature(cr.id, selectedFeatureId);
        onAccepted(selectedFeatureId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: 12,
        padding: 24, width: 440, maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
          Accept Change Request
        </h3>

        {/* Radio options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {(['create', 'link'] as const).map((m) => (
            <label key={m} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                checked={mode === m}
                onChange={() => setMode(m)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 14 }}>
                  {m === 'create' ? 'Create new feature' : 'Link to existing feature'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {m === 'create'
                    ? 'A new feature will be created from this change request.'
                    : 'Link this change request to a feature you already have.'}
                </div>
              </div>
            </label>
          ))}
        </div>

        {mode === 'create' && (
          <input
            value={featureName}
            onChange={(e) => setFeatureName(e.target.value)}
            placeholder="Feature name"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', boxSizing: 'border-box',
            }}
          />
        )}

        {mode === 'link' && (
          <div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features…"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)', boxSizing: 'border-box',
              }}
            />
            {searchResults.length > 0 && (
              <div style={{
                border: '1px solid var(--color-border)', borderRadius: 6,
                marginTop: 4, maxHeight: 160, overflowY: 'auto',
                backgroundColor: 'var(--color-bg)',
              }}>
                {searchResults.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => { setSelectedFeatureId(f.id); setSearchQuery(f.name); setSearchResults([]); }}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', fontSize: 14,
                      color: 'var(--color-text)',
                      backgroundColor: selectedFeatureId === f.id ? 'var(--color-accent-muted)' : 'transparent',
                    }}
                  >
                    {f.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid var(--color-border)',
              backgroundColor: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (mode === 'create' ? !featureName.trim() : !selectedFeatureId)}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none',
              backgroundColor: '#30d158', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              opacity: (loading || (mode === 'create' ? !featureName.trim() : !selectedFeatureId)) ? 0.5 : 1,
            }}
          >
            {loading ? 'Accepting…' : mode === 'create' ? 'Accept & Create' : 'Accept & Link'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CR card (collapsed + expandable) ──────────────────────────────────────

function CrCard({
  cr,
  onStatusChange,
}: {
  cr:             ChangeRequestSummary;
  onStatusChange: (id: string, status: ChangeRequestStatus, featureId?: string) => void;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [detail, setDetail]             = useState<{ cr: ChangeRequest; annotations: CrAnnotation[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing]             = useState(false);

  async function handleExpand() {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const d = await getChangeRequest(cr.id);
        setDetail(d);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded((prev) => !prev);
  }

  async function handleReject() {
    setActing(true);
    try {
      await rejectChangeRequest(cr.id, rejectReason || undefined);
      onStatusChange(cr.id, 'rejected');
      setShowRejectInput(false);
    } catch (err) {
      console.error(err);
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 10,
        backgroundColor: 'var(--color-surface)', overflow: 'hidden',
        marginBottom: 12,
      }}>
        {/* Collapsed card header */}
        <div
          onClick={handleExpand}
          style={{ display: 'flex', gap: 16, padding: 16, cursor: 'pointer' }}
        >
          {/* Thumbnail */}
          {cr.screenshot_url ? (
            <img
              src={cr.screenshot_url}
              alt="Screenshot"
              style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 80, height: 60, borderRadius: 6, flexShrink: 0,
              backgroundColor: 'var(--color-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>
              📋
            </div>
          )}

          {/* Meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <StatusChip status={cr.status} />
              {cr.route && (
                <span style={{
                  fontSize: 11, padding: '2px 6px', borderRadius: 4,
                  backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)',
                  fontFamily: 'monospace',
                }}>
                  {cr.route}
                </span>
              )}
            </div>
            <p style={{
              margin: 0, fontSize: 14, color: 'var(--color-text)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {cr.title ?? cr.description ?? 'No description'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {cr.submitter_email ?? 'Anonymous'} · {new Date(cr.submitted_at).toLocaleDateString()}
            </p>
          </div>

          <div style={{ fontSize: 18, color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div style={{ borderTop: '1px solid var(--color-border)', padding: 16 }}>
            {loadingDetail && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading…</p>
            )}

            {detail && (
              <>
                {/* Description */}
                {detail.cr.description && (
                  <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-text)' }}>
                    {detail.cr.description}
                  </p>
                )}

                {/* Screenshot with annotation pins */}
                {detail.cr.screenshot_url && (
                  <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginBottom: 12 }}>
                    <img
                      src={detail.cr.screenshot_url}
                      alt="Screenshot"
                      style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }}
                    />
                    <AnnotationPins annotations={detail.annotations} />
                  </div>
                )}

                {/* Console errors (collapsed by default) */}
                {detail.cr.console_errors && detail.cr.console_errors.length > 0 && (
                  <details style={{ marginBottom: 12 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      Console errors ({detail.cr.console_errors.length})
                    </summary>
                    <div style={{
                      marginTop: 8, padding: 10, borderRadius: 6,
                      backgroundColor: 'var(--color-bg)', fontFamily: 'monospace', fontSize: 11,
                    }}>
                      {detail.cr.console_errors.map((e, i) => (
                        <div key={i} style={{ color: e.level === 'error' ? '#ff3b30' : 'var(--color-text-muted)', marginBottom: 2 }}>
                          [{e.level.toUpperCase()}] {e.message}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Action strip — only for pending */}
                {cr.status === 'pending' && (
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => setShowAcceptModal(true)}
                        style={{
                          padding: '8px 16px', borderRadius: 6, border: 'none',
                          backgroundColor: '#30d158', color: '#fff',
                          cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        }}
                      >
                        Accept →
                      </button>
                      <button
                        onClick={() => setShowRejectInput((p) => !p)}
                        style={{
                          padding: '8px 16px', borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'transparent', color: 'var(--color-text)',
                          cursor: 'pointer', fontSize: 14,
                        }}
                      >
                        Reject
                      </button>
                    </div>

                    {showRejectInput && (
                      <div style={{ marginTop: 12 }}>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection (optional)"
                          rows={2}
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
                            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                            color: 'var(--color-text)', resize: 'vertical', boxSizing: 'border-box',
                          }}
                        />
                        <button
                          onClick={handleReject}
                          disabled={acting}
                          style={{
                            marginTop: 8, padding: '8px 16px', borderRadius: 6, border: 'none',
                            backgroundColor: '#ff3b30', color: '#fff',
                            cursor: 'pointer', fontSize: 14, fontWeight: 600,
                            opacity: acting ? 0.6 : 1,
                          }}
                        >
                          {acting ? 'Rejecting…' : 'Confirm Rejection'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Accepted: show linked feature */}
                {cr.status === 'accepted' && cr.feature_id && (
                  <p style={{ margin: '12px 0 0', fontSize: 13, color: '#30d158' }}>
                    ✓ Linked to feature
                  </p>
                )}

                {/* Rejected: show reason */}
                {cr.status === 'rejected' && detail.cr.rejection_reason && (
                  <p style={{ margin: '12px 0 0', fontSize: 13, color: '#ff3b30' }}>
                    Rejected: {detail.cr.rejection_reason}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showAcceptModal && (
        <AcceptModal
          cr={cr}
          onClose={() => setShowAcceptModal(false)}
          onAccepted={(featureId) => {
            setShowAcceptModal(false);
            onStatusChange(cr.id, 'accepted', featureId);
          }}
        />
      )}
    </>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ deployUrl }: { deployUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const testLink = deployUrl ? getFeedbackTestLink(deployUrl) : null;

  function handleCopy() {
    if (!testLink) return;
    navigator.clipboard.writeText(testLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 60, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
      <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
        No change requests yet
      </h3>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 360 }}>
        Share the test link with your users to collect feedback on your deployed app.
      </p>
      {testLink && (
        <button
          onClick={handleCopy}
          style={{
            padding: '10px 20px', borderRadius: 8,
            backgroundColor: copied ? '#30d158' : 'var(--color-accent)',
            color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
          }}
        >
          {copied ? '✓ Copied!' : 'Copy test link'}
        </button>
      )}
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

type FilterTab = 'all' | ChangeRequestStatus;

export default function ChangeRequestsScreen() {
  const { id: projectId } = useParams<{ id: string }>();

  const [crs, setCrs]         = useState<ChangeRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [screenFilter, setScreenFilter] = useState<string>('all');
  const [deployUrl, setDeployUrl] = useState<string | null>(null);

  // Load project for deploy_url (empty state test link)
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('projects')
      .select('deploy_url')
      .eq('id', projectId)
      .single()
      .then(({ data }) => setDeployUrl(data?.deploy_url ?? null));
  }, [projectId]);

  const loadCrs = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const opts: { status?: ChangeRequestStatus; screenId?: string } = {};
      if (activeTab !== 'all') opts.status = activeTab;
      if (screenFilter !== 'all') opts.screenId = screenFilter;
      const data = await listChangeRequests(projectId, opts);
      setCrs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeTab, screenFilter]);

  useEffect(() => { loadCrs(); }, [loadCrs]);

  function handleStatusChange(id: string, status: ChangeRequestStatus, featureId?: string) {
    setCrs((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status, feature_id: featureId ?? c.feature_id }
          : c
      )
    );
  }

  // Unique screens for the dropdown
  const screenOptions = Array.from(
    new Map(crs.filter((c) => c.screen_id).map((c) => [c.screen_id, c.route ?? c.screen_id!]))
  );

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all',      label: `All (${crs.length})` },
    { key: 'pending',  label: `Pending (${crs.filter((c) => c.status === 'pending').length})` },
    { key: 'accepted', label: `Accepted (${crs.filter((c) => c.status === 'accepted').length})` },
    { key: 'rejected', label: `Rejected (${crs.filter((c) => c.status === 'rejected').length})` },
  ];

  const filtered = activeTab === 'all' ? crs : crs.filter((c) => c.status === activeTab);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--color-text)' }}>
          Change Requests
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
          Review feedback and turn requests into features.
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Status pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                border: '1px solid var(--color-border)',
                backgroundColor: activeTab === tab.key ? 'var(--color-accent)' : 'transparent',
                color: activeTab === tab.key ? '#fff' : 'var(--color-text)',
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Screen dropdown */}
        {screenOptions.length > 0 && (
          <select
            value={screenFilter}
            onChange={(e) => setScreenFilter(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 13, marginLeft: 'auto',
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', cursor: 'pointer',
            }}
          >
            <option value="all">All Screens</option>
            {screenOptions.map(([id, label]) => (
              <option key={id} value={id!}>{label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading change requests…</p>
      ) : filtered.length === 0 ? (
        <EmptyState deployUrl={deployUrl} />
      ) : (
        <div>
          {filtered.map((cr) => (
            <CrCard key={cr.id} cr={cr} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
