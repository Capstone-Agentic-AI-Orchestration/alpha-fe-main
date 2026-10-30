import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export type ToastTone = 'success' | 'error' | 'info';

export function Toast({ title, description, tone = 'info', onDismiss, className = '' }: {
  title: string;
  description?: string;
  tone?: ToastTone;
  onDismiss?: () => void;
  className?: string;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info;
  const iconClass = tone === 'success' ? 'text-status-success' : tone === 'error' ? 'text-status-danger' : 'text-status-info';
  return <div role="status" className={twMerge('flex items-start gap-3 border border-divider bg-surface px-4 py-3 text-content shadow-2xl', className)}>
    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden="true" />
    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p>{description && <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">{description}</p>}</div>
    {onDismiss && <button type="button" onClick={onDismiss} className="shrink-0 p-0.5 text-content-muted transition-colors hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label="Dismiss notification"><X className="h-3.5 w-3.5" /></button>}
  </div>;
}
