import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { ApiRequestError } from '@/shared/services/apiService';
import { pmTicketApi, pmTicketDocumentsApi, type PmClientProjectConversation, type PmClientSummary, type PmTicketDetail } from './pmApi';
import { ProjectConversationChat, ProjectConversationView, useConversationJump, type ConversationAbout } from './ProjectConversationView';
import { PmSelectedTicket, usePmRequestDetail } from './PmRequestContext';
import { PmConversationRail } from './PmConversationRail';
import type { TicketDocumentsReadApi } from './ticketDocuments';
import { canToggleRequest, withUpdatedRequest, type ConversationItem, type ConversationRequest, type ProjectConversationTimeline } from './projectConversation';
import { REQUEST_TASK_LINKED_EVENT, type LinkedRequestDraft } from './requestTaskLink';
import { useProjectStage } from './useProjectStage';
import { ProjectStageTracker } from './ProjectStageTracker';
import { PmStagePanel } from './PmStagePanel';
import { ProjectDiscoverySummaries } from './ProjectDiscoverySummaries';
import type { StageSummary } from './projectStages';

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
  projectId: string; title: string; description: string; request: LinkedRequestDraft | null;
}

/** How a PM reply about a request is sent: an ordinary reply, or a question the client must answer. */
export type PmReplyKind = 'reply' | 'request_details';

function RequestQuestionButton({ detail, replyKind, onChange, inputId }: Readonly<{
  detail: PmTicketDetail | null;
  replyKind: PmReplyKind;
  onChange: (kind: PmReplyKind) => void;
  inputId: string;
}>) {
  if (replyKind === 'request_details') {
    return <Button type="button" variant="ghost" size="sm" onClick={() => onChange('reply')}>Ask &amp; wait for reply · Cancel</Button>;
  }
  if (!detail?.writesAvailable || !['received', 'under_review', 'awaiting_client', 'in_progress', 'ready_for_review'].includes(detail.status)) return null;
  return <Button type="button" variant="ghost" size="sm" onClick={() => {
    onChange('request_details');
    document.getElementById(inputId)?.focus();
  }}>Ask &amp; wait for reply</Button>;
}

/**
 * Loads one client's conversation about one project, refreshes it every 30
 * seconds and after a task is linked, and sends the PM's messages: about a
 * request (to that request) or about the project as a whole.
 */
