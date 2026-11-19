import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowLeft, Check, CheckCircle2, Copy, CornerDownRight, ExternalLink, FileText, Info, LockKeyhole, MessageSquareText, MessagesSquare, Paperclip, Send, ShieldCheck, UserRound } from 'lucide-react';

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
import { TicketChat, type TicketChatMessage } from './TicketChat';
import { CxBadge, requestTone } from './clientKit';
import { Button } from '@/shared/components/ui/button';

type Decision = Extract<ClientTicketCommandInput['command'], { type: 'agree_scope' | 'accept_delivery' }>;

/**
 * One request, laid out like a messaging app: the conversation fills the right side at full height,
 * with any decision pinned above it; everything else about the request sits in the left column.
 */
export function ClientTicketDetail({
  workspaceId, ticket, messages, messageCursor, historyLoading, historyError, busy, error, replyResetVersion,
  onBack, onLoadMore, onReply, onDecision, onAdditionalWork, onCorrection, api = clientTicketApi,
  documentsApi = clientTicketDocumentsApi, workflowActionsDisabled = false, newRequestsDisabled = true, communicationEnabled = false,
  readOnlyPreview = false, replyDraft, onReplyDraftChange, backLabel = 'Back to requests',
}: {
  /** Names where the back link goes, since it is the page's only way back. */
  backLabel?: string;
  workspaceId: string;
  api?: typeof clientTicketApi;
  documentsApi?: TicketDocumentsApi;
  workflowActionsDisabled?: boolean;
  newRequestsDisabled?: boolean;
  communicationEnabled?: boolean;
  /** Show fictional history in the development preview, with every reply disabled. */
  readOnlyPreview?: boolean;
  replyDraft?: string;
  onReplyDraftChange?: (value: string) => void;
  ticket: ClientTicketRecord;
  messages: ClientTicketMessage[];
  messageCursor: string | null;
  historyLoading: boolean;
  historyError: string;
  busy: boolean;
  error: string;
  replyResetVersion: number;
  onBack: () => void;
  onLoadMore: () => void;
  onReply: (body: string) => Promise<void>;
  onDecision: (decision: Decision) => void;
  onAdditionalWork: () => void;
  onCorrection: (body: string, deliveryId: string) => Promise<void>;
}) {
  const [localBody, setLocalBody] = useState('');
  const body = replyDraft ?? localBody;
  const setBody = (value: string) => { setLocalBody(value); onReplyDraftChange?.(value); };
  const previousReplyReset = useRef(replyResetVersion);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [inspectedKey, setInspectedKey] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionBody, setCorrectionBody] = useState('');
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [previewOpenedKey, setPreviewOpenedKey] = useState('');
  const [scopeChangeOpen, setScopeChangeOpen] = useState(false);
  const [scopeChangeBody, setScopeChangeBody] = useState('');
  const filesRef = useRef<HTMLDivElement>(null);
  const deliveryKey = clientDeliveryReviewKey(ticket);
  const inspected = useCallback((verified: boolean) => {
    setInspectedKey(verified ? deliveryKey : ''); setReviewAcknowledged(false); setConfirming(null);
  }, [deliveryKey]);
  const canReview = canReviewClientDelivery(ticket, clientReviewEvidenceKey(inspectedKey, previewOpenedKey, deliveryKey));
  const terminal = ticket.status === 'closed' || ticket.status === 'declined' || ticket.status === 'cancelled';
  const canReply = !readOnlyPreview && (communicationEnabled ? !terminal : ticket.writesAvailable && !ticket.readOnly);
  const requestedAction = workflowActionsDisabled ? null : ticket.requestedAction;
  const progress = clientTicketProgress(ticket.status, requestedAction);
  const progressSteps = clientProgressSteps({ ...ticket, requestedAction });
  const scopeDecision = ticket.requestedAction === 'agree_scope' && ticket.scope && !ticket.scope.agreed
    ? { type: 'agree_scope' as const, scopeVersionId: ticket.scope.id } : null;
  const awaitingResultReview = ticket.requestedAction === 'review_result' && Boolean(ticket.delivery) && !ticket.delivery?.accepted;
  const needsAction = !workflowActionsDisabled && (Boolean(scopeDecision) || awaitingResultReview);
  const clientInitial = (ticket.companyLabel?.trim()[0] ?? 'Y').toUpperCase();
  const showConversationFeed = readOnlyPreview || !(workflowActionsDisabled && !communicationEnabled);

  useEffect(() => {
    if (previousReplyReset.current !== replyResetVersion) setBody('');
    previousReplyReset.current = replyResetVersion;
  }, [replyResetVersion]);
  useEffect(() => { setCorrectionBody(''); setCorrectionOpen(false); setConfirming(null); setReviewAcknowledged(false); }, [deliveryKey]);
  useEffect(() => { setScopeChangeBody(''); setScopeChangeOpen(false); }, [ticket.scope?.id]);
  useEffect(() => { if (!canReview) { setConfirming(null); setReviewAcknowledged(false); } }, [canReview]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || !canReply || busy) return;
    try {
      await onReply(body);
      setBody('');
    } catch {
      // Preserve the draft if the operation was not confirmed.
    }
  }

  const scopeChangeText = scopeChangeMessage(scopeChangeBody);
  async function submitScopeChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scopeChangeText || !canReply || busy) return;
    try {
      await onReply(scopeChangeText);
      setScopeChangeBody(''); setScopeChangeOpen(false);
    } catch {
      // Keep the draft while the original operation is reconciled.
    }
  }

  async function submitCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReview || busy || !correctionBody.trim() || !ticket.delivery) return;
    try { await onCorrection(correctionBody.trim(), ticket.delivery.id); setCorrectionBody(''); setCorrectionOpen(false); }
    catch { /* Preserve this draft while the original operation is reconciled. */ }
  }

  function copyReference() {
    void navigator.clipboard?.writeText(ticket.reference).then(() => setCopied(true)).catch(() => undefined);
  }

  function showFiles() {
    filesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    filesRef.current?.focus({ preventScroll: true });
  }

  const planBody = !workflowActionsDisabled && ticket.scope ? <>
    <p className="cx-request-copy">{ticket.scope.summary}</p>
    <p className="cx-request-note">{ticket.scope.agreed
      ? ticket.scope.approvedBy === 'pm' ? 'Your project manager approved this plan and is going ahead with it.' : 'You approved this plan.'
      : 'Waiting for your approval.'}</p>
    {scopeDecision && canReply && <div className="cx-request-actions">
      <button onClick={() => { setScopeChangeOpen(false); setConfirming(scopeDecision); }} disabled={busy} className={primary + ' min-h-[44px]'}><CheckCircle2 size={14} />Approve plan</button>
      <button onClick={() => { setConfirming(null); setScopeChangeOpen(value => !value); }} disabled={busy} className={secondary + ' min-h-[44px]'}>{scopeChangeOpen ? 'Cancel' : 'Ask for changes'}</button>
    </div>}
    {scopeDecision && canReply && scopeChangeOpen && <form className="cx-request-form" onSubmit={submitScopeChange}>
      <label htmlFor="client-scope-change">What would you like changed in this plan?</label>
      <textarea id="client-scope-change" rows={3} maxLength={SCOPE_CHANGE_MAX_LENGTH} disabled={busy} value={scopeChangeBody} onChange={event => setScopeChangeBody(event.target.value)} className={input} />
      <p className="cx-request-note">This goes to your project manager in the conversation below. They can reply or send you an updated plan.</p>
      <button type="submit" disabled={busy || !scopeChangeText} className={primary + ' min-h-[44px]'}><Send size={13} />Send to my project manager</button>
    </form>}
  </> : null;

  const delivery = workflowActionsDisabled ? null : ticket.delivery;
  const resultBody = delivery ? <>
    <p className="cx-request-copy">{delivery.summary}</p>
    <p className="cx-request-note">Shared {time(delivery.sharedAt)}{delivery.accepted ? ' · accepted' : ''}</p>
    <ClientDeliveryFiles key={JSON.stringify([workspaceId, ticket.id, delivery.id, delivery.scopeVersionId])}
      workspaceId={workspaceId} ticketId={ticket.id} deliveryId={delivery.id} scopeVersionId={delivery.scopeVersionId} onInspectionChange={inspected} api={api} />
    {ticket.sharedProjectPreviewUrl && !delivery.accepted && <a href={ticket.sharedProjectPreviewUrl} target="_blank" rel="noreferrer" onClick={() => setPreviewOpenedKey(deliveryKey)}
      className="cx-link cx-request-preview">Open the project preview <ExternalLink size={12} /></a>}
    {!delivery.accepted && !canReview && <p className="cx-request-lock"><LockKeyhole size={12} aria-hidden="true" />{clientReviewLockMessage(Boolean(ticket.sharedProjectPreviewUrl))}</p>}
    {canReview && <div className="cx-request-form">
      <label className="cx-request-check"><input type="checkbox" checked={reviewAcknowledged} disabled={busy} onChange={event => setReviewAcknowledged(event.target.checked)} />I checked the result against the plan.</label>
      <div className="cx-request-actions"><button disabled={busy || !reviewAcknowledged} onClick={() => { setCorrectionOpen(false); setConfirming({ type: 'accept_delivery', deliveryId: delivery.id }); }} className={primary + ' min-h-[44px]'}>Accept result</button>
        <button disabled={busy} onClick={() => { setConfirming(null); setCorrectionOpen(value => !value); }} className={secondary + ' min-h-[44px]'}>{correctionOpen ? 'Cancel' : 'Needs a fix'}</button></div>
      {correctionOpen && <form className="cx-request-form" onSubmit={submitCorrection}>
        <label htmlFor="client-result-feedback">What does not match the plan?</label>
        <textarea id="client-result-feedback" rows={3} maxLength={4000} disabled={busy} value={correctionBody} onChange={event => setCorrectionBody(event.target.value)} className={input} />
        <p className="cx-request-note">Your project manager will look at your note and tell you the next step.</p>
        <button type="submit" disabled={busy || !correctionBody.trim()} className={primary + ' min-h-[44px]'}>Send fix request</button></form>}
    </div>}
    {delivery.accepted && <p className="cx-request-note">{clientAcceptedResultNote(ticket.status === 'closed')}</p>}
  </> : null;

  // The decision the client owes leads the page; everything else about the request sits in the side column.
  const decision = needsAction ? scopeDecision ? planBody : resultBody : null;
  const railPlan = decision === planBody ? null : planBody;
  const railResult = decision === resultBody ? null : resultBody;
  const whatNext = clientWhatNext({ status: ticket.status, requestedAction });
  const history = requestHistory(ticket, workflowActionsDisabled);

  // Milestones sit in the conversation at their dates, after whatever history is loaded.
  const firstLoaded = messages[0]?.createdAt;
  const updates: TicketChatMessage[] = history.slice(1)
    .filter(event => !messageCursor || !firstLoaded || Date.parse(event.at) >= Date.parse(firstLoaded))
    .map(event => ({ id: 'update:' + event.label, author: 'system', body: event.label, createdAt: event.at }));
  const feed = [...messages, ...updates].sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt));
  const unread = useUnreadCount(ticket.id, messages);

  return <section className="cx-request" aria-labelledby="client-request-title">
    <div className="cx-reqsplit">
      <aside className="cx-reqrail" aria-label="About this request">
        <div className="cx-reqrail-top">
          <button type="button" className="cx-back" onClick={onBack} disabled={busy}><ArrowLeft size={15} aria-hidden="true" />{backLabel}</button>
          <section className="cx-reqcard cx-reqhead">
            <div className="cx-reqhead-top">
              <span className="cx-reqhead-icon" aria-hidden="true"><FileText size={24} /></span>
              <div className="cx-reqhead-copy">
                <h1 id="client-request-title">{ticket.title}</h1>
                <p>{ticket.sharedProjectName ?? 'Not linked to a project yet'}</p>
                <p>Created {calendarDayOf(ticket.createdAt)}</p>
              </div>
            </div>
            <CxBadge tone={requestTone(ticket.status, requestedAction)}>{progress.statusLabel}</CxBadge>
            <p className="cx-request-summary">{progress.description}</p>
            {!newRequestsDisabled && <button onClick={onAdditionalWork} disabled={busy || workflowActionsDisabled} className="cx-button">Request additional work</button>}
          </section>
          {progressSteps.length > 0 && <RailCard icon={<Activity size={16} />} title="Request progress"><ClientProgressStrip steps={progressSteps} /></RailCard>}
          {whatNext && <RailCard icon={<CornerDownRight size={16} />} title="What happens next"><p className="cx-request-copy">{whatNext}</p></RailCard>}
        </div>
        <div className="cx-reqrail-more">
          {railPlan && <RailCard icon={<ShieldCheck size={16} />} title="The plan">{railPlan}</RailCard>}
          {railResult && <RailCard icon={<CheckCircle2 size={16} />} title="Your result">{railResult}</RailCard>}
          <RailCard icon={<MessageSquareText size={16} />} title="What you asked for"><p className="cx-request-copy">{ticket.description}</p></RailCard>
          {communicationEnabled && <div ref={filesRef} tabIndex={-1} className="cx-reqcard cx-request-files">
            <TicketDocumentsPanel api={documentsApi} scope={workspaceId} ticketId={ticket.id} canUpload={!terminal} heading="Files" />
          </div>}
          <RailCard icon={<Info size={16} />} title="Request details">
            <dl className="cx-details">
              <div><dt>Project</dt><dd>{ticket.sharedProjectName ?? 'Not linked yet'}</dd></div>
              <div><dt>Created on</dt><dd>{calendarDayOf(ticket.createdAt)}</dd></div>
              {ticket.request?.requestedDeadline && <div><dt>Hoped-for date</dt><dd>{calendarDay(ticket.request.requestedDeadline)} · not guaranteed</dd></div>}
              <div><dt>Last update</dt><dd>{time(ticket.updatedAt)}</dd></div>
              <div><dt>Project manager</dt><dd><span className="cx-details-pm" aria-hidden="true"><UserRound size={12} /></span>Your project manager</dd></div>
              <div><dt>Reference</dt><dd className="cx-request-reference"><code>{ticket.reference}</code>
                <button type="button" onClick={copyReference} aria-label="Copy request reference" className="cx-icon-button">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
                {copied && <span role="status" className="cx-request-note">Copied</span>}</dd></div>
            </dl>
            {ticket.sharedProjectPreviewUrl && <a href={ticket.sharedProjectPreviewUrl} target="_blank" rel="noreferrer" onClick={() => setPreviewOpenedKey(deliveryKey)} className="cx-link cx-request-preview">Open hosted preview <ExternalLink size={12} /></a>}
            {ticket.relatedTicket && <p className="cx-request-note">Related request: {ticket.relatedTicket.reference} · {ticket.relatedTicket.title}</p>}
          </RailCard>
        </div>
      </aside>

      <section className="cx-reqchat" aria-labelledby="client-conversation-title">
        <header className="cx-reqchat-head">
          <span className="cx-reqchat-icon" aria-hidden="true"><MessagesSquare size={22} /></span>
          <div><h2 id="client-conversation-title">Request conversation</h2><p>Private messages between you and your project manager.</p></div>
          {unread > 0 && <span className="cx-new-pill" role="status">{unread === 1 ? '1 new message' : unread + ' new messages'}</span>}
        </header>
        {error && <p role="alert" className="cx-error">{error}</p>}
        {decision && <section className="client-decision-slot cx-panel is-attention cx-decision" aria-labelledby="client-decision-title">
          <h2 id="client-decision-title">{'Action needed: ' + progress.label}</h2>
          {decision}
        </section>}
        <TicketChat
          role="client"
          messages={feed}
          clientInitial={clientInitial}
          title="Conversation"
          subtitle="Private messages between you and your project manager"
          showHeader={false}
          historyError={historyError}
          messageCursor={messageCursor}
          historyLoading={historyLoading}
          onLoadMore={onLoadMore}
          showFeed={showConversationFeed}
          unavailableTitle="About this conversation"
          unavailableDescription="The conversation and result review are not available for this request yet. Try again later or contact your project manager."
          emptyTitle="No messages yet"
          emptyDescription="Send a note below if you have a question or an update."
          draft={body}
          onDraftChange={setBody}
          onSubmit={submitReply}
          canCompose={canReply}
          busy={busy}
          writesAvailable={canReply}
          inputId="client-ticket-reply"
          placeholder="Message your project manager…"
          sendAriaLabel="Send reply"
          composerClassName="client-reply-form"
          composerNote="Enter sends · Shift + Enter starts a new line."
          submitOnEnter
          readOnlyLabel={terminal ? 'This request is closed. You can still read its history.' : 'This request is view-only right now.'}
          leadingAction={communicationEnabled && !terminal ? <span className="ticket-chat__leading"><Button type="button" variant="outline" size="icon" onClick={showFiles} aria-label="Go to files"><Paperclip size={17} /></Button></span> : undefined}
        />
      </section>
    </div>

    {!workflowActionsDisabled && confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirming(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="client-ticket-confirm-title" className="w-full max-w-md rounded-xl border border-divider bg-surface p-5 shadow-2xl">
        <h2 id="client-ticket-confirm-title" className="text-base font-semibold text-content">{confirming.type === 'accept_delivery' ? 'Accept this result?' : 'Approve this plan?'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">{confirming.type === 'accept_delivery' ? 'This finishes the request. Nothing more is needed from you.' : 'Your project manager will then start the work.'}</p>
        <div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirming(null)} disabled={busy} className={secondary + ' min-h-[44px]'}>Cancel</button><button onClick={() => {
          if (confirming.type === 'accept_delivery' && (!canReview || !reviewAcknowledged || confirming.deliveryId !== ticket.delivery?.id)) return;
          if (confirming.type === 'agree_scope' && confirming.scopeVersionId !== ticket.scope?.id) return;
          onDecision(confirming); setConfirming(null);
        }} disabled={busy || (confirming.type === 'accept_delivery' && (!canReview || !reviewAcknowledged))} className={primary + ' min-h-[44px]'}>{confirming.type === 'accept_delivery' ? 'Accept result' : 'Approve plan'}</button></div>
      </section>
    </div>}
  </section>;
}

function RailCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="cx-reqcard"><h2><span aria-hidden="true">{icon}</span>{title}</h2>{children}</section>;
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
