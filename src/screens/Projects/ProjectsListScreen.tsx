/**
 * ProjectsListScreen — the home screen after login.
 * Route: /projects
 *
 * Implements spec: specs/feature-projects-list.md (approved 2026-03-26)
 * Contract:        contracts/projects-list-api.md (build 001)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Anchor, Bell, Plus, User } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import { getBellBadgeCount, subscribeToHumanTaskChanges } from '@/api/humanTasks';
import type { MenuItem } from '@/api/projects';
import type { NewProjectInput } from '@/types/db';

import { FilterPills }     from './FilterPills';
import { ProjectCard }     from './ProjectCard';
import { EmptyState }      from './EmptyState';
import { NewProjectModal } from './NewProjectModal';

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
  const [showNewModal,   setShowNewModal]   = useState(false);
  const [bellBadgeCount, setBellBadgeCount] = useState(0);

  const refreshBellBadge = useCallback(() => {
    getBellBadgeCount().then(setBellBadgeCount).catch(console.error);
  }, []);

  useEffect(() => {
    refreshBellBadge();
    const unsub = subscribeToHumanTaskChanges(refreshBellBadge);
    return unsub;
  }, [refreshBellBadge]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const onNewProject = async (input: NewProjectInput) => {
    const { id } = await handleCreate(input);
    showToast(`✅ '${input.name.trim()}' created — opening setup`);
    navigate(`/projects/${id}/setup`);
  };

  // New Project card: create a blank project then go straight to wizard (no modal)
  const onNewProjectCard = async () => {
    try {
      const { id } = await handleCreate({ name: 'New Project' });
      navigate(`/projects/${id}/setup/wizard`); // routing-fix-031: restore ProjectTypeChoiceScreen
    } catch {
      showToast('Could not create project. Try again.', 'error');
    }
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
      // 'delete' is handled inline by ProjectCard — not routed through here
      case 'delete':
        break;
    }
  };

  const onDeleteProject = async (id: string) => {
    const project = filteredProjects.find(p => p.id === id);
    try {
      await handleDelete(id);
      showToast(`'${project?.name ?? 'Project'}' deleted.`);
    } catch (err) {
      showToast('Failed to delete project.', 'error');
      throw err; // re-throw so ProjectCard can clear its loading state
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
            {/* Notification bell — links to /tasks; badge = P0+P1 pending count */}
            <Link
              to="/tasks"
              data-testid="nav-bell"
              className="relative w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              aria-label={`Tasks${bellBadgeCount > 0 ? ` (${bellBadgeCount} pending)` : ''}`}
            >
              <Bell size={17} />
              {bellBadgeCount > 0 && (
                <span
                  data-testid="bell-badge"
                  className="absolute flex items-center justify-center rounded-full text-white"
                  style={{
                    top: 2, right: 2,
                    minWidth: bellBadgeCount > 9 ? 16 : 14,
                    height: bellBadgeCount > 9 ? 16 : 14,
                    fontSize: 9, fontWeight: 700,
                    background: '#ef4444',
                    lineHeight: 1,
                    padding: '0 2px',
                  }}
                >
                  {bellBadgeCount > 99 ? '99+' : bellBadgeCount}
                </span>
              )}
            </Link>



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
                onDelete={onDeleteProject}
              />
            ))}

            {/* New project card */}
            <button
              data-testid="new-project-card"
              onClick={onNewProjectCard}
              className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center
                gap-3 transition-all duration-150 cursor-pointer group"
              style={{
                borderColor: 'var(--color-border)',
                minHeight: '200px',
                background: 'transparent',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.background  = 'var(--color-accent-light)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.background  = 'transparent';
              }}
              aria-label="New project"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
              >
                <Plus size={20} />
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                New project
              </span>
            </button>
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

    </div>
  );
}