function usePmProjectConversation(api: typeof pmTicketApi, projectId: string | null, clientId: string | null, refreshToken?: unknown) {
  const [timeline, setTimeline] = useState<ProjectConversationTimeline | null>(null);
  const [requests, setRequests] = useState<ConversationRequest[] | null>(null);
  const [error, setError] = useState('');
  const loadToken = useRef(0);
  const load = useCallback(async (quiet = false) => {
    if (!clientId || !projectId) return;
    loadToken.current += 1;
    const token = loadToken.current;
    if (!quiet) { setTimeline(null); setRequests(null); setError(''); }
    try {
      const [timeline, list] = await Promise.all([api.getProjectConversation(projectId, clientId), api.getProjectConversationRequests(projectId, clientId)]);
      if (token !== loadToken.current) return;
      setTimeline(timeline); setRequests(list.items); setError('');
    } catch (error_) {
      if (token === loadToken.current && !quiet) setError(errorText(error_, 'The conversation could not be loaded. Refresh to try again.'));
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

  /** About a request it is that request's message; otherwise a message on the project. */
  const send = useCallback(async (body: string, about: ConversationAbout | null, kind: PmReplyKind = 'reply') => {
    if (!clientId || !projectId) return;
    if (about) {
      const ticket = await api.get(about.ticketId);
      await api.reply(about.ticketId, { schemaVersion: 1, operationId: newOperationId(), expectedVersion: ticket.version, body, action: { type: kind } });
    } else {
      await api.sendProjectFeedbackMessage(projectId, clientId, { schemaVersion: 1, operationId: newOperationId(), body });
    }
    await load(true);
  }, [api, clientId, projectId, load]);

  return { items: timeline?.items ?? null, discoverySummaries: timeline?.discoverySummaries, requests, setRequests, error, load, send };
}

/** Why there is no conversation to show: no portal account yet, a load error, or no shared projects. */
function conversationNotice(clientId: string | null, projectsError: string, projects: readonly PmClientProjectConversation[] | null): ReactNode {
  if (!clientId) return <p className="px-6 py-5 text-[13px] text-content-muted">
    This client hasn’t set up a portal account yet, so there is no conversation. Open a request from the client overview.</p>;
  if (projectsError) return <p role="alert" className="px-6 py-5 text-[13px] text-status-danger">{projectsError}</p>;
  if (projects?.length === 0) return <div className="px-6 py-5 text-[13px] text-content-secondary">
    <p className="font-medium text-content">No project conversations yet</p>
    <p className="mt-1 text-content-muted">A conversation starts once one of this client’s requests or proposals is linked to a project and shared with them.</p>
  </div>;
  return null;
}

/**
 * The stage card's title and prompt. Each stage's panel already heads itself (Proof of concept, Contract…),
 * so the card is just "Stage"; a project from before stages says so beside the stage picker.
 */
function stageCardText(summary: StageSummary): { title: string; prompt: string | null } {
  return { title: 'Stage', prompt: summary.stage === 'unset' ? 'This project started before stages. Choose where it is now.' : null };
}

/** Only a client's request gets "Create task"; ordinary messages do not. */
function requestCardActions(onCreate: ((request: { ticketId: string; title: string; reference?: string }, wording: string) => void) | undefined) {
  if (!onCreate) return undefined;
  return (item: ConversationItem): ReactNode => {
    const request = item.kind === 'request' ? item.request : null;
    return request
      ? <Button type="button" variant="ghost" size="sm" onClick={() => onCreate(request, item.body)}
          className="h-7 px-2 text-[12px] text-link hover:text-link-hover">
          <Plus size={12} aria-hidden="true" />Create task
        </Button>
      : null;
  };
}

/** The reply target: the selected request, unless the PM chose to write to the whole project. */
function useAboutTarget(selected: ConversationAbout | null) {
  const [cleared, setCleared] = useState(false);
  const selectedId = selected?.ticketId ?? null;
  useEffect(() => { setCleared(false); }, [selectedId]);
  return {
    about: cleared ? null : selected,
    restoreAbout: cleared ? selected : null,
    clear: () => setCleared(true),
    restore: () => setCleared(false),
  };
}

/**
 * A client's Conversation tab: one conversation per project the client can see.
 * The side panel shows the selected ticket's checklist actions, details, notes and documents. Tasks are
 * attached to a request by creating them from it (Create task).
 */
export function PmClientConversationTab({ api = pmTicketApi, documentsApi = pmTicketDocumentsApi, client, focus = null,
  onOpenWorkflow, onCreateTask, refreshToken }: Readonly<{
  api?: typeof pmTicketApi;
  documentsApi?: TicketDocumentsReadApi;
  client: PmClientSummary;
  focus?: PmConversationFocus | null;
  onOpenWorkflow?: (focus: PmConversationFocus, reference: string) => void;
  /** Opens the New task dialog; absent where tasks cannot be made, as in the UI preview. */
  onCreateTask?: (draft: ConversationTaskDraft) => void;
  refreshToken?: number;
}>) {
  const clientId = clientIdFromKey(client.key);
  const [projects, setProjects] = useState<PmClientProjectConversation[] | null>(null);
  const [projectsError, setProjectsError] = useState('');
  const [projectId, setProjectId] = useState<string | null>(focus?.projectId ?? null);
  const [actionError, setActionError] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [contextTicketId, setContextTicketId] = useState<string | null>(focus?.ticketId ?? null);
  const [contextVersion, setContextVersion] = useState(0);
  const [replyKind, setReplyKind] = useState<PmReplyKind>('reply');
  const { items, discoverySummaries, requests, setRequests, error, load, send } = usePmProjectConversation(api, projectId, clientId, refreshToken);
  const loadStage = useCallback(() => api.getProjectStage(projectId!, clientId!), [api, projectId, clientId]);
  const afterStageWrite = useCallback(() => { void load(true); }, [load]);
  const stage = useProjectStage(projectId && clientId && typeof api.getProjectStage === 'function' ? loadStage : null, afterStageWrite);
  const stageSummary = stage.available && projectId && stage.summary?.clientId === clientId ? stage.summary : null;

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
    }).catch(error_ => {
      if (!current) return;
      // An older server has no conversation routes yet.
      setProjectsError(error_ instanceof ApiRequestError && error_.status === 404
        ? 'Conversations aren’t available on the server yet. Open a request from the client overview.'
        : errorText(error_, 'This client’s projects could not be loaded.'));
    });
    return () => { current = false; };
  }, [api, clientId, refreshToken]);

  const project = projects?.find(item => item.projectId === projectId) ?? null;

  // The selected request receives replies by default.
  const contextRequest = requests?.find(request => request.ticketId === contextTicketId)
    ?? requests?.find(request => !['done', 'declined', 'cancelled'].includes(request.checklist)) ?? requests?.[0] ?? null;
  const { detail: contextTicketDetail, error: contextTicketError } = usePmRequestDetail(api, contextRequest?.ticketId ?? null,
    `${refreshToken ?? 0}:${contextVersion}`);
  const target = useAboutTarget(contextRequest ? { ticketId: contextRequest.ticketId, title: contextRequest.title } : null);
  const selectedTicketId = contextRequest?.ticketId ?? null;
  useEffect(() => { setReplyKind('reply'); }, [selectedTicketId]);

  const run = async (work: () => Promise<unknown>, fallback: string) => {
    setBusy(true); setActionError('');
    try { await work(); } catch (error_) { setActionError(errorText(error_, fallback)); } finally { setBusy(false); }
  };

  const toggle = (request: ConversationRequest, done: boolean) => void run(async () => {
    if (!clientId || !projectId) return;
    const updated = await api.setConversationRequestDone(projectId, clientId, request.ticketId, done);
    setRequests(withUpdatedRequest(updated));
    setContextVersion(value => value + 1);
    await load(true);
  }, 'The request was not updated.');

  const notice = conversationNotice(clientId, projectsError, projects);
  if (notice) return notice;

  // Keep stage and preview context below the ticket accordion.
  const stageProps = stageSummary && projectId && clientId ? {
    api, projectId, clientId, summary: stageSummary, busy: stage.busy, actionError: stage.actionError, run: stage.run,
  } : null;
  const stageCard = stageProps ? { ...stageCardText(stageProps.summary), content: <PmStagePanel {...stageProps} /> } : null;
  const inProofOfConcept = stageSummary?.stage === 'poc' || stageSummary?.stage === 'contract';
  const previewShared = client.projects.find(item => item.projectId === projectId)?.previewPublished;
  const inputId = `pm-conversation-${client.key}`;
  const refreshTicket = () => { setContextVersion(value => value + 1); void load(true); };

  const newTask = (projectId: string) => {
    const request = contextRequest && !['declined', 'cancelled'].includes(contextRequest.checklist) ? contextRequest : null;
    // A task is one piece of the request: it starts blank, linked to the request, with the client's wording on offer.
    onCreateTask?.({
      projectId, title: '', description: '',
      request: request && { ticketId: request.ticketId, title: request.title, reference: request.reference,
        description: request.description, source: 'task_dialog' },
    });
  };
  const newTaskButton = project && onCreateTask && <Button type="button" variant="ghost" size="sm" disabled={busy}
    className="h-auto justify-start px-0 py-0 text-xs font-semibold text-link hover:bg-transparent hover:text-link-hover"
    onClick={() => newTask(project.projectId)}>
    <Plus size={13} aria-hidden="true" />New task
  </Button>;

  const conversationHeader = <>
    {project && <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-divider px-4 py-3 sm:px-6">
      {stageSummary && <ProjectStageTracker summary={stageSummary} role="pm" unsetPrompt={false}
        nextActionControl={inProofOfConcept ? null : undefined} />}
      <div className="ml-auto min-w-0 text-right">
        <h2 className="truncate text-[14px] font-semibold text-content">{project.projectName}</h2>
        <p className="text-[12px] text-content-muted">Project conversation</p>
      </div>
    </header>}
    <ProjectDiscoverySummaries summaries={discoverySummaries} />
  </>;
  return <div className="flex h-full min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
    {projects && projects.length > 0 && <nav aria-label="Projects" className="shrink-0 border-b border-divider lg:w-52 lg:border-b-0 lg:border-r">
      <h2 className="px-4 pt-3 text-xs font-semibold text-content-secondary">Projects</h2>
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:px-2 lg:py-3">
        {projects.map(item => <li key={item.projectId}>
          <Button type="button" variant="ghost" onClick={() => setProjectId(item.projectId)} aria-current={item.projectId === projectId ? 'page' : undefined}
            className={`h-auto w-full justify-start rounded-md px-2.5 py-2 text-left text-[13px] ${item.projectId === projectId
              ? 'bg-selected text-selected-content hover:bg-selected' : 'text-content-secondary hover:bg-surface-high hover:text-content'}`}>
            <FolderKanban className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.projectName}</span>
            {item.openRequests > 0 && <span className="text-[11px] tabular-nums text-content-muted">{item.openRequests}</span>}
          </Button>
        </li>)}
      </ul>
    </nav>}
    {projects ? <ProjectConversationView key={projectId ?? 'none'} role="pm" projectName={project?.projectName ?? 'Project'}
      items={items} requests={requests} error={error} actionError={actionError}
      clientName={client.displayName} clientInitial={client.displayName.trim()[0]?.toUpperCase() ?? 'C'}
      draft={draft} onDraftChange={setDraft} busy={busy}
      onSend={body => void run(async () => { await send(body, target.about, replyKind); setDraft(''); setReplyKind('reply'); }, 'The message was not sent.')}
      about={target.about} onClearAbout={target.clear} restoreAbout={target.restoreAbout} onRestoreAbout={target.restore}
      onToggleDone={toggle}
      conversationHeader={conversationHeader}
      renderRail={({ requestList, requestsTitle }) => <PmConversationRail
        projectName={project?.projectName ?? 'Project'} stage={stageCard} previewShared={previewShared}
        ticketsTitle={requestsTitle}
        tickets={requestList}
        selected={contextRequest ? <PmSelectedTicket key={contextRequest.ticketId} api={api} documentsApi={documentsApi}
          request={contextRequest} clientName={client.displayName} detail={contextTicketDetail} error={contextTicketError}
          refreshToken={`${refreshToken ?? 0}:${contextVersion}`}
          onChanged={refreshTicket}
          onOpenWorkflow={onOpenWorkflow && projectId ? () => onOpenWorkflow({ projectId, ticketId: contextRequest.ticketId }, contextRequest.reference) : undefined}
          actions={<>
            {contextTicketDetail && canToggleRequest(contextRequest) && <Button type="button" variant="outline" size="sm" disabled={busy}
              onClick={() => toggle(contextRequest, contextRequest.checklist !== 'done')}>
              {contextRequest.checklist === 'done' ? 'Reopen ticket' : 'Mark done'}
            </Button>}
            {newTaskButton}
          </>} /> : newTaskButton} />}
      composerExtra={target.about && <RequestQuestionButton detail={contextTicketDetail} replyKind={replyKind}
        onChange={setReplyKind} inputId={inputId} />}
      focusTicketId={focus?.ticketId ?? null}
      selectedTicketId={selectedTicketId}
      onSelectRequest={request => setContextTicketId(request.ticketId)}
      inputId={inputId}
    /> : <p className="px-6 py-5 text-[13px] text-content-muted">Loading conversations…</p>}
  </div>;
}

