import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ArrowLeft, FolderKanban, ListChecks, Plus } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ClientTicketApiError, clientTicketApi, type ClientProject } from './clientApi';
import { ClientTicketDetail, RailCard } from './ClientTicketDetail';
import {
  ConversationRequestList, ProjectConversationChat, ProjectConversationView, openRequestCount, useConversationJump, type ConversationAbout,
} from './ProjectConversationView';
import { withUpdatedRequest, type ConversationItem, type ConversationRequest } from './projectConversation';

const REFRESH_MS = 30_000;
const newOperationId = () => crypto.randomUUID();
const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const CONVERSATION_DESCRIPTION = 'Everything about this project with your project manager: questions, your requests and their progress.';

/** The project's one conversation and its requests, refreshed every 30 seconds while the page is visible. */
function useClientProjectConversation(api: typeof clientTicketApi, project: ClientProject) {
  const [items, setItems] = useState<ConversationItem[] | null>(null);
  const [requests, setRequests] = useState<ConversationRequest[] | null>(null);
  const [error, setError] = useState('');
  const token = useRef(0);
  const { workspaceId, projectId } = project;
  const load = useCallback(async (quiet = false) => {
    token.current += 1;
    const current = token.current;
    if (!quiet) { setItems(null); setRequests(null); setError(''); }
    try {
      const [timeline, list] = await Promise.all([api.getProjectConversation(workspaceId, projectId), api.getProjectConversationRequests(workspaceId, projectId)]);
      if (current !== token.current) return;
      setItems(timeline.items); setRequests(list.items); setError('');
    } catch (error_) {
      if (current !== token.current || quiet) return;
      // A request never falls back to a chat of its own; the project's one conversation says what went wrong.
      setError(error_ instanceof ClientTicketApiError && error_.status === 404
        ? 'This project’s conversation isn’t available yet. Refresh in a moment.'
        : errorText(error_, 'The conversation could not be loaded. Refresh to try again.'));
    }
  }, [api, workspaceId, projectId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);
  return { items, requests, setRequests, error, load };
}

/** Rail card: the project and the requests made in its conversation, as a checklist. */
function ConversationRequestsCard({ project, requests, selectedTicketId, busy, writesAvailable, onSelect, onToggleDone, onCreateRequest }: Readonly<{
  project: ClientProject;
  requests: ConversationRequest[] | null;
  selectedTicketId: string | null;
  busy: boolean;
  writesAvailable: boolean;
  onSelect: (request: ConversationRequest) => void;
  onToggleDone: (request: ConversationRequest, done: boolean) => void;
  onCreateRequest?: (input: { title: string; description: string }) => Promise<boolean>;
}>) {
  const open = openRequestCount(requests);
  return <RailCard icon={<ListChecks size={16} />} title={requests ? `Requests · ${open} open` : 'Requests'}>
    <p className="cx-request-note"><FolderKanban size={12} aria-hidden="true" className="mr-1 inline" />{project.name}. Pick a request to see where you made it and how it is going.</p>
    <ConversationRequestList role="client" requests={requests} busy={busy} writesAvailable={writesAvailable} onToggleDone={onToggleDone}
      onCreateRequest={onCreateRequest} selectedTicketId={selectedTicketId} onSelectRequest={onSelect} />
  </RailCard>;
}

/** Everything the client does in the conversation: messages, ticks and new requests. */
function useConversationActions(api: typeof clientTicketApi, project: ClientProject, conversation: ReturnType<typeof useClientProjectConversation>) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const { workspaceId, projectId } = project;
  const run = async <T,>(work: () => Promise<T>, fallback: string): Promise<T | null> => {
    setBusy(true); setActionError('');
    try { const result = await work(); await conversation.load(true); return result; }
    catch (error_) { setActionError(errorText(error_, fallback)); return null; }
    finally { setBusy(false); }
  };
  const toggle = (request: ConversationRequest, done: boolean) => void run(async () => {
    const updated = await api.setConversationRequestDone(workspaceId, projectId, request.ticketId, done);
    conversation.setRequests(withUpdatedRequest(updated));
  }, 'That request could not be updated. Try again.');
  // A request made here is an ordinary request on this project, so it keeps the usual plan and result steps.
  const createRequest = (input: { title: string; description: string }) => run(async () => {
    const context = await api.getIntakeContext(workspaceId);
    if (!context.canCreate) throw new Error('New requests are not available for this project right now.');
    return api.createTicket({ intakeContextId: context.intakeContextId, schemaVersion: 1, operationId: newOperationId(),
      title: input.title, description: input.description, projectPreference: { kind: 'shared_project', optionId: project.intakeOptionId } });
  }, 'Your request was not sent. Try again.');
  const sendToProject = (body: string) => run(() => api.sendProjectFeedbackMessage(workspaceId, projectId, { schemaVersion: 1, operationId: newOperationId(), body }),
    'Your message was not sent. Try again.');
  /** Makes a request, then hands its ID on so it can be opened; true when it was made. */
  const createAndOpen = async (input: { title: string; description: string }, onCreated?: (ticketId: string) => void) => {
    const receipt = await createRequest(input);
    if (receipt) onCreated?.(receipt.ticketId);
    return Boolean(receipt);
  };
  return { busy, actionError, run, toggle, createAndOpen, sendToProject };
}

