/**
 * TourFab — Build 008
 *
 * Floating "?" action button at the bottom-right of every app screen.
 * Pulses once on first render (before tour has been seen), then settles.
 * Hidden (opacity 0.3, pointer-events none) during active tour.
 * Auto-launches tour on first login (tour_seen_at is null).
 *
 * Renders null when onboarding_tour_enabled is false.
 *
 * Props:
 *   projectId   — project whose tour to load
 *   userId      — current user (for tour_seen_at check)
 *   tourEnabled — from projects.onboarding_tour_enabled
 *   previewMode — if true, skip seen-at gate (from ?tour_preview=true)
 */

import { useEffect, useState } from 'react';
import { getTourSeenAt } from '@/api/tour';

interface Props {
  projectId:   string;
  userId:      string;
  tourEnabled: boolean;
  previewMode: boolean;
}

export default function TourFab({ projectId, userId, tourEnabled, previewMode }: Props) {
  const [visible, setVisible]    = useState(false);
  const [pulse, setPulse]        = useState(false);
  const [tourActive, setActive]  = useState(false);

  useEffect(() => {
    if (!tourEnabled) return;
    setVisible(true);

    // Auto-launch on first login
    async function maybeAutoLaunch() {
      if (previewMode) {
        // preview: skip gate, Tour component handles launch via event
        return;
      }
      try {
        const seenAt = await getTourSeenAt(userId);
        if (!seenAt) {
          setPulse(true);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('shipyard:launch-tour', { detail: { preview: false } }));
          }, 1000);
        }
      } catch { /* non-critical */ }
    }

    maybeAutoLaunch();
  }, [tourEnabled, userId, previewMode, projectId]);

  // Listen for tour active/inactive to dim FAB
  useEffect(() => {
    function onLaunch() { setActive(true); setPulse(false); }
    function onEnd()    { setActive(false); }
    window.addEventListener('shipyard:launch-tour', onLaunch);
    window.addEventListener('shipyard:tour-ended',  onEnd);
    return () => {
      window.removeEventListener('shipyard:launch-tour', onLaunch);
      window.removeEventListener('shipyard:tour-ended',  onEnd);
    };
  }, []);

  if (!tourEnabled || !visible) return null;

  return (
    <>
      <button
        data-testid="tour-fab"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('shipyard:launch-tour', { detail: { preview: previewMode } }));
        }}
        style={{
          position:   'fixed',
          bottom:      28,
          right:       28,
          zIndex:      7000,
          width:       44,
          height:      44,
          borderRadius: '50%',
          border:      'none',
          background:  '#5b5bd6',
          color:       '#fff',
          fontSize:    20,
          fontWeight:  700,
          cursor:       tourActive ? 'not-allowed' : 'pointer',
          boxShadow:   '0 4px 14px rgba(91,91,214,0.35)',
          opacity:      tourActive ? 0.3 : 1,
          pointerEvents: tourActive ? 'none' : 'all',
          transform:   'scale(1)',
          transition:  'transform 0.15s, opacity 0.2s',
          animation:   pulse ? 'fab-pulse 1.5s ease-in-out' : 'none',
        }}
        onMouseEnter={e => { if (!tourActive) (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        aria-label="Take the tour"
      >
        ?
      </button>

      <style>{`
        @keyframes fab-pulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(91,91,214,0.35); }
          50%       { box-shadow: 0 4px 24px rgba(91,91,214,0.65); transform: scale(1.1); }
        }
      `}</style>
    </>
  );
}
