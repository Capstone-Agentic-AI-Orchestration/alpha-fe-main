import { useCallback, useId, useState, type ReactNode } from 'react';
import { ChevronDown, Flag, ListChecks, Minus, Monitor, Plus } from 'lucide-react';
import './pmTickets.css';

/**
 * The PM's scrollable side panel beside a project conversation.
 * Ticket context comes first, followed by the project stage and preview.
 */

const RAIL_STORAGE = 'alpha.pm.rail.';

/** Whether a folding card is open, remembered on this device; open the first time unless told otherwise. */
export function usePmRailCollapsible(id: string, initiallyOpen = true): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(() => {
    try {
      const saved = window.localStorage.getItem(RAIL_STORAGE + id);
      return saved === null ? initiallyOpen : saved === '1';
    } catch { return initiallyOpen; }
  });
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try { window.localStorage.setItem(RAIL_STORAGE + id, next ? '1' : '0'); } catch { /* Storage can be unavailable; the choice lasts for this page. */ }
  }, [id]);
  return [open, setOpen];
}

/** A card in the panel: an icon and a title, then its content. */
export function PmRailCard({ icon, title, aside, children, label }: Readonly<{
  icon: ReactNode; title: ReactNode; aside?: ReactNode; children?: ReactNode; label?: string;
}>) {
  return <section className="pm-rail-card" aria-label={label}>
    <h2 className="pm-rail-card__head">
      <span className="pm-rail-card__icon" aria-hidden="true">{icon}</span>
      <span className="pm-rail-card__title">{title}</span>
      {aside}
    </h2>
    {children}
  </section>;
}

/** A card the PM can fold away; its title is the toggle. */
export function PmCollapsibleRailCard({ id, icon, title, aside, children, initiallyOpen = true, nested = false }: Readonly<{
  id: string; icon: ReactNode; title: ReactNode; aside?: ReactNode; children: ReactNode; initiallyOpen?: boolean; nested?: boolean;
}>) {
  const [open, setOpen] = usePmRailCollapsible(id, initiallyOpen);
  const bodyId = useId();
  const [mounted, setMounted] = useState(open);
  const Heading = nested ? 'h3' : 'h2';
  return <section className={'pm-rail-card is-collapsible' + (open ? ' is-open' : '') + (nested ? ' is-nested' : '')}>
    <Heading className="pm-rail-card__head">
      <button type="button" className="pm-rail-card__toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => { if (!open) setMounted(true); setOpen(!open); }}>
        <span className="pm-rail-card__icon" aria-hidden="true">{icon}</span>
        <span className="pm-rail-card__title">{title}</span>
        {aside}
        {nested ? <ChevronDown size={14} aria-hidden="true" className="pm-rail-card__chevron" />
          : open ? <Minus size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
      </button>
    </Heading>
    <div id={bodyId} hidden={!open} className="pm-rail-card__body">{mounted && children}</div>
  </section>;
}

export interface PmConversationRailProps {
  projectName: string;
  /** The stage card: its title (the stage's name) and its body, or null when the project has no stage yet. */
  stage?: { title: string; prompt?: string | null; content: ReactNode } | null;
  /** Whether a preview is shared with the client; undefined hides the card. */
  previewShared?: boolean;
  ticketsTitle: string;
  tickets: ReactNode;
  selected?: ReactNode;
}

/** Tickets first, followed by project-level context. */
export function PmConversationRail({ projectName, stage, previewShared, ticketsTitle, tickets, selected }: Readonly<PmConversationRailProps>) {
  return <aside className="pm-rail" aria-label={`Project tickets and details for ${projectName}`}>
    <section className="pm-rail-tickets" aria-label="Tickets">
      <h2 className="pm-rail-card__head">
        <ListChecks size={16} className="pm-rail-card__icon" aria-hidden="true" />
        <span>{ticketsTitle}</span>
      </h2>
      {tickets}
    </section>
    {selected}
    {stage && <PmCollapsibleRailCard id="stage" icon={<Flag size={16} />} title={stage.title}>
      {stage.prompt && <p className="pm-rail-note is-attention">{stage.prompt}</p>}
      {stage.content}
    </PmCollapsibleRailCard>}
    {previewShared !== undefined && <PmRailCard icon={<Monitor size={16} />} title="Preview"
      aside={<span className={'pm-rail-pill' + (previewShared ? ' is-success' : '')}>{previewShared ? 'Shared' : 'Not shared'}</span>}>
      <p className="pm-rail-note">{previewShared
        ? 'The client can try the latest version you shared, beside this conversation.'
        : 'Nothing shared yet. Once you share a version, the client sees it beside this conversation.'}</p>
    </PmRailCard>}
  </aside>;
}
