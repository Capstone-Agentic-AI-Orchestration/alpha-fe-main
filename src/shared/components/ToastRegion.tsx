import React from 'react';
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, XIcon } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';

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
          ? CheckCircle2Icon
          : toast.tone === 'error'
            ? AlertCircleIcon
            : InfoIcon;
        const toneClasses = toast.tone === 'success'
          ? 'border-status-success-border bg-status-success-subtle [&>svg]:text-status-success'
          : toast.tone === 'error'
            ? 'border-status-danger-border bg-status-danger-subtle [&>svg]:text-status-danger'
            : 'border-status-info-border bg-status-info-subtle [&>svg]:text-status-info';

        return (
          <Alert
            key={toast.id}
            className={`pointer-events-auto pr-11 ${toneClasses}`}
            role="status"
          >
            <Icon aria-hidden="true" />
            <AlertTitle>{toast.title}</AlertTitle>
            {toast.description && <AlertDescription>{toast.description}</AlertDescription>}
            <Button
              type="button"
              onClick={() => dismissToast(toast.id)}
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-7 w-7 rounded-md text-content-muted hover:text-content"
              aria-label="Dismiss notification"
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </Alert>
        );
      })}
    </div>
  );
};
