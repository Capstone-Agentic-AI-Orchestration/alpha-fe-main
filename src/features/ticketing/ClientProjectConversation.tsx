import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ListChecks, MessagesSquare, Monitor, Plus } from 'lucide-react';
import { LoadingRows } from '@/shared/components/ui/skeleton';
import { ClientTicketApiError, clientTicketApi, type ClientProject, type ClientTicketDetail as ClientTicketRecord } from './clientApi';
import { ClientRequestRail, CollapsibleRailCard, RailCard, type ClientRequestRailProps } from './ClientTicketDetail';
import { ProjectPreviewFrame } from './ClientProjectPreview';
import { ConversationRequestList, ProjectConversationChat, openRequestCount, useConversationJump, type ConversationAbout } from './ProjectConversationView';
import { withUpdatedRequest, type ConversationItem, type ConversationRequest } from './projectConversation';

const REFRESH_MS = 30_000;
const TERMINAL = new Set(['closed', 'declined', 'cancelled']);
const newOperationId = () => crypto.randomUUID();
const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const CONVERSATION_DESCRIPTION = 'One conversation with your project manager: questions, your requests and their progress.';
const PREVIEW_DESCRIPTION = 'The latest version your project manager shared for you to try.';

export type ClientProjectView = 'conversation' | 'preview';

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

/** What the client does in the conversation itself: send messages and tick requests done. */
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
  const sendToProject = (body: string) => api.sendProjectFeedbackMessage(workspaceId, projectId, { schemaVersion: 1, operationId: newOperationId(), body });
  return { busy, actionError, run, toggle, sendToProject };
}

/**
 * Who a message goes to: the picked request, unless the client chose to write to the whole
 * project instead. A finished request takes no replies.
 */
function useReplyTarget(ticket: ClientTicketRecord | null, selectedTicketId: string | null, readOnly: boolean) {
  const [cleared, setCleared] = useState(false);
  useEffect(() => { setCleared(false); }, [selectedTicketId]);
  const selected: ConversationAbout | null = ticket && ticket.id === selectedTicketId && !readOnly && !TERMINAL.has(ticket.status)
    ? { ticketId: ticket.id, title: ticket.title } : null;
  return {
    about: cleared ? null : selected,
    restoreAbout: cleared ? selected : null,
    clear: () => setCleared(true),
    restore: () => setCleared(false),
  };
}

export interface ClientProjectConversationProps {
  api?: typeof clientTicketApi;
  project: ClientProject;
  clientName: string;
  readOnly?: boolean;
  onBack: () => void;
  /** The request open in the side panel; picking another one keeps this page and its conversation in place. */
  selectedTicketId: string | null;
  onSelectRequest: (ticketId: string) => void;
  /** The conversation, or the project's shared preview when there is one. */
  view: ClientProjectView;
  onViewChange: (view: ClientProjectView) => void;
  /** The new request form, shown at the top of the side panel while the client writes one. */
  requestForm?: ReactNode;
  /** The picked request's details, loaded by the portal. */
  request: { ticket: ClientTicketRecord | null; loading: boolean; error: string };
  /** What the picked request's panel needs to act on it. */
  rail: Omit<ClientRequestRailProps, 'ticket' | 'lead' | 'revealFiles'>;
  /** Sends a reply about the picked request. */
  onReplyAbout: (body: string) => Promise<void>;
}

/**
 * A project's one page: the conversation (or its shared preview) on the left, and on the right the
 * project's requests with the picked request's progress, plan or result, files and details.
 */
