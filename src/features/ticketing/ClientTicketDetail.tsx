import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowLeft, Check, CheckCircle2, ChevronDown, Copy, CornerDownRight, ExternalLink, FileText, Info, LockKeyhole, MessageSquareText, MessagesSquare, Paperclip, Send, ShieldCheck, UserRound } from 'lucide-react';

import type {
  ClientTicketCommandInput, ClientTicketDetail as ClientTicketRecord,
  ClientTicketMessage,
} from './clientApi';
import { clientTicketApi, clientTicketDocumentsApi } from './clientApi';
import type { TicketDocumentsApi } from './ticketDocuments';
import { TicketDocumentsPanel } from './TicketDocumentsPanel';
import { input, primary, secondary, time } from './ticketUi';
import { ClientDeliveryFiles } from './ClientDeliveryFiles';
import {
  canReviewClientDelivery, clientAcceptedResultNote, clientDeliveryReviewKey, clientReviewEvidenceKey,
  clientReviewLockMessage, SCOPE_CHANGE_MAX_LENGTH, scopeChangeMessage,
} from './clientReview';
import { clientTicketProgress } from './clientTicketProgress';
import { clientWhatNext } from './clientFriendly';
import { clientProgressSteps } from './clientProgressSteps';
import { ClientProgressStrip } from './ClientProgressStrip';
import { TicketChat, type TicketChatMessage, type TicketChatProps } from './TicketChat';
import { CxBadge, requestTone, type CxTone } from './clientKit';
import { Button } from '@/shared/components/ui/button';

type Decision = Extract<ClientTicketCommandInput['command'], { type: 'agree_scope' | 'accept_delivery' }>;
type ScopeDecision = Extract<Decision, { type: 'agree_scope' }>;
const TERMINAL = new Set(['closed', 'declined', 'cancelled']);

/** What a request's side panel needs: the request, what the client may do, and how to do it. */
export interface ClientRequestRailProps {
  workspaceId: string;
  ticket: ClientTicketRecord;
  api?: typeof clientTicketApi;
  documentsApi?: TicketDocumentsApi;
  workflowActionsDisabled?: boolean;
  newRequestsDisabled?: boolean;
  communicationEnabled?: boolean;
  /** Show fictional history in the development preview, with every write disabled. */
  readOnlyPreview?: boolean;
  busy: boolean;
  /** Sends a message about this request, such as asking for changes to the plan. */
  onReply: (body: string) => Promise<void>;
  onDecision: (decision: Decision) => void;
  onAdditionalWork: () => void;
  onCorrection: (body: string, deliveryId: string) => Promise<void>;
  /** Shown first in the panel, such as the project's requests. */
  lead?: ReactNode;
  /** Changes when Files should open and come into view, as from the conversation's paperclip. */
  revealFiles?: number;
}

/** Whether the client can write about this request right now. */
export function clientCanReply(ticket: ClientTicketRecord, options: { readOnlyPreview?: boolean; communicationEnabled?: boolean }): boolean {
  if (options.readOnlyPreview) return false;
  return options.communicationEnabled ? !TERMINAL.has(ticket.status) : ticket.writesAvailable && !ticket.readOnly;
}

/**
 * One request in the side panel: what it is and where it stands, any decision the client owes,
 * then the plan or result, what was asked, files and details. Files and details fold away.
 */
export function ClientRequestRail(props: Readonly<ClientRequestRailProps>) {
  const { ticket, workflowActionsDisabled = false, busy, lead } = props;
  const decisions = useRequestDecisions(ticket, workflowActionsDisabled, props.onDecision);
  const canReply = clientCanReply(ticket, props);
  const requestedAction = workflowActionsDisabled ? null : ticket.requestedAction;
  const progress = clientTicketProgress(ticket.status, requestedAction);
  return <>
    <div className="cx-reqrail-top">
      {lead}
      <RequestHead ticket={ticket} statusLabel={progress.statusLabel} description={progress.description}
        tone={requestTone(ticket.status, requestedAction)} extraAction={<AdditionalWork {...props} />} />
      {decisions.owed && <section className="client-decision-slot cx-panel is-attention cx-decision" aria-labelledby="client-decision-title">
        <h2 id="client-decision-title">{'Action needed: ' + progress.label}</h2>
        {decisions.owed === 'plan'
          ? <PlanBody ticket={ticket} scopeDecision={decisions.scopeDecision} canReply={canReply} busy={busy} onAsk={decisions.setConfirming} onReply={props.onReply} />
          : <ResultBody {...props} decisions={decisions} />}
      </section>}
      <RequestStanding ticket={ticket} requestedAction={requestedAction} />
    </div>
    <RailMore {...props} decisions={decisions} canReply={canReply} />
    {decisions.confirming && <ConfirmDecision confirming={decisions.confirming} busy={busy} canAccept={decisions.canReview && decisions.reviewAcknowledged}
      onCancel={() => decisions.setConfirming(null)} onConfirm={decisions.confirm} />}
  </>;
}

