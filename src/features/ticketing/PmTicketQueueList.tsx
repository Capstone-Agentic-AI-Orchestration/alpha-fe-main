import { FolderKanban, UserRound } from 'lucide-react';

import type { PmTicketQueueItem } from './pmApi';
import { groupPmTickets } from './pmTicketGrouping';
import { pmTicketNextAction } from './pmTicketNextAction';
import { time } from './ticketUi';

function statusLabel(status: PmTicketQueueItem['status']): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function statusStyle(status: PmTicketQueueItem['status']): string {
  if (status === 'closed') return 'pm-status--closed';
  if (status === 'in_progress' || status === 'ready_for_review') return 'pm-status--active';
  if (status === 'awaiting_client' || status === 'on_hold') return 'pm-status--waiting';
  if (status === 'declined' || status === 'cancelled') return 'pm-status--stopped';
  return 'pm-status--review';
}

function actionOwnerLabel(item: PmTicketQueueItem): string {
  if (item.internal.actionOwner === 'pm') return 'PM action';
  if (item.internal.actionOwner === 'client') return 'Client action';
  if (item.internal.actionOwner === 'developer') return 'Developer action';
  return 'No action pending';
}

function actionSummary(item: PmTicketQueueItem): string {
  const nextAction = pmTicketNextAction(item.internal.nextAction);
  if (!nextAction) return actionOwnerLabel(item);
  const owner = item.internal.actionOwner ? actionOwnerLabel(item) : 'Next step';
  return `${owner} · ${nextAction}`;
}

export function PmTicketQueueList({ items, selectedId, disabled, requestAccessSaving, onSelect, onToggleRequests }: {
  items: readonly PmTicketQueueItem[];
  selectedId: string | null;
  disabled: boolean;
  requestAccessSaving: string | null;
  onSelect: (ticketId: string) => void;
  onToggleRequests: (ticketId: string, acceptsNewRequests: boolean) => void;
}) {
  const clients = groupPmTickets(items);
  return <div className="pm-ticket-queue">
    {clients.map(client => <section key={client.key} aria-label={`Requests for ${client.name}`} className="pm-ticket-queue__client">
      <header className="pm-ticket-queue__client-header">
        <div className="pm-ticket-queue__client-identity">
          <UserRound size={15} aria-hidden="true" />
          <div className="min-w-0">
            <p className="pm-ticket-queue__client-name">{client.name}</p>
            <p className="pm-ticket-queue__client-count">{client.tickets} request{client.tickets === 1 ? '' : 's'}{client.accessActive ? '' : ' · separate inquiry'}</p>
          </div>
        </div>
        {client.accessActive && <button type="button" disabled={disabled || requestAccessSaving !== null}
          onClick={() => onToggleRequests(items.find(item => item.internal.clientGroup?.key === client.key)?.id ?? items[0]!.id, !client.acceptsNewRequests)}
          aria-label={`${client.acceptsNewRequests ? 'Pause' : 'Allow'} new requests for ${client.name}`}
          className="pm-ticket-queue__request-toggle disabled:opacity-50">
          {requestAccessSaving && items.some(item => item.id === requestAccessSaving && item.internal.clientGroup?.key === client.key)
            ? 'Saving…' : client.acceptsNewRequests ? 'Pause new requests' : 'Allow new requests'}
        </button>}
      </header>
      {client.projects.map(project => <div key={project.key} className="pm-ticket-queue__project">
        <div className="pm-ticket-queue__project-heading">
          <FolderKanban size={13} aria-hidden="true" />
          <span>{project.name ?? 'Not linked to a project'}</span>
          <span className="pm-ticket-queue__project-count">{project.tickets.length}</span>
        </div>
        {project.tickets.map(item => <button key={item.id} type="button" aria-pressed={selectedId === item.id} disabled={disabled}
          onClick={() => onSelect(item.id)}
          className={`pm-ticket-queue__item focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:opacity-50${selectedId === item.id ? ' is-selected' : ''}`}>
          <div className="pm-ticket-queue__item-top">
            <span className="pm-ticket-queue__reference">{item.reference}</span>
            <span className="pm-ticket-queue__badges">{item.internal.clientReplyUnread && <span className="pm-ticket-queue__unread">New reply</span>}<span className={`pm-ticket-queue__status ${statusStyle(item.status)}`}>{statusLabel(item.status)}</span></span>
          </div>
          <p className="pm-ticket-queue__title">{item.title}</p>
          <div className="pm-ticket-queue__item-bottom">
            <span className="pm-ticket-queue__next-action">{actionSummary(item)}</span><time dateTime={item.updatedAt}>{time(item.updatedAt)}</time>
          </div>
        </button>)}
      </div>)}
    </section>)}
  </div>;
}
