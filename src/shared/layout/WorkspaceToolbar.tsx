import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';

/** Shared workspace chrome; each persona supplies its own destinations and actions. */
export function WorkspaceToolbar({ children, actions, draggable = false }: {
  children: ReactNode;
  actions: ReactNode;
  draggable?: boolean;
}) {
  return <div className={`pointer-events-auto mx-auto flex w-full max-w-[1800px] items-center gap-1.5 rounded-2xl border border-divider bg-surface/80 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-content/[0.04] ${draggable ? 'app-drag-region' : ''}`}>
    {children}
    <div className="app-no-drag ml-auto flex flex-shrink-0 items-center gap-2">{actions}</div>
  </div>;
}

export function WorkspaceTabStrip({ children, label }: { children: ReactNode; label: string }) {
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const revealActive = () => stripRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(revealActive) : null;
    if (stripRef.current) observer?.observe(stripRef.current);
    return () => observer?.disconnect();
  }, []);
  return <div ref={stripRef} role="tablist" aria-label={label}
    className="workspace-tab-strip app-no-drag flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar"
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return;
      const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
      const current = tabs.indexOf(event.target);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[next]?.focus();
      tabs[next]?.click();
    }}>
    {children}
  </div>;
}

export function WorkspaceTab({ active, title, icon, onActivate, onClose, closable = true, controls }: {
  active: boolean;
  title: string;
  icon: ReactNode;
  onActivate: () => void;
  onClose?: () => void;
  closable?: boolean;
  controls?: string;
}) {
  const tabRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) tabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return <div ref={tabRef} onClick={onActivate}
    onFocus={event => {
      if (event.target === event.currentTarget) event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }}
    onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onActivate();
      }
    }}
    onMouseDown={event => {
      if (event.button === 1 && onClose) {
        event.preventDefault();
        onClose();
      }
    }}
    role="tab" aria-selected={active} aria-controls={controls} tabIndex={active ? 0 : -1} title={title}
    className={`group flex h-9 min-w-[112px] max-w-[220px] cursor-pointer select-none items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all ${active
      ? 'border-divider bg-selected text-selected-content shadow-sm'
      : 'border-transparent text-content-muted hover:bg-surface-high hover:text-content'}`}>
    <span className={`flex-shrink-0 ${active ? 'text-link' : 'text-content-muted group-hover:text-content-secondary'}`}>{icon}</span>
    <span className="truncate flex-1 text-left">{title}</span>
    {onClose && closable && <button type="button" onClick={event => { event.stopPropagation(); onClose(); }}
      className="rounded-md p-1 text-content-muted opacity-0 transition-all hover:bg-surface-high hover:text-content focus:opacity-100 group-hover:opacity-100"
      title="Close tab" aria-label={`Close ${title} tab`}><X className="w-3 h-3" /></button>}
  </div>;
}

export function WorkspaceNewTabMenu({ items, onSelect, boundaryRef, portalRootRef, disabled = false }: {
  items: Array<{ id: string; title: string; subtitle: string; icon: ReactNode }>;
  onSelect: (id: string) => void;
  boundaryRef?: RefObject<HTMLElement>;
  portalRootRef?: RefObject<HTMLElement>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => { setOpen(false); buttonRef.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!buttonRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    const update = () => {
      const button = buttonRef.current?.getBoundingClientRect();
      if (!button) return;
      const boundary = boundaryRef?.current?.getBoundingClientRect();
      const leftEdge = Math.max(12, boundary?.left ?? 12);
      const rightEdge = Math.min(window.innerWidth - 12, boundary?.right ?? window.innerWidth - 12);
      const width = Math.min(288, Math.max(0, rightEdge - leftEdge));
      const top = Math.max(12, Math.min(button.bottom + 8, window.innerHeight - 160));
      setPosition({ top, left: Math.min(Math.max(leftEdge, button.left), rightEdge - width), width, maxHeight: Math.max(0, window.innerHeight - top - 12) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (boundaryRef?.current) observer?.observe(boundaryRef.current);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); observer?.disconnect(); };
  }, [open, boundaryRef]);

  useEffect(() => { if (open && position) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(); }, [open, Boolean(position)]);

  return <div className="app-no-drag relative flex-shrink-0">
    <button type="button" ref={buttonRef} disabled={disabled} onClick={() => setOpen(value => !value)}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-50 ${open ? 'bg-selected text-selected-content' : 'text-content-secondary hover:bg-surface-high hover:text-content'}`}
      title="Open new tab" aria-label="Open new tab" aria-expanded={open} aria-haspopup="menu"><Plus className="w-4 h-4" /></button>
    {open && position && createPortal(<div ref={menuRef} role="menu" aria-label="Open new tab" style={position}
      onKeyDown={event => {
        if (event.key === 'Tab') { setOpen(false); return; }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const choices = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
        const current = choices.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
        event.preventDefault(); choices[next]?.focus();
      }}
      className="fixed z-[60] flex flex-col gap-1 overflow-hidden rounded-2xl border border-divider bg-surface p-2 font-sans text-sm shadow-2xl animate-slide-up">
      <div className="px-2.5 py-1 text-xs font-medium text-content-muted">Open new tab</div>
      <div className="max-h-80 min-h-0 space-y-0.5 overflow-y-auto">{items.map(item => <button type="button" key={item.id} role="menuitem"
        onClick={() => { close(); onSelect(item.id); }} className="flex w-full items-center justify-between rounded-xl p-2 text-left text-content-secondary transition-colors hover:bg-surface-high hover:text-content">
        <div className="flex min-w-0 items-center gap-2.5"><div className="flex-shrink-0 p-1 text-content-muted">{item.icon}</div><div className="min-w-0">
          <div className="truncate text-xs font-medium">{item.title}</div><div className="truncate text-[10px] text-content-muted">{item.subtitle}</div>
        </div></div>
      </button>)}</div>
    </div>, portalRootRef?.current ?? document.body)}
  </div>;
}
