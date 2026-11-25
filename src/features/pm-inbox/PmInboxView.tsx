import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { Button } from '@/shared/components/ui/button';
import { pmTicketApi } from '@/features/ticketing/pmApi';
import { OPEN_INQUIRY_KEY } from '@/features/ticketing/PmInquiriesPage';
import { CLIENTS_CONVERSATION_FOCUS_KEY } from '@/features/ticketing/TaskClientRequest';
import {
  INBOX_FILTERS, clientAccountId, inInboxFilter, intakeInboxItem, requestsInboxItem, sortInbox, stageInboxItem,
  type InboxFilter, type InboxItem, type InboxTarget, type InboxTone
} from './inboxItems';

/** Stage reads per refresh: one request per client project, so a large workspace is capped. */
const MAX_STAGE_READS = 40;

const TONE: Record<InboxTone, string> = {
  info: 'border-status-info-border bg-status-info-subtle text-status-info',
  accent: 'border-divider bg-selected text-selected-content',
  warn: 'border-status-warning-border bg-status-warning-subtle text-status-warning',
  ok: 'border-status-success-border bg-status-success-subtle text-status-success',
};

function age(since: string | undefined): string {
  const time = since ? Date.parse(since) : NaN;
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 60) return minutes <= 1 ? 'just now' : minutes + ' min';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + ' h';
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : days + ' days';
}

/** What an empty list says. */
function emptyText(loading: boolean, filter: InboxFilter): string {
  if (loading) return 'Checking…';
  return filter === 'waiting' ? 'Nothing is waiting on a client.' : 'Nothing needs you right now.';
}

/** Read every source the Inbox lists; a source that fails leaves the rest. */
async function readInbox(): Promise<{ items: InboxItem[]; incomplete: boolean }> {
  const [intakes, clients] = await Promise.allSettled([pmTicketApi.listCentralIntakes(null, 'pending'), pmTicketApi.listClients()]);
  const items: InboxItem[] = intakes.status === 'fulfilled' ? intakes.value.items.map(intakeInboxItem) : [];
  let incomplete = intakes.status === 'rejected' || clients.status === 'rejected';
  if (clients.status === 'fulfilled') {
    items.push(...clients.value.map(requestsInboxItem).filter((item): item is InboxItem => Boolean(item)));
    const pairs = clients.value.flatMap(client => {
      const accountId = clientAccountId(client);
      return accountId ? client.projects.map(project => ({ client, project, accountId })) : [];
    });
    if (pairs.length > MAX_STAGE_READS) incomplete = true;
    const stages = await Promise.allSettled(pairs.slice(0, MAX_STAGE_READS)
      .map(pair => pmTicketApi.getProjectStage(pair.project.projectId, pair.accountId)
        .then(stage => stageInboxItem(pair.client, pair.project, stage))));
    for (const stage of stages) {
      if (stage.status === 'fulfilled' && stage.value) items.push(stage.value);
    }
  }
  return { items: sortInbox(items), incomplete };
}

interface PmInboxLayoutProps {
  items: InboxItem[];
  filter: InboxFilter;
  onFilter: (filter: InboxFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  incomplete: boolean;
  onRefresh: () => void;
  onOpen: (target: InboxTarget) => void;
}

/** What the page shows, given its rows: the filters, the list, and the selected request. */
export const PmInboxLayout: React.FC<PmInboxLayoutProps> = ({ items, filter, onFilter, selectedId, onSelect, loading, incomplete, onRefresh, onOpen }) => {
  const shown = items.filter(item => inInboxFilter(item, filter));
  const selected = shown.find(item => item.id === selectedId) ?? shown[0] ?? null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
        <div>
          <h1 className="text-lg font-semibold text-content">Inbox</h1>
          <p className="text-xs text-content-muted">Everything clients and prospects have asked for, in one list.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} aria-hidden />Refresh
        </Button>
      </header>