/**
 * The project's conversation before any request is picked (or when there is
 * none yet): the request page's layout, with the project and its requests on
 * the left and the one conversation on the right.
 */
export function ClientProjectConversation({ api = clientTicketApi, project, clientName, readOnly = false, canCreateRequests = true,
  onBack, focusTicketId = null, showRequestForm = false, requestForm, onStartRequest, onOpenRequestDetails }: Readonly<{
  api?: typeof clientTicketApi;
  project: ClientProject;
  clientName: string;
  readOnly?: boolean;
  canCreateRequests?: boolean;
  onBack: () => void;
  /** Request from another project surface that should be focused here. */
  focusTicketId?: string | null;
  showRequestForm?: boolean;
  requestForm?: ReactNode;
  onStartRequest?: () => void;
  onOpenRequestDetails?: (request: ConversationRequest) => void;
}>) {
  const conversation = useClientProjectConversation(api, project);
  const actions = useConversationActions(api, project, conversation);
  const [draft, setDraft] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(focusTicketId);
  useEffect(() => setSelectedTicketId(focusTicketId), [focusTicketId]);
  return <section className="cx-request flex min-h-0 flex-col" aria-labelledby="client-conversation-project-title">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-divider px-5 py-3 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={actions.busy} className="mt-0.5 shrink-0 px-2">
          <ArrowLeft size={15} aria-hidden="true" />All projects
        </Button>
        <div className="min-w-0">
          <h1 id="client-conversation-project-title" className="truncate text-[15px] font-semibold text-content">{project.name}</h1>
          <p className="mt-0.5 text-[12px] text-content-muted">One shared conversation for this project</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!readOnly && canCreateRequests && <Button type="button" size="sm" onClick={onStartRequest} disabled={actions.busy}>
          <Plus size={14} aria-hidden="true" />New request
        </Button>}
        <Badge variant="secondary" className="hidden gap-1.5 sm:inline-flex">
          <FolderKanban size={12} aria-hidden="true" />Project conversation
        </Badge>
      </div>
    </header>
    <div className="flex min-h-0 flex-1">
      <ProjectConversationView role="client" projectName={project.name}
        items={conversation.items} requests={conversation.requests} error={conversation.error} actionError={actions.actionError}
        clientName={clientName} clientInitial={clientName.trim()[0]?.toUpperCase() ?? 'C'}
        draft={draft} onDraftChange={setDraft} busy={actions.busy} writesAvailable={!readOnly}
        onSend={body => void actions.sendToProject(body).then(result => { if (result !== null) setDraft(''); })}
        onToggleDone={actions.toggle} focusTicketId={focusTicketId} selectedTicketId={selectedTicketId}
        requestForm={requestForm} initialPanelId={showRequestForm ? 'new-request' : 'requests'}
        onOpenRequest={onOpenRequestDetails}
        onSelectRequest={request => setSelectedTicketId(request.ticketId)}
        inputId={`client-conversation-${project.projectId}`} />
    </div>
  </section>;
}

