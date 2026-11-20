import { Fragment, useEffect, useLayoutEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, ClipboardList, LockKeyhole, MessageSquare, Send, StickyNote, UserRound, Zap } from 'lucide-react';
import { Button, type ButtonVariant } from '@/shared/components/ui/button';
import { Bubble, BubbleContent } from '@/shared/components/ui/bubble';
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader, MessageScroller } from '@/shared/components/ui/message';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Textarea } from '@/shared/components/ui/textarea';
import './ticketChat.css';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** 'system' marks a dated milestone (such as "Plan sent for your approval") shown between messages. */
export type TicketChatAuthor = 'client' | 'pm' | 'note' | 'system';

export interface TicketChatMessage {
  id: string;
  author: TicketChatAuthor;
  body: string;
  createdAt: string;
  /** 'event' renders as one centered line (a task linked, a request ticked done); 'request' as a request card. */
  kind?: 'message' | 'request' | 'event';
  /** A short label beside the author, such as the request a message is about. */
  tag?: string;
  /** A request card's title. */
  heading?: string;
  /** Buttons under the message, such as "Create task". */
  actions?: ReactNode;
  /** A request card's reference and status, shown in its header. */
  reference?: string;
  badge?: ReactNode;
}

type TicketChatMode = 'conversation' | 'notes';

export interface TicketChatProps {
  role: 'client' | 'pm';
  mode?: TicketChatMode;
  messages: TicketChatMessage[];
  clientName?: string;
  clientInitial?: string;
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  headerMeta?: ReactNode;
  privacyLabel?: string;
  historyError?: string;
  messageCursor?: string | null;
  historyLoading?: boolean;
  onLoadMore?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  locked?: boolean;
  lockedTitle?: string;
  lockedDescription?: string;
  showFeed?: boolean;
  unavailableTitle?: string;
  unavailableDescription?: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  canCompose?: boolean;
  busy?: boolean;
  writesAvailable?: boolean;
  inputId: string;
  placeholder?: string;
  sendLabel?: string;
  sendAriaLabel?: string;
  sendIcon?: ReactNode;
  sendVariant?: ButtonVariant;
  submitSuffix?: ReactNode;
  composerNote?: ReactNode;
  composerVisibility?: ReactNode;
  composerClassName?: string;
  composerToolbar?: ReactNode;
  leadingAction?: ReactNode;
  composerOpen?: boolean;
  composerPrompt?: boolean;
  composerPromptLabel?: string;
  composerPromptAction?: string;
  onOpenComposer?: () => void;
  onCloseComposer?: () => void;
  closeLabel?: string;
  rows?: number;
  submitOnEnter?: boolean;
  submitOnShortcut?: boolean;
  showShortcut?: boolean;
  readOnlyLabel?: string;
  className?: string;
  /** A message id to mark, as when a request is picked from a list. */
  highlightId?: string | null;
}

function dateKey(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function clockTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString(undefined, { timeStyle: 'short' });
}

function messageAuthor(message: TicketChatMessage, role: TicketChatProps['role'], clientName: string): string {
  if (message.author === 'note') return 'PM-only note';
  if (message.author === role) return 'You';
  return message.author === 'pm' ? 'Project manager' : clientName;
}

function messageAvatar(message: TicketChatMessage, role: TicketChatProps['role'], clientInitial: string) {
  if (message.author === 'note') return <LockKeyhole size={14} aria-hidden="true" />;
  if (message.author === 'pm' && role !== 'pm') return <UserRound size={15} aria-hidden="true" />;
  return message.author === 'pm' ? 'PM' : clientInitial;
}

/** Message groups in order; milestone groups are drawn as update cards instead of bubbles. */
function renderChatGroups(groups: TicketChatMessage[][], renderMessages: (group: TicketChatMessage[], index: number) => ReactNode) {
  return groups.map((group, index) => group[0].author === 'system'
    ? <SystemUpdates key={group[0].id} group={group} showDay={index === 0 || dateKey(groups[index - 1][0].createdAt) !== dateKey(group[0].createdAt)} />
    : renderMessages(group, index));
}

function SystemUpdates({ group, showDay }: Readonly<{ group: TicketChatMessage[]; showDay: boolean }>) {
  const first = group[0];
  return <>
    {showDay && <div className="ticket-chat__day" aria-label={'Messages from ' + dateLabel(first.createdAt)}><span><time dateTime={first.createdAt}>{dateLabel(first.createdAt)}</time></span></div>}
    {group.map(update => <div key={update.id} className="ticket-chat__system" role="note" aria-label={'Update at ' + clockTime(update.createdAt) + ': ' + update.body}>
      <p className="ticket-chat__system-meta" aria-hidden="true"><Zap size={13} />Update <time dateTime={update.createdAt}>{clockTime(update.createdAt)}</time></p>
      <p className="ticket-chat__system-body" aria-hidden="true">{update.body}</p>
    </div>)}
  </>;
}

