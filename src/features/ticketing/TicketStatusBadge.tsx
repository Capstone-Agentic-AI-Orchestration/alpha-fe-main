import type { ClientTicketView } from './previewModel';

export function TicketStatusBadge({ ticket }: { ticket: ClientTicketView }) {
  const color = ticket.status === 'Closed' ? 'text-emerald-300 bg-emerald-500/10' :
    ticket.status === 'Awaiting you' || ticket.status === 'Ready for review' ? 'text-amber-300 bg-amber-500/10' :
    ticket.status === 'In progress' ? 'text-brand-300 bg-brand-500/10' : 'text-gray-400 bg-white/5';
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium ${color}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />{ticket.status}
  </span>;
}
