import React, { useEffect, useRef } from 'react';
import { isEmptySidebarSpace, useSidebarDocked } from './useSidebarToggle';

export interface SidebarFrameState {
  compact: boolean;
  expanded: boolean;
  /** Closes the sidebar when it floats over the page (narrow windows); a docked sidebar stays open. */
  closeIfFloating: () => void;
}

/**
 * Shared sidebar rail. It opens and closes only on request (double-click on
 * empty sidebar space or Ctrl+B, handled by useSidebarToggle), never on hover.
 * On wide windows an open sidebar pushes the page panel over; on narrow ones it
 * floats above the page and closes on navigation, Escape or an outside click.
 */
export function SidebarFrame({
  collapsed,
  setCollapsed,
  ariaLabel,
  className = '',
  asideClassName = '',
  onBeforeCollapse,
  children,
}: Readonly<{
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  ariaLabel: string;
  className?: string;
  asideClassName?: string;
  onBeforeCollapse?: () => void;
  children: (state: SidebarFrameState) => React.ReactNode;
}>) {
  const asideRef = useRef<HTMLElement>(null);
  const docked = useSidebarDocked();
  const expanded = !collapsed;
  const compact = !expanded;
  const floating = expanded && !docked;

  const collapse = () => {
    onBeforeCollapse?.();
    setCollapsed(true);
  };

  useEffect(() => {
    if (!floating) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!asideRef.current?.contains(event.target as Node)) collapse();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') collapse(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  });

  return <div className={`sidebar-dock relative z-40 h-full flex-shrink-0 select-none overflow-visible ${docked && expanded ? 'w-[232px]' : 'w-[56px]'} ${className}`}>
    <aside
      ref={asideRef}
      aria-label={ariaLabel}
      onDoubleClick={event => {
        if (!isEmptySidebarSpace(event.target)) return;
        if (expanded) collapse(); else setCollapsed(false);
      }}
      // The page panel's left line is the sidebar's edge; only a floating sidebar draws its own.
      // No border unless floating, so the 56px rail's logo and icons sit exactly on its center line.
      className={`sidebar-flyout app-no-drag absolute inset-y-0 left-0 flex h-full flex-col bg-shell font-sans text-sm text-content-secondary ${
        floating ? 'w-[232px] border-r border-divider shadow-[14px_0_36px_-28px_rgb(var(--ui-overlay)/0.9)]' : 'w-full shadow-none'
      } ${asideClassName}`}
    >
      {children({ compact, expanded, closeIfFloating: () => { if (floating) collapse(); } })}
    </aside>
  </div>;
}
