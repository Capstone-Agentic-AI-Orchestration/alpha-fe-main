import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { LoadingRows, Skeleton } from '@/shared/components/ui/skeleton';
import type { ClientProject, ClientProjectFeedbackMessage, ClientProjectRequestItem, ClientProjectRequestQueue,
  ClientTicketPage, ClientTicketQueueOptions } from './clientApi';
import { clientTicketApi, ClientTicketApiError } from './clientApi';
import { clientProjectQaApi } from './clientProjectQaApi';
import type { QaRound, QaRoundPage, QaRoundSummary } from './projectQaApi';
import { clientTicketProgress } from './clientTicketProgress';
import { time } from './ticketUi';

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

/** Long generated references stay unique in the title attribute; rows show a readable prefix. */
export function shortReference(reference: string): string {
  const match = /^([A-Z]+-)([0-9A-F]{12,})$/i.exec(reference);
  return match ? match[1] + match[2].slice(0, 6).toUpperCase() : reference;
}

export function StatusPill({ status, requestedAction = null }: {
  status: ClientProjectRequestItem['status']; requestedAction?: ClientProjectRequestItem['requestedAction'];
}) {
  const tone = requestedAction ? 'is-waiting' : status === 'closed' ? 'is-complete'
    : status === 'ready_for_review' || status === 'awaiting_client' ? 'is-waiting'
      : status === 'in_progress' ? 'is-active'
        : status === 'declined' || status === 'cancelled' ? 'is-ended' : 'is-neutral';
  return <span className={`client-status ${tone}`}>{clientTicketProgress(status, requestedAction).statusLabel}</span>;
}

function ProjectRequestRow({ item, onOpen }: { item: ClientProjectRequestItem; onOpen: (item: ClientProjectRequestItem) => void }) {
  const pending = item.projectLinkStatus === 'pending_review';
  const action = needsClient(item);
  const next = pending ? 'Waiting for your project manager to add this to the project'
    : clientTicketProgress(item.status, item.requestedAction).label;
  return <button type="button" className={`client-proj-row${action ? ' needs-action' : ''}`} onClick={() => onOpen(item)}>
    <span className="client-proj-row-main"><strong>{item.title}</strong>
      <small><span className={action ? 'is-action' : undefined}>{next}</span><span title={item.reference}>{shortReference(item.reference)}</span></small></span>
    {pending ? <span className="client-status is-neutral">Pending link</span>
      : <StatusPill status={item.status} requestedAction={action ? item.requestedAction : null} />}
    <time dateTime={item.updatedAt}>{time(item.updatedAt)}</time>
    <ChevronRight size={15} aria-hidden />
  </button>;
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
  return <section className="client-proj-requests" aria-labelledby={`${idPrefix}-project-requests-title`}>
    <header className="client-proj-head">
      <div><h2 id={`${idPrefix}-project-requests-title`}>Requests</h2>
        <p>Everything you and your project manager are working on in this project.</p></div>
      <div className="client-section-actions">
        <button type="button" className="client-icon-action" aria-label="Refresh project requests" onClick={first.reload}><RefreshCw size={15} /></button>
        {newRequest}
      </div>
    </header>
    <div className="client-proj-toolbar">
      <div className="client-proj-filters" role="group" aria-label="Filter requests">
        {FILTERS.map(option => <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => onFilterChange(option.id)}>
          {option.label}{option.counter && counts && <span>{counts[option.counter]}</span>}</button>)}
      </div>
      <label className="client-proj-search"><Search size={15} aria-hidden /><span className="sr-only">Search project requests</span>
        <input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search requests" /></label>
    </div>
    {error && <p role="alert" className="client-project-error">{error} <button type="button" onClick={first.reload}>Try again</button></p>}
    <div className="client-proj-list">
      {first.pending ? <LoadingRows label="Loading project requests" layout="table" rows={4} />
        : !items.length ? !first.error && <p className="client-section-state">{search ? `No requests match “${search}”.` : EMPTY[filter]}</p>
          : <>
            {action.length > 0 && <p className="client-proj-group">Needs your action</p>}
            {action.map(item => <ProjectRequestRow key={item.id} item={item} onOpen={onOpenRequest} />)}
            {action.length > 0 && rest.length > 0 && <p className="client-proj-group">Other requests</p>}
            {rest.map(item => <ProjectRequestRow key={item.id} item={item} onOpen={onOpenRequest} />)}
          </>}
    </div>
    {cursor && <button type="button" className="client-text-action client-proj-more" disabled={moreLoading} onClick={() => void loadMore()}>
      {moreLoading ? 'Loading…' : 'Load more requests'} <ArrowRight size={15} /></button>}
  </section>;
}

const ROUND_LABEL: Record<QaRoundSummary['status'], string> = {
  draft: 'Draft', published: 'Ready to test', submitted: 'Submitted', withdrawn: 'Withdrawn', superseded: 'Replaced',
};
type Activity = { id: string; at: string; title: string; detail: string; open: () => void };