/** Below the request's standing: the plan and result when nothing is owed on them, what was asked, files and details. */
function RailMore({ decisions, canReply, ...props }: Readonly<ClientRequestRailProps & { decisions: RequestDecisions; canReply: boolean }>) {
  const { ticket, workflowActionsDisabled = false, busy } = props;
  const showPlan = !workflowActionsDisabled && Boolean(ticket.scope) && decisions.owed !== 'plan';
  const showResult = !workflowActionsDisabled && Boolean(ticket.delivery) && decisions.owed !== 'result';
  return <div className="cx-reqrail-more">
    {showPlan && <RailCard icon={<ShieldCheck size={16} />} title="The plan">
      <PlanBody ticket={ticket} scopeDecision={decisions.scopeDecision} canReply={canReply} busy={busy} onAsk={decisions.setConfirming} onReply={props.onReply} />
    </RailCard>}
    {showResult && <RailCard icon={<CheckCircle2 size={16} />} title="Your result"><ResultBody {...props} decisions={decisions} /></RailCard>}
    <RailCard icon={<MessageSquareText size={16} />} title="What you asked for"><p className="cx-request-copy">{ticket.description}</p></RailCard>
    {props.communicationEnabled && <FilesCard {...props} />}
    <CollapsibleRailCard id="details" icon={<Info size={16} />} title="Request details"><RequestDetails ticket={ticket} /></CollapsibleRailCard>
  </div>;
}

function AdditionalWork({ newRequestsDisabled = true, workflowActionsDisabled = false, busy, onAdditionalWork }: Readonly<ClientRequestRailProps>) {
  if (newRequestsDisabled) return null;
  return <button onClick={onAdditionalWork} disabled={busy || workflowActionsDisabled} className="cx-button">Request additional work</button>;
}

/** The plan or result decision the client owes, the review evidence it needs, and the confirm step before deciding. */
function useRequestDecisions(ticket: ClientTicketRecord, workflowActionsDisabled: boolean, onDecision: (decision: Decision) => void) {
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [inspectedKey, setInspectedKey] = useState('');
  const [previewOpenedKey, setPreviewOpenedKey] = useState('');
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const deliveryKey = clientDeliveryReviewKey(ticket);
  const inspected = useCallback((verified: boolean) => {
    setInspectedKey(verified ? deliveryKey : ''); setReviewAcknowledged(false); setConfirming(null);
  }, [deliveryKey]);
  const canReview = canReviewClientDelivery(ticket, clientReviewEvidenceKey(inspectedKey, previewOpenedKey, deliveryKey));
  useEffect(() => { setConfirming(null); setReviewAcknowledged(false); }, [deliveryKey]);
  useEffect(() => { if (!canReview) { setConfirming(null); setReviewAcknowledged(false); } }, [canReview]);
  const scopeDecision: ScopeDecision | null = ticket.requestedAction === 'agree_scope' && ticket.scope && !ticket.scope.agreed
    ? { type: 'agree_scope', scopeVersionId: ticket.scope.id } : null;
  const awaitingResultReview = ticket.requestedAction === 'review_result' && Boolean(ticket.delivery) && !ticket.delivery?.accepted;
  /** Sends a confirmed decision unless the plan or result changed while the client was deciding. */
  const confirm = (decision: Decision) => {
    const stale = decision.type === 'accept_delivery'
      ? decision.deliveryId !== ticket.delivery?.id || !(canReview && reviewAcknowledged)
      : decision.scopeVersionId !== ticket.scope?.id;
    if (stale) return;
    onDecision(decision); setConfirming(null);
  };
  return {
    confirming: workflowActionsDisabled ? null : confirming, setConfirming, confirm, inspected, canReview, reviewAcknowledged, setReviewAcknowledged, scopeDecision,
    markPreviewOpened: () => setPreviewOpenedKey(deliveryKey),
    owed: owedDecision(workflowActionsDisabled, scopeDecision, awaitingResultReview),
  };
}

