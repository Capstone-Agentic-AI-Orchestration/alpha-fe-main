import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, Check, ChevronDown, CircleDot, FileText, Info,
  LockKeyhole, MessageSquare, PanelLeftClose, PanelLeftOpen, Paperclip, RefreshCw, Search, Send, StickyNote,
  Ticket as TicketIcon, UserRound,
} from 'lucide-react';

import { ApiRequestError } from '@/shared/services/apiService';
import { pmTicketApi, pmTicketDocumentsApi } from './pmApi';
import { ChatContextPanel } from './ChatContextPanel';
import type {
  PmTicketCommandInput, PmTicketDetail, PmTicketMessage, PmTicketMessageInput,
  PmTicketNote, PmTicketNoteInput, PmTicketQueueItem, PmTicketQueueOptions,
  PmTicketQueuePage, PmTicketReceipt, PmTicketScopeProposalInput, PmTicketProjectLinkInput, TicketStatus,
} from './pmApi';
import { PmScopeProposalForm, type PmScopeProposalDraft } from './PmScopeProposalForm';
import { PmWorkHandoffForm, type PmWorkHandoffDraft } from './PmWorkHandoffForm';
import { PmProjectLinkForm, type PmProjectLinkDraft } from './PmProjectLinkForm';
import { PmTicketQueueList } from './PmTicketQueueList';
import { pmTicketNextAction } from './pmTicketNextAction';
import { canAuthorizeTicketWork } from './pmWorkHandoff';
import { PmCorrectionForm } from './PmCorrectionForm';
import { canAssessTicketDelivery, canCloseAcceptedTicket, canShareAssessedDelivery, pmCorrectionCommand, pmCorrectionMode, type PmCorrectionDraft } from './pmReview';
import { PmDeliveryReview } from './PmDeliveryReview';
import { PmDeliveryAssessment } from './PmDeliveryAssessment';
import { input, primary, secondary, time } from './ticketUi';
import { TicketDocumentsPanel } from './TicketDocumentsPanel';
import type { TicketDocumentsApi } from './ticketDocuments';
import './pmTickets.css';

type Filter = NonNullable<PmTicketQueueOptions['filter']>;
type Panel = 'conversation' | 'notes';
type TicketSection = 'conversation' | 'notes' | 'details' | 'documents';
type WorkflowActions = 'none' | 'triage' | 'review_scope' | 'all';
interface PendingOperation {
  ticketId: string;
  operationId: string;
  label: string;
  run: () => Promise<PmTicketReceipt>;
  clearDraft?: boolean;
  draftPanel?: Panel;
}

const filters: Array<{ id: Filter; label: string; counter?: 'needsPm' | 'inProgress' | 'waitingClient' | 'closedMonth' }> = [
  { id: 'all', label: 'All tickets' },
  { id: 'needs_pm', label: 'Needs attention', counter: 'needsPm' },
  { id: 'in_progress', label: 'In progress', counter: 'inProgress' },
  { id: 'waiting_client', label: 'Waiting for client', counter: 'waitingClient' },
  { id: 'closed_month', label: 'Closed this month', counter: 'closedMonth' },
  { id: 'history', label: 'History' },
];

