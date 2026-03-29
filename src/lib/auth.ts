import { supabase } from './supabase';

// ── Session guard (used in every API call) ────────────────────────────────

export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

// ── Auth actions ──────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/**
 * @param redirectTo  — Optional URL to land on after OAuth completes.
 *   Defaults to /projects. Pass `window.location.href` from wizard steps
 *   so the user is returned to the same page, not dropped at /projects.
 */
export async function signInWithGoogle(redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo ?? `${window.location.origin}/projects` },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
