import { TicketDetailSkeleton } from './TicketingSkeletons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUpRight, Check, ChevronDown, CircleDot, FileText,
  LockKeyhole, MessageSquare, Paperclip, Send, StickyNote, X,
  Ticket as TicketIcon, UserRound,
} from 'lucide-react';

import { ApiRequestError } from '@/shared/services/apiService';
import { pmTicketApi, pmTicketDocumentsApi } from './pmApi';
import { inviteClientToPortal } from './clientInvite';
import { ChatContextPanel } from './ChatContextPanel';
import type {
  PmTicketCommandInput, PmTicketDetail, PmTicketMessage, PmTicketMessageInput,
  PmTicketNote, PmTicketNoteInput, PmTicketQueueItem,
  PmTicketQueuePage, PmTicketReceipt, PmTicketScopeProposalInput, PmTicketProjectLinkInput, TicketStatus,
} from './pmApi';
import { PmScopeProposalForm, type PmScopeProposalDraft } from './PmScopeProposalForm';
import { PmWorkHandoffForm, type PmWorkHandoffDraft } from './PmWorkHandoffForm';
import { PmProjectLinkForm, type PmProjectLinkDraft } from './PmProjectLinkForm';
import { pmTicketNextAction } from './pmTicketNextAction';
import { pmNextStep, type PmStepAction } from './pmNextStep';
import { canAuthorizeTicketWork } from './pmWorkHandoff';
import { PmCorrectionForm } from './PmCorrectionForm';
import { canAssessTicketDelivery, canCloseAcceptedTicket, canShareAssessedDelivery, pmCorrectionCommand, pmCorrectionMode, type PmCorrectionDraft } from './pmReview';
import { PmDeliveryReview } from './PmDeliveryReview';
import { PmDeliveryAssessment } from './PmDeliveryAssessment';
import { PmLifecycleForm, pmLifecycleActions, pmLifecycleLabel, pmLifecycleOperation, pmLifecycleWrite, type PmLifecycleAction } from './PmLifecycleActions';
import { input, primary, secondary, time } from './ticketUi';
import { TicketDocumentsPanel } from './TicketDocumentsPanel';
import type { TicketDocumentsReadApi } from './ticketDocuments';
import { TicketChat } from './TicketChat';
import { Button } from '@/shared/components/ui/button';
import './pmTickets.css';

type Panel = 'conversation' | 'notes';
type TicketSection = 'conversation' | 'notes' | 'details' | 'documents';
export type WorkflowActions = 'none' | 'triage' | 'review_scope' | 'all';
interface PendingOperation {
  ticketId: string;
  operationId: string;
  label: string;
  run: () => Promise<PmTicketReceipt>;
  clearDraft?: boolean;
  draftPanel?: Panel;
  onSuccess?: (receipt: PmTicketReceipt) => void;
  /** Keep the active ticket mounted when its conversation was updated locally. */
  refresh?: boolean;
}

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

/** Shared with the request context beside the project conversation. */
export { statusLabel as pmStatusLabel, statusStyle as pmStatusStyle };

function appendPmMessage(messages: PmTicketMessage[], message: PmTicketMessage): PmTicketMessage[] {
  return messages.some(current => current.id === message.id) ? messages : [...messages, message];
}

function mergePmMessages(previous: PmTicketMessage[], latest: PmTicketMessage[]): PmTicketMessage[] {
  const messages = new Map(previous.map(message => [message.id, message]));
  for (const message of latest) messages.set(message.id, message);
  return [...messages.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id));
}

