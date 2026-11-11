import { useCallback, useEffect, useState } from 'react';

/** Wide enough for an open sidebar to push the page over instead of floating on top of it. */
export const SIDEBAR_DOCK_QUERY = '(min-width: 1024px)';

type SidebarStorage = Pick<Storage, 'getItem' | 'setItem'>;
const browserStorage = (): SidebarStorage | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage);

/** A sidebar starts closed unless this device remembers it open. */
export const readSidebarOpen = (key: string, storage = browserStorage()) => {
  try { return storage?.getItem(key) === 'open'; } catch { return false; }
};
export const writeSidebarOpen = (key: string, open: boolean, storage = browserStorage()) => {
  try { storage?.setItem(key, open ? 'open' : 'closed'); } catch { /* storage unavailable; state still works for this session */ }
};

/** Ctrl+B, or Cmd+B on macOS, outside rich-text editors (where it means bold). */
export const isSidebarShortcut = (event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'defaultPrevented'> & { target?: EventTarget | null }) =>
  !event.defaultPrevented && !event.altKey && !event.shiftKey && (event.ctrlKey || event.metaKey)
  && event.key.toLowerCase() === 'b'
  && !(typeof HTMLElement !== 'undefined' && event.target instanceof HTMLElement && event.target.isContentEditable);

/**
 * Whether a sidebar is open, remembered per device. The sidebar never opens on
 * hover: people toggle it by double-clicking empty sidebar space or with
 * Ctrl+B (Cmd+B on macOS), which also gives keyboard users a way in.
 */
export function useSidebarToggle(storageKey: string) {
  const [open, setOpenState] = useState(() => readSidebarOpen(storageKey));
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    writeSidebarOpen(storageKey, next);
  }, [storageKey]);
  const toggle = useCallback(() => {
    setOpenState(current => {
      writeSidebarOpen(storageKey, !current);
      return !current;
    });
  }, [storageKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSidebarShortcut(event)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return { open, setOpen, toggle };
}

/** True while the window is wide enough for an open sidebar to push the page over. */
export function useSidebarDocked() {
  const [docked, setDocked] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? true : window.matchMedia(SIDEBAR_DOCK_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(SIDEBAR_DOCK_QUERY);
    const update = () => setDocked(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return docked;
}

/** A double-click toggles the sidebar only on empty space, never on a control inside it. */
export const isEmptySidebarSpace = (target: EventTarget | null) =>
  target instanceof Element && !target.closest('button, a, input, select, textarea, [role="menu"], [role="menuitem"], [role="dialog"]');
