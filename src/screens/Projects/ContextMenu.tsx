import { useEffect, useRef } from 'react';
import { Pencil, Pause, Play, Package, Trash2 } from 'lucide-react';
import type { MenuItem } from '@/api/projects';

interface ContextMenuProps {
  items:   MenuItem[];
  onClose: () => void;
  onSelect: (action: MenuItem['action']) => void;
}

const ICONS: Partial<Record<MenuItem['action'], React.ElementType>> = {
  edit:   Pencil,
  pause:  Pause,
  resume: Play,
  ship:   Package,
  delete: Trash2,
};

export function ContextMenu({ items, onClose, onSelect }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-away or Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-30 min-w-[160px] rounded-xl border py-1
        shadow-card-hover animate-fade-in"
      style={{
        background:  'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.isDivider) {
          return (
            <div
              key={i}
              className="my-1 mx-2 h-px"
              style={{ background: 'var(--color-border)' }}
            />
          );
        }

        const Icon = ICONS[item.action];

        return (
          <button
            key={item.action}
            role="menuitem"
            onClick={() => { onSelect(item.action); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left
              transition-colors"
            style={{
              color: item.destructive ? '#ef4444' : 'var(--color-text)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = item.destructive ? '#fef2f2' : 'var(--color-surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {Icon && <Icon size={14} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
