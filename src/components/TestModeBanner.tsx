/**
 * TestModeBanner — Build 007
 *
 * Fixed amber banner rendered at the app root whenever Test Mode is active.
 * Persists across all routes; "Exit" ends the session.
 */

import { TestMode } from '@/utils/testMode';

export default function TestModeBanner() {
  if (!TestMode.isActive()) return null;

  return (
    <div
      data-testid="test-mode-banner"
      style={{
        position:       'fixed',
        top:             0,
        left:            0,
        right:           0,
        zIndex:          9999,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             12,
        padding:         '8px 16px',
        background:      '#92400e',
        color:           '#fef3c7',
        fontSize:         13,
        fontWeight:       600,
        letterSpacing:   '0.5px',
      }}
    >
      {/* Amber pulse dot */}
      <span style={{
        width:        8,
        height:       8,
        borderRadius: '50%',
        background:   '#fbbf24',
        flexShrink:    0,
        animation:    'testmode-pulse 1.4s ease-in-out infinite',
      }} />

      <span style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: 11 }}>
        Test Mode
      </span>

      <span style={{
        flex:       1,
        fontSize:   12,
        fontWeight: 400,
        opacity:    0.8,
        textAlign:  'center',
      }}>
        No data will be saved · Session ends when you close this tab
      </span>

      <button
        data-testid="test-mode-exit"
        onClick={() => TestMode.deactivate()}
        style={{
          padding:      '3px 12px',
          borderRadius:  20,
          border:       '1px solid rgba(254,243,199,0.4)',
          background:    'transparent',
          color:         '#fef3c7',
          fontSize:      12,
          fontWeight:    600,
          cursor:        'pointer',
          letterSpacing: '0.3px',
          flexShrink:     0,
        }}
      >
        Exit
      </button>

      {/* Pulse keyframe injected as a style tag */}
      <style>{`
        @keyframes testmode-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
