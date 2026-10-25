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

function storedWidth(): number {
  const value = Number(window.localStorage.getItem(WIDTH_KEY));
  return Number.isFinite(value) && value >= MIN_WIDTH ? value : DEFAULT_WIDTH;
}

/**
 * The chat's right side panel. Each thing opened beside the chat — the plan,
 * an agent, its code changes — gets its own tab, so opening one no longer
 * hides another. The panel's width is dragged from its left edge and remembered.
 */
export const ChatSidePanel: React.FC<{
  tabs: SidePanelTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCloseAll: () => void;
  children: React.ReactNode;
}> = ({ tabs, activeId, onSelect, onClose, onCloseAll, children }) => {
  const [width, setWidth] = useState(storedWidth);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!drag.current) return;
    const max = Math.max(MIN_WIDTH, window.innerWidth * 0.7);
    setWidth(Math.min(max, Math.max(MIN_WIDTH, drag.current.startWidth + drag.current.startX - event.clientX)));
  }, []);
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
  useEffect(() => { window.localStorage.setItem(WIDTH_KEY, String(Math.round(width))); }, [width]);

  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    if (next) { onSelect(next.id); document.getElementById('chat-side-tab-' + next.id)?.focus(); }
  };

  return <aside id="chat-side-panel" aria-label="Side panel" style={{ '--chat-panel-width': width + 'px' } as React.CSSProperties} className="relative flex h-full w-[var(--chat-panel-width)] max-w-full shrink-0 flex-col border-l border-white/[0.08] bg-shell max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:w-full">
    <div role="separator" aria-orientation="vertical" aria-label="Resize side panel" tabIndex={0}
      onPointerDown={event => { drag.current = { startX: event.clientX, startWidth: width }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
      onKeyDown={event => { if (event.key === 'ArrowLeft') setWidth(value => value + 24); if (event.key === 'ArrowRight') setWidth(value => Math.max(MIN_WIDTH, value - 24)); }}
      className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-violet-300/20 focus-visible:bg-violet-300/30 focus-visible:outline-none" />
    <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.07] px-2 py-1.5">
      <div role="tablist" aria-label="Open panels" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab, index) => {
          const active = tab.id === activeId;
          return <div key={tab.id} className={'group flex min-w-0 max-w-[13rem] shrink-0 items-center rounded-lg border text-[11px] transition-colors ' + (active ? 'border-white/[0.12] bg-white/[0.07] text-white' : 'border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-gray-200')}>
            <button type="button" role="tab" id={'chat-side-tab-' + tab.id} aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => onSelect(tab.id)} onKeyDown={event => onTabKeyDown(event, index)}
              onAuxClick={event => { if (event.button === 1) onClose(tab.id); }}
              className="flex min-w-0 items-center gap-1.5 py-1.5 pl-2.5 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 rounded-l-lg">
              <span className="shrink-0 text-gray-400">{tab.icon}</span>
              <span className={'truncate ' + (active ? '' : '')}>{tab.title}</span>
              {tab.live && <span aria-label="working" className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300 motion-safe:animate-pulse" />}
            </button>
            <button type="button" onClick={() => onClose(tab.id)} aria-label={'Close ' + tab.title} className={'mr-1 shrink-0 rounded p-0.5 text-gray-500 hover:bg-white/10 hover:text-white ' + (active ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}><X className="h-3 w-3" /></button>
          </div>;
        })}
      </div>
      <button type="button" onClick={onCloseAll} aria-label="Hide side panel" title="Hide side panel" className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button>
    </div>
    <div role="tabpanel" aria-labelledby={activeId ? 'chat-side-tab-' + activeId : undefined} className="flex min-h-0 flex-1 flex-col">{children}</div>
  </aside>;
};

