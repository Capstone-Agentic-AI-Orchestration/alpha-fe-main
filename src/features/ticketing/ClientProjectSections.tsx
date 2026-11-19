import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { LoadingRows } from '@/shared/components/ui/skeleton';
import type { ClientProject, ClientProjectRequestItem, ClientProjectRequestQueue, ClientTicketQueueOptions } from './clientApi';
import { clientTicketApi, ClientTicketApiError } from './clientApi';
import { clientTicketProgress } from './clientTicketProgress';
import { shortReference } from './clientFriendly';
import { time } from './ticketUi';
import { CxBadge, CxChips, CxEmpty, CxPanel, CxRequestBadge, CxRow, CxSection } from './clientKit';

export type ProjectRequestFilter = NonNullable<ClientTicketQueueOptions['filter']>;
type Api = typeof clientTicketApi;

export function clientProjectKey(project: Pick<ClientProject, 'workspaceId' | 'projectId'>): string {
  return JSON.stringify([project.workspaceId, project.projectId]);
}

export function projectLoadError(error: unknown, area: 'requests' | 'feedback' | 'send' | 'review'): string {
  if (error instanceof ClientTicketApiError) {
    if (error.status === 401) return 'Your sign-in has expired. Sign in again to continue.';
    if (error.status === 403 || error.status === 404) return area === 'send'
      ? 'Project access could not be verified. Refresh and try again.' : 'This shared project is no longer available to your account.';
    if (error.reconciliationRequired) return 'We could not confirm whether your message was sent. Refresh the conversation before trying again.';
  }
  return area === 'send' ? 'Your message could not be sent. Try again.'
    : area === 'feedback' ? 'Could not load the project conversation.'
      : area === 'review' ? 'Could not load the project review.' : 'Could not load requests for this project.';
}

/** Data belongs to the scope that requested it; a same-scope refresh keeps it on screen. */
function useScopedLoad<T>(key: string, load: (() => Promise<T>) | null, refresh = 0) {
  const [result, setResult] = useState<{ key: string; data: T | null; error: unknown } | null>(null);
  const [nonce, setNonce] = useState(0);
  const loader = useRef(load); loader.current = load;
  const enabled = load !== null;
  useEffect(() => {
    const run = loader.current;
    if (!run) return;
    let active = true;
    run().then(data => { if (active) setResult({ key, data, error: null }); })
      .catch(error => { if (active) setResult(current => ({ key, data: current?.key === key ? current.data : null, error })); });
    return () => { active = false; };
  }, [key, nonce, enabled, refresh]);
  const reload = useCallback(() => setNonce(value => value + 1), []);
  const current = result?.key === key ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? null, pending: enabled && !current, reload };
}

const ENDED = ['closed', 'declined', 'cancelled'];
export function needsClient(item: ClientProjectRequestItem): boolean {
  return item.requestedAction !== null && !ENDED.includes(item.status) && item.projectLinkStatus !== 'pending_review';
}

function ProjectRequestRow({ item, onOpen }: { item: ClientProjectRequestItem; onOpen: (item: ClientProjectRequestItem) => void }) {
  const pending = item.projectLinkStatus === 'pending_review';
  const action = needsClient(item);
  const next = pending ? 'Waiting for your project manager to add this to the project'
    : clientTicketProgress(item.status, item.requestedAction).label;
  return <CxRow title={item.title} onClick={() => onOpen(item)}
    meta={<><span className={action ? 'cx-meta-action' : undefined}>{next}</span> · <span title={item.reference}>{shortReference(item.reference)}</span></>}
    trailing={<>{pending ? <CxBadge>Pending link</CxBadge> : <CxRequestBadge status={item.status} requestedAction={action ? item.requestedAction : null} />}
      <time className="cx-row-time" dateTime={item.updatedAt}>{time(item.updatedAt)}</time></>} />;
}

const FILTERS: Array<{ id: ProjectRequestFilter; label: string; counter?: 'needsClient' | 'open' }> = [
  { id: 'all', label: 'All' },
  { id: 'needs_client', label: 'Needs your action', counter: 'needsClient' },
  { id: 'open', label: 'Open', counter: 'open' },
  { id: 'history', label: 'Completed' },
];
const EMPTY: Record<ProjectRequestFilter, string> = {
  all: 'No requests are linked to this project yet.',
  needs_client: 'Nothing needs your action right now.',
  open: 'No open requests.',
  history: 'No completed requests yet.',
};

