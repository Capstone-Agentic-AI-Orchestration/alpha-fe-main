import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronUp, Clock3, Copy, ExternalLink, FileText, FolderKanban, LockKeyhole, MessageSquare, Paperclip, Send, ShieldCheck, User } from 'lucide-react';

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
import { clientProgressSteps } from './clientProgressSteps';
import { ClientProgressStrip } from './ClientProgressStrip';
import { ChatContextPanel } from './ChatContextPanel';

type Decision = Extract<ClientTicketCommandInput['command'], { type: 'agree_scope' | 'accept_delivery' }>;
export type ClientTicketTab = 'conversation' | 'details' | 'documents';

const dayKey = (value: string) => new Date(value).toDateString();
const dayLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
const clockTime = (value: string) => new Date(value).toLocaleTimeString(undefined, { timeStyle: 'short' });

export function ClientTicketDetail({
  workspaceId, ticket, messages, messageCursor, historyLoading, historyError, busy, error, replyResetVersion,
  onBack, onLoadMore, onReply, onDecision, onAdditionalWork, onCorrection, api = clientTicketApi,
  documentsApi = clientTicketDocumentsApi, workflowActionsDisabled = false, newRequestsDisabled = true, communicationEnabled = false,
  defaultTab = 'conversation', readOnlyPreview = false,
}: {
  workspaceId: string;
  api?: typeof clientTicketApi;
  documentsApi?: TicketDocumentsApi;
  workflowActionsDisabled?: boolean;
  newRequestsDisabled?: boolean;
  communicationEnabled?: boolean;
  defaultTab?: ClientTicketTab;
  /** Show fictional history in the development preview, with every reply disabled. */
  readOnlyPreview?: boolean;
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
  const [tab, setTab] = useState<ClientTicketTab>(defaultTab);
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [inspectedKey, setInspectedKey] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionBody, setCorrectionBody] = useState('');
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [previewOpenedKey, setPreviewOpenedKey] = useState('');
  const [scopeChangeOpen, setScopeChangeOpen] = useState(false);
  const [scopeChangeBody, setScopeChangeBody] = useState('');
  const [progressOpen, setProgressOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const deliveryKey = clientDeliveryReviewKey(ticket);
  const inspected = useCallback((verified: boolean) => {
    setInspectedKey(verified ? deliveryKey : ''); setReviewAcknowledged(false); setConfirming(null);
  }, [deliveryKey]);
  const canReview = canReviewClientDelivery(ticket, clientReviewEvidenceKey(inspectedKey, previewOpenedKey, deliveryKey));
  const terminal = ticket.status === 'closed' || ticket.status === 'declined' || ticket.status === 'cancelled';
  const canReply = !readOnlyPreview && (communicationEnabled ? !terminal : ticket.writesAvailable && !ticket.readOnly);
  const progress = clientTicketProgress(ticket.status, workflowActionsDisabled ? null : ticket.requestedAction);
  const progressSteps = clientProgressSteps(workflowActionsDisabled ? { ...ticket, requestedAction: null } : ticket);
  const scopeDecision = ticket.requestedAction === 'agree_scope' && ticket.scope && !ticket.scope.agreed
    ? { type: 'agree_scope' as const, scopeVersionId: ticket.scope.id } : null;
  const awaitingResultReview = ticket.requestedAction === 'review_result' && Boolean(ticket.delivery) && !ticket.delivery?.accepted;
  const needsAction = !workflowActionsDisabled && (Boolean(scopeDecision) || awaitingResultReview);
  const clientInitial = (ticket.companyLabel?.trim()[0] ?? 'Y').toUpperCase();
  const showConversationFeed = readOnlyPreview || !(workflowActionsDisabled && !communicationEnabled);

  useEffect(() => { setBody(''); }, [replyResetVersion]);
  useEffect(() => { setCorrectionBody(''); setCorrectionOpen(false); setConfirming(null); setReviewAcknowledged(false); }, [deliveryKey]);
  useEffect(() => { setScopeChangeBody(''); setScopeChangeOpen(false); }, [ticket.scope?.id]);
  useEffect(() => { if (!canReview) { setConfirming(null); setReviewAcknowledged(false); } }, [canReview]);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length]);
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
      setScopeChangeBody(''); setScopeChangeOpen(false); setTab('conversation');
    } catch {
      // Keep the draft while the original operation is reconciled.
    }
  }

  function copyReference() {
    void navigator.clipboard?.writeText(ticket.reference).then(() => setCopied(true)).catch(() => undefined);
  }

  const tabs: Array<{ id: ClientTicketTab; label: string; icon: React.ReactNode }> = [
    { id: 'conversation', label: 'Overview', icon: <MessageSquare size={14} /> },
    { id: 'details', label: 'Details', icon: <FileText size={14} /> },
    ...(communicationEnabled ? [{ id: 'documents' as const, label: 'Documents', icon: <Paperclip size={14} /> }] : []),
  ];
  const panelScroll = 'client-detail-panel';

  return <section className="client-ticket-detail">
    <header className="client-detail-header">
      <button onClick={onBack} disabled={busy} className="client-detail-back"><ArrowLeft size={15} />Back to requests</button>
      <div className="client-detail-title-row">
        <div className="min-w-0">
          <h2 className="client-detail-title">{ticket.title}</h2>
          <div className="client-detail-reference-row">
            <span className="client-detail-reference">{ticket.reference}</span>
            <button type="button" onClick={copyReference} aria-label="Copy request reference" className="client-copy-reference">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            {copied && <span role="status" className="client-copied-note">Copied</span>}
          </div>
          <p className="client-detail-date">Created {time(ticket.createdAt)} <span aria-hidden="true">·</span> Updated {time(ticket.updatedAt)}</p>
        </div>
        <div className="client-detail-heading-actions">
          <Status status={ticket.status} label={progress.statusLabel} />
          {needsAction && canReply && tab !== 'details' && <button type="button" onClick={() => setTab('details')} className="client-header-review">{scopeDecision ? 'Review proposed work' : 'Review result'}</button>}
          {!newRequestsDisabled && <button onClick={onAdditionalWork} disabled={busy || workflowActionsDisabled} className={`${secondary} min-h-[44px]`}>Request additional work</button>}
        </div>
      </div>
    </header>


    {error && <p role="alert" className="client-detail-error">{error}</p>}



    <div className="client-detail-content role-chat-layout">
      <div className="client-chat-main">
      <section role="region" aria-label="Conversation"
        className="flex client-conversation">
        <p className="sr-only">Private messages between you and your project manager</p>
        {showConversationFeed ? <div ref={scroller} className="client-conversation-feed" aria-label="Messages, oldest first" aria-live="polite">
          {historyError && <p role="alert" className="client-detail-error">{historyError}</p>}
          {messages.length === 0 ? <p className="client-no-messages">No messages yet. Send a message below if you have a question.</p> : messages.map((message, index) => {
            const mine = message.author === 'client';
            const newDay = index === 0 || dayKey(message.createdAt) !== dayKey(messages[index - 1].createdAt);
            return <Fragment key={message.id}>
              {newDay && <div className="client-message-day"><span>{dayLabel(message.createdAt)}</span></div>}
              <article className={`client-message ${mine ? 'is-mine' : 'is-theirs'}`}>
                <span aria-hidden="true" className="client-message-avatar">{mine ? clientInitial : <User size={16} />}</span>
                <div className="client-message-bubble">
                  <span className="client-message-author">{mine ? 'You' : 'Project Manager'}</span>
                  <p>{message.body}</p>
                  <time dateTime={message.createdAt}>{clockTime(message.createdAt)}</time>
                </div>
              </article>
            </Fragment>;
          })}
          {messageCursor && <button onClick={onLoadMore} disabled={historyLoading} className="client-load-messages">{historyLoading ? 'Loading…' : 'Load earlier messages'}</button>}
        </div> : <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h3 className="text-sm font-medium text-content">About this conversation</h3>
          <p className="mt-2 text-xs leading-relaxed text-content-secondary">The conversation and result review are not available for this request yet. Try again later or contact your project manager.</p>
        </div>}
        {showConversationFeed && (canReply ? <form onSubmit={submitReply} className="client-reply-form">
          <label className="sr-only" htmlFor="client-ticket-reply">Message to your project manager</label>
          <div className="client-reply-controls">
            {communicationEnabled && !terminal && <button type="button" onClick={() => setTab('documents')} aria-label="Open documents" className="client-attach-button"><Paperclip size={17} /></button>}
            <textarea id="client-ticket-reply" value={body} onChange={event => setBody(event.target.value)} disabled={busy} maxLength={4000} rows={1} placeholder="Write a message…"
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <button type="submit" aria-label="Send reply" disabled={busy || !body.trim()} className="client-send-reply"><Send size={15} /><span>Send</span></button>
          </div>
          <p className="client-reply-note">Only you and your project manager can see this. Enter sends · Shift + Enter starts a new line.</p>
        </form> : <p className="shrink-0 border-t border-divider px-4 py-3 text-center text-xs text-content-secondary">{terminal ? 'This request is closed. You can still read its history.' : 'This request is view-only right now.'}</p>)}
      </section>


      </div>
      <ChatContextPanel label="Project overview" activeSection={tab} onClose={() => setTab('conversation')}>
    <div role="tablist" aria-label="Request sections" className="client-detail-tabs role-chat-tools">
      {tabs.map(item => <button key={item.id} role="tab" id={`client-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`client-panel-${item.id}`}
        onClick={() => setTab(item.id)}
        className={`client-detail-tab ${tab === item.id ? 'is-active' : ''}`}>{item.icon}{item.label}</button>)}
    </div>
      <div className={`client-other-panels ${tab === 'conversation' ? 'hidden' : ''}`}>
        <section role="tabpanel" id="client-panel-details" aria-labelledby="client-tab-details" className={`${tab === 'details' ? 'block' : 'hidden'} ${panelScroll}`}>
          <h2 className="sr-only">Request details</h2>
          <div className="grid gap-5">
            <InfoCard title="Your request" icon={<FileText size={14} />}>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-content-secondary">{ticket.description}</p>
              {ticket.request?.requestedDeadline && <p className="mt-3 text-xs text-content-secondary">Requested date: {ticket.request.requestedDeadline} · not guaranteed</p>}
            </InfoCard>
            <InfoCard title="Shared project" icon={<FolderKanban size={14} />}>
              {ticket.sharedProjectName ? <><p className="text-xs font-medium text-content">{ticket.sharedProjectName}</p><p className="mt-1 text-xs leading-relaxed text-content-secondary">This is a limited project preview. Private project work and files are not shown here.</p>
                {ticket.sharedProjectPreviewUrl && <div className="mt-3 rounded-lg border border-divider p-3"><a href={ticket.sharedProjectPreviewUrl} target="_blank" rel="noreferrer" onClick={() => setPreviewOpenedKey(deliveryKey)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-link hover:bg-surface-high hover:text-link-hover">Open hosted project preview <ExternalLink size={12} /></a><p className="mt-1.5 text-xs leading-relaxed text-status-warning">This opens the hosted site. Anyone with the link may be able to see it. It does not open your private Alphaexplora requests.</p></div>}</>
                : <p className="text-xs leading-relaxed text-content-secondary">Your project manager has not shared a project preview for this request yet. They will update you here if that changes.</p>}
              {ticket.relatedTicket && <p className="mt-3 text-xs leading-relaxed text-content-secondary">Related request: {ticket.relatedTicket.reference} · {ticket.relatedTicket.title}</p>}
            </InfoCard>
            {!workflowActionsDisabled && ticket.scope && <InfoCard title="Agreed work" icon={<ShieldCheck size={14} />}>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-content-secondary">{ticket.scope.summary}</p>
              <p className="mt-2 text-xs text-content-secondary">{ticket.scope.agreed ? 'You agreed to this work.' : 'Waiting for your decision.'}</p>
              {scopeDecision && canReply && <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => { setScopeChangeOpen(false); setConfirming(scopeDecision); }} disabled={busy} className={`${primary} min-h-[44px]`}><CheckCircle2 size={14} />Agree to proposed work</button>
                <button onClick={() => { setConfirming(null); setScopeChangeOpen(value => !value); }} disabled={busy} className={`${secondary} min-h-[44px]`}>{scopeChangeOpen ? 'Cancel' : 'Request changes'}</button>
              </div>}
              {scopeDecision && canReply && scopeChangeOpen && <form className="mt-3 space-y-2" onSubmit={submitScopeChange}>
                <label htmlFor="client-scope-change" className="block text-xs text-content-secondary">What would you like changed about this proposed work?</label>
                <textarea id="client-scope-change" rows={3} maxLength={SCOPE_CHANGE_MAX_LENGTH} disabled={busy} value={scopeChangeBody} onChange={event => setScopeChangeBody(event.target.value)} className={input} />
                <p className="text-xs leading-relaxed text-content-secondary">Sent to your project manager in this request’s conversation. Nothing is agreed yet. They can reply or send you an updated proposal.</p>
                <button type="submit" disabled={busy || !scopeChangeText} className={`${primary} min-h-[44px]`}><Send size={13} />Send to my project manager</button>
              </form>}
            </InfoCard>}
            {!workflowActionsDisabled && ticket.delivery && <InfoCard title="Result summary" icon={<CheckCircle2 size={14} />}>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-content-secondary">{ticket.delivery.summary}</p>
              <p className="mt-2 text-[10px] text-content-muted">Shared {time(ticket.delivery.sharedAt)}{ticket.delivery.accepted ? ' · accepted' : ''}</p>
              <ClientDeliveryFiles key={JSON.stringify([workspaceId, ticket.id, ticket.delivery.id, ticket.delivery.scopeVersionId])}
                workspaceId={workspaceId} ticketId={ticket.id} deliveryId={ticket.delivery.id} scopeVersionId={ticket.delivery.scopeVersionId} onInspectionChange={inspected} api={api} />
              {!ticket.delivery.accepted && !canReview && <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-status-warning"><LockKeyhole size={12} className="mt-0.5 shrink-0" />{clientReviewLockMessage(Boolean(ticket.sharedProjectPreviewUrl))}</p>}
              {canReview && <div className="mt-3 space-y-3">
                <label className="flex items-start gap-2 text-[11px] leading-relaxed text-content-secondary"><input type="checkbox" checked={reviewAcknowledged} disabled={busy} onChange={event => setReviewAcknowledged(event.target.checked)} className="mt-0.5 accent-violet-500" />I reviewed the shared result against the agreed work.</label>
                <div className="flex flex-wrap gap-2"><button disabled={busy || !reviewAcknowledged} onClick={() => { setCorrectionOpen(false); setConfirming({ type: 'accept_delivery', deliveryId: ticket.delivery!.id }); }} className={`${primary} min-h-[44px]`}>Accept result</button>
                  <button disabled={busy} onClick={() => { setConfirming(null); setCorrectionOpen(value => !value); }} className={`${secondary} min-h-[44px]`}>{correctionOpen ? 'Cancel feedback' : 'Needs a fix'}</button></div>
                {correctionOpen && <form className="space-y-2" onSubmit={async event => {
                  event.preventDefault(); if (!canReview || busy || !correctionBody.trim()) return;
                  try { await onCorrection(correctionBody.trim(), ticket.delivery!.id); setCorrectionBody(''); setCorrectionOpen(false); }
                  catch { /* Preserve this draft while the original operation is reconciled. */ }
                }}><label htmlFor="client-result-feedback" className="block text-[11px] text-content-secondary">What does not match the agreed work?</label>
                  <textarea id="client-result-feedback" rows={3} maxLength={4000} disabled={busy} value={correctionBody} onChange={event => setCorrectionBody(event.target.value)} className={input} />
                  <p className="text-xs leading-relaxed text-content-secondary">Your project manager will review your feedback and let you know the next step.</p>
                  <button type="submit" disabled={busy || !correctionBody.trim()} className={`${primary} min-h-[44px]`}>Send correction feedback</button></form>}
              </div>}
              {ticket.delivery.accepted && <p className="mt-2 text-xs text-content-secondary">{clientAcceptedResultNote(ticket.status === 'closed')}</p>}
              {!ticket.delivery.accepted && <p className="mt-2 text-xs text-content-secondary">Use this request’s conversation to discuss the result with your project manager.</p>}
            </InfoCard>}
          </div>
        </section>

        {communicationEnabled && <section role="tabpanel" id="client-panel-documents" aria-labelledby="client-tab-documents" className={`${tab === 'documents' ? 'block' : 'hidden'} ${panelScroll}`}>
          <TicketDocumentsPanel api={documentsApi} scope={workspaceId} ticketId={ticket.id}
            canUpload={!terminal} heading="Documents for this request" />
        </section>}
      </div>
        <div role="tabpanel" id="client-panel-conversation" aria-labelledby="client-tab-conversation" hidden={tab !== 'conversation'}>
    <section aria-live="polite" className={`client-detail-status client-sidebar-progress ${needsAction ? 'needs-action' : ''} ${progressOpen ? 'is-open' : 'is-collapsed'}`}>
      <div className="client-detail-status-head">
        <div className="client-detail-status-copy">
        <span className="client-detail-status-icon"><Clock3 size={16} /></span>
          <div><span className="client-detail-status-eyebrow">Current request status</span><h2>{needsAction ? `Action needed: ${progress.label}` : progress.label}</h2><p>{progress.description}</p></div>
        </div>
        <div className="client-detail-status-actions">
          {needsAction && canReply && tab !== 'details' && <button type="button" onClick={() => setTab('details')} className={`${primary} min-h-[44px] client-review-action`}>{scopeDecision ? 'Review proposed work' : 'Review result'}</button>}
          {progressSteps.length > 0 && <button type="button" className="client-detail-status-toggle" aria-expanded={progressOpen} aria-controls="client-request-progress" onClick={() => setProgressOpen(value => !value)}>
            <span>{progressOpen ? 'Hide progress' : 'Show progress'}</span>{progressOpen ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
          </button>}
        </div>
      </div>
      {progressSteps.length > 0 && <div id="client-request-progress" hidden={!progressOpen} className="client-detail-progress"><ClientProgressStrip steps={progressSteps} /></div>}
    </section>
        <section className="role-chat-context__section"><h3>Your request</h3><p>{ticket.description}</p><small>Created {time(ticket.createdAt)}</small>
          {ticket.request?.requestedDeadline && <small>Requested date: {ticket.request.requestedDeadline} · not guaranteed</small>}
        </section>
        <section className="role-chat-context__section"><h3>Shared project</h3><p>{ticket.sharedProjectName ?? 'Your project manager will share project updates here.'}</p>
          <button type="button" className="role-chat-context__link" onClick={() => setTab('details')}><FolderKanban size={15} />View request details</button>
        </section>
        {communicationEnabled && <section className="role-chat-context__section"><h3>Shared files</h3><p>Documents shared on this request.</p><button type="button" className="role-chat-context__link" onClick={() => setTab('documents')}><Paperclip size={15} />Open documents</button></section>}
        <section className="role-chat-context__section"><h3>Your project manager</h3><p>Send questions and updates in this conversation.</p><small><LockKeyhole size={12} className="inline" /> Private between you and your project manager</small></section>
        </div>
      </ChatContextPanel>
    </div>

    {!workflowActionsDisabled && confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirming(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="client-ticket-confirm-title" className="w-full max-w-md rounded-xl border border-divider bg-surface p-5 shadow-2xl">
        <h2 id="client-ticket-confirm-title" className="text-base font-semibold text-content">{confirming.type === 'accept_delivery' ? 'Accept this exact result?' : 'Agree to this proposed work?'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">{confirming.type === 'accept_delivery' ? 'This records that you accept the shared result. Your project manager will close the request afterwards, and you do not need to do anything else.' : 'This records your agreement to the proposed work. Your project manager still needs to approve and schedule it before work begins.'}</p>
        <div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirming(null)} disabled={busy} className={`${secondary} min-h-[44px]`}>Cancel</button><button onClick={() => {
          if (confirming.type === 'accept_delivery' && (!canReview || !reviewAcknowledged || confirming.deliveryId !== ticket.delivery?.id)) return;
          if (confirming.type === 'agree_scope' && confirming.scopeVersionId !== ticket.scope?.id) return;
          onDecision(confirming); setConfirming(null);
        }} disabled={busy || (confirming.type === 'accept_delivery' && (!canReview || !reviewAcknowledged))} className={`${primary} min-h-[44px]`}>{confirming.type === 'accept_delivery' ? 'Confirm acceptance' : 'Confirm agreement'}</button></div>
      </section>
    </div>}
  </section>;
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <article className="client-detail-card"><h2>{icon}{title}</h2>{children}</article>;
}

function Status({ status, label }: { status: ClientTicketRecord['status']; label: string }) {
  const tone = status === 'closed' ? 'is-complete'
    : status === 'ready_for_review' || status === 'awaiting_client' ? 'is-waiting'
      : status === 'in_progress' ? 'is-active'
        : status === 'declined' || status === 'cancelled' ? 'is-ended' : 'is-neutral';
  return <span className={`client-status ${tone}`}>{label}</span>;
}