/** Which decision the client owes now: approving the plan, checking the result, or none. */
function owedDecision(workflowActionsDisabled: boolean, scopeDecision: ScopeDecision | null, awaitingResultReview: boolean): 'plan' | 'result' | null {
  if (workflowActionsDisabled) return null;
  if (scopeDecision) return 'plan';
  return awaitingResultReview ? 'result' : null;
}
type RequestDecisions = ReturnType<typeof useRequestDecisions>;

function PlanBody({ ticket, scopeDecision, canReply, busy, onAsk, onReply }: Readonly<{
  ticket: ClientTicketRecord; scopeDecision: ScopeDecision | null; canReply: boolean; busy: boolean;
  onAsk: (decision: Decision | null) => void; onReply: (body: string) => Promise<void>;
}>) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  useEffect(() => { setBody(''); setOpen(false); }, [ticket.scope?.id]);
  const text = scopeChangeMessage(body);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text || !canReply || busy) return;
    try { await onReply(text); setBody(''); setOpen(false); }
    catch { /* Keep the draft while the original operation is reconciled. */ }
  }
  if (!ticket.scope) return null;
  const offer = scopeDecision && canReply;
  return <>
    <p className="cx-request-copy">{ticket.scope.summary}</p>
    <p className="cx-request-note">{planNote(ticket.scope)}</p>
    {offer && <div className="cx-request-actions">
      <button onClick={() => { setOpen(false); onAsk(scopeDecision); }} disabled={busy} className={primary + ' min-h-[44px]'}><CheckCircle2 size={14} />Approve plan</button>
      <button onClick={() => { onAsk(null); setOpen(value => !value); }} disabled={busy} className={secondary + ' min-h-[44px]'}>{open ? 'Cancel' : 'Ask for changes'}</button>
    </div>}
    {offer && open && <form className="cx-request-form" onSubmit={submit}>
      <label htmlFor="client-scope-change">What would you like changed in this plan?</label>
      <textarea id="client-scope-change" rows={3} maxLength={SCOPE_CHANGE_MAX_LENGTH} disabled={busy} value={body} onChange={event => setBody(event.target.value)} className={input} />
      <p className="cx-request-note">This goes to your project manager in the conversation. They can reply or send you an updated plan.</p>
      <button type="submit" disabled={busy || !text} className={primary + ' min-h-[44px]'}><Send size={13} />Send to my project manager</button>
    </form>}
  </>;
}

function planNote(scope: NonNullable<ClientTicketRecord['scope']>): string {
  if (!scope.agreed) return 'Waiting for your approval.';
  return scope.approvedBy === 'pm' ? 'Your project manager approved this plan and is going ahead with it.' : 'You approved this plan.';
}