/** A request made in the conversation: a card across the conversation, set apart from ordinary messages. */
function RequestCard({ message, author, highlighted }: Readonly<{ message: TicketChatMessage; author: string; highlighted: boolean }>) {
  const label = author === 'You' ? 'You made a request' : author + ' made a request';
  return <article className={`ticket-chat__request${highlighted ? ' is-highlighted' : ''}`} data-chat-id={message.id} data-message-kind="request"
    aria-label={label + ': ' + (message.heading ?? 'request') + ' at ' + clockTime(message.createdAt)}>
    <header className="ticket-chat__request-head">
      <span className="ticket-chat__request-icon" aria-hidden="true"><ClipboardList size={15} /></span>
      <span className="ticket-chat__request-label">New request</span>
      {message.reference && <code className="ticket-chat__request-ref">{message.reference}</code>}
      {message.badge && <span className="ticket-chat__request-badge">{message.badge}</span>}
    </header>
    {message.heading && <h3 className="ticket-chat__request-title">{message.heading}</h3>}
    {message.body && <p className="ticket-chat__request-body">{message.body}</p>}
    <footer className="ticket-chat__request-foot">
      <span>{label} · <time dateTime={message.createdAt}>{clockTime(message.createdAt)}</time></span>
      {message.actions && <span className="ticket-chat__actions">{message.actions}</span>}
    </footer>
  </article>;
}

function MessageSkeleton({ align = 'start', width = 'w-2/3' }: { align?: 'start' | 'end'; width?: string }) {
  return <div className={`ticket-chat__message-skeleton ${align === 'end' ? 'is-end' : ''}`}>
    <Skeleton className="ticket-chat__message-skeleton-avatar" />
    <div className="ticket-chat__message-skeleton-content">
      <Skeleton className="ticket-chat__message-skeleton-meta" />
      <Skeleton className={`ticket-chat__message-skeleton-bubble ${width}`} />
    </div>
  </div>;
}

