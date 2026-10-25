import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Matches the conversation rail: an edge target that reveals its centered handle on hover/focus. */
export function ChatPanelHandle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return <div data-chat-panel-edge className="group relative flex h-full w-12 shrink-0 items-center justify-center">
    <button id="chat-panel-toggle" type="button" aria-controls="chat-side-panel" aria-expanded={open}
      aria-label={open ? 'Hide side panel' : 'Open side panel'} title={open ? 'Hide side panel' : 'Open side panel'} onClick={onToggle}
      className="flex h-16 w-5 items-center justify-center rounded-full border border-divider bg-surface-raised/90 text-content-secondary opacity-0 shadow-lg shadow-black/40 transition-all duration-200 hover:border-divider hover:text-content group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [@media(hover:none)]:opacity-100 motion-reduce:transition-none">
      {open ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
    </button>
  </div>;
}