type RequestPageProps = ComponentProps<typeof ClientTicketDetail>;

/**
 * A request on a shared project, in the request page's layout: the project's
 * requests and this request's progress on the left, and on the right the
 * project's one conversation, scrolled to where this request was made. Replies
 * go to this request unless the client writes to the whole project.
 */
export function ClientConversationRequestPage({ project, clientName, readOnly = false, canCreateRequests = true, onSelectRequest,
  onRequestCreated, ...detail }: Readonly<RequestPageProps & {
  project: ClientProject;
  clientName: string;
  readOnly?: boolean;
  canCreateRequests?: boolean;
  onSelectRequest: (request: ConversationRequest) => void;
  onRequestCreated?: (ticketId: string) => void;
}>) {
  const api = detail.api ?? clientTicketApi;
  const conversation = useClientProjectConversation(api, project);
  const actions = useConversationActions(api, project, conversation);
  const [localDraft, setLocalDraft] = useState('');
  const draft = detail.replyDraft ?? localDraft;
  const setDraft = (value: string) => { setLocalDraft(value); detail.onReplyDraftChange?.(value); };
  const { jump, toRequest } = useConversationJump();
  const ticketId = detail.ticket.id;
  const [cleared, setCleared] = useState(false);
  const loaded = conversation.items !== null;
  useEffect(() => { if (loaded) toRequest(ticketId); }, [loaded, ticketId, toRequest]);

  const selected: ConversationAbout = { ticketId, title: detail.ticket.title };
  const canReply = !readOnly && !['closed', 'declined', 'cancelled'].includes(detail.ticket.status);
  const about = canReply && !cleared ? selected : null;
  const send = (body: string) => {
    const work: () => Promise<unknown> = about ? () => detail.onReply(body) : () => api.sendProjectFeedbackMessage(project.workspaceId, project.projectId,
      { schemaVersion: 1, operationId: newOperationId(), body });
    void actions.run(work, 'Your message was not sent. Try again.').then(result => { if (result !== null) setDraft(''); });
  };
  const create = (input: { title: string; description: string }) => actions.createAndOpen(input, onRequestCreated);

  return <ClientTicketDetail {...detail}
    railLead={<ConversationRequestsCard project={project} requests={conversation.requests} selectedTicketId={ticketId} busy={actions.busy || detail.busy}
      writesAvailable={!readOnly} onToggleDone={actions.toggle} onCreateRequest={readOnly || !canCreateRequests ? undefined : create}
      onSelect={request => { if (request.ticketId === ticketId) toRequest(ticketId); else onSelectRequest(request); }} />}
    conversation={{ title: 'Project conversation', description: CONVERSATION_DESCRIPTION, body: <ProjectConversationChat role="client"
      items={conversation.items} requests={conversation.requests} error={conversation.error} actionError={actions.actionError}
      clientName={clientName} clientInitial={clientName.trim()[0]?.toUpperCase() ?? 'C'} draft={draft} onDraftChange={setDraft}
      busy={actions.busy || detail.busy} writesAvailable={!readOnly} onSend={send} jump={jump}
      about={about} onClearAbout={() => setCleared(true)}
      restoreAbout={canReply && cleared ? selected : null} onRestoreAbout={() => setCleared(false)}
      inputId="client-ticket-reply" /> }} />;
}
