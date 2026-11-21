import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ListChecks, MessagesSquare, Monitor, PanelRightClose, PanelRightOpen, Plus, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { LoadingRows } from '@/shared/components/ui/skeleton';
import { ClientTicketApiError, clientTicketApi, type ClientProject, type ClientTicketDetail as ClientTicketRecord } from './clientApi';
import { ClientRequestRail, CollapsibleRailCard, RailCard, type ClientRequestRailProps } from './ClientTicketDetail';
import { ProjectPreviewFrame } from './ClientProjectPreview';
import { ConversationRequestList, ProjectConversationChat, openRequestCount, useConversationJump, type ConversationAbout } from './ProjectConversationView';
import { withUpdatedRequest, type ConversationItem, type ConversationRequest } from './projectConversation';
import type { ClientProjectView } from './clientWorkspaceTabs';

const REFRESH_MS = 30_000;
const TERMINAL = new Set(['closed', 'declined', 'cancelled']);
const newOperationId = () => crypto.randomUUID();
const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const CONVERSATION_DESCRIPTION = 'One conversation with your project manager: questions, your requests and their progress.';
const PREVIEW_DESCRIPTION = 'Try the latest version your project manager shared, and tell them what you notice in the conversation below.';
const PREVIEW_QUESTION = 'Is there a preview I can try yet?';

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
  /** The request open in the panel; picking another one keeps this page and its conversation in place. */
  selectedTicketId: string | null;
  onSelectRequest: (ticketId: string) => void;
  /** The new request form, shown above the requests while the client writes one. */
  requestForm?: ReactNode;
  /** The picked request's details, loaded by the portal. */
  request: { ticket: ClientTicketRecord | null; loading: boolean; error: string };
  /** What the picked request's panel needs to act on it. */
  rail: Omit<ClientRequestRailProps, 'ticket' | 'lead' | 'revealFiles'>;
  /** Sends a reply about the picked request. */
  onReplyAbout: (body: string) => Promise<void>;
  /** Which layout the page shows: the conversation page, the preview beside it, or the preview alone. */
  projectView?: ClientProjectView;
  /** Opens or closes the preview, or folds the conversation away beside it. */
  onProjectViewChange?: (view: ClientProjectView) => void;
}

/**
 * A project's one page. With a shared preview (or once the client opens the preview), it is a split page: the preview fills the left half
 * and everything else scrolls beside it (the project, its requests and the picked request, then the
 * conversation). Without one, the conversation fills the left and the requests and details sit on the right.
 */
export function ClientProjectConversation(props: Readonly<ClientProjectConversationProps>) {
  const { api = clientTicketApi, project, clientName, readOnly = false, selectedTicketId, onSelectRequest, request } = props;
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
  const inputId = `client-conversation-${project.projectId}`;
  const view = props.projectView ?? 'auto';
  const changeView = props.onProjectViewChange;
  const shared = Boolean(project.preview);
  // The preview area shows once one is shared, or whenever the client opens it, even if it only says nothing is shared yet.
  const showPreview = shared || view !== 'auto';
  const focused = showPreview && view === 'focus';
  // Asking about a preview is about the whole project, so it never goes to the picked request.
  const askAboutPreview = readOnly ? undefined : () => {
    target.clear();
    setDraft(current => current.trim() ? current : PREVIEW_QUESTION);
    if (focused) changeView?.('preview');
    // A second frame lets the conversation come back first when it was folded away.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.getElementById(inputId)?.focus()));
  };
  const openPreview = changeView && (() => changeView('preview'));
  const head = <ConversationHead project={project} onBack={props.onBack} busy={busy}
    action={!showPreview && openPreview ? <Button type="button" variant="outline" size="sm" className="cx-preview-open" onClick={openPreview}>
      <Monitor size={15} aria-hidden="true" />Preview</Button> : undefined} />;
  const chat = <ProjectConversationChat role="client"
    items={conversation.items} requests={conversation.requests} error={conversation.error} actionError={actions.actionError}
    clientName={clientName} clientInitial={clientName.trim()[0]?.toUpperCase() ?? 'C'} draft={draft} onDraftChange={setDraft}
    busy={busy} writesAvailable={!readOnly} onSend={send} jump={jump} onOpenQuotedRequest={pick}
    about={target.about} onClearAbout={target.clear} restoreAbout={target.restoreAbout} onRestoreAbout={target.restore}
    inputId={inputId} />;
  const requests = <>
    <div className="cx-reqrail-top">
      {props.requestForm && <RailCard icon={<Plus size={16} />} title="New request">{props.requestForm}</RailCard>}
      {!showPreview && <PreviewNotShared onOpen={openPreview} onAsk={askAboutPreview} />}
      <CollapsibleRailCard id="requests" icon={<ListChecks size={16} />}
        title={conversation.requests ? `Requests · ${openRequestCount(conversation.requests)} open` : 'Requests'}>
        <ConversationRequestList role="client" requests={conversation.requests} busy={busy} writesAvailable={!readOnly}
          onToggleDone={actions.toggle} selectedTicketId={selectedTicketId} onSelectRequest={item => pick(item.ticketId)} />
      </CollapsibleRailCard>
    </div>
    <PickedRequest selectedTicketId={selectedTicketId} request={request} rail={props.rail} />
  </>;

  if (showPreview) {
    const toggle = changeView && <FocusToggle focused={focused}
      onChange={next => changeView(next ? 'focus' : shared ? 'auto' : 'preview')} />;
    // Before anything is shared there is nothing to fold the conversation away for, so the toolbar offers a way back instead.
    const toolbarExtra = focused ? undefined : shared ? toggle
      : changeView && <Button type="button" variant="outline" size="sm" onClick={() => changeView('auto')}>
        <X size={15} aria-hidden="true" />Close preview</Button>;
    const emptyAction = askAboutPreview && <button type="button" className="cx-link" onClick={askAboutPreview}>
      Ask about a preview <ArrowRight size={14} aria-hidden="true" /></button>;
    return <section className={'cx-split' + (focused ? ' is-focus' : '') + (shared ? '' : ' is-empty')} aria-labelledby="client-conversation-project-title">
      <div className="cx-split-preview">
        {focused && <div className="cx-focusbar">
          <button type="button" className="cx-back" onClick={props.onBack} disabled={busy}><ArrowLeft size={15} aria-hidden="true" />All projects</button>
          <h1 id="client-conversation-project-title">{project.name}</h1>
          {toggle}
        </div>}
        <ProjectPreviewFrame project={project} toolbarExtra={toolbarExtra} emptyAction={emptyAction} />
      </div>
      {!focused && <div className="cx-split-side">
        {head}
        {requests}
        <section className="cx-split-chat" aria-label={`Conversation about ${project.name}`}>{chat}</section>
      </div>}
    </section>;
  }
  return <section className="cx-request" aria-labelledby="client-conversation-project-title">
    <div className="cx-reqsplit">
      <section className="cx-reqchat" aria-labelledby="client-conversation-project-title">{head}{chat}</section>
      <aside className="cx-reqrail" aria-label={`Requests and details for ${project.name}`}>{requests}</aside>
    </div>
  </section>;
}

