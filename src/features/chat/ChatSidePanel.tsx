import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export interface SidePanelTab {
  id: string;
  title: string;
  icon: React.ReactNode;
  /** A small live dot, for an agent that is working. */
  live?: boolean;
}

const WIDTH_KEY = 'alpha.chatSidePanelWidth';
const MIN_WIDTH = 340;
const DEFAULT_WIDTH = 480;

function storedWidth(key: string, fallback: number, min: number): number {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value >= min ? value : fallback;
}

/**
 * The chat's right side panel. Each thing opened beside the chat — the plan,
 * an agent, its code changes — gets its own tab, so opening one no longer
 * hides another. The panel's width is dragged from its left edge and remembered.
 */
/** The heading of a sheet: what it shows, and a dot while it is live. */
function SheetTitle({ tab }: { tab: SidePanelTab }) {
  return <h2 className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-content">
    <span className="shrink-0 text-content-secondary">{tab.icon}</span>
    <span className="truncate">{tab.title}</span>
    {tab.live && <span aria-label="working" className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300 motion-safe:animate-pulse" />}
  </h2>;
}

/** A sheet's close button closes what it shows; the tabbed panel's hides the panel. */
function closeLabels(sheet: SidePanelTab | undefined): { 'aria-label': string; title: string } {
  if (sheet) return { 'aria-label': 'Close ' + sheet.title, title: 'Close (Esc)' };
  return { 'aria-label': 'Hide side panel', title: 'Hide side panel' };
}

export const ChatSidePanel: React.FC<{
  tabs: SidePanelTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCloseAll: () => void;
  /** Panels can use a separate remembered width and a narrower initial size. */
  widthStorageKey?: string;
  defaultWidth?: number;
  minWidth?: number;
  /** Slides the panel open when it mounts, or shut while it is closing. */
  motion?: 'opening' | 'closing';
  /**
   * 'inset' (chat): the tab row shares the page header's line, with no strip of
   * its own, and the content sits in a panel with a curved top-left corner like
   * the main page panel. 'sheet' is inset with one thing in it: its title and a
   * close button instead of tabs. 'boxed' keeps the bordered header used on the board.
   */
  variant?: 'boxed' | 'inset' | 'sheet';
  children: React.ReactNode;
}> = ({ tabs, activeId, onSelect, onClose, onCloseAll, widthStorageKey = WIDTH_KEY, defaultWidth = DEFAULT_WIDTH, minWidth = MIN_WIDTH, motion, variant = 'boxed', children }) => {
  const inset = variant !== 'boxed';
  const sheet = variant === 'sheet' ? tabs.find(tab => tab.id === activeId) ?? tabs[0] : undefined;
  const [width, setWidth] = useState(() => storedWidth(widthStorageKey, defaultWidth, minWidth));
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!drag.current) return;
    const max = Math.max(minWidth, window.innerWidth * 0.7);
    setWidth(Math.min(max, Math.max(minWidth, drag.current.startWidth + drag.current.startX - event.clientX)));
  }, [minWidth]);
  const onPointerUp = useCallback(() => {
    drag.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);
  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => { window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); };
  }, [onPointerMove, onPointerUp]);
  useEffect(() => { window.localStorage.setItem(widthStorageKey, String(Math.round(width))); }, [width, widthStorageKey]);

  const tabStrip = <TabStrip tabs={tabs} activeId={activeId} onSelect={onSelect} onClose={onClose} />;
  const motionClass = motion ? 'chat-panel-' + motion : '';

  return <aside id="chat-side-panel" aria-label="Side panel" aria-hidden={motion === 'closing' || undefined} style={{ '--chat-panel-width': width + 'px' } as React.CSSProperties} className={'relative flex h-full w-[var(--chat-panel-width)] max-w-full shrink-0 flex-col bg-shell max-md:absolute ' + (inset ? 'max-md:border-l max-md:border-divider' : 'border-l border-divider') + ' max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:w-full ' + motionClass}>
    <div role="separator" aria-orientation="vertical" aria-label="Resize side panel" tabIndex={0}
      onPointerDown={event => { drag.current = { startX: event.clientX, startWidth: width }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
      onKeyDown={event => { if (event.key === 'ArrowLeft') setWidth(value => value + 24); if (event.key === 'ArrowRight') setWidth(value => Math.max(minWidth, value - 24)); }}
      className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-selected focus-visible:bg-selected focus-visible:outline-none" />
    {/* The inset frame's left edge curves into the page panel's top line, like the page's own corner. */}
    {inset ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-xl border-l border-divider">
      <div className="flex h-14 shrink-0 items-center gap-1 px-3">
        {sheet ? <SheetTitle tab={sheet} /> : tabStrip}
        <button type="button" onClick={onCloseAll} {...closeLabels(sheet)} className="shrink-0 rounded-lg p-1.5 text-content-muted hover:bg-surface-high hover:text-content"><X className="h-4 w-4" /></button>
      </div>
      <div {...panelBodyProps(sheet, activeId)} className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div> : <>
    <div className="flex shrink-0 items-center gap-1 border-b border-divider px-2 py-1.5">
      {tabStrip}
      <button type="button" onClick={onCloseAll} {...closeLabels(undefined)} className="shrink-0 rounded-lg p-1.5 text-content-muted hover:bg-surface-high hover:text-content"><X className="h-4 w-4" /></button>
    </div>
    <div {...panelBodyProps(undefined, activeId)} className="flex min-h-0 flex-1 flex-col">{children}</div>
    </>}
  </aside>;
};

/** A sheet's body is plain content; the tabbed panel's belongs to its selected tab. */
function panelBodyProps(sheet: SidePanelTab | undefined, activeId: string | null): React.HTMLAttributes<HTMLDivElement> {
  if (sheet) return {};
  return { role: 'tabpanel', 'aria-labelledby': activeId ? 'chat-side-tab-' + activeId : undefined };
}

/** One tab per thing opened beside the chat; arrow keys move between them. */
function TabStrip({ tabs, activeId, onSelect, onClose }: {
  tabs: SidePanelTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    if (next) { onSelect(next.id); document.getElementById('chat-side-tab-' + next.id)?.focus(); }
  };
  return <div role="tablist" aria-label="Open panels" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
    {tabs.map((tab, index) => {
      const active = tab.id === activeId;
      return <div key={tab.id} className={'group flex min-w-0 max-w-[13rem] shrink-0 items-center rounded-lg border text-[11px] transition-colors ' + (active ? 'border-divider bg-surface-raised text-content' : 'border-transparent text-content-secondary hover:bg-surface-high hover:text-content')}>
        <button type="button" role="tab" id={'chat-side-tab-' + tab.id} aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => onSelect(tab.id)} onKeyDown={event => onTabKeyDown(event, index)}
          onAuxClick={event => { if (event.button === 1) onClose(tab.id); }}
          className="flex min-w-0 items-center gap-1.5 py-1.5 pl-2.5 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-l-lg">
          <span className="shrink-0 text-content-secondary">{tab.icon}</span>
          <span className="truncate">{tab.title}</span>
          {tab.live && <span aria-label="working" className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300 motion-safe:animate-pulse" />}
        </button>
        <button type="button" onClick={() => onClose(tab.id)} aria-label={'Close ' + tab.title} className={'mr-1 shrink-0 rounded p-0.5 text-content-muted hover:bg-surface-high hover:text-content ' + (active ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}><X className="h-3 w-3" /></button>
      </div>;
    })}
  </div>;
}

