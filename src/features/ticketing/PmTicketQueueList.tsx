import { FolderKanban, UserRound } from 'lucide-react';

import type { PmTicketQueueItem } from './pmApi';
import { groupPmTickets } from './pmTicketGrouping';
import { time } from './ticketUi';

function statusLabel(status: PmTicketQueueItem['status']): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function statusStyle(status: PmTicketQueueItem['status']): string {
  if (status === 'closed') return 'bg-emerald-500/10 text-emerald-300';
  if (status === 'in_progress' || status === 'ready_for_review') return 'bg-brand-500/10 text-brand-300';
  if (status === 'awaiting_client' || status === 'on_hold') return 'bg-amber-500/10 text-amber-300';
  if (status === 'declined' || status === 'cancelled') return 'bg-rose-500/10 text-rose-300';
  return 'bg-white/[0.06] text-gray-300';
}

function actionOwnerLabel(item: PmTicketQueueItem): string {
  if (item.internal.actionOwner === 'pm') return 'PM action';
  if (item.internal.actionOwner === 'client') return 'Client action';
  if (item.internal.actionOwner === 'developer') return 'Developer action';
  return 'No action pending';
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
  return <div>
    {clients.map(client => <section key={client.key} aria-label={`Requests for ${client.name}`} className="border-b border-white/[0.07]">
      <header className="flex items-center justify-between gap-2 bg-white/[0.018] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound size={13} className="shrink-0 text-gray-500" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-gray-200">{client.name}</p>
            <p className="text-[10px] text-gray-600">{client.tickets} request{client.tickets === 1 ? '' : 's'}{client.accessActive ? '' : ' · separate inquiry'}</p>
          </div>
        </div>
        {client.accessActive && <button type="button" disabled={disabled || requestAccessSaving !== null}
          onClick={() => onToggleRequests(items.find(item => item.internal.clientGroup?.key === client.key)?.id ?? items[0]!.id, !client.acceptsNewRequests)}
          aria-label={`${client.acceptsNewRequests ? 'Pause' : 'Allow'} new requests for ${client.name}`}
          className="shrink-0 rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 disabled:opacity-50">
          {requestAccessSaving && items.some(item => item.id === requestAccessSaving && item.internal.clientGroup?.key === client.key)
            ? 'Saving…' : client.acceptsNewRequests ? 'Pause new requests' : 'Allow new requests'}
        </button>}
      </header>
      {client.projects.map(project => <div key={project.key} className="border-t border-white/[0.045]">
        <div className="flex items-center gap-1.5 bg-black/10 px-4 py-2 text-[10px] text-gray-500">
          <FolderKanban size={12} className="shrink-0" />
          <span className="truncate">{project.name ?? 'Not linked to a project'}</span>
          <span className="ml-auto shrink-0">{project.tickets.length}</span>
        </div>
        {project.tickets.map(item => <button key={item.id} type="button" disabled={disabled}
          onClick={() => onSelect(item.id)}
          className={`w-full border-t border-white/[0.04] p-3.5 pl-5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selectedId === item.id ? 'bg-brand-500/[0.08] shadow-[inset_2px_0_0_0_#a78bfa]' : 'hover:bg-white/[0.025]'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-gray-500">{item.reference}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${statusStyle(item.status)}`}>{statusLabel(item.status)}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-200">{item.title}</p>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-gray-500">
            <span>{actionOwnerLabel(item)}</span><time dateTime={item.updatedAt}>{time(item.updatedAt)}</time>
          </div>
        </button>)}
      </div>)}
    </section>)}
  </div>;
}
