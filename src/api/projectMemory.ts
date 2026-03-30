/**
 * Project Memory API — Build 043
 *
 * CRUD for project_memory_facts and read access to compacted_threads.
 * Memory facts are the persistent knowledge layer behind Morgan's Project Brain.
 *
 * Sources:
 *   'user'   — manually saved by builder via "Save to memory" in PmChatPanel
 *   'morgan' — auto-extracted by extract-memory-fact Edge Function
 *   'system' — written by Edge Functions on lifecycle events (cancellations, deploys)
 *              system facts are read-only from the client (RLS enforced)
 *
 * Contract: contracts/043-project-memory-general-chat-READY.md
 */

import { supabase } from '@/lib/supabase';
import type {
  ProjectMemoryFact,
  NewMemoryFactInput,
  UpdateMemoryFactInput,
  MemoryFactCategory,
  CompactedThread,
} from '@/types/db';

// ── Queries ────────────────────────────────────────────────────────────────

/** All user + morgan facts for a project, newest first */
export async function getMemoryFacts(projectId: string): Promise<ProjectMemoryFact[]> {
  const { data, error } = await supabase
    .from('project_memory_facts')
    .select('*')
    .eq('project_id', projectId)
    .in('source', ['user', 'morgan'])
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectMemoryFact[];
}

/** Filter by category — used by Memory Drawer tab navigation */
export async function getMemoryFactsByCategory(
  projectId: string,
  category:  MemoryFactCategory
): Promise<ProjectMemoryFact[]> {
  const { data, error } = await supabase
    .from('project_memory_facts')
    .select('*')
    .eq('project_id', projectId)
    .eq('category', category)
    .in('source', ['user', 'morgan'])
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectMemoryFact[];
}

/** System-generated facts only — for the System tab in Memory Drawer */
export async function getSystemMemoryFacts(projectId: string): Promise<ProjectMemoryFact[]> {
  const { data, error } = await supabase
    .from('project_memory_facts')
    .select('*')
    .eq('project_id', projectId)
    .eq('source', 'system')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectMemoryFact[];
}

/** Total fact count (user + morgan) for the 🧠 chip in panel header */
export async function getMemoryFactCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('project_memory_facts')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .in('source', ['user', 'morgan']);

  if (error) throw error;
  return count ?? 0;
}

/** Compacted thread summaries — used by Morgan context assembly */
export async function getCompactedThreads(
  projectId: string,
  threadId:  string
): Promise<CompactedThread[]> {
  const { data, error } = await supabase
    .from('compacted_threads')
    .select('*')
    .eq('project_id', projectId)
    .eq('thread_id', threadId)
    .order('oldest_message_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CompactedThread[];
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new memory fact.
 * source defaults to 'user' — the builder's manual save.
 */
export async function createMemoryFact(
  projectId: string,
  input:     NewMemoryFactInput
): Promise<ProjectMemoryFact> {
  const { data, error } = await supabase
    .from('project_memory_facts')
    .insert({
      project_id: projectId,
      title:      input.title.trim(),
      body:       input.body.trim(),
      category:   input.category,
      source:     input.source ?? 'user',
      feature_id: input.feature_id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProjectMemoryFact;
}

/**
 * Update an existing fact's title, body, or category.
 * RLS: only user/morgan facts can be updated by the client.
 * System facts are read-only.
 */
export async function updateMemoryFact(
  id:    string,
  patch: UpdateMemoryFactInput
): Promise<ProjectMemoryFact> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title    !== undefined) updates['title']    = patch.title!.trim();
  if (patch.body     !== undefined) updates['body']     = patch.body!.trim();
  if (patch.category !== undefined) updates['category'] = patch.category;

  const { data, error } = await supabase
    .from('project_memory_facts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectMemoryFact;
}

/**
 * Delete a memory fact.
 * RLS prevents deletion of system facts from the client.
 */
export async function deleteMemoryFact(id: string): Promise<void> {
  const { error } = await supabase
    .from('project_memory_facts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ── Realtime subscription ──────────────────────────────────────────────────

/**
 * Subscribe to INSERT events on project_memory_facts.
 * Used by the Memory Drawer to surface newly auto-extracted Morgan facts.
 * Returns an unsubscribe function.
 */
export function subscribeToMemoryFacts(
  projectId: string,
  onFact:    (fact: ProjectMemoryFact) => void
): () => void {
  const channel = supabase
    .channel(`memory_facts:${projectId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'project_memory_facts',
        filter: `project_id=eq.${projectId}`,
      },
      payload => onFact(payload.new as ProjectMemoryFact)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
