import { Ticket } from 'lucide-react';

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

export function PmTicketQueueList({ items, selectedId, disabled, onSelect }: {
  items: readonly PmTicketQueueItem[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (ticketId: string) => void;
}) {
  const clients = groupPmTickets(items);
  const clientByTicket = new Map(clients.flatMap(client => client.projects.flatMap(project =>
    project.tickets.map(item => [item.id, client] as const))));
  return <table aria-label="Client tickets" className="pm-queue-table w-full text-left text-[13px]">
    <thead className="text-[10.5px] font-semibold uppercase tracking-wide text-content-muted">
      <tr className="border-b border-divider">
        <th scope="col" className="w-1/2 py-2 pr-3 font-semibold sm:w-2/5">Request</th>
        <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">Client / project</th>
        <th scope="col" className="py-2 pr-3 font-semibold">Status / next step</th>
        <th scope="col" className="py-2 text-right font-semibold">Updated</th>
      </tr>
    </thead>
    <tbody>
      {items.map(item => {
        const client = clientByTicket.get(item.id)!;
        return <tr key={item.id} className="border-b border-divider hover:bg-surface-high/40">
          <td className="max-w-0 py-2.5 pr-3">
            <button type="button" data-ticket-id={item.id} aria-pressed={selectedId === item.id} disabled={disabled}
              onClick={() => onSelect(item.id)} className="flex w-full min-w-0 items-center gap-2.5 text-left hover:text-link disabled:opacity-50">
              <span className="pm-queue-table__icon"><Ticket size={14} aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className="block truncate font-medium" title={item.title}>{item.title}</span>
                <span className="block truncate text-[11px] text-content-muted" title={item.reference}>{item.reference}</span>
              </span>
            </button>
          </td>
          <td className="hidden max-w-0 py-2.5 pr-3 sm:table-cell">
            <span className="block truncate font-medium">{client.name}</span>
            <span className="block truncate text-[11px] text-content-muted">{item.internal.projectName ?? 'No project linked'}</span>
          </td>
          <td className="max-w-0 py-2.5 pr-3">
            <span className={`pm-ticket-queue__status ${statusStyle(item.status)}`}>{statusLabel(item.status)}</span>
            <span className="block truncate text-[11px] text-content-muted" title={actionSummary(item)}>{item.internal.clientReplyUnread ? 'New client reply' : actionSummary(item)}</span>
          </td>
          <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-content-muted">
            <time dateTime={item.updatedAt} title={time(item.updatedAt)}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
          </td>
        </tr>;
      })}
    </tbody>
  </table>;
}
