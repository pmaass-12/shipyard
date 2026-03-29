/**
 * Supabase admin client for edge functions.
 * Uses service role key — bypasses RLS.
 * Never import this from the frontend bundle.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Validate an X-Shipyard-Preview-Token against the projects table.
 * Returns the project row if valid, throws if not.
 */
export async function validatePreviewToken(token: string | null) {
  if (!token) throw new Error('Missing preview token');

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id, name')
    .eq('preview_token', token)
    .single();

  if (error || !data) throw new Error('Invalid preview token');
  return data as { id: string; name: string };
}
