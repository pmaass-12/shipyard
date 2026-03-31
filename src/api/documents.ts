/**
 * Documents API — Build 030
 *
 * Supporting project documents for feature generation context.
 * Categories: product_brief, pr_faq, wireframes, brand_guidelines, user_research, feature_spec, reference, other
 * Storage via Supabase bucket 'project-documents' (private).
 */

import { supabase } from '@/lib/supabase';
import type { ProjectDocument, DocumentCategory } from '@/types/db';

export const AUTO_INJECT_CATEGORIES: DocumentCategory[] = [
  'product_brief',
  'pr_faq',
  'brand_guidelines',
  'user_research',
  'wireframes',
  'feature_spec',
];

export const ON_DEMAND_CATEGORIES: DocumentCategory[] = ['reference', 'other'];

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch all documents for a project.
 */
export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from('project_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectDocument[];
}

/**
 * Fetch auto-injectable documents (used for context assembly).
 */
export async function getAutoInjectableDocuments(
  projectId: string
): Promise<Pick<ProjectDocument, 'id' | 'name' | 'category' | 'extracted_text' | 'summary_text'>[]> {
  const { data, error } = await supabase
    .from('project_documents')
    .select('id, name, category, extracted_text, summary_text')
    .eq('project_id', projectId)
    .eq('auto_inject', true)
    .not('extracted_text', 'is', null);

  if (error) throw error;
  return (data ?? []) as Pick<
    ProjectDocument,
    'id' | 'name' | 'category' | 'extracted_text' | 'summary_text'
  >[];
}

/**
 * Fetch a single document by ID.
 */
export async function getDocument(documentId: string): Promise<ProjectDocument> {
  const { data, error } = await supabase
    .from('project_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) throw error;
  return data as ProjectDocument;
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Upload a document file and create a document record.
 * Auto-inject defaults based on category.
 * After upload, the Edge Function extract-document-text is called (fire-and-forget).
 */
export async function uploadDocument(
  projectId: string,
  file: File,
  name: string,
  category: DocumentCategory,
  userId: string
): Promise<ProjectDocument> {
  // Build storage path
  const filename = `${Date.now()}_${file.name}`;
  const storagePath = `projects/${projectId}/${category}/${filename}`;

  // Upload file to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('project-documents')
    .upload(storagePath, file, { upsert: false });

  if (uploadError) throw uploadError;
  if (!uploadData?.path) throw new Error('Failed to upload file');

  // Determine auto_inject based on category
  const autoInject = AUTO_INJECT_CATEGORIES.includes(category);

  // Create document record
  const { data: docData, error: dbError } = await supabase
    .from('project_documents')
    .insert({
      project_id: projectId,
      name,
      category,
      file_path: storagePath,
      file_type: file.type || null,
      file_size_bytes: file.size,
      extracted_text: null,
      summary_text: null,
      auto_inject: autoInject,
      generation_count: 0,
      uploaded_by: userId,
    })
    .select()
    .single();

  if (dbError) throw dbError;

  // Call Edge Function to extract text (fire-and-forget)
  supabase.functions.invoke('extract-document-text', {
    body: { documentId: (docData as ProjectDocument).id },
  }).catch((err) => console.warn('extract-document-text failed:', err));

  return docData as ProjectDocument;
}

/**
 * Toggle auto-inject flag for a document.
 */
export async function toggleAutoInject(
  documentId: string,
  autoInject: boolean
): Promise<void> {
  const { error } = await supabase
    .from('project_documents')
    .update({ auto_inject: autoInject })
    .eq('id', documentId);

  if (error) throw error;
}

/**
 * Update document name.
 */
export async function updateDocumentName(documentId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('project_documents')
    .update({ name })
    .eq('id', documentId);

  if (error) throw error;
}

/**
 * Delete a document (removes from Storage + DB).
 */
export async function deleteDocument(documentId: string): Promise<void> {
  // Fetch to get storage path
  const doc = await getDocument(documentId);

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('project-documents')
    .remove([doc.file_path]);

  if (storageError) console.warn('Storage delete error:', storageError);

  // Delete from DB
  const { error: dbError } = await supabase
    .from('project_documents')
    .delete()
    .eq('id', documentId);

  if (dbError) throw dbError;
}

/**
 * Increment generation_count when Claude uses a document.
 */
export async function incrementGenerationCount(documentId: string): Promise<void> {
  const { error } = await supabase
    .from('project_documents')
    .update({
      generation_count: supabase.rpc('increment_generation_count', {
        doc_id: documentId,
      }),
    })
    .eq('id', documentId);

  if (error) console.warn('Failed to increment generation_count:', error);
}

/**
 * Get a signed URL for downloading a document.
 */
export async function getDocumentDownloadUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('project-documents')
    .createSignedUrl(filePath, 3600);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Failed to generate signed URL');
  return data.signedUrl;
}
