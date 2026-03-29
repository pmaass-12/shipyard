/**
 * useProjects — manages project list state for the Projects List screen.
 *
 * Handles: loading, optimistic create, update, delete, filter pill state.
 * Components should never call api/projects.ts directly; go through this hook.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  filterProjects,
  pillCounts,
  type FilterPill,
} from '@/api/projects';
import type { ProjectSummary, NewProjectInput, UpdateProjectInput, ProjectColor } from '@/types/db';

interface UseProjectsReturn {
  // Data
  projects: ProjectSummary[];
  filteredProjects: ProjectSummary[];
  counts: ReturnType<typeof pillCounts>;
  activePill: FilterPill;
  // Status
  loading: boolean;
  error: string | null;
  // Actions
  setActivePill: (pill: FilterPill) => void;
  handleCreate: (input: NewProjectInput) => Promise<{ id: string }>;
  handleUpdate: (id: string, patch: UpdateProjectInput) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handlePause:  (id: string) => Promise<void>;
  handleResume: (id: string) => Promise<void>;
  handleShip:   (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useProjects(currentUserId: string): UseProjectsReturn {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activePill, setActivePill] = useState<FilterPill>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Create (optimistic) ────────────────────────────────────────────────

  const handleCreate = useCallback(async (input: NewProjectInput): Promise<{ id: string }> => {
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();

    const optimistic: ProjectSummary = {
      id:                      tempId,
      user_id:                 currentUserId,
      name:                    input.name.trim(),
      description:             input.description ?? null,
      emoji:                   input.emoji        ?? '🚀',
      color:                   (input.color        ?? 'blue') as ProjectColor,
      status:                  'active',
      // Build 006
      phase:                   'alpha',
      pushed_to_production_at: null,
      // Build 007
      test_mode_enabled:       true,
      // Build 008
      onboarding_tour_enabled: true,
      tour_last_generated_at:  null,
      // Build 009
      whats_new_enabled:       true,
      // Build 011
      waitlist_enabled:        false,
      repo_url:                input.repo_url     ?? null,
      budget_usd:              input.budget_usd   ?? null,
      tech_stack:              input.tech_stack   ?? [],
      default_model:           'claude-sonnet-4-6',
      last_activity_at:        now,
      created_at:              now,
      updated_at:              now,
      screen_count:            0,
      feature_count:           0,
      features_done:           0,
      features_in_progress:    0,
      pct_complete:            null,
      open_bug_count:          0,
      last_deploy_date:        null,
      // Build 006: maturity counts
      features_alpha:          0,
      features_beta:           0,
      features_production:     0,
    };

    setProjects(prev => [optimistic, ...prev]);

    try {
      const created = await createProject(input);
      setProjects(prev =>
        prev.map(p => p.id === tempId ? { ...optimistic, ...created } : p)
      );
      return { id: created.id };
    } catch (err) {
      // Roll back optimistic insert
      setProjects(prev => prev.filter(p => p.id !== tempId));
      throw err;
    }
  }, [currentUserId]);

  // ── Update ────────────────────────────────────────────────────────────

  const handleUpdate = useCallback(async (id: string, patch: UpdateProjectInput) => {
    // Optimistic update
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    try {
      const updated = await updateProject(id, patch);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
    } catch (err) {
      await fetch(); // Revert by refetching
      throw err;
    }
  }, [fetch]);

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic removal
    const removed = projects.find(p => p.id === id);
    setProjects(prev => prev.filter(p => p.id !== id));
    try {
      await deleteProject(id);
    } catch (err) {
      // Restore on failure
      if (removed) setProjects(prev => [...prev, removed]);
      throw err;
    }
  }, [projects]);

  // ── Status shortcuts (delegate to handleUpdate — single Supabase call) ──

  const handlePause  = useCallback((id: string) =>
    handleUpdate(id, { status: 'paused'  }), [handleUpdate]);

  const handleResume = useCallback((id: string) =>
    handleUpdate(id, { status: 'active'  }), [handleUpdate]);

  const handleShip   = useCallback((id: string) =>
    handleUpdate(id, { status: 'shipped' }), [handleUpdate]);

  return {
    projects,
    filteredProjects: filterProjects(projects, activePill),
    counts: pillCounts(projects),
    activePill,
    loading,
    error,
    setActivePill,
    handleCreate,
    handleUpdate,
    handleDelete,
    handlePause,
    handleResume,
    handleShip,
    refetch: fetch,
  };
}
