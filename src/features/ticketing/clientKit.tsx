import { useId, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, FolderKanban } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import type { ClientProjectRequestItem } from './clientApi';
import { clientTicketProgress } from './clientTicketProgress';
import { clientNextLine, listProgressIndex, relativeTime, shortReference } from './clientFriendly';
import { time } from './ticketUi';
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
  return <Badge variant="secondary" className={'cx-badge is-' + tone}>{children}</Badge>;
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
    {back && <Button type="button" variant="ghost" className="cx-back" onClick={back.onClick} disabled={back.disabled}><ArrowLeft size={15} aria-hidden="true" />{back.label}</Button>}
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
  return <Card className={'cx-panel' + (tone ? ' is-' + tone : '') + (className ? ' ' + className : '')}>{children}</Card>;
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
    ? <Button type="button" variant="ghost" className="cx-row is-interactive" onClick={onClick} disabled={disabled} aria-current={current ? 'true' : undefined}>{body}<ChevronRight size={16} className="cx-row-chevron" aria-hidden="true" /></Button>
    : <div className="cx-row">{body}</div>;
}

/** Filter chips: one choice at a time, with an optional count. */
export function CxChips<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; disabled?: boolean;
  options: Array<{ id: T; label: string; count?: number | null; tone?: 'attention' }>; onChange: (value: T) => void;
}) {
  return <div className="cx-chips" role="group" aria-label={label}>
    {options.map(option => <Button key={option.id} type="button" variant={value === option.id ? 'default' : 'outline'} size="sm"
      aria-pressed={value === option.id} disabled={disabled}
      className={`${option.tone === 'attention' && option.count ? 'is-attention ' : ''}${value === option.id ? 'is-selected' : ''}`} onClick={() => onChange(option.id)}>
      {option.label}{option.count !== undefined && option.count !== null && <span>{option.count}</span>}
    </Button>)}
  </div>;
}

export function CxEmpty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return <div className="cx-empty"><CxOrbit className="cx-empty-art" />{icon && <span className="cx-empty-icon" aria-hidden="true">{icon}</span>}
    <p className="cx-empty-title">{title}</p>{body && <p>{body}</p>}{action}</div>;
}

/**
 * A request in a list: its title, what happens next in plain words, where it belongs, the five-step
 * track and its badge. The compact form (inside project cards) keeps only the status sentence and track.
 */
export function CxRequestRow({ item, onOpen, disabled, compact = false }: {
  item: ClientProjectRequestItem; onOpen: (item: ClientProjectRequestItem) => void; disabled?: boolean; compact?: boolean;
}) {
  const pendingLink = item.projectLinkStatus === 'pending_review';
  const index = pendingLink ? null : listProgressIndex(item);
  const next = compact ? null : clientNextLine(item);
  const sentence = pendingLink
    ? 'The project manager is confirming the project' + (item.requestedProjectName ? ' · ' + item.requestedProjectName : '')
    : clientTicketProgress(item.status, item.requestedAction).label;
  const project = item.projectName ?? item.requestedProjectName;
  const meta = next
    ? <span className={item.requestedAction && !pendingLink ? 'cx-meta-action' : undefined}><b className="cx-next-label">Next:</b> {next}</span>
    : <span className={item.requestedAction && !pendingLink ? 'cx-meta-action' : undefined}>{sentence}</span>;
  return <CxRow title={item.title} onClick={() => onOpen(item)} disabled={disabled} meta={meta}
    trailing={pendingLink ? <CxBadge>Pending link</CxBadge> : <CxRequestBadge status={item.status} requestedAction={item.requestedAction} />}>
    {!compact && <span className="cx-row-facts">
      {project && <span><FolderKanban size={12} aria-hidden="true" />{project}</span>}
      <span title={item.reference}>{shortReference(item.reference)}</span>
      <span>Updated <time dateTime={item.updatedAt} title={time(item.updatedAt)}>{relativeTime(item.updatedAt)}</time></span>
    </span>}
    {index !== null && <CxTrack index={index} label={'Step ' + (index + 1) + ' of 5'} />}
  </CxRow>;
}

