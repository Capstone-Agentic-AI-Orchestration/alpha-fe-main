import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Clock3, Copy, ExternalLink, FileText, FolderKanban, LockKeyhole, MessageSquare, Paperclip, Send, ShieldCheck, User } from 'lucide-react';

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

type Decision = Extract<ClientTicketCommandInput['command'], { type: 'agree_scope' | 'accept_delivery' }>;
export type ClientTicketTab = 'conversation' | 'details' | 'documents';

const dayKey = (value: string) => new Date(value).toDateString();
const dayLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
const clockTime = (value: string) => new Date(value).toLocaleTimeString(undefined, { timeStyle: 'short' });

export function ClientTicketDetail({
  workspaceId, ticket, messages, messageCursor, historyLoading, historyError, busy, error, replyResetVersion,
  onBack, onLoadMore, onReply, onDecision, onAdditionalWork, onCorrection, api = clientTicketApi,
  documentsApi = clientTicketDocumentsApi, workflowActionsDisabled = false, newRequestsDisabled = true, communicationEnabled = false,
  defaultTab = 'conversation',
}: {
  workspaceId: string;
  api?: typeof clientTicketApi;
  documentsApi?: TicketDocumentsApi;
  workflowActionsDisabled?: boolean;
  newRequestsDisabled?: boolean;
  communicationEnabled?: boolean;
  defaultTab?: ClientTicketTab;
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
  const scroller = useRef<HTMLDivElement>(null);
  const deliveryKey = clientDeliveryReviewKey(ticket);
  const inspected = useCallback((verified: boolean) => {
    setInspectedKey(verified ? deliveryKey : ''); setReviewAcknowledged(false); setConfirming(null);
  }, [deliveryKey]);
  const canReview = canReviewClientDelivery(ticket, clientReviewEvidenceKey(inspectedKey, previewOpenedKey, deliveryKey));
  const terminal = ticket.status === 'closed' || ticket.status === 'declined' || ticket.status === 'cancelled';
  const canReply = communicationEnabled ? !terminal : ticket.writesAvailable && !ticket.readOnly;
  const progress = clientTicketProgress(ticket.status, ticket.requestedAction);
  const scopeDecision = ticket.requestedAction === 'agree_scope' && ticket.scope && !ticket.scope.agreed
    ? { type: 'agree_scope' as const, scopeVersionId: ticket.scope.id } : null;
  const awaitingResultReview = ticket.requestedAction === 'review_result' && Boolean(ticket.delivery) && !ticket.delivery?.accepted;
  const needsAction = !workflowActionsDisabled && (Boolean(scopeDecision) || awaitingResultReview);
  const clientInitial = (ticket.companyLabel?.trim()[0] ?? 'Y').toUpperCase();
  const showConversationFeed = !(workflowActionsDisabled && !communicationEnabled);

  useEffect(() => { setBody(''); }, [replyResetVersion]);
  useEffect(() => { setCorrectionBody(''); setCorrectionOpen(false); setConfirming(null); setReviewAcknowledged(false); }, [deliveryKey]);
  useEffect(() => { setScopeChangeBody(''); setScopeChangeOpen(false); }, [ticket.scope?.id]);
  useEffect(() => { if (!canReview) { setConfirming(null); setReviewAcknowledged(false); } }, [canReview]);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, tab]);
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
    { id: 'conversation', label: 'Conversation', icon: <MessageSquare size={14} /> },
    { id: 'details', label: 'Details', icon: <FileText size={14} /> },
    ...(communicationEnabled ? [{ id: 'documents' as const, label: 'Documents', icon: <Paperclip size={14} /> }] : []),
  ];
  const panelScroll = 'min-h-0 flex-1 overflow-y-auto 2xl:flex-none 2xl:overflow-visible';

  return <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <header className="shrink-0 px-4 pt-4 md:px-6 md:pt-5">
      <button onClick={onBack} disabled={busy} className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 xl:hidden"><ArrowLeft size={14} />Back to tickets</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold text-white">{ticket.title}</h1>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="break-all font-mono text-xs text-gray-500">{ticket.reference}</span>
            <button type="button" onClick={copyReference} aria-label="Copy ticket reference" className="rounded p-1 text-gray-500 hover:bg-white/[0.06] hover:text-gray-200">{copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}</button>
            {copied && <span role="status" className="text-[10px] text-emerald-300">Copied</span>}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Created {time(ticket.createdAt)} · Updated {time(ticket.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Status status={ticket.status} />
          {!newRequestsDisabled && <button onClick={onAdditionalWork} disabled={busy || workflowActionsDisabled} className={secondary}>Request additional work</button>}
        </div>
      </div>
    </header>

    {!workflowActionsDisabled && <section aria-live="polite" className={`mx-4 mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border p-3 md:mx-6 ${needsAction ? 'border-amber-400/25 bg-amber-500/[0.07]' : 'border-brand-400/15 bg-brand-500/[0.06]'}`}>
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Clock3 size={15} className={`mt-0.5 shrink-0 ${needsAction ? 'text-amber-200' : 'text-brand-200'}`} />
        <div><h2 className={`text-xs font-semibold ${needsAction ? 'text-amber-100' : 'text-brand-100'}`}>{needsAction ? 'Action needed: ' : ''}{progress.label}</h2><p className="mt-1 hidden text-xs leading-relaxed text-gray-300 md:block">{progress.description}</p></div>
      </div>
      {needsAction && canReply && tab !== 'details' && <button onClick={() => setTab('details')} className={`${primary} 2xl:hidden`}>{scopeDecision ? 'Review scope' : 'Review result'}</button>}
      <div className="basis-full"><ClientProgressStrip steps={clientProgressSteps(ticket)} /></div>
    </section>}

    {error && <p role="alert" className="mx-4 mt-3 shrink-0 rounded-md border border-rose-400/20 bg-rose-500/[0.06] p-2.5 text-xs text-rose-200 md:mx-6">{error}</p>}

    <div role="tablist" aria-label="Ticket sections" className="mt-4 flex shrink-0 gap-1 border-b border-white/[0.07] px-4 md:px-6 2xl:hidden">
      {tabs.map(item => <button key={item.id} role="tab" id={`client-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`client-panel-${item.id}`}
        onClick={() => setTab(item.id)}
        className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${tab === item.id ? 'border-brand-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-200'}`}>{item.icon}{item.label}</button>)}
    </div>

    <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6 2xl:mt-2 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-rows-[minmax(0,1fr)] 2xl:gap-4">
      <section role="tabpanel" id="client-panel-conversation" aria-labelledby="client-tab-conversation"
        className={`${tab === 'conversation' ? 'flex' : 'hidden 2xl:flex'} min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-well/60`}>
        <h2 className="sr-only">Conversation with your project manager</h2>
        {showConversationFeed ? <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {historyError && <p role="alert" className="rounded-md border border-rose-400/20 bg-rose-500/[0.06] p-2 text-[11px] text-rose-200">{historyError}</p>}
          {messages.length === 0 ? <p className="py-10 text-center text-xs text-gray-600">No messages yet. Write to your project manager below.</p> : messages.map((message, index) => {
            const mine = message.author === 'client';
            const newDay = index === 0 || dayKey(message.createdAt) !== dayKey(messages[index - 1].createdAt);
            return <Fragment key={message.id}>
              {newDay && <div className="flex justify-center py-1"><span className="rounded-full bg-white/[0.05] px-3 py-1 text-[10px] text-gray-400">{dayLabel(message.createdAt)}</span></div>}
              <article className={`flex items-end gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600/80 text-xs font-semibold text-on-accent">{mine ? clientInitial : <User size={15} />}</span>
                <div className={`max-w-[85%] rounded-xl border px-3.5 py-2.5 ${mine ? 'border-brand-400/20 bg-brand-500/[0.12]' : 'border-white/[0.07] bg-white/[0.03]'}`}>
                  <span className="text-[10px] text-gray-400">{mine ? 'You' : 'Project Manager'}</span>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-100">{message.body}</p>
                  <time dateTime={message.createdAt} className="mt-1 block text-right text-[10px] text-gray-500">{clockTime(message.createdAt)}</time>
                </div>
              </article>
            </Fragment>;
          })}
          {messageCursor && <button onClick={onLoadMore} disabled={historyLoading} className="mx-auto block rounded-md px-3 py-1.5 text-[11px] text-brand-300 hover:bg-white/[0.04] disabled:opacity-50">{historyLoading ? 'Loading…' : 'Load more messages'}</button>}
        </div> : <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h3 className="text-sm font-medium text-gray-100">Ticket communication</h3>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">Your account is active and this ticket is visible to you. Ticket messages and result review will be enabled in a later phase.</p>
        </div>}
        {showConversationFeed && (canReply ? <form onSubmit={submitReply} className="shrink-0 border-t border-white/[0.07] p-3">
          <label className="sr-only" htmlFor="client-ticket-reply">Message to your project manager</label>
          <div className="flex items-end gap-2">
            {communicationEnabled && !terminal && <button type="button" onClick={() => setTab('documents')} aria-label="Attach a document" className={`${secondary} h-11 w-11 shrink-0 px-0 2xl:hidden`}><Paperclip size={16} /></button>}
            <textarea id="client-ticket-reply" className={`${input} max-h-32 min-h-11 flex-1 resize-none`} value={body} onChange={event => setBody(event.target.value)} disabled={busy} maxLength={4000} rows={1} placeholder="Write a message…"
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <button type="submit" disabled={busy || !body.trim()} className={`${primary} h-11 shrink-0`}><Send size={14} />Send</button>
          </div>
          <p className="mt-1.5 text-[10px] text-gray-600">Visible to you and your project manager · Enter to send, Shift+Enter for a new line</p>
        </form> : <p className="shrink-0 border-t border-white/[0.07] px-4 py-3 text-center text-[11px] text-gray-500">{terminal ? 'This ticket is closed. Its history remains available.' : 'This ticket is currently read-only.'}</p>)}
      </section>

      <div className="contents 2xl:flex 2xl:min-h-0 2xl:flex-col 2xl:gap-3 2xl:overflow-y-auto">
        <section role="tabpanel" id="client-panel-details" aria-labelledby="client-tab-details" className={`${tab === 'details' ? 'block' : 'hidden 2xl:block'} ${panelScroll}`}>
          <h2 className="sr-only">Ticket details</h2>
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-1">
            <InfoCard title="Your request" icon={<FileText size={14} />}>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{ticket.description}</p>
              {ticket.request?.requestedDeadline && <p className="mt-3 text-[10px] text-gray-500">Requested date: {ticket.request.requestedDeadline} · not guaranteed</p>}
            </InfoCard>
            <InfoCard title="Shared project" icon={<FolderKanban size={14} />}>
              {ticket.sharedProjectName ? <><p className="text-xs font-medium text-gray-200">{ticket.sharedProjectName}</p><p className="mt-1 text-[10px] text-gray-500">Your PM shared this project name as a limited preview. Its Issues, files, and other requests remain private.</p>
                {ticket.sharedProjectPreviewUrl && <div className="mt-3 rounded-lg border border-white/[0.07] p-3"><a href={ticket.sharedProjectPreviewUrl} target="_blank" rel="noreferrer" onClick={() => setPreviewOpenedKey(deliveryKey)} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 hover:text-brand-200">Open hosted project preview <ExternalLink size={12} /></a><p className="mt-1.5 text-[10px] text-amber-200/70">This opens the hosted site. It may be publicly accessible to anyone with the link; it does not grant access to Alpha project data.</p></div>}</>
                : <p className="text-xs text-gray-500">No project name has been shared on this request yet. Your PM may link it to a project or handle it without developer work.</p>}
              {ticket.relatedTicket && <p className="mt-3 text-[10px] text-gray-500">Related request: {ticket.relatedTicket.reference} · {ticket.relatedTicket.title}</p>}
            </InfoCard>
            {!workflowActionsDisabled && ticket.scope && <InfoCard title="Agreed work" icon={<ShieldCheck size={14} />}>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{ticket.scope.summary}</p>
              <p className="mt-2 text-[10px] text-gray-500">{ticket.scope.agreed ? 'You agreed to this scope.' : 'Waiting for your decision.'}</p>
              {scopeDecision && canReply && <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => { setScopeChangeOpen(false); setConfirming(scopeDecision); }} disabled={busy} className={primary}><CheckCircle2 size={14} />Agree to scope</button>
                <button onClick={() => { setConfirming(null); setScopeChangeOpen(value => !value); }} disabled={busy} className={secondary}>{scopeChangeOpen ? 'Cancel' : 'Request changes'}</button>
              </div>}
              {scopeDecision && canReply && scopeChangeOpen && <form className="mt-3 space-y-2" onSubmit={submitScopeChange}>
                <label htmlFor="client-scope-change" className="block text-[11px] text-gray-400">What would you like changed in this scope?</label>
                <textarea id="client-scope-change" rows={3} maxLength={SCOPE_CHANGE_MAX_LENGTH} disabled={busy} value={scopeChangeBody} onChange={event => setScopeChangeBody(event.target.value)} className={input} />
                <p className="text-[10px] text-gray-500">Sent to your project manager in this ticket's conversation. Nothing is agreed yet. They can reply or send you an updated scope.</p>
                <button type="submit" disabled={busy || !scopeChangeText} className={primary}><Send size={13} />Send to my project manager</button>
              </form>}
            </InfoCard>}
            {!workflowActionsDisabled && ticket.delivery && <InfoCard title="Result summary" icon={<CheckCircle2 size={14} />}>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{ticket.delivery.summary}</p>
              <p className="mt-2 text-[10px] text-gray-500">Shared {time(ticket.delivery.sharedAt)}{ticket.delivery.accepted ? ' · accepted' : ''}</p>
              <ClientDeliveryFiles key={JSON.stringify([workspaceId, ticket.id, ticket.delivery.id, ticket.delivery.scopeVersionId])}
                workspaceId={workspaceId} ticketId={ticket.id} deliveryId={ticket.delivery.id} scopeVersionId={ticket.delivery.scopeVersionId} onInspectionChange={inspected} api={api} />
              {!ticket.delivery.accepted && !canReview && <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-200/70"><LockKeyhole size={12} className="mt-0.5 shrink-0" />{clientReviewLockMessage(Boolean(ticket.sharedProjectPreviewUrl))}</p>}
              {canReview && <div className="mt-3 space-y-3">
                <label className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-300"><input type="checkbox" checked={reviewAcknowledged} disabled={busy} onChange={event => setReviewAcknowledged(event.target.checked)} className="mt-0.5 accent-violet-500" />I reviewed the shared result against the agreed work.</label>
                <div className="flex flex-wrap gap-2"><button disabled={busy || !reviewAcknowledged} onClick={() => { setCorrectionOpen(false); setConfirming({ type: 'accept_delivery', deliveryId: ticket.delivery!.id }); }} className={primary}>Accept result</button>
                  <button disabled={busy} onClick={() => { setConfirming(null); setCorrectionOpen(value => !value); }} className={secondary}>{correctionOpen ? 'Cancel feedback' : 'Needs a fix'}</button></div>
                {correctionOpen && <form className="space-y-2" onSubmit={async event => {
                  event.preventDefault(); if (!canReview || busy || !correctionBody.trim()) return;
                  try { await onCorrection(correctionBody.trim(), ticket.delivery!.id); setCorrectionBody(''); setCorrectionOpen(false); }
                  catch { /* Preserve this draft while the original operation is reconciled. */ }
                }}><label htmlFor="client-result-feedback" className="block text-[11px] text-gray-400">What does not match the agreed work?</label>
                  <textarea id="client-result-feedback" rows={3} maxLength={4000} disabled={busy} value={correctionBody} onChange={event => setCorrectionBody(event.target.value)} className={input} />
                  <p className="text-[10px] text-gray-500">Sent in this ticket's conversation. The PM reviews the feedback before assigning a correction. Extra work needs a separate linked request.</p>
                  <button type="submit" disabled={busy || !correctionBody.trim()} className={primary}>Send correction feedback</button></form>}
              </div>}
              {ticket.delivery.accepted && <p className="mt-2 text-[10px] text-gray-500">{clientAcceptedResultNote(ticket.status === 'closed')}</p>}
              {!ticket.delivery.accepted && <p className="mt-2 text-[10px] text-gray-500">Use this ticket's conversation to discuss the result with your PM.</p>}
            </InfoCard>}
          </div>
        </section>

        {communicationEnabled && <section role="tabpanel" id="client-panel-documents" aria-labelledby="client-tab-documents" className={`${tab === 'documents' ? 'block' : 'hidden 2xl:block'} ${panelScroll}`}>
          <TicketDocumentsPanel api={documentsApi} scope={workspaceId} ticketId={ticket.id}
            canUpload={!terminal} heading="Documents for this ticket" />
        </section>}
      </div>
    </div>

    {!workflowActionsDisabled && confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirming(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="client-ticket-confirm-title" className="w-full max-w-md rounded-xl border border-white/10 bg-surface p-5 shadow-2xl">
        <h2 id="client-ticket-confirm-title" className="text-base font-semibold text-white">{confirming.type === 'accept_delivery' ? 'Accept this exact result?' : 'Agree to this scope?'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">{confirming.type === 'accept_delivery' ? 'This records that you accept the shared result. It does not deploy anything. Your project manager will close the request afterwards, and you do not need to do anything else.' : 'This records your agreement to the displayed work. The project manager still has to authorize and assign the work before development starts.'}</p>
        <div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirming(null)} disabled={busy} className={secondary}>Cancel</button><button onClick={() => {
          if (confirming.type === 'accept_delivery' && (!canReview || !reviewAcknowledged || confirming.deliveryId !== ticket.delivery?.id)) return;
          if (confirming.type === 'agree_scope' && confirming.scopeVersionId !== ticket.scope?.id) return;
          onDecision(confirming); setConfirming(null);
        }} disabled={busy || (confirming.type === 'accept_delivery' && (!canReview || !reviewAcknowledged))} className={primary}>{confirming.type === 'accept_delivery' ? 'Confirm acceptance' : 'Confirm agreement'}</button></div>
      </section>
    </div>}
  </section>;
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <article className="rounded-xl border border-white/[0.07] bg-surface p-4"><h2 className="mb-3 flex items-center gap-2 text-xs font-medium text-gray-300">{icon}{title}</h2>{children}</article>;
}

function Status({ status }: { status: ClientTicketRecord['status'] }) {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  const color = status === 'closed' ? 'text-emerald-300 bg-emerald-500/10'
    : status === 'ready_for_review' || status === 'awaiting_client' ? 'text-amber-300 bg-amber-500/10'
      : status === 'in_progress' ? 'text-brand-300 bg-brand-500/10'
        : status === 'declined' || status === 'cancelled' ? 'text-rose-300 bg-rose-500/10'
          : 'text-gray-300 bg-white/[0.06]';
  return <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${color}`}>{label}</span>;
}
