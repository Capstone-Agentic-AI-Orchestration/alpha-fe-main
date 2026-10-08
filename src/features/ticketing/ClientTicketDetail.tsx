import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, FileText, FolderKanban, LockKeyhole, MessageSquare, Send, ShieldCheck } from 'lucide-react';

import type {
  ClientTicketCommandInput, ClientTicketDetail as ClientTicketRecord,
  ClientTicketMessage,
} from './clientApi';
import { clientTicketApi } from './clientApi';
import { input, primary, secondary, time } from './ticketUi';
import { ClientDeliveryFiles } from './ClientDeliveryFiles';
import { canReviewClientDelivery, clientDeliveryReviewKey } from './clientReview';

type Decision = Extract<ClientTicketCommandInput['command'], { type: 'agree_scope' | 'accept_delivery' }>;

export function ClientTicketDetail({
  workspaceId, ticket, messages, messageCursor, historyLoading, historyError, busy, error, replyResetVersion,
  onBack, onLoadMore, onReply, onDecision, onAdditionalWork, onCorrection, api = clientTicketApi,
}: {
  workspaceId: string;
  api?: typeof clientTicketApi;
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
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [inspectedKey, setInspectedKey] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionBody, setCorrectionBody] = useState('');
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const deliveryKey = clientDeliveryReviewKey(ticket);
  const inspected = useCallback((verified: boolean) => {
    setInspectedKey(verified ? deliveryKey : ''); setReviewAcknowledged(false); setConfirming(null);
  }, [deliveryKey]);
  const canReview = canReviewClientDelivery(ticket, inspectedKey);
  const canReply = ticket.writesAvailable && !ticket.readOnly;
  const scopeDecision = ticket.requestedAction === 'agree_scope' && ticket.scope && !ticket.scope.agreed
    ? { type: 'agree_scope' as const, scopeVersionId: ticket.scope.id } : null;
  const terminal = ticket.status === 'closed' || ticket.status === 'declined' || ticket.status === 'cancelled';

  useEffect(() => { setBody(''); }, [replyResetVersion]);
  useEffect(() => { setCorrectionBody(''); setCorrectionOpen(false); setConfirming(null); setReviewAcknowledged(false); }, [deliveryKey]);
  useEffect(() => { if (!canReview) { setConfirming(null); setReviewAcknowledged(false); } }, [canReview]);

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

  return <section className="min-w-0 flex-1 overflow-y-auto p-4 md:p-7">
    <button onClick={onBack} disabled={busy} className="mb-5 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50"><ArrowLeft size={14} />My tickets</button>
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-gray-500">{ticket.reference}</span><Status status={ticket.status} /></div>
        <h1 className="mt-2 break-words text-xl font-semibold text-white">{ticket.title}</h1>
        <p className="mt-1 text-[11px] text-gray-500">Updated {time(ticket.updatedAt)}</p></div>
      <button onClick={onAdditionalWork} disabled={busy} className={secondary}>Request additional work</button>
    </header>

    {ticket.requestedAction && <div className="mb-4 flex items-start gap-2 rounded-lg border border-brand-400/15 bg-brand-500/[0.06] p-3 text-xs text-brand-200"><Clock3 size={14} className="mt-0.5 shrink-0" /><span>{ticket.requestedAction === 'reply' ? 'Your project manager needs a reply.' : ticket.requestedAction === 'agree_scope' ? 'Please review the proposed scope.' : 'Your PM shared a result. Download and review its protected files, then accept it or explain what needs fixing.'}</span></div>}

    <div className="grid gap-3 lg:grid-cols-2">
      <InfoCard title="Your request" icon={<FileText size={14} />}>
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{ticket.description}</p>
        {ticket.request?.requestedDeadline && <p className="mt-3 text-[10px] text-gray-500">Requested date: {ticket.request.requestedDeadline} · not guaranteed</p>}
      </InfoCard>
      <InfoCard title="Shared project" icon={<FolderKanban size={14} />}>
      {ticket.sharedProjectName ? <><p className="text-xs font-medium text-gray-200">{ticket.sharedProjectName}</p><p className="mt-1 text-[10px] text-gray-500">Shared by your project manager. A read-only project preview is not connected yet.</p></>
          : <p className="text-xs text-gray-500">No project has been shared on this ticket yet. Your PM will decide whether to link a project, propose a new one, or answer without development.</p>}
        {ticket.relatedTicket && <p className="mt-3 text-[10px] text-gray-500">Related request: {ticket.relatedTicket.reference} · {ticket.relatedTicket.title}</p>}
      </InfoCard>
      {ticket.scope && <InfoCard title="Agreed work" icon={<ShieldCheck size={14} />}>
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{ticket.scope.summary}</p>
        <p className="mt-2 text-[10px] text-gray-500">{ticket.scope.agreed ? 'You agreed to this scope.' : 'Waiting for your decision.'}</p>
        {scopeDecision && canReply && <button onClick={() => setConfirming(scopeDecision)} disabled={busy} className={`${primary} mt-3`}><CheckCircle2 size={14} />Agree to scope</button>}
      </InfoCard>}
      {ticket.delivery && <InfoCard title="Result summary" icon={<CheckCircle2 size={14} />}>
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{ticket.delivery.summary}</p>
        <p className="mt-2 text-[10px] text-gray-500">Shared {time(ticket.delivery.sharedAt)}{ticket.delivery.accepted ? ' · accepted' : ''}</p>
        <ClientDeliveryFiles key={JSON.stringify([workspaceId, ticket.id, ticket.delivery.id, ticket.delivery.scopeVersionId])}
          workspaceId={workspaceId} ticketId={ticket.id} deliveryId={ticket.delivery.id} scopeVersionId={ticket.delivery.scopeVersionId} onInspectionChange={inspected} api={api} />
        {!ticket.delivery.accepted && !canReview && <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-200/70"><LockKeyhole size={12} className="mt-0.5 shrink-0" />Review actions become available after a verified download while this result is awaiting your review.</p>}
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
        {ticket.delivery.accepted && <p className="mt-2 text-[10px] text-gray-500">{ticket.status === 'closed' ? 'Accepted result · ticket closed.' : 'Acceptance is recorded; the PM still needs to close the ticket.'}</p>}
        {!ticket.delivery.accepted && <p className="mt-2 text-[10px] text-gray-500">Use this ticket's conversation to discuss the result with your PM.</p>}
      </InfoCard>}
    </div>

    <section className="mt-5 rounded-xl border border-white/[0.08] bg-surface">
      <header className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3"><MessageSquare size={15} className="text-brand-300" /><h2 className="text-sm font-medium text-gray-100">Conversation with your project manager</h2></header>
      <div className="max-h-[36rem] min-h-40 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messageCursor && <button onClick={onLoadMore} disabled={historyLoading} className="mx-auto block rounded-md px-3 py-1.5 text-[10px] text-brand-300 hover:bg-white/[0.04] disabled:opacity-50">{historyLoading ? 'Loading…' : 'Load more messages'}</button>}
        {historyError && <p role="alert" className="rounded-md border border-rose-400/20 bg-rose-500/[0.06] p-2 text-[11px] text-rose-200">{historyError}</p>}
        {messages.length === 0 ? <p className="py-8 text-center text-xs text-gray-600">No messages yet.</p> : messages.map(message => <article key={message.id} className={`max-w-[88%] rounded-xl border p-3 ${message.author === 'client' ? 'ml-auto border-brand-400/15 bg-brand-500/[0.06]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
          <div className="flex items-center justify-between gap-4 text-[10px] text-gray-500"><span>{message.author === 'client' ? 'You' : 'Project Manager'}</span><time dateTime={message.createdAt}>{time(message.createdAt)}</time></div>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-200">{message.body}</p>
        </article>)}
      </div>
      {error && <p role="alert" className="mx-4 mb-2 rounded-md border border-rose-400/20 bg-rose-500/[0.06] p-2.5 text-xs text-rose-200">{error}</p>}
      {canReply ? <form onSubmit={submitReply} className="space-y-2 border-t border-white/[0.07] p-3">
        <label className="sr-only" htmlFor="client-ticket-reply">Message to your project manager</label>
        <textarea id="client-ticket-reply" className={`${input} min-h-20 resize-y`} value={body} onChange={event => setBody(event.target.value)} disabled={busy} maxLength={4000} rows={2} placeholder="Write a message…" />
        <div className="flex items-center justify-between gap-2"><span className="text-[10px] text-gray-600">Visible to you and your project manager</span><button type="submit" disabled={busy || !body.trim()} className={primary}><Send size={13} />Send</button></div>
      </form> : <p className="border-t border-white/[0.07] px-4 py-3 text-center text-[11px] text-gray-500">{terminal ? 'This ticket is closed. Its history remains available.' : 'This ticket is currently read-only.'}</p>}
    </section>

    {confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirming(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="client-ticket-confirm-title" className="w-full max-w-md rounded-xl border border-white/10 bg-surface p-5 shadow-2xl">
        <h2 id="client-ticket-confirm-title" className="text-base font-semibold text-white">{confirming.type === 'accept_delivery' ? 'Accept this exact result?' : 'Agree to this scope?'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">{confirming.type === 'accept_delivery' ? 'This records acceptance of the shared result, not project completion or permission to deploy. The PM closes this ticket separately.' : 'This records your agreement to the displayed work. The project manager still has to authorize and assign the work before development starts.'}</p>
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
  return <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${color}`}>{label}</span>;
}
