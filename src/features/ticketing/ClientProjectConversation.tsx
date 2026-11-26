import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Flag, ListChecks, MessagesSquare, Monitor, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { LoadingRows } from '@/shared/components/ui/skeleton';
import { ClientTicketApiError, clientTicketApi, type ClientProject, type ClientTicketDetail as ClientTicketRecord } from './clientApi';
import { ClientRequestProgress, ClientRequestRail, CollapsibleRailCard, type ClientRequestRailProps } from './ClientTicketDetail';
import { ProjectPreviewFrame } from './ClientProjectPreview';
import { ConversationTicketPicker, ProjectConversationChat, openRequestCount, useConversationJump, type ConversationAbout } from './ProjectConversationView';
import { withUpdatedRequest, type ConversationRequest, type ProjectConversationTimeline, type RequestChecklistStatus } from './projectConversation';
import type { ClientProjectView } from './clientWorkspaceTabs';
import { useProjectStage } from './useProjectStage';
import { ClientStagePanel } from './ClientStagePanel';
import { ProjectStageTracker } from './ProjectStageTracker';
import { ProjectDiscoverySummaries } from './ProjectDiscoverySummaries';

const REFRESH_MS = 30_000;
const TERMINAL = new Set(['closed', 'declined', 'cancelled']);
const newOperationId = () => crypto.randomUUID();
const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const PREVIEW_QUESTION = 'Is there a preview I can try yet?';

