import { ArrowUpRight, MoreHorizontal } from 'lucide-react';

import type { PmTicketQueueItem } from './pmApi';
import { groupPmTickets } from './pmTicketGrouping';
import { pmTicketNextAction } from './pmTicketNextAction';
import { time } from './ticketUi';

function statusLabel(status: PmTicketQueueItem['status']): string {
  const label = status.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
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
  const clientByTicket = new Map(clients.flatMap(client => client.projects.flatMap(project =>
    project.tickets.map(item => [item.id, client] as const))));
  return <div className="pm-ticket-queue">
    <div className="pm-ticket-queue__columns" aria-hidden="true"><span>Request</span><span>Client / project</span><span>Status / next step</span><span>Updated</span><span /></div>
    <div role="list" aria-label="Client tickets">
      {items.map(item => {
        const client = clientByTicket.get(item.id)!;
        return <div key={item.id} role="listitem" className="pm-ticket-queue__row">
          <button type="button" data-ticket-id={item.id} aria-pressed={selectedId === item.id} disabled={disabled} onClick={() => onSelect(item.id)}
            className={`pm-ticket-queue__item focus-visible:outline${selectedId === item.id ? ' is-selected' : ''}`}>
            <span className="pm-ticket-queue__request">
              <span className="pm-ticket-queue__title">{item.title}{item.internal.clientReplyUnread && <span className="pm-ticket-queue__unread" aria-label="New client reply" />}</span>
              <span className="pm-ticket-queue__reference" title={item.reference}>{item.reference.length > 20 ? `${item.reference.slice(0, 16)}…` : item.reference}</span>
            </span>
            <span className="pm-ticket-queue__client">
              <span className="pm-ticket-queue__client-name">{client.name}</span>
              <span className="pm-ticket-queue__project">{item.internal.projectName ?? 'No project linked'}</span>
            </span>
            <span className="pm-ticket-queue__state">
              <span className={`pm-ticket-queue__status ${statusStyle(item.status)}`}>{statusLabel(item.status)}</span>
              <span className="pm-ticket-queue__next-action" title={actionSummary(item)}>{item.internal.clientReplyUnread ? 'New client reply' : actionSummary(item)}</span>
            </span>
            <time dateTime={item.updatedAt} title={time(item.updatedAt)}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
            <ArrowUpRight size={16} className="pm-ticket-queue__open" aria-hidden="true" />
          </button>
          {client.accessActive && <details className="pm-ticket-queue__client-options">
            <summary aria-label={`Client options for ${client.name}`}><MoreHorizontal size={16} /></summary>
            <button type="button" disabled={disabled || requestAccessSaving !== null}
              onClick={event => { onToggleRequests(item.id, !client.acceptsNewRequests); event.currentTarget.closest('details')?.removeAttribute('open'); }}
              aria-label={`${client.acceptsNewRequests ? 'Pause' : 'Allow'} new requests for ${client.name}`}
              className="pm-ticket-queue__request-toggle">
              {requestAccessSaving && items.some(candidate => candidate.id === requestAccessSaving && candidate.internal.clientGroup?.key === client.key)
                ? 'Saving…' : client.acceptsNewRequests ? 'Pause new requests' : 'Allow new requests'}
            </button>
          </details>}
        </div>;
      })}
    </div>
  </div>;
}
