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
          ? 'text-emerald-400'
          : toast.tone === 'error'
            ? 'text-rose-400'
            : 'text-brand-400';

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 border border-white/[0.09] bg-surface px-4 py-3 shadow-2xl"
            role="status"
          >
            <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconColor}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="p-0.5 text-gray-500 transition-colors hover:text-white"
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
