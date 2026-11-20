import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderKanban, Link2, Plus } from 'lucide-react';
import { ApiRequestError } from '@/shared/services/apiService';
import { pmTicketApi, pmTicketDocumentsApi, type PmClientProjectConversation, type PmClientSummary } from './pmApi';
import { ProjectConversationView, type ConversationPanelTab } from './ProjectConversationView';
import { PmRequestContext, type PmRequestContextSection } from './PmRequestContext';
import type { TicketDocumentsReadApi } from './ticketDocuments';
import type { ConversationItem, ConversationRequest } from './projectConversation';
import { REQUEST_TASK_LINKED_EVENT, linkSavedTaskToRequest } from './requestTaskLink';

const REFRESH_MS = 30_000;
const newOperationId = () => crypto.randomUUID();
const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

/** The client account behind a client page's key (`client:<account>`), or null for an unverified inquiry group. */
export function clientIdFromKey(key: string): string | null {
  return key.startsWith('client:') && key.length > 'client:'.length ? key.slice('client:'.length) : null;
}

export interface PmConversationFocus { projectId?: string | null; ticketId?: string | null }

/** What the New task dialog opens with when a task is made from the conversation. */
export interface ConversationTaskDraft {
  projectId: string; title: string; description: string; request: { ticketId: string; title: string } | null;
}
/** A board task that can be linked to a request. */
export interface ConversationLinkableTask { id: string; identifier: string; title: string }

/**
 * A client's Conversation tab: one conversation per project the client can see.
 * The side panel keeps the request context tabs (overview, private notes,
 * details, documents) for the selected request and adds a Requests checklist,
 * where the PM creates a task for a request (or links an existing one); the full
 * request page with the plan and result steps opens from each request.
 */
