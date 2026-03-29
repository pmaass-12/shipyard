/**
 * Screenshot upload helper — Build 002
 *
 * Uploads a base64-encoded PNG to the `shipyard-screenshots` bucket.
 * Returns the public URL.
 * Path: {project_id}/{screen_id}/{uuid}.png
 */

import { supabaseAdmin } from './supabaseAdmin.ts';

export async function uploadScreenshot(
  base64Png: string,
  projectId: string,
  screenId:  string,
): Promise<string> {
  if (!base64Png) return '';

  // Strip data URI prefix if present
  const base64   = base64Png.replace(/^data:image\/png;base64,/, '');
  const bytes    = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const filename = `${projectId}/${screenId}/${crypto.randomUUID()}.png`;

  const { data, error } = await supabaseAdmin.storage
    .from('shipyard-screenshots')
    .upload(filename, bytes, { contentType: 'image/png', upsert: false });

  if (error) throw new Error(`Screenshot upload failed: ${error.message}`);

  const { data: urlData } = supabaseAdmin.storage
    .from('shipyard-screenshots')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