function ResultBody({ ticket, workspaceId, api = clientTicketApi, busy, onCorrection, decisions }: Readonly<ClientRequestRailProps & { decisions: RequestDecisions }>) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const delivery = ticket.delivery;
  const deliveryKey = clientDeliveryReviewKey(ticket);
  useEffect(() => { setBody(''); setOpen(false); }, [deliveryKey]);
  if (!delivery) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decisions.canReview || busy || !body.trim() || !delivery) return;
    try { await onCorrection(body.trim(), delivery.id); setBody(''); setOpen(false); }
    catch { /* Preserve this draft while the original operation is reconciled. */ }
  }
  const reviewing = decisions.canReview && !delivery.accepted;
  return <>
    <p className="cx-request-copy">{delivery.summary}</p>
    <p className="cx-request-note">Shared {time(delivery.sharedAt)}{delivery.accepted ? ' · accepted' : ''}</p>
    <ClientDeliveryFiles key={JSON.stringify([workspaceId, ticket.id, delivery.id, delivery.scopeVersionId])}
      workspaceId={workspaceId} ticketId={ticket.id} deliveryId={delivery.id} scopeVersionId={delivery.scopeVersionId} onInspectionChange={decisions.inspected} api={api} />
    {ticket.sharedProjectPreviewUrl && !delivery.accepted && <a href={ticket.sharedProjectPreviewUrl} target="_blank" rel="noreferrer" onClick={decisions.markPreviewOpened}
      className="cx-link cx-request-preview">Open the project preview <ExternalLink size={12} /></a>}
    {!delivery.accepted && !decisions.canReview && <p className="cx-request-lock"><LockKeyhole size={12} aria-hidden="true" />{clientReviewLockMessage(Boolean(ticket.sharedProjectPreviewUrl))}</p>}
    {reviewing && <div className="cx-request-form">
      <label className="cx-request-check"><input type="checkbox" checked={decisions.reviewAcknowledged} disabled={busy} onChange={event => decisions.setReviewAcknowledged(event.target.checked)} />I checked the result against the plan.</label>
      <div className="cx-request-actions"><button disabled={busy || !decisions.reviewAcknowledged} onClick={() => { setOpen(false); decisions.setConfirming({ type: 'accept_delivery', deliveryId: delivery.id }); }} className={primary + ' min-h-[44px]'}>Accept result</button>
        <button disabled={busy} onClick={() => { decisions.setConfirming(null); setOpen(value => !value); }} className={secondary + ' min-h-[44px]'}>{open ? 'Cancel' : 'Needs a fix'}</button></div>
      {open && <form className="cx-request-form" onSubmit={submit}>
        <label htmlFor="client-result-feedback">What does not match the plan?</label>
        <textarea id="client-result-feedback" rows={3} maxLength={4000} disabled={busy} value={body} onChange={event => setBody(event.target.value)} className={input} />
        <p className="cx-request-note">Your project manager will look at your note and tell you the next step.</p>
        <button type="submit" disabled={busy || !body.trim()} className={primary + ' min-h-[44px]'}>Send fix request</button></form>}
    </div>}
    {delivery.accepted && <p className="cx-request-note">{clientAcceptedResultNote(ticket.status === 'closed')}</p>}
  </>;
}

function ConfirmDecision({ confirming, busy, canAccept, onCancel, onConfirm }: Readonly<{
  confirming: Decision; busy: boolean; canAccept: boolean; onCancel: () => void; onConfirm: (decision: Decision) => void;
}>) {
  const accept = confirming.type === 'accept_delivery';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="client-ticket-confirm-title" className="w-full max-w-md rounded-xl border border-divider bg-surface p-5 shadow-2xl">
      <h2 id="client-ticket-confirm-title" className="text-base font-semibold text-content">{accept ? 'Accept this result?' : 'Approve this plan?'}</h2>
      <p className="mt-2 text-sm leading-relaxed text-content-secondary">{accept ? 'This finishes the request. Nothing more is needed from you.' : 'Your project manager will then start the work.'}</p>
      <div className="mt-5 flex justify-end gap-2"><button onClick={onCancel} disabled={busy} className={secondary + ' min-h-[44px]'}>Cancel</button>
        <button onClick={() => onConfirm(confirming)} disabled={busy || (accept && !canAccept)} className={primary + ' min-h-[44px]'}>{accept ? 'Accept result' : 'Approve plan'}</button></div>
    </section>
  </div>;
}

function RequestHead({ ticket, statusLabel, description, tone, extraAction }: Readonly<{
  ticket: ClientTicketRecord; statusLabel: string; description: string; tone: CxTone; extraAction: ReactNode;
}>) {
  return <section className="cx-reqcard cx-reqhead">
    <div className="cx-reqhead-top">
      <span className="cx-reqhead-icon" aria-hidden="true"><FileText size={24} /></span>
      <div className="cx-reqhead-copy">
        <h1 id="client-request-title">{ticket.title}</h1>
        <p>{ticket.sharedProjectName ?? 'Not linked to a project yet'}</p>
        <p>Created {calendarDayOf(ticket.createdAt)}</p>
      </div>
    </div>
    <CxBadge tone={tone}>{statusLabel}</CxBadge>
    <p className="cx-request-summary">{description}</p>
    {extraAction}
  </section>;
}

