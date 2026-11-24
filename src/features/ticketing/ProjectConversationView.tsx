import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, CheckCircle2, ChevronDown, Circle, ListChecks, LockKeyhole, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Textarea } from '@/shared/components/ui/textarea';
import { compactTicketReference } from './ticketUi';
import { TicketChat, type ChatReplyTo, type TicketChatMessage } from './TicketChat';
import {
  CHECKLIST_LABEL, canToggleRequest, conversationChatMessages, requestCardId, requestIdOfCard,
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
  return <Badge variant="secondary" className={`shrink-0 rounded-full border-0 text-[11px] ${CHIP_TONE[status]}`}>
    {CHECKLIST_LABEL[status]}
  </Badge>;
}

/** The request a reply is about; without one, a message goes to the project as a whole. */
export interface ConversationAbout { ticketId: string; title: string }
/** Scroll the conversation to a message; a new token jumps again to the same one. */
export interface ConversationJump { id: string; token: number }

const requestMessageId = requestCardId;
const noCleanup = () => undefined;
const OPEN_CHECKLIST: ReadonlySet<RequestChecklistStatus> = new Set(['open', 'in_progress', 'ready_to_check']);
export const openRequestCount = (requests: readonly ConversationRequest[] | null) =>
  (requests ?? []).filter(request => OPEN_CHECKLIST.has(request.checklist)).length;

/**
 * Centers a message in the chat's own message list. Only that list scrolls, so the page or a side
 * panel around the chat (such as the request just picked) stays where it is.
 */
