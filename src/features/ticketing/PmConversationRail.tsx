import { useCallback, useId, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ClipboardCheck, Flag, Hammer, Inbox, ListChecks, Monitor, Sparkles } from 'lucide-react';
import type { ClientProgressStep } from './clientProgressSteps';
import './pmTickets.css';

/**
 * The PM's side panel beside a project conversation, laid out like the client's:
 * one scrolling column of cards (stage, preview, tickets, then the picked ticket),
 * with no tab strip. The client panel's classes and tokens stay on client pages; this
 * uses the staff theme with the same structure and spacing.
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
export function PmCollapsibleRailCard({ id, icon, title, aside, children, initiallyOpen = true }: Readonly<{
  id: string; icon: ReactNode; title: ReactNode; aside?: ReactNode; children: ReactNode; initiallyOpen?: boolean;
}>) {
  const [open, setOpen] = usePmRailCollapsible(id, initiallyOpen);
  const bodyId = useId();
  return <section className={'pm-rail-card is-collapsible' + (open ? ' is-open' : '')}>
    <h2 className="pm-rail-card__head">
      <button type="button" className="pm-rail-card__toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
        <span className="pm-rail-card__icon" aria-hidden="true">{icon}</span>
        <span className="pm-rail-card__title">{title}</span>
        {aside}
        <ChevronDown size={16} aria-hidden="true" className="pm-rail-card__chevron" />
      </button>
    </h2>
    <div id={bodyId} hidden={!open} className="pm-rail-card__body">{children}</div>
  </section>;
}

const STEP_ICONS = [Inbox, ClipboardCheck, Hammer, Sparkles, Flag];
const STATE_TEXT = { done: 'Complete', current: 'Now', upcoming: 'Not started' } as const;

/** The ticket's five steps, drawn like the client's request progress; the client's turn is called out. */
export function PmTicketProgress({ steps }: Readonly<{ steps: ClientProgressStep[] }>) {
  if (steps.length === 0) return null;
  return <ol aria-label="Ticket progress" className="pm-rail-steps">
    {steps.map((step, index) => {
      const Icon = step.state === 'done' ? Check : STEP_ICONS[index] ?? Flag;
      return <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined}
        className={'pm-rail-step is-' + step.state + (step.needsYou ? ' is-client' : '')}>
        <span className="pm-rail-step__icon" aria-hidden="true"><Icon size={15} /></span>
        <span className="pm-rail-step__label">{step.label}</span>
        <span className="pm-rail-step__state">{step.needsYou ? 'Client’s turn' : STATE_TEXT[step.state]}</span>
      </li>;
    })}
  </ol>;
}

export interface PmConversationRailProps {
  projectName: string;
  /** The stage card: its title (the stage's name) and its body, or null when the project has no stage yet. */
  stage?: { title: string; prompt?: string | null; content: ReactNode } | null;
  /** Whether a preview is shared with the client; undefined hides the card. */
  previewShared?: boolean;
  ticketsTitle: string;
  /** The tickets checklist. */
  tickets: ReactNode;
  /** The picked ticket's cards, or a hint to pick one. */
  selected: ReactNode;
}

/** Stage, preview, tickets, then the picked ticket, in one column. */
export function PmConversationRail({ projectName, stage, previewShared, ticketsTitle, tickets, selected }: Readonly<PmConversationRailProps>) {
  return <aside className="pm-rail" aria-label={`Project tickets and details for ${projectName}`}>
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
    <PmCollapsibleRailCard id="tickets" icon={<ListChecks size={16} />} title={ticketsTitle}>{tickets}</PmCollapsibleRailCard>
    {selected}
  </aside>;
}
