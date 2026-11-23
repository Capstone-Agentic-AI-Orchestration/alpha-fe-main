import './pmTickets.css';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, FolderKanban, RefreshCw, Search, ShieldCheck, ShieldOff, Users } from 'lucide-react';

import { useApp, useTabSessionState } from '@/app/AppContext';
import { ApiRequestError } from '@/shared/services/apiService';
import { SkeletonTable } from '@/shared/components/ui/skeleton';
import { pmTicketApi, pmTicketDocumentsApi, type PmCentralIntakeItem, type PmClientConversation, type PmClientSummary, type PmTicketQueueItem } from './pmApi';
import { PmTicketsView, type WorkflowActions } from './PmTicketsView';
import { pmTicketsIntakeEnabled, usePmWorkflowActions } from './PmTicketsPage';
import { ClientConversations, ClientDocuments, ClientOverview, ClientProjects, ClientProposals, loadClientProjects, loadClientRequests, type ClientProjectDetail } from './PmClientSections';
import type { TicketDocumentsReadApi } from './ticketDocuments';
import { OPEN_INQUIRY_KEY, type OpenInquiry } from './PmInquiriesPage';
import { PmClientConversationTab, PmRequestConversation, clientIdFromKey, type ConversationLinkableTask, type ConversationTaskDraft, type PmConversationFocus } from './PmClientConversation';
import { LINKED_REQUEST_KEY, type LinkedRequestDraft } from './requestTaskLink';
import { CLIENTS_CONVERSATION_FOCUS_KEY } from './TaskClientRequest';

export type ClientSection = 'overview' | 'conversation' | 'tickets' | 'conversations' | 'documents' | 'proposals' | 'projects' | 'access';
const SECTIONS: Array<{ id: ClientSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'Projects' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'documents', label: 'Documents' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'access', label: 'Access' },
];

/**
 * Why the list could not load, in words a PM can act on. In the desktop app
 * ticket requests are relayed to the cloud, and the relay passes its failures
 * through: 503 without a cloud connection, 502 when the cloud cannot be
 * reached, 404 when the cloud predates this page.
 */