function centerInFeed(target: HTMLElement) {
  const feed = target.closest<HTMLElement>('.ticket-chat__feed');
  if (!feed) { target.scrollIntoView({ block: 'center' }); return; }
  const offset = target.getBoundingClientRect().top - feed.getBoundingClientRect().top;
  feed.scrollTop += offset - (feed.clientHeight - target.offsetHeight) / 2;
}

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
  /** Called with the request's ticket id when a reply's quoted request is opened. */
  onOpenQuotedRequest?: (ticketId: string) => void;
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
  onRestoreAbout, jump: jumpRequest = null, onOpenQuotedRequest, composerExtra, inputId }: Readonly<ProjectConversationChatProps>) {
  const container = useRef<HTMLDivElement>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // A jump comes from the caller (a request picked in a list) or from opening a reply's quoted request.
  const [jump, setJump] = useState<ConversationJump | null>(jumpRequest);
  useEffect(() => { if (jumpRequest) setJump(jumpRequest); }, [jumpRequest]);
  const openQuote = useCallback((reply: ChatReplyTo) => {
    setJump(previous => ({ id: reply.id, token: (previous?.token ?? 0) + 1 }));
    const ticketId = requestIdOfCard(reply.id);
    if (ticketId) onOpenQuotedRequest?.(ticketId);
  }, [onOpenQuotedRequest]);
  const messages = useMemo((): TicketChatMessage[] => {
    const status = new Map((requests ?? []).map(request => [requestMessageId(request.ticketId), request.checklist]));
    const list = conversationChatMessages(items ?? [], role, messageActions);
    return list.map(message => {
      const checklist = message.kind === 'request' ? status.get(message.id) : undefined;
      return checklist ? { ...message, badge: <ChecklistChip status={checklist} /> } : message;
    });
  }, [items, requests, role, messageActions]);

  // Scroll to the picked request once it is loaded, then let the glow fade.
  const loaded = items !== null;
  useEffect(() => {
    const target = jump && loaded ? container.current?.querySelector<HTMLElement>(`[data-chat-id="${CSS.escape(jump.id)}"]`) : null;
    if (!jump || !target) return noCleanup;
    // An instant jump, like picking a search result in a chat; smooth scrolling can stall in background tabs.
    centerInFeed(target);
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
    aboutLine = <><span>Replying to</span><span className="ticket-chat__about-chip"><span>{about.title}</span>
      {onClearAbout && <Button type="button" variant="ghost" size="icon" className="h-[18px] w-[18px] rounded-full p-0"
        onClick={onClearAbout} aria-label={`Stop replying about ${about.title}`}><X size={12} aria-hidden="true" /></Button>}</span></>;
  } else if (restoreAbout && onRestoreAbout) {
    aboutLine = <><span>Message about the whole project.</span>
      <Button type="button" variant="ghost" size="sm" className="h-auto px-0 py-0 text-[11.5px] font-semibold text-link hover:bg-transparent"
        onClick={onRestoreAbout}>Reply about “{restoreAbout.title}” instead</Button></>;
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
      onOpenReply={openQuote}
      emptyTitle="No messages yet"
      emptyDescription={role === 'client'
        ? 'Ask a question, or make a request. The project manager sees everything here.'
        : 'Messages, requests and proposal questions for this project will appear here.'}
      draft={draft}
      onDraftChange={onDraftChange}
      onSubmit={submit}
      canCompose
      busy={busy}
      writesAvailable={writesAvailable}
      inputId={inputId}
      placeholder={role === 'client' ? 'Message the project manager…' : 'Message the client…'}
      sendAriaLabel="Send message"
      submitSuffix={null}
      composerToolbar={toolbar}
      composerNote={<>{actionError && <span role="alert" className="mr-2 text-status-danger">{actionError}</span>}
        <LockKeyhole size={11} aria-hidden="true" className="mr-1 inline" />
        {role === 'client' ? 'Only you and the project manager can see this.' : 'The client sees this conversation.'} Enter sends · Shift + Enter starts a new line.</>}
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
  conversationHeader?: ReactNode;
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
  /** Existing full request form, shown as a tab inside the project conversation. */
  requestForm?: ReactNode;
  /** Select a conversation panel after entering a workflow. */
  initialPanelId?: string;
  /**
   * PM: renders the ticket picker and the selected ticket context beside the chat.
   */
  renderRail?: (parts: { requestList: ReactNode; requestsTitle: string }) => ReactNode;
}

/**
 * One conversation per client and project, with the requests made in it as a
 * checklist beside it. Picking a request scrolls the conversation to it.
 */
export function ProjectConversationView(props: Readonly<ProjectConversationViewProps>) {
  const { role, projectName, requests, busy = false, writesAvailable = true, onToggleDone, onCreateRequest, conversationHeader,
    renderRequestActions, focusTicketId = null, selectedTicketId = null, onSelectRequest, panelTabs, requestForm, initialPanelId = 'requests', renderRail } = props;
  const [panel, setPanel] = useState(initialPanelId);
  useEffect(() => { setPanel(initialPanelId); }, [initialPanelId]);
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
  const requestLabel = role === 'pm' ? 'Tickets' : 'Requests';
  const requestsTitle = requests ? `${requestLabel} · ${openRequestCount(requests)} open` : requestLabel;
  const selectRequest = (request: ConversationRequest) => {
    onSelectRequest?.(request);
    toRequest(request.ticketId);
  };
  const chat = <section className="flex h-[70dvh] min-h-[420px] min-w-0 flex-col lg:h-auto lg:min-h-0" aria-label={`Conversation about ${projectName}`}>
    {conversationHeader}
    <ProjectConversationChat {...props} jump={jump} onOpenQuotedRequest={ticketId => {
      props.onOpenQuotedRequest?.(ticketId);
      const request = requests?.find(item => item.ticketId === ticketId);
      if (request && renderRail) onSelectRequest?.(request);
    }} />
  </section>;
  if (renderRail) {
    let requestList: ReactNode = <p role="status" className="pm-rail-note">Loading tickets…</p>;
    if (requests) requestList = requests.length > 0
      ? <ConversationTicketPicker requests={requests} selectedTicketId={selectedTicketId} focusTicketId={focusTicketId} onSelect={selectRequest} />
      : <p className="pm-rail-note">No tickets for this project yet.</p>;
    return <div className="grid min-h-0 min-w-0 flex-none grid-cols-1 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_clamp(320px,31vw,450px)]">
      {chat}
      {renderRail({ requestList, requestsTitle })}
    </div>;
  }
  const requestList = <ConversationRequestList role={role} requests={requests} busy={busy} writesAvailable={writesAvailable} onToggleDone={onToggleDone}
    onCreateRequest={onCreateRequest} renderRequestActions={renderRequestActions} focusTicketId={focusTicketId}
    selectedTicketId={selectedTicketId} onSelectRequest={selectRequest} />;
  const tabs: ConversationPanelTab[] = [{ id: 'requests', label: requestsTitle, content: null },
    ...(panelTabs ?? [about]), ...(requestForm ? [{ id: 'new-request', label: 'New request', content: requestForm }] : [])];

  return <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
    {chat}

    <aside className="flex min-h-0 flex-col border-t border-divider lg:border-l lg:border-t-0"
      aria-label={role === 'pm' ? `Project tickets and details for ${projectName}` : `Requests and details for ${projectName}`}>
      <div role="tablist" aria-label="Conversation details" className="flex shrink-0 flex-wrap gap-x-5 border-b border-divider px-5">
        {tabs.map(({ id, label }) =>
          <Button key={id} type="button" variant="ghost" size="default" role="tab" id={`${tabsId}-${id}`} aria-selected={panel === id} onClick={() => setPanel(id)}
            className={`relative h-11 rounded-none px-0 text-[13px] font-medium ${panel === id
              ? 'text-content after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-link'
              : 'text-content-muted hover:text-content-secondary'}`}>{label}</Button>)}
      </div>
      <div role="tabpanel" aria-labelledby={`${tabsId}-${panel}`} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {panel === 'requests' ? requestList : tabs.find(tab => tab.id === panel)?.content}
      </div>
    </aside>
  </div>;
}

/** A compact, searchable selector keeps long ticket histories from pushing details out of view. */
export function ConversationTicketPicker({ requests, selectedTicketId, focusTicketId, onSelect, noun = 'ticket' }: Readonly<{
  requests: readonly ConversationRequest[];
  selectedTicketId: string | null;
  focusTicketId: string | null;
  onSelect: (request: ConversationRequest) => void;
  noun?: 'ticket' | 'request';
}>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ordered = useMemo(() => orderRequests(requests, focusTicketId), [requests, focusTicketId]);
  const selected = requests.find(request => request.ticketId === selectedTicketId)
    ?? requests.find(request => request.ticketId === focusTicketId)
    ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = normalizedQuery ? ordered.filter(request => [request.title, request.reference, compactTicketReference(request.reference), CHECKLIST_LABEL[request.checklist]]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))) : ordered;

  if (requests.length === 0) return null;
  const choose = (request: ConversationRequest) => {
    onSelect(request);
    setQuery('');
    setOpen(false);
  };

  return <div className="project-ticket-picker">
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={selected ? `Selected ${noun}: ${selected.title}. Change ${noun}` : `Select a ${noun}`}
          className="project-ticket-picker__trigger">
          <span className="min-w-0 flex-1">
            {selected ? <>
              <span className="project-ticket-picker__title">{selected.title}</span>
              <span className="project-ticket-picker__meta">
                <code title={selected.reference}>{compactTicketReference(selected.reference)}</code>
                <ChecklistChip status={selected.checklist} />
              </span>
            </> : <span className="project-ticket-picker__placeholder">Select a {noun}</span>}
          </span>
          <ChevronDown size={16} aria-hidden="true" className={`project-ticket-picker__chevron${open ? ' is-open' : ''}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="project-ticket-picker__popover">
        <label className="project-ticket-picker__search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search tickets</span>
          <Input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${noun}s…`}
            className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0" />
        </label>
        <p className="project-ticket-picker__count" aria-live="polite">
          {matches.length === requests.length ? `${requests.length} ${requests.length === 1 ? noun : noun + 's'}` : `${matches.length} of ${requests.length} ${noun}s`}
        </p>
        {matches.length > 0 ? <ul className="project-ticket-picker__options" aria-label={`${noun[0].toUpperCase() + noun.slice(1)} choices`}>
          {matches.map(request => {
            const isSelected = request.ticketId === selected?.ticketId;
            return <li key={request.ticketId}>
              <button type="button" aria-pressed={isSelected} onClick={() => choose(request)} className="project-ticket-picker__option">
                <span className="min-w-0 flex-1">
                  <span className="project-ticket-picker__title">{request.title}</span>
                  <span className="project-ticket-picker__meta">
                    <code title={request.reference}>{compactTicketReference(request.reference)}</code>
                    <ChecklistChip status={request.checklist} />
                  </span>
                </span>
                {isSelected && <Check size={15} aria-hidden="true" className="shrink-0 text-link" />}
              </button>
            </li>;
          })}
        </ul> : <p className="project-ticket-picker__empty" role="status">No {noun}s match “{query.trim()}”.</p>}
      </PopoverContent>
    </Popover>
  </div>;
}

