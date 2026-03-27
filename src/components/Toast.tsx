import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import type { ToastMessage } from '@/context/ToastContext';

// ── Single toast ──────────────────────────────────────────────────────────

interface ToastProps {
  toast:     ToastMessage;
  onDismiss: (id: string) => void;
}

const CONFIG = {
  success: {
    icon:      CheckCircle2,
    container: 'border-green-200 bg-white',
    icon_cls:  'text-green-500',
    text_cls:  'text-gray-800',
  },
  error: {
    icon:      AlertCircle,
    container: 'border-red-200 bg-white',
    icon_cls:  'text-red-500',
    text_cls:  'text-gray-800',
  },
  info: {
    icon:      Info,
    container: 'border-blue-200 bg-white',
    icon_cls:  'text-blue-500',
    text_cls:  'text-gray-800',
  },
} as const;

function Toast({ toast, onDismiss }: ToastProps) {
  const { icon: Icon, container, icon_cls, text_cls } = CONFIG[toast.type];
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-md
        max-w-sm w-full animate-fade-in ${container}`}
      role="alert"
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${icon_cls}`} aria-hidden="true" />
      <p className={`text-sm font-medium flex-1 leading-snug ${text_cls}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Toast stack (rendered by ToastProvider) ───────────────────────────────

interface ToastStackProps {
  toasts:    ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
