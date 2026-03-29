import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { ContextMenu } from './ContextMenu';
import {
  getMonogram, getMonogramColors, resolveColor,
  STATUS_COLORS, statusLabel,
  pctLabel, pctValue, progressBarColor, relativeTime,
} from './utils';
import { menuOptions, type MenuItem } from '@/api/projects';
import type { ProjectSummary } from '@/types/db';

interface ProjectCardProps {
  project:  ProjectSummary;
  onClick:  () => void;
  onAction: (id: string, action: MenuItem['action']) => void;
  onDelete: (id: string) => Promise<void>;
}

export function ProjectCard({ project, onClick, onAction, onDelete }: ProjectCardProps) {
  const [menuOpen,          setMenuOpen]          = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading,     setDeleteLoading]     = useState(false);

  const color   = resolveColor(project);
  const mono    = getMonogramColors(color);
  const badge   = STATUS_COLORS[project.status];

  const pct     = pctValue(project.pct_complete);
  const barColor = progressBarColor(project.status);
  const monogram = getMonogram(project.name);

  const handleMenuAction = (action: MenuItem['action']) => {
    if (action === 'delete') {
      setShowDeleteConfirm(true);
      return;
    }
    onAction(project.id, action);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteLoading(true);
    try {
      await onDelete(project.id);
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div
      data-testid="project-card"
      className="relative rounded-2xl border cursor-pointer transition-all duration-150
        group"
      style={{
        background:   'var(--color-surface)',
        borderColor:  menuOpen ? 'var(--color-border)' : 'transparent',
        padding:      '20px',
      }}
      onClick={e => {
        // Don't navigate if click was inside the context menu button
        if ((e.target as HTMLElement).closest('[data-menu]')) return;
        onClick();
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.transform   = 'translateY(-2px)';
        el.style.boxShadow   = '0 4px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)';
        el.style.borderColor = 'var(--color-border)';
      }}
      onMouseLeave={e => {
        if (menuOpen) return;
        const el = e.currentTarget;
        el.style.transform  = '';
        el.style.boxShadow  = '';
        el.style.borderColor = 'transparent';
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        {/* Monogram */}
        <div
          className="w-[46px] h-[46px] flex items-center justify-center rounded-xl
            text-sm font-bold shrink-0"
          style={{ background: mono.bg, color: mono.text, borderRadius: '12px' }}
        >
          {monogram}
        </div>

        {/* Three-dot menu */}
        <div className="relative" data-menu>
          <button
            data-testid="context-menu-trigger"
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors
              opacity-0 group-hover:opacity-100 sm:opacity-100"
            style={{
              color:      'var(--color-text-muted)',
              background: menuOpen ? 'var(--color-surface-hover)' : 'transparent',
            }}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            aria-label="Project options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <ContextMenu
              items={menuOptions(project)}
              onClose={() => setMenuOpen(false)}
              onSelect={handleMenuAction}
            />
          )}
        </div>
      </div>

      {/* Name */}
      <p className="text-[15px] font-[660] leading-snug mb-1"
        style={{ color: 'var(--color-text)', letterSpacing: '-0.2px' }}>
        {project.name}
      </p>

      {/* Description */}
      {project.description && (
        <p className="text-sm line-clamp-2 mb-4"
          style={{ color: 'var(--color-text-muted)' }}>
          {project.description}
        </p>
      )}
      {!project.description && <div className="mb-4" />}

      {/* Status badge + progress */}
      <div className="flex items-center gap-2 mb-3">
        {/* Badge */}
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: badge.bg, color: badge.text }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.dot }} />
          {statusLabel(project.status)}
        </span>

        {/* Progress bar + label */}
        <div className="flex items-center gap-1.5 flex-1">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--color-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
          <span className="text-xs tabular-nums font-medium shrink-0"
            style={{ color: 'var(--color-text-muted)', minWidth: '28px', textAlign: 'right' }}>
            {pctLabel(project.pct_complete)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mb-3" style={{ background: 'var(--color-divider)' }} />

      {/* Stat grid */}
      <div
        className="grid grid-cols-3 rounded-xl overflow-hidden text-center"
        style={{ gap: '1px', background: 'var(--color-divider)' }}
      >
        {[
          {
            value: String(project.screen_count),
            label: 'SCREENS',
            highlight: false,
          },
          {
            value: String(project.open_bug_count),
            label: 'OPEN BUGS',
            highlight: project.open_bug_count > 0,
          },
          {
            value: relativeTime(project.last_deploy_date),
            label: 'LAST DEPLOY',
            highlight: project.last_deploy_date !== null,
          },
        ].map(({ value, label, highlight }) => (
          <div
            key={label}
            className="flex flex-col items-center py-2.5 px-1"
            style={{ background: 'var(--color-surface)' }}
          >
            <span
              className="text-sm font-bold leading-none mb-1"
              style={{ color: highlight ? (label === 'OPEN BUGS' ? '#ef4444' : '#22c55e') : 'var(--color-text)' }}
            >
              {value}
            </span>
            <span className="text-[10px] tracking-wide font-medium"
              style={{ color: 'var(--color-text-subtle)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Inline delete confirmation overlay */}
      {showDeleteConfirm && (
        <div
          data-testid="delete-confirm-overlay"
          data-menu
          className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-4 animate-fade-in"
          style={{
            background:   'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(2px)',
            zIndex: 10,
            padding: '24px',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
              style={{ background: '#fef2f2' }}>
              <Trash2 size={18} color="#ef4444" />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Delete "{project.name}"?
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              This cannot be undone.
            </p>
          </div>
          <div className="flex gap-2 w-full">
            <button
              data-testid="delete-cancel"
              onClick={e => { e.stopPropagation(); setShowDeleteConfirm(false); }}
              disabled={deleteLoading}
              className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{
                background:  'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color:       'var(--color-text)',
              }}
            >
              Cancel
            </button>
            <button
              data-testid="delete-confirm"
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: deleteLoading ? '#9ca3af' : '#ef4444' }}
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
