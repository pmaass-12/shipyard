/**
 * Tour — Build 008
 *
 * Spotlight/dim overlay onboarding tour rendered at the app root.
 * Works via the /api/tour Edge Function (no direct Supabase client call).
 *
 * Usage:
 *   <TourFab projectId={id} userId={userId} previewMode={false} />
 *
 * The FAB triggers tour launch; Tour renders the overlay.
 *
 * Spec:
 *   - Dim: rgba(0,0,0,0.72) full-screen overlay
 *   - Spotlight: box-shadow cutout on the target element, 2px white ring
 *   - Tooltip: white card 296px, step counter, title, description, footer nav
 *   - Missing element: center tooltip, append fallback note
 *   - Exit / Finish: marks tour_seen_at (unless previewMode)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { markTourSeen } from '@/api/tour';
import type { TourStep } from '@/types/db';

const MISSING_ELEMENT_NOTE = '*(This feature may have moved or been updated.)*';

type TourPhase = 'idle' | 'loading' | 'active' | 'finished';

interface TourState {
  phase:        TourPhase;
  steps:        TourStep[];
  currentIndex: number;
  previewMode:  boolean;
}

interface Props {
  projectId:   string;
  userId:      string;
  previewMode: boolean;
}

export default function Tour({ projectId, userId, previewMode }: Props) {
  const [state, setState] = useState<TourState>({
    phase:        'idle',
    steps:        [],
    currentIndex: 0,
    previewMode:  false,
  });

  // Spotlight position for the current step
  const [spotlight, setSpotlight] = useState<{
    top: number; left: number; width: number; height: number; found: boolean;
  } | null>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);

  // ── Measure spotlight target ────────────────────────────────────────────
  const measureTarget = useCallback((selector: string | null) => {
    if (!selector) {
      setSpotlight(null);
      return;
    }

    const el = document.querySelector(selector);
    if (!el) {
      setSpotlight({ top: 0, left: 0, width: 0, height: 0, found: false });
      return;
    }

    const rect = el.getBoundingClientRect();
    setSpotlight({
      top:    rect.top    + window.scrollY - 8,
      left:   rect.left   + window.scrollX - 8,
      width:  rect.width  + 16,
      height: rect.height + 16,
      found:  true,
    });
  }, []);

  // ── Launch tour ─────────────────────────────────────────────────────────
  const launch = useCallback(async (preview = false) => {
    setState(s => ({ ...s, phase: 'loading' }));

    try {
      const res  = await fetch(`/api/tour?project_id=${projectId}`);
      const data: { enabled: boolean; steps: TourStep[] } = await res.json();

      if (!data.enabled || data.steps.length === 0) {
        setState(s => ({ ...s, phase: 'idle' }));
        return;
      }

      setState({ phase: 'active', steps: data.steps, currentIndex: 0, previewMode: preview });
      measureTarget(data.steps[0].target_selector);
    } catch {
      setState(s => ({ ...s, phase: 'idle' }));
    }
  }, [projectId, measureTarget]);

  // ── Expose launch via custom event (TourFab dispatches 'shipyard:launch-tour') ─
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as { preview?: boolean };
      launch(detail?.preview ?? false);
    }
    window.addEventListener('shipyard:launch-tour', handler);
    return () => window.removeEventListener('shipyard:launch-tour', handler);
  }, [launch]);

  // ── Auto-launch on mount if previewMode ─────────────────────────────────
  useEffect(() => {
    if (previewMode) {
      setTimeout(() => launch(true), 800);
    }
  }, [previewMode, launch]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const step = state.phase === 'active' ? state.steps[state.currentIndex] : null;

  function goNext() {
    if (state.phase !== 'active') return;
    const nextIdx = state.currentIndex + 1;
    if (nextIdx >= state.steps.length) {
      finish();
      return;
    }
    setState(s => ({ ...s, currentIndex: nextIdx }));
    measureTarget(state.steps[nextIdx].target_selector);
  }

  function goBack() {
    if (state.phase !== 'active' || state.currentIndex === 0) return;
    const prevIdx = state.currentIndex - 1;
    setState(s => ({ ...s, currentIndex: prevIdx }));
    measureTarget(state.steps[prevIdx].target_selector);
  }

  async function finish() {
    setState(s => ({ ...s, phase: 'finished' }));
    if (!state.previewMode) {
      try { await markTourSeen(userId); } catch { /* non-critical */ }
    }
    setTimeout(() => setState(s => ({ ...s, phase: 'idle' })), 600);
  }

  async function exitTour() {
    setState(s => ({ ...s, phase: 'idle' }));
    if (!state.previewMode) {
      try { await markTourSeen(userId); } catch { /* non-critical */ }
    }
  }

  if (state.phase === 'idle' || state.phase === 'loading' || !step) return null;

  const totalSteps = state.steps.length;
  const isFirst    = state.currentIndex === 0;
  const isLast     = state.currentIndex === totalSteps - 1;
  const hasMissingTarget = step.target_selector && spotlight && !spotlight.found;
  const centered = !step.target_selector || hasMissingTarget;

  // ── Tooltip positioning ────────────────────────────────────────────────
  // Simple rule: center if no target; below spotlight if in top half, above if in bottom half
  let tooltipStyle: React.CSSProperties = {};
  if (centered) {
    tooltipStyle = {
      position:  'fixed',
      top:       '50%',
      left:      '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else if (spotlight && spotlight.found) {
    const inBottomHalf = spotlight.top > window.innerHeight / 2;
    if (inBottomHalf) {
      tooltipStyle = {
        position: 'absolute',
        top:      spotlight.top - 200,  // above spotlight
        left:     Math.max(12, spotlight.left),
      };
    } else {
      tooltipStyle = {
        position: 'absolute',
        top:      spotlight.top + spotlight.height + 12, // below spotlight
        left:     Math.max(12, spotlight.left),
      };
    }
  }

  return (
    <>
      {/* Dim overlay */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        zIndex: 8000,
        pointerEvents: 'none',
      }} />

      {/* Spotlight cutout */}
      {spotlight && spotlight.found && (
        <div
          style={{
            position:     'absolute',
            top:           spotlight.top,
            left:          spotlight.left,
            width:         spotlight.width,
            height:        spotlight.height,
            borderRadius:  10,
            zIndex:        8001,
            boxShadow:    '0 0 0 2000px rgba(0,0,0,0.72)',
            border:       '2px solid rgba(255,255,255,0.35)',
            transition:   'all 0.3s ease',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          ...tooltipStyle,
          zIndex:       8002,
          width:         296,
          background:   '#fff',
          borderRadius:  14,
          boxShadow:    '0 8px 32px rgba(0,0,0,0.22)',
          padding:      '16px 16px 14px',
          pointerEvents: 'all',
        }}
      >
        {/* Step counter */}
        <p style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.8px', color: '#9ca3af', marginBottom: 6,
        }}>
          Step {state.currentIndex + 1} of {totalSteps}
        </p>

        {/* Title */}
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>
          {step.title}
        </p>

        {/* Description */}
        <p style={{ fontSize: 12, color: '#444', lineHeight: 1.6, marginBottom: 10 }}>
          {step.description}
          {hasMissingTarget && (
            <span style={{ display: 'block', color: '#9ca3af', marginTop: 6, fontStyle: 'italic' }}>
              {MISSING_ELEMENT_NOTE}
            </span>
          )}
        </p>

        {/* Preview mode: "Edit this step" */}
        {state.previewMode && (
          <button
            style={{
              display: 'block', width: '100%', marginBottom: 10,
              padding: '5px 0', borderRadius: 6, border: '1px dashed #d1d5db',
              background: 'transparent', color: '#6b7280',
              fontSize: 11, cursor: 'pointer',
            }}
            onClick={() => {
              // Dispatch event for Admin Console to intercept
              window.dispatchEvent(new CustomEvent('shipyard:edit-tour-step', {
                detail: { step },
              }));
            }}
          >
            ✏️ Edit this step
          </button>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Dot progress */}
          <div style={{ display: 'flex', gap: 5 }}>
            {state.steps.map((_, i) => (
              <span
                key={i}
                style={{
                  width:        6,
                  height:       6,
                  borderRadius: '50%',
                  background:   i < state.currentIndex
                    ? 'rgba(91,91,214,0.35)'
                    : i === state.currentIndex
                      ? '#5b5bd6'
                      : '#e5e7eb',
                }}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {/* Exit */}
            <button
              data-testid="tour-exit"
              onClick={exitTour}
              style={{
                padding: '5px 10px', borderRadius: 6, border: 'none',
                background: 'transparent', color: '#888',
                fontSize: 12, cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = '#dc2626'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = '#888'; }}
            >
              Exit Tour
            </button>

            {/* Back */}
            {!isFirst && (
              <button
                data-testid="tour-back"
                onClick={goBack}
                style={{
                  padding: '5px 10px', borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  background: '#fff', color: '#374151',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            )}

            {/* Next / Finish */}
            <button
              data-testid={isLast ? 'tour-finish' : 'tour-next'}
              onClick={isLast ? finish : goNext}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: '#5b5bd6', color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {isLast ? 'Finish ✓' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
