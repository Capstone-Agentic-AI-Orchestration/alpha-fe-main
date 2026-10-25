import type { ClientTicketView } from './previewModel';

export function TicketStatusBadge({ ticket }: { ticket: ClientTicketView }) {
  const color = ticket.status === 'Closed' ? 'text-status-success bg-status-success-subtle' :
    ticket.status === 'Awaiting you' || ticket.status === 'Ready for review' ? 'text-status-warning bg-status-warning-subtle' :
    ticket.status === 'In progress' ? 'text-selected-content bg-selected' : 'text-content-secondary bg-surface-raised';
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium ${color}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />{ticket.status}
  </span>;
}