function statusLabel(status: TicketStatus): string {
  const label = status.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function statusStyle(status: TicketStatus): string {
  if (status === 'closed') return 'pm-status--closed';
  if (status === 'in_progress' || status === 'ready_for_review') return 'pm-status--active';
  if (status === 'awaiting_client' || status === 'on_hold') return 'pm-status--waiting';
  if (status === 'declined' || status === 'cancelled') return 'pm-status--stopped';
  return 'pm-status--review';
}

function timelineDayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function timelineDayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type ClientInvitationSummary = PmTicketQueueItem['internal']['clientInvitation'];

export function invitationButtonLabel(invitation: ClientInvitationSummary): string {
  if (!invitation) return 'Invite client to portal';
  if (invitation.status === 'expired' || invitation.status === 'revoked') return 'Send new invitation';
  if (invitation.status === 'consumed') return 'Invitation already used';
  if (invitation.delivery === 'failed') return 'Retry invitation email';
  if (invitation.delivery === 'sending') return 'Sending invitation…';
  if (invitation.delivery === 'retrying') return 'Retrying invitation…';
  if (invitation.delivery === 'accepted_by_provider') return 'Invitation email accepted';
  if (invitation.delivery === 'unknown') return 'Invitation status unavailable';
  return 'Invitation queued';
}

export function invitationStatusMessage(invitation: ClientInvitationSummary): string | null {
  if (!invitation) return null;
  if (invitation.status === 'expired') return 'The invitation expired. Send a new invitation if the inquiry is still eligible.';
  if (invitation.status === 'revoked') return 'The invitation was revoked. Send a new invitation if the inquiry is still eligible.';
  if (invitation.status === 'consumed') return 'The invitation link was used, but client access is not active. Check the workspace’s client access configuration.';
  switch (invitation.delivery) {
    case 'queued': return 'Invitation email is queued. Ticket access starts only after the client verifies the invited email and activates the account.';
    case 'sending': return 'The invitation email is being sent. Ticket access still requires email verification and activation.';
    case 'retrying': return 'The email service is retrying the invitation. Ticket access is not active yet.';
    case 'accepted_by_provider': return 'The email provider accepted the invitation; this does not confirm inbox delivery. Ticket access starts after email verification and activation.';
    case 'failed': return 'The invitation email failed. Use Retry invitation email to issue a fresh link.';
    case 'unknown': return 'Alpha could not confirm the invitation email state. No client access is granted.';
  }
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
  if (area === 'ticket' && error.code === 'ticket_intake_code_unavailable') return 'No published inquiry form is configured in this workspace yet.';
  if (area === 'ticket' && error.code === 'ticket_intake_code_ambiguous') return 'More than one inquiry form is published for this workspace. Ask an administrator to review the configuration.';
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

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return <div className="pm-tickets__empty">
    <TicketIcon size={22} aria-hidden="true" />
    <p className="pm-tickets__empty-title">{title}</p>
    <p className="pm-tickets__empty-detail">{detail}</p>
  </div>;
}

/** Display only a server-reported verification fact, never delivery/access state. */
export function PmContactVerification({ verification }: { verification: unknown }) {
  if (verification === 'verified') {
    return <span className="text-status-success">Email verified</span>;
  }
  if (verification === 'unverified_submission') {
    return <span className="text-status-warning">Pending email verification</span>;
  }
  return <span className="text-content-muted">Unable to verify status</span>;
}

export function PmTicketsView({ api = pmTicketApi, documentsApi = pmTicketDocumentsApi, intakeEnabled = true, workflowActions = 'all', communicationEnabled = false }: {
  api?: typeof pmTicketApi;
  documentsApi?: TicketDocumentsApi;
  intakeEnabled?: boolean;
  /** Limit actions to the implemented production phase. */
  workflowActions?: WorkflowActions;
  /** Enable only the conversation and document capabilities of Phase 5. */
  communicationEnabled?: boolean;
} = {}) {
  const [queue, setQueue] = useState<PmTicketQueuePage | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [detail, setDetail] = useState<PmTicketDetail | null>(null);
  const [messages, setMessages] = useState<PmTicketMessage[]>([]);
  const [notes, setNotes] = useState<PmTicketNote[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [noteCursor, setNoteCursor] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('conversation');
  const [ticketSection, setTicketSection] = useState<TicketSection>('conversation');
  const [composerOpen, setComposerOpen] = useState(false);
  const [scopeComposerOpen, setScopeComposerOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [projectLinkOpen, setProjectLinkOpen] = useState(false);
  const [deliveryAssessmentOpen, setDeliveryAssessmentOpen] = useState(false);
  const [deliveryReviewOpen, setDeliveryReviewOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [projectLinkSaving, setProjectLinkSaving] = useState(false);
  const [projectLinkError, setProjectLinkError] = useState('');
  const [requestAccessSaving, setRequestAccessSaving] = useState<string | null>(null);
  const [requestAccessError, setRequestAccessError] = useState('');
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
  const [invitationEmailSending, setInvitationEmailSending] = useState(false);
  const [invitationEmailError, setInvitationEmailError] = useState('');
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const queueGeneration = useRef(0);
  const historyGeneration = useRef(0);
  const writeLock = useRef(false);
  const queueElement = useRef<HTMLDivElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detailsElement = useRef<HTMLElement>(null);

  useEffect(() => { detailHeading.current?.focus({ preventScroll: true }); }, [detail?.id]);

  useEffect(() => {
    if (ticketSection === 'details' && (projectLinkOpen || declineOpen || scopeComposerOpen || handoffOpen
      || deliveryAssessmentOpen || deliveryReviewOpen || reviewAction)) {
      detailsElement.current?.querySelector('.pm-tickets__action-form')?.scrollIntoView({ block: 'nearest' });
    }
  }, [ticketSection, projectLinkOpen, declineOpen, scopeComposerOpen, handoffOpen, deliveryAssessmentOpen, deliveryReviewOpen, reviewAction]);

  function backToQueue() {
    const ticketId = selectedId;
    setSelectedId(null);
    window.requestAnimationFrame(() => {
      [...(queueElement.current?.querySelectorAll<HTMLButtonElement>('[data-ticket-id]') ?? [])]
        .find(button => button.dataset.ticketId === ticketId)?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    // Never carry one client's text to a different ticket. Public and private
    // composers also keep separate drafts, so changing tabs cannot publish a note.
    setDrafts({ conversation: '', notes: '' }); setMessageAction('reply'); setWriteError(''); setPanel('conversation');
    setDeclineOpen(false); setDeclineReason('');
    setInvitationEmailError('');
    setProjectLinkOpen(false); setProjectLinkError(''); setRequestAccessError('');
    setTicketSection('conversation'); setComposerOpen(false);
    setDeliveryAssessmentOpen(false); setDeliveryReviewOpen(false);
    setActionMenuOpen(false);
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
      setSelectedId(current => current && result.items.some(item => item.id === current) ? current : null);
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

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible' && !pending) void loadQueue();
    };
    const timer = window.setInterval(refreshIfVisible, 30_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshIfVisible); };
  }, [loadQueue, pending]);

  const selectedQueueItem = useMemo(
    () => queue?.items.find(item => item.id === selectedId) ?? null,
    [queue, selectedId],
  );
  const selectedInvitation = selectedQueueItem?.internal.clientInvitation ?? null;
  const selectedNextStep = useMemo(() => {
    if (!selectedQueueItem) return null;
    const owner = selectedQueueItem.internal.actionOwner === 'pm' ? 'You'
      : selectedQueueItem.internal.actionOwner === 'client' ? 'Client'
        : selectedQueueItem.internal.actionOwner === 'developer' ? 'Development team' : null;
    const action = pmTicketNextAction(selectedQueueItem.internal.nextAction);
    if (action) return owner ? `${owner} · ${action}` : action;
    return owner ? `${owner} is up next.` : 'No action is pending.';
  }, [selectedQueueItem]);

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
  }, [api, selectedId, panel, selectedQueueItem?.internal.clientAccessActive, selectedQueueItem?.updatedAt, refreshVersion]);

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

  async function saveProjectLink(value: PmProjectLinkDraft) {
    if (!detail || !detail.writesAvailable || writing || projectLinkSaving || pending || writeLock.current
      || (detail.internal.authorizedScopeVersionId && value.projectId !== detail.internal.projectId)) return;
    const inputValue: PmTicketProjectLinkInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      projectId: value.projectId, clientVisible: value.clientVisible, projectPreview: value.projectPreview,
    };
    writeLock.current = true; setProjectLinkSaving(true); setProjectLinkError(''); setWriteError('');
    try {
      const receipt = await api.linkProject(detail.id, inputValue);
      if (receipt.ticketId !== detail.id || receipt.operationId !== inputValue.operationId
        || !Number.isSafeInteger(receipt.version) || receipt.version < detail.version
        || receipt.projectId !== inputValue.projectId || typeof receipt.clientVisible !== 'boolean') {
        throw new Error('The project link could not be confirmed. Refresh the request before trying again.');
      }
      setProjectLinkOpen(false); refreshAll();
    } catch (error) {
      setProjectLinkError(safeError(error, 'write'));
      if (error instanceof ApiRequestError && error.reconciliationRequired) refreshAll();
    } finally {
      writeLock.current = false; setProjectLinkSaving(false);
    }
  }

  async function setClientRequestAccess(ticketId: string, enabled: boolean) {
    if (!intakeEnabled || writing || requestAccessSaving || pending || writeLock.current) return;
    writeLock.current = true; setRequestAccessSaving(ticketId); setRequestAccessError('');
    try {
      const result = await api.setClientRequestsEnabled(ticketId, enabled);
      if (result.ticketId !== ticketId || result.acceptsNewRequests !== enabled) {
        throw new Error('The request setting could not be confirmed. Refresh the queue.');
      }
      refreshAll();
    } catch (error) {
      setRequestAccessError(safeError(error, 'write'));
      if (error instanceof ApiRequestError && error.reconciliationRequired) refreshAll();
    } finally {
      writeLock.current = false; setRequestAccessSaving(null);
    }
  }


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
    if (!detail || !selectedQueueItem?.internal.clientAccessActive || !detail.writesAvailable
      || (!communicationEnabled && workflowActions === 'triage') || !draft.trim() || pending) return;
    const inputValue: PmTicketMessageInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      body: draft, action: { type: communicationEnabled ? 'reply' : messageAction },
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
    const invitation = selectedQueueItem?.internal.clientInvitation ?? null;
    const canRetryFailed = invitation?.status === 'pending' && invitation.delivery === 'failed';
    if (!detail || !selectedQueueItem || detail.status !== 'under_review' || !detail.writesAvailable
      || selectedQueueItem.internal.clientAccessActive || invitationEmailSending || writing || pending
      || invitation?.status === 'consumed' || (invitation?.status === 'pending' && !canRetryFailed)
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
      refreshAll();
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
      || detail.internal.authorizedScopeVersionId || detail.internal.requiredIssueIds.length > 0) return;
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
    if (!detail || writing || pending || (detail.internal.projectId && value.projectId !== detail.internal.projectId)
      || !canAuthorizeTicketWork(detail, selectedQueueItem?.internal.clientAccessActive === true)) return;
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

  const activeFilter = (value: Filter) => {
    setSelectedId(null);
    setFilter(value);
  };

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

  async function loadMoreHistory(mode: Panel = panel) {
    if (!selectedId || historyLoading) return;
    const generation = historyGeneration.current;
    const ticketId = selectedId;
    const activePanel = mode;
    const cursor = mode === 'conversation' ? messageCursor : noteCursor;
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

  const canMarkUnderReview = Boolean(detail && workflowActions !== 'none'
    && detail.status === 'received' && detail.writesAvailable);
  const canInviteClient = Boolean(detail && selectedQueueItem && workflowActions !== 'none'
    && detail.internal.request?.source === 'public_inquiry'
    && !selectedQueueItem.internal.clientAccessActive && detail.status === 'under_review'
    && detail.writesAvailable && selectedInvitation?.status !== 'consumed');
  const canDeclineInquiry = Boolean(detail && workflowActions !== 'none'
    && ['received', 'under_review'].includes(detail.status)
    && detail.writesAvailable && !detail.internal.authorizedScopeVersionId);
  const canProposeScope = Boolean(detail && selectedQueueItem
    && (workflowActions === 'all' || workflowActions === 'review_scope')
    && detail.writesAvailable && selectedQueueItem.internal.clientAccessActive
    && ['under_review', 'awaiting_client'].includes(detail.status)
    && !detail.internal.authorizedScopeVersionId && detail.internal.requiredIssueIds.length === 0);
  const canLinkAgreedWork = Boolean(detail && selectedQueueItem && workflowActions === 'all'
    && canAuthorizeTicketWork(detail, selectedQueueItem.internal.clientAccessActive));
  const canManageProjectLink = Boolean(detail && workflowActions !== 'none'
    && detail.writesAvailable && !['closed', 'declined', 'cancelled'].includes(detail.status));
  const canReviewCorrection = Boolean(detail && selectedQueueItem && workflowActions === 'all'
    && pmCorrectionMode(detail, selectedQueueItem.internal.clientAccessActive));
  const canCloseTicket = Boolean(detail && selectedQueueItem && workflowActions === 'all'
    && canCloseAcceptedTicket(detail, selectedQueueItem.internal.clientAccessActive));
  const canAssessDelivery = Boolean(detail && selectedQueueItem && workflowActions === 'all'
    && canAssessTicketDelivery(detail, selectedQueueItem.internal.clientAccessActive));
  const canReviewDelivery = Boolean(detail && workflowActions === 'all' && detail.internal.deliveryAssessment);
  const primaryAction = canMarkUnderReview ? 'review'
    : canInviteClient ? 'invite'
      : canLinkAgreedWork ? 'authorize'
        : canCloseTicket ? 'close' : null;
  const hasMoreActions = canDeclineInquiry || canProposeScope
    || (canLinkAgreedWork && primaryAction !== 'authorize') || canManageProjectLink
    || (canInviteClient && primaryAction !== 'invite') || canReviewCorrection
    || canAssessDelivery || canReviewDelivery || (canCloseTicket && primaryAction !== 'close');

  function openWorkflowAction(action: 'decline' | 'scope' | 'handoff' | 'project' | 'correction' | 'close' | 'delivery-assess' | 'delivery-review') {
    const wasOpen = action === 'decline' ? declineOpen
      : action === 'scope' ? scopeComposerOpen
        : action === 'handoff' ? handoffOpen
          : action === 'project' ? projectLinkOpen
            : action === 'correction' ? reviewAction === 'correction'
              : action === 'close' ? reviewAction === 'close'
                : action === 'delivery-assess' ? deliveryAssessmentOpen : deliveryReviewOpen;
    setTicketSection('details');
    setActionMenuOpen(false);
    setDeclineOpen(false);
    setScopeComposerOpen(false);
    setHandoffOpen(false);
    setProjectLinkOpen(false);
    setReviewAction(null);
    setDeliveryAssessmentOpen(false);
    setDeliveryReviewOpen(false);
    if (wasOpen) return;

    if (action === 'decline') { setDeclineReason(''); setDeclineOpen(true); }
    if (action === 'scope') { setWriteError(''); setScopeComposerOpen(true); }
    if (action === 'handoff') { setWriteError(''); setHandoffOpen(true); }
    if (action === 'project') { setProjectLinkError(''); setProjectLinkOpen(true); }
    if (action === 'correction') { setWriteError(''); setReviewAction('correction'); }
    if (action === 'close') { setWriteError(''); setReviewAction('close'); }
    if (action === 'delivery-assess') setDeliveryAssessmentOpen(true);
    if (action === 'delivery-review') setDeliveryReviewOpen(true);
  }

  function renderConversation(mode: Panel) {
    if (!detail || !selectedQueueItem) return null;

    const renderDayDivider = (value: string) => <div className="pm-tickets__timeline-divider" aria-label={`Messages from ${timelineDayLabel(value)}`}>
      <span><time dateTime={value}>{timelineDayLabel(value)}</time></span>
    </div>;

    let previousMessageDay = '';
    const messageTimeline = messages.map(message => {
      const day = timelineDayKey(message.createdAt);
      const showDayDivider = day !== previousMessageDay;
      previousMessageDay = day;
      return <Fragment key={message.id}>
        {showDayDivider && renderDayDivider(message.createdAt)}
        <article data-message-author={message.author} className={`pm-tickets__message${message.author === 'pm' ? ' pm-tickets__message--pm' : ''}`}>
          <span className="pm-tickets__message-avatar" aria-hidden="true">{message.author === 'pm' ? 'PM' : (detail.internal.request?.contact?.fullName ?? selectedQueueItem.internal.clientGroup?.displayName ?? 'Client').slice(0, 1)}</span>
          <div className="pm-tickets__message-content"><div className="pm-tickets__message-meta"><span>{message.author === 'pm' ? 'Project Manager' : detail.internal.request?.contact?.fullName ?? selectedQueueItem.internal.clientGroup?.displayName ?? 'Client'}</span><time dateTime={message.createdAt}>{time(message.createdAt)}</time></div>
          <p className="pm-tickets__message-body">{message.body}</p>
          </div>
        </article>
      </Fragment>;
    });

    let previousNoteDay = '';
    const noteTimeline = notes.map(note => {
      const day = timelineDayKey(note.createdAt);
      const showDayDivider = day !== previousNoteDay;
      previousNoteDay = day;
      return <Fragment key={note.id}>
        {showDayDivider && renderDayDivider(note.createdAt)}
        <article className="pm-tickets__message pm-tickets__message--note">
          <span className="pm-tickets__message-avatar" aria-hidden="true"><LockKeyhole size={14} /></span>
          <div className="pm-tickets__message-content"><div className="pm-tickets__message-meta"><span>PM-only note</span><time dateTime={note.createdAt}>{time(note.createdAt)}</time></div>
          <p className="pm-tickets__message-body">{note.body}</p>
          </div>
        </article>
      </Fragment>;
    });

    const canCompose = mode === 'notes' || ((communicationEnabled || workflowActions !== 'triage') && selectedQueueItem.internal.clientAccessActive);
    const openComposer = () => {
      setPanel(mode);
      setTicketSection(mode === 'notes' ? 'notes' : 'conversation');
      setComposerOpen(true);
    };

    return (
                <div className={`pm-tickets__conversation-area${mode === 'conversation' ? ' pm-tickets__conversation-area--chat' : ''}`}>
                  {mode === 'notes' && <p className="pm-tickets__privacy-notice"><LockKeyhole size={13} />Only authorized project managers can see these notes.</p>}
                  <div className="pm-tickets__conversation-history">
                    {(mode === 'conversation' ? messageCursor : noteCursor) && <button type="button" onClick={() => void loadMoreHistory(mode)} disabled={historyLoading} className="pm-tickets__load-more">{historyLoading ? 'Loading…' : 'Load more'}</button>}
                    {mode === panel && historyError && <div role="alert" className="pm-tickets__error">{historyError}</div>}
                    {mode === 'conversation' && !selectedQueueItem.internal.clientAccessActive
                      ? <div className="pm-tickets__locked"><LockKeyhole size={18} aria-hidden="true" /><p>Client conversation is available after the invited client activates access.</p><p>The invitation email contains a one-time activation link. Use private notes for internal triage until then.</p></div>
                      : mode === 'conversation' && messages.length === 0
                        ? <p className="pm-tickets__conversation-empty">No messages yet.</p>
                        : mode === 'notes' && notes.length === 0
                          ? <p className="pm-tickets__conversation-empty">No private notes yet. These notes are visible only to authorized PMs.</p>
                          : mode === 'conversation' ? messageTimeline : noteTimeline}
                  </div>

                  {canCompose && mode === 'conversation' && <form className="pm-tickets__composer pm-tickets__composer--compact" onSubmit={event => { event.preventDefault(); submitReply(); }}>
                    <span className="pm-tickets__composer-leading-icon" aria-hidden="true"><Paperclip size={17} /></span>
                    <div className="pm-tickets__composer-field">
                      { !communicationEnabled && <div className="pm-tickets__message-actions">
                        <button type="button" aria-pressed={messageAction === 'reply'} onClick={() => setMessageAction('reply')} className={messageAction === 'reply' ? 'is-active' : ''}>Send update</button>
                        <button type="button" aria-pressed={messageAction === 'request_details'} onClick={() => setMessageAction('request_details')} disabled={!['under_review', 'awaiting_client', 'in_progress', 'ready_for_review'].includes(detail.status)} className={messageAction === 'request_details' ? 'is-active' : ''}>Request details</button>
                        {messageAction === 'request_details' && <span>Sets the next action to the client.</span>}
                      </div>}
                      <textarea id={`ticket-${mode}-draft`} value={drafts[mode]} onChange={event => setDrafts(current => ({ ...current, [mode]: event.target.value }))} onKeyDown={event => {
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && drafts[mode].trim() && detail.writesAvailable && !writing && !pending) {
                          event.preventDefault(); event.currentTarget.form?.requestSubmit();
                        }
                      }} disabled={!detail.writesAvailable || writing || Boolean(pending)} maxLength={4000} rows={1} placeholder="Write a message to the client…" className="pm-tickets__composer-input" />
                      <kbd className="pm-tickets__composer-shortcut" aria-label="Command or control plus enter">⌘↵</kbd>
                    </div>
                    <button type="submit" disabled={!detail.writesAvailable || !drafts[mode].trim() || writing || Boolean(pending)} className={`pm-tickets__composer-send ${primary}`}>
                      <Send size={14} aria-hidden="true" /><span>{messageAction === 'request_details' ? 'Ask for details' : 'Reply'}</span><ChevronDown size={14} aria-hidden="true" />
                    </button>
                  </form>}

                  {canCompose && mode === 'notes' && <>
                    {(!composerOpen || mode !== panel) && <button type="button" className="pm-tickets__reply-prompt" onClick={openComposer}>
                      <span>{'Write a private note…'}</span>
                      <span>Add note<StickyNote size={15} aria-hidden="true" /></span>
                    </button>}
                    {composerOpen && mode === panel && <form className="pm-tickets__composer" onSubmit={event => { event.preventDefault(); submitNote(); }}>
                      <label className="sr-only" htmlFor={`ticket-${mode}-draft`}>{mode === 'notes' ? 'Private note' : 'Message to client'}</label>
                      <textarea autoFocus id={`ticket-${mode}-draft`} value={drafts[mode]} onChange={event => setDrafts(current => ({ ...current, [mode]: event.target.value }))} onKeyDown={event => {
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && drafts[mode].trim() && detail.writesAvailable && !writing && !pending) {
                          event.preventDefault(); event.currentTarget.form?.requestSubmit();
                        }
                      }} disabled={!detail.writesAvailable || writing || Boolean(pending)} maxLength={4000} rows={3} placeholder="Write a private PM note…" className="pm-tickets__composer-input" />
                      <span className="pm-tickets__composer-shortcut" aria-hidden="true">⌘↵</span>
                      <div className="pm-tickets__composer-footer">
                        <span className="pm-tickets__composer-visibility"><LockKeyhole size={12} />Only PMs can see this note</span>
                        <div className="pm-tickets__composer-buttons">
                          <button type="button" onClick={() => setComposerOpen(false)} disabled={writing} className={secondary}>Close</button>
                          <button type="submit" disabled={!detail.writesAvailable || !drafts[mode].trim() || writing || Boolean(pending)} className={mode === 'notes' ? secondary : primary}>
                            <StickyNote size={13} />Save note
                          </button>
                        </div>
                      </div>
                    </form>}
                  </>}
                  {!detail.writesAvailable && <div className="pm-tickets__readonly">This ticket is read-only or ticket changes are disabled.</div>}
                </div>
    );
  }

  const workflowToolbar = detail && selectedQueueItem && (primaryAction || hasMoreActions) ? (
                  <div className="pm-tickets__ticket-toolbar">
                  <div className="pm-tickets__next-step"><CircleDot size={14} aria-hidden="true" /><p>{selectedNextStep}</p></div>
                  <div className="pm-tickets__detail-actions">
                    {primaryAction === 'review' && <button onClick={markUnderReview} disabled={writing || Boolean(pending)} className={primary}><Check size={14} />Mark under review</button>}
                    {primaryAction === 'invite' && <button onClick={() => void sendClientInvitationEmail()}
                      disabled={invitationEmailSending || writing || Boolean(pending)
                        || (selectedInvitation?.status === 'pending' && selectedInvitation.delivery !== 'failed')} className={primary}>
                      <Send size={14} />{invitationEmailSending ? 'Sending invitation…' : invitationButtonLabel(selectedInvitation)}
                    </button>}
                    {primaryAction === 'authorize' && <button onClick={() => openWorkflowAction('handoff')}
                      disabled={writing || Boolean(pending)} className={primary}><Check size={14} />Link agreed work</button>}
                    {primaryAction === 'close' && <button onClick={() => openWorkflowAction('close')}
                      disabled={writing || Boolean(pending)} className={primary}>Close accepted ticket</button>}
                    {hasMoreActions && <details key={detail.id} open={actionMenuOpen}
                      onToggle={event => setActionMenuOpen(event.currentTarget.open)} className="pm-tickets__more-actions">
                      <summary>More actions<ChevronDown size={14} aria-hidden="true" /></summary>
                      <div className="pm-tickets__action-menu">
                        {canInviteClient && primaryAction !== 'invite' && <button type="button" onClick={() => { setActionMenuOpen(false); void sendClientInvitationEmail(); }}
                          disabled={invitationEmailSending || writing || Boolean(pending)
                            || (selectedInvitation?.status === 'pending' && selectedInvitation.delivery !== 'failed')}>
                          <Send size={14} />{invitationEmailSending ? 'Sending invitation…' : invitationButtonLabel(selectedInvitation)}
                        </button>}
                        {canDeclineInquiry && <button type="button" onClick={() => openWorkflowAction('decline')}>Decline inquiry</button>}
                        {canProposeScope && <button type="button" onClick={() => openWorkflowAction('scope')}>
                          {detail.scope?.agreed ? 'Replace agreed scope' : detail.scope ? 'Revise proposed scope' : 'Propose scope'}
                        </button>}
                        {canLinkAgreedWork && primaryAction !== 'authorize' && <button type="button" onClick={() => openWorkflowAction('handoff')}>Link agreed work</button>}
                        {canManageProjectLink && <button type="button" onClick={() => openWorkflowAction('project')}>
                          {detail.internal.projectId ? 'Manage project link' : 'Link to project'}
                        </button>}
                        {canReviewCorrection && <button type="button" onClick={() => openWorkflowAction('correction')}>
                          {detail.internal.correctionRequestedFor ? 'Review client correction' : 'Return affected tasks'}
                        </button>}
                        {canAssessDelivery && <button type="button" onClick={() => openWorkflowAction('delivery-assess')}>Assess prepared work</button>}
                        {canReviewDelivery && <button type="button" onClick={() => openWorkflowAction('delivery-review')}>Review client response</button>}
                        {canCloseTicket && primaryAction !== 'close' && <button type="button" onClick={() => openWorkflowAction('close')}>Close accepted ticket</button>}
                      </div>
                    </details>}
                  </div>
                  </div>
  ) : null;

  return <div className={`pm-tickets${selectedId ? ' pm-tickets--ticket-open' : ''}${navigationCollapsed ? ' is-navigation-collapsed' : ''}`}>
    <aside className="pm-tickets__navigation" aria-label="Ticket views">
      <button type="button" className="role-chat-navigation-toggle" aria-label={navigationCollapsed ? 'Show ticket navigation' : 'Collapse ticket navigation'} aria-expanded={!navigationCollapsed} onClick={() => setNavigationCollapsed(value => !value)}>{navigationCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
      <header className="pm-tickets__navigation-heading">
        <h1 className="pm-tickets__title"><TicketIcon size={19} aria-hidden="true" />Tickets</h1>
        <p>Client requests</p>
      </header>
      <label className="pm-tickets__compact-filter"><span className="sr-only">Filter requests</span>
        <select aria-label="Filter requests" value={filter} disabled={!intakeEnabled || writing || Boolean(pending)} onChange={event => activeFilter(event.target.value as Filter)}>
          {filters.map(option => <option key={option.id} value={option.id}>{option.label}{option.counter && queue?.counters.kind === 'pm' ? ` · ${queue.counters[option.counter]}` : ''}</option>)}
        </select>
      </label>
      {selectedId && <nav className="pm-tickets__chat-list" aria-label="Ticket conversations">
        <p>Conversations</p>
        {queue?.items.map(item => <button key={item.id} type="button" aria-current={selectedId === item.id ? 'page' : undefined}
          disabled={writing || Boolean(pending)} onClick={() => { historyGeneration.current += 1; setHistoryLoading(false); setSelectedId(item.id); setPanel('conversation'); setTicketSection('conversation'); setMessageAction('reply'); setDraft(''); setWriteError(''); }}>
          <MessageSquare size={15} aria-hidden="true" /><span><strong>{item.title}</strong><small>{statusLabel(item.status)}</small></span>
        </button>)}
        {queue?.nextCursor && <button type="button" disabled={queueMoreLoading || queueLoading} onClick={() => void loadMoreQueue()}>{queueMoreLoading ? 'Loading…' : 'Load more tickets'}</button>}
      </nav>}
    </aside>
    <div className="pm-tickets__main">
    <header className="pm-tickets__header">
      <div className="pm-tickets__view-heading">
        {selectedId ? <button type="button" onClick={backToQueue} disabled={writing || Boolean(pending)} className="pm-tickets__back"><ArrowLeft size={16} />{filters.find(option => option.id === filter)?.label}</button>
          : <><h2>{filters.find(option => option.id === filter)?.label}</h2><span className="pm-tickets__view-count">{queue ? queue.items.length : '…'}</span></>}
      </div>
      <div className="pm-tickets__header-actions">
        {!selectedId && <label className="pm-tickets__search"><Search size={15} aria-hidden="true" />
          <span className="sr-only">Search tickets</span>
          <input value={searchInput} disabled={!intakeEnabled} onChange={event => setSearchInput(event.target.value)} placeholder="Search tickets…" className="pm-tickets__search-input" />
        </label>}
        <button type="button" onClick={refreshAll} disabled={!intakeEnabled || queueLoading || Boolean(pending)} className="pm-tickets__refresh" title="Refresh tickets">
          <RefreshCw size={15} className={queueLoading ? 'animate-spin' : ''} /><span>Refresh</span>
        </button>
      </div>
    </header>

    {!intakeEnabled && <div role="status" className="pm-tickets__service-notice">
      <Info size={15} aria-hidden="true" />
      <p>Ticketing is coming soon. You can review the interface, but submissions are not available yet.</p>
    </div>}

    {intakeEnabled && queueError && <div role="alert" className="pm-tickets__error">
      <AlertCircle size={15} aria-hidden="true" />{queueError}
    </div>}

    <section className="pm-tickets__workspace">
      <div ref={queueElement} className={`pm-tickets__queue${selectedId ? ' pm-tickets__queue--collapsed' : ''}`}>
        <div className="pm-tickets__queue-toolbar">
          <p>{search ? `Results for “${search}”` : queue?.counters.kind === 'pm' && queue.counters.needsPm > 0
            ? `${queue.counters.needsPm} request${queue.counters.needsPm === 1 ? '' : 's'} need${queue.counters.needsPm === 1 ? 's' : ''} your attention.`
            : 'Your client requests and their next steps.'}</p>
          <span>Open a ticket to continue</span>
        </div>
        <div className="pm-tickets__queue-scroll">
          {requestAccessError && <p role="alert" className="pm-tickets__error">{requestAccessError}</p>}
          {!intakeEnabled ? <EmptyPanel title="Live tickets are not connected yet" detail="No ticket data is loaded while ticketing is disabled." />
            : queueLoading && !queue ? <div className="p-6 text-center text-xs text-content-muted">Loading tickets…</div>
            : queue && queue.items.length > 0 ? <PmTicketQueueList items={queue.items} selectedId={selectedId}
              disabled={Boolean(pending)} requestAccessSaving={requestAccessSaving}
              onSelect={ticketId => { historyGeneration.current += 1; setHistoryLoading(false); setSelectedId(ticketId); setPanel('conversation'); setMessageAction('reply'); setDraft(''); setWriteError(''); }}
              onToggleRequests={(ticketId, enabled) => void setClientRequestAccess(ticketId, enabled)} />
              : queue && <div className="pm-tickets__empty-state"><EmptyPanel title="No tickets in this view" detail={filter === 'all' && !search ? 'Accepted inquiries will appear here. New inquiries are reviewed in the separate intake inbox.' : 'Try another view or clear your search.'} />
                {(search || filter !== 'all') && <button type="button" className={secondary} onClick={() => { setSearchInput(''); setSearch(''); activeFilter('all'); }}>Show all tickets</button>}</div>}
        </div>
        {queue && <div className="pm-tickets__queue-footer">
          <span>Showing {queue.items.length} ticket{queue.items.length === 1 ? '' : 's'}</span>
          {queue.nextCursor && <button onClick={() => void loadMoreQueue()} disabled={queueMoreLoading || queueLoading} className="text-link hover:text-link-hover disabled:opacity-50">{queueMoreLoading ? 'Loading…' : 'Load more'}</button>}
        </div>}
      </div>

      <div role="region" aria-label="Ticket detail panel" className={`pm-tickets__detail${selectedId ? ' pm-tickets__detail--selected' : ''}`}>
        {!intakeEnabled ? <EmptyPanel title="Ticketing is coming soon" detail="Ticket details and conversations will be available when ticketing is connected." />
          : !selectedId || !selectedQueueItem ? <EmptyPanel title={queueError ? 'Ticket queue unavailable' : 'Select a ticket'} detail={queueError ? 'No ticket data is shown when the service cannot be reached.' : 'Choose a request from the queue to review its details and conversation.'} />
          : detailLoading ? <div role="status" className="p-8 text-center text-xs text-content-muted">Loading ticket…</div>
            : detailError ? <div role="alert" className="m-4 rounded-lg border border-status-danger-border bg-status-danger-subtle p-4 text-xs text-status-danger">{detailError}</div>
              : detail && selectedQueueItem && <div className="pm-tickets__detail-shell">
                <header className="pm-tickets__detail-header">
                  <div className="pm-tickets__detail-meta">
                    <div className="pm-tickets__detail-identity"><span className="pm-tickets__reference" title={detail.reference}>{detail.reference.length > 20 ? `${detail.reference.slice(0, 16)}…` : detail.reference}</span><span className={`pm-tickets__status ${statusStyle(detail.status)}`}>{statusLabel(detail.status)}</span></div>
                    <span className="pm-tickets__updated">Updated {time(detail.updatedAt)}</span>
                  </div>
                  <h2 ref={detailHeading} tabIndex={-1} className="pm-tickets__detail-title">{detail.title}</h2>
                  <p className="pm-tickets__ticket-context">{detail.internal.request?.contact?.fullName ?? selectedQueueItem.internal.clientGroup?.displayName ?? detail.companyLabel}
                    <span>·</span>{detail.internal.projectName ?? selectedQueueItem.internal.projectName ?? detail.request?.projectLabel ?? 'No project linked'}</p>
                  {invitationEmailError && <p role="alert" className="pm-tickets__detail-notice pm-tickets__detail-notice--error">{invitationEmailError}</p>}
                </header>

                {pending && <div className="pm-tickets__pending">
                  <span>Unconfirmed {pending.label} · operation {pending.operationId.slice(0, 8)}…</span>
                  <button onClick={async () => {
                    const operation = pending;
                    const succeeded = await performWrite(operation, operation.clearDraft);
                    if (succeeded && operation.label === 'scope proposal') setScopeComposerOpen(false);
                    if (succeeded && operation.label === 'work authorization') setHandoffOpen(false);
                    if (succeeded && ['correction authorization', 'accepted ticket closure'].includes(operation.label)) setReviewAction(null);
                  }} disabled={writing} className={secondary}>{writing ? 'Checking…' : 'Check and retry'}</button>
                </div>}



              {writeError && <div role="alert" className="pm-tickets__error">{writeError}</div>}
              <div className="pm-tickets__chat-layout role-chat-layout">
                {renderConversation('conversation')}
                <ChatContextPanel label="Ticket context" className="pm-tickets__context-panel" activeSection={ticketSection} onClose={() => { setTicketSection('conversation'); setPanel('conversation'); setComposerOpen(false); }}>
                <nav aria-label="Ticket sections" className="pm-tickets__section-tabs role-chat-tools">
                  <button type="button" aria-pressed={ticketSection === 'conversation'} onClick={() => { historyGeneration.current += 1; setHistoryLoading(false); setPanel('conversation'); setComposerOpen(false); setTicketSection('conversation'); }}
                    className={ticketSection === 'conversation' ? 'is-active' : ''}><MessageSquare size={15} />Overview</button>
                  <button type="button" aria-pressed={ticketSection === 'notes'} onClick={() => { historyGeneration.current += 1; setHistoryLoading(false); setPanel('notes'); setComposerOpen(false); setTicketSection('notes'); }}
                    className={ticketSection === 'notes' ? 'is-active' : ''}><LockKeyhole size={14} />Private notes</button>
                  <button type="button" aria-pressed={ticketSection === 'details'} onClick={() => setTicketSection('details')}
                    className={ticketSection === 'details' ? 'is-active' : ''}><FileText size={15} />Request details</button>
                  {communicationEnabled && <button type="button" aria-pressed={ticketSection === 'documents'} onClick={() => setTicketSection('documents')}
                    className={ticketSection === 'documents' ? 'is-active' : ''}><Paperclip size={15} />Documents</button>}
                </nav>
                {ticketSection === 'details' && <section ref={detailsElement} aria-label="Request details and workflow" className="pm-tickets__details-view">
                  {workflowToolbar}
                <div className="pm-tickets__overview">
                  <div className="pm-tickets__overview-section">
                    <p className="pm-tickets__eyebrow">Request</p>
                    <p className="pm-tickets__description">{detail.description}</p>
                    {detail.request?.requestedDeadline && <p className="pm-tickets__deadline">Requested date: {detail.request.requestedDeadline} · not guaranteed</p>}
                    {detail.scope && <div className="pm-tickets__scope-summary">
                      <p className="pm-tickets__eyebrow">Proposed scope <span>· {detail.scope.agreed ? 'Agreed' : 'Awaiting client'}</span></p>
                      <p className="pm-tickets__description">{detail.scope.summary}</p>
                    </div>}
                    {detail.internal.scopeVersion && <details className="pm-tickets__internal-brief">
                      <summary>Internal developer brief</summary>
                      <p className="pm-tickets__description">{detail.internal.scopeVersion.developerBrief ?? 'No internal brief is available for this older scope record.'}</p>
                    </details>}
                  </div>
                  <div className="pm-tickets__overview-section">
                    <p className="pm-tickets__eyebrow">Client & project</p>
                    <p className="pm-tickets__client-company">{detail.companyLabel}</p>
                    {detail.internal.request?.contact && <div className="pm-tickets__client-contact">
                      <p className="flex items-center gap-1.5"><UserRound size={12} />{detail.internal.request.contact.fullName}</p>
                      <p className="break-all">{detail.internal.request.contact.email} · <PmContactVerification verification={detail.internal.request.contact.verification} /></p>
                    </div>}
                    <p className="pm-tickets__client-access">{selectedQueueItem.internal.clientAccessActive ? 'Client account active' : selectedInvitation?.status === 'pending' ? 'Invitation pending · no access until verified' : 'Client account not active'}</p>
                    {!selectedQueueItem.internal.clientAccessActive && selectedInvitation && <p className="pm-tickets__client-access">{invitationStatusMessage(selectedInvitation)}</p>}
                    <p className="pm-tickets__project">{detail.internal.projectId ? `Project: ${detail.internal.projectName ?? selectedQueueItem.internal.projectName ?? 'linked'}` : 'No project linked yet'}</p>
                    {detail.internal.projectId && <p className="pm-tickets__project-note">{detail.internal.projectClientVisible ? 'Project name preview is visible to this ticket’s client; project and task access remain private.' : 'Project link is PM-only.'}</p>}
                  </div>
                </div>

                {projectLinkOpen && <div className="pm-tickets__action-form">
                  {projectLinkError && <p role="alert" className="mb-3 rounded-lg border border-status-danger-border bg-status-danger-subtle p-2.5 text-[11px] text-status-danger">{projectLinkError}</p>}
                  <PmProjectLinkForm key={`${detail.id}:${detail.version}:${detail.internal.projectId ?? ''}:${detail.internal.projectClientVisible === true}`}
                    initialProjectId={detail.internal.projectId}
                    initialClientVisible={detail.internal.projectClientVisible === true}
                    initialProjectPreview={detail.internal.projectPreview ?? null}
                    projectLocked={Boolean(detail.internal.authorizedScopeVersionId || detail.internal.requiredIssueIds.length)}
                    disabled={writing || projectLinkSaving || Boolean(pending)}
                    onCancel={() => setProjectLinkOpen(false)} onSubmit={value => void saveProjectLink(value)} />
                </div>}

                {declineOpen && ['received', 'under_review'].includes(detail.status) && <form aria-label="Decline inquiry" className="pm-tickets__action-form pm-tickets__action-form--decline" onSubmit={event => { event.preventDefault(); declineTicket(); }}>
                  <label className="block text-xs text-content-secondary">Reason for declining (required)<textarea required maxLength={4000} value={declineReason} onChange={event => setDeclineReason(event.target.value)} disabled={writing || Boolean(pending)} className={`${input} mt-2`} /></label>
                  <p className="text-xs text-content-muted">Saved in private PM history. No email is sent in this phase.</p>
                  <button type="button" onClick={() => setDeclineOpen(false)} className={secondary}>Cancel</button>
                  <button type="submit" className={primary} disabled={writing || Boolean(pending) || !declineReason.trim()}>Confirm decline</button>
                </form>}

              {deliveryAssessmentOpen && workflowActions === 'all' && canAssessTicketDelivery(detail, selectedQueueItem.internal.clientAccessActive) && <div className="pm-tickets__action-form"><PmDeliveryAssessment key={JSON.stringify([detail.id, detail.version, detail.scope?.id])}
                ticket={detail} clientAccessActive={selectedQueueItem.internal.clientAccessActive} disabled={writing || Boolean(pending)} onAssess={assessPreparedDelivery} onPrepared={refreshAll} /></div>}
              {deliveryReviewOpen && workflowActions === 'all' && detail.internal.deliveryAssessment && <div className="pm-tickets__action-form"><PmDeliveryReview key={JSON.stringify([detail.id, detail.version, detail.internal.deliveryAssessment.id, detail.internal.deliveryAssessment.pinnedAssetId])}
                ticket={detail} clientAccessActive={selectedQueueItem.internal.clientAccessActive} disabled={writing || Boolean(pending)} onShare={shareAssessedDelivery} /></div>}
              {scopeComposerOpen && <div className="pm-tickets__action-form">
                <PmScopeProposalForm existingScopeAgreed={detail.scope?.agreed === true} disabled={writing || Boolean(pending)} onCancel={() => setScopeComposerOpen(false)} onSubmit={draftValue => void submitScopeProposal(draftValue)} />
              </div>}
              {handoffOpen && canAuthorizeTicketWork(detail, selectedQueueItem.internal.clientAccessActive) && <div className="pm-tickets__action-form">
                <PmWorkHandoffForm key={`${detail.id}:${detail.version}`} linkedProjectId={detail.internal.projectId}
                  linkedProjectName={detail.internal.projectName ?? null} disabled={writing || Boolean(pending)}
                  onCancel={() => setHandoffOpen(false)} onSubmit={value => void submitWorkHandoff(value)} />
              </div>}
              {reviewAction === 'correction' && pmCorrectionMode(detail, selectedQueueItem.internal.clientAccessActive) && <div className="pm-tickets__action-form">
                <PmCorrectionForm key={`${detail.id}:${detail.version}`} ticket={detail} mode={pmCorrectionMode(detail, selectedQueueItem.internal.clientAccessActive)!}
                  disabled={writing || Boolean(pending)} onCancel={() => setReviewAction(null)} onSubmit={value => void submitCorrection(value)} />
              </div>}
              {reviewAction === 'close' && canCloseAcceptedTicket(detail, selectedQueueItem.internal.clientAccessActive) && <section aria-label="Confirm accepted ticket closure" className="pm-tickets__action-form pm-tickets__action-form--confirm">
                <h3 className="text-sm font-medium text-content">Close this accepted ticket?</h3>
                <p className="mt-2 text-[11px] leading-relaxed text-content-secondary">The client accepted this result. Closing makes this ticket read-only; its conversation and delivery history remain available. This does not complete the project or approve a deployment.</p>
                <div className="mt-3 flex justify-end gap-2"><button className={secondary} disabled={writing || Boolean(pending)} onClick={() => setReviewAction(null)}>Cancel</button>
                  <button className={primary} disabled={writing || Boolean(pending)} onClick={() => void closeAcceptedTicket()}>Confirm ticket closure</button></div>
              </section>}
              </section>}

                {ticketSection === 'documents' && communicationEnabled && <section aria-label="Ticket documents" className="pm-tickets__documents-view">
                  <TicketDocumentsPanel api={documentsApi} ticketId={detail.id} heading="Shared files"
                    canUpload={detail.writesAvailable && !['closed', 'declined', 'cancelled'].includes(detail.status)} />
                </section>}
                  {ticketSection === 'notes' && renderConversation('notes')}
                  <div hidden={ticketSection !== 'conversation'}>
                  <div className="pm-tickets__context-heading">
                    <div>
                      <p className="pm-tickets__eyebrow">Request context</p>
                      <span className="pm-tickets__reference">{detail.reference}</span>
                    </div>
                    <span className={`pm-tickets__status ${statusStyle(detail.status)}`}>{statusLabel(detail.status)}</span>
                  </div>
                  <section className="pm-tickets__context-section">
                    <p className="pm-tickets__context-label">Client</p>
                    <p className="pm-tickets__context-value">{detail.internal.request?.contact?.fullName ?? selectedQueueItem.internal.clientGroup?.displayName ?? detail.companyLabel}</p>
                    {detail.internal.request?.contact && <p className="pm-tickets__context-detail">{detail.internal.request.contact.email}</p>}
                    {detail.companyLabel !== (detail.internal.request?.contact?.fullName ?? selectedQueueItem.internal.clientGroup?.displayName ?? detail.companyLabel) && <p className="pm-tickets__context-detail">{detail.companyLabel}</p>}
                    {detail.internal.request?.contact && <p className="pm-tickets__context-detail"><PmContactVerification verification={detail.internal.request.contact.verification} /></p>}
                  </section>
                  <section className="pm-tickets__context-section">
                    <p className="pm-tickets__context-label">Project</p>
                    <p className="pm-tickets__context-value">{detail.internal.projectName ?? selectedQueueItem.internal.projectName ?? detail.request?.projectLabel ?? 'No project linked'}</p>
                    <p className="pm-tickets__context-detail">{detail.internal.projectId ? (detail.internal.projectClientVisible ? 'Client-visible project name' : 'PM-only project link') : 'Link a project after scope is agreed.'}</p>
                  </section>
                  {detail.internal.requiredIssueIds.length > 0 && <section className="pm-tickets__context-section" aria-label="Tasks authorized for this ticket">
                    <p className="pm-tickets__context-label">Authorized task IDs</p>
                    <ul className="space-y-1">
                      {detail.internal.requiredIssueIds.map(issueId => <li key={issueId} className="break-all font-mono text-[11px] text-content-secondary">{issueId}</li>)}
                    </ul>
                    <p className="pm-tickets__context-detail">These existing project Tasks are the approved work linked to this ticket.</p>
                  </section>}
                  <section className="pm-tickets__context-section">
                    <p className="pm-tickets__context-label">Next step</p>
                    <p className="pm-tickets__context-value pm-tickets__context-value--accent"><CircleDot size={14} aria-hidden="true" />{selectedNextStep}</p>
                    {workflowToolbar}
                  </section>
                  <section className="pm-tickets__context-section pm-tickets__context-section--request">
                    <p className="pm-tickets__context-label">Request summary</p>
                    <p className="pm-tickets__context-detail pm-tickets__context-description">{detail.description}</p>
                    {detail.request?.requestedDeadline && <p className="pm-tickets__context-detail">Requested by {detail.request.requestedDeadline}</p>}
                  </section>

                  </div>
                </ChatContextPanel>
              </div>

              </div>}
      </div>
    </section>
    </div>
  </div>;
}