export function ProjectRequestsTab({ api, project, refreshToken, filter, onFilterChange, onOpenRequest, newRequest, idPrefix }: {
  api: Api; project: ClientProject; refreshToken: number; filter: ProjectRequestFilter;
  onFilterChange: (filter: ProjectRequestFilter) => void; onOpenRequest: (item: ClientProjectRequestItem) => void;
  newRequest: ReactNode; idPrefix: string;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const scope = JSON.stringify([clientProjectKey(project), filter, search]);
  const first = useScopedLoad<ClientProjectRequestQueue>(scope,
    () => api.listProjectRequests(project.workspaceId, project.projectId, { limit: 50, filter, search }), refreshToken);
  const [more, setMore] = useState<{ base: ClientProjectRequestQueue; items: ClientProjectRequestItem[]; cursor: string | null } | null>(null);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [counters, setCounters] = useState<{ key: string; value: ClientProjectRequestQueue['counters'] } | null>(null);
  useEffect(() => {
    if (first.data) setCounters({ key: clientProjectKey(project), value: first.data.counters });
  }, [first.data]);
  const extra = more?.base === first.data ? more : null;
  const items = first.data ? [...first.data.items, ...(extra?.items ?? [])] : [];
  const cursor = extra ? extra.cursor : first.data?.nextCursor ?? null;
  const counts = counters?.key === clientProjectKey(project) ? counters.value : null;

  async function loadMore() {
    if (!first.data || !cursor || moreLoading) return;
    const base = first.data;
    setMoreLoading(true); setMoreError('');
    try {
      const page = await api.listProjectRequests(project.workspaceId, project.projectId, { limit: 50, after: cursor, filter, search });
      setMore(current => {
        const previous = current?.base === base ? current.items : [];
        const seen = new Set([...base.items, ...previous].map(item => item.id));
        return { base, items: [...previous, ...page.items.filter(item => !seen.has(item.id))], cursor: page.nextCursor };
      });
    } catch (error) { setMoreError(projectLoadError(error, 'requests')); }
    finally { setMoreLoading(false); }
  }

  const action = filter === 'all' ? items.filter(needsClient) : [];
  const rest = filter === 'all' ? items.filter(item => !needsClient(item)) : items;
  const error = first.error ? projectLoadError(first.error, 'requests') : moreError;
  return <CxSection titleId={idPrefix + '-project-requests-title'} title="Requests"
    action={<div className="cx-page-actions">
      <button type="button" className="cx-icon-button" aria-label="Refresh project requests" onClick={first.reload}><RefreshCw size={15} /></button>
      {newRequest}
    </div>}>
    <div className="cx-toolbar">
      <CxChips label="Filter requests" value={filter} onChange={onFilterChange} options={FILTERS.map(option => ({
        id: option.id, label: option.label, tone: option.id === 'needs_client' ? 'attention' as const : undefined,
        count: option.counter && counts ? counts[option.counter] : undefined }))} />
      <label className="cx-search"><Search size={15} aria-hidden /><span className="sr-only">Search project requests</span>
        <input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search requests" /></label>
    </div>
    {error && <p role="alert" className="cx-error">{error} <button type="button" onClick={first.reload}>Try again</button></p>}
    <CxPanel>
      {first.pending ? <LoadingRows label="Loading project requests" layout="table" rows={4} className="p-4" />
        : !items.length ? !first.error && <CxEmpty title={search ? 'No requests match “' + search + '”.' : EMPTY[filter]} />
          : <>
            {action.length > 0 && <p className="cx-group-label">Needs your action</p>}
            {action.map(item => <ProjectRequestRow key={item.id} item={item} onOpen={onOpenRequest} />)}
            {action.length > 0 && rest.length > 0 && <p className="cx-group-label">Other requests</p>}
            {rest.map(item => <ProjectRequestRow key={item.id} item={item} onOpen={onOpenRequest} />)}
          </>}
    </CxPanel>
    {cursor && <button type="button" className="cx-link" disabled={moreLoading} onClick={() => void loadMore()}>
      {moreLoading ? 'Loading…' : 'Load more requests'} <ArrowRight size={14} aria-hidden="true" /></button>}
  </CxSection>;
}