export interface ConversationRequestListProps {
  role: 'client' | 'pm';
  requests: readonly ConversationRequest[] | null;
  busy: boolean;
  writesAvailable: boolean;
  onToggleDone: (request: ConversationRequest, done: boolean) => void;
  onCreateRequest?: (input: { title: string; description: string }) => Promise<boolean>;
  renderRequestActions?: (request: ConversationRequest) => ReactNode;
  focusTicketId?: string | null;
  selectedTicketId?: string | null;
  /** Clicking a request's title picks it and jumps to where it was made. */
  onSelectRequest?: (request: ConversationRequest) => void;
}

function orderRequests(requests: readonly ConversationRequest[], focusTicketId: string | null) {
  const rank = (request: ConversationRequest) => {
    if (request.ticketId === focusTicketId) return -1;
    return OPEN_CHECKLIST.has(request.checklist) ? 0 : 1;
  };
  return [...requests].sort((a, b) => rank(a) - rank(b));
}

function doneByText(doneBy: ConversationRequest['doneBy'], role: 'client' | 'pm'): string {
  if (doneBy === role) return 'you';
  return doneBy === 'pm' ? 'the project manager' : 'the client';
}

function toggleTitle(request: ConversationRequest, done: boolean): string {
  if (!canToggleRequest(request)) return request.ticketStatus === 'closed' ? 'This request is finished.' : 'This request was not taken on.';
  return done ? 'Reopen this request' : 'Mark this request done';
}