export function TicketChat({
  role,
  mode = 'conversation',
  messages,
  clientName = 'Client',
  clientInitial = 'C',
  title = mode === 'notes' ? 'Private notes' : 'Conversation',
  subtitle = mode === 'notes' ? 'Visible only to authorized project managers' : 'Messages shared on this ticket',
  showHeader = true,
  headerMeta,
  privacyLabel = 'Private conversation',
  historyError = '',
  messageCursor = null,
  historyLoading = false,
  onLoadMore,
  emptyTitle = mode === 'notes' ? 'No private notes yet' : 'No messages yet',
  emptyDescription = mode === 'notes' ? 'Keep internal context here for the project team.' : 'Start the conversation with a question or update.',
  locked = false,
  lockedTitle = 'Client conversation is unavailable',
  lockedDescription = 'The client needs to activate access before messages can be shared.',
  showFeed = true,
  unavailableTitle = 'About this conversation',
  unavailableDescription = 'The conversation is not available for this request yet. Try again later or contact your project manager.',
  draft,
  onDraftChange,
  onSubmit,
  canCompose = false,
  busy = false,
  writesAvailable = true,
  inputId,
  placeholder = mode === 'notes' ? 'Write a private note…' : 'Write a message…',
  sendLabel = mode === 'notes' ? 'Save note' : 'Send',
  sendAriaLabel,
  sendIcon = mode === 'notes' ? <LockKeyhole size={14} aria-hidden="true" /> : <Send size={14} aria-hidden="true" />,
  sendVariant = mode === 'notes' ? 'outline' : 'default',
  submitSuffix,
  composerNote,
  composerVisibility,
  composerClassName = 'ticket-chat__composer',
  composerToolbar,
  leadingAction,
  composerOpen = true,
  composerPrompt = false,
  composerPromptLabel = 'Write a private note…',
  composerPromptAction = 'Add note',
  onOpenComposer,
  onCloseComposer,
  closeLabel = 'Close',
  rows = 1,
  submitOnEnter = false,
  submitOnShortcut = false,
  showShortcut = false,
  readOnlyLabel,
  className = '',
  highlightId = null,
}: TicketChatProps) {
  const feed = useRef<HTMLDivElement>(null);
  const previous = useRef<{ first: string; last: string; length: number; scrollHeight: number; scrollTop: number } | null>(null);
  const previousMode = useRef(mode);

  useIsomorphicLayoutEffect(() => {
    const element = feed.current;
    if (!element) return;
    if (previousMode.current !== mode) {
      previous.current = null;
      previousMode.current = mode;
    }

    const first = messages[0]?.id ?? '';
    const last = messages[messages.length - 1]?.id ?? '';
    const snapshot = previous.current;
    if (!snapshot || snapshot.length === 0) element.scrollTop = element.scrollHeight;
    else if (first && first !== snapshot.first && last === snapshot.last) {
      element.scrollTop = element.scrollHeight - snapshot.scrollHeight + snapshot.scrollTop;
    } else if (last && last !== snapshot.last) {
      element.scrollTop = element.scrollHeight;
    }
    previous.current = { first, last, length: messages.length, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop };
  }, [messages, mode, showFeed]);

  const messageGroups: TicketChatMessage[][] = [];
  messages.forEach(message => {
    const group = messageGroups[messageGroups.length - 1];
    // Events and request cards stand alone; ordinary messages group by author and day.
    const groupable = (item: TicketChatMessage) => (item.kind ?? 'message') === 'message';
    if (group && groupable(message) && groupable(group[0]) && group[0].author === message.author
      && dateKey(group[0].createdAt) === dateKey(message.createdAt)) group.push(message);
    else messageGroups.push([message]);
  });

  const renderMessageGroup = (group: TicketChatMessage[], groupIndex: number) => {
    const firstMessage = group[0];
    const day = (groupIndex === 0 || dateKey(messageGroups[groupIndex - 1][0].createdAt) !== dateKey(firstMessage.createdAt)) && <div className="ticket-chat__day" aria-label={`Messages from ${dateLabel(firstMessage.createdAt)}`}><span><time dateTime={firstMessage.createdAt}>{dateLabel(firstMessage.createdAt)}</time></span></div>;
    if (firstMessage.kind === 'event') {
      return <Fragment key={firstMessage.id}>
        {day}
        <p className="ticket-chat__event" data-message-kind="event" data-chat-id={firstMessage.id}>
          <span>{firstMessage.body}</span><time dateTime={firstMessage.createdAt}>{clockTime(firstMessage.createdAt)}</time>
        </p>
      </Fragment>;
    }
    if (firstMessage.kind === 'request') {
      return <Fragment key={firstMessage.id}>
        {day}
        <RequestCard message={firstMessage} author={messageAuthor(firstMessage, role, clientName)} highlighted={firstMessage.id === highlightId} />
      </Fragment>;
    }
    return <Fragment key={firstMessage.id}>
      {day}
      <MessageGroup className="ticket-chat__group">
        {group.map((message, groupIndex) => {
          const note = mode === 'notes' || message.author === 'note';
          const mine = !note && message.author === role;
          const author = messageAuthor(message, role, clientName);
          return <Message
            key={message.id}
            align={mine ? 'end' : 'start'}
            data-message-author={message.author}
            aria-label={`${author} message at ${clockTime(message.createdAt)}`}
            data-message-kind={message.kind ?? 'message'}
            data-chat-id={message.id}
            className={`ticket-chat__message${mine ? ' ticket-chat__message--mine' : ''}${note ? ' ticket-chat__message--note' : ''}${message.id === highlightId ? ' is-highlighted' : ''}`}
          >
            <MessageAvatar className={`ticket-chat__avatar${mine ? ' ticket-chat__avatar--mine' : ''}${note ? ' ticket-chat__avatar--note' : ''}`} aria-hidden="true">{messageAvatar(message, role, clientInitial)}</MessageAvatar>
            <MessageContent className="ticket-chat__content">
              <MessageHeader className="ticket-chat__message-meta"><span>{groupIndex === 0 || message.tag ? author : <span className="sr-only">{author}</span>}</span>{message.tag && <span className="ticket-chat__tag">{message.tag}</span>}</MessageHeader>
              <Bubble className="ticket-chat__bubble"><BubbleContent className="ticket-chat__bubble-content">
                {message.heading && <strong className="ticket-chat__bubble-heading">{message.heading}</strong>}
                {message.body}
              </BubbleContent></Bubble>
              <MessageFooter className="ticket-chat__message-footer"><time dateTime={message.createdAt}>{clockTime(message.createdAt)}</time>{message.actions && <span className="ticket-chat__actions">{message.actions}</span>}</MessageFooter>
            </MessageContent>
          </Message>;
        })}
      </MessageGroup>
    </Fragment>;
  };

  const submit = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const form = event.currentTarget.form;
    const canSubmit = Boolean(draft.trim()) && !busy && writesAvailable;
    if (submitOnEnter && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && canSubmit) {
      event.preventDefault();
      form?.requestSubmit();
    }
    if (submitOnShortcut && (event.metaKey || event.ctrlKey) && event.key === 'Enter' && canSubmit) {
      event.preventDefault();
      form?.requestSubmit();
    }
  };

  const composer = canCompose && (!composerPrompt || composerOpen) ? <form data-ticket-chat-composer="true" className={composerClassName} onSubmit={onSubmit}>
    {composerToolbar && <div className="ticket-chat__composer-toolbar">{composerToolbar}</div>}
    <div className="ticket-chat__composer-row">
      {leadingAction}
      <div className="ticket-chat__composer-field">
        <label className="sr-only" htmlFor={inputId}>{mode === 'notes' ? 'Private note' : 'Message'}</label>
        <Textarea
          id={inputId}
          value={draft}
          onChange={event => onDraftChange(event.target.value)}
          onKeyDown={submit}
          disabled={!writesAvailable || busy}
          maxLength={4000}
          rows={rows}
          placeholder={placeholder}
          aria-busy={busy}
        />
        {showShortcut && <kbd className="ticket-chat__shortcut" aria-label="Command or control plus enter">⌘↵</kbd>}
      </div>
      <Button type="submit" aria-label={sendAriaLabel} variant={sendVariant} disabled={!writesAvailable || !draft.trim() || busy} className="ticket-chat__send">
        {sendIcon}<span>{sendLabel}</span>{submitSuffix ?? (mode === 'conversation' && role === 'pm' ? <ChevronDown size={14} aria-hidden="true" /> : null)}
      </Button>
    </div>
    {composerNote && <p className="ticket-chat__composer-note">{composerNote}</p>}
    {composerVisibility && <div className="ticket-chat__composer-footer">
      <span className="ticket-chat__visibility">{mode === 'notes' && <LockKeyhole size={12} aria-hidden="true" />}{composerVisibility}</span>
      {onCloseComposer && <Button type="button" variant="ghost" size="sm" onClick={onCloseComposer} disabled={busy}>{closeLabel}</Button>}
    </div>}
  </form> : null;
  const composerPromptView = canCompose && composerPrompt && !composerOpen ? <Button type="button" variant="outline" onClick={onOpenComposer} className="ticket-chat__composer-prompt">
    <span>{composerPromptLabel}</span><span>{composerPromptAction}<StickyNote size={15} aria-hidden="true" /></span>
  </Button> : null;

  return <section className={`ticket-chat ticket-chat--${mode}${className ? ` ${className}` : ''}`} aria-label={title}>
    {showHeader && <header className="ticket-chat__header">
      <div className="ticket-chat__heading">
        <span className="ticket-chat__heading-icon" aria-hidden="true"><MessageSquare size={15} /></span>
        <div><h2>{title}</h2><p>{subtitle}</p></div>
      </div>
      <span className="ticket-chat__header-meta">{headerMeta ?? <><span className="ticket-chat__status-dot" aria-hidden="true" />{privacyLabel}</>}</span>
    </header>}

    {mode === 'notes' && <p className="ticket-chat__privacy"><LockKeyhole size={13} aria-hidden="true" />{privacyLabel}</p>}

    {showFeed ? <MessageScroller ref={feed} className="ticket-chat__feed" aria-label={mode === 'notes' ? 'Private notes, oldest first' : 'Messages, oldest first'} aria-live="polite">
      {historyError && <p role="alert" className="ticket-chat__error">{historyError}</p>}
      {historyLoading && messages.length > 0 && <div className="ticket-chat__loading-more" role="status" aria-label="Loading earlier messages"><Skeleton className="h-2 w-24" /></div>}
      {messageCursor && <Button type="button" variant="outline" size="sm" onClick={onLoadMore} disabled={historyLoading} className="ticket-chat__load-more">{historyLoading ? 'Loading…' : 'Load earlier messages'}</Button>}
      {historyLoading && messages.length === 0 ? <div className="ticket-chat__skeleton-list" role="status" aria-label="Loading messages">
        <MessageSkeleton width="w-3/5" />
        <MessageSkeleton align="end" width="w-2/3" />
        <MessageSkeleton width="w-1/2" />
      </div> : locked ? <div className="ticket-chat__locked"><LockKeyhole size={18} aria-hidden="true" /><div><strong>{lockedTitle}</strong><p>{lockedDescription}</p></div></div>
        : messages.length === 0 ? <div className="ticket-chat__empty"><MessageSquare size={20} aria-hidden="true" /><strong>{emptyTitle}</strong><p>{emptyDescription}</p></div>
          : renderChatGroups(messageGroups, renderMessageGroup)}
    </MessageScroller> : <div className="ticket-chat__unavailable"><h3>{unavailableTitle}</h3><p>{unavailableDescription}</p></div>}

    {showFeed && (composer ?? composerPromptView ?? (readOnlyLabel ? <p className="ticket-chat__readonly">{readOnlyLabel}</p> : null))}
  </section>;
}