function appendPmNote(notes: PmTicketNote[], note: PmTicketNote): PmTicketNote[] {
  return notes.some(current => current.id === note.id) ? notes : [...notes, note];
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

// eslint-disable-next-line sonarjs/cognitive-complexity -- existing ticket workflow and queue view
export function PmTicketsView({ api = pmTicketApi, documentsApi = pmTicketDocumentsApi, intakeEnabled = true, workflowActions = 'all', communicationEnabled = false, refreshToken, fixedClientGroupKey, onOpenClient,
  initialSelectedId: selectedId = null, ticketReference, renderRequestConversation, workflowReference, onWorkflowReply, onWorkflowChanged }: {
  api?: typeof pmTicketApi;
  /**
   * The conversation shown beside an open request instead of the request's own
   * chat: on a client's page, the project's one conversation. Null keeps the
   * request's chat.
   */
  renderRequestConversation?: (context: {
    detail: PmTicketDetail;
    replyKind: 'reply' | 'request_details';
    onReplyKindChange: (kind: 'reply' | 'request_details') => void;
    onWritten: () => void;
  }) => ReactNode | null;
  documentsApi?: TicketDocumentsReadApi;
  intakeEnabled?: boolean;
  /** Limit actions to the implemented production phase. */
  workflowActions?: WorkflowActions;
  /** Enable only the conversation and document capabilities of Phase 5. */
  communicationEnabled?: boolean;
  /** Parent-owned refresh control used by the compact Tickets/Inquiries toolbar. */
  refreshToken?: number | string;
  /**
   * Show one client's tickets only, as on that client's page. The client
   * dropdown is hidden and the attention line counts this client alone.
   */
  fixedClientGroupKey?: string;
  /** Offer "View client" on an open ticket whose client has an account. */
  onOpenClient?: (clientGroupKey: string) => void;
  /** Open this request once the queue has loaded it, as from a client's Overview. */
  initialSelectedId?: string | null;
  ticketReference?: string;
  /** Render only the selected ticket’s workflow within its project conversation. */
  workflowReference?: string;
  onWorkflowReply?: (kind: 'reply' | 'request_details') => void;
  onWorkflowChanged?: () => void;
} = {}) {
  const [queue, setQueue] = useState<PmTicketQueuePage | null>(null);
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
  const [declineReason, setDeclineReason] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'correction' | 'close' | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<PmLifecycleAction | null>(null);
  const [messageAction, setMessageAction] = useState<'reply' | 'request_details'>('reply');
  const [drafts, setDrafts] = useState<Record<Panel, string>>({ conversation: '', notes: '' });
  const [queueLoading, setQueueLoading] = useState(intakeEnabled);
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
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detailsElement = useRef<HTMLElement>(null);

  useEffect(() => { detailHeading.current?.focus({ preventScroll: true }); }, [detail?.id]);

  useEffect(() => {
    if (ticketSection === 'details' && (projectLinkOpen || declineOpen || scopeComposerOpen || handoffOpen
      || deliveryAssessmentOpen || deliveryReviewOpen || reviewAction || lifecycleAction)) {
      detailsElement.current?.querySelector('.pm-tickets__action-form')?.scrollIntoView({ block: 'nearest' });
    }
  }, [ticketSection, projectLinkOpen, declineOpen, scopeComposerOpen, handoffOpen, deliveryAssessmentOpen, deliveryReviewOpen, reviewAction, lifecycleAction]);

  useEffect(() => {
    // Never carry one client's text to a different ticket. Public and private
    // composers also keep separate drafts, so changing tabs cannot publish a note.
    setDrafts({ conversation: '', notes: '' }); setMessageAction('reply'); setWriteError(''); setPanel('conversation');
    setDeclineOpen(false); setDeclineReason(''); setLifecycleAction(null);
    setInvitationEmailError('');
    setProjectLinkOpen(false); setProjectLinkError('');
    setTicketSection('conversation'); setComposerOpen(false);
    setDeliveryAssessmentOpen(false); setDeliveryReviewOpen(false);
    setActionMenuOpen(false);
  }, [selectedId]);

  const loadQueue = useCallback(async () => {
    const generation = ++queueGeneration.current;
    if (!intakeEnabled || !selectedId) {
      setQueue(null); setQueueLoading(false); setQueueError('');
      return;
    }
    setQueueLoading(true);
    setQueueError('');
    try {
      const search = workflowReference ?? ticketReference;
      let after: string | undefined;
      do {
        const result = await api.list({ limit: 50, filter: 'all', search, after, clientGroupKey: fixedClientGroupKey });
        if (generation !== queueGeneration.current) return;
        const item = result.items.find(ticket => ticket.id === selectedId);
        if (item || !result.nextCursor || result.nextCursor === after) {
          setQueue({ ...result, items: item ? [item] : [] });
          return;
        }
        after = result.nextCursor;
      } while (after);
    } catch (error) {
      if (generation !== queueGeneration.current) return;
      const forbidden = error instanceof ApiRequestError && (error.status === 401 || error.status === 403 || error.status === 404);
      if (forbidden) setQueue(null);
      setQueueError(safeError(error, 'queue'));
    } finally {
      if (generation === queueGeneration.current) setQueueLoading(false);
    }
  }, [api, selectedId, fixedClientGroupKey, intakeEnabled, ticketReference, workflowReference]);

  useEffect(() => { void loadQueue(); }, [loadQueue, refreshVersion, refreshToken]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible' && !pending) void loadQueue();
    };
    const timer = window.setInterval(refreshIfVisible, 30_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshIfVisible); };
  }, [loadQueue, pending]);

  const queuePending = intakeEnabled && Boolean(selectedId) && queueLoading && !queue;
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

  const detailScope = useRef<string | null>(null);
  useEffect(() => {
    const sameTicket = detailScope.current === selectedId;
    detailScope.current = selectedId;
    if (!sameTicket) {
      setScopeComposerOpen(false);
      setHandoffOpen(false);
      setReviewAction(null);
    }
    if (!selectedId || !selectedQueueItem) {
      setDetail(null); setMessages([]); setNotes([]); setMessageCursor(null); setNoteCursor(null); setDetailError('');
      setDetailLoading(false);
      return;
    }
    let current = true;
    const historyVersion = ++historyGeneration.current;
    setDetailLoading(true); setDetailError(''); setHistoryError('');
    if (!sameTicket) {
      setDetail(null); setMessages([]); setNotes([]); setMessageCursor(null); setNoteCursor(null);
    }
    api.get(selectedId).then(ticket => {
      if (!current) return;
      setDetail(ticket);
    }).catch(error => {
      if (current) {
        if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403 || error.status === 404)) setDetail(null);
        setDetailError(safeError(error, 'ticket'));
      }
    }).finally(() => {
      if (current) setDetailLoading(false);
    });
    return () => {
      current = false;
      if (historyGeneration.current === historyVersion) historyGeneration.current += 1;
    };
  }, [api, selectedId, selectedQueueItem?.internal.clientAccessActive, refreshVersion, refreshToken]);

  useEffect(() => {
    if (workflowReference || !selectedId || panel !== 'conversation' || !selectedQueueItem) return;
    let current = true;
    if (!selectedQueueItem.internal.clientAccessActive) {
      setMessages([]); setMessageCursor(null); setHistoryError(''); setHistoryLoading(false);
      return () => { current = false; };
    }
    setHistoryError(''); setHistoryLoading(true);
    api.getMessages(selectedId).then(page => {
      if (current) { setMessages(previous => mergePmMessages(previous, page.items)); setMessageCursor(page.nextCursor); }
    }).catch(error => {
      if (current) setHistoryError(safeError(error, 'ticket'));
    }).finally(() => {
      if (current) setHistoryLoading(false);
    });
    return () => { current = false; };
  }, [api, selectedId, panel, selectedQueueItem?.internal.clientAccessActive, selectedQueueItem?.updatedAt, refreshVersion, refreshToken, workflowReference]);

  useEffect(() => {
    if (workflowReference || !selectedId || panel !== 'notes' || !selectedQueueItem) return;
    let current = true;
    setHistoryError(''); setHistoryLoading(true);
    api.getNotes(selectedId).then(page => {
      if (current) { setNotes(page.items); setNoteCursor(page.nextCursor); }
    }).catch(error => {
      if (current) setHistoryError(safeError(error, 'ticket'));
    }).finally(() => {
      if (current) setHistoryLoading(false);
    });
    return () => { current = false; };
  }, [api, selectedId, panel, refreshVersion, refreshToken, workflowReference]);


  const refreshAll = () => {
    onWorkflowChanged?.();
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

  async function performWrite(operation: PendingOperation, clearDraft = false): Promise<boolean> {
    if (!intakeEnabled || writeLock.current) return false;
    writeLock.current = true;
    const draftPanel = operation.draftPanel ?? panel;
    setWriting(true); setWriteError('');
    try {
      const receipt = await operation.run();
      setPending(null);
      if (clearDraft) setDrafts(current => ({ ...current, [draftPanel]: '' }));
      operation.onSuccess?.(receipt);
      setWriteError('');
      if (operation.refresh !== false) refreshAll();
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

  function applyLocalPmReceipt(
    receipt: PmTicketReceipt, body: string, kind: 'message' | 'note', requestedAction?: PmTicketDetail['requestedAction'],
  ): void {
    const updatedAt = new Date().toISOString();
    const waitingForClient = kind === 'message' && requestedAction === 'reply';
    const messageId = receipt.messageId;
    if (messageId) {
      if (kind === 'message') {
        setMessages(current => appendPmMessage(current, {
          id: messageId, author: 'pm', body: body.trim(), createdAt: updatedAt,
        }));
      } else {
        setNotes(current => appendPmNote(current, {
          id: messageId, author: 'pm', authorId: 'current-pm', body: body.trim(), createdAt: updatedAt,
        }));
      }
    }
    setDetail(current => current && current.id === receipt.ticketId ? {
      ...current, version: receipt.version, status: receipt.status, updatedAt,
      ...(kind === 'message' && requestedAction !== undefined ? { requestedAction } : {}),
      internal: { ...current.internal, updatedAt, ...(waitingForClient ? { actionOwner: 'client' as const, nextAction: 'reply' as const } : {}) },
    } : current);
    setQueue(current => current ? {
      ...current,
      items: current.items.map(item => item.id === receipt.ticketId ? {
        ...item, status: receipt.status, updatedAt,
        internal: { ...item.internal, updatedAt, ...(waitingForClient ? { actionOwner: 'client' as const, nextAction: 'reply' as const } : {}) },
      } : item),
    } : current);
  }

  async function shareAssessedDelivery(): Promise<boolean> {
    if (!detail || !selectedQueueItem || pending || writing || !canShareAssessedDelivery(detail, selectedQueueItem.internal.clientAccessActive)) return false;
    const ticketId = detail.id;
    const value: PmTicketCommandInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      command: { type: 'share_delivery', deliveryId: detail.internal.deliveryAssessment!.id } };
    return performWrite({ ticketId, operationId: value.operationId, label: 'result sharing', run: () => api.execute(ticketId, value) });
  }

  /** One PM step: record the check, then share the same result with the client. */
  async function assessAndShareDelivery(deliveryId: string): Promise<boolean> {
    if (!detail || !selectedQueueItem || pending || writing || !canAssessTicketDelivery(detail, selectedQueueItem.internal.clientAccessActive)) return false;
    const ticketId = detail.id;
    const value: PmTicketCommandInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      command: { type: 'assess_delivery', deliveryId } };
    let checkedVersion = detail.version + 1;
    const checked = await performWrite({ ticketId, operationId: value.operationId, label: 'result check', refresh: false,
      run: () => api.execute(ticketId, value), onSuccess: receipt => { checkedVersion = receipt.version; } });
    if (!checked) return false;
    // If sharing fails here, the Next step bar offers "Share result" for the same checked result.
    const share: PmTicketCommandInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: checkedVersion,
      command: { type: 'share_delivery', deliveryId } };
    const shared = await performWrite({ ticketId, operationId: share.operationId, label: 'result sharing', run: () => api.execute(ticketId, share) });
    if (!shared) refreshAll();
    else setDeliveryAssessmentOpen(false);
    return shared;
  }

  function skipScopeApproval() {
    if (!detail?.scope || detail.scope.agreed || !detail.writesAvailable || writing || pending) return;
    const inputValue: PmTicketCommandInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      command: { type: 'skip_scope_approval', scopeVersionId: detail.scope.id } };
    void performWrite({ ticketId: detail.id, operationId: inputValue.operationId, label: 'start without approval',
      run: () => api.execute(detail.id, inputValue) });
  }

  function submitReply() {
    const body = drafts.conversation;
    if (!detail || !selectedQueueItem?.internal.clientAccessActive || !detail.writesAvailable
      || (!communicationEnabled && workflowActions === 'triage') || !body.trim() || pending) return;
    const inputValue: PmTicketMessageInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      body, action: { type: messageAction },
    };
    const ticketId = detail.id;
    void performWrite({
      ticketId, operationId: inputValue.operationId, refresh: false, draftPanel: 'conversation',
      label: messageAction === 'request_details' ? 'request for details' : 'public reply',
      run: () => api.reply(ticketId, inputValue),
      onSuccess: receipt => {
        applyLocalPmReceipt(receipt, inputValue.body, 'message', inputValue.action?.type === 'request_details' ? 'reply' : null);
        setMessageAction('reply');
      },
    }, true);
  }

  function submitNote() {
    const body = drafts.notes;
    if (!detail || !detail.writesAvailable || !body.trim() || pending) return;
    const inputValue: PmTicketNoteInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version, body,
    };
    const ticketId = detail.id;
    void performWrite({
      ticketId, operationId: inputValue.operationId, label: 'private note', refresh: false, draftPanel: 'notes',
      run: () => api.addNote(ticketId, inputValue),
      onSuccess: receipt => {
        applyLocalPmReceipt(receipt, inputValue.body, 'note');
      },
    }, true);
  }

  async function sendClientInvitationEmail() {
    const invitation = selectedQueueItem?.internal.clientInvitation ?? null;
    const canRetryFailed = invitation?.status === 'pending' && invitation.delivery === 'failed';
    if (!detail || !selectedQueueItem || !['received', 'under_review'].includes(detail.status) || !detail.writesAvailable
      || selectedQueueItem.internal.clientAccessActive || invitationEmailSending || writing || pending
      || invitation?.status === 'consumed' || (invitation?.status === 'pending' && !canRetryFailed)
      || writeLock.current) return;
    const ticketId = detail.id;
    writeLock.current = true;
    setInvitationEmailSending(true);
    setInvitationEmailError('');
    setWriteError('');
    try {
      await inviteClientToPortal(api, ticketId, { status: detail.status, version: detail.version });
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
      || !['received', 'under_review', 'awaiting_client'].includes(detail.status)
      || detail.internal.authorizedScopeVersionId || detail.internal.requiredIssueIds.length > 0) return;
    const inputValue: PmTicketScopeProposalInput = {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      expectedVersion: detail.version,
      publicSummary: draftValue.publicSummary,
      developerBrief: draftValue.developerBrief,
      ...(draftValue.clientApproval === 'skipped' ? { clientApproval: 'skipped' as const } : {}),
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

  async function submitLifecycle(action: PmLifecycleAction, text: string) {
    if (!detail || !selectedQueueItem || writing || pending
      || !pmLifecycleActions(detail, selectedQueueItem.internal.clientAccessActive).includes(action)) return;
    const ticketId = detail.id;
    const write = pmLifecycleWrite(action, detail, text, crypto.randomUUID());
    const run = write.kind === 'message' ? () => api.reply(ticketId, write.input) : () => api.execute(ticketId, write.input);
    const succeeded = await performWrite({ ticketId, operationId: write.input.operationId, label: pmLifecycleOperation(action), run });
    if (succeeded) setLifecycleAction(null);
  }

  function openLifecycleAction(action: PmLifecycleAction) {
    const wasOpen = lifecycleAction === action;
    setActionMenuOpen(false);
    setDeclineOpen(false); setScopeComposerOpen(false); setHandoffOpen(false); setProjectLinkOpen(false);
    setReviewAction(null); setDeliveryAssessmentOpen(false); setDeliveryReviewOpen(false);
    setLifecycleAction(wasOpen ? null : action);
    if (!wasOpen) setWriteError('');
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

  const canInviteClient = Boolean(detail && selectedQueueItem && workflowActions !== 'none'
    && detail.internal.request?.source === 'public_inquiry'
    && !selectedQueueItem.internal.clientAccessActive && ['received', 'under_review'].includes(detail.status)
    && detail.writesAvailable && selectedInvitation?.status !== 'consumed');
  const canDeclineInquiry = Boolean(detail && workflowActions !== 'none'
    && ['received', 'under_review'].includes(detail.status)
    && detail.writesAvailable && !detail.internal.authorizedScopeVersionId);
  const canProposeScope = Boolean(detail && selectedQueueItem
    && (workflowActions === 'all' || workflowActions === 'review_scope')
    && detail.writesAvailable && selectedQueueItem.internal.clientAccessActive
    && ['received', 'under_review', 'awaiting_client'].includes(detail.status)
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
  const lifecycleActions = detail && selectedQueueItem && workflowActions !== 'none'
    ? pmLifecycleActions(detail, selectedQueueItem.internal.clientAccessActive) : [];
  const step = detail && selectedQueueItem && workflowActions !== 'none' ? pmNextStep(detail, {
    clientAccessActive: selectedQueueItem.internal.clientAccessActive,
    canInvite: canInviteClient, canPlan: canProposeScope, canStartWork: canLinkAgreedWork,
    canCheckAndShare: canAssessDelivery,
    canShare: canReviewDelivery && canShareAssessedDelivery(detail, selectedQueueItem.internal.clientAccessActive),
    canClose: canCloseTicket, canCorrect: canReviewCorrection, canResume: lifecycleActions.includes('resume'),
  }) : null;
  const stepActions = new Set([step?.primary?.action, step?.alternative?.action]);
  const inviteBlocked = selectedInvitation?.status === 'pending' && selectedInvitation.delivery !== 'failed';
  const menuLifecycleActions = lifecycleActions.filter(action => !(action === 'resume' && stepActions.has('resume'))
    && !(action === 'cancel' && stepActions.has('withdrawal')));
  /** Rare actions, kept out of the way in a small menu. */
  const moreActions: Array<{ id: string; label: string; run: () => void; disabled?: boolean }> = [
    ...(detail?.writesAvailable && selectedQueueItem?.internal.clientAccessActive && !stepActions.has('reply')
      && ['received', 'under_review', 'awaiting_client', 'in_progress', 'ready_for_review'].includes(detail.status)
      ? [{ id: 'ask', label: 'Ask the client a question', run: () => focusComposer('request_details') }] : []),
    ...(canInviteClient && !stepActions.has('invite') ? [{ id: 'invite', label: invitationButtonLabel(selectedInvitation),
      run: () => void sendClientInvitationEmail(), disabled: invitationEmailSending || inviteBlocked }] : []),
    ...(canProposeScope && !stepActions.has('plan') ? [{ id: 'plan',
      label: detail?.scope?.agreed ? 'Replace the plan' : detail?.scope ? 'Revise the plan' : 'Send a plan', run: () => openWorkflowAction('scope') }] : []),
    ...(canLinkAgreedWork && !stepActions.has('start_work') ? [{ id: 'start', label: 'Start work', run: () => openWorkflowAction('handoff') }] : []),
    ...(canReviewCorrection && !stepActions.has('correction') ? [{ id: 'correction', label: 'Send tasks back', run: () => openWorkflowAction('correction') }] : []),
    ...(canReviewDelivery && !stepActions.has('share') ? [{ id: 'result', label: 'View the result', run: () => openWorkflowAction('delivery-review') }] : []),
    ...(canCloseTicket && !stepActions.has('close') ? [{ id: 'close', label: 'Close request', run: () => openWorkflowAction('close') }] : []),
    ...(canManageProjectLink ? [{ id: 'project', label: detail?.internal.projectId ? 'Change project' : 'Link to a project', run: () => openWorkflowAction('project') }] : []),
    ...(canDeclineInquiry ? [{ id: 'decline', label: 'Decline request', run: () => openWorkflowAction('decline') }] : []),
    ...menuLifecycleActions.map(action => ({ id: action, label: pmLifecycleLabel[action], run: () => openLifecycleAction(action) })),
  ];

  /** The form for the step the PM chose, shown in the main column under the Next step bar. */
  function renderStepForms() {
    if (!detail || !selectedQueueItem || !(projectLinkOpen || declineOpen || deliveryAssessmentOpen || deliveryReviewOpen || scopeComposerOpen || handoffOpen || reviewAction !== null || lifecycleAction !== null)) return null;
    return <div className="pm-step__panel">
      <button type="button" className="pm-step__panel-close" aria-label="Close this step" title="Close" onClick={closeStepForms}><X size={16} aria-hidden="true" /></button>
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
      ticket={detail} clientAccessActive={selectedQueueItem.internal.clientAccessActive} disabled={writing || Boolean(pending)} onAssess={assessAndShareDelivery} onPrepared={refreshAll} /></div>}
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
      {lifecycleAction && lifecycleActions.includes(lifecycleAction) && <PmLifecycleForm key={`${detail.id}:${detail.version}:${lifecycleAction}`}
      action={lifecycleAction} disabled={writing || Boolean(pending)}
      onCancel={() => setLifecycleAction(null)} onSubmit={text => void submitLifecycle(lifecycleAction, text)} />}
    </div>;
  }

  function focusComposer(action: 'reply' | 'request_details' = 'reply') {
    setActionMenuOpen(false);
    if (onWorkflowReply) { onWorkflowReply(action); return; }
    setMessageAction(action);
    setPanel('conversation'); setTicketSection('conversation');
    window.setTimeout(() => document.getElementById('ticket-conversation-draft')?.focus(), 0);
  }

  function runStep(action: PmStepAction) {
    switch (action) {
      case 'invite': void sendClientInvitationEmail(); break;
      case 'plan': openWorkflowAction('scope'); break;
      case 'reply': focusComposer('reply'); break;
      case 'skip_approval': skipScopeApproval(); break;
      case 'start_work': openWorkflowAction('handoff'); break;
      case 'check_share': openWorkflowAction('delivery-assess'); break;
      case 'share': openWorkflowAction('delivery-review'); break;
      case 'close': openWorkflowAction('close'); break;
      case 'correction': openWorkflowAction('correction'); break;
      case 'withdrawal': openLifecycleAction('cancel'); break;
      case 'resume': openLifecycleAction('resume'); break;
    }
  }

  function closeStepForms() {
    setDeclineOpen(false); setScopeComposerOpen(false); setHandoffOpen(false); setProjectLinkOpen(false);
    setReviewAction(null); setDeliveryAssessmentOpen(false); setDeliveryReviewOpen(false); setLifecycleAction(null);
  }

  function openWorkflowAction(action: 'decline' | 'scope' | 'handoff' | 'project' | 'correction' | 'close' | 'delivery-assess' | 'delivery-review') {
    const wasOpen = action === 'decline' ? declineOpen
      : action === 'scope' ? scopeComposerOpen
        : action === 'handoff' ? handoffOpen
          : action === 'project' ? projectLinkOpen
            : action === 'correction' ? reviewAction === 'correction'
              : action === 'close' ? reviewAction === 'close'
                : action === 'delivery-assess' ? deliveryAssessmentOpen : deliveryReviewOpen;
    setActionMenuOpen(false);
    setDeclineOpen(false);
    setScopeComposerOpen(false);
    setHandoffOpen(false);
    setProjectLinkOpen(false);
    setReviewAction(null);
    setDeliveryAssessmentOpen(false);
    setDeliveryReviewOpen(false);
    setLifecycleAction(null);
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
    const clientName = detail.internal.request?.contact?.fullName ?? selectedQueueItem.internal.clientGroup?.displayName ?? 'Client';
    const canCompose = detail.writesAvailable && (mode === 'notes' || ((communicationEnabled || workflowActions !== 'triage') && selectedQueueItem.internal.clientAccessActive));
    const openComposer = () => {
      setPanel(mode);
      setTicketSection(mode === 'notes' ? 'notes' : 'conversation');
      setComposerOpen(true);
    };

    const chatMessages = mode === 'conversation'
      ? messages
      : notes.map(note => ({ id: note.id, author: 'note' as const, body: note.body, createdAt: note.createdAt }));
    const composerIsOpen = mode === 'conversation' || (composerOpen && mode === panel);
    const composerToolbar = mode === 'conversation' ? <div className="ticket-chat__mode-toggle" role="group" aria-label="Reply type">
      <Button type="button" size="sm" variant={messageAction === 'reply' ? 'outline' : 'ghost'} aria-pressed={messageAction === 'reply'} onClick={() => setMessageAction('reply')}>Send</Button>
      <Button type="button" size="sm" variant={messageAction === 'request_details' ? 'outline' : 'ghost'} aria-pressed={messageAction === 'request_details'}
        onClick={() => setMessageAction('request_details')} disabled={!['received', 'under_review', 'awaiting_client', 'in_progress', 'ready_for_review'].includes(detail.status)}>Ask &amp; wait for reply</Button>
      {messageAction === 'request_details' && <span>The client sees this as something that needs them.</span>}
    </div> : undefined;

    return <TicketChat
      role="pm"
      mode={mode}
      showHeader={false}
      title={mode === 'notes' ? 'Private notes' : 'Conversation'}
      subtitle={mode === 'notes' ? 'Visible only to authorized project managers' : 'Messages shared with the client'}
      privacyLabel={mode === 'notes' ? 'Only authorized project managers can see these notes.' : 'Private conversation'}
      messages={chatMessages}
      clientName={clientName}
      clientInitial={clientName.trim().slice(0, 1).toUpperCase() || 'C'}
      historyError={mode === panel ? historyError : ''}
      messageCursor={mode === 'conversation' ? messageCursor : noteCursor}
      historyLoading={historyLoading}
      onLoadMore={() => void loadMoreHistory(mode)}
      locked={mode === 'conversation' && !selectedQueueItem.internal.clientAccessActive}
      lockedTitle="Client conversation is unavailable"
      lockedDescription="The client conversation is available after the invited client activates access. Use private notes for internal triage until then."
      emptyTitle={mode === 'notes' ? 'No private notes yet' : 'No messages yet'}
      emptyDescription={mode === 'notes' ? 'Keep internal context here for the project team.' : 'Start the conversation with a question or update.'}
      draft={drafts[mode]}
      onDraftChange={value => setDrafts(current => ({ ...current, [mode]: value }))}
      onSubmit={event => { event.preventDefault(); if (mode === 'notes') submitNote(); else submitReply(); }}
      canCompose={canCompose}
      busy={writing || Boolean(pending)}
      writesAvailable={detail.writesAvailable}
      inputId={`ticket-${mode}-draft`}
      placeholder={mode === 'notes' ? 'Write a private note…' : 'Write a message to the client…'}
      sendLabel={mode === 'notes' ? 'Save note' : messageAction === 'request_details' ? 'Ask' : 'Reply'}
      sendAriaLabel={mode === 'notes' ? 'Save private note' : 'Send reply'}
      sendIcon={mode === 'notes' ? <StickyNote size={14} aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
      sendVariant={mode === 'notes' ? 'outline' : 'default'}
      submitSuffix={mode === 'conversation' ? <ChevronDown size={14} aria-hidden="true" /> : undefined}
      composerToolbar={composerToolbar}
      leadingAction={<span className="ticket-chat__leading" aria-hidden="true"><Paperclip size={17} /></span>}
      composerOpen={composerIsOpen}
      composerPrompt={mode === 'notes'}
      onOpenComposer={openComposer}
      onCloseComposer={mode === 'notes' ? () => setComposerOpen(false) : undefined}
      composerVisibility={mode === 'notes' ? 'Only PMs can see this note' : undefined}
      rows={mode === 'notes' ? 3 : 1}
      submitOnShortcut
      showShortcut
      readOnlyLabel={!detail.writesAvailable ? 'This ticket is read-only or ticket changes are disabled.' : undefined}
    />;
  }

  const busy = writing || Boolean(pending);
  const stepButtonLabel = (action: PmStepAction, label: string) => action === 'invite'
    ? invitationEmailSending ? 'Sending invitation…' : selectedInvitation ? invitationButtonLabel(selectedInvitation) : label : label;
  const stepButtonDisabled = (action: PmStepAction) => busy || (action === 'invite' && (invitationEmailSending || inviteBlocked));
  const stepBar = detail && step ? <section className="pm-step" aria-label="Next step">
    <div className="pm-step__copy">
      {step.owner && <span className={`pm-step__owner pm-step__owner--${step.owner.toLowerCase()}`}>
        {step.owner === 'You' ? 'Your turn' : step.owner === 'Client' ? 'Waiting on the client' : 'With the developer'}</span>}
      <h3 className="pm-step__title">{step.title}</h3>
      {step.detail && <p className="pm-step__detail">{step.detail}</p>}
    </div>
    <div className="pm-step__actions">
      {step.alternative && <button type="button" className={secondary} disabled={stepButtonDisabled(step.alternative.action)}
        onClick={() => runStep(step.alternative!.action)}>{step.alternative.label}</button>}
      {step.primary && <button type="button" className={primary} disabled={stepButtonDisabled(step.primary.action)}
        onClick={() => runStep(step.primary!.action)}>
        {step.primary.action === 'invite' ? <Send size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
        {stepButtonLabel(step.primary.action, step.primary.label)}</button>}
      {moreActions.length > 0 && <details key={detail.id} open={actionMenuOpen}
        onToggle={event => setActionMenuOpen(event.currentTarget.open)} className="pm-tickets__more-actions">
        <summary>More<ChevronDown size={14} aria-hidden="true" /></summary>
        <div className="pm-tickets__action-menu">
          {moreActions.map(item => <button key={item.id} type="button" disabled={busy || item.disabled}
            onClick={() => { setActionMenuOpen(false); item.run(); }}>{item.label}</button>)}
        </div>
      </details>}
    </div>
  </section> : null;

  const pendingWrite = pending && <div className="pm-tickets__pending">
    <span>Unconfirmed {pending.label} · operation {pending.operationId.slice(0, 8)}…</span>
    <button onClick={async () => {
      const operation = pending;
      const succeeded = await performWrite(operation, operation.clearDraft);
      if (succeeded && operation.label === 'scope proposal') setScopeComposerOpen(false);
      if (succeeded && operation.label === 'work authorization') setHandoffOpen(false);
      if (succeeded && ['correction authorization', 'accepted ticket closure'].includes(operation.label)) setReviewAction(null);
    }} disabled={writing} className={secondary}>{writing ? 'Checking…' : 'Check and retry'}</button>
  </div>;

  if (workflowReference) return <section className="pm-tickets pm-tickets--embedded-workflow" ref={detailsElement} aria-label="Ticket workflow">
    {queueError && <p role="alert" className="pm-tickets__error">{queueError} <button type="button" onClick={() => void loadQueue()}>Retry</button></p>}
    {detailError && <p role="alert" className="pm-tickets__error">{detailError} <button type="button" onClick={() => setRefreshVersion(version => version + 1)}>Retry</button></p>}
    {writeError && <p role="alert" className="pm-tickets__error">{writeError}</p>}
    {invitationEmailError && <p role="alert" className="pm-tickets__error">{invitationEmailError}</p>}
    {pendingWrite}
    {(queuePending || detailLoading) && !detail && !queueError && !detailError && <p role="status" className="pm-rail-note">Loading ticket actions…</p>}
    {!queuePending && !detailLoading && !queueError && !detailError && !stepBar && <p className="pm-rail-note">No ticket actions available.</p>}
    {stepBar}
    {renderStepForms()}
  </section>;

  return <div className="pm-tickets pm-tickets--ticket-open pm-tickets--detail-only">
    <div className="pm-tickets__main">
    <section className="pm-tickets__workspace">
      {queueError && <p role="alert" className="pm-tickets__error">{queueError} <button type="button" onClick={() => void loadQueue()}>Retry</button></p>}
      <div role="region" aria-label="Ticket detail panel" className={`pm-tickets__detail${selectedId ? ' pm-tickets__detail--selected' : ''}`}>
        {!intakeEnabled ? <EmptyPanel title="Ticketing is coming soon" detail="Ticket details and conversations will be available when ticketing is connected." />
          : queuePending ? <TicketDetailSkeleton label="Loading ticket" />
          : !selectedId || !selectedQueueItem ? <EmptyPanel title="Ticket unavailable" detail="Open a request from its client or inquiry to view the ticket." />
          : (detail?.id !== selectedId && (detailLoading || !detailError)) ? <TicketDetailSkeleton label="Loading ticket" />
            : detailError && detail?.id !== selectedId ? <div role="alert" className="m-4 rounded-lg border border-status-danger-border bg-status-danger-subtle p-4 text-xs text-status-danger">{detailError}</div>
              : detail && selectedQueueItem && <div className="pm-tickets__detail-shell">
                {detailError && <div role="alert" className="pm-tickets__error">{detailError}</div>}
                <header className="pm-tickets__detail-header">
                  <div className="pm-tickets__detail-heading">
                    <div className="pm-tickets__detail-heading-copy">
                      <div className="pm-tickets__detail-meta">
                        <div className="pm-tickets__detail-identity"><TicketIcon size={16} aria-hidden="true" /><span className="pm-tickets__reference" title={detail.reference}>{detail.reference.length > 20 ? `${detail.reference.slice(0, 16)}…` : detail.reference}</span><span className={`pm-tickets__status ${statusStyle(detail.status)}`}>{statusLabel(detail.status)}</span></div>
                        <span className="pm-tickets__updated">Updated {time(detail.updatedAt)}</span>
                      </div>
                      <h2 ref={detailHeading} tabIndex={-1} className="pm-tickets__detail-title">{detail.title}</h2>
                      <p className="pm-tickets__ticket-context">{detail.internal.request?.contact?.fullName ?? selectedQueueItem.internal.clientGroup?.displayName ?? detail.companyLabel}
                        <span>·</span>{detail.internal.projectName ?? selectedQueueItem.internal.projectName ?? detail.request?.projectLabel ?? 'No project linked'}</p>
                    </div>
                  </div>
                  {invitationEmailError && <p role="alert" className="pm-tickets__detail-notice pm-tickets__detail-notice--error">{invitationEmailError}</p>}
                </header>

                {pendingWrite}



              {writeError && <div role="alert" className="pm-tickets__error">{writeError}</div>}
              <div className="pm-tickets__chat-layout role-chat-layout">
                <div className="pm-tickets__main-column">
                  {stepBar}
                  {renderStepForms()}
                  {(detail && renderRequestConversation?.({ detail, replyKind: messageAction, onReplyKindChange: setMessageAction,
                    onWritten: () => setRefreshVersion(version => version + 1) })) ?? renderConversation('conversation')}
                </div>
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

              </section>}

                {ticketSection === 'documents' && communicationEnabled && <section aria-label="Ticket documents" className="pm-tickets__documents-view">
                  <TicketDocumentsPanel api={documentsApi} ticketId={detail.id} heading="Shared files"
                    canUpload={false} showRefresh={false} refreshToken={`${refreshVersion}:${refreshToken ?? ''}`}
                    emptyMessage="No client files have been uploaded to this request yet."
                    readOnlyMessage="Only the client can upload files. You can download the files they share here." />
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
                    {onOpenClient && selectedQueueItem.internal.clientGroup?.key.startsWith('client:') && selectedQueueItem.internal.clientGroup.key !== fixedClientGroupKey && (
                      <button type="button" className="pm-tickets__context-link" onClick={() => onOpenClient(selectedQueueItem.internal.clientGroup!.key)}>
                        View client <ArrowUpRight size={13} aria-hidden="true" />
                      </button>
                    )}
                  </section>
                  <section className="pm-tickets__context-section">
                    <p className="pm-tickets__context-label">Project</p>
                    <p className="pm-tickets__context-value">{detail.internal.projectName ?? selectedQueueItem.internal.projectName ?? detail.request?.projectLabel ?? 'No project linked'}</p>
                    <p className="pm-tickets__context-detail">{detail.internal.projectId ? (detail.internal.projectClientVisible ? 'Client-visible project name' : 'PM-only project link') : 'Link a project when you start the work.'}</p>
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
                    <p className="pm-tickets__context-value pm-tickets__context-value--accent"><CircleDot size={14} aria-hidden="true" />{step?.title ?? selectedNextStep}</p>
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
