/**
 * ImpersonationBanner — Build 003 (fixed: BUG-P1-003b)
 *
 * Provides an ImpersonationContext that wraps the ENTIRE app tree so that
 * any component can call `useImpersonation()` and check `isImpersonating`.
 *
 * Structure:
 *   <ImpersonationProvider>    ← renders at App root, owns state + token validation
 *     <ImpersonationBanner />  ← reads context, renders red banner when active
 *     {children}               ← rest of the app
 *   </ImpersonationProvider>
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

// ── Context ───────────────────────────────────────────────────────────────

interface ImpersonationState {
  isImpersonating: boolean;
  targetName:      string;
  targetEmail:     string;
}

const ImpersonationContext = createContext<ImpersonationState>({
  isImpersonating: false,
  targetName:      '',
  targetEmail:     '',
});

export function useImpersonation() {
  return useContext(ImpersonationContext);
}

// ── Provider ──────────────────────────────────────────────────────────────
// Render this at the App root so the context reaches all child components.

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    targetName:      '',
    targetEmail:     '',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('__shipyard_impersonate');
    if (!token) return;

    (async () => {
      const { data, error } = await supabase
        .from('admin_impersonation_tokens')
        .select('target_user_id, expires_at, used_at')
        .eq('token', token)
        .single();

      if (error || !data) return;
      if (data.used_at || new Date(data.expires_at) < new Date()) return;

      await supabase
        .from('admin_impersonation_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', data.target_user_id)
        .single();

      setState({
        isImpersonating: true,
        targetName:      profile?.name  ?? 'Unknown user',
        targetEmail:     profile?.email ?? '',
      });
    })();
  }, []);

  return (
    <ImpersonationContext.Provider value={state}>
      {children}
    </ImpersonationContext.Provider>
  );
}

// ── Banner ────────────────────────────────────────────────────────────────
// Reads from ImpersonationContext — only renders when isImpersonating is true.
// Place this just inside ImpersonationProvider, before <Routes>.

export default function ImpersonationBanner() {
  const { isImpersonating, targetName, targetEmail } = useImpersonation();

  if (!isImpersonating) return null;

  function endSession() {
    window.close();
    window.location.href = '/admin';
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="impersonation-banner"
      style={{
        position:      'fixed',
        top:            0,
        left:           0,
        right:          0,
        background:    '#3d1010',
        borderBottom:  '2px solid #ff453a',
        color:         '#e8e8ea',
        display:       'flex',
        alignItems:    'center',
        justifyContent: 'center',
        gap:            16,
        padding:       '8px 16px',
        zIndex:         2147483640,
        fontSize:       13,
        fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <span style={{ color: '#ff453a', fontSize: 16 }}>⚠</span>
      <span>
        You are viewing as{' '}
        <strong>{targetName}</strong>
        {targetEmail && <> ({targetEmail})</>}
        {' '}— read-only mode
      </span>
      <button
        onClick={endSession}
        style={{
          background:   'none',
          border:       '1px solid #ff453a',
          borderRadius:  6,
          color:        '#ff453a',
          cursor:        'pointer',
          fontSize:      12,
          padding:       '3px 10px',
          fontWeight:    600,
        }}
      >
        End session →
      </button>
    </div>
  );
}
