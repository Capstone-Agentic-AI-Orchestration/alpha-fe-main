import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, Check, Clock3, Info, LockKeyhole, MessageSquare,
  RefreshCw, Search, Send, StickyNote, Ticket as TicketIcon, UserRound,
} from 'lucide-react';

import { ApiRequestError } from '@/shared/services/apiService';
import { pmTicketApi } from './pmApi';
import type {
  PmTicketCommandInput, PmTicketDetail, PmTicketMessage, PmTicketMessageInput,
  PmTicketNote, PmTicketNoteInput, PmTicketQueueItem, PmTicketQueueOptions,
  PmTicketQueuePage, PmTicketReceipt, PmTicketScopeProposalInput, PmTicketInvitationEmailReceipt, TicketStatus,
} from './pmApi';
import { PmScopeProposalForm, type PmScopeProposalDraft } from './PmScopeProposalForm';
import { PmWorkHandoffForm, type PmWorkHandoffDraft } from './PmWorkHandoffForm';
import { canAuthorizeTicketWork } from './pmWorkHandoff';
import { PmCorrectionForm } from './PmCorrectionForm';
import { canAssessTicketDelivery, canCloseAcceptedTicket, canShareAssessedDelivery, pmCorrectionCommand, pmCorrectionMode, type PmCorrectionDraft } from './pmReview';
import { PmDeliveryReview } from './PmDeliveryReview';
import { PmDeliveryAssessment } from './PmDeliveryAssessment';
import { input, primary, secondary, time } from './ticketUi';

type Filter = NonNullable<PmTicketQueueOptions['filter']>;
type Panel = 'conversation' | 'notes';
type WorkflowActions = 'none' | 'triage' | 'review_scope' | 'all';
interface PendingOperation {
  ticketId: string;
  operationId: string;
  label: string;
  run: () => Promise<PmTicketReceipt>;
  clearDraft?: boolean;
  draftPanel?: Panel;
}

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'needs_pm', label: 'Needs PM' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'waiting_client', label: 'Waiting on client' },
  { id: 'history', label: 'History' },
];

