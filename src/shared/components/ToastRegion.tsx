import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '@/app/AppContext';

export const ToastRegion: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[calc(100%-2.5rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => {
        const Icon = toast.tone === 'success'
          ? CheckCircle2
          : toast.tone === 'error'
            ? AlertCircle
            : Info;
        const iconColor = toast.tone === 'success'
          ? 'text-status-success'
          : toast.tone === 'error'
            ? 'text-status-danger'
            : 'text-status-info';

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 border border-divider bg-surface px-4 py-3 shadow-2xl"
            role="status"
          >
            <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconColor}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-content">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="p-0.5 text-content-muted transition-colors hover:text-content"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
