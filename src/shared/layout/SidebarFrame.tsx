import React, { useEffect, useRef, useState } from 'react';
import { isEmptySidebarSpace, useSidebarDocked } from './useSidebarToggle';
import { loadFromStorage, saveToStorage } from '@/shared/lib/storage';

export interface SidebarFrameState {
  compact: boolean;
  expanded: boolean;
  /** Closes the sidebar when it floats over the page (narrow windows); a docked sidebar stays open. */
  closeIfFloating: () => void;
}

export const SIDEBAR_MIN_WIDTH = 184;
export const SIDEBAR_MAX_WIDTH = 420;
const clampWidth = (width: number) => Math.round(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)));

/**
 * Shared sidebar rail. It opens and closes only on request (double-click on
 * empty sidebar space or Ctrl+B, handled by useSidebarToggle), never on hover.
 * On wide windows an open sidebar pushes the page panel over; on narrow ones it
 * floats above the page and closes on navigation, Escape or an outside click.
 * Its right edge can be dragged (or moved with the arrow keys) to resize it;
 * the width is remembered on this device and a double-click on the edge
 * restores the default.
 */
export function SidebarFrame({
  collapsed,
  setCollapsed,
  ariaLabel,
  className = '',
  asideClassName = '',
  expandedWidth = 200,
  widthStorageKey = 'sidebar_width',
  onBeforeCollapse,
  children,
}: Readonly<{
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  ariaLabel: string;
  className?: string;
  asideClassName?: string;
  /** Default open width; people can resize from there. */
  expandedWidth?: number;
  widthStorageKey?: string;
  onBeforeCollapse?: () => void;
  children: (state: SidebarFrameState) => React.ReactNode;
}>) {
  const asideRef = useRef<HTMLElement>(null);
  const docked = useSidebarDocked();
  const expanded = !collapsed;
  const compact = !expanded;
  const floating = expanded && !docked;
  const [savedWidth, setSavedWidth] = useState<number | null>(() => {
    const value = loadFromStorage<number | null>(widthStorageKey, null);
    return typeof value === 'number' && Number.isFinite(value) ? clampWidth(value) : null;
  });
  const [resizing, setResizing] = useState(false);
  const width = savedWidth ?? clampWidth(expandedWidth);
  const setWidth = (next: number | null) => {
    const value = next === null ? null : clampWidth(next);
    setSavedWidth(value);
    saveToStorage(widthStorageKey, value);
  };

  const collapse = () => {
    onBeforeCollapse?.();
    setCollapsed(true);
  };

  useEffect(() => {
    if (!floating) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !asideRef.current?.contains(target) && !target.closest('[data-sidebar-overlay]')) collapse();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key !== 'Escape' || event.defaultPrevented
        || (target instanceof Element && target.closest('[data-sidebar-overlay]'))) return;
      collapse();
      requestAnimationFrame(() => asideRef.current?.querySelector<HTMLElement>('[data-sidebar-expand]')?.focus());
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  });

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = width;
    handle.setPointerCapture(event.pointerId);
    setResizing(true);
    document.body.style.cursor = 'col-resize';
    const move = (moveEvent: PointerEvent) => setSavedWidth(clampWidth(startWidth + moveEvent.clientX - startX));
    const end = (endEvent: PointerEvent) => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      document.body.style.cursor = '';
      setResizing(false);
      setWidth(startWidth + endEvent.clientX - startX);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  return <div className={'sidebar-dock relative z-40 h-full flex-shrink-0 select-none overflow-visible ' + (resizing ? 'sidebar-resizing ' : '') + className}
    style={{ width: docked && expanded ? width : 56 }}>
    <aside
      ref={asideRef}
      aria-label={ariaLabel}
      onDoubleClick={event => {
        if (!isEmptySidebarSpace(event.target)) return;
        if (expanded) collapse(); else setCollapsed(false);
      }}
      style={floating ? { width } : undefined}
      // The page panel's left line is the sidebar's edge; only a floating sidebar draws its own.
      // No border unless floating, so the 56px rail's logo and icons sit exactly on its center line.
      className={'sidebar-flyout app-no-drag absolute inset-y-0 left-0 flex h-full flex-col bg-shell font-sans text-sm text-content-secondary '
        + (floating ? 'border-r border-divider shadow-[14px_0_36px_-28px_rgb(var(--ui-overlay)/0.9)] ' : 'w-full shadow-none ') + asideClassName}
    >
      {children({ compact, expanded, closeIfFloating: () => { if (floating) collapse(); } })}
      {expanded && <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={startResize}
        onDoubleClick={event => { event.stopPropagation(); setWidth(null); }}
        onKeyDown={event => {
          const step = event.shiftKey ? 32 : 8;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            setWidth(width + (event.key === 'ArrowRight' ? step : -step));
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            setWidth(event.key === 'Home' ? SIDEBAR_MIN_WIDTH : SIDEBAR_MAX_WIDTH);
          }
        }}
        className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none focus-visible:outline-none"
      >
        <span aria-hidden="true" className={'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover:bg-action/60 group-focus-visible:bg-focus '
          + (resizing ? 'bg-action' : 'bg-transparent')} />
      </div>}
    </aside>
  </div>;
}