export function ProjectOverviewTab({ api, project, inspectionOnly, refreshToken, onOpenRequest, onShowRequests, onShowReview }: {
  api: Api; project: ClientProject; inspectionOnly: boolean; refreshToken: number;
  onOpenRequest: (item: ClientProjectRequestItem) => void; onShowRequests: (filter: ProjectRequestFilter) => void;
  onShowReview: () => void;
}) {
  const key = clientProjectKey(project);
  const requests = useScopedLoad<ClientProjectRequestQueue>(key,
    () => api.listProjectRequests(project.workspaceId, project.projectId, { limit: 100, filter: 'all' }), refreshToken);
  const rounds = useScopedLoad<QaRoundPage>(key, inspectionOnly ? async () => ({ items: [], nextBefore: null })
    : () => clientProjectQaApi.list(project.workspaceId, project.projectId), refreshToken);
  const messages = useScopedLoad<ClientTicketPage<ClientProjectFeedbackMessage>>(key,
    () => api.getProjectFeedbackMessages(project.workspaceId, project.projectId, { limit: 20 }), refreshToken);
  const roundList = useMemo(() => [...(rounds.data?.items ?? [])].filter(round => round.status !== 'draft')
    .sort((a, b) => b.number - a.number), [rounds.data]);
  const latestSummary = roundList[0] ?? null;
  const latest = useScopedLoad<QaRound>(latestSummary ? key + latestSummary.id : key,
    latestSummary ? () => clientProjectQaApi.get(project.workspaceId, project.projectId, latestSummary.id) : null, refreshToken);

  const items = requests.data?.items ?? [];
  const attention = items.filter(needsClient);
  const inProgress = items.filter(item => item.status === 'in_progress').length;
  const completed = items.filter(item => item.status === 'closed').length;
  const reviewDue = roundList.find(round => round.status === 'published') ?? null;
  const latestPm = [...(messages.data?.items ?? [])].reverse().find(message => message.author === 'pm') ?? null;
  const tested = latest.data?.items.filter(item => item.result.status !== 'not_tested').length ?? 0;
  const checks = latest.data?.items.length ?? 0;

  const activity: Activity[] = [
    ...[...items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6).map(item => ({
      id: 'r' + item.id, at: item.updatedAt, title: item.title,
      detail: item.projectLinkStatus === 'pending_review' ? 'Waiting to be added to this project'
        : clientTicketProgress(item.status, item.requestedAction).label, open: () => onOpenRequest(item) })),
    ...roundList.flatMap(round => [
      round.publishedAt ? { id: 'p' + round.id, at: round.publishedAt, title: `Review ${round.number} shared for testing`, detail: round.title, open: onShowReview } : null,
      round.submittedAt ? { id: 's' + round.id, at: round.submittedAt, title: `You submitted Review ${round.number}`, detail: round.title, open: onShowReview } : null,
    ].filter((entry): entry is Activity => entry !== null)),
    ...(messages.data?.items ?? []).slice(-4).map(message => ({
      id: 'm' + message.id, at: message.createdAt, title: message.author === 'pm' ? 'Your project manager wrote' : 'You wrote',
      detail: message.body, open: onShowReview })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6);
  const activityPending = requests.pending || rounds.pending || messages.pending;

  const stat = (value: number, label: string, filter: ProjectRequestFilter, emphasis = false) =>
    <button type="button" className={emphasis && value > 0 ? 'is-attention' : undefined} onClick={() => onShowRequests(filter)}>
      {requests.pending ? <Skeleton className="h-7 w-8" /> : <strong>{value}</strong>}<small>{label}</small></button>;

  return <div className="client-proj-overview">
    {requests.error && <p role="alert" className="client-project-error">{projectLoadError(requests.error, 'requests')} <button type="button" onClick={requests.reload}>Try again</button></p>}
    <div className="client-proj-stats" aria-label="Request progress">
      {stat(attention.length, 'Needs you', 'needs_client', true)}
      {stat(inProgress, 'In progress', 'open')}
      {stat(completed, 'Completed', 'history')}
    </div>
    <div className="client-overview-layout">
      <div className="client-overview-main">
        <section className="client-overview-panel is-highlight" aria-labelledby="client-proj-attention-title">
          <div className="client-section-heading"><div><h2 id="client-proj-attention-title">Needs your attention</h2>
            <p>Decisions, replies, and reviews waiting on you.</p></div></div>
          {requests.pending || rounds.pending ? <LoadingRows label="Loading items that need you" layout="detail" rows={1} className="px-5" />
            : !attention.length && !reviewDue ? <p className="client-section-state is-clear"><CheckCircle2 size={16} aria-hidden />You’re all caught up on this project.</p>
              : <div className="client-activity-list">
                {reviewDue && <button type="button" className="client-activity-row" onClick={onShowReview}>
                  <span className="client-activity-copy"><strong>{`Review ${reviewDue.number} is ready to test`}</strong><small>{reviewDue.title}</small></span>
                  <span className="client-status is-waiting">Test now</span>
                  {reviewDue.publishedAt ? <time dateTime={reviewDue.publishedAt}>{time(reviewDue.publishedAt)}</time> : <span />}
                  <ArrowRight size={15} aria-hidden /></button>}
                {attention.map(item => <button key={item.id} type="button" className="client-activity-row" onClick={() => onOpenRequest(item)}>
                  <span className="client-activity-copy"><strong>{item.title}</strong><small>{clientTicketProgress(item.status, item.requestedAction).label}</small></span>
                  <StatusPill status={item.status} requestedAction={item.requestedAction} />
                  <time dateTime={item.updatedAt}>{time(item.updatedAt)}</time>
                  <ArrowRight size={15} aria-hidden /></button>)}
              </div>}
        </section>
        <section className="client-overview-panel" aria-labelledby="client-proj-activity-title">
          <div className="client-section-heading"><div><h2 id="client-proj-activity-title">Recent activity</h2>
            <p>Latest updates across requests, reviews, and messages.</p></div>
            <button type="button" className="client-text-action" onClick={() => onShowRequests('all')}>All requests <ArrowRight size={15} /></button></div>
          {activityPending && !activity.length ? <LoadingRows label="Loading recent activity" layout="table" rows={4} />
            : activity.length ? <div className="client-proj-activity">{activity.map(entry => <button key={entry.id} type="button" onClick={entry.open}>
              <span><strong>{entry.title}</strong><small>{entry.detail}</small></span>
              <time dateTime={entry.at}>{time(entry.at)}</time></button>)}</div>
              : <p className="client-section-state">No activity yet. Updates from your project manager will appear here.</p>}
        </section>
      </div>
      <aside className="client-overview-rail">
        <section className="client-overview-panel" aria-labelledby="client-proj-review-title">
          <div className="client-section-heading"><div><h2 id="client-proj-review-title">Latest review</h2>
            <p>Builds your project manager shared for testing.</p></div></div>
          {rounds.pending ? <LoadingRows label="Loading review rounds" layout="detail" rows={2} />
            : rounds.error ? <p role="alert" className="client-project-error">{projectLoadError(rounds.error, 'review')}</p>
              : !latestSummary ? <p className="client-section-state">No review shared yet. When a build is ready to test, it appears here.</p>
                : <div className="client-proj-review">
                  <div className="client-proj-review-title"><strong>{`Review ${latestSummary.number}`} · {latestSummary.title}</strong>
                    <span className={`client-status ${latestSummary.status === 'published' ? 'is-waiting' : latestSummary.status === 'submitted' ? 'is-active' : 'is-neutral'}`}>{ROUND_LABEL[latestSummary.status]}</span></div>
                  {latest.pending ? <Skeleton className="h-1.5 w-full" /> : checks > 0 && <>
                    <div className="client-proj-progress" aria-hidden="true"><span style={{ width: `${Math.round((tested / checks) * 100)}%` }} /></div>
                    <small>{tested} of {checks} checks tested</small></>}
                  <button type="button" className="client-text-action" onClick={onShowReview}>
                    {latestSummary.status === 'published' ? (tested ? 'Continue review' : 'Start review') : 'View review'} <ArrowRight size={15} /></button>
                  {roundList.slice(1, 3).map(round => <p key={round.id} className="client-proj-earlier">
                    <span>{`Review ${round.number}`} · {round.title}</span><span>{ROUND_LABEL[round.status]}</span></p>)}
                </div>}
        </section>
        <section className="client-overview-panel" aria-labelledby="client-proj-message-title">
          <div className="client-section-heading"><div><h2 id="client-proj-message-title">From your project manager</h2>
            <p>The latest note in your project conversation.</p></div></div>
          {messages.pending ? <LoadingRows label="Loading the latest message" layout="conversation" rows={1} />
            : messages.error ? <p role="alert" className="client-project-error">{projectLoadError(messages.error, 'feedback')}</p>
              : latestPm ? <div className="client-proj-message"><p>{latestPm.body}</p>
                <div><time dateTime={latestPm.createdAt}>{time(latestPm.createdAt)}</time>
                  <button type="button" className="client-text-action" onClick={onShowReview}>Reply <ArrowRight size={15} /></button></div></div>
                : <p className="client-section-state">No messages yet. You can send feedback from Project Review.</p>}
        </section>
        <section className="client-overview-panel" aria-labelledby="client-proj-details-title">
          <div className="client-section-heading"><div><h2 id="client-proj-details-title">Project details</h2></div></div>
          <dl className="client-proj-details">
            <div><dt>Preview</dt><dd>{project.preview ? <a href={project.preview.url} target="_blank" rel="noopener noreferrer">UAT build <ExternalLink size={12} aria-hidden /></a> : 'Not shared yet'}</dd></div>
            <div><dt>Last updated</dt><dd>{time(project.updatedAt)}</dd></div>
            <div><dt>Requests</dt><dd>{requests.data ? items.length + (requests.data.nextCursor ? '+' : '') : '—'}</dd></div>
            <div><dt>Review rounds</dt><dd>{rounds.data ? roundList.length : '—'}</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  </div>;
}
