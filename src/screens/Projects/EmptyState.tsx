import { FolderPlus } from 'lucide-react';

interface EmptyStateProps {
  onCreateClick: () => void;
  isFiltered?: boolean;
  filterName?: string;
}

export function EmptyState({ onCreateClick, isFiltered, filterName }: EmptyStateProps) {
  if (isFiltered) {
    return (
      <div data-testid="empty-state" className="col-span-full flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No <strong>{filterName}</strong> projects.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="empty-state" className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Ghost cards behind the CTA card for spatial context */}
      <div className="relative mb-8 w-full max-w-sm">
        <div className="absolute -left-4 top-4 w-full h-32 rounded-2xl border opacity-20"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
        <div className="absolute -right-4 top-8 w-full h-32 rounded-2xl border opacity-10"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />

        {/* Main empty card */}
        <div className="relative rounded-2xl border p-8 flex flex-col items-center gap-3"
          style={{
            background:  'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-accent-light)' }}>
            <FolderPlus size={22} style={{ color: 'var(--color-accent)' }} />
          </div>

          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Start building something
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Projects keep all your screens, features, and bugs in one place.
            </p>
          </div>

          <button
            onClick={onCreateClick}
            className="mt-1 h-9 px-4 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--color-accent)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-accent)')}
          >
            Create your first project
          </button>

          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            You can connect a GitHub repo and set a budget later.
          </p>
        </div>
      </div>
    </div>
  );
}