/** The project's one conversation and its requests, refreshed every 30 seconds while the page is visible. */
function useClientProjectConversation(api: typeof clientTicketApi, project: ClientProject) {
  const [timeline, setTimeline] = useState<ProjectConversationTimeline | null>(null);
  const [requests, setRequests] = useState<ConversationRequest[] | null>(null);
  const [error, setError] = useState('');
  const token = useRef(0);
  const { workspaceId, projectId } = project;
  const load = useCallback(async (quiet = false) => {
    token.current += 1;
    const current = token.current;
    if (!quiet) { setTimeline(null); setRequests(null); setError(''); }
    try {
      const [timeline, list] = await Promise.all([api.getProjectConversation(workspaceId, projectId), api.getProjectConversationRequests(workspaceId, projectId)]);
      if (current !== token.current) return;
      setTimeline(timeline); setRequests(list.items); setError('');
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
  return { items: timeline?.items ?? null, discoverySummaries: timeline?.discoverySummaries, requests, setRequests, error, load };
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
  /** Whether stage decisions (approve, request changes, sign) are off; follows `readOnly` unless given. */
  stageReadOnly?: boolean;
  onBack: () => void;
  /** The request open in the panel; picking another one keeps this page and its conversation in place. */
  selectedTicketId: string | null;
  onSelectRequest: (ticketId: string) => void;
  /** The new request form, shown above the requests while the client writes one. */
  requestForm?: ReactNode;
  /** Existing request action moved out of the global navigation and into the project page header. */
  requestAction?: ReactNode;
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

/** The two things a project page can show in its main area. */
type ProjectMode = 'conversation' | 'preview';
/** What the rail beside the preview shows: the conversation, or the requests and the picked request. */
type RailTab = 'chat' | 'requests';

/**
 * Which main area the page shows. `auto` shows the preview once one is shared and the conversation
 * until then; the preview alone (`focus`) only makes sense once there is something to look at.
 */
function projectMode(view: ClientProjectView, shared: boolean): { mode: ProjectMode; focused: boolean } {
  if (view === 'auto') return { mode: shared ? 'preview' : 'conversation', focused: false };
  if (view === 'conversation') return { mode: 'conversation', focused: false };
  return { mode: 'preview', focused: view === 'focus' && shared };
}

/**
 * A project's one page, in one frame: the project header (with a Conversation | Preview switch) and the
 * main area on the left, a rail on the right. The conversation view puts the chat in the main area and the
 * requests in the rail. The preview view puts the preview there (it says so when nothing is shared yet)
 * and the same conversation in the rail, beside a Requests tab. Hide conversation folds the rail away.
 */
export function ClientProjectConversation(props: Readonly<ClientProjectConversationProps>) {
  const { api = clientTicketApi, project, clientName, readOnly = false, selectedTicketId, onSelectRequest, request } = props;
  const conversation = useClientProjectConversation(api, project);
  const actions = useConversationActions(api, project, conversation);
  const [draft, setDraft] = useState('');
  const [railTab, setRailTab] = useState<RailTab>('chat');
  const chatPane = useRef<HTMLElement | null>(null);
  const previousChatBounds = useRef<DOMRect | null>(null);
  const { jump, toRequest } = useConversationJump();
  const target = useReplyTarget(request.ticket, selectedTicketId, readOnly);
  const { workspaceId, projectId } = project;
  const loadStage = useCallback(() => api.getProjectStage(workspaceId, projectId), [api, workspaceId, projectId]);
  const reloadConversation = conversation.load;
  const afterStageWrite = useCallback(() => { void reloadConversation(true); }, [reloadConversation]);
  const stage = useProjectStage(typeof api.getProjectStage === 'function' ? loadStage : null, afterStageWrite);
  const stageSummary = stage.available ? stage.summary : null;
  const loaded = conversation.items !== null;
  useEffect(() => { if (loaded && selectedTicketId) toRequest(selectedTicketId); }, [loaded, selectedTicketId, toRequest]);
  // A new request is written in the requests panel, so bring it forward when the form opens.
  const writingRequest = Boolean(props.requestForm);
  useEffect(() => { if (writingRequest) setRailTab('requests'); }, [writingRequest]);
  const busy = actions.busy || props.rail.busy;
  const shared = Boolean(project.preview);
  const changeView = props.onProjectViewChange;
  const { mode, focused } = projectMode(props.projectView ?? 'auto', shared);
  const changeProjectView = (nextView: ClientProjectView) => {
    const nextMode = projectMode(nextView, shared).mode;
    if (nextMode !== mode) {
      previousChatBounds.current = chatPane.current?.getBoundingClientRect() ?? null;
      if (nextMode === 'preview' && !writingRequest) setRailTab('chat');
    }
    changeView?.(nextView);
  };
  useLayoutEffect(() => {
    const previous = previousChatBounds.current;
    previousChatBounds.current = null;
    const pane = chatPane.current;
    if (!pane || !previous?.width || typeof pane.animate !== 'function'
      || !window.matchMedia('(min-width: 1001px) and (prefers-reduced-motion: no-preference)').matches) return;
    const next = pane.getBoundingClientRect();
    if (!next.width) return;

    // Resize the actual chat so messages reflow as it moves into the rail.
    pane.classList.add('is-docking');
    const animation = pane.animate([
      { width: `${previous.width}px`, height: `${previous.height}px`,
        transform: `translate(${previous.left - next.left}px, ${previous.top - next.top}px)` },
      { width: `${next.width}px`, height: `${next.height}px`, transform: 'translate(0, 0)' },
    ], { duration: 260, easing: 'cubic-bezier(.22, .8, .25, 1)' });
    const clearDocking = () => pane.classList.remove('is-docking');
    animation.onfinish = clearDocking;
    return () => {
      animation.cancel();
      clearDocking();
    };
  }, [mode]);
  const send = (body: string) => {
    const work: () => Promise<unknown> = target.about ? () => props.onReplyAbout(body) : () => actions.sendToProject(body);
    void actions.run(work, 'Your message was not sent. Try again.').then(result => { if (result !== null) setDraft(''); });
  };
  const pick = (ticketId: string) => {
    // Beside the preview the picked request lives under Requests, so show it there.
    if (mode === 'preview') setRailTab('requests');
    if (ticketId === selectedTicketId) toRequest(ticketId); else onSelectRequest(ticketId);
  };
  const inputId = `client-conversation-${project.projectId}`;
  // Asking about a preview is about the whole project, so it never goes to the picked request.
  const askAboutPreview = readOnly ? undefined : () => {
    target.clear();
    setDraft(current => current.trim() ? current : PREVIEW_QUESTION);
    setRailTab('chat');
    if (focused) changeProjectView('preview');
    // A second frame lets the conversation come back first when it was folded away.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.getElementById(inputId)?.focus()));
  };
  const inProofOfConcept = stageSummary?.stage === 'poc' || stageSummary?.stage === 'contract';
  const head = <><ConversationHead project={project} onBack={props.onBack} busy={busy} requestAction={props.requestAction}
    controls={changeView && <>
      <ViewSwitch mode={mode} onChange={next => changeProjectView(next === 'preview' ? 'preview' : 'conversation')} />
      {mode === 'preview' && shared && <FocusToggle focused={focused} onChange={next => changeProjectView(next ? 'focus' : 'preview')} />}
    </>} />
    {stageSummary && <div className="shrink-0 border-b border-divider px-4 pb-2 sm:px-6">
      <ProjectStageTracker summary={stageSummary} role="client" nextActionControl={inProofOfConcept
        ? <span>Arrange in-person signing with your project manager.</span> : undefined} />
    </div>}
    <ProjectDiscoverySummaries summaries={conversation.discoverySummaries} />
  </>;
  const chat = <ProjectConversationChat role="client"
    items={conversation.items} requests={conversation.requests} error={conversation.error} actionError={actions.actionError}
    clientName={clientName} clientInitial={clientName.trim()[0]?.toUpperCase() ?? 'C'} draft={draft} onDraftChange={setDraft}
    busy={busy} writesAvailable={!readOnly} onSend={send} jump={jump} onOpenQuotedRequest={pick}
    about={target.about} onClearAbout={target.clear} restoreAbout={target.restoreAbout} onRestoreAbout={target.restore}
    inputId={inputId} />;
  const requestsTitle = conversation.requests ? `Requests · ${openRequestCount(conversation.requests)} open` : 'Requests';
  const requestPicker = conversation.requests === null
    ? <p role="status" className="cx-project-rail-note">Loading requests…</p>
    : conversation.requests.length > 0
      ? <ConversationTicketPicker noun="request" requests={conversation.requests} selectedTicketId={selectedTicketId} focusTicketId={selectedTicketId}
        onSelect={item => pick(item.ticketId)} />
      : <p className="cx-project-rail-note">No requests for this project yet.</p>;
  const selectedTicket = request.ticket?.id === selectedTicketId ? request.ticket : null;
  const hasDeliveryWorkflow = selectedTicket && (selectedTicket.scope || selectedTicket.delivery
    || selectedTicket.requestedAction === 'agree_scope' || selectedTicket.requestedAction === 'review_result');
  const checklist = selectedTicket && !hasDeliveryWorkflow && selectedTicket.status !== 'on_hold'
    ? conversation.requests?.find(item => item.ticketId === selectedTicketId)?.checklist ?? 'open'
    : undefined;
  const selectedProgress = selectedTicket && hasDeliveryWorkflow
    ? <ClientRequestProgress ticket={selectedTicket} workflowActionsDisabled={props.rail.workflowActionsDisabled} /> : null;
  const newRequest = props.requestForm && <section className="cx-project-new-request">
    <h2>New request</h2>{props.requestForm}
  </section>;
  const stagePanel = stageSummary && <CollapsibleRailCard id={`project-stage-${project.projectId}`} icon={<Flag size={16} />} title="Project stage" initiallyOpen={false}>
    <ClientStagePanel api={api} project={project} summary={stageSummary} busy={stage.busy} actionError={stage.actionError}
      readOnly={props.stageReadOnly ?? readOnly} run={stage.run} />
  </CollapsibleRailCard>;
  const picked = <PickedRequest selectedTicketId={selectedTicketId} request={request} rail={props.rail} checklist={checklist} />;
  const requestsPanel = <div className="cx-project-rail-content">
    <section className="cx-project-ticket-list" aria-label="Requests">
      <h2><ListChecks size={16} aria-hidden="true" /><span>{requestsTitle}</span></h2>
      {selectedProgress}
      {requestPicker}
    </section>
    {newRequest}
    {picked}
    {(stagePanel || !shared) && <div className="cx-project-rail-context">
      {stagePanel}
      {!shared && <PreviewNotShared projectId={project.projectId} onAsk={askAboutPreview} />}
    </div>}
  </div>;

  if (mode === 'preview') {
    const emptyAction = askAboutPreview && <button type="button" className="cx-link" onClick={askAboutPreview}>
      Ask about a preview <ArrowRight size={14} aria-hidden="true" /></button>;
    const tabId = (tab: RailTab) => `${inputId}-${tab}`;
    return <section className="cx-request" aria-labelledby="client-conversation-project-title">
      <div className={'cx-reqsplit is-preview' + (focused ? ' is-focus' : '') + (shared ? '' : ' is-empty')}>
        <section className="cx-reqchat cx-reqpreview" aria-labelledby="client-conversation-project-title">
          {head}
          <ProjectPreviewFrame project={project} emptyAction={emptyAction} />
        </section>
        {!focused && <aside className="cx-reqrail is-tabs" aria-label={`Conversation and requests for ${project.name}`}>
          <div className="cx-railtabs" role="tablist" aria-label="Beside the preview">
            {(['chat', 'requests'] as const).map(tab => <button key={tab} type="button" role="tab" id={tabId(tab) + '-tab'}
              aria-controls={tabId(tab)} aria-selected={railTab === tab} onClick={() => setRailTab(tab)}>
              {tab === 'chat' ? <><MessagesSquare size={15} aria-hidden="true" />Conversation</> : <><ListChecks size={15} aria-hidden="true" />{requestsTitle}</>}
            </button>)}
          </div>
          <section id={tabId('chat')} role="tabpanel" aria-labelledby={tabId('chat') + '-tab'} hidden={railTab !== 'chat'}
            ref={element => { chatPane.current = element; }} className="cx-railchat">{chat}</section>
          <div id={tabId('requests')} role="tabpanel" aria-labelledby={tabId('requests') + '-tab'} hidden={railTab !== 'requests'}
            className="cx-railrequests">{requestsPanel}</div>
        </aside>}
      </div>
    </section>;
  }
  return <section className="cx-request" aria-labelledby="client-conversation-project-title">
    <div className="cx-reqsplit">
      <section className="cx-reqchat" aria-labelledby="client-conversation-project-title">
        {head}
        <div ref={element => { chatPane.current = element; }} className="cx-main-chat-pane">{chat}</div>
      </section>
      <aside className="cx-reqrail" aria-label={`Requests and details for ${project.name}`}>{requestsPanel}</aside>
    </div>
  </section>;
}

/** Switches the page's main area between the conversation and the preview; the rail stays where it is. */
function ViewSwitch({ mode, onChange }: Readonly<{ mode: ProjectMode; onChange: (mode: ProjectMode) => void }>) {
  return <div className="cx-viewswitch" role="group" aria-label="Project view">
    {(['conversation', 'preview'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value}
      onClick={() => { if (mode !== value) onChange(value); }}>
      {value === 'conversation' ? <MessagesSquare size={15} aria-hidden="true" /> : <Monitor size={15} aria-hidden="true" />}
      {value === 'conversation' ? 'Conversation' : 'Preview'}
    </button>)}
  </div>;
}

/** Folds the conversation away so the preview fills the page, or brings it back beside the preview. */
function FocusToggle({ focused, onChange }: Readonly<{ focused: boolean; onChange: (focused: boolean) => void }>) {
  return <Button type="button" variant="outline" size="sm" className="cx-focus-toggle" onClick={() => onChange(!focused)}>
    {focused ? <PanelRightOpen size={15} aria-hidden="true" /> : <PanelRightClose size={15} aria-hidden="true" />}
    {focused ? 'Show conversation' : 'Hide conversation'}
  </Button>;
}

/** Where the shared preview will be, while the project manager hasn't shared one yet. */
function PreviewNotShared({ projectId, onAsk }: Readonly<{ projectId: string; onAsk?: () => void }>) {
  return <CollapsibleRailCard id={`project-preview-${projectId}`} icon={<Monitor size={16} />} title="Preview" initiallyOpen={false}>
    <p className="cx-request-note"><strong className="cx-preview-pending">Not shared yet.</strong> When the project manager
      shares a version to try, it opens under Preview at the top of this page, beside your conversation.</p>
    {onAsk && <button type="button" className="cx-link" onClick={onAsk}>Ask about a preview <ArrowRight size={14} aria-hidden="true" /></button>}
  </CollapsibleRailCard>;
}

/** The picked request's panel, a loading state while it arrives, or a hint to pick one. */
function PickedRequest({ selectedTicketId, request, rail, checklist }: Readonly<Pick<ClientProjectConversationProps, 'selectedTicketId' | 'request' | 'rail'>
  & { checklist?: RequestChecklistStatus }>) {
  if (request.ticket && request.ticket.id === selectedTicketId) return <ClientRequestRail {...rail} ticket={request.ticket} checklist={checklist} projectPanel />;
  if (!selectedTicketId) return <p className="cx-request-note cx-reqrail-hint">Pick a request to see its status, files and details.</p>;
  if (request.error) return <p role="alert" className="cx-error">{request.error}</p>;
  return <section className="cx-project-ticket-detail" aria-busy="true"><LoadingRows label="Loading request" layout="detail" rows={3} /></section>;
}

function ConversationHead({ project, onBack, busy, requestAction, controls }: Readonly<{
  project: ClientProject; onBack: () => void; busy: boolean; requestAction?: ReactNode; controls?: ReactNode;
}>) {
  return <header className="cx-reqchat-head">
    <button type="button" className="cx-icon-button cx-project-back" aria-label="Back to all projects" title="Back to all projects"
      onClick={onBack} disabled={busy}>
      <ArrowLeft size={18} aria-hidden="true" />
    </button>
    <div className="cx-project-head-copy">
      <h1 id="client-conversation-project-title">{project.name}</h1>
      <p>Project conversation</p>
    </div>
    {(requestAction || controls) && <div className="cx-reqchat-controls">{requestAction}{controls}</div>}
  </header>;
}
