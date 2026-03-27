/**
 * ProjectsListScreen — the home screen after login.
 * Route: /projects
 *
 * Implements spec: specs/feature-projects-list.md (approved 2026-03-26)
 * Contract:        contracts/projects-list-api.md (build 001)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Bell, Plus, User } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import type { MenuItem } from '@/api/projects';
import type { NewProjectInput } from '@/types/db';

import { FilterPills }       from './FilterPills';
import { ProjectCard }       from './ProjectCard';
import { EmptyState }        from './EmptyState';
import { NewProjectModal }   from './NewProjectModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

// ── Types ─────────────────────────────────────────────────────────────────

interface DeleteTarget { id: string; name: string; }

// ── Screen ───────────────────────────────────────────────────────────────

export default function ProjectsListScreen() {
  const navigate  = useNavigate();
  const { showToast } = useToast();

  // Current user (for optimistic creates)
  const [userId, setUserId] = useState('');
  const [userInitials, setUserInitials] = useState('?');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        const email = user.email ?? '';
        setUserInitials(email.slice(0, 2).toUpperCase());
      }
    });
  }, []);

  // Project data
  const {
    filteredProjects, counts, activePill, loading, error,
    setActivePill, handleCreate, handleDelete,
    handlePause, handleResume, handleShip,
  } = useProjects(userId);

  // UI state
  const [showNewModal,    setShowNewModal]    = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState<DeleteTarget | null>(null);
  const [deleteLoading,   setDeleteLoading]   = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────

  const onNewProject = async (input: NewProjectInput) => {
    const { id } = await handleCreate(input);
    showToast(`✅ '${input.name.trim()}' created — opening setup`);
    navigate(`/projects/${id}/setup`);
  };

  const onCardAction = async (id: string, action: MenuItem['action']) => {
    const project = filteredProjects.find(p => p.id === id);
    if (!project) return;

    switch (action) {
      case 'edit':
        // TODO: open edit modal (not yet built)
        showToast('Edit is coming soon.', 'info');
        break;
      case 'pause':
        try {
          await handlePause(id);
          showToast(`'${project.name}' paused.`);
        } catch {
          showToast('Failed to pause project.', 'error');
        }
        break;
      case 'resume':
        try {
          await handleResume(id);
          showToast(`'${project.name}' resumed.`);
        } catch {
          showToast('Failed to resume project.', 'error');
        }
        break;
      case 'ship':
        try {
          await handleShip(id);
          showToast(`'${project.name}' shipped! 🚢`);
        } catch {
          showToast('Failed to ship project.', 'error');
        }
        break;
      case 'delete':
        setDeleteTarget({ id, name: project.name });
        break;
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await handleDelete(deleteTarget.id);
      showToast(`'${deleteTarget.name}' deleted.`);
      setDeleteTarget(null);
    } catch {
      showToast('Failed to delete project.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const isFilteredEmpty = filteredProjects.length === 0 && counts.all > 0;
  const isAllEmpty      = counts.all === 0 && !loading;
  const subtitle = `${counts.all} project${counts.all !== 1 ? 's' : ''} · ${counts.active} active`;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header
        className="nav-blur sticky top-0 z-20 border-b"
        style={{ borderColor: 'var(--color-border)', height: '52px' }}
      >
        <div className="max-w-[1200px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-accent)', color: '#fff' }}>
              <Anchor size={14} />
            </div>
            <span className="text-sm font-bold tracking-tight"
              style={{ color: 'var(--color-text)' }}>
              Shipyard
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notification bell (static — no data model yet) */}
            <button
              className="relative w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {/* Red dot placeholder */}
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
            </button>

            {/* New project button */}
            <button
              onClick={() => setShowNewModal(true)}
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg
                text-sm font-semibold text-white transition-colors"
              style={{ background: 'var(--color-accent)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-accent-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-accent)')}
            >
              <Plus size={14} />
              New project
            </button>

            {/* Avatar */}
            <button
              onClick={() => signOut().then(() => navigate('/login'))}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: 'var(--color-accent-light)',
                color:      'var(--color-accent)',
              }}
              title="Sign out"
              aria-label="User menu"
            >
              {userInitials !== '?' ? userInitials : <User size={14} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">

        {/* Page header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.4px]"
              style={{ color: 'var(--color-text)' }}>
              My Projects
            </h1>
            {!loading && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Mobile new button */}
          <button
            onClick={() => setShowNewModal(true)}
            className="sm:hidden w-9 h-9 flex items-center justify-center rounded-xl text-white"
            style={{ background: 'var(--color-accent)' }}
            aria-label="New project"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Filter pills */}
        {counts.all > 0 && (
          <div className="mb-6">
            <FilterPills active={activePill} counts={counts} onChange={setActivePill} />
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading — skeleton cards */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}
                className="h-56 rounded-2xl animate-pulse"
                style={{ background: 'var(--color-surface)' }}
              />
            ))}
          </div>
        )}

        {/* All-empty state */}
        {isAllEmpty && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <EmptyState onCreateClick={() => setShowNewModal(true)} />
          </div>
        )}

        {/* Filter-empty state */}
        {isFilteredEmpty && !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <EmptyState
              isFiltered
              filterName={activePill}
              onCreateClick={() => setShowNewModal(true)}
            />
          </div>
        )}

        {/* Project cards */}
        {!loading && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/projects/${project.id}/screens`)}
                onAction={onCardAction}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {showNewModal && (
        <NewProjectModal
          onSubmit={onNewProject}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          projectName={deleteTarget.name}
          loading={deleteLoading}
          onConfirm={onConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
