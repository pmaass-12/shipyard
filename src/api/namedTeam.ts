/**
 * Named Team API — Build 040
 *
 * PM Chat queries/mutations + Daily Briefing queries.
 * Edge Function invocation for Morgan's responses and briefing generation.
 * Contract: contracts/040-named-team-pm-chat-READY.md
 */

import { supabase } from '@/lib/supabase';
import type { PmChatMessage, PmChatThread, ProjectBriefing, MorganSaveSuggestion } from '@/types/db';

// ── Extended response type for Build 043 — includes optional memory suggestion –
export interface PmChatResponseResult {
  message:         PmChatMessage;
  save_suggestion: MorganSaveSuggestion | null;
}

// ── PM Chat — Queries ──────────────────────────────────────────────────────

/** All messages for a specific thread, chronological order */
export async function getPmChatThread(
  projectId: string,
  threadId:  string
): Promise<PmChatMessage[]> {
  const { data, error } = await supabase
    .from('pm_chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PmChatMessage[];
}

/**
 * All threads for a project — returns one entry per thread_id
 * (the most recent message from each thread), newest thread first.
 */
export async function getPmChatThreadList(
  projectId: string
): Promise<PmChatThread[]> {
  const { data, error } = await supabase
    .from('pm_chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Group client-side: one entry per thread_id (first seen = newest message)
  const threadMap = new Map<string, PmChatMessage>();
  for (const msg of (data ?? []) as PmChatMessage[]) {
    if (!threadMap.has(msg.thread_id)) threadMap.set(msg.thread_id, msg);
  }

  // Convert to PmChatThread summaries
  return Array.from(threadMap.entries()).map(([thread_id, msg]) => {
    const allForThread = (data ?? []).filter(
      (m: PmChatMessage) => m.thread_id === thread_id
    );
    return {
      thread_id,
      last_message_at:      msg.created_at,
      last_message_preview: msg.content.slice(0, 80),
      message_count:        allForThread.length,
    };
  });
}

// ── PM Chat — Mutations ────────────────────────────────────────────────────

/**
 * Insert the user's message before calling the Edge Function.
 * The message appears in the UI immediately while waiting for Morgan's response.
 * NOTE: Only `role='user'` is permitted by the RLS INSERT policy.
 */
export async function insertUserPmMessage(
  projectId: string,
  threadId:  string,
  content:   string
): Promise<PmChatMessage> {
  const { data, error } = await supabase
    .from('pm_chat_messages')
    .insert({ project_id: projectId, thread_id: threadId, role: 'user', content })
    .select()
    .single();

  if (error) throw error;
  return data as PmChatMessage;
}

/**
 * Call the `generate-reeve-chat-response` Edge Function (Build 046 rename).
 * The user message must be inserted before calling this.
 * Returns the assistant's PmChatMessage row plus an optional save_suggestion
 * when Reeve identifies a durable memory-worthy fact in his response.
 */
export async function generateReeveChatResponse(
  projectId: string,
  threadId:  string,
  message:   string
): Promise<PmChatResponseResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch('/functions/v1/generate-reeve-chat-response', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ project_id: projectId, thread_id: threadId, user_message: message }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Reeve chat generation failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  return {
    message:         json.message         as PmChatMessage,
    save_suggestion: json.save_suggestion ?? null,
  };
}

// ── Morgan Design Response ─────────────────────────────────────────────────

export interface MorganDesignResponseResult {
  response_text: string;
  message_id:    string;
}

/**
 * Call the `generate-morgan-design-response` Edge Function (Build 046).
 * Used by the Feature Workflow Design tab chat.
 * Context is feature-scoped (not thread-scoped like Reeve).
 * Returns the response text and inserted message ID.
 */
export async function generateMorganDesignResponse(
  featureId:   string,
  userMessage: string
): Promise<MorganDesignResponseResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch('/functions/v1/generate-morgan-design-response', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ feature_id: featureId, user_message: userMessage }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Morgan design response failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<MorganDesignResponseResult>;
}

// ── PM Chat — Realtime ─────────────────────────────────────────────────────

/** Subscribe to new messages in a thread. Returns unsubscribe fn. */
export function subscribeToPmChatThread(
  projectId: string,
  threadId:  string,
  onMessage: (msg: PmChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`pm_chat:${projectId}:${threadId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'pm_chat_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      payload => onMessage(payload.new as PmChatMessage)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── Daily Briefing — Queries ───────────────────────────────────────────────

/** Current briefing for a project — null if never generated */
export async function getProjectBriefing(
  projectId: string
): Promise<ProjectBriefing | null> {
  const { data, error } = await supabase
    .from('project_briefings')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectBriefing | null;
}

// ── Daily Briefing — Mutations ─────────────────────────────────────────────

/**
 * Trigger briefing generation via Edge Function.
 * Inserts/overwrites the `project_briefings` row server-side.
 * Returns the updated ProjectBriefing row.
 */
export async function generateDailyBriefing(
  projectId: string
): Promise<ProjectBriefing> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch('/functions/v1/generate-daily-briefing', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ project_id: projectId }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Briefing generation failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<ProjectBriefing>;
}

// ── Daily Briefing — Realtime ──────────────────────────────────────────────

/** Watch for briefing updates after "Refresh" triggers generation. */
export function subscribeToBriefing(
  projectId: string,
  onUpdate:  (briefing: ProjectBriefing) => void
): () => void {
  const channel = supabase
    .channel(`briefing:${projectId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',    // INSERT on first generation, UPDATE on refresh
        schema: 'public',
        table:  'project_briefings',
        filter: `project_id=eq.${projectId}`,
      },
      payload => onUpdate(payload.new as ProjectBriefing)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
