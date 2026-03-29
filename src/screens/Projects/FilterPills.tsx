import type { FilterPill } from '@/api/projects';

interface FilterPillsProps {
  active: FilterPill;
  counts: Record<FilterPill, number>;
  onChange: (pill: FilterPill) => void;
}

const PILLS: { id: FilterPill; label: string }[] = [
  { id: 'all',     label: 'All'     },
  { id: 'active',  label: 'Active'  },
  { id: 'paused',  label: 'Paused'  },
  { id: 'stalled', label: 'Stalled' },
  { id: 'shipped', label: 'Shipped' },
];

export function FilterPills({ active, counts, onChange }: FilterPillsProps) {
  return (
    <div data-testid="filter-pills" className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
      {PILLS.map(pill => {
        const isActive = pill.id === active;
        return (
          <button
            key={pill.id}
            onClick={() => onChange(pill.id)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium whitespace-nowrap
              transition-colors shrink-0"
            style={isActive
              ? {
                  background:  'var(--color-accent-light)',
                  color:       'var(--color-accent)',
                  border:      '1.5px solid var(--color-accent)',
                }
              : {
                  background:  'var(--color-surface)',
                  color:       'var(--color-text-muted)',
                  border:      '1.5px solid var(--color-border)',
                }
            }
          >
            {pill.label}
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              style={isActive
                ? { background: 'var(--color-accent)', color: '#fff' }
                : { background: 'var(--color-border)', color: 'var(--color-text-muted)' }
              }
            >
              {counts[pill.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
