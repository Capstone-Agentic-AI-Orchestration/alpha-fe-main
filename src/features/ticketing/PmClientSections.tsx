import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, Download, ExternalLink, FileText, FolderKanban, Lightbulb, MessageSquare, Paperclip } from 'lucide-react';

import { Skeleton, SkeletonList, SkeletonRegion } from '@/shared/components/ui/skeleton';
import type { pmTicketApi, PmCentralIntakeItem, PmClientConversation, PmClientSummary, PmProjectFeedbackMessage, PmTicketQueueItem, PmTicketQueueOptions, PmTicketQueuePage } from './pmApi';
import { pmTicketNextAction } from './pmTicketNextAction';
import { downloadTicketDocument, type TicketDocument, type TicketDocumentsReadApi } from './ticketDocuments';
import { time } from './ticketUi';

/**
 * A client's Overview, Conversations and Documents tabs. Display only: replies,
 * files and every decision still happen inside the request, in the Tickets tab.
 */

const TERMINAL = new Set(['closed', 'declined', 'cancelled']);
export const isOpenRequest = (item: PmTicketQueueItem) => !TERMINAL.has(item.status);
const needsPm = (item: PmTicketQueueItem) => isOpenRequest(item) && item.internal.actionOwner === 'pm';
const needsAttention = (item: PmTicketQueueItem) => needsPm(item) || Boolean(item.internal.clientReplyUnread);
const statusLabel = (status: PmTicketQueueItem['status']) => {
  const label = status.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const fileSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`;

/** "3:01 AM" today, otherwise "Nov 15". */
export function shortWhen(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Every queue page for one client (up to a safe cap). */
export async function loadClientRequests(
  list: (options: PmTicketQueueOptions) => Promise<PmTicketQueuePage>, clientGroupKey: string, maxPages = 20,
): Promise<{ items: PmTicketQueueItem[]; complete: boolean }> {
  const items: PmTicketQueueItem[] = [];
  let after: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const result: PmTicketQueuePage = await list({ limit: 100, after, clientGroupKey });
    items.push(...result.items);
    if (!result.nextCursor) return { items, complete: true };
    after = result.nextCursor;
  }
  return { items, complete: false };
}

/** Run async work a few at a time, keeping a failed item as null. */
export async function mapLimited<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<Array<R | null>> {
  const results: Array<R | null> = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next; next += 1;
      try { results[index] = await work(items[index]); } catch { results[index] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function Panel({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return <section aria-label={title} className="min-w-0">
    <div className="flex items-baseline justify-between gap-3 pb-2.5">
      <h3 className="text-[13px] font-semibold text-content">{title}</h3>
      {caption && <p className="text-[11.5px] text-content-muted">{caption}</p>}
    </div>
    {children}
  </section>;
}

const rowClass = 'grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 border-t border-divider py-3 text-left';
const Empty = ({ children }: { children: ReactNode }) => <p className="border-t border-divider py-4 text-[13px] text-content-muted">{children}</p>;

/** A Panel-shaped placeholder: title bar, then icon / two-line / date rows like the real list. */
function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="min-w-0">
    <div className="flex items-center justify-between gap-3 pb-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-2 w-16" /></div>
    {Array.from({ length: rows }, (_, index) => <div key={index} className={rowClass}>
      <Skeleton className="h-3.5 w-3.5 justify-self-center" />
      <span className="min-w-0 space-y-1.5"><Skeleton className={`h-3 ${index % 2 ? 'w-2/5' : 'w-3/5'}`} /><Skeleton className="h-2 w-1/3" /></span>
      <Skeleton className="h-2 w-10" />
    </div>)}
  </div>;
}

function OverviewSkeleton() {
  return <SkeletonRegion label="Loading this client" className="px-6 py-5">
    <div className="mb-8 grid grid-cols-2 gap-x-8 gap-y-5 border-b border-divider pb-6 md:grid-cols-4">
      {[0, 1, 2, 3].map(index => <div key={index} className="flex flex-col gap-2">
        <Skeleton className="h-2.5 w-20" /><Skeleton className="h-5 w-6" />
      </div>)}
    </div>
    <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[1.3fr_1fr]"><PanelSkeleton rows={4} /><PanelSkeleton rows={3} /></div>
  </SkeletonRegion>;
}

interface ActivityEntry { at: string; requestId: string; message: boolean; text: string }

/** Open requests first (or all when none are open), those needing the PM on top, newest next. */
function listedRequests(requests: PmTicketQueueItem[]): PmTicketQueueItem[] {
  const open = requests.filter(isOpenRequest);
  return (open.length ? open : requests).slice().sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a))
    || Date.parse(b.internal.updatedAt) - Date.parse(a.internal.updatedAt)).slice(0, 6);
}

/** One line per request: its newest event, a message if that came last, otherwise its status. */
function recentActivity(client: PmClientSummary, requests: PmTicketQueueItem[], conversations: PmClientConversation[] | null): ActivityEntry[] {
  const byId = new Map(requests.map(item => [item.id, item]));
  const latest = new Map<string, ActivityEntry>();
  const consider = (entry: ActivityEntry) => {
    const current = latest.get(entry.requestId);
    if (Number.isFinite(Date.parse(entry.at)) && (!current || Date.parse(entry.at) > Date.parse(current.at))) latest.set(entry.requestId, entry);
  };
  for (const item of requests) consider({ at: item.internal.updatedAt, requestId: item.id, message: false, text: `${item.title} is now ${statusLabel(item.status).toLowerCase()}` });
  for (const item of conversations ?? []) {
    const request = byId.get(item.ticketId);
    if (!item.latestMessage || !request) continue;
    const fromClient = item.latestMessage.author === 'client';
    consider({ at: item.latestMessage.createdAt, requestId: item.ticketId, message: true,
      text: `${fromClient ? client.displayName : 'You'} ${fromClient ? 'wrote on' : 'replied on'} ${request.title}` });
  }
  return [...latest.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6);
}

export function ClientOverview({ client, requests, conversations, onOpenRequest }: {
  client: PmClientSummary;
  requests: PmTicketQueueItem[] | null;
  conversations: PmClientConversation[] | null;
  onOpenRequest: (requestId: string) => void;
}) {
  if (!requests) return <OverviewSkeleton />;
  const open = requests.filter(isOpenRequest);
  const listed = listedRequests(requests);
  const activity = recentActivity(client, requests, conversations);
  const stats = [
    { label: 'Need you', value: client.tickets.needsPm, attention: client.tickets.needsPm > 0 },
    { label: 'Waiting on client', value: client.tickets.waitingClient },
    { label: 'Open', value: client.tickets.open },
    { label: 'Closed', value: client.tickets.closed },
  ];
  const attentionCount = requests.filter(needsAttention).length;
  return <div className="h-full overflow-y-auto px-6 py-5">
    {/* Open figures, not tiles: a label over each number, one hairline under the row. */}
    <dl aria-label="Request summary" className="mb-8 grid grid-cols-2 gap-x-8 gap-y-5 border-b border-divider pb-6 md:grid-cols-4">
      {stats.map(stat => <div key={stat.label} className="flex flex-col gap-1">
        <dt className="text-xs text-content-secondary">{stat.label}</dt>
        <dd className={`text-xl font-semibold tabular-nums ${stat.attention ? 'text-status-warning' : 'text-content'}`}>{stat.value}</dd>
      </div>)}
    </dl>
    <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[1.3fr_1fr]">
      <Panel title={open.length ? 'Open requests' : 'Recent requests'}
        caption={attentionCount ? `${attentionCount} ${attentionCount === 1 ? 'needs' : 'need'} you` : open.length ? 'Nothing needs you right now' : undefined}>
        {listed.length ? <ul>{listed.map(item => {
          const step = pmTicketNextAction(item.internal.nextAction);
          return <li key={item.id}><button type="button" onClick={() => onOpenRequest(item.id)} className={`${rowClass} hover:bg-surface-high/40`}>
            <span aria-hidden="true" className={`h-2 w-2 justify-self-center rounded-full ${needsAttention(item) ? 'bg-status-warning' : 'bg-content-muted/60'}`} />
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2"><span className="truncate text-[13px] font-medium text-content" title={item.title}>{item.title}</span>
                {item.internal.clientReplyUnread && <span className="shrink-0 rounded-full bg-selected px-1.5 text-[10.5px] font-semibold text-selected-content">New reply</span>}</span>
              <span className="block truncate text-[11.5px] text-content-muted">{statusLabel(item.status)}{step ? ` · ${step}` : ''}{item.internal.projectName ? ` · ${item.internal.projectName}` : ''}</span>
            </span>
            <time dateTime={item.internal.updatedAt} title={time(item.internal.updatedAt)} className="text-[11.5px] tabular-nums text-content-muted">{shortWhen(item.internal.updatedAt)}</time>
          </button></li>;
        })}</ul> : <Empty>This client has no requests yet.</Empty>}
      </Panel>
      <Panel title="Recent activity">
        {activity.length ? <ul>{activity.map(entry => <li key={entry.requestId}>
          <button type="button" onClick={() => onOpenRequest(entry.requestId)} className={`${rowClass} hover:bg-surface-high/40`}>
            {entry.message ? <MessageSquare className="h-3.5 w-3.5 text-link" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5 text-link" aria-hidden="true" />}
            <span className="truncate text-[13px] text-content" title={entry.text}>{entry.text}</span>
            <time dateTime={entry.at} title={time(entry.at)} className="text-[11.5px] tabular-nums text-content-muted">{shortWhen(entry.at)}</time>
          </button></li>)}</ul> : <Empty>No activity yet.</Empty>}
      </Panel>
    </div>
  </div>;
}

export function ClientConversations({ client, requests, conversations, error, onOpenRequest }: {
  client: PmClientSummary;
  requests: PmTicketQueueItem[] | null;
  conversations: PmClientConversation[] | null;
  error: string;
  onOpenRequest: (requestId: string) => void;
}) {
  const byId = useMemo(() => new Map((requests ?? []).map(item => [item.id, item])), [requests]);
  if (error) return <p role="alert" className="mx-6 my-5 rounded-md border border-status-danger-border bg-status-danger-subtle px-3 py-2 text-[13px] text-status-danger">{error}</p>;
  if (!conversations || !requests) return <SkeletonRegion label="Loading conversations" className="px-6 py-5"><PanelSkeleton rows={4} /></SkeletonRegion>;
  const updated = (item: PmClientConversation) => item.latestMessage?.createdAt ?? byId.get(item.ticketId)?.updatedAt ?? '';
  const rows = conversations.filter(item => byId.has(item.ticketId)).sort((a, b) => Date.parse(updated(b)) - Date.parse(updated(a)));
  return <div className="h-full overflow-y-auto px-6 py-5">
    <Panel title="Conversations" caption="One per request. Internal notes stay inside each request.">
      {rows.length ? <ul>{rows.map(item => {
        const request = byId.get(item.ticketId)!;
        const message = item.latestMessage;
        const preview = message ? `${message.author === 'client' ? client.displayName : 'You'}: ${message.preview}${message.truncated ? '…' : ''}` : 'No messages yet';
        return <li key={item.ticketId}><button type="button" onClick={() => onOpenRequest(item.ticketId)} className={`${rowClass} hover:bg-surface-high/40`}>
          <MessageSquare className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2"><span className="truncate text-[13px] font-medium text-content" title={request.title}>{request.title}</span>
              {request.internal.clientReplyUnread && <span className="shrink-0 rounded-full bg-selected px-1.5 text-[10.5px] font-semibold text-selected-content">New</span>}</span>
            <span className="block truncate text-[11.5px] text-content-muted" title={message?.preview}>{preview}</span>
          </span>
          <time dateTime={updated(item)} className="text-[11.5px] tabular-nums text-content-muted">{shortWhen(updated(item))}</time>
        </button></li>;
      })}</ul> : <Empty>This client has no request conversations yet.</Empty>}
    </Panel>
  </div>;
}

export function ClientDocuments({ requests, documentsApi, onOpenRequest }: {
  requests: PmTicketQueueItem[] | null;
  documentsApi: TicketDocumentsReadApi;
  onOpenRequest: (requestId: string) => void;
}) {
  const [documents, setDocuments] = useState<Array<{ document: TicketDocument; request: PmTicketQueueItem }> | null>(null);
  const [failed, setFailed] = useState(0);
  const [requestFilter, setRequestFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState<'' | 'client' | 'pm'>('');
  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState('');
  useEffect(() => {
    if (!requests) return;
    let current = true;
    setDocuments(null);
    void mapLimited(requests, 4, async request => (await documentsApi.list(undefined, request.id)).map(document => ({ document, request }))).then(results => {
      if (!current) return;
      setFailed(results.filter(result => result === null).length);
      setDocuments(results.flatMap(result => result ?? []).sort((a, b) => Date.parse(b.document.createdAt) - Date.parse(a.document.createdAt)));
    });
    return () => { current = false; };
  }, [documentsApi, requests]);
  async function download(entry: { document: TicketDocument; request: PmTicketQueueItem }) {
    setDownloading(entry.document.id); setDownloadError('');
    try { downloadTicketDocument(await documentsApi.download(undefined, entry.request.id, entry.document.id), entry.document); }
    catch { setDownloadError(`${entry.document.filename} could not be downloaded.`); }
    finally { setDownloading(''); }
  }
  if (!requests || !documents) return <SkeletonRegion label="Loading documents" className="px-6 py-5"><div className="mb-3 flex gap-2"><Skeleton className="h-8 w-32" /><Skeleton className="h-8 w-24" /></div><PanelSkeleton rows={4} /></SkeletonRegion>;
  const shown = documents.filter(entry => (!requestFilter || entry.request.id === requestFilter) && (!authorFilter || entry.document.author === authorFilter));
  const select = 'h-8 rounded-md border border-control bg-well px-2.5 text-xs text-content';
  return <div className="h-full overflow-y-auto px-6 py-5">
    {documents.length > 0 && <div className="mb-3 flex flex-wrap gap-2">
      <select aria-label="Filter documents by request" value={requestFilter} onChange={event => setRequestFilter(event.target.value)} className={select}>
        <option value="">All requests</option>{requests.map(request => <option key={request.id} value={request.id}>{request.title}</option>)}
      </select>
      <select aria-label="Filter documents by who added them" value={authorFilter} onChange={event => setAuthorFilter(event.target.value as '' | 'client' | 'pm')} className={select}>
        <option value="">Anyone</option><option value="client">From the client</option><option value="pm">From the project team</option>
      </select>
    </div>}
    {failed > 0 && <p role="status" className="mb-3 text-[11.5px] text-content-muted">Files from {failed} {failed === 1 ? 'request' : 'requests'} could not be loaded.</p>}
    {downloadError && <p role="alert" className="mb-3 text-[11.5px] text-status-danger">{downloadError}</p>}
    <Panel title="Documents" caption={`${shown.length} ${shown.length === 1 ? 'file' : 'files'}`}>
      {shown.length ? <ul>{shown.map(entry => <li key={`${entry.request.id}:${entry.document.id}`} className={rowClass}>
        <Paperclip className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-content" title={entry.document.filename}>{entry.document.filename}</span>
          <span className="block truncate text-[11.5px] text-content-muted">
            <button type="button" onClick={() => onOpenRequest(entry.request.id)} className="text-link hover:text-link-hover">{entry.request.title}</button>
            {` · ${entry.document.author === 'client' ? 'from the client' : 'from the project team'} · ${fileSize(entry.document.byteLength)} · ${shortWhen(entry.document.createdAt)}`}
          </span>
        </span>
        {entry.document.status === 'available'
          ? <button type="button" aria-label={`Download ${entry.document.filename}`} title="Download" disabled={downloading === entry.document.id}
            onClick={() => void download(entry)} className="grid h-7 w-7 place-items-center rounded-md border border-divider text-content-secondary hover:bg-surface-high hover:text-content disabled:opacity-50">
            <Download className="h-3.5 w-3.5" aria-hidden="true" /></button>
          : <span className="text-[11.5px] text-content-muted">Processing</span>}
      </li>)}</ul> : <Empty>{documents.length ? 'No files match these filters.' : 'No files have been shared on this client’s requests.'}</Empty>}
    </Panel>
  </div>;
}

/** One project a client can see, with its client preview and this client's latest project feedback. */
export interface ClientProjectDetail {
  projectId: string;
  name: string;
  previewPublished: boolean;
  previewUrl: string | null;
  /** Newest first, at most three; null when it could not be loaded. */
  feedback: PmProjectFeedbackMessage[] | null;
}

type ProjectApi = Pick<typeof pmTicketApi, 'getProjectClientPreview' | 'listProjectPreviewClients' | 'getProjectFeedbackMessages'>;

/** Load each project's preview link and this client's latest feedback; one failing project never hides the others. */
export async function loadClientProjects(api: ProjectApi, client: PmClientSummary): Promise<ClientProjectDetail[]> {
  // The queue keys a client account as "client:" + its account ID, which is the feedback thread's client ID.
  const clientId = client.key.startsWith('client:') ? client.key.slice('client:'.length) : null;
  return Promise.all(client.projects.map(async project => {
    const base = { ...project, previewUrl: null, feedback: null };
    try {
      const [preview, viewers] = await Promise.all([
        api.getProjectClientPreview(project.projectId).catch(() => ({ preview: null })),
        api.listProjectPreviewClients(project.projectId),
      ]);
      const viewer = clientId ? viewers.items.find(item => item.clientId === clientId) : undefined;
      const feedback = viewer
        ? (await api.getProjectFeedbackMessages(project.projectId, viewer.clientId, { limit: 3 })).items
          .slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3)
        : [];
      return { ...base, previewUrl: preview.preview?.url ?? null, feedback };
    } catch {
      return base;
    }
  }));
}

/** Where the client preview stands: shared for review, a link set but not shared, or none yet. */
export const previewState = (published: boolean, hasLink: boolean) => published ? 'Shared with the client for review'
  : hasLink ? 'Preview link ready · not shared with the client yet' : 'No preview yet';

/** Only a web address can be opened from here; anything else is shown as not shared. */
const safeUrl = (value: string | null) => {
  if (!value) return null;
  try { return ['https:', 'http:'].includes(new URL(value).protocol) ? value : null; } catch { return null; }
};

export function ClientProjects({ client, projects, knownProjectIds, onOpenProject }: {
  client: PmClientSummary;
  projects: ClientProjectDetail[] | null;
  knownProjectIds: ReadonlySet<string>;
  onOpenProject: (projectId: string) => void;
}) {
  if (!client.projects.length) return <p className="text-[13px] text-content-muted">This client can’t see any projects yet. A project shows here once one of their requests is linked to it and shared with them.</p>;
  if (!projects) return <SkeletonList label="Loading projects" rows={2} />;
  return <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
    {projects.map(project => <ClientProjectCard key={project.projectId} client={client} project={project}
      canOpen={knownProjectIds.has(project.projectId)} onOpenProject={onOpenProject} />)}
  </div>;
}

function ClientProjectCard({ client, project, canOpen, onOpenProject }: {
  client: PmClientSummary;
  project: ClientProjectDetail;
  canOpen: boolean;
  onOpenProject: (projectId: string) => void;
}) {
  const url = safeUrl(project.previewUrl);
  return <section aria-label={project.name} className="min-w-0 border-t border-divider pt-4">
    <div className="flex items-start gap-3 pb-2">
      <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-content-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[13px] font-semibold text-content" title={project.name}>{project.name}</h3>
        <p className="text-[11.5px] text-content-muted">{previewState(project.previewPublished, Boolean(url))}</p>
      </div>
      {/* Only link to a project this PM's project list has; never a dead link. */}
      {canOpen && <button type="button" onClick={() => onOpenProject(project.projectId)}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-link hover:text-link-hover">
        Open project <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>}
    </div>
    {url && <a href={url} target="_blank" rel="noreferrer noopener"
      className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-link hover:text-link-hover">
      Open preview <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>}
    <div className="mt-2">
      <h4 className="mb-2 text-[11.5px] font-medium text-content-muted">Latest feedback on this project</h4>
      {project.feedback === null
        ? <p className="text-[12.5px] text-content-muted">Project feedback could not be loaded.</p>
        : project.feedback.length === 0
          ? <p className="text-[12.5px] text-content-muted">No project feedback from this client yet.</p>
          : <ul className="space-y-2">{project.feedback.map(message => <li key={message.id} className="min-w-0">
            <p className="text-[11px] text-content-muted">
              {message.author === 'client' ? client.displayName : 'You'} · <time dateTime={message.createdAt} title={time(message.createdAt)}>{shortWhen(message.createdAt)}</time>
            </p>
            <p className="line-clamp-2 text-[13px] text-content" title={message.body}>{message.body}</p>
          </li>)}</ul>}
    </div>
  </section>;
}

const PROPOSAL_STATUS: Record<NonNullable<PmCentralIntakeItem['status']>, string> = {
  pending: 'Waiting for your review', awaiting_client: 'Waiting on the client', accepted: 'Accepted', declined: 'Declined',
};

/** A client's project proposals, sent from their portal. Decisions stay in Inquiries. */
export function ClientProposals({ proposals, error, onOpenInquiries }: {
  proposals: PmCentralIntakeItem[] | null;
  error: string;
  onOpenInquiries: () => void;
}) {
  if (error) return <div className="px-6 py-5"><p role="alert" className="rounded-md border border-status-danger-border bg-status-danger-subtle px-3 py-2 text-[13px] text-status-danger">{error}</p></div>;
  if (!proposals) return <SkeletonRegion label="Loading proposals" className="px-6 py-5"><PanelSkeleton rows={3} /></SkeletonRegion>;
  const open = proposals.filter(item => item.status === 'pending' || item.status === 'awaiting_client' || item.status === undefined).length;
  return <div className="h-full overflow-y-auto px-6 py-5">
    <Panel title="Project proposals" caption={open ? `${open} still open` : undefined}>
      {proposals.length ? <ul>{proposals.map(item => <li key={item.id} className={`${rowClass} items-start`}>
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-content" title={item.title}>{item.title}</span>
          <span className="block line-clamp-2 text-[12px] text-content-muted" title={item.description}>{item.description}</span>
          <span className="mt-0.5 block text-[11.5px] text-content-secondary">{PROPOSAL_STATUS[item.status ?? 'pending']}</span>
        </span>
        <time dateTime={item.submittedAt} title={time(item.submittedAt)} className="text-[11.5px] tabular-nums text-content-muted">{shortWhen(item.submittedAt)}</time>
      </li>)}</ul> : <Empty>This client hasn’t sent any project proposals.</Empty>}
    </Panel>
    <p className="mt-3 text-xs text-content-muted">Proposals are reviewed, clarified and accepted in{' '}
      <button type="button" onClick={onOpenInquiries} className="font-semibold text-link hover:text-link-hover">Inquiries</button>.</p>
  </div>;
}
