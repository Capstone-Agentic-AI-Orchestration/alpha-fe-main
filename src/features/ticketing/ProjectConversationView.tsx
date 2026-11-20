import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, Circle, ListChecks, LockKeyhole, Plus } from 'lucide-react';
import { TicketChat } from './TicketChat';
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

export function ChecklistChip({ status }: { status: RequestChecklistStatus }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP_TONE[status]}`}>
    {CHECKLIST_LABEL[status]}
  </span>;
}

export interface ProjectConversationViewProps {
  role: 'client' | 'pm';
  projectName: string;
  items: ConversationItem[] | null;
  requests: ConversationRequest[] | null;
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
  onToggleDone: (request: ConversationRequest, done: boolean) => void;
  /** Client: make a new request inside this conversation. */
  onCreateRequest?: (input: { title: string; description: string }) => Promise<boolean>;
  /** Opens the request's full page (plan, result, files). */
  onOpenRequest?: (request: ConversationRequest) => void;
  /** PM: extra request actions, such as Create task and Link task. */
  renderRequestActions?: (request: ConversationRequest) => ReactNode;
  /** PM: actions under a chat entry, such as Create task from a client message. */
  messageActions?: (item: ConversationItem) => ReactNode;
  /** A request to show first in the panel, as when opened from elsewhere. */
  focusTicketId?: string | null;
  /** The request the other panel tabs describe; highlighted in the list. */
  selectedTicketId?: string | null;
  /** PM: pick a request for the panel's other tabs. */
  onSelectRequest?: (request: ConversationRequest) => void;
  /** Tabs after Requests; the client sees an About tab when none are given. */
  panelTabs?: ConversationPanelTab[];
  inputId: string;
}

export interface ConversationPanelTab { id: string; label: string; content: ReactNode }

/**
 * One conversation per client and project, for the client portal and the PM's
 * client page: the chat on the left, and on the right the requests made in it
 * as a checklist (with their linked tasks), plus what the conversation is about.
 */
export function ProjectConversationView({ role, projectName, items, requests, error = '', actionError = '', clientName = 'Client',
  clientInitial = 'C', draft, onDraftChange, onSend, busy = false, writesAvailable = true, onToggleDone, onCreateRequest,
  onOpenRequest, renderRequestActions, messageActions, focusTicketId = null, selectedTicketId = null, onSelectRequest, panelTabs,
  inputId }: ProjectConversationViewProps) {
  const [panel, setPanel] = useState('requests');
  const messages = useMemo(() => conversationChatMessages(items ?? [], role, messageActions
    ? item => { const node = messageActions(item); return node ?? undefined; } : undefined), [items, role, messageActions]);
  const open = (requests ?? []).filter(request => request.checklist !== 'done' && request.checklist !== 'declined' && request.checklist !== 'cancelled').length;
  const tabsId = useId();
  const about: ConversationPanelTab = { id: 'about', label: 'About', content: <div className="space-y-4 text-[13px]">
    <div>
      <p className="text-[11.5px] text-content-muted">Project</p>
      <p className="font-medium text-content">{projectName}</p>
    </div>
    <p className="text-[12px] leading-relaxed text-content-secondary">
      This is your one conversation about this project. Ask questions here, make new requests, and tick requests off when they are done.
    </p>
  </div> };
  const tabs: ConversationPanelTab[] = [{ id: 'requests', label: requests ? `Requests · ${open} open` : 'Requests', content: null },
    ...(panelTabs ?? [about])];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (body && !busy) onSend(body);
  };

  return <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
    <section className="flex h-[70dvh] min-h-[420px] min-w-0 flex-col lg:h-auto lg:min-h-0" aria-label={`Conversation about ${projectName}`}>
      {error && <p role="alert" className="mx-4 mt-3 text-[12.5px] text-status-danger">{error}</p>}
      <TicketChat
        role={role}
        messages={messages}
        clientName={clientName}
        clientInitial={clientInitial}
        showHeader={false}
        historyLoading={items === null && !error}
        emptyTitle="No messages yet"
        emptyDescription={role === 'client'
          ? 'Ask a question, or make a request from the Requests panel. Your project manager sees everything here.'
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
        composerNote={<>{actionError && <span role="alert" className="mr-2 text-status-danger">{actionError}</span>}
          <LockKeyhole size={11} aria-hidden="true" className="mr-1 inline" />
          {role === 'client' ? 'Only you and your project manager can see this.' : 'The client sees this conversation.'} Enter sends · Shift + Enter starts a new line.</>}
        submitOnEnter
      />
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
          ? <RequestsPanel role={role} requests={requests} busy={busy} writesAvailable={writesAvailable} onToggleDone={onToggleDone}
            onCreateRequest={onCreateRequest} onOpenRequest={onOpenRequest} renderRequestActions={renderRequestActions} focusTicketId={focusTicketId}
            selectedTicketId={selectedTicketId} onSelectRequest={onSelectRequest} />
          : tabs.find(tab => tab.id === panel)?.content}
      </div>
    </aside>
  </div>;
}

function RequestsPanel({ role, requests, busy, writesAvailable, onToggleDone, onCreateRequest, onOpenRequest, renderRequestActions, focusTicketId,
  selectedTicketId, onSelectRequest }: {
  role: 'client' | 'pm'; requests: ConversationRequest[] | null; busy: boolean; writesAvailable: boolean;
  onToggleDone: ProjectConversationViewProps['onToggleDone']; onCreateRequest?: ProjectConversationViewProps['onCreateRequest'];
  onOpenRequest?: ProjectConversationViewProps['onOpenRequest']; renderRequestActions?: ProjectConversationViewProps['renderRequestActions'];
  focusTicketId: string | null;
  selectedTicketId: string | null;
  onSelectRequest?: ProjectConversationViewProps['onSelectRequest'];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const ids = useId();
  const ordered = useMemo(() => {
    const list = [...(requests ?? [])];
    const rank = (request: ConversationRequest) => request.ticketId === focusTicketId ? -1
      : ['done', 'declined', 'cancelled'].includes(request.checklist) ? 1 : 0;
    return list.sort((a, b) => rank(a) - rank(b));
  }, [requests, focusTicketId]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateRequest || !title.trim() || !description.trim()) return;
    if (await onCreateRequest({ title: title.trim(), description: description.trim() })) {
      setTitle(''); setDescription(''); setFormOpen(false);
    }
  };

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

    {requests === null ? <p className="text-[12.5px] text-content-muted">Loading requests…</p>
      : ordered.length === 0 ? <div className="flex flex-col items-start gap-1 py-2 text-[12.5px] text-content-muted">
        <ListChecks size={18} aria-hidden="true" />
        <p>{role === 'client' ? 'No requests yet. Make one when you need something built or changed.' : 'No requests from this client on this project yet.'}</p>
      </div>
      : <ul className="divide-y divide-divider">
        {ordered.map(request => {
          const done = request.checklist === 'done';
          const toggleable = canToggleRequest(request) && writesAvailable;
          const highlighted = request.ticketId === (selectedTicketId ?? focusTicketId);
          return <li key={request.ticketId} className={`py-3 ${highlighted ? 'rounded-md bg-selected/40 px-2' : ''}`}>
            <div className="flex items-start gap-2.5">
              <button type="button" role="checkbox" aria-checked={done} disabled={!toggleable || busy}
                aria-label={`${done ? 'Reopen' : 'Mark done'}: ${request.title}`}
                title={!canToggleRequest(request) ? (request.ticketStatus === 'closed' ? 'This request is finished.' : 'This request was not taken on.')
                  : done ? 'Reopen this request' : 'Mark this request done'}
                onClick={() => onToggleDone(request, !done)}
                className="mt-0.5 shrink-0 text-content-muted hover:text-content disabled:cursor-default disabled:hover:text-content-muted">
                {done ? <CheckCircle2 size={17} className="text-status-success" aria-hidden="true" /> : <Circle size={17} aria-hidden="true" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  {onSelectRequest
                    ? <button type="button" onClick={() => onSelectRequest(request)} aria-pressed={highlighted}
                      className={`text-left text-[13px] font-medium hover:underline ${done ? 'text-content-secondary line-through decoration-content-muted' : 'text-content'}`}>{request.title}</button>
                    : <p className={`text-[13px] font-medium ${done ? 'text-content-secondary line-through decoration-content-muted' : 'text-content'}`}>{request.title}</p>}
                  <ChecklistChip status={request.checklist} />
                </div>
                {request.checklist === 'ready_to_check' && role === 'client' && <p className="mt-1 text-[12px] text-content-secondary">
                  The work for this is finished. Check it, then tick it done.</p>}
                {request.doneBy && done && <p className="mt-1 text-[11.5px] text-content-muted">
                  Marked done by {request.doneBy === role ? 'you' : request.doneBy === 'pm' ? 'your project manager' : 'the client'}</p>}
                {request.linkedTasks.length > 0 && <ul className="mt-2 space-y-1">
                  {request.linkedTasks.map(task => <li key={task.issueId} className="flex items-center gap-2 text-[12px] text-content-secondary">
                    <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${task.status === 'done' ? 'bg-status-success' : 'bg-content-muted'}`} />
                    {role === 'pm' && <span className="font-mono text-[11px] text-content-muted">{task.identifier}</span>}
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <span className="text-[11px] text-content-muted">{task.status === 'done' ? 'Done' : task.status.replace('_', ' ')}</span>
                  </li>)}
                </ul>}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                  {renderRequestActions?.(request)}
                  {onOpenRequest && <button type="button" onClick={() => onOpenRequest(request)} className="font-semibold text-link hover:text-link-hover">
                    Open details</button>}
                </div>
              </div>
            </div>
          </li>;
        })}
      </ul>}
  </div>;
}