/** Folds the conversation away so the preview fills the page, or brings it back beside the preview. */
function FocusToggle({ focused, onChange }: Readonly<{ focused: boolean; onChange: (focused: boolean) => void }>) {
  return <Button type="button" variant="outline" size="sm" onClick={() => onChange(!focused)}>
    {focused ? <PanelRightOpen size={15} aria-hidden="true" /> : <PanelRightClose size={15} aria-hidden="true" />}
    {focused ? 'Show conversation' : 'Hide conversation'}
  </Button>;
}

/** Where the shared preview will be, while the project manager hasn't shared one yet. */
function PreviewNotShared({ onOpen, onAsk }: Readonly<{ onOpen?: () => void; onAsk?: () => void }>) {
  return <RailCard icon={<Monitor size={16} />} title="Preview">
    <p className="cx-request-note"><strong className="cx-preview-pending">Not shared yet.</strong> When your project manager
      shares a version to try, you can test it on the preview page, beside your conversation.</p>
    {(onOpen || onAsk) && <div className="cx-preview-links">
      {onOpen && <button type="button" className="cx-link" onClick={onOpen}>Open preview page <ArrowRight size={14} aria-hidden="true" /></button>}
      {onAsk && <button type="button" className="cx-link is-quiet" onClick={onAsk}>Ask about a preview</button>}
    </div>}
  </RailCard>;
}

/** The picked request's panel, a loading state while it arrives, or a hint to pick one. */
function PickedRequest({ selectedTicketId, request, rail }: Readonly<Pick<ClientProjectConversationProps, 'selectedTicketId' | 'request' | 'rail'>>) {
  if (request.ticket && request.ticket.id === selectedTicketId) return <ClientRequestRail {...rail} ticket={request.ticket} />;
  if (!selectedTicketId) return <p className="cx-request-note cx-reqrail-hint">Pick a request to see its progress, plan or result, files and details.</p>;
  if (request.error) return <p role="alert" className="cx-error">{request.error}</p>;
  return <section className="cx-reqcard" aria-busy="true"><LoadingRows label="Loading request" layout="detail" rows={3} /></section>;
}

function ConversationHead({ project, onBack, busy, action }: Readonly<{ project: ClientProject; onBack: () => void; busy: boolean; action?: ReactNode }>) {
  return <>
    <button type="button" className="cx-back" onClick={onBack} disabled={busy}><ArrowLeft size={15} aria-hidden="true" />All projects</button>
    <header className="cx-reqchat-head">
      <span className="cx-reqchat-icon" aria-hidden="true"><MessagesSquare size={22} /></span>
      <div><h1 id="client-conversation-project-title">{project.name}</h1><p>{project.preview ? PREVIEW_DESCRIPTION : CONVERSATION_DESCRIPTION}</p></div>
      {action}
    </header>
  </>;
}