/** Where the request is on the five steps, and what happens next. */
function RequestStanding({ ticket, requestedAction }: Readonly<{ ticket: ClientTicketRecord; requestedAction: ClientTicketRecord['requestedAction'] }>) {
  const steps = clientProgressSteps({ ...ticket, requestedAction });
  const whatNext = clientWhatNext({ status: ticket.status, requestedAction });
  return <>
    {steps.length > 0 && <RailCard icon={<Activity size={16} />} title="Request progress"><ClientProgressStrip steps={steps} /></RailCard>}
    {whatNext && <RailCard icon={<CornerDownRight size={16} />} title="What happens next"><p className="cx-request-copy">{whatNext}</p></RailCard>}
  </>;
}

/** The request's files, folded away when not needed; the conversation's paperclip opens and shows it. */
function FilesCard({ ticket, workspaceId, documentsApi = clientTicketDocumentsApi, readOnlyPreview, revealFiles = 0 }: Readonly<ClientRequestRailProps>) {
  const state = useCollapsible('files');
  const [, setOpen] = state;
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!revealFiles) return;
    setOpen(true);
    card.current?.scrollIntoView({ block: 'start' });
    card.current?.focus({ preventScroll: true });
  }, [revealFiles, setOpen]);
  return <CollapsibleRailCard id="files" icon={<Paperclip size={16} />} title="Files" state={state} cardRef={card} bodyClassName="cx-request-files">
    <TicketDocumentsPanel api={documentsApi} scope={workspaceId} ticketId={ticket.id} canUpload={!readOnlyPreview && !TERMINAL.has(ticket.status)} heading="Files" showTitle={false} />
  </CollapsibleRailCard>;
}

/** Project, dates, the project manager and the reference, as a short list. */
function RequestDetails({ ticket }: Readonly<{ ticket: ClientTicketRecord }>) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = () => { void navigator.clipboard?.writeText(ticket.reference).then(() => setCopied(true)).catch(() => undefined); };
  const deadline = ticket.request?.requestedDeadline;
  return <>
    <dl className="cx-details">
      <div><dt>Project</dt><dd>{ticket.sharedProjectName ?? 'Not linked yet'}</dd></div>
      <div><dt>Created on</dt><dd>{calendarDayOf(ticket.createdAt)}</dd></div>
      {deadline && <div><dt>Hoped-for date</dt><dd>{calendarDay(deadline)} · not guaranteed</dd></div>}
      <div><dt>Last update</dt><dd>{time(ticket.updatedAt)}</dd></div>
      <div><dt>Project manager</dt><dd><span className="cx-details-pm" aria-hidden="true"><UserRound size={12} /></span>Your project manager</dd></div>
      <div><dt>Reference</dt><dd className="cx-request-reference"><code>{ticket.reference}</code>
        <button type="button" onClick={copy} aria-label="Copy request reference" className="cx-icon-button">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
        {copied && <output className="cx-request-note">Copied</output>}</dd></div>
    </dl>
    {ticket.relatedTicket && <p className="cx-request-note">Related request: {ticket.relatedTicket.reference} · {ticket.relatedTicket.title}</p>}
  </>;
}

export function RailCard({ icon, title, children }: Readonly<{ icon: ReactNode; title: ReactNode; children: ReactNode }>) {
  return <section className="cx-reqcard"><h2><span aria-hidden="true">{icon}</span>{title}</h2>{children}</section>;
}

const RAIL_STORAGE = 'alpha.client.rail.';

/** Whether a folding panel section is open, remembered on this device; open the first time. */
export function useCollapsible(id: string): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(() => {
    try { return window.localStorage.getItem(RAIL_STORAGE + id) !== '0'; } catch { return true; }
  });
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try { window.localStorage.setItem(RAIL_STORAGE + id, next ? '1' : '0'); } catch { /* Storage can be unavailable; the choice lasts for this page. */ }
  }, [id]);
  return [open, setOpen];
}

