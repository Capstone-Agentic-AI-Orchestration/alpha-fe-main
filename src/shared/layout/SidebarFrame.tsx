import React, { useEffect, useRef, useState } from 'react';

export interface SidebarFrameState {
  compact: boolean;
  expanded: boolean;
  togglePinned: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/** Shared flyout rail used by the staff app and the separately authenticated client portal. */
export function SidebarFrame({
  collapsed,
  setCollapsed,
  ariaLabel,
  className = '',
  asideClassName = '',
  onBeforeCollapse,
  children,
}: {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  ariaLabel: string;
  className?: string;
  asideClassName?: string;
  onBeforeCollapse?: () => void;
  children: (state: SidebarFrameState) => React.ReactNode;
}) {
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);

  const setPointerInsideAfter = (inside: boolean, delayMs: number) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setIsPointerInside(inside), delayMs);
  };

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const expanded = !collapsed || isPointerInside || isFocusWithin;
  const compact = !expanded;
  const togglePinned = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextCollapsed = !collapsed;
    if (nextCollapsed) {
      onBeforeCollapse?.();
      setIsFocusWithin(false);
      event.currentTarget.blur();
    }
    setCollapsed(nextCollapsed);
  };

  return <div className={`relative z-40 h-full w-[4.5rem] flex-shrink-0 select-none overflow-visible ${className}`}>
    <aside
      aria-label={ariaLabel}
      aria-expanded={expanded}
      onPointerEnter={() => setPointerInsideAfter(true, 90)}
      onPointerLeave={() => setPointerInsideAfter(false, 140)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={event => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) setIsFocusWithin(false);
      }}
      className={`sidebar-flyout app-no-drag absolute inset-y-0 left-0 flex h-full flex-col border-r border-divider bg-shell font-sans text-sm text-content-secondary ${
        expanded ? 'w-64 shadow-[14px_0_36px_-28px_rgb(var(--ui-overlay)/0.9)]' : 'w-[4.5rem] shadow-none'
      } ${asideClassName}`}
    >
      {children({ compact, expanded, togglePinned })}
    </aside>
  </div>;
}