export function ClientProjectConversation(props: Readonly<ClientProjectConversationProps>) {
  const { api = clientTicketApi, project, clientName, readOnly = false, selectedTicketId, onSelectRequest, view, request } = props;
  const conversation = useClientProjectConversation(api, project);
  const actions = useConversationActions(api, project, conversation);
  const [draft, setDraft] = useState('');
  const { jump, toRequest } = useConversationJump();
  const target = useReplyTarget(request.ticket, selectedTicketId, readOnly);
  const loaded = conversation.items !== null;
  useEffect(() => { if (loaded && selectedTicketId) toRequest(selectedTicketId); }, [loaded, selectedTicketId, toRequest]);
  const busy = actions.busy || props.rail.busy;
  const send = (body: string) => {
    const work: () => Promise<unknown> = target.about ? () => props.onReplyAbout(body) : () => actions.sendToProject(body);
    void actions.run(work, 'Your message was not sent. Try again.').then(result => { if (result !== null) setDraft(''); });
  };
  const pick = (ticketId: string) => { if (ticketId === selectedTicketId) toRequest(ticketId); else onSelectRequest(ticketId); };
  const showPreview = view === 'preview' && Boolean(project.preview);
  return <section className="cx-request" aria-labelledby="client-conversation-project-title">
    <div className="cx-reqsplit">
      <section className="cx-reqchat" aria-labelledby="client-conversation-project-title">
        <ConversationHead project={project} view={showPreview ? 'preview' : 'conversation'} onViewChange={props.onViewChange} onBack={props.onBack} busy={busy} />
        {showPreview ? <ProjectPreviewFrame project={project} /> : <ProjectConversationChat role="client"
          items={conversation.items} requests={conversation.requests} error={conversation.error} actionError={actions.actionError}
          clientName={clientName} clientInitial={clientName.trim()[0]?.toUpperCase() ?? 'C'} draft={draft} onDraftChange={setDraft}
          busy={busy} writesAvailable={!readOnly} onSend={send} jump={jump} onOpenQuotedRequest={pick}
          about={target.about} onClearAbout={target.clear} restoreAbout={target.restoreAbout} onRestoreAbout={target.restore}
          inputId={`client-conversation-${project.projectId}`} />}
      </section>
      <aside className="cx-reqrail" aria-label={`Requests and details for ${project.name}`}>
        <div className="cx-reqrail-top">
          {props.requestForm && <RailCard icon={<Plus size={16} />} title="New request">{props.requestForm}</RailCard>}
          <CollapsibleRailCard id="requests" icon={<ListChecks size={16} />}
            title={conversation.requests ? `Requests · ${openRequestCount(conversation.requests)} open` : 'Requests'}>
            <ConversationRequestList role="client" requests={conversation.requests} busy={busy} writesAvailable={!readOnly}
              onToggleDone={actions.toggle} selectedTicketId={selectedTicketId} onSelectRequest={item => pick(item.ticketId)} />
          </CollapsibleRailCard>
        </div>
        <PickedRequest selectedTicketId={selectedTicketId} request={request} rail={props.rail} />
      </aside>
    </div>
  </section>;
}

/** The picked request's panel, a loading state while it arrives, or a hint to pick one. */
function PickedRequest({ selectedTicketId, request, rail }: Readonly<Pick<ClientProjectConversationProps, 'selectedTicketId' | 'request' | 'rail'>>) {
  if (request.ticket && request.ticket.id === selectedTicketId) return <ClientRequestRail {...rail} ticket={request.ticket} />;
  if (!selectedTicketId) return <p className="cx-request-note cx-reqrail-hint">Pick a request to see its progress, plan or result, files and details.</p>;
  if (request.error) return <p role="alert" className="cx-error">{request.error}</p>;
  return <section className="cx-reqcard" aria-busy="true"><LoadingRows label="Loading request" layout="detail" rows={3} /></section>;
}

function ConversationHead({ project, view, onViewChange, onBack, busy }: Readonly<{
  project: ClientProject; view: ClientProjectView; onViewChange: (view: ClientProjectView) => void; onBack: () => void; busy: boolean;
}>) {
  return <>
    <button type="button" className="cx-back" onClick={onBack} disabled={busy}><ArrowLeft size={15} aria-hidden="true" />All projects</button>
    <header className="cx-reqchat-head">
      <span className="cx-reqchat-icon" aria-hidden="true">{view === 'preview' ? <Monitor size={22} /> : <MessagesSquare size={22} />}</span>
      <div><h1 id="client-conversation-project-title">{project.name}</h1><p>{view === 'preview' ? PREVIEW_DESCRIPTION : CONVERSATION_DESCRIPTION}</p></div>
      {project.preview && <div role="tablist" aria-label="Project view" className="cx-view-switch">
        {(['conversation', 'preview'] as const).map(id => <button key={id} type="button" role="tab" aria-selected={view === id}
          className={view === id ? 'is-current' : undefined} onClick={() => onViewChange(id)}>{id === 'preview' ? 'Preview' : 'Conversation'}</button>)}
      </div>}
    </header>
  </>;
}
