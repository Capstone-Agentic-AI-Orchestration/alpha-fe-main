import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, Circle, ListChecks, LockKeyhole, Plus, X } from 'lucide-react';
import { TicketChat, type TicketChatMessage } from './TicketChat';
import {
  CHECKLIST_LABEL, canToggleRequest, conversationChatMessages,
  type ConversationItem, type ConversationRequest, type RequestChecklistStatus,
} from './projectConversation';

const CHIP_TONE: Record<RequestChecklistStatus, string> = {
  open: 'bg-well text-content-secondary',
  in_progress: 'bg-selected text-selected-content',
  ready_to_check: 'bg-status-warning-subtle text-status-warning',
  done: 'bg-status-success-subtle text-status-success',
  declined: 'bg-well text-content-muted',
  cancelled: 'bg-well text-content-muted',
};

export function ChecklistChip({ status }: Readonly<{ status: RequestChecklistStatus }>) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP_TONE[status]}`}>
    {CHECKLIST_LABEL[status]}
  </span>;
}

/** The request a reply is about; without one, a message goes to the project as a whole. */
export interface ConversationAbout { ticketId: string; title: string }
/** Scroll the conversation to a message; a new token jumps again to the same one. */
export interface ConversationJump { id: string; token: number }

const requestMessageId = (ticketId: string) => 'request:' + ticketId;
const OPEN_CHECKLIST: ReadonlySet<RequestChecklistStatus> = new Set(['open', 'in_progress', 'ready_to_check']);
export const openRequestCount = (requests: readonly ConversationRequest[] | null) =>
  (requests ?? []).filter(request => OPEN_CHECKLIST.has(request.checklist)).length;

/** Jumps to a request's card, as picking a message in a search result would. */
export function useConversationJump() {
  const [jump, setJump] = useState<ConversationJump | null>(null);
  const toRequest = useCallback((ticketId: string) =>
    setJump(previous => ({ id: requestMessageId(ticketId), token: (previous?.token ?? 0) + 1 })), []);
  return { jump, toRequest };
}

export interface ProjectConversationChatProps {
  role: 'client' | 'pm';
  items: ConversationItem[] | null;
  requests: readonly ConversationRequest[] | null;
  error?: string;
  /** Shown above the composer, for a failed send or tick. */
  actionError?: string;
  clientName?: string;
  clientInitial?: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (body: string) => void;
  busy?: boolean;
  writesAvailable?: boolean;
  /** PM: actions on a request card, such as Create task. */
  messageActions?: (item: ConversationItem) => ReactNode;
  /** The request a reply goes to. Cleared, the message goes to the project as a whole. */
  about?: ConversationAbout | null;
  onClearAbout?: () => void;
  /** Offered when a request is selected but the reply was set to the whole project. */
  restoreAbout?: ConversationAbout | null;
  onRestoreAbout?: () => void;
  jump?: ConversationJump | null;
  /** More composer controls, such as the PM's "Ask & wait for reply". */
  composerExtra?: ReactNode;
  inputId: string;
}

/**
 * The project's one conversation: messages, requests as cards of their own, and
 * what happened to them. Picking a request elsewhere scrolls here and marks it.
 */
export function ProjectConversationChat({ role, items, requests, error = '', actionError = '', clientName = 'Client', clientInitial = 'C',
  draft, onDraftChange, onSend, busy = false, writesAvailable = true, messageActions, about = null, onClearAbout, restoreAbout = null,
  onRestoreAbout, jump = null, composerExtra, inputId }: Readonly<ProjectConversationChatProps>) {
  const container = useRef<HTMLDivElement>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const messages = useMemo((): TicketChatMessage[] => {
    const status = new Map((requests ?? []).map(request => [requestMessageId(request.ticketId), request.checklist]));
    const list = conversationChatMessages(items ?? [], role, messageActions
      ? item => { const node = messageActions(item); return node ?? undefined; } : undefined);
    return list.map(message => {
      const checklist = message.kind === 'request' ? status.get(message.id) : undefined;
      return checklist ? { ...message, badge: <ChecklistChip status={checklist} /> } : message;
    });
  }, [items, requests, role, messageActions]);

  // Scroll to the picked request once it is loaded, then let the glow fade.
  const loaded = items !== null;
  useEffect(() => {
    if (!jump || !loaded) return;
    const target = container.current?.querySelector<HTMLElement>(`[data-chat-id="${CSS.escape(jump.id)}"]`);
    if (!target) return;
    // An instant jump, like picking a search result in a chat; smooth scrolling can stall in background tabs.
    target.scrollIntoView({ block: 'center' });
    setHighlightId(jump.id);
    const timer = window.setTimeout(() => setHighlightId(current => current === jump.id ? null : current), 2600);
    return () => window.clearTimeout(timer);
  }, [jump, loaded]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (body && !busy) onSend(body);
  };

  let aboutLine: ReactNode = null;
  if (about) {
    aboutLine = <><span>Replying about</span><span className="ticket-chat__about-chip"><span>{about.title}</span>
      {onClearAbout && <button type="button" onClick={onClearAbout} aria-label={`Stop replying about ${about.title}`}><X size={12} aria-hidden="true" /></button>}</span></>;
  } else if (restoreAbout && onRestoreAbout) {
    aboutLine = <><span>Message about the whole project.</span>
      <button type="button" onClick={onRestoreAbout}>Reply about “{restoreAbout.title}” instead</button></>;
  }
  const toolbar = aboutLine || composerExtra ? <div className="ticket-chat__about">{aboutLine}{composerExtra}</div> : undefined;

  return <div ref={container} className="flex min-h-0 flex-1 flex-col">
    {error && <p role="alert" className="mx-4 mt-3 text-[12.5px] text-status-danger">{error}</p>}
    <TicketChat
      role={role}
      messages={messages}
      clientName={clientName}
      clientInitial={clientInitial}
      showHeader={false}
      historyLoading={items === null && !error}
      highlightId={highlightId}
      emptyTitle="No messages yet"
      emptyDescription={role === 'client'
        ? 'Ask a question, or make a request. Your project manager sees everything here.'
        : 'Messages, requests and proposal questions for this project will appear here.'}
      draft={draft}
      onDraftChange={onDraftChange}
      onSubmit={submit}
      canCompose
      busy={busy}
      writesAvailable={writesAvailable}
      inputId={inputId}
      placeholder={role === 'client' ? 'Message your project manager…' : 'Message the client…'}
      sendAriaLabel="Send message"
      submitSuffix={null}
      composerToolbar={toolbar}
      composerNote={<>{actionError && <span role="alert" className="mr-2 text-status-danger">{actionError}</span>}
        <LockKeyhole size={11} aria-hidden="true" className="mr-1 inline" />
        {role === 'client' ? 'Only you and your project manager can see this.' : 'The client sees this conversation.'} Enter sends · Shift + Enter starts a new line.</>}
      submitOnEnter
    />
  </div>;
}

export interface ConversationPanelTab { id: string; label: string; content: ReactNode }

export interface ProjectConversationViewProps extends Omit<ProjectConversationChatProps, 'requests' | 'jump'> {
  projectName: string;
  requests: ConversationRequest[] | null;
  onToggleDone: (request: ConversationRequest, done: boolean) => void;
  /** Client: make a new request inside this conversation. */
  onCreateRequest?: (input: { title: string; description: string }) => Promise<boolean>;
  /** Opens the request's full page (plan, result, files). */
  onOpenRequest?: (request: ConversationRequest) => void;
  /** PM: extra request actions, such as Create task and Link task. */
  renderRequestActions?: (request: ConversationRequest) => ReactNode;
  /** A request to show first in the panel, as when opened from elsewhere. */
  focusTicketId?: string | null;
  /** The request the other panel tabs describe; highlighted in the list. */
  selectedTicketId?: string | null;
  /** Pick a request; the conversation also scrolls to where it was made. */
  onSelectRequest?: (request: ConversationRequest) => void;
  /** Tabs after Requests; an About tab when none are given. */
  panelTabs?: ConversationPanelTab[];
}

/**
 * One conversation per client and project, with the requests made in it as a
 * checklist beside it. Picking a request scrolls the conversation to it.
 */
export function ProjectConversationView(props: Readonly<ProjectConversationViewProps>) {
  const { role, projectName, requests, busy = false, writesAvailable = true, onToggleDone, onCreateRequest, onOpenRequest,
    renderRequestActions, focusTicketId = null, selectedTicketId = null, onSelectRequest, panelTabs } = props;
  const [panel, setPanel] = useState('requests');
  const tabsId = useId();
  const { jump, toRequest } = useConversationJump();
  const focusJumped = useRef<string | null>(null);
  useEffect(() => {
    if (!focusTicketId || focusJumped.current === focusTicketId || !requests?.some(request => request.ticketId === focusTicketId)) return;
    focusJumped.current = focusTicketId;
    toRequest(focusTicketId);
  }, [focusTicketId, requests, toRequest]);

  const about: ConversationPanelTab = { id: 'about', label: 'About', content: <div className="space-y-4 text-[13px]">
    <div>
      <p className="text-[11.5px] text-content-muted">Project</p>
      <p className="font-medium text-content">{projectName}</p>
    </div>
    <p className="text-[12px] leading-relaxed text-content-secondary">
      This is your one conversation about this project. Ask questions here, make new requests, and tick requests off when they are done.
    </p>
  </div> };
  const tabs: ConversationPanelTab[] = [{ id: 'requests', label: requests ? `Requests · ${openRequestCount(requests)} open` : 'Requests', content: null },
    ...(panelTabs ?? [about])];

  return <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
    <section className="flex h-[70dvh] min-h-[420px] min-w-0 flex-col lg:h-auto lg:min-h-0" aria-label={`Conversation about ${projectName}`}>
      <ProjectConversationChat {...props} jump={jump} />
    </section>

    <aside className="flex min-h-0 flex-col border-t border-divider lg:border-l lg:border-t-0" aria-label="About this conversation">
      <div role="tablist" aria-label="Conversation details" className="flex shrink-0 flex-wrap gap-x-5 border-b border-divider px-5">
        {tabs.map(({ id, label }) =>
          <button key={id} type="button" role="tab" id={`${tabsId}-${id}`} aria-selected={panel === id} onClick={() => setPanel(id)}
            className={`relative h-11 text-[13px] font-medium ${panel === id
              ? 'text-content after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-link'
              : 'text-content-muted hover:text-content-secondary'}`}>{label}</button>)}
      </div>
      <div role="tabpanel" aria-labelledby={`${tabsId}-${panel}`} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {panel === 'requests'
          ? <ConversationRequestList role={role} requests={requests} busy={busy} writesAvailable={writesAvailable} onToggleDone={onToggleDone}
            onCreateRequest={onCreateRequest} onOpenRequest={onOpenRequest} renderRequestActions={renderRequestActions} focusTicketId={focusTicketId}
            selectedTicketId={selectedTicketId}
            onSelectRequest={request => { onSelectRequest?.(request); toRequest(request.ticketId); }} />
          : tabs.find(tab => tab.id === panel)?.content}
      </div>
    </aside>
  </div>;
}

export interface ConversationRequestListProps {
  role: 'client' | 'pm';
  requests: readonly ConversationRequest[] | null;
  busy: boolean;
  writesAvailable: boolean;
  onToggleDone: (request: ConversationRequest, done: boolean) => void;
  onCreateRequest?: (input: { title: string; description: string }) => Promise<boolean>;
  onOpenRequest?: (request: ConversationRequest) => void;
  renderRequestActions?: (request: ConversationRequest) => ReactNode;
  focusTicketId?: string | null;
  selectedTicketId?: string | null;
  /** Clicking a request's title picks it and jumps to where it was made. */
  onSelectRequest?: (request: ConversationRequest) => void;
}

function doneByText(doneBy: ConversationRequest['doneBy'], role: 'client' | 'pm'): string {
  if (doneBy === role) return 'you';
  return doneBy === 'pm' ? 'your project manager' : 'the client';
}

function toggleTitle(request: ConversationRequest, done: boolean): string {
  if (!canToggleRequest(request)) return request.ticketStatus === 'closed' ? 'This request is finished.' : 'This request was not taken on.';
  return done ? 'Reopen this request' : 'Mark this request done';
}

/** The requests made in the conversation, as a checklist. */
export function ConversationRequestList({ role, requests, busy, writesAvailable, onToggleDone, onCreateRequest, onOpenRequest,
  renderRequestActions, focusTicketId = null, selectedTicketId = null, onSelectRequest }: Readonly<ConversationRequestListProps>) {
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const ids = useId();
  const ordered = useMemo(() => {
    const rank = (request: ConversationRequest) => {
      if (request.ticketId === focusTicketId) return -1;
      return OPEN_CHECKLIST.has(request.checklist) ? 0 : 1;
    };
    return [...(requests ?? [])].sort((a, b) => rank(a) - rank(b));
  }, [requests, focusTicketId]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateRequest || !title.trim() || !description.trim()) return;
    if (await onCreateRequest({ title: title.trim(), description: description.trim() })) {
      setTitle(''); setDescription(''); setFormOpen(false);
    }
  };

  let list: ReactNode;
  if (requests === null) list = <p className="text-[12.5px] text-content-muted">Loading requests…</p>;
  else if (ordered.length === 0) list = <div className="flex flex-col items-start gap-1 py-2 text-[12.5px] text-content-muted">
    <ListChecks size={18} aria-hidden="true" />
    <p>{role === 'client' ? 'No requests yet. Make one when you need something built or changed.' : 'No requests from this client on this project yet.'}</p>
  </div>;
  else list = <ul className="divide-y divide-divider">
    {ordered.map(request => {
      const done = request.checklist === 'done';
      const toggleable = canToggleRequest(request) && writesAvailable;
      const highlighted = request.ticketId === (selectedTicketId ?? focusTicketId);
      const titleClass = `text-left text-[13px] font-medium ${done ? 'text-content-secondary line-through decoration-content-muted' : 'text-content'}`;
      return <li key={request.ticketId} className={`py-3 ${highlighted ? 'rounded-md bg-selected/40 px-2' : ''}`}>
        <div className="flex items-start gap-2.5">
          <button type="button" role="checkbox" aria-checked={done} disabled={!toggleable || busy}
            aria-label={`${done ? 'Reopen' : 'Mark done'}: ${request.title}`} title={toggleTitle(request, done)}
            onClick={() => onToggleDone(request, !done)}
            className="mt-0.5 shrink-0 text-content-muted hover:text-content disabled:cursor-default disabled:hover:text-content-muted">
            {done ? <CheckCircle2 size={17} className="text-status-success" aria-hidden="true" /> : <Circle size={17} aria-hidden="true" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              {onSelectRequest
                ? <button type="button" onClick={() => onSelectRequest(request)} aria-pressed={highlighted}
                  title="Show where this request was made" className={titleClass + ' hover:underline'}>{request.title}</button>
                : <p className={titleClass}>{request.title}</p>}
              <ChecklistChip status={request.checklist} />
            </div>
            {request.checklist === 'ready_to_check' && role === 'client' && <p className="mt-1 text-[12px] text-content-secondary">
              The work for this is finished. Check it, then tick it done.</p>}
            {request.doneBy && done && <p className="mt-1 text-[11.5px] text-content-muted">Marked done by {doneByText(request.doneBy, role)}</p>}
            {request.linkedTasks.length > 0 && <ul className="mt-2 space-y-1">
              {request.linkedTasks.map(task => <li key={task.issueId} className="flex items-center gap-2 text-[12px] text-content-secondary">
                <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${task.status === 'done' ? 'bg-status-success' : 'bg-content-muted'}`} />
                {role === 'pm' && <span className="font-mono text-[11px] text-content-muted">{task.identifier}</span>}
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <span className="text-[11px] text-content-muted">{task.status === 'done' ? 'Done' : task.status.replace('_', ' ')}</span>
              </li>)}
            </ul>}
            {(renderRequestActions || onOpenRequest) && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              {renderRequestActions?.(request)}
              {onOpenRequest && <button type="button" onClick={() => onOpenRequest(request)} className="font-semibold text-link hover:text-link-hover">
                Open details</button>}
            </div>}
          </div>
        </div>
      </li>;
    })}
  </ul>;

  return <div className="space-y-4">
    {onCreateRequest && (formOpen
      ? <form onSubmit={event => void create(event)} className="space-y-2.5 border-b border-divider pb-4">
        <label htmlFor={`${ids}-title`} className="block text-[12px] font-medium text-content-secondary">What do you need?</label>
        <input id={`${ids}-title`} value={title} onChange={event => setTitle(event.target.value)} maxLength={160} disabled={busy}
          placeholder="For example: Add a contact form" className="h-9 w-full rounded-md border border-control bg-well px-2.5 text-[13px] text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-focus" />
        <label htmlFor={`${ids}-details`} className="block text-[12px] font-medium text-content-secondary">Details</label>
        <textarea id={`${ids}-details`} value={description} onChange={event => setDescription(event.target.value)} maxLength={6000} rows={4} disabled={busy}
          placeholder="What should it do, and how will you know it is right?" className="w-full rounded-md border border-control bg-well px-2.5 py-2 text-[13px] text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-focus" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setFormOpen(false)} disabled={busy} className="h-8 rounded-md px-3 text-[12.5px] font-medium text-content-secondary hover:bg-surface-high">Cancel</button>
          <button type="submit" disabled={busy || !title.trim() || !description.trim() || !writesAvailable}
            className="h-8 rounded-md bg-action px-3 text-[12.5px] font-semibold text-on-action disabled:opacity-50">Send request</button>
        </div>
      </form>
      : <button type="button" onClick={() => setFormOpen(true)} disabled={busy || !writesAvailable}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-link hover:text-link-hover disabled:opacity-50">
        <Plus size={14} aria-hidden="true" /> New request
      </button>)}
    {list}
  </div>;
}
