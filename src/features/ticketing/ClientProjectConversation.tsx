import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ArrowLeft, FolderKanban, ListChecks } from 'lucide-react';
import { ClientTicketApiError, clientTicketApi, type ClientProject } from './clientApi';
import { ClientTicketDetail, ConversationColumn, RailCard } from './ClientTicketDetail';
import {
  ConversationRequestList, ProjectConversationChat, openRequestCount, useConversationJump, type ConversationAbout,
} from './ProjectConversationView';
import type { ConversationItem, ConversationRequest } from './projectConversation';

const REFRESH_MS = 30_000;
const newOperationId = () => crypto.randomUUID();
const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const CONVERSATION_DESCRIPTION = 'Everything about this project with your project manager: questions, your requests and their progress.';

/** The project's one conversation and its requests, refreshed every 30 seconds while the page is visible. */
function useClientProjectConversation(api: typeof clientTicketApi, project: ClientProject) {
  const [items, setItems] = useState<ConversationItem[] | null>(null);
  const [requests, setRequests] = useState<ConversationRequest[] | null>(null);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const token = useRef(0);
  const { workspaceId, projectId } = project;
  const load = useCallback(async (quiet = false) => {
    const current = ++token.current;
    if (!quiet) { setItems(null); setRequests(null); setError(''); }
    try {
      const [timeline, list] = await Promise.all([api.getProjectConversation(workspaceId, projectId), api.getProjectConversationRequests(workspaceId, projectId)]);
      if (current !== token.current) return;
      setItems(timeline.items); setRequests(list.items); setError(''); setUnavailable(false);
    } catch (failure) {
      if (current !== token.current || quiet) return;
      // An older server has no conversation routes; the request keeps its own messages then.
      if (failure instanceof ClientTicketApiError && failure.status === 404) setUnavailable(true);
      setError(errorText(failure, 'The conversation could not be loaded. Refresh to try again.'));
    }
  }, [api, workspaceId, projectId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);
  return { items, requests, setRequests, error, unavailable, load };
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
    catch (failure) { setActionError(errorText(failure, fallback)); return null; }
    finally { setBusy(false); }
  };
  const toggle = (request: ConversationRequest, done: boolean) => void run(async () => {
    const updated = await api.setConversationRequestDone(workspaceId, projectId, request.ticketId, done);
    conversation.setRequests(previous => previous?.map(item => item.ticketId === updated.ticketId ? updated : item) ?? previous);
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
  return { busy, actionError, run, toggle, createRequest, sendToProject };
}

/**
 * The project's conversation before any request is picked (or when there is
 * none yet): the request page's layout, with the project and its requests on
 * the left and the one conversation on the right.
 */
export function ClientProjectConversation({ api = clientTicketApi, project, clientName, readOnly = false, canCreateRequests = true,
  onBack, onSelectRequest, onRequestCreated }: Readonly<{
  api?: typeof clientTicketApi;
  project: ClientProject;
  clientName: string;
  readOnly?: boolean;
  canCreateRequests?: boolean;
  onBack: () => void;
  /** Opens a request beside this conversation. */
  onSelectRequest: (request: ConversationRequest) => void;
  onRequestCreated?: (ticketId: string) => void;
}>) {
  const conversation = useClientProjectConversation(api, project);
  const actions = useConversationActions(api, project, conversation);
  const [draft, setDraft] = useState('');
  const create = async (input: { title: string; description: string }) => {
    const receipt = await actions.createRequest(input);
    if (receipt) onRequestCreated?.(receipt.ticketId);
    return Boolean(receipt);
  };

  return <section className="cx-request" aria-labelledby="client-conversation-project-title">
    <div className="cx-reqsplit">
      <aside className="cx-reqrail" aria-label="About this project">
        <div className="cx-reqrail-top">
          <button type="button" className="cx-back" onClick={onBack} disabled={actions.busy}><ArrowLeft size={15} aria-hidden="true" />Back to requests</button>
          <section className="cx-reqcard cx-reqhead">
            <div className="cx-reqhead-top">
              <span className="cx-reqhead-icon" aria-hidden="true"><FolderKanban size={24} /></span>
              <div className="cx-reqhead-copy">
                <h1 id="client-conversation-project-title">{project.name}</h1>
                <p>Your conversation with your project manager</p>
              </div>
            </div>
            <p className="cx-request-summary">Make new requests here and tick them off when they are done.</p>
          </section>
          <ConversationRequestsCard project={project} requests={conversation.requests} selectedTicketId={null} busy={actions.busy}
            writesAvailable={!readOnly} onSelect={onSelectRequest} onToggleDone={actions.toggle}
            onCreateRequest={readOnly || !canCreateRequests ? undefined : create} />
        </div>
      </aside>
      <ConversationColumn title="Project conversation" description={CONVERSATION_DESCRIPTION}>
        <ProjectConversationChat role="client" items={conversation.items} requests={conversation.requests} error={conversation.error}
          actionError={actions.actionError} clientName={clientName} clientInitial={clientName.trim()[0]?.toUpperCase() ?? 'C'}
          draft={draft} onDraftChange={setDraft} busy={actions.busy} writesAvailable={!readOnly}
          onSend={body => void actions.sendToProject(body).then(result => { if (result !== null) setDraft(''); })}
          inputId={`client-conversation-${project.projectId}`} />
      </ConversationColumn>
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

  // An older server without conversations: the request keeps its own messages.
  if (conversation.unavailable) return <ClientTicketDetail {...detail} />;

  const selected: ConversationAbout = { ticketId, title: detail.ticket.title };
  const canReply = !readOnly && !['closed', 'declined', 'cancelled'].includes(detail.ticket.status);
  const about = canReply && !cleared ? selected : null;
  const send = (body: string) => {
    const work: () => Promise<unknown> = about ? () => detail.onReply(body) : () => api.sendProjectFeedbackMessage(project.workspaceId, project.projectId,
      { schemaVersion: 1, operationId: newOperationId(), body });
    void actions.run(work, 'Your message was not sent. Try again.').then(result => { if (result !== null) setDraft(''); });
  };
  const create = async (input: { title: string; description: string }) => {
    const receipt = await actions.createRequest(input);
    if (receipt) onRequestCreated?.(receipt.ticketId);
    return Boolean(receipt);
  };

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