/** A side panel section the client can fold away; its title is the toggle. */
export function CollapsibleRailCard({ id, icon, title, children, state, cardRef, bodyClassName = '' }: Readonly<{
  id: string; icon: ReactNode; title: ReactNode; children: ReactNode;
  state?: [boolean, (open: boolean) => void]; cardRef?: React.Ref<HTMLElement>; bodyClassName?: string;
}>) {
  const own = useCollapsible(id);
  const [open, setOpen] = state ?? own;
  const bodyId = useId();
  return <section ref={cardRef} tabIndex={-1} className={'cx-reqcard is-collapsible' + (open ? ' is-open' : '')}>
    <h2><button type="button" className="cx-reqcard-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
      <span aria-hidden="true">{icon}</span><span className="cx-reqcard-title">{title}</span>
      <ChevronDown size={16} aria-hidden="true" className="cx-reqcard-chevron" />
    </button></h2>
    <div id={bodyId} hidden={!open} className={'cx-reqcard-body ' + bodyClassName}>{children}</div>
  </section>;
}

/**
 * A request that is not on a project yet, laid out like a messaging app: its own conversation fills
 * the left side at full height, and the request's details sit in the panel on the right.
 */
export function ClientTicketDetail({
  workspaceId, ticket, messages, messageCursor, historyLoading, historyError, busy, error, replyResetVersion,
  onBack, onLoadMore, onReply, workflowActionsDisabled = false, communicationEnabled = false,
  readOnlyPreview = false, replyDraft, onReplyDraftChange, backLabel = 'Back to requests', ...rail
}: Readonly<Omit<ClientRequestRailProps, 'lead' | 'revealFiles'> & {
  /** Names where the back link goes, since it is the page's only way back. */
  backLabel?: string;
  replyDraft?: string;
  onReplyDraftChange?: (value: string) => void;
  messages: ClientTicketMessage[];
  messageCursor: string | null;
  historyLoading: boolean;
  historyError: string;
  error: string;
  replyResetVersion: number;
  onBack: () => void;
  onLoadMore: () => void;
}>) {
  const [localBody, setLocalBody] = useState('');
  const body = replyDraft ?? localBody;
  const setBody = (value: string) => { setLocalBody(value); onReplyDraftChange?.(value); };
  const previousReplyReset = useRef(replyResetVersion);
  const [revealFiles, setRevealFiles] = useState(0);
  const terminal = TERMINAL.has(ticket.status);
  const canReply = clientCanReply(ticket, { readOnlyPreview, communicationEnabled });

  useEffect(() => {
    if (previousReplyReset.current !== replyResetVersion) setBody('');
    previousReplyReset.current = replyResetVersion;
  }, [replyResetVersion]);

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || !canReply || busy) return;
    try { await onReply(body); setBody(''); }
    catch { /* Preserve the draft if the operation was not confirmed. */ }
  }

  const chat: Omit<TicketChatProps, 'messages'> = {
    role: 'client', clientInitial: (ticket.companyLabel?.trim()[0] ?? 'Y').toUpperCase(), showHeader: false,
    historyError, messageCursor, historyLoading, onLoadMore, showFeed: readOnlyPreview || !(workflowActionsDisabled && !communicationEnabled),
    unavailableTitle: 'About this conversation',
    unavailableDescription: 'The conversation and result review are not available for this request yet. Try again later or contact your project manager.',
    emptyTitle: 'No messages yet', emptyDescription: 'Send a note below if you have a question or an update.',
    draft: body, onDraftChange: setBody, onSubmit: submitReply, canCompose: canReply, busy, writesAvailable: canReply,
    inputId: 'client-ticket-reply', placeholder: 'Message your project manager…', sendAriaLabel: 'Send reply', composerClassName: 'client-reply-form',
    composerNote: 'Enter sends · Shift + Enter starts a new line.', submitOnEnter: true,
    readOnlyLabel: terminal ? 'This request is closed. You can still read its history.' : 'This request is view-only right now.',
    leadingAction: communicationEnabled && !terminal ? <span className="ticket-chat__leading"><Button type="button" variant="outline" size="icon" onClick={() => setRevealFiles(value => value + 1)} aria-label="Go to files"><Paperclip size={17} /></Button></span> : undefined,
  };

  return <section className="cx-request" aria-labelledby="client-request-title">
    <div className="cx-reqsplit">
      <RequestConversation ticketId={ticket.id} messages={messages} history={requestHistory(ticket, workflowActionsDisabled)} error={error} chat={chat}
        back={<button type="button" className="cx-back" onClick={onBack} disabled={busy}><ArrowLeft size={15} aria-hidden="true" />{backLabel}</button>} />
      <aside className="cx-reqrail" aria-label="About this request">
        <ClientRequestRail {...rail} workspaceId={workspaceId} ticket={ticket} busy={busy} onReply={onReply} workflowActionsDisabled={workflowActionsDisabled}
          communicationEnabled={communicationEnabled} readOnlyPreview={readOnlyPreview} revealFiles={revealFiles} />
      </aside>
    </div>
  </section>;
}

