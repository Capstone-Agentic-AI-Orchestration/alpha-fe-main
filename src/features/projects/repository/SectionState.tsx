import React from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

/**
 * The frame every repository section shares: a heading, optional actions,
 * and one of loading / error / empty / content.
 */
export const RepoSection: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ id, title, icon, actions, children, className = '' }) => (
  <section aria-labelledby={id} className={`min-w-0 rounded-xl border border-white/[0.06] bg-surface-200/50 ${className}`}>
    <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
      <h3 id={id} className="flex items-center gap-1.5 text-[11px] font-medium text-gray-300">
        {icon}
        {title}
      </h3>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
    <div className="min-w-0">{children}</div>
  </section>
);

export const SectionLoading: React.FC<{ label: string }> = ({ label }) => (
  <p role="status" className="flex items-center gap-2 px-3.5 py-4 text-[11px] text-gray-500">
    <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
    {label}
  </p>
);

export const SectionError: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div role="alert" className="flex items-start justify-between gap-3 px-3.5 py-3">
    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-300">
      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
      <span className="break-words">{message}</span>
    </p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
      >
        Try again
      </button>
    )}
  </div>
);

export const SectionEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="px-3.5 py-4 text-[11px] text-gray-500">{children}</p>
);

export const RefreshButton: React.FC<{ onClick: () => void; loading: boolean; label: string }> = ({
  onClick,
  loading,
  label
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    aria-label={label}
    title={label}
    className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
  >
    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
  </button>
);
