import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { ClientProjectRequestItem } from './clientApi';
import { clientTicketProgress } from './clientTicketProgress';
import './clientKit.css';

/**
 * The client portal's building blocks. Every client page is assembled from these, so pages
 * share one set of sizes, spacing and colours (clientKit.css) instead of each page styling itself.
 */

export type CxTone = 'neutral' | 'attention' | 'active' | 'done' | 'ended';

/** One colour per kind of status, the same everywhere a request appears. */
export function requestTone(status: ClientProjectRequestItem['status'], requestedAction: ClientProjectRequestItem['requestedAction']): CxTone {
  if (status === 'closed') return 'done';
  if (status === 'declined' || status === 'cancelled') return 'ended';
  if (requestedAction) return 'attention';
  return status === 'in_progress' || status === 'ready_for_review' ? 'active' : 'neutral';
}

export function CxBadge({ tone = 'neutral', children }: { tone?: CxTone; children: ReactNode }) {
  return <span className={'cx-badge is-' + tone}>{children}</span>;
}

/** A request's status badge: plain words from clientTicketProgress, coloured by requestTone. */
export function CxRequestBadge({ status, requestedAction }: Pick<ClientProjectRequestItem, 'status' | 'requestedAction'>) {
  return <CxBadge tone={requestTone(status, requestedAction)}>{clientTicketProgress(status, requestedAction).statusLabel}</CxBadge>;
}

/** Five short bars: where a request is on Received → Planning → In progress → Ready for you → Done. */
export function CxTrack({ index, total = 5, label }: { index: number; total?: number; label?: string }) {
  return <span className="cx-track" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {Array.from({ length: total }, (_, step) => <span key={step} className={step < index ? 'is-done' : step === index ? 'is-current' : ''} />)}
  </span>;
}

export function CxPageHeader({ titleId, title, description, back, actions, eyebrow }: {
  titleId: string; title: ReactNode; description?: ReactNode; eyebrow?: ReactNode;
  back?: { label: string; onClick: () => void; disabled?: boolean }; actions?: ReactNode;
}) {
  return <header className="cx-page-header">
    {back && <button type="button" className="cx-back" onClick={back.onClick} disabled={back.disabled}><ArrowLeft size={15} aria-hidden="true" />{back.label}</button>}
    <div className="cx-page-header-row">
      <div className="cx-page-header-copy">
        {eyebrow && <p className="cx-eyebrow">{eyebrow}</p>}
        <h1 id={titleId}>{title}</h1>
        {description && <p className="cx-page-description">{description}</p>}
      </div>
      {actions && <div className="cx-page-actions">{actions}</div>}
    </div>
  </header>;
}

export function CxSection({ titleId, title, count, action, children, className = '' }: {
  titleId: string; title: ReactNode; count?: number; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={'cx-section ' + className} aria-labelledby={titleId}>
    <div className="cx-section-head">
      <h2 id={titleId}>{title}{count !== undefined && <span className="cx-count">{count}</span>}</h2>
      {action}
    </div>
    {children}
  </section>;
}

export function CxPanel({ tone, children, className = '' }: { tone?: 'attention'; children: ReactNode; className?: string }) {
  return <div className={'cx-panel' + (tone ? ' is-' + tone : '') + (className ? ' ' + className : '')}>{children}</div>;
}

/** One line in a list: what it is, one line of context, and what to do or where it stands. */
export function CxRow({ title, meta, trailing, onClick, disabled, current, children }: {
  title: ReactNode; meta?: ReactNode; trailing?: ReactNode; onClick?: () => void; disabled?: boolean; current?: boolean; children?: ReactNode;
}) {
  const body = <>
    <span className="cx-row-copy"><strong>{title}</strong>{meta && <small>{meta}</small>}{children}</span>
    {trailing && <span className="cx-row-trailing">{trailing}</span>}
  </>;
  return onClick
    ? <button type="button" className="cx-row is-interactive" onClick={onClick} disabled={disabled} aria-current={current ? 'true' : undefined}>{body}<ChevronRight size={16} className="cx-row-chevron" aria-hidden="true" /></button>
    : <div className="cx-row">{body}</div>;
}

/** Filter chips: one choice at a time, with an optional count. */
export function CxChips<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; disabled?: boolean;
  options: Array<{ id: T; label: string; count?: number | null; tone?: 'attention' }>; onChange: (value: T) => void;
}) {
  return <div className="cx-chips" role="group" aria-label={label}>
    {options.map(option => <button key={option.id} type="button" aria-pressed={value === option.id} disabled={disabled}
      className={option.tone === 'attention' && option.count ? 'is-attention' : undefined} onClick={() => onChange(option.id)}>
      {option.label}{option.count !== undefined && option.count !== null && <span>{option.count}</span>}
    </button>)}
  </div>;
}

export function CxEmpty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return <div className="cx-empty">{icon && <span className="cx-empty-icon" aria-hidden="true">{icon}</span>}
    <p className="cx-empty-title">{title}</p>{body && <p>{body}</p>}{action}</div>;
}