/** The request's own conversation at full height: a header with new messages, then messages and milestone updates. */
function RequestConversation({ ticketId, messages, history, error, chat, back }: Readonly<{
  ticketId: string; messages: ClientTicketMessage[]; history: Array<{ label: string; at: string }>; error: string;
  chat: Omit<TicketChatProps, 'messages'>; back: ReactNode;
}>) {
  const unread = useUnreadCount(ticketId, messages);
  // Milestones sit in the conversation at their dates, after whatever history is loaded.
  const firstLoaded = messages[0]?.createdAt;
  const showFrom = chat.messageCursor && firstLoaded ? Date.parse(firstLoaded) : -Infinity;
  const updates: TicketChatMessage[] = history.slice(1).filter(event => Date.parse(event.at) >= showFrom)
    .map(event => ({ id: 'update:' + event.label, author: 'system', body: event.label, createdAt: event.at }));
  const feed = [...messages, ...updates].sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt));
  return <section className="cx-reqchat" aria-labelledby="client-conversation-title">
    {back}
    <header className="cx-reqchat-head">
      <span className="cx-reqchat-icon" aria-hidden="true"><MessagesSquare size={22} /></span>
      <div><h2 id="client-conversation-title">Request conversation</h2><p>Private messages between you and your project manager.</p></div>
      {unread > 0 && <output className="cx-new-pill">{unread === 1 ? '1 new message' : unread + ' new messages'}</output>}
    </header>
    {error && <p role="alert" className="cx-error">{error}</p>}
    <TicketChat {...chat} messages={feed} />
  </section>;
}

/** A timestamp shown as its calendar day, such as "Oct 6, 2026". */
function calendarDayOf(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * How many project manager messages arrived since this device last showed the request. Kept on the
 * device only; the first visit counts nothing as new.
 */
function useUnreadCount(ticketId: string, messages: ClientTicketMessage[]): number {
  const key = 'alpha.client.read.' + ticketId;
  const [seenAt] = useState(() => {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem(key); } catch { return null; }
  });
  const latest = messages.at(-1)?.createdAt;
  useEffect(() => {
    if (!latest) return;
    try { window.localStorage.setItem(key, latest); } catch { /* Storage can be unavailable; nothing is marked as read. */ }
  }, [key, latest]);
  if (!seenAt) return 0;
  const seen = Date.parse(seenAt);
  return messages.filter(message => message.author === 'pm' && Date.parse(message.createdAt) > seen).length;
}

/** "2026-10-20" as "Oct 20, 2026", read as a calendar day so time zones cannot shift it. */
function calendarDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const ENDED_LABEL: Partial<Record<ClientTicketRecord['status'], string>> = {
  closed: 'Request finished', declined: 'Not going ahead', cancelled: 'Request cancelled',
};

/** The request's milestones with dates, oldest first: sent, plan, result, and how it ended. */
function requestHistory(ticket: ClientTicketRecord, workflowActionsDisabled: boolean): Array<{ label: string; at: string }> {
  const events = [{ label: 'You sent the request', at: ticket.createdAt }];
  // Only the time a plan was sent is known, so an approved plan is dated as shared, not as approved.
  if (!workflowActionsDisabled && ticket.scope) events.push({ label: ticket.scope.agreed ? 'Plan shared' : 'Plan sent for your approval', at: ticket.scope.proposedAt });
  if (!workflowActionsDisabled && ticket.delivery) events.push({ label: ticket.delivery.accepted ? 'Result shared and accepted' : 'Result shared for you to check', at: ticket.delivery.sharedAt });
  const ended = ENDED_LABEL[ticket.status];
  if (ended && ticket.closedAt) events.push({ label: ended, at: ticket.closedAt });
  return events.filter(event => Number.isFinite(Date.parse(event.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