export function clientsLoadError(error: unknown): string {
  const status = error instanceof ApiRequestError ? error.status : null;
  if (status === 503) return 'Clients need a connection to your team’s Alpha cloud workspace. Connect this workspace, then refresh.';
  if (status === 502) return 'The Alpha cloud can’t be reached right now. Check your connection and refresh.';
  if (status === 404) return 'The client list isn’t available on the server yet. It appears once the server is updated.';
  if (status === 401) return 'Sign in again to see your clients.';
  if (status === 403) return 'Only project managers can see the client list.';
  return 'The client list could not be loaded. Refresh to try again.';
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Why a client's proposals could not load; an older server rejects the client filter. */
export function proposalsLoadError(error: unknown): string {
  const status = error instanceof ApiRequestError ? error.status : null;
  if (status === 400 || status === 404) return 'Proposals by client aren’t available on the server yet. They appear once the server is updated; until then they are in Inquiries.';
  if (status === 403) return 'Only project managers can see proposals.';
  return 'Proposals could not be loaded. Refresh to try again.';
}
const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
/** Up to two initials for a client's avatar. */
export const clientInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase() || '?';

/** A client needs the PM when a request waits on them or a client reply is unread. */
export const clientNeedsYou = (client: PmClientSummary) => client.tickets.needsPm > 0 || (client.tickets.unreadReplies ?? 0) > 0;

/** Clients matching a search (name, company or project) and, optionally, only those needing the PM. */
export function filterClients(clients: readonly PmClientSummary[], search: string, needsYouOnly: boolean): PmClientSummary[] {
  const query = search.trim().toLowerCase();
  return clients.filter(client => (!needsYouOnly || clientNeedsYou(client)) && (!query
    || [client.displayName, client.company ?? '', ...client.projects.map(project => project.name)].join(' ').toLowerCase().includes(query)));
}

/** One line on what is waiting, across all clients; empty when nothing is. */
export function clientsSummary(clients: readonly PmClientSummary[]): string {
  const needYou = clients.filter(clientNeedsYou).length;
  const unread = clients.reduce((total, client) => total + (client.tickets.unreadReplies ?? 0), 0);
  const waiting = clients.reduce((total, client) => total + client.tickets.waitingClient, 0);
  return [
    needYou > 0 && `${plural(needYou, 'client')} ${needYou === 1 ? 'needs' : 'need'} you`,
    unread > 0 && plural(unread, 'unread reply', 'unread replies'),
    waiting > 0 && `${plural(waiting, 'request')} ${waiting === 1 ? 'is' : 'are'} waiting on the client`,
  ].filter(Boolean).join(' · ');
}

/**
 * Clients: every client account in the workspace, those needing the PM first.
 * A client opens on its own page with three tabs: its tickets (the Tickets
 * view locked to this client), the projects it can see, and its portal access.
 * The Tickets page remains the queue across all clients.
 */
export function PmClientsPage() {
  const { activeWorkspace, projects, setActiveTab, issues, activeTabId, setTabSessionState } = useApp();
  // Tab session state, so "View client" on a ticket can open a client here.
  const [selectedKey, setSelectedKey] = useTabSessionState<string | null>('clients.selected', null);
  const [section, setSection] = useTabSessionState<ClientSection>('clients.section', 'overview');
  const [, setOpenInquiry] = useTabSessionState<OpenInquiry | null>(OPEN_INQUIRY_KEY, null);
  // Set by a task's "Client request" link: open that project's conversation on that request.
  const [conversationFocus, setConversationFocus] = useTabSessionState<PmConversationFocus | null>(CLIENTS_CONVERSATION_FOCUS_KEY, null);
  const workflowActions = usePmWorkflowActions();
  const knownProjectIds = useMemo(() => new Set(projects.map(project => project.id)), [projects]);

  return <PmClientsWorkspace workspaceKey={activeWorkspace?.id ?? 'none'} intakeEnabled={pmTicketsIntakeEnabled}
    workflowActions={workflowActions} selectedKey={selectedKey} onSelectKey={setSelectedKey} section={section} onSection={setSection}
    knownProjectIds={knownProjectIds} onOpenProject={projectId => { setConversationFocus({ projectId }); setSection('conversation'); }}
    onOpenInquiries={inquiry => { setOpenInquiry(inquiry ?? null); setActiveTab('inquiries'); }}
    conversationFocus={conversationFocus} onConversationFocusHandled={() => setConversationFocus(null)}
    onCreateTask={draft => {
      // Fill the New task dialog for this project and remember which request the task is for.
      const linked: LinkedRequestDraft | null = draft.request ? { ...draft.request, source: 'conversation' } : null;
      setTabSessionState(activeTabId, 'issueModal.project', draft.projectId);
      setTabSessionState(activeTabId, 'issueModal.title', draft.title);
      setTabSessionState(activeTabId, 'issueModal.description', draft.description);
      setTabSessionState(activeTabId, LINKED_REQUEST_KEY, linked);
      setTabSessionState(activeTabId, 'issueModal.open', true);
    }}
    tasksForProject={projectId => issues.filter(issue => issue.projectId === projectId && !issue.archivedAt)
      .map(issue => ({ id: issue.id, identifier: issue.identifier, title: issue.title }))} />;
}

/**
 * The Clients list and a client's page with its data: the summary list, and for the
 * open client its requests and their latest messages. Used by the PM app and the
 * development preview, which supplies sample APIs and its own selection state.
 */
export function PmClientsWorkspace({ api = pmTicketApi, documentsApi = pmTicketDocumentsApi, workspaceKey, intakeEnabled = true,
  workflowActions = 'all', selectedKey, onSelectKey, section, onSection, knownProjectIds, onOpenProject, onOpenInquiries, refreshToken,
  conversationFocus: externalFocus = null, onConversationFocusHandled, onCreateTask, tasksForProject }: {
  api?: typeof pmTicketApi;
  documentsApi?: TicketDocumentsReadApi;
  workspaceKey: string;
  intakeEnabled?: boolean;
  workflowActions?: WorkflowActions;
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  section: ClientSection;
  onSection: (section: ClientSection) => void;
  knownProjectIds: ReadonlySet<string>;
  onOpenProject: (projectId: string) => void;
  onOpenInquiries: (inquiry?: OpenInquiry) => void;
  /** Parent-owned refresh, as in the preview toolbar. */
  refreshToken?: number;
  /** A project and request to open the Conversation tab on, from elsewhere in the app. */
  conversationFocus?: PmConversationFocus | null;
  onConversationFocusHandled?: () => void;
  /** Opens the New task dialog from the conversation; absent in the UI preview. */
  onCreateTask?: (draft: ConversationTaskDraft) => void;
  tasksForProject?: (projectId: string) => ConversationLinkableTask[];
}) {
  const [clients, setClients] = useState<PmClientSummary[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [needsYouOnly, setNeedsYouOnly] = useState(false);
  const [requests, setRequests] = useState<PmTicketQueueItem[] | null>(null);
  const [conversations, setConversations] = useState<PmClientConversation[] | null>(null);
  const [conversationsError, setConversationsError] = useState('');
  const [projectDetails, setProjectDetails] = useState<ClientProjectDetail[] | null>(null);
  const [proposals, setProposals] = useState<PmCentralIntakeItem[] | null>(null);
  const [proposalsError, setProposalsError] = useState('');
  // A request picked on Overview, Conversations or Documents, opened in the Tickets tab.
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  // The project and request the Conversation tab opens on, when picked elsewhere.
  const [conversationFocus, setConversationFocus] = useState<PmConversationFocus | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    void api.listClients().then(items => {
      if (current) setClients(items);
    }).catch(failure => {
      if (current) { setClients(null); setError(clientsLoadError(failure)); }
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [api, workspaceKey, refreshVersion, refreshToken]);

  const refresh = useCallback(() => setRefreshVersion(value => value + 1), []);
  const selected = clients?.find(client => client.key === selectedKey) ?? null;

  // A saved selection from another workspace, or a client that no longer
  // exists, falls back to the list rather than an empty page.
  useEffect(() => {
    if (clients && selectedKey && !selected) onSelectKey(null);
  }, [clients, selectedKey, selected, onSelectKey]);

  // The open client's requests and latest messages, for Overview, Conversations and Documents.
  useEffect(() => {
    setRequests(null); setConversations(null); setConversationsError(''); setProposals(null); setProposalsError(''); setOpenRequestId(null);
    setConversationFocus(null);
    if (!selectedKey || !intakeEnabled) return;
    let current = true;
    void loadClientRequests(options => api.list(options), selectedKey).then(result => { if (current) setRequests(result.items); })
      .catch(() => { if (current) setRequests([]); });
    void api.listClientConversations(selectedKey).then(page => { if (current) setConversations(page.items); })
      .catch(() => { if (current) setConversationsError('Conversations could not be loaded. Refresh to try again.'); });
    void api.listClientProposals(selectedKey).then(items => { if (current) setProposals(items); })
      .catch(failure => { if (current) setProposalsError(proposalsLoadError(failure)); });
    return () => { current = false; };
  }, [api, selectedKey, intakeEnabled, refreshVersion, refreshToken]);

  // After the per-client reset above, so a focus that arrives with a new client survives it.
  useEffect(() => {
    if (!externalFocus) return;
    setConversationFocus(externalFocus);
    onConversationFocusHandled?.();
  }, [externalFocus, onConversationFocusHandled]);

  // The open client's projects, with preview links and feedback, once its summary is loaded.
  useEffect(() => {
    setProjectDetails(null);
    if (!selected || !intakeEnabled) return;
    let current = true;
    void loadClientProjects(api, selected).then(details => { if (current) setProjectDetails(details); });
    return () => { current = false; };
  }, [api, selected, intakeEnabled]);

  /** A request opens in its project's conversation; one not on a project yet opens its full page. */
  const openRequest = (requestId: string) => {
    const projectId = requests?.find(item => item.id === requestId)?.internal.projectId ?? null;
    if (projectId) { setConversationFocus({ projectId, ticketId: requestId }); onSection('conversation'); return; }
    setOpenRequestId(requestId); onSection('tickets');
  };
  const openRequestDetails = (requestId: string) => { setOpenRequestId(requestId); onSection('tickets'); };

  return <PmClientsView clients={clients} error={error} loading={loading} search={search} onSearch={setSearch}
    needsYouOnly={needsYouOnly} onNeedsYouOnly={setNeedsYouOnly}
    selectedKey={selectedKey} onSelect={key => { onSelectKey(key); if (key) onSection('overview'); }}
    section={section} onSection={next => { if (next === 'tickets') setOpenRequestId(null); onSection(next); }}
    knownProjectIds={knownProjectIds} onRefresh={refreshToken === undefined ? refresh : undefined} onOpenProject={onOpenProject} onOpenInquiries={onOpenInquiries}
    renderTickets={key => <div className="pm-ticket-page pm-ticket-page--nested">
      <div className="pm-ticket-page__content">
        <PmTicketsView key={`${workspaceKey}:${key}:${openRequestId ?? 'list'}`} api={api} documentsApi={documentsApi}
          fixedClientGroupKey={key} initialSelectedId={openRequestId}
          intakeEnabled={intakeEnabled} workflowActions={workflowActions} communicationEnabled
          renderRequestConversation={({ detail, replyKind, onReplyKindChange, onWritten }) => {
            // A request the client sees on a project lives in that project's one conversation.
            const clientId = clientIdFromKey(key);
            if (!clientId || !detail.internal.projectId || !detail.internal.projectClientVisible) return null;
            return <PmRequestConversation key={detail.id} api={api} projectId={detail.internal.projectId} clientId={clientId}
              ticketId={detail.id} ticketTitle={detail.title} clientName={detail.internal.request?.contact?.fullName ?? detail.companyLabel}
              replyKind={replyKind} onReplyKindChange={onReplyKindChange} onWritten={onWritten} onCreateTask={onCreateTask}
              writesAvailable={detail.writesAvailable} />;
          }} />
      </div>
    </div>}
    renderConversation={client => <PmClientConversationTab api={api} documentsApi={documentsApi} client={client} focus={conversationFocus}
      onBackToProjects={() => onSection('projects')} onOpenRequestDetails={openRequestDetails} onCreateTask={onCreateTask}
      tasksForProject={tasksForProject} refreshToken={refreshToken} />}
    renderOverview={client => <ClientOverview client={client} requests={requests} conversations={conversations} onOpenRequest={openRequest} />}
    renderConversations={client => <ClientConversations client={client} requests={requests} conversations={conversations}
      error={conversationsError} onOpenRequest={openRequest} />}
    renderDocuments={() => <ClientDocuments requests={requests} documentsApi={documentsApi} onOpenRequest={openRequest} />}
    renderProposals={() => <ClientProposals proposals={proposals} error={proposalsError} onOpenInquiries={onOpenInquiries} />}
    renderProjects={client => <ClientProjects client={client} projects={projectDetails} knownProjectIds={knownProjectIds} onOpenProject={onOpenProject} />} />;
}

export interface PmClientsViewProps {
  clients: PmClientSummary[] | null;
  error: string;
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  /** Show only clients with requests waiting on the PM. The toggle appears when `onNeedsYouOnly` is given. */
  needsYouOnly?: boolean;
  onNeedsYouOnly?: (value: boolean) => void;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  section: ClientSection;
  onSection: (section: ClientSection) => void;
  /** Projects in this PM's project list; others are named but not linked. */
  knownProjectIds: ReadonlySet<string>;
  /** Omitted when the parent owns refreshing, so the page shows no second Refresh. */
  onRefresh?: () => void;
  onOpenProject: (projectId: string) => void;
  onOpenInquiries: (inquiry?: OpenInquiry) => void;
  /** The Tickets tab's content for one client. */
  renderTickets: (clientKey: string) => ReactNode;
  /** Optional tabs; each appears only when given. */
  renderOverview?: (client: PmClientSummary) => ReactNode;
  /**
   * One conversation per project. When given, it replaces the Tickets and
   * Conversations tabs; a request's full page (Tickets) opens from it.
   */
  renderConversation?: (client: PmClientSummary) => ReactNode;
  renderConversations?: (client: PmClientSummary) => ReactNode;
  renderDocuments?: (client: PmClientSummary) => ReactNode;
  renderProposals?: (client: PmClientSummary) => ReactNode;
  /** Replaces the plain project list, as with preview links and feedback. */
  renderProjects?: (client: PmClientSummary) => ReactNode;
}

/** The Clients list and a client's page, from props alone. */
export function PmClientsView({ clients, error, loading, search, onSearch, selectedKey, onSelect, section, onSection,
  needsYouOnly = false, onNeedsYouOnly, renderProjects, renderProposals,
  knownProjectIds, onRefresh, onOpenProject, onOpenInquiries, renderTickets, renderOverview, renderConversation, renderConversations, renderDocuments }: PmClientsViewProps) {
  const selected = clients?.find(client => client.key === selectedKey) ?? null;
  const visible = useMemo(() => filterClients(clients ?? [], search, needsYouOnly), [clients, search, needsYouOnly]);
  const summary = useMemo(() => clientsSummary(clients ?? []), [clients]);

  if (selected) {
    const unified = Boolean(renderConversation);
    const optional: Partial<Record<ClientSection, ((client: PmClientSummary) => ReactNode) | undefined>> = {
      overview: renderOverview, conversation: renderConversation, conversations: unified ? undefined : renderConversations,
      documents: renderDocuments, proposals: renderProposals,
    };
    // With one conversation per project, a request's full page is reached from it, not from a tab.
    const sections = SECTIONS.filter(item => (!(item.id in optional) || optional[item.id]) && !(unified && item.id === 'tickets'));
    const requested: ClientSection = unified && section === 'conversations' ? 'conversation' : section;
    const openSection: ClientSection = unified && requested === 'tickets' ? 'tickets'
      : sections.some(item => item.id === requested) ? requested : unified ? 'conversation' : 'tickets';
    const highlighted: ClientSection = unified && openSection === 'tickets' ? 'conversation' : openSection;
    const badgeSection: ClientSection = unified ? 'conversation' : 'tickets';
    return <div className="flex h-full min-h-0 flex-col bg-canvas">
      {/* One row: back icon and section tabs on the left, the client on the right. */}
      <header className="flex shrink-0 items-center gap-4 border-b border-divider px-6">
        <button type="button" onClick={() => onSelect(null)} aria-label="All clients" title="All clients"
          className="-ml-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-content-muted hover:bg-surface-high hover:text-content">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div role="tablist" aria-label="Client sections" className="no-scrollbar flex min-w-0 gap-5 overflow-x-auto">
          {sections.map(item => <button key={item.id} type="button" role="tab" aria-selected={highlighted === item.id}
            onClick={() => onSection(item.id)}
            className={`relative inline-flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium ${highlighted === item.id
              ? 'text-content after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-link'
              : 'text-content-muted hover:text-content-secondary'}`}>
            {item.label}
            {item.id === badgeSection && selected.tickets.needsPm > 0 && <span className="rounded-full bg-selected px-1.5 text-[10.5px] font-semibold text-selected-content">{selected.tickets.needsPm}</span>}
          </button>)}
        </div>
        <div className="ml-auto min-w-0 max-w-[40%] py-1.5 text-right">
          <h1 className="truncate text-[15px] font-semibold leading-5 text-content" title={selected.displayName}>{selected.displayName}</h1>
          <p className="truncate text-xs text-content-muted">
            {[selected.company && selected.company.trim().toLowerCase() !== selected.displayName.trim().toLowerCase() ? selected.company : null, plural(selected.tickets.open, 'open request'), plural(selected.projects.length, 'project')].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      <div role="tabpanel" aria-label={SECTIONS.find(item => item.id === highlighted)?.label} className="min-h-0 flex-1">
        {openSection === 'overview' && renderOverview?.(selected)}
        {openSection === 'conversation' && renderConversation?.(selected)}
        {openSection === 'tickets' && (unified ? <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-divider px-6 py-2">
            <button type="button" onClick={() => onSection('conversation')} className="inline-flex items-center gap-1.5 text-xs font-medium text-content-muted hover:text-content">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to conversation
            </button>
          </div>
          <div className="min-h-0 flex-1">{renderTickets(selected.key)}</div>
        </div> : renderTickets(selected.key))}
        {openSection === 'conversations' && renderConversations?.(selected)}
        {openSection === 'documents' && renderDocuments?.(selected)}
        {openSection === 'proposals' && renderProposals?.(selected)}

        {openSection === 'projects' && <div className="h-full overflow-y-auto px-6 py-5">
          {renderProjects ? renderProjects(selected) : selected.projects.length === 0
            ? <p className="text-[13px] text-content-muted">This client can’t see any projects yet. A project shows here once one of their requests is linked to it and shared with them.</p>
            : <ul className="divide-y divide-divider border-y border-divider">
              {selected.projects.map(project => <li key={project.projectId} className="flex items-center gap-3 py-3">
                <FolderKanban className="h-4 w-4 shrink-0 text-content-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-content">{project.name}</p>
                  <p className="text-[11.5px] text-content-muted">{project.previewPublished ? 'Preview shared with the client' : 'No preview shared yet'}</p>
                </div>
                {/* Only link to a project this PM's project list has; never a dead link. */}
                {knownProjectIds.has(project.projectId) && <button type="button"
                  onClick={() => onOpenProject(project.projectId)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-link hover:text-link-hover">
                  Open conversation <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>}
              </li>)}
            </ul>}
          {selected.tickets.unlinkedOpen > 0 && <p className="mt-4 text-[12.5px] text-content-secondary">
            {plural(selected.tickets.unlinkedOpen, 'open request isn’t', 'open requests aren’t')} linked to a project yet.{' '}
            <button type="button" onClick={() => onSection('tickets')} className="font-semibold text-link hover:text-link-hover">{unified ? 'Review requests' : 'Review in Tickets'}</button>
          </p>}
        </div>}

        {openSection === 'access' && <div className="h-full space-y-4 overflow-y-auto px-6 py-5 text-[13px]">
          <div className="flex items-start gap-3">
            <AccessBadge access={selected.access} />
            <p className="text-content-secondary">{selected.access === 'active'
              ? 'Can sign in to the client portal, follow their requests and see the projects shared with them.'
              : 'Portal access is off. This client can’t sign in or see their requests and projects.'}</p>
          </div>
          {selected.tickets.accessRevoked > 0 && <p className="rounded-md border border-status-warning-border bg-status-warning-subtle px-3 py-2 text-status-warning">
            Access was removed on {plural(selected.tickets.accessRevoked, 'request')}. The client can’t open {selected.tickets.accessRevoked === 1 ? 'it' : 'them'}.
          </p>}
          <p className="text-xs text-content-muted">{unified ? 'Invitations and access are managed on each request’s page (Conversation, then Open details).' : 'Invitations and access are managed on each request in the Tickets tab.'}</p>
        </div>}
      </div>
    </div>;
  }

  return <div className="flex h-full min-h-0 flex-col bg-canvas">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold text-content">Clients</h1>
        <span className="text-xs tabular-nums text-content-muted">{clients ? clients.length : '…'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onNeedsYouOnly && <button type="button" aria-pressed={needsYouOnly} onClick={() => onNeedsYouOnly(!needsYouOnly)}
          className={`inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors ${needsYouOnly
            ? 'border-transparent bg-selected text-selected-content' : 'border-control text-content-secondary hover:bg-surface-high hover:text-content'}`}>
          Needs you
        </button>}
        <label className="flex h-8 w-64 max-w-full items-center gap-2 rounded-md border border-control bg-well px-2.5 focus-within:ring-2 focus-within:ring-focus">
          <Search className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
          <span className="sr-only">Search clients</span>
          <input value={search} onChange={event => onSearch(event.target.value)} placeholder="Search clients or projects…" className="min-w-0 flex-1 bg-transparent text-xs text-content placeholder-content-muted focus:outline-none" />
        </label>
        {onRefresh && <button type="button" onClick={onRefresh} disabled={loading} title="Refresh clients"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-content-secondary hover:bg-surface-high hover:text-content disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
        </button>}
      </div>
    </header>

    <div className="pm-table-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-6">
      {!error && summary && <p className="mb-2 text-xs text-content-secondary">{summary}</p>}
      {error ? <p role="alert" className="rounded-md border border-status-danger-border bg-status-danger-subtle px-3 py-2 text-[13px] text-status-danger">{error}</p>
        : loading && !clients ? <SkeletonTable label="Loading clients" columns={4} rows={5} header avatar />
        : clients && clients.length === 0 ? <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Users className="h-6 w-6 text-content-muted" aria-hidden="true" />
          <p className="text-[13px] font-medium text-content">No clients yet</p>
          <p className="max-w-sm text-xs text-content-muted">Clients appear here once they have a portal account. New inquiries are in Inquiries.</p>
          <button type="button" onClick={() => onOpenInquiries()} className="mt-1 text-xs font-semibold text-link hover:text-link-hover">Open Inquiries</button>
        </div>
        : <table className="pm-date-table w-full text-left text-[13px]">
          <thead className="text-[10.5px] font-semibold uppercase tracking-wide text-content-muted">
            <tr className="border-b border-divider">
              <th scope="col" className="w-1/2 py-2 pr-3 font-semibold sm:w-2/5">Client</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Needs you</th>
              <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">Open</th>
              <th scope="col" className="hidden py-2 pr-3 font-semibold md:table-cell">Projects</th>
              <th scope="col" className="hidden py-2 pr-3 font-semibold md:table-cell">Access</th>
              <th scope="col" className="py-2 text-right font-semibold">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(client => <tr key={client.key} className="cursor-pointer border-b border-divider hover:bg-surface-high/40 aria-disabled:cursor-default"
          onClick={event => { if (!(event.target instanceof Element && event.target.closest('button, a'))) onSelect(client.key); }}>
              <td className="max-w-0 py-2.5 pr-3">
                <button type="button" onClick={() => onSelect(client.key)} className="flex w-full min-w-0 items-center gap-2.5 text-left">
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-divider bg-surface-raised text-[11px] font-semibold text-content">{clientInitials(client.displayName)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-content hover:text-link">{client.displayName}</span>
                    <ClientSubline client={client} />
                  </span>
                </button>
              </td>
              <td className="py-2.5 pr-3"><NeedsYouCell tickets={client.tickets} /></td>
              <td className="hidden py-2.5 pr-3 tabular-nums text-content-secondary sm:table-cell">{client.tickets.open}</td>
              <td className="hidden py-2.5 pr-3 tabular-nums text-content-secondary md:table-cell">{client.projects.length}</td>
              <td className="hidden py-2.5 pr-3 md:table-cell"><AccessBadge access={client.access} compact /></td>
              <td className="py-2.5 text-right tabular-nums text-content-muted">{shortDate(client.lastActivityAt)}</td>
            </tr>)}
          </tbody>
        </table>}
      {clients && clients.length > 0 && visible.length === 0 && <div className="py-6 text-center text-xs text-content-muted">
        <p>{search.trim() ? `No clients match “${search.trim()}”${needsYouOnly ? ' among those needing you' : ''}.` : 'No clients need you right now.'}</p>
        {needsYouOnly && onNeedsYouOnly && <button type="button" onClick={() => onNeedsYouOnly(false)} className="mt-1 font-semibold text-link hover:text-link-hover">Show all clients</button>}
      </div>}
    </div>
  </div>;
}

/** Requests waiting on the PM, and unread client replies beneath. */
function NeedsYouCell({ tickets }: { tickets: PmClientSummary['tickets'] }) {
  const unread = tickets.unreadReplies ?? 0;
  if (!tickets.needsPm && !unread) return <span className="text-content-muted">—</span>;
  return <span className="flex flex-col items-start gap-0.5">
    {tickets.needsPm > 0 && <span className="rounded-full bg-selected px-2 py-0.5 text-[11.5px] font-semibold text-selected-content">{tickets.needsPm}</span>}
    {unread > 0 && <span className="whitespace-nowrap text-[11px] font-medium text-link">{unread} unread</span>}
  </span>;
}

/** Company and the projects the client can see, one muted line. */
function ClientSubline({ client }: { client: PmClientSummary }) {
  const projects = client.projects.map(project => project.name).join(', ');
  const company = client.company && client.company.trim().toLowerCase() !== client.displayName.trim().toLowerCase() ? client.company : null;
  const line = [company, projects].filter(Boolean).join(' · ');
  if (!line) return null;
  return <span className="block truncate text-[11.5px] text-content-muted" title={line}>{line}</span>;
}

function AccessBadge({ access, compact = false }: { access: PmClientSummary['access']; compact?: boolean }) {
  const Icon = access === 'active' ? ShieldCheck : ShieldOff;
  return <span className={`inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium ${access === 'active' ? 'text-status-success' : 'text-content-muted'}`}>
    <Icon className="h-3.5 w-3.5" aria-hidden="true" />{access === 'active' ? (compact ? 'Active' : 'Portal access on') : (compact ? 'Off' : 'Portal access off')}
  </span>;
}