export function PmClientConversationTab({ api = pmTicketApi, documentsApi = pmTicketDocumentsApi, client, focus = null, onOpenRequestDetails,
  onCreateTask, tasksForProject, refreshToken }: {
  api?: typeof pmTicketApi;
  documentsApi?: TicketDocumentsReadApi;
  client: PmClientSummary;
  focus?: PmConversationFocus | null;
  onOpenRequestDetails: (ticketId: string) => void;
  /** Opens the New task dialog; absent where tasks cannot be made, as in the UI preview. */
  onCreateTask?: (draft: ConversationTaskDraft) => void;
  /** The project's board tasks, for linking one to a request. */
  tasksForProject?: (projectId: string) => ConversationLinkableTask[];
  refreshToken?: number;
}) {
  const clientId = clientIdFromKey(client.key);
  const [projects, setProjects] = useState<PmClientProjectConversation[] | null>(null);
  const [projectsError, setProjectsError] = useState('');
  const [projectId, setProjectId] = useState<string | null>(focus?.projectId ?? null);
  const [items, setItems] = useState<ConversationItem[] | null>(null);
  const [requests, setRequests] = useState<ConversationRequest[] | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [contextTicketId, setContextTicketId] = useState<string | null>(focus?.ticketId ?? null);
  const [contextVersion, setContextVersion] = useState(0);
  const loadToken = useRef(0);

  useEffect(() => { if (focus?.projectId) setProjectId(focus.projectId); }, [focus?.projectId]);
  useEffect(() => { if (focus?.ticketId) setContextTicketId(focus.ticketId); }, [focus?.ticketId]);

  useEffect(() => {
    setProjects(null); setProjectsError('');
    if (!clientId) return;
    let current = true;
    void api.listClientProjectConversations(clientId).then(list => {
      if (!current) return;
      setProjects(list);
      setProjectId(previous => previous && list.some(item => item.projectId === previous) ? previous : list[0]?.projectId ?? null);
    }).catch(failure => {
      if (!current) return;
      // An older server has no conversation routes yet.
      setProjectsError(failure instanceof ApiRequestError && failure.status === 404
        ? 'Conversations aren’t available on the server yet. They appear once the server is updated; until then use Tickets.'
        : errorText(failure, 'This client’s projects could not be loaded.'));
    });
    return () => { current = false; };
  }, [api, clientId, refreshToken]);

  const load = useCallback(async (quiet = false) => {
    if (!clientId || !projectId) return;
    const token = ++loadToken.current;
    if (!quiet) { setItems(null); setRequests(null); setError(''); }
    try {
      const [timeline, list] = await Promise.all([api.getProjectConversation(projectId, clientId), api.getProjectConversationRequests(projectId, clientId)]);
      if (token !== loadToken.current) return;
      setItems(timeline.items); setRequests(list.items); setError('');
    } catch (failure) {
      if (token === loadToken.current && !quiet) setError(errorText(failure, 'The conversation could not be loaded. Refresh to try again.'));
    }
  }, [api, clientId, projectId]);

  useEffect(() => { void load(); }, [load, refreshToken]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(true); };
    const timer = window.setInterval(refresh, REFRESH_MS);
    const linked = () => void load(true);
    window.addEventListener(REQUEST_TASK_LINKED_EVENT, linked);
    return () => { window.clearInterval(timer); window.removeEventListener(REQUEST_TASK_LINKED_EVENT, linked); };
  }, [load]);

  const project = projects?.find(item => item.projectId === projectId) ?? null;
  const projectTasks = projectId && tasksForProject ? tasksForProject(projectId) : [];

  /** Open the New task dialog for this project, filled from a request or message and linked to its request. */
  const createTask = (request: { ticketId: string; title: string } | null, title: string, description: string) => {
    if (!projectId || !onCreateTask) return;
    onCreateTask({ projectId, title: title.slice(0, 160), description,
      request: request ? { ticketId: request.ticketId, title: request.title } : null });
  };

  const send = async (body: string) => {
    if (!clientId || !projectId) return;
    setBusy(true); setActionError('');
    try {
      await api.sendProjectFeedbackMessage(projectId, clientId, { schemaVersion: 1, operationId: newOperationId(), body });
      setDraft('');
      await load(true);
    } catch (failure) { setActionError(errorText(failure, 'The message was not sent.')); }
    finally { setBusy(false); }
  };

  const toggle = async (request: ConversationRequest, done: boolean) => {
    if (!clientId || !projectId) return;
    setBusy(true); setActionError('');
    try {
      const updated = await api.setConversationRequestDone(projectId, clientId, request.ticketId, done);
      setRequests(previous => previous?.map(item => item.ticketId === updated.ticketId ? updated : item) ?? previous);
      setContextVersion(value => value + 1);
      await load(true);
    } catch (failure) { setActionError(errorText(failure, 'The request was not updated.')); }
    finally { setBusy(false); }
  };

  const linkExisting = async (request: ConversationRequest, issueId: string) => {
    setLinking(null); setBusy(true); setActionError('');
    try { await linkSavedTaskToRequest(request.ticketId, issueId, 'conversation', api, []); await load(true); }
    catch (failure) { setActionError(errorText(failure, 'The task was not linked.')); }
    finally { setBusy(false); }
  };

  if (!clientId) return <p className="px-6 py-5 text-[13px] text-content-muted">
    This client hasn’t set up a portal account yet, so there is no conversation. Their requests are in Tickets.</p>;
  if (projectsError) return <p role="alert" className="px-6 py-5 text-[13px] text-status-danger">{projectsError}</p>;
  if (projects && projects.length === 0) return <div className="px-6 py-5 text-[13px] text-content-secondary">
    <p className="font-medium text-content">No project conversations yet</p>
    <p className="mt-1 text-content-muted">A conversation starts once one of this client’s requests or proposals is linked to a project and shared with them.</p>
  </div>;

  // The request the context tabs describe: the one picked, else the first open one, else the newest.
  const contextRequest = requests?.find(request => request.ticketId === contextTicketId)
    ?? requests?.find(request => !['done', 'declined', 'cancelled'].includes(request.checklist)) ?? requests?.[0] ?? null;
  const contextTab = (id: PmRequestContextSection, label: string): ConversationPanelTab => ({ id, label,
    content: <PmRequestContext section={id} api={api} documentsApi={documentsApi} requests={requests} selectedId={contextRequest?.ticketId ?? null}
      onSelect={setContextTicketId} clientName={client.displayName} refreshToken={`${String(refreshToken ?? '')}:${contextVersion}`}
      onChanged={() => void load(true)} /> });
  const panelTabs = [contextTab('overview', 'Overview'), contextTab('notes', 'Private notes'),
    contextTab('details', 'Request details'), contextTab('documents', 'Documents')];

  const linkedIds = new Set((requests ?? []).flatMap(request => request.linkedTasks.map(task => task.issueId)));
  const linkable = projectTasks.filter(task => !linkedIds.has(task.id));

  return <div className="flex h-full min-h-0 flex-col md:flex-row">
    {projects && projects.length > 1 && <nav aria-label="Projects" className="shrink-0 border-b border-divider md:w-56 md:border-b-0 md:border-r">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:px-2 md:py-3">
        {projects.map(item => <li key={item.projectId}>
          <button type="button" onClick={() => setProjectId(item.projectId)} aria-current={item.projectId === projectId ? 'page' : undefined}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] ${item.projectId === projectId
              ? 'bg-selected text-selected-content' : 'text-content-secondary hover:bg-surface-high hover:text-content'}`}>
            <FolderKanban className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.projectName}</span>
            {item.openRequests > 0 && <span className="text-[11px] tabular-nums text-content-muted">{item.openRequests}</span>}
          </button>
        </li>)}
      </ul>
    </nav>}
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {project && <header className="shrink-0 border-b border-divider px-6 py-3">
        <h2 className="text-[14px] font-semibold text-content">{project.projectName}</h2>
        <p className="text-[12px] text-content-muted">Conversation with {client.displayName}</p>
      </header>}
      {!projects ? <p className="px-6 py-5 text-[13px] text-content-muted">Loading conversations…</p>
        : <ProjectConversationView key={projectId ?? 'none'} role="pm" projectName={project?.projectName ?? 'Project'}
          items={items} requests={requests} error={error} actionError={actionError}
          clientName={client.displayName} clientInitial={client.displayName.trim()[0]?.toUpperCase() ?? 'C'}
          draft={draft} onDraftChange={setDraft} onSend={body => void send(body)} busy={busy}
          onToggleDone={(request, done) => void toggle(request, done)}
          onOpenRequest={request => onOpenRequestDetails(request.ticketId)}
          focusTicketId={focus?.ticketId ?? null}
          selectedTicketId={contextRequest?.ticketId ?? null}
          onSelectRequest={request => setContextTicketId(request.ticketId)}
          panelTabs={panelTabs}
          inputId={`pm-conversation-${client.key}`}
          messageActions={item => onCreateTask && item.author === 'client' && (item.kind === 'message' || item.kind === 'request' || item.kind === 'clarification')
            ? <button type="button" onClick={() => createTask(item.request, item.kind === 'request' ? item.request?.title ?? '' : item.body.split('\n')[0] ?? '',
              item.body)}>Create task</button> : null}
          renderRequestActions={request => request.checklist === 'declined' || request.checklist === 'cancelled' ? null : <>
            {onCreateTask && <button type="button" onClick={() => createTask(request, request.title, request.description)} disabled={busy}
              className="inline-flex items-center gap-1 font-semibold text-link hover:text-link-hover">
              <Plus size={13} aria-hidden="true" /> Create task</button>}
            {!tasksForProject ? null : linking === request.ticketId
              ? <label className="flex items-center gap-1.5">
                <span className="sr-only">Task to link to {request.title}</span>
                <select autoFocus defaultValue="" onChange={event => { if (event.target.value) void linkExisting(request, event.target.value); }}
                  onBlur={() => setLinking(null)}
                  className="h-7 max-w-[12rem] rounded-md border border-control bg-well px-1.5 text-[12px] text-content">
                  <option value="" disabled>{linkable.length ? 'Choose a task…' : 'No other tasks on this project'}</option>
                  {linkable.map(task => <option key={task.id} value={task.id}>{task.identifier} · {task.title}</option>)}
                </select>
              </label>
              : <button type="button" onClick={() => setLinking(request.ticketId)} disabled={busy}
                className="inline-flex items-center gap-1 font-semibold text-link hover:text-link-hover">
                <Link2 size={13} aria-hidden="true" /> Link task</button>}
          </>}
        />}
    </div>
  </div>;
}