/**
 * The conversation beside a request's plan and result steps: the same project
 * conversation as the Conversation tab, scrolled to this request, with replies
 * going to this request unless the PM writes to the whole project.
 */
export function PmRequestConversation({ api = pmTicketApi, projectId, clientId, ticketId, ticketTitle, clientName, replyKind, onReplyKindChange,
  onWritten, onCreateTask, writesAvailable = true }: Readonly<{
  api?: typeof pmTicketApi;
  projectId: string;
  clientId: string;
  ticketId: string;
  ticketTitle: string;
  clientName: string;
  replyKind: PmReplyKind;
  onReplyKindChange: (kind: PmReplyKind) => void;
  /** After a reply to this request, so the request page reloads its state. */
  onWritten: () => void;
  onCreateTask?: (draft: ConversationTaskDraft) => void;
  writesAvailable?: boolean;
}>) {
  const { items, requests, error, send } = usePmProjectConversation(api, projectId, clientId);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const { jump, toRequest } = useConversationJump();
  const target = useAboutTarget({ ticketId, title: ticketTitle });
  // Once loaded, show where this request was made.
  const loaded = items !== null;
  useEffect(() => { if (loaded) toRequest(ticketId); }, [loaded, ticketId, toRequest]);

  const submit = (body: string) => {
    const about = target.about;
    setBusy(true); setActionError('');
    void send(body, about, replyKind).then(() => {
      setDraft('');
      if (about) { onReplyKindChange('reply'); onWritten(); }
    }).catch(error_ => setActionError(errorText(error_, 'The message was not sent.'))).finally(() => setBusy(false));
  };
  const createTask = onCreateTask
    ? (request: { ticketId: string; title: string; reference?: string }, wording: string) => onCreateTask({ projectId, title: '', description: '',
      request: { ticketId: request.ticketId, title: request.title, reference: request.reference, description: wording, source: 'conversation' } })
    : undefined;

  return <ProjectConversationChat role="pm" items={items} requests={requests} error={error} actionError={actionError}
    clientName={clientName} clientInitial={clientName.trim()[0]?.toUpperCase() ?? 'C'} draft={draft} onDraftChange={setDraft}
    onSend={submit} busy={busy} writesAvailable={writesAvailable} messageActions={requestCardActions(createTask)}
    about={target.about} onClearAbout={target.clear} restoreAbout={target.restoreAbout} onRestoreAbout={target.restore} jump={jump}
    composerExtra={target.about ? <fieldset className="m-0 ml-auto inline-flex items-center gap-1 border-0 p-0">
      <legend className="sr-only">Reply type</legend>
      {(['reply', 'request_details'] as const).map(kind => <Button key={kind} type="button" variant="ghost" size="sm" aria-pressed={replyKind === kind} onClick={() => onReplyKindChange(kind)}
        className={`h-7 px-2 text-[11.5px] font-semibold ${replyKind === kind ? 'bg-selected text-selected-content hover:bg-selected' : 'text-content-muted hover:text-content'}`}>
        {kind === 'reply' ? 'Send' : 'Ask & wait for reply'}</Button>)}
    </fieldset> : null}
    inputId="ticket-conversation-draft" />;
}