/** The requests made in the conversation, as a checklist. */
export function ConversationRequestList({ role, requests, busy, writesAvailable, onToggleDone, onCreateRequest,
  renderRequestActions, focusTicketId = null, selectedTicketId = null, onSelectRequest }: Readonly<ConversationRequestListProps>) {
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const ids = useId();
  const ordered = useMemo(() => orderRequests(requests ?? [], focusTicketId), [requests, focusTicketId]);

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
      // Every row keeps the same padding, so picking one only tints it and nothing shifts.
      return <li key={request.ticketId} className={`-mx-2 rounded-md px-2 py-3 ${highlighted ? 'bg-selected/40' : ''}`}>
        <div className="flex items-start gap-2.5">
          {/* A toggle button, drawn as a circle that fills in when the request is done. */}
          <Button type="button" variant="ghost" size="icon" title={toggleTitle(request, done)}
            disabled={!toggleable || busy} onClick={() => onToggleDone(request, !done)} aria-pressed={done}
            aria-label={`${done ? 'Reopen' : 'Mark done'}: ${request.title}`}
            className="mt-0.5 h-6 w-6 shrink-0 rounded-full p-0 text-content-muted hover:text-content">
            {done ? <CheckCircle2 size={17} className="text-status-success" aria-hidden="true" /> : <Circle size={17} aria-hidden="true" />}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              {onSelectRequest
                ? <Button type="button" variant="ghost" size="default" onClick={() => onSelectRequest(request)} aria-pressed={highlighted}
                  title="Show where this request was made" className={`h-auto justify-start rounded-none p-0 text-left text-[13px] font-medium hover:bg-transparent hover:underline ${done ? 'text-content-secondary line-through decoration-content-muted' : 'text-content'}`}>{request.title}</Button>
                : <p className={titleClass}>{request.title}</p>}
              <ChecklistChip status={request.checklist} />
            </div>
            {request.checklist === 'ready_to_check' && role === 'client' && <p className="mt-1 text-[12px] text-content-secondary">
              The work for this is finished. Check it, then tick it done.</p>}
            {request.doneBy && done && <p className="mt-1 text-[11.5px] text-content-muted">Marked done by {doneByText(request.doneBy, role)}</p>}
            {role === 'pm' && request.linkedTasks.length > 0 && <ul className="mt-2 space-y-1">
              {request.linkedTasks.map(task => <li key={task.issueId} className="flex items-center gap-2 text-[12px] text-content-secondary">
                <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${task.status === 'done' ? 'bg-status-success' : 'bg-content-muted'}`} />
                {role === 'pm' && <span className="font-mono text-[11px] text-content-muted">{task.identifier}</span>}
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <span className="text-[11px] text-content-muted">{task.status === 'done' ? 'Done' : task.status.replace('_', ' ')}</span>
              </li>)}
            </ul>}
            {renderRequestActions && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              {renderRequestActions?.(request)}
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
        <Input id={`${ids}-title`} value={title} onChange={event => setTitle(event.target.value)} maxLength={160} disabled={busy}
          placeholder="For example: Add a contact form" className="h-9 bg-well text-[13px]" />
        <label htmlFor={`${ids}-details`} className="block text-[12px] font-medium text-content-secondary">Details</label>
        <Textarea id={`${ids}-details`} value={description} onChange={event => setDescription(event.target.value)} maxLength={6000} rows={4} disabled={busy}
          placeholder="What should it do, and how will you know it is right?" className="min-h-20 text-[13px]" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" size="sm" disabled={busy || !title.trim() || !description.trim() || !writesAvailable}>Send request</Button>
        </div>
      </form>
      : <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(true)} disabled={busy || !writesAvailable}
        className="h-8 justify-start px-0 text-[12.5px] font-semibold text-link hover:bg-transparent hover:text-link-hover">
        <Plus size={14} aria-hidden="true" /> New request
      </Button>)}
    {list}
  </div>;
}