function statusLabel(status: TicketStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

function statusStyle(status: TicketStatus): string {
  if (status === 'closed') return 'bg-emerald-500/10 text-emerald-300';
  if (status === 'in_progress' || status === 'ready_for_review') return 'bg-brand-500/10 text-brand-300';
  if (status === 'awaiting_client' || status === 'on_hold') return 'bg-amber-500/10 text-amber-300';
  if (status === 'declined' || status === 'cancelled') return 'bg-rose-500/10 text-rose-300';
  return 'bg-white/[0.06] text-gray-300';
}

export function safeError(error: unknown, area: 'queue' | 'ticket' | 'write'): string {
  if (!(error instanceof ApiRequestError)) {
    return area === 'queue' ? 'Could not load tickets. Check your connection and try again.'
      : area === 'ticket' ? 'Could not load this ticket. Refresh and try again.'
        : 'The action could not be completed. Refresh the ticket and try again.';
  }
  if (error.reconciliationRequired) return 'The result is uncertain. Use “Check and retry” to reconcile this same operation before starting another.';
  if (error.status === 401) return 'Your sign-in has expired. Sign in again to manage tickets.';
  if (error.status === 403) return 'Your current workspace role does not allow ticket management.';
  if (error.status === 404) return 'Ticket service is not connected in this environment, or this ticket is no longer available.';
  if (area === 'write' && error.status === 503 && error.code === 'client_invitation_unavailable') {
    return 'Client invitations are not configured on the hosted backend. Ask the deployment owner to check the client portal setup; retrying will not send an email until it is ready.';
  }
  if (area === 'write' && error.status === 409 && error.code === 'ticket_invitation_recipient_restricted') {
    return 'The email sender currently allows only its configured test recipient. Submit an inquiry with that email, or configure a verified sender before inviting other clients.';
  }
  if (error.status === 409) return 'The ticket changed before this action completed. Refresh it and review the latest state.';
  if (error.status === 429) return 'Too many requests. Wait a little, then try again.';
  if (error.status !== null && error.status >= 500) return 'Ticket service is temporarily unavailable.';
  return area === 'queue' ? 'Could not load tickets. Check your connection and try again.'
    : area === 'ticket' ? 'Could not load this ticket. Refresh and try again.'
      : 'The action could not be completed. Refresh the ticket and try again.';
}

function actionOwnerLabel(item: PmTicketQueueItem): string {
  if (item.internal.actionOwner === 'pm') return 'PM action';
  if (item.internal.actionOwner === 'client') return 'Client action';
  if (item.internal.actionOwner === 'developer') return 'Developer action';
  return 'No action pending';
}

function Counter({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} aria-pressed={active} className={`rounded-xl border p-3 text-left transition-colors ${active ? 'border-brand-400/50 bg-brand-500/10' : 'border-white/[0.07] bg-surface hover:bg-white/[0.04]'}`}>
    <span className="block text-[11px] text-gray-500">{label}</span>
    <span className="mt-1 block text-xl font-semibold tabular-nums text-gray-100">{value}</span>
  </button>;
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
    <TicketIcon size={22} className="text-gray-600" />
    <p className="mt-3 text-sm font-medium text-gray-300">{title}</p>
    <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500">{detail}</p>
  </div>;
}

export function PmTicketsView({ api = pmTicketApi, intakeEnabled = true, workflowActions = 'all' }: {
  api?: typeof pmTicketApi;
  intakeEnabled?: boolean;
  /** Limit actions to the implemented production phase. */
  workflowActions?: WorkflowActions;
} = {}) {
  const [queue, setQueue] = useState<PmTicketQueuePage | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PmTicketDetail | null>(null);
  const [messages, setMessages] = useState<PmTicketMessage[]>([]);
  const [notes, setNotes] = useState<PmTicketNote[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [noteCursor, setNoteCursor] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('conversation');
  const [scopeComposerOpen, setScopeComposerOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'correction' | 'close' | null>(null);
  const [messageAction, setMessageAction] = useState<'reply' | 'request_details'>('reply');
  const [drafts, setDrafts] = useState<Record<Panel, string>>({ conversation: '', notes: '' });
  const draft = drafts[panel];
  const setDraft = (value: string) => setDrafts(current => ({ ...current, [panel]: value }));
  const [queueLoading, setQueueLoading] = useState(intakeEnabled);
  const [queueMoreLoading, setQueueMoreLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [invitationEmailReceipt, setInvitationEmailReceipt] = useState<PmTicketInvitationEmailReceipt | null>(null);
  const [invitationEmailSending, setInvitationEmailSending] = useState(false);
  const [invitationEmailError, setInvitationEmailError] = useState('');
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const queueGeneration = useRef(0);
  const historyGeneration = useRef(0);
  const writeLock = useRef(false);

  useEffect(() => {
    // Never carry one client's text to a different ticket. Public and private
    // composers also keep separate drafts, so changing tabs cannot publish a note.
    setDrafts({ conversation: '', notes: '' }); setMessageAction('reply'); setWriteError('');
    setDeclineOpen(false); setDeclineReason('');
    setInvitationEmailReceipt(null); setInvitationEmailError('');
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadQueue = useCallback(async () => {
    const generation = ++queueGeneration.current;
    if (!intakeEnabled) {
      setQueue(null); setSelectedId(null); setQueueLoading(false); setQueueMoreLoading(false); setQueueError('');
      return;
    }
    setQueueLoading(true);
    setQueueMoreLoading(false);
    setQueueError('');
    try {
      const result = await api.list({ limit: 50, filter, search });
      if (generation !== queueGeneration.current) return;
      setQueue(result);
      setSelectedId(current => current && result.items.some(item => item.id === current)
        ? current : window.matchMedia('(min-width: 1280px)').matches ? result.items[0]?.id ?? null : null);
    } catch (error) {
      if (generation !== queueGeneration.current) return;
      setQueue(null);
      setSelectedId(null);
      setQueueError(safeError(error, 'queue'));
    } finally {
      if (generation === queueGeneration.current) setQueueLoading(false);
    }
  }, [api, filter, search, intakeEnabled]);

  useEffect(() => { void loadQueue(); }, [loadQueue, refreshVersion]);

  const selectedQueueItem = useMemo(
    () => queue?.items.find(item => item.id === selectedId) ?? null,
    [queue, selectedId],
  );

  useEffect(() => {
    setScopeComposerOpen(false);
    setHandoffOpen(false);
    setReviewAction(null);
    if (!selectedId || !selectedQueueItem) {
      setDetail(null); setMessages([]); setNotes([]); setMessageCursor(null); setNoteCursor(null); setDetailError('');
      setDetailLoading(false);
      return;
    }
    let current = true;
    const historyVersion = ++historyGeneration.current;
    setDetailLoading(true); setDetailError(''); setHistoryError(''); setDetail(null); setMessages([]); setNotes([]);
    setMessageCursor(null); setNoteCursor(null);
    api.get(selectedId).then(ticket => {
      if (!current) return;
      setDetail(ticket);
    }).catch(error => {
      if (current) setDetailError(safeError(error, 'ticket'));
    }).finally(() => {
      if (current) setDetailLoading(false);
    });
    return () => {
      current = false;
      if (historyGeneration.current === historyVersion) historyGeneration.current += 1;
    };
  }, [api, selectedId, selectedQueueItem?.internal.clientAccessActive, refreshVersion]);

  useEffect(() => {
    if (!selectedId || panel !== 'conversation' || !selectedQueueItem) return;
    let current = true;
    if (!selectedQueueItem.internal.clientAccessActive) {
      setMessages([]); setMessageCursor(null); setHistoryError('');
      return () => { current = false; };
    }
    setHistoryError('');
    api.getMessages(selectedId).then(page => {
      if (current) { setMessages(page.items); setMessageCursor(page.nextCursor); }
    }).catch(error => {
      if (current) setHistoryError(safeError(error, 'ticket'));
    });
    return () => { current = false; };
  }, [api, selectedId, panel, selectedQueueItem?.internal.clientAccessActive, refreshVersion]);

  useEffect(() => {
    if (!selectedId || panel !== 'notes' || !selectedQueueItem) return;
    let current = true;
    setHistoryError('');
    api.getNotes(selectedId).then(page => {
      if (current) { setNotes(page.items); setNoteCursor(page.nextCursor); }
    }).catch(error => {
      if (current) setHistoryError(safeError(error, 'ticket'));
    });
    return () => { current = false; };
  }, [api, selectedId, panel, refreshVersion]);


  const refreshAll = () => {
    historyGeneration.current += 1;
    setHistoryLoading(false);
    setRefreshVersion(version => version + 1);
  };


  async function performWrite(operation: PendingOperation, clearDraft = false): Promise<boolean> {
    if (!intakeEnabled || writeLock.current) return false;
    writeLock.current = true;
    const draftPanel = operation.draftPanel ?? panel;
    setWriting(true); setWriteError('');
    try {
      await operation.run();
      setPending(null);
      if (clearDraft) setDrafts(current => ({ ...current, [draftPanel]: '' }));
      setWriteError('');
      refreshAll();
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && error.reconciliationRequired) setPending({ ...operation, clearDraft, draftPanel });
      else setPending(null);
      setWriteError(safeError(error, 'write'));
      return false;
    } finally {
      writeLock.current = false;
      setWriting(false);
    }
  }

  async function shareAssessedDelivery(): Promise<boolean> {
    if (!detail || !selectedQueueItem || pending || writing || !canShareAssessedDelivery(detail, selectedQueueItem.internal.clientAccessActive)) return false;
    const ticketId = detail.id;
    const value: PmTicketCommandInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      command: { type: 'share_delivery', deliveryId: detail.internal.deliveryAssessment!.id } };
    return performWrite({ ticketId, operationId: value.operationId, label: 'result sharing', run: () => api.execute(ticketId, value) });
  }

  async function assessPreparedDelivery(deliveryId: string): Promise<boolean> {
    if (!detail || !selectedQueueItem || pending || writing || !canAssessTicketDelivery(detail, selectedQueueItem.internal.clientAccessActive)) return false;
    const ticketId = detail.id;
    const value: PmTicketCommandInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      command: { type: 'assess_delivery', deliveryId } };
    return performWrite({ ticketId, operationId: value.operationId, label: 'result assessment', run: () => api.execute(ticketId, value) });
  }

  function submitReply() {
    if (!detail || !selectedQueueItem?.internal.clientAccessActive || !detail.writesAvailable || !draft.trim() || pending) return;
    const inputValue: PmTicketMessageInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      body: draft, action: { type: messageAction },
    };
    void performWrite({
      ticketId: detail.id, operationId: inputValue.operationId,
      label: messageAction === 'request_details' ? 'request for details' : 'public reply',
      run: () => api.reply(detail.id, inputValue),
    }, true);
  }

  function submitNote() {
    if (!detail || !detail.writesAvailable || !draft.trim() || pending) return;
    const inputValue: PmTicketNoteInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version, body: draft,
    };
    void performWrite({
      ticketId: detail.id, operationId: inputValue.operationId, label: 'private note',
      run: () => api.addNote(detail.id, inputValue),
    }, true);
  }

  function markUnderReview() {
    if (workflowActions === 'none' || !detail || detail.status !== 'received' || !detail.writesAvailable || pending) return;
    const inputValue: PmTicketCommandInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      command: { type: 'review' },
    };
    void performWrite({
      ticketId: detail.id, operationId: inputValue.operationId, label: 'review decision',
      run: () => api.execute(detail.id, inputValue),
    });
  }

  async function sendClientInvitationEmail() {
    if (!detail || !selectedQueueItem || detail.status !== 'under_review' || !detail.writesAvailable
      || selectedQueueItem.internal.clientAccessActive || invitationEmailSending || writing || pending
      || writeLock.current) return;
    const ticketId = detail.id;
    writeLock.current = true;
    setInvitationEmailSending(true);
    setInvitationEmailError('');
    setWriteError('');
    try {
      const receipt = await api.sendInvitationEmail(ticketId);
      if (receipt.ticketId !== ticketId || !receipt.invitationId || !Number.isFinite(Date.parse(receipt.expiresAt))
        || receipt.status !== 'pending' || typeof receipt.alreadyPending !== 'boolean') throw new Error('Invalid client invitation receipt.');
      setInvitationEmailReceipt(receipt);
    } catch (error) {
      setInvitationEmailError(safeError(error, 'write'));
    } finally {
      writeLock.current = false;
      setInvitationEmailSending(false);
    }
  }

  function declineTicket() {
    if (!detail || !detail.writesAvailable || !declineReason.trim() || writing || pending
      || !['received', 'under_review'].includes(detail.status)) return;
    const inputValue: PmTicketCommandInput = { schemaVersion: 1, operationId: crypto.randomUUID(),
      expectedVersion: detail.version, command: { type: 'decline', reason: declineReason.trim() } };
    void performWrite({ ticketId: detail.id, operationId: inputValue.operationId, label: 'decline decision',
      run: () => api.execute(detail.id, inputValue),
    }).then(success => { if (success) { setDeclineOpen(false); setDeclineReason(''); } });
  }


  async function submitScopeProposal(draftValue: PmScopeProposalDraft) {
    if (workflowActions === 'none' || !detail || !selectedQueueItem?.internal.clientAccessActive || !detail.writesAvailable || pending
      || !['under_review', 'awaiting_client'].includes(detail.status)
      || detail.internal.authorizedScopeVersionId || detail.internal.projectId || detail.internal.requiredIssueIds.length > 0) return;
    const inputValue: PmTicketScopeProposalInput = {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      expectedVersion: detail.version,
      publicSummary: draftValue.publicSummary,
      developerBrief: draftValue.developerBrief,
    };
    const succeeded = await performWrite({
      ticketId: detail.id,
      operationId: inputValue.operationId,
      label: 'scope proposal',
      run: () => api.proposeScope(detail.id, inputValue),
    });
    if (succeeded) setScopeComposerOpen(false);
  }

  async function submitWorkHandoff(value: PmWorkHandoffDraft) {
    if (!detail || writing || pending || !canAuthorizeTicketWork(detail, selectedQueueItem?.internal.clientAccessActive === true)) return;
    const inputValue: PmTicketCommandInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      command: { type: 'authorize_work', scopeVersionId: detail.scope!.id, projectId: value.projectId, issueIds: [...value.issueIds] },
    };
    const succeeded = await performWrite({
      ticketId: detail.id, operationId: inputValue.operationId, label: 'work authorization',
      run: () => api.execute(detail.id, inputValue),
    });
    if (succeeded) setHandoffOpen(false);
  }

  async function submitCorrection(value: PmCorrectionDraft) {
    if (!detail || writing || pending) return;
    const mode = pmCorrectionMode(detail, selectedQueueItem?.internal.clientAccessActive === true);
    if (!mode || !value.reason.trim() || value.reason.trim().length > 4000 || !value.issueIds.length
      || new Set(value.issueIds).size !== value.issueIds.length
      || value.issueIds.some(id => !detail.internal.requiredIssueIds.includes(id))) return;
    const inputValue: PmTicketCommandInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      command: pmCorrectionCommand(detail, mode, value),
    };
    const succeeded = await performWrite({ ticketId: detail.id, operationId: inputValue.operationId,
      label: 'correction authorization', run: () => api.execute(detail.id, inputValue) });
    if (succeeded) setReviewAction(null);
  }

  async function closeAcceptedTicket() {
    if (!detail || writing || pending || !canCloseAcceptedTicket(detail, selectedQueueItem?.internal.clientAccessActive === true)) return;
    const inputValue: PmTicketCommandInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      command: { type: 'close_accepted', deliveryId: detail.delivery!.id },
    };
    const succeeded = await performWrite({ ticketId: detail.id, operationId: inputValue.operationId,
      label: 'accepted ticket closure', run: () => api.execute(detail.id, inputValue) });
    if (succeeded) setReviewAction(null);
  }

  const activeFilter = (value: Filter) => setFilter(current => current === value && value !== 'all' ? 'all' : value);

  async function loadMoreQueue() {
    if (!queue?.nextCursor || queueMoreLoading) return;
    const generation = queueGeneration.current;
    setQueueMoreLoading(true); setQueueError('');
    try {
      const page = await api.list({ limit: 50, after: queue.nextCursor, filter, search });
      if (generation !== queueGeneration.current) return;
      setQueue(current => {
        if (!current) return page;
        const existing = new Set(current.items.map(item => item.id));
        return { ...page, items: [...current.items, ...page.items.filter(item => !existing.has(item.id))] };
      });
    } catch (error) {
      if (generation === queueGeneration.current) setQueueError(safeError(error, 'queue'));
    } finally {
      if (generation === queueGeneration.current) setQueueMoreLoading(false);
    }
  }

  async function loadMoreHistory() {
    if (!selectedId || historyLoading) return;
    const generation = historyGeneration.current;
    const ticketId = selectedId;
    const activePanel = panel;
    const cursor = panel === 'conversation' ? messageCursor : noteCursor;
    if (!cursor) return;
    setHistoryLoading(true); setHistoryError('');
    try {
      if (activePanel === 'conversation' && selectedQueueItem?.internal.clientAccessActive) {
        const page = await api.getMessages(ticketId, { after: cursor });
        if (generation !== historyGeneration.current) return;
        setMessages(current => [...current, ...page.items]);
        setMessageCursor(page.nextCursor);
      } else if (activePanel === 'notes') {
        const page = await api.getNotes(ticketId, { after: cursor });
        if (generation !== historyGeneration.current) return;
        setNotes(current => [...current, ...page.items]);
        setNoteCursor(page.nextCursor);
      }
    } catch (error) {
      if (generation === historyGeneration.current) setHistoryError(safeError(error, 'ticket'));
    } finally {
      if (generation === historyGeneration.current) setHistoryLoading(false);
    }
  }

  return <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6 xl:overflow-hidden">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Tickets</h1>
        <p className="mt-1 text-xs text-gray-500">Review client requests and manage their conversation in this workspace.</p>
      </div>
      <button onClick={refreshAll} disabled={!intakeEnabled || queueLoading || Boolean(pending)} className={secondary}>
        <RefreshCw size={14} className={queueLoading ? 'animate-spin' : ''} />Refresh
      </button>
    </header>

    {!intakeEnabled && <div role="status" className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-relaxed text-gray-400">
      <Info size={15} className="mt-0.5 shrink-0 text-gray-500" />
      <p>Ticketing is coming soon. You can review the interface, but submissions are not available yet.</p>
    </div>}

    {intakeEnabled && queue?.counters.kind === 'pm' && <section aria-label="Ticket counters" className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Counter label="Needs PM" value={queue.counters.needsPm} active={filter === 'needs_pm'} onClick={() => activeFilter('needs_pm')} />
      <Counter label="In progress" value={queue.counters.inProgress} active={filter === 'in_progress'} onClick={() => activeFilter('in_progress')} />
      <Counter label="Waiting on client" value={queue.counters.waitingClient} active={filter === 'waiting_client'} onClick={() => activeFilter('waiting_client')} />
      <Counter label="Closed this month" value={queue.counters.closedMonth} active={filter === 'closed_month'} onClick={() => activeFilter('closed_month')} />
    </section>}

    {intakeEnabled && queueError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-3 text-xs text-rose-200">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />{queueError}
    </div>}

    <section className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.5fr)]">
      <div className={`${selectedId ? 'hidden xl:flex' : 'flex'} min-h-[320px] min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-surface`}>
        <div className="space-y-3 border-b border-white/[0.07] p-3">
          <label className="relative block"><Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-gray-600" />
            <span className="sr-only">Search tickets</span>
            <input value={searchInput} disabled={!intakeEnabled} onChange={event => setSearchInput(event.target.value)} placeholder="Search tickets…" className={`${input} py-2 pl-9 disabled:cursor-not-allowed disabled:opacity-50`} />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {filters.map(option => <button key={option.id} aria-pressed={filter === option.id} disabled={!intakeEnabled} onClick={() => activeFilter(option.id)} className={`rounded-md px-2 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-50 ${filter === option.id ? 'bg-brand-500/15 text-brand-200' : 'text-gray-500 hover:bg-white/[0.05] hover:text-gray-300'}`}>
              {option.label}
            </button>)}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!intakeEnabled ? <EmptyPanel title="Live tickets are not connected yet" detail="No ticket data is loaded while ticketing is disabled." />
            : queueLoading && !queue ? <div className="p-6 text-center text-xs text-gray-500">Loading tickets…</div>
            : queue && queue.items.length > 0 ? queue.items.map(item => <button key={item.id}
              disabled={Boolean(pending)} onClick={() => { historyGeneration.current += 1; setHistoryLoading(false); setSelectedId(item.id); setPanel('conversation'); setMessageAction('reply'); setDraft(''); setWriteError(''); }}
              className={`w-full border-b border-white/[0.05] p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selectedId === item.id ? 'bg-brand-500/[0.08] shadow-[inset_2px_0_0_0_#a78bfa]' : 'hover:bg-white/[0.025]'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-gray-500">{item.reference}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${statusStyle(item.status)}`}>{statusLabel(item.status)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-200">{item.title}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-gray-500">
                <span>{actionOwnerLabel(item)}</span><time dateTime={item.updatedAt}>{time(item.updatedAt)}</time>
              </div>
            </button>)
              : queue && <EmptyPanel title="No tickets in this view" detail={filter === 'all' ? 'New client inquiries and requests will appear here when ticket intake is enabled.' : 'Try another filter or clear your search.'} />}
        </div>
        {queue && <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2 text-[10px] text-gray-600">
          <span>Showing {queue.items.length} ticket{queue.items.length === 1 ? '' : 's'}</span>
          {queue.nextCursor && <button onClick={() => void loadMoreQueue()} disabled={queueMoreLoading || queueLoading} className="text-brand-300 hover:text-brand-200 disabled:opacity-50">{queueMoreLoading ? 'Loading…' : 'Load more'}</button>}
        </div>}
      </div>

      <div role="region" aria-label="Ticket detail panel" className={`${selectedId ? 'block' : 'hidden xl:block'} min-h-[420px] min-w-0 rounded-xl border border-white/[0.08] bg-surface xl:overflow-x-hidden xl:overflow-y-auto`}>
        {!intakeEnabled ? <EmptyPanel title="Ticketing is coming soon" detail="Ticket details and conversations will be available when ticketing is connected." />
          : !selectedId || !selectedQueueItem ? <EmptyPanel title={queueError ? 'Ticket queue unavailable' : 'Select a ticket'} detail={queueError ? 'No ticket data is shown when the service cannot be reached.' : 'Choose a request from the queue to review its details and conversation.'} />
          : detailLoading ? <div role="status" className="p-8 text-center text-xs text-gray-500">Loading ticket…</div>
            : detailError ? <div role="alert" className="m-4 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-4 text-xs text-rose-200">{detailError}</div>
              : detail && selectedQueueItem && <div className="flex min-h-full flex-col">
                <div className="border-b border-white/[0.07] p-4 md:p-5">
                  <button type="button" onClick={() => setSelectedId(null)} disabled={writing || Boolean(pending)} className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white xl:hidden"><ArrowLeft size={13} />Back to tickets</button>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><span className="font-mono text-[10px] text-gray-500">{detail.reference}</span><span className={`rounded px-2 py-1 text-[10px] ${statusStyle(detail.status)}`}>{statusLabel(detail.status)}</span></div>
                    <span className="flex items-center gap-1 text-[10px] text-gray-500"><Clock3 size={12} />Updated {time(detail.updatedAt)}</span>
                  </div>
                  <h2 className="mt-2 break-words text-lg font-semibold text-gray-100">{detail.title}</h2>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {workflowActions !== 'none' && detail.status === 'received' && detail.writesAvailable && <button onClick={markUnderReview} disabled={writing || Boolean(pending)} className={primary}><Check size={14} />Mark under review</button>}
                    {workflowActions !== 'none' && ['received', 'under_review'].includes(detail.status)
                      && detail.writesAvailable && !detail.internal.authorizedScopeVersionId
                      && <button onClick={() => { setDeclineReason(''); setDeclineOpen(value => !value); }} disabled={writing || Boolean(pending)} className={secondary}>Decline inquiry</button>}
                    {(workflowActions === 'all' || workflowActions === 'review_scope') && detail.writesAvailable && selectedQueueItem.internal.clientAccessActive
                      && ['under_review', 'awaiting_client'].includes(detail.status)
                      && !detail.internal.authorizedScopeVersionId && !detail.internal.projectId
                      && detail.internal.requiredIssueIds.length === 0
                      && <button onClick={() => { setWriteError(''); setHandoffOpen(false); setScopeComposerOpen(value => !value); }} disabled={writing || Boolean(pending)} className={secondary}>
                        {scopeComposerOpen ? 'Close scope editor' : detail.scope?.agreed ? 'Replace agreed scope' : detail.scope ? 'Revise proposed scope' : 'Propose scope'}
                      </button>}
                    {workflowActions === 'all' && canAuthorizeTicketWork(detail, selectedQueueItem.internal.clientAccessActive) && <button
                      onClick={() => { setWriteError(''); setScopeComposerOpen(false); setHandoffOpen(value => !value); }}
                      disabled={writing || Boolean(pending)} className={primary}>
                      {handoffOpen ? 'Close work selector' : 'Link agreed work'}
                    </button>}
                    {workflowActions !== 'none' && detail.internal.request?.source === 'public_inquiry'
                      && !selectedQueueItem.internal.clientAccessActive && detail.status === 'under_review'
                      && detail.writesAvailable && <button type="button" onClick={() => void sendClientInvitationEmail()}
                        disabled={invitationEmailSending || writing || Boolean(pending)} className={secondary}>
                        <Send size={13} />{invitationEmailSending ? 'Sending…'
                          : invitationEmailReceipt?.ticketId === detail.id ? 'Invitation pending' : 'Invite client to portal'}
                      </button>}
                    {detail.internal.request?.source === 'public_inquiry' && !selectedQueueItem.internal.clientAccessActive && <span className="rounded-md border border-amber-400/15 bg-amber-500/[0.05] px-2.5 py-2 text-[10px] text-amber-200/80">Ticket access starts only after the invited client verifies their email</span>}
                    {detail.internal.request?.source === 'public_inquiry' && <span className="rounded-md border border-white/[0.07] px-2.5 py-2 text-[10px] text-gray-500">Unverified public inquiry</span>}
                    {detail.internal.authorizedScopeVersionId && <span className="text-[10px] text-gray-500">Scope locked after work authorization · new work needs a linked ticket</span>}
                    {workflowActions === 'all' && pmCorrectionMode(detail, selectedQueueItem.internal.clientAccessActive) && <button className={secondary} disabled={writing || Boolean(pending)}
                      onClick={() => { setWriteError(''); setScopeComposerOpen(false); setHandoffOpen(false); setReviewAction(value => value === 'correction' ? null : 'correction'); }}>
                      {reviewAction === 'correction' ? 'Close correction editor' : detail.internal.correctionRequestedFor ? 'Review client correction' : 'Return affected Issues'}
                    </button>}
                    {workflowActions === 'all' && canCloseAcceptedTicket(detail, selectedQueueItem.internal.clientAccessActive) && <button className={primary} disabled={writing || Boolean(pending)}
                      onClick={() => { setWriteError(''); setReviewAction('close'); }}>Close accepted ticket</button>}
                  </div>
                  {invitationEmailError && <p role="alert" className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-2.5 text-[11px] text-rose-200">{invitationEmailError}</p>}
                  {invitationEmailReceipt?.ticketId === detail.id && <p role="status" className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-500/[0.04] p-2.5 text-[11px] text-emerald-200/80">
                    {invitationEmailReceipt.alreadyPending
                      ? 'An active invitation already exists; Alpha did not create a duplicate.'
                      : 'Invitation queued. The client gets access only after verifying the invited email and activating this ticket.'}
                    {' '}Expires {new Date(invitationEmailReceipt.expiresAt).toLocaleString()}.
                  </p>}
                </div>

                <div className="grid gap-3 border-b border-white/[0.07] p-4 md:grid-cols-2 md:p-5">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-600">Request</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{detail.description}</p>
                    {detail.request?.requestedDeadline && <p className="mt-3 text-[10px] text-gray-500">Requested date: {detail.request.requestedDeadline} · not guaranteed</p>}
                    {detail.scope && <div className="mt-4 border-t border-white/[0.06] pt-3">
                      <p className="text-[10px] uppercase tracking-wide text-gray-600">Proposed scope · {detail.scope.agreed ? 'Agreed' : 'Awaiting client'}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{detail.scope.summary}</p>
                    </div>}
                    {detail.internal.scopeVersion && <details className="mt-3 rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                      <summary className="cursor-pointer text-[10px] font-medium text-gray-400">Internal developer brief</summary>
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{detail.internal.scopeVersion.developerBrief ?? 'No internal brief is available for this older scope record.'}</p>
                    </details>}
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-600">Client & project</p>
                    <p className="mt-2 text-xs text-gray-300">{detail.companyLabel}</p>
                    {detail.internal.request?.contact && <div className="mt-2 space-y-1 text-[11px] text-gray-400">
                      <p className="flex items-center gap-1.5"><UserRound size={12} />{detail.internal.request.contact.fullName}</p>
                      <p className="break-all">{detail.internal.request.contact.email} <span className="text-amber-300/80">· unverified</span></p>
                    </div>}
                    <p className="mt-3 text-[10px] text-gray-500">{selectedQueueItem.internal.clientAccessActive ? 'Client account active' : invitationEmailReceipt?.ticketId === detail.id ? 'Invitation pending · no access until verified' : 'Client account not active'}</p>
                    <p className="mt-1 text-[10px] text-gray-500">{detail.internal.projectId ? 'Linked to a project' : 'No project linked yet'}</p>
                  </div>
                </div>

                {declineOpen && ['received', 'under_review'].includes(detail.status) && <form aria-label="Decline inquiry" className="m-4 space-y-3 rounded-lg border border-rose-400/20 p-4" onSubmit={event => { event.preventDefault(); declineTicket(); }}>
                  <label className="block text-xs text-gray-300">Reason for declining (required)<textarea required maxLength={4000} value={declineReason} onChange={event => setDeclineReason(event.target.value)} disabled={writing || Boolean(pending)} className={`${input} mt-2`} /></label>
                  <p className="text-xs text-gray-500">Saved in private PM history. No email is sent in this phase.</p>
                  <button type="button" onClick={() => setDeclineOpen(false)} className={secondary}>Cancel</button>
                  <button type="submit" className={primary} disabled={writing || Boolean(pending) || !declineReason.trim()}>Confirm decline</button>
                </form>}

              {workflowActions === 'all' && canAssessTicketDelivery(detail, selectedQueueItem.internal.clientAccessActive) && <PmDeliveryAssessment key={JSON.stringify([detail.id, detail.version, detail.scope?.id])}
                ticket={detail} clientAccessActive={selectedQueueItem.internal.clientAccessActive} disabled={writing || Boolean(pending)} onAssess={assessPreparedDelivery} />}
              {workflowActions === 'all' && detail.internal.deliveryAssessment && <PmDeliveryReview key={JSON.stringify([detail.id, detail.version, detail.internal.deliveryAssessment.id, detail.internal.deliveryAssessment.pinnedAssetId])}
                ticket={detail} clientAccessActive={selectedQueueItem.internal.clientAccessActive} disabled={writing || Boolean(pending)} onShare={shareAssessedDelivery} />}
              {scopeComposerOpen && <div className="border-b border-white/[0.07] p-4 md:p-5">
                <PmScopeProposalForm existingScopeAgreed={detail.scope?.agreed === true} disabled={writing || Boolean(pending)} onCancel={() => setScopeComposerOpen(false)} onSubmit={draftValue => void submitScopeProposal(draftValue)} />
              </div>}
              {handoffOpen && canAuthorizeTicketWork(detail, selectedQueueItem.internal.clientAccessActive) && <div className="border-b border-white/[0.07] p-4 md:p-5">
                <PmWorkHandoffForm key={`${detail.id}:${detail.version}`} disabled={writing || Boolean(pending)} onCancel={() => setHandoffOpen(false)} onSubmit={value => void submitWorkHandoff(value)} />
              </div>}
              {reviewAction === 'correction' && pmCorrectionMode(detail, selectedQueueItem.internal.clientAccessActive) && <div className="border-b border-white/[0.07] p-4 md:p-5">
                <PmCorrectionForm key={`${detail.id}:${detail.version}`} ticket={detail} mode={pmCorrectionMode(detail, selectedQueueItem.internal.clientAccessActive)!}
                  disabled={writing || Boolean(pending)} onCancel={() => setReviewAction(null)} onSubmit={value => void submitCorrection(value)} />
              </div>}
              {reviewAction === 'close' && canCloseAcceptedTicket(detail, selectedQueueItem.internal.clientAccessActive) && <section aria-label="Confirm accepted ticket closure" className="m-4 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.04] p-4">
                <h3 className="text-sm font-medium text-gray-100">Close this accepted ticket?</h3>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-400">The client accepted this result. Closing makes this ticket read-only; its conversation and delivery history remain available. This does not complete the project or approve a deployment.</p>
                <div className="mt-3 flex justify-end gap-2"><button className={secondary} disabled={writing || Boolean(pending)} onClick={() => setReviewAction(null)}>Cancel</button>
                  <button className={primary} disabled={writing || Boolean(pending)} onClick={() => void closeAcceptedTicket()}>Confirm ticket closure</button></div>
              </section>}
              {writeError && <div role="alert" className="mx-4 mt-3 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-2.5 text-[11px] text-rose-200">{writeError}</div>}
              <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center gap-1 border-b border-white/[0.06] px-4 pt-2">
                    <button onClick={() => { historyGeneration.current += 1; setHistoryLoading(false); setPanel('conversation'); }} className={`flex items-center gap-1.5 border-b-2 px-2 py-2 text-xs ${panel === 'conversation' ? 'border-brand-400 text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-300'}`}><MessageSquare size={13} />Conversation</button>
                    <button onClick={() => { historyGeneration.current += 1; setHistoryLoading(false); setPanel('notes'); }} className={`flex items-center gap-1.5 border-b-2 px-2 py-2 text-xs ${panel === 'notes' ? 'border-brand-400 text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-300'}`}><LockKeyhole size={13} />Private notes</button>
                  </div>

                  <div className="min-h-36 flex-1 space-y-3 overflow-y-auto p-4">
                    {(panel === 'conversation' ? messageCursor : noteCursor) && <button onClick={() => void loadMoreHistory()} disabled={historyLoading} className="mx-auto block rounded-md px-3 py-1.5 text-[10px] text-brand-300 hover:bg-white/[0.04] disabled:opacity-50">{historyLoading ? 'Loading…' : 'Load more'}</button>}
                    {historyError && <div role="alert" className="rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-2 text-[10px] text-rose-200">{historyError}</div>}
                    {panel === 'conversation' && !selectedQueueItem.internal.clientAccessActive
                      ? <div className="flex min-h-32 flex-col items-center justify-center text-center"><LockKeyhole size={18} className="text-gray-600" /><p className="mt-2 text-xs text-gray-400">Client conversation is available after the invited client activates access.</p><p className="mt-1 max-w-sm text-[10px] text-gray-600">The invitation email contains a one-time activation link. Use private notes for internal triage until then.</p></div>
                      : panel === 'conversation' && messages.length === 0
                        ? <p className="py-8 text-center text-xs text-gray-600">No messages yet.</p>
                        : panel === 'notes' && notes.length === 0
                          ? <p className="py-8 text-center text-xs text-gray-600">No private notes yet. These notes are visible only to authorized PMs.</p>
                          : panel === 'conversation' ? messages.map(message => <article key={message.id} className={`max-w-[88%] rounded-xl border p-3 ${message.author === 'pm' ? 'ml-auto border-brand-400/15 bg-brand-500/[0.06]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
                            <div className="flex items-center justify-between gap-4 text-[10px] text-gray-500"><span>{message.author === 'pm' ? 'Project Manager' : 'Client'}</span><time dateTime={message.createdAt}>{time(message.createdAt)}</time></div>
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-200">{message.body}</p>
                          </article>) : notes.map(note => <article key={note.id} className="rounded-xl border border-amber-400/10 bg-amber-500/[0.035] p-3">
                            <div className="flex items-center justify-between gap-4 text-[10px] text-amber-200/60"><span className="flex items-center gap-1"><LockKeyhole size={11} />PM-only note</span><time dateTime={note.createdAt}>{time(note.createdAt)}</time></div>
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-200">{note.body}</p>
                          </article>)}
                  </div>

                  {pending && <div className="mx-4 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.05] p-3 text-[11px] text-amber-100/80">
                    <span>Unconfirmed {pending.label} · operation {pending.operationId.slice(0, 8)}…</span>
                    <button onClick={async () => {
                      const operation = pending;
                      const succeeded = await performWrite(operation, operation.clearDraft);
                      if (succeeded && operation.label === 'scope proposal') setScopeComposerOpen(false);
                      if (succeeded && operation.label === 'work authorization') setHandoffOpen(false);
                      if (succeeded && ['correction authorization', 'accepted ticket closure'].includes(operation.label)) setReviewAction(null);
                    }} disabled={writing} className={secondary}>{writing ? 'Checking…' : 'Check and retry'}</button>
                  </div>}
                  {(panel === 'notes' || (workflowActions !== 'triage' && selectedQueueItem.internal.clientAccessActive)) && <form className="border-t border-white/[0.06] p-3" onSubmit={event => { event.preventDefault(); panel === 'notes' ? submitNote() : submitReply(); }}>
                    <label className="sr-only" htmlFor="ticket-message-draft">{panel === 'notes' ? 'Private note' : 'Message to client'}</label>
                    {panel === 'conversation' && <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button type="button" aria-pressed={messageAction === 'reply'} onClick={() => setMessageAction('reply')} className={`rounded-md px-2.5 py-1.5 text-[10px] ${messageAction === 'reply' ? 'bg-brand-500/15 text-brand-200' : 'text-gray-500 hover:bg-white/[0.04]'}`}>Send update</button>
                      <button type="button" aria-pressed={messageAction === 'request_details'} onClick={() => setMessageAction('request_details')} disabled={!['under_review', 'awaiting_client', 'in_progress', 'ready_for_review'].includes(detail.status)} className={`rounded-md px-2.5 py-1.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${messageAction === 'request_details' ? 'bg-amber-500/10 text-amber-200' : 'text-gray-500 hover:bg-white/[0.04]'}`}>Request details</button>
                      {messageAction === 'request_details' && <span className="text-[10px] text-amber-200/70">Sets the next action to the client.</span>}
                    </div>}
                    <textarea id="ticket-message-draft" value={draft} onChange={event => setDraft(event.target.value)} disabled={!detail.writesAvailable || writing || Boolean(pending)} maxLength={4000} rows={2} placeholder={panel === 'notes' ? 'Write a private PM note…' : 'Write a message to the client…'} className={`${input} min-h-20 resize-y`} />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-[10px] text-gray-600">{panel === 'notes' ? <><LockKeyhole size={11} />Visible only to PMs</> : <><MessageSquare size={11} />Visible to the client</>}</span>
                      <button type="submit" disabled={!detail.writesAvailable || !draft.trim() || writing || Boolean(pending)} className={panel === 'notes' ? secondary : primary}>
                        {panel === 'notes' ? <StickyNote size={13} /> : <Send size={13} />}{panel === 'notes' ? 'Save private note' : messageAction === 'request_details' ? 'Ask for details' : 'Send update'}
                      </button>
                    </div>
                  </form>}
                  {!detail.writesAvailable && <div className="border-t border-white/[0.06] px-4 py-3 text-center text-[10px] text-gray-600">This ticket is read-only or ticket changes are disabled.</div>}
                </div>
              </div>}
      </div>
    </section>
  </div>;
}
