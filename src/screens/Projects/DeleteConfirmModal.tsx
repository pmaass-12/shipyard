import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  projectName: string;
  loading:     boolean;
  onConfirm:   () => void;
  onCancel:    () => void;
}

export function DeleteConfirmModal({
  projectName, loading, onConfirm, onCancel,
}: DeleteConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-6 shadow-xl animate-fade-in"
        style={{
          background:  'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <h2 id="delete-title" className="text-base font-semibold"
            style={{ color: 'var(--color-text)' }}>
            Delete "{projectName}"?
          </h2>
        </div>

        <p id="delete-desc" className="text-sm mb-6"
          style={{ color: 'var(--color-text-muted)' }}>
          This will permanently remove all screens, features, and bugs for this project.
          This cannot be undone.
        </p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="h-9 px-4 rounded-lg text-sm font-medium transition-colors"
            style={{
              background:  'var(--color-surface)',
              color:       'var(--color-text)',
              border:      '1px solid var(--color-border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-white
              bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {loading ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>
    </div>
  );
}
