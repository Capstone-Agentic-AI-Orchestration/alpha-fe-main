import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerMeta?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  dialogClassName?: string;
  contentClassName?: string;
  footer?: React.ReactNode;
  /** Keep the dialog open while a save or other blocking operation is running. */
  closeDisabled?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerMeta,
  children,
  maxWidth = 'max-w-2xl',
  dialogClassName = '',
  contentClassName,
  footer,
  closeDisabled = false
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) onCloseRef.current();
      if (e.key === 'Tab') {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(item => item.getClientRects().length);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus({ preventScroll: true }); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    const focusTimer = window.setTimeout(() => {
      if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [isOpen, closeDisabled]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={closeDisabled ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ width: 'calc(100vw - 2rem)' }}
        className={`relative ${maxWidth} ${dialogClassName} bg-surface-100 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10 animate-slide-up flex flex-col max-h-[90vh] focus:outline-none`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between p-5 border-b border-white/10 bg-surface-200/50">
          <div>
            <h3 id={titleId} className="text-lg font-semibold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            {headerMeta}
          </div>
          <button
            onClick={onClose}
            disabled={closeDisabled}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className={`min-h-0 ${contentClassName ?? 'p-5 sm:p-6 overflow-y-auto overscroll-contain space-y-4'}`}>
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-white/10 bg-surface-200/50 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
};
