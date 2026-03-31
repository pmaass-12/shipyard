/**
 * Artifacts API — Build 026
 *
 * Project artifacts: architecture, specs, migrations, contracts, generated code, uploads.
 * Version control via partial unique index + archive_artifact_version() proc.
 * Storage via Supabase bucket 'shipyard-artifacts' (private).
 */

import { supabase } from '@/lib/supabase';
import type { Artifact, ArtifactType } from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch all current artifacts for a project, optionally filtered by type.
 */
export async function getCurrentArtifacts(
  projectId: string,
  type?: ArtifactType
): Promise<Artifact[]> {
  let q = supabase
    .from('artifacts')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_current', true)
    .order('created_at', { ascending: false });

  if (type) q = q.eq('artifact_type', type);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Artifact[];
}

/**
 * Fetch all versions of a specific artifact slot.
 * artifact_type + feature_id uniquely identify a slot.
 */
export async function getArtifactHistory(
  projectId: string,
  artifactType: ArtifactType,
  featureId: string | null
): Promise<Artifact[]> {
  let q = supabase
    .from('artifacts')
    .select('*')
    .eq('project_id', projectId)
    .eq('artifact_type', artifactType)
    .order('version', { ascending: false });

  if (featureId) {
    q = q.eq('feature_id', featureId);
  } else {
    q = q.is('feature_id', null);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Artifact[];
}

/**
 * Generate a signed URL for an artifact download (expires in 1 hour).
 */
export async function getArtifactDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('shipyard-artifacts')
    .createSignedUrl(storagePath, 3600);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Failed to generate signed URL');
  return data.signedUrl;
}

/**
 * Fetch a single artifact by ID.
 */
export async function getArtifact(artifactId: string): Promise<Artifact> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('id', artifactId)
    .single();

  if (error) throw error;
  return data as Artifact;
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Build a storage path for an artifact.
 * Format: projects/{projectId}/{artifactType}/{featureId || 'project'}/{filename}
 */
export function buildStoragePath(
  projectId: string,
  artifactType: ArtifactType,
  filename: string,
  featureId?: string | null
): string {
  const scope = featureId || 'project';
  return `projects/${projectId}/${artifactType}/${scope}/${filename}`;
}

/**
 * Create a new artifact row and upload file to storage.
 * If an is_current artifact already exists for this slot, mark it as is_current=false
 * via archive_artifact_version() RPC.
 */
export async function uploadArtifact(
  projectId: string,
  artifactType: ArtifactType,
  featureId: string | null,
  file: File,
  filename: string
): Promise<Artifact> {
  // Build storage path
  const storagePath = buildStoragePath(projectId, artifactType, filename, featureId);

  // Upload file to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('shipyard-artifacts')
    .upload(storagePath, file, { upsert: false });

  if (uploadError) throw uploadError;
  if (!uploadData?.path) throw new Error('Failed to upload file');

  // Archive previous version if exists
  if (featureId) {
    const { error: archiveError } = await supabase.rpc('archive_artifact_version', {
      p_project_id: projectId,
      p_artifact_type: artifactType,
      p_feature_id: featureId,
    });
    if (archiveError && archiveError.code !== 'PGRST116') {
      // PGRST116 = no existing version, which is fine
      console.warn('archive error (may be first version):', archiveError);
    }
  } else {
    // Project-level artifact
    const { error: archiveError } = await supabase.rpc('archive_artifact_version', {
      p_project_id: projectId,
      p_artifact_type: artifactType,
      p_feature_id: null,
    });
    if (archiveError && archiveError.code !== 'PGRST116') {
      console.warn('archive error (may be first version):', archiveError);
    }
  }

  // Create artifact record
  const { data: artifactData, error: dbError } = await supabase
    .from('artifacts')
    .insert({
      project_id: projectId,
      artifact_type: artifactType,
      feature_id: featureId || null,
      filename,
      storage_path: storagePath,
      file_size_bytes: file.size,
      mime_type: file.type || null,
      version: 1,
      is_current: true,
    })
    .select()
    .single();

  if (dbError) throw dbError;
  return artifactData as Artifact;
}

/**
 * Mark an artifact as not current (soft delete from user perspective).
 * Does not remove from storage.
 */
export async function deleteArtifact(artifactId: string): Promise<void> {
  const { error } = await supabase
    .from('artifacts')
    .update({ is_current: false })
    .eq('id', artifactId);

  if (error) throw error;
}

/**
 * Update artifact metadata (filename, etc.).
 */
export async function updateArtifact(
  artifactId: string,
  patch: Partial<Pick<Artifact, 'filename'>>
): Promise<void> {
  const { error } = await supabase
    .from('artifacts')
    .update(patch)
    .eq('id', artifactId);

  if (error) throw error;
}
