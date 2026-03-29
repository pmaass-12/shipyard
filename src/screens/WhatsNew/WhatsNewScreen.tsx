/**
 * WhatsNewScreen — Build 009
 *
 * Route: /projects/:id/whats-new
 *
 * Displays AI-generated release notes for a project's deployed app.
 * Fetches from /api/whats-new Edge Function (public content).
 * Marks whats_new_last_seen_at on mount to clear the red dot.
 *
 * Design:
 *   - Each release is a white card with date + optional "NEW" pill
 *   - New Features section: accent bullet dots, full-weight text
 *   - Bugs Fixed: subordinate — 11px muted, separated by thin top border
 *   - Empty state: rocket emoji + copy
 *   - Reverse-chronological order (newest first)
 */

import { useState, useEffect } from 'react';
import { useParams }           from 'react-router-dom';
import { markWhatsNewSeen }    from '@/api/whatsNew';
import type { ReleaseNoteWithItems, ReleaseNoteItem } from '@/types/db';

// ── Types ──────────────────────────────────────────────────────────────────

interface LoadedData {
  enabled:  boolean;
  releases: ReleaseNoteWithItems[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── ReleaseCard ────────────────────────────────────────────────────────────

function ReleaseCard({
  release,
  isNew,
}: {
  release: ReleaseNoteWithItems;
  isNew:   boolean;
}) {
  const features = release.items.filter(i => i.item_type === 'feature');
  const bugFixes = release.items.filter(i => i.item_type === 'bug_fix');

  return (
    <div style={{
      background:   '#fff',
      borderRadius:  14,
      border:       '1px solid #e5e7eb',
      overflow:     'hidden',
      marginBottom:  20,
    }}>
      {/* Card header */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:         10,
        padding:    '14px 18px 12px',
        borderBottom: '1px solid #f3f4f6',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
          {formatReleaseDate(release.release_date)}
        </span>
        {isNew && (
          <span style={{
            padding:       '2px 8px',
            borderRadius:   20,
            background:    '#fee2e2',
            color:         '#dc2626',
            fontSize:       10,
            fontWeight:     700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}>
            New
          </span>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '14px 18px' }}>

        {/* Features section */}
        {features.length > 0 && (
          <div style={{ marginBottom: bugFixes.length > 0 ? 14 : 0 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.6px', color: '#6b7280', marginBottom: 8,
            }}>
              ▲ New Features
            </p>
            {features.map((item: ReleaseNoteItem) => (
              <div key={item.id} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                marginBottom: 7,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#5b5bd6', flexShrink: 0, marginTop: 4,
                }} />
                <span style={{ fontSize: 14, color: '#111', lineHeight: 1.5 }}>
                  {item.content}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bugs Fixed section */}
        {bugFixes.length > 0 && (
          <div style={{
            paddingTop: features.length > 0 ? 14 : 0,
            borderTop:  features.length > 0 ? '1px solid #f3f4f6' : 'none',
          }}>
            <p style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.6px', color: '#9ca3af', marginBottom: 8,
            }}>
              ⏱ Bugs Fixed
            </p>
            {bugFixes.map((item: ReleaseNoteItem) => (
              <div key={item.id} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                marginBottom: 5,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#d1d5db', flexShrink: 0, marginTop: 5,
                }} />
                <span style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                  {item.content}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty items fallback */}
        {features.length === 0 && bugFixes.length === 0 && (
          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            This release has no notes.
          </p>
        )}
      </div>
    </div>
  );
}

// ── WhatsNewScreen ─────────────────────────────────────────────────────────

export default function WhatsNewScreen() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData]   = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mark as seen on mount (clears red dot)
  useEffect(() => {
    async function markSeen() {
      try {
        const { data: { user } } = await (await import('@/lib/supabase')).supabase.auth.getUser();
        if (user) await markWhatsNewSeen(user.id);
      } catch { /* non-critical */ }
    }
    markSeen();
  }, []);

  // Fetch releases
  useEffect(() => {
    if (!projectId) return;

    async function load() {
      try {
        const res = await fetch(`/api/whats-new?project_id=${projectId}`);
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        setData(json as LoadedData);
      } catch {
        setError("Couldn't load release notes — check your connection.");
      }
    }

    load();
  }, [projectId]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  if (!data.enabled || data.releases.length === 0) {
    return (
      <div style={{
        padding:        '80px 24px',
        textAlign:      'center',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:             12,
      }}>
        <span style={{ fontSize: 40 }}>✨</span>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#6b7280' }}>Nothing here yet</p>
        <p style={{ fontSize: 12, color: '#9ca3af', maxWidth: 280 }}>
          Check back after your first release is pushed to production.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{
        fontSize: 22, fontWeight: 800, color: '#111',
        marginBottom: 24, letterSpacing: '-0.4px',
      }}>
        ✨ What's New
      </h1>

      {data.releases.map((release, idx) => (
        <ReleaseCard
          key={release.id}
          release={release}
          isNew={idx === 0}
        />
      ))}
    </div>
  );
}