      <div role="tablist" aria-label="Show" className="flex flex-wrap gap-1.5 px-6 pb-3">
        {INBOX_FILTERS.map(option => {
          const count = items.filter(item => inInboxFilter(item, option.id)).length;
          const active = filter === option.id;
          return <button key={option.id} type="button" role="tab" aria-selected={active} onClick={() => onFilter(option.id)}
            className={'rounded-full border px-3 py-1 text-xs ' + (active ? 'border-transparent bg-action text-on-action' : 'border-divider text-content-secondary hover:bg-surface-high')}>
            {option.label} · {count}
          </button>;
        })}
      </div>
      {incomplete && <p role="status" className="px-6 pb-2 text-xs text-status-warning">Some requests could not be checked just now, so this list may be missing items.</p>}

      <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6 max-lg:flex-col">
        <section aria-label="Requests" className="min-h-0 flex-[1.25] overflow-y-auto rounded-xl border border-divider bg-surface">
          {shown.length === 0 && <p className="p-6 text-sm text-content-muted">{emptyText(loading, filter)}</p>}
          {shown.map(item => {
            const active = selected?.id === item.id;
            return <button key={item.id} type="button" onClick={() => onSelect(item.id)} aria-pressed={active}
              className={'flex w-full items-start gap-3 border-b border-divider px-4 py-3 text-left last:border-b-0 ' + (active ? 'bg-surface-high' : 'hover:bg-surface-high/60')}>
              <span className={'mt-0.5 w-32 shrink-0 rounded-md border px-2 py-0.5 text-center text-[11px] font-semibold ' + TONE[item.tone]}>{item.label}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-content">{item.title}</span>
                <span className="block truncate text-xs text-content-muted">{item.who}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[11px] text-content-muted">{age(item.since)}</span>
                <span className="block max-w-56 truncate text-xs font-medium text-link">{item.nextStep}</span>
              </span>
            </button>;
          })}
        </section>

        {selected && <section aria-label="Selected request" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-xl border border-divider bg-surface p-5">
          <div className="flex items-center gap-2">
            <span className={'rounded-md border px-2 py-0.5 text-[11px] font-semibold ' + TONE[selected.tone]}>{selected.label}</span>
            {selected.since && <span className="text-xs text-content-muted">{age(selected.since)}{/^\d/.test(age(selected.since)) ? ' ago' : ''}</span>}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-content">{selected.title}</h2>
            <p className="text-sm text-content-muted">{selected.who}</p>
          </div>
          {selected.detail && <div className="rounded-lg border border-divider bg-well p-3.5">
            <p className="mb-1 text-xs font-semibold text-content-muted">What they asked for</p>
            <p className="whitespace-pre-wrap text-sm text-content-secondary">{selected.detail}</p>
          </div>}
          <div className="mt-auto border-t border-divider pt-4">
            <p className="mb-3 text-sm text-content-secondary">{selected.turn === 'pm' ? 'Next step: ' : ''}{selected.nextStep}</p>
            <Button onClick={() => onOpen(selected.target)}>{selected.target.view === 'inquiries' ? 'Open the inquiry' : 'Open the conversation'}</Button>
          </div>
        </section>}
      </div>
    </div>
  );
};

/** One list of what clients and prospects asked for, with the next step for each. */
export const PmInboxView: React.FC = () => {
  const { activeTabId, setTabSessionState, setActiveTab } = useApp();
  const [filter, setFilter] = useTabSessionState<InboxFilter>('inbox.filter', 'all');
  const [selectedId, setSelectedId] = useTabSessionState<string | null>('inbox.selected', null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [incomplete, setIncomplete] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await readInbox();
    setItems(result.items);
    setIncomplete(result.incomplete);
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const open = (target: InboxTarget) => {
    if (target.view === 'inquiries') {
      setTabSessionState(activeTabId, OPEN_INQUIRY_KEY, { id: target.inquiryId, view: 'pending' });
    } else {
      setTabSessionState(activeTabId, 'clients.selected', target.clientKey);
      setTabSessionState(activeTabId, 'clients.section', 'conversation');
      if (target.projectId) setTabSessionState(activeTabId, CLIENTS_CONVERSATION_FOCUS_KEY, { projectId: target.projectId });
    }
    setActiveTab(target.view);
  };

  return <PmInboxLayout items={items} filter={filter} onFilter={setFilter} selectedId={selectedId} onSelect={setSelectedId}
    loading={loading} incomplete={incomplete} onRefresh={() => void refresh()} onOpen={open} />;
};