/** A few counts side by side, shown as "2 Open · 1 Done". */
export function CxStats({ label, items }: { label: string; items: Array<{ label: string; value: number; tone?: 'attention' | 'done' }> }) {
  return <dl className="cx-stats" aria-label={label}>
    {items.map(item => <div key={item.label} className={'cx-stat' + (item.tone && item.value ? ' is-' + item.tone : '')}>
      <dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </dl>;
}

/** A page's opening band: open on the page (no box), large headline, with the orbit art on the right. */
export function CxHero({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'cx-hero' + (className ? ' ' + className : '')}><CxOrbit className="cx-hero-art" />{children}</div>;
}

/** A four-point sparkle centred on (x, y), as used where the orbit rings cross. */
function sparkle(x: number, y: number, size: number): string {
  return `M${x} ${y - size} Q${x} ${y} ${x + size} ${y} Q${x} ${y} ${x} ${y + size} Q${x} ${y} ${x - size} ${y} Q${x} ${y} ${x} ${y - size}Z`;
}

/** SVG ids must be unique on the page, and React's ids contain colons that url(#…) references dislike. */
function useArtId(): string {
  return 'cx-art' + useId().replace(/:/g, '');
}

/**
 * Alphaexplora's orbit rings, the portal's decorative motif. Drawn from the theme's accent colour
 * (clientKit.css) so the same art reads as a glow on dark themes and as fine lines on light ones.
 */
export function CxOrbit({ className = '' }: { className?: string }) {
  const id = useArtId();
  return <svg className={'cx-orbit ' + className} viewBox="0 0 560 320" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id + '-line'} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" className="cx-art-stop-faint" />
        <stop offset=".45" className="cx-art-stop-strong" />
        <stop offset="1" className="cx-art-stop-clear" />
      </linearGradient>
      <radialGradient id={id + '-glow'}>
        <stop offset="0" className="cx-art-stop-glow" />
        <stop offset="1" className="cx-art-stop-clear" />
      </radialGradient>
    </defs>
    <ellipse cx="300" cy="165" rx="220" ry="130" fill={`url(#${id}-glow)`} />
    <g fill="none" stroke={`url(#${id}-line)`}>
      <ellipse className="cx-orbit-band" cx="300" cy="168" rx="236" ry="76" transform="rotate(-12 300 168)" />
      <ellipse className="cx-orbit-line" cx="300" cy="168" rx="236" ry="76" transform="rotate(-12 300 168)" />
      <ellipse className="cx-orbit-band" cx="318" cy="150" rx="150" ry="104" transform="rotate(-38 318 150)" />
      <ellipse className="cx-orbit-line" cx="318" cy="150" rx="150" ry="104" transform="rotate(-38 318 150)" />
      <ellipse className="cx-orbit-line is-faint" cx="292" cy="176" rx="190" ry="118" transform="rotate(8 292 176)" />
    </g>
    <path className="cx-orbit-spark" d={sparkle(394, 124, 14)} />
    <path className="cx-orbit-spark is-small" d={sparkle(526, 112, 8)} />
    <circle className="cx-orbit-star" cx="128" cy="62" r="1.6" />
    <circle className="cx-orbit-star" cx="214" cy="286" r="1.2" />
    <circle className="cx-orbit-star" cx="470" cy="38" r="1.4" />
  </svg>;
}

const COVER_ART = ['orbit', 'wave', 'cubes'] as const;

/** One line of the wave artwork; each step sits a little lower and flatter than the last. */
function waveLine(step: number): string {
  return `M-10 ${118 + step * 5}C70 ${40 + step * 9} 150 ${180 - step * 7} 330 ${58 + step * 8}`;
}

/** One isometric cube's three faces around (x, y). */
function Cube({ x, y, size }: { x: number; y: number; size: number }) {
  const w = size * 0.866;
  const h = size / 2;
  return <g className="cx-cube">
    <path className="is-top" d={`M${x} ${y - size}L${x + w} ${y - h}L${x} ${y}L${x - w} ${y - h}Z`} />
    <path className="is-left" d={`M${x - w} ${y - h}L${x} ${y}L${x} ${y + size}L${x - w} ${y + h}Z`} />
    <path className="is-right" d={`M${x} ${y}L${x + w} ${y - h}L${x + w} ${y + h}L${x} ${y + size}Z`} />
  </g>;
}

/**
 * Artwork for a project card before a preview is shared. The same project always gets the same
 * picture (orbit, wave or cubes, picked from `seed`), so cards stay recognisable between visits.
 */
export function CxCoverArt({ seed }: { seed: string }) {
  const id = useArtId();
  const kind = COVER_ART[[...seed].reduce((total, character) => total + character.charCodeAt(0), 0) % COVER_ART.length];
  if (kind === 'orbit') return <div className="cx-cover-art"><CxOrbit /></div>;
  return <div className="cx-cover-art">
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id + '-line'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className="cx-art-stop-clear" />
          <stop offset=".5" className="cx-art-stop-strong" />
          <stop offset="1" className="cx-art-stop-faint" />
        </linearGradient>
      </defs>
      {kind === 'wave'
        ? <g fill="none" stroke={`url(#${id}-line)`} className="cx-wave">
          <path className="is-glow" d={waveLine(3)} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map(step => <path key={step} style={{ opacity: 1 - step * 0.1 }} d={waveLine(step)} />)}
        </g>
        : <g>
          <Cube x={92} y={88} size={34} />
          <Cube x={164} y={46} size={30} />
          <Cube x={226} y={104} size={38} />
          <Cube x={150} y={150} size={26} />
          <Cube x={290} y={30} size={22} />
        </g>}
    </svg>
  </div>;
}

/** Something the client needs to do, as a large card: icon, title, context, where it is, and the action. */
export function CxActionCard({ icon, title, meta, index, action, onClick, disabled }: {
  icon: ReactNode; title: ReactNode; meta?: ReactNode; index?: number | null; action: string; onClick: () => void; disabled?: boolean;
}) {
  return <Button type="button" variant="outline" className="cx-action-card" onClick={onClick} disabled={disabled}>
    <span className="cx-action-icon" aria-hidden="true">{icon}</span>
    <strong>{title}</strong>
    {meta && <small>{meta}</small>}
    <span className="cx-action-foot">
      {index !== undefined && index !== null ? <CxTrack index={index} label={'Step ' + (index + 1) + ' of 5'} /> : <span className="cx-action-spacer" />}
      <span className="cx-button is-primary">{action}</span>
    </span>
  </Button>;
}
