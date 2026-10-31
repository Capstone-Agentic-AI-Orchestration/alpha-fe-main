import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, ChevronRight, FileText, FolderKanban, X } from 'lucide-react';
import type { ClientProject, ClientProjectRequestItem } from './clientApi';
import { time } from './ticketUi';

export type ClientPortalUpdate = {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  target: { kind: 'request'; item: ClientProjectRequestItem } | { kind: 'project'; item: ClientProject };
};

interface PopoverPosition { top: number; left: number; width: number; maxHeight: number }

export function ClientNotificationBell({ email, updates, ready, loading, error, onRefresh, onOpen }: {
  email: string;
  updates: ClientPortalUpdate[];
  ready: boolean;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onOpen: (update: ClientPortalUpdate) => void;
}) {
  const storageKey = email.trim() ? `alpha.client-updates.v1:${email.trim().toLowerCase()}` : null;
  const scope = storageKey ?? 'volatile-client';
  const [open, setOpen] = useState(false);
  const [readState, setReadState] = useState<{ scope: string; ids: string[] }>({ scope: '', ids: [] });
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const updatesRef = useRef(updates);
  updatesRef.current = updates;

  useEffect(() => {
    if (!ready) return;
    try {
      const saved = storageKey ? localStorage.getItem(storageKey) : null;
      if (saved === null) {
        const ids = updatesRef.current.map(update => update.id).slice(0, 250);
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(ids));
        setReadState({ scope, ids });
        return;
      }
      const parsed: unknown = JSON.parse(saved);
      setReadState({ scope, ids: Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 250) : [] });
    } catch {
      setReadState({ scope, ids: [] });
    }
  }, [ready, scope, storageKey]);

  const readIds = useMemo(() => new Set(readState.scope === scope ? readState.ids : []), [readState, scope]);
  const unreadCount = updates.reduce((count, update) => count + (readIds.has(update.id) ? 0 : 1), 0);

  function saveReadIds(ids: string[]) {
    const unique = [...new Set(ids)].slice(0, 250);
    setReadState({ scope, ids: unique });
    try { if (storageKey) localStorage.setItem(storageKey, JSON.stringify(unique)); } catch { /* Reading state remains available for this session. */ }
  }

  function markRead(id: string) {
    if (!readIds.has(id)) saveReadIds([id, ...readState.ids]);
  }

  function markAllRead() {
    saveReadIds(updates.map(update => update.id));
  }

  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const edge = 12;
      const width = Math.min(380, Math.max(0, window.innerWidth - edge * 2));
      const top = Math.max(edge, Math.min(rect.bottom + 8, window.innerHeight - 220));
      setPosition({
        top,
        left: Math.min(Math.max(edge, rect.right - width), window.innerWidth - width - edge),
        width,
        maxHeight: Math.max(0, Math.min(560, window.innerHeight - top - edge)),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => { window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" className="client-portal-action client-notification-trigger"
      aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'} title="Notifications and updates"
      aria-expanded={open} aria-haspopup="dialog" aria-controls="client-notification-panel" onClick={() => setOpen(value => !value)}>
      <Bell size={17} aria-hidden="true" />
      {unreadCount > 0 && <span className="client-notification-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && position && createPortal(<section ref={panelRef} id="client-notification-panel" role="dialog" aria-label="Client notifications and updates"
      aria-modal="false" tabIndex={-1} style={{ position: 'fixed', top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}
      className="client-notification-popover">
      <header className="client-notification-header">
        <div><h2>Updates</h2><p>{unreadCount ? `${unreadCount} unread` : 'You’re up to date'}</p></div>
        <div className="client-notification-header-actions">
          <button type="button" onClick={markAllRead} disabled={!unreadCount} title="Mark all updates as read"><CheckCheck size={15} /><span>Mark all read</span></button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close updates"><X size={16} /></button>
        </div>
      </header>
      {error && <div role="alert" className="client-notification-error"><span>{error}</span><button type="button" onClick={onRefresh}>Try again</button></div>}
      <div className="client-notification-list" aria-live="polite">
        {loading && !updates.length ? <p role="status" className="client-notification-empty">Loading your updates…</p>
          : updates.length ? updates.map(update => {
            const isUnread = !readIds.has(update.id);
            const Icon = update.target.kind === 'request' ? FileText : FolderKanban;
            return <button type="button" key={update.id} className={`client-notification-item ${isUnread ? 'is-unread' : ''}`}
              onClick={() => { markRead(update.id); setOpen(false); onOpen(update); }}>
              <span className="client-notification-icon"><Icon size={16} aria-hidden="true" /></span>
              <span className="client-notification-copy"><strong>{update.title}</strong><span>{update.message}</span><time dateTime={update.timestamp}>{time(update.timestamp)}</time></span>
              {isUnread ? <span className="client-notification-unread-dot" aria-label="Unread" /> : <ChevronRight size={15} className="client-notification-chevron" aria-hidden="true" />}
            </button>;
          }) : <div className="client-notification-empty"><Bell size={20} /><strong>No updates yet</strong><span>Project and request updates will appear here.</span></div>}
      </div>
      {ready && !loading && !error && <footer className="client-notification-footer">Updates from your shared projects and requests</footer>}
    </section>, triggerRef.current?.closest('.client-portal-shell') ?? document.body)}
  </>;
}
